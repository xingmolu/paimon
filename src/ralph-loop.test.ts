/**
 * Tests for Ralph Loop Manager - Self-referential iteration loop for autonomous evolution
 */

import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RalphLoopManager, type RalphLoopState, resetRalphLoopManager } from "./ralph-loop.js";

// Test directory for Ralph Loop data
let testDir: string;

beforeEach(() => {
	// Create unique temp directory for each test
	testDir = mkdtempSync(join(tmpdir(), "ralph-loop-test-"));
	resetRalphLoopManager();
});

afterEach(() => {
	// Clean up temp directory
	if (existsSync(testDir)) {
		rmSync(testDir, { recursive: true, force: true });
	}
	resetRalphLoopManager();
});

describe("RalphLoopManager", () => {
	describe("constructor and basic methods", () => {
		it("should create manager with default config", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			expect(manager.isEnabled()).toBe(true);
			expect(manager.getCurrentLoop()).toBeNull();
			expect(manager.hasActiveLoop()).toBe(false);
		});

		it("should create manager with custom config", () => {
			const manager = new RalphLoopManager({
				dataDir: testDir,
				enabled: false,
				defaultMaxIterations: 100,
			});
			expect(manager.isEnabled()).toBe(false);
		});

		it("should persist current loop across manager instances", () => {
			const manager1 = new RalphLoopManager({ dataDir: testDir });
			const loop = manager1.startLoop("Test prompt", "COMPLETE", 10);

			// Reset and create new manager - should load the active loop
			resetRalphLoopManager();
			const manager2 = new RalphLoopManager({ dataDir: testDir });
			expect(manager2.hasActiveLoop()).toBe(true);
			expect(manager2.getCurrentLoop()?.id).toBe(loop.id);
		});
	});

	describe("startLoop", () => {
		it("should start a new loop", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			const loop = manager.startLoop("Build a REST API for todos", "COMPLETE", 50);

			expect(loop.id).toMatch(/^ralph-/);
			expect(loop.prompt).toBe("Build a REST API for todos");
			expect(loop.completionPromise).toBe("COMPLETE");
			expect(loop.maxIterations).toBe(50);
			expect(loop.currentIteration).toBe(0);
			expect(loop.status).toBe("active");
			expect(manager.hasActiveLoop()).toBe(true);
		});

		it("should use default max iterations if not specified", () => {
			const manager = new RalphLoopManager({ dataDir: testDir, defaultMaxIterations: 25 });
			const loop = manager.startLoop("Test prompt", "DONE");

			expect(loop.maxIterations).toBe(25);
		});

		it("should cancel existing loop when starting new one", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			const loop1 = manager.startLoop("First prompt", "DONE1");
			expect(loop1.status).toBe("active");

			const loop2 = manager.startLoop("Second prompt", "DONE2");
			expect(loop2.status).toBe("active");

			// First loop should be cancelled
			const oldLoop = manager.getLoop(loop1.id);
			expect(oldLoop?.status).toBe("cancelled");
			expect(manager.getCurrentLoop()?.id).toBe(loop2.id);
		});

		it("should include session context in loop", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			const loop = manager.startLoop("Test prompt", "DONE", 10, {
				mode: "evolve",
				project: "test-project",
			});

			expect(loop.sessionContext?.mode).toBe("evolve");
			expect(loop.sessionContext?.project).toBe("test-project");
		});
	});

	describe("incrementIteration", () => {
		it("should increment iteration count", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			manager.startLoop("Test prompt", "DONE", 10);

			const result = manager.incrementIteration();
			expect(result.shouldContinue).toBe(true);
			expect(result.reason).toBe("Iteration 1/10");
			expect(result.prompt).toBe("Test prompt");
			expect(manager.getCurrentLoop()?.currentIteration).toBe(1);
		});

		it("should stop at max iterations", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			manager.startLoop("Test prompt", "DONE", 3);

			// Increment 3 times
			manager.incrementIteration(); // 1
			manager.incrementIteration(); // 2
			const result = manager.incrementIteration(); // 3 - max reached

			expect(result.shouldContinue).toBe(false);
			expect(result.reason).toBe("Max iterations reached (3)");
			expect(manager.getCurrentLoop()?.status).toBe("max_reached");
		});

		it("should return false if no active loop", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			const result = manager.incrementIteration();

			expect(result.shouldContinue).toBe(false);
			expect(result.reason).toBe("No active loop");
		});
	});

	describe("checkCompletionPromise", () => {
		it("should detect completion promise in output", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			manager.startLoop("Test prompt", "COMPLETE", 10);

			expect(manager.checkCompletionPromise("All tests passing COMPLETE")).toBe(true);
			expect(manager.checkCompletionPromise("All tests passing")).toBe(false);
		});

		it("should return false if no active loop", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			expect(manager.checkCompletionPromise("COMPLETE")).toBe(false);
		});
	});

	describe("completeLoop", () => {
		it("should mark loop as completed", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			const loop = manager.startLoop("Test prompt", "DONE", 10);

			const completed = manager.completeLoop(loop.id, "All tests passing");
			expect(completed?.status).toBe("completed");
			expect(completed?.notes).toContain("Completed: All tests passing");
			expect(manager.hasActiveLoop()).toBe(false);
		});

		it("should return null if loop not found", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			const result = manager.completeLoop("nonexistent-id");
			expect(result).toBeNull();
		});

		it("should complete loop from disk", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			const loop = manager.startLoop("Test prompt", "DONE", 10);
			manager.incrementIteration();

			// Reset manager to lose current loop reference
			resetRalphLoopManager();
			const manager2 = new RalphLoopManager({ dataDir: testDir });

			// The active loop was loaded, so we can complete it
			const completed = manager2.completeLoop(loop.id, "Done");
			expect(completed?.status).toBe("completed");
		});
	});

	describe("cancelLoop", () => {
		it("should cancel active loop", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			const loop = manager.startLoop("Test prompt", "DONE", 10);

			const cancelled = manager.cancelLoop(loop.id, "User requested");
			expect(cancelled?.status).toBe("cancelled");
			expect(cancelled?.notes).toContain("Cancelled: User requested");
			expect(manager.hasActiveLoop()).toBe(false);
		});

		it("should return null if not current loop", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			const loop1 = manager.startLoop("First prompt", "DONE1");
			manager.startLoop("Second prompt", "DONE2"); // Cancels loop1

			// Can't cancel loop1 again - it's already cancelled
			const result = manager.cancelLoop(loop1.id);
			expect(result).toBeNull();
		});
	});

	describe("addNote", () => {
		it("should add note to current loop", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			manager.startLoop("Test prompt", "DONE", 10);

			expect(manager.addNote("Iteration 1: Tests failing")).toBe(true);
			expect(manager.getCurrentLoop()?.notes).toContain("Iteration 1: Tests failing");
		});

		it("should return false if no active loop", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			expect(manager.addNote("Test note")).toBe(false);
		});
	});

	describe("getLoop", () => {
		it("should get loop by ID", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			const loop = manager.startLoop("Test prompt", "DONE", 10);

			const found = manager.getLoop(loop.id);
			expect(found?.id).toBe(loop.id);
			expect(found?.prompt).toBe("Test prompt");
		});

		it("should return null for nonexistent ID", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			const found = manager.getLoop("nonexistent-id");
			expect(found).toBeNull();
		});
	});

	describe("listLoops", () => {
		it("should list all loops", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			manager.startLoop("Prompt 1", "DONE1");
			manager.startLoop("Prompt 2", "DONE2"); // Cancels first
			manager.startLoop("Prompt 3", "DONE3"); // Cancels second

			const loops = manager.listLoops();
			expect(loops.length).toBe(3);
			expect(loops[0].status).toBe("active"); // Most recent first
			expect(loops[1].status).toBe("cancelled");
			expect(loops[2].status).toBe("cancelled");
		});

		it("should filter by status", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			manager.startLoop("Prompt 1", "DONE1");
			manager.startLoop("Prompt 2", "DONE2");

			const active = manager.listLoops("active");
			expect(active.length).toBe(1);
			expect(active[0].status).toBe("active");

			const cancelled = manager.listLoops("cancelled");
			expect(cancelled.length).toBe(1);
			expect(cancelled[0].status).toBe("cancelled");
		});
	});

	describe("getStats", () => {
		it("should calculate statistics", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });

			const loop1 = manager.startLoop("Prompt 1", "DONE1", 5);
			manager.incrementIteration();
			manager.incrementIteration();
			manager.completeLoop(loop1.id);

			const loop2 = manager.startLoop("Prompt 2", "DONE2", 3);
			manager.incrementIteration();
			manager.cancelLoop(loop2.id);

			const stats = manager.getStats();
			expect(stats.totalLoops).toBe(2);
			expect(stats.completedLoops).toBe(1);
			expect(stats.cancelledLoops).toBe(1);
			expect(stats.avgIterations).toBe(1.5); // (2 + 1) / 2
		});

		it("should handle no loops", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			const stats = manager.getStats();
			expect(stats.totalLoops).toBe(0);
			expect(stats.avgIterations).toBe(0);
		});
	});

	describe("clearOldLoops", () => {
		it("should clear old non-active loops", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });

			// Create and complete loops one by one
			for (let i = 0; i < 25; i++) {
				const loop = manager.startLoop(`Prompt ${i}`, `DONE${i}`);
				manager.completeLoop(loop.id);
			}

			// All 25 loops are now completed (no active loop)
			// Keep 5, delete 20 completed
			const deleted = manager.clearOldLoops(5);
			expect(deleted).toBe(20);

			const loops = manager.listLoops();
			// 5 completed loops remain
			expect(loops.filter((l) => l.status === "completed").length).toBe(5);
		});

		it("should not clear active loops", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			manager.startLoop("Active prompt", "DONE");

			const deleted = manager.clearOldLoops(0);
			expect(deleted).toBe(0);
			expect(manager.hasActiveLoop()).toBe(true);
		});
	});

	describe("formatting methods", () => {
		it("should format loop for display", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			const loop = manager.startLoop(
				"Build a REST API for todos with CRUD operations",
				"COMPLETE",
				50,
			);

			const formatted = manager.formatLoop(loop);
			expect(formatted).toContain("🔄");
			expect(formatted).toContain(loop.id);
			expect(formatted).toContain("active");
			expect(formatted).toContain("0/50");
			expect(formatted).toContain("COMPLETE");
		});

		it("should format loops list", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			manager.startLoop("Prompt 1", "DONE1");
			manager.startLoop("Prompt 2", "DONE2");

			const loops = manager.listLoops();
			const formatted = manager.formatLoopsList(loops);
			expect(formatted).toContain("Ralph Loops");
			expect(formatted).toContain("Total: 2 loops");
		});

		it("should format statistics", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			manager.startLoop("Prompt 1", "DONE1");

			const stats = manager.getStats();
			const formatted = manager.formatStats(stats);
			expect(formatted).toContain("Ralph Loop Statistics");
			expect(formatted).toContain("Total Loops: 1");
		});
	});

	describe("file persistence", () => {
		it("should save loop to file", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			const loop = manager.startLoop("Test prompt", "DONE", 10);

			// Check file exists
			const loopPath = join(testDir, `loop-${loop.id}.json`);
			expect(existsSync(loopPath)).toBe(true);
		});

		it("should save current loop marker", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			manager.startLoop("Test prompt", "DONE", 10);

			const currentPath = join(testDir, "current-loop.json");
			expect(existsSync(currentPath)).toBe(true);
		});

		it("should update file on iteration", () => {
			const manager = new RalphLoopManager({ dataDir: testDir });
			const loop = manager.startLoop("Test prompt", "DONE", 10);
			manager.incrementIteration();

			// Load from file and verify iteration count
			resetRalphLoopManager();
			const manager2 = new RalphLoopManager({ dataDir: testDir });
			expect(manager2.getCurrentLoop()?.currentIteration).toBe(1);
		});
	});
});
