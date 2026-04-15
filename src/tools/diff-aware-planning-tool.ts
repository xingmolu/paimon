/**
 * Diff-Aware Planning Tool (Devin Pattern)
 *
 * Tool for analyzing git diffs for impact prediction and safer implementation planning.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { getDiffAwarePlanningManager } from "../diff-aware-planning.js";

const HELP_TEXT = `
## Diff-Aware Planning Tool (Devin Pattern)

Analyze git diffs before making changes to predict impact and reduce rework.

### Actions

- **analyze** — Analyze current git diff for impact prediction
- **predict** — Predict impact of proposed changes on files
- **plan** — Get a safe implementation plan with phases
- **check** — Check if changes are safe to apply
- **stats** — View planning statistics
- **config** — View or update configuration
- **reset** — Reset statistics and configuration
- **help** — Show this help message

### Examples

\`\`\`
// Analyze current git diff
diffAwarePlan({action: 'analyze'})

// Analyze specific files
diffAwarePlan({action: 'analyze', files: ['src/agent.ts', 'src/types.ts']})

// Predict impact of changes
diffAwarePlan({action: 'predict', files: ['src/agent.ts'], changes: ['export removal']})

// Get safe implementation plan
diffAwarePlan({action: 'plan', files: ['src/agent.ts']})

// Check if changes are safe
diffAwarePlan({action: 'check', files: ['src/agent.ts']})

// View statistics
diffAwarePlan({action: 'stats'})
\`\`\`

### Risk Levels

| Level | Score | Description |
|-------|-------|-------------|
| low | 0-24 | Minimal impact, safe to proceed |
| medium | 25-49 | Moderate impact, review recommended |
| high | 50-74 | Significant impact, careful review required |
| critical | 75+ | Major impact, manual review required |
`;

/**
 * Diff-Aware Planning Tool
 */
