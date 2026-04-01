/**
 * Context Budget Tool - Tool interface for context budget monitoring.
 *
 * This tool exposes the ContextBudgetManager functionality to the agent,
 * enabling proactive context management before hitting limits.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type ContextBudgetConfig,
	type ContextBudgetHistoryEntry,
	ContextBudgetManager,
	type ContextBudgetStats,
	type ContextUsageStats,
	type OptimizationSuggestion,
	getGlobalContextBudgetManager,
} from "../context-budget.js";

/**
 * Context budget tool result.
 */
interface ContextBudgetResult {
	success: boolean;
	action: string;
	data?:
		| ContextUsageStats
		| ContextBudgetStats
		| OptimizationSuggestion[]
		| ContextBudgetConfig
		| ContextBudgetHistoryEntry[]
		| string;
	error?: string;
}

/**
 * Create the contextBudget tool.
 */
export const contextBudgetTool: AgentTool = {
	name: "contextBudget",
	label: "Context Budget Monitoring",
	description: `Monitor and manage context window usage proactively. Prevents context overflow by tracking token usage and providing warnings before hitting limits.

Actions:
- check: Get current context usage status (tokens, percentage, health)
- stats: Get comprehensive statistics including history and trends
- suggestions: Get optimization suggestions for reducing context usage
- config: View or update configuration (maxContextWindow, thresholds)
- update: Update current token estimate manually
- add: Add tokens to current estimate (after tool output)
- reset: Reset statistics (keep configuration)
- history: View recent context usage history

Usage:
contextBudget({action: 'check'}) // Check current usage
contextBudget({action: 'stats'}) // Get full statistics
contextBudget({action: 'suggestions'}) // Get optimization suggestions
contextBudget({action: 'config'}) // View configuration
contextBudget({action: 'config', maxContextWindow: 128000, warningThresholdPercent: 70}) // Update config`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: check, stats, suggestions, config, update, add, reset, history",
		}),
		tokens: Type.Optional(Type.Number({ description: "Token count for update/add actions" })),
		maxContextWindow: Type.Optional(
			Type.Number({ description: "Maximum context window tokens (for config update)" }),
		),
		warningThresholdPercent: Type.Optional(
			Type.Number({ description: "Warning threshold percentage (for config update)" }),
		),
		criticalThresholdPercent: Type.Optional(
			Type.Number({ description: "Critical threshold percentage (for config update)" }),
		),
		responseBufferTokens: Type.Optional(
			Type.Number({ description: "Response buffer tokens (for config update)" }),
		),
		enabled: Type.Optional(
			Type.Boolean({ description: "Enable/disable monitoring (for config update)" }),
		),
		limit: Type.Optional(Type.Number({ description: "Limit for history entries to return" })),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<ContextBudgetResult>> => {
		const manager = getGlobalContextBudgetManager();
		const p = params as Record<string, unknown>;
		const action = p.action as string;
		const result: ContextBudgetResult = {
			success: true,
			action,
		};

		try {
			switch (action) {
				case "check":
					result.data = manager.checkBudget("tool_call");
					break;

				case "stats":
					result.data = manager.getStats();
					break;

				case "suggestions":
					result.data = manager.getOptimizationSuggestions();
					break;

				case "config":
					if (
						p.maxContextWindow ||
						p.warningThresholdPercent ||
						p.criticalThresholdPercent ||
						p.responseBufferTokens ||
						p.enabled !== undefined
					) {
						const newConfig: Partial<ContextBudgetConfig> = {};
						if (p.maxContextWindow !== undefined) {
							newConfig.maxContextWindow = p.maxContextWindow as number;
						}
						if (p.warningThresholdPercent !== undefined) {
							newConfig.warningThresholdPercent = p.warningThresholdPercent as number;
						}
						if (p.criticalThresholdPercent !== undefined) {
							newConfig.criticalThresholdPercent = p.criticalThresholdPercent as number;
						}
						if (p.responseBufferTokens !== undefined) {
							newConfig.responseBufferTokens = p.responseBufferTokens as number;
						}
						if (p.enabled !== undefined) {
							newConfig.enabled = p.enabled as boolean;
						}
						manager.updateConfig(newConfig);
						result.data = `Configuration updated: ${JSON.stringify(newConfig)}`;
					} else {
						result.data = manager.getConfig();
					}
					break;

				case "update":
					if (p.tokens === undefined) {
						result.success = false;
						result.error = "tokens parameter required for update action";
					} else {
						manager.updateTokenEstimate(p.tokens as number);
						result.data = `Token estimate updated to ${p.tokens}`;
					}
					break;

				case "add":
					if (p.tokens === undefined) {
						result.success = false;
						result.error = "tokens parameter required for add action";
					} else {
						manager.addTokens(p.tokens as number);
						result.data = `Added ${p.tokens} tokens, current estimate: ${manager.getTokenEstimate()}`;
					}
					break;

				case "reset":
					manager.reset();
					result.data = "Context budget statistics reset";
					break;

				case "history": {
					const limit = (p.limit as number) || 20;
					const stats = manager.getStats();
					result.data = stats.history.slice(-limit);
					break;
				}

				default:
					result.success = false;
					result.error = `Unknown action: ${action}`;
			}
		} catch (error) {
			result.success = false;
			result.error = error instanceof Error ? error.message : String(error);
		}

		// Format output
		let output: string;
		if (result.success && result.data) {
			if (typeof result.data === "string") {
				output = `✅ ${result.data}`;
			} else {
				output = formatOutput(result.action, result.data);
			}
		} else if (result.error) {
			output = `❌ Error: ${result.error}`;
		} else {
			output = `✅ Action ${action} completed`;
		}

		return {
			content: [{ type: "text", text: output }],
			details: result,
		};
	},
};

