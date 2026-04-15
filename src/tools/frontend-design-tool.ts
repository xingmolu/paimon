/**
 * Frontend Design Tool (Claude Code Pattern)
 *
 * Tool for accessing frontend design guidance, principles, and recommendations.
 * Provides guidance for creating distinctive, production-grade frontend interfaces.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type DesignCategory,
	type DesignGuidance,
	type DesignPrinciple,
	type FrontendContext,
	type FrontendDesignConfig,
	FrontendDesignManager,
	type FrontendDesignStats,
} from "../frontend-design.js";

const manager = new FrontendDesignManager();

/**
 * Frontend design tool result.
 */
interface FrontendDesignResult {
	success: boolean;
	action: string;
	data?:
		| DesignGuidance
		| DesignPrinciple
		| DesignPrinciple[]
		| FrontendDesignConfig
		| FrontendDesignStats
		| string;
	error?: string;
}

/**
 * Format principle for display.
 */
function formatPrinciple(principle: DesignPrinciple): string {
	const lines: string[] = [];

	lines.push(`### ${principle.name}`);
	lines.push("");
	lines.push(`**Category:** ${principle.category}`);
	lines.push(`**Priority:** ${principle.priority}`);
	lines.push("");
	lines.push(`**Description:** ${principle.description}`);
	lines.push("");
	lines.push("**Examples:");
	for (const example of principle.examples) {
		lines.push(`- ${example}`);
	}
	lines.push("");
	lines.push("**Anti-patterns to avoid:");
	for (const anti of principle.antiPatterns) {
		lines.push(`- ${anti}`);
	}

	return lines.join("\n");
}

/**
 * Format guidance for display.
 */
function formatGuidance(guidance: DesignGuidance): string {
	const lines: string[] = [];

	lines.push("## Frontend Design Guidance");
	lines.push("");
	lines.push(`**Context:** ${guidance.contextType}`);
	lines.push(`**Confidence:** ${(guidance.confidence * 100).toFixed(0)}%`);
	lines.push("");

	// Principles
	lines.push("### Relevant Principles");
	for (const principle of guidance.principles) {
		lines.push(`- **${principle.name}**: ${principle.description}`);
	}
	lines.push("");

	// Recommendations
	lines.push("### Recommendations");
	for (const rec of guidance.recommendations) {
		lines.push(`- ${rec}`);
	}
	lines.push("");

	// Anti-patterns
	if (guidance.antiPatternWarnings.length > 0) {
		lines.push("### Anti-pattern Warnings");
		for (const warning of guidance.antiPatternWarnings) {
			lines.push(`- ${warning}`);
		}
	}

	return lines.join("\n");
}

/**
 * Format statistics for display.
 */
function formatStats(stats: FrontendDesignStats): string {
	const lines: string[] = [];

	lines.push("## Frontend Design Statistics");
	lines.push("");
	lines.push(`**Guidance Provided:** ${stats.guidanceProvided}`);
	lines.push(`**Principles Shown:** ${stats.principlesShown}`);
	lines.push(`**Anti-patterns Warned:** ${stats.antiPatternsWarned}`);
	lines.push(`**Sessions Enhanced:** ${stats.sessionsEnhanced}`);
	lines.push("");

	// Context distribution
	if (Object.keys(stats.contextsDetected).length > 0) {
		lines.push("### Contexts Detected");
		for (const [context, count] of Object.entries(stats.contextsDetected)) {
			lines.push(`- **${context}:** ${count}`);
		}
		lines.push("");
	}

	// Top principles
	if (stats.topPrinciples.length > 0) {
		lines.push("### Top Principles Used");
		for (const id of stats.topPrinciples) {
			lines.push(`- ${id}`);
		}
	}

	return lines.join("\n");
}

/**
 * Format config for display.
 */
function formatConfig(config: FrontendDesignConfig): string {
	return `## Frontend Design Configuration

- **Enabled:** ${config.enabled}
- **Auto-Invoke:** ${config.autoInvoke}
- **Verbose Guidance:** ${config.verboseGuidance}
- **Show Anti-patterns:** ${config.showAntiPatterns}
- **Max Principles:** ${config.maxPrinciples}
- **Preferred Style:** ${config.preferredStyle}`;
}

/**
 * Format principles list.
 */
function formatPrinciplesList(principles: DesignPrinciple[]): string {
	const lines: string[] = [];

	lines.push("## Frontend Design Principles");
	lines.push("");
	lines.push(`**Total Principles:** ${principles.length}`);
	lines.push("");

	// Group by category
	const categories: Record<DesignCategory, DesignPrinciple[]> = {
		typography: [],
		color: [],
		spacing: [],
		animation: [],
		layout: [],
		interaction: [],
		accessibility: [],
		performance: [],
	};

	for (const principle of principles) {
		categories[principle.category].push(principle);
	}

	for (const [category, categoryPrinciples] of Object.entries(categories)) {
		if (categoryPrinciples.length > 0) {
			lines.push(`### ${category}`);
			for (const p of categoryPrinciples) {
				lines.push(`- **${p.name}** (priority ${p.priority}): ${p.description}`);
			}
			lines.push("");
		}
	}

	return lines.join("\n");
}

