/**
 * Role-Based Multi-Agent Protocol (MetaGPT Pattern)
 *
 * Inspired by MetaGPT's "Software Company as Multi-Agent System" concept.
 * Assigns specialized roles to agents with SOP-based coordination.
 *
 * Key concepts:
 * - Code = SOP(Team) - Standard Operating Procedures for multi-agent coordination
 * - Specialized roles: ProductManager, Architect, ProjectManager, Engineer, QAEngineer
 * - Role-specific outputs and responsibilities
 * - Workflow phases with role transitions
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ============================================================================
// Types
// ============================================================================

/** Agent role types inspired by MetaGPT software company */
export type AgentRole =
	| "product-manager"
	| "architect"
	| "project-manager"
	| "engineer"
	| "qa-engineer"
	| "reviewer";

/** SOP workflow phases */
export type SOPPhase =
	| "requirement-analysis"
	| "design"
	| "planning"
	| "implementation"
	| "testing"
	| "review"
	| "completion";

/** Role-specific output artifacts */
export interface RoleOutput {
	role: AgentRole;
	phase: SOPPhase;
	artifacts: Artifact[];
	timestamp: string;
	metadata?: Record<string, unknown>;
}

/** Artifact types produced by roles */
export type ArtifactType =
	| "user-stories"
	| "competitive-analysis"
	| "requirements"
	| "data-structures"
	| "api-design"
	| "architecture-diagram"
	| "task-list"
	| "implementation-plan"
	| "code"
	| "test-plan"
	| "test-results"
	| "review-findings"
	| "summary";

/** Individual artifact */
export interface Artifact {
	type: ArtifactType;
	name: string;
	content: string;
	confidence: number; // 0-100
	dependencies?: ArtifactType[];
}

/** Agent role definition with responsibilities */
export interface AgentRoleDefinition {
	id: AgentRole;
	name: string;
	description: string;
	responsibilities: string[];
	inputs: ArtifactType[];
	outputs: ArtifactType[];
	sopSteps: string[]; // Standard Operating Procedure steps
	priority: number; // Role priority in workflow
}

/** SOP workflow definition */
export interface SOPWorkflow {
	phases: SOPPhase[];
	phaseRoles: Partial<Record<SOPPhase, AgentRole[]>>;
	phaseInputs: Partial<Record<SOPPhase, ArtifactType[]>>;
	phaseOutputs: Partial<Record<SOPPhase, ArtifactType[]>>;
	transitions: Partial<Record<SOPPhase, SOPPhase | "complete">>;
}

/** Role-based session state */
export interface RoleBasedSession {
	sessionId: string;
	workflow: SOPWorkflow;
	currentPhase: SOPPhase;
	activeRoles: AgentRole[];
	outputs: RoleOutput[];
	artifacts: Artifact[];
	startTime: string;
	lastUpdate: string;
	status: "active" | "paused" | "completed" | "failed";
}

/** Configuration */
export interface RoleBasedAgentsConfig {
	enabled: boolean;
	defaultWorkflow: "software-company" | "feature-development" | "code-review" | "custom";
	maxConcurrentRoles: number;
	artifactPersistence: boolean;
	confidenceThreshold: number; // Minimum confidence for artifact acceptance
	sopEnforcement: boolean; // Enforce SOP steps strictly
}

/** Statistics */
export interface RoleBasedAgentsStats {
	sessionsTotal: number;
	sessionsCompleted: number;
	sessionsActive: number;
	artifactsTotal: number;
	artifactsByRole: Record<AgentRole, number>;
	phasesCompleted: Record<SOPPhase, number>;
	averageSessionTime: number; // milliseconds
	roleUsage: Record<AgentRole, number>;
	workflowSuccessRates: Record<string, number>;
}

// ============================================================================
// Default Role Definitions (MetaGPT Software Company Pattern)
// ============================================================================

