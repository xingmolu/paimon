/**
 * Trajectory Viewer - Inspired by Mini-SWE-Agent trajectory browser
 *
 * Provides viewing and analysis of agent execution trajectories for debugging
 * and fine-tuning preparation.
 *
 * Key capabilities:
 * 1. List saved trajectories from session directory
 * 2. View individual trajectories with step-by-step breakdown
 * 3. Analyze trajectory patterns (error rates, tool usage, step counts)
 * 4. Export trajectories for RL/fine-tuning experiments
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Trajectory step (same as MinimalAgent's TrajectoryStep)
 */
export interface TrajectoryStep {
	step: number;
	userMessage?: string;
	assistantResponse: string;
	toolCall?: {
		name: string;
		parameters: Record<string, unknown>;
	};
	toolOutput?: string;
	timestamp: string;
	isError?: boolean;
}

/**
 * Full trajectory structure
 */
export interface Trajectory {
	metadata: {
		model: string;
		baseline: boolean;
		startTime: string;
		endTime: string;
		totalSteps: number;
		success: boolean;
	};
	steps: TrajectoryStep[];
}

/**
 * Mini-SWE-Agent compatible format
 */
export interface MiniSweTrajectory {
	input: string;
	trajectory: Array<{ action: string; output: string }>;
	result: string;
}

/**
 * Trajectory analysis results
 */
export interface TrajectoryAnalysis {
	/** Total trajectories analyzed */
	totalTrajectories: number;
	/** Success rate (trajectories ending with "DONE") */
	successRate: number;
	/** Average steps per trajectory */
	averageSteps: number;
	/** Error rate (steps with isError=true) */
	errorRate: number;
	/** Tool usage breakdown */
	toolUsage: Record<string, number>;
	/** Most common errors */
	commonErrors: Array<{ error: string; count: number }>;
	/** Time distribution */
	timeStats: {
		minDuration: number;
		maxDuration: number;
		avgDuration: number;
	};
}

/**
 * Trajectory listing with metadata
 */
export interface TrajectoryListing {
	/** File name */
	name: string;
	/** Full path */
	path: string;
	/** File size in bytes */
	size: number;
	/** Modification time */
	modified: string;
	/** Quick metadata preview */
	preview: {
		model: string;
		success: boolean;
		steps: number;
		startTime: string;
	};
}

/**
 * Trajectory viewer configuration
 */
export interface TrajectoryViewerConfig {
	/** Directory to store/load trajectories */
	dataDir?: string;
}

/**
 * Trajectory Viewer class for analyzing agent execution history
 */
export class TrajectoryViewer {
	private dataDir: string;

	constructor(config: TrajectoryViewerConfig = {}) {
		this.dataDir = config.dataDir || join(process.cwd(), "trajectories");
	}

	/**
	 * Get the data directory path
	 */
	getDataDir(): string {
		return this.dataDir;
	}

	/**
	 * Set the data directory path
	 */
	setDataDir(path: string): void {
		this.dataDir = path;
	}

	/**
	 * List all saved trajectories in the data directory
	 */
	listTrajectories(): TrajectoryListing[] {
		if (!existsSync(this.dataDir)) {
			return [];
		}

		const files = readdirSync(this.dataDir).filter((f) => f.endsWith(".json"));
		const listings: TrajectoryListing[] = [];

		for (const file of files) {
			const filePath = join(this.dataDir, file);
			const stats = statSync(filePath);

			try {
				const content = readFileSync(filePath, "utf-8");
				const trajectory = JSON.parse(content) as Trajectory;

				listings.push({
					name: file,
					path: filePath,
					size: stats.size,
					modified: stats.mtime.toISOString(),
					preview: {
						model: trajectory.metadata.model,
						success: trajectory.metadata.success,
						steps: trajectory.metadata.totalSteps,
						startTime: trajectory.metadata.startTime,
					},
				});
			} catch {
				// Skip malformed files
			}
		}

		// Sort by modification time (most recent first)
		return listings.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
	}

	/**
	 * Load a specific trajectory by name
	 */
	loadTrajectory(name: string): Trajectory | null {
		const filePath = name.includes("/") ? name : join(this.dataDir, name);

		if (!existsSync(filePath)) {
			return null;
		}

		try {
			const content = readFileSync(filePath, "utf-8");
			return JSON.parse(content) as Trajectory;
		} catch {
			return null;
		}
	}

