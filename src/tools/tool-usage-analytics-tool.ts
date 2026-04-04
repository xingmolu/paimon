/**
 * Tool Usage Analytics Tool (Phase 73)
 *
 * Tool for tracking and analyzing tool usage patterns across evolution sessions.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";

import {
	type ToolUsageAnalyticsManager,
	getToolUsageAnalyticsManager,
	resetToolUsageAnalyticsManager,
} from "../tool-usage-analytics.js";

// Tool implementation
export const toolUsageAnalyticsTool: AgentTool = {
	name: "toolUsageAnalytics",
	label: "Tool Usage Analytics",
	description:
		"Track and analyze tool usage patterns across evolution sessions. Use to identify underutilized tools, high failure tools, and optimal tool combinations.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: record, stats, tool, combinations, insights, recommendations, recent, export, clear, reset, config, help",
		}),
		toolName: Type.Optional(
			Type.String({ description: "Tool name for specific tool stats (tool action)" }),
		),
		success: Type.Optional(
			Type.Boolean({ description: "Whether the tool use was successful (record action)" }),
		),
		actionName: Type.Optional(
			Type.String({ description: "Action name if applicable (record action)" }),
		),
		sessionId: Type.Optional(
			Type.String({ description: "Session ID for grouping (record action)" }),
		),
		taskType: Type.Optional(
			Type.String({
				description: "Task type (capability/reliability/feature) (record action)",
				enum: ["capability", "reliability", "feature"],
			}),
		),
		duration: Type.Optional(
			Type.Number({ description: "Duration of tool use in milliseconds (record action)" }),
		),
		errorMessage: Type.Optional(
			Type.String({ description: "Error message if failed (record action)" }),
		),
		days: Type.Optional(
			Type.Number({ description: "Number of days to look back (recent action, default: 7)" }),
		),
		topN: Type.Optional(
			Type.Number({
				description: "Number of results to return (combinations action, default: 10)",
			}),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
		const manager = getToolUsageAnalyticsManager();
		const p = params as Record<string, unknown>;
		const action = p.action as string;

		try {
			let result: string;
			switch (action) {
				case "record":
					result = handleRecord(manager, p);
					break;
				case "stats":
					result = manager.formatStats();
					break;
				case "tool":
					result = handleTool(manager, p);
					break;
				case "combinations":
					result = handleCombinations(manager, p);
					break;
				case "insights":
					result = handleInsights(manager);
					break;
				case "recommendations":
					result = handleRecommendations(manager, p);
					break;
				case "recent":
					result = handleRecent(manager, p);
					break;
				case "export":
					result = handleExport(manager);
					break;
				case "clear":
					result = handleClear(manager);
					break;
				case "reset":
					result = handleReset();
					break;
				case "config":
					result = handleConfig(manager);
					break;
				case "help":
					result = getHelpMessage();
					break;
				default:
					result = `Unknown action: ${action}. Use 'help' for available actions.`;
			}
			return { content: [{ type: "text", text: result }], details: result };
		} catch (error) {
			const errorMessage = `Error executing action '${action}': ${error instanceof Error ? error.message : String(error)}`;
			return { content: [{ type: "text", text: errorMessage }], details: errorMessage };
		}
	},
};

function handleRecord(manager: ToolUsageAnalyticsManager, params: Record<string, unknown>): string {
	const toolName = params.toolName as string;
	const success = (params.success as boolean) ?? true;

	if (!toolName) {
		return "Error: toolName is required for record action";
	}

	manager.recordUsage({
		toolName,
		action: params.actionName as string | undefined,
		sessionId: params.sessionId as string | undefined,
		taskType: params.taskType as string | undefined,
		success,
		duration: params.duration as number | undefined,
		errorMessage: params.errorMessage as string | undefined,
	});

	return `Recorded usage of tool "${toolName}" (${success ? "success" : "failure"})`;
}

function handleTool(manager: ToolUsageAnalyticsManager, params: Record<string, unknown>): string {
	const toolName = params.toolName as string;

	if (!toolName) {
		return "Error: toolName is required for tool action";
	}

	const toolStats = manager.getToolStat(toolName);
	if (!toolStats) {
		return `No stats found for tool "${toolName}"`;
	}

	const lines: string[] = [
		`## Tool Stats: ${toolStats.toolName}`,
		"",
		`**Total Uses:** ${toolStats.totalUses}`,
		`**Success Rate:** ${toolStats.successRate.toFixed(1)}%`,
		`**Successful Uses:** ${toolStats.successfulUses}`,
		`**Failed Uses:** ${toolStats.failedUses}`,
		`**Average Duration:** ${toolStats.averageDuration.toFixed(0)}ms`,
		`**Last Used:** ${toolStats.lastUsed || "N/A"}`,
	];

	if (Object.keys(toolStats.actions).length > 0) {
		lines.push("", "### Actions Used", "");
		for (const [action, count] of Object.entries(toolStats.actions)) {
			lines.push(`- ${action}: ${count} times`);
		}
	}

	if (Object.keys(toolStats.taskTypes).length > 0) {
		lines.push("", "### Used in Task Types", "");
		for (const [type, count] of Object.entries(toolStats.taskTypes)) {
			lines.push(`- ${type}: ${count} times`);
		}
	}

	if (toolStats.commonErrors.length > 0) {
		lines.push("", "### Common Errors", "");
		for (const err of toolStats.commonErrors) {
			lines.push(`- ${err}`);
		}
	}

	return lines.join("\n");
}

function handleCombinations(
	manager: ToolUsageAnalyticsManager,
	params: Record<string, unknown>,
): string {
	return manager.formatCombinations();
}

function handleInsights(manager: ToolUsageAnalyticsManager): string {
	const insights = manager.analyzeUsage();
	if (insights.length === 0) {
		return "No insights available yet. Use more tools to generate insights.";
	}

	const lines: string[] = ["## Tool Usage Insights", ""];

	// Group by type
	const byType: Record<string, typeof insights> = {};
	for (const insight of insights) {
		if (!byType[insight.type]) {
			byType[insight.type] = [];
		}
		byType[insight.type].push(insight);
	}

	for (const [type, typeInsights] of Object.entries(byType)) {
		const title =
			type === "underutilized"
				? "Underutilized Tools"
				: type === "high_failure"
					? "High Failure Rate Tools"
					: type === "optimal"
						? "Optimal Tools"
						: type === "recommended"
							? "Recommended Tools"
							: "Other Insights";
		lines.push(`### ${title}`, "");

		for (const insight of typeInsights) {
			lines.push(`- **${insight.toolName}** (${insight.confidence}% confidence)`);
			lines.push(`  ${insight.description}`);
			lines.push(`  _Suggestion: ${insight.suggestion}_`);
			lines.push("");
		}
	}

	return lines.join("\n");
}

function handleRecommendations(
	manager: ToolUsageAnalyticsManager,
	params: Record<string, unknown>,
): string {
	const taskType = params.taskType as string;

	if (!taskType) {
		return "Error: taskType is required for recommendations action. Use: capability, reliability, or feature.";
	}

	const recommendations = manager.getToolRecommendations(taskType);
	const lines: string[] = [
		`## Tool Recommendations for ${taskType} tasks`,
		"",
		"Based on historical usage patterns:",
		"",
	];

	for (const tool of recommendations) {
		const toolStats = manager.getToolStat(tool);
		if (toolStats) {
			lines.push(
				`- **${tool}**: ${toolStats.successRate.toFixed(0)}% success rate, ${toolStats.totalUses} uses`,
			);
		} else {
			lines.push(`- **${tool}**: recommended (no usage data yet)`);
		}
	}

	return lines.join("\n");
}

function handleRecent(manager: ToolUsageAnalyticsManager, params: Record<string, unknown>): string {
	const days = (params.days as number) ?? 7;
	const records = manager.getRecentRecords(days);
	const lines: string[] = [
		`## Recent Tool Usage (Last ${days} Days)`,
		"",
		`**Total Records:** ${records.length}`,
		"",
	];

	// Group by tool
	const byTool: Record<string, number> = {};
	for (const record of records) {
		byTool[record.toolName] = (byTool[record.toolName] || 0) + 1;
	}

	const sorted = Object.entries(byTool).sort((a, b) => b[1] - a[1]);
	for (const [tool, count] of sorted.slice(0, 15)) {
		lines.push(`- ${tool}: ${count} uses`);
	}

	return lines.join("\n");
}

function handleExport(manager: ToolUsageAnalyticsManager): string {
	const data = manager.exportData();
	return JSON.stringify(data, null, 2);
}

function handleClear(manager: ToolUsageAnalyticsManager): string {
	manager.clearRecords();
	return "Cleared all tool usage records.";
}

function handleReset(): string {
	resetToolUsageAnalyticsManager();
	return "Reset tool usage analytics manager.";
}

function handleConfig(manager: ToolUsageAnalyticsManager): string {
	const stats = manager.getStats();
	const lines: string[] = [
		"## Tool Usage Analytics Configuration",
		"",
		`**Total Records:** ${stats.totalRecords}`,
		`**Unique Tools:** ${stats.uniqueTools}`,
		`**Unique Sessions:** ${stats.uniqueSessions}`,
		`**Average Tools/Session:** ${stats.averageToolsPerSession.toFixed(1)}`,
		`**Last Analyzed:** ${stats.lastAnalyzed || "Never"}`,
	];
	return lines.join("\n");
}

function getHelpMessage(): string {
	return `## Tool Usage Analytics Help

Track and analyze tool usage patterns across evolution sessions.

### Actions

- **record** - Record a tool usage event
  - Required: toolName, success
  - Optional: actionName, sessionId, taskType, duration, errorMessage

- **stats** - Get overall tool usage statistics

- **tool** - Get statistics for a specific tool
  - Required: toolName

- **combinations** - Get frequently used tool combinations
  - Optional: topN (default: 10)

- **insights** - Get usage insights and recommendations

- **recommendations** - Get tool recommendations for a task type
  - Required: taskType (capability/reliability/feature)

- **recent** - Get recent tool usage records
  - Optional: days (default: 7)

- **export** - Export all data as JSON

- **clear** - Clear all records

- **reset** - Reset the analytics manager

- **config** - View current configuration

### Example Usage

\`\`\`typescript
// Record a tool usage
toolUsageAnalytics({action: 'record', toolName: 'edit', success: true, taskType: 'capability'})

// Get stats for a specific tool
toolUsageAnalytics({action: 'tool', toolName: 'assess'})

// Get tool recommendations for capability tasks
toolUsageAnalytics({action: 'recommendations', taskType: 'capability'})

// Get usage insights
toolUsageAnalytics({action: 'insights'})
\`\`\`
`;
}

export default toolUsageAnalyticsTool;
