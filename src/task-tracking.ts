/**
 * Task Tracking Manager (OpenHands SDK Pattern)
 *
 * Specialized tool for tracking task progress during agent execution.
 * Supports task dependencies, subtasks, completion state, and progress tracking.
 *
 * Inspired by OpenHands Software Agent SDK TaskTrackerTool.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface Task {
	id: string;
	name: string;
	description: string;
	status: "pending" | "in_progress" | "completed" | "failed" | "blocked";
	priority: "low" | "medium" | "high" | "critical";
	progress: number; // 0-100 percentage
	dependencies: string[]; // IDs of tasks that must complete first
	subtasks: string[]; // IDs of child tasks
	parentId?: string; // ID of parent task (if subtask)
	createdAt: Date;
	updatedAt: Date;
	startedAt?: Date;
	completedAt?: Date;
	estimatedTime?: number; // minutes
	actualTime?: number; // minutes
	assignee?: string; // agent role or identifier
	tags: string[];
	notes: string[];
	artifacts: string[]; // files or outputs produced
	errors: string[];
}

export interface TaskSession {
	id: string;
	name: string;
	description: string;
	createdAt: Date;
	updatedAt: Date;
	tasks: Map<string, Task>;
	completedTasks: number;
	totalTasks: number;
	estimatedTotalTime?: number;
	actualTotalTime?: number;
	status: "active" | "completed" | "paused" | "cancelled";
	rootTaskIds: string[]; // Top-level tasks (no parent)
}

export interface TaskTrackingStats {
	totalSessions: number;
	activeSessions: number;
	totalTasks: number;
	completedTasks: number;
	failedTasks: number;
	blockedTasks: number;
	averageCompletionRate: number;
	averageTaskTime: number;
	tasksByPriority: Record<string, number>;
	tasksByStatus: Record<string, number>;
	tasksByTag: Record<string, number>;
	dependencyDepth: number; // Max dependency chain length
}

const DATA_DIR = path.join(process.env.HOME || "~", ".paimon");
const TASKS_FILE = path.join(DATA_DIR, "task-tracking.json");

/**
 * TaskTrackingManager - Manage task tracking for agent execution
 */
export class TaskTrackingManager {
	private sessions: Map<string, TaskSession> = new Map();
	private currentSessionId?: string;
	private stats: TaskTrackingStats;

	constructor() {
		this.stats = this.initStats();
		this.loadState();
	}

	private initStats(): TaskTrackingStats {
		return {
			totalSessions: 0,
			activeSessions: 0,
			totalTasks: 0,
			completedTasks: 0,
			failedTasks: 0,
			blockedTasks: 0,
			averageCompletionRate: 0,
			averageTaskTime: 0,
			tasksByPriority: { low: 0, medium: 0, high: 0, critical: 0 },
			tasksByStatus: { pending: 0, in_progress: 0, completed: 0, failed: 0, blocked: 0 },
			tasksByTag: {},
			dependencyDepth: 0,
		};
	}

	private loadState(): void {
		try {
			if (fs.existsSync(TASKS_FILE)) {
				const data = JSON.parse(fs.readFileSync(TASKS_FILE, "utf-8"));

				// Load sessions
				if (data.sessions) {
					for (const sessionData of data.sessions) {
						const session: TaskSession = {
							...sessionData,
							tasks: new Map(Object.entries(sessionData.tasks || {})),
							createdAt: new Date(sessionData.createdAt),
							updatedAt: new Date(sessionData.updatedAt),
						};
						this.sessions.set(session.id, session);
					}
				}

				// Load current session
				this.currentSessionId = data.currentSessionId;

				// Load stats
				if (data.stats) {
					this.stats = data.stats;
				}
			}
		} catch (error) {
			// Ignore errors, start fresh
		}
	}

	private saveState(): void {
		try {
			if (!fs.existsSync(DATA_DIR)) {
				fs.mkdirSync(DATA_DIR, { recursive: true });
			}

			const data = {
				sessions: Array.from(this.sessions.values()).map((session) => ({
					...session,
					tasks: Object.fromEntries(session.tasks),
				})),
				currentSessionId: this.currentSessionId,
				stats: this.stats,
			};

			fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
		} catch (error) {
			// Ignore save errors
		}
	}

