/**
 * Multi-Agent Orchestrator Tool
 *
 * Tool for managing the two-agent pattern (initializer + coder) for
 * autonomous evolution. Inspired by Claude Quickstart autonomous coding agent.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type OrchestratorTask,
	type SessionResult,
	type TaskStatus,
	createSampleTaskList,
	getMultiAgentOrchestrator,
	resetMultiAgentOrchestrator,
} from "../multi-agent.js";

/**
 * Multi-Agent Orchestrator Tool
 *
 * Actions:
 * - init: Start initializer session and create task list
 * - coder: Start coder session
 * - progress: View current progress
 * - next: Get next pending task
 * - update: Update task status
 * - complete: Complete current session
 * - stats: View statistics
 * - tasks: View task list
 * - sessions: View all sessions
 * - reset: Clear state and start fresh
 * - sample: Create sample task list for testing
 * - add-task: Add a new task to the list
 * - note: Add session note
 */
export const multiAgentTool: AgentTool = {
	name: "multiAgent",
	label: "Multi-Agent Orchestrator",
	description:
		"Manage the two-agent pattern (initializer + coder) for autonomous evolution. Inspired by Claude Quickstart autonomous coding agent pattern. Actions: init, coder, progress, next, update, complete, stats, tasks, sessions, reset, sample, add-task, note.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: init, coder, progress, next, update, complete, stats, tasks, sessions, reset, sample, add-task, note",
		}),
		projectName: Type.Optional(Type.String({ description: "Project name for init action" })),
		taskId: Type.Optional(Type.String({ description: "Task ID for update action" })),
		status: Type.Optional(
			Type.String({
				description: "Task status for update: pending, in_progress, completed, failed",
			}),
		),
		notes: Type.Optional(Type.Array(Type.String(), { description: "Notes to add" })),
		actualTime: Type.Optional(Type.Number({ description: "Actual time taken in minutes" })),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const args = params as {
			action: string;
			projectName?: string;
			taskId?: string;
			status?: TaskStatus;
			notes?: string[];
			actualTime?: number;
		};

		try {
			const orchestrator = getMultiAgentOrchestrator();

			switch (args.action) {
				case "init":
					return handleInit(orchestrator, args);

				case "coder":
					return handleCoder(orchestrator);

				case "progress":
					return handleProgress(orchestrator);

				case "next":
					return handleNext(orchestrator);

				case "update":
					return handleUpdate(orchestrator, args);

				case "complete":
					return handleComplete(orchestrator, args);

				case "stats":
					return handleStats(orchestrator);

				case "tasks":
					return handleTasks(orchestrator);

				case "sessions":
					return handleSessions(orchestrator);

				case "reset":
					return handleReset();

				case "sample":
					return handleSample(orchestrator, args);

				case "add-task":
					return handleAddTask(orchestrator, args);

				case "note":
					return handleNote(orchestrator, args);

				default:
					return {
						content: [
							{
								type: "text",
								text: `Unknown action: ${args.action}. Available actions: init, coder, progress, next, update, complete, stats, tasks, sessions, reset, sample, add-task, note`,
							},
						],
						details: { error: `Unknown action '${args.action}'` },
					};
			}
		} catch (e) {
			const errorMessage = e instanceof Error ? e.message : String(e);
			return {
				content: [{ type: "text", text: `Error: ${errorMessage}` }],
				details: { error: errorMessage },
			};
		}
	},
};

function handleInit(
	orchestrator: ReturnType<typeof getMultiAgentOrchestrator>,
	args: { projectName?: string },
): AgentToolResult<unknown> {
	if (!args.projectName) {
		return {
			content: [{ type: "text", text: "Error: projectName required for init action" }],
			details: { error: "Missing projectName" },
		};
	}

	// Start initializer session
	const session = orchestrator.startInitializerSession(args.projectName);

	return {
		content: [
			{
				type: "text",
				text: `# Initializer Session Started\n\n- **Session ID:** ${session.id}\n- **Project:** ${args.projectName}\n- **Status:** ${session.status}\n- **Started:** ${session.startTime}\n\n**Instructions:** Create a task list with tasks, then use \`multiAgent({action: 'complete', notes: ['...']})\` to complete initialization.`,
			},
		],
		details: { session },
	};
}

