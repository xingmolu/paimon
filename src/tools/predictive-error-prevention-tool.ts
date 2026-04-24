/**
 * Predictive Error Prevention Tool
 *
 * Proactively predicts errors BEFORE they occur based on:
 * - Task type and description patterns
 * - Files being modified
 * - Tools being used
 * - Historical error patterns
 *
 * Unlike reactive errorPatterns tool, this predicts errors proactively.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type ErrorPattern,
	type PredictionContext,
	getPredictiveErrorPreventionManager,
} from "../predictive-error-prevention.js";

// Tool Definition
export const predictiveErrorPreventionTool: AgentTool = {
	name: "predictiveErrorPrevention",
	label: "Predictive Error Prevention",
	description: `Predict errors BEFORE they occur based on task context, files, tools, and historical patterns

Actions:
- predict: Get error predictions for current context (provide taskType, files, toolsUsed)
- warnings: Get proactive warnings for a task (provide taskType, taskDescription)
- patterns: List all prediction patterns
- pattern: Get details of a specific pattern (provide patternId)
- learn: Learn from an error that occurred (provide errorType, context, preventionWorked)
- record: Record prediction outcome (provide predictionId, action: occurred/prevented/false-positive)
- stats: View prediction statistics and accuracy
- config: View or update configuration
- enable/disable: Enable or disable predictive error prevention
- reset: Reset statistics
- clear: Clear predictions history
- help: Show help message

Example usage:
predictiveErrorPrevention({action: 'predict', taskType: 'capability', files: ['src/agent.ts'], toolsUsed: ['edit', 'bash']})
predictiveErrorPrevention({action: 'warnings', taskType: 'capability', taskDescription: 'Add new tool'})
predictiveErrorPrevention({action: 'learn', errorType: 'typescript', preventionWorked: true})
predictiveErrorPrevention({action: 'stats'})`,
	parameters: Type.Object({
		action: Type.String({
			enum: [
				"predict",
				"warnings",
				"patterns",
				"pattern",
				"learn",
				"record",
				"stats",
				"config",
				"enable",
				"disable",
				"reset",
				"clear",
				"help",
			],
			description:
				"Action to perform: predict (get predictions), warnings (get warnings), patterns (list patterns), pattern (get details), learn (learn from error), record (record outcome), stats, config, enable/disable, reset, clear, help",
		}),
		taskType: Type.Optional(
			Type.String({
				enum: ["capability", "reliability", "feature"],
				description: "Task type for prediction context",
			}),
		),
		taskDescription: Type.Optional(
			Type.String({
				description: "Task description for prediction context",
			}),
		),
		files: Type.Optional(
			Type.Array(Type.String(), {
				description: "Files being worked on for prediction context",
			}),
		),
		toolsUsed: Type.Optional(
			Type.Array(Type.String(), {
				description: "Tools used so far for prediction context",
			}),
		),
		recentErrors: Type.Optional(
			Type.Array(Type.String(), {
				description: "Recent errors encountered",
			}),
		),
		errorType: Type.Optional(
			Type.String({
				description: "Error type for learning (typescript, test, lint, runtime)",
			}),
		),
		predictionId: Type.Optional(
			Type.String({
				description: "Prediction ID for recording outcomes",
			}),
		),
		recordAction: Type.Optional(
			Type.String({
				enum: ["occurred", "prevented", "false-positive"],
				description: "Outcome to record for record action: occurred, prevented, or false-positive",
			}),
		),
		preventionWorked: Type.Optional(
			Type.Boolean({
				description: "Whether prevention strategy worked (for learning)",
			}),
		),
		patternId: Type.Optional(
			Type.String({
				description: "Pattern ID for getting pattern details",
			}),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const manager = getPredictiveErrorPreventionManager();
		const args = params as {
			action: string;
			taskType?: "capability" | "reliability" | "feature";
			taskDescription?: string;
			files?: string[];
			toolsUsed?: string[];
			recentErrors?: string[];
			errorType?: string;
			predictionId?: string;
			recordAction?: "occurred" | "prevented" | "false-positive";
			preventionWorked?: boolean;
			patternId?: string;
		};

		try {
			let result: string;

			switch (args.action) {
				case "predict": {
					const context: PredictionContext = {
						taskType: args.taskType,
						taskDescription: args.taskDescription,
						files: args.files,
						toolsUsed: args.toolsUsed,
						recentErrors: args.recentErrors,
					};
					const predictions = manager.predict(context);
					result = manager.formatPredictions(predictions);
					break;
				}

				case "warnings": {
					const context: PredictionContext = {
						taskType: args.taskType,
						taskDescription: args.taskDescription,
						files: args.files,
						toolsUsed: args.toolsUsed,
					};
					const warnings = manager.getWarnings(context);
					if (warnings.length === 0) {
						result = "No predicted errors for current context.";
					} else {
						result = ["## Proactive Error Warnings", "", ...warnings].join("\n");
					}
					break;
				}

				case "patterns": {
					const patterns = manager.getPatterns();
					const lines = ["## Prediction Patterns", ""];
					for (const p of patterns) {
						lines.push(
							`- **${p.id}** (${p.errorType}): ${p.occurrences} occurrences, ${Math.round(p.successRate * 100)}% success rate`,
						);
					}
					result = lines.join("\n");
					break;
				}

				case "pattern": {
					if (!args.patternId) {
						result = "Error: Pattern ID required for pattern action";
						break;
					}
					const pattern = manager.getPattern(args.patternId);
					if (!pattern) {
						result = `Error: Pattern not found: ${args.patternId}`;
						break;
					}
					result = [
						`## Pattern: ${pattern.id}`,
						"",
						`- **Error Type:** ${pattern.errorType}`,
						`- **Occurrences:** ${pattern.occurrences}`,
						`- **Success Rate:** ${Math.round(pattern.successRate * 100)}%`,
						"- **Prevention Strategies:**",
						...pattern.preventionStrategies.map((s) => `  - ${s}`),
					].join("\n");
					break;
				}

				case "learn": {
					if (!args.errorType) {
						result = "Error: Error type required for learn action";
						break;
					}
					const context: PredictionContext = {
						taskType: args.taskType,
						files: args.files,
						toolsUsed: args.toolsUsed,
					};
					manager.learnFromError(args.errorType, context, args.preventionWorked ?? false);
					result = `Learned from error: ${args.errorType}`;
					break;
				}

				case "record": {
					if (!args.predictionId) {
						result = "Error: Prediction ID required for record action";
						break;
					}
					if (!args.recordAction) {
						result =
							"Error: recordAction required for record action (occurred, prevented, or false-positive)";
						break;
					}
					switch (args.recordAction) {
						case "occurred":
							manager.recordOccurrence(args.predictionId);
							result = `Recorded occurred outcome for prediction: ${args.predictionId}`;
							break;
						case "prevented":
							manager.recordPrevention(args.predictionId);
							result = `Recorded prevented outcome for prediction: ${args.predictionId}`;
							break;
						case "false-positive":
							manager.recordFalsePositive(args.predictionId);
							result = `Recorded false-positive outcome for prediction: ${args.predictionId}`;
							break;
					}
					break;
				}

				case "stats": {
					result = manager.formatStats();
					break;
				}

				case "config": {
					const config = manager.getConfig();
					result = [
						"## Predictive Error Prevention Config",
						"",
						`- **Enabled:** ${config.enabled}`,
						`- **Min Probability:** ${config.minProbability}`,
						`- **Min Confidence:** ${config.minConfidence}`,
						`- **Proactive Warnings:** ${config.proactiveWarnings}`,
						`- **Session Start Predictions:** ${config.sessionStartPredictions}`,
						`- **Pre Tool-Use Checks:** ${config.preToolUseChecks}`,
						`- **Learning Enabled:** ${config.learningEnabled}`,
					].join("\n");
					break;
				}

				case "enable": {
					manager.setEnabled(true);
					result = "Predictive error prevention enabled.";
					break;
				}

				case "disable": {
					manager.setEnabled(false);
					result = "Predictive error prevention disabled.";
					break;
				}

				case "reset": {
					manager.resetStats();
					result = "Prediction statistics reset.";
					break;
				}

				case "clear": {
					manager.clearPredictions();
					result = "Prediction history cleared.";
					break;
				}

				case "help": {
					result = [
						"# Predictive Error Prevention Tool",
						"",
						"Proactively predicts errors BEFORE they occur based on task context, files, tools, and historical patterns.",
						"",
						"## Actions",
						"",
						"- **predict** - Get error predictions for current context",
						"- **warnings** - Get proactive warnings for a task",
						"- **patterns** - List all prediction patterns",
						"- **pattern** - Get details of a specific pattern",
						"- **learn** - Learn from an error that occurred",
						"- **record** - Record prediction outcome",
						"- **stats** - View prediction statistics and accuracy",
						"- **config** - View or update configuration",
						"- **enable/disable** - Toggle predictive error prevention",
						"- **reset** - Reset statistics",
						"- **clear** - Clear predictions history",
						"- **help** - Show this help message",
						"",
						"## Example Usage",
						"",
						"```",
						"// Get predictions for current context",
						"predictiveErrorPrevention({action: 'predict', taskType: 'capability', files: ['src/agent.ts'], toolsUsed: ['edit']})",
						"",
						"// Get warnings before starting a task",
						"predictiveErrorPrevention({action: 'warnings', taskType: 'capability', taskDescription: 'Add new tool'})",
						"",
						"// Learn from an error",
						"predictiveErrorPrevention({action: 'learn', errorType: 'typescript', preventionWorked: true})",
						"",
						"// Record prediction outcome",
						"predictiveErrorPrevention({action: 'record', predictionId: 'pred-123', recordAction: 'prevented'})",
						"",
						"// View statistics",
						"predictiveErrorPrevention({action: 'stats'})",
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
						text: `Error in predictiveErrorPrevention: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				details: { error: true },
			};
		}
	},
};

export default predictiveErrorPreventionTool;