	/**
	 * Start a new task tracking session
	 */
	startSession(name: string, description?: string): TaskSession {
		const id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		const session: TaskSession = {
			id,
			name,
			description: description || "",
			createdAt: new Date(),
			updatedAt: new Date(),
			tasks: new Map(),
			completedTasks: 0,
			totalTasks: 0,
			status: "active",
			rootTaskIds: [],
		};

		this.sessions.set(id, session);
		this.currentSessionId = id;
		this.stats.totalSessions++;
		this.stats.activeSessions++;
		this.saveState();

		return session;
	}

	/**
	 * Get current session
	 */
	getCurrentSession(): TaskSession | undefined {
		if (!this.currentSessionId) return undefined;
		return this.sessions.get(this.currentSessionId);
	}

	/**
	 * Add a new task
	 */
	addTask(
		name: string,
		description: string,
		options?: {
			priority?: Task["priority"];
			dependencies?: string[];
			parentId?: string;
			estimatedTime?: number;
			assignee?: string;
			tags?: string[];
		},
	): Task {
		const session = this.getCurrentSession();
		if (!session) {
			throw new Error("No active session. Start a session first.");
		}

		const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		const task: Task = {
			id,
			name,
			description,
			status: "pending",
			priority: options?.priority || "medium",
			progress: 0,
			dependencies: options?.dependencies || [],
			subtasks: [],
			parentId: options?.parentId,
			createdAt: new Date(),
			updatedAt: new Date(),
			estimatedTime: options?.estimatedTime,
			assignee: options?.assignee,
			tags: options?.tags || [],
			notes: [],
			artifacts: [],
			errors: [],
		};

		// Check dependencies
		for (const depId of task.dependencies) {
			const depTask = session.tasks.get(depId);
			if (!depTask) {
				throw new Error(`Dependency task ${depId} not found`);
			}
			// Add this task as a subtask to dependency if it was a parent relationship
			if (depTask.subtasks.includes(id)) {
				depTask.subtasks.push(id);
			}
		}

		// If has parent, add as subtask
		if (task.parentId) {
			const parentTask = session.tasks.get(task.parentId);
			if (parentTask) {
				parentTask.subtasks.push(id);
				// Parent's dependencies become implicit dependencies
				task.dependencies = [...task.dependencies, ...parentTask.dependencies];
			}
		}

		// Check if blocked by incomplete dependencies
		const blockedByDeps = task.dependencies.some((depId) => {
			const depTask = session.tasks.get(depId);
			return depTask && depTask.status !== "completed";
		});

		if (blockedByDeps) {
			task.status = "blocked";
			this.stats.blockedTasks++;
		}

		session.tasks.set(id, task);
		session.totalTasks++;
		session.updatedAt = new Date();

		// Track root tasks (no parent)
		if (!task.parentId) {
			session.rootTaskIds.push(id);
		}

		// Update stats
		this.stats.totalTasks++;
		this.stats.tasksByPriority[task.priority]++;
		this.stats.tasksByStatus[task.status]++;
		for (const tag of task.tags) {
			this.stats.tasksByTag[tag] = (this.stats.tasksByTag[tag] || 0) + 1;
		}

		// Calculate dependency depth
		this.updateDependencyDepth(session);

		this.saveState();

		return task;
	}

