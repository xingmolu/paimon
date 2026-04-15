/**
 * Chat Modes Tool (Aider Pattern)
 *
 * Tool for managing different interaction modes:
 * - code: Make changes to code
 * - ask: Discuss without making changes
 * - architect: Architect proposes, editor implements
 * - help: Answer usage/configuration questions
 *
 * Usage:
 * chatModes({action: 'get'})                    // Get current mode
 * chatModes({action: 'set', mode: 'ask'})       // Set mode to ask
 * chatModes({action: 'code'})                   // Quick switch to code mode
 * chatModes({action: 'ask'})                    // Quick switch to ask mode
 * chatModes({action: 'architect'})              // Quick switch to architect mode
 * chatModes({action: 'help'})                   // Quick switch to help mode
 * chatModes({action: 'modes'})                  // List all modes
 * chatModes({action: 'workflow'})               // Get workflow guidance
 * chatModes({action: 'stats'})                  // View statistics
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { Static, TObject } from "@sinclair/typebox";
import type { ChatMode } from "../chat-modes.js";
import { ChatModesManager, getChatModesManager } from "../chat-modes.js";

// Parameter schemas
const ChatModesActionSchema = Type.Union([
	Type.Literal("get"),
	Type.Literal("set"),
	Type.Literal("code"),
	Type.Literal("ask"),
	Type.Literal("architect"),
	Type.Literal("help"),
	Type.Literal("modes"),
	Type.Literal("workflow"),
	Type.Literal("stats"),
	Type.Literal("config"),
	Type.Literal("reset"),
	Type.Literal("ok"),
]);

const ChatModesParamsSchema = Type.Object({
	action: ChatModesActionSchema,
	mode: Type.Optional(
		Type.Union([
			Type.Literal("code"),
			Type.Literal("ask"),
			Type.Literal("architect"),
			Type.Literal("help"),
		]),
	),
	reason: Type.Optional(Type.String()),
	limit: Type.Optional(Type.Number()),
	instructions: Type.Optional(Type.String()),
});

type ChatModesParams = Static<typeof ChatModesParamsSchema>;

// Tool definition
export const chatModesToolDefinition = {
	name: "chatModes",
	description: `Manage chat modes for different interaction styles (Aider Pattern)

Actions:
- get: Get current mode and its configuration
- set: Set mode explicitly (requires mode parameter)
- code: Quick switch to code mode (make changes to files)
- ask: Quick switch to ask mode (discuss without changes)
- architect: Quick switch to architect mode (plan then implement)
- help: Quick switch to help mode (usage/configuration help)
- ok: Accept proposed changes and proceed with implementation (optional instructions)
- modes: List all available modes with descriptions
- workflow: Get workflow guidance for ask/code workflow
- stats: View mode usage statistics
- config: View or update configuration
- reset: Reset to default mode (code)

Modes:
- code: Make changes to code to satisfy requests (default)
- ask: Discuss and answer questions without making changes
- architect: Architect proposes changes, editor model implements
- help: Answer questions about usage, configuration, troubleshooting

Usage:
chatModes({action: 'get'})                    // Get current mode
chatModes({action: 'set', mode: 'ask'})       // Set mode to ask
chatModes({action: 'code'})                   // Quick switch to code mode
chatModes({action: 'ask'})                    // Quick switch to ask mode
chatModes({action: 'ok'})                     // Accept proposed changes, proceed
chatModes({action: 'ok', instructions: 'also add tests'})  // With extra instructions
chatModes({action: 'workflow'})               // Get workflow guidance

Ask/Code Workflow:
A recommended workflow is to bounce between ask and code modes:
1. Use ask mode to discuss and plan
2. Switch to code mode to implement
3. Or use 'ok' action to quickly accept and proceed

Example:
chatModes({action: 'ask'})
// ... discuss approach ...
chatModes({action: 'ok'})
// Proceeds with implementation`,
	parameters: ChatModesParamsSchema,
};

// Execute function
export async function executeChatModes(params: ChatModesParams): Promise<string> {
	const manager = getChatModesManager();
	const { action, mode, reason, limit = 20, instructions } = params;

	switch (action) {
		case "get": {
			const currentMode = manager.getMode();
			const config = manager.getModeConfig(currentMode);
			const state = manager.getState();

			return `# Current Chat Mode: ${currentMode}

## Mode Configuration
- **Description**: ${config.description}
- **Allows File Changes**: ${config.allowsFileChanges ? "Yes" : "No"}
- **Allows Tool Execution**: ${config.allowsToolExecution ? "Yes" : "No"}
${config.recommendedModels ? `- **Recommended Models**: ${config.recommendedModels.join(", ")}` : ""}

## State
- **Previous Mode**: ${state.previousMode || "None"}
- **Mode Changes**: ${state.stats.totalModeChanges}

## System Prompt Suffix
\`\`\`
${config.systemPromptSuffix}
\`\`\`
`;
		}

		case "set": {
			if (!mode) {
				return "Error: 'mode' parameter required for set action. Use: chatModes({action: 'set', mode: 'ask'})";
			}
			manager.setMode(mode, reason);
			const config = manager.getModeConfig(mode);
			return `# Switched to ${mode.toUpperCase()} Mode

${config.description}

${config.systemPromptSuffix}
`;
		}

		case "code": {
			manager.setMode("code", reason);
			const config = manager.getModeConfig("code");
			return `# CODE Mode

${config.description}

You can now make changes to files. Be direct and efficient in your implementation.
`;
		}

		case "ask": {
			manager.setMode("ask", reason);
			const config = manager.getModeConfig("ask");
			return `# ASK Mode

${config.description}

${config.systemPromptSuffix}

You can read files to understand the codebase, but will NOT make any changes.
`;
		}

		case "architect": {
			manager.setMode("architect", reason);
			const config = manager.getModeConfig("architect");
			return `# ARCHITECT Mode

${config.description}

${config.systemPromptSuffix}

${
	config.recommendedModels
		? `**Recommended models for this mode**: ${config.recommendedModels.join(", ")}`
		: ""
}
`;
		}

		case "help": {
			manager.setMode("help", reason);
			const config = manager.getModeConfig("help");
			return `# HELP Mode

${config.description}

${config.systemPromptSuffix}

Ask questions about how to use the agent, configuration options, troubleshooting, and best practices.
`;
		}

		case "modes": {
			const modes = manager.getModes();
			const currentMode = manager.getMode();

			let output = "# Available Chat Modes\n\n";
			output += "| Mode | Description | File Changes | Recommended Models |\n";
			output += "|------|-------------|--------------|-------------------|\n";

			for (const { mode, config } of modes) {
				const current = mode === currentMode ? " ✓" : "";
				output += `| ${mode}${current} | ${config.description} | ${config.allowsFileChanges ? "Yes" : "No"} | ${config.recommendedModels?.join(", ") || "Any"} |\n`;
			}

			output += "\n## Quick Switch Commands\n";
			output += "- `chatModes({action: 'code'})` - Make changes to files\n";
			output += "- `chatModes({action: 'ask'})` - Discuss without changes\n";
			output += "- `chatModes({action: 'architect'})` - Plan then implement\n";
			output += "- `chatModes({action: 'help'})` - Usage/configuration help\n";

			return output;
		}

		case "workflow": {
			return manager.getWorkflowGuidance();
		}

		case "stats": {
			const stats = manager.getStats();
			const history = manager.getHistory(limit);

			let output = "# Chat Modes Statistics\n\n";
			output += "## Mode Usage\n";
			output += "| Mode | Count |\n";
			output += "|------|-------|\n";
			for (const [mode, count] of Object.entries(stats.modeUsage)) {
				output += `| ${mode} | ${count} |\n`;
			}

			output += "\n## Summary\n";
			output += `- **Total Mode Changes**: ${stats.totalModeChanges}\n`;
			output += `- **Ask/Code Workflow Transitions**: ${stats.askCodeWorkflowTransitions}\n`;
			output += `- **Architect Mode Sessions**: ${stats.architectModeSessions}\n`;
			output += `- **Help Mode Queries**: ${stats.helpModeQueries}\n`;
			output += `- **OK Command Usage**: ${stats.okCommandUsage}\n`;

			if (history.length > 0) {
				output += `\n## Recent Mode History (last ${Math.min(limit, history.length)})\n`;
				output += "| Mode | Timestamp | Reason |\n";
				output += "|------|-----------|--------|\n";
				for (const entry of history) {
					output += `| ${entry.mode} | ${entry.timestamp} | ${entry.reason || "-"} |\n`;
				}
			}

			return output;
		}

		case "config": {
			const config = manager.getConfig();
			return `# Chat Modes Configuration

- **Default Mode**: ${config.defaultMode}
- **Persist State**: ${config.persistState}
- **Mode Transition Logging**: ${config.modeTransitionLogging}

State is persisted to: ~/.paimon/chat-modes.json
`;
		}

		case "reset": {
			manager.reset();
			return `# Chat Modes Reset

Reset to default mode: code
Cleared all statistics and history.
`;
		}

		case "ok": {
			const currentMode = manager.getMode();
			const previousMode = manager.getState().previousMode;

			// Track ok command usage
			manager.trackOkUsage();

			// Switch to code mode if currently in ask mode
			if (currentMode === "ask") {
				manager.setMode("code", "ok: accepting proposed changes");
			}

			let output = "# ✓ OK - Proceeding with Implementation\n\n";

			if (currentMode === "ask") {
				output += "Switched from ASK mode to CODE mode.\n\n";
			}

			output += "The proposed changes will now be implemented.\n\n";

			if (params.instructions) {
				output += `**Additional Instructions**: ${params.instructions}\n\n`;
			}

			output += "---\n\n";
			output += "You can now proceed with the planned implementation. ";
			output += "Be direct and efficient in making the discussed changes to the codebase.\n\n";

			if (params.instructions) {
				output += `Remember to also: ${params.instructions}\n`;
			}

			return output;
		}

		default:
			return `Unknown action: ${action}. Valid actions: get, set, code, ask, architect, help, ok, modes, workflow, stats, config, reset`;
	}
}

// AgentTool wrapper
export const chatModesTool: AgentTool = {
	...chatModesToolDefinition,
	label: "Chat Modes Management",
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const result = await executeChatModes(params as ChatModesParams);
		return {
			content: [{ type: "text", text: result }],
			details: { action: (params as ChatModesParams).action },
		};
	},
};
