/**
 * Edit Format Tool Wrapper
 *
 * Wraps the EditFormatManager as an AgentTool for use in the Paimon agent.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type EditFormatType,
	type EditOperation,
	getEditFormatManager,
	EditFormatManager,
} from "../edit-format.js";

type EditFormatAction =
	| "list"
	| "get"
	| "set"
	| "detect"
	| "recommend"
	| "formats"
	| "format"
	| "validate"
	| "convert"
	| "stats"
	| "config"
	| "help";

interface ToolParams {
	action: EditFormatAction;
	format?: EditFormatType;
	model?: string;
	operation?: EditOperation;
	fromFormat?: EditFormatType;
	toFormat?: EditFormatType;
}

function formatResult(result: Record<string, unknown>): string {
	return `## Edit Format Result\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
}

/**
 * Edit format tool for managing code edit formats for different LLMs
 */
export const editFormatTool: AgentTool = {
	name: "editFormat",
	label: "Edit Format",
	description: `Manage edit formats for code modifications (Aider Pattern).

Actions:
- list/formats: List all available edit formats
- get/format [format]: Get details of a format (current if not specified)
- set <format>: Set the default format
- detect <model>: Detect best format for a model
- recommend <model>: Get format recommendation with reasoning
- validate <operation> [format]: Validate an edit operation
- convert <operation> <fromFormat> <toFormat>: Convert between formats
- stats: View edit statistics
- config: View current configuration
- help: Show this help

Formats:
- diff: Standard unified diff format
- diff-fenced: Diff with markdown code fences
- whole: Full file replacement
- editor-diff: Editor-style diff for architect mode
- editor-whole: Editor-style whole file for architect mode
- patch: OpenAI GPT-4.1 patch format

Example usage:
editFormat({action: 'list'})
editFormat({action: 'detect', model: 'gpt-4.1'})
editFormat({action: 'recommend', model: 'claude-3.7-sonnet'})
`,
	parameters: Type.Object({
		action: Type.Union(
			[
				Type.Literal("list"),
				Type.Literal("get"),
				Type.Literal("set"),
				Type.Literal("detect"),
				Type.Literal("recommend"),
				Type.Literal("formats"),
				Type.Literal("format"),
				Type.Literal("validate"),
				Type.Literal("convert"),
				Type.Literal("stats"),
				Type.Literal("config"),
				Type.Literal("help"),
			],
			{ description: "Action to perform" },
		),
		format: Type.Optional(
			Type.String({
				description: "Format name (diff, diff-fenced, whole, editor-diff, editor-whole, patch)",
			}),
		),
		model: Type.Optional(Type.String({ description: "Model name for detection/recommendation" })),
		operation: Type.Optional(
			Type.Object({
				filePath: Type.String(),
				action: Type.Union([
					Type.Literal("create"),
					Type.Literal("edit"),
					Type.Literal("delete"),
				]),
				content: Type.Optional(Type.String()),
				oldContent: Type.Optional(Type.String()),
				newContent: Type.Optional(Type.String()),
			}),
		),
		fromFormat: Type.Optional(Type.String({ description: "Source format for conversion" })),
		toFormat: Type.Optional(Type.String({ description: "Target format for conversion" })),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const manager = getEditFormatManager();
		const { action, format, model, operation, fromFormat, toFormat } = params as ToolParams;

		let result: Record<string, unknown>;

		switch (action) {
			case "list":
			case "formats": {
				const formats = manager.listFormats();
				result = {
					formats: formats.map((f) => ({
						name: f.name,
						description: f.description,
						supportsPartialEdits: f.supportsPartialEdits,
						supportsNewFiles: f.supportsNewFiles,
						supportsDeletion: f.supportsDeletion,
						models: f.models,
					})),
				};
				break;
			}

			case "get":
			case "format": {
				const formatName = format || manager.getCurrentFormat();
				const formatInfo = manager.getFormat(formatName);
				if (!formatInfo) {
					result = { error: `Unknown format: ${formatName}` };
				} else {
					result = {
						format: formatInfo,
						current: manager.getCurrentFormat() === formatName,
					};
				}
				break;
			}

			case "set": {
				if (!format) {
					result = { error: "Format parameter required for set action" };
				} else {
					const success = manager.setFormat(format);
					result = {
						success,
						currentFormat: manager.getCurrentFormat(),
						message: success
							? `Format set to ${format}`
							: `Failed to set format to ${format}`,
					};
				}
				break;
			}

			case "detect": {
				if (!model) {
					result = { error: "Model parameter required for detect action" };
				} else {
					const detected = manager.detectFormat(model);
					result = {
						model,
						detectedFormat: detected,
						formatDetails: manager.getFormat(detected),
					};
				}
				break;
			}

			case "recommend": {
				if (!model) {
					result = { error: "Model parameter required for recommend action" };
				} else {
					const recommendation = manager.recommendFormat(model);
					result = {
						model,
						...recommendation,
						formatDetails: manager.getFormat(recommendation.format),
					};
				}
				break;
			}

			case "validate": {
				if (!operation) {
					result = { error: "Operation parameter required for validate action" };
				} else {
					const validationResult = manager.validateEdit(operation, format);
					result = {
						operation,
						format: format || manager.getCurrentFormat(),
						...validationResult,
					};
				}
				break;
			}

			case "convert": {
				if (!operation || !fromFormat || !toFormat) {
					result = {
						error:
							"Operation, fromFormat, and toFormat parameters required for convert action",
					};
				} else {
					const convertResult = manager.convertEdit(operation, fromFormat, toFormat);
					result = {
						operation,
						fromFormat,
						toFormat,
						...convertResult,
					};
				}
				break;
			}

			case "stats": {
				result = {
					stats: manager.getStats(),
					currentFormat: manager.getCurrentFormat(),
				};
				break;
			}

			case "config": {
				result = {
					config: manager.getConfig(),
				};
				break;
			}

			case "help": {
				result = {
					message: "Edit Format Tool - Manage code edit formats for different LLMs",
					actions: [
						"list/formats - List all available edit formats",
						"get/format [format] - Get details of a format (current if not specified)",
						"set <format> - Set the default format",
						"detect <model> - Detect best format for a model",
						"recommend <model> - Get format recommendation with reasoning",
						"validate <operation> [format] - Validate an edit operation",
						"convert <operation> <fromFormat> <toFormat> - Convert between formats",
						"stats - View edit statistics",
						"config - View current configuration",
						"help - Show this help",
					],
					formats: manager.listFormats().map((f) => f.name),
				};
				break;
			}

			default:
				result = { error: `Unknown action: ${action}` };
		}

		return {
			content: [{ type: "text", text: formatResult(result) }],
			details: result,
		};
	},
};

export { getEditFormatManager, EditFormatManager };

export default editFormatTool;