	/**
	 * Update task status/progress
	 */
	updateTask(
		taskId: string,
		updates: {
			status?: Task["status"];
			progress?: number;
			actualTime?: number;
			notes?: string;
			artifacts?: string;
			errors?: string;
		},
	): Task | undefined {
		const session = this.getCurrentSession();
		if (!session) return undefined;

		const task = session.tasks.get(taskId);
		if (!task) return undefined;

		const oldStatus = task.status;

		// Apply updates
		if (updates.status !== undefined) {
			// Check if can transition to new status
			if (updates.status === "in_progress" && task.status === "blocked") {
				// Check if all dependencies are completed
				const allDepsComplete = task.dependencies.every((depId) => {
					const depTask = session.tasks.get(depId);
					return depTask && depTask.status === "completed";
				});
				if (!allDepsComplete) {
					throw new Error("Task is blocked by incomplete dependencies");
				}
			}
			task.status = updates.status;

			if (updates.status === "in_progress" && !task.startedAt) {
				task.startedAt = new Date();
			}

			if (updates.status === "completed") {
				task.completedAt = new Date();
				task.progress = 100;
				session.completedTasks++;
				this.stats.completedTasks++;

				// Unblock dependent tasks
				this.unblockDependentTasks(session, taskId);
			}

			if (updates.status === "failed") {
				this.stats.failedTasks++;
			}

			// Update stats
			this.stats.tasksByStatus[oldStatus]--;
			this.stats.tasksByStatus[task.status]++;
		}

		if (updates.progress !== undefined) {
			task.progress = Math.min(100, Math.max(0, updates.progress));
		}

		if (updates.actualTime !== undefined) {
			task.actualTime = updates.actualTime;
		}

		if (updates.notes) {
			task.notes.push(updates.notes);
		}

		if (updates.artifacts) {
			task.artifacts.push(updates.artifacts);
		}

		if (updates.errors) {
			task.errors.push(updates.errors);
		}

		task.updatedAt = new Date();
		session.updatedAt = new Date();

		// Update session status if all tasks complete
		if (session.completedTasks === session.totalTasks) {
			session.status = "completed";
			session.actualTotalTime = this.calculateSessionTime(session);
			this.stats.activeSessions--;
		}

		this.saveState();

		return task;
	}

	/**
	 * Unblock dependent tasks when a dependency completes
	 */
	private unblockDependentTasks(session: TaskSession, completedTaskId: string): void {
		for (const [id, task] of session.tasks) {
			if (task.status === "blocked" && task.dependencies.includes(completedTaskId)) {
				// Check if all dependencies are now complete
				const allDepsComplete = task.dependencies.every((depId) => {
					const depTask = session.tasks.get(depId);
					return depTask && depTask.status === "completed";
				});

				if (allDepsComplete) {
					task.status = "pending";
					this.stats.tasksByStatus.blocked--;
					this.stats.tasksByStatus.pending++;
					this.stats.blockedTasks--;
				}
			}
		}
	}

	/**
	 * Complete a task
	 */
	completeTask(taskId: string, actualTime?: number, artifacts?: string[]): Task | undefined {
		return this.updateTask(taskId, {
			status: "completed",
			actualTime,
			...(artifacts && artifacts.length > 0 ? { artifacts: artifacts.join("\n") } : {}),
		});
	}

	/**
	 * Mark task as failed
	 */
	failTask(taskId: string, error: string): Task | undefined {
		return this.updateTask(taskId, {
			status: "failed",
			errors: error,
		});
	}

	/**
	 * Get task by ID
	 */
	getTask(taskId: string): Task | undefined {
		const session = this.getCurrentSession();
		if (!session) return undefined;
		return session.tasks.get(taskId);
	}

	/**
	 * List tasks with filtering
	 */
	listTasks(options?: {
		status?: Task["status"];
		priority?: Task["priority"];
		parentId?: string;
		blocked?: boolean;
	}): Task[] {
		const session = this.getCurrentSession();
		if (!session) return [];

		let tasks = Array.from(session.tasks.values());

		if (options?.status) {
			tasks = tasks.filter((t) => t.status === options.status);
		}

		if (options?.priority) {
			tasks = tasks.filter((t) => t.priority === options.priority);
		}

		if (options?.parentId) {
			tasks = tasks.filter((t) => t.parentId === options.parentId);
		}

		if (options?.blocked) {
			tasks = tasks.filter((t) => t.status === "blocked");
		}

		// Sort by priority (critical first) then by createdAt
		const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
		tasks.sort((a, b) => {
			const prioDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
			if (prioDiff !== 0) return prioDiff;
			return a.createdAt.getTime() - b.createdAt.getTime();
		});

		return tasks;
	}

	/**
	 * Get task dependencies (all ancestors)
	 */
	getDependencies(taskId: string): Task[] {
		const session = this.getCurrentSession();
		if (!session) return [];

		const task = session.tasks.get(taskId);
		if (!task) return [];

		const deps: Task[] = [];
		for (const depId of task.dependencies) {
			const depTask = session.tasks.get(depId);
			if (depTask) {
				deps.push(depTask);
			}
		}

		return deps;
	}

