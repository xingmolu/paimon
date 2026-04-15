/**
 * Feature Dev 7-Phase Workflow (Claude Code Pattern)
 *
 * A comprehensive, structured workflow for feature development with
 * 7 phases: Discovery → Exploration → Questions → Architecture →
 * Implementation → Review → Summary.
 *
 * This orchestrates existing skills (explore-code, plan-architecture,
 * review-changes) in a structured approach.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Phase identifiers for the 7-phase workflow
 */
export type FeaturePhase =
	| "discovery" // Phase 1: Understand what to build
	| "exploration" // Phase 2: Explore codebase with agents
	| "questions" // Phase 3: Ask clarifying questions
	| "architecture" // Phase 4: Design implementation approaches
	| "implementation" // Phase 5: Build the feature
	| "review" // Phase 6: Quality review with agents
	| "summary"; // Phase 7: Document what was done

/**
 * Agent type for specialized subagents
 */
export type AgentType = "code-explorer" | "code-architect" | "code-reviewer";

/**
 * Agent focus area
 */
export type AgentFocus =
	| "similar-features" // Find similar existing features
	| "architecture-map" // Map architecture and abstractions
	| "current-impl" // Analyze current implementation
	| "minimal-changes" // Smallest change, maximum reuse
	| "clean-architecture" // Maintainability, elegant abstractions
	| "pragmatic-balance" // Speed + quality balance
	| "simplicity-dry" // Code quality and maintainability
	| "bugs-correctness" // Functional correctness
	| "conventions"; // Project standards and patterns

/**
 * Agent task for parallel execution
 */
export interface AgentTask {
	id: string;
	type: AgentType;
	focus: AgentFocus;
	prompt: string;
	status: "pending" | "running" | "completed" | "failed";
	result?: string;
	keyFiles?: string[];
	insights?: string[];
	startTime?: string;
	endTime?: string;
}

/**
 * Clarifying question
 */
export interface ClarifyingQuestion {
	id: string;
	category:
		| "edge-cases"
		| "error-handling"
		| "integration"
		| "backward-compat"
		| "performance"
		| "requirements";
	question: string;
	context: string;
	answered: boolean;
	answer?: string;
	priority: number;
}

/**
 * Architecture approach
 */
export interface ArchitectureApproach {
	id: string;
	name: string;
	description: string;
	pros: string[];
	cons: string[];
	filesToModify: string[];
	estimatedComplexity: "low" | "medium" | "high";
	reuseScore: number; // 0-100, higher = more reuse
	cleanlinessScore: number; // 0-100, higher = cleaner
	recommended: boolean;
	reason?: string;
}

/**
 * Review finding
 */
export interface ReviewFinding {
	id: string;
	severity: "critical" | "high" | "medium" | "low";
	category: "bug" | "quality" | "convention" | "security" | "performance";
	description: string;
	file?: string;
	line?: number;
	suggestion?: string;
	confidence: number; // 0-100
}

/**
 * Feature Dev session state
 */
export interface FeatureDevState {
	id: string;
	featureRequest: string;
	currentPhase: FeaturePhase;
	completedPhases: FeaturePhase[];

	// Phase 1: Discovery
	understanding: string;
	problemStatement: string;
	constraints: string[];

	// Phase 2: Exploration
	agentTasks: AgentTask[];
	keyFilesFound: string[];
	codebaseSummary: string;

	// Phase 3: Questions
	clarifyingQuestions: ClarifyingQuestion[];
	questionsResolved: boolean;

	// Phase 4: Architecture
	approaches: ArchitectureApproach[];
	selectedApproach: string;
	architectureApproved: boolean;

	// Phase 5: Implementation
	implementationStarted: boolean;
	implementationComplete: boolean;
	filesModified: string[];
	todosCompleted: string[];

	// Phase 6: Review
	reviewFindings: ReviewFinding[];
	reviewComplete: boolean;
	issuesAddressed: string[];

	// Phase 7: Summary
	summaryGenerated: boolean;
	keyDecisions: string[];
	suggestedNextSteps: string[];

	// Metadata
	startTime: string;
	endTime?: string;
	skillsUsed: string[];
}

