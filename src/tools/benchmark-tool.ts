/**
 * Benchmark Tool - Run and manage benchmark tasks for evaluating self-evolution capabilities
 *
 * SWE-bench inspired benchmark system for standardized evaluation.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { type BenchmarkTask, createSampleTasks, getBenchmarkRunner } from "../benchmark.js";

/**
 * Benchmark tool for evaluating self-evolution capabilities
 */
export const benchmarkTool: AgentTool = {
	name: "benchmark",
	label: "SWE-bench Benchmark Integration",
	description: `Run and manage benchmark tasks for evaluating self-evolution capabilities.

Actions:
- load: Load tasks from a JSON file
- run: Run a single task by ID
- runAll: Run all loaded tasks
- stats: View benchmark statistics
- tasks: List loaded tasks
- results: View task results
- clear: Clear tasks or results
- sample: Load sample benchmark tasks
- save: Save results to file
- validate: Validate a patch against gold patch
- add: Add a custom benchmark task

Example usage:
benchmark({action: 'sample'})
benchmark({action: 'tasks'})
benchmark({action: 'stats'})
benchmark({action: 'add', taskId: 'custom-001', problem: 'Fix bug in code', difficulty: 'easy'})`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action: load, run, runAll, stats, tasks, results, clear, sample, save, validate, add",
		}),
		filePath: Type.Optional(Type.String({ description: "File path for load/save actions" })),
		dirPath: Type.Optional(Type.String({ description: "Directory path for loading tasks" })),
		maxTasks: Type.Optional(Type.Number({ description: "Maximum tasks to load/run" })),
		categoryFilter: Type.Optional(Type.Array(Type.String(), { description: "Filter by category" })),
		difficultyFilter: Type.Optional(
			Type.Array(Type.String(), { description: "Filter by difficulty" }),
		),
		taskId: Type.Optional(Type.String({ description: "Task ID for run/add actions" })),
		problem: Type.Optional(Type.String({ description: "Problem statement for add action" })),
		repo: Type.Optional(Type.String({ description: "Repository for add action" })),
		difficulty: Type.Optional(Type.String({ description: "Difficulty: easy, medium, hard" })),
		category: Type.Optional(
			Type.Array(Type.String(), { description: "Categories for add action" }),
		),
		generatedPatch: Type.Optional(Type.String({ description: "Generated patch for validation" })),
		goldPatch: Type.Optional(Type.String({ description: "Gold patch for validation" })),
		outputDir: Type.Optional(Type.String({ description: "Output directory for results" })),
		target: Type.Optional(Type.String({ description: "Target for clear: tasks, results, all" })),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const input = params as Record<string, unknown>;
		const action = input.action as string;

		try {
			switch (action) {
				case "load":
					return handleLoad(input);

				case "run":
					return await handleRun(input);

				case "runAll":
					return await handleRunAll(input);

				case "stats":
					return handleStats();

				case "tasks":
					return handleTasks();

				case "results":
					return handleResults();

				case "clear":
					return handleClear(input);

				case "sample":
					return handleSample(input);

				case "save":
					return handleSave(input);

				case "validate":
					return handleValidate(input);

				case "add":
					return handleAdd(input);

				default:
					return {
						content: [{ type: "text", text: `Unknown action: ${action}` }],
						details: `Error: Unknown action '${action}'`,
					};
			}
		} catch (e) {
			const errorMessage = e instanceof Error ? e.message : String(e);
			return {
				content: [{ type: "text", text: `Error: ${errorMessage}` }],
				details: `Error: ${errorMessage}`,
			};
		}
	},
};

/**
 * Handle load action
 */
function handleLoad(input: Record<string, unknown>): AgentToolResult<unknown> {
	const runner = getBenchmarkRunner({
		maxTasks: input.maxTasks as number | undefined,
		categoryFilter: input.categoryFilter as string[] | undefined,
		difficultyFilter: input.difficultyFilter as string[] | undefined,
	});

	try {
		let count = 0;

		if (input.filePath) {
			count = runner.loadTasks(input.filePath as string);
		} else if (input.dirPath) {
			count = runner.loadTasksFromDir(input.dirPath as string);
		} else {
			return {
				content: [{ type: "text", text: "Error: filePath or dirPath required for load action" }],
				details: "Error: Missing path",
			};
		}

		const tasks = runner.getTasks();
		return {
			content: [{ type: "text", text: formatLoadResult(count, tasks) }],
			details: { loaded: count, tasks },
		};
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		return {
			content: [{ type: "text", text: `Error loading tasks: ${errorMessage}` }],
			details: `Error: ${errorMessage}`,
		};
	}
}

/**
 * Handle run action (single task)
 */
