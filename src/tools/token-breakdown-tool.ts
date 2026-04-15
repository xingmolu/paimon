/**
 * Token breakdown tool - Detailed token usage breakdown display (Aider /tokens pattern)
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	TokenBreakdownManager,
	getTokenBreakdownManager,
	resetTokenBreakdownManager,
} from "../token-breakdown.js";

/**
 * Token breakdown tool for showing detailed token usage breakdowns
 */
export const tokenBreakdownTool: AgentTool = {
	name: "tokenBreakdown",
	label: "Token Breakdown Display",
	description:
		"Show detailed token usage breakdown for context analysis. Displays token distribution across system messages, chat history, repo map, and files with cost estimation. Inspired by Aider's /tokens command.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: breakdown (generate breakdown), summary (quick summary), models (list models), compare (compare costs), help",
		}),
		model: Type.Optional(Type.String({ description: "Model name for breakdown/cost calculation" })),
		systemPrompt: Type.Optional(Type.String({ description: "System prompt content" })),
		chatHistory: Type.Optional(
			Type.Array(
				Type.Object({
					role: Type.String(),
					content: Type.String(),
				}),
			),
		),
		repoMap: Type.Optional(Type.String({ description: "Repository map content" })),
		files: Type.Optional(
			Type.Array(Type.String(), { description: "List of file paths to analyze" }),
		),
		readOnlyFiles: Type.Optional(
			Type.Array(Type.String(), { description: "List of read-only file paths" }),
		),
		tokens: Type.Optional(Type.Number({ description: "Token count for cost comparison" })),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const manager = getTokenBreakdownManager();
		const { action, model, systemPrompt, chatHistory, repoMap, files, readOnlyFiles, tokens } =
			params as {
				action: string;
				model?: string;
				systemPrompt?: string;
				chatHistory?: Array<{ role: string; content: string }>;
				repoMap?: string;
				files?: string[];
				readOnlyFiles?: string[];
				tokens?: number;
			};

		switch (action) {
			case "breakdown":
			case "analyze": {
				if (!model) {
					return {
						content: [
							{
								type: "text",
								text: "❌ Error: model parameter required for breakdown action\nExample: tokenBreakdown({action: 'breakdown', model: 'gpt-4o', files: ['src/agent.ts']})",
							},
						],
						details: { error: "model required" },
					};
				}

				const breakdown = manager.generateBreakdown({
					model,
					systemPrompt,
					chatHistory,
					repoMap,
					files,
					readOnlyFiles,
				});

				return {
					content: [
						{
							type: "text",
							text: manager.formatBreakdown(breakdown),
						},
					],
					details: breakdown,
				};
			}

			case "summary":
			case "quick": {
				if (!model) {
					return {
						content: [
							{
								type: "text",
								text: "❌ Error: model parameter required for summary action",
							},
						],
						details: { error: "model required" },
					};
				}

				const breakdown = manager.generateBreakdown({
					model,
					systemPrompt,
					chatHistory,
					repoMap,
					files,
					readOnlyFiles,
				});

				return {
					content: [
						{
							type: "text",
							text: manager.getQuickSummary(breakdown),
						},
					],
					details: breakdown,
				};
			}

			case "models":
			case "list": {
				return {
					content: [
						{
							type: "text",
							text: manager.listModels(),
						},
					],
					details: { action: "models" },
				};
			}

			case "compare": {
				const tokenCount = tokens || 10000;
				return {
					content: [
						{
							type: "text",
							text: manager.compareModels(tokenCount),
						},
					],
					details: { action: "compare", tokens: tokenCount },
				};
			}

			case "cost": {
				if (!model || tokens === undefined) {
					return {
						content: [
							{
								type: "text",
								text: "❌ Error: model and tokens parameters required for cost action\nExample: tokenBreakdown({action: 'cost', model: 'gpt-4o', tokens: 10000})",
							},
						],
						details: { error: "model and tokens required" },
					};
				}

				const cost = manager.getCostForTokens(model, tokens);
				const modelConfig = manager.getModelConfig(model);
				const fits = tokens <= modelConfig.contextWindow;

				return {
					content: [
						{
							type: "text",
							text: `💰 Cost for ${manager.formatTokens(tokens)} tokens with ${model}:\n\nCost: $${cost.toFixed(6)}\nContext Window: ${manager.formatTokens(modelConfig.contextWindow)} (${fits ? "✅ fits" : "❌ exceeds"})\nCost per 1K tokens: $${(modelConfig.inputCostPerToken * 1000).toFixed(6)}`,
						},
					],
					details: {
						model,
						tokens,
						cost,
						contextWindow: modelConfig.contextWindow,
						fits,
					},
				};
			}

			case "context":
			case "window": {
				if (!model) {
					return {
						content: [
							{
								type: "text",
								text: "❌ Error: model parameter required for context action",
							},
						],
						details: { error: "model required" },
					};
				}

				const modelConfig = manager.getModelConfig(model);

				return {
					content: [
						{
							type: "text",
							text: `📐 Context Window for ${model}:\n\nMax tokens: ${manager.formatTokens(modelConfig.contextWindow)}\nSupports vision: ${modelConfig.supportsVision ? "✅" : "❌"}\nCost per 1K input tokens: $${(modelConfig.inputCostPerToken * 1000).toFixed(6)}`,
						},
					],
					details: {
						model: modelConfig.name,
						contextWindow: modelConfig.contextWindow,
						supportsVision: modelConfig.supportsVision,
						inputCostPerToken: modelConfig.inputCostPerToken,
					},
				};
			}

			case "help": {
				const helpText = `
📊 Token Breakdown Tool - Detailed token usage analysis (Aider /tokens pattern)

Actions:
  breakdown  - Generate detailed token breakdown
               Usage: tokenBreakdown({action: 'breakdown', model: 'gpt-4o', files: ['src/app.ts']})

  summary    - Get quick token usage summary
               Usage: tokenBreakdown({action: 'summary', model: 'gpt-4o'})

  models     - List available models with context windows and pricing
               Usage: tokenBreakdown({action: 'models'})

  compare    - Compare costs across models for a token count
               Usage: tokenBreakdown({action: 'compare', tokens: 10000})

  cost       - Calculate cost for specific token count
               Usage: tokenBreakdown({action: 'cost', model: 'gpt-4o', tokens: 5000})

  context    - Get context window info for a model
               Usage: tokenBreakdown({action: 'context', model: 'claude-3-5-sonnet'})

Parameters:
  model        - Model name (e.g., 'gpt-4o', 'claude-3-5-sonnet', 'deepseek-chat')
  files        - Array of file paths to analyze
  readOnlyFiles - Array of read-only file paths
  systemPrompt - System prompt content to analyze
  chatHistory  - Chat history messages to analyze
  repoMap      - Repository map content to analyze
  tokens       - Token count for cost comparison

Examples:
  # Analyze files for token usage
  tokenBreakdown({action: 'breakdown', model: 'gpt-4o', files: ['src/agent.ts', 'src/tools/*.ts']})

  # Compare model costs
  tokenBreakdown({action: 'compare', tokens: 50000})

  # Get quick summary
  tokenBreakdown({action: 'summary', model: 'claude-3-5-sonnet', files: ['README.md']})
`;
				return {
					content: [
						{
							type: "text",
							text: helpText.trim(),
						},
					],
					details: { action: "help" },
				};
			}

			default:
				return {
					content: [
						{
							type: "text",
							text: `❌ Unknown action: ${action}\nValid actions: breakdown, summary, models, compare, cost, context, help`,
						},
					],
					details: { error: "unknown action", action },
				};
		}
	},
};

// Re-export for convenience
export { getTokenBreakdownManager, resetTokenBreakdownManager, TokenBreakdownManager };