const DEFAULT_ROLES: AgentRoleDefinition[] = [
	{
		id: "product-manager",
		name: "Product Manager Agent",
		description: "Understands requirements, analyzes competition, writes user stories",
		responsibilities: [
			"Gather and clarify requirements",
			"Perform competitive analysis",
			"Write user stories and acceptance criteria",
			"Define product requirements document",
			"Prioritize features and scope",
		],
		inputs: ["user-stories"],
		outputs: ["user-stories", "competitive-analysis", "requirements"],
		sopSteps: [
			"1. Receive requirement input",
			"2. Clarify ambiguities and gather context",
			"3. Analyze competitive landscape",
			"4. Write user stories with acceptance criteria",
			"5. Produce requirements document",
			"6. Review with stakeholders",
		],
		priority: 100,
	},
	{
		id: "architect",
		name: "Architect Agent",
		description: "Designs system architecture, data structures, APIs based on requirements",
		responsibilities: [
			"Design system architecture",
			"Define data structures and models",
			"Design API interfaces",
			"Create architecture diagrams",
			"Evaluate technical feasibility",
			"Define design patterns and conventions",
		],
		inputs: ["requirements", "user-stories"],
		outputs: ["data-structures", "api-design", "architecture-diagram", "implementation-plan"],
		sopSteps: [
			"1. Review requirements from Product Manager",
			"2. Analyze system constraints and dependencies",
			"3. Design data structures and models",
			"4. Design API interfaces",
			"5. Create architecture diagram",
			"6. Produce implementation plan",
			"7. Validate design feasibility",
		],
		priority: 90,
	},
	{
		id: "project-manager",
		name: "Project Manager Agent",
		description: "Creates task breakdown, schedules, manages workflow transitions",
		responsibilities: [
			"Break down implementation into tasks",
			"Assign tasks to appropriate roles",
			"Manage workflow transitions",
			"Track progress and blockers",
			"Coordinate between roles",
			"Manage timeline and milestones",
		],
		inputs: ["implementation-plan", "architecture-diagram"],
		outputs: ["task-list"],
		sopSteps: [
			"1. Review architecture from Architect",
			"2. Break down implementation into tasks",
			"3. Assign tasks to Engineer roles",
			"4. Create project timeline",
			"5. Monitor progress",
			"6. Handle blockers and dependencies",
		],
		priority: 80,
	},
	{
		id: "engineer",
		name: "Engineer Agent",
		description: "Writes code, implements features, creates documentation",
		responsibilities: [
			"Implement features according to design",
			"Write clean, maintainable code",
			"Create unit tests",
			"Document implementation",
			"Follow coding standards",
			"Report implementation status",
		],
		inputs: ["task-list", "data-structures", "api-design"],
		outputs: ["code", "test-plan"],
		sopSteps: [
			"1. Receive task from Project Manager",
			"2. Review design specifications",
			"3. Implement feature according to design",
			"4. Write unit tests",
			"5. Document implementation",
			"6. Submit for review",
		],
		priority: 70,
	},
	{
		id: "qa-engineer",
		name: "QA Engineer Agent",
		description: "Tests implementation, validates quality, reports issues",
		responsibilities: [
			"Execute test plans",
			"Validate acceptance criteria",
			"Report bugs and issues",
			"Verify bug fixes",
			"Ensure quality standards",
			"Document test results",
		],
		inputs: ["code", "test-plan", "requirements"],
		outputs: ["test-results", "review-findings"],
		sopSteps: [
			"1. Review test plan",
			"2. Execute tests",
			"3. Validate against acceptance criteria",
			"4. Report bugs and issues",
			"5. Verify fixes",
			"6. Document test results",
		],
		priority: 60,
	},
	{
		id: "reviewer",
		name: "Reviewer Agent",
		description: "Reviews code quality, validates architecture, provides feedback",
		responsibilities: [
			"Review code for quality",
			"Validate architecture adherence",
			"Provide improvement suggestions",
			"Check coding standards",
			"Review documentation",
			"Approve or request changes",
		],
		inputs: ["code", "architecture-diagram"],
		outputs: ["review-findings", "summary"],
		sopSteps: [
			"1. Review implementation",
			"2. Check architecture adherence",
			"3. Validate coding standards",
			"4. Provide improvement suggestions",
			"5. Approve or request changes",
			"6. Document review findings",
		],
		priority: 50,
	},
];

// ============================================================================
// Default SOP Workflows
// ============================================================================

