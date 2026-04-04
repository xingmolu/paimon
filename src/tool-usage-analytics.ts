/**
 * Tool Usage Analytics (Phase 73)
 *
 * Tracks tool usage patterns across evolution sessions to:
 * - Identify most/least used tools
 * - Track tool success rates by task type
 * - Suggest optimal tool combinations
 * - Detect underutilized tools
 * - Integrate with metrics and intelligence systems
 *
 * Inspired by Claude Code's tool analytics and OpenHands' usage tracking.
 */

import * as fs from "node:fs";
import * as path from "node:path";

// Types

export interface ToolUsageRecord {
	toolName: string;
	action?: string;
	timestamp?: string;
	sessionId?: string;
	taskType?: string;
	success: boolean;
	duration?: number;
	errorMessage?: string;
}

export interface ToolUsageStats {
	toolName: string;
	totalUses: number;
	successfulUses: number;
	failedUses: number;
	successRate: number;
	averageDuration: number;
	lastUsed: string;
	actions: Record<string, number>;
	taskTypes: Record<string, number>;
	commonErrors: string[];
}

export interface ToolCombination {
	tools: string[];
	coOccurrence: number;
	successRate: number;
	averageTime: number;
	taskTypes: string[];
}

export interface ToolUsageInsight {
	type: "underutilized" | "overused" | "high_failure" | "optimal" | "recommended";
	toolName: string;
	description: string;
	confidence: number;
	suggestion: string;
}

export interface ToolUsageAnalyticsConfig {
	enabled: boolean;
	dataPath: string;
	maxRecords: number;
	analysisWindow: number; // days
	minUsesForAnalysis: number;
}

export interface ToolUsageAnalyticsStats {
	totalRecords: number;
	uniqueTools: number;
	uniqueSessions: number;
	averageToolsPerSession: number;
	topTools: string[];
	insights: ToolUsageInsight[];
	lastAnalyzed: string;
}

// Default configuration
const DEFAULT_CONFIG: ToolUsageAnalyticsConfig = {
	enabled: true,
	dataPath: path.join(process.env.HOME || ".", ".paimon", "tool-usage-analytics.json"),
	maxRecords: 10000,
	analysisWindow: 30,
	minUsesForAnalysis: 5,
};

// Default recommended tools for each task type
const RECOMMENDED_TOOLS: Record<string, string[]> = {
	capability: ["read", "edit", "bash", "plan", "assess", "intelligence", "errorPatterns"],
	reliability: ["read", "edit", "bash", "grep", "assess", "selfHealing", "errorPatterns"],
	feature: ["read", "edit", "write", "bash", "plan", "assess", "featureDev"],
};

// Class
export class ToolUsageAnalyticsManager {
	private config: ToolUsageAnalyticsConfig;
	private records: ToolUsageRecord[] = [];
	private stats: ToolUsageAnalyticsStats;

	constructor(config?: Partial<ToolUsageAnalyticsConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.stats = {
			totalRecords: 0,
			uniqueTools: 0,
			uniqueSessions: 0,
			averageToolsPerSession: 0,
			topTools: [],
			insights: [],
			lastAnalyzed: "",
		};
		this.loadData();
	}

	/**
	 * Record a tool usage event
	 */
	recordUsage(record: ToolUsageRecord): void {
		if (!this.config.enabled) return;

		this.records.push({
			...record,
			timestamp: record.timestamp || new Date().toISOString(),
		});

		// Trim old records if needed
		if (this.records.length > this.config.maxRecords) {
			this.records = this.records.slice(-this.config.maxRecords);
		}

		this.saveData();
	}

