/**
 * Trajectory Tool - Agent tool for trajectory viewing and analysis
 *
 * Inspired by Mini-SWE-Agent's trajectory browser functionality.
 * Provides viewing and analysis of agent execution trajectories.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type TrajectoryAnalysis,
	type TrajectoryViewer,
	createTrajectoryViewer,
} from "../trajectory.js";

/**
 * Create the trajectory viewer tool
 */
export function createTrajectoryTool(): AgentTool {
	const viewer: TrajectoryViewer = createTrajectoryViewer();

	return {
		name: "trajectory",
		label: "View/Analyze Agent Trajectories",
		description:
			"View and analyze agent execution trajectories for debugging and fine-tuning. Inspired by Mini-SWE-Agent's trajectory browser - provides step-by-step viewing, pattern analysis, and export capabilities.",
		parameters: Type.Object({
			action: Type.String({
				description: "Action to perform: list, view, analyze, stats, export",
			}),
			name: Type.Optional(
				Type.String({
					description: "Trajectory name (for view/export actions)",
				}),
			),
			format: Type.Optional(
				Type.String({
					description:
						"Output format: summary, full, steps (for view); json, mini-swe, markdown (for export)",
				}),
			),
			trajectoryNames: Type.Optional(
				Type.Array(Type.String(), {
					description: "Specific trajectory names to analyze (for analyze action)",
				}),
			),
			dataDir: Type.Optional(
				Type.String({
					description: "Directory containing trajectory files (optional)",
				}),
			),
		}),
		execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
			const {
				action,
				name,
				format = "summary",
				trajectoryNames,
				dataDir,
			} = params as {
				action: "list" | "view" | "analyze" | "stats" | "export";
				name?: string;
				format?: string;
				trajectoryNames?: string[];
				dataDir?: string;
			};

			// Update data directory if provided
			if (dataDir) {
				viewer.setDataDir(dataDir);
			}

			try {
				switch (action) {
					case "list":
						return handleList(viewer);
					case "view":
						return handleView(viewer, name || "", format);
					case "analyze":
						return handleAnalyze(viewer, trajectoryNames);
					case "stats":
						return handleStats(viewer);
					case "export":
						return handleExport(viewer, name || "", format);
					default:
						return {
							content: [{ type: "text", text: `Unknown action: ${action}` }],
							details: `Unknown action: ${action}`,
						};
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					content: [{ type: "text", text: `Error: ${message}` }],
					details: `Error: ${message}`,
				};
			}
		},
	};
}

/**
 * Handle list action
 */
function handleList(viewer: TrajectoryViewer): AgentToolResult<string> {
	const trajectories = viewer.listTrajectories();

	if (trajectories.length === 0) {
		const text = `No trajectories found in ${viewer.getDataDir()}\n\nSave trajectories first by running agent with --linear or --minimal flags.`;
		return {
			content: [{ type: "text", text }],
			details: text,
		};
	}

	const lines: string[] = ["## Saved Trajectories\n"];
	lines.push(`**Directory:** ${viewer.getDataDir()}`);
	lines.push(`**Count:** ${trajectories.length}`);
	lines.push("");

	for (const t of trajectories) {
		const status = t.preview.success ? "✅" : "❌";
		lines.push(`### ${t.name} ${status}`);
		lines.push(`- Model: ${t.preview.model}`);
		lines.push(`- Steps: ${t.preview.steps}`);
		lines.push(`- Time: ${t.preview.startTime}`);
		lines.push(`- Size: ${(t.size / 1024).toFixed(1)}KB`);
		lines.push("");
	}

	const text = lines.join("\n");
	return {
		content: [{ type: "text", text }],
		details: text,
	};
}

/**
 * Handle view action
 */
function handleView(
	viewer: TrajectoryViewer,
	name: string,
	format?: string,
): AgentToolResult<string> {
	if (!name) {
		return {
			content: [{ type: "text", text: "Error: trajectory name required for view action" }],
			details: "Error: trajectory name required",
		};
	}

	// Determine format (view uses summary/steps/full, export uses json/mini-swe/markdown)
	const viewFormat =
		format === "json" || format === "mini-swe" || format === "markdown"
			? "summary"
			: format || "summary";

	const text = viewer.viewTrajectory(name, viewFormat as "summary" | "full" | "steps");
	return {
		content: [{ type: "text", text }],
		details: text,
	};
}

/**
 * Handle analyze action
 */
function handleAnalyze(
	viewer: TrajectoryViewer,
	trajectoryNames?: string[],
): AgentToolResult<string> {
	const analysis: TrajectoryAnalysis = viewer.analyzeTrajectories(trajectoryNames);
	const text = viewer.formatAnalysis(analysis);
	return {
		content: [{ type: "text", text }],
		details: text,
	};
}

/**
 * Handle stats action
 */
function handleStats(viewer: TrajectoryViewer): AgentToolResult<string> {
	const stats = viewer.getStats();

	const lines: string[] = ["## Trajectory Directory Statistics\n"];
	lines.push(`**Data Directory:** ${stats.dataDir}`);
	lines.push(`**Total Files:** ${stats.totalFiles}`);
	lines.push(`**Total Size:** ${(stats.totalSize / 1024).toFixed(1)}KB`);
	lines.push("");
	if (stats.oldestFile) {
		lines.push(`**Oldest File:** ${stats.oldestFile}`);
	}
	if (stats.newestFile) {
		lines.push(`**Newest File:** ${stats.newestFile}`);
	}

	const text = lines.join("\n");
	return {
		content: [{ type: "text", text }],
		details: text,
	};
}

/**
 * Handle export action
 */
function handleExport(
	viewer: TrajectoryViewer,
	name: string,
	format?: string,
): AgentToolResult<string> {
	if (!name) {
		return {
			content: [{ type: "text", text: "Error: trajectory name required for export action" }],
			details: "Error: trajectory name required",
		};
	}

	const exportFormat = format || "json";
	const exported = viewer.exportTrajectory(name, exportFormat as "json" | "mini-swe" | "markdown");

	if (!exported) {
		return {
			content: [{ type: "text", text: `Trajectory not found: ${name}` }],
			details: `Trajectory not found: ${name}`,
		};
	}

	return {
		content: [{ type: "text", text: exported }],
		details: exported,
	};
}

/**
 * Trajectory tool singleton
 */
export const trajectoryTool = createTrajectoryTool();
