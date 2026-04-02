/**
 * Token tracking tool - Manage LLM token usage and costs
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type TokenSession,
	type TokenTracker,
	type TokenUsage,
	getTokenTracker,
	resetTokenTracker,
} from "../token-tracking.js";

/**
 * Token tracking tool for managing LLM API usage and costs
 */
export const tokenTrackingTool: AgentTool = {
	name: "tokenTracking",
	label: "Token/Cost Tracking",
	description:
		"Track LLM token usage and costs. Use this to monitor API efficiency, calculate costs, and analyze usage patterns. Inspired by Aider's calculate_and_show_tokens_and_cost pattern.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: start (session), end (session), record (usage), stats, report, session, sessions, clear, cost, export",
		}),
		sessionId: Type.Optional(Type.String({ description: "Session ID for session operations" })),
		model: Type.Optional(Type.String({ description: "Model name for cost calculation" })),
		promptTokens: Type.Optional(
			Type.Number({ description: "Prompt tokens for recording/calculation" }),
		),
		completionTokens: Type.Optional(
			Type.Number({ description: "Completion tokens for recording/calculation" }),
		),
		cacheHitTokens: Type.Optional(Type.Number({ description: "Cache hit tokens" })),
		cacheWriteTokens: Type.Optional(Type.Number({ description: "Cache write tokens" })),
		taskType: Type.Optional(Type.String({ description: "Task type for session/usage" })),
		success: Type.Optional(Type.Boolean({ description: "Whether session/usage was successful" })),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const tracker = getTokenTracker();
		const {
			action,
			sessionId,
			model,
			promptTokens,
			completionTokens,
			cacheHitTokens,
			cacheWriteTokens,
			taskType,
			success,
		} = params as {
			action: string;
			sessionId?: string;
			model?: string;
			promptTokens?: number;
			completionTokens?: number;
			cacheHitTokens?: number;
			cacheWriteTokens?: number;
			taskType?: string;
			success?: boolean;
		};

		switch (action) {
			case "start": {
				const id = sessionId || `session-${Date.now()}`;
				const session = tracker.startSession(id, taskType);
				return {
					content: [
						{
							type: "text",
							text: `🚀 Started token tracking session: ${id}\nTask type: ${taskType || "not specified"}`,
						},
					],
					details: session,
				};
			}

			case "end": {
				if (!sessionId) {
					return {
						content: [
							{
								type: "text",
								text: "❌ Error: sessionId required for end action",
							},
						],
						details: { error: "sessionId required" },
					};
				}
				const session = tracker.endSession(success);
				if (!session) {
					return {
						content: [
							{
								type: "text",
								text: "❌ No active session to end",
							},
						],
						details: { error: "no active session" },
					};
				}
				const duration =
					(session.endTime && session.startTime
						? new Date(session.endTime).getTime() - new Date(session.startTime).getTime()
						: 0) / 1000;
				return {
					content: [
						{
							type: "text",
							text: `🏁 Ended session: ${session.sessionId}\nDuration: ${duration.toFixed(1)}s\nAPI Calls: ${session.apiCalls}\nTotal Tokens: ${tracker.formatTokens(session.totalPromptTokens + session.totalCompletionTokens)}\nTotal Cost: ${tracker.formatCost(session.totalCost)}\nSuccess: ${session.success ?? "unknown"}`,
						},
					],
					details: session,
				};
			}

			case "record": {
				if (!model || promptTokens === undefined || completionTokens === undefined) {
					return {
						content: [
							{
								type: "text",
								text: "❌ Error: model, promptTokens, and completionTokens required for record action",
							},
						],
						details: { error: "missing required parameters" },
					};
				}
				const cost = tracker.calculateCost(
					model,
					promptTokens,
					completionTokens,
					cacheHitTokens || 0,
					cacheWriteTokens || 0,
				);
				const usage = tracker.recordUsage({
					model,
					promptTokens,
					completionTokens,
					totalTokens: promptTokens + completionTokens,
					cacheHitTokens: cacheHitTokens || 0,
					cacheWriteTokens: cacheWriteTokens || 0,
					cost,
					sessionId,
					taskType,
					success,
				});
				return {
					content: [
						{
							type: "text",
							text: tracker.generateUsageReport(usage),
						},
					],
					details: usage,
				};
			}

			case "stats": {
				const stats = tracker.getStats();
				return {
					content: [
						{
							type: "text",
							text: tracker.formatStats(stats),
						},
					],
					details: stats,
				};
			}

			case "report": {
				if (!model || promptTokens === undefined || completionTokens === undefined) {
					return {
						content: [
							{
								type: "text",
								text: "❌ Error: model, promptTokens, and completionTokens required for report action",
							},
						],
						details: { error: "missing required parameters" },
					};
				}
				const cost = tracker.calculateCost(
					model,
					promptTokens,
					completionTokens,
					cacheHitTokens || 0,
					cacheWriteTokens || 0,
				);
				const usage: TokenUsage = {
					timestamp: new Date().toISOString(),
					model,
					promptTokens,
					completionTokens,
					totalTokens: promptTokens + completionTokens,
					cacheHitTokens: cacheHitTokens || 0,
					cacheWriteTokens: cacheWriteTokens || 0,
					cost,
				};
				return {
					content: [
						{
							type: "text",
							text: tracker.generateUsageReport(usage),
						},
					],
					details: usage,
				};
			}

			case "session": {
				if (!sessionId) {
					return {
						content: [
							{
								type: "text",
								text: "❌ Error: sessionId required for session action",
							},
						],
						details: { error: "sessionId required" },
					};
				}
				const session = tracker.getSession(sessionId);
				if (!session) {
					return {
						content: [
							{
								type: "text",
								text: `❌ Session not found: ${sessionId}`,
							},
						],
						details: { error: "session not found", sessionId },
					};
				}
				const duration =
					(session.endTime
						? new Date(session.endTime).getTime() - new Date(session.startTime).getTime()
						: Date.now() - new Date(session.startTime).getTime()) / 1000;
				return {
					content: [
						{
							type: "text",
							text: `📋 Session: ${session.sessionId}\nStart: ${session.startTime}\nEnd: ${session.endTime || "active"}\nDuration: ${duration.toFixed(1)}s\nAPI Calls: ${session.apiCalls}\nPrompt Tokens: ${tracker.formatTokens(session.totalPromptTokens)}\nCompletion Tokens: ${tracker.formatTokens(session.totalCompletionTokens)}\nTotal Cost: ${tracker.formatCost(session.totalCost)}\nTask Type: ${session.taskType || "unknown"}\nSuccess: ${session.success ?? "active"}`,
						},
					],
					details: session,
				};
			}

			case "sessions": {
				const sessions = tracker.listSessions();
				if (sessions.length === 0) {
					return {
						content: [
							{
								type: "text",
								text: "📋 No sessions recorded",
							},
						],
						details: { sessions: [], total: 0 },
					};
				}
				const lines = sessions.slice(0, 10).map((s) => {
					const cost = tracker.formatCost(s.totalCost);
					const tokens = tracker.formatTokens(s.totalPromptTokens + s.totalCompletionTokens);
					const status = s.endTime ? (s.success ? "✅" : "❌") : "🔄";
					return `${status} ${s.sessionId}: ${tokens} tokens, ${cost}`;
				});
				return {
					content: [
						{
							type: "text",
							text: `📋 Sessions (${sessions.length} total):\n${lines.join("\n")}`,
						},
					],
					details: { sessions: sessions.slice(0, 10), total: sessions.length },
				};
			}

			case "clear": {
				tracker.clear();
				return {
					content: [
						{
							type: "text",
							text: "🗑️ Token tracking data cleared",
						},
					],
					details: { cleared: true },
				};
			}

			case "cost": {
				if (!model || promptTokens === undefined || completionTokens === undefined) {
					return {
						content: [
							{
								type: "text",
								text: "❌ Error: model, promptTokens, and completionTokens required for cost action",
							},
						],
						details: { error: "missing required parameters" },
					};
				}
				const cost = tracker.calculateCost(
					model,
					promptTokens,
					completionTokens,
					cacheHitTokens || 0,
					cacheWriteTokens || 0,
				);
				const formattedCost = tracker.formatCost(cost);
				const formattedPrompt = tracker.formatTokens(promptTokens);
				const formattedCompletion = tracker.formatTokens(completionTokens);
				return {
					content: [
						{
							type: "text",
							text: `💰 Cost Calculation\nModel: ${model}\nPrompt: ${formattedPrompt} tokens\nCompletion: ${formattedCompletion} tokens\n${cacheHitTokens ? `Cache Hits: ${tracker.formatTokens(cacheHitTokens)} tokens\n` : ""}${cacheWriteTokens ? `Cache Writes: ${tracker.formatTokens(cacheWriteTokens)} tokens\n` : ""}Estimated Cost: ${formattedCost}`,
						},
					],
					details: {
						model,
						promptTokens,
						completionTokens,
						cacheHitTokens,
						cacheWriteTokens,
						cost,
					},
				};
			}

			case "export": {
				const data = tracker.exportData();
				return {
					content: [
						{
							type: "text",
							text: `📦 Exported ${data.usage.length} usage records and ${data.sessions.length} sessions`,
						},
					],
					details: data,
				};
			}

			default:
				return {
					content: [
						{
							type: "text",
							text: `❌ Unknown action: ${action}\nValid actions: start, end, record, stats, report, session, sessions, clear, cost, export`,
						},
					],
					details: { error: "unknown action", action },
				};
		}
	},
};

// Re-export for convenience
export { getTokenTracker, resetTokenTracker, type TokenTracker };
