import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execSyncMock = vi.fn();

vi.mock("node:child_process", () => ({
	execSync: execSyncMock,
}));

const memoryPath = "MEMORY.md";

describe("assessTool", () => {
	let originalMemory: string | null = null;

	beforeEach(() => {
		originalMemory = existsSync(memoryPath) ? readFileSync(memoryPath, "utf-8") : null;
		execSyncMock.mockReset();
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		if (typeof originalMemory === "string") {
			writeFileSync(memoryPath, originalMemory);
		} else if (existsSync(memoryPath)) {
			unlinkSync(memoryPath);
		}
	});

	it("adds MEMORY-backed test guardrails when tests fail", async () => {
		writeFileSync(
			memoryPath,
			[
				"# Memory",
				"",
				"## Recent Scorecard",
				"",
				"| Date | Task Type | Task Description | Time | First Try | Errors | Rework? | Skills Used |",
				"|------|-----------|------------------|------|-----------|--------|---------|-------------|",
				"| 2026-05-12 | capability | Investigate unresolved regression failure | ~25m | ❌ | test | Yes | systematic debugging |",
				"| 2026-05-11 | capability | Recover regression with review pass | ~20m | ✅ | test | Yes | review changes / evolve |",
			].join("\n"),
		);

		execSyncMock.mockImplementation((command: string) => {
			if (command === "git status --porcelain") return " M src/tools/assess-tool.ts\n" as never;
			if (command === "npm run build") return "build ok" as never;
			if (command === "npm test -- --run") {
				throw new Error("AssertionError: Regression output diverged from expected artifact");
			}
			if (command === "npm run lint") return "lint ok" as never;
			throw new Error(`Unexpected command: ${command}`);
		});

		const { assessTool } = await import("./assess-tool.js");
		const result = await assessTool.execute("tool-call", {
			runBuild: true,
			runTests: true,
			runLint: true,
			runRegression: false,
		});

		const text = result.content[0]?.type === "text" ? result.content[0].text : "";
		expect(text).toContain("Build: pass");
		expect(text).toContain("Tests: fail");
		expect(text).toContain("🧠 Guardrail: Recent MEMORY.md failure on 2026-05-12");
		expect(text).toContain("Prevention: re-run systematic-debugging before editing");
		expect(text).toContain("Recover regression with review pass");
		expect(text).toContain("Prevention: run review-changes before assess/build-test");
	});
});
