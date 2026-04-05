/**
 * Clipboard Tool
 *
 * Tool for working with LLM web chats when API access isn't available or is cost-prohibitive.
 * Provides clipboard context generation for copying to web LLM and paste parsing for
 * applying web LLM responses to files.
 *
 * Inspired by Aider's copy/paste with web chat pattern:
 * https://aider.chat/docs/usage/copypaste.html
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	ClipboardManager,
	getClipboardManager,
	resetClipboardManager,
} from "../clipboard-manager.js";
import type { ParsedEdit } from "../clipboard-manager.js";

interface ClipboardToolArgs {
	action: string;
	instructions?: string;
	content?: string;
	edits?: Array<{
		filePath: string;
		action: "create" | "edit" | "delete";
		content?: string;
		oldContent?: string;
		newContent?: string;
	}>;
	file?: string;
	readOnly?: boolean;
	enabled?: boolean;
	includeRepoMap?: boolean;
	includeInstructions?: boolean;
	editFormat?: "editor-diff" | "editor-whole" | "auto";
}

const HELP_TEXT = `
Clipboard Tool - Work with LLM web chats

This tool enables working with LLM web chats (like ChatGPT, Claude web) when
API access isn't available or is cost-prohibitive. You can copy code context
to your clipboard, paste it into a web LLM, and then paste the LLM's response
back to apply changes.

Actions:
  copy-context    Copy tracked files and repo map to clipboard
  paste           Parse LLM response from clipboard for edits
  apply           Apply parsed edits to files
  add             Add a file to track (use readOnly: true for read-only)
  remove          Remove a file from tracking
  clear           Clear all tracked files
  mode            Toggle or set copy/paste mode (automatic clipboard sync)
  status          View current status and tracked files
  stats           View usage statistics
  config          View or update configuration
  reset           Reset to defaults
  help            Show this help message

Workflow:
  1. Add files to track: clipboard({action: 'add', file: 'src/app.ts'})
  2. Copy context: clipboard({action: 'copy-context', instructions: 'Add auth'})
  3. Paste into LLM web chat and get response
  4. Copy LLM response from web chat
  5. Parse and apply: clipboard({action: 'paste'}) then clipboard({action: 'apply'})

Copy/Paste Mode:
  When enabled, clipboard is automatically synced:
  - Files are copied when added
  - Clipboard is monitored for LLM responses
  
  Enable: clipboard({action: 'mode', enabled: true})

Example LLM Response Formats:
  CREATE: new-file.ts
  \`\`\`typescript
  // new file content
  \`\`\`

  DELETE: old-file.ts

  \`\`\`src/app.ts
  // original code
  \`\`\`
  →
  \`\`\`src/app.ts
  // new code
  \`\`\`

Learn more: https://aider.chat/docs/usage/copypaste.html`;

async function handleClipboardToolCall(args: ClipboardToolArgs): Promise<string> {
	const manager = getClipboardManager();

	switch (args.action) {
		case "copy-context": {
			const context = manager.copyContext(args.instructions);
			const totalFiles = context.files.length + context.readOnlyFiles.length;

			if (totalFiles === 0) {
				return `Copied context to clipboard with ${context.readOnlyFiles.length} read-only files.\nUse 'add' action to add files first.`;
			}

			return `Copied context to clipboard:\n- ${context.files.length} editable files\n- ${context.readOnlyFiles.length} read-only files\n- ${args.instructions ? "With instructions" : "No instructions"}\n- Timestamp: ${context.timestamp}\n\nPaste into your LLM web chat (e.g., ChatGPT, Claude web) and ask for code changes.\nThen use 'paste' action to apply the LLM's response.`;
		}

		case "paste": {
			const edits = manager.paste(args.content);

			if (edits.length === 0) {
				return "No edits found in clipboard content.\n\nExpected formats:\n- CREATE: filepath followed by code block\n- DELETE: filepath\n- File blocks with arrow notation for edits\n\nMake sure the LLM response contains properly formatted code changes.";
			}

			let result = `Parsed ${edits.length} edit(s) from clipboard:\n\n`;
			for (const edit of edits) {
				result += `- ${edit.action.toUpperCase()}: ${edit.filePath}\n`;
			}
			result +=
				"\nUse 'apply' action to apply these edits, or use 'apply' with 'edits' parameter for custom edits.";

			return result;
		}

		case "apply": {
			let edits: ParsedEdit[] = [];

			// Use provided edits or parse from clipboard
			if (args.edits && Array.isArray(args.edits)) {
				edits = args.edits as ParsedEdit[];
			} else {
				// Parse from clipboard
				edits = manager.parsePasteContent(args.content);
			}

			if (edits.length === 0) {
				return "No edits to apply. Use 'paste' first to parse LLM response.";
			}

			const results = manager.applyEdits(edits);

			let output = `Applied ${edits.length} edit(s):\n\n`;
			let successCount = 0;
			for (const result of results) {
				if (result.success) {
					successCount++;
					output += `✓ ${result.message}\n`;
				} else {
					output += `✗ ${result.message}\n`;
				}
			}

			output += `\n${successCount}/${edits.length} successful`;
			return output;
		}

		case "add": {
			if (!args.file) {
				return "Error: 'file' parameter required.";
			}

			manager.addFile(args.file, args.readOnly || false);
			const files = manager.getAddedFiles();
			const readOnlyFiles = manager.getReadOnlyFiles();

			return `Added ${args.file} (${args.readOnly ? "read-only" : "editable"}).\nTotal: ${files.length} editable files, ${readOnlyFiles.length} read-only files.`;
		}

		case "remove": {
			if (!args.file) {
				return "Error: 'file' parameter required.";
			}

			manager.removeFile(args.file);
			const files = manager.getAddedFiles();
			const readOnlyFiles = manager.getReadOnlyFiles();

			return `Removed ${args.file}.\nRemaining: ${files.length} editable files, ${readOnlyFiles.length} read-only files.`;
		}

		case "clear": {
			manager.clearFiles();
			return "Cleared all tracked files.";
		}

		case "mode": {
			if (args.enabled === undefined) {
				// Toggle
				if (manager.isCopyPasteMode()) {
					manager.disableCopyPasteMode();
					return "Copy/paste mode disabled.";
				}
				manager.enableCopyPasteMode();
				return "Copy/paste mode enabled.\n\nFiles will be automatically copied to clipboard when added.\nThe clipboard will be monitored for LLM responses.\n\nUse 'mode' with 'enabled: false' to disable.";
			}

			if (args.enabled) {
				manager.enableCopyPasteMode();
				return "Copy/paste mode enabled.";
			}
			manager.disableCopyPasteMode();
			return "Copy/paste mode disabled.";
		}

		case "status": {
			const files = manager.getAddedFiles();
			const readOnlyFiles = manager.getReadOnlyFiles();
			const config = manager.getConfig();

			let status = `Clipboard Manager Status\n\nMode: ${config.copyPasteMode ? "Copy/Paste (active)" : "Manual"}\nEnabled: ${config.enabled ? "Yes" : "No"}\nEdit Format: ${config.editFormat}\n\nTracked Files:\n- Editable: ${files.length}\n- Read-only: ${readOnlyFiles.length}`;

			if (files.length > 0) {
				status += "\n\nEditable Files:";
				for (const file of files.slice(0, 5)) {
					status += `\n  - ${file}`;
				}
				if (files.length > 5) {
					status += `\n  ... and ${files.length - 5} more`;
				}
			}

			if (readOnlyFiles.length > 0) {
				status += "\n\nRead-only Files:";
				for (const file of readOnlyFiles.slice(0, 5)) {
					status += `\n  - ${file}`;
				}
				if (readOnlyFiles.length > 5) {
					status += `\n  ... and ${readOnlyFiles.length - 5} more`;
				}
			}

			return status;
		}

		case "stats": {
			const stats = manager.getStats();

			return `Clipboard Manager Statistics\n\nCopy Operations: ${stats.copyContextCount}\nPaste Operations: ${stats.pasteCount}\nFiles Copied: ${stats.filesCopied}\nEdits Applied: ${stats.editsApplied}\nClipboard Watch Hits: ${stats.clipboardWatchHits}\nLast Copy: ${stats.lastCopyTime || "Never"}\nLast Paste: ${stats.lastPasteTime || "Never"}`;
		}

		case "config": {
			// Update config if parameters provided
			if (args.includeRepoMap !== undefined) {
				manager.updateConfig({ includeRepoMap: args.includeRepoMap });
			}
			if (args.includeInstructions !== undefined) {
				manager.updateConfig({ includeInstructions: args.includeInstructions });
			}
			if (args.editFormat !== undefined) {
				manager.updateConfig({ editFormat: args.editFormat });
			}

			const config = manager.getConfig();

			return `Clipboard Manager Configuration\n\nEnabled: ${config.enabled}\nCopy/Paste Mode: ${config.copyPasteMode}\nEdit Format: ${config.editFormat}\nInclude Repo Map: ${config.includeRepoMap}\nInclude Instructions: ${config.includeInstructions}\nAuto Copy on Add: ${config.autoCopyOnAdd}\n\nTo update config, pass parameters:\n- includeRepoMap: boolean\n- includeInstructions: boolean\n- editFormat: "editor-diff" | "editor-whole" | "auto"`;
		}

		case "reset": {
			manager.resetStats();
			manager.clearFiles();
			manager.disableCopyPasteMode();
			resetClipboardManager();
			return "Reset clipboard manager to defaults.";
		}

		case "help": {
			return HELP_TEXT;
		}

		default:
			return "Unknown action. Use 'help' for available actions.";
	}
}

export const clipboardToolDefinition: AgentTool = {
	name: "clipboard",
	label: "Clipboard Manager",
	description:
		"Manage clipboard context for working with LLM web chats - copy code context to clipboard, paste LLM responses to apply changes. Actions: copy-context, paste, apply, add, remove, clear, mode, status, stats, config, reset, help",
	parameters: Type.Object({
		action: Type.Union([
			Type.Literal("copy-context"),
			Type.Literal("paste"),
			Type.Literal("apply"),
			Type.Literal("add"),
			Type.Literal("remove"),
			Type.Literal("clear"),
			Type.Literal("mode"),
			Type.Literal("status"),
			Type.Literal("stats"),
			Type.Literal("config"),
			Type.Literal("reset"),
			Type.Literal("help"),
		]),
		instructions: Type.Optional(
			Type.String({ description: "Instructions to include with copy-context" }),
		),
		content: Type.Optional(
			Type.String({ description: "Content to paste (defaults to clipboard)" }),
		),
		edits: Type.Optional(
			Type.Array(
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
		),
		file: Type.Optional(Type.String({ description: "File path for add/remove actions" })),
		readOnly: Type.Optional(Type.Boolean({ description: "Mark file as read-only for add action" })),
		enabled: Type.Optional(Type.Boolean({ description: "Enable/disable copy/paste mode" })),
		includeRepoMap: Type.Optional(Type.Boolean({ description: "Include repo map in context" })),
		includeInstructions: Type.Optional(
			Type.Boolean({ description: "Include instructions template" }),
		),
		editFormat: Type.Optional(
			Type.Union(
				[Type.Literal("editor-diff"), Type.Literal("editor-whole"), Type.Literal("auto")],
				{ description: "Edit format for paste parsing" },
			),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const typedArgs = params as ClipboardToolArgs;
		if (!typedArgs?.action) {
			return {
				content: [{ type: "text", text: "Error: 'action' parameter is required" }],
				details: {},
			};
		}
		const result = await handleClipboardToolCall(typedArgs);
		return {
			content: [{ type: "text", text: result }],
			details: {},
		};
	},
};

export function getClipboardTool(): AgentTool {
	return clipboardToolDefinition;
}
