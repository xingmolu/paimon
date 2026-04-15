/**
 * Code Completion Tool (Cursor Pattern)
 *
 * Provides intelligent code completion suggestions based on codebase analysis.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { CodePattern } from "../code-completion.js";
import { getCodeCompletionManager, initCodeCompletionManager } from "../code-completion.js";

function executeCodeCompletionTool(args: Record<string, unknown>): string {
	const manager = getCodeCompletionManager();
	const action = String(args.action || "");

	switch (action) {
		case "complete": {
			const filePath = args.filePath as string | undefined;
			if (!filePath) {
				return "Error: filePath is required for complete action";
			}

			// Read file content if not provided
			let content = args.content as string | undefined;
			if (!content) {
				try {
					const fs = require("node:fs");
					content = fs.readFileSync(filePath, "utf-8");
				} catch {
					return `Error: Could not read file ${filePath}`;
				}
			}

			const cursorLine = (args.cursorLine as number) ?? 0;
			const cursorColumn = (args.cursorColumn as number) ?? 0;

			// Content is guaranteed to be defined here due to the logic above
			// biome-ignore lint/style/noNonNullAssertion: content is guaranteed to be defined by the read logic above
			const context = manager.buildCodeContext(filePath, content!, cursorLine, cursorColumn);
			const completions = manager.getCompletions(context);

			return manager.formatCompletions(completions);
		}

		case "analyze": {
			const rootPath = (args.rootPath as string) || process.cwd();
			const result = manager.analyzeCodebase(rootPath);

			return [
				"## Codebase Analysis Complete",
				"",
				`Files Analyzed: ${result.filesAnalyzed}`,
				`Imports Found: ${result.importsFound}`,
				`Signatures Extracted: ${result.signaturesFound}`,
				"",
				"The code completion manager is now ready to provide context-aware suggestions.",
			].join("\n");
		}

		case "patterns": {
			return manager.formatPatterns();
		}

		case "pattern": {
			const patternId = args.patternId as string | undefined;
			if (!patternId) {
				return "Error: patternId is required for pattern action";
			}

			const patterns = manager.getPatterns();
			const pattern = patterns.find((p) => p.id === patternId);

			if (!pattern) {
				return `Pattern '${patternId}' not found. Use 'patterns' action to list all patterns.`;
			}

			return [
				`## Pattern: ${pattern.name}`,
				"",
				`- **ID:** ${pattern.id}`,
				`- **Language:** ${pattern.language}`,
				`- **Trigger:** ${pattern.trigger}`,
				`- **Confidence:** ${(pattern.confidence * 100).toFixed(0)}%`,
				`- **Usage Count:** ${pattern.usageCount}`,
				`- **Description:** ${pattern.description}`,
				"",
				"### Template",
				"```",
				pattern.template,
				"```",
			].join("\n");
		}

		case "add-pattern": {
			const pattern = args.pattern as Partial<CodePattern> | undefined;
			if (!pattern || !pattern.id || !pattern.name || !pattern.template) {
				return "Error: pattern must include id, name, and template";
			}

			manager.addPattern({
				id: pattern.id,
				name: pattern.name,
				pattern: pattern.pattern || "",
				template: pattern.template,
				description: pattern.description || "",
				language: pattern.language || "typescript",
				trigger: pattern.trigger || "",
				confidence: pattern.confidence ?? 0.8,
				usageCount: 0,
			});

			return `Pattern '${pattern.id}' added successfully.`;
		}

		case "remove-pattern": {
			const patternId = args.patternId as string | undefined;
			if (!patternId) {
				return "Error: patternId is required for remove-pattern action";
			}

			const removed = manager.removePattern(patternId);
			return removed
				? `Pattern '${patternId}' removed successfully.`
				: `Pattern '${patternId}' not found.`;
		}

		case "stats": {
			return manager.formatStats();
		}

		case "config": {
			const config = args.config as Record<string, unknown> | undefined;
			if (config) {
				manager.updateConfig(config);
				return "Configuration updated successfully.";
			}
			const currentConfig = manager.getConfig();
			return [
				"## Code Completion Configuration",
				"",
				`- **Enabled:** ${currentConfig.enabled}`,
				`- **Max Suggestions:** ${currentConfig.maxSuggestions}`,
				`- **Min Confidence:** ${currentConfig.minConfidence}`,
				`- **Analyze Codebase:** ${currentConfig.analyzeCodebase}`,
				`- **Extract Signatures:** ${currentConfig.extractSignatures}`,
				`- **Learn Patterns:** ${currentConfig.learnPatterns}`,
				`- **Pattern Min Usage:** ${currentConfig.patternMinUsage}`,
			].join("\n");
		}

		case "enable": {
			manager.setEnabled(true);
			return "Code completion enabled.";
		}

		case "disable": {
			manager.setEnabled(false);
			return "Code completion disabled.";
		}

		case "reset": {
			manager.resetStats();
			return "Statistics reset successfully.";
		}

		case "help": {
			return [
				"# Code Completion Tool (Cursor Pattern)",
				"",
				"Provides intelligent code completion suggestions based on codebase analysis.",
				"",
				"## Actions",
				"",
				"### complete",
				"Get code completions for a file at cursor position.",
				"```",
				"codeCompletion({action: 'complete', filePath: 'src/agent.ts', cursorLine: 10, cursorColumn: 20})",
				"```",
				"",
				"### analyze",
				"Analyze codebase to extract imports and signatures.",
				"```",
				"codeCompletion({action: 'analyze', rootPath: './src'})",
				"```",
				"",
				"### patterns",
				"List all available code patterns.",
				"```",
				"codeCompletion({action: 'patterns'})",
				"```",
				"",
				"### pattern",
				"Get details of a specific pattern.",
				"```",
				"codeCompletion({action: 'pattern', patternId: 'ts-async-function'})",
				"```",
				"",
				"### add-pattern",
				"Add a custom code pattern.",
				"```",
				'codeCompletion({action: "add-pattern", pattern: {id: "my-pattern", name: "My Pattern", template: "...", language: "typescript", trigger: "my ", confidence: 0.8}})',
				"```",
				"",
				"### remove-pattern",
				"Remove a custom pattern.",
				"```",
				"codeCompletion({action: 'remove-pattern', patternId: 'my-pattern'})",
				"```",
				"",
				"### stats",
				"View completion statistics.",
				"```",
				"codeCompletion({action: 'stats'})",
				"```",
				"",
				"### config",
				"View or update configuration.",
				"```",
				"codeCompletion({action: 'config'})",
				"codeCompletion({action: 'config', config: {maxSuggestions: 15}})",
				"```",
				"",
				"### enable/disable",
				"Enable or disable code completion.",
				"```",
				"codeCompletion({action: 'enable'})",
				"codeCompletion({action: 'disable'})",
				"```",
				"",
				"### reset",
				"Reset statistics.",
				"```",
				"codeCompletion({action: 'reset'})",
				"```",
			].join("\n");
		}

		default:
			return `Unknown action: ${action}. Use 'help' for available actions.`;
	}
}

export const codeCompletionTool: AgentTool = {
	name: "codeCompletion",
	label: "Code Completion",
	description:
		"Manage intelligent code completion suggestions based on codebase analysis (Cursor Pattern). Actions: complete, analyze, patterns, pattern, add-pattern, remove-pattern, stats, config, enable, disable, reset, help.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action: complete, analyze, patterns, pattern, add-pattern, remove-pattern, stats, config, enable, disable, reset, help",
		}),
		filePath: Type.Optional(Type.String({ description: "File path for completion context" })),
		content: Type.Optional(Type.String({ description: "File content for completion (optional)" })),
		cursorLine: Type.Optional(Type.Number({ description: "Current cursor line (0-indexed)" })),
		cursorColumn: Type.Optional(Type.Number({ description: "Current cursor column (0-indexed)" })),
		rootPath: Type.Optional(
			Type.String({ description: "Root path for codebase analysis (default: current directory)" }),
		),
		patternId: Type.Optional(
			Type.String({ description: "Pattern ID for pattern/remove-pattern actions" }),
		),
		pattern: Type.Optional(
			Type.Object({
				id: Type.String(),
				name: Type.String(),
				pattern: Type.Optional(Type.String()),
				template: Type.String(),
				description: Type.Optional(Type.String()),
				language: Type.Optional(Type.String()),
				trigger: Type.Optional(Type.String()),
				confidence: Type.Optional(Type.Number()),
			}),
		),
		config: Type.Optional(
			Type.Object({
				enabled: Type.Optional(Type.Boolean()),
				maxSuggestions: Type.Optional(Type.Number()),
				minConfidence: Type.Optional(Type.Number()),
				analyzeCodebase: Type.Optional(Type.Boolean()),
				extractSignatures: Type.Optional(Type.Boolean()),
				learnPatterns: Type.Optional(Type.Boolean()),
				patternMinUsage: Type.Optional(Type.Number()),
			}),
		),
	}),
	execute: async (
		_toolCallId: string,
		params: unknown,
	): Promise<AgentToolResult<{ success: boolean; action: string }>> => {
		const p = params as Record<string, unknown>;
		const output = executeCodeCompletionTool(p);
		return {
			content: [{ type: "text", text: output }],
			details: { success: true, action: String(p.action || "") },
		};
	},
};

export default codeCompletionTool;
