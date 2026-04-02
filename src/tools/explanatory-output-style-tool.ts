/**
 * Explanatory Output Style tool - Educational context injection at session start
 *
 * Inspired by Claude Code's explanatory-output-style pattern:
 * - Injects educational insights about implementation choices
 * - Provides context about codebase patterns
 * - Reduces rework by improving understanding
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { getExplanatoryOutputStyleManager } from "../explanatory-output-style.js";
import type { InsightCategory } from "../explanatory-output-style.js";

/**
 * Explanatory Output Style tool - Manage educational context injection
 */
export const explanatoryOutputStyleTool: AgentTool = {
	name: "explanatoryOutputStyle",
	label: "Explanatory Output Style",
	description: `Manage educational context injection at session start. Provides insights about implementation choices and codebase patterns (Claude Code explanatory-output-style pattern).

Actions:
- context: Generate educational context for current session
- insights: List all available educational insights
- insight: Get details of a specific insight by title
- category: Get insights by category (architecture, patterns, evolution, tools, skills, memory, safety)
- add: Add a custom educational insight
- config: View or update configuration
- stats: View statistics
- enable: Enable educational context injection
- disable: Disable educational context injection
- reset: Reset to defaults
- clear: Clear statistics

Example usage:
explanatoryOutputStyle({action: 'insights'})
explanatoryOutputStyle({action: 'insight', title: 'Evolution Value Scoring'})
explanatoryOutputStyle({action: 'context', sessionMode: 'evolve'})
`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action: context, insights, insight, category, add, config, stats, enable, disable, reset, clear",
		}),
		title: Type.Optional(Type.String({ description: "Insight title for insight action" })),
		category: Type.Optional(
			Type.String({
				description:
					"Category for category action: architecture, patterns, evolution, tools, skills, memory, safety",
			}),
		),
		description: Type.Optional(Type.String({ description: "Description for add action" })),
		pattern: Type.Optional(Type.String({ description: "Pattern for add action" })),
		reason: Type.Optional(Type.String({ description: "Reason for add action" })),
		alternatives: Type.Optional(
			Type.Array(Type.String(), { description: "Alternatives for add action" }),
		),
		priority: Type.Optional(Type.Number({ description: "Priority for add action" })),
		maxInsights: Type.Optional(Type.Number({ description: "Max insights to show" })),
		verbosity: Type.Optional(Type.String({ description: "Verbosity: brief, normal, detailed" })),
		includePatterns: Type.Optional(Type.Boolean({ description: "Include patterns in context" })),
		includeReasons: Type.Optional(Type.Boolean({ description: "Include reasons in context" })),
		includeAlternatives: Type.Optional(
			Type.Boolean({ description: "Include alternatives in context" }),
		),
		sessionMode: Type.Optional(Type.String({ description: "Session mode for context action" })),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
		const manager = getExplanatoryOutputStyleManager();
		const args = params as {
			action: string;
			title?: string;
			category?: string;
			description?: string;
			pattern?: string;
			reason?: string;
			alternatives?: string[];
			priority?: number;
			maxInsights?: number;
			verbosity?: string;
			includePatterns?: boolean;
			includeReasons?: boolean;
			includeAlternatives?: boolean;
			sessionMode?: string;
		};

		try {
			switch (args.action) {
				case "context":
					return handleContext(manager, args.sessionMode);

				case "insights":
					return handleInsights(manager);

				case "insight":
					return handleInsight(manager, args.title);

				case "category":
					return handleCategory(manager, args.category as InsightCategory);

				case "add":
					return handleAdd(manager, args);

				case "config":
					return handleConfig(manager, args);

				case "stats":
					return handleStats(manager);

				case "enable":
					return handleEnable(manager);

				case "disable":
					return handleDisable(manager);

				case "reset":
					return handleReset(manager);

				case "clear":
					return handleClear(manager);

				default:
					return {
						content: [
							{
								type: "text",
								text: `Unknown action: ${args.action}. Valid actions: context, insights, insight, category, add, config, stats, enable, disable, reset, clear`,
							},
						],
						details: `Unknown action: ${args.action}`,
					};
			}
		} catch (e) {
			const error = e instanceof Error ? e.message : String(e);
			return {
				content: [{ type: "text", text: `Error: ${error}` }],
				details: `Error: ${error}`,
			};
		}
	},
};

/**
 * Handle context action
 */
function handleContext(
	manager: ReturnType<typeof getExplanatoryOutputStyleManager>,
	sessionMode?: string,
): AgentToolResult<string> {
	const context = manager.generateEducationalContext(sessionMode);
	if (!context) {
		return {
			content: [
				{
					type: "text",
					text: "Explanatory output style is disabled. Enable with explanatoryOutputStyle({action: 'enable'})",
				},
			],
			details: "Disabled",
		};
	}
	return {
		content: [{ type: "text", text: context }],
		details: `Generated context (${context.length} chars)`,
	};
}

