/**
 * Edit Format Support Module (Aider Pattern)
 *
 * Manages different edit formats for code modifications:
 * - diff: Standard unified diff format
 * - diff-fenced: Diff with markdown code fences
 * - whole: Full file replacement
 * - editor-diff: Editor-style diff for architect mode
 * - editor-whole: Editor-style whole file for architect mode
 * - patch: OpenAI GPT-4.1 patch format
 *
 * Inspired by Aider's edit format system for supporting different LLM capabilities
 */

import * as fs from "node:fs";
import * as path from "node:path";

// Types
export type EditFormatType =
	| "diff"
	| "diff-fenced"
	| "whole"
	| "editor-diff"
	| "editor-whole"
	| "patch";

export interface EditFormat {
	name: EditFormatType;
	description: string;
	fileExtension: string;
	supportsPartialEdits: boolean;
	supportsNewFiles: boolean;
	supportsDeletion: boolean;
	models: string[]; // Models that work well with this format
	example: string;
	promptGuidance: string;
}

export interface EditFormatConfig {
	defaultFormat: EditFormatType;
	autoDetect: boolean;
	preferredByModel: Record<string, EditFormatType>;
}

export interface EditOperation {
	filePath: string;
	action: "create" | "edit" | "delete";
	content?: string;
	oldContent?: string;
	newContent?: string;
}

export interface EditFormatStats {
	totalEdits: number;
	byFormat: Record<string, number>;
	byModel: Record<string, number>;
	successRate: Record<string, { success: number; total: number }>;
	lastEditTime: string;
}

// Default edit formats (based on Aider patterns)
const EDIT_FORMATS: EditFormat[] = [
	{
		name: "diff",
		description: "Standard unified diff format for most LLMs",
		fileExtension: ".diff",
		supportsPartialEdits: true,
		supportsNewFiles: true,
		supportsDeletion: true,
		models: ["claude-3", "claude-sonnet", "claude-opus", "gpt-4", "gpt-4o", "deepseek"],
		example: `--- a/src/file.ts
+++ b/src/file.ts
@@ -1,3 +1,3 @@
 function hello() {
-  console.log("Hello");
+  console.log("Hello, World!");
 }`,
		promptGuidance:
			"Use standard unified diff format with --- a/file and +++ b/file headers. Include @@ line numbers @@ context.",
	},
	{
		name: "diff-fenced",
		description: "Diff format wrapped in markdown code fences for better parsing",
		fileExtension: ".diff",
		supportsPartialEdits: true,
		supportsNewFiles: true,
		supportsDeletion: true,
		models: ["gemini", "qwen", "llama"],
		example: `\`\`\`diff
--- a/src/file.ts
+++ b/src/file.ts
@@ -1,3 +1,3 @@
 function hello() {
-  console.log("Hello");
+  console.log("Hello, World!");
 }
\`\`\``,
		promptGuidance:
			"Wrap the diff in markdown code fences (```diff ... ```). Use standard diff format inside.",
	},
	{
		name: "whole",
		description: "Full file replacement - provide complete new file content",
		fileExtension: ".ts",
		supportsPartialEdits: false,
		supportsNewFiles: true,
		supportsDeletion: false,
		models: ["gpt-3.5", "local-models", "small-models"],
		example: `// filepath: src/file.ts
function hello() {
  console.log("Hello, World!");
}`,
		promptGuidance: "Provide the complete new file content. Start with // filepath: path comment.",
	},
	{
		name: "editor-diff",
		description: "Editor-style diff format for architect mode with clear markers",
		fileExtension: ".diff",
		supportsPartialEdits: true,
		supportsNewFiles: true,
		supportsDeletion: true,
		models: ["architect-mode", "claude-3.7-sonnet"],
		example: `File: src/file.ts
\`\`\`
<<<<<<< SEARCH
function hello() {
  console.log("Hello");
}
=======
function hello() {
  console.log("Hello, World!");
}
>>>>>>> REPLACE
\`\`\``,
		promptGuidance:
			"Use SEARCH/REPLACE blocks with file path header. Include exact content to find and replace.",
	},
	{
		name: "editor-whole",
		description: "Editor-style whole file replacement for architect mode",
		fileExtension: ".ts",
		supportsPartialEdits: false,
		supportsNewFiles: true,
		supportsDeletion: false,
		models: ["architect-mode", "editor-models"],
		example: `File: src/file.ts
\`\`\`typescript
function hello() {
  console.log("Hello, World!");
}
\`\`\``,
		promptGuidance: "Provide the complete file with File: header and code block.",
	},
	{
		name: "patch",
		description: "OpenAI GPT-4.1 patch format for structured edits",
		fileExtension: ".patch",
		supportsPartialEdits: true,
		supportsNewFiles: true,
		supportsDeletion: true,
		models: ["gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano"],
		example: `*** Begin Patch
*** a/src/file.ts
function hello() {
- console.log("Hello");
+ console.log("Hello, World!");
}
*** End Patch`,
		promptGuidance:
			"Use *** Begin Patch and *** End Patch markers. Use - for deletions and + for additions.",
	},
];

