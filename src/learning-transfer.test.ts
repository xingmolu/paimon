import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LearningTransferManager } from "./learning-transfer.js";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("LearningTransferManager scorecard parsing", () => {
	it("loads compact scorecard rows with inferred first-try and failure state", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "learning-transfer-"));
		tempDirs.push(tempDir);
		const memoryPath = join(tempDir, "MEMORY.md");
		writeFileSync(
			memoryPath,
			`# Memory

## Recent Scorecard

| Date | Type | Description | Time | Result | Errors | Skills Used |
|------|------|-------------|------|--------|--------|-------------|
| 2026-04-20 | capability | Add scorecard fallback guidance | ~15m | ✅ | none | evolve, review-changes |
| 2026-04-19 | reliability | Fix retry loop regression | ~11m | ❌ | test | evolve |
`,
		);

		const manager = new LearningTransferManager(undefined, {
			dataPath: tempDir,
			memoryPath,
			excludeOlderThanDays: 1000,
		});

		const sessions = manager.getSessions();
		expect(sessions).toHaveLength(2);
		expect(sessions[0]?.taskDescription).toContain("Add scorecard fallback guidance");
		expect(sessions[0]?.success).toBe(true);
		expect(sessions[0]?.firstTry).toBe(true);
		expect(sessions[1]?.taskDescription).toContain("Fix retry loop regression");
		expect(sessions[1]?.success).toBe(false);
		expect(sessions[1]?.firstTry).toBe(false);
		expect(sessions[1]?.errors).toEqual(["test"]);
	});
});
