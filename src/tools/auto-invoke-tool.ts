/**
 * Auto-Invoke tool - Automatic skill invocation based on context
 *
 * Inspired by Claude Code's auto-invoke pattern:
 * - Automatically suggest skills based on detected context
 * - File patterns, keywords, tool usage, and task type triggers
 * - Confidence-based suggestions with thresholds
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { getAutoInvokeManager } from "../auto-invoke.js";
import type { AutoInvokeTrigger } from "../auto-invoke.js";

/**
 * Auto-Invoke tool - Suggest and manage automatic skill invocations
 */
export const autoInvokeTool: AgentTool = {
	name: "autoInvoke",
	label: "Auto-Invoke Skills",
	description: `Automatically suggest skills based on task context. Use to discover relevant skills for the current task.

Actions:
- analyze: Get skill suggestions based on current context (files, keywords, tools used, task type)
- list: List all auto-invoke rules
- get: Get details of a specific rule
- add: Add a custom auto-invoke rule
- remove: Remove a custom rule
- enable: Enable a rule
- disable: Disable a rule
- stats: View invocation statistics
- config: View configuration
- reset: Reset to defaults
- clear: Clear statistics

Example usage:
autoInvoke({action: 'analyze', files: ['src/styles.css'], keywords: ['frontend'], taskType: 'frontend'})
autoInvoke({action: 'list'})
autoInvoke({action: 'get', ruleId: 'frontend-work'})
`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action: analyze, list, get, add, remove, enable, disable, stats, config, reset, clear, record",
		}),
		files: Type.Optional(
			Type.Array(Type.String(), {
				description: "Files being worked on (for analyze action)",
			}),
		),
		keywords: Type.Optional(
			Type.Array(Type.String(), {
				description: "Keywords detected in task (for analyze action)",
			}),
		),
		toolsUsed: Type.Optional(
			Type.Array(Type.String(), {
				description: "Tools being used (for analyze action)",
			}),
		),
		taskType: Type.Optional(
			Type.String({
				description: "Task type: capability, reliability, feature, etc.",
			}),
		),
		taskDescription: Type.Optional(
			Type.String({
				description: "Task description (for analyze action)",
			}),
		),
		ruleId: Type.Optional(
			Type.String({
				description: "Rule ID for get, remove, enable, disable, record actions",
			}),
		),
		skill: Type.Optional(
			Type.String({
				description: "Skill name for add action",
			}),
		),
		triggers: Type.Optional(
			Type.Array(
				Type.Object({
					type: Type.String({
						description: "Trigger type: file_pattern, keyword, context, tool_usage",
					}),
					pattern: Type.String({ description: "Regex pattern to match" }),
					weight: Type.Number({ description: "Weight 0-1 for confidence calculation" }),
					description: Type.Optional(Type.String({ description: "Human-readable description" })),
				}),
			),
		),
		priority: Type.Optional(
			Type.Number({
				description: "Priority for rule (higher = more important)",
			}),
		),
		confidenceThreshold: Type.Optional(
			Type.Number({
				description: "Minimum confidence threshold (0-1)",
			}),
		),
		enabled: Type.Optional(
			Type.Boolean({
				description: "Whether rule is enabled",
			}),
		),
		description: Type.Optional(
			Type.String({
				description: "Description for add action",
			}),
		),
		successful: Type.Optional(
			Type.Boolean({
				description: "Whether invocation was successful (for record action)",
			}),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
		const manager = getAutoInvokeManager();
		const args = params as {
			action: string;
			files?: string[];
			keywords?: string[];
			toolsUsed?: string[];
			taskType?: string;
			taskDescription?: string;
			ruleId?: string;
			skill?: string;
			triggers?: AutoInvokeTrigger[];
			priority?: number;
			confidenceThreshold?: number;
			enabled?: boolean;
			description?: string;
			successful?: boolean;
		};

		try {
			switch (args.action) {
				case "analyze":
				case "suggest":
					return handleAnalyze(manager, args);

				case "list":
					return handleList(manager, args.enabled);

				case "get":
					return handleGet(manager, args.ruleId || "");

				case "add":
					return handleAdd(manager, args);

				case "remove":
					return handleRemove(manager, args.ruleId || "");

				case "enable":
					return handleEnable(manager, args.ruleId || "");

				case "disable":
					return handleDisable(manager, args.ruleId || "");

				case "stats":
					return handleStats(manager);

				case "config":
					return handleConfig(manager);

				case "reset":
					return handleReset(manager);

				case "clear":
					return handleClear(manager);

				case "record":
					return handleRecord(manager, args.ruleId || "", args.successful);

				default:
					return {
						content: [
							{
								type: "text",
								text: `Unknown action: ${args.action}. Valid actions: analyze, list, get, add, remove, enable, disable, stats, config, reset, clear, record`,
							},
						],
						details: `Unknown action: ${args.action}`,
					};
			}
		} catch (e) {
			const error = e instanceof Error ? e.message : String(e);
			return {
				content: [{ type: "text", text: `Error: ${error}` }],
				details: `Error: ${error}`,
			};
		}
	},
};