const DEFAULT_CONFIG: EditFormatConfig = {
	defaultFormat: "diff",
	autoDetect: true,
	preferredByModel: {
		"claude-3.7-sonnet": "editor-diff",
		"claude-sonnet-4": "editor-diff",
		"claude-opus-4": "diff",
		"gpt-4.1": "patch",
		"gpt-4.1-mini": "patch",
		"gpt-4.1-nano": "patch",
		gemini: "diff-fenced",
		"gemini-2.5-pro": "diff-fenced",
		"gemini-2.5-flash": "diff-fenced",
		qwen: "diff-fenced",
		llama: "diff-fenced",
		deepseek: "diff",
		"deepseek-r1": "diff",
		"deepseek-v3": "diff",
	},
};

let managerInstance: EditFormatManager | null = null;

export class EditFormatManager {
	private config: EditFormatConfig;
	private stats: EditFormatStats;
	private dataPath: string;
	private currentFormat: EditFormatType;

	constructor() {
		this.config = DEFAULT_CONFIG;
		this.currentFormat = this.config.defaultFormat;
		const homeDir = process.env.HOME || ".";
		this.dataPath = path.join(homeDir, ".paimon", "edit-format-stats.json");
		this.stats = {
			totalEdits: 0,
			byFormat: {},
			byModel: {},
			successRate: {},
			lastEditTime: "",
		};
		this.loadData();
	}

	private loadData(): void {
		try {
			if (fs.existsSync(this.dataPath)) {
				const data = JSON.parse(fs.readFileSync(this.dataPath, "utf-8"));
				this.config = { ...DEFAULT_CONFIG, ...data.config };
				this.stats = { ...this.stats, ...data.stats };
				this.currentFormat = this.config.defaultFormat;
			}
		} catch {
			// Use defaults
		}
	}

