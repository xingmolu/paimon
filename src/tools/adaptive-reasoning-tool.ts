/**
 * Adaptive Reasoning Tool
 *
 * Tool for selecting and adapting reasoning strategies based on task context.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type ReasoningStrategy,
	type StrategyOutcome,
	type TaskContext,
	getAdaptiveReasoningManager,
} from "../adaptive-reasoning.js";

// Tool Definition
export const adaptiveReasoningToolDefinition: AgentTool = {
	name: "adaptiveReasoning",
	label: "Adaptive Reasoning Strategy Selection",
	description: `Manage adaptive reasoning strategy selection - automatically selects optimal reasoning strategies based on task type, context, and historical success rates. Use before starting complex tasks to improve success rate.

Actions:
- select: Choose optimal strategy for a task
- adapt: Change strategy during task execution
- record: Log task outcome for learning
- context: Detect context from task description
- strategies: List all available strategies
- profile: Get details of a specific strategy
- recommend: Get recommendations for task type
- stats: View performance statistics
- config: View or update configuration
- enable/disable: Toggle adaptive reasoning
- reset: Clear learned data
- help: Show this help message

Example Usage:
adaptiveReasoning({action: 'select', taskType: 'capability', taskDescription: 'Add new tool'})
adaptiveReasoning({action: 'record', strategy: 'systematic', taskType: 'capability', success: true, timeMinutes: 15})
adaptiveReasoning({action: 'recommend', taskType: 'capability'})`,
	parameters: Type.Object({
		action: Type.String({
			enum: [
				"select",
				"adapt",
				"record",
				"context",
				"strategies",
				"profile",
				"recommend",
				"stats",
				"config",
				"enable",
				"disable",
				"reset",
				"help",
			],
			description:
				"Action to perform: select (choose strategy), adapt (change strategy), record (log outcome), context (detect context), strategies (list all), profile (get details), recommend (get recommendations), stats (view statistics), config (view/update), enable/disable, reset, help",
		}),
		taskType: Type.Optional(
			Type.String({
				enum: ["capability", "reliability", "feature"],
				description: "Task type for selection/adaptation",
			}),
		),
		context: Type.Optional(
			Type.String({
				enum: [
					"code-exploration",
					"debugging",
					"architecture",
					"implementation",
					"verification",
					"research",
					"planning",
					"review",
				],
				description: "Task context for selection/adaptation",
			}),
		),
		taskDescription: Type.Optional(
			Type.String({
				description: "Task description for context detection",
			}),
		),
		strategy: Type.Optional(
			Type.String({
				enum: [
					"analytical",
					"creative",
					"systematic",
					"exploratory",
					"diagnostic",
					"architectural",
					"iterative",
				],
				description: "Reasoning strategy for record/adapt actions",
			}),
		),
		reason: Type.Optional(
			Type.String({
				description: "Reason for adaptation (for adapt action)",
			}),
		),
		success: Type.Optional(
			Type.Boolean({
				description: "Whether the task succeeded (for record action)",
			}),
		),
		timeMinutes: Type.Optional(
			Type.Number({
				description: "Time taken in minutes (for record action)",
			}),
		),
		errorsEncountered: Type.Optional(
			Type.Array(Type.String(), {
				description: "Errors encountered during task (for record action)",
			}),
		),
		skillsUsed: Type.Optional(
			Type.Array(Type.String(), {
				description: "Skills used during task (for record action)",
			}),
		),
		config: Type.Optional(
			Type.Object({
				learningRate: Type.Optional(Type.Number()),
				explorationRate: Type.Optional(Type.Number()),
				preferLearnedPatterns: Type.Optional(Type.Boolean()),
				adaptOnFailure: Type.Optional(Type.Boolean()),
			}),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const manager = getAdaptiveReasoningManager();
		const args = params as {
			action: string;
			taskType?: "capability" | "reliability" | "feature";
			context?: TaskContext;
			taskDescription?: string;
			strategy?: ReasoningStrategy;
			reason?: string;
			success?: boolean;
			timeMinutes?: number;
			errorsEncountered?: string[];
			skillsUsed?: string[];
			config?: {
				learningRate?: number;
				explorationRate?: number;
				preferLearnedPatterns?: boolean;
				adaptOnFailure?: boolean;
			};
		};

		try {
			let result: string;

			switch (args.action) {
				case "select": {
					if (!args.taskType) {
						result = "Error: taskType is required for select action";
						break;
					}
					const context =
						args.context ||
						(args.taskDescription ? manager.detectContext(args.taskDescription) : "implementation");
					const selection = manager.selectStrategy(args.taskType, context, args.taskDescription);

					const lines = [
						"## Strategy Selection",
						"",
						`**Selected Strategy:** ${selection.selectedStrategy}`,
						`**Confidence:** ${(selection.confidence * 100).toFixed(0)}%`,
						`**Reasoning:** ${selection.reasoning}`,
						"",
						"### Alternative Strategies",
						"",
					];

					for (const alt of selection.alternativeStrategies) {
						lines.push(
							`- **${alt.strategy}:** ${(alt.confidence * 100).toFixed(0)}% confidence - ${alt.reason}`,
						);
					}

					if (selection.adaptationTriggers.length > 0) {
						lines.push("", "### Adaptation Triggers", "");
						for (const trigger of selection.adaptationTriggers) {
							lines.push(`- ${trigger}`);
						}
					}

					result = lines.join("\n");
					break;
				}

				case "adapt": {
					if (!args.strategy || !args.reason || !args.taskType) {
						result = "Error: strategy, reason, and taskType are required for adapt action";
						break;
					}
					const context = args.context || "implementation";
					const newSelection = manager.adaptStrategy(
						args.strategy,
						args.reason,
						context,
						args.taskType,
					);

					result = [
						"## Strategy Adapted",
						"",
						`**Previous Strategy:** ${args.strategy}`,
						`**New Strategy:** ${newSelection.selectedStrategy}`,
						`**Reason:** ${newSelection.reasoning}`,
						`**Confidence:** ${(newSelection.confidence * 100).toFixed(0)}%`,
					].join("\n");
					break;
				}

				case "record": {
					if (!args.strategy || !args.taskType || args.success === undefined) {
						result = "Error: strategy, taskType, and success are required for record action";
						break;
					}
					const context = args.context || "implementation";
					const outcome: StrategyOutcome = {
						strategy: args.strategy,
						taskType: args.taskType,
						context,
						success: args.success,
						timeMinutes: args.timeMinutes || 0,
						errorsEncountered: args.errorsEncountered || [],
						skillsUsed: args.skillsUsed || [],
					};

					manager.recordOutcome(outcome);

					result = [
						"## Outcome Recorded",
						"",
						`**Strategy:** ${args.strategy}`,
						`**Task Type:** ${args.taskType}`,
						`**Context:** ${context}`,
						`**Success:** ${args.success ? "Yes" : "No"}`,
						`**Time:** ${args.timeMinutes || 0} minutes`,
					].join("\n");
					break;
				}

				case "context": {
					if (!args.taskDescription) {
						result = "Error: taskDescription is required for context action";
						break;
					}
					const context = manager.detectContext(args.taskDescription);
					result = `Detected context: **${context}**`;
					break;
				}

				case "strategies": {
					const profiles = manager.getAllStrategyProfiles();

					const lines = ["## Available Reasoning Strategies", ""];

					for (const profile of profiles) {
						lines.push(`### ${profile.strategy}`);
						lines.push(`- ${profile.description}`);
						lines.push(`- **Optimal for:** ${profile.optimalTaskTypes.join(", ")}`);
						lines.push(`- **Best contexts:** ${profile.optimalContexts.join(", ")}`);
						lines.push("");
					}

					result = lines.join("\n");
					break;
				}

				case "profile": {
					if (!args.strategy) {
						result = "Error: strategy is required for profile action";
						break;
					}
					result = manager.formatStrategyProfile(args.strategy);
					break;
				}

				case "recommend": {
					if (!args.taskType) {
						result = "Error: taskType is required for recommend action";
						break;
					}
					const recommendations = manager.getRecommendations(args.taskType, args.context);

					if (recommendations.length === 0) {
						result =
							"No recommendations available yet. Use the tool more to build up learning data.";
					} else {
						result = ["## Recommendations", "", ...recommendations.map((r) => `- ${r}`)].join("\n");
					}
					break;
				}

				case "stats": {
					result = manager.formatStats();
					break;
				}

				case "config": {
					if (args.config) {
						manager.updateConfig({
							learningRate: args.config.learningRate,
							explorationRate: args.config.explorationRate,
							preferLearnedPatterns: args.config.preferLearnedPatterns,
							adaptOnFailure: args.config.adaptOnFailure,
						});
						result = "Configuration updated.";
					} else {
						const config = manager.getConfig();
						result = [
							"## Adaptive Reasoning Configuration",
							"",
							`**Enabled:** ${config.enabled}`,
							`**Learning Rate:** ${config.learningRate}`,
							`**Min Samples for Adaptation:** ${config.minSamplesForAdaptation}`,
							`**Exploration Rate:** ${config.explorationRate}`,
							`**Prefer Learned Patterns:** ${config.preferLearnedPatterns}`,
							`**Adapt on Failure:** ${config.adaptOnFailure}`,
							`**Track Intermediate Results:** ${config.trackIntermediateResults}`,
						].join("\n");
					}
					break;
				}

				case "enable": {
					manager.setEnabled(true);
					result = "Adaptive reasoning enabled.";
					break;
				}

				case "disable": {
					manager.setEnabled(false);
					result = "Adaptive reasoning disabled.";
					break;
				}

				case "reset": {
					manager.resetStats();
					result = "Adaptive reasoning statistics reset.";
					break;
				}

				case "help": {
					result = [
						"# Adaptive Reasoning Tool",
						"",
						"Automatically selects optimal reasoning strategies based on task context.",
						"",
						"## Actions",
						"",
						"- **select** - Choose optimal strategy for a task",
						"- **adapt** - Change strategy during task execution",
						"- **record** - Log task outcome for learning",
						"- **context** - Detect context from task description",
						"- **strategies** - List all available strategies",
						"- **profile** - Get details of a specific strategy",
						"- **recommend** - Get recommendations for task type",
						"- **stats** - View performance statistics",
						"- **config** - View or update configuration",
						"- **enable/disable** - Toggle adaptive reasoning",
						"- **reset** - Clear learned data",
						"- **help** - Show this help message",
						"",
						"## Example Usage",
						"",
						"```",
						"// Select strategy for a capability task",
						"adaptiveReasoning({action: 'select', taskType: 'capability', taskDescription: 'Add new tool'})",
						"",
						"// Record outcome for learning",
						"adaptiveReasoning({action: 'record', strategy: 'systematic', taskType: 'capability', success: true, timeMinutes: 15})",
						"",
						"// Get recommendations",
						"adaptiveReasoning({action: 'recommend', taskType: 'capability'})",
						"```",
					].join("\n");
					break;
				}

				default:
					result = `Unknown action: ${args.action}. Use 'help' for available actions.`;
			}

			return {
				content: [{ type: "text", text: result }],
				details: { action: args.action },
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Error in adaptiveReasoning: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				details: { error: true },
			};
		}
	},
};

export default adaptiveReasoningToolDefinition;
