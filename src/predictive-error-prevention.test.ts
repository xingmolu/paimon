import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PredictiveErrorPreventionManager } from "./predictive-error-prevention.js";

const tempDirs: string[] = [];
const originalHome = process.env.HOME;

function withTemporaryMemory(memoryContent: string, run: () => void): void {
	const memoryPath = path.join(process.cwd(), "MEMORY.md");
	const originalMemory = fs.readFileSync(memoryPath, "utf-8");
	fs.writeFileSync(memoryPath, memoryContent);

	try {
		run();
	} finally {
		fs.writeFileSync(memoryPath, originalMemory);
	}
}

function createManager(): PredictiveErrorPreventionManager {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "predictive-error-prevention-"));
	tempDirs.push(tempDir);

	const homeDir = path.join(tempDir, "home");
	fs.mkdirSync(path.join(homeDir, ".paimon"), { recursive: true });
	process.env.HOME = homeDir;

	return new PredictiveErrorPreventionManager();
}

afterEach(() => {
	process.env.HOME = originalHome;
	for (const dir of tempDirs.splice(0)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

describe("PredictiveErrorPreventionManager MEMORY fallback", () => {
	it("adds MEMORY-backed warnings for recent repeated errors in matching task types", () => {
		withTemporaryMemory(
			"# Memory\n\n## Recent Scorecard\n\n| Date | Type | Description | Time | Result | Errors |\n|------|------|-------------|------|--------|--------|\n| 2026-04-23 | capability | Improve scorecard guidance for capability work | ~12m | ✅ | test |\n| 2026-04-22 | capability | Normalize reasoning memory scorecard fallback | ~10m | ✅ | test |\n| 2026-04-21 | reliability | Fix flaky lint retry loop | ~8m | ✅ | lint |\n",
			() => {
				const manager = createManager();
				manager.updateConfig({ minProbability: 0.1, minConfidence: 0.1 });

				const warnings = manager.getWarnings({
					taskType: "capability",
					taskDescription: "Normalize reasoning memory scorecard fallback",
				});
				const predictions = manager.predict({
					taskType: "capability",
					taskDescription: "Normalize reasoning memory scorecard fallback",
				});

				expect(
					predictions.some(
						(prediction) =>
							prediction.predictedErrorType === "test" &&
							prediction.preventionSuggestions.some((suggestion) =>
								suggestion.includes("Recent MEMORY.md scorecard entries recorded test errors"),
							),
					),
				).toBe(true);
				expect(warnings.length).toBeGreaterThan(0);
				expect(warnings.join("\n")).not.toContain("lint");
			},
		);
	});

	it("preserves built-in pattern predictions while appending MEMORY fallbacks", () => {
		withTemporaryMemory(
			"# Memory\n\n## Recent Scorecard\n\n| Date | Type | Description | Time | Result | Errors |\n|------|------|-------------|------|--------|--------|\n| 2026-04-23 | capability | Improve task guidance | ~12m | ✅ | test |\n| 2026-04-22 | capability | Improve task guidance again | ~10m | ✅ | lint |\n",
			() => {
				const manager = createManager();
				manager.updateConfig({ minProbability: 0.1, minConfidence: 0.1 });

				const predictions = manager.predict({
					taskType: "capability",
					taskDescription: "Improve task guidance",
					files: ["src/example.ts"],
					toolsUsed: ["edit", "bash"],
				});

				expect(predictions.some((prediction) => prediction.source === "pattern")).toBe(true);
				expect(
					predictions.some(
						(prediction) =>
							prediction.source === "pattern" && prediction.predictedErrorType === "typescript",
					),
				).toBe(true);
				expect(
					predictions.some(
						(prediction) =>
							prediction.predictedErrorType === "lint" &&
							prediction.preventionSuggestions.some((suggestion) =>
								suggestion.includes("Recent MEMORY.md scorecard entries recorded lint errors"),
							),
					),
				).toBe(true);
				expect(
					predictions.some(
						(prediction) =>
							prediction.predictedErrorType === "test" &&
							prediction.preventionSuggestions.some((suggestion) =>
								suggestion.includes("Recent MEMORY.md scorecard entries recorded test errors"),
							),
					),
				).toBe(true);
			},
		);
	});

	it("merges MEMORY fallback prevention guidance into existing pattern predictions for the same error type", () => {
		withTemporaryMemory(
			"# Memory\n\n## Recent Scorecard\n\n| Date | Type | Description | Time | Result | Errors |\n|------|------|-------------|------|--------|--------|\n| 2026-04-23 | capability | Improve TypeScript guidance | ~12m | ✅ | TS |\n| 2026-04-22 | capability | Improve imports again | ~10m | ✅ | TS |\n",
			() => {
				const manager = createManager();
				manager.updateConfig({ minProbability: 0.1, minConfidence: 0.1 });

				const predictions = manager.predict({
					taskType: "capability",
					taskDescription: "Improve TypeScript guidance",
					files: ["src/example.ts"],
					toolsUsed: ["edit", "bash"],
				});

				const typeScriptPrediction = predictions.find(
					(prediction) =>
						prediction.source === "pattern" && prediction.predictedErrorType === "typescript",
				);
				expect(typeScriptPrediction).toBeDefined();
				expect(typeScriptPrediction?.preventionSuggestions.join("\n")).toContain(
					"Recent MEMORY.md scorecard entries recorded typescript errors",
				);
			},
		);
	});

	it("treats explicit compact failures as valid MEMORY fallback evidence", () => {
		withTemporaryMemory(
			"# Memory\n\n## Evolution Scorecard\n\n| Date | Task Type | Task Description | Time | Result | First Try | Errors | Rework? | Impact | Skills Used | Enables |\n|------|-----------|------------------|------|--------|-----------|--------|---------|--------|-------------|---------|\n| 2026-04-23 | capability | Improve capability selection guidance | ~12m | ❌ | ✅ | TS/test | Yes | High | evolve | guidance |\n",
			() => {
				const manager = createManager();
				manager.updateConfig({ minProbability: 0.1, minConfidence: 0.1 });

				const predictions = manager.predict({
					taskType: "capability",
					taskDescription: "Improve capability selection guidance",
				});

				expect(
					predictions.some(
						(prediction) =>
							prediction.predictedErrorType === "typescript" &&
							prediction.preventionSuggestions.some((suggestion) =>
								suggestion.includes(
									"Recent MEMORY.md scorecard entries recorded typescript errors",
								),
							),
					),
				).toBe(true);
				expect(
					predictions.some(
						(prediction) =>
							prediction.predictedErrorType === "test" &&
							prediction.preventionSuggestions.some((suggestion) =>
								suggestion.includes("Recent MEMORY.md scorecard entries recorded test errors"),
							),
					),
				).toBe(true);
			},
		);
	});
});
