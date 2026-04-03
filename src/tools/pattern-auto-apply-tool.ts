/**
 * Pattern Auto-Apply Tool - Tool interface for pattern auto-application
 *
 * Provides actions for matching, suggesting, and applying learned patterns.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type PatternContext,
	type PatternType,
	getPatternAutoApplier,
} from "../pattern-auto-apply.js";

// Tool definition
export const patternAutoApplyToolDef: AgentTool = {
	name: "patternAutoApply",
	label: "Pattern Auto-Apply",
	description: `Automatically match and apply learned patterns from past sessions.

Actions:
- match: Find patterns matching current context (provide taskType, taskDescription, files, toolsUsed, errors, keywords)
- suggest: Get pattern suggestions without auto-applying (same params as match)
- apply: Apply a specific pattern by ID (provide patternId)
- auto-apply: Auto-apply best matching patterns (provide context)
- patterns: List all available patterns (optional type filter)
- pattern: Get details of a specific pattern (provide patternId)
- history: View application history
- stats: View statistics
- config: View or update configuration
- enable/disable: Enable or disable auto-apply
- reset: Reset statistics
- clear: Clear application history
- help: Show help message

Example usage:
patternAutoApply({action: 'match', taskType: 'capability', taskDescription: 'Add new tool', keywords: ['tool', 'api']})
patternAutoApply({action: 'apply', patternId: 'tool-seq-session-123'})
patternAutoApply({action: 'stats'})
patternAutoApply({action: 'patterns', type: 'success-pattern'})`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: match, suggest, apply, auto-apply, patterns, pattern, history, stats, config, enable, disable, reset, clear, help",
		}),
		taskType: Type.Optional(
			Type.String({ description: "Task type for matching: capability, reliability, feature" }),
		),
		taskDescription: Type.Optional(Type.String({ description: "Task description for matching" })),
		files: Type.Optional(Type.Array(Type.String(), { description: "Files being worked on" })),
		toolsUsed: Type.Optional(Type.Array(Type.String(), { description: "Tools used so far" })),
		errors: Type.Optional(Type.Array(Type.String(), { description: "Errors encountered" })),
		keywords: Type.Optional(Type.Array(Type.String(), { description: "Keywords from task" })),
		patternId: Type.Optional(Type.String({ description: "Pattern ID for apply/pattern actions" })),
		type: Type.Optional(
			Type.String({
				description:
					"Pattern type filter: success-pattern, failure-pattern, tool-sequence, error-recovery, decision-point, skill-usage",
			}),
		),
		config: Type.Optional(Type.Object({}, { description: "Configuration updates" })),
		limit: Type.Optional(Type.Number({ description: "Limit for history" })),
	}),
	execute: async (
		_toolCallId: string,
		params: unknown,
	): Promise<AgentToolResult<{ success: boolean; action: string }>> => {
		const p = params as Record<string, unknown>;
		const output = executePatternAutoApplyTool({
			action: String(p.action),
			taskType: p.taskType as "capability" | "reliability" | "feature" | undefined,
			taskDescription: p.taskDescription as string | undefined,
			files: p.files as string[] | undefined,
			toolsUsed: p.toolsUsed as string[] | undefined,
			errors: p.errors as string[] | undefined,
			keywords: p.keywords as string[] | undefined,
			patternId: p.patternId as string | undefined,
			type: p.type as PatternType | undefined,
			config: p.config as Record<string, unknown> | undefined,
			limit: p.limit as number | undefined,
		});
		return {
			content: [{ type: "text", text: output }],
			details: { success: true, action: String(p.action) },
		};
	},
};

/**
 * Execute pattern auto-apply tool action
 */
