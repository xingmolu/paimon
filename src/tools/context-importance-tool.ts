/**
 * Context Importance Tool - Intelligent context importance scoring.
 *
 * This tool provides actions for analyzing message importance and generating
 * truncation recommendations. Inspired by Aider's ChatSummary pattern.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type ContentType,
	type ContextImportanceAnalysis,
	type ContextImportanceConfig,
	ContextImportanceScorer,
	type ContextImportanceStats,
	DEFAULT_CONTEXT_IMPORTANCE_CONFIG,
	type MessageForAnalysis,
	type MessageImportanceScore,
	type MessageRole,
	type TruncationRecommendation,
	getGlobalContextImportanceScorer,
} from "../context-importance.js";

/**
 * Context importance tool result.
 */
interface ContextImportanceResult {
	success: boolean;
	action: string;
	data?:
		| ContextImportanceAnalysis
		| MessageImportanceScore
		| TruncationRecommendation[]
		| ContextImportanceStats
		| ContextImportanceConfig
		| string;
	error?: string;
}

/**
 * Convert raw messages to analysis format.
 */
function convertMessages(
	messages: Array<{
		role: string;
		content: string;
		index?: number;
		toolName?: string;
		toolSuccess?: boolean;
	}>,
): MessageForAnalysis[] {
	return messages.map((msg, i) => ({
		role: msg.role as "system" | "user" | "assistant" | "tool_result",
		content: msg.content,
		index: msg.index ?? i,
		totalMessages: messages.length,
		toolName: msg.toolName,
		toolSuccess: msg.toolSuccess,
	}));
}

/**
 * Format analysis result for display.
 */
function formatAnalysis(analysis: ContextImportanceAnalysis): string {
	const lines: string[] = [];

	lines.push("## Context Importance Analysis");
	lines.push("");
	lines.push(`**Total Messages:** ${analysis.totalMessages}`);
	lines.push(`**Total Tokens:** ${analysis.totalTokens}`);
	lines.push(`**Average Importance Score:** ${analysis.averageScore.toFixed(1)}`);
	lines.push(`**Estimated Savings Available:** ${analysis.estimatedTotalSavings} tokens`);
	lines.push("");

	// Score distribution
	lines.push("### Score Distribution");
	for (const [level, count] of analysis.scoreDistribution) {
		lines.push(`- **${level}:** ${count} messages`);
	}
	lines.push("");

	// Critical messages
	if (analysis.criticalMessages.length > 0) {
		lines.push("### Critical Messages (Never Truncate)");
		lines.push(`Indices: ${analysis.criticalMessages.join(", ")}`);
		lines.push("");
	}

	// Top truncation recommendations
	if (analysis.truncationRecommendations.length > 0) {
		lines.push("### Top Truncation Recommendations");
		const topRecs = analysis.truncationRecommendations.slice(0, 10);
		for (const rec of topRecs) {
			lines.push(
				`- **Message ${rec.messageIndex}:** ${rec.action} (${rec.estimatedSavings} tokens saved)`,
			);
			lines.push(`  - Score: ${rec.importanceScore.toFixed(1)}, Priority: ${rec.priority}`);
			lines.push(`  - Reason: ${rec.reason}`);
		}
		lines.push("");
		lines.push(
			`Total recommendations: ${analysis.truncationRecommendations.length}, Total savings: ${analysis.estimatedTotalSavings} tokens`,
		);
	}

	return lines.join("\n");
}

/**
 * Format message score for display.
 */
function formatMessageScore(score: MessageImportanceScore): string {
	const lines: string[] = [];

	lines.push("## Message Importance Score");
	lines.push("");
	lines.push(`**Score:** ${score.score.toFixed(1)}`);
	lines.push(`**Level:** ${score.level}`);
	lines.push(`**Content Type:** ${score.contentType}`);
	lines.push(`**Tokens:** ${score.tokens}`);
	lines.push("");

	// Factor breakdown
	lines.push("### Factor Breakdown");
	for (const [factor, value] of score.factors) {
		lines.push(`- **${factor}:** ${value.toFixed(1)}`);
	}
	lines.push("");

	// Truncation info
	if (score.canTruncate) {
		lines.push("### Truncation Info");
		lines.push("- **Can Truncate:** Yes");
		lines.push(`- **Strategy:** ${score.truncationStrategy}`);
		lines.push(`- **Estimated Savings:** ${score.estimatedSavings} tokens`);
	} else {
		lines.push("### Truncation Info");
		lines.push("- **Can Truncate:** No");
	}

	return lines.join("\n");
}

