/**
 * Evolution Timeline Generator
 *
 * Generates visual timelines of evolution history showing:
 * - When capabilities were added
 * - Success rate trends over time
 * - Key milestones and achievements
 * - Velocity patterns (capabilities per day)
 *
 * This provides self-awareness about the evolution journey and helps
 * identify patterns in capability additions.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parseScorecardRows } from "./scorecard.js";

// Types

export interface TimelineEvent {
	date: string;
	type: "capability" | "reliability" | "feature" | "milestone";
	description: string;
	impact: "high" | "medium" | "low";
	enables: string[];
	skillsUsed: string[];
}

export interface TimelineDay {
	date: string;
	events: TimelineEvent[];
	capabilitiesAdded: number;
	successRate: number;
	averageTime: number;
}

export interface TimelinePhase {
	phaseNumber: number;
	name: string;
	startDate: string;
	endDate: string;
	capabilitiesCount: number;
	successRate: number;
	keyAchievements: string[];
}

export interface TimelineMilestone {
	date: string;
	title: string;
	description: string;
	significance: string;
}

export interface EvolutionTimeline {
	startDate: string;
	endDate: string;
	totalDays: number;
	totalCapabilities: number;
	totalReliability: number;
	totalFeatures: number;
	overallSuccessRate: number;
	averageVelocity: number;
	days: TimelineDay[];
	phases: TimelinePhase[];
	milestones: TimelineMilestone[];
	trends: {
		velocityTrend: "increasing" | "stable" | "decreasing";
		successTrend: "improving" | "stable" | "declining";
		timeTrend: "faster" | "stable" | "slower";
	};
}

export interface TimelineGeneratorConfig {
	includePhases: boolean;
	includeMilestones: boolean;
	includeTrends: boolean;
	maxDays: number;
	groupByWeek: boolean;
	memoryPath?: string;
}

export interface TimelineGeneratorStats {
	timelinesGenerated: number;
	eventsProcessed: number;
	phasesIdentified: number;
	milestonesFound: number;
	lastGenerationTime: string;
}

// Default configuration
const DEFAULT_CONFIG: TimelineGeneratorConfig = {
	includePhases: true,
	includeMilestones: true,
	includeTrends: true,
	maxDays: 90,
	groupByWeek: false,
	memoryPath: undefined,
};

/**
 * Evolution Timeline Generator
 * Generates visual timelines from MEMORY.md scorecard data
 */
export class EvolutionTimelineGenerator {
	private config: TimelineGeneratorConfig;
	private stats: TimelineGeneratorStats;
	private dataPath: string;

	constructor(config?: Partial<TimelineGeneratorConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.dataPath = path.join(process.env.HOME || "/tmp", ".paimon", "evolution-timeline.json");
		this.stats = {
			timelinesGenerated: 0,
			eventsProcessed: 0,
			phasesIdentified: 0,
			milestonesFound: 0,
			lastGenerationTime: new Date().toISOString(),
		};
		this.loadData();
	}

	private loadData(): void {
		try {
			if (fs.existsSync(this.dataPath)) {
				const data = JSON.parse(fs.readFileSync(this.dataPath, "utf-8"));
				this.stats = { ...this.stats, ...data.stats };
			}
		} catch {
			// Ignore errors
		}
	}