function executePatternAutoApplyTool(args: {
	action: string;
	taskType?: "capability" | "reliability" | "feature";
	taskDescription?: string;
	files?: string[];
	toolsUsed?: string[];
	errors?: string[];
	keywords?: string[];
	patternId?: string;
	type?: PatternType;
	config?: Record<string, unknown>;
	limit?: number;
}): string {
	const applier = getPatternAutoApplier();

	function buildContext(): PatternContext {
		return {
			taskType: args.taskType,
			taskDescription: args.taskDescription,
			files: args.files,
			toolsUsed: args.toolsUsed,
			errors: args.errors,
			keywords: args.keywords,
		};
	}

	switch (args.action) {
		case "match":
		case "suggest": {
			const context = buildContext();
			const matches = applier.matchPatterns(context);
			return applier.formatMatches(matches);
		}

		case "apply": {
			if (!args.patternId) {
				return "Error: patternId is required for apply action";
			}
			const context = buildContext();
			const result = applier.applyPattern(args.patternId, context);
			const lines = [
				"## Pattern Application Result\n",
				`**Pattern:** ${result.patternId}`,
				`**Success:** ${result.success ? "✅" : "❌"}`,
				`**Confidence:** ${result.confidence}%`,
				`**Time Saved:** ~${result.timeSaved} minutes\n`,
			];
			if (result.actionsTaken.length > 0) {
				lines.push("**Actions Taken:**");
				for (const action of result.actionsTaken) {
					lines.push(`- ${action}`);
				}
			}
			if (result.errors.length > 0) {
				lines.push("\n**Errors:**");
				for (const error of result.errors) {
					lines.push(`- ${error}`);
				}
			}
			return lines.join("\n");
		}

		case "auto-apply": {
			const context = buildContext();
			const results = applier.autoApplyPatterns(context);
			if (results.length === 0) {
				return "No patterns auto-applied. Either no matches found or confidence threshold not met.";
			}
			const lines = [`## Auto-Applied Patterns (${results.length})\n`];
			let totalTimeSaved = 0;
			for (const result of results) {
				lines.push(`### ${result.patternId}`);
				lines.push(`**Success:** ${result.success ? "✅" : "❌"}`);
				lines.push(`**Time Saved:** ~${result.timeSaved} minutes`);
				totalTimeSaved += result.timeSaved;
				if (result.actionsTaken.length > 0) {
					lines.push(`**Actions:** ${result.actionsTaken.join(", ")}`);
				}
				lines.push("");
			}
			lines.push(`**Total Time Saved:** ~${totalTimeSaved} minutes`);
			return lines.join("\n");
		}

		case "patterns": {
			const patterns = args.type
				? applier.getPatternsByType(args.type)
				: applier.getAvailablePatterns();
			if (patterns.length === 0) {
				return args.type
					? `No patterns found for type: ${args.type}`
					: "No patterns available. Run session replay to extract patterns.";
			}
			const lines = [`## Available Patterns (${patterns.length})\n`];
			for (const pattern of patterns.slice(0, 20)) {
				lines.push(`- **${pattern.id}** (${pattern.type})`);
				lines.push(`  ${pattern.description}`);
				lines.push(
					`  Confidence: ${pattern.confidence}%, Success: ${Math.round(pattern.successCorrelation * 100)}%`,
				);
			}
			return lines.join("\n");
		}

		case "pattern": {
			if (!args.patternId) {
				return "Error: patternId is required for pattern action";
			}
			const patterns = applier.getAvailablePatterns();
			const pattern = patterns.find((p) => p.id === args.patternId);
			if (!pattern) {
				return `Pattern not found: ${args.patternId}`;
			}
			const lines = [`## Pattern: ${pattern.id}\n`];
			lines.push(`**Type:** ${pattern.type}`);
			lines.push(`**Description:** ${pattern.description}`);
			lines.push(`**Confidence:** ${pattern.confidence}%`);
			lines.push(`**Success Correlation:** ${Math.round(pattern.successCorrelation * 100)}%`);
			lines.push(`**Found In:** ${pattern.foundIn.join(", ")}`);
			lines.push(`**Suggested Application:** ${pattern.suggestedApplication}`);
			lines.push("\n**Details:**");
			for (const [key, value] of Object.entries(pattern.details)) {
				lines.push(`- ${key}: ${JSON.stringify(value)}`);
			}
			return lines.join("\n");
		}

		case "history": {
			const history = applier.getApplicationHistory(args.limit || 10);
			if (history.length === 0) {
				return "No application history.";
			}
			const lines = [`## Application History (${history.length})\n`];
			for (const record of history) {
				const resultIcon =
					record.result === "success" ? "✅" : record.result === "partial" ? "⚠️" : "❌";
				lines.push(`### ${record.id} ${resultIcon}`);
				lines.push(`**Pattern:** ${record.patternId}`);
				lines.push(`**Time:** ${record.timestamp}`);
				lines.push(`**Similarity:** ${record.similarityScore}%`);
				if (record.notes.length > 0) {
					lines.push(`**Notes:** ${record.notes.join(", ")}`);
				}
				lines.push("");
			}
			return lines.join("\n");
		}

		case "stats": {
			return applier.formatStats();
		}

		case "config": {
			if (args.config) {
				applier.updateConfig(args.config as Record<string, never>);
				return `Configuration updated:\n${JSON.stringify(applier.getConfig(), null, 2)}`;
			}
			return `## Current Configuration\n\n\`\`\`json\n${JSON.stringify(applier.getConfig(), null, 2)}\n\`\`\``;
		}

		case "enable": {
			applier.setEnabled(true);
			return "Pattern auto-apply enabled.";
		}

		case "disable": {
			applier.setEnabled(false);
			return "Pattern auto-apply disabled.";
		}

		case "reset": {
			applier.resetStats();
			return "Statistics reset.";
		}

		case "clear": {
			applier.clearHistory();
			return "Application history cleared.";
		}

		case "help": {
			return `## Pattern Auto-Apply Tool

Automatically match and apply learned patterns from past evolution sessions.

### Actions

| Action | Description | Required Parameters |
|--------|-------------|-------------------|
| match | Find patterns matching context | taskType, taskDescription, or keywords |
| suggest | Get suggestions without auto-apply | Same as match |
| apply | Apply specific pattern | patternId |
| auto-apply | Auto-apply best matches | context parameters |
| patterns | List available patterns | (optional: type) |
| pattern | Get pattern details | patternId |
| history | View application history | (optional: limit) |
| stats | View statistics | - |
| config | View/update configuration | (optional: config) |
| enable/disable | Toggle auto-apply | - |
| reset | Reset statistics | - |
| clear | Clear history | - |

### Pattern Types

- success-pattern: Patterns from successful sessions
- failure-pattern: Patterns from failed sessions (to avoid)
- tool-sequence: Tool usage sequences
- error-recovery: Error recovery strategies
- decision-point: Decision point patterns
- skill-usage: Skill usage patterns

### Configuration

- minSimilarityScore: Minimum score to suggest (default: 50)
- autoApplyConfidenceThreshold: Min confidence for auto-apply (default: 80)
- autoApplySuccessThreshold: Min success correlation for auto-apply (default: 0.75)
- maxSuggestions: Maximum suggestions to return (default: 5)`;
		}

		default:
			return `Unknown action: ${args.action}. Use 'help' for available actions.`;
	}
}

// Export tool
export const patternAutoApplyTool = {
	definition: patternAutoApplyToolDef,
	execute: executePatternAutoApplyTool,
};
