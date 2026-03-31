/**
 * Parallel tool - Run multiple independent shell commands concurrently
 */

import { spawn } from "node:child_process";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { ParallelResult, ParallelTaskResult } from "../types.js";

/**
 * Parallel tool - Execute tasks concurrently
 */
export const parallelTool: AgentTool = {
	name: "parallel",
	label: "Execute Tasks in Parallel",
	description:
		"Run multiple independent shell commands concurrently. Use this for tasks that have no dependencies or shared state - like running lint, typecheck, and tests simultaneously. Inspired by dispatching-parallel-agents from superpowers.",
	parameters: Type.Object({
		tasks: Type.Array(
			Type.Object({
				name: Type.String({ description: "Task name for identification" }),
				command: Type.String({ description: "Shell command to execute" }),
			}),
			{ description: "Array of independent tasks to run concurrently" },
		),
		timeout: Type.Optional(
			Type.Number({ description: "Overall timeout in milliseconds (default: 120000)" }),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<ParallelResult>> => {
		const { tasks, timeout = 120000 } = params as {
			tasks: Array<{ name: string; command: string }>;
			timeout?: number;
		};

		if (tasks.length === 0) {
			return {
				content: [{ type: "text", text: "Error: No tasks provided" }],
				details: {
					success: false,
					results: [],
					totalDuration: 0,
					successCount: 0,
					failedCount: 0,
					timedOutCount: 0,
				},
			};
		}

		const startTime = Date.now();

		// Execute all tasks concurrently using Promise.all
		const taskPromises = tasks.map((task) => {
			return new Promise<ParallelTaskResult>((resolve) => {
				const taskStart = Date.now();
				let output = "";
				let errorOutput = "";

				// Use spawn for better control over stdout/stderr
				const proc = spawn(task.command, [], {
					shell: true,
					timeout: timeout,
				});

				proc.stdout.on("data", (data: Buffer) => {
					output += data.toString();
				});

				proc.stderr.on("data", (data: Buffer) => {
					errorOutput += data.toString();
				});

				proc.on("close", (code: number | null) => {
					resolve({
						name: task.name,
						status: code === 0 ? "success" : "failed",
						exitCode: code,
						output: output.slice(0, 5000), // Limit output size
						error: errorOutput.slice(0, 1000),
						duration: Date.now() - taskStart,
					});
				});

				proc.on("error", (err: Error) => {
					resolve({
						name: task.name,
						status: "failed",
						exitCode: null,
						output: "",
						error: err.message,
						duration: Date.now() - taskStart,
					});
				});
			});
		});

		// Wait for all tasks with overall timeout
		let results: ParallelTaskResult[];
		try {
			results = await Promise.all(taskPromises);
		} catch (e) {
			const error = e instanceof Error ? e.message : String(e);
			return {
				content: [{ type: "text", text: `Error executing parallel tasks: ${error}` }],
				details: {
					success: false,
					results: [],
					totalDuration: Date.now() - startTime,
					successCount: 0,
					failedCount: 0,
					timedOutCount: 0,
				},
			};
		}

		const totalDuration = Date.now() - startTime;
		const successCount = results.filter((r) => r.status === "success").length;
		const failedCount = results.filter((r) => r.status === "failed").length;
		const timedOutCount = results.filter((r) => r.status === "timeout").length;

		// Format output
		const statusEmoji = {
			success: "✅",
			failed: "❌",
			timeout: "⏱️",
		};

		let output = "⚡ Parallel Execution Results\n";
		output += `${"─".repeat(50)}\n`;
		output += `Total time: ${(totalDuration / 1000).toFixed(2)}s\n`;
		output += `Tasks: ${results.length} (${successCount} ✅, ${failedCount} ❌, ${timedOutCount} ⏱️)\n`;
		output += `${"─".repeat(50)}\n\n`;

		for (const result of results) {
			output += `${statusEmoji[result.status]} ${result.name}\n`;
			output += `   Command finished in ${(result.duration / 1000).toFixed(2)}s (exit code: ${result.exitCode})\n`;
			if (result.output) {
				output += `   Output: ${result.output.slice(0, 200)}${result.output.length > 200 ? "..." : ""}\n`;
			}
			if (result.error) {
				output += `   Error: ${result.error}\n`;
			}
			output += "\n";
		}

		const allSuccess = successCount === results.length;
		if (allSuccess) {
			output += "🎉 All tasks completed successfully!\n";
		} else {
			output += `⚠️ ${failedCount + timedOutCount} tasks failed or timed out.\n`;
		}

		const result: ParallelResult = {
			success: allSuccess,
			results,
			totalDuration,
			successCount,
			failedCount,
			timedOutCount,
		};

		return {
			content: [{ type: "text", text: output }],
			details: result,
		};
	},
};
