/**
 * Tom tool - Theory-of-Mind for personalized guidance
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type ConsultationResult,
	type SessionAnalysis,
	TomModule,
	formatConsultation,
	formatStats,
	generateId,
} from "../tom.js";

// Global ToM module instance
const tomModule = new TomModule();

/**
 * Tom tool - Theory-of-Mind for personalized guidance
 */
export const tomTool: AgentTool = {
	name: "tom",
	label: "Theory-of-Mind",
	description:
		"Get personalized guidance based on user profile and session history. Inspired by OpenHands' ToM-SWE - provides intent understanding, preference tracking, and adaptive behavior.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: 'consult' (get guidance), 'analyze' (analyze session), 'stats' (view statistics), 'profile' (view profile)",
		}),
		sessionData: Type.Optional(
			Type.Object({
				taskType: Type.String({ description: "Task type: capability, reliability, feature" }),
				taskDescription: Type.String({ description: "Brief task description" }),
				success: Type.Boolean({ description: "Whether the task succeeded" }),
				firstTry: Type.Boolean({ description: "Whether it succeeded on first try" }),
				errors: Type.Array(Type.String(), { description: "Error types encountered" }),
				rework: Type.Boolean({ description: "Whether rework was required" }),
				timeMinutes: Type.Number({ description: "Time taken in minutes" }),
				skillsUsed: Type.Array(Type.String(), { description: "Skills used during task" }),
			}),
		),
		currentContext: Type.Optional(
			Type.String({ description: "Current task context for consultation" }),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const { action, sessionData, currentContext } = params as {
			action: string;
			sessionData?: {
				taskType: string;
				taskDescription: string;
				success: boolean;
				firstTry: boolean;
				errors: string[];
				rework: boolean;
				timeMinutes: number;
				skillsUsed: string[];
			};
			currentContext?: string;
		};

		try {
			switch (action) {
				case "consult": {
					const context = currentContext || "No context provided";
					const consultation = tomModule.consult(context);
					const output = formatConsultation(consultation);
					return {
						content: [{ type: "text", text: output }],
						details: consultation,
					};
				}

				case "analyze": {
					if (!sessionData) {
						return {
							content: [
								{ type: "text", text: "Error: 'sessionData' is required for 'analyze' action" },
							],
							details: "Error: sessionData required",
						};
					}

					const analysis: SessionAnalysis = {
						sessionId: generateId(),
						date: new Date().toISOString().split("T")[0],
						taskType: sessionData.taskType as "capability" | "reliability" | "feature",
						taskDescription: sessionData.taskDescription,
						success: sessionData.success,
						firstTry: sessionData.firstTry,
						errors: sessionData.errors,
						rework: sessionData.rework,
						timeMinutes: sessionData.timeMinutes,
						skillsUsed: sessionData.skillsUsed,
						insights: [],
						patterns: [],
					};

					tomModule.analyzeSession(analysis);

					return {
						content: [{ type: "text", text: "✅ Session analyzed and profile updated." }],
						details: analysis,
					};
				}

				case "stats": {
					const stats = tomModule.getStats();
					const output = formatStats(stats);
					return {
						content: [{ type: "text", text: output }],
						details: stats,
					};
				}

				case "profile": {
					const profile = tomModule.getProfile();
					const prefs = profile.preferences;
					let output = "👤 User Profile\n";
					output += `${"─".repeat(40)}\n`;
					output += `Preferred Task Types: ${prefs.preferredTaskTypes.join(", ") || "Not set"}\n`;
					output += `Average Iteration Time: ${prefs.averageIterationTime || "N/A"} minutes\n`;
					output += `Common Errors: ${prefs.commonErrors?.join(", ") || "None tracked"}\n`;
					output += `Skills That Work: ${prefs.skillsUsedSuccess?.join(", ") || "None tracked"}\n`;
					output += `Total Sessions: ${profile.analyses?.length || 0}\n`;

					return {
						content: [{ type: "text", text: output }],
						details: profile,
					};
				}

				default:
					return {
						content: [
							{
								type: "text",
								text: `Error: Unknown action '${action}'. Use: consult, analyze, stats, profile`,
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
