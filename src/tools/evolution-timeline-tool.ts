/**
 * Evolution Timeline Tool Definition
 *
 * Tool for generating visual timelines of evolution history
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { evolutionTimelineTool } from "../evolution-timeline.js";

// ============================================================================
// Tool Definition
// ============================================================================

export const evolutionTimelineToolDefinition: AgentTool = {
	name: "evolutionTimeline",
	label: "Evolution Timeline Generator",
	description: `Generate visual timelines of evolution history showing capabilities added, success rates, milestones, and trends.

This tool parses MEMORY.md scorecard data to generate visual representations
of the evolution journey, helping understand progress and patterns.

Actions:
- generate: Generate and format the evolution timeline
- format: Format the current timeline as markdown
- stats: View generator statistics
- config: View generator configuration
- reset: Reset statistics
- help: Show help message

Parameters:
- includePhases: Include phase breakdown (default: true)
- includeMilestones: Include milestone markers (default: true)
- includeTrends: Include trend analysis (default: true)
- groupByWeek: Group events by week instead of day (default: false)`,
	parameters: Type.Object({
		action: Type.Union([
			Type.Literal("generate"),
			Type.Literal("format"),
			Type.Literal("stats"),
			Type.Literal("config"),
			Type.Literal("reset"),
			Type.Literal("help"),
		]),
		includePhases: Type.Optional(Type.Boolean()),
		includeMilestones: Type.Optional(Type.Boolean()),
		includeTrends: Type.Optional(Type.Boolean()),
		groupByWeek: Type.Optional(Type.Boolean()),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const { action, includePhases, includeMilestones, includeTrends, groupByWeek } = params as {
			action: string;
			includePhases?: boolean;
			includeMilestones?: boolean;
			includeTrends?: boolean;
			groupByWeek?: boolean;
		};

		try {
			const text = evolutionTimelineTool({
				action: action as "generate" | "format" | "stats" | "config" | "reset" | "help",
				includePhases,
				includeMilestones,
				includeTrends,
				groupByWeek,
			});

			return {
				content: [{ type: "text", text }],
				details: { action },
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Error executing ${action}: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				details: { error: true },
			};
		}
	},
};
