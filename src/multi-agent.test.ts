import { beforeEach, describe, expect, it } from "vitest";
import {
	type MultiAgentOrchestrator,
	type OrchestratorTask,
	type TaskStatus,
	createSampleTaskList,
	getMultiAgentOrchestrator,
	resetMultiAgentOrchestrator,
} from "./multi-agent.js";

describe("MultiAgentOrchestrator", () => {
	let orchestrator: MultiAgentOrchestrator;

	beforeEach(() => {
		resetMultiAgentOrchestrator();
		orchestrator = getMultiAgentOrchestrator();
	});

	describe("createTaskList", () => {
		it("should create a task list with tasks", () => {
			const tasks: OrchestratorTask[] = [
				{
					id: "task-001",
					description: "First task",
					type: "capability",
					priority: 10,
					status: "pending",
				},
				{
					id: "task-002",
					description: "Second task",
					type: "reliability",
					priority: 8,
					status: "pending",
					dependencies: ["task-001"],
				},
			];

			const taskList = orchestrator.createTaskList("test-project", tasks);

			expect(taskList.projectName).toBe("test-project");
			expect(taskList.totalTasks).toBe(2);
			expect(taskList.completedTasks).toBe(0);
			expect(taskList.tasks).toHaveLength(2);
			expect(taskList.tasks[0].id).toBe("task-001");
			expect(taskList.tasks[1].dependencies).toContain("task-001");
		});
	});

	describe("startInitializerSession", () => {
		it("should start an initializer session", () => {
			const session = orchestrator.startInitializerSession("new-project");

			expect(session.id).toMatch(/^init-/);
			expect(session.role).toBe("initializer");
			expect(session.status).toBe("running");
			expect(session.startTime).toBeDefined();
			expect(session.notes).toHaveLength(1);
		});
	});

	describe("startCoderSession", () => {
		it("should return null when no task list exists", () => {
			const session = orchestrator.startCoderSession();
			expect(session).toBeNull();
		});

		it("should start coder session when task list exists", () => {
			const tasks: OrchestratorTask[] = [
				{
					id: "task-001",
					description: "First task",
					type: "capability",
					priority: 10,
					status: "pending",
				},
			];

			const initSession = orchestrator.startInitializerSession("test-project");
			const taskList = orchestrator.createTaskList("test-project", tasks);
			orchestrator.completeInitializerSession(initSession, taskList);

			const coderSession = orchestrator.startCoderSession();
			expect(coderSession).not.toBeNull();
			expect(coderSession?.role).toBe("coder");
			expect(coderSession?.status).toBe("running");
		});

		it("should return null when all tasks are completed", () => {
			const tasks: OrchestratorTask[] = [
				{
					id: "task-001",
					description: "First task",
					type: "capability",
					priority: 10,
					status: "completed",
				},
			];

			const initSession = orchestrator.startInitializerSession("test-project");
			const taskList = orchestrator.createTaskList("test-project", tasks);
			orchestrator.completeInitializerSession(initSession, taskList);

			const coderSession = orchestrator.startCoderSession();
			expect(coderSession).toBeNull();
		});
	});

	describe("getNextTask", () => {
		it("should return null when no task list exists", () => {
			const task = orchestrator.getNextTask();
			expect(task).toBeNull();
		});

		it("should return highest priority pending task", () => {
			const tasks: OrchestratorTask[] = [
				{
					id: "task-001",
					description: "Low priority task",
					type: "capability",
					priority: 3,
					status: "pending",
				},
				{
					id: "task-002",
					description: "High priority task",
					type: "capability",
					priority: 10,
					status: "pending",
				},
			];

			const initSession = orchestrator.startInitializerSession("test-project");
			const taskList = orchestrator.createTaskList("test-project", tasks);
			orchestrator.completeInitializerSession(initSession, taskList);

			const nextTask = orchestrator.getNextTask();
			expect(nextTask?.id).toBe("task-002");
		});

		it("should respect dependencies", () => {
			const tasks: OrchestratorTask[] = [
				{
					id: "task-001",
					description: "First task",
					type: "capability",
					priority: 10,
					status: "pending",
				},
				{
					id: "task-002",
					description: "Dependent task",
					type: "capability",
					priority: 15,
					status: "pending",
					dependencies: ["task-001"],
				},
			];

			const initSession = orchestrator.startInitializerSession("test-project");
			const taskList = orchestrator.createTaskList("test-project", tasks);
			orchestrator.completeInitializerSession(initSession, taskList);

			// Should return task-001 because task-002 has unsatisfied dependency
			const nextTask = orchestrator.getNextTask();
			expect(nextTask?.id).toBe("task-001");

			// Mark task-001 as completed
			orchestrator.updateTaskStatus("task-001", "completed", "Done");

			// Now task-002 should be available
			const nextTask2 = orchestrator.getNextTask();
			expect(nextTask2?.id).toBe("task-002");
		});
	});

	describe("updateTaskStatus", () => {
		it("should update task status", () => {
			const tasks: OrchestratorTask[] = [
				{
					id: "task-001",
					description: "First task",
					type: "capability",
					priority: 10,
					status: "pending",
				},
			];

			const initSession = orchestrator.startInitializerSession("test-project");
			const taskList = orchestrator.createTaskList("test-project", tasks);
			orchestrator.completeInitializerSession(initSession, taskList);

			const updatedTask = orchestrator.updateTaskStatus(
				"task-001",
				"completed",
				"Task completed successfully",
				15,
			);

			expect(updatedTask?.status).toBe("completed");
			expect(updatedTask?.notes).toBe("Task completed successfully");
			expect(updatedTask?.actualTime).toBe(15);

			const progress = orchestrator.getProgress();
			expect(progress.completedTasks).toHaveLength(1);
			expect(progress.progressPercent).toBe(100);
		});

		it("should return null for unknown task", () => {
			const task = orchestrator.updateTaskStatus("unknown-task", "completed", "Note");
			expect(task).toBeNull();
		});
	});

	describe("getProgress", () => {
		it("should return progress with no task list", () => {
			const progress = orchestrator.getProgress();

			expect(progress.taskList).toBeNull();
			expect(progress.pendingTasks).toHaveLength(0);
			expect(progress.completedTasks).toHaveLength(0);
			expect(progress.progressPercent).toBe(0);
		});

		it("should return correct progress", () => {
			const tasks: OrchestratorTask[] = [
				{
					id: "task-001",
					description: "First task",
					type: "capability",
					priority: 10,
					status: "pending",
				},
				{
					id: "task-002",
					description: "Second task",
					type: "capability",
					priority: 8,
					status: "pending",
				},
			];

			const initSession = orchestrator.startInitializerSession("test-project");
			const taskList = orchestrator.createTaskList("test-project", tasks);
			orchestrator.completeInitializerSession(initSession, taskList);

			// Mark one task as completed
			orchestrator.updateTaskStatus("task-001", "completed", "Done");

			const progress = orchestrator.getProgress();
			expect(progress.taskList?.totalTasks).toBe(2);
			expect(progress.completedTasks).toHaveLength(1);
			expect(progress.pendingTasks).toHaveLength(1);
			expect(progress.progressPercent).toBe(50);
		});
	});

	describe("getStats", () => {
		it("should return statistics", () => {
			const stats = orchestrator.getStats();

			expect(stats.totalSessions).toBe(0);
			expect(stats.initializerSessions).toBe(0);
			expect(stats.coderSessions).toBe(0);
			expect(stats.totalTasks).toBe(0);
			expect(stats.completedTasks).toBe(0);
			expect(stats.successRate).toBe(0);
		});

		it("should track sessions", () => {
			const tasks: OrchestratorTask[] = [
				{
					id: "task-001",
					description: "First task",
					type: "capability",
					priority: 10,
					status: "pending",
				},
			];

			const initSession = orchestrator.startInitializerSession("test-project");
			const taskList = orchestrator.createTaskList("test-project", tasks);
			orchestrator.completeInitializerSession(initSession, taskList);

			// Start and complete coder session
			const coderSession = orchestrator.startCoderSession();
			orchestrator.updateTaskStatus("task-001", "completed", "Done");
			if (coderSession) {
				orchestrator.completeCoderSession(coderSession, 1, 0, ["Session done"]);
			}

			const stats = orchestrator.getStats();
			expect(stats.totalSessions).toBe(2);
			expect(stats.initializerSessions).toBe(1);
			expect(stats.coderSessions).toBe(1);
			expect(stats.completedTasks).toBe(1);
			expect(stats.successRate).toBe(100);
		});
	});

	describe("addSessionNote", () => {
		it("should add session note", () => {
			const session = orchestrator.startInitializerSession("test-project");
			orchestrator.addSessionNote("Custom note");

			expect(session.notes).toHaveLength(2);
			expect(session.notes[1]).toContain("Custom note");

			const taskList = orchestrator.getTaskList();
			expect(taskList).toBeNull(); // No task list created yet
		});
	});

	describe("reset", () => {
		it("should reset all state", () => {
			const tasks: OrchestratorTask[] = [
				{
					id: "task-001",
					description: "First task",
					type: "capability",
					priority: 10,
					status: "pending",
				},
			];

			const initSession = orchestrator.startInitializerSession("test-project");
			const taskList = orchestrator.createTaskList("test-project", tasks);
			orchestrator.completeInitializerSession(initSession, taskList);

			// Verify state exists
			expect(orchestrator.getTaskList()).not.toBeNull();
			expect(orchestrator.getSessions()).toHaveLength(1);

			// Reset
			orchestrator.reset();

			// Verify state cleared
			expect(orchestrator.getTaskList()).toBeNull();
			expect(orchestrator.getSessions()).toHaveLength(0);
		});
	});

	describe("formatProgress", () => {
		it("should format progress as markdown", () => {
			const formatted = orchestrator.formatProgress();
			expect(formatted).toContain("Multi-Agent Orchestrator Progress");
			expect(formatted).toContain("No task list created yet");
		});

		it("should format progress with task list", () => {
			const tasks: OrchestratorTask[] = [
				{
					id: "task-001",
					description: "First task",
					type: "capability",
					priority: 10,
					status: "pending",
				},
			];

			const initSession = orchestrator.startInitializerSession("test-project");
			const taskList = orchestrator.createTaskList("test-project", tasks);
			orchestrator.completeInitializerSession(initSession, taskList);

			const formatted = orchestrator.formatProgress();
			expect(formatted).toContain("Project: test-project");
			expect(formatted).toContain("**Total Tasks:** 1");
			expect(formatted).toContain("**Pending:** 1");
		});
	});

	describe("createSampleTaskList", () => {
		it("should create sample task list", () => {
			const sampleList = createSampleTaskList("sample-project");

			expect(sampleList.projectName).toBe("sample-project");
			expect(sampleList.totalTasks).toBe(5);
			expect(sampleList.tasks).toHaveLength(5);
			expect(sampleList.tasks[0].id).toBe("task-001");
			expect(sampleList.tasks[1].dependencies).toContain("task-001");
		});
	});
});
