/**
 * Ralph Loop Tool - Tool interface for self-referential iteration loops.
 *
 * This tool exposes the RalphLoopManager functionality to the agent,
 * enabling autonomous iteration loops for continuous improvement.
 *
 * Inspired by Claude Code's ralph-wiggum plugin:
 * - Stop hook intercepts exit attempts
 * - Blocks exit and feeds the same prompt back
 * - Creates self-referential feedback loop
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type RalphLoopConfig,
	type RalphLoopState,
	type RalphLoopStats,
	getRalphLoopManager,
} from "../ralph-loop.js";

/**
 * Ralph Loop tool result.
 */
interface RalphLoopResult {
	success: boolean;
	action: string;
	data?: RalphLoopState | RalphLoopState[] | RalphLoopStats | RalphLoopConfig | string | null;
	error?: string;
}

/**
 * Create the ralphLoop tool.
 */
export const ralphLoopTool: AgentTool = {
	name: "ralphLoop",
	label: "Ralph Loop (Self-referential Iteration)",
	description: `Manage self-referential iteration loops for autonomous continuous improvement. Inspired by Claude Code's ralph-wiggum plugin - the agent works on the same task repeatedly until completion.

Actions:
- start: Start a new Ralph Loop with a prompt and completion promise
- status: Check current loop status and iteration count
- complete: Mark the current loop as completed
- cancel: Cancel the current active loop
- list: List all loops (optionally filtered by status)
- stats: View Ralph Loop statistics
- get: Get specific loop details by ID
- note: Add a note to the current loop
- clear: Clear old loops (keep recent N)
- config: View or update Ralph Loop configuration

Usage:
ralphLoop({action: 'start', prompt: 'Build a REST API for todos. Output <promise>COMPLETE</promise> when done.', completionPromise: 'COMPLETE', maxIterations: 50})
ralphLoop({action: 'status'})
ralphLoop({action: 'complete', id: 'ralph-123', reason: 'All tests passing'})
ralphLoop({action: 'cancel', id: 'ralph-123', reason: 'Task blocked'})
ralphLoop({action: 'list', status: 'active'})
ralphLoop({action: 'stats'})

The completion promise is a unique string that signals task completion. When this string appears in the agent's output, the loop completes automatically.

Safety: Always set maxIterations to prevent infinite loops. Default is 50.`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: start, status, complete, cancel, list, stats, get, note, clear, config",
		}),
		prompt: Type.Optional(Type.String({ description: "Prompt to iterate on (for start action)" })),
		completionPromise: Type.Optional(
			Type.String({ description: "Completion promise string (for start action)" }),
		),
		maxIterations: Type.Optional(
			Type.Number({ description: "Maximum iterations safety limit (for start action)" }),
		),
		id: Type.Optional(Type.String({ description: "Loop ID for complete/cancel/get actions" })),
		reason: Type.Optional(Type.String({ description: "Reason for completion/cancellation/note" })),
		status: Type.Optional(
			Type.String({
				description: "Filter by status for list action: active, completed, cancelled, max_reached",
			}),
		),
		note: Type.Optional(Type.String({ description: "Note content (for note action)" })),
		keepCount: Type.Optional(
			Type.Number({ description: "Number of loops to keep when clearing (for clear action)" }),
		),
		enabled: Type.Optional(
			Type.Boolean({ description: "Enable/disable Ralph Loop (for config action)" }),
		),
		defaultMaxIterations: Type.Optional(
			Type.Number({ description: "Default max iterations (for config action)" }),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<RalphLoopResult>> => {
		const manager = getRalphLoopManager();
		const p = params as Record<string, unknown>;
		const action = p.action as string;
		const result: RalphLoopResult = {
			success: true,
			action,
		};

		try {
			switch (action) {
				case "start":
					if (!p.prompt) {
						result.success = false;
						result.error = "prompt parameter required for start action";
					} else if (!p.completionPromise) {
						result.success = false;
						result.error = "completionPromise parameter required for start action";
					} else {
						const loop = manager.startLoop(
							p.prompt as string,
							p.completionPromise as string,
							p.maxIterations as number | undefined,
							undefined, // sessionContext - could be added later
						);
						result.data = loop;
					}
					break;

				case "status":
					result.data = manager.getCurrentLoop();
					break;

				case "complete":
					if (!p.id) {
						result.success = false;
						result.error = "id parameter required for complete action";
					} else {
						const loop = manager.completeLoop(p.id as string, p.reason as string | undefined);
						if (!loop) {
							result.success = false;
							result.error = `Loop ${p.id} not found or not active`;
						} else {
							result.data = loop;
						}
					}
					break;

				case "cancel":
					if (!p.id) {
						result.success = false;
						result.error = "id parameter required for cancel action";
					} else {
						const loop = manager.cancelLoop(p.id as string, p.reason as string | undefined);
						if (!loop) {
							result.success = false;
							result.error = `Loop ${p.id} not found or not active`;
						} else {
							result.data = loop;
						}
					}
					break;

				case "list": {
					const statusFilter = p.status as
						| "active"
						| "completed"
						| "cancelled"
						| "max_reached"
						| undefined;
					const loops = manager.listLoops(statusFilter);
					result.data = loops;
					break;
				}

				case "stats":
					result.data = manager.getStats();
					break;

				case "get":
					if (!p.id) {
						result.success = false;
						result.error = "id parameter required for get action";
					} else {
						const loop = manager.getLoop(p.id as string);
						if (!loop) {
							result.success = false;
							result.error = `Loop ${p.id} not found`;
						} else {
							result.data = loop;
						}
					}
					break;

				case "note":
					if (!p.note) {
						result.success = false;
						result.error = "note parameter required for note action";
					} else {
						const added = manager.addNote(p.note as string);
						if (!added) {
							result.success = false;
							result.error = "No active loop to add note to";
						} else {
							result.data = `Note added: ${p.note}`;
						}
					}
					break;

				case "clear": {
					const keepCount = (p.keepCount as number) || 20;
					const deleted = manager.clearOldLoops(keepCount);
					result.data = `Cleared ${deleted} old loops, keeping ${keepCount} most recent`;
					break;
				}

				case "config":
					if (p.enabled !== undefined || p.defaultMaxIterations !== undefined) {
						// Update config (for now just return current config)
						result.data = `Config: enabled=${manager.isEnabled()}`;
					} else {
						result.data = {
							enabled: manager.isEnabled(),
						};
					}
					break;

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
				output = formatOutput(result.action, result.data, manager);
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
 * Create Ralph Loop tool function (for compatibility).
 */
export function createRalphLoopTool(): AgentTool {
	return ralphLoopTool;
}

/**
 * Format output based on action type.
 */
function formatOutput(
	action: string,
	data: unknown,
	manager: ReturnType<typeof getRalphLoopManager>,
): string {
	if (action === "start" && isRalphLoopState(data)) {
		const loop = data as RalphLoopState;
		return `
## Ralph Loop Started

🔄 Loop ID: ${loop.id}
Iterations: ${loop.currentIteration}/${loop.maxIterations}
Completion Promise: "${loop.completionPromise}"

Prompt: ${loop.prompt.substring(0, 200)}${loop.prompt.length > 200 ? "..." : ""}

The agent will now work on this task repeatedly until:
1. The completion promise "${loop.completionPromise}" appears in output
2. Max iterations (${loop.maxIterations}) reached

Use ralphLoop({action: 'status'}) to check progress.
Use ralphLoop({action: 'cancel', id: '${loop.id}'}) to stop.
`;
	}

	if (action === "status") {
		if (data === null) {
			return "No active Ralph Loop.";
		}
		if (isRalphLoopState(data)) {
			const loop = data as RalphLoopState;
			return manager.formatLoop(loop);
		}
	}

	if (action === "list" && Array.isArray(data)) {
		return manager.formatLoopsList(data as RalphLoopState[]);
	}

	if (action === "stats" && isRalphLoopStats(data)) {
		return manager.formatStats(data as RalphLoopStats);
	}

	if ((action === "complete" || action === "cancel") && isRalphLoopState(data)) {
		const loop = data as RalphLoopState;
		return manager.formatLoop(loop);
	}

	if (action === "get" && isRalphLoopState(data)) {
		const loop = data as RalphLoopState;
		return manager.formatLoop(loop);
	}

	if (action === "config") {
		if (typeof data === "object" && data !== null && "enabled" in data) {
			const config = data as { enabled: boolean };
			return `
## Ralph Loop Configuration

- Enabled: ${config.enabled}
`;
		}
	}

	return JSON.stringify(data, null, 2);
}

/**
 * Type guards for output formatting.
 */
function isRalphLoopState(data: unknown): boolean {
	return (
		typeof data === "object" &&
		data !== null &&
		"id" in data &&
		"prompt" in data &&
		"status" in data
	);
}

function isRalphLoopStats(data: unknown): boolean {
	return (
		typeof data === "object" && data !== null && "totalLoops" in data && "avgIterations" in data
	);
}
