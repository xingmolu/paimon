import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const loadManager = async () => {
	const module = await import("./predictive-error-prevention.js");
	return module.getPredictiveErrorPreventionManager();
};

const loadTool = async () => {
	const module = await import("./tools/predictive-error-prevention-tool.js");
	return module.predictiveErrorPreventionTool;
};

describe("PredictiveErrorPreventionManager", () => {
	let tempHome: string;
	const originalHome = process.env.HOME;

	beforeEach(() => {
		tempHome = mkdtempSync(path.join(os.tmpdir(), "paimon-pep-"));
		process.env.HOME = tempHome;
		writeFileSync(
			path.join(process.cwd(), "MEMORY.md"),
			[
				"# Memory",
				"",
				"## Recent Scorecard",
				"",
				"| Date | Type | Description | Time | Result | Errors | Skills Used |",
				"|------|------|-------------|------|--------|--------|-------------|",
				"| 2026-04-23 | capability | Add MEMORY.md scorecard fallback guidance to predictive error prevention | ~20m | ✅ | test | evolve, review-changes |",
			].join("\n"),
		);
	});

	afterEach(async () => {
		process.env.HOME = originalHome;
		rmSync(tempHome, { recursive: true, force: true });
		const module = await import("./predictive-error-prevention.js");
		module.resetPredictiveErrorPreventionManager();
	});

	it("records occurred, prevented, and false-positive outcomes distinctly", async () => {
		const manager = await loadManager();
		const [prediction] = manager.predict({
			taskType: "capability",
			files: ["src/example.ts"],
			toolsUsed: ["edit", "bash"],
		});

		expect(prediction).toBeDefined();
		manager.recordOccurrence(prediction.id);
		manager.recordPrevention(prediction.id);
		manager.recordFalsePositive(prediction.id);

		const stats = manager.getStats();
		expect(stats.correctPredictions).toBe(1);
		expect(stats.falsePositives).toBe(1);
		expect(stats.byErrorType[prediction.predictedErrorType]?.occurred).toBe(1);
		expect(stats.byErrorType[prediction.predictedErrorType]?.prevented).toBe(1);
		expect(stats.predictionAccuracy).toBe(0.5);
	});

	it("builds memory fallback guidance that distinguishes failures from successful rework", async () => {
		writeFileSync(
			path.join(process.cwd(), "MEMORY.md"),
			[
				"# Memory",
				"",
				"## Recent Scorecard",
				"",
				"| Date | Type | Description | Time | Result | Errors | Skills Used |",
				"|------|------|-------------|------|--------|--------|-------------|",
				"| 2026-04-24 | capability | Fix predictive fallback after failing regression | ~15m | ❌ | test | systematic-debugging |",
				"| 2026-04-23 | capability | Add predictive fallback coverage with rework | ~20m | ✅ | test | evolve, review-changes |",
			].join("\n"),
		);

		const manager = await loadManager();
		const predictions = manager.predict({ taskType: "capability" });
		const memoryPrediction = predictions.find((prediction) => prediction.source === "memory");

		expect(memoryPrediction).toBeDefined();
		expect(memoryPrediction?.preventionSuggestions[0]).toContain(
			"Recent MEMORY.md failure on 2026-04-24",
		);
		expect(memoryPrediction?.preventionSuggestions[0]).toContain(
			"Prevention: re-run systematic-debugging before editing",
		);
		expect(memoryPrediction?.preventionSuggestions.join("\n")).not.toContain(
			"Reuse skills from recent successful work when applicable: systematic-debugging",
		);
		expect(memoryPrediction?.preventionSuggestions.join("\n")).toContain(
			"Recent clean capability success on 2026-04-23",
		);
	});

	it("prioritizes unresolved failures and guarded recoveries ahead of generic clean wins", async () => {
		writeFileSync(
			path.join(process.cwd(), "MEMORY.md"),
			[
				"# Memory",
				"",
				"## Recent Scorecard",
				"",
				"| Date | Task Type | Task Description | Time | First Try | Errors | Rework? | Skills Used |",
				"|------|-----------|------------------|------|-----------|--------|---------|-------------|",
				"| 2026-05-12 | capability | Clean regression success with no guardrails | ~8m | ✅ | test | No | evolve |",
				"| 2026-05-11 | capability | Recover regression with verification rerun | ~18m | ✅ | test | Yes | assess |",
				"| 2026-05-10 | capability | Recover regression with review pass | ~20m | ✅ | test | Yes | review changes / evolve |",
				"| 2026-05-09 | capability | Investigate unresolved regression failure | ~25m | ❌ | test | Yes | skills used: systematic debugging |",
			].join("\n"),
		);

		const manager = await loadManager();
		const predictions = manager.predict({ taskType: "capability" });
		const memoryPrediction = predictions.find((prediction) => prediction.source === "memory");

		expect(memoryPrediction).toBeDefined();
		expect(memoryPrediction?.preventionSuggestions[0]).toContain(
			"Investigate unresolved regression failure",
		);
		expect(memoryPrediction?.preventionSuggestions[0]).toContain(
			"Prevention: re-run systematic-debugging before editing",
		);
		expect(memoryPrediction?.preventionSuggestions.join("\n")).toContain(
			"Recover regression with review pass",
		);
		expect(memoryPrediction?.preventionSuggestions.join("\n")).toContain(
			"Prevention: run review-changes before assess/build-test",
		);
		expect(memoryPrediction?.preventionSuggestions.join("\n")).not.toContain(
			"Clean regression success with no guardrails",
		);
		expect(memoryPrediction?.preventionSuggestions.join("\n")).not.toContain("verification rerun");
	});
});

