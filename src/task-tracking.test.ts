/**
 * Tests for TaskTrackingManager (OpenHands SDK Pattern)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	type Task,
	type TaskSession,
	TaskTrackingManager,
	executeTaskTrackingTool,
	getTaskTrackingManager,
} from "./task-tracking.js";

const TEST_DATA_DIR = path.join(process.env.HOME || "~", ".paimon");
const TEST_TASKS_FILE = path.join(TEST_DATA_DIR, "task-tracking.json");

describe("TaskTrackingManager", () => {
	let manager: TaskTrackingManager;

	beforeEach(() => {
		// Clean up test file
		if (fs.existsSync(TEST_TASKS_FILE)) {
			fs.unlinkSync(TEST_TASKS_FILE);
		}
		manager = new TaskTrackingManager();
	});

	afterEach(() => {
		// Clean up test file
		if (fs.existsSync(TEST_TASKS_FILE)) {
			fs.unlinkSync(TEST_TASKS_FILE);
		}
	});

	describe("Session Management", () => {
		it("should start a new session", () => {
			const session = manager.startSession("Test Session", "Testing task tracking");

			expect(session.id).toMatch(/^session-/);
			expect(session.name).toBe("Test Session");
			expect(session.description).toBe("Testing task tracking");
			expect(session.status).toBe("active");
			expect(session.totalTasks).toBe(0);
			expect(session.completedTasks).toBe(0);
		});

		it("should get current session", () => {
			manager.startSession("Current Session");
			const current = manager.getCurrentSession();

			expect(current).toBeDefined();
			expect(current?.name).toBe("Current Session");
		});

		it("should list sessions", () => {
			manager.startSession("Session 1");
			manager.startSession("Session 2");

			const sessions = manager.getSessions();
			expect(sessions.length).toBe(2);
		});

		it("should clear current session", () => {
			manager.startSession("Test");
			manager.addTask("Task 1", "Description");

			manager.clearSession();

			expect(manager.getCurrentSession()).toBeUndefined();
		});
	});

	describe("Task Management", () => {
		beforeEach(() => {
			manager.startSession("Test Session");
		});

		it("should add a new task", () => {
			const task = manager.addTask("Test Task", "Task description", {
				priority: "high",
				estimatedTime: 30,
				tags: ["test", "unit"],
			});

			expect(task.id).toMatch(/^task-/);
			expect(task.name).toBe("Test Task");
			expect(task.description).toBe("Task description");
			expect(task.status).toBe("pending");
			expect(task.priority).toBe("high");
			expect(task.estimatedTime).toBe(30);
			expect(task.tags).toContain("test");
		});

		it("should add subtask with parent", () => {
			const parentTask = manager.addTask("Parent Task", "Parent description");
			const subtask = manager.addTask("Subtask", "Subtask description", {
				parentId: parentTask.id,
			});

			expect(subtask.parentId).toBe(parentTask.id);

			const parent = manager.getTask(parentTask.id);
			expect(parent?.subtasks).toContain(subtask.id);
		});

		it("should add task with dependencies", () => {
			const depTask = manager.addTask("Dependency Task", "Must complete first");
			const mainTask = manager.addTask("Main Task", "Depends on other task", {
				dependencies: [depTask.id],
			});

			expect(mainTask.dependencies).toContain(depTask.id);
			expect(mainTask.status).toBe("blocked"); // Blocked by incomplete dependency
		});

		it("should update task status", () => {
			const task = manager.addTask("Test Task", "Description");

			const updated = manager.updateTask(task.id, {
				status: "in_progress",
				progress: 50,
			});

			expect(updated?.status).toBe("in_progress");
			expect(updated?.progress).toBe(50);
			expect(updated?.startedAt).toBeDefined();
		});

		it("should complete a task", () => {
			const task = manager.addTask("Test Task", "Description");
			manager.updateTask(task.id, { status: "in_progress" });

			const completed = manager.completeTask(task.id, 25, ["output.txt"]);

			expect(completed?.status).toBe("completed");
			expect(completed?.progress).toBe(100);
			expect(completed?.actualTime).toBe(25);
			expect(completed?.completedAt).toBeDefined();
			expect(completed?.artifacts).toContain("output.txt");
		});

		it("should fail a task", () => {
			const task = manager.addTask("Test Task", "Description");

			const failed = manager.failTask(task.id, "Test failed: unexpected error");

			expect(failed?.status).toBe("failed");
			expect(failed?.errors).toContain("Test failed: unexpected error");
		});

		it("should get task by ID", () => {
			const task = manager.addTask("Test Task", "Description");

			const retrieved = manager.getTask(task.id);

			expect(retrieved).toBeDefined();
			expect(retrieved?.name).toBe("Test Task");
		});

		it("should list tasks", () => {
			manager.addTask("Task 1", "Desc", { priority: "high" });
			manager.addTask("Task 2", "Desc", { priority: "low" });
			manager.addTask("Task 3", "Desc", { priority: "critical" });

			const tasks = manager.listTasks();

			expect(tasks.length).toBe(3);
			// Should be sorted by priority (critical first)
			expect(tasks[0].priority).toBe("critical");
			expect(tasks[1].priority).toBe("high");
			expect(tasks[2].priority).toBe("low");
		});

		it("should filter tasks by status", () => {
			const t1 = manager.addTask("Task 1", "Desc");
			const t2 = manager.addTask("Task 2", "Desc");
			manager.updateTask(t1.id, { status: "in_progress" });

			const inProgress = manager.listTasks({ status: "in_progress" });

			expect(inProgress.length).toBe(1);
			expect(inProgress[0].id).toBe(t1.id);
		});
	});

	describe("Dependencies", () => {
		beforeEach(() => {
			manager.startSession("Test Session");
		});

		it("should block task with incomplete dependencies", () => {
			const dep1 = manager.addTask("Dep 1", "First dependency");
			const dep2 = manager.addTask("Dep 2", "Second dependency");
			const mainTask = manager.addTask("Main", "Main task", {
				dependencies: [dep1.id, dep2.id],
			});

			expect(mainTask.status).toBe("blocked");
		});

		it("should unblock task when dependencies complete", () => {
			const depTask = manager.addTask("Dependency", "Must complete first");
			const mainTask = manager.addTask("Main", "Main task", {
				dependencies: [depTask.id],
			});

			expect(mainTask.status).toBe("blocked");

			// Complete the dependency
			manager.completeTask(depTask.id);

			// Check if main task is unblocked
			const updatedMain = manager.getTask(mainTask.id);
			expect(updatedMain?.status).toBe("pending");
		});

		it("should get dependencies", () => {
			const dep1 = manager.addTask("Dep 1", "First");
			const dep2 = manager.addTask("Dep 2", "Second");
			const mainTask = manager.addTask("Main", "Main", {
				dependencies: [dep1.id, dep2.id],
			});

			const deps = manager.getDependencies(mainTask.id);

			expect(deps.length).toBe(2);
		});

		it("should get subtasks", () => {
			const parent = manager.addTask("Parent", "Parent task");
			const sub1 = manager.addTask("Sub 1", "First subtask", { parentId: parent.id });
			const sub2 = manager.addTask("Sub 2", "Second subtask", { parentId: parent.id });

			const subtasks = manager.getSubtasks(parent.id);

			expect(subtasks.length).toBe(2);
		});
	});

	describe("Progress Tracking", () => {
		beforeEach(() => {
			manager.startSession("Test Session");
		});

		it("should calculate progress", () => {
			const t1 = manager.addTask("Task 1", "Desc");
			const t2 = manager.addTask("Task 2", "Desc");
			const t3 = manager.addTask("Task 3", "Desc");

			manager.completeTask(t1.id);

			const progress = manager.getProgress();
			expect(progress).toBe(33); // 1/3 = 33%

			manager.completeTask(t2.id);
			expect(manager.getProgress()).toBe(67); // 2/3 = 67%
		});

		it("should get session summary", () => {
			manager.addTask("Task 1", "Desc", { estimatedTime: 10 });
			manager.addTask("Task 2", "Desc", { estimatedTime: 20 });
			manager.addTask("Task 3", "Desc", { estimatedTime: 30 });

			const summary = manager.getSessionSummary();

			expect(summary.total).toBe(3);
			expect(summary.completed).toBe(0);
			expect(summary.inProgress).toBe(0);
			expect(summary.pending).toBe(3);
			expect(summary.progress).toBe(0);
			expect(summary.estimatedTime).toBe(60);
		});

		it("should find next task to work on", () => {
			manager.addTask("Low Priority", "Desc", { priority: "low" });
			manager.addTask("High Priority", "Desc", { priority: "high" });
			manager.addTask("Critical Task", "Desc", { priority: "critical" });

			const nextTask = manager.getNextTask();

			expect(nextTask?.priority).toBe("critical");
		});

		it("should prefer in-progress tasks", () => {
			const t1 = manager.addTask("Pending", "Desc");
			const t2 = manager.addTask("In Progress", "Desc");
			manager.updateTask(t2.id, { status: "in_progress" });

			const nextTask = manager.getNextTask();

			expect(nextTask?.id).toBe(t2.id);
			expect(nextTask?.status).toBe("in_progress");
		});
	});

	describe("Statistics", () => {
		it("should track statistics", () => {
			manager.startSession("Session 1");
			manager.addTask("Task 1", "Desc", { priority: "high", tags: ["test"] });
			manager.addTask("Task 2", "Desc", { priority: "low" });

			const stats = manager.getStats();

			expect(stats.totalSessions).toBe(1);
			expect(stats.totalTasks).toBe(2);
			expect(stats.tasksByPriority.high).toBe(1);
			expect(stats.tasksByPriority.low).toBe(1);
			expect(stats.tasksByTag.test).toBe(1);
		});
	});

	describe("Tool Execution", () => {
		it("should execute start action", () => {
			const result = executeTaskTrackingTool({
				action: "start",
				name: "Test Session",
				description: "Testing",
			});

			const parsed = JSON.parse(result);
			expect(parsed.success).toBe(true);
			expect(parsed.session.name).toBe("Test Session");
		});

		it("should execute add action", () => {
			executeTaskTrackingTool({ action: "start", name: "Test" });

			const result = executeTaskTrackingTool({
				action: "add",
				name: "Test Task",
				description: "Task description",
				priority: "high",
			});

			const parsed = JSON.parse(result);
			expect(parsed.success).toBe(true);
			expect(parsed.task.name).toBe("Test Task");
			expect(parsed.task.priority).toBe("high");
		});

		it("should execute update action", () => {
			executeTaskTrackingTool({ action: "start", name: "Test" });
			const addResult = JSON.parse(
				executeTaskTrackingTool({
					action: "add",
					name: "Task",
					description: "Desc",
				}),
			);

			const result = executeTaskTrackingTool({
				action: "update",
				taskId: addResult.task.id,
				status: "in_progress",
				progress: 50,
			});

			const parsed = JSON.parse(result);
			expect(parsed.success).toBe(true);
			expect(parsed.task.status).toBe("in_progress");
			expect(parsed.task.progress).toBe(50);
		});

		it("should execute list action", () => {
			executeTaskTrackingTool({ action: "start", name: "Test" });
			executeTaskTrackingTool({ action: "add", name: "Task 1", description: "D1" });
			executeTaskTrackingTool({ action: "add", name: "Task 2", description: "D2" });

			const result = executeTaskTrackingTool({ action: "list" });

			const parsed = JSON.parse(result);
			expect(parsed.success).toBe(true);
			expect(parsed.count).toBe(2);
		});

		it("should execute progress action", () => {
			executeTaskTrackingTool({ action: "start", name: "Test" });
			const add1 = JSON.parse(
				executeTaskTrackingTool({
					action: "add",
					name: "Task 1",
					description: "D1",
				}),
			);
			const add2 = JSON.parse(
				executeTaskTrackingTool({
					action: "add",
					name: "Task 2",
					description: "D2",
				}),
			);

			executeTaskTrackingTool({
				action: "complete",
				taskId: add1.task.id,
			});

			const result = executeTaskTrackingTool({ action: "progress" });

			const parsed = JSON.parse(result);
			expect(parsed.success).toBe(true);
			expect(parsed.progress).toBe(50);
		});

		it("should execute stats action", () => {
			// Clear all first for clean state
			executeTaskTrackingTool({ action: "clear-all" });

			executeTaskTrackingTool({ action: "start", name: "Test" });
			executeTaskTrackingTool({ action: "add", name: "Task", description: "D" });

			const result = executeTaskTrackingTool({ action: "stats" });

			const parsed = JSON.parse(result);
			expect(parsed.success).toBe(true);
			expect(parsed.stats.totalSessions).toBe(1);
			expect(parsed.stats.totalTasks).toBe(1);
		});

		it("should return error for unknown action", () => {
			const result = executeTaskTrackingTool({ action: "unknown" });

			const parsed = JSON.parse(result);
			expect(parsed.success).toBe(false);
			expect(parsed.error).toContain("Unknown action");
		});
	});

	describe("Persistence", () => {
		it("should save state to file", () => {
			manager.startSession("Session");
			manager.addTask("Task", "Description");

			// Check file exists
			expect(fs.existsSync(TEST_TASKS_FILE)).toBe(true);

			// Load content
			const data = JSON.parse(fs.readFileSync(TEST_TASKS_FILE, "utf-8"));
			expect(data.sessions.length).toBe(1);
			expect(data.currentSessionId).toBeDefined();
		});

		it("should load state from file", () => {
			// Create initial manager with data
			manager.startSession("Session 1");
			manager.addTask("Task 1", "Desc");

			// Create new manager to test loading
			const newManager = new TaskTrackingManager();

			expect(newManager.getSessions().length).toBe(1);
			newManager.setActiveSession(manager.getSessions()[0].id);
			expect(newManager.getCurrentSession()?.tasks.size).toBe(1);
		});
	});
});