const SOFTWARE_COMPANY_WORKFLOW: SOPWorkflow = {
	phases: [
		"requirement-analysis",
		"design",
		"planning",
		"implementation",
		"testing",
		"review",
		"completion",
	],
	phaseRoles: {
		"requirement-analysis": ["product-manager"],
		design: ["architect"],
		planning: ["project-manager"],
		implementation: ["engineer"],
		testing: ["qa-engineer"],
		review: ["reviewer"],
		completion: ["reviewer", "product-manager"],
	},
	phaseInputs: {
		"requirement-analysis": [],
		design: ["requirements", "user-stories"],
		planning: ["architecture-diagram", "implementation-plan"],
		implementation: ["task-list", "data-structures", "api-design"],
		testing: ["code", "test-plan"],
		review: ["code", "test-results"],
		completion: ["review-findings", "code"],
	},
	phaseOutputs: {
		"requirement-analysis": ["user-stories", "competitive-analysis", "requirements"],
		design: ["data-structures", "api-design", "architecture-diagram", "implementation-plan"],
		planning: ["task-list"],
		implementation: ["code", "test-plan"],
		testing: ["test-results", "review-findings"],
		review: ["review-findings", "summary"],
		completion: ["summary"],
	},
	transitions: {
		"requirement-analysis": "design",
		design: "planning",
		planning: "implementation",
		implementation: "testing",
		testing: "review",
		review: "completion",
		completion: "complete",
	},
};

const FEATURE_DEVELOPMENT_WORKFLOW: SOPWorkflow = {
	phases: ["requirement-analysis", "design", "implementation", "testing", "completion"],
	phaseRoles: {
		"requirement-analysis": ["product-manager", "architect"],
		design: ["architect"],
		implementation: ["engineer"],
		testing: ["qa-engineer"],
		completion: ["reviewer"],
	},
	phaseInputs: {
		"requirement-analysis": [],
		design: ["requirements"],
		implementation: ["task-list", "api-design"],
		testing: ["code"],
		completion: ["test-results"],
	},
	phaseOutputs: {
		"requirement-analysis": ["requirements", "architecture-diagram"],
		design: ["api-design", "implementation-plan"],
		implementation: ["code", "test-plan"],
		testing: ["test-results"],
		completion: ["summary"],
	},
	transitions: {
		"requirement-analysis": "design",
		design: "implementation",
		implementation: "testing",
		testing: "completion",
		completion: "complete",
	},
};

const CODE_REVIEW_WORKFLOW: SOPWorkflow = {
	phases: ["review", "completion"],
	phaseRoles: {
		review: ["reviewer", "qa-engineer"],
		completion: ["reviewer"],
	},
	phaseInputs: {
		review: ["code"],
		completion: ["review-findings"],
	},
	phaseOutputs: {
		review: ["review-findings"],
		completion: ["summary"],
	},
	transitions: {
		review: "completion",
		completion: "complete",
	},
};

// ============================================================================
// RoleBasedAgentManager Class
// ============================================================================

export class RoleBasedAgentManager {
	private roles: Map<AgentRole, AgentRoleDefinition> = new Map();
	private workflows: Map<string, SOPWorkflow> = new Map();
	private sessions: Map<string, RoleBasedSession> = new Map();
	private config: RoleBasedAgentsConfig;
	private stats: RoleBasedAgentsStats;
	private dataPath: string;

	constructor(config?: Partial<RoleBasedAgentsConfig>) {
		this.config = {
			enabled: true,
			defaultWorkflow: "software-company",
			maxConcurrentRoles: 3,
			artifactPersistence: true,
			confidenceThreshold: 80,
			sopEnforcement: false,
			...config,
		};

		this.stats = {
			sessionsTotal: 0,
			sessionsCompleted: 0,
			sessionsActive: 0,
			artifactsTotal: 0,
			artifactsByRole: {
				"product-manager": 0,
				architect: 0,
				"project-manager": 0,
				engineer: 0,
				"qa-engineer": 0,
				reviewer: 0,
			},
			phasesCompleted: {
				"requirement-analysis": 0,
				design: 0,
				planning: 0,
				implementation: 0,
				testing: 0,
				review: 0,
				completion: 0,
			},
			averageSessionTime: 0,
			roleUsage: {
				"product-manager": 0,
				architect: 0,
				"project-manager": 0,
				engineer: 0,
				"qa-engineer": 0,
				reviewer: 0,
			},
			workflowSuccessRates: {},
		};

		this.dataPath = path.join(process.env.HOME || "~", ".paimon", "role-based-agents.json");

		// Initialize default roles
		for (const role of DEFAULT_ROLES) {
			this.roles.set(role.id, role);
		}

		// Initialize default workflows
		this.workflows.set("software-company", SOFTWARE_COMPANY_WORKFLOW);
		this.workflows.set("feature-development", FEATURE_DEVELOPMENT_WORKFLOW);
		this.workflows.set("code-review", CODE_REVIEW_WORKFLOW);

		this.loadState();
	}

