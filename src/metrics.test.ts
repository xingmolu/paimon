import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { EvolutionMetricsTracker } from "./metrics.js";

function createMemoryFile(content: string): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "metrics-test-"));
	const filePath = path.join(dir, "MEMORY.md");
	fs.writeFileSync(filePath, content);
	return filePath;
}

describe("EvolutionMetricsTracker", () => {
	it("parses the current MEMORY.md scorecard schema", () => {
		const memoryFile = createMemoryFile(`# Memory

## Recent Scorecard

| Date | Type | Description | Time | Result | Errors |
|------|------|-------------|------|--------|--------|
| 2026-04-16 | capability | Metrics parser compatibility | ~12m | ✅ | none |
| 2026-04-15 | reliability | Improve verification loop | ~18m | ❌ | test |
`);

		const tracker = new EvolutionMetricsTracker({ memoryFile });
		const metrics = tracker.getMetrics();

		expect(metrics.iterationsAnalyzed).toBe(2);
		expect(metrics.successRate.weeklyAverage).toBe(50);
		expect(metrics.errors.totalErrors).toBe(1);
		expect(metrics.errors.byType).toEqual({ test: 1 });
		expect(metrics.capabilityVelocity.totalCapabilities).toBe(1);
		expect(metrics.capabilityVelocity.highImpactCount).toBe(0);
		expect(metrics.capabilityVelocity.highImpactPercentage).toBe(0);
		expect(metrics.time.byTaskType).toEqual({ capability: 12, reliability: 18 });
		expect(metrics.skills).toEqual([]);
	});

	it("preserves support for the legacy detailed scorecard schema", () => {
		const memoryFile = createMemoryFile(`# Memory

## Scorecard

| Date | Task Type | Task Description | Time | First Try | Errors | Rework? | Impact | Skills Used | Enables |
|------|-----------|------------------|------|-----------|--------|---------|--------|-------------|---------|
| 2026-04-16 | capability | Legacy format support | ~10m | ✅ | none | No | High | evolve, review-changes | metrics |
| 2026-04-15 | reliability | Recovery loop tune-up | ~20m | ❌ | lint | Yes | Medium | systematic-debugging | verification |
`);

		const tracker = new EvolutionMetricsTracker({ memoryFile });
		const metrics = tracker.getMetrics();

		expect(metrics.iterationsAnalyzed).toBe(2);
		expect(metrics.successRate.weeklyAverage).toBe(50);
		expect(metrics.errors.byType).toEqual({ lint: 1 });
		expect(metrics.capabilityVelocity.totalCapabilities).toBe(1);
		expect(metrics.capabilityVelocity.highImpactCount).toBe(1);
		expect(metrics.capabilityVelocity.highImpactPercentage).toBe(100);
		expect(metrics.time.byTaskType).toEqual({ capability: 10, reliability: 20 });
		expect(metrics.skills[0]?.skill).toBe("evolve");
	});

	it("does not treat missing impact columns in compact scorecards as low impact capability work", () => {
		const memoryFile = createMemoryFile(`# Memory

## Recent Scorecard

| Date | Type | Description | Time | Result | Errors |
|------|------|-------------|------|--------|--------|
| 2026-04-16 | capability | Compact capability one | ~12m | ✅ | none |
| 2026-04-15 | capability | Compact capability two | ~18m | ✅ | none |
`);

		const tracker = new EvolutionMetricsTracker({ memoryFile });
		const metrics = tracker.getMetrics();

		expect(metrics.capabilityVelocity.totalCapabilities).toBe(2);
		expect(metrics.capabilityVelocity.highImpactCount).toBe(0);
		expect(metrics.capabilityVelocity.highImpactPercentage).toBe(0);
	});
});
