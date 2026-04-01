/**
 * Multi-Agent Orchestrator (Claude Quickstart Pattern)
 *
 * Implements a two-agent pattern for better complex task handling:
 * - Initializer Agent: Creates task list, plans approach, sets up structure
 * - Coding Agent: Executes tasks, marks completion, persists progress
 *
 * Inspired by Claude Quickstart "Autonomous Coding Agent" demo:
 * https://github.com/anthropics/anthropic-quickstarts/tree/main/autonomous-coding
 */

import * as fs from "node:fs";
import * as path from "node:path";

// Agent roles
export type AgentRole = "initializer" | "coder";

// Task status
export type TaskStatus = "pending" | "in_progress" | "completed" | "failed";

// Task in the task list
export interface OrchestratorTask {
	id: string;
	description: string;
	type: "capability" | "reliability" | "feature";
	priority: number;
	status: TaskStatus;
	dependencies?: string[];
	estimatedTime?: number;
	actualTime?: number;
	errors?: string[];
	notes?: string;
}

// Task list (source of truth for progress)
export interface TaskList {
	version: string;
	createdAt: string;
	updatedAt: string;
	projectName: string;
	totalTasks: number;
	completedTasks: number;
	failedTasks: number;
	tasks: OrchestratorTask[];
	sessionNotes: string[];
}

// Agent session state
export interface AgentSession {
	id: string;
	role: AgentRole;
	startTime: string;
	endTime?: string;
	tasksCompleted: number;
	tasksFailed: number;
	notes: string[];
	status: "running" | "completed" | "paused" | "failed";
}

// Orchestrator configuration
export interface MultiAgentConfig {
	taskListPath?: string;
	progressPath?: string;
	maxIterations?: number;
	sessionTimeout?: number; // minutes
	autoContinue?: boolean;
	continueDelay?: number; // seconds
	saveIntermediate?: boolean;
}

// Orchestrator statistics
export interface OrchestratorStats {
	totalSessions: number;
	initializerSessions: number;
	coderSessions: number;
	totalTasks: number;
	completedTasks: number;
	failedTasks: number;
	averageTasksPerSession: number;
	averageTimePerTask: number;
	successRate: number;
	lastSession?: string;
}

// Session result
export interface SessionResult {
	success: boolean;
	session: AgentSession;
	tasksCompleted: number;
	tasksFailed: number;
	notes: string[];
	nextAction?: "continue" | "pause" | "complete";
}

/**
 * Multi-Agent Orchestrator
 *
 * Manages the two-agent pattern for autonomous evolution:
 */
export class MultiAgentOrchestrator {
	private config: MultiAgentConfig;
	private taskList: TaskList | null = null;
	private currentSession: AgentSession | null = null;
	private sessions: AgentSession[] = [];
	private dataDir: string;

	constructor(config: MultiAgentConfig = {}, dataDir = "data") {
		this.config = {
			taskListPath: config.taskListPath || "evolution-tasks.json",
			progressPath: config.progressPath || "evolution-progress.txt",
			maxIterations: config.maxIterations || 10,
			sessionTimeout: config.sessionTimeout || 30,
			autoContinue: config.autoContinue ?? false,
			continueDelay: config.continueDelay || 3,
			saveIntermediate: config.saveIntermediate ?? true,
		};
		this.dataDir = dataDir;
		this.loadState();
	}

	/**
	 * Load state from files
	 */
	private loadState(): void {
		const taskListPath = path.join(
			this.dataDir,
			this.config.taskListPath ?? "evolution-tasks.json",
		);
		const progressPath = path.join(
			this.dataDir,
			this.config.progressPath ?? "evolution-progress.txt",
		);

		// Load task list if exists
		if (fs.existsSync(taskListPath)) {
			try {
				const content = fs.readFileSync(taskListPath, "utf-8");
				this.taskList = JSON.parse(content) as TaskList;
			} catch {
				// Ignore parse errors
			}
		}

		// Load sessions from progress file if exists
		if (fs.existsSync(progressPath)) {
			try {
				const content = fs.readFileSync(progressPath, "utf-8");
				const lines = content.split("\n").filter((l) => l.trim());
				for (const line of lines) {
					if (line.startsWith("SESSION:")) {
						const sessionData = JSON.parse(line.replace("SESSION:", "").trim());
						this.sessions.push(sessionData as AgentSession);
					}
				}
			} catch {
				// Ignore parse errors
			}
		}
	}

