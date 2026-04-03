/**
 * Session Replay Tool - Tool for replaying and analyzing evolution sessions
 *
 * Provides actions for:
 * - Replay sessions in various modes (full, steps, actions, learning)
 * - Extract patterns from sessions
 * - Compare successful vs failed sessions
 * - Step-by-step walkthrough
 * - Statistics and pattern management
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type PatternType,
	type ReplayMode,
	type SessionReplayConfig,
	getSessionReplayManager,
} from "../session-replay.js";

// Tool definition
export const sessionReplayToolDef: AgentTool = {
	name: "sessionReplay",
	label: "Session Replay",
	description: `Manage evolution session replay for analyzing past evolution sessions

Actions:
- replay: Replay a session in specified mode (requires sessionName, optional mode: full, steps, actions, learning)
- compare: Compare two sessions (requires sessionA, sessionB)
- walkthrough: Get step-by-step walkthrough (requires sessionName, stepIndex)
- sessions: List available sessions for replay
- patterns: Get extracted patterns (optional type filter)
- pattern: Get specific pattern details (requires patternId)
- success-patterns: Get patterns from successful sessions
- failure-patterns: Get patterns from failed sessions
- stats: View replay statistics
- config: View or update configuration
- reset: Reset statistics and patterns
- set-dir: Set trajectories directory (requires dirPath)
- help: Show help message

Example usage:
sessionReplay({action: 'sessions'})
sessionReplay({action: 'replay', sessionName: 'trajectory-001.json', mode: 'learning'})
sessionReplay({action: 'compare', sessionA: 'traj-001.json', sessionB: 'traj-002.json'})
sessionReplay({action: 'walkthrough', sessionName: 'traj-001.json', stepIndex: 5})
sessionReplay({action: 'stats'})`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: replay, compare, walkthrough, sessions, patterns, pattern, success-patterns, failure-patterns, stats, config, reset, set-dir, help",
		}),
		sessionName: Type.Optional(
			Type.String({ description: "Session name for replay/walkthrough actions" }),
		),
		mode: Type.Optional(
			Type.String({ description: "Replay mode: full, steps, actions, learning" }),
		),
		sessionA: Type.Optional(Type.String({ description: "First session for comparison" })),
		sessionB: Type.Optional(Type.String({ description: "Second session for comparison" })),
		stepIndex: Type.Optional(Type.Number({ description: "Step index for walkthrough" })),
		type: Type.Optional(Type.String({ description: "Pattern type filter" })),
		patternId: Type.Optional(Type.String({ description: "Pattern ID for pattern action" })),
		dirPath: Type.Optional(Type.String({ description: "Directory path for set-dir action" })),
		configUpdates: Type.Optional(Type.Object({}, { description: "Configuration updates" })),
	}),
	execute: async (
		_toolCallId: string,
		params: unknown,
	): Promise<AgentToolResult<{ success: boolean; action: string }>> => {
		const p = params as Record<string, unknown>;
		const output = executeSessionReplayTool({
			action: String(p.action),
			sessionName: p.sessionName as string | undefined,
			mode: p.mode as string | undefined,
			sessionA: p.sessionA as string | undefined,
			sessionB: p.sessionB as string | undefined,
			stepIndex: p.stepIndex as number | undefined,
			type: p.type as string | undefined,
			patternId: p.patternId as string | undefined,
			dirPath: p.dirPath as string | undefined,
			configUpdates: p.configUpdates as Partial<SessionReplayConfig> | undefined,
		});
		return {
			content: [{ type: "text", text: output }],
			details: { success: true, action: String(p.action) },
		};
	},
};

/**
 * Execute session replay tool action
 */