/**
 * Handle insights action
 */
function handleInsights(
	manager: ReturnType<typeof getExplanatoryOutputStyleManager>,
): AgentToolResult<string> {
	const config = manager.getConfig();
	const categories: InsightCategory[] = [
		"architecture",
		"patterns",
		"evolution",
		"tools",
		"skills",
		"memory",
		"safety",
	];

	let output = "📚 **Educational Insights Library**\n\n";

	let total = 0;
	for (const cat of categories) {
		const insights = manager.getInsightsByCategory(cat);
		total += insights.length;
	}

	output += `Total: ${total} insights across ${categories.length} categories\n\n`;

	for (const cat of categories) {
		const insights = manager.getInsightsByCategory(cat);
		if (insights.length > 0) {
			output += `**${cat.toUpperCase()}** (${insights.length})\n`;
			for (const insight of insights.slice(0, 3)) {
				output += `  - ${insight.title} (priority: ${insight.priority})\n`;
			}
			if (insights.length > 3) {
				output += `  ... and ${insights.length - 3} more\n`;
			}
			output += "\n";
		}
	}

	output += "Use `explanatoryOutputStyle({action: 'insight', title: '...'})` for details.";

	return {
		content: [{ type: "text", text: output }],
		details: `${total} insights`,
	};
}

/**
 * Handle insight action
 */
function handleInsight(
	manager: ReturnType<typeof getExplanatoryOutputStyleManager>,
	title?: string,
): AgentToolResult<string> {
	if (!title) {
		return {
			content: [
				{
					type: "text",
					text: "Error: title is required for insight action. Use explanatoryOutputStyle({action: 'insight', title: '...'})",
				},
			],
			details: "Error: title required",
		};
	}

	const insight = manager.getInsight(title);
	if (!insight) {
		return {
			content: [
				{
					type: "text",
					text: `Insight '${title}' not found. Use explanatoryOutputStyle({action: 'insights'}) to list all.`,
				},
			],
			details: `Not found: ${title}`,
		};
	}

	let output = `📚 **${insight.title}** (${insight.category})\n\n`;
	output += `${insight.description}\n\n`;
	if (insight.pattern) output += `**Pattern:** ${insight.pattern}\n\n`;
	if (insight.reason) output += `**Reason:** ${insight.reason}\n\n`;
	if (insight.alternatives?.length) {
		output += "**Alternatives:**\n";
		for (const alt of insight.alternatives) {
			output += `- ${alt}\n`;
		}
		output += "\n";
	}
	output += `**Priority:** ${insight.priority}\n`;

	return {
		content: [{ type: "text", text: output }],
		details: `Insight: ${title}`,
	};
}

/**
 * Handle category action
 */
function handleCategory(
	manager: ReturnType<typeof getExplanatoryOutputStyleManager>,
	category?: InsightCategory,
): AgentToolResult<string> {
	if (!category) {
		return {
			content: [
				{
					type: "text",
					text: "Error: category is required. Use one of: architecture, patterns, evolution, tools, skills, memory, safety",
				},
			],
			details: "Error: category required",
		};
	}

	const insights = manager.getInsightsByCategory(category);
	if (insights.length === 0) {
		return {
			content: [{ type: "text", text: `No insights in category '${category}'` }],
			details: `No insights: ${category}`,
		};
	}

	let output = `📚 **${category.toUpperCase()} Insights**\n\n`;
	output += `${insights.length} insights in this category\n\n`;

	for (const insight of insights) {
		output += `**${insight.title}** (priority: ${insight.priority})\n`;
		output += `${insight.description}\n`;
		if (insight.pattern) output += `- Pattern: ${insight.pattern}\n`;
		output += "\n";
	}

	return {
		content: [{ type: "text", text: output }],
		details: `${insights.length} insights in ${category}`,
	};
}

/**
 * Handle add action
 */
function handleAdd(
	manager: ReturnType<typeof getExplanatoryOutputStyleManager>,
	args: {
		title?: string;
		description?: string;
		category?: string;
		pattern?: string;
		reason?: string;
		alternatives?: string[];
		priority?: number;
	},
): AgentToolResult<string> {
	if (!args.title || !args.description || !args.category) {
		return {
			content: [
				{
					type: "text",
					text: "Error: title, description, and category are required for add action.",
				},
			],
			details: "Error: missing parameters",
		};
	}

	manager.addInsight({
		category: args.category as InsightCategory,
		title: args.title,
		description: args.description,
		pattern: args.pattern,
		reason: args.reason,
		alternatives: args.alternatives,
		priority: args.priority || 5,
	});

	return {
		content: [
			{
				type: "text",
				text: `✅ Added insight '${args.title}' to category '${args.category}'`,
			},
		],
		details: `Added: ${args.title}`,
	};
}