	/**
	 * Get task subtasks (all descendants)
	 */
	getSubtasks(taskId: string): Task[] {
		const session = this.getCurrentSession();
		if (!session) return [];

		const task = session.tasks.get(taskId);
		if (!task) return [];

		const subtasks: Task[] = [];
		for (const subtaskId of task.subtasks) {
			const subtask = session.tasks.get(subtaskId);
			if (subtask) {
				subtasks.push(subtask);
				// Recursively get nested subtasks
				subtasks.push(...this.getSubtasks(subtaskId));
			}
		}

		return subtasks;
	}

	/**
	 * Get session progress (percentage of completed tasks)
	 */
	getProgress(): number {
		const session = this.getCurrentSession();
		if (!session || session.totalTasks === 0) return 0;
		return Math.round((session.completedTasks / session.totalTasks) * 100);
	}

	/**
	 * Get session summary
	 */
	getSessionSummary(): {
		total: number;
		completed: number;
		inProgress: number;
		pending: number;
		blocked: number;
		failed: number;
		progress: number;
		estimatedTime: number;
		actualTime: number;
	} {
		const session = this.getCurrentSession();
		if (!session) {
			return {
				total: 0,
				completed: 0,
				inProgress: 0,
				pending: 0,
				blocked: 0,
				failed: 0,
				progress: 0,
				estimatedTime: 0,
				actualTime: 0,
			};
		}

		const tasks = Array.from(session.tasks.values());
		const inProgress = tasks.filter((t) => t.status === "in_progress").length;
		const pending = tasks.filter((t) => t.status === "pending").length;
		const blocked = tasks.filter((t) => t.status === "blocked").length;
		const failed = tasks.filter((t) => t.status === "failed").length;

		const estimatedTime = tasks.reduce((sum, t) => sum + (t.estimatedTime || 0), 0);
		const actualTime = tasks.reduce((sum, t) => sum + (t.actualTime || 0), 0);

		return {
			total: session.totalTasks,
			completed: session.completedTasks,
			inProgress,
			pending,
			blocked,
			failed,
			progress: this.getProgress(),
			estimatedTime,
			actualTime,
		};
	}

	/**
	 * Get all sessions
	 */
	getSessions(options?: { status?: TaskSession["status"]; limit?: number }): TaskSession[] {
		let sessions = Array.from(this.sessions.values());

		if (options?.status) {
			sessions = sessions.filter((s) => s.status === options.status);
		}

		// Sort by createdAt (newest first)
		sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

		if (options?.limit) {
			sessions = sessions.slice(0, options.limit);
		}

		return sessions;
	}

	/**
	 * Set active session
	 */
	setActiveSession(sessionId: string): TaskSession | undefined {
		const session = this.sessions.get(sessionId);
		if (session) {
			this.currentSessionId = sessionId;
			this.saveState();
		}
		return session;
	}

	/**
	 * Clear current session
	 */
	clearSession(): void {
		const session = this.getCurrentSession();
		if (session) {
			// Update stats
			this.stats.totalTasks -= session.totalTasks;
			this.stats.completedTasks -= session.completedTasks;

			for (const task of session.tasks.values()) {
				this.stats.tasksByPriority[task.priority]--;
				this.stats.tasksByStatus[task.status]--;
				for (const tag of task.tags) {
					this.stats.tasksByTag[tag]--;
				}
			}

			if (session.status === "active") {
				this.stats.activeSessions--;
			}

			this.sessions.delete(session.id);
			this.currentSessionId = undefined;
			this.saveState();
		}
	}

	/**
	 * Clear all sessions
	 */
	clearAll(): void {
		this.sessions.clear();
		this.currentSessionId = undefined;
		this.stats = this.initStats();
		this.saveState();
	}

	/**
	 * Get statistics
	 */
	getStats(): TaskTrackingStats {
		return this.stats;
	}

	/**
	 * Calculate dependency depth for a session
	 */
	private updateDependencyDepth(session: TaskSession): void {
		const calculateDepth = (taskId: string, visited: Set<string> = new Set()): number => {
			if (visited.has(taskId)) return 0; // Circular dependency
			visited.add(taskId);

			const task = session.tasks.get(taskId);
			if (!task || task.dependencies.length === 0) return 1;

			const depths = task.dependencies.map((depId) => calculateDepth(depId, visited));
			return 1 + Math.max(...depths);
		};

		const maxDepth = Math.max(...session.rootTaskIds.map((id) => calculateDepth(id)), 0);

		this.stats.dependencyDepth = Math.max(this.stats.dependencyDepth, maxDepth);
	}

