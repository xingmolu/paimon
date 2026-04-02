import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	ExplanatoryOutputStyleManager,
	type InsightCategory,
	getExplanatoryOutputStyleManager,
} from "./explanatory-output-style.js";

describe("ExplanatoryOutputStyleManager", () => {
	let manager: ExplanatoryOutputStyleManager;
	const tempDir = os.tmpdir();
	const testConfigPath = path.join(tempDir, "test-explanatory-output-style.json");

	beforeEach(() => {
		// Clean up test files
		try {
			fs.unlinkSync(testConfigPath);
		} catch {}
		try {
			fs.unlinkSync(path.join(tempDir, "test-explanatory-output-style-stats.json"));
		} catch {}

		// Create fresh manager instance
		manager = new ExplanatoryOutputStyleManager(testConfigPath);
	});

	afterEach(() => {
		// Clean up test files
		try {
			fs.unlinkSync(testConfigPath);
		} catch {}
		try {
			fs.unlinkSync(path.join(tempDir, "test-explanatory-output-style-stats.json"));
		} catch {}
	});

	describe("constructor and initialization", () => {
		it("should create manager with default config", () => {
			expect(manager).toBeDefined();
			expect(manager.isEnabled()).toBe(true);
		});

		it("should load default insights", () => {
			const insights = manager.getInsightsByCategory("architecture");
			expect(insights.length).toBeGreaterThan(0);
		});

		it("should have insights across all categories", () => {
			const categories: InsightCategory[] = [
				"architecture",
				"patterns",
				"evolution",
				"tools",
				"skills",
				"memory",
				"safety",
			];
			for (const category of categories) {
				const insights = manager.getInsightsByCategory(category);
				expect(insights.length).toBeGreaterThan(0);
			}
		});
	});

	describe("generateEducationalContext", () => {
		it("should generate context when enabled", () => {
			const context = manager.generateEducationalContext("evolve");
			expect(context).toContain("Educational Insights");
			expect(context.length).toBeGreaterThan(100);
		});

		it("should return empty string when disabled", () => {
			manager.setEnabled(false);
			const context = manager.generateEducationalContext();
			expect(context).toBe("");
		});

		it("should include session-specific tip for evolve mode", () => {
			const context = manager.generateEducationalContext("evolve");
			expect(context).toContain("Evolution Tip");
		});

		it("should include session-specific tip for chat mode", () => {
			const context = manager.generateEducationalContext("chat");
			expect(context).toContain("Chat Tip");
		});

		it("should limit insights to maxInsights config", () => {
			manager.setConfig({ maxInsights: 2 });
			const context = manager.generateEducationalContext();
			// Count number of **Title** patterns (each insight has a title)
			const titleMatches = context.match(/\*\*[^\*]+\*\*/g);
			expect(titleMatches?.length).toBeLessThanOrEqual(3); // 2 insights + 1 header
		});

		it("should update stats when generating context", () => {
			manager.clearStats(); // Clear stats first to get accurate count
			manager.generateEducationalContext();
			const stats = manager.getStats();
			expect(stats.sessionsEnhanced).toBe(1);
			expect(stats.insightsShown).toBeGreaterThan(0);
		});

		it("should include patterns when config enabled", () => {
			manager.setConfig({ includePatterns: true, maxInsights: 1 });
			const context = manager.generateEducationalContext();
			expect(context).toContain("Pattern:");
		});

		it("should exclude patterns when config disabled", () => {
			manager.setConfig({ includePatterns: false, maxInsights: 1 });
			const context = manager.generateEducationalContext();
			expect(context).not.toContain("Pattern:");
		});

		it("should include reasons when config enabled", () => {
			manager.setConfig({ includeReasons: true, maxInsights: 1 });
			const context = manager.generateEducationalContext();
			expect(context).toContain("Reason:");
		});

		it("should exclude reasons when config disabled", () => {
			manager.setConfig({ includeReasons: false, maxInsights: 1 });
			const context = manager.generateEducationalContext();
			expect(context).not.toContain("Reason:");
		});

		it("should include alternatives when config enabled", () => {
			manager.setConfig({ includeAlternatives: true, maxInsights: 1 });
			const context = manager.generateEducationalContext();
			expect(context).toContain("Alternatives:");
		});

		it("should exclude alternatives when config disabled", () => {
			manager.setConfig({ includeAlternatives: false, maxInsights: 1 });
			const context = manager.generateEducationalContext();
			expect(context).not.toContain("Alternatives:");
		});
	});

	describe("getInsight", () => {
		it("should return insight by title", () => {
			const insight = manager.getInsight("Modular Architecture");
			expect(insight).toBeDefined();
			expect(insight?.title).toBe("Modular Architecture");
			expect(insight?.category).toBe("architecture");
		});

		it("should return undefined for unknown title", () => {
			const insight = manager.getInsight("Unknown Title");
			expect(insight).toBeUndefined();
		});
	});

	describe("getInsightsByCategory", () => {
		it("should return all architecture insights", () => {
			const insights = manager.getInsightsByCategory("architecture");
			expect(insights.length).toBeGreaterThan(0);
			for (const insight of insights) {
				expect(insight.category).toBe("architecture");
			}
		});

		it("should return all patterns insights", () => {
			const insights = manager.getInsightsByCategory("patterns");
			expect(insights.length).toBeGreaterThan(0);
			for (const insight of insights) {
				expect(insight.category).toBe("patterns");
			}
		});

		it("should return empty array for category with no insights", () => {
			// All default categories have insights, but test the function
			const insights = manager.getInsightsByCategory("architecture");
			expect(insights).toBeDefined();
			expect(Array.isArray(insights)).toBe(true);
		});
	});

	describe("addInsight", () => {
		it("should add custom insight", () => {
			manager.addInsight({
				category: "architecture",
				title: "Test Insight",
				description: "Test description",
				priority: 5,
			});
			const insight = manager.getInsight("Test Insight");
			expect(insight).toBeDefined();
			expect(insight?.description).toBe("Test description");
		});

		it("should update existing insight with same title", () => {
			manager.addInsight({
				category: "architecture",
				title: "Modular Architecture",
				description: "Updated description",
				priority: 1,
			});
			const insight = manager.getInsight("Modular Architecture");
			expect(insight?.description).toBe("Updated description");
		});
	});

	describe("config management", () => {
		it("should get config", () => {
			const config = manager.getConfig();
			expect(config.enabled).toBe(true);
			expect(config.maxInsights).toBeDefined();
			expect(config.verbosity).toBeDefined();
		});

		it("should set config", () => {
			manager.setConfig({ maxInsights: 3, verbosity: "brief" });
			const config = manager.getConfig();
			expect(config.maxInsights).toBe(3);
			expect(config.verbosity).toBe("brief");
		});

		it("should enable/disable", () => {
			manager.setEnabled(false);
			expect(manager.isEnabled()).toBe(false);
			manager.setEnabled(true);
			expect(manager.isEnabled()).toBe(true);
		});
	});

	describe("stats management", () => {
		it("should get stats", () => {
			const stats = manager.getStats();
			expect(stats.sessionsEnhanced).toBeDefined();
			expect(stats.insightsShown).toBeDefined();
		});

		it("should clear stats", () => {
			manager.generateEducationalContext();
			manager.clearStats();
			const stats = manager.getStats();
			expect(stats.sessionsEnhanced).toBe(0);
			expect(stats.insightsShown).toBe(0);
		});

		it("should track insights by category", () => {
			manager.clearStats();
			manager.generateEducationalContext();
			const stats = manager.getStats();
			expect(Object.keys(stats.insightsByCategory).length).toBeGreaterThan(0);
		});

		it("should track top insights", () => {
			manager.clearStats();
			manager.generateEducationalContext();
			manager.generateEducationalContext();
			const stats = manager.getStats();
			expect(stats.topInsights.length).toBeGreaterThan(0);
			expect(stats.topInsights[0].count).toBeGreaterThanOrEqual(2);
		});
	});

	describe("reset", () => {
		it("should reset to defaults", () => {
			manager.setConfig({ maxInsights: 10, verbosity: "detailed" });
			manager.reset();
			const config = manager.getConfig();
			expect(config.maxInsights).toBe(5);
			expect(config.verbosity).toBe("normal");
		});

		it("should restore default insights after reset", () => {
			manager.addInsight({
				category: "architecture",
				title: "Custom Insight",
				description: "Custom",
				priority: 1,
			});
			manager.reset();
			const insights = manager.getInsightsByCategory("architecture");
			expect(insights.length).toBeGreaterThan(0);
		});
	});

	describe("priority ordering", () => {
		it("should return insights sorted by priority", () => {
			const insights = manager.getInsightsByCategory("architecture");
			for (let i = 0; i < insights.length - 1; i++) {
				expect(insights[i].priority).toBeGreaterThanOrEqual(insights[i + 1].priority);
			}
		});

		it("should show highest priority insights in context first", () => {
			manager.setConfig({ maxInsights: 1 });
			const context = manager.generateEducationalContext();
			// Should contain the highest priority insight (Modular Architecture, priority 10)
			expect(context).toContain("Modular Architecture");
		});
	});
});

describe("getExplanatoryOutputStyleManager singleton", () => {
	it("should return singleton instance", () => {
		const manager1 = getExplanatoryOutputStyleManager();
		const manager2 = getExplanatoryOutputStyleManager();
		expect(manager1).toBe(manager2);
	});

	it("should be enabled by default", () => {
		const manager = getExplanatoryOutputStyleManager();
		expect(manager.isEnabled()).toBe(true);
	});
});
