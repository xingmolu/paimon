/**
 * Commit message tool wrapper for agent integration.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { commitMsgTool as commitMsgToolImpl } from "../commit-msg.js";

/**
 * Tool for generating conventional commit messages from git diffs (Aider pattern).
 *
 * Actions:
 * - generate: Generate commit message from staged changes
 * - preview: Preview commit message without committing
 * - stats: Show git diff statistics
 * - commit: Generate message and commit immediately
 */
export const commitMsgTool: AgentTool = {
	name: "commitMsg",
	label: "Commit Message Generator",
	description:
		"Generate conventional commit messages from git diffs. Use before committing to improve commit history quality.",
	parameters: Type.Object({
		action: Type.String({
			description: "Action to perform: generate, preview, stats, or commit",
		}),
		diffType: Type.Optional(
			Type.String({
				description: "Type of diff to analyze: staged (default), unstaged, or all changes",
			}),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const { action, diffType } = params as {
			action: "generate" | "preview" | "stats" | "commit";
			diffType?: "staged" | "unstaged" | "all";
		};

		try {
			const result = await commitMsgToolImpl({
				action,
				diffType,
			});
			return {
				content: [{ type: "text", text: result }],
				details: { action, diffType },
			};
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			return {
				content: [{ type: "text", text: `Error: ${errorMsg}` }],
				details: `Error: ${errorMsg}`,
			};
		}
	},
};

export default commitMsgTool;
