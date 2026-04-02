import * as fs from "node:fs";
import * as path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AutoInvokeManager, getAutoInvokeManager } from "./auto-invoke.js";

// Mock fs module
vi.mock("fs", () => ({
	existsSync: vi.fn(() => false),
	mkdirSync: vi.fn(),
	readFileSync: vi.fn(() =>
		JSON.stringify({
			enabled: true,
			rules: [],
			dataPath: "",
			maxSuggestions: 3,
			minConfidence: 0.3,
		}),
	),
	writeFileSync: vi.fn(),
}));

describe("AutoInvokeManager", () => {
	let manager: AutoInvokeManager;

	beforeEach(() => {
		vi.clearAllMocks();
		manager = new AutoInvokeManager("/tmp/test-auto-invoke.json");
	});

	describe("constructor", () => {
		it("should initialize with default rules", () => {
			const rules = manager.listRules();
			expect(rules.length).toBeGreaterThan(0);
		});

		it("should have enabled config by default", () => {
			const config = manager.getConfig();
			expect(config.enabled).toBe(true);
		});
	});

	describe("analyzeContext", () => {
		it("should return suggestions when context matches", () => {
			const suggestions = manager.analyzeContext(
				["src/styles.css"],
				["frontend", "ui"],
				[],
				"frontend",
				"Fix frontend button styling",
			);

			expect(suggestions.length).toBeGreaterThan(0);
			expect(suggestions[0].rule.skill).toBeDefined();
			expect(suggestions[0].confidence).toBeGreaterThan(0);
		});

		it("should return no suggestions when config disabled", () => {
			manager.setConfig({ enabled: false });
			const suggestions = manager.analyzeContext(["src/styles.css"], ["frontend"], []);
			expect(suggestions.length).toBe(0);
		});

		it("should match file pattern triggers", () => {
			const suggestions = manager.analyzeContext(["src/app.test.ts"], [], []);

			// Should match testing-work rule (test files)
			const testSuggestion = suggestions.find((s) => s.rule.skill === "test-driven-development");
			expect(testSuggestion).toBeDefined();
		});

		it("should match keyword triggers", () => {
			const suggestions = manager.analyzeContext([], ["debug", "fix bug", "error"], []);

			// Should match debugging-work rule
			const debugSuggestion = suggestions.find((s) => s.rule.skill === "systematic-debugging");
			expect(debugSuggestion).toBeDefined();
		});

		it("should match tool usage triggers", () => {
			const suggestions = manager.analyzeContext([], [], ["assess", "reflect"]);

			// Should match review-work or debugging-work
			const reviewSuggestion = suggestions.find((s) => s.rule.skill === "review-changes");
			expect(reviewSuggestion).toBeDefined();
		});

		it("should match context triggers", () => {
			const suggestions = manager.analyzeContext([], [], [], "evolution");

			// Should match evolution-work rule
			const evolutionSuggestion = suggestions.find((s) => s.rule.skill === "evolve");
			expect(evolutionSuggestion).toBeDefined();
		});

		it("should respect confidence threshold", () => {
			const suggestions = manager.analyzeContext(["src/styles.css"], ["frontend"], []);

			// All suggestions should meet confidence threshold
			for (const s of suggestions) {
				expect(s.confidence).toBeGreaterThanOrEqual(s.rule.confidenceThreshold);
			}
		});

		it("should limit suggestions to maxSuggestions", () => {
			manager.setConfig({ maxSuggestions: 2 });
			const suggestions = manager.analyzeContext(
				["src/styles.css", "src/app.test.ts"],
				["frontend", "debug", "test"],
				["assess"],
			);

			expect(suggestions.length).toBeLessThanOrEqual(2);
		});

		it("should sort suggestions by confidence", () => {
			const suggestions = manager.analyzeContext(
				["src/styles.css"],
				["frontend", "ui", "design"],
				[],
				"frontend",
			);

			for (let i = 0; i < suggestions.length - 1; i++) {
				expect(suggestions[i].confidence).toBeGreaterThanOrEqual(suggestions[i + 1].confidence);
			}
		});

		it("should return matched triggers in suggestion", () => {
			const suggestions = manager.analyzeContext(["src/styles.css"], ["frontend"], []);

			expect(suggestions[0].matchedTriggers.length).toBeGreaterThan(0);
		});

		it("should return reason for suggestion", () => {
			const suggestions = manager.analyzeContext(["src/styles.css"], ["frontend"], []);

			expect(suggestions[0].reason).toBeDefined();
			expect(suggestions[0].reason.length).toBeGreaterThan(0);
		});
	});

	describe("addRule", () => {
		it("should add custom rule", () => {
			const rule = manager.addRule({
				id: "custom-rule",
				name: "Custom Rule",
				description: "Test custom rule",
				skill: "custom-skill",
				triggers: [{ type: "keyword", pattern: "custom", weight: 0.8 }],
				priority: 5,
				enabled: true,
				confidenceThreshold: 0.5,
			});

			expect(rule.id).toBe("custom-rule");
			expect(rule.invokeCount).toBe(0);

			const found = manager.getRule("custom-rule");
			expect(found).toBeDefined();
		});

		it("should update existing rule", () => {
			manager.addRule({
				id: "test-rule",
				name: "Test Rule",
				description: "Original",
				skill: "skill1",
				triggers: [{ type: "keyword", pattern: "test", weight: 0.5 }],
				priority: 5,
				enabled: true,
				confidenceThreshold: 0.5,
			});

			manager.addRule({
				id: "test-rule",
				name: "Updated Rule",
				description: "Updated",
				skill: "skill2",
				triggers: [{ type: "keyword", pattern: "test", weight: 0.7 }],
				priority: 10,
				enabled: false,
				confidenceThreshold: 0.6,
			});

			const found = manager.getRule("test-rule");
			expect(found?.skill).toBe("skill2");
			expect(found?.priority).toBe(10);
		});
	});

	describe("removeRule", () => {
		it("should disable default rule instead of removing", () => {
			const defaultRules = manager.listRules();
			const defaultRule = defaultRules[0];

			const result = manager.removeRule(defaultRule.id);
			expect(result).toBe(true);

			const found = manager.getRule(defaultRule.id);
			expect(found?.enabled).toBe(false);
		});

		it("should remove custom rule", () => {
			manager.addRule({
				id: "custom-remove",
				name: "Custom",
				description: "Test",
				skill: "skill",
				triggers: [{ type: "keyword", pattern: "test", weight: 0.5 }],
				priority: 5,
				enabled: true,
				confidenceThreshold: 0.5,
			});

			const result = manager.removeRule("custom-remove");
			expect(result).toBe(true);

			const found = manager.getRule("custom-remove");
			expect(found).toBeUndefined();
		});
	});

	describe("setRuleEnabled", () => {
		it("should enable rule", () => {
			manager.setRuleEnabled("debugging-work", false);
			manager.setRuleEnabled("debugging-work", true);

			const rule = manager.getRule("debugging-work");
			expect(rule?.enabled).toBe(true);
		});

		it("should disable rule", () => {
			manager.setRuleEnabled("debugging-work", false);

			const rule = manager.getRule("debugging-work");
			expect(rule?.enabled).toBe(false);
		});

		it("should return false for unknown rule", () => {
			const result = manager.setRuleEnabled("unknown-rule", true);
			expect(result).toBe(false);
		});
	});

	describe("listRules", () => {
		it("should list all rules", () => {
			const rules = manager.listRules();
			expect(rules.length).toBeGreaterThan(5);
		});

		it("should filter enabled rules only", () => {
			const allRules = manager.listRules();
			manager.setRuleEnabled(allRules[0].id, false);

			const enabledRules = manager.listRules(true);
			expect(enabledRules.length).toBeLessThan(allRules.length);
		});
	});

	describe("recordInvocation", () => {
		it("should update stats on invocation", () => {
			manager.recordInvocation("debugging-work", true);

			const stats = manager.getStats();
			expect(stats.totalInvocations).toBe(1);
			expect(stats.successfulInvocations).toBe(1);
		});

		it("should update rule invoke count", () => {
			manager.recordInvocation("debugging-work", true);

			const rule = manager.getRule("debugging-work");
			expect(rule?.invokeCount).toBe(1);
			expect(rule?.lastInvoked).toBeDefined();
		});

		it("should track failed invocations", () => {
			manager.recordInvocation("debugging-work", false);

			const stats = manager.getStats();
			expect(stats.totalInvocations).toBe(1);
			expect(stats.successfulInvocations).toBe(0);
		});

		it("should track skills used", () => {
			manager.recordInvocation("debugging-work", true);

			const stats = manager.getStats();
			expect(stats.rulesBySkill["systematic-debugging"]).toBe(1);
		});

		it("should track trigger types used", () => {
			manager.recordInvocation("debugging-work", true);

			const stats = manager.getStats();
			expect(Object.keys(stats.rulesByTrigger).length).toBeGreaterThan(0);
		});
	});

	describe("getStats", () => {
		it("should return empty stats initially", () => {
			const stats = manager.getStats();
			expect(stats.totalInvocations).toBe(0);
			expect(stats.successfulInvocations).toBe(0);
		});

		it("should accumulate stats across invocations", () => {
			manager.recordInvocation("debugging-work", true);
			manager.recordInvocation("evolution-work", true);
			manager.recordInvocation("debugging-work", false);

			const stats = manager.getStats();
			expect(stats.totalInvocations).toBe(3);
			expect(stats.successfulInvocations).toBe(2);
		});
	});

	describe("getConfig", () => {
		it("should return config", () => {
			const config = manager.getConfig();
			expect(config.enabled).toBe(true);
			expect(config.maxSuggestions).toBeDefined();
			expect(config.minConfidence).toBeDefined();
		});
	});

	describe("setConfig", () => {
		it("should update config", () => {
			manager.setConfig({ maxSuggestions: 5, minConfidence: 0.4 });

			const config = manager.getConfig();
			expect(config.maxSuggestions).toBe(5);
			expect(config.minConfidence).toBe(0.4);
		});
	});

	describe("reset", () => {
		it("should reset to defaults", () => {
			manager.addRule({
				id: "test-reset",
				name: "Test",
				description: "Test",
				skill: "skill",
				triggers: [{ type: "keyword", pattern: "test", weight: 0.5 }],
				priority: 5,
				enabled: true,
				confidenceThreshold: 0.5,
			});
			manager.recordInvocation("debugging-work", true);
			manager.setConfig({ maxSuggestions: 10 });

			manager.reset();

			const config = manager.getConfig();
			expect(config.maxSuggestions).toBe(3);

			const stats = manager.getStats();
			expect(stats.totalInvocations).toBe(0);

			const customRule = manager.getRule("test-reset");
			expect(customRule).toBeUndefined();
		});
	});

	describe("clearStats", () => {
		it("should clear stats only", () => {
			manager.recordInvocation("debugging-work", true);
			manager.recordInvocation("evolution-work", true);

			manager.clearStats();

			const stats = manager.getStats();
			expect(stats.totalInvocations).toBe(0);
		});

		it("should preserve rules", () => {
			manager.addRule({
				id: "test-clear",
				name: "Test",
				description: "Test",
				skill: "skill",
				triggers: [{ type: "keyword", pattern: "test", weight: 0.5 }],
				priority: 5,
				enabled: true,
				confidenceThreshold: 0.5,
			});

			manager.clearStats();

			const rule = manager.getRule("test-clear");
			expect(rule).toBeDefined();
		});
	});

	describe("getAutoInvokeManager singleton", () => {
		it("should return same instance", () => {
			const instance1 = getAutoInvokeManager();
			const instance2 = getAutoInvokeManager();
			expect(instance1).toBe(instance2);
		});
	});
});
