/**
 * Role-Based Multi-Agent Protocol Tool (MetaGPT Pattern)
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { AgentRole, Artifact, SOPPhase } from "../role-based-agents.js";
import { type RoleBasedAgentManager, getRoleBasedAgentManager } from "../role-based-agents.js";

// ============================================================================
// Tool Definition
// ============================================================================

export const roleBasedAgentsToolDef: AgentTool = {
	name: "roleBasedAgents",
	label: "Role-Based Multi-Agent Protocol",
	description: `Manage Role-Based Multi-Agent Protocol (MetaGPT Pattern) - Specialized agent roles with SOP-based workflow coordination

Actions:
- start: Start a new role-based session (workflowId optional)
- advance: Advance session to next phase
- output: Record role output artifacts (requires sessionId, roleId, artifacts)
- complete: Complete session (requires sessionId, summary optional)
- cancel: Cancel session (requires sessionId, reason optional)
- session: Get session details (requires sessionId)
- sessions: List all sessions (filter: active/completed/failed)
- roles: List all agent roles
- role: Get role details (requires roleId)
- workflows: List all workflows
- workflow: Get workflow guidance (workflowId optional)
- sop: Get SOP steps for a role (requires roleId)
- phase-guidance: Get phase guidance (phase, workflowId optional)
- stats: View statistics
- config: View/update configuration
- reset: Reset statistics
- clear: Clear old sessions
- help: Show help

Example usage:
roleBasedAgents({action: 'start', workflowId: 'software-company'})
roleBasedAgents({action: 'advance', sessionId: 'session-123'})
roleBasedAgents({action: 'roles'})`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: start, advance, output, complete, cancel, session, sessions, roles, role, workflows, workflow, sop, phase-guidance, stats, config, reset, clear, help",
		}),
		sessionId: Type.Optional(Type.String()),
		workflowId: Type.Optional(Type.String()),
		roleId: Type.Optional(Type.String()),
		phase: Type.Optional(Type.String()),
		summary: Type.Optional(Type.String()),
		reason: Type.Optional(Type.String()),
		description: Type.Optional(Type.String()),
		artifacts: Type.Optional(
			Type.Array(
				Type.Object({
					type: Type.String(),
					name: Type.String(),
					content: Type.String(),
					confidence: Type.Number(),
				}),
			),
		),
	}),
	execute: async (
		_toolCallId: string,
		params: unknown,
	): Promise<AgentToolResult<{ success: boolean; action: string }>> => {
		const p = params as Record<string, unknown>;
		const manager = getRoleBasedAgentManager();
		const output = await executeAction(manager, p);
		return {
			content: [{ type: "text", text: output }],
			details: { success: true, action: String(p.action) },
		};
	},
};

// ============================================================================
// Action Implementation
// ============================================================================

async function executeAction(
	manager: RoleBasedAgentManager,
	params: Record<string, unknown>,
): Promise<string> {
	const action = params.action as string;

	switch (action) {
		case "start":
			return handleStart(manager, params);
		case "advance":
			return handleAdvance(manager, params);
		case "output":
			return handleOutput(manager, params);
		case "complete":
			return handleComplete(manager, params);
		case "cancel":
			return handleCancel(manager, params);
		case "session":
			return handleSession(manager, params);
		case "sessions":
			return handleSessions(manager, params);
		case "roles":
			return handleRoles(manager);
		case "role":
			return handleRole(manager, params);
		case "workflows":
			return handleWorkflows(manager);
		case "workflow":
			return handleWorkflow(manager, params);
		case "sop":
			return handleSOP(manager, params);
		case "phase-guidance":
			return handlePhaseGuidance(manager, params);
		case "stats":
			return handleStats(manager);
		case "config":
			return handleConfig(manager);
		case "reset":
			return handleReset(manager);
		case "clear":
			return handleClear(manager);
		case "help":
			return handleHelp();
		default:
			return `Unknown action: ${action}`;
	}
}

// Helper functions
function formatList(items: string[]): string {
	if (items.length === 0) return "None";
	return items.join(", ");
}

function formatTableRow(cells: string[]): string {
	return `| ${cells.join(" | ")} |`;
}

function safeString(input: string | undefined): string {
	if (!input) return "";
	return input.replace(/[;'"\n\r]/g, "");
}

// Action Handlers
function handleStart(manager: RoleBasedAgentManager, params: Record<string, unknown>): string {
	try {
		const session = manager.startSession(params.workflowId as string | undefined);
		const guidance = manager.getPhaseGuidance(
			session.currentPhase,
			params.workflowId as string | undefined,
		);
		const workflowName = (params.workflowId as string) || manager.getConfig().defaultWorkflow;

		const lines: string[] = [
			"## Role-Based Session Started",
			"",
			`**Session ID:** ${session.sessionId}`,
			`**Workflow:** ${workflowName}`,
			`**Current Phase:** ${session.currentPhase}`,
			`**Active Roles:** ${formatList(session.activeRoles)}`,
			"",
			"### Phase Guidance",
			"| Property | Value |",
			"|----------|-------|",
			formatTableRow(["Roles", formatList(guidance.roles)]),
			formatTableRow(["Required Inputs", formatList(guidance.inputs) || "None"]),
			formatTableRow(["Expected Outputs", formatList(guidance.outputs)]),
			formatTableRow(["Next Phase", guidance.nextPhase]),
			"",
			"### SOP Steps for Active Roles",
		];

		for (const r of session.activeRoles) {
			const sop = manager.getSOPGuidance(r);
			const role = manager.getRole(r);
			lines.push(`\n**${role?.name || r}:**`);
			for (const s of sop) {
				lines.push(`  ${s}`);
			}
		}

		lines.push("");
		lines.push(
			`Use roleBasedAgents with action 'advance' and sessionId '${safeString(session.sessionId)}' to move to next phase.`,
		);

		return lines.join("\n");
	} catch (error) {
		return `Error starting session: ${safeString(String(error))}`;
	}
}

function handleAdvance(manager: RoleBasedAgentManager, params: Record<string, unknown>): string {
	if (!params.sessionId) {
		return "Error: sessionId required for advance action";
	}

	const session = manager.advancePhase(params.sessionId as string);
	if (!session) {
		return `Error: Session not found or not active: ${safeString(params.sessionId as string)}`;
	}

	if (session.status === "completed") {
		const duration = Math.round(
			(new Date(session.lastUpdate).getTime() - new Date(session.startTime).getTime()) / 1000,
		);

		const lines: string[] = [
			"## Session Completed",
			"",
			`**Session ID:** ${session.sessionId}`,
			`**Total Artifacts:** ${session.artifacts.length}`,
			`**Duration:** ${duration}s`,
		];

		return lines.join("\n");
	}

	const guidance = manager.getPhaseGuidance(session.currentPhase);

	const lines: string[] = [
		"## Phase Advanced",
		"",
		`**Session ID:** ${session.sessionId}`,
		`**New Phase:** ${session.currentPhase}`,
		`**Active Roles:** ${formatList(session.activeRoles)}`,
		"",
		"### Phase Guidance",
		"| Property | Value |",
		"|----------|-------|",
		formatTableRow(["Roles", formatList(guidance.roles)]),
		formatTableRow(["Required Inputs", formatList(guidance.inputs) || "None"]),
		formatTableRow(["Expected Outputs", formatList(guidance.outputs)]),
		formatTableRow(["Next Phase", guidance.nextPhase]),
	];

	return lines.join("\n");
}

function handleOutput(manager: RoleBasedAgentManager, params: Record<string, unknown>): string {
	if (!params.sessionId) {
		return "Error: sessionId required for output action";
	}
	if (!params.roleId) {
		return "Error: roleId required for output action";
	}
	if (!params.artifacts) {
		return "Error: artifacts array required for output action";
	}

	const output = manager.recordOutput(
		params.sessionId as string,
		params.roleId as AgentRole,
		params.artifacts as Artifact[],
	);

	if (!output) {
		return `Error: Session not found or not active: ${safeString(params.sessionId as string)}`;
	}

	return `## Output Recorded\n\n**Session:** ${safeString(params.sessionId as string)}\n**Role:** ${safeString(params.roleId as string)}\n**Artifacts:** ${output.artifacts.length}`;
}

function handleComplete(manager: RoleBasedAgentManager, params: Record<string, unknown>): string {
	if (!params.sessionId) {
		return "Error: sessionId required for complete action";
	}

	const session = manager.completeSession(
		params.sessionId as string,
		params.summary as string | undefined,
	);
	if (!session) {
		return `Error: Session not found: ${safeString(params.sessionId as string)}`;
	}

	return `## Session Completed\n\n**Session ID:** ${session.sessionId}\n**Status:** ${session.status}`;
}

function handleCancel(manager: RoleBasedAgentManager, params: Record<string, unknown>): string {
	if (!params.sessionId) {
		return "Error: sessionId required for cancel action";
	}

	const session = manager.cancelSession(
		params.sessionId as string,
		params.reason as string | undefined,
	);
	if (!session) {
		return `Error: Session not found: ${safeString(params.sessionId as string)}`;
	}

	return `## Session Cancelled\n\n**Session ID:** ${session.sessionId}\n**Status:** ${session.status}`;
}

function handleSession(manager: RoleBasedAgentManager, params: Record<string, unknown>): string {
	if (!params.sessionId) {
		return "Error: sessionId required for session action";
	}

	const session = manager.getSession(params.sessionId as string);
	if (!session) {
		return `Error: Session not found: ${safeString(params.sessionId as string)}`;
	}

	return `## Session Details\n\n**Session ID:** ${session.sessionId}\n**Status:** ${session.status}\n**Phase:** ${session.currentPhase}`;
}

function handleSessions(manager: RoleBasedAgentManager, _params: Record<string, unknown>): string {
	const sessions = manager.listSessions();
	return `## All Sessions\n\n**Total:** ${sessions.length}\n**Active:** ${sessions.filter((s) => s.status === "active").length}`;
}

function handleRoles(manager: RoleBasedAgentManager): string {
	const roles = manager.getRoles();

	const lines: string[] = [
		"## Agent Roles (MetaGPT Pattern)",
		"",
		"| Role | Priority | Description |",
		"|------|----------|-------------|",
	];

	const sortedRoles = roles.sort((a, b) => b.priority - a.priority);
	for (const r of sortedRoles) {
		lines.push(formatTableRow([r.id, String(r.priority), r.description.slice(0, 40)]));
	}

	return lines.join("\n");
}

function handleRole(manager: RoleBasedAgentManager, params: Record<string, unknown>): string {
	if (!params.roleId) {
		return "Error: roleId required for role action";
	}

	const role = manager.getRole(params.roleId as AgentRole);
	if (!role) {
		return `Error: Role not found: ${safeString(params.roleId as string)}`;
	}

	const lines: string[] = [
		`## Role: ${role.name}`,
		"",
		`**ID:** ${role.id}`,
		`**Priority:** ${role.priority}`,
		"",
		"### Description",
		role.description,
		"",
		"### Responsibilities",
	];

	for (const r of role.responsibilities) {
		lines.push(`- ${r}`);
	}

	return lines.join("\n");
}

function handleWorkflows(manager: RoleBasedAgentManager): string {
	const workflows = manager.getWorkflows();

	const lines: string[] = [
		"## SOP Workflows",
		"",
		"| Workflow | Phases |",
		"|----------|--------|",
	];

	for (const w of workflows) {
		const wf = manager.getWorkflow(w);
		lines.push(formatTableRow([w, String(wf?.phases.length || 0)]));
	}

	return lines.join("\n");
}

function handleWorkflow(manager: RoleBasedAgentManager, params: Record<string, unknown>): string {
	return manager.getWorkflowGuidance(params.workflowId as string | undefined);
}

function handleSOP(manager: RoleBasedAgentManager, params: Record<string, unknown>): string {
	if (!params.roleId) {
		return "Error: roleId required for sop action";
	}

	const sop = manager.getSOPGuidance(params.roleId as AgentRole);
	const role = manager.getRole(params.roleId as AgentRole);

	const lines: string[] = [`## SOP for ${role?.name || params.roleId}`, ""];

	for (const s of sop) {
		lines.push(s);
	}

	return lines.join("\n");
}

function handlePhaseGuidance(
	manager: RoleBasedAgentManager,
	params: Record<string, unknown>,
): string {
	if (!params.phase) {
		return "Error: phase required for phase-guidance action";
	}

	const guidance = manager.getPhaseGuidance(
		params.phase as SOPPhase,
		params.workflowId as string | undefined,
	);

	const lines: string[] = [
		`## Phase Guidance: ${params.phase}`,
		"",
		"| Property | Value |",
		"|----------|-------|",
		formatTableRow(["Active Roles", formatList(guidance.roles)]),
		formatTableRow(["Required Inputs", formatList(guidance.inputs) || "None"]),
		formatTableRow(["Expected Outputs", formatList(guidance.outputs)]),
		formatTableRow(["Next Phase", guidance.nextPhase]),
	];

	return lines.join("\n");
}

function handleStats(manager: RoleBasedAgentManager): string {
	const stats = manager.getStats();

	const lines: string[] = [
		"## Role-Based Agents Statistics",
		"",
		"### Sessions",
		"| Metric | Value |",
		"|--------|-------|",
		formatTableRow(["Total", String(stats.sessionsTotal)]),
		formatTableRow(["Completed", String(stats.sessionsCompleted)]),
		formatTableRow(["Active", String(stats.sessionsActive)]),
	];

	return lines.join("\n");
}

function handleConfig(manager: RoleBasedAgentManager): string {
	const config = manager.getConfig();

	const lines: string[] = [
		"## Configuration",
		"",
		"| Setting | Value |",
		"|---------|-------|",
		formatTableRow(["enabled", String(config.enabled)]),
		formatTableRow(["defaultWorkflow", config.defaultWorkflow]),
		formatTableRow(["confidenceThreshold", `${config.confidenceThreshold}%`]),
	];

	return lines.join("\n");
}

function handleReset(manager: RoleBasedAgentManager): string {
	manager.resetStats();
	return "Statistics reset to zero.";
}

function handleClear(manager: RoleBasedAgentManager): string {
	manager.clearSessions(10);
	return "Old sessions cleared. Keeping 10 most recent.";
}

function handleHelp(): string {
	const lines: string[] = [
		"## Role-Based Multi-Agent Protocol Help",
		"",
		"Inspired by MetaGPT Software Company as Multi-Agent System concept.",
		"Key principle: Code equals SOP(Team) - Standard Operating Procedures for multi-agent coordination.",
		"",
		"### Quick Start",
		"1. Start session: roleBasedAgents({action: 'start', workflowId: 'software-company'})",
		"2. Get roles: roleBasedAgents({action: 'roles'})",
		"3. Get SOP: roleBasedAgents({action: 'sop', roleId: 'architect'})",
		"4. Advance phase: roleBasedAgents({action: 'advance', sessionId: '...'})",
		"",
		"### Default Roles",
		"- product-manager: Requirements, user stories",
		"- architect: Architecture, APIs",
		"- project-manager: Tasks, scheduling",
		"- engineer: Implementation",
		"- qa-engineer: Testing, validation",
		"- reviewer: Quality review",
	];

	return lines.join("\n");
}