	/**
	 * Get all tool usage statistics
	 */
	getToolStats(): ToolUsageStats[] {
		const toolData: Record<
			string,
			{
				uses: number;
				successes: number;
				failures: number;
				durations: number[];
				lastUsed: string;
				actions: Record<string, number>;
				taskTypes: Record<string, number>;
				errors: string[];
			}
		> = {};

		for (const record of this.records) {
			const tool = record.toolName;
			if (!toolData[tool]) {
				toolData[tool] = {
					uses: 0,
					successes: 0,
					failures: 0,
					durations: [],
					lastUsed: "",
					actions: {},
					taskTypes: {},
					errors: [],
				};
			}

			toolData[tool].uses++;
			if (record.success) {
				toolData[tool].successes++;
			} else {
				toolData[tool].failures++;
				if (record.errorMessage) {
					toolData[tool].errors.push(record.errorMessage);
				}
			}

			if (record.duration) {
				toolData[tool].durations.push(record.duration);
			}

			if (record.timestamp && record.timestamp > toolData[tool].lastUsed) {
				toolData[tool].lastUsed = record.timestamp;
			}

			if (record.action) {
				toolData[tool].actions[record.action] = (toolData[tool].actions[record.action] || 0) + 1;
			}

			if (record.taskType) {
				toolData[tool].taskTypes[record.taskType] =
					(toolData[tool].taskTypes[record.taskType] || 0) + 1;
			}
		}

		const stats: ToolUsageStats[] = [];
		for (const [toolName, data] of Object.entries(toolData)) {
			const avgDuration =
				data.durations.length > 0
					? data.durations.reduce((a, b) => a + b, 0) / data.durations.length
					: 0;

			// Get common errors (top 3)
			const errorCounts: Record<string, number> = {};
			for (const err of data.errors) {
				errorCounts[err] = (errorCounts[err] || 0) + 1;
			}
			const commonErrors = Object.entries(errorCounts)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 3)
				.map(([err]) => err.slice(0, 100)); // Truncate long errors

			stats.push({
				toolName,
				totalUses: data.uses,
				successfulUses: data.successes,
				failedUses: data.failures,
				successRate: (data.successes / data.uses) * 100,
				averageDuration: avgDuration,
				lastUsed: data.lastUsed,
				actions: data.actions,
				taskTypes: data.taskTypes,
				commonErrors,
			});
		}