	// --------------------------------------------------------------------------
	// Role Management
	// --------------------------------------------------------------------------

	/** Get all available roles */
	getRoles(): AgentRoleDefinition[] {
		return Array.from(this.roles.values());
	}

	/** Get specific role definition */
	getRole(roleId: AgentRole): AgentRoleDefinition | undefined {
		return this.roles.get(roleId);
	}

	/** Add custom role */
	addRole(role: AgentRoleDefinition): boolean {
		if (this.roles.has(role.id)) {
			return false;
		}
		this.roles.set(role.id, role);
		this.saveState();
		return true;
	}

	/** Remove role */
	removeRole(roleId: AgentRole): boolean {
		if (!this.roles.has(roleId)) {
			return false;
		}
		this.roles.delete(roleId);
		this.saveState();
		return true;
	}

	/** Get roles for a phase */
	getPhaseRoles(phase: SOPPhase, workflowId?: string): AgentRole[] {
		const workflow = this.workflows.get(workflowId || this.config.defaultWorkflow);
		return workflow?.phaseRoles[phase] || [];
	}

	// --------------------------------------------------------------------------
	// Workflow Management
	// --------------------------------------------------------------------------

	/** Get all available workflows */
	getWorkflows(): string[] {
		return Array.from(this.workflows.keys());
	}

	/** Get workflow definition */
	getWorkflow(workflowId: string): SOPWorkflow | undefined {
		return this.workflows.get(workflowId);
	}

	/** Add custom workflow */
	addWorkflow(workflowId: string, workflow: SOPWorkflow): boolean {
		if (this.workflows.has(workflowId)) {
			return false;
		}
		this.workflows.set(workflowId, workflow);
		this.saveState();
		return true;
	}

	/** Remove workflow */
	removeWorkflow(workflowId: string): boolean {
		if (!this.workflows.has(workflowId)) {
			return false;
		}
		this.workflows.delete(workflowId);
		this.saveState();
		return true;
	}

	// --------------------------------------------------------------------------
	// Session Management
	// --------------------------------------------------------------------------

	/** Start a new role-based session */
	startSession(workflowId?: string, description?: string): RoleBasedSession {
		const workflow = this.workflows.get(workflowId || this.config.defaultWorkflow);
		if (!workflow) {
			throw new Error(`Workflow not found: ${workflowId}`);
		}

		const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
		const now = new Date().toISOString();

		const session: RoleBasedSession = {
			sessionId,
			workflow,
			currentPhase: workflow.phases[0],
			activeRoles: workflow.phaseRoles[workflow.phases[0]] || [],
			outputs: [],
			artifacts: [],
			startTime: now,
			lastUpdate: now,
			status: "active",
		};

		this.sessions.set(sessionId, session);
		this.stats.sessionsTotal++;
		this.stats.sessionsActive++;

		// Track role usage
		for (const role of session.activeRoles) {
			this.stats.roleUsage[role]++;
		}

		this.saveState();
		return session;
	}

	/** Get session status */
	getSession(sessionId: string): RoleBasedSession | undefined {
		return this.sessions.get(sessionId);
	}

	/** List all sessions */
	listSessions(filter?: "active" | "completed" | "failed"): RoleBasedSession[] {
		const sessions = Array.from(this.sessions.values());
		if (!filter) return sessions;
		return sessions.filter((s) => s.status === filter);
	}

