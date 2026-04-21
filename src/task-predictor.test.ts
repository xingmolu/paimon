import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { TaskSuccessPredictor } from "./task-predictor.js";

function createMemoryFile(memoryContent: string): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "task-predictor-test-"));
	const memoryPath = path.join(dir, "MEMORY.md");
	fs.writeFileSync(memoryPath, memoryContent, "utf-8");
	return memoryPath;
}

describe("TaskSuccessPredictor scorecard compatibility", () => {
	it("parses sessions from the current compact Recent Scorecard schema", () => {
		const memoryPath = createMemoryFile(`# Memory

## Recent Scorecard

| Date | Type | Description | Time | Result | Errors |
|------|------|-------------|------|--------|--------|
| 2026-04-18 | capability | Improve task predictor parser reuse | ~10m | ✅ | none |
| 2026-04-17 | reliability | Fix regression retry loop | ~20m | ❌ | test |
`);

		const predictor = new TaskSuccessPredictor({ memoryPath });
		const patterns = predictor.getPatterns();
		const capabilityPattern = patterns.find((pattern) => pattern.taskType === "capability");
		const reliabilityPattern = patterns.find((pattern) => pattern.taskType === "reliability");
		const prediction = predictor.predict({
			taskDescription: "Improve task predictor parser reuse",
			taskType: "capability",
			skillsAvailable: ["evolve", "explore-code"],
		});

		expect(capabilityPattern?.avgSuccessRate).toBe(1);
		expect(capabilityPattern?.avgTime).toBe(10);
		expect(reliabilityPattern?.avgSuccessRate).toBe(0);
		expect(reliabilityPattern?.commonErrors).toEqual(["test"]);
		expect(prediction.similarSuccessfulTasks).toContain("Improve task predictor parser reuse");
	});

	it("retains support for the legacy detailed scorecard schema", () => {
		const memoryPath = createMemoryFile(`# Memory

## Evolution Scorecard

| Date | Task Type | Task Description | Time | First Try | Errors | Rework? | Impact | Skills Used | Enables |
|------|-----------|------------------|------|-----------|--------|---------|--------|-------------|---------|
| 2026-04-18 | capability | Improve task predictor parser reuse | ~10m | ✅ | none | No | High | evolve, review-changes | task-predictor |
| 2026-04-17 | capability | Improve historical task matching | ~14m | ✅ | none | No | Medium | evolve | task-selection |
`);

		const predictor = new TaskSuccessPredictor({ memoryPath });
		const capabilityPattern = predictor
			.getPatterns()
			.find((pattern) => pattern.taskType === "capability");
		const prediction = predictor.predict({
			taskDescription: "Improve historical task matching",
			taskType: "capability",
			skillsAvailable: ["evolve", "review-changes"],
		});

		expect(capabilityPattern?.avgSuccessRate).toBe(1);
		expect(capabilityPattern?.avgTime).toBe(12);
		expect(capabilityPattern?.successfulSkills).toContain("evolve");
		expect(prediction.similarSuccessfulTasks).toContain("Improve historical task matching");
	});
});
