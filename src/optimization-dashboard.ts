/**
 * Evolution Optimization Dashboard
 * Provides unified view of evolution metrics and recommendations.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import type { EvolutionMetrics, SkillMetric } from "./metrics.js";
import { getMetricsTracker } from "./metrics.js";
import type { ToolUsageStats } from "./tool-usage-analytics.js";
import { getToolUsageAnalyticsManager } from "./tool-usage-analytics.js";

export interface HealthComponents {
	successRate: number;
	timeEfficiency: number;
	errorRate: number;
	capabilityUtilization: number;
	memoryQuality: number;
}

export interface DashboardHealth {
	overallScore: number;
	status: "excellent" | "good" | "fair" | "poor";
	components: HealthComponents;
	trend: "improving" | "stable" | "declining";
	lastUpdated: string;
}

export interface CapabilityUtilization {
	tool: string;
	usageCount: number;
	successRate: number;
	avgTime: number;
	underutilized: boolean;
}

export interface Bottleneck {
	type: "slow-tool" | "high-error" | "low-utilization" | "memory-issues";
	name: string;
	impact: number;
	description: string;
	suggestion: string;
}

export interface OptimizationRecommendation {
	priority: "critical" | "high" | "medium" | "low";
	category: "performance" | "reliability" | "capability" | "memory";
	title: string;
	description: string;
	expectedImpact: string;
	effort: "simple" | "moderate" | "complex";
}

export interface SessionComparison {
	current: { successRate: number; avgTime: number; errorCount: number; capabilitiesUsed: number };
	average: { successRate: number; avgTime: number; errorCount: number; capabilitiesUsed: number };
	delta: { successRate: number; avgTime: number; errorCount: number; capabilitiesUsed: number };
	rating: "above_average" | "average" | "below_average";
}

export interface DashboardConfig {
	enabled: boolean;
	updateInterval: number;
	historySize: number;
	bottleneckThreshold: number;
	underutilizedThreshold: number;
}

export interface DashboardStats {
	totalViews: number;
	recommendationsGenerated: number;
	optimizationsApplied: number;
	healthHistory: Array<{ score: number; timestamp: string }>;
}

export interface OptimizationDashboardDependencies {
	metricsTracker?: {
		getMetrics(): EvolutionMetrics;
	};
	toolUsageAnalyticsManager?: {
		getToolStats(): ToolUsageStats[];
	};
}

interface EnablerRecommendationSignal {
	threshold: number;
	title: string;
	description: string;
	expectedImpact: string;
	effort: OptimizationRecommendation["effort"];
	priority: OptimizationRecommendation["priority"];
	enablers: string[];
}

export class OptimizationDashboardManager {
	private config: DashboardConfig;
	private stats: DashboardStats;
	private dataFile: string;
	private history: DashboardHealth[] = [];
	private readonly metricsTracker: { getMetrics(): EvolutionMetrics };
	private readonly toolUsageAnalyticsManager: { getToolStats(): ToolUsageStats[] };
	private readonly enablerSignals: Record<
		keyof HealthComponents,
		EnablerRecommendationSignal | null
	> = {
		successRate: {
			threshold: 90,
			title: "Strengthen self-assessment enablers",
			description:
				"Success rate is below target. Invest in capabilities that strengthen pre-merge verification and error recovery loops before adding more surface area.",
			expectedImpact: "Higher first-try success rate and fewer failed iterations",
			effort: "simple",
			priority: "high",
			enablers: ["self-assessment", "error-recovery", "reflection"],
		},
		timeEfficiency: {
			threshold: 75,
			title: "Improve planning and tool-chain enablers",
			description:
				"Iteration speed is lagging. Focus on planning and workflow enablers that reduce avoidable exploration and verification churn.",
			expectedImpact: "Shorter iteration cycles and more throughput per session",
			effort: "simple",
			priority: "medium",
			enablers: ["better-planning", "parallel-execution", "tool-chain-reliability"],
		},
		errorRate: {
			threshold: 85,
			title: "Expand error-recovery enablers",
			description:
				"Error pressure is elevated. Prioritize capabilities that turn recurring failures into faster recovery and prevention loops.",
			expectedImpact: "Lower rework and more resilient evolution sessions",
			effort: "simple",
			priority: "high",
			enablers: ["error-recovery", "self-healing", "error-patterns"],
		},
		capabilityUtilization: {
			threshold: 60,
			title: "Promote tool-discovery enablers",
			description:
				"Capability utilization is weak. Strengthen enablers that make the right tools easier to discover and reuse during execution.",
			expectedImpact: "Better leverage of existing capabilities and less redundant work",
			effort: "simple",
			priority: "medium",
			enablers: ["repo-map", "auto-invoke-skills", "unified-intelligence"],
		},
		memoryQuality: {
			threshold: 80,
			title: "Invest in memory-persistence enablers",
			description:
				"Memory-quality signals are weak. Prioritize enablers that improve capture, retrieval, and transfer of lessons across sessions.",
			expectedImpact: "Better task selection and stronger cross-session learning reuse",
			effort: "simple",
			priority: "high",
			enablers: ["memory-persistence", "rag", "learning-transfer"],
		},
	};

	constructor(dependencies: OptimizationDashboardDependencies = {}) {
		this.config = {
			enabled: true,
			updateInterval: 60000,
			historySize: 100,
			bottleneckThreshold: 50,
			underutilizedThreshold: 10,
		};
		this.dataFile = path.join(process.env.HOME || ".", ".paimon", "dashboard.json");
		this.stats = {
			totalViews: 0,
			recommendationsGenerated: 0,
			optimizationsApplied: 0,
			healthHistory: [],
		};
		this.metricsTracker = dependencies.metricsTracker ?? getMetricsTracker();
		this.toolUsageAnalyticsManager =
			dependencies.toolUsageAnalyticsManager ?? getToolUsageAnalyticsManager();
		this.readData();
	}

	private readData(): void {
		try {
			if (fs.existsSync(this.dataFile)) {
				const raw = fs.readFileSync(this.dataFile, "utf-8");
				const obj = JSON.parse(raw);
				this.config = { ...this.config, ...obj.config };
				this.stats = { ...this.stats, ...obj.stats };
				this.history = obj.history || [];
			}
		} catch {
			/* ignore */
		}
	}

	private writeData(): void {
		try {
			const dir = path.dirname(this.dataFile);
			if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
			fs.writeFileSync(
				this.dataFile,
				JSON.stringify(
					{
						config: this.config,
						stats: this.stats,
						history: this.history.slice(-this.config.historySize),
					},
					null,
					2,
				),
			);
		} catch (e) {
			console.error("Dashboard write error:", e);
		}
	}

	private clamp(value: number, min = 0, max = 100): number {
		return Math.max(min, Math.min(max, Math.round(value)));
	}

	private getMetrics(): EvolutionMetrics {
		return this.metricsTracker.getMetrics();
	}

	private getToolStats(): ToolUsageStats[] {
		try {
			return this.toolUsageAnalyticsManager.getToolStats();
		} catch {
			return [];
		}
	}

	private calculateTimeEfficiency(averageMinutes: number): number {
		if (averageMinutes <= 0) return 75;
		const baselineMinutes = 15;
		return this.clamp((baselineMinutes / averageMinutes) * 100);
	}

	private calculateMemoryQuality(metrics: EvolutionMetrics): number {
		const skillsScore =
			metrics.skills.length > 0
				? metrics.skills.reduce((sum, skill) => sum + skill.successRate, 0) / metrics.skills.length
				: 75;
		const iterationScore = Math.min(metrics.iterationsAnalyzed, 25) * 2;
		const capabilityScore = Math.min(metrics.capabilityVelocity.highImpactPercentage, 100);
		return this.clamp(skillsScore * 0.5 + iterationScore * 0.2 + capabilityScore * 0.3);
	}

	private isMeaningfulSkillName(skillName: string): boolean {
		const normalized = skillName.trim();
		if (!normalized) return false;
		if (/^-+$/.test(normalized)) return false;
		if (!/[a-zA-Z]/.test(normalized)) return false;
		return true;
	}

	private formatErrorPattern(pattern: string): string {
		return pattern
			.trim()
			.replace(/\s*\((fixed|auto-fixed)\)\s*/gi, "")
			.replace(/\s+/g, " ");
	}

	private getLowConfidenceSkills(metrics: EvolutionMetrics): SkillMetric[] {
		const deduplicatedSkills = new Map<string, SkillMetric>();
		for (const skill of metrics.skills) {
			if (skill.successRate >= 85 || !this.isMeaningfulSkillName(skill.skill)) {
				continue;
			}
			const normalizedName = skill.skill.trim().toLowerCase();
			const existing = deduplicatedSkills.get(normalizedName);
			if (!existing || skill.successRate < existing.successRate) {
				deduplicatedSkills.set(normalizedName, skill);
			}
		}
		return Array.from(deduplicatedSkills.values())
			.sort((a, b) => a.successRate - b.successRate)
			.slice(0, 2);
	}

	private getPrimaryErrorPattern(metrics: EvolutionMetrics): string | undefined {
		const formattedPatterns = metrics.errors.commonPatterns
			.map((pattern) => this.formatErrorPattern(pattern))
			.filter((pattern) => pattern && pattern !== "none");
		return formattedPatterns[0];
	}

	private formatEnablerList(enablers: string[]): string {
		if (enablers.length === 0) return "";
		if (enablers.length === 1) return enablers[0] ?? "";
		if (enablers.length === 2) return `${enablers[0]} and ${enablers[1]}`;
		return `${enablers.slice(0, -1).join(", ")}, and ${enablers[enablers.length - 1]}`;
	}

	private getEnablerRecommendations(health: HealthComponents): OptimizationRecommendation[] {
		const recommendations: OptimizationRecommendation[] = [];

		for (const [component, signal] of Object.entries(this.enablerSignals) as Array<
			[keyof HealthComponents, EnablerRecommendationSignal | null]
		>) {
			if (!signal) continue;
			if (health[component] >= signal.threshold) continue;
			recommendations.push({
				priority: signal.priority,
				category: "capability",
				title: signal.title,
				description: `${signal.description} Recommended enablers: ${this.formatEnablerList(signal.enablers)}.`,
				expectedImpact: signal.expectedImpact,
				effort: signal.effort,
			});
		}

		return recommendations;
	}

	private getMemoryRecommendations(
		metrics: EvolutionMetrics,
		memoryQuality: number,
	): OptimizationRecommendation[] {
		if (memoryQuality >= 80) {
			return [];
		}

		const recommendations: OptimizationRecommendation[] = [];
		const lowConfidenceSkills = this.getLowConfidenceSkills(metrics);
		const primaryErrorPattern = this.getPrimaryErrorPattern(metrics);
		const lowImpactRatio = Math.max(0, 100 - metrics.capabilityVelocity.highImpactPercentage);

		if (lowConfidenceSkills.length > 0) {
			const skillSummary = lowConfidenceSkills
				.map((skill) => `${skill.skill} (${Math.round(skill.successRate)}%)`)
				.join(", ");
			recommendations.push({
				priority: "high",
				category: "memory",
				title: "Capture reusable lessons from weak-signal skills",
				description: `Recent skill effectiveness suggests weaker learning capture around ${skillSummary}. Record what worked, what failed, and when to invoke these skills in MEMORY.md.`,
				expectedImpact: "Improves future skill selection and reduces repeated exploratory mistakes",
				effort: "simple",
			});
		}

		if (primaryErrorPattern) {
			recommendations.push({
				priority: "medium",
				category: "memory",
				title: "Turn recurring errors into reusable guardrails",
				description: `Recent iterations still show recurring ${primaryErrorPattern} errors. Capture a prevention checklist and preferred recovery steps so future sessions can avoid re-learning the same fix.`,
				expectedImpact: "Stronger cross-session transfer and fewer repeated recovery loops",
				effort: "simple",
			});
		}

		if (lowImpactRatio >= 25) {
			recommendations.push({
				priority: lowImpactRatio >= 40 ? "high" : "medium",
				category: "memory",
				title: "Record why recent work was lower impact",
				description: `Only ${Math.round(metrics.capabilityVelocity.highImpactPercentage)}% of recent capability work was marked high impact. Capture stronger rationale in MEMORY.md about what made recent tasks less leverageful and what future tasks should optimize for.`,
				expectedImpact: "Better task selection and clearer impact scoring in future iterations",
				effort: "simple",
			});
		}

		if (recommendations.length === 0) {
			recommendations.push({
				priority: "medium",
				category: "memory",
				title: "Strengthen learning capture",
				description:
					"Recent iteration history suggests memory quality or impact capture can improve.",
				expectedImpact: "Better task selection and stronger cross-session transfer",
				effort: "simple",
			});
		}

		return this.finalizeRecommendations(recommendations);
	}

	private getPriorityWeight(priority: OptimizationRecommendation["priority"]): number {
		return {
			critical: 4,
			high: 3,
			medium: 2,
			low: 1,
		}[priority];
	}

	private getEffortWeight(effort: OptimizationRecommendation["effort"]): number {
		return {
			simple: 1,
			moderate: 2,
			complex: 3,
		}[effort];
	}

	private finalizeRecommendations(
		recommendations: OptimizationRecommendation[],
	): OptimizationRecommendation[] {
		const merged = new Map<string, OptimizationRecommendation>();

		for (const recommendation of recommendations) {
			const key = `${recommendation.category}:${recommendation.title}`.toLowerCase();
			const existing = merged.get(key);
			if (!existing) {
				merged.set(key, { ...recommendation });
				continue;
			}

			const mergedRecommendation: OptimizationRecommendation = {
				...existing,
				priority:
					this.getPriorityWeight(recommendation.priority) >
					this.getPriorityWeight(existing.priority)
						? recommendation.priority
						: existing.priority,
				effort:
					this.getEffortWeight(recommendation.effort) > this.getEffortWeight(existing.effort)
						? recommendation.effort
						: existing.effort,
				expectedImpact:
					recommendation.expectedImpact.length > existing.expectedImpact.length
						? recommendation.expectedImpact
						: existing.expectedImpact,
				description:
					recommendation.description.length > existing.description.length
						? recommendation.description
						: existing.description,
			};
			merged.set(key, mergedRecommendation);
		}

		return Array.from(merged.values()).sort((a, b) => {
			const priorityDelta = this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority);
			if (priorityDelta !== 0) return priorityDelta;
			const effortDelta = this.getEffortWeight(a.effort) - this.getEffortWeight(b.effort);
			if (effortDelta !== 0) return effortDelta;
			return a.title.localeCompare(b.title);
		});
	}

	private calculateCapabilityUtilization(toolStats: ToolUsageStats[]): number {
		if (toolStats.length === 0) return 40;
		const activelyUsedTools = toolStats.filter(
			(tool) => tool.totalUses >= this.config.underutilizedThreshold,
		);
		const coverageScore = (activelyUsedTools.length / toolStats.length) * 100;
		const successScore =
			toolStats.reduce((sum, tool) => sum + tool.successRate, 0) / toolStats.length;
		return this.clamp(coverageScore * 0.6 + successScore * 0.4);
	}

	private getTrend(currentScore: number): DashboardHealth["trend"] {
		if (this.history.length < 2) return "stable";
		const recent = this.history.slice(-5).map((entry) => entry.overallScore);
		const prior = recent.slice(0, -1);
		if (prior.length === 0) return "stable";
		const priorAverage = prior.reduce((sum, value) => sum + value, 0) / prior.length;
		if (currentScore >= priorAverage + 3) return "improving";
		if (currentScore <= priorAverage - 3) return "declining";
		return "stable";
	}

	getHealth(): DashboardHealth {
		const metrics = this.getMetrics();
		const toolStats = this.getToolStats();
		const totalErrors = metrics.errors.totalErrors;
		const errorFreeRate =
			metrics.iterationsAnalyzed > 0
				? ((metrics.iterationsAnalyzed - totalErrors) / metrics.iterationsAnalyzed) * 100
				: 92;
		const components: HealthComponents = {
			successRate: this.clamp(
				metrics.successRate.current || metrics.successRate.weeklyAverage || 0,
			),
			timeEfficiency: this.calculateTimeEfficiency(metrics.time.averageMinutes),
			errorRate: this.clamp(errorFreeRate),
			capabilityUtilization: this.calculateCapabilityUtilization(toolStats),
			memoryQuality: this.calculateMemoryQuality(metrics),
		};
		const weights = {
			successRate: 0.3,
			timeEfficiency: 0.2,
			errorRate: 0.25,
			capabilityUtilization: 0.15,
			memoryQuality: 0.1,
		};
		const overallScore = this.clamp(
			components.successRate * weights.successRate +
				components.timeEfficiency * weights.timeEfficiency +
				components.errorRate * weights.errorRate +
				components.capabilityUtilization * weights.capabilityUtilization +
				components.memoryQuality * weights.memoryQuality,
		);
		const status: DashboardHealth["status"] =
			overallScore >= 90
				? "excellent"
				: overallScore >= 75
					? "good"
					: overallScore >= 50
						? "fair"
						: "poor";
		const trend = this.getTrend(overallScore);
		const health: DashboardHealth = {
			overallScore,
			status,
			components,
			trend,
			lastUpdated: new Date().toISOString(),
		};
		this.history.push(health);
		if (this.history.length > this.config.historySize) this.history.shift();
		this.stats.totalViews++;
		this.stats.healthHistory.push({ score: overallScore, timestamp: health.lastUpdated });
		if (this.stats.healthHistory.length > this.config.historySize) {
			this.stats.healthHistory = this.stats.healthHistory.slice(-this.config.historySize);
		}
		this.writeData();
		return health;
	}

	getCapabilityUtilization(): CapabilityUtilization[] {
		const toolStats = this.getToolStats();
		if (toolStats.length === 0) {
			return [];
		}

		return toolStats
			.map((tool) => ({
				tool: tool.toolName,
				usageCount: tool.totalUses,
				successRate: this.clamp(tool.successRate),
				avgTime: Math.round(tool.averageDuration),
				underutilized: tool.totalUses < this.config.underutilizedThreshold,
			}))
			.sort((a, b) => b.usageCount - a.usageCount);
	}

	identifyBottlenecks(): Bottleneck[] {
		const metrics = this.getMetrics();
		const result: Bottleneck[] = [];
		for (const tool of this.getCapabilityUtilization()) {
			if (tool.avgTime > this.config.bottleneckThreshold * 1000) {
				result.push({
					type: "slow-tool",
					name: tool.tool,
					impact: this.clamp(tool.avgTime / 1000),
					description: `${tool.tool} averages ${(tool.avgTime / 1000).toFixed(1)}s per use`,
					suggestion: "Optimize slow tool workflows or use it later in the iteration.",
				});
			}
			if (tool.successRate < 85) {
				result.push({
					type: "high-error",
					name: tool.tool,
					impact: this.clamp(100 - tool.successRate),
					description: `${tool.tool} succeeds only ${tool.successRate}% of the time`,
					suggestion: "Review recent failures and add safeguards or retries.",
				});
			}
			if (tool.underutilized) {
				result.push({
					type: "low-utilization",
					name: tool.tool,
					impact: this.clamp(this.config.underutilizedThreshold - tool.usageCount + 10),
					description: `${tool.tool} is available but rarely used`,
					suggestion: "Surface usage guidance or integrate it into common workflows.",
				});
			}
		}

		if (metrics.iterationsAnalyzed > 0 && metrics.capabilityVelocity.highImpactPercentage < 75) {
			result.push({
				type: "memory-issues",
				name: "memory-quality",
				impact: this.clamp(100 - metrics.capabilityVelocity.highImpactPercentage),
				description: "Recent iterations are producing fewer high-impact capabilities than usual",
				suggestion:
					"Prefer higher-leverage capability work and capture stronger learnings in MEMORY.md.",
			});
		}

		return result.sort((a, b) => b.impact - a.impact).slice(0, 5);
	}

	getRecommendations(): OptimizationRecommendation[] {
		const metrics = this.getMetrics();
		const health = this.getHealth();
		const recommendations: OptimizationRecommendation[] = [
			...this.getEnablerRecommendations(health.components),
		];

		if (health.components.timeEfficiency < 70) {
			recommendations.push({
				priority: "high",
				category: "performance",
				title: "Improve iteration speed",
				description: `Average iteration time is ~${metrics.time.averageMinutes.toFixed(1)} minutes, above the 15 minute target.`,
				expectedImpact: "Faster verification loops and more iterations per day",
				effort: "moderate",
			});
		}

		if (health.components.errorRate < 85) {
			recommendations.push({
				priority: "high",
				category: "reliability",
				title: "Reduce recurring errors",
				description: `Recent common errors: ${metrics.errors.commonPatterns.slice(0, 3).join(", ") || "insufficient data"}.`,
				expectedImpact: "Higher first-try success rate and less rework",
				effort: "moderate",
			});
		}

		const underutilizedCount = this.getCapabilityUtilization().filter(
			(tool) => tool.underutilized,
		).length;
		if (underutilizedCount > 0) {
			recommendations.push({
				priority: underutilizedCount >= 5 ? "high" : "medium",
				category: "capability",
				title: "Increase tool utilization",
				description: `${underutilizedCount} tools are underutilized based on recent tool analytics.`,
				expectedImpact: "Better capability leverage and improved task execution quality",
				effort: "simple",
			});
		}

		recommendations.push(
			...this.getMemoryRecommendations(metrics, health.components.memoryQuality),
		);

		const finalizedRecommendations = this.finalizeRecommendations(recommendations);
		this.stats.recommendationsGenerated += finalizedRecommendations.length;
		this.writeData();
		return finalizedRecommendations;
	}

	compareSession(cur: {
		successRate: number;
		avgTime: number;
		errorCount: number;
		capabilitiesUsed: number;
	}): SessionComparison {
		const metrics = this.getMetrics();
		const utilizations = this.getCapabilityUtilization();
		const avg = {
			successRate: this.clamp(
				metrics.successRate.current || metrics.successRate.weeklyAverage || 92,
			),
			avgTime: Math.round((metrics.time.averageMinutes || 15) * 60000),
			errorCount:
				metrics.iterationsAnalyzed > 0
					? Number((metrics.errors.totalErrors / metrics.iterationsAnalyzed).toFixed(1))
					: 1.2,
			capabilitiesUsed:
				utilizations.filter((tool) => !tool.underutilized).length || utilizations.length || 12,
		};
		const delta = {
			successRate: cur.successRate - avg.successRate,
			avgTime: cur.avgTime - avg.avgTime,
			errorCount: cur.errorCount - avg.errorCount,
			capabilitiesUsed: cur.capabilitiesUsed - avg.capabilitiesUsed,
		};
		const pos = [delta.successRate > 0, delta.avgTime < 0, delta.errorCount < 0].filter(
			Boolean,
		).length;
		const rating = pos >= 2 ? "above_average" : pos === 1 ? "average" : "below_average";
		return { current: cur, average: avg, delta, rating };
	}

	generateReport(): string {
		const health = this.getHealth();
		const utilizations = this.getCapabilityUtilization();
		const bottlenecks = this.identifyBottlenecks();
		const recommendations = this.getRecommendations();
		const statusIcon =
			health.status === "excellent"
				? "🟢"
				: health.status === "good"
					? "🟡"
					: health.status === "fair"
						? "🟠"
						: "🔴";
		const trendIcon =
			health.trend === "improving" ? "📈" : health.trend === "declining" ? "📉" : "➡️";
		let out = "# Evolution Optimization Dashboard\n\n";
		out += `${statusIcon} **Score:** ${health.overallScore}/100 (${health.status})\n${trendIcon} **Trend:** ${health.trend}\n\n`;
		out += "## Components\n\n| Component | Score |\n|-----------|-------|\n";
		for (const [key, value] of Object.entries(health.components)) out += `| ${key} | ${value} |\n`;
		out +=
			"\n## Utilization\n\n| Tool | Uses | Success | Avg Time (ms) |\n|------|------|---------|---------------|\n";
		for (const utilization of utilizations.slice(0, 5)) {
			out += `| ${utilization.tool} | ${utilization.usageCount} | ${utilization.successRate}% | ${utilization.avgTime} |\n`;
		}
		if (bottlenecks.length > 0) {
			out += "\n## Bottlenecks\n\n";
			for (const bottleneck of bottlenecks) {
				out += `- **${bottleneck.name}**: ${bottleneck.description}\n`;
			}
		}
		if (recommendations.length > 0) {
			out += "\n## Recommendations\n\n";
			for (const recommendation of recommendations) {
				out += `- **${recommendation.title}**: ${recommendation.description}\n`;
			}
		}
		return out;
	}

	getConfig(): DashboardConfig {
		return { ...this.config };
	}

	updateConfig(up: Partial<DashboardConfig>): DashboardConfig {
		this.config = { ...this.config, ...up };
		this.writeData();
		return this.getConfig();
	}

	getStats(): DashboardStats {
		return { ...this.stats, healthHistory: [...this.stats.healthHistory] };
	}

	resetStats(): void {
		this.stats = {
			totalViews: 0,
			recommendationsGenerated: 0,
			optimizationsApplied: 0,
			healthHistory: [],
		};
		this.history = [];
		this.writeData();
	}

	markApplied(): void {
		this.stats.optimizationsApplied++;
		this.writeData();
	}

	exportData(): {
		health: DashboardHealth;
		utilizations: CapabilityUtilization[];
		bottlenecks: Bottleneck[];
		recommendations: OptimizationRecommendation[];
	} {
		return {
			health: this.getHealth(),
			utilizations: this.getCapabilityUtilization(),
			bottlenecks: this.identifyBottlenecks(),
			recommendations: this.getRecommendations(),
		};
	}
}

let instance: OptimizationDashboardManager | null = null;
export function getOptimizationDashboardManager(): OptimizationDashboardManager {
	if (!instance) instance = new OptimizationDashboardManager();
	return instance;
}
export function resetOptimizationDashboardManager(): void {
	instance = null;
}