export function executeSessionReplayTool(args: {
	action: string;
	sessionName?: string;
	mode?: string;
	sessionA?: string;
	sessionB?: string;
	stepIndex?: number;
	type?: string;
	patternId?: string;
	dirPath?: string;
	configUpdates?: Partial<SessionReplayConfig>;
}): string {
	const manager = getSessionReplayManager();

	switch (args.action) {
		case "replay": {
			if (!args.sessionName) {
				return "Error: sessionName required for replay action";
			}
			const mode = (args.mode as ReplayMode) || "full";
			const result = manager.replaySession(args.sessionName, mode);
			return result.output;
		}

		case "compare": {
			if (!args.sessionA || !args.sessionB) {
				return "Error: sessionA and sessionB required for compare action";
			}
			const comparison = manager.compareSessions(args.sessionA, args.sessionB);
			return manager.formatComparison(comparison);
		}

		case "walkthrough": {
			if (!args.sessionName) {
				return "Error: sessionName required for walkthrough action";
			}
			if (args.stepIndex === undefined) {
				return "Error: stepIndex required for walkthrough action";
			}
			const walkthrough = manager.getWalkthrough(args.sessionName, args.stepIndex);
			if (!walkthrough) {
				return "Walkthrough not available for step " + args.stepIndex;
			}

			const lines: string[] = ["## Step Walkthrough\n"];
			lines.push("**Step:** " + walkthrough.currentStep + " / " + walkthrough.totalSteps);
			lines.push("**Current State:** " + walkthrough.context.currentState);
			lines.push("**Previous Actions:** " + walkthrough.context.previousActions.join(" → "));
			lines.push("**Next Actions:** " + walkthrough.context.nextActions.join(" → "));
			lines.push("");

			if (walkthrough.learningPoints.length > 0) {
				lines.push("### Learning Points");
				for (const point of walkthrough.learningPoints) {
					lines.push("- " + point);
				}
				lines.push("");
			}

			if (walkthrough.similarSuccessfulPatterns.length > 0) {
				lines.push("### Similar Success Patterns");
				for (const pattern of walkthrough.similarSuccessfulPatterns) {
					lines.push("- " + pattern.description);
				}
				lines.push("");
			}

			if (walkthrough.similarFailurePatterns.length > 0) {
				lines.push("### Similar Failure Patterns");
				for (const pattern of walkthrough.similarFailurePatterns) {
					lines.push("- " + pattern.description);
				}
			}

			return lines.join("\n");
		}

		case "sessions": {
			const sessions = manager.listSessions();
			if (sessions.length === 0) {
				return "No sessions available for replay. Check trajectories directory.";
			}

			const lines: string[] = ["## Available Sessions\n"];
			for (const session of sessions) {
				const status = session.success ? "✅" : "❌";
				lines.push(
					"- " +
						status +
						" " +
						session.name +
						" (" +
						session.steps +
						" steps, " +
						session.model +
						")",
				);
			}
			lines.push("\n**Total:** " + sessions.length + " sessions");
			lines.push("**Directory:** " + manager.getTrajectoriesDir());

			return lines.join("\n");
		}

		case "patterns": {
			const patternType = args.type as PatternType | undefined;
			const patterns = manager.getPatterns(patternType);
			if (patterns.length === 0) {
				return "No patterns extracted yet. Replay sessions to extract patterns.";
			}
			return manager.formatPatterns(patterns.slice(0, 20));
		}

		case "pattern": {
			if (!args.patternId) {
				return "Error: patternId required for pattern action";
			}
			const patterns = manager.getPatterns();
			const pattern = patterns.find((p) => p.id === args.patternId);
			if (!pattern) {
				return "Pattern not found: " + args.patternId;
			}
			return manager.formatPatterns([pattern]);
		}

		case "success-patterns": {
			const patterns = manager.getSuccessPatterns();
			if (patterns.length === 0) {
				return "No success patterns extracted yet. Replay successful sessions.";
			}
			return manager.formatPatterns(patterns);
		}

		case "failure-patterns": {
			const patterns = manager.getFailurePatterns();
			if (patterns.length === 0) {
				return "No failure patterns extracted yet. Replay failed sessions.";
			}
			return manager.formatPatterns(patterns);
		}

		case "stats": {
			return manager.formatStats();
		}

		case "config": {
			const config = manager.getConfig();
			if (args.configUpdates) {
				manager.updateConfig(args.configUpdates);
				return "Configuration updated:\n" + JSON.stringify(manager.getConfig(), null, 2);
			}
			return "## Configuration\n" + JSON.stringify(config, null, 2);
		}

		case "reset": {
			manager.resetStats();
			return "Statistics and patterns reset.";
		}

		case "set-dir": {
			if (!args.dirPath) {
				return "Error: dirPath required for set-dir action";
			}
			manager.setTrajectoriesDir(args.dirPath);
			return "Trajectories directory set to: " + args.dirPath;
		}

		case "help": {
			const helpText = [
				"## Session Replay Tool",
				"",
				"Replay and analyze past evolution sessions to extract patterns and learning.",
				"",
				"### Actions",
				"",
				"| Action | Description | Required Args |",
				"|--------|-------------|---------------|",
				"| replay | Replay a session | sessionName, mode (optional) |",
				"| compare | Compare two sessions | sessionA, sessionB |",
				"| walkthrough | Step-by-step walkthrough | sessionName, stepIndex |",
				"| sessions | List available sessions | none |",
				"| patterns | Get extracted patterns | type (optional) |",
				"| pattern | Get specific pattern | patternId |",
				"| success-patterns | Get success patterns | none |",
				"| failure-patterns | Get failure patterns | none |",
				"| stats | View statistics | none |",
				"| config | View/update config | configUpdates (optional) |",
				"| reset | Reset stats/patterns | none |",
				"| set-dir | Set trajectories dir | dirPath |",
				"| help | Show this help | none |",
				"",
				"### Replay Modes",
				"",
				"| Mode | Description |",
				"|------|-------------|",
				"| full | Full session replay with all details |",
				"| steps | Condensed step-by-step replay |",
				"| actions | Tool actions only |",
				"| learning | Pattern-focused learning replay |",
				"",
				"### Pattern Types",
				"",
				"| Type | Description |",
				"|------|-------------|",
				"| success-pattern | Patterns from successful sessions |",
				"| failure-pattern | Patterns from failed sessions |",
				"| tool-sequence | Tool usage sequences |",
				"| error-recovery | Error recovery patterns |",
				"| decision-point | Decision point patterns |",
				"| skill-usage | Skill usage patterns |",
				"",
				"### Example Usage",
				"",
				"sessionReplay({action: 'sessions'})",
				"sessionReplay({action: 'replay', sessionName: 'traj-001.json', mode: 'learning'})",
				"sessionReplay({action: 'compare', sessionA: 'traj-001.json', sessionB: 'traj-002.json'})",
				"sessionReplay({action: 'walkthrough', sessionName: 'traj-001.json', stepIndex: 5})",
			];
			return helpText.join("\n");
		}

		default:
			return "Unknown action: " + args.action + ". Use 'help' action for available actions.";
	}
}

// Export tool
export const sessionReplayTool = {
	definition: sessionReplayToolDef,
	execute: executeSessionReplayTool,
};
