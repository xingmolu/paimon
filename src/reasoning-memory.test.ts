import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ReasoningMemoryManager } from "./reasoning-memory.js";

const tempDirs: string[] = [];

function createManager(memoryContent?: string): ReasoningMemoryManager {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reasoning-memory-"));
	tempDirs.push(tempDir);

	const storagePath = path.join(tempDir, "reasoning-memory.json");
	const homeDir = path.join(tempDir, "home");
	fs.mkdirSync(path.join(homeDir, ".paimon"), { recursive: true });

	if (memoryContent) {
		fs.writeFileSync(path.join(process.cwd(), "MEMORY.md"), memoryContent);
	}

	return new ReasoningMemoryManager({
		storagePath,
		similarityThreshold: 0,
	});
}

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

describe("ReasoningMemoryManager scorecard guidance", () => {
	it("prefers explicit compact scorecard failures over legacy success markers", () => {
		const memoryPath = path.join(process.cwd(), "MEMORY.md");
		const originalMemory = fs.readFileSync(memoryPath, "utf-8");
		const manager = createManager(
			"# Memory\n\n## Evolution Scorecard\n\n| Date | Task Type | Task Description | Time | Result | First Try | Errors | Rework? | Impact | Skills Used | Enables |\n|------|-----------|------------------|------|--------|-----------|--------|---------|--------|-------------|---------|\n| 2026-04-19 | capability | Improve capability guidance fallback | ~12m | ❌ | ✅ | test | Yes | High | evolve | guidance |\n",
		);

		try {
			const [similar] = manager.findSimilarChains(
				"Improve capability guidance fallback",
				"capability",
				1,
			);

			expect(similar?.chain.outcome).toBe("success");
		} finally {
			fs.writeFileSync(memoryPath, originalMemory);
		}
	});

	it("includes relevant MEMORY.md scorecard entries in guidance when no chains match", () => {
		const memoryPath = path.join(process.cwd(), "MEMORY.md");
		const originalMemory = fs.readFileSync(memoryPath, "utf-8");
		const manager = createManager(
			"# Memory\n\n## Recent Scorecard\n\n| Date | Type | Description | Time | Result | Errors |\n|------|------|-------------|------|--------|--------|\n| 2026-04-19 | capability | Improve task selection guidance for capability work | ~12m | ✅ | none |\n| 2026-04-18 | reliability | Fix flaky verification retry loop | ~9m | ✅ | test |\n",
		);

		try {
			const guidance = manager.getReasoningGuidance(
				"Improve guidance for selecting capability tasks",
				"capability",
			);

			expect(guidance).toContain("### Related MEMORY.md Scorecard Entries");
			expect(guidance).toContain("Improve task selection guidance for capability work");
			expect(guidance).not.toContain("Fix flaky verification retry loop");
		} finally {
			fs.writeFileSync(memoryPath, originalMemory);
		}
	});

	it("prefers live reasoning chains over scorecard fallbacks in similar-chain search", () => {
		const memoryPath = path.join(process.cwd(), "MEMORY.md");
		const originalMemory = fs.readFileSync(memoryPath, "utf-8");
		const manager = createManager(
			"# Memory\n\n## Recent Scorecard\n\n| Date | Type | Description | Time | Result | Errors |\n|------|------|-------------|------|--------|--------|\n| 2026-04-19 | capability | Improve task selection guidance for capability work | ~12m | ✅ | none |\n",
		);

		try {
			manager.startChain("Improve guidance for selecting capability tasks", "capability");
			manager.addStep("analysis", "Reviewed the scoring flow");
			manager.completeChain(
				"success",
				["src/reasoning-memory.ts"],
				[],
				["Use recent successful capability iterations to guide selection"],
			);

			const similar = manager.findSimilarChains(
				"Improve guidance for selecting capability tasks",
				"capability",
				5,
			);

			expect(similar).toHaveLength(1);
			expect(similar[0]?.chain.learnings?.[0]).toContain("recent successful capability iterations");
			expect(similar[0]?.matchingKeywords).toContain("guidance");
		} finally {
			fs.writeFileSync(memoryPath, originalMemory);
		}
	});
});
