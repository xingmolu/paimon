import { beforeEach, describe, expect, it } from "vitest";
import { resetOptimizationDashboardManager } from "../src/optimization-dashboard.js";
import { optimizationDashboardTool } from "../src/tools/optimization-dashboard-tool.js";

describe("optimizationDashboardTool", () => {
	beforeEach(() => {
		resetOptimizationDashboardManager();
	});

	it("returns a report", async () => {
		const result = await optimizationDashboardTool.execute("test", { action: "report" });
		expect(result.content[0]?.type).toBe("text");
		expect(String(result.content[0]?.text)).toContain("Evolution Optimization Dashboard");
	});

	it("requires compare parameters", async () => {
		const result = await optimizationDashboardTool.execute("test", { action: "compare" });
		expect(String(result.content[0]?.text)).toContain("compare requires successRate");
	});

	it("compares a mixed session as average when signals are split", async () => {
		const result = await optimizationDashboardTool.execute("test", {
			action: "compare",
			successRate: 95,
			avgTime: 600000,
			errorCount: 1,
			capabilitiesUsed: 12,
		});
		const comparison = JSON.parse(String(result.content[0]?.text)) as {
			rating: string;
			delta: { successRate: number; avgTime: number; errorCount: number; capabilitiesUsed: number };
		};
		expect(comparison.rating).toBe("average");
		expect(comparison.delta.avgTime).toBeLessThan(0);
		expect(
			comparison.delta.successRate > 0 ||
				comparison.delta.errorCount > 0 ||
				comparison.delta.capabilitiesUsed > 0,
		).toBe(true);
	});

	it("updates config with partial values", async () => {
		const result = await optimizationDashboardTool.execute("test", {
			action: "update-config",
			historySize: 25,
		});
		expect(String(result.content[0]?.text)).toContain('"historySize": 25');
	});
});
