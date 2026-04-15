/**
 * Synthetic Task Generation Tool (SWE-smith Pattern)
 *
 * Tool for generating synthetic task instances for:
 * - Training SWE-agents
 * - Self-evolution verification
 * - Benchmark task generation
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { SyntheticTaskType, TaskDifficulty } from "../synthetic-task-gen.js";
import { type SyntheticTaskGenerator, getSyntheticTaskGenerator } from "../synthetic-task-gen.js";

// ============================================================================
// Tool Definition
// ============================================================================

export const syntheticTaskGenToolDef: AgentTool = {
	name: "syntheticTaskGen",
	label: "Synthetic Task Generation",
	description: `Manage synthetic task generation for training and testing (SWE-smith Pattern) - Generate synthetic task instances from code patterns for training SWE-agents

Actions:
- generate: Generate synthetic tasks (optional: type, difficulty, count, repository)
- validate: Validate a generated task (requires taskId)
- scenarios: List all generation scenarios
- tasks: List generated tasks (optional: type filter, validated filter)
- task: Get specific task details (requires taskId)
- export: Export training data in various formats (optional: format: swe-bench, swe-smith, custom)
- config: View or update configuration
- stats: View generation statistics
- reset: Reset statistics
- clear: Clear all generated tasks
- add-scenario: Add custom generation scenario (requires scenario)
- remove: Remove specific task (requires taskId)

Task Types: bug-fix, feature-add, refactor, test-add, security-fix
Difficulty Levels: easy, medium, hard

Example usage:
syntheticTaskGen({action: 'generate', type: 'bug-fix', difficulty: 'medium', count: 5})
syntheticTaskGen({action: 'scenarios'})
syntheticTaskGen({action: 'validate', taskId: 'synth-123'})`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action: generate, validate, scenarios, tasks, task, export, config, stats, reset, clear, add-scenario, remove",
		}),
		type: Type.Optional(
			Type.String({
				description: "Task type: bug-fix, feature-add, refactor, test-add, security-fix",
			}),
		),
		difficulty: Type.Optional(
			Type.String({
				description: "Difficulty: easy, medium, hard",
			}),
		),
		count: Type.Optional(
			Type.Number({
				description: "Number of tasks to generate",
			}),
		),
		repository: Type.Optional(
			Type.String({
				description: "Repository context for generation",
			}),
		),
		taskId: Type.Optional(
			Type.String({
				description: "Task ID for specific operations",
			}),
		),
		format: Type.Optional(
			Type.String({
				description: "Export format: swe-bench, swe-smith, custom",
			}),
		),
		validated: Type.Optional(
			Type.Boolean({
				description: "Filter for validated tasks",
			}),
		),
	}),
	execute: async (
		_toolCallId: string,
		params: unknown,
	): Promise<AgentToolResult<{ success: boolean; action: string }>> => {
		const p = params as Record<string, unknown>;
		const generator = getSyntheticTaskGenerator();
		const output = executeAction(generator, p);
		return {
			content: [{ type: "text", text: output }],
			details: { success: true, action: String(p.action) },
		};
	},
};

// ============================================================================
// Action Implementation
// ============================================================================

function executeAction(generator: SyntheticTaskGenerator, params: Record<string, unknown>): string {
	const action = params.action as string;

	switch (action) {
		case "generate":
			return handleGenerate(generator, params);
		case "validate":
			return handleValidate(generator, params);
		case "scenarios":
			return handleScenarios(generator);
		case "tasks":
			return handleTasks(generator, params);
		case "task":
			return handleTask(generator, params);
		case "export":
			return handleExport(generator, params);
		case "config":
			return handleConfig(generator, params);
		case "stats":
			return handleStats(generator);
		case "reset":
			return handleReset(generator);
		case "clear":
			return handleClear(generator);
		case "add-scenario":
			return "Add-scenario action requires scenario object - use config action to customize";
		case "remove":
			return handleRemove(generator, params);
		default:
			return `Unknown action: ${action}. Available actions: generate, validate, scenarios, tasks, task, export, config, stats, reset, clear, add-scenario, remove`;
	}
}

// Helper functions
function formatList(items: string[]): string {
	if (items.length === 0) return "None";
	return items.join(", ");
}

function formatTableRow(cells: string[]): string {
	return `| ${cells.join(" | ")} |`;
}

function safeString(input: string | undefined): string {
	if (!input) return "";
	return input.replace(/[;'"\n\r]/g, "");
}

// Action Handlers
function handleGenerate(
	generator: SyntheticTaskGenerator,
	params: Record<string, unknown>,
): string {
	const type = params.type as SyntheticTaskType | undefined;
	const difficulty = params.difficulty as TaskDifficulty | undefined;
	const count = params.count as number | undefined;
	const repository = params.repository as string | undefined;

	const tasks = generator.generate(type, difficulty, count, repository);

	const lines: string[] = [
		"## Synthetic Tasks Generated",
		"",
		`**Total:** ${tasks.length}`,
		"",
		"| ID | Type | Difficulty | Problem Statement |",
		"|----|------|------------|-------------------|",
	];

	for (const t of tasks) {
		lines.push(
			formatTableRow([t.id, t.type, t.difficulty, `${t.problemStatement.slice(0, 40)}...`]),
		);
	}

	return lines.join("\n");
}

function handleValidate(
	generator: SyntheticTaskGenerator,
	params: Record<string, unknown>,
): string {
	if (!params.taskId) {
		return "Error: taskId required for validate action";
	}

	const result = generator.validate(params.taskId as string);

	const lines: string[] = [
		"## Validation Result",
		"",
		`**Task ID:** ${result.taskId}`,
		`**Passed:** ${result.passed ? "Yes" : "No"}`,
		`**Complexity Score:** ${result.complexityScore}`,
	];

	if (result.errors.length > 0) {
		lines.push("", "### Errors");
		for (const e of result.errors) {
			lines.push(`- ${e}`);
		}
	}

	if (result.suggestions.length > 0) {
		lines.push("", "### Suggestions");
		for (const s of result.suggestions) {
			lines.push(`- ${s}`);
		}
	}

	return lines.join("\n");
}

function handleScenarios(generator: SyntheticTaskGenerator): string {
	const scenarios = generator.getScenarios();

	const lines: string[] = [
		"## Generation Scenarios",
		"",
		"| Name | Type | Difficulty Range |",
		"|------|------|-------------------|",
	];

	for (const s of scenarios) {
		lines.push(formatTableRow([s.name, s.taskType, s.difficultyRange.join(" - ")]));
	}

	return lines.join("\n");
}

function handleTasks(generator: SyntheticTaskGenerator, params: Record<string, unknown>): string {
	const type = params.type as SyntheticTaskType | undefined;
	const validated = params.validated as boolean | undefined;

	const tasks = generator.getTasks(type, validated);

	const lines: string[] = [
		"## Generated Tasks",
		"",
		`**Total:** ${tasks.length}`,
		"",
		"| ID | Type | Difficulty | Validated |",
		"|----|------|------------|-----------|",
	];

	const displayTasks = tasks.slice(0, 20);
	for (const t of displayTasks) {
		lines.push(formatTableRow([t.id, t.type, t.difficulty, t.validated ? "Yes" : "No"]));
	}

	if (tasks.length > 20) {
		lines.push("", `... and ${tasks.length - 20} more`);
	}

	return lines.join("\n");
}

function handleTask(generator: SyntheticTaskGenerator, params: Record<string, unknown>): string {
	if (!params.taskId) {
		return "Error: taskId required for task action";
	}

	const task = generator.getTask(params.taskId as string);
	if (!task) {
		return `Error: Task not found: ${safeString(params.taskId as string)}`;
	}

	const lines: string[] = [
		`## Task: ${task.id}`,
		"",
		`**Type:** ${task.type}`,
		`**Difficulty:** ${task.difficulty}`,
		`**Category:** ${task.category}`,
		`**Validated:** ${task.validated ? "Yes" : "No"}`,
		`**Confidence:** ${task.metadata.confidence}%`,
		"",
		"### Problem Statement",
		task.problemStatement,
	];

	if (task.hints && task.hints.length > 0) {
		lines.push("", "### Hints");
		for (const h of task.hints) {
			lines.push(`- ${h}`);
		}
	}

	if (task.targetFiles.length > 0) {
		lines.push("", "### Target Files");
		for (const f of task.targetFiles) {
			lines.push(`- ${f}`);
		}
	}

	return lines.join("\n");
}

function handleExport(generator: SyntheticTaskGenerator, params: Record<string, unknown>): string {
	const format = (params.format as "swe-bench" | "swe-smith" | "custom") || "swe-bench";
	const data = generator.exportTrainingData(format);

	const lines: string[] = [
		"## Training Data Export",
		"",
		`**Format:** ${data.format}`,
		`**Total Tasks:** ${data.metadata.totalTasks}`,
		`**Validated Tasks:** ${data.metadata.validatedTasks}`,
		`**Average Difficulty:** ${data.metadata.avgDifficulty}`,
		`**Generated At:** ${data.metadata.generatedAt}`,
	];

	return lines.join("\n");
}

function handleConfig(generator: SyntheticTaskGenerator, params: Record<string, unknown>): string {
	const config = generator.getConfig();

	const lines: string[] = [
		"## Configuration",
		"",
		"| Setting | Value |",
		"|---------|-------|",
		formatTableRow(["enabled", String(config.enabled)]),
		formatTableRow(["maxTasksPerGeneration", String(config.maxTasksPerGeneration)]),
		formatTableRow(["defaultDifficulty", config.defaultDifficulty]),
		formatTableRow(["validateGenerated", String(config.validateGenerated)]),
		formatTableRow(["repositoryContext", String(config.repositoryContext)]),
	];

	return lines.join("\n");
}

function handleStats(generator: SyntheticTaskGenerator): string {
	const stats = generator.getStats();

	const lines: string[] = [
		"## Synthetic Task Generation Statistics",
		"",
		"### Overview",
		"| Metric | Value |",
		"|--------|-------|",
		formatTableRow(["Total Generated", String(stats.totalGenerated)]),
		formatTableRow(["Validated Tasks", String(stats.validatedTasks)]),
		formatTableRow(["Validation Pass Rate", `${(stats.validationPassRate * 100).toFixed(1)}%`]),
		formatTableRow(["Average Confidence", stats.avgConfidence.toFixed(1)]),
		formatTableRow(["Last Generation", stats.lastGeneration || "never"]),
		"",
		"### By Type",
		"| Type | Count |",
		"|------|-------|",
	];

	for (const [type, count] of Object.entries(stats.byType)) {
		lines.push(formatTableRow([type, String(count)]));
	}

	lines.push("", "### By Difficulty", "| Difficulty | Count |", "|------------|-------|");
	for (const [diff, count] of Object.entries(stats.byDifficulty)) {
		lines.push(formatTableRow([diff, String(count)]));
	}

	return lines.join("\n");
}

function handleReset(generator: SyntheticTaskGenerator): string {
	generator.resetStats();
	return "Statistics reset to zero.";
}

function handleClear(generator: SyntheticTaskGenerator): string {
	generator.clearTasks();
	return "All generated tasks cleared.";
}

function handleRemove(generator: SyntheticTaskGenerator, params: Record<string, unknown>): string {
	if (!params.taskId) {
		return "Error: taskId required for remove action";
	}

	const removed = generator.removeTask(params.taskId as string);
	return removed
		? `Task ${safeString(params.taskId as string)} removed.`
		: `Task ${safeString(params.taskId as string)} not found.`;
}
