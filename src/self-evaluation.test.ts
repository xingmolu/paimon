import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	type SelfEvaluation,
	SelfEvaluationManager,
	getSelfEvaluationManager,
	resetSelfEvaluationManager,
} from "./self-evaluation.js";

const memoryPath = path.join(process.cwd(), "MEMORY.md");

describe("SelfEvaluationManager", () => {
	let manager: SelfEvaluationManager;
	let originalMemory: string | null = null;

	beforeEach(() => {
		resetSelfEvaluationManager();
		manager = new SelfEvaluationManager();
		originalMemory = existsSync(memoryPath) ? readFileSync(memoryPath, "utf-8") : null;
	});

	afterEach(() => {
		manager.clearEvaluations();
		resetSelfEvaluationManager();
		if (typeof originalMemory === "string") {
			writeFileSync(memoryPath, originalMemory);
		} else if (existsSync(memoryPath)) {
			unlinkSync(memoryPath);
		}
	});

	describe("evaluate", () => {
		it("should perform successful evaluation", () => {
			const evaluation = manager.evaluate({
				iterationId: "iter-1",
				taskType: "capability",
				taskDescription: "Add self-evaluation tool",
				durationMinutes: 15,
				success: true,
				errors: [],
				skillsUsed: ["evolve"],
				firstTry: true,
				rework: false,
				impact: "High",
			});

			expect(evaluation.id).toBeDefined();
			expect(evaluation.timestamp).toBeDefined();
			expect(evaluation.iterationId).toBe("iter-1");
			expect(evaluation.taskType).toBe("capability");
			expect(evaluation.success).toBe(true);
			expect(evaluation.overallScore).toBeGreaterThan(70);
			expect(evaluation.strengths.length).toBeGreaterThan(0);
		});

		it("should perform failed evaluation", () => {
			const evaluation = manager.evaluate({
				iterationId: "iter-2",
				taskType: "reliability",
				taskDescription: "Fix a bug",
				durationMinutes: 30,
				success: false,
				errors: ["TypeScript error"],
				skillsUsed: [],
				firstTry: false,
				rework: true,
				impact: "Medium",
			});

			expect(evaluation.success).toBe(false);
			expect(evaluation.overallScore).toBeLessThan(60);
			expect(evaluation.weaknesses.length).toBeGreaterThan(0);
			expect(evaluation.recommendations.length).toBeGreaterThan(0);
		});

		it("should score task_success criterion correctly", () => {
			const successEval = manager.evaluate({
				iterationId: "iter-3",
				taskType: "capability",
				taskDescription: "Test task",
				durationMinutes: 10,
				success: true,
				errors: [],
				skillsUsed: [],
				firstTry: true,
				rework: false,
				impact: "High",
			});

			const taskSuccessScore = successEval.criterionScores.find(
				(cs) => cs.criterion === "task_success",
			);
			expect(taskSuccessScore?.score).toBe(100); // First try success
		});

		it("should score time_efficiency criterion correctly", () => {
			const efficientEval = manager.evaluate({
				iterationId: "iter-4",
				taskType: "capability",
				taskDescription: "Quick task",
				durationMinutes: 10,
				success: true,
				errors: [],
				skillsUsed: [],
				firstTry: true,
				rework: false,
				impact: "Medium",
			});

			const timeScore = efficientEval.criterionScores.find(
				(cs) => cs.criterion === "time_efficiency",
			);
			expect(timeScore?.score).toBeGreaterThan(70); // Efficient
		});

		it("should identify capability gaps", () => {
			const evaluation = manager.evaluate({
				iterationId: "iter-5",
				taskType: "capability",
				taskDescription: "Test without skills",
				durationMinutes: 20,
				success: true,
				errors: [],
				skillsUsed: [], // No skills used
				firstTry: true,
				rework: false,
				impact: "High",
			});

			expect(evaluation.capabilityGaps.length).toBeGreaterThan(0);
		});

		it("should generate recommendations", () => {
			const evaluation = manager.evaluate({
				iterationId: "iter-6",
				taskType: "feature",
				taskDescription: "Add new feature",
				durationMinutes: 45,
				success: true,
				errors: ["lint"],
				skillsUsed: [],
				firstTry: false,
				rework: true,
				impact: "Low",
			});

			expect(evaluation.recommendations.length).toBeGreaterThan(0);
		});

		it("should add MEMORY-backed test recovery recommendations for recurring test failures", () => {
			writeFileSync(
				memoryPath,
				[
					"# Memory",
					"",
					"## Recent Scorecard",
					"",
					"| Date | Type | Description | Time | Result | Errors | Skills Used |",
					"|------|------|-------------|------|--------|--------|-------------|",
					"| 2026-05-19 | capability | Fix timeout-heavy regression suite with rework | ~15m | ✅ | test | evolve, review-changes |",
					"| 2026-05-18 | capability | Recover from failing regression snapshot update | ~20m | ❌ | test | systematic-debugging |",
				].join("\n"),
			);

			const evaluation = manager.evaluate({
				iterationId: "iter-memory-rec-1",
				taskType: "capability",
				taskDescription: "Recover from recurring regression failures",
				durationMinutes: 35,
				success: false,
				errors: ["test timeout"],
				skillsUsed: ["evolve"],
				firstTry: false,
				rework: true,
				impact: "Medium",
			});

			expect(evaluation.recommendations.join("\n")).toContain(
				"Reuse the successful recovery path from MEMORY.md (2026-05-19: Fix timeout-heavy regression suite with rework). Skills used: evolve, review-changes.",
			);
			expect(evaluation.recommendations.join("\n")).toContain(
				"Review the failed MEMORY.md attempt before retrying (2026-05-18: Recover from failing regression snapshot update). Skills used: systematic-debugging.",
			);
		});

		it("should add MEMORY-backed capability gaps for recurring test failures", () => {
			writeFileSync(
				memoryPath,
				[
					"# Memory",
					"",
					"## Recent Scorecard",
					"",
					"| Date | Type | Description | Time | Result | Errors | Skills Used |",
					"|------|------|-------------|------|--------|--------|-------------|",
					"| 2026-05-17 | capability | Stabilize flaky regression coverage | ~15m | ✅ | test | evolve, review-changes |",
				].join("\n"),
			);

			const evaluation = manager.evaluate({
				iterationId: "iter-memory-gap-1",
				taskType: "capability",
				taskDescription: "Fix recurring test breakage",
				durationMinutes: 40,
				success: false,
				errors: ["test assertion failed"],
				skillsUsed: [],
				firstTry: false,
				rework: true,
				impact: "Low",
			});

			expect(evaluation.capabilityGaps).toContain(
				"test-recovery: Better recurring test failure recovery guidance needed",
			);
			expect(evaluation.capabilityGaps.join("\n")).toContain(
				"memory-test-recovery: Capture and reuse the 2026-05-17 successful recovery path for Stabilize flaky regression coverage",
			);
		});
	});

	describe("getHistory", () => {
		it("should return empty array when no evaluations", () => {
			const history = manager.getHistory();
			expect(history).toHaveLength(0);
		});

		it("should return evaluation history", () => {
			manager.evaluate({
				iterationId: "iter-1",
				taskType: "capability",
				taskDescription: "Task 1",
				durationMinutes: 10,
				success: true,
				errors: [],
				skillsUsed: ["evolve"],
				firstTry: true,
				rework: false,
				impact: "High",
			});

			manager.evaluate({
				iterationId: "iter-2",
				taskType: "reliability",
				taskDescription: "Task 2",
				durationMinutes: 15,
				success: false,
				errors: [],
				skillsUsed: [],
				firstTry: false,
				rework: true,
				impact: "Medium",
			});

			const history = manager.getHistory();
			expect(history).toHaveLength(2);
		});

		it("should respect limit parameter", () => {
			for (let i = 0; i < 5; i++) {
				manager.evaluate({
					iterationId: `iter-${i}`,
					taskType: "capability",
					taskDescription: `Task ${i}`,
					durationMinutes: 10,
					success: true,
					errors: [],
					skillsUsed: [],
					firstTry: true,
					rework: false,
					impact: "High",
				});
			}

			const history = manager.getHistory(3);
			expect(history).toHaveLength(3);
		});
	});

	describe("getEvaluation", () => {
		it("should return specific evaluation", () => {
			const evaluation = manager.evaluate({
				iterationId: "iter-test",
				taskType: "capability",
				taskDescription: "Test task",
				durationMinutes: 10,
				success: true,
				errors: [],
				skillsUsed: [],
				firstTry: true,
				rework: false,
				impact: "High",
			});

			const retrieved = manager.getEvaluation(evaluation.id);
			expect(retrieved).toBeDefined();
			expect(retrieved?.iterationId).toBe("iter-test");
		});

		it("should return undefined for non-existent evaluation", () => {
			const retrieved = manager.getEvaluation("non-existent");
			expect(retrieved).toBeUndefined();
		});
	});

	describe("getCurrentStrengths", () => {
		it("should return empty array when no evaluations", () => {
			const strengths = manager.getCurrentStrengths();
			expect(strengths).toHaveLength(0);
		});

		it("should return strengths from recent evaluations", () => {
			manager.evaluate({
				iterationId: "iter-1",
				taskType: "capability",
				taskDescription: "Task",
				durationMinutes: 10,
				success: true,
				errors: [],
				skillsUsed: ["evolve"],
				firstTry: true,
				rework: false,
				impact: "High",
			});

			const strengths = manager.getCurrentStrengths();
			expect(strengths.length).toBeGreaterThan(0);
		});
	});

	describe("getCurrentWeaknesses", () => {
		it("should return weaknesses from recent evaluations", () => {
			manager.evaluate({
				iterationId: "iter-1",
				taskType: "capability",
				taskDescription: "Task",
				durationMinutes: 60, // Slow
				success: false,
				errors: ["TypeScript error", "lint error"],
				skillsUsed: [],
				firstTry: false,
				rework: true,
				impact: "Low",
			});

			const weaknesses = manager.getCurrentWeaknesses();
			expect(weaknesses.length).toBeGreaterThan(0);
		});
	});

	describe("getRecommendations", () => {
		it("should return recommendations from recent evaluations", () => {
			manager.evaluate({
				iterationId: "iter-1",
				taskType: "capability",
				taskDescription: "Task",
				durationMinutes: 60,
				success: false,
				errors: ["TypeScript error"],
				skillsUsed: [],
				firstTry: false,
				rework: true,
				impact: "Low",
			});

			const recommendations = manager.getRecommendations();
			expect(recommendations.length).toBeGreaterThan(0);
		});
	});

	describe("getPerformanceTrends", () => {
		it("should return empty array when not enough data", () => {
			// Add only 3 evaluations (less than minIterationsForTrend = 5)
			for (let i = 0; i < 3; i++) {
				manager.evaluate({
					iterationId: `iter-${i}`,
					taskType: "capability",
					taskDescription: `Task ${i}`,
					durationMinutes: 10,
					success: true,
					errors: [],
					skillsUsed: [],
					firstTry: true,
					rework: false,
					impact: "High",
				});
			}

			const trends = manager.getPerformanceTrends();
			expect(trends).toHaveLength(0);
		});

		it("should return trends when enough data", () => {
			// Add 20 evaluations (need 10 current + 10 previous for trend comparison)
			for (let i = 0; i < 20; i++) {
				manager.evaluate({
					iterationId: `iter-${i}`,
					taskType: i % 2 === 0 ? "capability" : "reliability",
					taskDescription: `Task ${i}`,
					durationMinutes: 10 + i,
					success: i % 3 !== 0, // 2/3 success rate
					errors: i % 3 === 0 ? ["error"] : [],
					skillsUsed: ["evolve"],
					firstTry: i % 2 === 0,
					rework: i % 4 === 0,
					impact: i % 2 === 0 ? "High" : "Medium",
				});
			}

			const trends = manager.getPerformanceTrends();
			expect(trends.length).toBeGreaterThan(0);
		});
	});

	describe("getStats", () => {
		it("should return empty stats when no evaluations", () => {
			const stats = manager.getStats();
			expect(stats.totalEvaluations).toBe(0);
			expect(stats.averageOverallScore).toBe(0);
		});

		it("should return correct statistics", () => {
			for (let i = 0; i < 5; i++) {
				manager.evaluate({
					iterationId: `iter-${i}`,
					taskType: "capability",
					taskDescription: `Task ${i}`,
					durationMinutes: 10,
					success: i < 4, // 4 successes
					errors: [],
					skillsUsed: ["evolve"],
					firstTry: true,
					rework: false,
					impact: "High",
				});
			}

			const stats = manager.getStats();
			expect(stats.totalEvaluations).toBe(5);
			expect(stats.successRate).toBe(80); // 4/5
		});
	});

	describe("config", () => {
		it("should return default configuration", () => {
			const config = manager.getConfig();
			expect(config.enabled).toBe(true);
			expect(config.autoEvaluate).toBe(true);
			expect(config.minIterationsForTrend).toBe(5);
		});

		it("should update configuration", () => {
			const updated = manager.updateConfig({
				autoEvaluate: false,
				minIterationsForTrend: 10,
			});

			expect(updated.autoEvaluate).toBe(false);
			expect(updated.minIterationsForTrend).toBe(10);
		});
	});

	describe("clear and reset", () => {
		it("should clear evaluations", () => {
			manager.evaluate({
				iterationId: "iter-1",
				taskType: "capability",
				taskDescription: "Task",
				durationMinutes: 10,
				success: true,
				errors: [],
				skillsUsed: [],
				firstTry: true,
				rework: false,
				impact: "High",
			});

			expect(manager.getHistory()).toHaveLength(1);
			manager.clearEvaluations();
			expect(manager.getHistory()).toHaveLength(0);
		});

		it("should reset to defaults", () => {
			manager.updateConfig({ autoEvaluate: false });
			manager.evaluate({
				iterationId: "iter-1",
				taskType: "capability",
				taskDescription: "Task",
				durationMinutes: 10,
				success: true,
				errors: [],
				skillsUsed: [],
				firstTry: true,
				rework: false,
				impact: "High",
			});

			manager.reset();
			expect(manager.getHistory()).toHaveLength(0);
			expect(manager.getConfig().autoEvaluate).toBe(true);
		});
	});

	describe("singleton", () => {
		it("should return same instance", () => {
			resetSelfEvaluationManager();
			const instance1 = getSelfEvaluationManager();
			const instance2 = getSelfEvaluationManager();
			expect(instance1).toBe(instance2);
			resetSelfEvaluationManager();
		});
	});
});
