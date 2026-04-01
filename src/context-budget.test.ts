/**
 * Tests for Context Budget Monitoring module.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
	ContextBudgetManager,
	DEFAULT_CONTEXT_BUDGET_CONFIG,
	getGlobalContextBudgetManager,
	initGlobalContextBudgetManager,
} from "./context-budget.js";

describe("ContextBudgetManager", () => {
	let manager: ContextBudgetManager;

	beforeEach(() => {
		manager = new ContextBudgetManager();
	});

	describe("constructor", () => {
		it("should use default configuration", () => {
			const config = manager.getConfig();
			expect(config.maxContextWindow).toBe(128000);
			expect(config.warningThresholdPercent).toBe(70);
			expect(config.criticalThresholdPercent).toBe(85);
			expect(config.responseBufferTokens).toBe(8000);
			expect(config.enabled).toBe(true);
		});

		it("should accept custom configuration", () => {
			const customManager = new ContextBudgetManager({
				maxContextWindow: 200000,
				warningThresholdPercent: 60,
			});
			const config = customManager.getConfig();
			expect(config.maxContextWindow).toBe(200000);
			expect(config.warningThresholdPercent).toBe(60);
		});
	});

	describe("token estimation", () => {
		it("should track token estimate", () => {
			manager.updateTokenEstimate(50000);
			expect(manager.getTokenEstimate()).toBe(50000);
		});

		it("should add tokens to estimate", () => {
			manager.updateTokenEstimate(10000);
			manager.addTokens(5000);
			expect(manager.getTokenEstimate()).toBe(15000);
		});

		it("should use compaction estimateTokens function", () => {
			const estimate = ContextBudgetManager.estimateTokens("Hello world");
			expect(estimate).toBeGreaterThan(0);
		});
	});

	describe("checkBudget", () => {
		it("should return healthy status for low usage", () => {
			manager.updateTokenEstimate(50000); // ~40% of 120k available
			const stats = manager.checkBudget("test");
			expect(stats.healthStatus).toBe("healthy");
			expect(stats.currentTokens).toBe(50000);
			expect(stats.usagePercent).toBeLessThan(50);
		});

		it("should return warning status at threshold", () => {
			// 70% of 120k = 84k tokens
			manager.updateTokenEstimate(85000);
			const stats = manager.checkBudget("test");
			expect(stats.healthStatus).toBe("warning");
		});

		it("should return critical status at critical threshold", () => {
			// 85% of 120k = 102k tokens
			manager.updateTokenEstimate(105000);
			const stats = manager.checkBudget("test");
			expect(stats.healthStatus).toBe("critical");
		});

		it("should return overflow status beyond max", () => {
			// Beyond 120k available
			manager.updateTokenEstimate(130000);
			const stats = manager.checkBudget("test");
			expect(stats.healthStatus).toBe("overflow");
		});

		it("should generate appropriate recommendations", () => {
			manager.updateTokenEstimate(50000);
			const stats = manager.checkBudget("test");
			expect(stats.recommendations.length).toBeGreaterThan(0);
			expect(stats.recommendations.some((r) => r.includes("healthy"))).toBe(true);
		});

		it("should track history", () => {
			manager.updateTokenEstimate(50000);
			manager.checkBudget("test1");
			manager.updateTokenEstimate(60000);
			manager.checkBudget("test2");
			// Note: getStats() calls checkBudget which adds an extra entry
			const stats = manager.getStats();
			expect(stats.history.length).toBe(3); // test1, test2, and stats_query
		});

		it("should track peak usage", () => {
			manager.updateTokenEstimate(50000);
			manager.checkBudget("test");
			manager.updateTokenEstimate(80000);
			manager.checkBudget("test");
			const stats = manager.getStats();
			expect(stats.peakUsage).toBe(80000);
		});
	});

	describe("getStats", () => {
		it("should return comprehensive statistics", () => {
			manager.updateTokenEstimate(80000);
			manager.checkBudget("test");
			const stats = manager.getStats();
			expect(stats.totalChecks).toBeGreaterThan(0);
			expect(stats.currentUsage).toBeDefined();
			expect(stats.averageUsage).toBeDefined();
			expect(stats.peakUsage).toBeDefined();
		});

		it("should track warning counts", () => {
			manager.updateTokenEstimate(85000);
			manager.checkBudget("test");
			const stats = manager.getStats();
			expect(stats.warningCount).toBeGreaterThan(0);
		});

		it("should track critical counts", () => {
			manager.updateTokenEstimate(105000);
			manager.checkBudget("test");
			const stats = manager.getStats();
			expect(stats.criticalCount).toBeGreaterThan(0);
		});

		it("should track overflow counts", () => {
			manager.updateTokenEstimate(130000);
			manager.checkBudget("test");
			const stats = manager.getStats();
			expect(stats.overflowCount).toBeGreaterThan(0);
		});
	});

	describe("getOptimizationSuggestions", () => {
		it("should return suggestions when usage is moderate", () => {
			manager.updateTokenEstimate(70000);
			const suggestions = manager.getOptimizationSuggestions();
			expect(suggestions.length).toBeGreaterThan(0);
		});

		it("should prioritize suggestions correctly", () => {
			manager.updateTokenEstimate(90000);
			const suggestions = manager.getOptimizationSuggestions();
			// Check that priority 1 comes first
			const priorities = suggestions.map((s) => s.priority);
			expect(priorities[0]).toBeLessThanOrEqual(priorities[priorities.length - 1]);
		});

		it("should include estimated savings", () => {
			manager.updateTokenEstimate(80000);
			const suggestions = manager.getOptimizationSuggestions();
			for (const s of suggestions) {
				expect(s.estimatedSavings).toBeGreaterThan(0);
			}
		});
	});

	describe("updateConfig", () => {
		it("should update configuration", () => {
			manager.updateConfig({ warningThresholdPercent: 75 });
			const config = manager.getConfig();
			expect(config.warningThresholdPercent).toBe(75);
		});

		it("should preserve other config values", () => {
			manager.updateConfig({ warningThresholdPercent: 75 });
			const config = manager.getConfig();
			expect(config.maxContextWindow).toBe(128000); // unchanged
		});
	});

	describe("reset", () => {
		it("should reset statistics", () => {
			manager.updateTokenEstimate(50000);
			manager.checkBudget("test");
			manager.reset();
			const stats = manager.getStats();
			expect(stats.totalChecks).toBe(1); // reset sets to 0, but getStats calls checkBudget
			expect(manager.getTokenEstimate()).toBe(0);
		});

		it("should preserve configuration after reset", () => {
			manager.updateConfig({ warningThresholdPercent: 75 });
			manager.reset();
			const config = manager.getConfig();
			expect(config.warningThresholdPercent).toBe(75);
		});
	});

	describe("history limit", () => {
		it("should limit history to 100 entries", () => {
			for (let i = 0; i < 150; i++) {
				manager.updateTokenEstimate(i * 100);
				manager.checkBudget("test");
			}
			const stats = manager.getStats();
			expect(stats.history.length).toBeLessThanOrEqual(100);
		});
	});

	describe("shouldCheck", () => {
		it("should return true when no last check", () => {
			expect(manager.shouldCheck(null)).toBe(true);
		});

		it("should return true after interval", () => {
			const oldTime = Date.now() - 10000; // 10 seconds ago
			expect(manager.shouldCheck(oldTime, 5000)).toBe(true);
		});

		it("should return false within interval", () => {
			const recentTime = Date.now() - 2000; // 2 seconds ago
			expect(manager.shouldCheck(recentTime, 5000)).toBe(false);
		});
	});
});

describe("Global Context Budget Manager", () => {
	it("should initialize global manager", () => {
		const manager = initGlobalContextBudgetManager({ maxContextWindow: 200000 });
		expect(manager.getConfig().maxContextWindow).toBe(200000);
	});

	it("should get global manager", () => {
		initGlobalContextBudgetManager();
		const manager = getGlobalContextBudgetManager();
		expect(manager).toBeDefined();
		expect(manager.getConfig()).toBeDefined();
	});
});
