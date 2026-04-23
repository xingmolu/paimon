import { describe, expect, it } from "vitest";

import {
	extractScorecardTableLines,
	hasRecordedImpact,
	isNegativeScorecardResult,
	isPositiveScorecardResult,
	normalizeScorecardResult,
	parseScorecardRows,
} from "./scorecard.js";

describe("scorecard parsing", () => {
	it("parses the current compact Recent Scorecard schema", () => {
		const content = `# Memory

## Recent Scorecard

| Date | Type | Description | Time | Result | Errors |
|------|------|-------------|------|--------|--------|
| 2026-04-17 | capability | Fix compact parser compatibility | ~15m | ✅ | none |
| 2026-04-16 | reliability | Stabilize recovery loop | ~10m | ❌ | test |
`;

		expect(extractScorecardTableLines(content)).toHaveLength(4);
		expect(parseScorecardRows(content)).toEqual([
			{
				date: "2026-04-17",
				taskType: "capability",
				description: "Fix compact parser compatibility",
				time: "~15m",
				result: "✅",
				firstTry: "",
				errors: "none",
				rework: "",
				impact: "",
				skillsUsed: "",
				enables: "",
			},
			{
				date: "2026-04-16",
				taskType: "reliability",
				description: "Stabilize recovery loop",
				time: "~10m",
				result: "❌",
				firstTry: "",
				errors: "test",
				rework: "",
				impact: "",
				skillsUsed: "",
				enables: "",
			},
		]);
	});

	it("parses the legacy detailed scorecard schema", () => {
		const content = `# Memory

## Evolution Scorecard

| Date | Task Type | Task Description | Time | First Try | Errors | Rework? | Impact | Skills Used | Enables |
|------|-----------|------------------|------|-----------|--------|---------|--------|-------------|---------|
| 2026-04-15 | capability | Add timeline parser fallback | ~20m | ✅ | none | No | High | evolve, review-changes | timeline |
`;

		expect(parseScorecardRows(content)).toEqual([
			{
				date: "2026-04-15",
				taskType: "capability",
				description: "Add timeline parser fallback",
				time: "~20m",
				result: "",
				firstTry: "✅",
				errors: "none",
				rework: "No",
				impact: "High",
				skillsUsed: "evolve, review-changes",
				enables: "timeline",
			},
		]);
	});

	it("parses the compact ## Scorecard alias used by metrics fixtures", () => {
		const content = `# Memory

## Scorecard

| Date | Task Type | Task Description | Time | First Try | Errors | Rework? | Impact | Skills Used | Enables |
|------|-----------|------------------|------|-----------|--------|---------|--------|-------------|---------|
| 2026-04-14 | capability | Keep aliases compatible | ~11m | ✅ | none | No | Medium | evolve | scorecard |
`;

		const [row] = parseScorecardRows(content);
		expect(row?.taskType).toBe("capability");
		expect(row?.description).toBe("Keep aliases compatible");
		expect(row?.enables).toBe("scorecard");
	});

	it("exposes helpers for interpreting scorecard result and impact fields", () => {
		expect(normalizeScorecardResult("✅")).toBe("positive");
		expect(normalizeScorecardResult(undefined, "✅")).toBe("positive");
		expect(normalizeScorecardResult("❌", "✅")).toBe("negative");
		expect(normalizeScorecardResult("✅", "❌")).toBe("positive");
		expect(normalizeScorecardResult("❌")).toBe("negative");
		expect(normalizeScorecardResult("")).toBe("unknown");
		expect(isPositiveScorecardResult("✅")).toBe(true);
		expect(isPositiveScorecardResult(undefined, "✅")).toBe(true);
		expect(isPositiveScorecardResult("❌", "✅")).toBe(false);
		expect(isPositiveScorecardResult("✅", "❌")).toBe(true);
		expect(isPositiveScorecardResult("")).toBe(false);
		expect(isNegativeScorecardResult("❌")).toBe(true);
		expect(isNegativeScorecardResult("✅")).toBe(false);
		expect(isNegativeScorecardResult("❌", "✅")).toBe(true);
		expect(isNegativeScorecardResult("✅", "❌")).toBe(false);
		expect(isNegativeScorecardResult("", "❌")).toBe(true);
		expect(hasRecordedImpact("High")).toBe(true);
		expect(hasRecordedImpact("medium")).toBe(true);
		expect(hasRecordedImpact("")).toBe(false);
	});
});
