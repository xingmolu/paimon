import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { EvolutionTimelineGenerator } from "./evolution-timeline.js";

function createMemoryFile(content: string): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "timeline-test-"));
	const filePath = path.join(dir, "MEMORY.md");
	fs.writeFileSync(filePath, content);
	return filePath;
}

describe("EvolutionTimelineGenerator scorecard compatibility", () => {
	it("parses the current compact Recent Scorecard schema", () => {
		const memoryFile = createMemoryFile(`# Memory

## Recent Scorecard

| Date | Type | Description | Time | Result | Errors |
|------|------|-------------|------|--------|--------|
| 2026-04-17 | capability | Improve timeline parsing | ~15m | ✅ | none |
| 2026-04-16 | reliability | Stabilize scorecard ingestion | ~10m | ✅ | none |
`);

		const generator = new EvolutionTimelineGenerator({ memoryPath: memoryFile });
		const timeline = generator.generateTimeline();

		expect(timeline.totalCapabilities).toBe(1);
		expect(timeline.totalReliability).toBe(1);
		expect(timeline.totalFeatures).toBe(0);
		expect(timeline.days).toHaveLength(2);
		expect(timeline.days[0]?.events[0]?.description).toBe("Stabilize scorecard ingestion");
	});

	it("retains support for the legacy detailed Evolution Scorecard schema", () => {
		const memoryFile = createMemoryFile(`# Memory

## Evolution Scorecard

| Date | Task Type | Task Description | Time | First Try | Errors | Rework? | Impact | Skills Used | Enables |
|------|-----------|------------------|------|-----------|--------|---------|--------|-------------|---------|
| 2026-04-17 | capability | Improve timeline parsing | ~15m | ✅ | none | No | High | evolve | timeline |
| 2026-04-16 | feature | Add markdown output | ~20m | ✅ | none | No | Medium | evolve | formatting |
`);

		const generator = new EvolutionTimelineGenerator({ memoryPath: memoryFile });
		const timeline = generator.generateTimeline();

		expect(timeline.totalCapabilities).toBe(1);
		expect(timeline.totalFeatures).toBe(1);
		expect(timeline.overallSuccessRate).toBe(50);
		expect(timeline.days[1]?.events[0]?.skillsUsed).toEqual(["evolve"]);
	});
});