async function handleRun(input: Record<string, unknown>): Promise<AgentToolResult<unknown>> {
	const runner = getBenchmarkRunner();
	const tasks = runner.getTasks();

	const taskId = input.taskId as string;
	if (!taskId) {
		return {
			content: [{ type: "text", text: "Error: taskId required for run action" }],
			details: "Error: Missing taskId",
		};
	}

	const task = tasks.find((t: BenchmarkTask) => t.instance_id === taskId);
	if (!task) {
		return {
			content: [{ type: "text", text: `Error: Task not found: ${taskId}` }],
			details: "Error: Task not found",
		};
	}

	try {
		const result = await runner.runTask(task);
		return {
			content: [{ type: "text", text: formatResult(result) }],
			details: { result },
		};
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		return {
			content: [{ type: "text", text: `Error running task: ${errorMessage}` }],
			details: `Error: ${errorMessage}`,
		};
	}
}

/**
 * Handle runAll action
 */
async function handleRunAll(input: Record<string, unknown>): Promise<AgentToolResult<unknown>> {
	const runner = getBenchmarkRunner();

	const tasks = runner.getTasks();
	if (tasks.length === 0) {
		return {
			content: [{ type: "text", text: "Error: No tasks loaded. Use load or sample action first." }],
			details: "Error: No tasks",
		};
	}

	try {
		const stats = await runner.runAll();
		return {
			content: [{ type: "text", text: runner.formatStats(stats) }],
			details: { stats },
		};
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		return {
			content: [{ type: "text", text: `Error running all tasks: ${errorMessage}` }],
			details: `Error: ${errorMessage}`,
		};
	}
}

/**
 * Handle stats action
 */
function handleStats(): AgentToolResult<unknown> {
	const runner = getBenchmarkRunner();
	const stats = runner.calculateStats();
	return {
		content: [{ type: "text", text: runner.formatStats(stats) }],
		details: { stats },
	};
}

/**
 * Handle tasks action
 */
function handleTasks(): AgentToolResult<unknown> {
	const runner = getBenchmarkRunner();
	const tasks = runner.getTasks();

	if (tasks.length === 0) {
		return {
			content: [{ type: "text", text: "No tasks loaded. Use load or sample action first." }],
			details: { tasks: [] },
		};
	}

	const lines: string[] = ["## Loaded Benchmark Tasks", "", `**Total:** ${tasks.length}`, ""];

	for (const task of tasks.slice(0, 10)) {
		lines.push(`### ${task.instance_id}`);
		lines.push(`- **Problem:** ${task.problem_statement.slice(0, 100)}...`);
		lines.push(`- **Repo:** ${task.repo}`);
		if (task.difficulty) {
			lines.push(`- **Difficulty:** ${task.difficulty}`);
		}
		if (task.category) {
			lines.push(`- **Categories:** ${task.category.join(", ")}`);
		}
		lines.push("");
	}

	if (tasks.length > 10) {
		lines.push(`... and ${tasks.length - 10} more tasks.`);
	}

	return {
		content: [{ type: "text", text: lines.join("\n") }],
		details: { count: tasks.length },
	};
}

/**
 * Handle results action
 */
function handleResults(): AgentToolResult<unknown> {
	const runner = getBenchmarkRunner();
	const results = runner.getResults();

	if (results.length === 0) {
		return {
			content: [{ type: "text", text: "No results available. Run tasks first." }],
			details: { results: [] },
		};
	}

	const lines: string[] = ["## Benchmark Results", "", `**Total:** ${results.length}`, ""];

	const successful = results.filter((r: { success: boolean }) => r.success).length;
	const failed = results.filter((r: { success: boolean }) => !r.success).length;

	lines.push(`**Successful:** ${successful}`);
	lines.push(`**Failed:** ${failed}`);
	lines.push("");

	for (const result of results.slice(0, 10)) {
		lines.push(`### ${result.instance_id}`);
		lines.push(`- **Status:** ${result.success ? "✅ Success" : "❌ Failed"}`);
		lines.push(`- **Time:** ${result.time_minutes.toFixed(1)} minutes`);
		if (result.quality_score) {
			lines.push(`- **Quality:** ${result.quality_score}`);
		}
		if (result.errors && result.errors.length > 0) {
			lines.push(`- **Errors:** ${result.errors.join(", ")}`);
		}
		lines.push("");
	}

	if (results.length > 10) {
		lines.push(`... and ${results.length - 10} more results.`);
	}

	return {
		content: [{ type: "text", text: lines.join("\n") }],
		details: { successful, failed, total: results.length },
	};
}

/**
 * Handle clear action
 */
function handleClear(input: Record<string, unknown>): AgentToolResult<unknown> {
	const runner = getBenchmarkRunner();
	const target = (input.target as string) || "all";

	if (target === "tasks" || target === "all") {
		runner.clearTasks();
	}
	if (target === "results" || target === "all") {
		runner.clearResults();
	}

	const message = `Cleared ${target}. Current state: ${runner.getTasks().length} tasks, ${runner.getResults().length} results`;
	return {
		content: [{ type: "text", text: message }],
		details: { cleared: target },
	};
}

/**
 * Handle sample action
 */
function handleSample(input: Record<string, unknown>): AgentToolResult<unknown> {
	const runner = getBenchmarkRunner({
		maxTasks: input.maxTasks as number | undefined,
	});

	const samples = createSampleTasks();
	for (const task of samples) {
		runner.addTask(task);
	}

	const tasks = runner.getTasks();
	return {
		content: [{ type: "text", text: formatLoadResult(samples.length, tasks) }],
		details: { loaded: samples.length },
	};
}

