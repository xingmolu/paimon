/**
 * Hook tool - Manage hooks for pre-tool validation and safety checks
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { globalHookManager } from "../hooks.js";

/**
 * Hook tool - Manage hooks for pre-tool validation
 */
export const hookTool: AgentTool = {
	name: "hook",
	label: "Manage Hooks",
	description:
		"Create, list, enable, or disable hooks for pre-tool validation and safety checks. Hooks intercept tool calls before execution to prevent dangerous patterns.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: 'list' (show all hooks), 'enable' (enable hook), 'disable' (disable hook), 'status' (show global status), 'toggle' (toggle global hooks)",
		}),
		hookId: Type.Optional(
			Type.String({
				description: "Hook ID for enable/disable actions",
			}),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
		const { action, hookId } = params as {
			action: string;
			hookId?: string;
		};

		try {
			switch (action) {
				case "list": {
					const output = globalHookManager.formatHooksList();
					return {
						content: [{ type: "text", text: output }],
						details: output,
					};
				}

				case "status": {
					const enabled = globalHookManager.isEnabled();
					const hooks = globalHookManager.getHooks();
					const output = `Hook System Status: ${enabled ? "✅ Enabled" : "❌ Disabled"}\nTotal hooks: ${hooks.length}`;
					return {
						content: [{ type: "text", text: output }],
						details: output,
					};
				}

				case "enable": {
					if (!hookId) {
						return {
							content: [{ type: "text", text: "Error: 'hookId' is required for 'enable' action" }],
							details: "Error: hookId required",
						};
					}
					const success = globalHookManager.setHookEnabled(hookId, true);
					if (success) {
						return {
							content: [{ type: "text", text: `✅ Hook '${hookId}' enabled.` }],
							details: `Hook ${hookId} enabled`,
						};
					}
					return {
						content: [{ type: "text", text: `❌ Hook '${hookId}' not found.` }],
						details: `Hook ${hookId} not found`,
					};
				}

				case "disable": {
					if (!hookId) {
						return {
							content: [{ type: "text", text: "Error: 'hookId' is required for 'disable' action" }],
							details: "Error: hookId required",
						};
					}
					const success = globalHookManager.setHookEnabled(hookId, false);
					if (success) {
						return {
							content: [{ type: "text", text: `✅ Hook '${hookId}' disabled.` }],
							details: `Hook ${hookId} disabled`,
						};
					}
					return {
						content: [{ type: "text", text: `❌ Hook '${hookId}' not found.` }],
						details: `Hook ${hookId} not found`,
					};
				}

				case "toggle": {
					const currentState = globalHookManager.isEnabled();
					const newState = !currentState;
					globalHookManager.setEnabled(newState);
					return {
						content: [
							{ type: "text", text: `Hook system ${newState ? "✅ enabled" : "❌ disabled"}.` },
						],
						details: `Hook system ${newState ? "enabled" : "disabled"}`,
					};
				}

				default:
					return {
						content: [
							{
								type: "text",
								text: `Error: Unknown action '${action}'. Use: list, status, enable, disable, toggle`,
							},
						],
						details: `Error: Unknown action '${action}'`,
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