	/** Advance session to next phase */
	advancePhase(sessionId: string): RoleBasedSession | undefined {
		const session = this.sessions.get(sessionId);
		if (!session || session.status !== "active") {
			return undefined;
		}

		const nextPhase = session.workflow.transitions[session.currentPhase];
		if (nextPhase === "complete") {
			session.status = "completed";
			session.currentPhase = "completion";
			this.stats.sessionsCompleted++;
			this.stats.sessionsActive--;
			this.stats.phasesCompleted[session.currentPhase]++;
		} else if (typeof nextPhase === "string") {
			session.currentPhase = nextPhase;
			session.activeRoles = session.workflow.phaseRoles[nextPhase] || [];
			this.stats.phasesCompleted[session.currentPhase]++;

			// Track role usage for new phase
			for (const role of session.activeRoles) {
				this.stats.roleUsage[role]++;
			}
		}

		session.lastUpdate = new Date().toISOString();
		this.saveState();
		return session;
	}

	/** Record role output */
	recordOutput(sessionId: string, role: AgentRole, artifacts: Artifact[]): RoleOutput | undefined {
		const session = this.sessions.get(sessionId);
		if (!session || session.status !== "active") {
			return undefined;
		}

		// Filter artifacts by confidence threshold
		const validArtifacts = artifacts.filter((a) => a.confidence >= this.config.confidenceThreshold);

		const output: RoleOutput = {
			role,
			phase: session.currentPhase,
			artifacts: validArtifacts,
			timestamp: new Date().toISOString(),
		};

		session.outputs.push(output);
		session.artifacts.push(...validArtifacts);

		// Track stats
		this.stats.artifactsTotal += validArtifacts.length;
		this.stats.artifactsByRole[role] += validArtifacts.length;

		session.lastUpdate = new Date().toISOString();
		this.saveState();
		return output;
	}

	/** Complete session */
	completeSession(sessionId: string, summary?: string): RoleBasedSession | undefined {
		const session = this.sessions.get(sessionId);
		if (!session) {
			return undefined;
		}

		session.status = "completed";
		session.lastUpdate = new Date().toISOString();

		if (summary) {
			const summaryArtifact: Artifact = {
				type: "summary",
				name: "Session Summary",
				content: summary,
				confidence: 100,
			};
			session.artifacts.push(summaryArtifact);
		}

		// Calculate session time
		const startTime = new Date(session.startTime).getTime();
		const endTime = new Date(session.lastUpdate).getTime();
		const sessionTime = endTime - startTime;
		this.stats.averageSessionTime =
			(this.stats.averageSessionTime * this.stats.sessionsCompleted + sessionTime) /
			(this.stats.sessionsCompleted + 1);

		this.stats.sessionsCompleted++;
		this.stats.sessionsActive--;
		this.stats.phasesCompleted[session.currentPhase]++;

		// Track workflow success rate
		const workflowId = this.config.defaultWorkflow;
		const currentRate = this.stats.workflowSuccessRates[workflowId] || 0;
		const totalSessions = this.stats.sessionsTotal;
		this.stats.workflowSuccessRates[workflowId] =
			(currentRate * (totalSessions - 1) + 1) / totalSessions;

		this.saveState();
		return session;
	}

	/** Cancel session */
	cancelSession(sessionId: string, reason?: string): RoleBasedSession | undefined {
		const session = this.sessions.get(sessionId);
		if (!session) {
			return undefined;
		}

		session.status = "failed";
		session.lastUpdate = new Date().toISOString();

		this.stats.sessionsActive--;

		// Track workflow success rate
		const workflowId = this.config.defaultWorkflow;
		const currentRate = this.stats.workflowSuccessRates[workflowId] || 0;
		const totalSessions = this.stats.sessionsTotal;
		this.stats.workflowSuccessRates[workflowId] =
			(currentRate * (totalSessions - 1) + 0) / totalSessions;

		this.saveState();
		return session;
	}

	// --------------------------------------------------------------------------
	// SOP Guidance
	// --------------------------------------------------------------------------

	/** Get SOP steps for a role in current phase */
	getSOPGuidance(role: AgentRole): string[] {
		const roleDef = this.roles.get(role);
		return roleDef?.sopSteps || [];
	}

