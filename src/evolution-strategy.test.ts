import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { initCapabilityGapDetector } from "./capability-gap.js";
import { EvolutionStrategyPlanner, resetEvolutionStrategyPlanner } from "./evolution-strategy.js";

function createMemoryFile(content: string): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "evolution-strategy-test-"));
	const filePath = path.join(dir, "MEMORY.md");
	fs.writeFileSync(filePath, content, "utf-8");
	return filePath;
}

describe("EvolutionStrategyPlanner", () => {
	beforeEach(() => {
		resetEvolutionStrategyPlanner();
		vi.useRealTimers();
	});

	it("derives daysSinceStart from the earliest compact Recent Scorecard entry", async () => {
		const memoryPath = createMemoryFile(`# Memory

## Recent Scorecard

| Date | Type | Description | Time | Result | Errors |
|------|------|-------------|------|--------|--------|
| 2026-04-10 | capability | Improve strategic planning | ~10m | ✅ | none |
| 2026-04-18 | capability | Improve timeline parsing | ~12m | ✅ | none |
`);

		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-19T12:00:00Z"));

		const planner = new EvolutionStrategyPlanner({ memoryPath });
		const state = await planner.analyzeCurrentState();

		expect(state.daysSinceStart).toBe(9);
	});

	it("retains support for the legacy Evolution Scorecard schema", async () => {
		const memoryPath = createMemoryFile(`# Memory

## Evolution Scorecard

| Date | Task Type | Task Description | Time | First Try | Errors | Rework? | Impact | Skills Used | Enables |
|------|-----------|------------------|------|-----------|--------|---------|--------|-------------|---------|
| 2026-04-05 | capability | Improve strategic planning | ~10m | ✅ | none | No | High | evolve | strategy |
| 2026-04-18 | capability | Improve timeline parsing | ~12m | ✅ | none | No | Medium | evolve | timeline |
`);

		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-19T12:00:00Z"));

		const planner = new EvolutionStrategyPlanner({ memoryPath });
		const state = await planner.analyzeCurrentState();

		expect(state.daysSinceStart).toBe(14);
	});

	it("falls back to zero days when MEMORY scorecard data is unavailable", async () => {
		const memoryPath = createMemoryFile("# Memory\n\nNo scorecard yet.\n");

		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-19T12:00:00Z"));

		const planner = new EvolutionStrategyPlanner({ memoryPath });
		const state = await planner.analyzeCurrentState();

		expect(state.daysSinceStart).toBe(0);
	});

	it("uses capability gap coverage instead of scorecard velocity totals", async () => {
		const memoryPath = createMemoryFile(`# Memory

## Recent Scorecard

| Date | Type | Description | Time | Result | Errors |
|------|------|-------------|------|--------|--------|
| 2026-04-10 | capability | Tiny historical sample | ~10m | ✅ | none |
| 2026-04-18 | reliability | Another iteration | ~12m | ✅ | none |
`);
		const dir = path.dirname(memoryPath);
		const toolsDir = path.join(dir, "tools");
		const roadmapPath = path.join(dir, "ROADMAP.md");
		fs.mkdirSync(toolsDir, { recursive: true });
		for (const name of ["alpha-tool.ts", "beta-tool.ts", "gamma-tool.ts", "delta-tool.ts"]) {
			fs.writeFileSync(path.join(toolsDir, name), "export const x = 1;\n", "utf-8");
		}
		fs.writeFileSync(
			roadmapPath,
			"## Phase 1: Foundation\n- [x] Done\n## Phase 2: Growth\n- [x] Done\n",
			"utf-8",
		);

		initCapabilityGapDetector({ roadmapPath, toolsDir });
		const planner = new EvolutionStrategyPlanner({ memoryPath });
		const state = await planner.analyzeCurrentState();

		expect(state.capabilitiesImplemented).toBeGreaterThan(2);
		expect(state.capabilitiesImplemented).toBe(54);
		expect(state.capabilitiesTotal).toBe(110);
		expect(state.coveragePercentage).toBe(49);
	});
});
