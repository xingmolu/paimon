/**
 * Repomap tool - Generate structured map of codebase definitions
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { generateRepoMap } from "../repomap.js";
import { truncateToolOutput } from "../truncate.js";

/**
 * Repomap tool - Generate repo map
 */
export const repomapTool: AgentTool = {
	name: "repomap",
	label: "Generate Repo Map",
	description:
		"Generate a structured map of the codebase showing definitions (functions, classes, interfaces) organized by file. Inspired by Aider's RepoMap - helps understand codebase structure without reading every file.",
	parameters: Type.Object({
		root: Type.Optional(Type.String({ description: "Root directory to scan (default: .)" })),
		maxTokens: Type.Optional(
			Type.Number({ description: "Maximum tokens for the map output (default: 2048)" }),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
		const { root = ".", maxTokens = 2048 } = params as {
			root?: string;
			maxTokens?: number;
		};

		try {
			const output = generateRepoMap(root, maxTokens);
			return {
				content: [{ type: "text", text: truncateToolOutput(output, "repomap") }],
				details: truncateToolOutput(output, "repomap"),
			};
		} catch (e) {
			const error = e instanceof Error ? e.message : String(e);
			return {
				content: [{ type: "text", text: `Error: ${error}` }],
				details: `Error: ${error}`,
			};
		}
	},
};
