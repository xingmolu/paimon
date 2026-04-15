/**
 * Learning Output Style tool - Interactive learning mode for decision point detection
 *
 * Inspired by Claude Code's learning-output-style pattern:
 * - Requests meaningful code contributions at decision points
 * - Identifies where user input matters vs. auto-implementable code
 * - Educational insights about implementation choices
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { getLearningManager } from "../learning-output-style.js";
import type {
	DecisionPoint,
	LearningInsight,
	LearningOutputStyleConfig,
	SessionContext,
} from "../learning-output-style.js";

/**
 * Learning Output Style tool - Manage interactive learning mode
 */
export const learningOutputStyleTool: AgentTool = {
	name: "learningOutputStyle",
	label: "Learning Output Style",
	description: `Manage interactive learning mode that requests meaningful code contributions at decision points (Claude Code learning-output-style pattern).

Actions:
- context: Generate educational context for current session
- detect: Detect decision points in task description
- insights: List all learning insights
- insight: Get details of a specific insight by title
- category: Get insights by category (architecture, patterns, evolution, tools, skills, memory, safety)
- add: Add a custom learning insight
- config: View or update configuration
- stats: View statistics
- enable: Enable interactive learning mode
- disable: Disable interactive learning mode
- reset: Reset statistics
- clear: Clear custom insights
- record: Record contribution or auto-implementation

Example usage:
learningOutputStyle({action: 'detect', taskDescription: 'Implement business logic for...'})
learningOutputStyle({action: 'insights'})
learningOutputStyle({action: 'insight', title: 'Decision Points'})
learningOutputStyle({action: 'context', sessionMode: 'evolve'})
`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action: context, detect, insights, insight, category, add, config, stats, enable, disable, reset, clear, record",
		}),
		sessionMode: Type.Optional(
			Type.String({ description: "Session mode for context action: evolve, chat, feature, debug" }),
		),
		verbosity: Type.Optional(Type.String({ description: "Verbosity: brief, normal, detailed" })),
		maxInsights: Type.Optional(Type.Number({ description: "Max insights to show" })),
		title: Type.Optional(Type.String({ description: "Insight title for insight action" })),
		category: Type.Optional(
			Type.String({
				description:
					"Category for category action: architecture, patterns, evolution, tools, skills, memory, safety",
			}),
		),
		insightId: Type.Optional(Type.String({ description: "Insight ID for add action" })),
		description: Type.Optional(Type.String({ description: "Description for add action" })),
		pattern: Type.Optional(Type.String({ description: "Pattern for add action" })),
		reason: Type.Optional(Type.String({ description: "Reason for add action" })),
		alternatives: Type.Optional(
			Type.Array(Type.String(), { description: "Alternatives for add action" }),
		),
		priority: Type.Optional(Type.Number({ description: "Priority for add action (1-10)" })),
		taskDescription: Type.Optional(
			Type.String({ description: "Task description for detect action" }),
		),
		files: Type.Optional(Type.Array(Type.String(), { description: "Files for detect action" })),
		pointId: Type.Optional(Type.String({ description: "Decision point ID for record action" })),
		contributed: Type.Optional(
			Type.Boolean({ description: "Whether contribution was provided for record action" }),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
		const manager = getLearningManager();
		const args = params as {
			action: string;
			sessionMode?: "evolve" | "chat" | "feature" | "debug";
			verbosity?: "brief" | "normal" | "detailed";
			maxInsights?: number;
			title?: string;
			category?: string;
			insightId?: string;
			description?: string;
			pattern?: string;
			reason?: string;
			alternatives?: string[];
			priority?: number;
			taskDescription?: string;
			files?: string[];
			pointId?: string;
			contributed?: boolean;
		};

		try {
			switch (args.action) {
				case "context":
					return handleContext(manager, args);

				case "detect":
					return handleDetect(manager, args);

				case "insights":
					return handleInsights(manager, args);

				case "insight":
					return handleInsight(manager, args);

				case "category":
					return handleCategory(manager, args);

				case "add":
					return handleAdd(manager, args);

				case "config":
					return handleConfig(manager, args);

				case "stats":
					return handleStats(manager);

				case "enable":
					manager.enable();
					return {
						content: [
							{
								type: "text",
								text: "✅ Learning output style enabled. Sessions will include interactive learning mode for requesting meaningful code contributions at decision points.",
							},
						],
						details: "Enabled",
					};

				case "disable":
					manager.disable();
					return {
						content: [
							{
								type: "text",
								text: "❌ Learning output style disabled. Sessions will not include interactive learning mode.",
							},
						],
						details: "Disabled",
					};

				case "reset":
					manager.resetStats();
					return {
						content: [
							{
								type: "text",
								text: "🔄 Learning output style statistics reset. All counters reset to 0.",
							},
						],
						details: "Stats reset",
					};

				case "clear":
					return handleClear(manager);

				case "record":
					return handleRecord(manager, args);

				default:
					return {
						content: [
							{
								type: "text",
								text: `Unknown action: ${args.action}. Valid actions: context, detect, insights, insight, category, add, config, stats, enable, disable, reset, clear, record`,
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
 * Handle context action - generate educational context for session
 */
function handleContext(
	manager: ReturnType<typeof getLearningManager>,
	args: {
		sessionMode?: "evolve" | "chat" | "feature" | "debug";
	},
): AgentToolResult<string> {
	const context: SessionContext = {
		mode: args.sessionMode || "evolve",
		filesChanged: [],
		skillsUsed: [],
	};

	const educationalContext = manager.generateEducationalContext(context);

	if (!educationalContext) {
		return {
			content: [
				{
					type: "text",
					text: "Learning output style is disabled. Enable with learningOutputStyle({action: 'enable'})",
				},
			],
			details: "Disabled",
		};
	}

	return {
		content: [{ type: "text", text: educationalContext }],
		details: `Generated context (${educationalContext.length} chars)`,
	};
}

/**
 * Handle detect action - detect decision points
 */
function handleDetect(
	manager: ReturnType<typeof getLearningManager>,
	args: {
		taskDescription?: string;
		files?: string[];
	},
): AgentToolResult<string> {
	if (!args.taskDescription) {
		return {
			content: [
				{
					type: "text",
					text: "Error: taskDescription is required for detect action.\n\nUsage: learningOutputStyle({action: 'detect', taskDescription: '...'})",
				},
			],
			details: "Error: taskDescription required",
		};
	}

	const points = manager.detectDecisionPoints(args.taskDescription, args.files);

	if (points.length === 0) {
		return {
			content: [
				{
					type: "text",
					text: "✅ No decision points detected. This task can be implemented directly without user contribution.",
				},
			],
			details: "No decision points",
		};
	}

	let output = `🎯 **Decision Points Detected (${points.length})**\n\n`;
	output +=
		"At these decision points, consider requesting user contribution (5-10 lines of meaningful code).\n\n";

	for (const point of points.slice(0, 5)) {
		output += `**${point.category.toUpperCase()}** (priority: ${point.priority})\n`;
		output += `${point.description}\n`;
		output += `Trade-offs: ${point.tradeoffs.slice(0, 3).join(", ")}\n`;
		output += `Estimated lines: ${point.estimatedLines}\n`;
		output += `Auto-implementable: ${point.autoImplementable ? "Yes" : "No - request contribution"}\n\n`;
		manager.recordDecisionPointRequested(point);
	}

	if (points.length > 5) {
		output += `... and ${points.length - 5} more decision points.\n`;
	}

	output +=
		"\n**Recommendation:** Request user contribution for highest priority non-auto-implementable decision points.";

	return {
		content: [{ type: "text", text: output }],
		details: `${points.length} decision points detected`,
	};
}

/**
 * Handle insights action - list all insights
 */
function handleInsights(
	manager: ReturnType<typeof getLearningManager>,
	args: {
		maxInsights?: number;
	},
): AgentToolResult<string> {
	const insights = manager.getInsights();
	const max = args.maxInsights || insights.length;

	let output = "📚 **Learning Insights Library**\n\n";
	output += `Total: ${insights.length} insights for interactive learning mode\n\n`;

	const categories = [
		"architecture",
		"patterns",
		"evolution",
		"tools",
		"skills",
		"memory",
		"safety",
	] as const;

	for (const cat of categories) {
		const catInsights = insights.filter((i) => i.category === cat);
		if (catInsights.length > 0) {
			output += `**${cat.toUpperCase()}** (${catInsights.length})\n`;
			for (const insight of catInsights.slice(0, 3)) {
				output += `  - ${insight.title} (priority: ${insight.priority})\n`;
			}
			if (catInsights.length > 3) {
				output += `  ... and ${catInsights.length - 3} more\n`;
			}
			output += "\n";
		}
	}

	output += "Use `learningOutputStyle({action: 'insight', title: '...'})` for details.";
	output +=
		"\nUse `learningOutputStyle({action: 'category', category: '...'})` for category insights.";

	return {
		content: [{ type: "text", text: output }],
		details: `${Math.min(insights.length, max)} insights shown`,
	};
}

/**
 * Handle insight action - get specific insight
 */
function handleInsight(
	manager: ReturnType<typeof getLearningManager>,
	args: {
		title?: string;
		insightId?: string;
	},
): AgentToolResult<string> {
	let insight: LearningInsight | undefined;

	if (args.insightId) {
		insight = manager.getInsight(args.insightId);
	} else if (args.title) {
		const titleLower = args.title.toLowerCase();
		insight = manager.getInsights().find((i) => i.title.toLowerCase() === titleLower);
	}

	if (!insight) {
		return {
			content: [
				{
					type: "text",
					text: `Insight not found. Use learningOutputStyle({action: 'insights'}) to see available insights.`,
				},
			],
			details: "Not found",
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
		details: `Insight: ${insight.title}`,
	};
}

/**
 * Handle category action - get insights by category
 */
function handleCategory(
	manager: ReturnType<typeof getLearningManager>,
	args: {
		category?: string;
	},
): AgentToolResult<string> {
	if (!args.category) {
		const categories = [
			"architecture",
			"patterns",
			"evolution",
			"tools",
			"skills",
			"memory",
			"safety",
		];
		return {
			content: [
				{
					type: "text",
					text: `Available categories: ${categories.join(", ")}\n\nUsage: learningOutputStyle({action: 'category', category: 'architecture'})`,
				},
			],
			details: "Categories listed",
		};
	}

	const insights = manager.getInsightsByCategory(args.category);

	if (insights.length === 0) {
		return {
			content: [{ type: "text", text: `No insights found for category "${args.category}".` }],
			details: `No insights: ${args.category}`,
		};
	}

	let output = `📚 **${args.category.toUpperCase()} Insights** (${insights.length})\n\n`;

	for (const insight of insights) {
		output += `**${insight.title}** (priority: ${insight.priority})\n`;
		output += `${insight.description}\n`;
		if (insight.pattern) output += `- Pattern: ${insight.pattern}\n`;
		output += "\n";
	}

	return {
		content: [{ type: "text", text: output }],
		details: `${insights.length} insights in ${args.category}`,
	};
}

/**
 * Handle add action - add custom insight
 */
function handleAdd(
	manager: ReturnType<typeof getLearningManager>,
	args: {
		insightId?: string;
		title?: string;
		description?: string;
		category?: string;
		pattern?: string;
		reason?: string;
		alternatives?: string[];
		priority?: number;
	},
): AgentToolResult<string> {
	if (!args.insightId || !args.title || !args.description) {
		return {
			content: [
				{
					type: "text",
					text: "Error: insightId, title, and description are required for add action.\n\nUsage: learningOutputStyle({action: 'add', insightId: 'my-insight', title: '...', description: '...', category: 'patterns'})",
				},
			],
			details: "Error: missing parameters",
		};
	}

	const insight: LearningInsight = {
		id: args.insightId,
		category: (args.category as LearningInsight["category"]) || "patterns",
		title: args.title,
		description: args.description,
		pattern: args.pattern,
		reason: args.reason,
		alternatives: args.alternatives,
		priority: args.priority || 5,
	};

	manager.addInsight(insight);

	return {
		content: [
			{
				type: "text",
				text: `✅ Added insight: ${args.title}\n\nCategory: ${insight.category}\nPriority: ${insight.priority}`,
			},
		],
		details: `Added: ${args.title}`,
	};
}

/**
 * Handle config action - view or update config
 */
function handleConfig(
	manager: ReturnType<typeof getLearningManager>,
	args: {
		verbosity?: "brief" | "normal" | "detailed";
		minDecisionPriority?: number;
		maxLinesPerRequest?: number;
		interactive?: boolean;
		combineExplanatory?: boolean;
	},
): AgentToolResult<string> {
	// Update config if parameters provided
	const updates: Partial<LearningOutputStyleConfig> = {};

	if (args.verbosity) updates.verbosity = args.verbosity;
	if (args.minDecisionPriority !== undefined)
		updates.minDecisionPriority = args.minDecisionPriority;
	if (args.maxLinesPerRequest !== undefined) updates.maxLinesPerRequest = args.maxLinesPerRequest;
	if (args.interactive !== undefined) updates.interactive = args.interactive;
	if (args.combineExplanatory !== undefined) updates.combineExplanatory = args.combineExplanatory;

	if (Object.keys(updates).length > 0) {
		manager.updateConfig(updates);
	}

	const config = manager.getConfig();

	let output = "⚙️ **Learning Output Style Configuration**\n\n";
	output += `Enabled: ${config.enabled ? "✅" : "❌"}\n`;
	output += `Interactive: ${config.interactive ? "✅" : "❌"}\n`;
	output += `Combine Explanatory: ${config.combineExplanatory ? "✅" : "❌"}\n`;
	output += `Min Decision Priority: ${config.minDecisionPriority}\n`;
	output += `Max Lines Per Request: ${config.maxLinesPerRequest}\n`;
	output += `Verbosity: ${config.verbosity}\n`;
	output += `Session Mode: ${config.sessionMode}\n`;

	return {
		content: [{ type: "text", text: output }],
		details: `Config: enabled=${config.enabled}`,
	};
}

/**
 * Handle stats action - show statistics
 */
function handleStats(manager: ReturnType<typeof getLearningManager>): AgentToolResult<string> {
	const stats = manager.getStats();

	let output = "📊 **Learning Output Style Statistics**\n\n";
	output += `Sessions Enhanced: ${stats.sessionsEnhanced}\n`;
	output += `Last Session: ${stats.lastSession || "N/A"}\n\n`;

	output += "**Decision Points**\n";
	output += `- Requested: ${stats.decisionPointsRequested}\n`;
	output += `- Contributions Provided: ${stats.decisionPointsContributed}\n`;
	output += `- Auto-Implemented: ${stats.decisionPointsAutoImplemented}\n`;
	output += `- Contribution Rate: ${stats.contributionRate.toFixed(1)}%\n\n`;

	output += `Insights Shown: ${stats.insightsShown}\n`;

	if (stats.topCategories.length > 0) {
		output += "\n**Top Decision Categories**\n";
		for (const cat of stats.topCategories.slice(0, 5)) {
			output += `- ${cat.category}: ${cat.count}\n`;
		}
	}

	if (stats.topInsights.length > 0) {
		output += "\n**Top Insights**\n";
		for (const insight of stats.topInsights.slice(0, 5)) {
			output += `- ${insight.insightId}: ${insight.count} times\n`;
		}
	}

	return {
		content: [{ type: "text", text: output }],
		details: `${stats.sessionsEnhanced} sessions enhanced`,
	};
}

/**
 * Handle clear action - clear custom insights
 */
function handleClear(manager: ReturnType<typeof getLearningManager>): AgentToolResult<string> {
	const defaultIds = [
		"learning-modular-arch",
		"learning-wrapper-pattern",
		"learning-evolution-value",
		"learning-decision-points",
		"learning-capability-first",
		"learning-session-persistence",
		"learning-assess-tool",
		"learning-learning-tool",
		"learning-skill-workflows",
		"learning-scorecard",
		"learning-safety-gates",
	];

	const customInsights = manager.getInsights().filter((i) => !defaultIds.includes(i.id));

	for (const insight of customInsights) {
		manager.removeInsight(insight.id);
	}

	return {
		content: [
			{
				type: "text",
				text: `🧹 Cleared ${customInsights.length} custom insights. Default insights preserved.`,
			},
		],
		details: `Cleared ${customInsights.length} custom insights`,
	};
}

/**
 * Handle record action - record contribution or auto-implementation
 */
function handleRecord(
	manager: ReturnType<typeof getLearningManager>,
	args: {
		pointId?: string;
		contributed?: boolean;
	},
): AgentToolResult<string> {
	if (!args.pointId) {
		return {
			content: [
				{
					type: "text",
					text: "Error: pointId is required for record action.\n\nUsage: learningOutputStyle({action: 'record', pointId: '...', contributed: true/false})",
				},
			],
			details: "Error: pointId required",
		};
	}

	if (args.contributed) {
		manager.recordContributionProvided(args.pointId);
		return {
			content: [
				{
					type: "text",
					text: `✅ Recorded user contribution for decision point: ${args.pointId}`,
				},
			],
			details: `Recorded contribution: ${args.pointId}`,
		};
	}
	manager.recordAutoImplemented(args.pointId);
	return {
		content: [
			{
				type: "text",
				text: `✅ Recorded auto-implementation for decision point: ${args.pointId}`,
			},
		],
		details: `Recorded auto-impl: ${args.pointId}`,
	};
}
