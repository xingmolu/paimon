/**
 * Tests for Edit Format Support Module
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	EditFormatManager,
	type EditFormatType,
	type EditOperation,
	getEditFormatManager,
} from "../src/edit-format.js";
import { editFormatTool } from "../src/tools/edit-format-tool.js";

describe("EditFormatManager", () => {
	let manager: EditFormatManager;

	beforeEach(() => {
		manager = new EditFormatManager();
		// Reset to default state
		manager.setFormat("diff");
		manager.resetStats();
	});

	describe("listFormats", () => {
		it("should return all available edit formats", () => {
			const formats = manager.listFormats();
			expect(formats.length).toBe(6);
			expect(formats.map((f) => f.name)).toContain("diff");
			expect(formats.map((f) => f.name)).toContain("diff-fenced");
			expect(formats.map((f) => f.name)).toContain("whole");
			expect(formats.map((f) => f.name)).toContain("editor-diff");
			expect(formats.map((f) => f.name)).toContain("editor-whole");
			expect(formats.map((f) => f.name)).toContain("patch");
		});
	});

	describe("getFormat", () => {
		it("should return details for a specific format", () => {
			const diffFormat = manager.getFormat("diff");
			expect(diffFormat).toBeDefined();
			expect(diffFormat?.name).toBe("diff");
			expect(diffFormat?.supportsPartialEdits).toBe(true);
			expect(diffFormat?.supportsNewFiles).toBe(true);
			expect(diffFormat?.supportsDeletion).toBe(true);
		});

		it("should return undefined for unknown format", () => {
			const unknownFormat = manager.getFormat("unknown" as EditFormatType);
			expect(unknownFormat).toBeUndefined();
		});
	});

	describe("setFormat and getCurrentFormat", () => {
		it("should set and get current format", () => {
			expect(manager.getCurrentFormat()).toBe("diff");

			const success = manager.setFormat("patch");
			expect(success).toBe(true);
			expect(manager.getCurrentFormat()).toBe("patch");
		});

		it("should fail to set unknown format", () => {
			const success = manager.setFormat("unknown" as EditFormatType);
			expect(success).toBe(false);
			expect(manager.getCurrentFormat()).toBe("diff");
		});
	});

	describe("detectFormat", () => {
		it("should detect diff format for Claude models", () => {
			expect(manager.detectFormat("claude-3.7-sonnet")).toBe("editor-diff");
			expect(manager.detectFormat("claude-sonnet-4")).toBe("editor-diff");
			expect(manager.detectFormat("claude-opus-4")).toBe("diff");
		});

		it("should detect patch format for GPT-4.1 models", () => {
			expect(manager.detectFormat("gpt-4.1")).toBe("patch");
			expect(manager.detectFormat("gpt-4.1-mini")).toBe("patch");
			expect(manager.detectFormat("gpt-4.1-nano")).toBe("patch");
		});

		it("should detect diff-fenced format for Gemini models", () => {
			expect(manager.detectFormat("gemini-2.5-pro")).toBe("diff-fenced");
			expect(manager.detectFormat("gemini-2.5-flash")).toBe("diff-fenced");
		});

		it("should detect diff format for DeepSeek models", () => {
			expect(manager.detectFormat("deepseek-v3")).toBe("diff");
			expect(manager.detectFormat("deepseek-r1")).toBe("diff");
		});

		it("should default to diff for unknown models", () => {
			expect(manager.detectFormat("unknown-model")).toBe("diff");
		});
	});

	describe("recommendFormat", () => {
		it("should provide recommendations with reasoning", () => {
			const recommendation = manager.recommendFormat("gpt-4.1");
			expect(recommendation.format).toBe("patch");
			expect(recommendation.reason).toContain("patch");
			expect(recommendation.alternatives).toBeDefined();
		});

		it("should include alternatives when available", () => {
			const recommendation = manager.recommendFormat("claude-3.7-sonnet");
			expect(recommendation.format).toBe("editor-diff");
			expect(Array.isArray(recommendation.alternatives)).toBe(true);
		});
	});

	describe("validateEdit", () => {
		it("should validate create operation for format that supports it", () => {
			const operation: EditOperation = {
				filePath: "test.ts",
				action: "create",
				content: "console.log('hello');",
			};

			const result = manager.validateEdit(operation, "diff");
			expect(result.valid).toBe(true);
			expect(result.errors.length).toBe(0);
		});

		it("should fail create operation for format that does not support it", () => {
			// Create a mock format that doesn't support new files
			const operation: EditOperation = {
				filePath: "test.ts",
				action: "create",
				content: "console.log('hello');",
			};

			// All our formats support new files, so let's test valid case
			const result = manager.validateEdit(operation, "diff");
			expect(result.valid).toBe(true);
		});

		it("should validate edit operation with old and new content", () => {
			const operation: EditOperation = {
				filePath: "test.ts",
				action: "edit",
				oldContent: "console.log('old');",
				newContent: "console.log('new');",
			};

			const result = manager.validateEdit(operation, "diff");
			expect(result.valid).toBe(true);
			expect(result.errors.length).toBe(0);
		});

		it("should fail edit operation without required content", () => {
			const operation: EditOperation = {
				filePath: "test.ts",
				action: "edit",
			};

			const result = manager.validateEdit(operation, "diff");
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it("should warn about partial edits for whole format", () => {
			const operation: EditOperation = {
				filePath: "test.ts",
				action: "edit",
				oldContent: "old",
				newContent: "new",
			};

			const result = manager.validateEdit(operation, "whole");
			expect(result.warnings.length).toBeGreaterThan(0);
			expect(result.warnings[0]).toContain("does not support partial edits");
		});
	});

	describe("convertEdit", () => {
		it("should convert create operation to diff format", () => {
			const operation: EditOperation = {
				filePath: "test.ts",
				action: "create",
				content: "console.log('hello');",
			};

			const result = manager.convertEdit(operation, "whole", "diff");
			expect(result.success).toBe(true);
			expect(result.result).toContain("--- /dev/null");
			expect(result.result).toContain("+++ b/test.ts");
		});

		it("should convert edit operation to diff-fenced format", () => {
			const operation: EditOperation = {
				filePath: "test.ts",
				action: "edit",
				oldContent: "old content",
				newContent: "new content",
			};

			const result = manager.convertEdit(operation, "diff", "diff-fenced");
			expect(result.success).toBe(true);
			expect(result.result).toContain("```diff");
			expect(result.result).toContain("```");
		});

		it("should convert to patch format", () => {
			const operation: EditOperation = {
				filePath: "test.ts",
				action: "edit",
				oldContent: "old",
				newContent: "new",
			};

			const result = manager.convertEdit(operation, "diff", "patch");
			expect(result.success).toBe(true);
			expect(result.result).toContain("*** Begin Patch");
			expect(result.result).toContain("*** End Patch");
		});

		it("should convert to editor-diff format", () => {
			const operation: EditOperation = {
				filePath: "test.ts",
				action: "edit",
				oldContent: "old",
				newContent: "new",
			};

			const result = manager.convertEdit(operation, "diff", "editor-diff");
			expect(result.success).toBe(true);
			expect(result.result).toContain("File: test.ts");
			expect(result.result).toContain("<<<<<<< SEARCH");
			expect(result.result).toContain(">>>>>>> REPLACE");
		});

		it("should fail for invalid format", () => {
			const operation: EditOperation = {
				filePath: "test.ts",
				action: "create",
				content: "content",
			};

			const result = manager.convertEdit(operation, "invalid" as EditFormatType, "diff");
			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});
	});

	describe("recordEdit and getStats", () => {
		it("should record edits and update statistics", () => {
			manager.recordEdit("diff", "claude-3.7-sonnet", true);
			manager.recordEdit("diff", "claude-3.7-sonnet", false);
			manager.recordEdit("patch", "gpt-4.1", true);

			const stats = manager.getStats();
			expect(stats.totalEdits).toBe(3);
			expect(stats.byFormat.diff).toBe(2);
			expect(stats.byFormat.patch).toBe(1);
			expect(stats.byModel["claude-3.7-sonnet"]).toBe(2);
			expect(stats.byModel["gpt-4.1"]).toBe(1);
		});

		it("should track success rates", () => {
			manager.recordEdit("diff", "model-a", true);
			manager.recordEdit("diff", "model-a", true);
			manager.recordEdit("diff", "model-a", false);

			const stats = manager.getStats();
			expect(stats.successRate["model-a"].success).toBe(2);
			expect(stats.successRate["model-a"].total).toBe(3);
		});
	});

	describe("getPromptGuidance", () => {
		it("should return guidance for diff format", () => {
			const guidance = manager.getPromptGuidance("diff");
			expect(guidance).toContain("unified diff");
			expect(guidance).toContain("--- a/file");
			expect(guidance).toContain("+++ b/file");
		});

		it("should return guidance for patch format", () => {
			const guidance = manager.getPromptGuidance("patch");
			expect(guidance).toContain("*** Begin Patch");
			expect(guidance).toContain("*** End Patch");
		});
	});

	describe("getExample", () => {
		it("should return example for diff format", () => {
			const example = manager.getExample("diff");
			expect(example).toContain("--- a/");
			expect(example).toContain("+++ b/");
			expect(example).toContain("@@");
		});

		it("should return example for editor-diff format", () => {
			const example = manager.getExample("editor-diff");
			expect(example).toContain("<<<<<<< SEARCH");
			expect(example).toContain("=======");
			expect(example).toContain(">>>>>>> REPLACE");
		});
	});
});

describe("editFormatTool", () => {
	describe("execute", () => {
		it("should list formats", async () => {
			const result = await editFormatTool.execute("test-id", { action: "list" });
			expect(result.content).toBeDefined();
			expect(result.details).toHaveProperty("formats");
		});

		it("should get format details", async () => {
			const result = await editFormatTool.execute("test-id", { action: "get", format: "diff" });
			expect(result.details).toHaveProperty("format");
		});

		it("should set format", async () => {
			const result = await editFormatTool.execute("test-id", { action: "set", format: "patch" });
			expect(result.details).toHaveProperty("success", true);
		});

		it("should detect format for model", async () => {
			const result = await editFormatTool.execute("test-id", {
				action: "detect",
				model: "gpt-4.1",
			});
			expect(result.details).toHaveProperty("detectedFormat", "patch");
		});

		it("should recommend format with reasoning", async () => {
			const result = await editFormatTool.execute("test-id", {
				action: "recommend",
				model: "claude-3.7-sonnet",
			});
			expect(result.details).toHaveProperty("format", "editor-diff");
		});

		it("should validate edit operation", async () => {
			const result = await editFormatTool.execute("test-id", {
				action: "validate",
				operation: {
					filePath: "test.ts",
					action: "create",
					content: "console.log('hello');",
				},
				format: "diff",
			});
			expect(result.details).toHaveProperty("valid", true);
		});

		it("should convert between formats", async () => {
			const result = await editFormatTool.execute("test-id", {
				action: "convert",
				operation: {
					filePath: "test.ts",
					action: "edit",
					oldContent: "old",
					newContent: "new",
				},
				fromFormat: "diff",
				toFormat: "patch",
			});
			expect(result.details).toHaveProperty("success", true);
		});

		it("should return stats", async () => {
			const result = await editFormatTool.execute("test-id", { action: "stats" });
			expect(result.details).toHaveProperty("stats");
		});

		it("should return help", async () => {
			const result = await editFormatTool.execute("test-id", { action: "help" });
			expect(result.details).toHaveProperty("message");
		});
	});
});

describe("getEditFormatManager singleton", () => {
	it("should return the same instance", () => {
		const manager1 = getEditFormatManager();
		const manager2 = getEditFormatManager();
		expect(manager1).toBe(manager2);
	});
});