/**
 * Feature Dev configuration
 */
export interface FeatureDevConfig {
	enabled: boolean;
	autoPhaseProgression: boolean; // Automatically move to next phase
	maxAgentsPerPhase: number; // Maximum agents to launch per phase
	minConfidenceForReview: number; // Minimum confidence for review findings
	skipPhases: FeaturePhase[]; // Phases to skip for simple tasks
	requireApprovalForImpl: boolean; // Require approval before implementation
	verbosity: "brief" | "normal" | "detailed";
}

/**
 * Feature Dev statistics
 */
export interface FeatureDevStats {
	sessionsStarted: number;
	sessionsCompleted: number;
	sessionsAbandoned: number;
	phasesCompleted: Record<FeaturePhase, number>;
	agentsLaunched: Record<AgentType, number>;
	questionsAsked: number;
	questionsAnswered: number;
	approachesDesigned: number;
	reviewsCompleted: number;
	findingsAddressed: number;
	avgSessionTime: number;
	topFeatureTypes: { type: string; count: number }[];
	completionRate: number;
	lastSession: string;
}

const DEFAULT_CONFIG: FeatureDevConfig = {
	enabled: true,
	autoPhaseProgression: false, // Manual phase progression by default
	maxAgentsPerPhase: 3,
	minConfidenceForReview: 80,
	skipPhases: [],
	requireApprovalForImpl: true,
	verbosity: "normal",
};

const PHASE_ORDER: FeaturePhase[] = [
	"discovery",
	"exploration",
	"questions",
	"architecture",
	"implementation",
	"review",
	"summary",
];

/**
 * Phase descriptions and guidance
 */
const PHASE_INFO: Record<
	FeaturePhase,
	{
		name: string;
		description: string;
		actions: string[];
		outputs: string[];
		skills: string[];
	}
> = {
	discovery: {
		name: "Phase 1: Discovery",
		description: "Understand what needs to be built",
		actions: [
			"Clarify the feature request if unclear",
			"Identify the problem being solved",
			"Determine constraints and requirements",
			"Summarize understanding and confirm",
		],
		outputs: ["understanding", "problemStatement", "constraints"],
		skills: [],
	},
	exploration: {
		name: "Phase 2: Codebase Exploration",
		description: "Understand relevant existing code and patterns",
		actions: [
			"Launch code-explorer agents in parallel",
			"Each agent explores different aspects",
			"Read identified key files",
			"Present comprehensive summary",
		],
		outputs: ["agentTasks", "keyFilesFound", "codebaseSummary"],
		skills: ["explore-code"],
	},
	questions: {
		name: "Phase 3: Clarifying Questions",
		description: "Fill in gaps and resolve ambiguities",
		actions: [
			"Review findings and feature request",
			"Identify underspecified aspects",
			"Present organized question list",
			"Wait for answers before proceeding",
		],
		outputs: ["clarifyingQuestions", "questionsResolved"],
		skills: [],
	},
	architecture: {
		name: "Phase 4: Architecture Design",
		description: "Design multiple implementation approaches",
		actions: [
			"Launch code-architect agents",
			"Design minimal, clean, and pragmatic approaches",
			"Compare trade-offs",
			"Present recommendation and ask for preference",
		],
		outputs: ["approaches", "selectedApproach", "architectureApproved"],
		skills: ["plan-architecture"],
	},
	implementation: {
		name: "Phase 5: Implementation",
		description: "Build the feature",
		actions: [
			"Wait for explicit approval",
			"Read all relevant files",
			"Implement following chosen architecture",
			"Follow codebase conventions strictly",
		],
		outputs: ["implementationStarted", "implementationComplete", "filesModified", "todosCompleted"],
		skills: [],
	},
	review: {
		name: "Phase 6: Quality Review",
		description: "Ensure code quality and correctness",
		actions: [
			"Launch code-reviewer agents",
			"Check simplicity, bugs, and conventions",
			"Consolidate findings",
			"Address high-priority issues",
		],
		outputs: ["reviewFindings", "reviewComplete", "issuesAddressed"],
		skills: ["review-changes"],
	},
	summary: {
		name: "Phase 7: Summary",
		description: "Document what was accomplished",
		actions: [
			"Mark todos complete",
			"Summarize what was built",
			"List key decisions made",
			"Suggest next steps",
		],
		outputs: ["summaryGenerated", "keyDecisions", "suggestedNextSteps"],
		skills: [],
	},
};