export const diffAwarePlanTool: AgentTool = {
	name: "diffAwarePlan",
	label: "Diff-Aware Planning",
	description:
		"Analyze git diffs for impact prediction and safer implementation planning (Devin Pattern)",
	parameters: Type.Object({
		action: Type.String({
			enum: ["analyze", "predict", "plan", "check", "stats", "config", "reset", "help"],
			description: "Action to perform",
		}),
		files: Type.Optional(Type.Array(Type.String(), { description: "Files to analyze (optional)" })),
		changes: Type.Optional(
			Type.Array(Type.String(), { description: "Proposed changes for impact prediction" }),
		),
	}),
	execute: async (_toolCallId: string, params: unknown): Promise<AgentToolResult<string>> => {
		const manager = getDiffAwarePlanningManager();
		const args = params as { action: string; files?: string[]; changes?: string[] };
		const { action, files, changes } = args;

		let output = "";

		switch (action) {
			case "analyze": {
				const analysis = manager.analyzeDiff(files);

				output = "## Diff Analysis\n\n";
				output += `**Files Changed:** ${analysis.files.length}\n`;
				output += `**Additions:** ${analysis.additions}\n`;
				output += `**Deletions:** ${analysis.deletions}\n`;
				output += `**Impact Score:** ${analysis.impactScore}/100\n`;
				output += `**Risk Level:** ${analysis.riskLevel.toUpperCase()}\n\n`;

				if (analysis.files.length > 0) {
					output += "### Changed Files\n";
					for (const file of analysis.files) {
						output += `- ${file.status}: ${file.path} (+${file.additions}/-${file.deletions})\n`;
					}
					output += "\n";
				}

				if (analysis.affectedModules.length > 0) {
					output += "### Affected Modules\n";
					for (const mod of analysis.affectedModules) {
						output += `- ${mod}\n`;
					}
					output += "\n";
				}

				if (analysis.potentialConflicts.length > 0) {
					output += "### Potential Conflicts\n";
					for (const conflict of analysis.potentialConflicts) {
						const icon = conflict.severity === "error" ? "❌" : "⚠️";
						output += `${icon} **${conflict.file}**: ${conflict.description}\n`;
						output += `   Suggestion: ${conflict.suggestion}\n`;
					}
					output += "\n";
				}

				if (analysis.recommendations.length > 0) {
					output += "### Recommendations\n";
					for (const rec of analysis.recommendations) {
						output += `- ${rec}\n`;
					}
				}
				break;
			}

			case "predict": {
				if (!files || files.length === 0) {
					output = 'Error: No files provided for impact prediction. Use the "files" parameter.';
					break;
				}
				const prediction = manager.predictImpact(files, changes || []);

				output = "## Impact Prediction\n\n";
				output += `**Estimated Effort:** ${prediction.estimatedEffort}\n\n`;

				output += `### Affected Files (${prediction.affectedFiles.length})\n`;
				for (const file of prediction.affectedFiles.slice(0, 10)) {
					output += `- ${file}\n`;
				}
				if (prediction.affectedFiles.length > 10) {
					output += `... and ${prediction.affectedFiles.length - 10} more\n`;
				}
				output += "\n";

				output += `### Affected Tests (${prediction.affectedTests.length})\n`;
				for (const test of prediction.affectedTests) {
					output += `- ${test}\n`;
				}
				output += "\n";

				if (prediction.breakingChanges.length > 0) {
					output += "### Breaking Changes\n";
					for (const change of prediction.breakingChanges) {
						output += `- ${change}\n`;
					}
					output += "\n";
				}

				output += "### Suggested Tests\n";
				for (const test of prediction.suggestedTests) {
					output += `- ${test}\n`;
				}
				break;
			}

			case "plan": {
				const plan = manager.getSafeImplementationPlan(files || []);

				output = "## Safe Implementation Plan\n\n";
				output += `**Total Risk:** ${plan.totalRisk.toUpperCase()}\n\n`;

				for (const phase of plan.phases) {
					output += `### ${phase.name}\n`;
					output += `**Files:** ${phase.files.join(", ")}\n`;
					if (phase.risks.length > 0) {
						output += `**Risks:** ${phase.risks.join("; ")}\n`;
					}
					output += "\n";
				}

				output += "### Pre-Implementation Checks\n";
				for (const check of plan.preChecks) {
					output += `- [ ] ${check}\n`;
				}
				output += "\n";

				output += "### Post-Implementation Checks\n";
				for (const check of plan.postChecks) {
					output += `- [ ] ${check}\n`;
				}
				break;
			}

			case "check": {
				const safety = manager.areChangesSafe(files || []);

				output = "## Safety Check\n\n";
				output += `**Safe to Proceed:** ${safety.safe ? "✅ Yes" : "❌ No"}\n\n`;

				if (safety.blockers.length > 0) {
					output += "### Blockers\n";
					for (const blocker of safety.blockers) {
						output += `- ❌ ${blocker}\n`;
					}
					output += "\n";
				}

				if (safety.warnings.length > 0) {
					output += "### Warnings\n";
					for (const warning of safety.warnings) {
						output += `- ⚠️ ${warning}\n`;
					}
					output += "\n";
				}

				if (safety.safe) {
					output += "✅ Changes appear safe to apply. Proceed with standard workflow.\n";
				} else {
					output += "❌ Address blockers before proceeding with changes.\n";
				}
				break;
			}

			case "stats":
				output = manager.formatStats();
				break;

			case "config": {
				const config = manager.getConfig();
				output = "## Diff-Aware Planning Configuration\n\n";
				output += `**Enabled:** ${config.enabled}\n`;
				output += `**Auto-Analyze Before Edit:** ${config.autoAnalyzeBeforeEdit}\n`;
				output += `**Max Files to Analyze:** ${config.maxFilesToAnalyze}\n`;
				output += `**Risk Threshold:** ${config.riskThreshold}`;
				break;
			}

			case "reset":
				manager.reset();
				output = "Diff-aware planning statistics and configuration reset.";
				break;
			default:
				output = HELP_TEXT;
				break;
		}

		return {
			content: [{ type: "text", text: output }],
			details: output,
		};
	},
};

export default diffAwarePlanTool;