	/**
	 * Calculate total session time
	 */
	private calculateSessionTime(session: TaskSession): number {
		return Array.from(session.tasks.values()).reduce(
			(sum, task) => sum + (task.actualTime || 0),
			0,
		);
	}

	/**
	 * Find next task to work on (highest priority, ready to start)
	 */
	getNextTask(): Task | undefined {
		const session = this.getCurrentSession();
		if (!session) return undefined;

		const readyTasks = Array.from(session.tasks.values()).filter(
			(t) => t.status === "pending" || t.status === "in_progress",
		);

		if (readyTasks.length === 0) return undefined;

		// Sort by priority, then by in_progress first, then by createdAt
		const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
		readyTasks.sort((a, b) => {
			// In progress tasks first
			if (a.status === "in_progress" && b.status !== "in_progress") return -1;
			if (b.status === "in_progress" && a.status !== "in_progress") return 1;

			// Then by priority
			const prioDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
			if (prioDiff !== 0) return prioDiff;

			// Then by createdAt
			return a.createdAt.getTime() - b.createdAt.getTime();
		});

		return readyTasks[0];
	}
}

// Singleton instance
let taskTrackingManager: TaskTrackingManager | undefined;

export function getTaskTrackingManager(): TaskTrackingManager {
	if (!taskTrackingManager) {
		taskTrackingManager = new TaskTrackingManager();
	}
	return taskTrackingManager;
}

/**
 * Tool definition for task tracking
 */
export const taskTrackingToolDefinition = {
	name: "taskTracking",
	description:
		"Manage task tracking for agent execution - track progress, dependencies, and completion state",
	parameters: {
		type: "object",
		properties: {
			action: {
				type: "string",
				description:
					"Action to perform: start, current, add, update, complete, fail, get, list, dependencies, subtasks, progress, summary, next, sessions, set-session, clear, clear-all, stats",
				enum: [
					"start",
					"current",
					"add",
					"update",
					"complete",
					"fail",
					"get",
					"list",
					"dependencies",
					"subtasks",
					"progress",
					"summary",
					"next",
					"sessions",
					"set-session",
					"clear",
					"clear-all",
					"stats",
				],
			},
			name: {
				type: "string",
				description: "Task or session name (for start, add actions)",
			},
			description: {
				type: "string",
				description: "Task or session description",
			},
			taskId: {
				type: "string",
				description: "Task ID (for update, complete, fail, get, dependencies, subtasks actions)",
			},
			sessionId: {
				type: "string",
				description: "Session ID (for set-session action)",
			},
			status: {
				type: "string",
				description:
					"Task status (for update action): pending, in_progress, completed, failed, blocked",
				enum: ["pending", "in_progress", "completed", "failed", "blocked"],
			},
			priority: {
				type: "string",
				description: "Task priority (for add, list actions): low, medium, high, critical",
				enum: ["low", "medium", "high", "critical"],
			},
			progress: {
				type: "number",
				description: "Task progress percentage (0-100) (for update action)",
			},
			dependencies: {
				type: "array",
				items: { type: "string" },
				description: "Task dependency IDs (for add action)",
			},
			parentId: {
				type: "string",
				description: "Parent task ID (for add action - creates subtask)",
			},
			estimatedTime: {
				type: "number",
				description: "Estimated time in minutes (for add action)",
			},
			actualTime: {
				type: "number",
				description: "Actual time in minutes (for update, complete actions)",
			},
			assignee: {
				type: "string",
				description: "Agent role or identifier (for add action)",
			},
			tags: {
				type: "array",
				items: { type: "string" },
				description: "Task tags (for add action)",
			},
			notes: {
				type: "string",
				description: "Task notes (for update action)",
			},
			artifacts: {
				type: "array",
				items: { type: "string" },
				description: "Task artifacts - files or outputs produced (for complete action)",
			},
			errors: {
				type: "string",
				description: "Error message (for fail action)",
			},
			blocked: {
				type: "boolean",
				description: "Filter for blocked tasks (for list action)",
			},
			limit: {
				type: "number",
				description: "Limit number of results (for sessions, list actions)",
			},
		},
		required: ["action"],
	},
};

/**
 * Execute task tracking tool
 */
