/**
 * Task Predictor Tool - Predict task success before starting
 *
 * Uses historical patterns from MEMORY.md scorecard to predict outcomes.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { type TaskContext, TaskSuccessPredictor, getTaskPredictor } from "../task-predictor.js";

/**
 * Task Predictor tool for predicting task success
 */
export const taskPredictorTool: AgentTool = {
	name: "taskPredictor",
	label: "Task Success Prediction",
	description:
		"Predict task success likelihood before starting. Use before task selection to estimate outcomes and identify risk factors based on historical patterns.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: 'predict' (estimate success), 'stats' (view accuracy), 'patterns' (view historical patterns), 'refresh' (reload from MEMORY.md)",
		}),
		taskDescription: Type.Optional(
			Type.String({
				description: "Task description for prediction (required for predict action)",
			}),
		),
		taskType: Type.Optional(
			Type.String({
				description: "Task type: capability, reliability, or feature (required for predict action)",
			}),
		),
		skillsAvailable: Type.Optional(
			Type.Array(Type.String(), {
				description: "Skills available for this task",
			}),
		),
		complexity: Type.Optional(
			Type.String({
				description: "Estimated task complexity: low, medium, high",
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
			const predictor = getTaskPredictor();

			switch (action) {
				case "predict": {
					if (!taskDescription) {
						return {
							content: [
								{
									type: "text",
									text: "Error: 'taskDescription' is required for 'predict' action",
								},
							],
							details: "Error: taskDescription required",
						};
					}

					if (!taskType) {
						return {
							content: [
								{
									type: "text",
									text: "Error: 'taskType' is required for 'predict' action (capability, reliability, feature)",
								},
							],
							details: "Error: taskType required",
						};
					}

					const context: TaskContext = {
						taskDescription,
						taskType,
						skillsAvailable: skillsAvailable ?? [],
						complexity,
					};

					const prediction = predictor.predict(context);

					return {
						content: [{ type: "text", text: predictor.formatPrediction(prediction) }],
						details: { prediction },
					};
				}

				case "stats": {
					const stats = predictor.getStats();

					const lines: string[] = [
						"## Task Predictor Statistics",
						"",
						`**Total Predictions:** ${stats.totalPredictions}`,
						`**Accurate Predictions:** ${stats.accuratePredictions}`,
						`**Accuracy Rate:** ${stats.accuracyRate}%`,
						"",
					];

					if (Object.keys(stats.predictionsByType).length > 0) {
						lines.push("### Accuracy by Task Type");
						lines.push("| Type | Total | Accurate | Rate |");
						lines.push("|------|-------|----------|------|");

						for (const [type, data] of Object.entries(stats.predictionsByType)) {
							const rate = data.total > 0 ? Math.round((data.accurate / data.total) * 100) : 0;
							lines.push(`| ${type} | ${data.total} | ${data.accurate} | ${rate}% |`);
						}
					}

					return {
						content: [{ type: "text", text: lines.join("\n") }],
						details: { stats },
					};
				}

				case "patterns": {
					const patterns = predictor.getPatterns();

					if (patterns.length === 0) {
						return {
							content: [
								{
									type: "text",
									text: "## Historical Patterns\n\nNo patterns found. Run refresh to load from MEMORY.md.",
								},
							],
							details: { patterns: [] },
						};
					}

					const lines: string[] = [
						"## Historical Patterns",
						"",
						"| Type | Success Rate | Avg Time | Common Errors |",
						"|------|-------------|----------|---------------|",
					];

					for (const pattern of patterns) {
						const successRate = Math.round(pattern.avgSuccessRate * 100);
						const errors = pattern.commonErrors.slice(0, 2).join(", ") || "none";
						lines.push(
							`| ${pattern.taskType} | ${successRate}% | ~${pattern.avgTime}m | ${errors} |`,
						);
					}

					lines.push("", "### Recommended Skills by Type");
					for (const pattern of patterns) {
						if (pattern.successfulSkills.length > 0) {
							lines.push(`- **${pattern.taskType}:** ${pattern.successfulSkills.join(", ")}`);
						}
					}

					return {
						content: [{ type: "text", text: lines.join("\n") }],
						details: { patterns },
					};
				}

				case "refresh": {
					predictor.refresh();
					const patterns = predictor.getPatterns();

					return {
						content: [
							{
								type: "text",
								text: `## Task Predictor Refreshed\n\nLoaded ${patterns.length} historical patterns from MEMORY.md.`,
							},
						],
						details: { patterns },
					};
				}

				default:
					return {
						content: [
							{
								type: "text",
								text: `Error: Unknown action '${action}'. Use: predict, stats, patterns, refresh`,
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
