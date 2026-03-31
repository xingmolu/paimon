/**
 * Stuck tool - Detect and recover from loops
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type HistoryMessage,
	type LoopType,
	type RecoveryOption,
	type StuckAnalysis,
	StuckDetector,
} from "../stuck.js";

// Global stuck detector instance
const stuckDetector = new StuckDetector();

/**
 * Stuck tool - Detect and recover from loops
 */
export const stuckTool: AgentTool = {
	name: "stuck",
	label: "Detect and Recover from Loops",
	description:
		"Check if agent is stuck in a loop and provide recovery options. Inspired by OpenHands' StuckDetector - detects repeated actions, same errors, or no progress.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: 'check' (detect if stuck), 'recover' (truncate to recovery point), 'add' (add message for detection), 'reset' (clear stuck state)",
		}),
		recoveryOption: Type.Optional(
			Type.Number({
				description:
					"Recovery option ID (1: restart before loop, 2: restart with last message, 3: quit)",
			}),
		),
		message: Type.Optional(
			Type.Object({
				role: Type.String({ description: "Message role: user, assistant, system" }),
				content: Type.String({ description: "Message content" }),
				action: Type.Optional(Type.String({ description: "Action name if applicable" })),
				error: Type.Optional(Type.String({ description: "Error message if applicable" })),
			}),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const { action, recoveryOption, message } = params as {
			action: string;
			recoveryOption?: number;
			message?: {
				role: string;
				content: string;
				action?: string;
				error?: string;
			};
		};

		try {
			switch (action) {
				case "check": {
					const isStuck = stuckDetector.isStuck();
					const analysis = stuckDetector.getStuckAnalysis();

					if (isStuck && analysis) {
						const options: RecoveryOption[] = [
							{
								id: 1,
								description: "Restart from before the loop began",
								action: "restart_before_loop",
							},
							{
								id: 2,
								description: "Restart with the last user message",
								action: "restart_with_last_message",
							},
							{
								id: 3,
								description: "Quit the task",
								action: "quit",
							},
						];

						let output = "🔄 Stuck Detection Alert!\n";
						output += `${"─".repeat(40)}\n`;
						output += `Loop Type: ${analysis.loopType}\n`;
						output += "Recovery Options:\n";
						for (const opt of options) {
							output += `  ${opt.id}. ${opt.description}\n`;
						}

						return {
							content: [{ type: "text", text: output }],
							details: { isStuck: true, analysis, options },
						};
					}

					return {
						content: [{ type: "text", text: "✅ Agent is not stuck." }],
						details: { isStuck: false },
					};
				}

				case "recover": {
					if (!analysis) {
						return {
							content: [
								{ type: "text", text: "Error: No stuck analysis available. Run 'check' first." },
							],
							details: "Error: No analysis",
						};
					}

					const options = [
						{ id: 1, action: "restart_before_loop" },
						{ id: 2, action: "restart_with_last_message" },
						{ id: 3, action: "quit" },
					];

					if (!recoveryOption || recoveryOption < 1 || recoveryOption > options.length) {
						return {
							content: [
								{
									type: "text",
									text: "Error: Invalid recovery option. Use 1, 2, or 3.",
								},
							],
							details: "Error: Invalid recovery option",
						};
					}

					const option = options[recoveryOption - 1];
					// The actual recovery is handled by the agent, this just returns the action
					return {
						content: [
							{
								type: "text",
								text: `Recovery action: ${option.action}`,
							},
						],
						details: { recoveryAction: option.action },
					};
				}

				case "add": {
					if (!message) {
						return {
							content: [{ type: "text", text: "Error: 'message' is required for 'add' action" }],
							details: "Error: message required",
						};
					}

					stuckDetector.addMessage({
						id: Date.now(),
						role: message.role as "user" | "assistant" | "system",
						content: message.content,
						action: message.action,
						error: message.error,
						timestamp: Date.now(),
					});

					return {
						content: [{ type: "text", text: "Message added to stuck detector." }],
						details: "Message added",
					};
				}

				case "reset": {
					stuckDetector.reset();
					return {
						content: [{ type: "text", text: "Stuck detector state reset." }],
						details: "State reset",
					};
				}

				default:
					return {
						content: [
							{
								type: "text",
								text: `Error: Unknown action '${action}'. Use: check, recover, add, reset`,
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

// Variable to store analysis for recovery
const analysis: StuckAnalysis | null = null;