/**
 * Handle analyze action
 */
function handleAnalyze(
	manager: ReturnType<typeof getAutoInvokeManager>,
	args: {
		files?: string[];
		keywords?: string[];
		toolsUsed?: string[];
		taskType?: string;
		taskDescription?: string;
	},
): AgentToolResult<string> {
	if (!args.files && !args.keywords && !args.toolsUsed) {
		return {
			content: [
				{
					type: "text",
					text: "Error: At least one of files, keywords, or toolsUsed must be provided for analysis.",
				},
			],
			details: "Error: context required",
		};
	}

	const suggestions = manager.analyzeContext(
		args.files || [],
		args.keywords || [],
		args.toolsUsed || [],
		args.taskType,
		args.taskDescription,
	);

	if (suggestions.length === 0) {
		return {
			content: [{ type: "text", text: "No auto-invoke suggestions matched the current context." }],
			details: "No suggestions",
		};
	}

	let output = "🎯 Auto-Invoke Suggestions\n";
	output += `${"─".repeat(50)}\n\n`;

	for (const s of suggestions) {
		output += `**${s.rule.name}** → \`${s.rule.skill}\`\n`;
		output += `   Confidence: ${(s.confidence * 100).toFixed(1)}%\n`;
		output += `   Reason: ${s.reason}\n`;
		output += `   To use: \`read skills/${s.rule.skill}/SKILL.md\`\n\n`;
	}

	return {
		content: [{ type: "text", text: output }],
		details: `${suggestions.length} suggestions`,
	};
}

/**
 * Handle list action
 */
function handleList(
	manager: ReturnType<typeof getAutoInvokeManager>,
	enabledOnly?: boolean,
): AgentToolResult<string> {
	const rules = manager.listRules(enabledOnly);
	if (rules.length === 0) {
		return {
			content: [{ type: "text", text: "No auto-invoke rules configured." }],
			details: "No rules",
		};
	}

	let output = "📋 Auto-Invoke Rules\n";
	output += `${"─".repeat(50)}\n\n`;

	for (const r of rules) {
		const status = r.enabled ? "✅" : "❌";
		output += `${status} **${r.name}** (${r.skill})\n`;
		output += `   Priority: ${r.priority} | Threshold: ${r.confidenceThreshold} | Invokes: ${r.invokeCount}\n`;
	}

	output += `\nTotal: ${rules.length} rules, ${rules.filter((r) => r.enabled).length} enabled`;

	return {
		content: [{ type: "text", text: output }],
		details: `${rules.length} rules`,
	};
}

/**
 * Handle get action
 */
