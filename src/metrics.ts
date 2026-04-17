/**
 * Evolution Metrics Dashboard (Phase 22)
 *
 * Tracks and visualizes evolution metrics over time:
 * - First-try success rate trends
 * - Time trends (average time per task)
 * - Error counts and patterns
 * - Skill effectiveness
 * - Capability velocity
 *
 * Inspired by OpenHands' analytics and Claude Code's tracking patterns.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parseScorecardRows } from "./scorecard.js";

// Types

export interface MetricPoint {
	date: string;
	value: number;
	trend?: "up" | "down" | "stable";
}

export interface SuccessRateMetric {
	current: number;
	points: MetricPoint[];
	weeklyAverage: number;
	improvement: number; // Percentage change from first measurement
}

export interface TimeMetric {
	averageMinutes: number;
	byTaskType: Record<string, number>;
	points: MetricPoint[];
	fastestTask: string;
	slowestTask: string;
}

export interface ErrorMetric {
	totalErrors: number;
	byType: Record<string, number>;
	recentErrors: string[];
	points: MetricPoint[];
	commonPatterns: string[];
}

export interface SkillMetric {
	skill: string;
	usageCount: number;
	successRate: number;
	averageTime: number;
	trend: "improving" | "declining" | "stable";
}

export interface CapabilityVelocityMetric {
	current: number; // capabilities per day
	points: MetricPoint[];
	totalCapabilities: number;
	highImpactCount: number;
	highImpactPercentage: number;
}

export interface EvolutionMetrics {
	successRate: SuccessRateMetric;
	time: TimeMetric;
	errors: ErrorMetric;
	skills: SkillMetric[];
	capabilityVelocity: CapabilityVelocityMetric;
	lastUpdated: string;
	iterationsAnalyzed: number;
}

export interface MetricsDashboardConfig {
	dataDir?: string;
	memoryFile?: string;
	daysLookback?: number;
}

interface SessionEntry {
	date: string;
	taskType: string;
	description: string;
	time: string;
	firstTry: string;
	errors: string;
	rework: string;
	impact: string;
	skillsUsed: string;
	enables: string;
}

// Class

export class EvolutionMetricsTracker {
	private config: MetricsDashboardConfig;
	private sessions: SessionEntry[] = [];
	private dataDir: string;
	private metricsFile: string;

	constructor(config: MetricsDashboardConfig = {}) {
		this.config = config;
		this.dataDir = config.dataDir || path.join(process.cwd(), "data");
		this.metricsFile = path.join(this.dataDir, "evolution-metrics.json");
		this.loadSessions();
	}

	/**
	 * Load sessions from MEMORY.md scorecard
	 */
	private loadSessions(): void {
		const memoryPath = this.config.memoryFile || path.join(process.cwd(), "MEMORY.md");

		if (!fs.existsSync(memoryPath)) {
			return;
		}

		const content = fs.readFileSync(memoryPath, "utf-8");
		this.sessions = parseScorecardRows(content).map((row) => {
			const firstTry = row.firstTry || row.result || "✅";
			const errors = row.errors || "none";

			return {
				date: row.date,
				taskType: row.taskType,
				description: row.description,
				time: row.time,
				firstTry,
				errors,
				rework: row.rework || (firstTry === "✅" ? "No" : "Yes"),
				impact: row.impact || "Low",
				skillsUsed: row.skillsUsed || "",
				enables: row.enables || "",
			};
		});
	}

	/**
	 * Parse time string like "~5m" or "~15m" to minutes
	 */
	private parseTime(timeStr: string): number {
		const match = timeStr.match(/~?(\d+)m?/);
		return match ? Number.parseInt(match[1], 10) : 0;
	}

	/**
	 * Calculate success rate metrics
	 */
	calculateSuccessRate(): SuccessRateMetric {
		if (this.sessions.length === 0) {
			return {
				current: 0,
				points: [],
				weeklyAverage: 0,
				improvement: 0,
			};
		}

		// Group by week
		const weeklyData: Record<string, { success: number; total: number }> = {};

		for (const session of this.sessions) {
			const week = this.getWeekKey(session.date);
			if (!weeklyData[week]) {
				weeklyData[week] = { success: 0, total: 0 };
			}
			weeklyData[week].total++;
			if (session.firstTry === "✅") {
				weeklyData[week].success++;
			}
		}

		// Build trend points
		const weeks = Object.keys(weeklyData).sort();
		const points: MetricPoint[] = weeks.map((week, idx) => {
			const rate = (weeklyData[week].success / weeklyData[week].total) * 100;
			const prevRate =
				idx > 0
					? (weeklyData[weeks[idx - 1]].success / weeklyData[weeks[idx - 1]].total) * 100
					: rate;
			const trend = rate > prevRate + 2 ? "up" : rate < prevRate - 2 ? "down" : "stable";
			return { date: week, value: rate, trend };
		});

		// Current success rate (last week)
		const currentWeek = weeks[weeks.length - 1];
		const current = points.length > 0 ? points[points.length - 1].value : 0;

		// Weekly average
		const totalSuccess = this.sessions.filter((s) => s.firstTry === "✅").length;
		const weeklyAverage = (totalSuccess / this.sessions.length) * 100;

		// Improvement from first to last
		const firstRate = points.length > 0 ? points[0].value : current;
		const improvement = current - firstRate;

		return {
			current,
			points,
			weeklyAverage,
			improvement,
		};
	}

	/**
	 * Calculate time metrics
	 */
	calculateTimeMetrics(): TimeMetric {
		if (this.sessions.length === 0) {
			return {
				averageMinutes: 0,
				byTaskType: {},
				points: [],
				fastestTask: "",
				slowestTask: "",
			};
		}

		// Calculate averages by task type
		const byType: Record<string, { times: number[]; descriptions: string[] }> = {};

		for (const session of this.sessions) {
			const type = session.taskType;
			const time = this.parseTime(session.time);
			if (!byType[type]) {
				byType[type] = { times: [], descriptions: [] };
			}
			byType[type].times.push(time);
			byType[type].descriptions.push(session.description);
		}

		const byTaskType: Record<string, number> = {};
		for (const [type, data] of Object.entries(byType)) {
			byTaskType[type] = data.times.reduce((a, b) => a + b, 0) / data.times.length;
		}

		// Weekly time trends
		const weeklyTimes: Record<string, number[]> = {};
		for (const session of this.sessions) {
			const week = this.getWeekKey(session.date);
			const time = this.parseTime(session.time);
			if (!weeklyTimes[week]) {
				weeklyTimes[week] = [];
			}
			weeklyTimes[week].push(time);
		}

		const weeks = Object.keys(weeklyTimes).sort();
		const points: MetricPoint[] = weeks.map((week, idx) => {
			const avg = weeklyTimes[week].reduce((a, b) => a + b, 0) / weeklyTimes[week].length;
			const prevAvg =
				idx > 0
					? weeklyTimes[weeks[idx - 1]].reduce((a, b) => a + b, 0) /
						weeklyTimes[weeks[idx - 1]].length
					: avg;
			const trend = avg < prevAvg - 1 ? "up" : avg > prevAvg + 1 ? "down" : "stable";
			return { date: week, value: avg, trend };
		});

		// Overall average
		const allTimes = this.sessions.map((s) => this.parseTime(s.time));
		const averageMinutes = allTimes.reduce((a, b) => a + b, 0) / allTimes.length;

		// Find fastest and slowest
		let fastestTime = Number.POSITIVE_INFINITY;
		let slowestTime = 0;
		let fastestTask = "";
		let slowestTask = "";

		for (const session of this.sessions) {
			const time = this.parseTime(session.time);
			if (time < fastestTime) {
				fastestTime = time;
				fastestTask = session.description;
			}
			if (time > slowestTime) {
				slowestTime = time;
				slowestTask = session.description;
			}
		}

		return {
			averageMinutes,
			byTaskType,
			points,
			fastestTask,
			slowestTask,
		};
	}

	/**
	 * Calculate error metrics
	 */
	calculateErrorMetrics(): ErrorMetric {
		if (this.sessions.length === 0) {
			return {
				totalErrors: 0,
				byType: {},
				recentErrors: [],
				points: [],
				commonPatterns: [],
			};
		}

		// Count errors by type
		const byType: Record<string, number> = {};
		const recentErrors: string[] = [];
		const errorPatterns: Record<string, number> = {};

		for (const session of this.sessions) {
			const error = session.errors;
			if (error && error !== "none") {
				// Track error type counts
				if (!byType[error]) {
					byType[error] = 0;
				}
				byType[error]++;

				// Track recent errors (last 10)
				if (recentErrors.length < 10) {
					recentErrors.push(`${session.date}: ${error} in "${session.description}"`);
				}

				// Track patterns
				const pattern = error.toLowerCase();
				if (!errorPatterns[pattern]) {
					errorPatterns[pattern] = 0;
				}
				errorPatterns[pattern]++;
			}
		}

		// Common patterns (sorted by frequency)
		const commonPatterns = Object.entries(errorPatterns)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([p]) => p);

		// Weekly error counts
		const weeklyErrors: Record<string, number> = {};
		for (const session of this.sessions) {
			const week = this.getWeekKey(session.date);
			if (!weeklyErrors[week]) {
				weeklyErrors[week] = 0;
			}
			if (session.errors && session.errors !== "none") {
				weeklyErrors[week]++;
			}
		}

		const weeks = Object.keys(weeklyErrors).sort();
		const points: MetricPoint[] = weeks.map((week, idx) => {
			const count = weeklyErrors[week];
			const prevCount = idx > 0 ? weeklyErrors[weeks[idx - 1]] : count;
			const trend = count < prevCount ? "up" : count > prevCount ? "down" : "stable";
			return { date: week, value: count, trend };
		});

		return {
			totalErrors: Object.values(byType).reduce((a, b) => a + b, 0),
			byType,
			recentErrors,
			points,
			commonPatterns,
		};
	}

	/**
	 * Calculate skill effectiveness metrics
	 */
	calculateSkillMetrics(): SkillMetric[] {
		if (this.sessions.length === 0) {
			return [];
		}

		// Aggregate skill data
		const skillData: Record<string, { uses: number; successes: number; times: number[] }> = {};

		for (const session of this.sessions) {
			const skills = session.skillsUsed
				.split(",")
				.map((s) => s.trim())
				.filter((s) => s);
			const success = session.firstTry === "✅";
			const time = this.parseTime(session.time);

			for (const skill of skills) {
				if (!skillData[skill]) {
					skillData[skill] = { uses: 0, successes: 0, times: [] };
				}
				skillData[skill].uses++;
				if (success) {
					skillData[skill].successes++;
				}
				skillData[skill].times.push(time);
			}
		}

		// Build metrics for each skill
		const metrics: SkillMetric[] = [];

		for (const [skill, data] of Object.entries(skillData)) {
			const successRate = (data.successes / data.uses) * 100;
			const averageTime = data.times.reduce((a, b) => a + b, 0) / data.times.length;

			// Determine trend (compare recent vs earlier)
			const recentUses = Math.min(5, data.uses);
			const earlierUses = data.uses - recentUses;
			if (earlierUses > 0) {
				// Simplified trend detection
				const trend = successRate >= 85 ? "improving" : successRate < 70 ? "declining" : "stable";
				metrics.push({
					skill,
					usageCount: data.uses,
					successRate,
					averageTime,
					trend,
				});
			} else {
				metrics.push({
					skill,
					usageCount: data.uses,
					successRate,
					averageTime,
					trend: "stable",
				});
			}
		}

		// Sort by usage count
		return metrics.sort((a, b) => b.usageCount - a.usageCount);
	}

	/**
	 * Calculate capability velocity metrics
	 */
	calculateCapabilityVelocity(): CapabilityVelocityMetric {
		if (this.sessions.length === 0) {
			return {
				current: 0,
				points: [],
				totalCapabilities: 0,
				highImpactCount: 0,
				highImpactPercentage: 0,
			};
		}

		// Count capabilities by week
		const weeklyCapabilities: Record<string, number[]> = { total: [], highImpact: [] };
		const dailyCapabilities: Record<string, number> = {};

		for (const session of this.sessions) {
			const week = this.getWeekKey(session.date);
			if (!weeklyCapabilities[week]) {
				weeklyCapabilities[week] = [];
			}

			if (session.taskType === "capability") {
				weeklyCapabilities[week].push(1);

				// Daily count
				const day = session.date;
				if (!dailyCapabilities[day]) {
					dailyCapabilities[day] = 0;
				}
				dailyCapabilities[day]++;
			}

			// High impact count
			if (session.impact === "High") {
				if (!weeklyCapabilities.highImpact) {
					weeklyCapabilities.highImpact = [];
				}
				weeklyCapabilities.highImpact.push(1);
			}
		}

		// Build trend points (capabilities per day by week)
		const weeks = Object.keys(weeklyCapabilities)
			.filter((w) => w !== "highImpact")
			.sort();

		const points: MetricPoint[] = weeks.map((week) => {
			const total = weeklyCapabilities[week].length;
			// Approximate days in week (simplified)
			const daysInWeek = 2; // Based on typical 2-day sprint patterns
			const velocity = total / daysInWeek;
			return { date: week, value: velocity };
		});

		// Total capabilities
		const totalCapabilities = this.sessions.filter((s) => s.taskType === "capability").length;

		// High impact count
		const highImpactCount = this.sessions.filter((s) => s.impact === "High").length;

		// High impact percentage
		const highImpactPercentage =
			totalCapabilities > 0 ? (highImpactCount / totalCapabilities) * 100 : 0;

		// Current velocity (last week)
		const current = points.length > 0 ? points[points.length - 1].value : 0;

		return {
			current,
			points,
			totalCapabilities,
			highImpactCount,
			highImpactPercentage,
		};
	}

	/**
	 * Get all metrics
	 */
	getMetrics(): EvolutionMetrics {
		return {
			successRate: this.calculateSuccessRate(),
			time: this.calculateTimeMetrics(),
			errors: this.calculateErrorMetrics(),
			skills: this.calculateSkillMetrics(),
			capabilityVelocity: this.calculateCapabilityVelocity(),
			lastUpdated: new Date().toISOString(),
			iterationsAnalyzed: this.sessions.length,
		};
	}

	/**
	 * Get week key from date string
	 */
	private getWeekKey(dateStr: string): string {
		// Parse date (format: YYYY-MM-DD)
		const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
		if (!match) {
			return dateStr;
		}

		const year = Number.parseInt(match[1], 10);
		const month = Number.parseInt(match[2], 10) - 1;
		const day = Number.parseInt(match[3], 10);

		const date = new Date(year, month, day);
		const weekNum = this.getWeekNumber(date);

		return `${year}-W${weekNum}`;
	}

	/**
	 * Get ISO week number
	 */
	private getWeekNumber(date: Date): number {
		const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
		const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
		return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
	}

	/**
	 * Save metrics to file
	 */
	saveMetrics(): void {
		const metrics = this.getMetrics();

		// Ensure data directory exists
		if (!fs.existsSync(this.dataDir)) {
			fs.mkdirSync(this.dataDir, { recursive: true });
		}

		fs.writeFileSync(this.metricsFile, JSON.stringify(metrics, null, 2));
	}

	/**
	 * Load saved metrics
	 */
	loadMetrics(): EvolutionMetrics | null {
		if (fs.existsSync(this.metricsFile)) {
			const content = fs.readFileSync(this.metricsFile, "utf-8");
			return JSON.parse(content) as EvolutionMetrics;
		}
		return null;
	}

	/**
	 * Refresh metrics (reload sessions and recalculate)
	 */
	refresh(): EvolutionMetrics {
		this.sessions = [];
		this.loadSessions();
		this.saveMetrics();
		return this.getMetrics();
	}
}