function handleCoder(
	orchestrator: ReturnType<typeof getMultiAgentOrchestrator>,
): AgentToolResult<unknown> {
	const session = orchestrator.startCoderSession();

	if (!session) {
		const progress = orchestrator.getProgress();
		if (!progress.taskList) {
			return {
				content: [
					{
						type: "text",
						text: "Error: No task list. Run initializer session first with `multiAgent({action: 'init', projectName: '...'})`",
					},
				],
				details: { error: "No task list" },
			};
		}
		return {
			content: [
				{
					type: "text",
					text: `No pending tasks. All ${progress.taskList.totalTasks} tasks completed.`,
				},
			],
			details: { completed: true, totalTasks: progress.taskList.totalTasks },
		};
	}

	const nextTask = orchestrator.getNextTask();

	return {
		content: [
			{
				type: "text",
				text: `# Coder Session Started\n\n- **Session ID:** ${session.id}\n- **Status:** ${session.status}\n- **Started:** ${session.startTime}\n- **Pending Tasks:** ${orchestrator.getProgress().pendingTasks.length}\n\n${nextTask ? `## Next Task\n\n- **ID:** ${nextTask.id}\n- **Description:** ${nextTask.description}\n- **Type:** ${nextTask.type}\n- **Priority:** ${nextTask.priority}\n- **Dependencies:** ${nextTask.dependencies?.join(", ") || "none"}\n\nUse \`multiAgent({action: 'update', taskId: '${nextTask.id}', status: 'completed'})\` to mark progress.` : "No eligible task found. Check dependencies."}`,
			},
		],
		details: { session, nextTask },
	};
}

function handleProgress(
	orchestrator: ReturnType<typeof getMultiAgentOrchestrator>,
): AgentToolResult<unknown> {
	const progress = orchestrator.getProgress();
	return {
		content: [{ type: "text", text: orchestrator.formatProgress() }],
		details: progress,
	};
}

function handleNext(
	orchestrator: ReturnType<typeof getMultiAgentOrchestrator>,
): AgentToolResult<unknown> {
	const task = orchestrator.getNextTask();

	if (!task) {
		return {
			content: [{ type: "text", text: "No pending tasks with satisfied dependencies." }],
			details: { noTask: true },
		};
	}

	return {
		content: [
			{
				type: "text",
				text: `# Next Task\n\n- **ID:** ${task.id}\n- **Description:** ${task.description}\n- **Type:** ${task.type}\n- **Priority:** ${task.priority}\n- **Status:** ${task.status}\n- **Dependencies:** ${task.dependencies?.join(", ") || "none"}\n- **Estimated Time:** ${task.estimatedTime || "unknown"} minutes\n`,
			},
		],
		details: { task },
	};
}

function handleUpdate(
	orchestrator: ReturnType<typeof getMultiAgentOrchestrator>,
	args: { taskId?: string; status?: TaskStatus; notes?: string[]; actualTime?: number },
): AgentToolResult<unknown> {
	if (!args.taskId || !args.status) {
		return {
			content: [{ type: "text", text: "Error: taskId and status required for update action" }],
			details: { error: "Missing taskId or status" },
		};
	}

	const noteText = args.notes ? args.notes.join("; ") : undefined;
	const task = orchestrator.updateTaskStatus(args.taskId, args.status, noteText, args.actualTime);

	if (!task) {
		return {
			content: [{ type: "text", text: `Error: Task ${args.taskId} not found` }],
			details: { error: "Task not found" },
		};
	}

	return {
		content: [
			{
				type: "text",
				text: `# Task Updated\n\n- **ID:** ${task.id}\n- **Status:** ${task.status}\n- **Notes:** ${task.notes || "none"}\n${task.actualTime ? `- **Actual Time:** ${task.actualTime} minutes\n` : ""}\n**Progress:** ${orchestrator.getProgress().progressPercent}%`,
			},
		],
		details: { task },
	};
}

function handleComplete(
	orchestrator: ReturnType<typeof getMultiAgentOrchestrator>,
	args: { notes?: string[] },
): AgentToolResult<unknown> {
	const currentSession = orchestrator.getCurrentSession();

	if (!currentSession) {
		return {
			content: [{ type: "text", text: "Error: No active session to complete" }],
			details: { error: "No active session" },
		};
	}

	let result: SessionResult | undefined;
	if (currentSession.role === "initializer") {
		const taskList = orchestrator.getTaskList();
		if (!taskList) {
			return {
				content: [
					{
						type: "text",
						text: "Error: No task list created. Create task list before completing initialization.",
					},
				],
				details: { error: "No task list" },
			};
		}
		result = orchestrator.completeInitializerSession(currentSession, taskList);
	} else {
		const progress = orchestrator.getProgress();
		const notesStr = args.notes ? args.notes.join("; ") : undefined;
		result = orchestrator.completeCoderSession(
			currentSession,
			progress.completedTasks.length,
			0,
			notesStr ? [notesStr] : undefined,
		);
	}

	return {
		content: [
			{
				type: "text",
				text: `# Session Completed\n\n- **Session ID:** ${result.session.id}\n- **Role:** ${result.session.role}\n- **Status:** ${result.session.status}\n- **Tasks Completed:** ${result.tasksCompleted}\n- **Tasks Failed:** ${result.tasksFailed}\n- **Success:** ${result.success ? "Yes" : "No"}\n\n**Next Action:** ${result.nextAction}\n\n${result.nextAction === "continue" ? "Run `multiAgent({action: 'coder'})` to start next session." : result.nextAction === "complete" ? "All tasks complete! Project finished." : "Session paused. Run `multiAgent({action: 'coder'})` to resume."}`,
			},
		],
		details: { result },
	};
}

