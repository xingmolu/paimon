/**
 * Feature Dev Tool
 *
 * Tool interface for the 7-phase feature development workflow.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { type FeatureDevManager, getFeatureDevManager } from "../feature-dev.js";
import type {
	AgentTask,
	ArchitectureApproach,
	ClarifyingQuestion,
	FeatureDevState,
	FeaturePhase,
	ReviewFinding,
} from "../feature-dev.js";

let featureDevManagerInstance: FeatureDevManager | null = null;

function getManager(): FeatureDevManager {
	if (!featureDevManagerInstance) {
		featureDevManagerInstance = getFeatureDevManager();
	}
	return featureDevManagerInstance;
}

function formatHelp(): string {
	return `
## Feature Dev Tool - 7-Phase Feature Development Workflow

A comprehensive workflow for feature development:
1. Discovery → 2. Exploration → 3. Questions → 4. Architecture → 5. Implementation → 6. Review → 7. Summary

### Actions:

**Session Management:**
- \`start\` - Start a new feature development session
  - Required: featureRequest
  - Example: \`featureDev({action: 'start', featureRequest: 'Add OAuth authentication'})\`

- \`status\` - Get current session status
- \`sessions\` - List recent sessions
- \`cancel\` - Cancel current session

**Phase Navigation:**
- \`phase\` - Get info for a specific phase
  - Optional: phase (discovery, exploration, questions, architecture, implementation, review, summary)
- \`progress\` - Move to next phase

**Phase 1: Discovery:**
- \`discovery\` - Get discovery guidance or update discovery
  - Optional: understanding, problemStatement, constraints

**Phase 2: Exploration:**
- \`exploration\` - Launch exploration agents or update agent results
  - Optional: agentId, result, keyFiles, insights

**Phase 3: Questions:**
- \`questions\` - Generate clarifying questions
- \`answer\` - Answer a question
  - Required: questionId, answer

**Phase 4: Architecture:**
- \`architecture\` - Generate architecture approaches
- \`select\` - Select an approach
  - Required: approachId
- \`approve\` - Approve selected architecture

**Phase 5: Implementation:**
- \`implementation\` - Start implementation or update progress
  - Optional: filesModified, todosCompleted, complete

**Phase 6: Review:**
- \`review\` - Launch review agents or add findings
  - Optional: findings, complete
- \`finding\` - Address a finding
  - Required: findingId

**Phase 7: Summary:**
- \`summary\` - Generate final summary
  - Optional: keyDecision, nextStep

**Configuration:**
- \`config\` - View or update configuration
- \`stats\` - View statistics
- \`reset\` - Reset session or statistics
`;
}

function formatAgentsLaunched(agents: AgentTask[]): string {
	return `
### Exploration Agents Launched

${agents
	.map(
		(a: AgentTask) => `
**${a.id}** (${a.type})
- Focus: ${a.focus}
- Status: ${a.status}
- Prompt: ${a.prompt}
`,
	)
	.join("\n")}

Use \`featureDev({action: 'exploration', agentId: '...', result: '...', keyFiles: ['...'], insights: ['...']})\` to update agent results.
`;
}

function formatReviewAgentsLaunched(agents: AgentTask[]): string {
	return `
### Review Agents Launched

${agents
	.map(
		(a: AgentTask) => `
**${a.id}** (${a.type})
- Focus: ${a.focus}
- Status: ${a.status}
`,
	)
	.join("\n")}

Use \`featureDev({action: 'review', agentId: '...', findings: [...]})\` to submit review findings.
`;
}

function formatQuestions(questions: ClarifyingQuestion[]): string {
	return `
### Clarifying Questions

Before proceeding, please answer these questions:

${questions
	.map(
		(q: ClarifyingQuestion, i: number) => `
**${i + 1}.** [${q.category}] ${q.question}
   Context: ${q.context}
`,
	)
	.join("\n")}

Use \`featureDev({action: 'answer', questionId: '...', answer: '...'})\` to answer each question.
`;
}

function formatApproaches(approaches: ArchitectureApproach[]): string {
	let output = `
### Architecture Approaches

I've designed 3 approaches:

`;

	for (const approach of approaches) {
		output += `
**${approach.name}**
${approach.description}

- Pros: ${approach.pros.join(", ")}
- Cons: ${approach.cons.join(", ")}
- Complexity: ${approach.estimatedComplexity}
${approach.recommended ? `\n**Recommended:** ${approach.reason}` : ""}
`;
	}

	output += `
Use \`featureDev({action: 'select', approachId: 'approach-...'})\` to choose an approach.
`;

	return output;
}

function formatPhaseInfo(
	phase: FeaturePhase,
	phaseInfo: NonNullable<ReturnType<FeatureDevManager["getPhaseInfo"]>>,
	session: FeatureDevState | undefined,
	manager: FeatureDevManager,
): string {
	let output = `
## ${phaseInfo.name}

**Description:** ${phaseInfo.description}

**Actions:**
${phaseInfo.actions.map((a: string) => `- ${a}`).join("\n")}

**Expected outputs:**
${phaseInfo.outputs.map((o: string) => `- ${o}`).join("\n")}

**Relevant skills:**
${phaseInfo.skills.length > 0 ? phaseInfo.skills.map((s: string) => `- ${s}`).join("\n") : "None (manual phase)"}
`;

	// Add phase-specific guidance
	if (phase === "discovery" && session) {
		output += `\n${manager.generateDiscoveryGuidance(session.featureRequest)}`;
	} else if (phase === "exploration" && session) {
		const agents = manager.launchExplorationAgents(session.id);
		output += `\n${formatAgentsLaunched(agents)}`;
	} else if (phase === "questions" && session) {
		const questions = manager.generateClarifyingQuestions(session.id);
		output += `\n${formatQuestions(questions)}`;
	} else if (phase === "architecture" && session) {
		const approaches = manager.generateArchitectureApproaches(session.id);
		output += `\n${formatApproaches(approaches)}`;
	} else if (phase === "implementation" && session) {
		output += `\n${manager.generateImplementationGuidance(session.id)}`;
	} else if (phase === "review" && session) {
		const agents = manager.generateReviewAgents(session.id);
		output += `\n${formatReviewAgentsLaunched(agents)}`;
	} else if (phase === "summary" && session) {
		output += `\n${manager.generateSummary(session.id)}`;
	}

	return output;
}

/**
 * Feature Dev tool - 7-phase feature development workflow
 */