/**
 * Handle config action
 */
function handleConfig(
	manager: ReturnType<typeof getExplanatoryOutputStyleManager>,
	args: {
		maxInsights?: number;
		verbosity?: string;
		includePatterns?: boolean;
		includeReasons?: boolean;
		includeAlternatives?: boolean;
	},
): AgentToolResult<string> {
	// Update config if parameters provided
	if (args.maxInsights !== undefined) manager.setConfig({ maxInsights: args.maxInsights });
	if (args.verbosity !== undefined)
		manager.setConfig({ verbosity: args.verbosity as "brief" | "normal" | "detailed" });
	if (args.includePatterns !== undefined)
		manager.setConfig({ includePatterns: args.includePatterns });
	if (args.includeReasons !== undefined) manager.setConfig({ includeReasons: args.includeReasons });
	if (args.includeAlternatives !== undefined)
		manager.setConfig({ includeAlternatives: args.includeAlternatives });

	const config = manager.getConfig();

	let output = "⚙️ **Explanatory Output Style Configuration**\n\n";
	output += `Enabled: ${config.enabled ? "✅" : "❌"}\n`;
	output += `Max Insights: ${config.maxInsights}\n`;
	output += `Verbosity: ${config.verbosity}\n`;
	output += `Categories: ${config.categories.join(", ")}\n`;
	output += `Include Patterns: ${config.includePatterns ? "✅" : "❌"}\n`;
	output += `Include Reasons: ${config.includeReasons ? "✅" : "❌"}\n`;
	output += `Include Alternatives: ${config.includeAlternatives ? "✅" : "❌"}\n`;

	return {
		content: [{ type: "text", text: output }],
		details: `Config: enabled=${config.enabled}`,
	};
}

/**
 * Handle stats action
 */
function handleStats(
	manager: ReturnType<typeof getExplanatoryOutputStyleManager>,
): AgentToolResult<string> {
	const stats = manager.getStats();

	let output = "📊 **Explanatory Output Style Statistics**\n\n";
	output += `Sessions Enhanced: ${stats.sessionsEnhanced}\n`;
	output += `Insights Shown: ${stats.insightsShown}\n`;
	output += `Average Insights per Session: ${
		stats.sessionsEnhanced > 0 ? Math.round(stats.insightsShown / stats.sessionsEnhanced) : 0
	}\n\n`;

	output += "**Insights by Category:**\n";
	for (const [cat, count] of Object.entries(stats.insightsByCategory)) {
		output += `- ${cat}: ${count}\n`;
	}

	if (stats.topInsights.length > 0) {
		output += "\n**Top Insights Shown:**\n";
		for (const { insight, count } of stats.topInsights.slice(0, 5)) {
			output += `- ${insight}: ${count} times\n`;
		}
	}

	return {
		content: [{ type: "text", text: output }],
		details: `${stats.sessionsEnhanced} sessions enhanced`,
	};
}

/**
 * Handle enable action
 */
function handleEnable(
	manager: ReturnType<typeof getExplanatoryOutputStyleManager>,
): AgentToolResult<string> {
	manager.setEnabled(true);
	return {
		content: [
			{
				type: "text",
				text: "✅ Explanatory output style enabled. Educational context will be injected at session start.",
			},
		],
		details: "Enabled",
	};
}

/**
 * Handle disable action
 */
function handleDisable(
	manager: ReturnType<typeof getExplanatoryOutputStyleManager>,
): AgentToolResult<string> {
	manager.setEnabled(false);
	return {
		content: [
			{
				type: "text",
				text: "❌ Explanatory output style disabled. No educational context will be injected.",
			},
		],
		details: "Disabled",
	};
}

/**
 * Handle reset action
 */
function handleReset(
	manager: ReturnType<typeof getExplanatoryOutputStyleManager>,
): AgentToolResult<string> {
	manager.reset();
	return {
		content: [
			{
				type: "text",
				text: "🔄 Explanatory output style reset to defaults. All custom insights removed, default insights restored.",
			},
		],
		details: "Reset complete",
	};
}

/**
 * Handle clear action
 */
function handleClear(
	manager: ReturnType<typeof getExplanatoryOutputStyleManager>,
): AgentToolResult<string> {
	manager.clearStats();
	return {
		content: [
			{
				type: "text",
				text: "🧹 Statistics cleared. Session and insight counts reset to 0.",
			},
		],
		details: "Stats cleared",
	};
}