	/**
	 * Save task list to file
	 */
	private saveTaskList(): void {
		if (!this.taskList) return;

		const taskListPath = path.join(
			this.dataDir,
			this.config.taskListPath ?? "evolution-tasks.json",
		);
		this.taskList.updatedAt = new Date().toISOString();

		// Ensure data directory exists
		if (!fs.existsSync(this.dataDir)) {
			fs.mkdirSync(this.dataDir, { recursive: true });
		}

		fs.writeFileSync(taskListPath, JSON.stringify(this.taskList, null, 2));
	}

	/**
	 * Save progress to file
	 */
	private saveProgress(): void {
		const progressPath = path.join(
			this.dataDir,
			this.config.progressPath ?? "evolution-progress.txt",
		);

		// Ensure data directory exists
		if (!fs.existsSync(this.dataDir)) {
			fs.mkdirSync(this.dataDir, { recursive: true });
		}

		const lines: string[] = [];
		for (const session of this.sessions) {
			lines.push(`SESSION: ${JSON.stringify(session)}`);
		}
		if (this.taskList?.sessionNotes) {
			for (const note of this.taskList.sessionNotes) {
				lines.push(`NOTE: ${note}`);
			}
		}

		fs.writeFileSync(progressPath, lines.join("\n"));
	}

	/**
	 * Create a new task list (Initializer Agent role)
	 */
	createTaskList(projectName: string, tasks: OrchestratorTask[], notes?: string[]): TaskList {
		this.taskList = {
			version: "1.0",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			projectName,
			totalTasks: tasks.length,
			completedTasks: 0,
			failedTasks: 0,
			tasks,
			sessionNotes: notes || [],
		};
		this.saveTaskList();
		return this.taskList;
	}

	/**
	 * Start an initializer session
	 *
	 * Initializer agent creates task list, plans approach, sets up structure
	 */
	startInitializerSession(projectName: string): AgentSession {
		const session: AgentSession = {
			id: `init-${Date.now()}`,
			role: "initializer",
			startTime: new Date().toISOString(),
			tasksCompleted: 0,
			tasksFailed: 0,
			notes: [`Starting initialization for ${projectName}`],
			status: "running",
		};
		this.currentSession = session;
		this.sessions.push(session);
		this.saveProgress();
		return session;
	}

	/**
	 * Complete initializer session
	 */
	completeInitializerSession(session: AgentSession, taskList: TaskList): SessionResult {
		session.endTime = new Date().toISOString();
		session.status = "completed";
		session.notes.push("Initialization complete");
		session.tasksCompleted = taskList.totalTasks > 0 ? 1 : 0;

		this.taskList = taskList;
		this.currentSession = null;
		this.saveTaskList();
		this.saveProgress();

		return {
			success: true,
			session,
			tasksCompleted: session.tasksCompleted,
			tasksFailed: session.tasksFailed,
			notes: session.notes,
			nextAction: "continue",
		};
	}

	/**
	 * Start a coder session
	 *
	 * Coding agent picks up where previous left off, executes tasks
	 */
	startCoderSession(): AgentSession | null {
		if (!this.taskList) {
			return null;
		}

		const pendingTasks = this.taskList.tasks.filter(
			(t) => t.status === "pending" || t.status === "in_progress",
		);

		if (pendingTasks.length === 0) {
			return null;
		}

		const session: AgentSession = {
			id: `coder-${Date.now()}`,
			role: "coder",
			startTime: new Date().toISOString(),
			tasksCompleted: 0,
			tasksFailed: 0,
			notes: [`Starting coding session with ${pendingTasks.length} pending tasks`],
			status: "running",
		};
		this.currentSession = session;
		this.sessions.push(session);
		this.saveProgress();
		return session;
	}