	private saveData(): void {
		try {
			const dir = path.dirname(this.dataPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(
				this.dataPath,
				JSON.stringify(
					{
						config: this.config,
						stats: this.stats,
					},
					null,
					2,
				),
			);
		} catch (error) {
			console.error("Failed to save edit format data:", error);
		}
	}

	// List all available edit formats
	public listFormats(): EditFormat[] {
		return [...EDIT_FORMATS];
	}

	// Get details of a specific format
	public getFormat(formatName: EditFormatType): EditFormat | undefined {
		return EDIT_FORMATS.find((f) => f.name === formatName);
	}

	// Set the current default format
	public setFormat(format: EditFormatType): boolean {
		if (!EDIT_FORMATS.find((f) => f.name === format)) {
			return false;
		}
		this.currentFormat = format;
		this.config.defaultFormat = format;
		this.saveData();
		return true;
	}

	// Get current format
	public getCurrentFormat(): EditFormatType {
		return this.currentFormat;
	}

	// Detect best format for a given model
	public detectFormat(model: string): EditFormatType {
		const modelLower = model.toLowerCase();

		// Check explicit preferences
		for (const [modelPattern, format] of Object.entries(this.config.preferredByModel)) {
			if (modelLower.includes(modelPattern.toLowerCase())) {
				return format;
			}
		}

		// Auto-detect based on format model lists
		for (const format of EDIT_FORMATS) {
			for (const formatModel of format.models) {
				if (modelLower.includes(formatModel.toLowerCase())) {
					return format.name;
				}
			}
		}

		// Default to diff
		return this.config.defaultFormat;
	}

	// Get recommended format for a model with explanation
	public recommendFormat(model: string): {
		format: EditFormatType;
		reason: string;
		alternatives: EditFormatType[];
	} {
		const detected = this.detectFormat(model);
		const format = this.getFormat(detected);

		if (!format) {
			return {
				format: this.config.defaultFormat,
				reason: "No specific recommendation available, using default",
				alternatives: ["diff", "whole"],
			};
		}

		// Find alternatives that also support this model
		const alternatives: EditFormatType[] = [];
		for (const f of EDIT_FORMATS) {
			if (f.name !== detected) {
				for (const m of f.models) {
					if (model.toLowerCase().includes(m.toLowerCase())) {
						alternatives.push(f.name);
						break;
					}
				}
			}
		}

		return {
			format: detected,
			reason: `${format.description}. Best for models like: ${format.models.join(", ")}`,
			alternatives,
		};
	}

	// Validate an edit operation for a format
	public validateEdit(
		operation: EditOperation,
		formatName?: EditFormatType,
	): { valid: boolean; errors: string[]; warnings: string[] } {
		const format = this.getFormat(formatName || this.currentFormat);
		const errors: string[] = [];
		const warnings: string[] = [];

		if (!format) {
			return { valid: false, errors: ["Unknown format"], warnings: [] };
		}

		// Check new file support
		if (operation.action === "create" && !format.supportsNewFiles) {
			errors.push(`Format '${format.name}' does not support creating new files`);
		}

		// Check deletion support
		if (operation.action === "delete" && !format.supportsDeletion) {
			errors.push(`Format '${format.name}' does not support file deletion`);
		}

		// Check partial edit support
		if (
			operation.action === "edit" &&
			operation.oldContent &&
			operation.newContent &&
			!format.supportsPartialEdits
		) {
			warnings.push(
				`Format '${format.name}' does not support partial edits. Consider using whole file replacement.`,
			);
		}

		// Check required content
		if (operation.action === "create" && !operation.content) {
			errors.push("Create operation requires 'content'");
		}

		if (operation.action === "edit" && (!operation.oldContent || !operation.newContent)) {
			if (format.supportsPartialEdits) {
				errors.push("Edit operation requires 'oldContent' and 'newContent' for partial edits");
			} else if (!operation.content) {
				errors.push("Edit operation requires 'content' for whole file replacement");
			}
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		};
	}

	// Convert between formats
	public convertEdit(
		operation: EditOperation,
		fromFormat: EditFormatType,
		toFormat: EditFormatType,
	): { success: boolean; result?: string; error?: string } {
		const sourceFormat = this.getFormat(fromFormat);
		const targetFormat = this.getFormat(toFormat);

		if (!sourceFormat || !targetFormat) {
			return { success: false, error: "Invalid format specified" };
		}

		try {
			let result = "";

			switch (toFormat) {
				case "diff":
					result = this.toDiffFormat(operation);
					break;
				case "diff-fenced":
					result = "```diff\n" + this.toDiffFormat(operation) + "\n```";
					break;
				case "whole":
					result = this.toWholeFormat(operation);
					break;
				case "editor-diff":
					result = this.toEditorDiffFormat(operation);
					break;
				case "editor-whole":
					result = this.toEditorWholeFormat(operation);
					break;
				case "patch":
					result = this.toPatchFormat(operation);
					break;
				default:
					return { success: false, error: "Unsupported target format" };
			}

			// Update stats
			this.recordEdit(toFormat, "converted");

			return { success: true, result };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Conversion failed",
			};
		}
	}

	private toDiffFormat(operation: EditOperation): string {
		const lines: string[] = [];

		if (operation.action === "create") {
			lines.push(`--- /dev/null`);
			lines.push(`+++ b/${operation.filePath}`);
			if (operation.content) {
				const contentLines = operation.content.split("\n");
				lines.push(`@@ -0,0 +1,${contentLines.length} @@`);
				for (const line of contentLines) {
					lines.push(`+${line}`);
				}
			}
		} else if (operation.action === "delete") {
			lines.push(`--- a/${operation.filePath}`);
			lines.push(`+++ /dev/null`);
			lines.push(`@@ -1,0 +0,0 @@`);
		} else if (operation.action === "edit") {
			lines.push(`--- a/${operation.filePath}`);
			lines.push(`+++ b/${operation.filePath}`);
			if (operation.oldContent && operation.newContent) {
				const oldLines = operation.oldContent.split("\n");
				const newLines = operation.newContent.split("\n");
				lines.push(`@@ -1,${oldLines.length} +1,${newLines.length} @@`);
				for (const line of oldLines) {
					lines.push(`-${line}`);
				}
				for (const line of newLines) {
					lines.push(`+${line}`);
				}
			}
		}

		return lines.join("\n");
	}

