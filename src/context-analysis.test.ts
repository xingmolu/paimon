import { describe, expect, it, vi } from "vitest";

import {
	type ContextTaskCandidate,
	analyzeContextTasks,
	buildContextAnalyzeCommand,
} from "./context-analysis.js";
import * as contextIdentifierModule from "./context-identifier.js";

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

	it("formats reusable context analyze commands", () => {
		expect(buildContextAnalyzeCommand("Add a new self-evolution capability tool")).toBe(
			"context({action: 'analyze', taskDescription: 'Add a new self-evolution capability tool'})",
		);
	});
});
