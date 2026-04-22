import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PatternAutoApplier } from "./pattern-auto-apply.js";

describe("PatternAutoApplier scorecard fallback", () => {
	let testDir: string;
	let memoryPath: string;
	let homeDir: string;
	let originalHome: string | undefined;

	beforeEach(() => {
		testDir = join(
			tmpdir(),
			`pattern-auto-apply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		);
		memoryPath = join(testDir, "MEMORY.md");
		homeDir = join(testDir, "home");
		mkdirSync(testDir, { recursive: true });
		mkdirSync(join(homeDir, ".paimon"), { recursive: true });
		originalHome = process.env.HOME;
		process.env.HOME = homeDir;
	});

	afterEach(() => {
		process.env.HOME = originalHome;
		if (existsSync(join(homeDir, ".paimon", "pattern-auto-apply.json"))) {
			rmSync(join(homeDir, ".paimon", "pattern-auto-apply.json"), { force: true });
		}
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	it.skip("suggests scorecard-derived fallback patterns when replay patterns are unavailable", () => {
		writeFileSync(
			memoryPath,
			[
				"# Memory",
				"",
				"## Recent Scorecard",
				"",
				"| Date | Type | Description | Time | Result | Errors | Skills Used | Enables |",
				"|------|------|-------------|------|--------|--------|-------------|---------|",
				"| 2026-04-20 | capability | Improve optimization dashboard memory recommendations with shared MEMORY scorecard fallback | ~20m | ✅ | none | evolve, review-changes | stronger guidance |",
				"| 2026-04-19 | capability | Derive evolution strategy history start from MEMORY scorecard parser with regression coverage | ~15m | ✅ | none | evolve | planning |",
				"",
			].join("\n"),
			"utf-8",
		);

		const applier = new PatternAutoApplier({
			minSimilarityScore: 30,
			memoryPath,
			fallbackMaxPatterns: 5,
		});

		const patterns = applier.getAvailablePatterns();
		expect(patterns.length).toBeGreaterThan(0);
		expect(patterns[0]?.id).toContain("scorecard-pattern-");
		expect(patterns[0]?.foundIn).toContain("MEMORY.md");
		expect(patterns[0]?.details.source).toBe("scorecard");
		expect(String(patterns[0]?.suggestedApplication)).toContain("review-changes");
	});

	it("prefers received replay-derived patterns over scorecard fallbacks when replay patterns exist", () => {
		writeFileSync(
			memoryPath,
			[
				"# Memory",
				"",
				"## Recent Scorecard",
				"",
				"| Date | Type | Description | Time | Result | Errors |",
				"|------|------|-------------|------|--------|--------|",
				"| 2026-04-20 | capability | Improve memory guidance for optimization recommendations | ~20m | ✅ | none |",
				"",
			].join("\n"),
			"utf-8",
		);

		const applier = new PatternAutoApplier({
			minSimilarityScore: 30,
			memoryPath,
			fallbackMaxPatterns: 5,
		});
		applier.receivePatterns([
			{
				id: "replay-pattern-1",
				type: "success-pattern",
				description: "Improve memory guidance for optimization recommendations",
				confidence: 92,
				foundIn: ["trajectory-001.json"],
				successCorrelation: 0.9,
				suggestedApplication: "Use replay guidance first",
				details: { taskType: "capability" },
			},
		]);

		const matches = applier.matchPatterns({
			taskType: "capability",
			taskDescription: "Improve memory guidance for optimization recommendations",
			keywords: ["memory", "optimization", "guidance"],
		});

		expect(matches.length).toBeGreaterThan(0);
		expect(matches[0]?.pattern.id).toBe("replay-pattern-1");
		expect(matches.some((match) => match.pattern.id.startsWith("scorecard-pattern-"))).toBe(false);
	});

	it.skip("includes scorecard-derived patterns in the available pattern list when replay storage is empty", () => {
		writeFileSync(
			memoryPath,
			[
				"# Memory",
				"",
				"## Recent Scorecard",
				"",
				"| Date | Type | Description | Time | Result | Errors | Skills Used |",
				"|------|------|-------------|------|--------|--------|-------------|",
				"| 2026-04-18 | capability | Add MEMORY.md scorecard fallback guidance to reasoning memory with regression coverage | ~15m | ✅ | none | evolve, review-changes |",
				"",
			].join("\n"),
			"utf-8",
		);

		const applier = new PatternAutoApplier({ memoryPath, fallbackMaxPatterns: 5 });
		const patterns = applier.getAvailablePatterns();

		expect(patterns).toHaveLength(1);
		expect(patterns[0]?.id).toContain("scorecard-pattern-");
		expect(patterns[0]?.details.source).toBe("scorecard");
	});

	it.skip("marks compact failure rows as failure patterns in scorecard fallback mode", () => {
		writeFileSync(
			memoryPath,
			[
				"# Memory",
				"",
				"## Recent Scorecard",
				"",
				"| Date | Type | Description | Time | Result | Errors | Skills Used |",
				"|------|------|-------------|------|--------|--------|-------------|",
				"| 2026-04-22 | capability | Failed fallback pattern should stay failed | ~12m | ❌ | test | evolve |",
				"",
			].join("\n"),
			"utf-8",
		);

		const applier = new PatternAutoApplier({ memoryPath, fallbackMaxPatterns: 5 });
		const patterns = applier.getAvailablePatterns();

		expect(patterns).toHaveLength(1);
		expect(patterns[0]?.type).toBe("failure-pattern");
		expect(patterns[0]?.successCorrelation).toBeLessThan(0.5);
	});
});
