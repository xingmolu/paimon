/**
 * Visual Progress Tool (Devin Pattern)
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { ProgressPhase, StepStatus } from "../visual-progress.js";
import { getVisualProgressManager } from "../visual-progress.js";

function executeVisualProgressTool(args: Record<string, unknown>): string {
	const manager = getVisualProgressManager();
	const action = String(args.action || "");

	switch (action) {
		case "start": {
			const taskType = args.taskType as "capability" | "reliability" | "feature" | undefined;
			const taskDescription = args.taskDescription as string | undefined;
			if (!taskType || !taskDescription) {
				return "Error: taskType and taskDescription are required for start action";
			}
			const session = manager.startSession(taskType, taskDescription);
			return `## Progress Session Started\n\n**Session Identifier:** ${session.sessionId}\n**Task:** ${taskDescription}\n**Type:** ${taskType}\n**Estimated Duration:** ~${Math.round((session.estimatedTotalDuration ?? 900) / 60)} minutes\n\nUse visualProgress({action: 'step', description: '...'}) to add steps.`;
		}

		case "step": {
			const description = args.description as string | undefined;
			const estimatedDuration = args.estimatedDuration as number | undefined;
			const toolsUsed = args.toolsUsed as string[] | undefined;
			if (!description) {
				return "Error: description is required for step action";
			}
			const step = manager.addStep(description, estimatedDuration, toolsUsed);
			if (!step) {
				return "Error: No active session. Start a session first with action: 'start'";
			}
			return `## Step Added\n\n**Step Identifier:** ${step.id}\n**Description:** ${description}\n**Status:** ${step.status}\n\nTotal steps: ${manager.getCurrentSession()?.totalSteps || 0}`;
		}

		case "update": {
			const stepIdentifier = args.stepId as string | undefined;
			const status = args.status as StepStatus | undefined;
			const errorMessage = args.errorMessage as string | undefined;
			if (!stepIdentifier || !status) {
				return "Error: stepId and status are required for update action";
			}
			const step = manager.updateStep(stepIdentifier, status, errorMessage);
			if (!step) {
				return `Error: Step ${stepIdentifier} not found or no active session`;
			}
			const session = manager.getCurrentSession();
			return `## Step Updated\n\n**Step Identifier:** ${stepIdentifier}\n**Status:** ${status}\n**Progress:** ${session?.progressPercentage || 0}%`;
		}

		case "phase": {
			const phase = args.phase as ProgressPhase | undefined;
			if (!phase) {
				return "Error: phase is required for phase action";
			}
			manager.setPhase(phase);
			const session = manager.getCurrentSession();
			return `## Phase Changed\n\n**Current Phase:** ${phase}\n**Progress:** ${session?.progressPercentage || 0}%`;
		}

		case "tool": {
			const toolName = args.toolName as string | undefined;
			if (!toolName) {
				return "Error: toolName is required for tool action";
			}
			manager.recordToolUsage(toolName);
			return `## Tool Usage Recorded\n\n**Tool:** ${toolName}`;
		}

		case "complete": {
			const success = args.success !== false;
			const summary = args.summary as string | undefined;
			const session = manager.completeSession(success, summary);
			if (!session) {
				return "Error: No active session to complete";
			}
			const duration = Math.round(
				(new Date(session.lastUpdateTime).getTime() - new Date(session.startTime).getTime()) / 1000,
			);
			return `## Session Completed\n\n**Status:** ${success ? "✅ Success" : "❌ Failed"}\n**Task:** ${session.taskDescription}\n**Duration:** ${Math.round(duration / 60)}m ${duration % 60}s\n**Steps Completed:** ${session.completedSteps}/${session.totalSteps}`;
		}

		case "status": {
			const session = manager.getCurrentSession();
			if (!session) {
				return "No active session. Start a session with action: 'start'";
			}
			return manager.formatProgress();
		}

		case "sessions": {
			const limit = (args.limit as number) || 10;
			const sessions = manager.getSessions(limit);
			if (sessions.length === 0) {
				return "No sessions found.";
			}
			const lines: string[] = ["## Recent Progress Sessions", ""];
			for (const session of sessions) {
				const icon =
					session.status === "completed" ? "✅" : session.status === "failed" ? "❌" : "🔄";
				const duration = Math.round(
					(new Date(session.lastUpdateTime).getTime() - new Date(session.startTime).getTime()) /
						1000,
				);
				lines.push(
					`${icon} **${session.sessionId}** - ${session.taskDescription.substring(0, 50)}...`,
				);
				lines.push(
					`   Type: ${session.taskType} | Duration: ${Math.round(duration / 60)}m | Progress: ${session.progressPercentage}%`,
				);
				lines.push("");
			}
			return lines.join("\n");
		}

		case "session": {
			const sessionIdentifier = args.sessionId as string | undefined;
			if (!sessionIdentifier) {
				return "Error: sessionId is required for session action";
			}
			const session = manager.getSession(sessionIdentifier);
			if (!session) {
				return `Session ${sessionIdentifier} not found.`;
			}
			const lines: string[] = [
				"## Session Details",
				"",
				`**Session Identifier:** ${session.sessionId}`,
				`**Task:** ${session.taskDescription}`,
				`**Type:** ${session.taskType}`,
				`**Status:** ${session.status}`,
				`**Progress:** ${session.progressPercentage}%`,
				`**Started:** ${session.startTime}`,
				`**Last Update:** ${session.lastUpdateTime}`,
				"",
				"### Steps",
			];
			for (const step of session.steps) {
				const icon =
					step.status === "completed"
						? "✅"
						: step.status === "in_progress"
							? "🔄"
							: step.status === "failed"
								? "❌"
								: "⏳";
				lines.push(`${icon} ${step.description} (${step.status})`);
				if (step.actualDuration) {
					lines.push(`   Duration: ${step.actualDuration}s`);
				}
				if (step.errorMessage) {
					lines.push(`   Error: ${step.errorMessage}`);
				}
			}
			return lines.join("\n");
		}

		case "estimate": {
			const taskType = args.taskType as "capability" | "reliability" | "feature" | undefined;
			if (!taskType) {
				return "Error: taskType is required for estimate action";
			}
			const estimate = manager.getEstimatedDuration(taskType);
			return `## Estimated Duration\n\n**Task Type:** ${taskType}\n**Estimated Duration:** ~${Math.round(estimate / 60)} minutes\n\nNote: Estimates improve over time with historical data.`;
		}

		case "stats": {
			const stats = manager.getStats();
			const config = manager.getConfig();
			const lines: string[] = [
				"## Visual Progress Statistics",
				"",
				`**Sessions Started:** ${stats.sessionsStarted}`,
				`**Sessions Completed:** ${stats.sessionsCompleted}`,
				`**Sessions Failed:** ${stats.sessionsFailed}`,
				`**Success Rate:** ${
					stats.sessionsStarted > 0
						? Math.round((stats.sessionsCompleted / stats.sessionsStarted) * 100)
						: 0
				}%`,
				`**Average Duration:** ${Math.round(stats.averageDurationMs / 1000 / 60)} minutes`,
				`**Steps Tracked:** ${stats.stepsTracked}`,
				`**Historical Timings:** ${stats.historicalTimingsStored}`,
				`**Last Session:** ${stats.lastSessionTime || "N/A"}`,
				"",
				"### Configuration",
				`**Enabled:** ${config.enabled}`,
				`**Progress Bar:** ${config.showProgressBar}`,
				`**Time Estimates:** ${config.showTimeEstimates}`,
				`**Tool Usage Tracking:** ${config.showToolUsage}`,
			];
			return lines.join("\n");
		}

		case "config": {
			const config = manager.getConfig();
			const lines: string[] = [
				"## Visual Progress Configuration",
				"",
				`**Enabled:** ${config.enabled}`,
				`**Show Progress Bar:** ${config.showProgressBar}`,
				`**Show Time Estimates:** ${config.showTimeEstimates}`,
				`**Show Tool Usage:** ${config.showToolUsage}`,
				`**Progress Bar Width:** ${config.progressBarWidth}`,
				`**Use Colors:** ${config.useColors}`,
				`**Store Historical Timing:** ${config.storeHistoricalTiming}`,
				`**Auto Track Tool Usage:** ${config.autoTrackToolUsage}`,
				"",
				"Update configuration: visualProgress({action: 'config', enabled: true, ...})",
			];
			return lines.join("\n");
		}

		case "reset": {
			manager.resetStats();
			return "✅ Statistics and historical timings have been reset.";
		}

		case "clear": {
			manager.clearSessions();
			return "✅ All sessions have been cleared.";
		}

		case "help": {
			return "## Visual Progress Tool Help\n\n**Purpose:** Track and visualize progress during evolution iterations.\n\n**Actions:**\n\n| Action | Description | Required Parameters |\n|--------|-------------|---------------------|\n| start | Start a new progress session | taskType, taskDescription |\n| step | Add a step to track | description |\n| update | Update step status | stepId, status |\n| phase | Change current phase | phase |\n| tool | Record tool usage | toolName |\n| complete | End session | success (optional), summary (optional) |\n| status | Show current progress | - |\n| sessions | List recent sessions | limit (optional) |\n| session | Get session details | sessionId |\n| estimate | Get duration estimate | taskType |\n| stats | View statistics | - |\n| config | View/update config | config options |\n| reset | Reset statistics | - |\n| clear | Clear sessions | - |\n\n**Progress Phases:**\n- context-gathering: Reading memory, roadmap, etc.\n- task-selection: Scoring and selecting tasks\n- planning: Creating implementation plan\n- implementation: Making code changes\n- verification: Running tests, build\n- completion: Updating docs, saying DONE\n\n**Step Statuses:**\n- pending: Not started\n- in_progress: Currently working\n- completed: Successfully finished\n- failed: Encountered error\n- skipped: Not needed";
		}

		default:
			return `Unknown action: ${action}. Use 'help' to see available actions.`;
	}
}

export const visualProgressTool: AgentTool = {
	name: "visual-progress",
	label: "Visual Progress",
	description:
		"Manage visual progress tracking during evolution iterations (Devin Pattern). Actions: start, step, update, phase, tool, complete, status, sessions, session, estimate, stats, config, reset, clear, help.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action: start, step, update, phase, tool, complete, status, sessions, session, estimate, stats, config, reset, clear, help",
		}),
		taskType: Type.Optional(
			Type.String({ description: "Task type: capability, reliability, feature" }),
		),
		taskDescription: Type.Optional(
			Type.String({ description: "Description of the task being tracked" }),
		),
		description: Type.Optional(Type.String({ description: "Step description" })),
		estimatedDuration: Type.Optional(Type.Number({ description: "Estimated duration in seconds" })),
		toolsUsed: Type.Optional(
			Type.Array(Type.String(), { description: "Tools that will be used for this step" }),
		),
		stepId: Type.Optional(Type.String({ description: "Step identifier to update" })),
		status: Type.Optional(
			Type.String({ description: "Step status: pending, in_progress, completed, failed, skipped" }),
		),
		errorMessage: Type.Optional(Type.String({ description: "Error message if step failed" })),
		phase: Type.Optional(
			Type.String({
				description:
					"Phase: context-gathering, task-selection, planning, implementation, verification, completion",
			}),
		),
		toolName: Type.Optional(Type.String({ description: "Tool name to record" })),
		success: Type.Optional(
			Type.Boolean({ description: "Whether the session completed successfully (default: true)" }),
		),
		summary: Type.Optional(Type.String({ description: "Summary of what was accomplished" })),
		sessionId: Type.Optional(Type.String({ description: "Session identifier to retrieve" })),
		limit: Type.Optional(Type.Number({ description: "Limit number of sessions to return" })),
	}),
	execute: async (
		_toolCallId: string,
		params: unknown,
	): Promise<AgentToolResult<{ success: boolean; action: string }>> => {
		const p = params as Record<string, unknown>;
		const output = executeVisualProgressTool(p);
		return {
			content: [{ type: "text", text: output }],
			details: { success: true, action: String(p.action || "") },
		};
	},
};

export default visualProgressTool;