	private toWholeFormat(operation: EditOperation): string {
		const lines: string[] = [];
		lines.push(`// filepath: ${operation.filePath}`);
		if (operation.content || operation.newContent) {
			lines.push(operation.content || operation.newContent || "");
		}
		return lines.join("\n");
	}

	private toEditorDiffFormat(operation: EditOperation): string {
		const lines: string[] = [];
		lines.push(`File: ${operation.filePath}`);
		lines.push("```");

		if (operation.action === "edit" && operation.oldContent && operation.newContent) {
			lines.push("<<<<<<< SEARCH");
			lines.push(operation.oldContent);
			lines.push("=======");
			lines.push(operation.newContent);
			lines.push(">>>>>>> REPLACE");
		} else if (operation.action === "create" && operation.content) {
			lines.push("<<<<<<< SEARCH");
			lines.push("=======");
			lines.push(operation.content);
			lines.push(">>>>>>> REPLACE");
		}

		lines.push("```");
		return lines.join("\n");
	}

	private toEditorWholeFormat(operation: EditOperation): string {
		const lines: string[] = [];
		lines.push(`File: ${operation.filePath}`);
		lines.push("```typescript");
		if (operation.content || operation.newContent) {
			lines.push(operation.content || operation.newContent || "");
		}
		lines.push("```");
		return lines.join("\n");
	}

	private toPatchFormat(operation: EditOperation): string {
		const lines: string[] = [];
		lines.push("*** Begin Patch");
		lines.push(`*** ${operation.filePath}`);

		if (operation.action === "create" && operation.content) {
			const contentLines = operation.content.split("\n");
			for (const line of contentLines) {
				lines.push(`+ ${line}`);
			}
		} else if (operation.action === "delete") {
			lines.push("*** DELETE FILE ***");
		} else if (operation.action === "edit" && operation.oldContent && operation.newContent) {
			const oldLines = operation.oldContent.split("\n");
			const newLines = operation.newContent.split("\n");

			// Simple line-by-line diff
			const maxLen = Math.max(oldLines.length, newLines.length);
			for (let i = 0; i < maxLen; i++) {
				if (i < oldLines.length && i < newLines.length) {
					if (oldLines[i] !== newLines[i]) {
						lines.push(`- ${oldLines[i]}`);
						lines.push(`+ ${newLines[i]}`);
					} else {
						lines.push(`  ${oldLines[i]}`);
					}
				} else if (i < oldLines.length) {
					lines.push(`- ${oldLines[i]}`);
				} else if (i < newLines.length) {
					lines.push(`+ ${newLines[i]}`);
				}
			}
		}

		lines.push("*** End Patch");
		return lines.join("\n");
	}

	// Record an edit for statistics
	public recordEdit(format: EditFormatType, model?: string, success: boolean = true): void {
		this.stats.totalEdits++;
		this.stats.byFormat[format] = (this.stats.byFormat[format] || 0) + 1;

		if (model) {
			this.stats.byModel[model] = (this.stats.byModel[model] || 0) + 1;

			if (!this.stats.successRate[model]) {
				this.stats.successRate[model] = { success: 0, total: 0 };
			}
			this.stats.successRate[model].total++;
			if (success) {
				this.stats.successRate[model].success++;
			}
		}

		this.stats.lastEditTime = new Date().toISOString();
		this.saveData();
	}

	// Get statistics
	public getStats(): EditFormatStats {
		return { ...this.stats };
	}

	// Get configuration
	public getConfig(): EditFormatConfig {
		return { ...this.config };
	}

	// Update configuration
	public updateConfig(updates: Partial<EditFormatConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveData();
	}

	// Reset statistics
	public resetStats(): void {
		this.stats = {
			totalEdits: 0,
			byFormat: {},
			byModel: {},
			successRate: {},
			lastEditTime: "",
		};
		this.saveData();
	}

	// Get prompt guidance for current format
	public getPromptGuidance(formatName?: EditFormatType): string {
		const format = this.getFormat(formatName || this.currentFormat);
		return format?.promptGuidance || "";
	}

	// Get example for a format
	public getExample(formatName?: EditFormatType): string {
		const format = this.getFormat(formatName || this.currentFormat);
		return format?.example || "";
	}
}

// Get or create singleton instance
export function getEditFormatManager(): EditFormatManager {
	if (!managerInstance) {
		managerInstance = new EditFormatManager();
	}
	return managerInstance;
}

// Tool interface for agent (defined in separate tool file using TypeBox)
// See src/tools/edit-format-tool.ts

export default EditFormatManager;