/**
 * Feature Dev Manager
 *
 * Manages the 7-phase feature development workflow.
 */
export class FeatureDevManager {
	private config: FeatureDevConfig;
	private stats: FeatureDevStats;
	private currentSession: FeatureDevState | null = null;
	private sessions: FeatureDevState[] = [];
	private configPath: string;

	constructor(configPath?: string) {
		this.configPath =
			configPath || path.join(process.env.HOME || ".", ".paimon", "feature-dev.json");
		this.config = DEFAULT_CONFIG;
		this.stats = {
			sessionsStarted: 0,
			sessionsCompleted: 0,
			sessionsAbandoned: 0,
			phasesCompleted: {
				discovery: 0,
				exploration: 0,
				questions: 0,
				architecture: 0,
				implementation: 0,
				review: 0,
				summary: 0,
			},
			agentsLaunched: {
				"code-explorer": 0,
				"code-architect": 0,
				"code-reviewer": 0,
			},
			questionsAsked: 0,
			questionsAnswered: 0,
			approachesDesigned: 0,
			reviewsCompleted: 0,
			findingsAddressed: 0,
			avgSessionTime: 0,
			topFeatureTypes: [],
			completionRate: 0,
			lastSession: "",
		};
		this.loadState();
	}

	/**
	 * Load state from disk
	 */
	private loadState(): void {
		try {
			if (fs.existsSync(this.configPath)) {
				const data = JSON.parse(fs.readFileSync(this.configPath, "utf-8"));
				if (data.config) {
					this.config = { ...DEFAULT_CONFIG, ...data.config };
				}
				if (data.stats) {
					this.stats = { ...this.stats, ...data.stats };
				}
				if (data.sessions) {
					this.sessions = data.sessions;
				}
			}
		} catch {
			// Use defaults if load fails
		}
	}