		return stats.sort((a, b) => b.totalUses - a.totalUses);
	}

	/**
	 * Get statistics for a specific tool
	 */
	getToolStat(toolName: string): ToolUsageStats | undefined {
		return this.getToolStats().find((s) => s.toolName === toolName);
	}

	/**
	 * Get tool combinations (tools frequently used together)
	 */
	getToolCombinations(topN = 10): ToolCombination[] {
		const sessionTools: Record<string, Set<string>> = {};
		const sessionResults: Record<string, { success: boolean; time: number; taskType: string }> = {};

		// Group tools by session
		for (const record of this.records) {
			if (!record.sessionId) continue;

			if (!sessionTools[record.sessionId]) {
				sessionTools[record.sessionId] = new Set();
			}
			sessionTools[record.sessionId].add(record.toolName);

			if (!sessionResults[record.sessionId]) {
				sessionResults[record.sessionId] = {
					success: true,
					time: 0,
					taskType: record.taskType || "unknown",
				};
			}
			if (!record.success) {
				sessionResults[record.sessionId].success = false;
			}
			if (record.duration) {
				sessionResults[record.sessionId].time += record.duration;
			}
			if (record.taskType) {
				sessionResults[record.sessionId].taskType = record.taskType;
			}
		}

		// Count combinations
		const combinationCounts: Record<
			string,
			{
				count: number;
				successes: number;
				totalTime: number;
				taskTypes: Set<string>;
			}
		> = {};

		for (const [sessionId, tools] of Object.entries(sessionTools)) {
			const toolList = Array.from(tools).sort();
			const key = toolList.join(",");

			if (!combinationCounts[key]) {
				combinationCounts[key] = {
					count: 0,
					successes: 0,
					totalTime: 0,
					taskTypes: new Set(),
				};
			}

			combinationCounts[key].count++;
			if (sessionResults[sessionId].success) {
				combinationCounts[key].successes++;
			}
			combinationCounts[key].totalTime += sessionResults[sessionId].time;
			combinationCounts[key].taskTypes.add(sessionResults[sessionId].taskType);
		}

		// Convert to array and sort
		const combinations: ToolCombination[] = [];
		for (const [key, data] of Object.entries(combinationCounts)) {
			combinations.push({
				tools: key.split(","),
				coOccurrence: data.count,
				successRate: (data.successes / data.count) * 100,
				averageTime: data.totalTime / data.count,
				taskTypes: Array.from(data.taskTypes),
			});
		}

		return combinations
			.filter((c) => c.tools.length >= 2)
			.sort((a, b) => b.coOccurrence - a.coOccurrence)
			.slice(0, topN);
	}

	/**
	 * Analyze tool usage and generate insights
	 */
	analyzeUsage(): ToolUsageInsight[] {
		const insights: ToolUsageInsight[] = [];
		const stats = this.getToolStats();
		const totalUses = stats.reduce((sum, s) => sum + s.totalUses, 0);

		if (totalUses < this.config.minUsesForAnalysis) {
			return insights;
		}

		// Calculate average uses per tool
		const avgUses = totalUses / stats.length;

		for (const tool of stats) {
			// Underutilized tools
			if (tool.totalUses < avgUses * 0.2 && tool.totalUses > 0) {
				insights.push({
					type: "underutilized",
					toolName: tool.toolName,
					description: `Tool "${tool.toolName}" is used only ${tool.totalUses} times (${((tool.totalUses / totalUses) * 100).toFixed(1)}% of total)`,
					confidence: Math.min(100, 100 - (tool.totalUses / avgUses) * 100),
					suggestion: `Consider using ${tool.toolName} more often. It has a ${tool.successRate.toFixed(0)}% success rate.`,
				});
			}

			// High failure rate tools
			if (tool.successRate < 70 && tool.totalUses >= this.config.minUsesForAnalysis) {
				insights.push({
					type: "high_failure",
					toolName: tool.toolName,
					description: `Tool "${tool.toolName}" has a low success rate of ${tool.successRate.toFixed(1)}%`,
					confidence: Math.min(100, 100 - tool.successRate),
					suggestion: `Review usage patterns for ${tool.toolName}. Common errors: ${tool.commonErrors.slice(0, 2).join(", ")}`,
				});
			}

			// Optimal tools (high usage, high success)
			if (tool.totalUses > avgUses && tool.successRate > 90) {
				insights.push({
					type: "optimal",
					toolName: tool.toolName,
					description: `Tool "${tool.toolName}" is optimally used with ${tool.successRate.toFixed(1)}% success rate`,
					confidence: Math.min(100, tool.successRate),
					suggestion: `Continue using ${tool.toolName} as a core tool.`,
				});
			}
		}

		// Check for recommended tools not being used for task types
		for (const [taskType, recommended] of Object.entries(RECOMMENDED_TOOLS)) {
			const taskTools = stats
				.filter((s) => s.taskTypes[taskType] && s.taskTypes[taskType] > 0)
				.map((s) => s.toolName);

			for (const tool of recommended) {
				if (!taskTools.includes(tool)) {
					insights.push({
						type: "recommended",
						toolName: tool,
						description: `Tool "${tool}" is recommended for ${taskType} tasks but not used`,
						confidence: 80,
						suggestion: `Consider using ${tool} for ${taskType} tasks to improve efficiency.`,
					});
				}
			}
		}

		// Update stats
		this.stats.insights = insights;
		this.stats.lastAnalyzed = new Date().toISOString();

		return insights;
	}

	/**
	 * Get tool recommendations for a task
	 */
	getToolRecommendations(taskType: string, taskDescription?: string): string[] {
		const recommended = RECOMMENDED_TOOLS[taskType] || [];
		const stats = this.getToolStats();
		const insights = this.analyzeUsage();

		// Sort by success rate
		const toolSuccessRates: Record<string, number> = {};
		for (const tool of stats) {
			if (tool.successRate > 70) {
				toolSuccessRates[tool.toolName] = tool.successRate;
			}
		}

		// Start with recommended tools
		const recommendations = [...recommended];

		// Add tools with high success rate for this task type
		for (const tool of stats) {
			if (tool.taskTypes[taskType] && tool.taskTypes[taskType] > 0 && tool.successRate > 85) {
				if (!recommendations.includes(tool.toolName)) {
					recommendations.push(tool.toolName);
				}
			}
		}

		// Remove tools with low success rates
		const lowSuccessTools = insights
			.filter((i) => i.type === "high_failure")
			.map((i) => i.toolName);

		return recommendations.filter((t) => !lowSuccessTools.includes(t));
	}

	/**
	 * Get usage analytics stats
	 */
	getStats(): ToolUsageAnalyticsStats {
		const stats = this.getToolStats();
		const sessions = new Set(this.records.map((r) => r.sessionId).filter(Boolean));

		return {
			totalRecords: this.records.length,
			uniqueTools: stats.length,
			uniqueSessions: sessions.size,
			averageToolsPerSession: sessions.size > 0 ? this.records.length / sessions.size : 0,
			topTools: stats.slice(0, 10).map((s) => s.toolName),
			insights: this.stats.insights,
			lastAnalyzed: this.stats.lastAnalyzed,
		};
	}

	/**
	 * Get records within a time window
	 */
	getRecentRecords(days = 7): ToolUsageRecord[] {
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - days);

		return this.records.filter((r) => r.timestamp && new Date(r.timestamp) >= cutoff);
	}

	/**
	 * Format stats for display
	 */
	formatStats(): string {
		const stats = this.getToolStats();
		const analyticsStats = this.getStats();

		const lines: string[] = [
			"## Tool Usage Analytics",
			"",
			`**Total Records:** ${analyticsStats.totalRecords}`,
			`**Unique Tools:** ${analyticsStats.uniqueTools}`,
			`**Unique Sessions:** ${analyticsStats.uniqueSessions}`,
			`**Avg Tools/Session:** ${analyticsStats.averageToolsPerSession.toFixed(1)}`,
			"",
			"### Top Tools by Usage",
			"",
		];

		for (const tool of stats.slice(0, 10)) {
			const successIcon = tool.successRate >= 90 ? "✅" : tool.successRate >= 70 ? "⚠️" : "❌";
			lines.push(
				`- **${tool.toolName}**: ${tool.totalUses} uses, ${tool.successRate.toFixed(0)}% success ${successIcon}`,
			);
		}

		if (analyticsStats.insights.length > 0) {
			lines.push("", "### Insights", "");

			for (const insight of analyticsStats.insights.slice(0, 5)) {
				const icon =
					insight.type === "optimal"
						? "✅"
						: insight.type === "underutilized"
							? "💡"
							: insight.type === "high_failure"
								? "⚠️"
								: insight.type === "recommended"
									? "📌"
									: "ℹ️";
				lines.push(`${icon} **${insight.toolName}**: ${insight.description}`);
				lines.push(`   _Suggestion: ${insight.suggestion}_`);
			}
		}

		return lines.join("\n");
	}

	/**
	 * Format tool combinations
	 */
	formatCombinations(): string {
		const combinations = this.getToolCombinations();

		const lines: string[] = ["## Tool Combinations", "", "Tools frequently used together:", ""];

		for (const combo of combinations.slice(0, 10)) {
			const successIcon = combo.successRate >= 90 ? "✅" : combo.successRate >= 70 ? "⚠️" : "❌";
			lines.push(
				`- **${combo.tools.join(" + ")}**: ${combo.coOccurrence} sessions, ${combo.successRate.toFixed(0)}% success ${successIcon}`,
			);
		}

		return lines.join("\n");
	}

	/**
	 * Clear all records
	 */
	clearRecords(): void {
		this.records = [];
		this.stats = {
			totalRecords: 0,
			uniqueTools: 0,
			uniqueSessions: 0,
			averageToolsPerSession: 0,
			topTools: [],
			insights: [],
			lastAnalyzed: "",
		};
		this.saveData();
	}

	/**
	 * Export data
	 */
	exportData(): { records: ToolUsageRecord[]; stats: ToolUsageAnalyticsStats } {
		return {
			records: [...this.records],
			stats: this.getStats(),
		};
	}

	// Private methods

	private loadData(): void {
		try {
			if (fs.existsSync(this.config.dataPath)) {
				const content = fs.readFileSync(this.config.dataPath, "utf-8");
				const data = JSON.parse(content);
				this.records = data.records || [];
				this.stats = data.stats || this.stats;
			}
		} catch {
			// Start fresh on error
		}
	}

	private saveData(): void {
		try {
			const dir = path.dirname(this.config.dataPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}

			fs.writeFileSync(
				this.config.dataPath,
				JSON.stringify(
					{
						records: this.records,
						stats: this.stats,
						config: this.config,
					},
					null,
					2,
				),
			);
		} catch (error) {
			console.error("Failed to save tool usage analytics data:", error);
		}
	}
}

// Singleton instance
let analyticsInstance: ToolUsageAnalyticsManager | null = null;

/**
 * Get or create the analytics manager instance
 */
export function getToolUsageAnalyticsManager(
	config?: Partial<ToolUsageAnalyticsConfig>,
): ToolUsageAnalyticsManager {
	if (!analyticsInstance) {
		analyticsInstance = new ToolUsageAnalyticsManager(config);
	}
	return analyticsInstance;
}

/**
 * Initialize a new analytics manager
 */
export function initToolUsageAnalyticsManager(
	config?: Partial<ToolUsageAnalyticsConfig>,
): ToolUsageAnalyticsManager {
	analyticsInstance = new ToolUsageAnalyticsManager(config);
	return analyticsInstance;
}

/**
 * Reset the analytics manager
 */
export function resetToolUsageAnalyticsManager(): void {
	analyticsInstance = null;
}
