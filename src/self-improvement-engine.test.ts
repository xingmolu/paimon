import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it, vi } from "vitest";

import * as contextAnalysisModule from "./context-analysis.js";
import { OptimizationDashboardManager } from "./optimization-dashboard.js";
import type { ImprovementSuggestion } from "./self-improvement-engine.js";
import { SelfImprovementEngine } from "./self-improvement-engine.js";

function createEngine(): SelfImprovementEngine {
	const engine = new SelfImprovementEngine();
	(engine as unknown as { suggestions: Map<string, unknown> }).suggestions.clear();
	(engine as unknown as { dismissedIds: Set<string> }).dismissedIds.clear();
	(engine as unknown as { stats: { lastScanTime: string } }).stats.lastScanTime = "";
	return engine;
}

describe("SelfImprovementEngine", () => {
	it("refreshes suggestions when cache is empty", async () => {
		const engine = createEngine();
		const expectedSuggestion: ImprovementSuggestion = {
			id: "fresh-suggestion",
			category: "capability",
			priority: "high",
			title: "Fresh suggestion",
			description: "Generated from a refresh scan",
			impact: "Improves task selection freshness",
			effort: "simple",
			confidence: 90,
			source: "best-practice",
			timestamp: "2026-05-19T00:00:00.000Z",
		};
		const scanSpy = vi.spyOn(engine, "scanCodebase").mockImplementation(async () => {
			(
				engine as unknown as { suggestions: Map<string, typeof expectedSuggestion> }
			).suggestions.set(expectedSuggestion.id, expectedSuggestion);
			(engine as unknown as { stats: { lastScanTime: string } }).stats.lastScanTime =
				new Date().toISOString();
			return [expectedSuggestion];
		});

		const suggestions = await engine.getSuggestionsWithRefresh();

		expect(scanSpy).toHaveBeenCalledOnce();
		expect(suggestions.map((item) => item.id)).toContain(expectedSuggestion.id);
	});

	it("does not refresh suggestions when cache is recent and populated", async () => {
		const engine = createEngine();
		const cachedSuggestion = {
			id: "cached-suggestion",
			category: "capability",
			priority: "medium",
			title: "Cached suggestion",
			description: "Already available",
			impact: "Avoids redundant rescans",
			effort: "simple",
			confidence: 85,
			source: "best-practice",
			timestamp: "2026-05-19T00:00:00.000Z",
		} as const;
		(engine as unknown as { suggestions: Map<string, typeof cachedSuggestion> }).suggestions.set(
			cachedSuggestion.id,
			cachedSuggestion,
		);
		(engine as unknown as { stats: { lastScanTime: string } }).stats.lastScanTime =
			new Date().toISOString();
		const scanSpy = vi.spyOn(engine, "scanCodebase").mockResolvedValue([cachedSuggestion]);

		const suggestions = await engine.getSuggestionsWithRefresh();

		expect(scanSpy).not.toHaveBeenCalled();
		expect(suggestions.map((item) => item.id)).toContain(cachedSuggestion.id);
	});

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
		expect(titles).not.toContain("Reduce recurring errors");
		expect(titles).toContain("Bottleneck: assess");
		expect(titles).not.toContain("Optimization dashboard health is fair");
		expect(titles).toContain("Turn recurring errors into reusable guardrails");
		expect(titles).toContain("Expand error-recovery enablers");
		expect(
			suggestions.find((item) => item.title === "Turn recurring errors into reusable guardrails")
				?.description,
		).toContain("lint");
	});

	it("surfaces memory-backed dashboard recommendations through self-improvement suggestions", async () => {
		const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "self-improvement-memory-"));
		const memoryFile = path.join(tempDir, "MEMORY.md");
		fs.writeFileSync(
			memoryFile,
			[
				"# Memory",
				"",
				"## Recent Scorecard",
				"",
				"| Date | Type | Description | Time | Result | Errors | Skills Used |",
				"|------|------|-------------|------|--------|--------|-------------|",
				"| 2026-04-20 | capability | Add MEMORY scorecard fallback guidance | ~15m | ✅ | none | evolve, plan-architecture |",
				"| 2026-04-19 | capability | Fix self-improvement config output | ~10m | ✅ | lint | evolve, review-changes |",
			].join("\n"),
		);

		const engine = createEngine();
		vi.spyOn(engine as never, "scanCodePatterns" as never).mockResolvedValue([]);
		vi.spyOn(engine as never, "getCapabilityGapSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getUsageAnalyticsSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getCompetitorSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getContextAwareSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "saveData" as never).mockImplementation(() => {});

		const dashboard = new OptimizationDashboardManager({
			memoryFile,
			metricsTracker: {
				getMetrics: () => ({
					successRate: { current: 76, points: [], weeklyAverage: 78, improvement: -2 },
					time: {
						averageMinutes: 19,
						byTaskType: { capability: 19 },
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
		vi.spyOn(engine as never, "getDashboardManager" as never).mockReturnValue(dashboard);

		const suggestions = await engine.scanCodebase("src");
		const titles = suggestions.map((item) => item.title);

		expect(titles).toContain("Preserve successful skill combinations in memory");
		expect(
			suggestions.some((item) => item.title === "Preserve successful skill combinations in memory"),
		).toBe(true);
		fs.rmSync(tempDir, { recursive: true, force: true });
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

	it("filters low-signal code-analysis suggestions from tests, generated outputs, and internal detector files", async () => {
		const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "self-improvement-engine-"));
		const srcDir = path.join(tempRoot, "src");
		const distDir = path.join(tempRoot, "dist");
		const toolsDir = path.join(srcDir, "tools");
		fs.mkdirSync(srcDir, { recursive: true });
		fs.mkdirSync(distDir, { recursive: true });
		fs.mkdirSync(toolsDir, { recursive: true });
		fs.writeFileSync(path.join(srcDir, "example.test.ts"), "eval('danger')\n");
		fs.writeFileSync(path.join(distDir, "generated.ts"), "eval('danger')\n");
		fs.writeFileSync(path.join(srcDir, "security-guidance.ts"), "eval('danger')\n");
		fs.writeFileSync(path.join(toolsDir, "assess-tool.ts"), "new Function('danger')\n");
		fs.writeFileSync(path.join(srcDir, "production.ts"), "eval('danger')\n");

		const engine = createEngine();
		vi.spyOn(engine as never, "getCapabilityGapSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getUsageAnalyticsSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getCompetitorSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getContextAwareSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getDashboardSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "saveData" as never).mockImplementation(() => {});

		const suggestions = await engine.scanCodebase(tempRoot);
		const filePaths = suggestions.map((item) => item.filePath);

		expect(filePaths).toContain("src/production.ts");
		expect(filePaths).not.toContain("src/example.test.ts");
		expect(filePaths).not.toContain("dist/generated.ts");
		expect(filePaths).not.toContain("src/security-guidance.ts");
		expect(filePaths).not.toContain("src/tools/assess-tool.ts");
	});

	it("filters duplicate competitor suggestions for capabilities that already exist", async () => {
		const engine = createEngine();
		vi.spyOn(engine as never, "scanCodePatterns" as never).mockResolvedValue([]);
		vi.spyOn(engine as never, "getCapabilityGapSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getUsageAnalyticsSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getContextAwareSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getDashboardSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "saveData" as never).mockImplementation(() => {});

		const suggestions = await engine.scanCodebase("src");
		const titles = suggestions.map((item) => item.title);

		expect(titles).not.toContain("Auto-context detection");
		expect(titles).not.toContain("Parallel file analysis");
		expect(titles).not.toContain("Code generation templates");
	});

	it("suppresses generic optimization-health suggestions when specific actionable best-practice alternatives already exist", async () => {
		const engine = createEngine();
		vi.spyOn(engine as never, "scanCodePatterns" as never).mockResolvedValue([]);
		vi.spyOn(engine as never, "getCapabilityGapSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getUsageAnalyticsSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getCompetitorSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getContextAwareSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "saveData" as never).mockImplementation(() => {});
		vi.spyOn(engine as never, "getDashboardManager" as never).mockReturnValue({
			getHealth: () => ({
				status: "fair",
				overallScore: 66,
				components: {
					successRate: 83,
					timeEfficiency: 74,
					errorRate: 78,
					capabilityUtilization: 63,
					memoryQuality: 52,
				},
			}),
			identifyBottlenecks: () => [],
			getRecommendations: () => [
				{
					priority: "high",
					category: "capability",
					title: "Optimization dashboard health is fair",
					description:
						"Live evolution health is 66/100. Prioritize improvements that address the weakest dashboard signals.",
					expectedImpact: "Improves task prioritization with real evolution health signals",
					effort: "simple",
				},
				{
					priority: "high",
					category: "capability",
					title: "Expand error-recovery enablers",
					description:
						"Error pressure is elevated. Prioritize capabilities that turn recurring failures into faster recovery and prevention loops. Recommended enablers: error-recovery, self-healing, and error-patterns. Likely starting files (100% context confidence): src/error-patterns.test.ts, src/error-patterns.ts, src/tools/error-patterns-tool.ts.",
					expectedImpact: "Lower rework and more resilient evolution sessions",
					effort: "simple",
				},
			],
		});

		const suggestions = await engine.scanCodebase("src");
		const titles = suggestions.map((item) => item.title);

		expect(titles).not.toContain("Optimization dashboard health is fair");
		expect(titles).toContain("Expand error-recovery enablers");
	});

	it("suppresses generic recurring-error suggestions when specific actionable error-recovery guidance already exists", async () => {
		const engine = createEngine();
		vi.spyOn(engine as never, "scanCodePatterns" as never).mockResolvedValue([]);
		vi.spyOn(engine as never, "getCapabilityGapSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getUsageAnalyticsSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getCompetitorSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getContextAwareSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "saveData" as never).mockImplementation(() => {});
		vi.spyOn(engine as never, "getDashboardManager" as never).mockReturnValue({
			getHealth: () => ({
				status: "fair",
				overallScore: 67,
				components: {
					successRate: 82,
					timeEfficiency: 73,
					errorRate: 78,
					capabilityUtilization: 61,
					memoryQuality: 55,
				},
			}),
			identifyBottlenecks: () => [],
			getRecommendations: () => [
				{
					priority: "high",
					category: "reliability",
					title: "Reduce recurring errors",
					description: "Recent common errors: test.",
					expectedImpact: "Higher first-try success rate and less rework",
					effort: "moderate",
				},
				{
					priority: "high",
					category: "capability",
					title: "Expand error-recovery enablers",
					description:
						"Error pressure is elevated. Prioritize capabilities that turn recurring failures into faster recovery and prevention loops. Recommended enablers: error-recovery, self-healing, and error-patterns. Likely starting files (100% context confidence): src/error-patterns.ts, src/tools/error-patterns-tool.ts.",
					expectedImpact: "Lower rework and more resilient evolution sessions",
					effort: "simple",
				},
				{
					priority: "medium",
					category: "memory",
					title: "Turn recurring errors into reusable guardrails",
					description:
						"Recent iterations still show recurring test errors. Capture a prevention checklist and preferred recovery steps so future sessions can avoid re-learning the same fix.",
					expectedImpact: "Stronger cross-session transfer and fewer repeated recovery loops",
					effort: "simple",
				},
			],
		});

		const suggestions = await engine.scanCodebase("src");
		const titles = suggestions.map((item) => item.title);

		expect(titles).not.toContain("Reduce recurring errors");
		expect(titles).toContain("Expand error-recovery enablers");
		expect(titles).toContain("Turn recurring errors into reusable guardrails");
	});

	it("suppresses generic recurring-error suggestions when MEMORY-backed test guardrail evidence is concrete", async () => {
		const engine = createEngine();
		vi.spyOn(engine as never, "scanCodePatterns" as never).mockResolvedValue([]);
		vi.spyOn(engine as never, "getCapabilityGapSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getUsageAnalyticsSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getCompetitorSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getContextAwareSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "saveData" as never).mockImplementation(() => {});
		vi.spyOn(engine as never, "getDashboardManager" as never).mockReturnValue({
			getHealth: () => ({
				status: "fair",
				overallScore: 64,
				components: {
					successRate: 80,
					timeEfficiency: 72,
					errorRate: 70,
					capabilityUtilization: 61,
					memoryQuality: 55,
				},
			}),
			identifyBottlenecks: () => [],
			getRecommendations: () => [
				{
					priority: "high",
					category: "reliability",
					title: "Reduce recurring errors",
					description: "Recent common errors: test.",
					expectedImpact: "Higher first-try success rate and less rework",
					effort: "moderate",
				},
				{
					priority: "high",
					category: "memory",
					title: "Turn recurring errors into reusable guardrails",
					description:
						"Recent iterations still show recurring test errors. Capture a prevention checklist and preferred recovery steps so future sessions can avoid re-learning the same fix.",
					expectedImpact: "Stronger cross-session transfer and fewer repeated recovery loops",
					effort: "simple",
				},
			],
		});

		const suggestions = await engine.scanCodebase("src");
		const titles = suggestions.map((item) => item.title);

		expect(titles).not.toContain("Reduce recurring errors");
		expect(titles).toContain("Turn recurring errors into reusable guardrails");
	});

	it("suppresses best-practice suggestions that are already satisfied by current health", async () => {
		const engine = createEngine();
		vi.spyOn(engine as never, "scanCodePatterns" as never).mockResolvedValue([]);
		vi.spyOn(engine as never, "getCapabilityGapSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getUsageAnalyticsSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getCompetitorSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getContextAwareSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "saveData" as never).mockImplementation(() => {});
		vi.spyOn(engine as never, "getDashboardManager" as never).mockReturnValue({
			getHealth: () => ({
				status: "good",
				overallScore: 91,
				components: {
					successRate: 95,
					timeEfficiency: 81,
					errorRate: 92,
					capabilityUtilization: 72,
					memoryQuality: 88,
				},
			}),
			identifyBottlenecks: () => [],
			getRecommendations: () => [
				{
					priority: "critical",
					category: "capability",
					title: "Optimization dashboard health is poor",
					description: "This should be hidden when health is already good.",
					expectedImpact: "n/a",
					effort: "simple",
				},
				{
					priority: "high",
					category: "capability",
					title: "Strengthen self-assessment enablers",
					description: "This should be hidden when success rate is already strong.",
					expectedImpact: "n/a",
					effort: "simple",
				},
				{
					priority: "medium",
					category: "memory",
					title: "Preserve successful skill combinations in memory",
					description:
						"This should remain because it is not directly satisfied by health thresholds.",
					expectedImpact: "n/a",
					effort: "simple",
				},
			],
		});

		const suggestions = await engine.scanCodebase("src");
		const titles = suggestions.map((item) => item.title);

		expect(titles).not.toContain("Optimization dashboard health is poor");
		expect(titles).not.toContain("Strengthen self-assessment enablers");
		expect(titles).toContain("Preserve successful skill combinations in memory");
	});

	it("suppresses low-signal generic memory dashboard fallbacks without actionable evidence", async () => {
		const engine = createEngine();
		vi.spyOn(engine as never, "scanCodePatterns" as never).mockResolvedValue([]);
		vi.spyOn(engine as never, "getCapabilityGapSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getUsageAnalyticsSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getCompetitorSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getContextAwareSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "saveData" as never).mockImplementation(() => {});
		const dashboard = {
			getHealth: () => ({
				status: "fair",
				overallScore: 61,
				components: {
					successRate: 82,
					timeEfficiency: 74,
					errorRate: 88,
					capabilityUtilization: 63,
					memoryQuality: 45,
				},
			}),
			identifyBottlenecks: () => [],
			getRecommendations: () => [
				{
					priority: "medium",
					category: "memory",
					title: "Strengthen learning capture",
					description:
						"Recent iteration history suggests memory quality or impact capture can improve.",
					expectedImpact: "Better task selection and stronger cross-session transfer",
					effort: "simple",
				},
			],
		};
		vi.spyOn(engine as never, "getDashboardManager" as never).mockReturnValue(dashboard);
		vi.spyOn(engine as never, "safeGetDashboardHealth" as never).mockReturnValue(
			dashboard.getHealth(),
		);

		const suggestions = await engine.scanCodebase("src");
		const fallbackSuggestions = suggestions.filter(
			(item) =>
				item.title === "Strengthen learning capture" &&
				item.description ===
					"Recent iteration history suggests memory quality or impact capture can improve.",
		);

		expect(fallbackSuggestions).toHaveLength(0);
	});

	it("suppresses weak-signal skill suggestions when they lack actionable evidence", async () => {
		const engine = createEngine();
		vi.spyOn(engine as never, "scanCodePatterns" as never).mockResolvedValue([]);
		vi.spyOn(engine as never, "getCapabilityGapSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getUsageAnalyticsSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getCompetitorSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getContextAwareSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "saveData" as never).mockImplementation(() => {});
		vi.spyOn(engine as never, "getDashboardManager" as never).mockReturnValue({
			getHealth: () => ({
				status: "fair",
				overallScore: 58,
				components: {
					successRate: 80,
					timeEfficiency: 73,
					errorRate: 84,
					capabilityUtilization: 60,
					memoryQuality: 52,
				},
			}),
			identifyBottlenecks: () => [],
			getRecommendations: () => [
				{
					priority: "high",
					category: "memory",
					title: "Capture reusable lessons from weak-signal skills",
					description: "Recent skill effectiveness suggests improvement opportunities exist.",
					expectedImpact: "Better task selection and stronger cross-session transfer",
					effort: "simple",
				},
			],
		});

		const suggestions = await engine.scanCodebase("src");

		expect(
			suggestions.some((item) => item.title === "Capture reusable lessons from weak-signal skills"),
		).toBe(false);
	});

	it("keeps weak-signal skill suggestions when they include actionable evidence", async () => {
		const engine = createEngine();
		vi.spyOn(engine as never, "scanCodePatterns" as never).mockResolvedValue([]);
		vi.spyOn(engine as never, "getCapabilityGapSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getUsageAnalyticsSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getCompetitorSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getContextAwareSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "saveData" as never).mockImplementation(() => {});
		vi.spyOn(engine as never, "getDashboardManager" as never).mockReturnValue({
			getHealth: () => ({
				status: "fair",
				overallScore: 58,
				components: {
					successRate: 80,
					timeEfficiency: 73,
					errorRate: 84,
					capabilityUtilization: 60,
					memoryQuality: 52,
				},
			}),
			identifyBottlenecks: () => [],
			getRecommendations: () => [
				{
					priority: "high",
					category: "memory",
					title: "Capture reusable lessons from weak-signal skills",
					description:
						"Recent skill effectiveness suggests weaker learning capture around systematic-debugging (0%). Record what worked, what failed, and when to invoke these skills in MEMORY.md.",
					expectedImpact:
						"Improves future skill selection and reduces repeated exploratory mistakes",
					effort: "simple",
				},
			],
		});

		const suggestions = await engine.scanCodebase("src");
		const retainedSuggestion = suggestions.find(
			(item) => item.title === "Capture reusable lessons from weak-signal skills",
		);

		expect(retainedSuggestion).toBeDefined();
		expect(retainedSuggestion?.description).toContain("systematic-debugging");
	});

	it("suppresses memory-only dashboard recommendations when memory health is already strong", async () => {
		const engine = createEngine();
		vi.spyOn(engine as never, "scanCodePatterns" as never).mockResolvedValue([]);
		vi.spyOn(engine as never, "getCapabilityGapSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getUsageAnalyticsSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getCompetitorSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getContextAwareSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "saveData" as never).mockImplementation(() => {});
		vi.spyOn(engine as never, "getDashboardManager" as never).mockReturnValue({
			getHealth: () => ({
				status: "good",
				overallScore: 92,
				components: {
					successRate: 95,
					timeEfficiency: 81,
					errorRate: 91,
					capabilityUtilization: 72,
					memoryQuality: 88,
				},
			}),
			identifyBottlenecks: () => [],
			getRecommendations: () => [
				{
					priority: "high",
					category: "memory",
					title: "Capture reusable lessons from weak-signal skills",
					description: "This should be hidden when memory quality is already strong.",
					expectedImpact: "n/a",
					effort: "simple",
				},
				{
					priority: "medium",
					category: "memory",
					title: "Turn recurring errors into reusable guardrails",
					description: "This should also be hidden when memory quality is already strong.",
					expectedImpact: "n/a",
					effort: "simple",
				},
			],
		});

		const suggestions = await engine.scanCodebase("src");
		const titles = suggestions.map((item) => item.title);

		expect(titles).not.toContain("Capture reusable lessons from weak-signal skills");
		expect(titles).not.toContain("Turn recurring errors into reusable guardrails");
	});

	it("suppresses generic memory bottlenecks when concrete recent-success evidence already exists", async () => {
		const engine = createEngine();
		vi.spyOn(engine as never, "scanCodePatterns" as never).mockResolvedValue([]);
		vi.spyOn(engine as never, "getCapabilityGapSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getUsageAnalyticsSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getCompetitorSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getContextAwareSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "saveData" as never).mockImplementation(() => {});
		vi.spyOn(engine as never, "getDashboardManager" as never).mockReturnValue({
			getHealth: () => ({
				status: "fair",
				overallScore: 67,
				components: {
					successRate: 83,
					timeEfficiency: 75,
					errorRate: 86,
					capabilityUtilization: 62,
					memoryQuality: 58,
				},
			}),
			identifyBottlenecks: () => [
				{
					type: "memory-issues",
					name: "memory-quality",
					description: "Recent iterations are producing fewer high-impact capabilities than usual",
					suggestion:
						"Prefer higher-leverage capability work and capture stronger learnings in MEMORY.md.",
					impact: 72,
				},
			],
			getRecommendations: () => [
				{
					priority: "medium",
					category: "memory",
					title: "Promote proven memory-backed tasks",
					description:
						"Recent successful iterations include Auto-refresh self-improvement suggestions when cached results are empty or stale; Suppress weak-signal skill-learning suggestions unless backed by actionable evidence. Use these concrete wins to guide future task selection and keep new work aligned with demonstrated high-signal improvements.",
					expectedImpact: "More evidence-based task selection from existing MEMORY.md history",
					effort: "simple",
				},
			],
		});

		const suggestions = await engine.scanCodebase("src");
		const titles = suggestions.map((item) => item.title);

		expect(titles).toContain("Promote proven memory-backed tasks");
		expect(titles).not.toContain("Bottleneck: memory-quality");
	});

	it("suppresses redundant implemented enabler suggestions without contextual file evidence", async () => {
		const engine = createEngine();
		vi.spyOn(engine as never, "scanCodePatterns" as never).mockResolvedValue([]);
		vi.spyOn(engine as never, "getCapabilityGapSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getUsageAnalyticsSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getCompetitorSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "getContextAwareSuggestions" as never).mockReturnValue([]);
		vi.spyOn(engine as never, "saveData" as never).mockImplementation(() => {});
		vi.spyOn(engine as never, "getDashboardManager" as never).mockReturnValue({
			getHealth: () => ({
				status: "fair",
				overallScore: 63,
				components: {
					successRate: 82,
					timeEfficiency: 72,
					errorRate: 78,
					capabilityUtilization: 55,
					memoryQuality: 62,
				},
			}),
			identifyBottlenecks: () => [],
			getRecommendations: () => [
				{
					priority: "high",
					category: "capability",
					title: "Invest in memory-persistence enablers",
					description:
						"Memory-quality signals are weak. Prioritize enablers that improve capture, retrieval, and transfer of lessons across sessions. Recommended enablers: memory-persistence, rag, and learning-transfer.",
					expectedImpact: "n/a",
					effort: "simple",
				},
				{
					priority: "high",
					category: "capability",
					title: "Expand error-recovery enablers",
					description:
						"Error pressure is elevated. Prioritize capabilities that turn recurring failures into faster recovery and prevention loops. Recommended enablers: error-recovery, self-healing, and error-patterns.",
					expectedImpact: "n/a",
					effort: "simple",
				},
				{
					priority: "high",
					category: "capability",
					title: "Strengthen self-assessment enablers",
					description:
						"Success rate is below target. Invest in capabilities that strengthen pre-merge verification and error recovery loops before adding more surface area. Recommended enablers: self-assessment, error-recovery, and reflection.",
					expectedImpact: "n/a",
					effort: "simple",
				},
				{
					priority: "high",
					category: "capability",
					title: "Keep actionable evidence-backed enabler guidance",
					description:
						"Use contextual evidence when recommending next work. Recommended enablers: memory-persistence, rag, and learning-transfer. Likely starting files (81% context confidence): MEMORY.md, src/learning-transfer.ts.",
					expectedImpact: "n/a",
					effort: "simple",
				},
			],
		});

		const suggestions = await engine.scanCodebase("src");
		const titles = suggestions.map((item) => item.title);

		expect(titles).not.toContain("Invest in memory-persistence enablers");
		expect(titles).not.toContain("Expand error-recovery enablers");
		expect(titles).not.toContain("Strengthen self-assessment enablers");
		expect(titles).toContain("Keep actionable evidence-backed enabler guidance");
	});
});
