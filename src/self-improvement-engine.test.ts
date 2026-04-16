import { describe, expect, it, vi } from "vitest";

import * as contextAnalysisModule from "./context-analysis.js";
import { OptimizationDashboardManager } from "./optimization-dashboard.js";
import { SelfImprovementEngine } from "./self-improvement-engine.js";

function createEngine(): SelfImprovementEngine {
	return new SelfImprovementEngine();
}

describe("SelfImprovementEngine", () => {
	it("creates stable suggestion ids and deduplicates repeated matches within a scan", async () => {
		const engine = createEngine();
		const scanFile = vi.spyOn(engine as never, "scanFile" as never).mockReturnValue([
			{
				id: "random-1",
				category: "code-quality",
				priority: "medium",
				title: "Repeated TODO",
				description: "Found unresolved comment that indicates incomplete work",
				filePath: "src/example.ts",
				lineNumber: 5,
				impact: "Improves code-quality",
				effort: "simple",
				confidence: 80,
				source: "code-analysis",
				timestamp: "2026-04-16T00:00:00.000Z",
			},
			{
				id: "random-2",
				category: "code-quality",
				priority: "medium",
				title: "Repeated TODO",
				description: "Found unresolved comment that indicates incomplete work",
				filePath: "src/example.ts",
				lineNumber: 5,
				impact: "Improves code-quality",
				effort: "simple",
				confidence: 80,
				source: "code-analysis",
				timestamp: "2026-04-16T00:00:00.000Z",
			},
		]);
		vi.spyOn(engine as never, "getCapabilityGapSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getUsageAnalyticsSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getCompetitorSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getDashboardSuggestions" as never).mockReturnValue([]);
		const saveData = vi.spyOn(engine as never, "saveData" as never).mockImplementation(() => {});

		const suggestions = await engine.scanCodebase("src");
		const repeated = suggestions.filter((item) => item.title === "Repeated TODO");

		expect(repeated).toHaveLength(1);
		expect(repeated[0].id).toBe("self-improvement-code-analysis-code-quality-medium-src-examp");

		scanFile.mockRestore();
		saveData.mockRestore();
	});

	it("adds optimization dashboard signals as actionable suggestions", async () => {
		const engine = createEngine();
		vi.spyOn(engine as never, "scanCodePatterns" as never).mockResolvedValue([]);
		vi.spyOn(engine as never, "getCapabilityGapSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getUsageAnalyticsSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getCompetitorSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getContextAwareSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "saveData" as never).mockImplementation(() => {});

		const dashboard = new OptimizationDashboardManager({
			metricsTracker: {
				getMetrics: () => ({
					successRate: { current: 78, points: [], weeklyAverage: 80, improvement: -2 },
					time: {
						averageMinutes: 22,
						byTaskType: { capability: 22 },
						points: [],
						fastestTask: "Quick fix",
						slowestTask: "Large feature",
					},
					errors: {
						totalErrors: 6,
						byType: { lint: 4, test: 2 },
						recentErrors: [],
						points: [],
						commonPatterns: ["lint", "test"],
					},
					skills: [],
					capabilityVelocity: {
						current: 5,
						points: [],
						totalCapabilities: 30,
						highImpactCount: 16,
						highImpactPercentage: 53,
					},
					lastUpdated: "2026-04-16T00:00:00.000Z",
					iterationsAnalyzed: 10,
				}),
			},
			toolUsageAnalyticsManager: {
				getToolStats: () => [
					{
						toolName: "assess",
						totalUses: 4,
						successfulUses: 2,
						failedUses: 2,
						successRate: 50,
						averageDuration: 70000,
						lastUsed: "2026-04-16T00:00:00.000Z",
						actions: {},
						taskTypes: { capability: 4 },
						commonErrors: ["timeout"],
					},
				],
			},
		});
		vi.spyOn(engine as never, "getDashboardManager" as never).mockReturnValue(dashboard);

		const suggestions = await engine.scanCodebase("src");
		const titles = suggestions.map((item) => item.title);

		expect(titles).toContain("Improve iteration speed");
		expect(titles).toContain("Reduce recurring errors");
		expect(titles).toContain("Bottleneck: assess");
		expect(titles).toContain("Optimization dashboard health is fair");
		expect(titles).toContain("Turn recurring errors into reusable guardrails");
		expect(
			suggestions.find((item) => item.title === "Turn recurring errors into reusable guardrails")
				?.description,
		).toContain("lint");
	});

	it("adds evidence-based auto-context suggestions from the shared context analysis helper", async () => {
		const engine = createEngine();
		vi.spyOn(engine as never, "scanCodePatterns" as never).mockResolvedValue([]);
		vi.spyOn(engine as never, "getCapabilityGapSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getUsageAnalyticsSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getCompetitorSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getDashboardSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "saveData" as never).mockImplementation(() => {});
		vi.spyOn(contextAnalysisModule, "analyzeContextTasks").mockReturnValue([
			{
				taskDescription:
					"Add a new self-evolution capability tool with tests and tool registration",
				analysis: {
					taskDescription:
						"Add a new self-evolution capability tool with tests and tool registration",
					suggestedFiles: [
						{
							path: "src/tools/index.ts",
							relevance: 0.82,
							reason: "",
							symbols: [],
							category: "primary",
						},
						{
							path: "src/self-improvement-engine.ts",
							relevance: 0.79,
							reason: "",
							symbols: [],
							category: "secondary",
						},
						{
							path: "src/tools/self-improvement-tool.ts",
							relevance: 0.75,
							reason: "",
							symbols: [],
							category: "secondary",
						},
					],
					relevantSymbols: [],
					confidence: 0.78,
					reasoning: "",
				},
				primaryFiles: [
					{
						path: "src/tools/index.ts",
						relevance: 0.82,
						reason: "",
						symbols: [],
						category: "primary",
					},
					{
						path: "src/self-improvement-engine.ts",
						relevance: 0.79,
						reason: "",
						symbols: [],
						category: "secondary",
					},
					{
						path: "src/tools/self-improvement-tool.ts",
						relevance: 0.75,
						reason: "",
						symbols: [],
						category: "secondary",
					},
				],
				topFiles: [
					"src/tools/index.ts",
					"src/self-improvement-engine.ts",
					"src/tools/self-improvement-tool.ts",
				],
				confidencePercent: 78,
			},
		]);

		const suggestions = await engine.scanCodebase("src");
		const suggestion = suggestions.find((item) =>
			item.title.includes("Use auto-context detection"),
		);

		expect(suggestion).toBeDefined();
		expect(suggestion?.description).toContain("src/tools/index.ts");
		expect(suggestion?.suggestedFix).toContain("context({action: 'analyze'");
		expect(suggestion?.impact).toContain("file-target selection");
	});
});
