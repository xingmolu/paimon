/**
 * Pattern Miner tool - Get evolution pattern recommendations
 *
 * Mines successful patterns from past sessions to predict optimal approaches.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type PatternType,
	formatMiningStats,
	formatRecommendations,
	getPatternMiner,
} from "../pattern-miner.js";

/**
 * Pattern Miner tool for evolution recommendations
 */
export const patternMinerTool: AgentTool = {
	name: "patternMiner",
	label: "Evolution Pattern Mining",
	description:
		"Mine successful patterns from past evolution sessions to predict optimal approaches. Use this to get recommendations for task selection and approaches based on historical success patterns.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: 'recommend' (get recommendations for current task), 'stats' (view pattern statistics), 'patterns' (list all patterns), 'get' (get specific pattern), 'refresh' (re-analyze sessions)",
		}),
		taskType: Type.Optional(
			Type.String({
				description: "Task type context: capability, reliability, feature",
			}),
		),
		skillsAvailable: Type.Optional(
			Type.Array(Type.String(), {
				description: "Skills available for use",
			}),
		),
		taskDescription: Type.Optional(
			Type.String({
				description: "Current task description for pattern matching",
			}),
		),
		patternId: Type.Optional(
			Type.String({
				description: "Pattern ID to get details for (for 'get' action)",
			}),
		),
		patternType: Type.Optional(
			Type.String({
				description:
					"Pattern type filter: skill-combination, task-type-success, time-pattern, error-avoidance, approach-pattern",
			}),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const { action, taskType, skillsAvailable, taskDescription, patternId, patternType } =
			params as {
				action: string;
				taskType?: string;
				skillsAvailable?: string[];
				taskDescription?: string;
				patternId?: string;
				patternType?: PatternType;
			};

		try {
			const miner = getPatternMiner();

			switch (action) {
				case "recommend": {
					const recommendations = miner.getRecommendations({
						taskType,
						skillsAvailable,
						taskDescription,
					});

					return {
						content: [{ type: "text", text: formatRecommendations(recommendations) }],
						details: { recommendations },
					};
				}

				case "stats": {
					const stats = miner.getStats();
					return {
						content: [{ type: "text", text: formatMiningStats(stats) }],
						details: { stats },
					};
				}

				case "patterns": {
					const patterns = miner.getPatterns(patternType);

					if (patterns.length === 0) {
						return {
							content: [
								{
									type: "text",
									text: patternType
										? `No patterns found for type '${patternType}'.`
										: "No patterns found. Need more session history.",
								},
							],
							details: { patterns: [], filter: patternType },
						};
					}

					const lines: string[] = [
						`## Evolution Patterns (${patterns.length} total)`,
						"",
						"| Pattern ID | Type | Success Rate | Confidence | Sample Size |",
						"|------------|------|--------------|------------|-------------|",
					];

					for (const pattern of patterns) {
						lines.push(
							`| ${pattern.id} | ${pattern.type} | ${pattern.successRate}% | ${pattern.confidence}% | ${pattern.sampleSize} |`,
						);
					}

					return {
						content: [{ type: "text", text: lines.join("\n") }],
						details: { patterns },
					};
				}

				case "get": {
					if (!patternId) {
						return {
							content: [
								{
									type: "text",
									text: "Error: 'patternId' is required for 'get' action",
								},
							],
							details: "Error: patternId required",
						};
					}

					const pattern = miner.getPattern(patternId);

					if (!pattern) {
						return {
							content: [
								{
									type: "text",
									text: `Pattern '${patternId}' not found.`,
								},
							],
							details: "Pattern not found",
						};
					}

					const lines: string[] = [
						`## Pattern: ${pattern.id}`,
						"",
						`**Type:** ${pattern.type}`,
						`**Description:** ${pattern.description}`,
						`**Success Rate:** ${pattern.successRate}%`,
						`**First Try Rate:** ${pattern.firstTryRate}%`,
						`**Average Time:** ${pattern.averageTime} minutes`,
						`**Confidence:** ${pattern.confidence}%`,
						`**Sample Size:** ${pattern.sampleSize} sessions`,
						"",
						"**Characteristics:**",
					];

					if (pattern.characteristics.skills) {
						lines.push(`- Skills: ${pattern.characteristics.skills.join(", ")}`);
					}
					if (pattern.characteristics.taskType) {
						lines.push(`- Task Type: ${pattern.characteristics.taskType}`);
					}
					if (pattern.characteristics.timeRange) {
						lines.push(
							`- Time Range: ${pattern.characteristics.timeRange.min}-${pattern.characteristics.timeRange.max} min`,
						);
					}
					if (pattern.characteristics.errorsAvoided) {
						lines.push(`- Errors Avoided: ${pattern.characteristics.errorsAvoided.join(", ")}`);
					}
					if (pattern.characteristics.approach) {
						lines.push(`- Approach: ${pattern.characteristics.approach}`);
					}

					if (pattern.examples.length > 0) {
						lines.push("", "**Examples:**");
						for (const ex of pattern.examples) {
							lines.push(
								`- ${ex.date}: "${ex.taskDescription.slice(0, 50)}..." (${ex.time}min, ${ex.firstTry ? "✅" : "❌"})`,
							);
						}
					}

					return {
						content: [{ type: "text", text: lines.join("\n") }],
						details: { pattern },
					};
				}

				case "refresh": {
					miner.refresh();
					const stats = miner.getStats();

					return {
						content: [
							{
								type: "text",
								text: `Patterns refreshed. Found ${stats.totalPatterns} patterns from ${stats.totalSessionsAnalyzed} sessions.`,
							},
						],
						details: { stats },
					};
				}

				default:
					return {
						content: [
							{
								type: "text",
								text: `Error: Unknown action '${action}'. Use: recommend, stats, patterns, get, refresh`,
							},
						],
						details: `Error: Unknown action '${action}'`,
					};
			}
		} catch (e) {
			const error = e instanceof Error ? e.message : String(e);
			return {
				content: [{ type: "text", text: `Error: ${error}` }],
				details: `Error: ${error}`,
			};
		}
	},
};
