import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { describe, expect, it, vi } from "vitest";

import * as contextAnalysisModule from "./context-analysis.js";
import { OptimizationDashboardManager } from "./optimization-dashboard.js";

describe("OptimizationDashboardManager", () => {
	it("derives health from injected metrics and tool usage data", () => {
		const manager = new OptimizationDashboardManager({
			metricsTracker: {
				getMetrics: () => ({
					successRate: { current: 96, points: [], weeklyAverage: 94, improvement: 4 },
					time: {
						averageMinutes: 12,
						byTaskType: { capability: 12 },
						points: [],
						fastestTask: "Quick fix",
						slowestTask: "Large feature",
					},
					errors: {
						totalErrors: 2,
						byType: { lint: 2 },
						recentErrors: [],
						points: [],
						commonPatterns: ["lint"],
					},
					skills: [
						{
							skill: "evolve",
							usageCount: 10,
							successRate: 95,
							averageTime: 12,
							trend: "improving",
						},
					],
					capabilityVelocity: {
						current: 18,
						points: [],
						totalCapabilities: 100,
						highImpactCount: 90,
						highImpactPercentage: 90,
					},
					lastUpdated: "2026-04-16T00:00:00.000Z",
					iterationsAnalyzed: 20,
				}),
			},
			toolUsageAnalyticsManager: {
				getToolStats: () => [
					{
						toolName: "read",
						totalUses: 50,
						successfulUses: 49,
						failedUses: 1,
						successRate: 98,
						averageDuration: 100,
						lastUsed: "2026-04-16T00:00:00.000Z",
						actions: {},
						taskTypes: { capability: 50 },
						commonErrors: [],
					},
					{
						toolName: "assess",
						totalUses: 12,
						successfulUses: 9,
						failedUses: 3,
						successRate: 75,
						averageDuration: 65000,
						lastUsed: "2026-04-16T00:00:00.000Z",
						actions: {},
						taskTypes: { capability: 12 },
						commonErrors: ["timeout"],
					},
				],
			},
		});

		const health = manager.getHealth();
		expect(health.components.successRate).toBe(96);
		expect(health.components.timeEfficiency).toBeGreaterThanOrEqual(100 - 1);
		expect(health.components.errorRate).toBe(90);
		expect(health.components.capabilityUtilization).toBeGreaterThan(80);
		expect(health.components.memoryQuality).toBeGreaterThanOrEqual(78);
		expect(health.status).toBe("excellent");
	});

	it("builds utilization and bottlenecks from analytics data", () => {
		const manager = new OptimizationDashboardManager({
			metricsTracker: {
				getMetrics: () => ({
					successRate: { current: 80, points: [], weeklyAverage: 80, improvement: 0 },
					time: {
						averageMinutes: 20,
						byTaskType: {},
						points: [],
						fastestTask: "A",
						slowestTask: "B",
					},
					errors: {
						totalErrors: 5,
						byType: { lint: 5 },
						recentErrors: [],
						points: [],
						commonPatterns: ["lint"],
					},
					skills: [],
					capabilityVelocity: {
						current: 5,
						points: [],
						totalCapabilities: 20,
						highImpactCount: 10,
						highImpactPercentage: 50,
					},
					lastUpdated: "2026-04-16T00:00:00.000Z",
					iterationsAnalyzed: 10,
				}),
			},
			toolUsageAnalyticsManager: {
				getToolStats: () => [
					{
						toolName: "rareTool",
						totalUses: 2,
						successfulUses: 1,
						failedUses: 1,
						successRate: 50,
						averageDuration: 70000,
						lastUsed: "2026-04-16T00:00:00.000Z",
						actions: {},
						taskTypes: {},
						commonErrors: ["boom"],
					},
				],
			},
		});

		const utilization = manager.getCapabilityUtilization();
		expect(utilization).toHaveLength(1);
		expect(utilization[0].underutilized).toBe(true);

		const bottlenecks = manager.identifyBottlenecks();
		expect(bottlenecks.some((item) => item.type === "slow-tool")).toBe(true);
		expect(bottlenecks.some((item) => item.type === "high-error")).toBe(true);
		expect(bottlenecks.some((item) => item.type === "low-utilization")).toBe(true);
		expect(bottlenecks.some((item) => item.type === "memory-issues")).toBe(true);
	});

	it("suppresses generic fallback memory recommendations without evidence", () => {
		const manager = new OptimizationDashboardManager({
			metricsTracker: {
				getMetrics: () => ({
					successRate: { current: 82, points: [], weeklyAverage: 84, improvement: -3 },
					time: {
						averageMinutes: 18,
						byTaskType: { capability: 18 },
						points: [],
						fastestTask: "Quick fix",
						slowestTask: "Complex integration",
					},
					errors: {
						totalErrors: 0,
						byType: {},
						recentErrors: [],
						points: [],
						commonPatterns: [],
					},
					skills: [],
					capabilityVelocity: {
						current: 6,
						points: [],
						totalCapabilities: 40,
						highImpactCount: 0,
						highImpactPercentage: 0,
					},
					lastUpdated: "2026-04-16T00:00:00.000Z",
					iterationsAnalyzed: 0,
				}),
			},
			toolUsageAnalyticsManager: {
				getToolStats: () => [],
			},
		});

		const recommendations = manager.getRecommendations();
		const titles = recommendations.map((item) => item.title);

		expect(titles).not.toContain("Strengthen learning capture");
	});

	it("does not claim recent capability work was low impact when impact data is unavailable", () => {
		const manager = new OptimizationDashboardManager({
			metricsTracker: {
				getMetrics: () => ({
					successRate: { current: 82, points: [], weeklyAverage: 84, improvement: -3 },
					time: {
						averageMinutes: 18,
						byTaskType: { capability: 18 },
						points: [],
						fastestTask: "Quick fix",
						slowestTask: "Complex integration",
					},
					errors: {
						totalErrors: 4,
						byType: { lint: 3, test: 1 },
						recentErrors: [],
						points: [],
						commonPatterns: ["lint (fixed)", "test"],
					},
					skills: [
						{
							skill: "review-changes",
							usageCount: 3,
							successRate: 62,
							averageTime: 17,
							trend: "declining",
						},
					],
					capabilityVelocity: {
						current: 6,
						points: [],
						totalCapabilities: 40,
						highImpactCount: 0,
						highImpactPercentage: 0,
					},
					lastUpdated: "2026-04-16T00:00:00.000Z",
					iterationsAnalyzed: 12,
				}),
			},
			toolUsageAnalyticsManager: {
				getToolStats: () => [],
			},
		});

		const recommendations = manager.getRecommendations();
		const titles = recommendations.map((item) => item.title);

		expect(titles).not.toContain("Record why recent work was lower impact");
	});

	it("generates actionable memory recommendations from live weak signals", () => {
		const manager = new OptimizationDashboardManager({
			metricsTracker: {
				getMetrics: () => ({
					successRate: { current: 82, points: [], weeklyAverage: 84, improvement: -3 },
					time: {
						averageMinutes: 18,
						byTaskType: { capability: 18 },
						points: [],
						fastestTask: "Quick fix",
						slowestTask: "Complex integration",
					},
					errors: {
						totalErrors: 4,
						byType: { lint: 3, test: 1 },
						recentErrors: [],
						points: [],
						commonPatterns: ["lint (fixed)", "test"],
					},
					skills: [
						{
							skill: "review-changes",
							usageCount: 3,
							successRate: 62,
							averageTime: 17,
							trend: "declining",
						},
						{
							skill: "-------------",
							usageCount: 1,
							successRate: 0,
							averageTime: 5,
							trend: "declining",
						},
						{
							skill: "plan-architecture",
							usageCount: 4,
							successRate: 72,
							averageTime: 20,
							trend: "stable",
						},
					],
					capabilityVelocity: {
						current: 6,
						points: [],
						totalCapabilities: 40,
						highImpactCount: 20,
						highImpactPercentage: 50,
					},
					lastUpdated: "2026-04-16T00:00:00.000Z",
					iterationsAnalyzed: 12,
				}),
			},
			toolUsageAnalyticsManager: {
				getToolStats: () => [],
			},
		});

		const recommendations = manager.getRecommendations();
		const titles = recommendations.map((item) => item.title);
		const skillRecommendation = recommendations.find(
			(item) => item.title === "Capture reusable lessons from weak-signal skills",
		);
		const errorRecommendation = recommendations.find(
			(item) => item.title === "Turn recurring errors into reusable guardrails",
		);

		expect(titles).toContain("Capture reusable lessons from weak-signal skills");
		expect(titles).toContain("Turn recurring errors into reusable guardrails");
		expect(titles).toContain("Record why recent work was lower impact");
		expect(skillRecommendation?.description).toContain("review-changes (62%)");
		expect(skillRecommendation?.description).not.toContain("plan-architecture (72%)");
		expect(skillRecommendation?.description).not.toContain("-------------");
		expect(errorRecommendation?.description).toContain("recurring lint errors");
		expect(errorRecommendation?.description).not.toContain("lint (fixed)");
	});

	for (const scenario of [
		{
			name: "compact Result schema",
			lines: [
				"# Memory",
				"",
				"## Recent Scorecard",
				"",
				"| Date | Type | Description | Time | Result | Errors | Skills Used |",
				"|------|------|-------------|------|--------|--------|-------------|",
				"| 2026-04-20 | capability | Add MEMORY scorecard fallback guidance | ~15m | ✅ | none | evolve, plan-architecture |",
				"| 2026-04-19 | capability | Fix self-improvement config output | ~10m | ✅ | lint | evolve, review-changes |",
			],
		},
		{
			name: "legacy First Try schema",
			lines: [
				"# Memory",
				"",
				"## Evolution Scorecard",
				"",
				"| Date | Task Type | Task Description | Time | First Try | Errors | Rework? | Impact | Skills Used | Enables |",
				"|------|-----------|------------------|------|-----------|--------|---------|--------|-------------|---------|",
				"| 2026-04-20 | capability | Add MEMORY scorecard fallback guidance | ~15m | ✅ | none | No | High | evolve, plan-architecture | guidance |",
				"| 2026-04-19 | capability | Fix self-improvement config output | ~10m | ✅ | lint | No | Medium | evolve, review-changes | config |",
			],
		},
	]) {
		it(`falls back to shared MEMORY.md scorecard history when live skill signals are sparse (${scenario.name})`, () => {
			const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "optimization-dashboard-"));
			const memoryFile = path.join(tempDir, "MEMORY.md");
			fs.writeFileSync(memoryFile, scenario.lines.join("\n"));

			const manager = new OptimizationDashboardManager({
				memoryFile,
				metricsTracker: {
					getMetrics: () => ({
						successRate: { current: 78, points: [], weeklyAverage: 80, improvement: -2 },
						time: {
							averageMinutes: 20,
							byTaskType: { capability: 20 },
							points: [],
							fastestTask: "Quick fix",
							slowestTask: "Large feature",
						},
						errors: {
							totalErrors: 0,
							byType: {},
							recentErrors: [],
							points: [],
							commonPatterns: [],
						},
						skills: [],
						capabilityVelocity: {
							current: 4,
							points: [],
							totalCapabilities: 20,
							highImpactCount: 0,
							highImpactPercentage: 0,
						},
						lastUpdated: "2026-04-20T00:00:00.000Z",
						iterationsAnalyzed: 2,
					}),
				},
				toolUsageAnalyticsManager: {
					getToolStats: () => [],
				},
			});

			const health = manager.getHealth();
			const recommendations = manager.getRecommendations();
			const titles = recommendations.map((item) => item.title);

			expect(health.components.memoryQuality).toBeGreaterThan(55);
			expect(titles).toContain("Preserve successful skill combinations in memory");
			expect(titles).toContain("Promote proven memory-backed tasks");
			expect(
				recommendations.find(
					(item) => item.title === "Preserve successful skill combinations in memory",
				)?.description,
			).toContain("evolve");
			expect(
				recommendations.find((item) => item.title === "Promote proven memory-backed tasks")
					?.description,
			).toContain("Add MEMORY scorecard fallback guidance");
			fs.rmSync(tempDir, { recursive: true, force: true });
		});
	}

	it("adds enabler-aware capability recommendations for weak dashboard components", () => {
		vi.spyOn(contextAnalysisModule, "analyzeContextTasks").mockImplementation((candidates) =>
			candidates.map((candidate) => {
				const taskDescription = candidate.taskDescription;
				const topFiles = taskDescription.includes("MEMORY scorecard")
					? ["MEMORY.md", "src/learning-transfer.ts"]
					: taskDescription.includes("self-healing")
						? ["src/error-patterns.ts", "src/self-healing.ts"]
						: ["src/assess.ts", "src/reflection.ts"];
				return {
					taskDescription,
					analysis: {
						taskDescription,
						suggestedFiles: topFiles.map((filePath, index) => ({
							path: filePath,
							relevance: index === 0 ? 0.82 : 0.74,
							reason: "",
							symbols: [],
							category: index === 0 ? "primary" : "secondary",
						})),
						relevantSymbols: [],
						confidence: 0.81,
						reasoning: "",
					},
					primaryFiles: topFiles.map((filePath, index) => ({
						path: filePath,
						relevance: index === 0 ? 0.82 : 0.74,
						reason: "",
						symbols: [],
						category: index === 0 ? "primary" : "secondary",
					})),
					topFiles,
					confidencePercent: 81,
				};
			}),
		);

		const manager = new OptimizationDashboardManager({
			metricsTracker: {
				getMetrics: () => ({
					successRate: { current: 78, points: [], weeklyAverage: 80, improvement: -4 },
					time: {
						averageMinutes: 19,
						byTaskType: { capability: 19 },
						points: [],
						fastestTask: "A",
						slowestTask: "B",
					},
					errors: {
						totalErrors: 5,
						byType: { lint: 3, test: 2 },
						recentErrors: [],
						points: [],
						commonPatterns: ["lint", "test"],
					},
					skills: [
						{
							skill: "review-changes",
							usageCount: 4,
							successRate: 60,
							averageTime: 18,
							trend: "declining",
						},
					],
					capabilityVelocity: {
						current: 5,
						points: [],
						totalCapabilities: 30,
						highImpactCount: 12,
						highImpactPercentage: 40,
					},
					lastUpdated: "2026-04-16T00:00:00.000Z",
					iterationsAnalyzed: 10,
				}),
			},
			toolUsageAnalyticsManager: {
				getToolStats: () => [
					{
						toolName: "read",
						totalUses: 3,
						successfulUses: 2,
						failedUses: 1,
						successRate: 67,
						averageDuration: 100,
						lastUsed: "2026-04-16T00:00:00.000Z",
						actions: {},
						taskTypes: { capability: 3 },
						commonErrors: ["boom"],
					},
				],
			},
		});

		const recommendations = manager.getRecommendations();
		const successEnablerRecommendation = recommendations.find(
			(item) => item.title === "Strengthen self-assessment enablers",
		);
		const memoryEnablerRecommendation = recommendations.find(
			(item) => item.title === "Invest in memory-persistence enablers",
		);

		expect(successEnablerRecommendation?.description).toContain("self-assessment");
		expect(successEnablerRecommendation?.description).toContain("error-recovery");
		expect(successEnablerRecommendation?.description).toContain("Likely starting files");
		expect(successEnablerRecommendation?.description).toContain("src/assess.ts");
		expect(successEnablerRecommendation?.contextEvidence?.command).toContain(
			"context({action: 'analyze'",
		);
		expect(successEnablerRecommendation?.contextEvidence?.taskDescription).toContain("assess tool");
		expect(successEnablerRecommendation?.contextEvidence?.topFiles).toEqual([
			"src/assess.ts",
			"src/reflection.ts",
		]);
		expect(memoryEnablerRecommendation?.description).toContain("memory-persistence");
		expect(memoryEnablerRecommendation?.description).toContain("learning-transfer");
		expect(memoryEnablerRecommendation?.contextEvidence?.confidencePercent).toBe(81);
		expect(memoryEnablerRecommendation?.contextEvidence?.taskDescription).toContain(
			"MEMORY scorecard",
		);
		expect(memoryEnablerRecommendation?.contextEvidence?.topFiles).toEqual([
			"MEMORY.md",
			"src/learning-transfer.ts",
		]);
		const errorRecoveryRecommendation = recommendations.find(
			(item) => item.title === "Expand error-recovery enablers",
		);
		expect(errorRecoveryRecommendation?.contextEvidence?.topFiles).toEqual([
			"src/error-patterns.ts",
			"src/self-healing.ts",
		]);
		expect(recommendations.some((item) => item.title === "Promote tool-discovery enablers")).toBe(
			true,
		);
	});

	it("deduplicates and orders recommendations by priority and effort", () => {
		const manager = new OptimizationDashboardManager({
			metricsTracker: {
				getMetrics: () => ({
					successRate: { current: 60, points: [], weeklyAverage: 62, improvement: -4 },
					time: {
						averageMinutes: 21,
						byTaskType: { capability: 21 },
						points: [],
						fastestTask: "A",
						slowestTask: "B",
					},
					errors: {
						totalErrors: 6,
						byType: { lint: 4, test: 2 },
						recentErrors: [],
						points: [],
						commonPatterns: ["lint", "lint", "test"],
					},
					skills: [
						{
							skill: "review-changes",
							usageCount: 3,
							successRate: 62,
							averageTime: 17,
							trend: "declining",
						},
					],
					capabilityVelocity: {
						current: 5,
						points: [],
						totalCapabilities: 20,
						highImpactCount: 8,
						highImpactPercentage: 40,
					},
					lastUpdated: "2026-04-16T00:00:00.000Z",
					iterationsAnalyzed: 10,
				}),
			},
			toolUsageAnalyticsManager: {
				getToolStats: () => [
					{
						toolName: "rareTool",
						totalUses: 2,
						successfulUses: 1,
						failedUses: 1,
						successRate: 50,
						averageDuration: 70000,
						lastUsed: "2026-04-16T00:00:00.000Z",
						actions: {},
						taskTypes: {},
						commonErrors: ["boom"],
					},
					{
						toolName: "rareTool",
						totalUses: 2,
						successfulUses: 1,
						failedUses: 1,
						successRate: 50,
						averageDuration: 70000,
						lastUsed: "2026-04-16T00:00:00.000Z",
						actions: {},
						taskTypes: {},
						commonErrors: ["boom"],
					},
				],
			},
		});

		const recommendations = manager.getRecommendations();
		const titles = recommendations.map((item) => item.title);

		expect(new Set(titles).size).toBe(titles.length);
		expect(recommendations[0]?.priority).toBe("high");
		expect(titles[0]).toBe("Capture reusable lessons from weak-signal skills");
		expect(titles).toContain("Increase tool utilization");
		expect(titles.filter((title) => title === "Increase tool utilization")).toHaveLength(1);
	});

	it("uses dynamic baseline values when comparing a session", () => {
		const manager = new OptimizationDashboardManager({
			metricsTracker: {
				getMetrics: () => ({
					successRate: { current: 88, points: [], weeklyAverage: 87, improvement: 1 },
					time: {
						averageMinutes: 14,
						byTaskType: {},
						points: [],
						fastestTask: "A",
						slowestTask: "B",
					},
					errors: {
						totalErrors: 3,
						byType: { lint: 3 },
						recentErrors: [],
						points: [],
						commonPatterns: ["lint"],
					},
					skills: [],
					capabilityVelocity: {
						current: 8,
						points: [],
						totalCapabilities: 50,
						highImpactCount: 35,
						highImpactPercentage: 70,
					},
					lastUpdated: "2026-04-16T00:00:00.000Z",
					iterationsAnalyzed: 10,
				}),
			},
			toolUsageAnalyticsManager: {
				getToolStats: () => [
					{
						toolName: "read",
						totalUses: 20,
						successfulUses: 20,
						failedUses: 0,
						successRate: 100,
						averageDuration: 50,
						lastUsed: "2026-04-16T00:00:00.000Z",
						actions: {},
						taskTypes: {},
						commonErrors: [],
					},
					{
						toolName: "edit",
						totalUses: 15,
						successfulUses: 14,
						failedUses: 1,
						successRate: 93,
						averageDuration: 200,
						lastUsed: "2026-04-16T00:00:00.000Z",
						actions: {},
						taskTypes: {},
						commonErrors: [],
					},
				],
			},
		});

		const comparison = manager.compareSession({
			successRate: 92,
			avgTime: 10 * 60 * 1000,
			errorCount: 0,
			capabilitiesUsed: 3,
		});

		expect(comparison.average.successRate).toBe(88);
		expect(comparison.average.avgTime).toBe(14 * 60 * 1000);
		expect(comparison.average.errorCount).toBe(0.3);
		expect(comparison.average.capabilitiesUsed).toBe(2);
		expect(comparison.rating).toBe("above_average");
	});
});
