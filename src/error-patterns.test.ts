import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ErrorPatternLearner } from "./error-patterns.js";

const memoryPath = path.join(process.cwd(), "MEMORY.md");

describe("ErrorPatternLearner memory fallback", () => {
	let originalMemory: string | null = null;
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-error-patterns-"));
		originalMemory = existsSync(memoryPath) ? readFileSync(memoryPath, "utf-8") : null;
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
		if (typeof originalMemory === "string") {
			writeFileSync(memoryPath, originalMemory);
		} else if (existsSync(memoryPath)) {
			unlinkSync(memoryPath);
		}
	});

	it("returns enriched MEMORY-backed suggestions when regex patterns do not match", () => {
		writeFileSync(
			memoryPath,
			[
				"# Memory",
				"",
				"## Recent Scorecard",
				"",
				"| Date | Type | Description | Time | Result | Errors | Skills Used |",
				"|------|------|-------------|------|--------|--------|-------------|",
				"| 2026-05-12 | capability | Recover from failing regression snapshot update | ~20m | ❌ | test | systematic-debugging |",
				"| 2026-05-11 | capability | Fix timeout-heavy regression suite with rework | ~15m | ✅ | test | evolve, review-changes |",
			].join("\n"),
		);

		const learner = new ErrorPatternLearner(tempDir);
		const suggestions = learner.getSuggestions(
			"Received output did not match expected golden file",
			3,
		);

		expect(suggestions.length).toBeGreaterThan(0);
		expect(suggestions[0]?.source).toBe("memory");
		expect(suggestions[0]?.suggestion).toContain("Recent MEMORY.md failure on 2026-05-12");
		expect(suggestions[0]?.suggestion).toContain("remained unresolved");
		expect(suggestions[1]?.suggestion).toContain("recovered");
		expect(suggestions[1]?.suggestion).toContain("Skills used: evolve, review-changes.");
	});

	it("deduplicates repeated MEMORY fallback descriptions", () => {
		writeFileSync(
			memoryPath,
			[
				"# Memory",
				"",
				"## Recent Scorecard",
				"",
				"| Date | Type | Description | Time | Result | Errors | Skills Used |",
				"|------|------|-------------|------|--------|--------|-------------|",
				"| 2026-05-12 | capability | Stabilize flaky regression suite | ~20m | ✅ | test | evolve |",
				"| 2026-05-11 | capability | Stabilize flaky regression suite | ~25m | ❌ | test | systematic-debugging |",
				"| 2026-05-10 | capability | Add timeout guardrails | ~10m | ✅ | test | review-changes |",
			].join("\n"),
		);

		const learner = new ErrorPatternLearner(tempDir);
		const suggestions = learner.getSuggestions(
			"Regression output diverged from expected artifact",
			3,
		);

		expect(suggestions).toHaveLength(2);
		expect(suggestions[0]?.suggestion).toContain("Stabilize flaky regression suite");
		expect(suggestions[1]?.suggestion).toContain("Add timeout guardrails");
		expect(
			suggestions.filter((suggestion) =>
				suggestion.suggestion.includes("Stabilize flaky regression suite"),
			),
		).toHaveLength(1);
	});

	it("prioritizes unresolved failures and actionable prevention guidance in MEMORY fallback", () => {
		writeFileSync(
			memoryPath,
			[
				"# Memory",
				"",
				"## Recent Scorecard",
				"",
				"| Date | Task Type | Task Description | Time | First Try | Errors | Rework? | Skills Used |",
				"|------|-----------|------------------|------|-----------|--------|---------|-------------|",
				"| 2026-05-12 | capability | Green regression sweep | ~10m | ✅ | test | No | evolve |",
				"| 2026-05-11 | capability | Recover flaky regression after rework | ~25m | ✅ | test | Yes | review-changes, systematic-debugging |",
				"| 2026-05-10 | capability | Investigate unresolved regression failure | ~30m | ❌ | test | Yes | systematic-debugging |",
			].join("\n"),
		);

		const learner = new ErrorPatternLearner(tempDir);
		const suggestions = learner.getSuggestions(
			"Regression suite still diverges from expected output",
			3,
		);

		expect(suggestions).toHaveLength(3);
		expect(suggestions[0]?.suggestion).toContain("Investigate unresolved regression failure");
		expect(suggestions[0]?.suggestion).toContain(
			"Prevention: re-run systematic-debugging before editing",
		);
		expect(suggestions[1]?.suggestion).toContain("Recover flaky regression after rework");
		expect(suggestions[1]?.suggestion).toContain(
			"Prevention: run review-changes before assess/build-test",
		);
		expect(suggestions[2]?.suggestion).toContain("Green regression sweep");
	});

	it("prefers direct regex pattern matches over MEMORY fallback", () => {
		writeFileSync(
			memoryPath,
			[
				"# Memory",
				"",
				"## Recent Scorecard",
				"",
				"| Date | Type | Description | Time | Result | Errors | Skills Used |",
				"|------|------|-------------|------|--------|--------|-------------|",
				"| 2026-05-12 | capability | Fix import errors | ~10m | ❌ | typescript | evolve |",
			].join("\n"),
		);

		const learner = new ErrorPatternLearner(tempDir);
		const suggestions = learner.getSuggestions("Cannot find name 'missingSymbol'", 3);

		expect(suggestions[0]?.source).toBe("pattern");
		expect(suggestions[0]?.pattern.id).toBe("ts-missing-import");
	});
});