	/**
	 * View a trajectory with formatted output
	 */
	viewTrajectory(name: string, format: "summary" | "full" | "steps" = "summary"): string {
		const trajectory = this.loadTrajectory(name);

		if (!trajectory) {
			return `Trajectory not found: ${name}`;
		}

		switch (format) {
			case "summary":
				return this.formatSummary(trajectory);
			case "full":
				return JSON.stringify(trajectory, null, 2);
			case "steps":
				return this.formatSteps(trajectory);
			default:
				return this.formatSummary(trajectory);
		}
	}

	/**
	 * Format trajectory as summary
	 */
	private formatSummary(trajectory: Trajectory): string {
		const { metadata, steps } = trajectory;
		const toolCalls = steps.filter((s) => s.toolCall);
		const errors = steps.filter((s) => s.isError);

		const duration = metadata.endTime
			? (
					(new Date(metadata.endTime).getTime() - new Date(metadata.startTime).getTime()) /
					1000
				).toFixed(1)
			: "ongoing";

		return `## Trajectory Summary

**Model:** ${metadata.model}
**Baseline:** ${metadata.baseline ? "Yes" : "No"}
**Status:** ${metadata.success ? "✅ Success" : "❌ Failed"}
**Steps:** ${metadata.totalSteps}
**Duration:** ${duration}s
**Tool Calls:** ${toolCalls.length}
**Errors:** ${errors.length}

**Start Time:** ${metadata.startTime}
**End Time:** ${metadata.endTime || "N/A"}
`;
	}

	/**
	 * Format trajectory as step-by-step breakdown
	 */
	private formatSteps(trajectory: Trajectory): string {
		const lines: string[] = ["## Trajectory Steps\n"];

		for (const step of trajectory.steps) {
			lines.push(`### Step ${step.step} (${step.timestamp})`);

			if (step.userMessage) {
				lines.push(`**User:** ${step.userMessage.slice(0, 100)}...`);
			}

			if (step.toolCall) {
				lines.push(`**Tool:** ${step.toolCall.name}`);
				lines.push(`**Parameters:** ${JSON.stringify(step.toolCall.parameters)}`);
			}

			if (step.toolOutput) {
				const output =
					step.toolOutput.length > 200 ? `${step.toolOutput.slice(0, 200)}...` : step.toolOutput;
				lines.push(`**Output:** ${output}`);
			}

			if (step.assistantResponse) {
				const response =
					step.assistantResponse.length > 200
						? `${step.assistantResponse.slice(0, 200)}...`
						: step.assistantResponse;
				lines.push(`**Response:** ${response}`);
			}

			if (step.isError) {
				lines.push("⚠️ **Error Step**");
			}

			lines.push("");
		}

		return lines.join("\n");
	}