	private saveData(): void {
		try {
			const dir = path.dirname(this.dataPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(this.dataPath, JSON.stringify({ stats: this.stats }, null, 2));
		} catch {
			// Ignore errors
		}
	}

	/**
	 * Parse MEMORY.md scorecard to extract timeline events
	 */
	private parseScorecard(): TimelineEvent[] {
		const events: TimelineEvent[] = [];
		const memoryPath = this.config.memoryPath || path.join(process.cwd(), "MEMORY.md");

		try {
			if (!fs.existsSync(memoryPath)) return events;

			const content = fs.readFileSync(memoryPath, "utf-8");
			const rows = parseScorecardRows(content);

			for (const row of rows) {
				const event: TimelineEvent = {
					date: row.date.trim(),
					type: this.parseTaskType(row.taskType),
					description: row.description.trim(),
					impact: this.parseImpact(row.impact || "medium"),
					enables: row.enables
						? row.enables
								.split(",")
								.map((s) => s.trim())
								.filter(Boolean)
						: [],
					skillsUsed: row.skillsUsed
						? row.skillsUsed
								.split(",")
								.map((s) => s.trim())
								.filter(Boolean)
						: [],
				};

				events.push(event);
			}
		} catch (error) {
			console.error("Error parsing scorecard:", error);
		}

		return events;
	}

	private parseTaskType(type: string): TimelineEvent["type"] {
		const t = type.toLowerCase().trim();
		if (t.includes("capability")) return "capability";
		if (t.includes("reliability")) return "reliability";
		if (t.includes("feature")) return "feature";
		return "capability";
	}

	private parseImpact(impact: string): "high" | "medium" | "low" {
		const i = impact.toLowerCase().trim();
		if (i.includes("high")) return "high";
		if (i.includes("medium")) return "medium";
		return "low";
	}

	/**
	 * Group events by day
	 */
	private groupByDay(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
		const days = new Map<string, TimelineEvent[]>();

		for (const event of events) {
			const existing = days.get(event.date) || [];
			existing.push(event);
			days.set(event.date, existing);
		}

		return days;
	}

	/**
	 * Calculate daily statistics
	 */
	private calculateDayStats(date: string, events: TimelineEvent[]): TimelineDay {
		const capabilities = events.filter((e) => e.type === "capability").length;
		const highImpact = events.filter((e) => e.impact === "high").length;
		const successRate = (highImpact / Math.max(events.length, 1)) * 100;

		return {
			date,
			events,
			capabilitiesAdded: capabilities,
			successRate: Math.round(successRate),
			averageTime: 15, // Default estimate
		};
	}

	/**
	 * Identify milestones from events
	 */
	private identifyMilestones(events: TimelineEvent[]): TimelineMilestone[] {
		const milestones: TimelineMilestone[] = [];
		const seenMilestones = new Set<string>();

		// Track cumulative capabilities
		let totalCapabilities = 0;
		const eventsByDate = new Map<string, TimelineEvent[]>();

		for (const event of events) {
			const existing = eventsByDate.get(event.date) || [];
			existing.push(event);
			eventsByDate.set(event.date, existing);
		}

		// Sort dates
		const sortedDates = Array.from(eventsByDate.keys()).sort();

		for (const date of sortedDates) {
			const dayEvents = eventsByDate.get(date) || [];
			const newCapabilities = dayEvents.filter((e) => e.type === "capability").length;
			totalCapabilities += newCapabilities;

			// Milestone: First capability
			if (
				totalCapabilities === newCapabilities &&
				newCapabilities > 0 &&
				!seenMilestones.has("first")
			) {
				milestones.push({
					date,
					title: "🚀 First Capability",
					description: "First capability added to the system",
					significance: "Beginning of evolution journey",
				});
				seenMilestones.add("first");
			}

			// Milestone: 10 capabilities
			if (totalCapabilities >= 10 && !seenMilestones.has("10")) {
				milestones.push({
					date,
					title: "🎯 10 Capabilities",
					description: `Reached ${totalCapabilities} capabilities`,
					significance: "Foundation building phase complete",
				});
				seenMilestones.add("10");
			}

			// Milestone: 50 capabilities
			if (totalCapabilities >= 50 && !seenMilestones.has("50")) {
				milestones.push({
					date,
					title: "⭐ 50 Capabilities",
					description: `Reached ${totalCapabilities} capabilities`,
					significance: "Significant capability coverage achieved",
				});
				seenMilestones.add("50");
			}

			// Milestone: 100 capabilities
			if (totalCapabilities >= 100 && !seenMilestones.has("100")) {
				milestones.push({
					date,
					title: "🏆 100 Capabilities",
					description: `Reached ${totalCapabilities} capabilities`,
					significance: "Major evolution milestone",
				});
				seenMilestones.add("100");
			}
		}

		return milestones;
	}

	/**
	 * Identify phases from events
	 */
	private identifyPhases(events: TimelineEvent[]): TimelinePhase[] {
		const phases: TimelinePhase[] = [];
		const eventsByDate = new Map<string, TimelineEvent[]>();

		for (const event of events) {
			const existing = eventsByDate.get(event.date) || [];
			existing.push(event);
			eventsByDate.set(event.date, existing);
		}

		const sortedDates = Array.from(eventsByDate.keys()).sort();

		// Group events into phases based on ROADMAP phases
		// Each ~10 capabilities could be a phase
		let phaseNumber = 1;
		let phaseStart = sortedDates[0] || "";
		let phaseEvents: TimelineEvent[] = [];

		for (const date of sortedDates) {
			const dayEvents = eventsByDate.get(date) || [];
			phaseEvents.push(...dayEvents);

			const capabilitiesInPhase = phaseEvents.filter((e) => e.type === "capability").length;

			if (capabilitiesInPhase >= 10) {
				const highImpact = phaseEvents.filter((e) => e.impact === "high").length;
				phases.push({
					phaseNumber,
					name: `Phase ${phaseNumber}`,
					startDate: phaseStart,
					endDate: date,
					capabilitiesCount: capabilitiesInPhase,
					successRate: Math.round((highImpact / phaseEvents.length) * 100),
					keyAchievements: phaseEvents
						.filter((e) => e.impact === "high")
						.slice(0, 3)
						.map((e) => e.description.slice(0, 50)),
				});

				phaseNumber++;
				phaseStart = date;
				phaseEvents = [];
			}
		}

		// Add remaining events as last phase
		if (phaseEvents.length > 0) {
			const highImpact = phaseEvents.filter((e) => e.impact === "high").length;
			phases.push({
				phaseNumber,
				name: `Phase ${phaseNumber}`,
				startDate: phaseStart,
				endDate: sortedDates[sortedDates.length - 1] || phaseStart,
				capabilitiesCount: phaseEvents.filter((e) => e.type === "capability").length,
				successRate: Math.round((highImpact / Math.max(phaseEvents.length, 1)) * 100),
				keyAchievements: phaseEvents
					.filter((e) => e.impact === "high")
					.slice(0, 3)
					.map((e) => e.description.slice(0, 50)),
			});
		}

		return phases;
	}

	/**
	 * Calculate trends from events
	 */
	private calculateTrends(events: TimelineEvent[]): EvolutionTimeline["trends"] {
		const eventsByDate = new Map<string, TimelineEvent[]>();

		for (const event of events) {
			const existing = eventsByDate.get(event.date) || [];
			existing.push(event);
			eventsByDate.set(event.date, existing);
		}

		const sortedDates = Array.from(eventsByDate.keys()).sort();

		if (sortedDates.length < 3) {
			return {
				velocityTrend: "stable",
				successTrend: "stable",
				timeTrend: "stable",
			};
		}

		// Compare first half vs second half
		const midPoint = Math.floor(sortedDates.length / 2);
		const firstHalf = sortedDates.slice(0, midPoint);
		const secondHalf = sortedDates.slice(midPoint);

		// Velocity trend
		const firstHalfCaps = firstHalf.reduce(
			(sum, date) =>
				sum + (eventsByDate.get(date)?.filter((e) => e.type === "capability").length || 0),
			0,
		);
		const secondHalfCaps = secondHalf.reduce(
			(sum, date) =>
				sum + (eventsByDate.get(date)?.filter((e) => e.type === "capability").length || 0),
			0,
		);

		const velocityTrend: "increasing" | "stable" | "decreasing" =
			secondHalfCaps > firstHalfCaps * 1.2
				? "increasing"
				: secondHalfCaps < firstHalfCaps * 0.8
					? "decreasing"
					: "stable";

		// Success trend (high impact ratio)
		const firstHalfHigh = firstHalf.reduce(
			(sum, date) => sum + (eventsByDate.get(date)?.filter((e) => e.impact === "high").length || 0),
			0,
		);
		const secondHalfHigh = secondHalf.reduce(
			(sum, date) => sum + (eventsByDate.get(date)?.filter((e) => e.impact === "high").length || 0),
			0,
		);

		const successTrend: "improving" | "stable" | "declining" =
			secondHalfHigh > firstHalfHigh * 1.2
				? "improving"
				: secondHalfHigh < firstHalfHigh * 0.8
					? "declining"
					: "stable";

		return {
			velocityTrend,
			successTrend,
			timeTrend: "stable", // Would need time data to calculate
		};
	}

	/**
	 * Generate the evolution timeline
	 */
	generateTimeline(): EvolutionTimeline {
		const events = this.parseScorecard();

		if (events.length === 0) {
			return {
				startDate: new Date().toISOString().split("T")[0],
				endDate: new Date().toISOString().split("T")[0],
				totalDays: 0,
				totalCapabilities: 0,
				totalReliability: 0,
				totalFeatures: 0,
				overallSuccessRate: 0,
				averageVelocity: 0,
				days: [],
				phases: [],
				milestones: [],
				trends: {
					velocityTrend: "stable",
					successTrend: "stable",
					timeTrend: "stable",
				},
			};
		}

		// Sort events by date
		events.sort((a, b) => a.date.localeCompare(b.date));

		const eventsByDay = this.groupByDay(events);
		const days: TimelineDay[] = [];

		for (const [date, dayEvents] of eventsByDay) {
			days.push(this.calculateDayStats(date, dayEvents));
		}

		// Calculate totals
		const totalCapabilities = events.filter((e) => e.type === "capability").length;
		const totalReliability = events.filter((e) => e.type === "reliability").length;
		const totalFeatures = events.filter((e) => e.type === "feature").length;
		const highImpact = events.filter((e) => e.impact === "high").length;
		const overallSuccessRate = Math.round((highImpact / events.length) * 100);

		// Calculate velocity
		const uniqueDates = new Set(events.map((e) => e.date));
		const averageVelocity = Math.round(totalCapabilities / Math.max(uniqueDates.size, 1));

		// Get date range
		const sortedDates = Array.from(uniqueDates).sort();
		const startDate = sortedDates[0] || new Date().toISOString().split("T")[0];
		const endDate = sortedDates[sortedDates.length - 1] || startDate;

		// Generate phases and milestones
		const phases = this.config.includePhases ? this.identifyPhases(events) : [];
		const milestones = this.config.includeMilestones ? this.identifyMilestones(events) : [];
		const trends = this.config.includeTrends
			? this.calculateTrends(events)
			: {
					velocityTrend: "stable" as const,
					successTrend: "stable" as const,
					timeTrend: "stable" as const,
				};

		// Update stats
		this.stats.timelinesGenerated++;
		this.stats.eventsProcessed = events.length;
		this.stats.phasesIdentified = phases.length;
		this.stats.milestonesFound = milestones.length;
		this.stats.lastGenerationTime = new Date().toISOString();
		this.saveData();

		return {
			startDate,
			endDate,
			totalDays: uniqueDates.size,
			totalCapabilities,
			totalReliability,
			totalFeatures,
			overallSuccessRate,
			averageVelocity,
			days,
			phases,
			milestones,
			trends,
		};
	}

	/**
	 * Format timeline as a visual string
	 */
	formatTimeline(timeline: EvolutionTimeline): string {
		const lines: string[] = [
			"# Evolution Timeline",
			"",
			`**Period:** ${timeline.startDate} to ${timeline.endDate} (${timeline.totalDays} days)`,
			"",
			"## Summary",
			"",
			"| Metric | Value |",
			"|--------|-------|",
			`| Total Capabilities | ${timeline.totalCapabilities} |`,
			`| Total Reliability | ${timeline.totalReliability} |`,
			`| Total Features | ${timeline.totalFeatures} |`,
			`| Overall Success Rate | ${timeline.overallSuccessRate}% |`,
			`| Average Velocity | ${timeline.averageVelocity} caps/day |`,
			"",
		];

		// Trends
		if (this.config.includeTrends) {
			lines.push("## Trends", "");
			lines.push(`- **Velocity:** ${timeline.trends.velocityTrend}`);
			lines.push(`- **Success Rate:** ${timeline.trends.successTrend}`);
			lines.push(`- **Time Efficiency:** ${timeline.trends.timeTrend}`);
			lines.push("");
		}

		// Milestones
		if (this.config.includeMilestones && timeline.milestones.length > 0) {
			lines.push("## Milestones", "");
			for (const milestone of timeline.milestones) {
				lines.push(`### ${milestone.title}`);
				lines.push(`- **Date:** ${milestone.date}`);
				lines.push(`- **Description:** ${milestone.description}`);
				lines.push(`- **Significance:** ${milestone.significance}`);
				lines.push("");
			}
		}

		// Phases
		if (this.config.includePhases && timeline.phases.length > 0) {
			lines.push("## Phases", "");
			lines.push("| Phase | Period | Capabilities | Success Rate | Key Achievements |");
			lines.push("|-------|--------|--------------|--------------|------------------|");

			for (const phase of timeline.phases) {
				const achievements = phase.keyAchievements.slice(0, 2).join("; ").slice(0, 50);
				lines.push(
					`| ${phase.name} | ${phase.startDate} - ${phase.endDate} | ${phase.capabilitiesCount} | ${phase.successRate}% | ${achievements}... |`,
				);
			}
			lines.push("");
		}

		// Recent days
		lines.push("## Recent Activity (Last 10 Days)", "");
		const recentDays = timeline.days.slice(-10);

		if (recentDays.length === 0) {
			lines.push("No recent activity recorded.");
		} else {
			for (const day of recentDays) {
				const caps = day.capabilitiesAdded;
				const rate = day.successRate;
				lines.push(`### ${day.date}`);
				lines.push(`- Capabilities added: ${caps}`);
				lines.push(`- High-impact ratio: ${rate}%`);
				lines.push(`- Events: ${day.events.length}`);
				lines.push("");
			}
		}

		return lines.join("\n");
	}

	/**
	 * Get statistics
	 */
	getStats(): TimelineGeneratorStats {
		return { ...this.stats };
	}

	/**
	 * Update configuration
	 */
	updateConfig(updates: Partial<TimelineGeneratorConfig>): void {
		this.config = { ...this.config, ...updates };
	}

	/**
	 * Get configuration
	 */
	getConfig(): TimelineGeneratorConfig {
		return { ...this.config };
	}

	/**
	 * Reset statistics
	 */
	resetStats(): void {
		this.stats = {
			timelinesGenerated: 0,
			eventsProcessed: 0,
			phasesIdentified: 0,
			milestonesFound: 0,
			lastGenerationTime: new Date().toISOString(),
		};
		this.saveData();
	}
}

// Singleton instance
let timelineGeneratorInstance: EvolutionTimelineGenerator | null = null;

export function getEvolutionTimelineGenerator(): EvolutionTimelineGenerator {
	if (!timelineGeneratorInstance) {
		timelineGeneratorInstance = new EvolutionTimelineGenerator();
	}
	return timelineGeneratorInstance;
}

export function initEvolutionTimelineGenerator(
	config?: Partial<TimelineGeneratorConfig>,
): EvolutionTimelineGenerator {
	timelineGeneratorInstance = new EvolutionTimelineGenerator(config);
	return timelineGeneratorInstance;
}

// Tool interface
export interface EvolutionTimelineToolArgs {
	action: "generate" | "format" | "stats" | "config" | "reset" | "help";
	includePhases?: boolean;
	includeMilestones?: boolean;
	includeTrends?: boolean;
	groupByWeek?: boolean;
}

export function evolutionTimelineTool(args: EvolutionTimelineToolArgs): string {
	const generator = getEvolutionTimelineGenerator();

	switch (args.action) {
		case "generate": {
			const config: Partial<TimelineGeneratorConfig> = {};
			if (args.includePhases !== undefined) config.includePhases = args.includePhases;
			if (args.includeMilestones !== undefined) config.includeMilestones = args.includeMilestones;
			if (args.includeTrends !== undefined) config.includeTrends = args.includeTrends;
			if (args.groupByWeek !== undefined) config.groupByWeek = args.groupByWeek;

			if (Object.keys(config).length > 0) {
				generator.updateConfig(config);
			}

			const timeline = generator.generateTimeline();
			return generator.formatTimeline(timeline);
		}

		case "format": {
			const timeline = generator.generateTimeline();
			return generator.formatTimeline(timeline);
		}

		case "stats": {
			const stats = generator.getStats();
			return [
				"## Timeline Generator Statistics",
				"",
				`- Timelines Generated: ${stats.timelinesGenerated}`,
				`- Events Processed: ${stats.eventsProcessed}`,
				`- Phases Identified: ${stats.phasesIdentified}`,
				`- Milestones Found: ${stats.milestonesFound}`,
				`- Last Generation: ${stats.lastGenerationTime}`,
			].join("\n");
		}

		case "config": {
			const config = generator.getConfig();
			return [
				"## Timeline Generator Configuration",
				"",
				`- Include Phases: ${config.includePhases}`,
				`- Include Milestones: ${config.includeMilestones}`,
				`- Include Trends: ${config.includeTrends}`,
				`- Max Days: ${config.maxDays}`,
				`- Group By Week: ${config.groupByWeek}`,
			].join("\n");
		}

		case "reset": {
			generator.resetStats();
			return "Timeline generator statistics reset.";
		}

		case "help": {
			return [
				"# Evolution Timeline Tool",
				"",
				"Generate visual timelines of evolution history.",
				"",
				"## Actions",
				"",
				"- `generate` - Generate and format the evolution timeline",
				"- `format` - Format the current timeline",
				"- `stats` - View generator statistics",
				"- `config` - View generator configuration",
				"- `reset` - Reset statistics",
				"- `help` - Show this help message",
				"",
				"## Parameters",
				"",
				"- `includePhases` - Include phase breakdown (default: true)",
				"- `includeMilestones` - Include milestone markers (default: true)",
				"- `includeTrends` - Include trend analysis (default: true)",
				"- `groupByWeek` - Group events by week instead of day (default: false)",
				"",
				"## Example Usage",
				"",
				"```typescript",
				"evolutionTimeline({action: 'generate'})",
				"evolutionTimeline({action: 'generate', includePhases: false})",
				"evolutionTimeline({action: 'stats'})",
				"```",
			].join("\n");
		}

		default:
			return `Unknown action: ${args.action}. Use 'help' for available actions.`;
	}
}
