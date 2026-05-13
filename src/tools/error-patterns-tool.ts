/**
 * Error Patterns Tool - Learn from and query error patterns
 *
 * Tool for managing and querying error patterns learned from past sessions.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type ErrorMatch,
	type ErrorPattern,
	ErrorPatternLearner,
	formatPatternStats,
} from "../error-patterns.js";

// Global error pattern learner instance
const errorPatternLearner = new ErrorPatternLearner();

/**
 * Error patterns tool - Learn from and query error patterns
 */
export const errorPatternsTool: AgentTool = {
	name: "errorPatterns",
	label: "Error Pattern Learning",
	description:
		"Learn from and query error patterns. Use when encountering errors to find known solutions from past sessions.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: match (find pattern), learn (add new pattern), suggest (get suggestions), stats (view stats), patterns (list patterns), add (add custom), update (update solution), clear (clear learned)",
		}),
		error: Type.Optional(
			Type.String({
				description: "Error message to match or learn from",
			}),
		),
		solution: Type.Optional(
			Type.String({
				description: "Solution to associate with the error",
			}),
		),
		type: Type.Optional(
			Type.String({
				description: "Error type filter: typescript, test, lint, runtime",
			}),
		),
		patternId: Type.Optional(
			Type.String({
				description: "Pattern ID to update",
			}),
		),
		pattern: Type.Optional(
			Type.String({
				description: "Regex pattern for custom error",
			}),
		),
		description: Type.Optional(
			Type.String({
				description: "Description of the error pattern",
			}),
		),
		confidence: Type.Optional(
			Type.Number({
				description: "Confidence level 0-100",
			}),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const { action, error, solution, type, patternId, pattern, description, confidence } =
			params as {
				action: string;
				error?: string;
				solution?: string;
				type?: string;
				patternId?: string;
				pattern?: string;
				description?: string;
				confidence?: number;
			};

		try {
			switch (action) {
				case "match": {
					if (!error) {
						return {
							content: [
								{ type: "text", text: "Error: 'error' parameter required for match action" },
							],
							details: "Error: missing parameter",
						};
					}
					const match = errorPatternLearner.matchError(error);
					if (!match) {
						return {
							content: [
								{
									type: "text",
									text: "No matching error pattern found. Use 'learn' action to add this error to the pattern database.",
								},
							],
							details: { found: false },
						};
					}
					return {
						content: [{ type: "text", text: formatMatchResult(match) }],
						details: { found: true, pattern: match.pattern.id, confidence: match.confidence },
					};
				}

				case "learn": {
					if (!error) {
						return {
							content: [
								{ type: "text", text: "Error: 'error' parameter required for learn action" },
							],
							details: "Error: missing parameter",
						};
					}
					const learnedPattern = errorPatternLearner.learnFromError(error, solution);
					if (!learnedPattern) {
						return {
							content: [
								{
									type: "text",
									text: "Could not learn pattern from error message. The error may be too generic.",
								},
							],
							details: { learned: false },
						};
					}
					return {
						content: [
							{
								type: "text",
								text: `Pattern learned successfully!\n\n${formatPattern(learnedPattern)}`,
							},
						],
						details: { learned: true, patternId: learnedPattern.id },
					};
				}

				case "suggest": {
					if (!error) {
						return {
							content: [
								{ type: "text", text: "Error: 'error' parameter required for suggest action" },
							],
							details: "Error: missing parameter",
						};
					}
					const suggestions = errorPatternLearner.getSuggestions(error, 3);
					if (suggestions.length === 0) {
						return {
							content: [
								{
									type: "text",
									text: "No suggestions found for this error. Use 'learn' action to add it.",
								},
							],
							details: { count: 0 },
						};
					}
					return {
						content: [{ type: "text", text: formatSuggestions(suggestions) }],
						details: { count: suggestions.length },
					};
				}

				case "stats": {
					const stats = errorPatternLearner.getStats();
					return {
						content: [{ type: "text", text: formatPatternStats(stats) }],
						details: stats,
					};
				}

				case "patterns": {
					const patterns = errorPatternLearner.getPatterns(
						type as "typescript" | "test" | "lint" | "runtime" | undefined,
					);
					if (patterns.length === 0) {
						return {
							content: [{ type: "text", text: "No patterns found." }],
							details: { count: 0 },
						};
					}
					return {
						content: [
							{ type: "text", text: patterns.map((p) => formatPatternBrief(p)).join("\n\n") },
						],
						details: { count: patterns.length },
					};
				}

				case "add": {
					if (!pattern || !description || !solution) {
						return {
							content: [
								{
									type: "text",
									text: "Error: 'pattern', 'description', and 'solution' parameters required for add action",
								},
							],
							details: "Error: missing parameters",
						};
					}
					const newPattern = errorPatternLearner.addPattern({
						type: (type as "typescript" | "test" | "lint" | "runtime") || "runtime",
						pattern,
						description,
						solution,
						confidence: confidence || 75,
					});
					return {
						content: [
							{
								type: "text",
								text: `Custom pattern added successfully!\n\n${formatPattern(newPattern)}`,
							},
						],
						details: { patternId: newPattern.id },
					};
				}

				case "update": {
					if (!patternId || !solution) {
						return {
							content: [
								{
									type: "text",
									text: "Error: 'patternId' and 'solution' parameters required for update action",
								},
							],
							details: "Error: missing parameters",
						};
					}
					const success = errorPatternLearner.updateSolution(patternId, solution, confidence);
					if (!success) {
						return {
							content: [{ type: "text", text: `Pattern "${patternId}" not found.` }],
							details: { found: false },
						};
					}
					const updatedPattern = errorPatternLearner.getPattern(patternId);
					const patternText = updatedPattern ? formatPattern(updatedPattern) : "Pattern updated.";
					return {
						content: [
							{
								type: "text",
								text: `Pattern updated successfully!\n\n${patternText}`,
							},
						],
						details: { patternId, confidence: updatedPattern?.confidence },
					};
				}

				case "clear": {
					errorPatternLearner.clearLearned();
					return {
						content: [
							{ type: "text", text: "Learned patterns cleared. Default patterns retained." },
						],
						details: { cleared: true },
					};
				}

				default:
					return {
						content: [
							{
								type: "text",
								text: `Unknown action: ${action}. Valid actions: match, learn, suggest, stats, patterns, add, update, clear`,
							},
						],
						details: `Error: unknown action '${action}'`,
					};
			}
		} catch (e) {
			const errorMessage = e instanceof Error ? e.message : String(e);
			return {
				content: [{ type: "text", text: `Error: ${errorMessage}` }],
				details: `Error: ${errorMessage}`,
			};
		}
	},
};