export function executeTaskTrackingTool(params: Record<string, unknown>): string {
	const manager = getTaskTrackingManager();
	const action = params.action as string;

	try {
		switch (action) {
			case "start": {
				const session = manager.startSession(
					(params.name as string) || "Untitled Session",
					params.description as string,
				);
				return JSON.stringify(
					{
						success: true,
						session: {
							id: session.id,
							name: session.name,
							description: session.description,
							status: session.status,
							createdAt: session.createdAt.toISOString(),
						},
					},
					null,
					2,
				);
			}

			case "current": {
				const currentSession = manager.getCurrentSession();
				if (!currentSession) {
					return JSON.stringify({ success: false, message: "No active session" }, null, 2);
				}
				return JSON.stringify(
					{
						success: true,
						session: {
							id: currentSession.id,
							name: currentSession.name,
							description: currentSession.description,
							status: currentSession.status,
							totalTasks: currentSession.totalTasks,
							completedTasks: currentSession.completedTasks,
							createdAt: currentSession.createdAt.toISOString(),
						},
					},
					null,
					2,
				);
			}

			case "add":
				try {
					const task = manager.addTask(
						params.name as string,
						(params.description as string) || "",
						{
							priority: params.priority as Task["priority"],
							dependencies: (params.dependencies as string[]) || [],
							parentId: params.parentId as string,
							estimatedTime: params.estimatedTime as number,
							assignee: params.assignee as string,
							tags: (params.tags as string[]) || [],
						},
					);
					return JSON.stringify(
						{
							success: true,
							task: {
								id: task.id,
								name: task.name,
								description: task.description,
								status: task.status,
								priority: task.priority,
								progress: task.progress,
								dependencies: task.dependencies,
								parentId: task.parentId,
								createdAt: task.createdAt.toISOString(),
							},
						},
						null,
						2,
					);
				} catch (error) {
					return JSON.stringify(
						{
							success: false,
							error: (error as Error).message,
						},
						null,
						2,
					);
				}

			case "update":
				try {
					const updatedTask = manager.updateTask(params.taskId as string, {
						status: params.status as Task["status"],
						progress: params.progress as number,
						actualTime: params.actualTime as number,
						notes: params.notes as string,
						artifacts: params.artifacts as string,
						errors: params.errors as string,
					});
					if (!updatedTask) {
						return JSON.stringify({ success: false, message: "Task not found" }, null, 2);
					}
					return JSON.stringify(
						{
							success: true,
							task: {
								id: updatedTask.id,
								name: updatedTask.name,
								status: updatedTask.status,
								progress: updatedTask.progress,
								updatedAt: updatedTask.updatedAt.toISOString(),
							},
						},
						null,
						2,
					);
				} catch (error) {
					return JSON.stringify(
						{
							success: false,
							error: (error as Error).message,
						},
						null,
						2,
					);
				}

			case "complete": {
				const completedTask = manager.completeTask(
					params.taskId as string,
					params.actualTime as number,
					params.artifacts as string[],
				);
				if (!completedTask) {
					return JSON.stringify({ success: false, message: "Task not found" }, null, 2);
				}
				return JSON.stringify(
					{
						success: true,
						task: {
							id: completedTask.id,
							name: completedTask.name,
							status: completedTask.status,
							progress: completedTask.progress,
							completedAt: completedTask.completedAt?.toISOString(),
							actualTime: completedTask.actualTime,
						},
					},
					null,
					2,
				);
			}

			case "fail": {
				const failedTask = manager.failTask(
					params.taskId as string,
					(params.errors as string) || "Unknown error",
				);
				if (!failedTask) {
					return JSON.stringify({ success: false, message: "Task not found" }, null, 2);
				}
				return JSON.stringify(
					{
						success: true,
						task: {
							id: failedTask.id,
							name: failedTask.name,
							status: failedTask.status,
							errors: failedTask.errors,
						},
					},
					null,
					2,
				);
			}

			case "get": {
				const task = manager.getTask(params.taskId as string);
				if (!task) {
					return JSON.stringify({ success: false, message: "Task not found" }, null, 2);
				}
				return JSON.stringify(
					{
						success: true,
						task: {
							id: task.id,
							name: task.name,
							description: task.description,
							status: task.status,
							priority: task.priority,
							progress: task.progress,
							dependencies: task.dependencies,
							subtasks: task.subtasks,
							parentId: task.parentId,
							createdAt: task.createdAt.toISOString(),
							startedAt: task.startedAt?.toISOString(),
							completedAt: task.completedAt?.toISOString(),
							estimatedTime: task.estimatedTime,
							actualTime: task.actualTime,
							assignee: task.assignee,
							tags: task.tags,
							notes: task.notes,
							artifacts: task.artifacts,
							errors: task.errors,
						},
					},
					null,
					2,
				);
			}

			case "list": {
				const tasks = manager.listTasks({
					status: params.status as Task["status"],
					priority: params.priority as Task["priority"],
					parentId: params.parentId as string,
					blocked: params.blocked as boolean,
				});
				return JSON.stringify(
					{
						success: true,
						count: tasks.length,
						tasks: tasks.slice(0, (params.limit as number) || 20).map((t) => ({
							id: t.id,
							name: t.name,
							status: t.status,
							priority: t.priority,
							progress: t.progress,
							parentId: t.parentId,
						})),
					},
					null,
					2,
				);
			}

			case "dependencies": {
				const deps = manager.getDependencies(params.taskId as string);
				return JSON.stringify(
					{
						success: true,
						taskId: params.taskId,
						dependencies: deps.map((d) => ({
							id: d.id,
							name: d.name,
							status: d.status,
							progress: d.progress,
						})),
					},
					null,
					2,
				);
			}

			case "subtasks": {
				const subtasks = manager.getSubtasks(params.taskId as string);
				return JSON.stringify(
					{
						success: true,
						taskId: params.taskId,
						subtasks: subtasks.map((s) => ({
							id: s.id,
							name: s.name,
							status: s.status,
							progress: s.progress,
						})),
					},
					null,
					2,
				);
			}

			case "progress": {
				const progress = manager.getProgress();
				return JSON.stringify(
					{
						success: true,
						progress: progress,
						message: `Session progress: ${progress}%`,
					},
					null,
					2,
				);
			}

			case "summary": {
				const summary = manager.getSessionSummary();
				return JSON.stringify(
					{
						success: true,
						summary,
					},
					null,
					2,
				);
			}

			case "next": {
				const nextTask = manager.getNextTask();
				if (!nextTask) {
					return JSON.stringify({ success: false, message: "No tasks available" }, null, 2);
				}
				return JSON.stringify(
					{
						success: true,
						nextTask: {
							id: nextTask.id,
							name: nextTask.name,
							status: nextTask.status,
							priority: nextTask.priority,
							progress: nextTask.progress,
							dependencies: nextTask.dependencies,
						},
					},
					null,
					2,
				);
			}

			case "sessions": {
				const sessions = manager.getSessions({
					status: params.status as TaskSession["status"],
					limit: params.limit as number,
				});
				return JSON.stringify(
					{
						success: true,
						count: sessions.length,
						sessions: sessions.map((s) => ({
							id: s.id,
							name: s.name,
							status: s.status,
							totalTasks: s.totalTasks,
							completedTasks: s.completedTasks,
							createdAt: s.createdAt.toISOString(),
						})),
					},
					null,
					2,
				);
			}

			case "set-session": {
				const setActiveSessionResult = manager.setActiveSession(params.sessionId as string);
				if (!setActiveSessionResult) {
					return JSON.stringify({ success: false, message: "Session not found" }, null, 2);
				}
				return JSON.stringify(
					{
						success: true,
						session: {
							id: setActiveSessionResult.id,
							name: setActiveSessionResult.name,
							status: setActiveSessionResult.status,
						},
					},
					null,
					2,
				);
			}

			case "clear":
				manager.clearSession();
				return JSON.stringify({ success: true, message: "Session cleared" }, null, 2);

			case "clear-all":
				manager.clearAll();
				return JSON.stringify({ success: true, message: "All sessions cleared" }, null, 2);

			case "stats": {
				const stats = manager.getStats();
				return JSON.stringify(
					{
						success: true,
						stats,
					},
					null,
					2,
				);
			}

			default:
				return JSON.stringify(
					{
						success: false,
						error: `Unknown action: ${action}`,
					},
					null,
					2,
				);
		}
	} catch (error) {
		return JSON.stringify(
			{
				success: false,
				error: (error as Error).message,
			},
			null,
			2,
		);
	}
}