	/**
	 * Update task status during coding session
	 */
	updateTaskStatus(
		taskId: string,
		status: TaskStatus,
		notes?: string,
		actualTime?: number,
		errors?: string[],
	): OrchestratorTask | null {
		if (!this.taskList) return null;

		const task = this.taskList.tasks.find((t) => t.id === taskId);
		if (!task) return null;

		task.status = status;
		if (notes) task.notes = notes;
		if (actualTime) task.actualTime = actualTime;
		if (errors) task.errors = errors;

		// Update counters
		this.taskList.completedTasks = this.taskList.tasks.filter(
			(t) => t.status === "completed",
		).length;
		this.taskList.failedTasks = this.taskList.tasks.filter((t) => t.status === "failed").length;

		this.saveTaskList();
		return task;
	}

	/**
	 * Complete coder session
	 */
	completeCoderSession(
		session: AgentSession,
		tasksCompleted: number,
		tasksFailed: number,
		notes?: string[],
	): SessionResult {
		session.endTime = new Date().toISOString();
		session.status = "completed";
		session.tasksCompleted = tasksCompleted;
		session.tasksFailed = tasksFailed;
		if (notes) {
			session.notes.push(...notes);
		}

		this.currentSession = null;
		this.saveProgress();

		// Determine next action
		const pendingTasks =
			this.taskList?.tasks.filter((t) => t.status === "pending" || t.status === "in_progress") ||
			[];

		let nextAction: "continue" | "pause" | "complete" = "continue";
		if (pendingTasks.length === 0) {
			nextAction = "complete";
		} else if (
			this.config.maxIterations &&
			this.sessions.filter((s) => s.role === "coder").length >= this.config.maxIterations
		) {
			nextAction = "pause";
		}

		return {
			success: tasksFailed === 0,
			session,
			tasksCompleted,
			tasksFailed,
			notes: session.notes,
			nextAction,
		};
	}

	/**
	 * Get current progress
	 */
	getProgress(): {
		taskList: TaskList | null;
		currentSession: AgentSession | null;
		pendingTasks: OrchestratorTask[];
		completedTasks: OrchestratorTask[];
		progressPercent: number;
	} {
		const pendingTasks =
			this.taskList?.tasks.filter((t) => t.status === "pending" || t.status === "in_progress") ||
			[];
		const completedTasks = this.taskList?.tasks.filter((t) => t.status === "completed") || [];

		const progressPercent =
			this.taskList && this.taskList.totalTasks > 0
				? Math.round((this.taskList.completedTasks / this.taskList.totalTasks) * 100)
				: 0;

		return {
			taskList: this.taskList,
			currentSession: this.currentSession,
			pendingTasks,
			completedTasks,
			progressPercent,
		};
	}

	/**
	 * Get next pending task for coding agent
	 */
	getNextTask(): OrchestratorTask | null {
		if (!this.taskList) return null;

		// Find highest priority pending task with satisfied dependencies
		const pendingTasks = this.taskList.tasks.filter((t) => t.status === "pending");

		for (const task of pendingTasks.sort((a, b) => b.priority - a.priority)) {
			// Check dependencies
			if (task.dependencies && task.dependencies.length > 0) {
				const depsSatisfied = task.dependencies.every((depId) => {
					const depTask = this.taskList?.tasks.find((t) => t.id === depId);
					return depTask && depTask.status === "completed";
				});
				if (!depsSatisfied) continue;
			}
			return task;
		}

		// If no pending tasks with satisfied deps, return in_progress task
		const inProgressTask = this.taskList.tasks.find((t) => t.status === "in_progress");
		return inProgressTask || null;
	}

	/**
	 * Add session note
	 */
	addSessionNote(note: string): void {
		if (this.currentSession) {
			this.currentSession.notes.push(note);
		}
		if (this.taskList) {
			this.taskList.sessionNotes.push(`[${new Date().toISOString()}] ${note}`);
		}
		this.saveProgress();
	}

