import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LearningTransferManager } from "./learning-transfer.js";

describe("LearningTransferManager scorecard ingestion", () => {
	let testDir: string;
	let dataDir: string;
	let memoryPath: string;

	beforeEach(() => {
		testDir = join(
			tmpdir(),
			`learning-transfer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		);
		dataDir = join(testDir, ".paimon-test");
		memoryPath = join(testDir, "MEMORY.md");
		mkdirSync(testDir, { recursive: true });
		mkdirSync(dataDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	it("loads sessions from the current compact Recent Scorecard schema", () => {
		writeFileSync(
			memoryPath,
			[
				"# Memory",
				"",
				"## Recent Scorecard",
				"",
				"| Date | Type | Description | Time | Result | Errors |",
				"|------|------|-------------|------|--------|--------|",
				"| 2026-04-17 | capability | Fix context identifier alias compatibility and relevance scoring | ~15m | ✅ | none |",
				"| 2026-04-16 | reliability | Self-improvement engine false positive fix | ~10m | ✅ | lint |",
				"",
			].join("\n"),
			"utf-8",
		);

		const manager = new LearningTransferManager(dataDir, { memoryPath });
		const sessions = manager
			.getSessions()
			.filter((session) => session.sessionId.startsWith("scorecard-2026-04-"));
		const capabilitySession = sessions.find(
			(session) =>
				session.taskDescription ===
				"Fix context identifier alias compatibility and relevance scoring",
		);
		const reliabilitySession = sessions.find(
			(session) => session.taskDescription === "Self-improvement engine false positive fix",
		);

		expect(capabilitySession).toBeDefined();
		expect(reliabilitySession).toBeDefined();
		expect(capabilitySession?.success).toBe(true);
		expect(capabilitySession?.errors).toEqual([]);
		expect(reliabilitySession?.taskSignature.taskType).toBe("reliability");
		expect(reliabilitySession?.errors).toEqual(["lint"]);
		expect(manager.getStats().sessionsProcessed).toBeGreaterThanOrEqual(2);
	});

	it("retains compatibility with the legacy Evolution Scorecard schema", () => {
		writeFileSync(
			memoryPath,
			[
				"# Memory",
				"",
				"## Evolution Scorecard",
				"",
				"| Date | Type | Description | Time | First Try | Errors | Rework | Impact | Skills Used |",
				"|------|------|-------------|------|-----------|--------|--------|--------|-------------|",
				"| 2026-04-15 | capability | Add reasoning memory guidance | ~20m | ✅ | none | No | High | evolve, review-changes |",
				"",
				"### Quality",
			].join("\n"),
			"utf-8",
		);

		const manager = new LearningTransferManager(dataDir, { memoryPath });
		const sessions = manager.getSessions();

		const importedSession = sessions.find(
			(session) => session.taskDescription === "Add reasoning memory guidance",
		);

		expect(importedSession).toBeDefined();
		expect(importedSession?.success).toBe(true);
		expect(importedSession?.skillsUsed).toEqual(["evolve", "review-changes"]);
		expect(importedSession?.taskSignature.category).toBe("memory");
	});
});
