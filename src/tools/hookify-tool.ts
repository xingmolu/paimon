/**
 * Hookify tool - Dynamic hook creation from conversation patterns
 *
 * Inspired by Claude Code's hookify plugin:
 * - Create custom hooks from conversation patterns or explicit instructions
 * - Simple markdown configuration files with YAML frontmatter
 * - Easy enable/disable without restarting
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { type ConversationMessage, type HookifyStats, getHookifyManager } from "../hookify.js";

/**
 * Hookify tool - Create and manage dynamic hooks from conversation patterns
 */
export const hookifyTool: AgentTool = {
	name: "hookify",
	label: "Dynamic Hook Creation",
	description: `Create and manage dynamic hooks from conversation patterns. Use to prevent unwanted behaviors by creating hooks from descriptions.

Actions:
- create: Create a new hookify rule from description (e.g., "Warn me when I use rm -rf commands")
- analyze: Analyze conversation to find problematic behaviors and suggest rules
- list: List all hookify rules
- enable: Enable a specific rule by name
- disable: Disable a specific rule by name
- delete: Delete a specific rule by name
- get: Get details of a specific rule
- stats: View statistics (blocked/warning counts, rules by event)
- clear: Clear all hookify rules
- help: Get help message

Example usage:
hookify({action: 'create', description: 'Warn me when I use rm -rf commands'})
hookify({action: 'analyze', messages: [{role: 'user', content: '...'}]})
hookify({action: 'list'})
hookify({action: 'enable', name: 'block-dangerous-rm'})
`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action: create, analyze, list, enable, disable, delete, get, stats, clear, help",
		}),
		description: Type.Optional(
			Type.String({
				description: "Description for create action (e.g., 'Warn me when I use rm -rf')",
			}),
		),
		name: Type.Optional(
			Type.String({
				description: "Rule name for enable/disable/delete/get actions",
			}),
		),
		messages: Type.Optional(
			Type.Array(
				Type.Object({
					role: Type.String({ description: "Message role: user or assistant" }),
					content: Type.String({ description: "Message content" }),
					action: Type.Optional(Type.String({ description: "Action name if applicable" })),
					error: Type.Optional(Type.String({ description: "Error if applicable" })),
				}),
			),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
		const manager = getHookifyManager();
		const { action, description, name, messages } = params as {
			action: string;
			description?: string;
			name?: string;
			messages?: ConversationMessage[];
		};

		try {
			switch (action) {
				case "create":
					return handleCreate(manager, description || "");

				case "analyze":
					return handleAnalyze(manager, messages || []);

				case "list":
					return handleList(manager);

				case "enable":
					return handleEnable(manager, name || "");

				case "disable":
					return handleDisable(manager, name || "");

				case "delete":
					return handleDelete(manager, name || "");

				case "get":
					return handleGet(manager, name || "");

				case "stats":
					return handleStats(manager);

				case "clear":
					return handleClear(manager);

				case "help":
					return handleHelp();

				default:
					return {
						content: [
							{
								type: "text",
								text: `Unknown action: ${action}. Use 'help' for available actions.`,
							},
						],
						details: `Unknown action: ${action}`,
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
 * Handle create action
 */
function handleCreate(
	manager: ReturnType<typeof getHookifyManager>,
	description: string,
): AgentToolResult<string> {
	if (!description) {
		return {
			content: [
				{
					type: "text",
					text: "Error: Please provide a description for the rule.\nExample: hookify({action: 'create', description: 'Warn me when I use rm -rf commands'})",
				},
			],
			details: "Error: description required",
		};
	}

	try {
		const rule = manager.createRule(description);
		const output = `✅ Created hookify rule: ${rule.config.name}

Event: ${rule.config.event}
Pattern: ${rule.config.pattern}
Action: ${rule.config.action}
File: ${rule.path}

The rule is now active and will ${rule.config.action === "block" ? "block" : "warn"} operations matching this pattern.
`;
		return {
			content: [{ type: "text", text: output }],
			details: `Created rule: ${rule.config.name}`,
		};
	} catch (error) {
		return {
			content: [
				{
					type: "text",
					text: `Error creating rule: ${error instanceof Error ? error.message : String(error)}`,
				},
			],
			details: `Error: ${error}`,
		};
	}
}

/**
 * Handle analyze action
 */
function handleAnalyze(
	manager: ReturnType<typeof getHookifyManager>,
	messages: ConversationMessage[],
): AgentToolResult<string> {
	if (messages.length === 0) {
		return {
			content: [
				{
					type: "text",
					text: "Error: Please provide messages to analyze.\nExample: hookify({action: 'analyze', messages: [{role: 'user', content: '...'}]})",
				},
			],
			details: "Error: messages required",
		};
	}

	const analysis = manager.analyzeConversation(messages);

	if (analysis.behaviors.length === 0) {
		return {
			content: [{ type: "text", text: "No problematic behaviors detected in the conversation." }],
			details: "No behaviors found",
		};
	}

	let output = "🔍 Conversation Analysis Results\n";
	output += `${"─".repeat(50)}\n`;
	output += `Detected ${analysis.behaviors.length} potential problematic behaviors:\n\n`;

	for (const behavior of analysis.behaviors) {
		const confidenceEmoji =
			behavior.confidence >= 80 ? "🔴" : behavior.confidence >= 50 ? "🟡" : "🟢";
		output += `${confidenceEmoji} ${behavior.description}\n`;
		output += `   Suggested pattern: ${behavior.pattern}\n`;
		output += `   Suggested action: ${behavior.action}\n`;
		output += `   Confidence: ${behavior.confidence}%\n\n`;
	}

	output += "\n💡 To create a rule from a detected behavior:\n";
	output += "hookify({action: 'create', description: 'Block <behavior>'})\n";

	return {
		content: [{ type: "text", text: output }],
		details: `Behaviors found: ${analysis.behaviors.length}`,
	};
}

/**
 * Handle list action
 */
function handleList(manager: ReturnType<typeof getHookifyManager>): AgentToolResult<string> {
	const output = manager.formatRulesList();
	return {
		content: [{ type: "text", text: output }],
		details: output,
	};
}

/**
 * Handle enable action
 */
function handleEnable(
	manager: ReturnType<typeof getHookifyManager>,
	name: string,
): AgentToolResult<string> {
	if (!name) {
		return {
			content: [
				{
					type: "text",
					text: "Error: Please provide a rule name.\nExample: hookify({action: 'enable', name: 'block-dangerous-rm'})",
				},
			],
			details: "Error: name required",
		};
	}

	if (manager.setRuleEnabled(name, true)) {
		return {
			content: [{ type: "text", text: `✅ Enabled hookify rule: ${name}` }],
			details: `Rule ${name} enabled`,
		};
	}
	return {
		content: [
			{ type: "text", text: `❌ Rule not found: ${name}. Use 'list' to see available rules.` },
		],
		details: `Rule ${name} not found`,
	};
}

/**
 * Handle disable action
 */
function handleDisable(
	manager: ReturnType<typeof getHookifyManager>,
	name: string,
): AgentToolResult<string> {
	if (!name) {
		return {
			content: [
				{
					type: "text",
					text: "Error: Please provide a rule name.\nExample: hookify({action: 'disable', name: 'block-dangerous-rm'})",
				},
			],
			details: "Error: name required",
		};
	}

	if (manager.setRuleEnabled(name, false)) {
		return {
			content: [{ type: "text", text: `✅ Disabled hookify rule: ${name}` }],
			details: `Rule ${name} disabled`,
		};
	}
	return {
		content: [
			{ type: "text", text: `❌ Rule not found: ${name}. Use 'list' to see available rules.` },
		],
		details: `Rule ${name} not found`,
	};
}

/**
 * Handle delete action
 */
function handleDelete(
	manager: ReturnType<typeof getHookifyManager>,
	name: string,
): AgentToolResult<string> {
	if (!name) {
		return {
			content: [
				{
					type: "text",
					text: "Error: Please provide a rule name.\nExample: hookify({action: 'delete', name: 'block-dangerous-rm'})",
				},
			],
			details: "Error: name required",
		};
	}

	if (manager.deleteRule(name)) {
		return {
			content: [{ type: "text", text: `✅ Deleted hookify rule: ${name}` }],
			details: `Rule ${name} deleted`,
		};
	}
	return {
		content: [
			{ type: "text", text: `❌ Rule not found: ${name}. Use 'list' to see available rules.` },
		],
		details: `Rule ${name} not found`,
	};
}

/**
 * Handle get action
 */
function handleGet(
	manager: ReturnType<typeof getHookifyManager>,
	name: string,
): AgentToolResult<string> {
	if (!name) {
		return {
			content: [
				{
					type: "text",
					text: "Error: Please provide a rule name.\nExample: hookify({action: 'get', name: 'block-dangerous-rm'})",
				},
			],
			details: "Error: name required",
		};
	}

	const rule = manager.getRule(name);
	if (!rule) {
		return {
			content: [
				{ type: "text", text: `❌ Rule not found: ${name}. Use 'list' to see available rules.` },
			],
			details: `Rule ${name} not found`,
		};
	}

	let output = `📋 Hookify Rule: ${name}\n`;
	output += `${"─".repeat(50)}\n`;
	output += `Event: ${rule.config.event}\n`;
	output += `Pattern: ${rule.config.pattern}\n`;
	output += `Action: ${rule.config.action}\n`;
	output += `Enabled: ${rule.config.enabled}\n`;
	output += `File: ${rule.path}\n\n`;
	output += `Message:\n${rule.message}\n`;

	return {
		content: [{ type: "text", text: output }],
		details: `Rule: ${name}, Event: ${rule.config.event}`,
	};
}

/**
 * Handle stats action
 */
function handleStats(manager: ReturnType<typeof getHookifyManager>): AgentToolResult<string> {
	const stats: HookifyStats = manager.getStats();

	let output = "📊 Hookify Statistics\n";
	output += `${"─".repeat(50)}\n`;
	output += `Total rules: ${stats.totalRules}\n`;
	output += `Enabled rules: ${stats.enabledRules}\n`;
	output += `Blocked operations: ${stats.blockedCount}\n`;
	output += `Warnings shown: ${stats.warningCount}\n\n`;

	output += "Rules by event type:\n";
	for (const [event, count] of Object.entries(stats.rulesByEvent)) {
		output += `  ${event}: ${count}\n`;
	}

	return {
		content: [{ type: "text", text: output }],
		details: `Total rules: ${stats.totalRules}`,
	};
}

/**
 * Handle clear action
 */
function handleClear(manager: ReturnType<typeof getHookifyManager>): AgentToolResult<string> {
	const count = manager.clearRules();
	return {
		content: [{ type: "text", text: `✅ Cleared ${count} hookify rules.` }],
		details: `Cleared ${count} rules`,
	};
}

/**
 * Handle help action
 */
function handleHelp(): AgentToolResult<string> {
	let output = "📖 Hookify - Dynamic Hook Creation\n";
	output += `${"─".repeat(50)}\n`;
	output += "Create custom hooks from conversation patterns.\n\n";

	output += "Actions:\n";
	output += "  create <description> - Create a new rule from description\n";
	output += "  analyze <messages>   - Analyze conversation for behaviors\n";
	output += "  list                 - List all rules\n";
	output += "  enable <name>        - Enable a rule\n";
	output += "  disable <name>       - Disable a rule\n";
	output += "  delete <name>        - Delete a rule\n";
	output += "  get <name>           - Get rule details\n";
	output += "  stats                - View statistics\n";
	output += "  clear                - Clear all rules\n";
	output += "  help                 - Show this help\n\n";

	output += "Examples:\n";
	output += "  hookify({action: 'create', description: 'Warn me when I use rm -rf commands'})\n";
	output += "  hookify({action: 'list'})\n";
	output += "  hookify({action: 'enable', name: 'block-dangerous-rm'})\n\n";

	output += "Common patterns:\n";
	output += "  - 'Block rm -rf commands'\n";
	output += "  - 'Warn when using console.log'\n";
	output += "  - 'Prevent modifications to .env files'\n";
	output += "  - 'Block git push --force'\n";

	return {
		content: [{ type: "text", text: output }],
		details: "Help message",
	};
}