function handleGet(
	manager: ReturnType<typeof getAutoInvokeManager>,
	ruleId: string,
): AgentToolResult<string> {
	if (!ruleId) {
		return {
			content: [{ type: "text", text: "Error: ruleId is required for get action." }],
			details: "Error: ruleId required",
		};
	}

	const rule = manager.getRule(ruleId);
	if (!rule) {
		return {
			content: [{ type: "text", text: `Error: Rule '${ruleId}' not found.` }],
			details: `Rule not found: ${ruleId}`,
		};
	}

	let output = `📋 Auto-Invoke Rule: ${rule.name}\n`;
	output += `${"─".repeat(50)}\n`;
	output += `ID: ${rule.id}\n`;
	output += `Skill: ${rule.skill}\n`;
	output += `Description: ${rule.description}\n`;
	output += `Status: ${rule.enabled ? "Enabled" : "Disabled"}\n`;
	output += `Priority: ${rule.priority}\n`;
	output += `Confidence Threshold: ${rule.confidenceThreshold}\n`;
	output += `Created: ${rule.createdAt}\n`;
	output += `Last Invoked: ${rule.lastInvoked || "Never"}\n`;
	output += `Invoke Count: ${rule.invokeCount}\n\n`;

	output += "Triggers:\n";
	for (const t of rule.triggers) {
		output += `  - ${t.type}: ${t.pattern} (weight: ${t.weight})${t.description ? ` - ${t.description}` : ""}\n`;
	}

	return {
		content: [{ type: "text", text: output }],
		details: `Rule: ${ruleId}`,
	};
}

/**
 * Handle add action
 */
function handleAdd(
	manager: ReturnType<typeof getAutoInvokeManager>,
	args: {
		ruleId?: string;
		skill?: string;
		triggers?: AutoInvokeTrigger[];
		priority?: number;
		confidenceThreshold?: number;
		enabled?: boolean;
		description?: string;
	},
): AgentToolResult<string> {
	if (!args.ruleId || !args.skill || !args.triggers) {
		return {
			content: [
				{ type: "text", text: "Error: ruleId, skill, and triggers are required for add action." },
			],
			details: "Error: missing parameters",
		};
	}

	const rule = manager.addRule({
		id: args.ruleId,
		name: args.ruleId,
		description: args.description || `Auto-invoke ${args.skill} skill`,
		skill: args.skill,
		triggers: args.triggers,
		priority: args.priority || 5,
		enabled: args.enabled ?? true,
		confidenceThreshold: args.confidenceThreshold || 0.5,
	});

	return {
		content: [
			{
				type: "text",
				text: `✅ Added auto-invoke rule '${rule.id}' for skill '${rule.skill}' with ${rule.triggers.length} triggers.`,
			},
		],
		details: `Added rule: ${rule.id}`,
	};
}

/**
 * Handle remove action
 */
function handleRemove(
	manager: ReturnType<typeof getAutoInvokeManager>,
	ruleId: string,
): AgentToolResult<string> {
	if (!ruleId) {
		return {
			content: [{ type: "text", text: "Error: ruleId is required for remove action." }],
			details: "Error: ruleId required",
		};
	}

	const removed = manager.removeRule(ruleId);
	if (removed) {
		return {
			content: [{ type: "text", text: `✅ Removed auto-invoke rule '${ruleId}'.` }],
			details: `Removed: ${ruleId}`,
		};
	}
	return {
		content: [{ type: "text", text: `Error: Rule '${ruleId}' not found.` }],
		details: `Rule not found: ${ruleId}`,
	};
}

/**
 * Handle enable action
 */
function handleEnable(
	manager: ReturnType<typeof getAutoInvokeManager>,
	ruleId: string,
): AgentToolResult<string> {
	if (!ruleId) {
		return {
			content: [{ type: "text", text: "Error: ruleId is required for enable action." }],
			details: "Error: ruleId required",
		};
	}

	const enabled = manager.setRuleEnabled(ruleId, true);
	if (enabled) {
		return {
			content: [{ type: "text", text: `✅ Enabled auto-invoke rule '${ruleId}'.` }],
			details: `Enabled: ${ruleId}`,
		};
	}
	return {
		content: [{ type: "text", text: `Error: Rule '${ruleId}' not found.` }],
		details: `Rule not found: ${ruleId}`,
	};
}

