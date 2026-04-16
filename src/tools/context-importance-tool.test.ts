import { describe, expect, it } from "vitest";

import { contextImportanceTool } from "./context-importance-tool.js";

describe("contextImportance tool update-config", () => {
	it("should update numeric, boolean, and map-based config fields", async () => {
		const result = await contextImportanceTool.execute("test-call", {
			action: "update-config",
			minKeepScore: 55,
			recencyWeight: 0.45,
			analyzeToolSuccess: false,
			roleWeights: {
				assistant: 65,
				tool_result: 35,
			},
			contentTypeWeights: {
				plan_output: 85,
				tool_result: 25,
			},
		});

		expect(result.details.success).toBe(true);
		const config = result.details.data as {
			minKeepScore: number;
			recencyWeight: number;
			analyzeToolSuccess: boolean;
			roleWeights: Map<string, number>;
			contentTypeWeights: Map<string, number>;
		};
		expect(config.minKeepScore).toBe(55);
		expect(config.recencyWeight).toBe(0.45);
		expect(config.analyzeToolSuccess).toBe(false);
		expect(config.roleWeights.get("assistant")).toBe(65);
		expect(config.roleWeights.get("tool_result")).toBe(35);
		expect(config.contentTypeWeights.get("plan_output")).toBe(85);
		expect(config.contentTypeWeights.get("tool_result")).toBe(25);
		const firstContent = result.content[0];
		expect(firstContent?.type).toBe("text");
		if (!firstContent || firstContent.type !== "text") {
			throw new Error("Expected text content from contextImportance tool");
		}
		expect(firstContent.text).toContain("Configuration updated successfully");
		expect(firstContent.text).toContain('"minKeepScore": 55');
		expect(firstContent.text).toContain('"assistant": 65');
	});

	it("should reject invalid config keys", async () => {
		const result = await contextImportanceTool.execute("test-call", {
			action: "update-config",
			roleWeights: {
				invalidRole: 99,
			},
		});

		expect(result.details.success).toBe(false);
		expect(result.details.error).toContain("Invalid roleWeights key");
	});

	it("should reject empty update-config requests", async () => {
		const result = await contextImportanceTool.execute("test-call", {
			action: "update-config",
		});

		expect(result.details.success).toBe(false);
		expect(result.details.error).toContain("No valid configuration fields provided");
	});
});