/**
 * Create the frontendDesign tool.
 */
export const frontendDesignTool: AgentTool = {
	name: "frontendDesign",
	label: "Frontend Design Guidance",
	description: `Manage frontend design guidance for creating distinctive, production-grade interfaces (Claude Code frontend-design pattern).

Actions:
- guidance: Get design guidance for a frontend context
- principles: List all design principles
- principle: Get specific principle details
- category: Get principles by category
- context: Detect frontend context from task description
- session: Generate session start context
- config: View/update configuration
- stats: View statistics
- reset: Reset statistics
- add: Add custom principle
- remove: Remove principle
- enable: Enable guidance
- disable: Disable guidance
- help: Show help

Usage:
frontendDesign({action: 'guidance', context: 'new-component'})
frontendDesign({action: 'guidance', taskDescription: 'Create a card component'})
frontendDesign({action: 'principles'})
frontendDesign({action: 'principle', principleId: 'distinctive-typography'})
frontendDesign({action: 'category', category: 'typography'})
frontendDesign({action: 'stats'})
`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action: guidance, principles, principle, category, context, session, config, stats, reset, add, remove, enable, disable, help",
		}),
		context: Type.Optional(
			Type.String({
				description:
					"Frontend context: new-component, refactor, style-update, responsive-design, animation-work, typography-work, layout-work, general-frontend",
			}),
		),
		taskDescription: Type.Optional(
			Type.String({
				description: "Task description for context detection",
			}),
		),
		files: Type.Optional(Type.Array(Type.String())),
		principleId: Type.Optional(
			Type.String({
				description: "Principle ID for principle/remove actions",
			}),
		),
		category: Type.Optional(
			Type.String({
				description:
					"Category for category action: typography, color, spacing, animation, layout, interaction, accessibility, performance",
			}),
		),
		principle: Type.Optional(
			Type.Object({
				id: Type.String(),
				name: Type.String(),
				description: Type.String(),
				category: Type.String(),
				examples: Type.Array(Type.String()),
				antiPatterns: Type.Array(Type.String()),
				priority: Type.Number(),
			}),
		),
		enabled: Type.Optional(Type.Boolean()),
		verbose: Type.Optional(Type.Boolean()),
		showAntiPatterns: Type.Optional(Type.Boolean()),
		maxPrinciples: Type.Optional(Type.Number()),
		preferredStyle: Type.Optional(Type.String()),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<FrontendDesignResult>> => {
		const p = params as Record<string, unknown>;
		const action = p.action as string;
		const result: FrontendDesignResult = {
			success: true,
			action,
		};

		let output: string;

		try {
			switch (action) {
				case "guidance": {
					const context =
						(p.context as FrontendContext) ||
						(p.taskDescription
							? manager.detectContext(p.taskDescription as string, p.files as string[])
							: "general-frontend");

					const guidance = manager.getGuidance(
						context,
						p.taskDescription as string,
						p.files as string[],
					);

					result.data = guidance;
					output = formatGuidance(guidance);
					break;
				}

				case "principles": {
					const principles = manager.getAllPrinciples();
					result.data = principles;
					output = formatPrinciplesList(principles);
					break;
				}

				case "principle": {
					if (!p.principleId) {
						result.success = false;
						result.error = "principleId required for principle action";
						output = "Error: principleId required for principle action";
					} else {
						const principle = manager.getPrinciple(p.principleId as string);
						if (!principle) {
							result.success = false;
							result.error = `Principle '${p.principleId}' not found`;
							output = `Error: Principle '${p.principleId}' not found`;
						} else {
							result.data = principle;
							output = formatPrinciple(principle);
						}
					}
					break;
				}

				case "category": {
					if (!p.category) {
						result.success = false;
						result.error = "category required for category action";
						output = "Error: category required for category action";
					} else {
						const principles = manager.getPrinciplesByCategory(p.category as DesignCategory);
						result.data = principles;
						output = formatPrinciplesList(principles);
					}
					break;
				}

				case "context": {
					if (!p.taskDescription) {
						result.success = false;
						result.error = "taskDescription required for context detection";
						output = "Error: taskDescription required for context detection";
					} else {
						const context = manager.detectContext(p.taskDescription as string, p.files as string[]);
						result.data = context;
						output = `Detected frontend context: ${context}`;
					}
					break;
				}

				case "session": {
					const sessionContext = manager.generateSessionStartContext();
					manager.incrementSessionsEnhanced();
					result.data = sessionContext;
					output = sessionContext;
					break;
				}

				case "config": {
					// Apply updates if provided
					if (
						p.enabled !== undefined ||
						p.verbose !== undefined ||
						p.showAntiPatterns !== undefined ||
						p.maxPrinciples !== undefined ||
						p.preferredStyle !== undefined
					) {
						manager.updateConfig({
							enabled: p.enabled as boolean | undefined,
							verboseGuidance: p.verbose as boolean | undefined,
							showAntiPatterns: p.showAntiPatterns as boolean | undefined,
							maxPrinciples: p.maxPrinciples as number | undefined,
							preferredStyle: p.preferredStyle as
								| "minimal"
								| "bold"
								| "playful"
								| "professional"
								| "custom"
								| undefined,
						});
					}
					const config = manager.getConfig();
					result.data = config;
					output = formatConfig(config);
					break;
				}

				case "stats": {
					const stats = manager.getStats();
					result.data = stats;
					output = formatStats(stats);
					break;
				}

				case "reset": {
					manager.resetStats();
					result.data = "Statistics reset successfully.";
					output = "Statistics reset successfully.";
					break;
				}

				case "add": {
					if (!p.principle) {
						result.success = false;
						result.error = "principle object required for add action";
						output = "Error: principle object required for add action";
					} else {
						const principleData = p.principle as Record<string, unknown>;
						const principle: DesignPrinciple = {
							id: principleData.id as string,
							name: principleData.name as string,
							description: principleData.description as string,
							category: principleData.category as DesignCategory,
							examples: principleData.examples as string[],
							antiPatterns: principleData.antiPatterns as string[],
							priority: principleData.priority as number,
						};
						manager.addPrinciple(principle);
						result.data = `Principle '${principle.id}' added`;
						output = `Principle '${principle.id}' added successfully.`;
					}
					break;
				}

				case "remove": {
					if (!p.principleId) {
						result.success = false;
						result.error = "principleId required for remove action";
						output = "Error: principleId required for remove action";
					} else {
						const removed = manager.removePrinciple(p.principleId as string);
						result.success = removed;
						result.data = removed ? "Principle removed" : "Principle not found";
						output = removed
							? `Principle '${p.principleId}' removed successfully.`
							: `Error: Principle '${p.principleId}' not found`;
					}
					break;
				}

				case "enable": {
					manager.updateConfig({ enabled: true, autoInvoke: true });
					result.data = "Frontend design guidance enabled";
					output = "Frontend design guidance enabled.";
					break;
				}

				case "disable": {
					manager.updateConfig({ enabled: false, autoInvoke: false });
					result.data = "Frontend design guidance disabled";
					output = "Frontend design guidance disabled.";
					break;
				}

				case "help": {
					const helpText = `## Frontend Design Tool Help

Provides guidance for creating distinctive, production-grade frontend interfaces.

### Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| guidance | Get design guidance for context | context or taskDescription |
| principles | List all design principles | none |
| principle | Get specific principle details | principleId |
| category | Get principles by category | category |
| context | Detect frontend context | taskDescription |
| session | Generate session start context | none |
| config | View/update configuration | optional: enabled, verbose, etc. |
| stats | View statistics | none |
| reset | Reset statistics | none |
| add | Add custom principle | principle object |
| remove | Remove principle | principleId |
| enable | Enable guidance | none |
| disable | Disable guidance | none |
| help | Show help | none |

### Categories

- typography: Font selection, sizing, hierarchy
- color: Palette, accents, semantics
- spacing: Margins, padding, rhythm
- animation: Transitions, micro-interactions
- layout: Grid, flex, positioning
- interaction: Hover, focus, feedback
- accessibility: Contrast, focus, a11y
- performance: Optimizations, efficiency

### Example Usage

// Get guidance for new component
frontendDesign({action: 'guidance', context: 'new-component'})

// Get guidance with auto context detection
frontendDesign({action: 'guidance', taskDescription: 'Create a card component with hover animation'})

// Get typography principles
frontendDesign({action: 'category', category: 'typography'})

// Get specific principle
frontendDesign({action: 'principle', principleId: 'distinctive-typography'})

// Configure settings
frontendDesign({action: 'config', maxPrinciples: 3, preferredStyle: 'bold'})
`;
					result.data = helpText;
					output = helpText;
					break;
				}

				default:
					result.success = false;
					result.error = `Unknown action: ${action}`;
					output = `Error: Unknown action: ${action}`;
			}
		} catch (error) {
			result.success = false;
			result.error = error instanceof Error ? error.message : String(error);
			output = `Error: ${result.error}`;
		}

		return {
			content: [{ type: "text", text: output }],
			details: result,
		};
	},
};

export default frontendDesignTool;
