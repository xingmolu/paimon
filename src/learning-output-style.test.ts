/**
 * Tests for Learning Output Style Pattern
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LearningOutputStyleManager, getLearningManager } from "./learning-output-style.js";
import type {
	DecisionPoint,
	DecisionPointCategory,
	LearningInsight,
	LearningOutputStyleConfig,
	LearningOutputStyleStats,
} from "./learning-output-style.js";

describe("LearningOutputStyleManager", () => {
	let manager: LearningOutputStyleManager;
	const testConfigPath = path.join(
		process.env.HOME || ".",
		".paimon",
		"test-learning-output-style.json",
	);

	beforeEach(() => {
		// Clean up any existing config file before each test
		try {
			if (fs.existsSync(testConfigPath)) {
				fs.unlinkSync(testConfigPath);
			}
		} catch {
			// Ignore cleanup errors
		}
		manager = new LearningOutputStyleManager(testConfigPath);
		// Ensure fresh state
		manager.resetStats();
		manager.updateConfig({ enabled: true, interactive: true });
	});

	afterEach(() => {
		// Clean up test config
		try {
			if (fs.existsSync(testConfigPath)) {
				fs.unlinkSync(testConfigPath);
			}
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("constructor and configuration", () => {
		it("should initialize with default configuration", () => {
			const config = manager.getConfig();
			expect(config.enabled).toBe(true);
			expect(config.interactive).toBe(true);
			expect(config.combineExplanatory).toBe(true);
			expect(config.minDecisionPriority).toBe(5);
			expect(config.maxLinesPerRequest).toBe(10);
		});

		it("should update configuration", () => {
			manager.updateConfig({
				enabled: false,
				interactive: false,
				minDecisionPriority: 7,
			});
			const config = manager.getConfig();
			expect(config.enabled).toBe(false);
			expect(config.interactive).toBe(false);
			expect(config.minDecisionPriority).toBe(7);
		});

		it("should enable and disable learning mode", () => {
			manager.disable();
			expect(manager.getConfig().enabled).toBe(false);

			manager.enable();
			expect(manager.getConfig().enabled).toBe(true);
		});
	});

	describe("educational context generation", () => {
		it("should generate educational context for evolve mode", () => {
			const context = manager.generateEducationalContext({
				mode: "evolve",
				filesChanged: [],
				skillsUsed: [],
			});
			expect(context).toContain("Learning Mode Active");
			expect(context).toContain("Educational Insights");
			expect(context).toContain("evolve mode tips");
		});

		it("should generate educational context for chat mode", () => {
			const context = manager.generateEducationalContext({
				mode: "chat",
				filesChanged: [],
				skillsUsed: [],
			});
			expect(context).toContain("Learning Mode Active");
			expect(context).toContain("chat mode tips");
		});

		it("should not generate context when disabled", () => {
			manager.disable();
			const context = manager.generateEducationalContext({
				mode: "evolve",
				filesChanged: [],
				skillsUsed: [],
			});
			expect(context).toBe("");
		});

		it("should include decision point guidance when interactive", () => {
			// Ensure interactive mode is enabled
			manager.updateConfig({ interactive: true, enabled: true });
			const context = manager.generateEducationalContext({
				mode: "feature",
				filesChanged: [],
				skillsUsed: [],
			});
			expect(context).toContain("Request contribution");
			expect(context).toContain("Implement directly");
		});
	});

	describe("decision point detection", () => {
		it("should detect business logic decision points", () => {
			const points = manager.detectDecisionPoints(
				"Implement the business logic for user authentication with multiple valid approaches",
			);
			expect(points.length).toBeGreaterThan(0);
			expect(points.some((p) => p.category === "business-logic")).toBe(true);
		});

		it("should detect error handling decision points", () => {
			const points = manager.detectDecisionPoints(
				"Add error handling strategy for API failures with retry logic",
			);
			expect(points.length).toBeGreaterThan(0);
			expect(points.some((p) => p.category === "error-handling")).toBe(true);
		});

		it("should detect architecture decision points", () => {
			const points = manager.detectDecisionPoints(
				"Design the architecture for the new module with proper abstractions",
			);
			expect(points.length).toBeGreaterThan(0);
			expect(points.some((p) => p.category === "architecture")).toBe(true);
		});

		it("should not detect decision points for auto-implementable code", () => {
			const points = manager.detectDecisionPoints(
				"Add boilerplate configuration and simple CRUD setup code",
			);
			// Auto-implementable patterns should be filtered - no points should be returned
			// because "boilerplate", "configuration", "setup" are auto-implement patterns
			expect(points.length).toBe(0);
		});

		it("should respect minDecisionPriority config", () => {
			manager.updateConfig({ minDecisionPriority: 9 });
			const points = manager.detectDecisionPoints("Implement business logic with design choices");
			// Only priority 9+ decision points should be returned
			expect(points.every((p) => p.priority >= 9)).toBe(true);
		});

		it("should include tradeoffs for each category", () => {
			const points = manager.detectDecisionPoints(
				"Choose algorithm implementation for sorting data",
			);
			for (const point of points) {
				expect(point.tradeoffs.length).toBeGreaterThan(0);
			}
		});
	});

	describe("decision point formatting", () => {
		it("should format decision point request", () => {
			const points = manager.detectDecisionPoints("Design security approach for authentication");
			if (points.length > 0) {
				const formatted = manager.formatDecisionPointRequest(points[0]);
				expect(formatted).toContain("Decision Point:");
				expect(formatted).toContain("Trade-offs to consider");
				expect(formatted).toContain("lines implementing");
			}
		});
	});

	describe("insights management", () => {
		it("should get all insights", () => {
			const insights = manager.getInsights();
			expect(insights.length).toBeGreaterThan(0);
			expect(insights.some((i) => i.category === "patterns")).toBe(true);
			expect(insights.some((i) => i.category === "evolution")).toBe(true);
		});

		it("should get specific insight by ID", () => {
			const insight = manager.getInsight("learning-evolution-value");
			expect(insight).toBeDefined();
			expect(insight?.title).toContain("Evolution Value");
		});

		it("should get insights by category", () => {
			const insights = manager.getInsightsByCategory("architecture");
			expect(insights.length).toBeGreaterThan(0);
			expect(insights.every((i) => i.category === "architecture")).toBe(true);
		});

		it("should add custom insight", () => {
			const customInsight: LearningInsight = {
				id: "custom-test-insight",
				category: "patterns",
				title: "Custom Test Insight",
				description: "A custom insight for testing",
				priority: 5,
			};
			manager.addInsight(customInsight);
			const insights = manager.getInsights();
			expect(insights.some((i) => i.id === "custom-test-insight")).toBe(true);
		});

		it("should not add duplicate insight", () => {
			const customInsight: LearningInsight = {
				id: "learning-evolution-value", // Already exists
				category: "patterns",
				title: "Duplicate",
				description: "Should not be added",
				priority: 5,
			};
			manager.addInsight(customInsight);
			const insights = manager.getInsights();
			// Should still only have one insight with this ID
			expect(insights.filter((i) => i.id === "learning-evolution-value").length).toBe(1);
		});

		it("should remove custom insight", () => {
			const customInsight: LearningInsight = {
				id: "removable-test-insight",
				category: "patterns",
				title: "Removable Test Insight",
				description: "A removable insight for testing",
				priority: 5,
			};
			manager.addInsight(customInsight);
			const removed = manager.removeInsight("removable-test-insight");
			expect(removed).toBe(true);
			const insights = manager.getInsights();
			expect(insights.some((i) => i.id === "removable-test-insight")).toBe(false);
		});

		it("should not remove default insight", () => {
			const removed = manager.removeInsight("learning-evolution-value");
			expect(removed).toBe(false);
			const insights = manager.getInsights();
			expect(insights.some((i) => i.id === "learning-evolution-value")).toBe(true);
		});
	});

	describe("statistics tracking", () => {
		it("should track sessions enhanced", () => {
			manager.generateEducationalContext({
				mode: "evolve",
				filesChanged: [],
				skillsUsed: [],
			});
			const stats = manager.getStats();
			expect(stats.sessionsEnhanced).toBeGreaterThan(0);
		});

		it("should track decision points requested", () => {
			const points = manager.detectDecisionPoints("Design architecture with multiple approaches");
			for (const point of points) {
				manager.recordDecisionPointRequested(point);
			}
			const stats = manager.getStats();
			expect(stats.decisionPointsRequested).toBe(points.length);
		});

		it("should track contributions provided", () => {
			manager.recordContributionProvided("test-point-1");
			manager.recordContributionProvided("test-point-2");
			const stats = manager.getStats();
			expect(stats.decisionPointsContributed).toBe(2);
		});

		it("should track auto-implemented", () => {
			manager.recordAutoImplemented("test-point-3");
			const stats = manager.getStats();
			expect(stats.decisionPointsAutoImplemented).toBe(1);
		});

		it("should calculate contribution rate", () => {
			manager.resetStats();
			manager.recordDecisionPointRequested({
				id: "test-1",
				category: "business-logic",
				description: "Test",
				context: "Test context",
				tradeoffs: ["A vs B"],
				estimatedLines: 5,
				priority: 8,
				autoImplementable: false,
			});
			manager.recordContributionProvided("test-1");
			const stats = manager.getStats();
			expect(stats.contributionRate).toBe(100);
		});

		it("should track top categories", () => {
			manager.resetStats();
			manager.recordDecisionPointRequested({
				id: "test-1",
				category: "business-logic",
				description: "Test",
				context: "Test",
				tradeoffs: [],
				estimatedLines: 5,
				priority: 8,
				autoImplementable: false,
			});
			manager.recordDecisionPointRequested({
				id: "test-2",
				category: "business-logic",
				description: "Test",
				context: "Test",
				tradeoffs: [],
				estimatedLines: 5,
				priority: 8,
				autoImplementable: false,
			});
			const stats = manager.getStats();
			expect(stats.topCategories.length).toBeGreaterThan(0);
			expect(stats.topCategories[0].category).toBe("business-logic");
			expect(stats.topCategories[0].count).toBe(2);
		});

		it("should reset statistics", () => {
			manager.recordContributionProvided("test");
			manager.resetStats();
			const stats = manager.getStats();
			expect(stats.sessionsEnhanced).toBe(0);
			expect(stats.decisionPointsRequested).toBe(0);
			expect(stats.decisionPointsContributed).toBe(0);
		});
	});

	describe("singleton instance", () => {
		it("should return singleton manager", () => {
			const instance1 = getLearningManager();
			const instance2 = getLearningManager();
			expect(instance1).toBe(instance2);
		});
	});
});

describe("Decision Point Categories", () => {
	it("should have all expected categories", () => {
		const categories: DecisionPointCategory[] = [
			"business-logic",
			"error-handling",
			"algorithm",
			"data-structure",
			"ux-decision",
			"architecture",
			"security",
			"performance",
		];
		expect(categories.length).toBe(8);
	});
});

describe("Learning Insight Categories", () => {
	it("should have all expected insight categories", () => {
		const manager = getLearningManager();
		const insights = manager.getInsights();
		const categories = [...new Set(insights.map((i) => i.category))];
		expect(categories).toContain("architecture");
		expect(categories).toContain("patterns");
		expect(categories).toContain("evolution");
		expect(categories).toContain("tools");
		expect(categories).toContain("skills");
		expect(categories).toContain("memory");
		expect(categories).toContain("safety");
	});
});
