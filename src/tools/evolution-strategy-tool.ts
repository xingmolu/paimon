/**
 * Evolution Strategy Tool - Tool interface for Evolution Strategy Planner
 *
 * This tool provides access to the Evolution Strategy Planner for
 * analyzing current state and recommending optimal evolution strategies.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { getEvolutionStrategyPlanner } from "../evolution-strategy.js";

// ============================================================================
// Tool Definition
// ============================================================================

export const evolutionStrategyTool: AgentTool = {
	name: "evolutionStrategy",
	label: "Evolution Strategy Planner",
	description: `Manage evolution strategy planning for optimal self-evolution decisions.

This meta-capability analyzes current state, metrics, and capability gaps to recommend
the best evolution strategies. Use this before task selection to make smarter decisions
about what to work on next.

Actions:
- analyze: Analyze current evolution state and get recommendations (no params required)
- recommend: Get top strategy recommendations with rationale and expected benefits
- enablers: Get capability enablers - which capabilities enable others
- guidance: Get strategic guidance for a specific task (requires taskDescription, taskType)
- state: Get current evolution state snapshot
- direction: Get current strategic direction
- config: View or update configuration
- clear-cache: Clear state cache for fresh analysis
- stats: View strategy statistics
- help: Show help message

Strategy Types:
- fill-gaps: Fill identified capability gaps
- improve-reliability: Address error patterns and improve success rate
- add-new-capability: Add new capabilities to expand coverage
- optimize-existing: Optimize underutilized tools
- integration-improvement: Improve cross-capability integrations
- research-competitors: Research competitor patterns
- memory-enhancement: Enhance learning and memory systems
- tool-chain-improvement: Improve tool chain reliability

Example usage:
evolutionStrategy({action: 'analyze'})
evolutionStrategy({action: 'recommend'})
evolutionStrategy({action: 'enablers'})
evolutionStrategy({action: 'guidance', taskDescription: 'Add new capability', taskType: 'capability'})
evolutionStrategy({action: 'state'})
evolutionStrategy({action: 'config'})`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: analyze, recommend, enablers, guidance, state, direction, config, clear-cache, stats, help",
		}),
		taskDescription: Type.Optional(
			Type.String({
				description: "Task description for guidance action",
			}),
		),
		taskType: Type.Optional(
			Type.String({
				description: "Task type for guidance action: capability, reliability, or feature",
			}),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const planner = getEvolutionStrategyPlanner();
		const { action, taskDescription, taskType } = params as {
			action: string;
			taskDescription?: string;
			taskType?: string;
		};

		const executeAction = async (): Promise<string> => {
			switch (action) {
				case "analyze": {
					const result = await planner.recommendNextStrategy();
					return formatAnalysisResult(result);
				}

				case "recommend": {
					const result = await planner.recommendNextStrategy();
					return formatRecommendations(result.recommendations);
				}

				case "enablers": {
					const enablers = await planner.predictCapabilityEnablers();
					return formatEnablers(enablers);
				}

				case "guidance": {
					if (!taskDescription || !taskType) {
						return "Error: taskDescription and taskType are required for guidance action";
					}

					const guidance = await planner.getStrategicGuidance(taskDescription, taskType);
					return formatGuidance(guidance);
				}

				case "state": {
					const state = await planner.analyzeCurrentState();
					return formatState(state);
				}

				case "direction": {
					const result = await planner.recommendNextStrategy();
					return `## Strategic Direction: ${result.strategicDirection.toUpperCase()}\n\n${result.nextPhaseSuggestion}`;
				}

				case "config": {
					const config = planner.getConfig();
					return formatConfig({ ...config } as Record<string, unknown>);
				}

				case "clear-cache": {
					planner.clearCache();
					return "State cache cleared successfully";
				}

				case "stats": {
					const state = await planner.analyzeCurrentState();
					const result = await planner.recommendNextStrategy();
					return formatStats(state, result);
				}

				case "help": {
					return getHelpMessage();
				}

				default:
					return `Unknown action: ${action}. Use 'help' for available actions.`;
			}
		};

		try {
			const text = await executeAction();
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

// ============================================================================
// Formatting Helpers
// ============================================================================

function formatAnalysisResult(
	result: ReturnType<typeof planner.recommendNextStrategy> extends Promise<infer T> ? T : never,
): string {
	const analysis = result as {
		state: {
			capabilitiesImplemented: number;
			capabilitiesTotal: number;
			coveragePercentage: number;
			recentSuccessRate: number;
			averageIterationTime: number;
			capabilityVelocity: number;
		};
		recommendations: unknown[];
		enablers: unknown[];
		strategicDirection: string;
		nextPhaseSuggestion: string;
	};

	let output = "## Evolution Strategy Analysis\n\n";

	// Strategic Direction
	output += `### Strategic Direction: ${analysis.strategicDirection.toUpperCase()}\n\n`;
	output += `${analysis.nextPhaseSuggestion}\n\n`;

	// State Summary
	output += "### Current State\n";
	output += `- **Capabilities:** ${analysis.state.capabilitiesImplemented}/${analysis.state.capabilitiesTotal} (${analysis.state.coveragePercentage}%)\n`;
	output += `- **Success Rate:** ${(analysis.state.recentSuccessRate * 100).toFixed(1)}%\n`;
	output += `- **Average Time:** ${analysis.state.averageIterationTime} minutes\n`;
	output += `- **Velocity:** ${analysis.state.capabilityVelocity} capabilities/day\n\n`;

	// Top Recommendations
	output += "### Top Recommendations\n\n";
	for (let i = 0; i < Math.min(3, analysis.recommendations.length); i++) {
		const rec = analysis.recommendations[i] as {
			strategyType: string;
			priority: number;
			confidence: number;
			description: string;
		};
		output += `${i + 1}. **${rec.strategyType}** (Priority: ${rec.priority}, Confidence: ${(rec.confidence * 100).toFixed(0)}%)\n`;
		output += `   ${rec.description}\n\n`;
	}

	// Top Enablers
	output += "### Top Capability Enablers\n";
	const topEnablers = (
		analysis.enablers as Array<{ capabilityName: string; enablesCount: number; priority: number }>
	).slice(0, 5);
	for (const enabler of topEnablers) {
		output += `- **${enabler.capabilityName}**: Enables ${enabler.enablesCount} capabilities (Priority: ${enabler.priority})\n`;
	}

	return output;
}

function formatRecommendations(recommendations: unknown[]): string {
	let output = "## Strategy Recommendations\n\n";

	for (let i = 0; i < recommendations.length; i++) {
		const rec = recommendations[i] as {
			strategyType: string;
			priority: number;
			confidence: number;
			description: string;
			rationale: string[];
			expectedBenefit: string;
			riskFactors: string[];
			enablerCapabilities: string[];
		};
		output += `### ${i + 1}. ${rec.strategyType.toUpperCase().replace(/-/g, " ")}\n`;
		output += `**Priority:** ${rec.priority} | **Confidence:** ${(rec.confidence * 100).toFixed(0)}%\n\n`;
		output += `${rec.description}\n\n`;

		output += "**Rationale:**\n";
		for (const reason of rec.rationale) {
			output += `- ${reason}\n`;
		}
		output += "\n";

		output += `**Expected Benefit:** ${rec.expectedBenefit}\n\n`;

		if (rec.riskFactors.length > 0) {
			output += "**Risk Factors:**\n";
			for (const risk of rec.riskFactors) {
				output += `- ${risk}\n`;
			}
			output += "\n";
		}

		if (rec.enablerCapabilities.length > 0) {
			output += `**Related Capabilities:** ${rec.enablerCapabilities.join(", ")}\n\n`;
		}

		output += "---\n\n";
	}

	return output;
}

function formatEnablers(enablers: unknown[]): string {
	let output = "## Capability Enablers\n\n";
	output +=
		"These capabilities enable other capabilities. Implementing them creates multiplier effects.\n\n";

	output += "| Capability | Enables | Enabled By | Priority |\n";
	output += "|------------|---------|------------|----------|\n";

	for (const enabler of enablers as Array<{
		capabilityName: string;
		enablesCount: number;
		enabledBy: string[];
		priority: number;
	}>) {
		output += `| ${enabler.capabilityName} | ${enabler.enablesCount} | ${enabler.enabledBy.length} | ${enabler.priority} |\n`;
	}

	output += "\n### Top Enablers (Most Impactful)\n";
	const topEnablers = (
		enablers as Array<{
			capabilityName: string;
			enablesCount: number;
			enabledBy: string[];
			priority: number;
		}>
	)
		.filter((e) => e.enablesCount > 0)
		.slice(0, 5);

	for (const enabler of topEnablers) {
		output += `- **${enabler.capabilityName}**: Enables ${enabler.enablesCount} other capabilities\n`;
	}

	return output;
}

function formatGuidance(guidance: {
	recommendation: unknown | null;
	riskLevel: string;
	enablersToConsider: string[];
	patternsToApply: string[];
}): string {
	let output = "## Strategic Guidance\n\n";

	if (guidance.recommendation) {
		const rec = guidance.recommendation as {
			strategyType: string;
			description: string;
			confidence: number;
		};
		output += `### Aligns with Strategy: ${rec.strategyType.toUpperCase().replace(/-/g, " ")}\n`;
		output += `${rec.description}\n`;
		output += `**Confidence:** ${(rec.confidence * 100).toFixed(0)}%\n\n`;
	} else {
		output += "### No Direct Strategy Alignment\n";
		output += "This task does not directly align with current strategy recommendations.\n\n";
	}

	output += `### Risk Level: ${guidance.riskLevel.toUpperCase()}\n\n`;

	if (guidance.enablersToConsider.length > 0) {
		output += `### Enablers to Consider: ${guidance.enablersToConsider.join(", ")}\n\n`;
	}

	if (guidance.patternsToApply.length > 0) {
		output += `### Patterns to Apply: ${guidance.patternsToApply.join(", ")}\n`;
	}

	return output;
}

function formatState(
	state: ReturnType<typeof planner.analyzeCurrentState> extends Promise<infer T> ? T : never,
): string {
	const s = state as {
		capabilitiesImplemented: number;
		capabilitiesTotal: number;
		coveragePercentage: number;
		recentSuccessRate: number;
		averageIterationTime: number;
		topErrors: string[];
		underutilizedTools: string[];
		highFailureTools: string[];
		skillSuccessRates: Record<string, number>;
		daysSinceStart: number;
		capabilityVelocity: number;
	};

	let output = "## Current Evolution State\n\n";

	output += "### Capability Metrics\n";
	output += `- **Implemented:** ${s.capabilitiesImplemented}\n`;
	output += `- **Target:** ${s.capabilitiesTotal}\n`;
	output += `- **Coverage:** ${s.coveragePercentage}%\n\n`;

	output += "### Performance Metrics\n";
	output += `- **Success Rate:** ${(s.recentSuccessRate * 100).toFixed(1)}%\n`;
	output += `- **Avg Iteration Time:** ${s.averageIterationTime} minutes\n`;
	output += `- **Velocity:** ${s.capabilityVelocity} capabilities/day\n\n`;

	output += "### Evolution Timeline\n";
	output += `- **Days Since Start:** ${s.daysSinceStart}\n\n`;

	if (s.topErrors.length > 0) {
		output += "### Top Error Patterns\n";
		for (const error of s.topErrors.slice(0, 5)) {
			output += `- ${error}\n`;
		}
		output += "\n";
	}

	if (s.underutilizedTools.length > 0) {
		output += `### Underutilized Tools: ${s.underutilizedTools.join(", ")}\n\n`;
	}

	if (s.highFailureTools.length > 0) {
		output += `### High Failure Tools: ${s.highFailureTools.join(", ")}\n`;
	}

	return output;
}

function formatConfig(config: Record<string, unknown>): string {
	let output = "## Evolution Strategy Configuration\n\n";

	output += "| Setting | Value |\n";
	output += "|---------|-------|\n";

	for (const [key, value] of Object.entries(config)) {
		output += `| ${key} | ${JSON.stringify(value)} |\n`;
	}

	return output;
}

function formatStats(
	state: ReturnType<typeof planner.analyzeCurrentState> extends Promise<infer T> ? T : never,
	result: ReturnType<typeof planner.recommendNextStrategy> extends Promise<infer T> ? T : never,
): string {
	const s = state as {
		capabilitiesImplemented: number;
		capabilitiesTotal: number;
		coveragePercentage: number;
		recentSuccessRate: number;
		capabilityVelocity: number;
	};
	const r = result as { recommendations: unknown[]; strategicDirection: string };

	let output = "## Evolution Strategy Statistics\n\n";

	output += "### Key Metrics\n";
	output += `- **Coverage:** ${s.coveragePercentage}%\n`;
	output += `- **Success Rate:** ${(s.recentSuccessRate * 100).toFixed(1)}%\n`;
	output += `- **Velocity:** ${s.capabilityVelocity} caps/day\n`;
	output += `- **Strategy Recommendations:** ${r.recommendations.length}\n`;
	output += `- **Direction:** ${r.strategicDirection}\n`;

	return output;
}

function getHelpMessage(): string {
	return `## Evolution Strategy Tool Help

This meta-capability helps you make optimal evolution decisions by analyzing
current state, metrics, and capability gaps.

### Actions

| Action | Description |
|--------|-------------|
| analyze | Full analysis with state, recommendations, and enablers |
| recommend | Get top strategy recommendations |
| enablers | Get capability enablers (which enable others) |
| guidance | Get strategic guidance for a specific task |
| state | Get current evolution state snapshot |
| direction | Get current strategic direction |
| config | View or update configuration |
| clear-cache | Clear state cache for fresh analysis |
| stats | View strategy statistics |
| help | Show this help message |

### Strategy Types

1. **fill-gaps** - Fill identified capability gaps (Priority: 90)
2. **add-new-capability** - Add new capabilities (Priority: 80)
3. **integration-improvement** - Improve integrations (Priority: 75)
4. **improve-reliability** - Address error patterns (Priority: 70)
5. **memory-enhancement** - Enhance memory systems (Priority: 65)
6. **optimize-existing** - Optimize underutilized tools (Priority: 60)
7. **tool-chain-improvement** - Improve tool chain (Priority: 55)
8. **research-competitors** - Research competitor patterns (Priority: 50)

### Example Usage

\`\`\`typescript
// Full analysis
evolutionStrategy({action: 'analyze'})

// Get recommendations only
evolutionStrategy({action: 'recommend'})

// Get guidance for a specific task
evolutionStrategy({
  action: 'guidance',
  taskDescription: 'Add new capability for X',
  taskType: 'capability'
})

// Get capability enablers
evolutionStrategy({action: 'enablers'})
\`\`\`

### Strategic Directions

- **expand** - Focus on adding new capabilities
- **stabilize** - Focus on reliability and error reduction
- **integrate** - Focus on cross-capability integrations
- **optimize** - Focus on optimizing existing capabilities
- **evolve** - Balanced approach to evolution
- **maintain** - Maintain current capabilities
`;
}

// Import for typing
declare const planner: ReturnType<typeof getEvolutionStrategyPlanner>;