	/**
	 * Get statistics
	 */
	getStats(): OrchestratorStats {
		const initializerSessions = this.sessions.filter((s) => s.role === "initializer");
		const coderSessions = this.sessions.filter((s) => s.role === "coder");

		const totalTasksCompleted = coderSessions.reduce((sum, s) => sum + s.tasksCompleted, 0);
		const totalTasksFailed = coderSessions.reduce((sum, s) => sum + s.tasksFailed, 0);
		const totalTasks = totalTasksCompleted + totalTasksFailed;

		const successRate = totalTasks > 0 ? Math.round((totalTasksCompleted / totalTasks) * 100) : 0;

		const averageTasksPerSession =
			coderSessions.length > 0 ? Math.round(totalTasksCompleted / coderSessions.length) : 0;

		return {
			totalSessions: this.sessions.length,
			initializerSessions: initializerSessions.length,
			coderSessions: coderSessions.length,
			totalTasks: this.taskList?.totalTasks || 0,
			completedTasks: this.taskList?.completedTasks || 0,
			failedTasks: this.taskList?.failedTasks || 0,
			averageTasksPerSession,
			averageTimePerTask: 0, // Would need to track actual times
			successRate,
			lastSession: this.sessions[this.sessions.length - 1]?.id,
		};
	}

	/**
	 * Clear state and start fresh
	 */
	reset(): void {
		this.taskList = null;
		this.currentSession = null;
		this.sessions = [];

		const taskListPath = path.join(
			this.dataDir,
			this.config.taskListPath ?? "evolution-tasks.json",
		);
		const progressPath = path.join(
			this.dataDir,
			this.config.progressPath ?? "evolution-progress.txt",
		);

		if (fs.existsSync(taskListPath)) {
			fs.unlinkSync(taskListPath);
		}
		if (fs.existsSync(progressPath)) {
			fs.unlinkSync(progressPath);
		}
	}

	/**
	 * Get current session
	 */
	getCurrentSession(): AgentSession | null {
		return this.currentSession;
	}

	/**
	 * Get task list
	 */
	getTaskList(): TaskList | null {
		return this.taskList;
	}

	/**
	 * Get all sessions
	 */
	getSessions(): AgentSession[] {
		return this.sessions;
	}

	/**
	 * Format progress as markdown
	 */
	formatProgress(): string {
		const progress = this.getProgress();
		const stats = this.getStats();

		let output = "# Multi-Agent Orchestrator Progress\n\n";

		if (progress.taskList) {
			output += `## Project: ${progress.taskList.projectName}\n\n`;
			output += `- **Total Tasks:** ${progress.taskList.totalTasks}\n`;
			output += `- **Completed:** ${progress.completedTasks.length} (${progress.progressPercent}%)\n`;
			output += `- **Pending:** ${progress.pendingTasks.length}\n`;
			output += `- **Failed:** ${progress.taskList.failedTasks}\n\n`;
		} else {
			output += "**No task list created yet.** Run initializer session first.\n\n";
		}

		if (progress.currentSession) {
			output += "## Current Session\n\n";
			output += `- **Role:** ${progress.currentSession.role}\n`;
			output += `- **Status:** ${progress.currentSession.status}\n`;
			output += `- **Started:** ${progress.currentSession.startTime}\n`;
			output += `- **Tasks Completed:** ${progress.currentSession.tasksCompleted}\n\n`;
		}

		if (progress.pendingTasks.length > 0) {
			output += "## Pending Tasks\n\n";
			for (const task of progress.pendingTasks.slice(0, 10)) {
				output += `- [${task.status}] **${task.id}:** ${task.description}\n`;
			}
			if (progress.pendingTasks.length > 10) {
				output += `  ... and ${progress.pendingTasks.length - 10} more\n`;
			}
			output += "\n";
		}

		output += "## Statistics\n\n";
		output += `- **Total Sessions:** ${stats.totalSessions}\n`;
		output += `- **Initializer Sessions:** ${stats.initializerSessions}\n`;
		output += `- **Coder Sessions:** ${stats.coderSessions}\n`;
		output += `- **Success Rate:** ${stats.successRate}%\n`;
		output += `- **Average Tasks/Session:** ${stats.averageTasksPerSession}\n`;

		return output;
	}

