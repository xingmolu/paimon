/**
 * Self-Evaluation Tool - Agent self-evaluation for recursive improvement
 *
 * This tool allows the agent to evaluate its own performance and
 * identify strengths, weaknesses, and areas for improvement.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type PerformanceTrend,
	type SelfEvaluation,
	type SelfEvaluationStats,
	getSelfEvaluationManager,
} from "../self-evaluation.js";

// Tool Definition
export const selfEvaluationToolDef: AgentTool = {
	name: "selfEvaluation",
	label: "Self-Evaluation",
	description: `Agent self-evaluation for recursive improvement - evaluates own performance after iterations, identifies strengths/weaknesses, provides recommendations

Actions:
- evaluate: Perform self-evaluation after iteration (requires: iterationId, taskType, taskDescription, durationMinutes, success)
- history: View evaluation history (optional: limit)
- evaluation: Get specific evaluation result (requires: evaluationId)
- strengths: View current strengths
- weaknesses: View current weaknesses
- recommendations: Get performance recommendations
- trends: View performance trends
- stats: View statistics
- config: View configuration
- update-config: Update configuration
- clear: Clear evaluation history
- reset: Reset to defaults
- enable: Enable auto-evaluation
- disable: Disable auto-evaluation
- help: Show help message

Evaluation Criteria: task_success, time_efficiency, error_handling, skill_usage, code_quality, learning_quality, capability_gap, planning_quality
Result Categories: excellent (≥90), good (≥75), adequate (≥60), needs_improvement (≥40), poor (<40)

Example usage:
selfEvaluation({action: 'evaluate', iterationId: 'iter-123', taskType: 'capability', taskDescription: 'Add tool', durationMinutes: 15, success: true})
selfEvaluation({action: 'stats'})
selfEvaluation({action: 'strengths'})`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action: evaluate, history, evaluation, strengths, weaknesses, recommendations, trends, stats, config, update-config, clear, reset, enable, disable, help",
		}),
		iterationId: Type.Optional(Type.String({ description: "Iteration ID (for evaluate)" })),
		taskType: Type.Optional(
			Type.String({ description: "Task type: capability, reliability, feature (for evaluate)" }),
		),
		taskDescription: Type.Optional(Type.String({ description: "Task description (for evaluate)" })),
		durationMinutes: Type.Optional(
			Type.Number({ description: "Duration in minutes (for evaluate)" }),
		),
		success: Type.Optional(Type.Boolean({ description: "Task success (for evaluate)" })),
		errors: Type.Optional(
			Type.Array(Type.String(), { description: "Errors encountered (for evaluate)" }),
		),
		skillsUsed: Type.Optional(
			Type.Array(Type.String(), { description: "Skills used (for evaluate)" }),
		),
		firstTry: Type.Optional(Type.Boolean({ description: "First try success (for evaluate)" })),
		rework: Type.Optional(Type.Boolean({ description: "Rework required (for evaluate)" })),
		impact: Type.Optional(
			Type.String({ description: "Task impact: High, Medium, Low (for evaluate)" }),
		),
		limit: Type.Optional(Type.Number({ description: "Limit for history" })),
		evaluationId: Type.Optional(Type.String({ description: "Evaluation ID to retrieve" })),
		enabled: Type.Optional(Type.Boolean({ description: "Enable/disable (for update-config)" })),
		autoEvaluate: Type.Optional(
			Type.Boolean({ description: "Auto-evaluation setting (for update-config)" }),
		),
		historyRetentionDays: Type.Optional(
			Type.Number({ description: "History retention days (for update-config)" }),
		),
		minIterationsForTrend: Type.Optional(
			Type.Number({ description: "Min iterations for trend (for update-config)" }),
		),
	}),
	execute: async (
		_toolCallId: string,
		params: unknown,
	): Promise<AgentToolResult<{ success: boolean; action: string }>> => {
		const p = params as Record<string, unknown>;
		const manager = getSelfEvaluationManager();
		const output = executeAction(manager, p);
		return {
			content: [{ type: "text", text: output }],
			details: { success: true, action: String(p.action) },
		};
	},
};

// Action Implementation
function executeAction(
	manager: ReturnType<typeof getSelfEvaluationManager>,
	params: Record<string, unknown>,
): string {
	const action = params.action as string;

	switch (action) {
		case "evaluate": {
			if (
				!params.iterationId ||
				!params.taskType ||
				!params.taskDescription ||
				!params.durationMinutes ||
				params.success === undefined
			) {
				return "Missing required parameters for evaluate action. Need: iterationId, taskType, taskDescription, durationMinutes, success";
			}

			const evaluation = manager.evaluate({
				iterationId: params.iterationId as string,
				taskType: params.taskType as "capability" | "reliability" | "feature",
				taskDescription: params.taskDescription as string,
				durationMinutes: params.durationMinutes as number,
				success: params.success as boolean,
				errors: (params.errors as string[]) || [],
				skillsUsed: (params.skillsUsed as string[]) || [],
				firstTry: (params.firstTry as boolean) ?? true,
				rework: (params.rework as boolean) ?? false,
				impact: (params.impact as "High" | "Medium" | "Low") || "Medium",
			});

			return formatEvaluationResult(evaluation);
		}

		case "history": {
			const history = manager.getHistory((params.limit as number) || 20);
			if (history.length === 0) {
				return "## Evaluation History\n\nNo evaluations recorded yet.";
			}

			const historyParts: string[] = [
				"## Evaluation History",
				"",
				"| ID | Timestamp | Task Type | Score | Success |",
				"|----|-----------|-----------|-------|---------|",
			];

			for (const e of history) {
				historyParts.push(
					`| ${e.id} | ${e.timestamp.slice(0, 10)} | ${e.taskType} | ${e.overallScore} | ${e.success ? "✅" : "❌"} |`,
				);
			}

			return historyParts.join("\n");
		}

		case "evaluation": {
			if (!params.evaluationId) {
				return "Missing evaluationId parameter";
			}

			const specificEvaluation = manager.getEvaluation(params.evaluationId as string);
			if (!specificEvaluation) {
				return `Evaluation ${params.evaluationId as string} not found`;
			}

			return formatEvaluationResult(specificEvaluation);
		}

		case "strengths": {
			const strengths = manager.getCurrentStrengths();
			if (strengths.length === 0) {
				return "## Current Strengths\n\nNo strengths identified yet. Need more evaluation history.";
			}

			return `## Current Strengths\n\n${strengths.map((s) => `- ✅ ${s}`).join("\n")}`;
		}

		case "weaknesses": {
			const weaknesses = manager.getCurrentWeaknesses();
			if (weaknesses.length === 0) {
				return "## Current Weaknesses\n\nNo weaknesses identified yet. Need more evaluation history.";
			}

			return `## Current Weaknesses\n\n${weaknesses.map((w) => `- ⚠️ ${w}`).join("\n")}`;
		}

		case "recommendations": {
			const recommendations = manager.getRecommendations();
			if (recommendations.length === 0) {
				return "## Recommendations\n\nNo recommendations available yet. Need more evaluation history.";
			}

			return `## Recommendations\n\n${recommendations.map((r) => `- 💡 ${r}`).join("\n")}`;
		}

		case "trends":
			return formatTrends(manager.getPerformanceTrends());

		case "stats":
			return formatStats(manager.getStats());

		case "config": {
			const config = manager.getConfig();
			return [
				"## Self-Evaluation Configuration",
				"",
				"| Setting | Value |",
				"|---------|-------|",
				`| enabled | ${config.enabled} |`,
				`| autoEvaluate | ${config.autoEvaluate} |`,
				`| historyRetentionDays | ${config.historyRetentionDays} |`,
				`| minIterationsForTrend | ${config.minIterationsForTrend} |`,
				`| excellent threshold | ≥${config.evaluationThresholds.excellent} |`,
				`| good threshold | ≥${config.evaluationThresholds.good} |`,
				`| adequate threshold | ≥${config.evaluationThresholds.adequate} |`,
				`| needsImprovement threshold | ≥${config.evaluationThresholds.needsImprovement} |`,
			].join("\n");
		}

		case "update-config": {
			const updated = manager.updateConfig({
				enabled: params.enabled as boolean | undefined,
				autoEvaluate: params.autoEvaluate as boolean | undefined,
				historyRetentionDays: params.historyRetentionDays as number | undefined,
				minIterationsForTrend: params.minIterationsForTrend as number | undefined,
			});
			return `Configuration updated:\n- enabled: ${updated.enabled}\n- autoEvaluate: ${updated.autoEvaluate}`;
		}

		case "clear":
			manager.clearEvaluations();
			return "Evaluation history cleared";

		case "reset":
			manager.reset();
			return "Self-evaluation manager reset to defaults";

		case "enable":
			manager.updateConfig({ enabled: true, autoEvaluate: true });
			return "Self-evaluation enabled with auto-evaluation";

		case "disable":
			manager.updateConfig({ autoEvaluate: false });
			return "Auto-evaluation disabled (manual evaluation still available)";

		case "help":
			return formatHelp();

		default:
			return `Unknown action: ${action}. Use 'help' to see available actions.`;
	}
}

// Formatting Functions
function formatEvaluationResult(evaluation: SelfEvaluation): string {
	const parts: string[] = [
		`## Self-Evaluation Result (${evaluation.id})`,
		"",
		`**Timestamp:** ${evaluation.timestamp}`,
		`**Iteration:** ${evaluation.iterationId}`,
		`**Task Type:** ${evaluation.taskType}`,
		`**Task:** ${evaluation.taskDescription}`,
		`**Duration:** ${evaluation.durationMinutes} minutes`,
		`**Success:** ${evaluation.success ? "✅" : "❌"}`,
		"",
		`### Overall Score: ${evaluation.overallScore}/100`,
		"",
		"### Criterion Scores",
		"",
		"| Criterion | Result | Score | Notes |",
		"|-----------|--------|-------|-------|",
	];

	for (const cs of evaluation.criterionScores) {
		parts.push(`| ${cs.criterion} | ${cs.result} | ${cs.score} | ${cs.notes} |`);
	}

	if (evaluation.strengths.length > 0) {
		parts.push("", "### Strengths", "");
		for (const s of evaluation.strengths) {
			parts.push(`- ✅ ${s}`);
		}
	}

	if (evaluation.weaknesses.length > 0) {
		parts.push("", "### Weaknesses", "");
		for (const w of evaluation.weaknesses) {
			parts.push(`- ⚠️ ${w}`);
		}
	}

	if (evaluation.recommendations.length > 0) {
		parts.push("", "### Recommendations", "");
		for (const r of evaluation.recommendations) {
			parts.push(`- 💡 ${r}`);
		}
	}

	if (evaluation.capabilityGaps.length > 0) {
		parts.push("", "### Capability Gaps", "");
		for (const g of evaluation.capabilityGaps) {
			parts.push(`- 🔍 ${g}`);
		}
	}

	if (evaluation.nextFocusAreas.length > 0) {
		parts.push("", "### Next Focus Areas", "");
		for (const f of evaluation.nextFocusAreas) {
			parts.push(`- 🎯 ${f}`);
		}
	}

	return parts.join("\n");
}

function formatStats(stats: SelfEvaluationStats): string {
	const parts: string[] = [
		"## Self-Evaluation Statistics",
		"",
		`**Total Evaluations:** ${stats.totalEvaluations}`,
		`**Average Overall Score:** ${stats.averageOverallScore}`,
		`**Success Rate:** ${stats.successRate}%`,
		`**Average Time:** ${stats.averageTimeEfficiency} minutes`,
		`**Error Recovery Rate:** ${stats.errorRecoveryRate}%`,
		"",
		"### Score Distribution",
		"",
		"| Result | Count |",
		"|--------|-------|",
		`| Excellent | ${stats.excellentCount} |`,
		`| Good | ${stats.goodCount} |`,
		`| Adequate | ${stats.adequateCount} |`,
		`| Needs Improvement | ${stats.needsImprovementCount} |`,
		`| Poor | ${stats.poorCount} |`,
	];

	if (stats.recentTrends.length > 0) {
		parts.push("", "### Performance Trends", "");
		parts.push("| Dimension | Current | Previous | Trend | Change |");
		parts.push("|-----------|---------|----------|-------|--------|");
		for (const trend of stats.recentTrends) {
			const trendEmoji =
				trend.trend === "improving" ? "📈" : trend.trend === "declining" ? "📉" : "➡️";
			parts.push(
				`| ${trend.dimension} | ${Math.round(trend.currentValue)} | ${Math.round(trend.previousValue)} | ${trendEmoji} ${trend.trend} | ${trend.trendPercentage}% |`,
			);
		}
	}

	if (stats.topStrengths.length > 0) {
		parts.push("", "### Top Strengths", "");
		for (const s of stats.topStrengths) {
			parts.push(`- ✅ ${s}`);
		}
	}

	if (stats.topWeaknesses.length > 0) {
		parts.push("", "### Top Weaknesses", "");
		for (const w of stats.topWeaknesses) {
			parts.push(`- ⚠️ ${w}`);
		}
	}

	if (stats.commonCapabilityGaps.length > 0) {
		parts.push("", "### Common Capability Gaps", "");
		for (const g of stats.commonCapabilityGaps) {
			parts.push(`- 🔍 ${g}`);
		}
	}

	return parts.join("\n");
}

function formatTrends(trends: PerformanceTrend[]): string {
	if (trends.length === 0) {
		return "## Performance Trends\n\nNo trends available. Need more evaluation history.";
	}

	const parts: string[] = [
		"## Performance Trends",
		"",
		"| Dimension | Current | Previous | Trend | Change |",
		"|-----------|---------|----------|-------|--------|",
	];

	for (const trend of trends) {
		const trendEmoji =
			trend.trend === "improving" ? "📈" : trend.trend === "declining" ? "📉" : "➡️";
		parts.push(
			`| ${trend.dimension} | ${Math.round(trend.currentValue)} | ${Math.round(trend.previousValue)} | ${trendEmoji} ${trend.trend} | ${trend.trendPercentage}% |`,
		);
	}

	return parts.join("\n");
}

function formatHelp(): string {
	return `
## Self-Evaluation Tool

Agent self-evaluation for recursive improvement.

### Actions

| Action | Description | Required Parameters |
|--------|-------------|---------------------|
| evaluate | Perform self-evaluation | iterationId, taskType, taskDescription, durationMinutes, success |
| history | View evaluation history | limit (optional) |
| evaluation | Get specific result | evaluationId |
| strengths | View current strengths | - |
| weaknesses | View current weaknesses | - |
| recommendations | Get recommendations | - |
| trends | View performance trends | - |
| stats | View statistics | - |
| config | View configuration | - |
| update-config | Update configuration | enabled, autoEvaluate (optional) |
| clear | Clear history | - |
| reset | Reset to defaults | - |
| enable | Enable auto-evaluation | - |
| disable | Disable auto-evaluation | - |
| help | Show help | - |

### Evaluation Criteria

| Criterion | Description |
|-----------|-------------|
| task_success | Task completion success |
| time_efficiency | Time taken vs expected |
| error_handling | Error recovery quality |
| skill_usage | Skill selection effectiveness |
| code_quality | Code output quality |
| learning_quality | Learning capture quality |
| capability_gap | Capability coverage |
| planning_quality | Planning and approach |

### Result Categories

| Result | Score Range |
|--------|-------------|
| excellent | ≥90 |
| good | ≥75 |
| adequate | ≥60 |
| needs_improvement | ≥40 |
| poor | <40 |
`;
}
