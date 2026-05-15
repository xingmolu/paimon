import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { CapabilityGapDetector, resetCapabilityGapDetector } from "./capability-gap.js";

describe("CapabilityGapDetector coverage", () => {
	beforeEach(() => {
		resetCapabilityGapDetector();
	});

	it("uses roadmap checklist items for roadmap category coverage instead of phase count", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "capability-gap-test-"));
		const roadmapPath = path.join(dir, "ROADMAP.md");
		const toolsDir = path.join(dir, "tools");
		const promptPath = path.join(dir, "prompt.ts");

		fs.mkdirSync(toolsDir, { recursive: true });
		fs.writeFileSync(path.join(toolsDir, "alpha-tool.ts"), "export const alpha = 1;\n", "utf-8");
		fs.writeFileSync(promptPath, "", "utf-8");
		fs.writeFileSync(
			roadmapPath,
			[
				"## Phase 1: Foundation",
				"- [x] Setup project",
				"- [x] Add core tools",
				"## Phase 2: Growth",
				"- [x] Add memory",
				"- [ ] Ship analytics",
			].join("\n"),
			"utf-8",
		);

		const detector = new CapabilityGapDetector({ roadmapPath, toolsDir, promptPath });
		const coverage = detector.getCapabilityCoverage();

		expect(coverage.byCategory.roadmap).toEqual({
			expected: 4,
			implemented: 3,
			percentage: 75,
		});
		expect(coverage.byCategory.roadmap.percentage).toBeLessThanOrEqual(100);
	});
});
