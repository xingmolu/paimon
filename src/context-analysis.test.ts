import { describe, expect, it, vi } from "vitest";

import {
	type ContextTaskCandidate,
	analyzeContextTasks,
	buildContextAnalyzeCommand,
	formatContextAnalysis,
	formatRelatedFileSuggestions,
	groupFileSuggestions,
} from "./context-analysis.js";
import * as contextIdentifierModule from "./context-identifier.js";
import { executeContextIdentifierTool } from "./tools/context-identifier-tool.js";

describe("context-analysis helpers", () => {
	it("sorts context task insights by confidence and keeps top actionable files", () => {
		const analyze = vi.fn((taskDescription: string) => {
			if (taskDescription.includes("capability")) {
				return {
					taskDescription,
					suggestedFiles: [
						{
							path: "src/tools/index.ts",
							relevance: 0.91,
							reason: "",
							symbols: [],
							category: "primary",
						},
						{
							path: "src/tools/new-tool.ts",
							relevance: 0.84,
							reason: "",
							symbols: [],
							category: "secondary",
						},
						{ path: "README.md", relevance: 0.5, reason: "", symbols: [], category: "reference" },
					],
					relevantSymbols: [],
					confidence: 0.82,
					reasoning: "",
				};
			}

			return {
				taskDescription,
				suggestedFiles: [
					{
						path: "src/self-improvement-engine.ts",
						relevance: 0.7,
						reason: "",
						symbols: [],
						category: "primary",
					},
				],
				relevantSymbols: [],
				confidence: 0.55,
				reasoning: "",
			};
		});

		vi.spyOn(contextIdentifierModule, "getContextIdentifierManager").mockReturnValue({
			analyze,
		} as unknown as contextIdentifierModule.ContextIdentifierManager);

		const candidates: ContextTaskCandidate[] = [
			{
				taskDescription:
					"Improve reliability of a failing evolution tool by updating implementation and tests",
				minimumConfidence: 0.45,
				maxFiles: 2,
			},
			{
				taskDescription:
					"Add a new self-evolution capability tool with tests and tool registration",
				minimumConfidence: 0.45,
				maxFiles: 2,
			},
		];

		const insights = analyzeContextTasks(candidates);

		expect(insights).toHaveLength(2);
		expect(insights[0]?.taskDescription).toContain("capability tool");
		expect(insights[0]?.topFiles).toEqual(["src/tools/index.ts", "src/tools/new-tool.ts"]);
		expect(insights[0]?.confidencePercent).toBe(82);
		expect(insights[1]?.topFiles).toEqual(["src/self-improvement-engine.ts"]);
	});

	it("filters out low-confidence or empty analyses", () => {
		vi.spyOn(contextIdentifierModule, "getContextIdentifierManager").mockReturnValue({
			analyze: vi.fn(() => ({
				taskDescription: "task",
				suggestedFiles: [],
				relevantSymbols: [],
				confidence: 0.2,
				reasoning: "",
			})),
		} as unknown as contextIdentifierModule.ContextIdentifierManager);

		const insights = analyzeContextTasks([
			{ taskDescription: "Refactor context system", minimumConfidence: 0.45 },
		]);

		expect(insights).toEqual([]);
	});

	it("groups and formats context analysis output for shared reuse", () => {
		const analysis = {
			taskDescription: "Improve context tool output reuse",
			suggestedFiles: [
				{
					path: "src/context-analysis.ts",
					relevance: 0.88,
					reason: "Matches shared context helper",
					symbols: ["formatContextAnalysis", "groupFileSuggestions"],
					category: "primary" as const,
				},
				{
					path: "src/tools/context-identifier-tool.ts",
					relevance: 0.61,
					reason: "Tool formatting consumer",
					symbols: ["executeContextIdentifierTool"],
					category: "secondary" as const,
				},
				{
					path: "README.md",
					relevance: 0.33,
					reason: "Reference docs",
					symbols: [],
					category: "reference" as const,
				},
			],
			relevantSymbols: [],
			confidence: 0.76,
			reasoning: "High confidence shared helper refactor candidate.",
		};

		const grouped = groupFileSuggestions(analysis.suggestedFiles);
		expect(grouped.primary).toHaveLength(1);
		expect(grouped.secondary).toHaveLength(1);
		expect(grouped.reference).toHaveLength(1);

		const formatted = formatContextAnalysis(analysis);
		expect(formatted).toContain("## Context Analysis Results");
		expect(formatted).toContain("**Primary Files (highly relevant):**");
		expect(formatted).toContain("src/context-analysis.ts");
		expect(formatted).toContain("Reason: Matches shared context helper");
		expect(formatted).toContain("**Secondary Files (moderately relevant):**");
		expect(formatted).toContain("**Reference Files (may be useful):**");
		expect(formatted).toContain("### Reasoning");
	});

	it("formats related file suggestions and empty states", () => {
		expect(formatRelatedFileSuggestions([])).toBe("No related files found.");
		expect(
			formatRelatedFileSuggestions([
				{
					path: "src/context-identifier.ts",
					relevance: 0.5,
					reason: "",
					symbols: ["ContextAnalysis"],
					category: "secondary",
				},
			]),
		).toContain("Shared symbols: ContextAnalysis");
	});

	it("formats reusable context analyze commands", () => {
		expect(buildContextAnalyzeCommand("Add a new self-evolution capability tool")).toBe(
			"context({action: 'analyze', taskDescription: 'Add a new self-evolution capability tool'})",
		);
	});

	it("respects config flags when ranking tests and config files", () => {
		const manager = new contextIdentifierModule.ContextIdentifierManager();
		manager.updateConfig({ includeTests: false, includeConfigs: false });

		const disabledTestScore = (
			manager as unknown as {
				calculateRelevance: (filePath: string, keywords: string[], taskTypes: string[]) => number;
			}
		).calculateRelevance("src/context-identifier.test.ts", ["context", "identifier"], []);
		const disabledConfigScore = (
			manager as unknown as {
				calculateRelevance: (filePath: string, keywords: string[], taskTypes: string[]) => number;
			}
		).calculateRelevance("package.json", ["package", "config"], []);

		manager.updateConfig({ includeTests: true, includeConfigs: true });
		const enabledTestScore = (
			manager as unknown as {
				calculateRelevance: (filePath: string, keywords: string[], taskTypes: string[]) => number;
			}
		).calculateRelevance("src/context-identifier.test.ts", ["context", "identifier"], []);
		const enabledConfigScore = (
			manager as unknown as {
				calculateRelevance: (filePath: string, keywords: string[], taskTypes: string[]) => number;
			}
		).calculateRelevance("package.json", ["package", "config"], []);

		expect(enabledTestScore).toBeGreaterThan(disabledTestScore);
		expect(enabledConfigScore).toBeGreaterThan(disabledConfigScore);
	});

	it("supports context tool action aliases for compatibility", async () => {
		vi.spyOn(contextIdentifierModule, "getContextIdentifierManager").mockReturnValue({
			suggestForFile: vi.fn(() => [
				{
					path: "src/context-identifier.ts",
					relevance: 0.8,
					reason: "",
					symbols: ["ContextIdentifierManager"],
					category: "secondary",
				},
			]),
			getRelatedFiles: vi.fn(() => ["src/context-analysis.ts"]),
			extractSymbols: vi.fn(() => [
				{
					name: "ContextIdentifierManager",
					type: "class",
					file: "src/context-identifier.ts",
					line: 10,
				},
			]),
		} as unknown as contextIdentifierModule.ContextIdentifierManager);

		const getResult = await executeContextIdentifierTool("tool-1", {
			action: "get",
			filePath: "src/context-analysis.ts",
		});
		const listResult = await executeContextIdentifierTool("tool-2", {
			action: "list",
			filePath: "src/context-identifier.ts",
		});
		const formatResult = await executeContextIdentifierTool("tool-3", {
			action: "format",
			filePath: "src/context-identifier.ts",
		});

		expect(getResult).toContain("## Related Files");
		expect(listResult).toContain("## Related Files for src/context-identifier.ts");
		expect(formatResult).toContain("## Symbols in src/context-identifier.ts");
	});
});
