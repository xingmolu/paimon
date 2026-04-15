/**
 * Learning Transfer Tool - Tool interface for cross-session learning transfer
 *
 * Provides actions for transferring learnings between related tasks.
 */
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type LearningTransferConfig,
	type SessionLearning,
	getLearningTransferManager,
} from "../learning-transfer.js";

// Tool definition
export const learningTransferToolDef: AgentTool = {
	name: "learningTransfer",
	label: "Cross-Session Learning Transfer",
	description: `Automatically transfers learnings between related tasks.

Actions:
- transfer: Generate transfer recommendation with similar sessions and patterns
- similar: Find similar past sessions
- sessions: List all recorded sessions
- session: Get specific session details
- record: Record a new session learning
- context: Get proactive context injection for a new task
- stats: View transfer statistics
- config: View or update configuration
- update-config: Update configuration
- clear: Clear all sessions
- reset: Reset statistics
- help: Show help message

Example usage:
learningTransfer({action: 'transfer', taskDescription: 'Add self-healing patterns'})
learningTransfer({action: 'similar', taskDescription: 'Implement error recovery'})
learningTransfer({action: 'context', taskDescription: 'Add new capability'})
learningTransfer({action: 'stats'})`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: transfer, similar, sessions, session, record, context, stats, config, update-config, clear, reset, help",
		}),
		taskDescription: Type.Optional(
			Type.String({ description: "Task description for transfer/similar/context actions" }),
		),
		taskType: Type.Optional(
			Type.String({ description: "Task type: capability, reliability, or feature" }),
		),
		sessionId: Type.Optional(Type.String({ description: "Session ID for session action" })),
		session: Type.Optional(
			Type.Object({}, { description: "Session learning object for record action" }),
		),
		configUpdates: Type.Optional(
			Type.Object({}, { description: "Configuration updates for update-config action" }),
		),
	}),
	execute: async (
		_toolCallId: string,
		params: unknown,
	): Promise<AgentToolResult<{ success: boolean; action: string }>> => {
		const p = params as Record<string, unknown>;
		const output = executeLearningTransferTool({
			action: String(p.action),
			taskDescription: p.taskDescription as string | undefined,
			taskType: p.taskType as string | undefined,
			sessionId: p.sessionId as string | undefined,
			session: p.session as SessionLearning | undefined,
			configUpdates: p.configUpdates as Partial<LearningTransferConfig> | undefined,
		});
		return {
			content: [{ type: "text", text: output }],
			details: { success: true, action: String(p.action) },
		};
	},
};

/**
 * Execute learning transfer tool action
 */
