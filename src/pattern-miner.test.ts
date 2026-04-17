import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { PatternMiner } from "./pattern-miner.js";

function createRepoWithMemory(memoryContent: string) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pattern-miner-test-"));
	fs.mkdirSync(path.join(dir, ".git"));
	fs.mkdirSync(path.join(dir, "data"));
	const memoryPath = path.join(dir, "MEMORY.md");
	fs.writeFileSync(memoryPath, memoryContent);
	return { dir, memoryPath, dataDir: path.join(dir, "data") };
}

describe("PatternMiner scorecard compatibility", () => {
	it("parses sessions from the current compact Recent Scorecard schema", () => {
		const repo = createRepoWithMemory(`# Memory

## Recent Scorecard

| Date | Type | Description | Time | Result | Errors |
|------|------|-------------|------|--------|--------|
| 2026-04-17 | capability | Improve pattern recommendations | ~10m | ✅ | none |
| 2026-04-16 | capability | Improve scorecard parsing | ~12m | ✅ | none |
| 2026-04-15 | capability | Improve task selection | ~14m | ✅ | none |
| 2026-04-14 | reliability | Reduce parser regressions | ~18m | ❌ | test |
`);

		const miner = new PatternMiner(repo.dataDir, repo.memoryPath);
		const stats = miner.getStats();
		const taskTypePattern = miner.getPattern("task-type-capability");

		expect(stats.totalSessionsAnalyzed).toBe(4);
		expect(taskTypePattern?.successRate).toBe(100);
		expect(taskTypePattern?.sampleSize).toBe(3);
	});

	it("retains support for the legacy detailed Evolution Scorecard schema", () => {
		const repo = createRepoWithMemory(`# Memory

## Evolution Scorecard

| Date | Task Type | Task Description | Time | First Try | Errors | Rework? | Impact | Skills Used | Enables |
|------|-----------|------------------|------|-----------|--------|---------|--------|-------------|---------|
| 2026-04-17 | capability | Improve pattern recommendations | ~10m | ✅ | none | No | High | evolve | miner |
| 2026-04-16 | capability | Improve scorecard parsing | ~12m | ✅ | none | No | High | evolve, review-changes | parser |
| 2026-04-15 | capability | Improve task selection | ~14m | ✅ | none | No | Medium | evolve | task-selection |
`);

		const miner = new PatternMiner(repo.dataDir, repo.memoryPath);
		const stats = miner.getStats();
		const taskTypePattern = miner.getPattern("task-type-capability");

		expect(stats.totalSessionsAnalyzed).toBe(3);
		expect(taskTypePattern?.sampleSize).toBe(3);
		expect(taskTypePattern?.examples[0]?.taskDescription).toBe("Improve pattern recommendations");
	});
});
