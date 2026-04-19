import { afterEach, describe, expect, it } from "vitest";

import { getSelfImprovementEngine } from "../self-improvement-engine.js";
import { selfImprovementTool } from "./self-improvement-tool.js";

describe("selfImprovement tool", () => {
	afterEach(() => {
		const engine = getSelfImprovementEngine();
		engine.updateConfig({
			enabled: true,
			scanOnStartup: false,
			minConfidence: 50,
			maxSuggestions: 20,
			scanPatterns: ["src/**/*.ts"],
			excludePatterns: ["**/*.test.ts", "**/*.d.ts"],
		});
	});

	it("returns actual configuration for config action", async () => {
		const engine = getSelfImprovementEngine();
		engine.updateConfig({
			minConfidence: 77,
			maxSuggestions: 11,
			excludePatterns: ["**/*.generated.ts"],
		});

		const result = await selfImprovementTool.execute("test-call", {
			action: "config",
		});

		expect(result.details.success).toBe(true);
		const firstContent = result.content[0];
		expect(firstContent?.type).toBe("text");
		if (!firstContent || firstContent.type !== "text") {
			throw new Error("Expected text content from selfImprovement tool");
		}

		expect(firstContent.text).toContain("Retrieved configuration");
		expect(firstContent.text).toContain("Self-Improvement Engine Configuration");
		expect(firstContent.text).toContain('"minConfidence": 77');
		expect(firstContent.text).toContain('"maxSuggestions": 11');
		expect(firstContent.text).toContain('"**/*.generated.ts"');
		expect(firstContent.text).not.toContain("Self-Improvement Engine Statistics");
	});
});