// Singleton instance
let metricsInstance: EvolutionMetricsTracker | null = null;

/**
 * Get or create metrics tracker instance
 */
export function getMetricsTracker(config?: MetricsDashboardConfig): EvolutionMetricsTracker {
	if (!metricsInstance) {
		metricsInstance = new EvolutionMetricsTracker(config);
	}
	return metricsInstance;
}

/**
 * Format metrics for display
 */
export function formatMetricsDashboard(metrics: EvolutionMetrics): string {
	const lines: string[] = [];

	lines.push("## Evolution Metrics Dashboard");
	lines.push("");
	lines.push(`**Iterations Analyzed:** ${metrics.iterationsAnalyzed}`);
	lines.push(`**Last Updated:** ${metrics.lastUpdated}`);
	lines.push("");

	// Success Rate Section
	lines.push("### First-Try Success Rate");
	lines.push("");
	lines.push(`**Current:** ${metrics.successRate.current.toFixed(1)}%`);
	lines.push(`**Weekly Average:** ${metrics.successRate.weeklyAverage.toFixed(1)}%`);
	lines.push(
		`**Improvement:** ${metrics.successRate.improvement >= 0 ? "+" : ""}${metrics.successRate.improvement.toFixed(1)}%`,
	);

	if (metrics.successRate.points.length > 0) {
		lines.push("");
		lines.push("**Weekly Trend:**");
		for (const point of metrics.successRate.points) {
			const trendIcon = point.trend === "up" ? "📈" : point.trend === "down" ? "📉" : "➡️";
			lines.push(`- ${point.date}: ${point.value.toFixed(1)}% ${trendIcon}`);
		}
	}
	lines.push("");

	// Time Section
	lines.push("### Average Time");
	lines.push("");
	lines.push(`**Overall:** ~${metrics.time.averageMinutes.toFixed(1)}m`);
	lines.push(`**Fastest Task:** "${metrics.time.fastestTask}"`);
	lines.push(`**Slowest Task:** "${metrics.time.slowestTask}"`);

	if (Object.keys(metrics.time.byTaskType).length > 0) {
		lines.push("");
		lines.push("**By Task Type:**");
		for (const [type, avg] of Object.entries(metrics.time.byTaskType)) {
			lines.push(`- ${type}: ~${avg.toFixed(1)}m`);
		}
	}
	lines.push("");

	// Errors Section
	lines.push("### Error Analysis");
	lines.push("");
	lines.push(`**Total Errors:** ${metrics.errors.totalErrors}`);

	if (Object.keys(metrics.errors.byType).length > 0) {
		lines.push("");
		lines.push("**By Error Type:**");
		for (const [type, count] of Object.entries(metrics.errors.byType)) {
			lines.push(`- ${type}: ${count}`);
		}
	}

	if (metrics.errors.commonPatterns.length > 0) {
		lines.push("");
		lines.push("**Common Patterns:**");
		for (const pattern of metrics.errors.commonPatterns) {
			lines.push(`- ${pattern}`);
		}
	}
	lines.push("");

	// Skills Section
	lines.push("### Skill Effectiveness");
	lines.push("");

	if (metrics.skills.length > 0) {
		for (const skill of metrics.skills.slice(0, 10)) {
			const trendIcon =
				skill.trend === "improving" ? "📈" : skill.trend === "declining" ? "📉" : "➡️";
			lines.push(
				`- **${skill.skill}**: ${skill.usageCount} uses, ${skill.successRate.toFixed(0)}% success, ~${skill.averageTime.toFixed(0)}m avg ${trendIcon}`,
			);
		}
	} else {
		lines.push("No skill data available.");
	}
	lines.push("");

	// Capability Velocity Section
	lines.push("### Capability Velocity");
	lines.push("");
	lines.push(`**Current:** ${metrics.capabilityVelocity.current.toFixed(1)} capabilities/day`);
	lines.push(`**Total Capabilities:** ${metrics.capabilityVelocity.totalCapabilities}`);
	lines.push(
		`**High Impact:** ${metrics.capabilityVelocity.highImpactCount} (${metrics.capabilityVelocity.highImpactPercentage.toFixed(0)}%)`,
	);

	if (metrics.capabilityVelocity.points.length > 0) {
		lines.push("");
		lines.push("**Weekly Velocity:**");
		for (const point of metrics.capabilityVelocity.points) {
			lines.push(`- ${point.date}: ${point.value.toFixed(1)} caps/day`);
		}
	}

	return lines.join("\n");
}

/**
 * Format success rate trend chart (ASCII)
 */
export function formatSuccessRateChart(metrics: EvolutionMetrics): string {
	const points = metrics.successRate.points;
	if (points.length === 0) {
		return "No data available.";
	}

	const lines: string[] = [];
	const maxHeight = 10;
	const width = points.length;

	// Find min/max values
	const values = points.map((p) => p.value);
	const minVal = Math.min(...values);
	const maxVal = Math.max(...values);
	const range = maxVal - minVal || 1;

	lines.push("## Success Rate Trend Chart");
	lines.push("");

	// Draw chart
	for (let row = maxHeight; row >= 0; row--) {
		const threshold = minVal + (range * row) / maxHeight;
		let rowStr = `${threshold.toFixed(0)}% |`;

		for (const point of points) {
			if (point.value >= threshold) {
				rowStr += " █";
			} else {
				rowStr += "  ";
			}
		}

		lines.push(rowStr);
	}

	// X-axis labels
	lines.push(`      ${points.map((p) => p.date.slice(-5)).join("  ")}`);

	return lines.join("\n");
}
