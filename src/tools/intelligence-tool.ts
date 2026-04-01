/**
 * Intelligence Tool - Unified entry point for evolution intelligence.
 *
 * Integrates taskPredictor, patternMiner, errorPatterns, and rag into
 * a single tool for smarter task selection decisions.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { type TaskContext, getEvolutionIntelligence } from "../intelligence.js";

/**
 * Intelligence tool for unified recommendations.
 */
export const intelligenceTool: AgentTool = {
	name: "intelligence",
	label: "Unified Evolution Intelligence",
	description:
		"Unified evolution intelligence - combine all intelligence tools for task recommendations. Use before task selection for smarter decisions.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: 'analyze' (get recommendations), 'stats' (view intelligence stats), 'refresh' (reload all modules), 'risks' (analyze error risks), 'opportunities' (find key opportunities)",
		}),
		taskDescription: Type.Optional(
			Type.String({
				description: "Task description to analyze (for analyze action)",
			}),
		),
		taskType: Type.Optional(
			Type.String({
				description: "Task type: capability, reliability, feature (for analyze action)",
			}),
		),
		skillsAvailable: Type.Optional(
			Type.Array(Type.String(), {
				description: "Skills available for the task (for analyze action)",
			}),
		),
		complexity: Type.Optional(
			Type.String({
				description: "Task complexity: low, medium, high (for analyze action)",
			}),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const { action, taskDescription, taskType, skillsAvailable, complexity } = params as {
			action: string;
			taskDescription?: string;
			taskType?: "capability" | "reliability" | "feature";
			skillsAvailable?: string[];
			complexity?: "low" | "medium" | "high";
		};

		try {
			const intelligence = getEvolutionIntelligence();

			switch (action) {
				case "analyze": {
					const context: TaskContext = {
						taskDescription: taskDescription || "Unknown task",
						taskType: taskType || "capability",
						skillsAvailable: skillsAvailable || [],
						complexity,
					};

					const recommendation = intelligence.analyze(context);
					return {
						content: [{ type: "text", text: intelligence.formatRecommendation(recommendation) }],
						details: { recommendation },
					};
				}

				case "stats": {
					const stats = intelligence.getStats();
					return {
						content: [{ type: "text", text: intelligence.formatStats(stats) }],
						details: { stats },
					};
				}

				case "refresh": {
					intelligence.refresh();
					return {
						content: [
							{
								type: "text",
								text: "All intelligence modules refreshed. Updated from MEMORY.md and session history.",
							},
						],
						details: { refreshed: true },
					};
				}

				case "risks": {
					const context: TaskContext = {
						taskDescription: "Risk analysis",
						taskType: taskType || "capability",
						skillsAvailable: [],
						complexity,
					};

					const recommendation = intelligence.analyze(context);
					const risks = recommendation.errorRisks;

					if (risks.length === 0) {
						return {
							content: [
								{
									type: "text",
									text: "No significant error risks detected for this task type.",
								},
							],
							details: { risks: [] },
						};
					}

					const lines: string[] = [
						"## Error Risk Analysis",
						"",
						`Analyzed risks for ${taskType || "capability"} tasks with ${complexity || "medium"} complexity:`,
						"",
					];

					for (const risk of risks) {
						lines.push(`### ${risk.errorType}`);
						lines.push(`- **Description:** ${risk.description}`);
						lines.push(`- **Likelihood:** ${risk.likelihood}%`);
						if (risk.solutions.length > 0) {
							lines.push("- **Solutions:**");
							for (const sol of risk.solutions) {
								lines.push(`  - ${sol}`);
							}
						}
						lines.push("");
					}

					return {
						content: [{ type: "text", text: lines.join("\n") }],
						details: { risks },
					};
				}

				case "opportunities": {
					const context: TaskContext = {
						taskDescription: taskDescription || "Task",
						taskType: taskType || "capability",
						skillsAvailable: skillsAvailable || [],
						complexity: "medium",
					};

					const recommendation = intelligence.analyze(context);
					const opportunities = recommendation.keyOpportunities;

					if (opportunities.length === 0) {
						return {
							content: [
								{
									type: "text",
									text: "No specific opportunities identified. Proceed with standard approach.",
								},
							],
							details: { opportunities: [] },
						};
					}

					const lines: string[] = [
						"## Key Opportunities",
						"",
						`Found ${opportunities.length} opportunities for ${taskDescription || "task"}:`,
						"",
					];

					for (const opp of opportunities) {
						lines.push(`✨ ${opp}`);
					}

					lines.push(
						"",
						"**Recommendation:** Leverage these opportunities to improve success probability.",
					);

					return {
						content: [{ type: "text", text: lines.join("\n") }],
						details: { opportunities },
					};
				}

				default:
					return {
						content: [
							{
								type: "text",
								text: `Unknown action: ${action}. Available: analyze, stats, refresh, risks, opportunities`,
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

export default intelligenceTool;
