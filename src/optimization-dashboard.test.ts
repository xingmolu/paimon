import { describe, expect, it } from "vitest";

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
		expect(health.components.memoryQuality).toBeGreaterThan(80);
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
