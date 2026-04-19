/**
 * Self-Improvement Suggestion Tool
 *
 * Tool interface for the Self-Improvement Suggestion Engine.
 * Provides proactive codebase analysis and improvement suggestions.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type ImprovementCategory,
	type ImprovementSuggestion,
	type Priority,
	type SuggestionEngineConfig,
	type SuggestionEngineStats,
	getSelfImprovementEngine,
} from "../self-improvement-engine.js";

/**
 * Tool action types.
 */
type SelfImprovementAction =
	| "scan"
	| "suggestions"
	| "suggestion"
	| "accept"
	| "dismiss"
	| "clear-dismissed"
	| "stats"
	| "config"
	| "enable"
	| "disable"
	| "reset";

/**
 * Tool result.
 */
interface ToolResult {
	success: boolean;
	message: string;
	suggestions?: ImprovementSuggestion[];
	suggestion?: ImprovementSuggestion;
	stats?: SuggestionEngineStats;
	config?: SuggestionEngineConfig;
	count?: number;
}

/**
 * Handle self-improvement tool actions.
 */
async function handleAction(
	action: SelfImprovementAction,
	params: Record<string, unknown>,
): Promise<ToolResult> {
	const engine = getSelfImprovementEngine();

	switch (action) {
		case "scan": {
			const rootDir = (params.rootDir as string) || ".";
			const suggestions = await engine.scanCodebase(rootDir);
			return {
				success: true,
				message: `Scanned codebase and found ${suggestions.length} improvement suggestions`,
				suggestions,
			};
		}

		case "suggestions": {
			const category = params.category as ImprovementCategory | undefined;
			const priority = params.priority as Priority | undefined;
			const suggestions = engine.getSuggestions(category, priority);
			return {
				success: true,
				message: `Found ${suggestions.length} suggestions`,
				suggestions,
			};
		}

		case "suggestion": {
			const id = params.id as string;
			if (!id) {
				return { success: false, message: "Missing required parameter: id" };
			}
			const suggestion = engine.getSuggestion(id);
			if (!suggestion) {
				return { success: false, message: `Suggestion not found: ${id}` };
			}
			return {
				success: true,
				message: `Found suggestion: ${suggestion.title}`,
				suggestion,
			};
		}

		case "accept": {
			const id = params.id as string;
			if (!id) {
				return { success: false, message: "Missing required parameter: id" };
			}
			return engine.acceptSuggestion(id);
		}

		case "dismiss": {
			const id = params.id as string;
			if (!id) {
				return { success: false, message: "Missing required parameter: id" };
			}
			return engine.dismissSuggestion(id);
		}

		case "clear-dismissed": {
			return engine.clearDismissed();
		}

		case "stats": {
			const stats = engine.getStats();
			return {
				success: true,
				message: "Retrieved statistics",
				stats,
			};
		}

		case "config": {
			return {
				success: true,
				message: "Retrieved configuration",
				config: engine.getConfig(),
			};
		}

		case "enable": {
			engine.setEnabled(true);
			return { success: true, message: "Self-improvement engine enabled" };
		}

		case "disable": {
			engine.setEnabled(false);
			return { success: true, message: "Self-improvement engine disabled" };
		}

		case "reset": {
			return engine.resetStats();
		}

		default:
			return { success: false, message: `Unknown action: ${action}` };
	}
}

/**
 * Self-Improvement Suggestion Tool Definition
 */
export const selfImprovementTool: AgentTool = {
	name: "selfImprovement",
	label: "Self-Improvement Suggestions",
	description: `Manage self-improvement suggestions - proactive codebase analysis and improvement recommendations

Actions:
- scan: Scan codebase for improvement suggestions (optional: rootDir)
- suggestions: Get all suggestions (optional: category, priority)
- suggestion: Get specific suggestion (requires: id)
- accept: Accept a suggestion (requires: id)
- dismiss: Dismiss a suggestion (requires: id)
- clear-dismissed: Clear all dismissed suggestions
- stats: View suggestion statistics
- config: View configuration
- enable: Enable suggestion engine
- disable: Disable suggestion engine
- reset: Reset statistics and suggestions

Categories: code-quality, performance, architecture, capability, reliability, documentation, testing, security
Priorities: critical, high, medium, low

Example usage:
selfImprovement({action: 'scan'})
selfImprovement({action: 'suggestions', category: 'security'})
selfImprovement({action: 'accept', id: 'pattern-xxx'})
selfImprovement({action: 'stats'})`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: scan, suggestions, suggestion, accept, dismiss, clear-dismissed, stats, config, enable, disable, reset",
		}),
		rootDir: Type.Optional(
			Type.String({ description: "Root directory to scan (for scan action)" }),
		),
		id: Type.Optional(
			Type.String({ description: "Suggestion ID (for suggestion, accept, dismiss actions)" }),
		),
		category: Type.Optional(
			Type.String({
				description:
					"Filter by category: code-quality, performance, architecture, capability, reliability, documentation, testing, security",
			}),
		),
		priority: Type.Optional(
			Type.String({ description: "Filter by priority: critical, high, medium, low" }),
		),
	}),
	execute: async (_toolCallId: string, params: unknown): Promise<AgentToolResult<unknown>> => {
		const typedParams = params as Record<string, unknown>;
		const action = typedParams.action as SelfImprovementAction;

		const result = await handleAction(action, typedParams);
		const engine = getSelfImprovementEngine();

		let output = `## Self-Improvement Engine\n\n**Action:** ${action}\n**Result:** ${result.success ? "✅ Success" : "❌ Failed"}\n\n${result.message}\n`;

		if (result.suggestions && result.suggestions.length > 0) {
			output += `\n${engine.formatSuggestions(result.suggestions)}`;
		}

		if (result.suggestion) {
			output += "\n\n### Suggestion Details\n";
			output += `- **ID:** ${result.suggestion.id}\n`;
			output += `- **Category:** ${result.suggestion.category}\n`;
			output += `- **Priority:** ${result.suggestion.priority}\n`;
			output += `- **Title:** ${result.suggestion.title}\n`;
			output += `- **Description:** ${result.suggestion.description}\n`;
			if (result.suggestion.filePath) {
				output += `- **File:** ${result.suggestion.filePath}\n`;
			}
			output += `- **Impact:** ${result.suggestion.impact}\n`;
			output += `- **Effort:** ${result.suggestion.effort}\n`;
			output += `- **Confidence:** ${result.suggestion.confidence}%\n`;
		}

		if (result.stats) {
			output += `\n\n${engine.formatStats(result.stats)}`;
		}

		if (result.config) {
			output += "\n\n## Self-Improvement Engine Configuration\n\n";
			output += `\n\`\`\`json\n${JSON.stringify(result.config, null, 2)}\n\`\`\``;
		}

		if (result.count !== undefined) {
			output += `\n\n**Count:** ${result.count}`;
		}

		return {
			content: [{ type: "text", text: output }],
			details: { action, success: result.success },
		};
	},
};