/**
 * Handle disable action
 */
function handleDisable(
	manager: ReturnType<typeof getAutoInvokeManager>,
	ruleId: string,
): AgentToolResult<string> {
	if (!ruleId) {
		return {
			content: [{ type: "text", text: "Error: ruleId is required for disable action." }],
			details: "Error: ruleId required",
		};
	}

	const disabled = manager.setRuleEnabled(ruleId, false);
	if (disabled) {
		return {
			content: [{ type: "text", text: `✅ Disabled auto-invoke rule '${ruleId}'.` }],
			details: `Disabled: ${ruleId}`,
		};
	}
	return {
		content: [{ type: "text", text: `Error: Rule '${ruleId}' not found.` }],
		details: `Rule not found: ${ruleId}`,
	};
}

/**
 * Handle stats action
 */
function handleStats(manager: ReturnType<typeof getAutoInvokeManager>): AgentToolResult<string> {
	const stats = manager.getStats();

	let output = "📊 Auto-Invoke Statistics\n";
	output += `${"─".repeat(50)}\n`;
	output += `Total Invocations: ${stats.totalInvocations}\n`;
	output += `Successful Invocations: ${stats.successfulInvocations}\n`;
	output += `Success Rate: ${stats.totalInvocations > 0 ? ((stats.successfulInvocations / stats.totalInvocations) * 100).toFixed(1) : 0}%\n\n`;

	if (stats.topRules.length > 0) {
		output += "Top Rules:\n";
		for (const r of stats.topRules) {
			output += `  ${r.rule}: ${r.count} invocations\n`;
		}
	}

	return {
		content: [{ type: "text", text: output }],
		details: `${stats.totalInvocations} total invocations`,
	};
}

/**
 * Handle config action
 */
function handleConfig(manager: ReturnType<typeof getAutoInvokeManager>): AgentToolResult<string> {
	const config = manager.getConfig();

	let output = "⚙️ Auto-Invoke Configuration\n";
	output += `${"─".repeat(50)}\n`;
	output += `Enabled: ${config.enabled}\n`;
	output += `Max Suggestions: ${config.maxSuggestions}\n`;
	output += `Min Confidence: ${config.minConfidence}\n`;
	output += `Rules: ${config.rules.length} (${config.rules.filter((r) => r.enabled).length} enabled)`;

	return {
		content: [{ type: "text", text: output }],
		details: `Config: ${config.rules.length} rules`,
	};
}

/**
 * Handle reset action
 */
function handleReset(manager: ReturnType<typeof getAutoInvokeManager>): AgentToolResult<string> {
	manager.reset();
	return {
		content: [{ type: "text", text: "✅ Reset auto-invoke to default configuration." }],
		details: "Reset complete",
	};
}

/**
 * Handle clear action
 */
function handleClear(manager: ReturnType<typeof getAutoInvokeManager>): AgentToolResult<string> {
	manager.clearStats();
	return {
		content: [{ type: "text", text: "✅ Cleared auto-invoke statistics." }],
		details: "Stats cleared",
	};
}

/**
 * Handle record action
 */
function handleRecord(
	manager: ReturnType<typeof getAutoInvokeManager>,
	ruleId: string,
	successful?: boolean,
): AgentToolResult<string> {
	if (!ruleId) {
		return {
			content: [{ type: "text", text: "Error: ruleId is required for record action." }],
			details: "Error: ruleId required",
		};
	}

	manager.recordInvocation(ruleId, successful ?? true);
	return {
		content: [{ type: "text", text: `✅ Recorded invocation for rule '${ruleId}'.` }],
		details: `Recorded: ${ruleId}`,
	};
}
