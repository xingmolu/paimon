/**
 * Context Identifier Tool (Aider Pattern)
 *
 * Tool for automatically identifying which files need to be edited for a given request.
 * Analyzes task descriptions, codebase structure, and symbol relationships.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { formatContextAnalysis, formatRelatedFileSuggestions } from "../context-analysis.js";
import {
	type ContextIdentifierConfig,
	type ContextIdentifierStats,
	getContextIdentifierManager,
	resetContextIdentifierInstance,
} from "../context-identifier.js";

// Parameter schema using TypeBox
const ContextIdentifierParameters = Type.Object({
	action: Type.Union([
		Type.Literal("analyze"),
		Type.Literal("suggest"),
		Type.Literal("related"),
		Type.Literal("symbols"),
		Type.Literal("stats"),
		Type.Literal("config"),
		Type.Literal("enable"),
		Type.Literal("disable"),
		Type.Literal("clear"),
		Type.Literal("reset"),
		Type.Literal("help"),
		Type.Literal("get"),
		Type.Literal("list"),
		Type.Literal("format"),
	]),
	taskDescription: Type.Optional(Type.String()),
	filePath: Type.Optional(Type.String()),
	maxSuggestions: Type.Optional(Type.Number()),
	minRelevance: Type.Optional(Type.Number()),
	includeTests: Type.Optional(Type.Boolean()),
	includeConfigs: Type.Optional(Type.Boolean()),
});

type ContextIdentifierToolParams = {
	action:
		| "analyze"
		| "suggest"
		| "related"
		| "symbols"
		| "stats"
		| "config"
		| "enable"
		| "disable"
		| "clear"
		| "reset"
		| "help"
		| "get"
		| "list"
		| "format";
	taskDescription?: string;
	filePath?: string;
	maxSuggestions?: number;
	minRelevance?: number;
	includeTests?: boolean;
	includeConfigs?: boolean;
};

export async function executeContextIdentifierTool(
	_toolCallId: string,
	params: unknown,
): Promise<string> {
	const typedParams = params as ContextIdentifierToolParams;
	const manager = getContextIdentifierManager();

	const normalizedAction =
		typedParams.action === "get"
			? "suggest"
			: typedParams.action === "list"
				? "related"
				: typedParams.action === "format"
					? "symbols"
					: typedParams.action;

	switch (normalizedAction) {
		case "analyze": {
			if (!typedParams.taskDescription) {
				return "Error: taskDescription parameter required for analyze action";
			}

			// Apply config overrides
			if (typedParams.maxSuggestions !== undefined) {
				manager.updateConfig({ maxSuggestions: typedParams.maxSuggestions });
			}
			if (typedParams.minRelevance !== undefined) {
				manager.updateConfig({ minRelevance: typedParams.minRelevance });
			}
			if (typedParams.includeTests !== undefined) {
				manager.updateConfig({ includeTests: typedParams.includeTests });
			}
			if (typedParams.includeConfigs !== undefined) {
				manager.updateConfig({ includeConfigs: typedParams.includeConfigs });
			}

			const analysis = manager.analyze(typedParams.taskDescription);
			return formatContextAnalysis(analysis);
		}

		case "suggest": {
			if (!typedParams.filePath) {
				return "Error: filePath parameter required for suggest action";
			}

			const suggestions = manager.suggestForFile(typedParams.filePath);
			return formatRelatedFileSuggestions(suggestions);
		}

		case "related": {
			if (!typedParams.filePath) {
				return "Error: filePath parameter required for related action";
			}

			const related = manager.getRelatedFiles(typedParams.filePath);
			if (related.length === 0) {
				return `No related files found for ${typedParams.filePath}`;
			}

			return `## Related Files for ${typedParams.filePath}\n\n${related.map((f) => `- \`${f}\``).join("\n")}`;
		}

		case "symbols": {
			if (!typedParams.filePath) {
				return "Error: filePath parameter required for symbols action";
			}

			const symbols = manager.extractSymbols(typedParams.filePath);
			if (symbols.length === 0) {
				return `No symbols found in ${typedParams.filePath}`;
			}

			const lines = [`## Symbols in ${typedParams.filePath}\n`];

			const grouped: Record<string, typeof symbols> = {};
			for (const symbol of symbols) {
				if (!grouped[symbol.type]) {
					grouped[symbol.type] = [];
				}
				grouped[symbol.type].push(symbol);
			}

			for (const [type, syms] of Object.entries(grouped)) {
				lines.push(`**${type.charAt(0).toUpperCase() + type.slice(1)}s:**`);
				for (const sym of syms) {
					const lineInfo = sym.line ? ` (line ${sym.line})` : "";
					lines.push(`- ${sym.name}${lineInfo}`);
				}
				lines.push("");
			}

			return lines.join("\n");
		}

		case "stats": {
			const stats = manager.getStats();
			return `## Context Identifier Statistics

- Total Analyses: ${stats.totalAnalyses}
- Files Suggested: ${stats.filesSuggested}
- Primary Files Suggested: ${stats.primaryFilesSuggested}
- Average Confidence: ${(stats.avgConfidence * 100).toFixed(1)}%`;
		}

		case "config": {
			const config = manager.getConfig();
			return `## Context Identifier Configuration

- Enabled: ${config.enabled}
- Max Suggestions: ${config.maxSuggestions}
- Min Relevance: ${config.minRelevance}
- Include Tests: ${config.includeTests}
- Include Configs: ${config.includeConfigs}`;
		}

		case "enable": {
			manager.setEnabled(true);
			return "Context identifier enabled.";
		}

		case "disable": {
			manager.setEnabled(false);
			return "Context identifier disabled.";
		}

		case "clear": {
			manager.clearCache();
			return "Context identifier cache cleared.";
		}

		case "reset": {
			resetContextIdentifierInstance();
			return "Context identifier instance reset.";
		}

		case "help": {
			return `Context Identifier Tool (Aider Pattern)

Automatically identifies which files need to be edited for a given request.

Actions:
- analyze: Analyze a task description and identify relevant files (requires taskDescription)
- suggest/get: Find files related to a specific file (requires filePath)
- related/list: Get files that share symbols with a file (requires filePath)
- symbols/format: Extract symbols from a file (requires filePath)
- stats: View usage statistics
- config: View current configuration
- enable: Enable context identifier
- disable: Disable context identifier
- clear: Clear internal cache
- reset: Reset the manager instance
- help: Show this help message

Parameters for analyze:
- taskDescription: The task to analyze (required)
- maxSuggestions: Maximum number of files to suggest (default: 10)
- minRelevance: Minimum relevance threshold 0-1 (default: 0.3)
- includeTests: Include test files in suggestions (default: false)
- includeConfigs: Include config files in suggestions (default: true)

Examples:
- context({action: 'analyze', taskDescription: 'Add a new tool for file watching'})
- context({action: 'suggest', filePath: 'src/agent.ts'})
- context({action: 'related', filePath: 'src/tools/file-tools.ts'})
- context({action: 'symbols', filePath: 'src/capability-gap.ts'})
- context({action: 'stats'})

Inspired by Aider's /context command:
https://aider.chat/docs/usage/commands.html#context`;
		}

		default:
			return "Unknown action. Use 'help' to see available actions.";
	}
}

export const contextIdentifierTool: AgentTool = {
	name: "context",
	label: "Context Identifier",
	description:
		"Automatically identify which files need to be edited for a given request (Aider /context pattern). Analyzes task descriptions, codebase structure, and symbol relationships.",
	parameters: ContextIdentifierParameters,
	execute: async (
		_toolCallId,
		params,
	): Promise<{
		content: Array<{ type: "text"; text: string }>;
		details: Record<string, unknown>;
	}> => {
		const result = await executeContextIdentifierTool(_toolCallId, params);
		return {
			content: [{ type: "text", text: result }],
			details: {},
		};
	},
};

export const contextIdentifierToolDefinition: AgentTool = contextIdentifierTool;
