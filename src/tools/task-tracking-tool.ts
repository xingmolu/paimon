/**
 * Task Tracking Tool - OpenHands SDK Pattern
 *
 * Tool for tracking task progress during agent execution.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { type Task, type TaskSession, getTaskTrackingManager } from "../task-tracking.js";

/**
 * Task Tracking Tool
 *
 * Actions:
 * - start: Start a new task tracking session
 * - current: Get current session
 * - add: Add a new task
 * - update: Update task status/progress
 * - complete: Mark task as completed
 * - fail: Mark task as failed
 * - get: Get task details
 * - list: List tasks with filtering
 * - dependencies: Get task dependencies
 * - subtasks: Get task subtasks
 * - progress: Get session progress
 * - summary: Get session summary
 * - next: Get next task to work on
 * - sessions: List all sessions
 * - set-session: Set active session
 * - clear: Clear current session
 * - clear-all: Clear all sessions
 * - stats: Get statistics
 */
export const taskTrackingTool: AgentTool = {
	name: "taskTracking",
	label: "Task Tracking",
	description:
		"Manage task tracking for agent execution - track progress, dependencies, and completion state. Actions: start (create session), add (create task), update (update status/progress), complete (mark done), fail (mark failed), get (get task details), list (list tasks), dependencies (get deps), subtasks (get children), progress (get percentage), summary (get session summary), next (get next task), sessions (list sessions), set-session (switch session), clear (clear session), clear-all (clear all), stats (get statistics).",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: start, current, add, update, complete, fail, get, list, dependencies, subtasks, progress, summary, next, sessions, set-session, clear, clear-all, stats",
		}),
		name: Type.Optional(
			Type.String({ description: "Task or session name (for start, add actions)" }),
		),
		description: Type.Optional(Type.String({ description: "Task or session description" })),
		taskId: Type.Optional(
			Type.String({
				description: "Task ID (for update, complete, fail, get, dependencies, subtasks actions)",
			}),
		),
		sessionId: Type.Optional(Type.String({ description: "Session ID (for set-session action)" })),
		status: Type.Optional(
			Type.String({
				description:
					"Task status (for update action): pending, in_progress, completed, failed, blocked",
			}),
		),
		priority: Type.Optional(
			Type.String({
				description: "Task priority (for add, list actions): low, medium, high, critical",
			}),
		),
		progress: Type.Optional(
			Type.Number({ description: "Task progress percentage (0-100) (for update action)" }),
		),
		dependencies: Type.Optional(
			Type.Array(Type.String(), { description: "Task dependency IDs (for add action)" }),
		),
		parentId: Type.Optional(
			Type.String({ description: "Parent task ID (for add action - creates subtask)" }),
		),
		estimatedTime: Type.Optional(
			Type.Number({ description: "Estimated time in minutes (for add action)" }),
		),
		actualTime: Type.Optional(
			Type.Number({ description: "Actual time in minutes (for update, complete actions)" }),
		),
		assignee: Type.Optional(
			Type.String({ description: "Agent role or identifier (for add action)" }),
		),
		tags: Type.Optional(Type.Array(Type.String(), { description: "Task tags (for add action)" })),
		notes: Type.Optional(Type.String({ description: "Task notes (for update action)" })),
		artifacts: Type.Optional(
			Type.Array(Type.String(), {
				description: "Task artifacts - files or outputs produced (for complete action)",
			}),
		),
		errors: Type.Optional(Type.String({ description: "Error message (for fail action)" })),
		blocked: Type.Optional(
			Type.Boolean({ description: "Filter for blocked tasks (for list action)" }),
		),
		limit: Type.Optional(
			Type.Number({ description: "Limit number of results (for sessions, list actions)" }),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const args = params as {
			action: string;
			name?: string;
			description?: string;
			taskId?: string;
			sessionId?: string;
			status?: Task["status"];
			priority?: Task["priority"];
			progress?: number;
			dependencies?: string[];
			parentId?: string;
			estimatedTime?: number;
			actualTime?: number;
			assignee?: string;
			tags?: string[];
			notes?: string;
			artifacts?: string[];
			errors?: string;
			blocked?: boolean;
			limit?: number;
		};

		try {
			const manager = getTaskTrackingManager();

			switch (args.action) {
				case "start":
					return handleStart(manager, args);
				case "current":
					return handleCurrent(manager);
				case "add":
					return handleAdd(manager, args);
				case "update":
					return handleUpdate(manager, args);
				case "complete":
					return handleComplete(manager, args);
				case "fail":
					return handleFail(manager, args);
				case "get":
					return handleGet(manager, args);
				case "list":
					return handleList(manager, args);
				case "dependencies":
					return handleDependencies(manager, args);
				case "subtasks":
					return handleSubtasks(manager, args);
				case "progress":
					return handleProgress(manager);
				case "summary":
					return handleSummary(manager);
				case "next":
					return handleNext(manager);
				case "sessions":
					return handleSessions(manager, args);
				case "set-session":
					return handleSetSession(manager, args);
				case "clear":
					return handleClear(manager);
				case "clear-all":
					return handleClearAll(manager);
				case "stats":
					return handleStats(manager);
				default:
					return {
						content: [
							{
								type: "text",
								text: `Unknown action: ${args.action}`,
							},
						],
						details: { error: "Unknown action" },
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

function handleStart(
	manager: ReturnType<typeof getTaskTrackingManager>,
	args: { name?: string; description?: string },
): AgentToolResult<unknown> {
	const session = manager.startSession(args.name || "Untitled Session", args.description);

	return {
		content: [
			{
				type: "text",
				text: `# Session Started\n\nID: ${session.id}\nName: ${session.name}\nStatus: ${session.status}`,
			},
		],
		details: { session: { ...session, tasks: Object.fromEntries(session.tasks) } },
	};
}

function handleCurrent(
	manager: ReturnType<typeof getTaskTrackingManager>,
): AgentToolResult<unknown> {
	const session = manager.getCurrentSession();

	if (!session) {
		return {
			content: [{ type: "text", text: "No active session" }],
			details: { noSession: true },
		};
	}

	const summary = manager.getSessionSummary();

	return {
		content: [
			{
				type: "text",
				text: `# Current Session\n\nID: ${session.id}\nName: ${session.name}\nProgress: ${summary.progress}%`,
			},
		],
		details: { session: { ...session, tasks: Object.fromEntries(session.tasks) }, summary },
	};
}

function handleAdd(
	manager: ReturnType<typeof getTaskTrackingManager>,
	args: {
		name?: string;
		description?: string;
		priority?: Task["priority"];
		dependencies?: string[];
		parentId?: string;
		estimatedTime?: number;
		assignee?: string;
		tags?: string[];
	},
): AgentToolResult<unknown> {
	try {
		const task = manager.addTask(args.name || "Untitled Task", args.description || "", {
			priority: args.priority,
			dependencies: args.dependencies,
			parentId: args.parentId,
			estimatedTime: args.estimatedTime,
			assignee: args.assignee,
			tags: args.tags,
		});

		return {
			content: [
				{
					type: "text",
					text: `# Task Added\n\nID: ${task.id}\nName: ${task.name}\nStatus: ${task.status}\nPriority: ${task.priority}`,
				},
			],
			details: { task },
		};
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		return {
			content: [{ type: "text", text: `Error: ${errorMessage}` }],
			details: { error: errorMessage },
		};
	}
}

function handleUpdate(
	manager: ReturnType<typeof getTaskTrackingManager>,
	args: {
		taskId?: string;
		status?: Task["status"];
		progress?: number;
		actualTime?: number;
		notes?: string;
	},
): AgentToolResult<unknown> {
	if (!args.taskId) {
		return {
			content: [{ type: "text", text: "Error: taskId required for update action" }],
			details: { error: "Missing taskId" },
		};
	}

	try {
		const task = manager.updateTask(args.taskId, {
			status: args.status,
			progress: args.progress,
			actualTime: args.actualTime,
			notes: args.notes,
		});

		if (!task) {
			return {
				content: [{ type: "text", text: "Error: Task not found" }],
				details: { error: "Task not found" },
			};
		}

		return {
			content: [
				{
					type: "text",
					text: `# Task Updated\n\nID: ${task.id}\nStatus: ${task.status}\nProgress: ${task.progress}%`,
				},
			],
			details: { task },
		};
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		return {
			content: [{ type: "text", text: `Error: ${errorMessage}` }],
			details: { error: errorMessage },
		};
	}
}

function handleComplete(
	manager: ReturnType<typeof getTaskTrackingManager>,
	args: { taskId?: string; actualTime?: number; artifacts?: string[] },
): AgentToolResult<unknown> {
	if (!args.taskId) {
		return {
			content: [{ type: "text", text: "Error: taskId required for complete action" }],
			details: { error: "Missing taskId" },
		};
	}

	const task = manager.completeTask(args.taskId, args.actualTime, args.artifacts);

	if (!task) {
		return {
			content: [{ type: "text", text: "Error: Task not found" }],
			details: { error: "Task not found" },
		};
	}

	const summary = manager.getSessionSummary();

	return {
		content: [
			{
				type: "text",
				text: `# Task Completed\n\nID: ${task.id}\nName: ${task.name}\nProgress: ${summary.progress}%`,
			},
		],
		details: { task, summary },
	};
}

function handleFail(
	manager: ReturnType<typeof getTaskTrackingManager>,
	args: { taskId?: string; errors?: string },
): AgentToolResult<unknown> {
	if (!args.taskId) {
		return {
			content: [{ type: "text", text: "Error: taskId required for fail action" }],
			details: { error: "Missing taskId" },
		};
	}

	const task = manager.failTask(args.taskId, args.errors || "Unknown error");

	if (!task) {
		return {
			content: [{ type: "text", text: "Error: Task not found" }],
			details: { error: "Task not found" },
		};
	}

	return {
		content: [
			{
				type: "text",
				text: `# Task Failed\n\nID: ${task.id}\nName: ${task.name}\nStatus: ${task.status}`,
			},
		],
		details: { task },
	};
}

function handleGet(
	manager: ReturnType<typeof getTaskTrackingManager>,
	args: { taskId?: string },
): AgentToolResult<unknown> {
	if (!args.taskId) {
		return {
			content: [{ type: "text", text: "Error: taskId required for get action" }],
			details: { error: "Missing taskId" },
		};
	}

	const task = manager.getTask(args.taskId);

	if (!task) {
		return {
			content: [{ type: "text", text: "Error: Task not found" }],
			details: { error: "Task not found" },
		};
	}

	return {
		content: [
			{
				type: "text",
				text: `# Task Details\n\nID: ${task.id}\nName: ${task.name}\nStatus: ${task.status}\nPriority: ${task.priority}\nProgress: ${task.progress}%`,
			},
		],
		details: { task },
	};
}

function handleList(
	manager: ReturnType<typeof getTaskTrackingManager>,
	args: {
		status?: Task["status"];
		priority?: Task["priority"];
		parentId?: string;
		blocked?: boolean;
		limit?: number;
	},
): AgentToolResult<unknown> {
	const tasks = manager.listTasks({
		status: args.status,
		priority: args.priority,
		parentId: args.parentId,
		blocked: args.blocked,
	});

	const limit = args.limit || 20;
	const limited = tasks.slice(0, limit);

	let output = `# Tasks (${tasks.length} total)\n\n`;

	for (const task of limited) {
		output += `- ${task.id}: ${task.name} (${task.status}, ${task.priority})\n`;
	}

	if (tasks.length > limit) {
		output += `\nShowing ${limit} of ${tasks.length} tasks\n`;
	}

	return {
		content: [{ type: "text", text: output }],
		details: { count: tasks.length, tasks: limited },
	};
}

function handleDependencies(
	manager: ReturnType<typeof getTaskTrackingManager>,
	args: { taskId?: string },
): AgentToolResult<unknown> {
	if (!args.taskId) {
		return {
			content: [{ type: "text", text: "Error: taskId required for dependencies action" }],
			details: { error: "Missing taskId" },
		};
	}

	const deps = manager.getDependencies(args.taskId);

	return {
		content: [
			{
				type: "text",
				text: `# Task Dependencies\n\nTask: ${args.taskId}\nDependencies: ${deps.length}`,
			},
		],
		details: { taskId: args.taskId, dependencies: deps },
	};
}

function handleSubtasks(
	manager: ReturnType<typeof getTaskTrackingManager>,
	args: { taskId?: string },
): AgentToolResult<unknown> {
	if (!args.taskId) {
		return {
			content: [{ type: "text", text: "Error: taskId required for subtasks action" }],
			details: { error: "Missing taskId" },
		};
	}

	const subtasks = manager.getSubtasks(args.taskId);

	return {
		content: [
			{
				type: "text",
				text: `# Task Subtasks\n\nTask: ${args.taskId}\nSubtasks: ${subtasks.length}`,
			},
		],
		details: { taskId: args.taskId, subtasks },
	};
}

function handleProgress(
	manager: ReturnType<typeof getTaskTrackingManager>,
): AgentToolResult<unknown> {
	const progress = manager.getProgress();
	const summary = manager.getSessionSummary();

	return {
		content: [
			{
				type: "text",
				text: `# Session Progress\n\nProgress: ${progress}%\nCompleted: ${summary.completed}/${summary.total} tasks`,
			},
		],
		details: { progress, summary },
	};
}

function handleSummary(
	manager: ReturnType<typeof getTaskTrackingManager>,
): AgentToolResult<unknown> {
	const summary = manager.getSessionSummary();

	return {
		content: [
			{
				type: "text",
				text: `# Session Summary\n\nTotal: ${summary.total}\nCompleted: ${summary.completed}\nProgress: ${summary.progress}%`,
			},
		],
		details: { summary },
	};
}

function handleNext(manager: ReturnType<typeof getTaskTrackingManager>): AgentToolResult<unknown> {
	const task = manager.getNextTask();

	if (!task) {
		return {
			content: [{ type: "text", text: "No tasks available" }],
			details: { noTask: true },
		};
	}

	return {
		content: [
			{
				type: "text",
				text: `# Next Task\n\nID: ${task.id}\nName: ${task.name}\nStatus: ${task.status}\nPriority: ${task.priority}`,
			},
		],
		details: { nextTask: task },
	};
}

function handleSessions(
	manager: ReturnType<typeof getTaskTrackingManager>,
	args: { status?: string; limit?: number },
): AgentToolResult<unknown> {
	const sessions = manager.getSessions({
		status: args.status as TaskSession["status"],
		limit: args.limit,
	});

	let output = `# Sessions (${sessions.length} total)\n\n`;

	for (const session of sessions) {
		output += `- ${session.id}: ${session.name} (${session.status}, ${session.completedTasks}/${session.totalTasks} tasks)\n`;
	}

	return {
		content: [{ type: "text", text: output }],
		details: { count: sessions.length, sessions },
	};
}

function handleSetSession(
	manager: ReturnType<typeof getTaskTrackingManager>,
	args: { sessionId?: string },
): AgentToolResult<unknown> {
	if (!args.sessionId) {
		return {
			content: [{ type: "text", text: "Error: sessionId required for set-session action" }],
			details: { error: "Missing sessionId" },
		};
	}

	const session = manager.setActiveSession(args.sessionId);

	if (!session) {
		return {
			content: [{ type: "text", text: "Error: Session not found" }],
			details: { error: "Session not found" },
		};
	}

	return {
		content: [
			{
				type: "text",
				text: `# Session Activated\n\nID: ${session.id}\nName: ${session.name}`,
			},
		],
		details: { session: { ...session, tasks: Object.fromEntries(session.tasks) } },
	};
}

function handleClear(manager: ReturnType<typeof getTaskTrackingManager>): AgentToolResult<unknown> {
	manager.clearSession();

	return {
		content: [
			{
				type: "text",
				text: "# Session Cleared",
			},
		],
		details: { cleared: true },
	};
}

function handleClearAll(
	manager: ReturnType<typeof getTaskTrackingManager>,
): AgentToolResult<unknown> {
	manager.clearAll();

	return {
		content: [
			{
				type: "text",
				text: "# All Sessions Cleared",
			},
		],
		details: { clearedAll: true },
	};
}

function handleStats(manager: ReturnType<typeof getTaskTrackingManager>): AgentToolResult<unknown> {
	const stats = manager.getStats();

	const output = `# Task Tracking Statistics\n\nTotal Sessions: ${stats.totalSessions}\nActive Sessions: ${stats.activeSessions}\nTotal Tasks: ${stats.totalTasks}\nCompleted Tasks: ${stats.completedTasks}\nFailed Tasks: ${stats.failedTasks}\nBlocked Tasks: ${stats.blockedTasks}`;

	return {
		content: [{ type: "text", text: output }],
		details: { stats },
	};
}

export default taskTrackingTool;
