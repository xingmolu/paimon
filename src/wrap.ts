/**
 * Tool wrapping with PreToolUse hooks
 *
 * Wraps tools to check hooks before execution, enabling:
 * - Security validation (block dangerous commands)
 * - Warning messages (caution for risky operations)
 * - Proactive safety before tool execution
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import type { HookContext, HookManager } from "./hooks.js";

/**
 * Create wrapped tools with PreToolUse hooks
 * Each tool's execute function is wrapped to check hooks before execution
 *
 * @param tools - Array of tools to wrap
 * @param hookManager - Hook manager instance for executing hooks
 * @param onToolOutput - Optional callback for tracking tool output size
 * @returns Array of wrapped tools
 */
export function createWrappedTools(
	tools: AgentTool[],
	hookManager: HookManager,
	onToolOutput?: (size: number) => void,
): AgentTool[] {
	return tools.map((tool) => ({
		...tool,
		execute: async (toolCallId: string, params: unknown): Promise<AgentToolResult<unknown>> => {
			// Execute PreToolUse hooks
			const hookContext: HookContext = {
				tool: tool.name,
				params: params as Record<string, unknown>,
			};

			const hookResult = await hookManager.executeHooks("PreToolUse", hookContext);

			// If hook blocks, return block message instead of executing tool
			if (!hookResult.allow) {
				const blockMessage = `🚫 Hook blocked this action:\n${hookResult.block || "Unknown reason"}\n${hookResult.context || ""}`;
				return {
					content: [{ type: "text", text: blockMessage }],
					details: { blocked: true, hookResult },
				};
			}

			let result: AgentToolResult<unknown>;

			// If hook warns, add warning to output
			if (hookResult.warning) {
				result = await tool.execute(toolCallId, params);
				const warningPrefix = `⚠️ ${hookResult.warning}\n\n`;
				if (result.content?.[0] && result.content[0].type === "text") {
					result.content[0].text = warningPrefix + result.content[0].text;
				}
			} else {
				result = await tool.execute(toolCallId, params);
			}

			if (onToolOutput && result.content?.[0] && result.content[0].type === "text") {
				onToolOutput(Math.ceil(result.content[0].text.length / 4));
			}

			return result;
		},
	}));
}