function formatMatchResult(match: ErrorMatch): string {
	return [
		"## Error Pattern Match",
		"",
		`**Pattern:** ${match.pattern.id}`,
		`**Type:** ${match.pattern.type}`,
		`**Description:** ${match.pattern.description}`,
		`**Confidence:** ${match.confidence}%`,
		`**Source:** ${match.source === "memory" ? "MEMORY.md fallback" : "pattern"}`,
		"",
		"**Solution:**",
		match.suggestion,
		"",
		`**Occurrences:** This pattern has been seen ${match.pattern.occurrences} times.`,
		"",
		"**Example Errors:**",
		...match.pattern.examples
			.slice(0, 3)
			.map((e) => `- ${e.slice(0, 100)}${e.length > 100 ? "..." : ""}`),
	].join("\n");
}

function formatSuggestions(suggestions: ErrorMatch[]): string {
	const lines: string[] = [
		"## Error Suggestions",
		"",
		`Found ${suggestions.length} suggestions:`,
		"",
	];

	for (let i = 0; i < suggestions.length; i++) {
		const s = suggestions[i];
		lines.push(`### Suggestion ${i + 1} (${s.confidence}% confidence)`);
		lines.push("");
		lines.push(`**Pattern:** ${s.pattern.id}`);
		lines.push(`**Source:** ${s.source === "memory" ? "MEMORY.md fallback" : "pattern"}`);
		lines.push(`**Description:** ${s.pattern.description}`);
		lines.push("");
		lines.push("**Solution:**");
		lines.push(s.suggestion);
		lines.push("");
	}

	return lines.join("\n");
}

function formatPattern(pattern: ErrorPattern): string {
	return [
		`### Pattern: ${pattern.id}`,
		"",
		`- **Type:** ${pattern.type}`,
		`- **Description:** ${pattern.description}`,
		`- **Pattern:** \`/${pattern.pattern}/\``,
		`- **Solution:** ${pattern.solution}`,
		`- **Confidence:** ${pattern.confidence}%`,
		`- **Occurrences:** ${pattern.occurrences}`,
		`- **Last Seen:** ${pattern.lastSeen}`,
		"",
		"**Examples:**",
		...pattern.examples
			.slice(0, 3)
			.map((e) => `- ${e.slice(0, 100)}${e.length > 100 ? "..." : ""}`),
	].join("\n");
}

function formatPatternBrief(pattern: ErrorPattern): string {
	return [
		`**${pattern.id}** (${pattern.type}, ${pattern.confidence}% confidence)`,
		`- Description: ${pattern.description}`,
		`- Occurrences: ${pattern.occurrences}`,
		`- Solution: ${pattern.solution.slice(0, 100)}${pattern.solution.length > 100 ? "..." : ""}`,
	].join("\n");
}

export default errorPatternsTool;