export const featureDevTool: AgentTool = {
	name: "featureDev",
	label: "Feature Development Workflow",
	description:
		"Manage the 7-phase feature development workflow (Claude Code Pattern) - Discovery → Exploration → Questions → Architecture → Implementation → Review → Summary",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action: start, phase, progress, discovery, exploration, questions, answer, architecture, select, approve, implementation, review, finding, summary, status, sessions, stats, config, reset, cancel, help",
		}),
		featureRequest: Type.Optional(Type.String({ description: "Feature request for start action" })),
		phase: Type.Optional(Type.String({ description: "Phase name for phase action" })),
		sessionId: Type.Optional(Type.String({ description: "Session ID for multi-session support" })),
		understanding: Type.Optional(Type.String({ description: "Understanding for discovery phase" })),
		problemStatement: Type.Optional(
			Type.String({ description: "Problem statement for discovery phase" }),
		),
		constraints: Type.Optional(Type.Array(Type.String(), { description: "Constraints list" })),
		agentId: Type.Optional(Type.String({ description: "Agent ID for exploration/review updates" })),
		result: Type.Optional(Type.String({ description: "Agent result" })),
		keyFiles: Type.Optional(Type.Array(Type.String(), { description: "Key files found by agent" })),
		insights: Type.Optional(Type.Array(Type.String(), { description: "Insights from agent" })),
		questionId: Type.Optional(Type.String({ description: "Question ID for answer action" })),
		answer: Type.Optional(Type.String({ description: "Answer to question" })),
		approachId: Type.Optional(Type.String({ description: "Approach ID for select action" })),
		filesModified: Type.Optional(
			Type.Array(Type.String(), { description: "Files modified in implementation" }),
		),
		todosCompleted: Type.Optional(
			Type.Array(Type.String(), { description: "Todos completed in implementation" }),
		),
		complete: Type.Optional(Type.Boolean({ description: "Mark phase complete" })),
		findings: Type.Optional(Type.Array(Type.Any(), { description: "Review findings" })),
		findingId: Type.Optional(Type.String({ description: "Finding ID for addressing" })),
		keyDecision: Type.Optional(Type.String({ description: "Key decision to add to summary" })),
		nextStep: Type.Optional(Type.String({ description: "Next step to add to summary" })),
		limit: Type.Optional(Type.Number({ description: "Limit for sessions list" })),
		reason: Type.Optional(Type.String({ description: "Reason for cancel" })),
		enabled: Type.Optional(Type.Boolean({ description: "Enable/disable feature dev" })),
		resetStats: Type.Optional(Type.Boolean({ description: "Reset statistics" })),
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
			case "start": {
				const featureRequest = args.featureRequest as string;
				if (!featureRequest) {
					result = "Error: featureRequest is required for start action";
					break;
				}
				const session = manager.startSession(featureRequest);
				const phaseInfo = manager.getPhaseInfo(session.currentPhase);
				if (!phaseInfo) {
					result = `Error: Unknown phase: ${session.currentPhase}`;
					break;
				}
				result = `
## Feature Development Session Started

**Session ID:** ${session.id}
**Feature Request:** ${session.featureRequest}

${phaseInfo.name}

**Description:** ${phaseInfo.description}

**Actions:**
${phaseInfo.actions.map((a: string) => `- ${a}`).join("\n")}

Use \`featureDev({action: 'phase', phase: 'discovery'})\` to get detailed guidance for this phase.
`;
				break;
			}

			case "phase": {
				const phase = args.phase as FeaturePhase;
				const sessionId = args.sessionId as string | undefined;
				const session = sessionId ? manager.getSession(sessionId) : manager.getCurrentSession();

				if (!phase) {
					const currentSession = manager.getCurrentSession();
					if (currentSession) {
						const phaseInfo = manager.getPhaseInfo(currentSession.currentPhase);
						if (!phaseInfo) {
							result = `Error: Unknown phase: ${currentSession.currentPhase}`;
							break;
						}
						result = formatPhaseInfo(
							currentSession.currentPhase,
							phaseInfo,
							currentSession,
							manager,
						);
					} else {
						result = "Error: No active session. Use start action first.";
					}
					break;
				}

				const phaseInfo = manager.getPhaseInfo(phase);
				if (!phaseInfo) {
					result = `Error: Unknown phase: ${phase}`;
					break;
				}

				result = formatPhaseInfo(phase, phaseInfo, session ?? undefined, manager);
				break;
			}

			case "progress": {
				const sessionId = args.sessionId as string | undefined;
				const session = manager.progressToNextPhase(sessionId);

				if (!session) {
					result = "Error: Cannot progress - no more phases or session not found";
					break;
				}

				const phaseInfo = manager.getPhaseInfo(session.currentPhase);
				if (!phaseInfo) {
					result = `Error: Unknown phase: ${session.currentPhase}`;
					break;
				}
				result = `
## Progressed to ${phaseInfo.name}

**Completed phases:** ${session.completedPhases.join(", ")}

${formatPhaseInfo(session.currentPhase, phaseInfo, session, manager)}
`;
				break;
			}

			case "status": {
				const sessionId = args.sessionId as string | undefined;
				const session = sessionId ? manager.getSession(sessionId) : manager.getCurrentSession();

				if (!session) {
					result =
						"No active session. Use `featureDev({action: 'start', featureRequest: '...'})` to begin.";
					break;
				}

				const phaseInfo = manager.getPhaseInfo(session.currentPhase);
				result = `
## Feature Dev Status

**Session ID:** ${session.id}
**Feature Request:** ${session.featureRequest}
**Current Phase:** ${session.currentPhase} (${phaseInfo?.name || "Unknown"})
**Completed Phases:** ${session.completedPhases.join(", ") || "None"}

### Progress:
- Discovery: ${session.understanding ? "✅" : "⬜"}
- Exploration: ${session.keyFilesFound.length > 0 ? "✅" : "⬜"}
- Questions: ${session.questionsResolved ? "✅" : "⬜"}
- Architecture: ${session.architectureApproved ? "✅" : "⬜"}
- Implementation: ${session.implementationComplete ? "✅" : session.implementationStarted ? "🔄" : "⬜"}
- Review: ${session.reviewComplete ? "✅" : "⬜"}
- Summary: ${session.summaryGenerated ? "✅" : "⬜"}

### Files:
- Key files found: ${session.keyFilesFound.length}
- Files modified: ${session.filesModified.length}
`;
				break;
			}

			case "stats": {
				const stats = manager.getStats();
				result = `
## Feature Dev Statistics

**Sessions:**
- Started: ${stats.sessionsStarted}
- Completed: ${stats.sessionsCompleted}
- Abandoned: ${stats.sessionsAbandoned}
- Completion Rate: ${stats.completionRate.toFixed(1)}%

**Phases Completed:**
${Object.entries(stats.phasesCompleted)
	.map(([phase, count]) => `- ${phase}: ${count}`)
	.join("\n")}

**Agents:**
${Object.entries(stats.agentsLaunched)
	.map(([type, count]) => `- ${type}: ${count}`)
	.join("\n")}

**Questions:**
- Asked: ${stats.questionsAsked}
- Answered: ${stats.questionsAnswered}

**Reviews:**
- Completed: ${stats.reviewsCompleted}
- Findings addressed: ${stats.findingsAddressed}

**Average session time:** ${stats.avgSessionTime.toFixed(1)} minutes
`;
				break;
			}

			case "config": {
				const config = manager.getConfig();
				if (args.enabled !== undefined) {
					const enabled = args.enabled as boolean;
					if (enabled) {
						manager.enable();
					} else {
						manager.disable();
					}
					result = `Feature Dev ${enabled ? "enabled" : "disabled"}`;
				} else {
					result = `
## Feature Dev Configuration

- Enabled: ${config.enabled}
- Auto Phase Progression: ${config.autoPhaseProgression}
- Max Agents Per Phase: ${config.maxAgentsPerPhase}
- Min Confidence for Review: ${config.minConfidenceForReview}
- Skip Phases: ${config.skipPhases.join(", ") || "None"}
- Require Approval for Implementation: ${config.requireApprovalForImpl}
- Verbosity: ${config.verbosity}
`;
				}
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