	/** Get phase guidance */
	getPhaseGuidance(
		phase: SOPPhase,
		workflowId?: string,
	): {
		roles: AgentRole[];
		inputs: ArtifactType[];
		outputs: ArtifactType[];
		nextPhase: SOPPhase | "complete";
	} {
		const workflow = this.workflows.get(workflowId || this.config.defaultWorkflow);
		if (!workflow) {
			return { roles: [], inputs: [], outputs: [], nextPhase: "complete" };
		}

		return {
			roles: workflow.phaseRoles[phase] || [],
			inputs: workflow.phaseInputs[phase] || [],
			outputs: workflow.phaseOutputs[phase] || [],
			nextPhase: workflow.transitions[phase] || "complete",
		};
	}

	/** Get full workflow guidance */
	getWorkflowGuidance(workflowId?: string): string {
		const workflow = this.workflows.get(workflowId || this.config.defaultWorkflow);
		if (!workflow) {
			return "No workflow found";
		}

		const lines: string[] = [
			`## SOP Workflow: ${workflowId || this.config.defaultWorkflow}`,
			"",
			"| Phase | Roles | Inputs | Outputs | Next |",
			"|-------|-------|--------|---------|------|",
		];

		for (const phase of workflow.phases) {
			const roles = workflow.phaseRoles[phase]?.join(", ") || "-";
			const inputs = workflow.phaseInputs[phase]?.join(", ") || "-";
			const outputs = workflow.phaseOutputs[phase]?.join(", ") || "-";
			const next = workflow.transitions[phase];
			lines.push(`| ${phase} | ${roles} | ${inputs} | ${outputs} | ${next} |`);
		}

		return lines.join("\n");
	}

	// --------------------------------------------------------------------------
	// Statistics & Configuration
	// --------------------------------------------------------------------------

	/** Get statistics */
	getStats(): RoleBasedAgentsStats {
		return this.stats;
	}

	/** Get configuration */
	getConfig(): RoleBasedAgentsConfig {
		return this.config;
	}

	/** Update configuration */
	setConfig(updates: Partial<RoleBasedAgentsConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveState();
	}

	/** Reset statistics */
	resetStats(): void {
		this.stats = {
			sessionsTotal: 0,
			sessionsCompleted: 0,
			sessionsActive: 0,
			artifactsTotal: 0,
			artifactsByRole: {
				"product-manager": 0,
				architect: 0,
				"project-manager": 0,
				engineer: 0,
				"qa-engineer": 0,
				reviewer: 0,
			},
			phasesCompleted: {
				"requirement-analysis": 0,
				design: 0,
				planning: 0,
				implementation: 0,
				testing: 0,
				review: 0,
				completion: 0,
			},
			averageSessionTime: 0,
			roleUsage: {
				"product-manager": 0,
				architect: 0,
				"project-manager": 0,
				engineer: 0,
				"qa-engineer": 0,
				reviewer: 0,
			},
			workflowSuccessRates: {},
		};
		this.saveState();
	}

	/** Clear old sessions */
	clearSessions(keepCount = 10): void {
		const sessions = Array.from(this.sessions.entries()).sort(
			(a, b) => new Date(b[1].startTime).getTime() - new Date(a[1].startTime).getTime(),
		);

		// Keep only recent sessions
		const toKeep = sessions.slice(0, keepCount);
		this.sessions = new Map(toKeep);
		this.saveState();
	}

	// --------------------------------------------------------------------------
	// Persistence
	// --------------------------------------------------------------------------

	private loadState(): void {
		try {
			if (fs.existsSync(this.dataPath)) {
				const data = JSON.parse(fs.readFileSync(this.dataPath, "utf-8"));
				if (data.config) this.config = { ...this.config, ...data.config };
				if (data.stats) this.stats = { ...this.stats, ...data.stats };
				if (data.sessions) {
					this.sessions = new Map(Object.entries(data.sessions));
				}
			}
		} catch {
			// Ignore load errors
		}
	}

	private saveState(): void {
		try {
			const dir = path.dirname(this.dataPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}

			const data = {
				config: this.config,
				stats: this.stats,
				sessions: Object.fromEntries(this.sessions),
			};
			fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
		} catch {
			// Ignore save errors
		}
	}
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: RoleBasedAgentManager | undefined;

export function getRoleBasedAgentManager(): RoleBasedAgentManager {
	if (!instance) {
		instance = new RoleBasedAgentManager();
	}
	return instance;
}