	/**
	 * Save state to disk
	 */
	private saveState(): void {
		try {
			const dir = path.dirname(this.configPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(
				this.configPath,
				JSON.stringify(
					{
						config: this.config,
						stats: this.stats,
						sessions: this.sessions.slice(-50), // Keep last 50 sessions
					},
					null,
					2,
				),
			);
		} catch {
			// Ignore save failures
		}
	}

	/**
	 * Start a new feature development session
	 */
	public startSession(featureRequest: string): FeatureDevState {
		const session: FeatureDevState = {
			id: `fd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
			featureRequest,
			currentPhase: "discovery",
			completedPhases: [],
			understanding: "",
			problemStatement: "",
			constraints: [],
			agentTasks: [],
			keyFilesFound: [],
			codebaseSummary: "",
			clarifyingQuestions: [],
			questionsResolved: false,
			approaches: [],
			selectedApproach: "",
			architectureApproved: false,
			implementationStarted: false,
			implementationComplete: false,
			filesModified: [],
			todosCompleted: [],
			reviewFindings: [],
			reviewComplete: false,
			issuesAddressed: [],
			summaryGenerated: false,
			keyDecisions: [],
			suggestedNextSteps: [],
			startTime: new Date().toISOString(),
			skillsUsed: [],
		};

		this.currentSession = session;
		this.sessions.push(session);
		this.stats.sessionsStarted++;
		this.stats.lastSession = session.startTime;
		this.saveState();

		return session;
	}

	/**
	 * Get current session
	 */
	public getCurrentSession(): FeatureDevState | null {
		return this.currentSession;
	}

	/**
	 * Get session by ID
	 */
	public getSession(sessionId: string): FeatureDevState | undefined {
		return (
			this.sessions.find((s) => s.id === sessionId) ||
			(this.currentSession?.id === sessionId ? this.currentSession : undefined)
		);
	}

	/**
	 * Get phase info
	 */
	public getPhaseInfo(phase: FeaturePhase) {
		return PHASE_INFO[phase];
	}

	/**
	 * Get all phases in order
	 */
	public getPhaseOrder(): FeaturePhase[] {
		return PHASE_ORDER;
	}

	/**
	 * Get next phase
	 */
	public getNextPhase(current: FeaturePhase): FeaturePhase | null {
		const currentIndex = PHASE_ORDER.indexOf(current);
		if (currentIndex < PHASE_ORDER.length - 1) {
			return PHASE_ORDER[currentIndex + 1];
		}
		return null;
	}

	/**
	 * Progress to next phase
	 */
	public progressToNextPhase(sessionId?: string): FeatureDevState | null {
		const session = sessionId ? this.getSession(sessionId) : this.currentSession;
		if (!session) return null;

		// Mark current phase as completed
		if (!session.completedPhases.includes(session.currentPhase)) {
			session.completedPhases.push(session.currentPhase);
			this.stats.phasesCompleted[session.currentPhase]++;
		}

		const nextPhase = this.getNextPhase(session.currentPhase);
		if (nextPhase) {
			session.currentPhase = nextPhase;
			this.saveState();
			return session;
		}

		return null;
	}

	/**
	 * Skip a phase
	 */
	public skipPhase(phase: FeaturePhase, sessionId?: string): boolean {
		const session = sessionId ? this.getSession(sessionId) : this.currentSession;
		if (!session) return false;

		if (session.currentPhase === phase) {
			const nextPhase = this.getNextPhase(phase);
			if (nextPhase) {
				session.currentPhase = nextPhase;
				session.completedPhases.push(phase);
				this.stats.phasesCompleted[phase]++;
				this.saveState();
				return true;
			}
		}
		return false;
	}

	/**
	 * Generate Phase 1: Discovery guidance
	 */
	public generateDiscoveryGuidance(featureRequest: string): string {
		return `
## Phase 1: Discovery

**Feature Request:** ${featureRequest}

**Goal:** Understand what needs to be built

**Actions:**
${PHASE_INFO.discovery.actions.map((a) => `- ${a}`).join("\n")}

**Questions to consider:**
1. What problem are we solving?
2. What are the constraints (time, resources, compatibility)?
3. What are the key requirements?
4. Is the request clear, or does it need clarification?

**Output format:**
- **Understanding:** [Your summary of what needs to be built]
- **Problem Statement:** [The core problem being solved]
- **Constraints:** [List of constraints and requirements]
`;
	}

	/**
	 * Update discovery phase results
	 */
	public updateDiscovery(
		understanding: string,
		problemStatement: string,
		constraints: string[],
		sessionId?: string,
	): FeatureDevState | null {
		const session = sessionId ? this.getSession(sessionId) : this.currentSession;
		if (!session) return null;

		session.understanding = understanding;
		session.problemStatement = problemStatement;
		session.constraints = constraints;
		this.saveState();
		return session;
	}

	/**
	 * Generate Phase 2: Exploration agent prompts
	 */
	public generateExplorationAgents(featureRequest: string, understanding: string): AgentTask[] {
		const agents: AgentTask[] = [
			{
				id: `agent-explore-${Date.now()}-1`,
				type: "code-explorer",
				focus: "similar-features",
				prompt: `Find features similar to "${featureRequest}" and trace their implementation. Look for patterns, abstractions, and key files.`,
				status: "pending",
			},
			{
				id: `agent-explore-${Date.now()}-2`,
				type: "code-explorer",
				focus: "architecture-map",
				prompt: `Map the architecture and abstractions for the area related to "${featureRequest}". Identify layers, modules, and dependencies.`,
				status: "pending",
			},
			{
				id: `agent-explore-${Date.now()}-3`,
				type: "code-explorer",
				focus: "current-impl",
				prompt: `Analyze current implementation related to "${understanding}". Find entry points, data flow, and integration points.`,
				status: "pending",
			},
		];

		return agents.slice(0, this.config.maxAgentsPerPhase);
	}

	/**
	 * Launch exploration agents
	 */
	public launchExplorationAgents(sessionId?: string): AgentTask[] {
		const session = sessionId ? this.getSession(sessionId) : this.currentSession;
		if (!session) return [];

		const agents = this.generateExplorationAgents(session.featureRequest, session.understanding);
		session.agentTasks = agents;
		session.skillsUsed.push("explore-code");

		for (const agent of agents) {
			agent.status = "running";
			agent.startTime = new Date().toISOString();
			this.stats.agentsLaunched["code-explorer"]++;
		}

		this.saveState();
		return agents;
	}

	/**
	 * Update agent result
	 */
	public updateAgentResult(
		agentId: string,
		result: string,
		keyFiles?: string[],
		insights?: string[],
		sessionId?: string,
	): AgentTask | null {
		const session = sessionId ? this.getSession(sessionId) : this.currentSession;
		if (!session) return null;

		const agent = session.agentTasks.find((a) => a.id === agentId);
		if (!agent) return null;

		agent.status = "completed";
		agent.result = result;
		agent.keyFiles = keyFiles;
		agent.insights = insights;
		agent.endTime = new Date().toISOString();

		// Collect key files from all agents
		if (keyFiles) {
			for (const file of keyFiles) {
				if (!session.keyFilesFound.includes(file)) {
					session.keyFilesFound.push(file);
				}
			}
		}

		this.saveState();
		return agent;
	}

	/**
	 * Generate exploration summary
	 */
	public generateExplorationSummary(sessionId?: string): string {
		const session = sessionId ? this.getSession(sessionId) : this.currentSession;
		if (!session) return "";

		const completedAgents = session.agentTasks.filter((a) => a.status === "completed");
		let summary = `
## Phase 2: Exploration Summary

**Agents completed:** ${completedAgents.length}/${session.agentTasks.length}

`;

		for (const agent of completedAgents) {
			summary += `
### ${agent.focus}: ${agent.type}

${agent.result || "No result"}

**Key files:**
${agent.keyFiles?.map((f) => `- ${f}`).join("\n") || "No key files identified"}

**Insights:**
${agent.insights?.map((i) => `- ${i}`).join("\n") || "No insights"}

`;
		}

		summary += `
### All Key Files to Read:
${session.keyFilesFound.map((f) => `- ${f}`).join("\n") || "No files identified yet"}
`;

		session.codebaseSummary = summary;
		this.saveState();
		return summary;
	}

	/**
	 * Generate Phase 3: Clarifying questions
	 */
	public generateClarifyingQuestions(sessionId?: string): ClarifyingQuestion[] {
		const session = sessionId ? this.getSession(sessionId) : this.currentSession;
		if (!session) return [];

		// Generate questions based on understanding and gaps
		const questions: ClarifyingQuestion[] = [];

		// Common question categories
		const questionTemplates: Record<string, string[]> = {
			"edge-cases": [
				"What edge cases should be handled?",
				"How should empty/null inputs be handled?",
				"What are the failure scenarios?",
			],
			"error-handling": [
				"How should errors be surfaced to users?",
				"Should errors be logged or silently handled?",
				"What retry strategy should be used?",
			],
			integration: [
				"How does this integrate with existing features?",
				"Should this work alongside or replace existing functionality?",
				"What APIs/interfaces should be used?",
			],
			"backward-compat": [
				"Should this maintain backward compatibility?",
				"Can existing behavior be changed?",
				"What migration path for existing users?",
			],
			performance: [
				"What are the performance requirements?",
				"Should this be optimized for speed or memory?",
				"What caching strategy should be used?",
			],
			requirements: [
				"What are the must-have vs nice-to-have features?",
				"What is the timeline/priority?",
				"Who are the target users?",
			],
		};

		let priority = 10;
		for (const [category, templates] of Object.entries(questionTemplates)) {
			for (const template of templates) {
				questions.push({
					id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
					category: category as ClarifyingQuestion["category"],
					question: template,
					context: session?.understanding || "",
					answered: false,
					priority: priority--,
				});
			}
		}

		session.clarifyingQuestions = questions.slice(0, 10); // Limit to 10 questions
		this.stats.questionsAsked += session.clarifyingQuestions.length;
		this.saveState();
		return session.clarifyingQuestions;
	}

	/**
	 * Answer a clarifying question
	 */
	public answerQuestion(
		questionId: string,
		answer: string,
		sessionId?: string,
	): ClarifyingQuestion | null {
		const session = sessionId ? this.getSession(sessionId) : this.currentSession;
		if (!session) return null;

		const question = session.clarifyingQuestions.find((q) => q.id === questionId);
		if (!question) return null;

		question.answered = true;
		question.answer = answer;
		this.stats.questionsAnswered++;

		// Check if all questions answered
		session.questionsResolved = session.clarifyingQuestions.every((q) => q.answered);

		this.saveState();
		return question;
	}

	/**
	 * Generate Phase 4: Architecture approaches
	 */
	public generateArchitectureApproaches(sessionId?: string): ArchitectureApproach[] {
		const session = sessionId ? this.getSession(sessionId) : this.currentSession;
		if (!session) return [];

		session.skillsUsed.push("plan-architecture");

		const approaches: ArchitectureApproach[] = [
			{
				id: "approach-minimal",
				name: "Approach 1: Minimal Changes",
				description: "Smallest change, maximum reuse of existing patterns",
				pros: ["Fast implementation", "Low risk", "Minimal refactoring"],
				cons: ["May have some coupling", "Less testable", "Harder to extend later"],
				filesToModify: [],
				estimatedComplexity: "low",
				reuseScore: 90,
				cleanlinessScore: 60,
				recommended: false,
			},
			{
				id: "approach-clean",
				name: "Approach 2: Clean Architecture",
				description: "Focus on maintainability and elegant abstractions",
				pros: ["Clean separation", "Testable", "Maintainable", "Extensible"],
				cons: ["More files", "More refactoring", "Higher complexity"],
				filesToModify: [],
				estimatedComplexity: "high",
				reuseScore: 40,
				cleanlinessScore: 95,
				recommended: false,
			},
			{
				id: "approach-pragmatic",
				name: "Approach 3: Pragmatic Balance",
				description: "Balance between speed and quality",
				pros: ["Good boundaries", "Reasonable complexity", "Fits existing patterns"],
				cons: ["Some coupling remains", "Not perfectly clean"],
				filesToModify: [],
				estimatedComplexity: "medium",
				reuseScore: 70,
				cleanlinessScore: 80,
				recommended: true,
				reason: "Balanced complexity and cleanliness, fits existing architecture well",
			},
		];

		session.approaches = approaches;
		this.stats.approachesDesigned += approaches.length;
		this.saveState();
		return approaches;
	}

	/**
	 * Select architecture approach
	 */
	public selectApproach(approachId: string, sessionId?: string): ArchitectureApproach | null {
		const session = sessionId ? this.getSession(sessionId) : this.currentSession;
		if (!session) return null;

		const approach = session.approaches.find((a) => a.id === approachId);
		if (!approach) return null;

		session.selectedApproach = approachId;
		this.saveState();
		return approach;
	}

	/**
	 * Approve architecture for implementation
	 */
	public approveArchitecture(sessionId?: string): boolean {
		const session = sessionId ? this.getSession(sessionId) : this.currentSession;
		if (!session) return false;

		session.architectureApproved = true;
		this.saveState();
		return true;
	}

	/**
	 * Generate implementation guidance
	 */
	public generateImplementationGuidance(sessionId?: string): string {
		const session = sessionId ? this.getSession(sessionId) : this.currentSession;
		if (!session) return "";

		const selectedApproach = session.approaches.find((a) => a.id === session.selectedApproach);

		return `
## Phase 5: Implementation

**Approach:** ${selectedApproach?.name || "No approach selected"}

**Key files to read first:**
${session.keyFilesFound.map((f) => `- ${f}`).join("\n")}

**Implementation steps:**
1. Read all relevant files identified in Phase 2
2. Follow the chosen architecture approach
3. Follow codebase conventions strictly
4. Write clean, well-documented code
5. Update todos as progress is made

**Files to modify:** ${selectedApproach?.filesToModify?.join(", ") || "To be determined"}

**Important:** Implementation only starts after explicit approval.
`;
	}

	/**
	 * Mark implementation started
	 */
	public startImplementation(sessionId?: string): boolean {
		const session = sessionId ? this.getSession(sessionId) : this.currentSession;
		if (!session || !session.architectureApproved) return false;

		session.implementationStarted = true;
		this.saveState();
		return true;
	}

	/**
	 * Update implementation progress
	 */
	public updateImplementation(
		filesModified: string[],
		todosCompleted: string[],
		sessionId?: string,
	): FeatureDevState | null {
		const session = sessionId ? this.getSession(sessionId) : this.currentSession;
		if (!session) return null;

		session.filesModified = filesModified;
		session.todosCompleted = todosCompleted;
		this.saveState();
		return session;
	}

	/**
	 * Mark implementation complete
	 */
	public completeImplementation(sessionId?: string): boolean {
		const session = sessionId ? this.getSession(sessionId) : this.currentSession;
		if (!session) return false;

		session.implementationComplete = true;
		this.saveState();
		return true;
	}

	/**
	 * Generate Phase 6: Review agents
	 */
	public generateReviewAgents(sessionId?: string): AgentTask[] {
		const session = sessionId ? this.getSession(sessionId) : this.currentSession;
		if (!session) return [];

		session.skillsUsed.push("review-changes");

		const agents: AgentTask[] = [
			{
				id: `agent-review-${Date.now()}-1`,
				type: "code-reviewer",
				focus: "simplicity-dry",
				prompt:
					"Review code for simplicity, DRY violations, and elegance. Focus on maintainability.",
				status: "pending",
			},
			{
				id: `agent-review-${Date.now()}-2`,
				type: "code-reviewer",
				focus: "bugs-correctness",
				prompt:
					"Review code for bugs, logic errors, and functional correctness. Focus on edge cases.",
				status: "pending",
			},
			{
				id: `agent-review-${Date.now()}-3`,
				type: "code-reviewer",
				focus: "conventions",
				prompt: "Review code for project conventions and patterns. Check CLAUDE.md compliance.",
				status: "pending",
			},
		];

		// Add review agents to existing tasks
		session.agentTasks.push(...agents);

		for (const agent of agents) {
			agent.status = "running";
			agent.startTime = new Date().toISOString();
			this.stats.agentsLaunched["code-reviewer"]++;
		}

		this.saveState();
		return agents;
	}

	/**
	 * Add review finding
	 */
	public addReviewFinding(finding: ReviewFinding, sessionId?: string): void {
		const session = sessionId ? this.getSession(sessionId) : this.currentSession;
		if (!session) return;

		if (finding.confidence >= this.config.minConfidenceForReview) {
			session.reviewFindings.push(finding);
			this.saveState();
		}
	}

	/**
	 * Address a review finding
	 */
	public addressFinding(findingId: string, sessionId?: string): boolean {
		const session = sessionId ? this.getSession(sessionId) : this.currentSession;
		if (!session) return false;

		session.issuesAddressed.push(findingId);
		this.stats.findingsAddressed++;
		this.saveState();
		return true;
	}

	/**
	 * Mark review complete
	 */
	public completeReview(sessionId?: string): boolean {
		const session = sessionId ? this.getSession(sessionId) : this.currentSession;
		if (!session) return false;

		session.reviewComplete = true;
		this.stats.reviewsCompleted++;
		this.saveState();
		return true;
	}

	/**
	 * Generate Phase 7: Summary
	 */
	public generateSummary(sessionId?: string): string {
		const session = sessionId ? this.getSession(sessionId) : this.currentSession;
		if (!session) return "";

		const selectedApproach = session.approaches.find((a) => a.id === session.selectedApproach);

		session.summaryGenerated = true;
		session.endTime = new Date().toISOString();

		// Calculate session time
		const startTime = new Date(session.startTime).getTime();
		const endTime = new Date(session.endTime).getTime();
		const sessionTime = (endTime - startTime) / 1000 / 60; // minutes

		// Update stats
		const totalCompleted = this.stats.sessionsCompleted;
		const avgTime = this.stats.avgSessionTime;
		this.stats.avgSessionTime =
			totalCompleted === 0
				? sessionTime
				: (avgTime * totalCompleted + sessionTime) / (totalCompleted + 1);
		this.stats.sessionsCompleted++;
		this.stats.completionRate = (this.stats.sessionsCompleted / this.stats.sessionsStarted) * 100;

		this.saveState();

		return `
## Phase 7: Summary

### Feature Complete: ${session.featureRequest}

**What was built:**
${session.problemStatement || "Feature implemented"}

**Key decisions made:**
${session.keyDecisions.length > 0 ? session.keyDecisions.map((d) => `- ${d}`).join("\n") : `- Used ${selectedApproach?.name || "selected approach"}`}
${session.clarifyingQuestions
	.filter((q) => q.answered)
	.map((q) => `- ${q.question}: ${q.answer}`)
	.join("\n")}

**Files modified:**
${session.filesModified.map((f) => `- ${f}`).join("\n") || "Files tracked during implementation"}

**Skills used:**
${session.skillsUsed.map((s) => `- ${s}`).join("\n") || "Standard workflow"}

**Suggested next steps:**
- Add tests for new functionality
- Update documentation
- Consider performance optimizations
- Review for additional edge cases

**Session time:** ${Math.round(sessionTime)} minutes
**Phases completed:** ${session.completedPhases.length + 1}/${PHASE_ORDER.length}
`;
	}

	/**
	 * Add key decision
	 */
	public addKeyDecision(decision: string, sessionId?: string): void {
		const session = sessionId ? this.getSession(sessionId) : this.currentSession;
		if (!session) return;

		session.keyDecisions.push(decision);
		this.saveState();
	}

	/**
	 * Add suggested next step
	 */
	public addNextStep(step: string, sessionId?: string): void {
		const session = sessionId ? this.getSession(sessionId) : this.currentSession;
		if (!session) return;

		session.suggestedNextSteps.push(step);
		this.saveState();
	}

	/**
	 * Cancel session
	 */
	public cancelSession(reason: string, sessionId?: string): boolean {
		const session = sessionId ? this.getSession(sessionId) : this.currentSession;
		if (!session) return false;

		session.endTime = new Date().toISOString();
		this.stats.sessionsAbandoned++;
		this.currentSession = null;
		this.saveState();
		return true;
	}

	/**
	 * Get configuration
	 */
	public getConfig(): FeatureDevConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration
	 */
	public updateConfig(updates: Partial<FeatureDevConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveState();
	}

	/**
	 * Get statistics
	 */
	public getStats(): FeatureDevStats {
		return { ...this.stats };
	}

	/**
	 * List recent sessions
	 */
	public listSessions(limit?: number): FeatureDevState[] {
		return this.sessions.slice(-(limit || 10));
	}

	/**
	 * Reset statistics
	 */
	public resetStats(): void {
		this.stats = {
			sessionsStarted: 0,
			sessionsCompleted: 0,
			sessionsAbandoned: 0,
			phasesCompleted: {
				discovery: 0,
				exploration: 0,
				questions: 0,
				architecture: 0,
				implementation: 0,
				review: 0,
				summary: 0,
			},
			agentsLaunched: {
				"code-explorer": 0,
				"code-architect": 0,
				"code-reviewer": 0,
			},
			questionsAsked: 0,
			questionsAnswered: 0,
			approachesDesigned: 0,
			reviewsCompleted: 0,
			findingsAddressed: 0,
			avgSessionTime: 0,
			topFeatureTypes: [],
			completionRate: 0,
			lastSession: "",
		};
		this.saveState();
	}

	/**
	 * Enable/disable feature dev
	 */
	public enable(): void {
		this.config.enabled = true;
		this.saveState();
	}

	public disable(): void {
		this.config.enabled = false;
		this.saveState();
	}
}

// Singleton instance
let featureDevManagerInstance: FeatureDevManager | null = null;

/**
 * Get the feature dev manager instance
 */
export function getFeatureDevManager(): FeatureDevManager {
	if (!featureDevManagerInstance) {
		featureDevManagerInstance = new FeatureDevManager();
	}
	return featureDevManagerInstance;
}