/**
 * Handle save action
 */
function handleSave(input: Record<string, unknown>): AgentToolResult<unknown> {
	const runner = getBenchmarkRunner();

	try {
		runner.saveResults();
		const outputDir = (input.outputDir as string) || "data/benchmark-results";
		return {
			content: [{ type: "text", text: `Results saved to ${outputDir}/benchmark-summary.json` }],
			details: { saved: true },
		};
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		return {
			content: [{ type: "text", text: `Error saving results: ${errorMessage}` }],
			details: `Error: ${errorMessage}`,
		};
	}
}

/**
 * Handle validate action
 */
function handleValidate(input: Record<string, unknown>): AgentToolResult<unknown> {
	const generated = input.generatedPatch as string;
	const gold = input.goldPatch as string;

	if (!generated || !gold) {
		return {
			content: [
				{ type: "text", text: "Error: generatedPatch and goldPatch required for validate action" },
			],
			details: "Error: Missing patches",
		};
	}

	const runner = getBenchmarkRunner();
	const isValid = runner.validatePatch(generated, gold);

	const text = `## Patch Validation

**Result:** ${isValid ? "✅ Valid - Patch matches gold" : "❌ Invalid - Patch differs from gold"}

- **Generated Length:** ${generated.length} chars
- **Gold Length:** ${gold.length} chars`;

	return {
		content: [{ type: "text", text }],
		details: { valid: isValid },
	};
}

/**
 * Handle add action
 */
function handleAdd(input: Record<string, unknown>): AgentToolResult<unknown> {
	const runner = getBenchmarkRunner();

	const taskId = input.taskId as string;
	const problem = input.problem as string;

	if (!taskId || !problem) {
		return {
			content: [{ type: "text", text: "Error: taskId and problem required for add action" }],
			details: "Error: Missing parameters",
		};
	}

	const task: BenchmarkTask = {
		instance_id: taskId,
		problem_statement: problem,
		repo: (input.repo as string) || "paimon/paimon",
		base_commit: "main",
		difficulty: input.difficulty as "easy" | "medium" | "hard" | undefined,
		category: input.category as string[] | undefined,
	};

	runner.addTask(task);

	return {
		content: [{ type: "text", text: `Task added: ${taskId}\n\n${runner.formatTask(task)}` }],
		details: { added: taskId },
	};
}

/**
 * Format load result
 */
function formatLoadResult(count: number, tasks: BenchmarkTask[]): string {
	const lines: string[] = ["## Tasks Loaded", "", `**Total:** ${count} tasks`, ""];

	// Summarize by difficulty
	const byDiff: Record<string, number> = {};
	const byCat: Record<string, number> = {};

	for (const task of tasks) {
		if (task.difficulty) {
			byDiff[task.difficulty] = (byDiff[task.difficulty] || 0) + 1;
		}
		if (task.category) {
			for (const cat of task.category) {
				byCat[cat] = (byCat[cat] || 0) + 1;
			}
		}
	}

	if (Object.keys(byDiff).length > 0) {
		lines.push("**By Difficulty:**");
		for (const [diff, count] of Object.entries(byDiff)) {
			lines.push(`- ${diff}: ${count}`);
		}
		lines.push("");
	}

	if (Object.keys(byCat).length > 0) {
		lines.push("**By Category:**");
		for (const [cat, count] of Object.entries(byCat)) {
			lines.push(`- ${cat}: ${count}`);
		}
		lines.push("");
	}

	lines.push("**Use `runAll` to execute all tasks, or `run` with taskId for single task.**");

	return lines.join("\n");
}

/**
 * Format single result
 */
function formatResult(
	result:
		| { totalTasks: number }
		| {
				instance_id: string;
				success: boolean;
				time_minutes: number;
				errors?: string[];
				quality_score?: number;
		  },
): string {
	if ("totalTasks" in result) {
		const runner = getBenchmarkRunner();
		// Type guard for BenchmarkStats
		return runner.formatStats({
			totalTasks: result.totalTasks,
			successful: 0,
			failed: 0,
			passRate: 0,
			averageTime: 0,
			averageQuality: 0,
			errorsByType: {},
			byDifficulty: {},
			byCategory: {},
		});
	}

	const lines: string[] = [
		"## Task Result",
		"",
		`**ID:** ${result.instance_id}`,
		`**Status:** ${result.success ? "✅ Success" : "❌ Failed"}`,
		`**Time:** ${result.time_minutes.toFixed(1)} minutes`,
		"",
	];

	if (result.quality_score) {
		lines.push(`**Quality Score:** ${result.quality_score}`);
	}

	if (result.errors && result.errors.length > 0) {
		lines.push("", "**Errors:**");
		for (const error of result.errors) {
			lines.push(`- ${error}`);
		}
	}

	return lines.join("\n");
}

export default benchmarkTool;
