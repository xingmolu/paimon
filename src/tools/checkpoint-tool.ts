/**
 * Checkpoint tool - Create, list, or restore checkpoints for safe rollback
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type Checkpoint,
	type CheckpointInfo,
	CheckpointManager,
	formatCheckpoint,
	formatCheckpointList,
} from "../checkpoint.js";

// Global checkpoint manager (shared across agent runs)
const checkpointManager = new CheckpointManager();

/**
 * Checkpoint tool - Manage checkpoints for safe rollback
 */
export const checkpointTool: AgentTool = {
	name: "checkpoint",
	label: "Manage Checkpoints",
	description:
		"Create, list, or restore checkpoints for safe rollback during evolution. Use this before risky changes to save a snapshot you can restore if something goes wrong.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: 'create' (save snapshot), 'list' (show checkpoints), 'restore' (rollback to checkpoint), 'delete' (remove checkpoint)",
		}),
		description: Type.Optional(
			Type.String({
				description: "Description for the checkpoint (for 'create' action)",
			}),
		),
		checkpointId: Type.Optional(
			Type.String({
				description: "Checkpoint ID to restore or delete (for 'restore' and 'delete' actions)",
			}),
		),
	}),
	execute: async (
		_toolCallId,
		params,
	): Promise<AgentToolResult<Checkpoint | CheckpointInfo[] | string>> => {
		const { action, description, checkpointId } = params as {
			action: string;
			description?: string;
			checkpointId?: string;
		};

		try {
			// Check if checkpoints are enabled
			if (!checkpointManager.isEnabled()) {
				return {
					content: [
						{
							type: "text",
							text: "⚠️ Checkpoints require a git repository. Current directory is not in a git repo.",
						},
					],
					details: "Checkpoints disabled - not in git repo",
				};
			}

			switch (action) {
				case "create": {
					if (!description) {
						return {
							content: [
								{
									type: "text",
									text: "Error: 'description' is required for 'create' action",
								},
							],
							details: "Error: description required",
						};
					}
					const checkpoint = checkpointManager.create(description);
					if (!checkpoint) {
						return {
							content: [
								{
									type: "text",
									text: "⚠️ No changes to checkpoint. Make some changes first.",
								},
							],
							details: "No changes to checkpoint",
						};
					}
					const output = formatCheckpoint(checkpoint);
					return {
						content: [
							{
								type: "text",
								text: `✅ Checkpoint created:\n\n${output}\n\nUse \`checkpoint({action: 'restore', checkpointId: '${checkpoint.id}'})\` to rollback.`,
							},
						],
						details: checkpoint,
					};
				}

				case "list": {
					const checkpoints = checkpointManager.list();
					const output = formatCheckpointList(checkpoints);
					return {
						content: [{ type: "text", text: output }],
						details: checkpoints,
					};
				}

				case "restore": {
					if (!checkpointId) {
						return {
							content: [
								{
									type: "text",
									text: "Error: 'checkpointId' is required for 'restore' action. Use 'list' to see available checkpoints.",
								},
							],
							details: "Error: checkpointId required",
						};
					}
					const success = checkpointManager.restore(checkpointId);
					if (success) {
						return {
							content: [
								{
									type: "text",
									text: `✅ Restored to checkpoint ${checkpointId}. Files have been restored from stash.`,
								},
							],
							details: `Restored checkpoint ${checkpointId}`,
						};
					}
					return {
						content: [
							{
								type: "text",
								text: `❌ Failed to restore checkpoint ${checkpointId}. The stash may have been dropped or conflicts occurred.`,
							},
						],
						details: `Failed to restore checkpoint ${checkpointId}`,
					};
				}

				case "delete": {
					if (!checkpointId) {
						return {
							content: [
								{
									type: "text",
									text: "Error: 'checkpointId' is required for 'delete' action. Use 'list' to see available checkpoints.",
								},
							],
							details: "Error: checkpointId required",
						};
					}
					const success = checkpointManager.delete(checkpointId);
					if (success) {
						return {
							content: [
								{
									type: "text",
									text: `✅ Deleted checkpoint ${checkpointId}.`,
								},
							],
							details: `Deleted checkpoint ${checkpointId}`,
						};
					}
					return {
						content: [
							{
								type: "text",
								text: `❌ Failed to delete checkpoint ${checkpointId}. It may not exist.`,
							},
						],
						details: `Failed to delete checkpoint ${checkpointId}`,
					};
				}

				default:
					return {
						content: [
							{
								type: "text",
								text: `Error: Unknown action '${action}'. Use: create, list, restore, delete`,
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
