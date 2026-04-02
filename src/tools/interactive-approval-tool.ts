/**
 * Interactive Approval Tool
 *
 * Provides tool interface for managing the interactive approval workflow.
 * Use this tool to request, approve, reject, or view pending approvals
 * for risky operations.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type ApprovalCategory,
	type ApprovalRequest,
	type ApprovalStatus,
	type InteractiveApprovalConfig,
	InteractiveApprovalManager,
	type InteractiveApprovalStats,
	getApprovalManager,
} from "../interactive-approval.js";

/**
 * Interactive Approval Tool Definition
 */
export const interactiveApprovalTool: AgentTool = {
	name: "interactiveApproval",
	label: "Interactive Approval",
	description: `Manage interactive approval workflow for risky operations. Use when you need to request approval for dangerous operations (file deletion, workflow modification, self-modification) or check pending approvals.

Actions:
- request: Request approval for an operation (requires tool, toolParams, description)
- approve: Approve a pending request (requires requestId)
- reject: Reject a pending request (requires requestId)
- pending: View all pending approvals
- stats: View approval statistics
- config: View or update configuration
- history: View approval history
- clear: Clear pending approvals, stats, or history
- batch: Batch approve/reject multiple requests
- auto: Attempt to auto-approve a request
- get: Get details of a specific request

Example usage:
interactiveApproval({action: 'request', tool: 'bash', toolParams: {command: 'rm -rf dist'}, description: 'Delete dist folder'})
interactiveApproval({action: 'pending'})
interactiveApproval({action: 'approve', requestId: 'approval-123', reason: 'Safe to proceed'})`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: request, approve, reject, pending, stats, config, history, clear, batch, auto, get",
		}),
		requestId: Type.Optional(
			Type.String({
				description: "Request ID for approve/reject/get/auto actions",
			}),
		),
		tool: Type.Optional(
			Type.String({
				description: "Tool name for request action",
			}),
		),
		toolParams: Type.Optional(Type.Object({}, { additionalProperties: true })),
		description: Type.Optional(
			Type.String({
				description: "Description of the operation for request action",
			}),
		),
		reason: Type.Optional(
			Type.String({
				description: "Reason for approval or rejection",
			}),
		),
		suggestion: Type.Optional(
			Type.String({
				description: "Suggested alternative for rejection",
			}),
		),
		requestIds: Type.Optional(
			Type.Array(Type.String(), {
				description: "Array of request IDs for batch operations",
			}),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
		const manager = getApprovalManager();
		const typedParams = params as Record<string, unknown>;
		const action = String(typedParams.action || "pending");

		try {
			switch (action) {
				case "request":
					return handleRequest(manager, typedParams);

				case "approve":
					return handleApprove(manager, typedParams);

				case "reject":
					return handleReject(manager, typedParams);

				case "pending": {
					const output = manager.formatPendingApprovals();
					return { content: [{ type: "text", text: output }], details: output };
				}

				case "stats": {
					const output = manager.formatStats();
					return { content: [{ type: "text", text: output }], details: output };
				}

				case "config":
					return handleConfig(manager, typedParams);

				case "history":
					return handleHistory(manager, typedParams);

				case "clear":
					return handleClear(manager, typedParams);

				case "batch":
					return handleBatch(manager, typedParams);

				case "auto":
					return handleAuto(manager, typedParams);

				case "get":
					return handleGet(manager, typedParams);

				default:
					return {
						content: [
							{
								type: "text",
								text: `Unknown action: ${action}. Available: request, approve, reject, pending, stats, config, history, clear, batch, auto, get`,
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
 * Handle request action
 */
function handleRequest(
	manager: InteractiveApprovalManager,
	params: Record<string, unknown>,
): AgentToolResult<string> {
	const tool = params.tool ? String(params.tool) : "";
	const toolParams = (params.toolParams as Record<string, unknown>) || {};
	const description = params.description ? String(params.description) : "";

	if (!tool || !description) {
		return {
			content: [{ type: "text", text: "Error: 'tool' and 'description' required." }],
			details: "Error: missing params",
		};
	}

	// Check if approval required
	if (!manager.requiresApproval(tool, toolParams)) {
		return {
			content: [{ type: "text", text: "✅ Operation does not require approval" }],
			details: "No approval required",
		};
	}

	// Create request
	const request = manager.createRequest(tool, toolParams, description);

	// Try auto-approve
	if (request.autoApprovable) {
		const result = manager.tryAutoApprove(request.id);
		if (result?.approved) {
			const output = `✅ Auto-approved: ${request.id}\nReason: ${result.reason}`;
			return { content: [{ type: "text", text: output }], details: output };
		}
	}

	const output = manager.formatRequest(request.id);
	return { content: [{ type: "text", text: output }], details: output };
}

/**
 * Handle approve action
 */
function handleApprove(
	manager: InteractiveApprovalManager,
	params: Record<string, unknown>,
): AgentToolResult<string> {
	const requestId = params.requestId ? String(params.requestId) : "";
	const reason = params.reason ? String(params.reason) : undefined;

	if (!requestId) {
		return {
			content: [{ type: "text", text: "Error: 'requestId' required." }],
			details: "Error: missing requestId",
		};
	}

	const result = manager.approve(requestId, reason);
	if (result.approved) {
		const output = `✅ Approved: ${requestId}\nReason: ${result.reason}`;
		return { content: [{ type: "text", text: output }], details: output };
	}
	return {
		content: [{ type: "text", text: `❌ Approval failed: ${result.reason}` }],
		details: `Approval failed: ${result.reason}`,
	};
}

/**
 * Handle reject action
 */
function handleReject(
	manager: InteractiveApprovalManager,
	params: Record<string, unknown>,
): AgentToolResult<string> {
	const requestId = params.requestId ? String(params.requestId) : "";
	const reason = params.reason ? String(params.reason) : undefined;
	const suggestion = params.suggestion ? String(params.suggestion) : undefined;

	if (!requestId) {
		return {
			content: [{ type: "text", text: "Error: 'requestId' required." }],
			details: "Error: missing requestId",
		};
	}

	const result = manager.reject(requestId, reason, suggestion);
	let output = `✅ Rejected: ${requestId}\nReason: ${result.reason}`;
	if (result.suggestion) {
		output += `\nSuggestion: ${result.suggestion}`;
	}
	return { content: [{ type: "text", text: output }], details: output };
}

/**
 * Handle config action
 */
function handleConfig(
	manager: InteractiveApprovalManager,
	params: Record<string, unknown>,
): AgentToolResult<string> {
	const config = manager.getConfig();
	let output = "## Interactive Approval Configuration\n";
	output += `${"─".repeat(50)}\n`;
	output += `Enabled: ${config.enabled ? "✅" : "❌"}\n`;
	output += `Auto-approve Below: ${config.autoApproveBelow}\n`;
	output += `Require Approval Above: ${config.requireApprovalAbove}\n`;
	output += `Always Require: ${config.alwaysRequireApproval.join(", ")}\n`;
	output += `Auto-approvable Categories: ${config.autoApprovableCategories.join(", ")}\n`;
	output += `Expiration: ${config.expirationSeconds}s\n`;
	output += `Max Pending: ${config.maxPendingApprovals}\n`;
	output += `Batch Approval: ${config.allowBatchApproval ? "✅" : "❌"}\n`;
	output += `Track History: ${config.trackHistory ? "✅" : "❌"}\n`;
	return { content: [{ type: "text", text: output }], details: output };
}

/**
 * Handle history action
 */
function handleHistory(
	manager: InteractiveApprovalManager,
	params: Record<string, unknown>,
): AgentToolResult<string> {
	const limit = params.requestId ? undefined : 20;
	const history = manager.getHistory(limit);
	if (history.length === 0) {
		return {
			content: [{ type: "text", text: "## Approval History\n\nNo history entries\n" }],
			details: "No history",
		};
	}
	let output = "## Approval History\n";
	output += `${"─".repeat(50)}\n`;
	output += `Total: ${history.length} entries\n\n`;
	for (const req of history) {
		const statusIcon =
			req.status === "approved" || req.status === "auto-approved"
				? "✅"
				: req.status === "rejected"
					? "❌"
					: "⏱️";
		output += `${statusIcon} [${req.id}] ${req.category}: ${req.status}\n`;
		output += `   ${req.description}\n`;
		if (req.reason) {
			output += `   Reason: ${req.reason}\n`;
		}
	}
	return { content: [{ type: "text", text: output }], details: output };
}

/**
 * Handle clear action
 */
function handleClear(
	manager: InteractiveApprovalManager,
	params: Record<string, unknown>,
): AgentToolResult<string> {
	const target = params.requestId ? String(params.requestId) : "";

	if (target === "pending") {
		manager.clearPending();
		return {
			content: [{ type: "text", text: "✅ Pending approvals cleared" }],
			details: "Pending cleared",
		};
	}
	if (target === "stats") {
		manager.resetStats();
		return {
			content: [{ type: "text", text: "✅ Statistics reset" }],
			details: "Stats reset",
		};
	}
	if (target === "history") {
		manager.clearHistory();
		return {
			content: [{ type: "text", text: "✅ History cleared" }],
			details: "History cleared",
		};
	}
	return {
		content: [{ type: "text", text: "❌ Specify what to clear: pending, stats, or history" }],
		details: "Missing clear target",
	};
}

/**
 * Handle batch action
 */
function handleBatch(
	manager: InteractiveApprovalManager,
	params: Record<string, unknown>,
): AgentToolResult<string> {
	const requestIds = (params.requestIds as string[]) || [];
	const reason = params.reason ? String(params.reason) : undefined;

	if (requestIds.length === 0) {
		return {
			content: [{ type: "text", text: "Error: 'requestIds' array required." }],
			details: "Error: missing requestIds",
		};
	}

	const batchResults = reason?.includes("reject")
		? manager.batchReject(requestIds, reason)
		: manager.batchApprove(requestIds, reason);

	let output = "## Batch Approval Results\n";
	output += `${"─".repeat(50)}\n`;
	output += `Total: ${requestIds.length}\n`;
	output += `Approved: ${batchResults.filter((r) => r.approved).length}\n`;
	output += `Rejected: ${batchResults.filter((r) => !r.approved).length}\n\n`;
	for (const result of batchResults) {
		output += `${result.approved ? "✅" : "❌"} ${result.requestId}: ${result.status}\n`;
	}
	return { content: [{ type: "text", text: output }], details: output };
}

/**
 * Handle auto action
 */
function handleAuto(
	manager: InteractiveApprovalManager,
	params: Record<string, unknown>,
): AgentToolResult<string> {
	const requestId = params.requestId ? String(params.requestId) : "";

	if (!requestId) {
		return {
			content: [{ type: "text", text: "Error: 'requestId' required." }],
			details: "Error: missing requestId",
		};
	}

	const result = manager.tryAutoApprove(requestId);
	if (result?.approved) {
		const output = `✅ Auto-approved: ${requestId}\nReason: ${result.reason}`;
		return { content: [{ type: "text", text: output }], details: output };
	}
	return {
		content: [
			{
				type: "text",
				text: `❌ Cannot auto-approve: ${requestId}\nNot eligible for auto-approval`,
			},
		],
		details: "Not auto-approvable",
	};
}

/**
 * Handle get action
 */
function handleGet(
	manager: InteractiveApprovalManager,
	params: Record<string, unknown>,
): AgentToolResult<string> {
	const requestId = params.requestId ? String(params.requestId) : "";

	if (!requestId) {
		return {
			content: [{ type: "text", text: "Error: 'requestId' required." }],
			details: "Error: missing requestId",
		};
	}

	const output = manager.formatRequest(requestId);
	return { content: [{ type: "text", text: output }], details: output };
}

// Re-export types and functions
export {
	getApprovalManager,
	InteractiveApprovalManager,
	type ApprovalCategory,
	type ApprovalRequest,
	type ApprovalStatus,
	type InteractiveApprovalConfig,
	type InteractiveApprovalStats,
};