	/**
	 * Analyze multiple trajectories for patterns
	 */
	analyzeTrajectories(trajectoryNames?: string[]): TrajectoryAnalysis {
		const trajectories = trajectoryNames
			? (trajectoryNames
					.map((n) => this.loadTrajectory(n))
					.filter((t) => t !== null) as Trajectory[])
			: (this.listTrajectories()
					.map((l) => this.loadTrajectory(l.name))
					.filter((t) => t !== null) as Trajectory[]);

		if (trajectories.length === 0) {
			return {
				totalTrajectories: 0,
				successRate: 0,
				averageSteps: 0,
				errorRate: 0,
				toolUsage: {},
				commonErrors: [],
				timeStats: {
					minDuration: 0,
					maxDuration: 0,
					avgDuration: 0,
				},
			};
		}

		// Calculate metrics
		const successfulTrajectories = trajectories.filter((t) => t.metadata.success);
		const totalSteps = trajectories.reduce((sum, t) => sum + t.metadata.totalSteps, 0);
		const allSteps = trajectories.flatMap((t) => t.steps);
		const errorSteps = allSteps.filter((s) => s.isError);

		// Tool usage
		const toolUsage: Record<string, number> = {};
		for (const step of allSteps) {
			if (step.toolCall) {
				toolUsage[step.toolCall.name] = (toolUsage[step.toolCall.name] || 0) + 1;
			}
		}

		// Common errors
		const errorMap: Record<string, number> = {};
		for (const step of errorSteps) {
			if (step.toolOutput?.includes("Error:")) {
				const errorMsg = step.toolOutput.slice(0, 100);
				errorMap[errorMsg] = (errorMap[errorMsg] || 0) + 1;
			}
		}
		const commonErrors = Object.entries(errorMap)
			.map(([error, count]) => ({ error, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 5);

		// Time stats
		const durations: number[] = [];
		for (const t of trajectories) {
			if (t.metadata.endTime && t.metadata.startTime) {
				durations.push(
					(new Date(t.metadata.endTime).getTime() - new Date(t.metadata.startTime).getTime()) /
						1000,
				);
			}
		}

		return {
			totalTrajectories: trajectories.length,
			successRate: successfulTrajectories.length / trajectories.length,
			averageSteps: totalSteps / trajectories.length,
			errorRate: errorSteps.length / allSteps.length,
			toolUsage,
			commonErrors,
			timeStats: {
				minDuration: durations.length > 0 ? Math.min(...durations) : 0,
				maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
				avgDuration:
					durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
			},
		};
	}

	/**
	 * Format analysis results as readable string
	 */
	formatAnalysis(analysis: TrajectoryAnalysis): string {
		const lines: string[] = ["## Trajectory Analysis\n"];

		lines.push(`**Total Trajectories:** ${analysis.totalTrajectories}`);
		lines.push(`**Success Rate:** ${(analysis.successRate * 100).toFixed(1)}%`);
		lines.push(`**Average Steps:** ${analysis.averageSteps.toFixed(1)}`);
		lines.push(`**Error Rate:** ${(analysis.errorRate * 100).toFixed(1)}%`);
		lines.push("");

		lines.push("### Tool Usage");
		for (const [tool, count] of Object.entries(analysis.toolUsage).sort((a, b) => b[1] - a[1])) {
			lines.push(`- ${tool}: ${count} calls`);
		}
		lines.push("");

		if (analysis.commonErrors.length > 0) {
			lines.push("### Common Errors");
			for (const { error, count } of analysis.commonErrors) {
				lines.push(`- (${count}x) ${error}`);
			}
			lines.push("");
		}

		lines.push("### Time Statistics");
		lines.push(`- Min Duration: ${analysis.timeStats.minDuration.toFixed(1)}s`);
		lines.push(`- Max Duration: ${analysis.timeStats.maxDuration.toFixed(1)}s`);
		lines.push(`- Avg Duration: ${analysis.timeStats.avgDuration.toFixed(1)}s`);

		return lines.join("\n");
	}

	/**
	 * Convert trajectory to Mini-SWE-Agent format
	 */
	toMiniSweFormat(trajectory: Trajectory): MiniSweTrajectory {
		const input = trajectory.steps.find((s) => s.userMessage)?.userMessage || "";
		const traj = trajectory.steps
			.filter((s) => s.toolCall)
			.map((s) => ({
				action: s.toolCall?.parameters.command as string,
				output: s.toolOutput || "",
			}));
		const result =
			trajectory.steps.find((s) => s.assistantResponse.includes("DONE"))?.assistantResponse || "";

		return { input, trajectory: traj, result };
	}

	/**
	 * Export trajectory in various formats
	 */
	exportTrajectory(name: string, format: "json" | "mini-swe" | "markdown"): string | null {
		const trajectory = this.loadTrajectory(name);

		if (!trajectory) {
			return null;
		}

		switch (format) {
			case "json":
				return JSON.stringify(trajectory, null, 2);
			case "mini-swe":
				return JSON.stringify(this.toMiniSweFormat(trajectory), null, 2);
			case "markdown":
				return `${this.formatSummary(trajectory)}\n${this.formatSteps(trajectory)}`;
			default:
				return JSON.stringify(trajectory, null, 2);
		}
	}

	/**
	 * Get statistics about the trajectory directory
	 */
	getStats(): {
		dataDir: string;
		totalFiles: number;
		totalSize: number;
		oldestFile: string | null;
		newestFile: string | null;
	} {
		const listings = this.listTrajectories();

		if (listings.length === 0) {
			return {
				dataDir: this.dataDir,
				totalFiles: 0,
				totalSize: 0,
				oldestFile: null,
				newestFile: null,
			};
		}

		const totalSize = listings.reduce((sum, l) => sum + l.size, 0);
		const sortedByDate = [...listings].sort(
			(a, b) => new Date(a.modified).getTime() - new Date(b.modified).getTime(),
		);

		return {
			dataDir: this.dataDir,
			totalFiles: listings.length,
			totalSize,
			oldestFile: sortedByDate[0]?.name || null,
			newestFile: sortedByDate[sortedByDate.length - 1]?.name || null,
		};
	}
}

/**
 * Create a trajectory viewer instance
 */
export function createTrajectoryViewer(config: TrajectoryViewerConfig = {}): TrajectoryViewer {
	return new TrajectoryViewer(config);
}