	/**
	 * Format statistics as markdown
	 */
	formatStats(): string {
		const stats = this.getStats();

		let output = "# Multi-Agent Orchestrator Statistics\n\n";

		output += "| Metric | Value |\n";
		output += "|--------|-------|\n";
		output += `| Total Sessions | ${stats.totalSessions} |\n`;
		output += `| Initializer Sessions | ${stats.initializerSessions} |\n`;
		output += `| Coder Sessions | ${stats.coderSessions} |\n`;
		output += `| Total Tasks | ${stats.totalTasks} |\n`;
		output += `| Completed Tasks | ${stats.completedTasks} |\n`;
		output += `| Failed Tasks | ${stats.failedTasks} |\n`;
		output += `| Success Rate | ${stats.successRate}% |\n`;
		output += `| Average Tasks/Session | ${stats.averageTasksPerSession} |\n`;

		if (stats.lastSession) {
			output += `| Last Session | ${stats.lastSession} |\n`;
		}

		return output;
	}

	/**
	 * Format task list as markdown
	 */
	formatTaskList(): string {
		if (!this.taskList) {
			return "**No task list available.** Run initializer session first.";
		}

		let output = `# Task List: ${this.taskList.projectName}\n\n`;

		output += `- **Created:** ${this.taskList.createdAt}\n`;
		output += `- **Updated:** ${this.taskList.updatedAt}\n`;
		output += `- **Progress:** ${this.taskList.completedTasks}/${this.taskList.totalTasks}\n\n`;

		output += "## Tasks\n\n";
		output += "| ID | Description | Type | Priority | Status |\n";
		output += "|----|-------------|------|----------|--------|\n";

		for (const task of this.taskList.tasks) {
			output += `| ${task.id} | ${task.description.slice(0, 50)}${task.description.length > 50 ? "..." : ""} | ${task.type} | ${task.priority} | ${task.status} |\n`;
		}

		if (this.taskList.sessionNotes.length > 0) {
			output += "\n## Session Notes\n\n";
			for (const note of this.taskList.sessionNotes.slice(-5)) {
				output += `- ${note}\n`;
			}
		}

		return output;
	}
}

// Singleton instance
let orchestratorInstance: MultiAgentOrchestrator | null = null;

/**
 * Get or create orchestrator instance
 */
export function getMultiAgentOrchestrator(config?: MultiAgentConfig): MultiAgentOrchestrator {
	if (!orchestratorInstance) {
		orchestratorInstance = new MultiAgentOrchestrator(config);
	}
	return orchestratorInstance;
}

/**
 * Reset orchestrator instance
 */
export function resetMultiAgentOrchestrator(): void {
	if (orchestratorInstance) {
		orchestratorInstance.reset();
	}
	orchestratorInstance = null;
}

/**
 * Create sample task list for testing
 */
export function createSampleTaskList(projectName: string): TaskList {
	const tasks: OrchestratorTask[] = [
		{
			id: "task-001",
			description: "Implement core module structure",
			type: "capability",
			priority: 10,
			status: "pending",
			estimatedTime: 15,
		},
		{
			id: "task-002",
			description: "Add configuration management",
			type: "capability",
			priority: 8,
			status: "pending",
			dependencies: ["task-001"],
			estimatedTime: 10,
		},
		{
			id: "task-003",
			description: "Create unit tests",
			type: "reliability",
			priority: 7,
			status: "pending",
			dependencies: ["task-001"],
			estimatedTime: 20,
		},
		{
			id: "task-004",
			description: "Add documentation",
			type: "feature",
			priority: 5,
			status: "pending",
			dependencies: ["task-002"],
			estimatedTime: 10,
		},
		{
			id: "task-005",
			description: "Performance optimization",
			type: "reliability",
			priority: 6,
			status: "pending",
			dependencies: ["task-001", "task-002"],
			estimatedTime: 15,
		},
	];

	return {
		version: "1.0",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		projectName,
		totalTasks: tasks.length,
		completedTasks: 0,
		failedTasks: 0,
		tasks,
		sessionNotes: ["Sample task list created for testing"],
	};
}