function executeLearningTransferTool(args: {
	action: string;
	taskDescription?: string;
	taskType?: string;
	sessionId?: string;
	session?: SessionLearning;
	configUpdates?: Partial<LearningTransferConfig>;
}): string {
	const manager = getLearningTransferManager();

	switch (args.action) {
		case "transfer": {
			if (!args.taskDescription) {
				return "Error: taskDescription required for transfer action";
			}

			const signature = {
				taskType: args.taskType || "capability",
				keywords: manager.extractKeywords(args.taskDescription),
				toolsUsed: [] as string[],
				skillsUsed: [] as string[],
				category: manager.extractCategory(args.taskDescription),
			};

			const recommendation = manager.generateTransferRecommendation(
				args.taskDescription,
				signature,
			);

			let output = `## Transfer Recommendation for "${args.taskDescription}"\n\n`;
			const conf = (recommendation.overallConfidence * 100).toFixed(0);
			output += `**Overall Confidence:** ${conf}%\n`;
			output += `**Similar Sessions Found:** ${recommendation.similarSessions.length}\n\n`;

			if (recommendation.similarSessions.length > 0) {
				output += "### Similar Sessions\n";
				for (const sim of recommendation.similarSessions.slice(0, 5)) {
					const desc = sim.taskDescription.slice(0, 50);
					const score = (sim.score * 100).toFixed(0);
					const status = sim.success ? "✅ success" : "❌ failed";
					output += `- **${desc}...** (score: ${score}%, ${status})\n`;
					output += `  Matching factors: ${sim.matchingFactors.join(", ")}\n`;
				}
			}

			if (recommendation.recommendedApproach) {
				output += `\n### Recommended Approach\n${recommendation.recommendedApproach}\n`;
			}

			if (recommendation.transferredLearning.length > 0) {
				output += "\n### Transferred Patterns\n";
				for (const learning of recommendation.transferredLearning.slice(0, 3)) {
					if (learning.patterns.length > 0) {
						output += `From "${learning.sourceSession}":\n`;
						output += `- Patterns: ${learning.patterns.join(", ")}\n`;
						output += `- Recommended skills: ${learning.recommendedSkills.join(", ")}\n`;
					}
				}
			}

			if (recommendation.riskFactors.length > 0) {
				output += "\n### ⚠️ Risk Factors\n";
				for (const risk of recommendation.riskFactors) {
					output += `- ${risk}\n`;
				}
			}

			return output;
		}

		case "similar": {
			if (!args.taskDescription) {
				return "Error: taskDescription required for similar action";
			}

			const signature = {
				taskType: args.taskType || "capability",
				keywords: manager.extractKeywords(args.taskDescription),
				toolsUsed: [] as string[],
				skillsUsed: [] as string[],
				category: manager.extractCategory(args.taskDescription),
			};

			const similar = manager.findSimilarSessions(signature);

			if (similar.length === 0) {
				return `No similar sessions found for "${args.taskDescription}"`;
			}

			let output = `## Similar Sessions for "${args.taskDescription}"\n\n`;
			for (const sim of similar) {
				const desc = sim.taskDescription.slice(0, 50);
				const score = (sim.score * 100).toFixed(0);
				const status = sim.success ? "✅" : "❌";
				output += `- **${sim.sessionId}: "${desc}..." (score: ${score}%, ${status})\n`;
				output += `  Factors: ${sim.matchingFactors.join(", ")}\n`;
			}

			return output;
		}

		case "sessions": {
			const sessions = manager.getSessions();
			if (sessions.length === 0) {
				return "No sessions recorded";
			}

			let output = `## Recorded Sessions (${sessions.length})\n\n`;
			for (const session of sessions.slice(0, 20)) {
				const desc = session.taskDescription.slice(0, 40);
				const status = session.success ? "✅" : "❌";
				output += `- **${session.sessionId}: "${desc}..." (${status}, ${session.durationMinutes}m)\n`;
			}

			return output;
		}

		case "session": {
			if (!args.sessionId) {
				return "Error: sessionId required for session action";
			}

			const session = manager.getSession(args.sessionId);
			if (!session) {
				return `Session "${args.sessionId}" not found`;
			}

			let output = `## Session: ${args.sessionId}\n\n`;
			output += `**Task:** ${session.taskDescription}\n`;
			output += `**Type:** ${session.taskSignature.taskType}\n`;
			output += `**Success:** ${session.success ? "✅" : "❌"} (first try: ${session.firstTry ? "✅" : "❌"})\n`;
			output += `**Duration:** ${session.durationMinutes} minutes\n`;
			output += `**Skills Used:** ${session.skillsUsed.join(", ") || "none"}\n`;
			output += `**Errors:** ${session.errors.join(", ") || "none"}\n`;
			output += `**Keywords:** ${session.taskSignature.keywords.join(", ") || "none"}\n`;
			output += `**Patterns Learned:** ${session.patternsLearned.join(", ") || "none"}\n`;
			output += `**Solutions Applied:** ${session.solutionsApplied.join(", ") || "none"}\n`;

			return output;
		}

		case "record": {
			if (!args.session) {
				return "Error: session object required for record action";
			}

			manager.recordSession(args.session);
			return `Session "${args.session.sessionId}" recorded successfully`;
		}

		case "context": {
			if (!args.taskDescription) {
				return "Error: taskDescription required for context action";
			}

			const context = manager.getProactiveContext(args.taskDescription);
			if (!context) {
				return `No relevant context found for "${args.taskDescription}"`;
			}

			return context;
		}

		case "stats": {
			const stats = manager.getStats();
			let output = "## Learning Transfer Statistics\n\n";
			output += `**Total Transfers:** ${stats.totalTransfers}\n`;
			output += `**Patterns Transferred:** ${stats.patternsTransferred}\n`;
			output += `**Warnings Generated:** ${stats.warningsGenerated}\n`;
			const avgConf = (stats.averageSimilarityScore * 100).toFixed(0);
			output += `**Average Similarity Score:** ${avgConf}%\n`;
			output += `**Sessions Processed:** ${stats.sessionsProcessed}\n`;
			output += `**Last Transfer:** ${stats.lastTransferTime}\n`;

			if (stats.topTransferredPatterns.length > 0) {
				output += "\n### Top Transferred Patterns\n";
				for (const item of stats.topTransferredPatterns.slice(0, 5)) {
					output += `- ${item.pattern} (${item.count} times)\n`;
				}
			}

			return output;
		}

		case "config": {
			const config = manager.getConfig();
			let output = "## Learning Transfer Configuration\n\n";
			output += `**Min Similarity Threshold:** ${config.minSimilarityThreshold}\n`;
			output += `**Max Sessions to Consider:** ${config.maxSessionsToConsider}\n`;
			output += `**Max Patterns Per Session:** ${config.maxPatternsPerSession}\n`;
			output += `**Proactive Injection:** ${config.enableProactiveInjection ? "enabled" : "disabled"}\n`;
			output += `**Exclude Older Than (days):** ${config.excludeOlderThanDays}\n`;
			output += `**Data Path:** ${config.dataPath}\n`;

			return output;
		}

		case "update-config": {
			if (!args.configUpdates) {
				return "Error: configUpdates required for update-config action";
			}

			manager.updateConfig(args.configUpdates);
			return `Configuration updated: ${Object.keys(args.configUpdates).join(", ")}`;
		}

		case "clear": {
			manager.clearSessions();
			return "All sessions cleared";
		}

		case "reset": {
			manager.resetStats();
			return "Statistics reset";
		}

		case "help": {
			return `## Learning Transfer Tool

Automatically transfers learnings between related tasks.

### Actions

| Action | Description | Required Args |
|--------|-------------|---------------|
| transfer | Generate transfer recommendation | taskDescription, taskType (optional) |
| similar | Find similar sessions | taskDescription, taskType (optional) |
| sessions | List all recorded sessions | none |
| session | Get specific session details | sessionId |
| record | Record a new session | session object |
| context | Get proactive context injection | taskDescription |
| stats | View statistics | none |
| config | View configuration | none |
| update-config | Update configuration | configUpdates |
| clear | Clear all sessions | none |
| reset | Reset statistics | none |
| help | Show this help | none |

### How It Works

1. Extracts keywords and category from task description
2. Calculates similarity score with past sessions
3. Transfers patterns from successful similar sessions
4. Warns about patterns from failed similar sessions
5. Recommends approach based on past success

This improves first-try success rate and reduces rework.`;
		}

		default:
			return `Unknown action: ${args.action}. Use 'help' for available actions.`;
	}
}

// Export for use in agent
export { getLearningTransferManager };