/**
 * Format recommendations for display.
 */
function formatRecommendations(recommendations: TruncationRecommendation[]): string {
	const lines: string[] = [];

	lines.push("## Truncation Recommendations");
	lines.push("");

	if (recommendations.length === 0) {
		lines.push("No truncation recommendations available.");
		return lines.join("\n");
	}

	const totalSavings = recommendations.reduce((sum, rec) => sum + rec.estimatedSavings, 0);
	lines.push(`**Total Recommendations:** ${recommendations.length}`);
	lines.push(`**Estimated Total Savings:** ${totalSavings} tokens`);
	lines.push("");

	// Sort by priority
	const sorted = [...recommendations].sort((a, b) => a.priority - b.priority);

	lines.push("### Recommendations (sorted by priority)");
	for (const rec of sorted) {
		lines.push(`#### Message ${rec.messageIndex}`);
		lines.push(`- **Action:** ${rec.action}`);
		lines.push(`- **Score:** ${rec.importanceScore.toFixed(1)}`);
		lines.push(`- **Priority:** ${rec.priority}`);
		lines.push(`- **Estimated Savings:** ${rec.estimatedSavings} tokens`);
		lines.push(`- **Reason:** ${rec.reason}`);
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Format statistics for display.
 */
function formatStats(stats: ContextImportanceStats): string {
	const lines: string[] = [];

	lines.push("## Context Importance Statistics");
	lines.push("");
	lines.push(`**Total Analyses:** ${stats.totalAnalyses}`);
	lines.push(`**Total Recommendations:** ${stats.totalRecommendations}`);
	lines.push(`**Total Estimated Savings:** ${stats.totalEstimatedSavings} tokens`);
	lines.push(`**Average Importance Score:** ${stats.averageImportanceScore.toFixed(1)}`);
	lines.push(`**Messages Truncated (simulated):** ${stats.messagesTruncated}`);
	lines.push(`**Critical Messages Preserved:** ${stats.criticalMessagesPreserved}`);
	lines.push(`**Most Common Action:** ${stats.mostCommonAction}`);
	lines.push(`**Last Analysis:** ${stats.lastAnalysisTimestamp ?? "Never"}`);

	return lines.join("\n");
}

/**
 * Format target result.
 */
function formatTargetResult(
	recommendations: TruncationRecommendation[],
	targetSavings: number,
): string {
	const totalSavings = recommendations.reduce((sum, rec) => sum + rec.estimatedSavings, 0);
	const base = formatRecommendations(recommendations);
	return `${base}\n\n**Target:** ${targetSavings} tokens\n**Achieved:** ${totalSavings} tokens`;
}

function mapToRecord<TKey extends string>(map: Map<TKey, number>): Record<string, number> {
	return Object.fromEntries(map.entries());
}

function formatConfig(config: ContextImportanceConfig): string {
	return JSON.stringify(
		{
			...config,
			roleWeights: mapToRecord(config.roleWeights),
			contentTypeWeights: mapToRecord(config.contentTypeWeights),
		},
		null,
		2,
	);
}

function isNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
	return typeof value === "boolean";
}

function parseWeightRecord<TKey extends string>(
	value: unknown,
	allowedKeys: readonly TKey[],
	fieldName: string,
): Map<TKey, number> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${fieldName} must be an object of numeric weights`);
	}

	const entries = Object.entries(value as Record<string, unknown>);
	const allowed = new Set<string>(allowedKeys);
	const weights = new Map<TKey, number>();

	for (const [key, raw] of entries) {
		if (!allowed.has(key)) {
			throw new Error(`Invalid ${fieldName} key: ${key}`);
		}
		if (!isNumber(raw)) {
			throw new Error(`${fieldName}.${key} must be a finite number`);
		}
		weights.set(key as TKey, raw);
	}

	return weights;
}

function parseConfigUpdate(params: Record<string, unknown>): Partial<ContextImportanceConfig> {
	const update: Partial<ContextImportanceConfig> = {};

	if (params.minKeepScore !== undefined) {
		if (!isNumber(params.minKeepScore)) {
			throw new Error("minKeepScore must be a finite number");
		}
		update.minKeepScore = params.minKeepScore;
	}

	if (params.maxTruncatableSize !== undefined) {
		if (!isNumber(params.maxTruncatableSize)) {
			throw new Error("maxTruncatableSize must be a finite number");
		}
		update.maxTruncatableSize = params.maxTruncatableSize;
	}

	if (params.recencyWeight !== undefined) {
		if (!isNumber(params.recencyWeight)) {
			throw new Error("recencyWeight must be a finite number");
		}
		update.recencyWeight = params.recencyWeight;
	}

	if (params.analyzeToolSuccess !== undefined) {
		if (!isBoolean(params.analyzeToolSuccess)) {
			throw new Error("analyzeToolSuccess must be a boolean");
		}
		update.analyzeToolSuccess = params.analyzeToolSuccess;
	}

	if (params.detectFileReferences !== undefined) {
		if (!isBoolean(params.detectFileReferences)) {
			throw new Error("detectFileReferences must be a boolean");
		}
		update.detectFileReferences = params.detectFileReferences;
	}

	if (params.detectPlanReferences !== undefined) {
		if (!isBoolean(params.detectPlanReferences)) {
			throw new Error("detectPlanReferences must be a boolean");
		}
		update.detectPlanReferences = params.detectPlanReferences;
	}

	if (params.roleWeights !== undefined) {
		update.roleWeights = parseWeightRecord<MessageRole>(
			params.roleWeights,
			Array.from(DEFAULT_CONTEXT_IMPORTANCE_CONFIG.roleWeights.keys()),
			"roleWeights",
		);
	}

	if (params.contentTypeWeights !== undefined) {
		update.contentTypeWeights = parseWeightRecord<ContentType>(
			params.contentTypeWeights,
			Array.from(DEFAULT_CONTEXT_IMPORTANCE_CONFIG.contentTypeWeights.keys()),
			"contentTypeWeights",
		);
	}

	if (Object.keys(update).length === 0) {
		throw new Error("No valid configuration fields provided for update-config");
	}

	return update;
}

/**
 * Create the contextImportance tool.
 */
export const contextImportanceTool: AgentTool = {
	name: "contextImportance",
	label: "Context Importance Scoring",
	description: `Manage context importance scoring for intelligent truncation decisions (Aider ChatSummary pattern).

Actions:
- analyze: Analyze messages for importance and truncation recommendations
- score: Score a single message for importance
- recommendations: Get truncation recommendations for messages
- target: Get recommendations to achieve target token savings
- stats: View statistics
- config: View configuration
- update-config: Update configuration
- reset: Reset statistics

Usage:
contextImportance({action: 'analyze', messages: [{role: 'user', content: '...'}, {role: 'assistant', content: '...'}]})
contextImportance({action: 'score', messages: [{role: 'user', content: '...'}], messageIndex: 0})
contextImportance({action: 'recommendations', messages: [...]})
contextImportance({action: 'target', messages: [...], targetSavings: 5000})
contextImportance({action: 'stats'})
`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action: analyze, score, recommendations, target, stats, config, update-config, reset",
		}),
		messages: Type.Optional(
			Type.Array(
				Type.Object({
					role: Type.String(),
					content: Type.String(),
					index: Type.Optional(Type.Number()),
					toolName: Type.Optional(Type.String()),
					toolSuccess: Type.Optional(Type.Boolean()),
				}),
			),
		),
		targetSavings: Type.Optional(
			Type.Number({ description: "Target savings in tokens (for target action)" }),
		),
		messageIndex: Type.Optional(
			Type.Number({ description: "Message index to score (for score action)" }),
		),
		minKeepScore: Type.Optional(Type.Number()),
		maxTruncatableSize: Type.Optional(Type.Number()),
		recencyWeight: Type.Optional(Type.Number()),
		analyzeToolSuccess: Type.Optional(Type.Boolean()),
		detectFileReferences: Type.Optional(Type.Boolean()),
		detectPlanReferences: Type.Optional(Type.Boolean()),
		roleWeights: Type.Optional(Type.Record(Type.String(), Type.Number())),
		contentTypeWeights: Type.Optional(Type.Record(Type.String(), Type.Number())),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<ContextImportanceResult>> => {
		const scorer = getGlobalContextImportanceScorer();
		const p = params as Record<string, unknown>;
		const action = p.action as string;
		const result: ContextImportanceResult = {
			success: true,
			action,
		};

		let output: string;

		try {
			switch (action) {
				case "analyze": {
					if (!p.messages || !Array.isArray(p.messages)) {
						result.success = false;
						result.error = "messages parameter required for analyze action";
						output = "Error: messages parameter required for analyze action";
					} else {
						const messages = convertMessages(
							p.messages as Array<{
								role: string;
								content: string;
								index?: number;
								toolName?: string;
								toolSuccess?: boolean;
							}>,
						);
						const analysis = scorer.analyzeConversation(messages);
						result.data = analysis;
						output = formatAnalysis(analysis);
					}
					break;
				}

				case "score": {
					if (!p.messages || !Array.isArray(p.messages)) {
						result.success = false;
						result.error = "messages parameter required for score action";
						output = "Error: messages parameter required for score action";
					} else {
						const messages = convertMessages(
							p.messages as Array<{
								role: string;
								content: string;
								index?: number;
								toolName?: string;
								toolSuccess?: boolean;
							}>,
						);
						const index = (p.messageIndex as number) ?? 0;
						if (index < 0 || index >= messages.length) {
							result.success = false;
							result.error = `messageIndex ${index} out of range`;
							output = "Error: messageIndex out of range";
						} else {
							const score = scorer.scoreMessage(messages[index]);
							result.data = score;
							output = formatMessageScore(score);
						}
					}
					break;
				}

				case "recommendations": {
					if (!p.messages || !Array.isArray(p.messages)) {
						result.success = false;
						result.error = "messages parameter required for recommendations action";
						output = "Error: messages parameter required for recommendations action";
					} else {
						const messages = convertMessages(
							p.messages as Array<{
								role: string;
								content: string;
								index?: number;
								toolName?: string;
								toolSuccess?: boolean;
							}>,
						);
						const analysis = scorer.analyzeConversation(messages);
						result.data = analysis.truncationRecommendations;
						output = formatRecommendations(analysis.truncationRecommendations);
					}
					break;
				}

				case "target": {
					if (!p.messages || !Array.isArray(p.messages)) {
						result.success = false;
						result.error = "messages parameter required for target action";
						output = "Error: messages parameter required for target action";
					} else {
						const targetSavings = (p.targetSavings as number) ?? 5000;
						const messages = convertMessages(
							p.messages as Array<{
								role: string;
								content: string;
								index?: number;
								toolName?: string;
								toolSuccess?: boolean;
							}>,
						);
						const recommendations = scorer.getRecommendationsForTarget(messages, targetSavings);
						result.data = recommendations;
						output = formatTargetResult(recommendations, targetSavings);
					}
					break;
				}

				case "stats": {
					const stats = scorer.getStats();
					result.data = stats;
					output = formatStats(stats);
					break;
				}

				case "config": {
					const config = scorer.getConfig();
					result.data = config;
					output = formatConfig(config);
					break;
				}

				case "update-config": {
					const configUpdate = parseConfigUpdate(p);
					scorer.updateConfig(configUpdate);
					const updatedConfig = scorer.getConfig();
					result.data = updatedConfig;
					output = `Configuration updated successfully.\n\n${formatConfig(updatedConfig)}`;
					break;
				}

				case "reset": {
					scorer.reset();
					result.data = "Statistics reset successfully.";
					output = "Statistics reset successfully.";
					break;
				}

				default:
					result.success = false;
					result.error = `Unknown action: ${action}`;
					output = `Error: Unknown action: ${action}`;
			}
		} catch (error) {
			result.success = false;
			result.error = error instanceof Error ? error.message : String(error);
			output = `Error: ${result.error}`;
		}

		return {
			content: [{ type: "text", text: output }],
			details: result,
		};
	},
};

/**
 * Create context importance tool function (for compatibility).
 */
export function createContextImportanceTool(): AgentTool {
	return contextImportanceTool;
}
