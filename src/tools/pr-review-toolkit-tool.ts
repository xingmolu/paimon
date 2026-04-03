/**
 * PR Review Toolkit Tool
 *
 * Comprehensive collection of specialized agents for thorough pull request review.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type PRReviewFinding,
	type PRReviewToolkitManager,
	type ReviewAgentType,
	type ReviewAspect,
	generateFindingId,
	getConfidenceLevel,
	getPRReviewToolkit,
	parseAgentType,
	parseReviewAspect,
} from "../pr-review-toolkit.js";

let toolkitManagerInstance: PRReviewToolkitManager | null = null;

function getManager(): PRReviewToolkitManager {
	if (!toolkitManagerInstance) {
		toolkitManagerInstance = getPRReviewToolkit();
	}
	return toolkitManagerInstance;
}

function formatHelp(): string {
	return `
## PR Review Toolkit - Comprehensive PR Review with Specialized Agents

6 specialized review agents for thorough PR analysis:
- **comment-analyzer**: Analyze code comment accuracy
- **pr-test-analyzer**: Analyze test coverage quality
- **silent-failure-hunter**: Hunt silent failures
- **type-design-analyzer**: Analyze type design quality
- **code-reviewer**: General code review
- **code-simplifier**: Analyze simplification opportunities

### Actions:

**Review Actions:**
- \`review\` - Start and run a review
  - Required: files (array of file paths)
  - Optional: aspects, prNumber, branch
  - Example: \`prReviewToolkit({action: 'review', files: ['src/agent.ts']})\`

- \`start\` - Start a new review session
  - Required: files
  - Optional: aspects, prNumber, branch

- \`complete\` - Complete a review session
  - Required: sessionId
  - Optional: summary, outputFormat

- \`finding\` - Add a finding to a session
  - Required: sessionId, finding object, agent
  - Optional: aspect

**Status and Info:**
- \`status\` - View toolkit status
- \`agents\` - List all agents
- \`agent\` - Get specific agent details
  - Required: agent
  - Example: \`prReviewToolkit({action: 'agent', agent: 'code-reviewer'})\`

- \`sessions\` - List recent sessions
  - Optional: limit

- \`session\` - Get specific session details
  - Required: sessionId

**Configuration:**
- \`config\` - View/update configuration
  - Optional: confidenceThreshold, maxFindingsPerAgent, parallelExecution, outputFormat, enabled

- \`enable\` / \`disable\` - Enable/disable toolkit
- \`enable-agent\` / \`disable-agent\` - Enable/disable specific agent
  - Required: agent

**Statistics:**
- \`stats\` - View statistics
- \`reset\` - Reset statistics
- \`clear\` - Clear sessions

### Review Aspects:
comments, tests, errors, types, code, simplify, all

### Confidence Scoring:
Findings are scored 0-100. Default threshold is 80 to filter false positives.
`;
}

export const prReviewToolkitTool: AgentTool = {
	name: "prReviewToolkit",
	label: "PR Review Toolkit",
	description:
		"Manage comprehensive PR review with 6 specialized agents (Claude Code Pattern) - comment-analyzer, pr-test-analyzer, silent-failure-hunter, type-design-analyzer, code-reviewer, code-simplifier",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action: review, start, complete, finding, fixed, ignored, status, agents, agent, sessions, session, config, enable, disable, enable-agent, disable-agent, stats, reset, clear, help",
		}),
		files: Type.Optional(Type.Array(Type.String(), { description: "Files to review" })),
		aspects: Type.Optional(
			Type.Array(Type.String(), {
				description: "Review aspects: comments, tests, errors, types, code, simplify, all",
			}),
		),
		agents: Type.Optional(Type.Array(Type.String(), { description: "Agents to run" })),
		prNumber: Type.Optional(Type.Number({ description: "PR number" })),
		branch: Type.Optional(Type.String({ description: "Branch name" })),
		sessionId: Type.Optional(Type.String({ description: "Session ID" })),
		findingId: Type.Optional(Type.String({ description: "Finding ID" })),
		agent: Type.Optional(Type.String({ description: "Agent type" })),
		aspect: Type.Optional(Type.String({ description: "Review aspect" })),
		enabled: Type.Optional(Type.Boolean({ description: "Enable/disable" })),
		confidenceThreshold: Type.Optional(
			Type.Number({ description: "Confidence threshold (0-100)" }),
		),
		maxFindingsPerAgent: Type.Optional(Type.Number({ description: "Max findings per agent" })),
		parallelExecution: Type.Optional(Type.Boolean({ description: "Run agents in parallel" })),
		outputFormat: Type.Optional(
			Type.String({ description: "Output format: terminal, comment, structured" }),
		),
		limit: Type.Optional(Type.Number({ description: "Limit for sessions list" })),
		summary: Type.Optional(Type.String({ description: "Review summary" })),
		description: Type.Optional(Type.String({ description: "Finding description" })),
		lineStart: Type.Optional(Type.Number({ description: "Finding line start" })),
		lineEnd: Type.Optional(Type.Number({ description: "Finding line end" })),
		file: Type.Optional(Type.String({ description: "Finding file" })),
		severity: Type.Optional(Type.Number({ description: "Finding severity (1-10)" })),
		confidence: Type.Optional(Type.Number({ description: "Finding confidence (0-100)" })),
		suggestion: Type.Optional(Type.String({ description: "Finding suggestion" })),
		whyItMatters: Type.Optional(Type.String({ description: "Why finding matters" })),
		category: Type.Optional(Type.String({ description: "Finding category" })),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const manager = getManager();
		const args = params as Record<string, unknown>;
		const action = args.action as string;

		if (!action) {
			return { content: [{ type: "text", text: formatHelp() }], details: { action: "help" } };
		}

		let result: string;

		switch (action) {
			case "review": {
				const files = args.files as string[] | undefined;
				if (!files || files.length === 0) {
					result = "Error: 'files' parameter required for review action";
					break;
				}
				const aspects: ReviewAspect[] = args.aspects
					? (args.aspects as string[]).map(parseReviewAspect)
					: ["all"];
				const session = manager.startReview(
					files,
					aspects,
					args.prNumber as number | undefined,
					args.branch as string | undefined,
				);
				const agentsToRun = manager.getAgents().filter((a) => a.enabled);
				result = [
					"=== PR Review Started ===",
					`Session ID: ${session.id}`,
					`Files: ${session.files.length}`,
					`Aspects: ${aspects.join(", ")}`,
					`Agents: ${agentsToRun.map((a) => a.name).join(", ")}`,
					"",
					"Review agents are ready. Use:",
					`  prReviewToolkit({action: 'finding', sessionId: '${session.id}', ...}) to add findings`,
					`  prReviewToolkit({action: 'complete', sessionId: '${session.id}', summary: '...'}) to finish`,
				].join("\n");
				break;
			}

			case "start": {
				const files = args.files as string[] | undefined;
				if (!files || files.length === 0) {
					result = "Error: 'files' parameter required for start action";
					break;
				}
				const aspects: ReviewAspect[] = args.aspects
					? (args.aspects as string[]).map(parseReviewAspect)
					: ["all"];
				const session = manager.startReview(
					files,
					aspects,
					args.prNumber as number | undefined,
					args.branch as string | undefined,
				);
				result = [
					`Review session started: ${session.id}`,
					`Files: ${session.files.join(", ")}`,
					`Aspects: ${session.aspects.join(", ")}`,
					`Agents: ${session.agents.join(", ")}`,
					`Started: ${session.startedAt}`,
				].join("\n");
				break;
			}

			case "complete": {
				const sessionId = args.sessionId as string | undefined;
				if (!sessionId) {
					result = "Error: 'sessionId' parameter required for complete action";
					break;
				}
				const summary = (args.summary as string) || "Review completed";
				const reviewResult = manager.completeReview(sessionId, summary);
				const format = (args.outputFormat as "terminal" | "comment") || "terminal";
				result = manager.formatReviewResult(reviewResult, format);
				break;
			}

			case "finding": {
				const sessionId = args.sessionId as string | undefined;
				const agent = args.agent as string | undefined;
				const file = args.file as string | undefined;
				const lineStart = args.lineStart as number | undefined;
				const lineEnd = args.lineEnd as number | undefined;
				const description = args.description as string | undefined;
				const severity = args.severity as number | undefined;
				const confidence = args.confidence as number | undefined;
				const suggestion = args.suggestion as string | undefined;

				if (!sessionId) {
					result = "Error: 'sessionId' parameter required for finding action";
					break;
				}
				if (!file || !description) {
					result = "Error: 'file' and 'description' parameters required for finding action";
					break;
				}
				if (!agent) {
					result = "Error: 'agent' parameter required for finding action";
					break;
				}

				const agentType = parseAgentType(agent);
				if (!agentType) {
					result = `Error: Invalid agent type: ${agent}`;
					break;
				}

				const aspect = parseReviewAspect((args.aspect as string) || "code");
				const finding: PRReviewFinding = {
					id: generateFindingId(),
					agent: agentType,
					aspect,
					file,
					lineStart: lineStart || 1,
					lineEnd: lineEnd || lineStart || 1,
					description,
					severity: (severity || 5) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
					confidence: confidence || 80,
					confidenceLevel: getConfidenceLevel(confidence || 80),
					suggestion: suggestion || "",
					whyItMatters: (args.whyItMatters as string) || "",
					category: (args.category as string) || "general",
					timestamp: new Date().toISOString(),
				};

				manager.addFinding(sessionId, finding);
				result = [
					`Finding added: ${finding.id}`,
					`Agent: ${agentType}`,
					`File: ${finding.file}#${finding.lineStart}-${finding.lineEnd}`,
					`Description: ${finding.description}`,
					`Severity: ${finding.severity}/10`,
					`Confidence: ${finding.confidence} (${finding.confidenceLevel})`,
				].join("\n");
				break;
			}

			case "fixed": {
				const sessionId = args.sessionId as string | undefined;
				const findingId = args.findingId as string | undefined;
				if (!sessionId || !findingId) {
					result = "Error: 'sessionId' and 'findingId' parameters required";
					break;
				}
				manager.markFindingFixed(sessionId, findingId);
				result = `Finding ${findingId} marked as fixed`;
				break;
			}

			case "ignored": {
				const sessionId = args.sessionId as string | undefined;
				const findingId = args.findingId as string | undefined;
				if (!sessionId || !findingId) {
					result = "Error: 'sessionId' and 'findingId' parameters required";
					break;
				}
				manager.markFindingIgnored(sessionId, findingId);
				result = `Finding ${findingId} marked as ignored`;
				break;
			}

			case "status": {
				const config = manager.getConfig();
				const stats = manager.getStats();
				const lines = [
					"=== PR Review Toolkit Status ===",
					"",
					`Enabled: ${config.enabled}`,
					`Confidence Threshold: ${config.confidenceThreshold}`,
					`Parallel Execution: ${config.parallelExecution}`,
					`Total Reviews: ${stats.totalReviews}`,
					`Average Findings: ${stats.averageFindingsPerReview.toFixed(1)}`,
				];
				if (stats.lastReview) {
					lines.push(`Last Review: ${stats.lastReview}`);
				}
				result = lines.join("\n");
				break;
			}

			case "agents": {
				result = manager.formatAgents();
				break;
			}

			case "agent": {
				const agent = args.agent as string | undefined;
				if (!agent) {
					result = "Error: 'agent' parameter required for agent action";
					break;
				}
				const agentType = parseAgentType(agent);
				if (!agentType) {
					result = `Error: Invalid agent type: ${agent}`;
					break;
				}
				const agentInfo = manager.getAgent(agentType);
				if (!agentInfo) {
					result = `Agent not found: ${agent}`;
					break;
				}
				result = [
					`=== ${agentInfo.name} ===`,
					"",
					`Type: ${agentInfo.type}`,
					`Focus: ${agentInfo.focus}`,
					`Enabled: ${agentInfo.enabled}`,
					`Priority: ${agentInfo.priority}`,
					"",
					"Description:",
					agentInfo.description,
					"",
					"Analyzes:",
				].join("\n");
				for (const a of agentInfo.analyzes) {
					result += `\n  - ${a}`;
				}
				result += "\n\nWhen to Use:";
				for (const a of agentInfo.whenToUse) {
					result += `\n  - ${a}`;
				}
				break;
			}

			case "sessions": {
				const limit = (args.limit as number) || 10;
				const sessions = manager.getSessionHistory(limit);
				if (sessions.length === 0) {
					result = "No review sessions found.";
					break;
				}
				result = `=== Review Sessions (last ${sessions.length}) ===\n\n`;
				for (const session of sessions) {
					result += `Session: ${session.id}\n`;
					result += `  Files: ${session.files.length}\n`;
					result += `  Agents: ${session.agents.join(", ")}\n`;
					result += `  Findings: ${session.findings.length}\n`;
					result += `  Started: ${session.startedAt}\n`;
					if (session.completedAt) {
						result += `  Completed: ${session.completedAt}\n`;
						result += `  Duration: ${session.duration}ms\n`;
					}
					result += "\n";
				}
				break;
			}

			case "session": {
				const sessionId = args.sessionId as string | undefined;
				if (!sessionId) {
					result = "Error: 'sessionId' parameter required for session action";
					break;
				}
				const session = manager.getSession(sessionId);
				if (!session) {
					result = `Session not found: ${sessionId}`;
					break;
				}
				result = `=== Session: ${session.id} ===\n\n`;
				result += `Files: ${session.files.join(", ")}\n`;
				result += `Aspects: ${session.aspects.join(", ")}\n`;
				result += `Agents: ${session.agents.join(", ")}\n`;
				result += `Started: ${session.startedAt}\n`;
				if (session.completedAt) {
					result += `Completed: ${session.completedAt}\n`;
					result += `Duration: ${session.duration}ms\n`;
				}
				result += `\nFindings: ${session.findings.length}\n`;
				break;
			}

			case "config": {
				if (
					args.confidenceThreshold !== undefined ||
					args.maxFindingsPerAgent !== undefined ||
					args.parallelExecution !== undefined ||
					args.outputFormat !== undefined ||
					args.enabled !== undefined
				) {
					const updates: Record<string, unknown> = {};
					if (args.confidenceThreshold !== undefined)
						updates.confidenceThreshold = args.confidenceThreshold;
					if (args.maxFindingsPerAgent !== undefined)
						updates.maxFindingsPerAgent = args.maxFindingsPerAgent;
					if (args.parallelExecution !== undefined)
						updates.parallelExecution = args.parallelExecution;
					if (args.outputFormat !== undefined) updates.outputFormat = args.outputFormat;
					if (args.enabled !== undefined) updates.enabled = args.enabled;
					manager.updateConfig(updates);
					result = `Configuration updated: ${Object.keys(updates).join(", ")}`;
				} else {
					const config = manager.getConfig();
					result = "=== PR Review Toolkit Configuration ===\n\n";
					result += `Enabled: ${config.enabled}\n`;
					result += `Confidence Threshold: ${config.confidenceThreshold}\n`;
					result += `Max Findings Per Agent: ${config.maxFindingsPerAgent}\n`;
					result += `Parallel Execution: ${config.parallelExecution}\n`;
					result += `Auto Invoke on PR: ${config.autoInvokeOnPR}\n`;
					result += `Output Format: ${config.outputFormat}\n`;
				}
				break;
			}

			case "enable": {
				manager.setEnabled(true);
				result = "PR Review Toolkit enabled";
				break;
			}

			case "disable": {
				manager.setEnabled(false);
				result = "PR Review Toolkit disabled";
				break;
			}

			case "enable-agent": {
				const agent = args.agent as string | undefined;
				if (!agent) {
					result = "Error: 'agent' parameter required for enable-agent action";
					break;
				}
				const agentType = parseAgentType(agent);
				if (!agentType) {
					result = `Error: Invalid agent type: ${agent}`;
					break;
				}
				manager.setAgentEnabled(agentType, true);
				result = `Agent ${agent} enabled`;
				break;
			}

			case "disable-agent": {
				const agent = args.agent as string | undefined;
				if (!agent) {
					result = "Error: 'agent' parameter required for disable-agent action";
					break;
				}
				const agentType = parseAgentType(agent);
				if (!agentType) {
					result = `Error: Invalid agent type: ${agent}`;
					break;
				}
				manager.setAgentEnabled(agentType, false);
				result = `Agent ${agent} disabled`;
				break;
			}

			case "stats": {
				result = manager.formatStats();
				break;
			}

			case "reset": {
				manager.resetStats();
				result = "Statistics reset";
				break;
			}

			case "clear": {
				manager.clearSessions();
				result = "Sessions cleared";
				break;
			}

			case "help": {
				result = formatHelp();
				break;
			}

			default: {
				result = `Unknown action: ${action}. Use 'help' for available actions.`;
			}
		}

		return { content: [{ type: "text", text: result }], details: { action } };
	},
};

export default prReviewToolkitTool;
