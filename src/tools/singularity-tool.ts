/**
 * Singularity Tool for Self-Authorship Tracking (Aider Pattern)
 *
 * Tracks how much code was written by Paimon vs humans.
 * Inspired by Aider's "88% Singularity" metric.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type SingularityConfig,
	SingularityTracker,
	formatSingularityStats,
} from "../singularity.js";

/**
 * Singularity tool for tracking self-authorship
 */
export const singularityTool: AgentTool = {
	name: "singularity",
	label: "Track Self-Authorship",
	description:
		"Track self-authorship percentage (Singularity metric) - how much code was written by Paimon vs humans. Inspired by Aider's 88% Singularity metric. Use this to understand which code Paimon authored and be more confident when modifying bot-authored files.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: 'report' (full stats), 'check' (check if file is bot-authored), 'author' (get primary author of file)",
		}),
		file: Type.Optional(
			Type.String({
				description: "File path to check (for 'check' and 'author' actions)",
			}),
		),
		includeFileAnalysis: Type.Optional(
			Type.Boolean({
				description: "Include detailed file-level analysis (default: false)",
			}),
		),
		filePatterns: Type.Optional(
			Type.Array(Type.String(), {
				description: "File patterns to analyze (e.g., ['src/*.ts', 'scripts/*.ts'])",
			}),
		),
		botNames: Type.Optional(
			Type.Array(Type.String(), {
				description: "Bot author names to recognize (default: ['paimon[bot]', 'paimon-bot'])",
			}),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
		const {
			action,
			file,
			includeFileAnalysis = false,
			filePatterns,
			botNames,
		} = params as {
			action: "report" | "check" | "author";
			file?: string;
			includeFileAnalysis?: boolean;
			filePatterns?: string[];
			botNames?: string[];
		};

		try {
			const config: SingularityConfig = {
				includeFileAnalysis,
				filePatterns,
				botNames,
			};

			const tracker = new SingularityTracker(config);

			// Handle actions with blocks to avoid variable leaking across cases
			if (action === "report") {
				const stats = tracker.calculateStats();
				return {
					content: [{ type: "text", text: formatSingularityStats(stats) }],
					details: formatSingularityStats(stats),
				};
			}

			if (action === "check") {
				if (!file) {
					return {
						content: [
							{
								type: "text",
								text: "Error: 'file' parameter required for 'check' action",
							},
						],
						details: "Error: 'file' parameter required for 'check' action",
					};
				}
				const isBotAuthored = tracker.isFileBotAuthored(file);
				const result = isBotAuthored
					? `✅ ${file} is primarily bot-authored (>50% Paimon-authored lines)`
					: `❌ ${file} is primarily human-authored (≤50% Paimon-authored lines)`;
				return {
					content: [{ type: "text", text: result }],
					details: result,
				};
			}

			if (action === "author") {
				if (!file) {
					return {
						content: [
							{
								type: "text",
								text: "Error: 'file' parameter required for 'author' action",
							},
						],
						details: "Error: 'file' parameter required for 'author' action",
					};
				}
				const primaryAuthor = tracker.getFilePrimaryAuthor(file);
				const authorResult = primaryAuthor
					? `Primary author of ${file}: ${primaryAuthor}`
					: `Could not determine primary author for ${file}`;
				return {
					content: [{ type: "text", text: authorResult }],
					details: authorResult,
				};
			}

			const defaultResult = `Unknown action: ${action}. Use 'report', 'check', or 'author'.`;
			return {
				content: [{ type: "text", text: defaultResult }],
				details: defaultResult,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				content: [{ type: "text", text: `Error analyzing singularity: ${errorMessage}` }],
				details: `Error analyzing singularity: ${errorMessage}`,
			};
		}
	},
};