/**
 * Create context budget tool function (for compatibility).
 */
export function createContextBudgetTool(): AgentTool {
	return contextBudgetTool;
}

/**
 * Format output based on action type.
 */
function formatOutput(action: string, data: unknown): string {
	if (action === "check" && isContextUsageStats(data)) {
		const stats = data as ContextUsageStats;
		const healthEmoji = {
			healthy: "✅",
			warning: "⚠️",
			critical: "🔴",
			overflow: "💥",
		}[stats.healthStatus];

		return `
## Context Budget Status

${healthEmoji} Health: ${stats.healthStatus.toUpperCase()}
Tokens: ${stats.currentTokens} / ${stats.maxAvailableTokens} (${Math.round(stats.usagePercent)}%)
Time: ${new Date(stats.timestamp).toISOString()}

### Recommendations
${stats.recommendations.map((r) => `- ${r}`).join("\n")}
`;
	}

	if (action === "stats" && isContextBudgetStats(data)) {
		const stats = data as ContextBudgetStats;
		const healthEmoji = {
			healthy: "✅",
			warning: "⚠️",
			critical: "🔴",
			overflow: "💥",
		}[stats.currentUsage.healthStatus];

		return `
## Context Budget Statistics

${healthEmoji} Current Health: ${stats.currentUsage.healthStatus.toUpperCase()}
Current Usage: ${stats.currentUsage.currentTokens} tokens (${Math.round(stats.currentUsage.usagePercent)}%)

### Metrics
- Total Checks: ${stats.totalChecks}
- Peak Usage: ${stats.peakUsage} tokens
- Average Usage: ${stats.averageUsage} tokens
- Warnings: ${stats.warningCount}
- Criticals: ${stats.criticalCount}
- Overflows: ${stats.overflowCount}

### Recent History (${stats.history.length} entries)
${stats.history
	.slice(-5)
	.map(
		(h) =>
			`- ${new Date(h.timestamp).toISOString()}: ${h.tokens} tokens (${Math.round(h.usagePercent)}%) - ${h.healthStatus}`,
	)
	.join("\n")}
`;
	}

	if (action === "suggestions" && Array.isArray(data)) {
		const suggestions = data as OptimizationSuggestion[];
		return `
## Context Optimization Suggestions

${suggestions.map((s) => `${s.priority}. **${s.action}**: ${s.description}\n   Estimated savings: ~${s.estimatedSavings} tokens`).join("\n\n")}
`;
	}

	if (action === "config" && isContextBudgetConfig(data)) {
		const config = data as ContextBudgetConfig;
		return `
## Context Budget Configuration

- Max Context Window: ${config.maxContextWindow} tokens
- Warning Threshold: ${config.warningThresholdPercent}%
- Critical Threshold: ${config.criticalThresholdPercent}%
- Response Buffer: ${config.responseBufferTokens} tokens
- Enabled: ${config.enabled}
`;
	}

	if (action === "history" && Array.isArray(data)) {
		const history = data as ContextBudgetHistoryEntry[];
		return `
## Context Budget History (${history.length} entries)

${history.map((h) => `- ${new Date(h.timestamp).toISOString()}: ${h.tokens} tokens (${Math.round(h.usagePercent)}%) - ${h.healthStatus} (${h.trigger})`).join("\n")}
`;
	}

	return JSON.stringify(data, null, 2);
}

/**
 * Type guards for output formatting.
 */
function isContextUsageStats(data: unknown): boolean {
	return (
		typeof data === "object" && data !== null && "healthStatus" in data && "currentTokens" in data
	);
}

function isContextBudgetStats(data: unknown): boolean {
	return (
		typeof data === "object" && data !== null && "totalChecks" in data && "currentUsage" in data
	);
}

function isContextBudgetConfig(data: unknown): boolean {
	return typeof data === "object" && data !== null && "maxContextWindow" in data;
}
