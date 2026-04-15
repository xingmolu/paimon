/**
 * Git workflow tool wrapper for agent integration.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { gitWorkflowTool as gitWorkflowToolImpl } from "../git-workflow.js";

/**
 * Tool for git workflow automation (Claude Code commit-commands pattern).
 *
 * Actions:
 * - commit: Generate commit message and commit staged/all changes
 * - commit-push-pr: Full workflow: commit → push → create PR
 * - clean-gone: Remove stale local branches (remote deleted)
 * - status: Get git status summary
 * - branch-status: Get detailed status for a branch
 * - branches: List all local branches with status
 * - pr-status: Get PR status for current/specified branch
 * - push: Push current branch to remote
 * - create-branch: Create and switch to new branch
 */
export const gitWorkflowTool: AgentTool = {
	name: "gitWorkflow",
	label: "Git Workflow Automation",
	description:
		"Streamlines git operations for committing, pushing, creating PRs, and cleaning up stale branches. Use for efficient git workflow automation.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action: commit, commit-push-pr, clean-gone, status, branch-status, branches, pr-status, push, create-branch",
		}),
		branch: Type.Optional(
			Type.String({
				description: "Branch name for branch-status, pr-status, push, create-branch actions",
			}),
		),
		draft: Type.Optional(
			Type.Boolean({
				description: "Create draft PR (for commit-push-pr action)",
			}),
		),
		stagedOnly: Type.Optional(
			Type.Boolean({
				description: "Only commit staged changes, don't stage all (for commit action)",
			}),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const { action, branch, draft, stagedOnly } = params as {
			action:
				| "commit"
				| "commit-push-pr"
				| "clean-gone"
				| "status"
				| "branch-status"
				| "branches"
				| "pr-status"
				| "push"
				| "create-branch";
			branch?: string;
			draft?: boolean;
			stagedOnly?: boolean;
		};

		try {
			const result = await gitWorkflowToolImpl({
				action,
				branch,
				draft,
				stagedOnly,
			});
			return {
				content: [{ type: "text", text: result }],
				details: { action, branch, draft, stagedOnly },
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

export default gitWorkflowTool;