function handleStats(
	orchestrator: ReturnType<typeof getMultiAgentOrchestrator>,
): AgentToolResult<unknown> {
	const stats = orchestrator.getStats();
	return {
		content: [{ type: "text", text: orchestrator.formatStats() }],
		details: { stats },
	};
}

function handleTasks(
	orchestrator: ReturnType<typeof getMultiAgentOrchestrator>,
): AgentToolResult<unknown> {
	const taskList = orchestrator.getTaskList();
	return {
		content: [{ type: "text", text: orchestrator.formatTaskList() }],
		details: { taskList },
	};
}

function handleSessions(
	orchestrator: ReturnType<typeof getMultiAgentOrchestrator>,
): AgentToolResult<unknown> {
	const sessions = orchestrator.getSessions();

	if (sessions.length === 0) {
		return {
			content: [
				{
					type: "text",
					text: "No sessions recorded. Start with `multiAgent({action: 'init', projectName: '...'})`",
				},
			],
			details: { sessions: [] },
		};
	}

	let output = "# Sessions\n\n";
	output += "| ID | Role | Status | Started | Completed | Notes |\n";
	output += "|----|------|--------|---------|-----------|-------|\n";

	for (const session of sessions) {
		output += `| ${session.id} | ${session.role} | ${session.status} | ${session.startTime.slice(0, 10)} | ${session.tasksCompleted} | ${session.notes.length} |\n`;
	}

	return {
		content: [{ type: "text", text: output }],
		details: { sessions },
	};
}

function handleReset(): AgentToolResult<unknown> {
	resetMultiAgentOrchestrator();
	return {
		content: [
			{
				type: "text",
				text: "# Orchestrator Reset\n\nAll state cleared. Start fresh with `multiAgent({action: 'init', projectName: '...'})`",
			},
		],
		details: { reset: true },
	};
}

function handleSample(
	orchestrator: ReturnType<typeof getMultiAgentOrchestrator>,
	args: { projectName?: string },
): AgentToolResult<unknown> {
	const projectName = args.projectName || "sample-project";
	const sampleList = createSampleTaskList(projectName);

	// Start session and save
	const session = orchestrator.startInitializerSession(projectName);
	orchestrator.completeInitializerSession(session, sampleList);

	return {
		content: [
			{
				type: "text",
				text: `# Sample Task List Created\n\n- **Project:** ${projectName}\n- **Tasks:** ${sampleList.totalTasks}\n\n${orchestrator.formatTaskList()}`,
			},
		],
		details: { sampleList },
	};
}

function handleAddTask(
	orchestrator: ReturnType<typeof getMultiAgentOrchestrator>,
	args: { notes?: string[] },
): AgentToolResult<unknown> {
	// For simplicity, use notes as task descriptions
	if (!args.notes || args.notes.length === 0) {
		return {
			content: [{ type: "text", text: "Error: Provide task descriptions via notes array" }],
			details: { error: "Missing notes" },
		};
	}

	const taskList = orchestrator.getTaskList();
	if (!taskList) {
		return {
			content: [{ type: "text", text: "Error: No task list. Run init action first." }],
			details: { error: "No task list" },
		};
	}

	const newTasks: OrchestratorTask[] = args.notes.map((desc, i) => ({
		id: `task-${taskList.tasks.length + i + 1}`,
		description: desc,
		type: "capability" as const,
		priority: 5,
		status: "pending" as TaskStatus,
	}));

	taskList.tasks.push(...newTasks);
	taskList.totalTasks += newTasks.length;
	taskList.updatedAt = new Date().toISOString();

	return {
		content: [
			{
				type: "text",
				text: `# Tasks Added\n\n- **Added:** ${newTasks.length} tasks\n- **Total:** ${taskList.totalTasks} tasks\n\nNew tasks:\n${newTasks.map((t) => `- ${t.id}: ${t.description}`).join("\n")}`,
			},
		],
		details: { newTasks },
	};
}

function handleNote(
	orchestrator: ReturnType<typeof getMultiAgentOrchestrator>,
	args: { notes?: string[] },
): AgentToolResult<unknown> {
	if (!args.notes || args.notes.length === 0) {
		return {
			content: [{ type: "text", text: "Error: notes array required for note action" }],
			details: { error: "Missing notes" },
		};
	}

	for (const note of args.notes) {
		orchestrator.addSessionNote(note);
	}

	return {
		content: [
			{ type: "text", text: `# Notes Added\n\n${args.notes.map((n) => `- ${n}`).join("\n")}` },
		],
		details: { notes: args.notes },
	};
}

export default multiAgentTool;
