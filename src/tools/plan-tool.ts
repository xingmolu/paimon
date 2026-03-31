/**
 * Plan tool - Create, update, or view a step-by-step plan for complex tasks
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { PlanState } from "../types.js";

// Global plan state (shared across agent runs)
let currentPlan: PlanState | null = null;

/**
 * Format plan for display
 */
function formatPlan(plan: PlanState): string {
	const statusEmoji = {
		pending: "⬜",
		in_progress: "🔄",
		completed: "✅",
		skipped: "⏭️",
	};

	let output = "";
	for (const step of plan.steps) {
		const emoji = statusEmoji[step.status];
		output += `${emoji} ${step.id}. ${step.description}\n`;
		if (step.notes) {
			output += `   📝 ${step.notes}\n`;
		}
	}
	return output;
}

/**
 * Plan tool - Manage execution plans
 */
export const planTool: AgentTool = {
	name: "plan",
	label: "Manage Execution Plan",
	description:
		"Create, update, or view a step-by-step plan for complex tasks. Use this to break down multi-step tasks into manageable steps.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: 'create' (new plan), 'update' (modify step), 'progress' (mark step status), 'show' (display current plan), 'clear' (remove plan)",
		}),
		steps: Type.Optional(
			Type.Array(
				Type.String({
					description: "List of step descriptions (for 'create' action)",
				}),
			),
		),
		stepId: Type.Optional(
			Type.Number({
				description: "Step ID to update (for 'update' or 'progress' actions)",
			}),
		),
		status: Type.Optional(
			Type.String({
				description:
					"New status for step: 'pending', 'in_progress', 'completed', 'skipped' (for 'progress' action)",
			}),
		),
		notes: Type.Optional(
			Type.String({
				description: "Notes to add to a step (for 'update' action)",
			}),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<PlanState | string>> => {
		const { action, steps, stepId, status, notes } = params as {
			action: string;
			steps?: string[];
			stepId?: number;
			status?: string;
			notes?: string;
		};

		try {
			switch (action) {
				case "create": {
					if (!steps || steps.length === 0) {
						return {
							content: [
								{ type: "text", text: "Error: 'steps' array is required for 'create' action" },
							],
							details: "Error: 'steps' array is required for 'create' action",
						};
					}
					const now = new Date().toISOString();
					currentPlan = {
						steps: steps.map((desc, i) => ({
							id: i + 1,
							description: desc,
							status: "pending" as const,
						})),
						currentStep: 1,
						createdAt: now,
						updatedAt: now,
					};
					const result = formatPlan(currentPlan);
					return {
						content: [{ type: "text", text: `Plan created:\n\n${result}` }],
						details: currentPlan,
					};
				}

				case "update": {
					if (!currentPlan) {
						return {
							content: [{ type: "text", text: "Error: No active plan. Use 'create' first." }],
							details: "Error: No active plan",
						};
					}
					if (stepId === undefined) {
						return {
							content: [{ type: "text", text: "Error: 'stepId' is required for 'update' action" }],
							details: "Error: 'stepId' is required",
						};
					}
					const step = currentPlan.steps.find((s) => s.id === stepId);
					if (!step) {
						return {
							content: [{ type: "text", text: `Error: Step ${stepId} not found` }],
							details: `Error: Step ${stepId} not found`,
						};
					}
					if (notes) step.notes = notes;
					currentPlan.updatedAt = new Date().toISOString();
					const result = formatPlan(currentPlan);
					return {
						content: [{ type: "text", text: `Step ${stepId} updated:\n\n${result}` }],
						details: currentPlan,
					};
				}

				case "progress": {
					if (!currentPlan) {
						return {
							content: [{ type: "text", text: "Error: No active plan. Use 'create' first." }],
							details: "Error: No active plan",
						};
					}
					if (stepId === undefined || !status) {
						return {
							content: [
								{
									type: "text",
									text: "Error: 'stepId' and 'status' are required for 'progress' action",
								},
							],
							details: "Error: 'stepId' and 'status' are required",
						};
					}
					const validStatuses = ["pending", "in_progress", "completed", "skipped"];
					if (!validStatuses.includes(status)) {
						return {
							content: [
								{
									type: "text",
									text: `Error: Invalid status '${status}'. Use: ${validStatuses.join(", ")}`,
								},
							],
							details: `Error: Invalid status '${status}'`,
						};
					}
					const step = currentPlan.steps.find((s) => s.id === stepId);
					if (!step) {
						return {
							content: [{ type: "text", text: `Error: Step ${stepId} not found` }],
							details: `Error: Step ${stepId} not found`,
						};
					}
					step.status = status as PlanState["steps"][0]["status"];
					// Update current step pointer
					const nextPending = currentPlan.steps.find((s) => s.status === "pending");
					currentPlan.currentStep = nextPending ? nextPending.id : currentPlan.steps.length;
					currentPlan.updatedAt = new Date().toISOString();
					const result = formatPlan(currentPlan);
					const completedCount = currentPlan.steps.filter((s) => s.status === "completed").length;
					const totalCount = currentPlan.steps.length;
					return {
						content: [
							{
								type: "text",
								text: `Step ${stepId} marked as ${status}:\n\n${result}\n\nProgress: ${completedCount}/${totalCount} steps completed`,
							},
						],
						details: currentPlan,
					};
				}

				case "show": {
					if (!currentPlan) {
						return {
							content: [{ type: "text", text: "No active plan. Use 'create' to make one." }],
							details: "No active plan",
						};
					}
					const result = formatPlan(currentPlan);
					const completedCount = currentPlan.steps.filter((s) => s.status === "completed").length;
					const totalCount = currentPlan.steps.length;
					return {
						content: [
							{
								type: "text",
								text: `Current plan:\n\n${result}\n\nProgress: ${completedCount}/${totalCount} steps completed`,
							},
						],
						details: currentPlan,
					};
				}

				case "clear": {
					currentPlan = null;
					return {
						content: [{ type: "text", text: "Plan cleared." }],
						details: "Plan cleared",
					};
				}

				default:
					return {
						content: [
							{
								type: "text",
								text: `Error: Unknown action '${action}'. Use: create, update, progress, show, clear`,
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

/**
 * Get current plan state (for testing/debugging)
 */
export function getCurrentPlan(): PlanState | null {
	return currentPlan;
}

/**
 * Set current plan state (for testing)
 */
export function setCurrentPlan(plan: PlanState | null): void {
	currentPlan = plan;
}