describe("predictiveErrorPreventionTool", () => {
	let tempHome: string;
	const originalHome = process.env.HOME;

	beforeEach(() => {
		tempHome = mkdtempSync(path.join(os.tmpdir(), "paimon-pep-tool-"));
		process.env.HOME = tempHome;
	});

	afterEach(async () => {
		process.env.HOME = originalHome;
		rmSync(tempHome, { recursive: true, force: true });
		const module = await import("./predictive-error-prevention.js");
		module.resetPredictiveErrorPreventionManager();
	});

	it("requires recordAction for record action", async () => {
		const tool = await loadTool();
		const result = await tool.execute("tool-call", {
			action: "record",
			predictionId: "pred-123",
		});

		expect(result.content[0]?.type).toBe("text");
		const resultText = result.content[0]?.type === "text" ? result.content[0].text : "";
		expect(resultText).toContain("recordAction required");
	});

	it("routes prevented record outcomes to prevention tracking", async () => {
		const tool = await loadTool();
		const predictResult = await tool.execute("tool-call", {
			action: "predict",
			taskType: "capability",
			files: ["src/example.ts"],
			toolsUsed: ["edit", "bash"],
		});

		const predictionText =
			predictResult.content[0]?.type === "text" ? predictResult.content[0].text : "";
		const predictionIdMatch = predictionText.match(/pred-[^\s|]+/);
		const manager = await loadManager();
		const predictionId = manager.getPredictions()[0]?.id || predictionIdMatch?.[0];

		expect(predictionId).toBeTruthy();
		const recordResult = await tool.execute("tool-call", {
			action: "record",
			predictionId,
			recordAction: "prevented",
		});

		expect(recordResult.content[0]?.type).toBe("text");
		const recordText = recordResult.content[0]?.type === "text" ? recordResult.content[0].text : "";
		expect(recordText).toContain("Recorded prevented outcome");
		expect(
			manager.getStats().byErrorType[manager.getPredictions()[0].predictedErrorType]?.prevented,
		).toBe(1);
	});

	it("updates config values through the config action", async () => {
		const tool = await loadTool();
		const result = await tool.execute("tool-call", {
			action: "config",
			minProbability: 0.6,
			minConfidence: 0.7,
			proactiveWarnings: false,
			patternRetentionDays: 14,
		});

		expect(result.content[0]?.type).toBe("text");
		const resultText = result.content[0]?.type === "text" ? result.content[0].text : "";
		expect(resultText).toContain("Config Updated");
		expect(resultText).toContain("**Min Probability:** 0.6");
		expect(resultText).toContain("**Min Confidence:** 0.7");
		expect(resultText).toContain("**Proactive Warnings:** false");
		expect(resultText).toContain("**Pattern Retention Days:** 14");

		const manager = await loadManager();
		expect(manager.getConfig().minProbability).toBe(0.6);
		expect(manager.getConfig().minConfidence).toBe(0.7);
		expect(manager.getConfig().proactiveWarnings).toBe(false);
		expect(manager.getConfig().patternRetentionDays).toBe(14);
	});
});
