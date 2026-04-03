/**
 * Plugin Development Toolkit Module (Claude Code Pattern)
 *
 * Comprehensive toolkit for developing plugins with 8-phase workflow
 * and 7 specialized skills for hooks, MCP, commands, agents, and more.
 */

import * as fs from "node:fs";
import { homedir } from "node:os";
import * as path from "node:path";

// Plugin Dev Phases
export type PluginDevPhase =
	| "discovery"
	| "component-planning"
	| "detailed-design"
	| "structure-creation"
	| "component-implementation"
	| "validation"
	| "testing"
	| "documentation";

// Skill Types
export type PluginSkillType =
	| "hook-dev"
	| "mcp-integration"
	| "plugin-structure"
	| "plugin-settings"
	| "command-dev"
	| "agent-dev"
	| "skill-dev";

// Agent Types
export type PluginAgentType = "plugin-validator" | "agent-creator" | "skill-reviewer";

// Component Types
export type PluginComponentType = "command" | "agent" | "skill" | "hook" | "mcp";

// Component Specification
export interface PluginComponentSpec {
	type: PluginComponentType;
	name: string;
	description: string;
	enabled: boolean;
	validated: boolean;
	tested: boolean;
}

// Phase State
export interface PhaseState {
	phase: PluginDevPhase;
	started: string;
	completed?: string;
	notes: string[];
	questions: string[];
	answers: Record<string, string>;
}

// Plugin Dev State
export interface PluginDevState {
	id: string;
	description: string;
	created: string;
	currentPhase: PluginDevPhase;
	phases: Record<PluginDevPhase, PhaseState>;
	components: PluginComponentSpec[];
	requiredSkills: PluginSkillType[];
	agentsUsed: PluginAgentType[];
	structure?: {
		name: string;
		directory: string;
		manifest?: Record<string, unknown>;
	};
	validation?: {
		passed: boolean;
		errors: string[];
		warnings: string[];
	};
	testing?: {
		passed: boolean;
		results: string[];
	};
	complete: boolean;
}

// Skill Definition
export interface PluginSkillDef {
	type: PluginSkillType;
	name: string;
	description: string;
	triggerPhrases: string[];
	coreTopics: string[];
	resources: {
		examples: number;
		references: number;
		scripts: number;
	};
}

// Agent Definition
export interface PluginAgentDef {
	type: PluginAgentType;
	name: string;
	description: string;
	purpose: string;
	inputs: string[];
	outputs: string[];
}

// Config
export interface PluginDevConfig {
	dataDir: string;
	autoPhase: boolean;
	defaultSkills: PluginSkillType[];
	validationEnabled: boolean;
}

// Stats
export interface PluginDevStats {
	sessionsCreated: number;
	sessionsCompleted: number;
	phasesCompleted: Record<PluginDevPhase, number>;
	componentsCreated: Record<PluginComponentType, number>;
	skillsUsed: Record<PluginSkillType, number>;
	agentsUsed: Record<PluginAgentType, number>;
	validationRuns: number;
	validationPassRate: number;
	averageTimeMinutes: number;
}

// Default Skills
const DEFAULT_SKILLS: PluginSkillDef[] = [
	{
		type: "hook-dev",
		name: "Hook Development",
		description: "Advanced hooks API and event-driven automation",
		triggerPhrases: [
			"create a hook",
			"add a PreToolUse hook",
			"validate tool use",
			"implement prompt-based hooks",
			"block dangerous commands",
		],
		coreTopics: [
			"prompt-based hooks",
			"command hooks",
			"hook events",
			"security best practices",
			"input validation",
		],
		resources: { examples: 3, references: 3, scripts: 3 },
	},
	{
		type: "mcp-integration",
		name: "MCP Integration",
		description: "Model Context Protocol server integration",
		triggerPhrases: [
			"add MCP server",
			"integrate MCP",
			"configure mcp.json",
			"Model Context Protocol",
			"stdio server",
			"SSE server",
			"HTTP server",
		],
		coreTopics: [
			"MCP server configuration",
			"server types",
			"authentication patterns",
			"tool naming",
			"performance optimization",
		],
		resources: { examples: 3, references: 3, scripts: 0 },
	},
	{
		type: "plugin-structure",
		name: "Plugin Structure",
		description: "Plugin organization and manifest configuration",
		triggerPhrases: [
			"plugin structure",
			"plugin.json manifest",
			"auto-discovery",
			"component organization",
		],
		coreTopics: [
			"directory structure",
			"plugin.json format",
			"component organization",
			"file naming conventions",
		],
		resources: { examples: 3, references: 2, scripts: 0 },
	},
	{
		type: "plugin-settings",
		name: "Plugin Settings",
		description: "Configuration patterns using .local.md files",
		triggerPhrases: [
			"plugin settings",
			"store plugin configuration",
			".local.md files",
			"per-project settings",
		],
		coreTopics: [
			"YAML frontmatter",
			"parsing techniques",
			"atomic updates",
			"gitignore management",
		],
		resources: { examples: 3, references: 2, scripts: 2 },
	},
	{
		type: "command-dev",
		name: "Command Development",
		description: "Creating slash commands with frontmatter and arguments",
		triggerPhrases: [
			"create a slash command",
			"add a command",
			"command frontmatter",
			"define command arguments",
		],
		coreTopics: [
			"command structure",
			"YAML frontmatter",
			"dynamic arguments",
			"command organization",
		],
		resources: { examples: 3, references: 1, scripts: 0 },
	},
	{
		type: "agent-dev",
		name: "Agent Development",
		description: "Creating autonomous agents with AI-assisted generation",
		triggerPhrases: [
			"create an agent",
			"add an agent",
			"agent definition",
			"AI-assisted agent generation",
		],
		coreTopics: ["agent structure", "agent.md format", "agent behavior", "agent prompts"],
		resources: { examples: 2, references: 1, scripts: 1 },
	},
	{
		type: "skill-dev",
		name: "Skill Development",
		description: "Creating skills with progressive disclosure and strong triggers",
		triggerPhrases: ["create a skill", "add a skill", "skill SKILL.md", "progressive disclosure"],
		coreTopics: [
			"skill structure",
			"progressive disclosure",
			"strong triggers",
			"skill organization",
		],
		resources: { examples: 2, references: 1, scripts: 0 },
	},
];

// Default Agents
const DEFAULT_AGENTS: PluginAgentDef[] = [
	{
		type: "plugin-validator",
		name: "Plugin Validator",
		description: "Validate plugin structure and components",
		purpose: "Validate plugin against best practices and requirements",
		inputs: ["plugin directory", "manifest", "components"],
		outputs: ["validation report", "errors", "warnings", "suggestions"],
	},
	{
		type: "agent-creator",
		name: "Agent Creator",
		description: "AI-assisted agent generation",
		purpose: "Generate agent definitions from requirements",
		inputs: ["agent purpose", "agent behavior", "expected inputs", "expected outputs"],
		outputs: ["agent.md file", "agent configuration", "example prompts"],
	},
	{
		type: "skill-reviewer",
		name: "Skill Reviewer",
		description: "Review skills for quality and completeness",
		purpose: "Review skill definitions for best practices",
		inputs: ["skill SKILL.md", "skill purpose"],
		outputs: ["review report", "improvement suggestions", "trigger recommendations"],
	},
];

// Phase Workflow
const PHASE_ORDER: PluginDevPhase[] = [
	"discovery",
	"component-planning",
	"detailed-design",
	"structure-creation",
	"component-implementation",
	"validation",
	"testing",
	"documentation",
];

// Phase Guidance
const PHASE_GUIDANCE: Record<PluginDevPhase, { purpose: string; actions: string[] }> = {
	discovery: {
		purpose: "Understand plugin purpose and requirements",
		actions: [
			"Clarify plugin purpose",
			"Identify requirements",
			"Determine scope",
			"List expected features",
		],
	},
	"component-planning": {
		purpose: "Determine needed skills, commands, agents, hooks, MCP",
		actions: [
			"Identify required components",
			"Select relevant skills",
			"Plan agent usage",
			"Determine MCP needs",
		],
	},
	"detailed-design": {
		purpose: "Specify each component and resolve ambiguities",
		actions: [
			"Define component specifications",
			"Resolve ambiguities",
			"Create detailed plans",
			"Ask clarifying questions",
		],
	},
	"structure-creation": {
		purpose: "Set up directories and manifest",
		actions: [
			"Create plugin directory",
			"Create plugin.json manifest",
			"Set up component directories",
			"Create README template",
		],
	},
	"component-implementation": {
		purpose: "Create each component using AI-assisted agents",
		actions: [
			"Implement commands",
			"Implement agents",
			"Implement skills",
			"Implement hooks",
			"Configure MCP",
		],
	},
	validation: {
		purpose: "Run plugin-validator and component-specific checks",
		actions: [
			"Validate structure",
			"Validate manifest",
			"Validate components",
			"Run validation scripts",
		],
	},
	testing: {
		purpose: "Verify plugin works in environment",
		actions: [
			"Test commands",
			"Test agents",
			"Test hooks",
			"Test MCP integration",
			"Integration testing",
		],
	},
	documentation: {
		purpose: "Finalize README and prepare for distribution",
		actions: [
			"Complete README",
			"Add usage examples",
			"Document configuration",
			"Prepare for distribution",
		],
	},
};

export class PluginDevManager {
	private config: PluginDevConfig;
	private stats: PluginDevStats;
	private sessions: Map<string, PluginDevState>;
	private dataFile: string;

	constructor(config?: Partial<PluginDevConfig>) {
		this.config = {
			dataDir: path.join(homedir(), ".paimon", "plugin-dev"),
			autoPhase: false,
			defaultSkills: [
				"hook-dev",
				"mcp-integration",
				"plugin-structure",
				"command-dev",
				"agent-dev",
				"skill-dev",
			],
			validationEnabled: true,
			...config,
		};

		this.dataFile = path.join(this.config.dataDir, "state.json");
		this.sessions = new Map();
		this.stats = this.getDefaultStats();

		this.loadState();
	}

	private getDefaultStats(): PluginDevStats {
		return {
			sessionsCreated: 0,
			sessionsCompleted: 0,
			phasesCompleted: {
				discovery: 0,
				"component-planning": 0,
				"component-implementation": 0,
				"detailed-design": 0,
				documentation: 0,
				"structure-creation": 0,
				testing: 0,
				validation: 0,
			},
			componentsCreated: {
				agent: 0,
				command: 0,
				hook: 0,
				mcp: 0,
				skill: 0,
			},
			skillsUsed: {
				"agent-dev": 0,
				"command-dev": 0,
				"hook-dev": 0,
				"mcp-integration": 0,
				"plugin-settings": 0,
				"plugin-structure": 0,
				"skill-dev": 0,
			},
			agentsUsed: {
				"agent-creator": 0,
				"plugin-validator": 0,
				"skill-reviewer": 0,
			},
			validationRuns: 0,
			validationPassRate: 0,
			averageTimeMinutes: 0,
		};
	}

	private loadState(): void {
		try {
			if (fs.existsSync(this.dataFile)) {
				const data = JSON.parse(fs.readFileSync(this.dataFile, "utf-8"));
				if (data.sessions) {
					for (const [id, state] of Object.entries(data.sessions)) {
						this.sessions.set(id, state as PluginDevState);
					}
				}
				if (data.stats) {
					this.stats = { ...this.stats, ...data.stats };
				}
			}
		} catch {
			// Ignore load errors, use defaults
		}
	}

	private saveState(): void {
		try {
			if (!fs.existsSync(this.config.dataDir)) {
				fs.mkdirSync(this.config.dataDir, { recursive: true });
			}
			const sessionsObj: Record<string, PluginDevState> = {};
			for (const [id, state] of this.sessions.entries()) {
				sessionsObj[id] = state;
			}
			fs.writeFileSync(
				this.dataFile,
				JSON.stringify(
					{
						sessions: sessionsObj,
						stats: this.stats,
					},
					null,
					2,
				),
			);
		} catch {
			// Ignore save errors
		}
	}

	// Create new plugin development session
	createSession(description: string): PluginDevState {
		const id = `plugin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		const now = new Date().toISOString();

		// Initialize phases
		const phases: Record<PluginDevPhase, PhaseState> = {} as Record<PluginDevPhase, PhaseState>;
		for (const phase of PHASE_ORDER) {
			phases[phase] = {
				phase,
				started: "",
				notes: [],
				questions: [],
				answers: {},
			};
		}

		// Start discovery phase
		phases.discovery.started = now;

		const state: PluginDevState = {
			id,
			description,
			created: now,
			currentPhase: "discovery",
			phases,
			components: [],
			requiredSkills: this.config.defaultSkills,
			agentsUsed: [],
			complete: false,
		};

		this.sessions.set(id, state);
		this.stats.sessionsCreated++;
		this.saveState();

		return state;
	}

	// Get session
	getSession(id: string): PluginDevState | undefined {
		return this.sessions.get(id);
	}

	// List sessions
	listSessions(filter?: "active" | "complete" | "all"): PluginDevState[] {
		const sessions = Array.from(this.sessions.values());
		if (filter === "active") {
			return sessions.filter((s) => !s.complete);
		}
		if (filter === "complete") {
			return sessions.filter((s) => s.complete);
		}
		return sessions;
	}

	// Progress to next phase
	progressPhase(sessionId: string, notes?: string[]): PluginDevState | undefined {
		const session = this.sessions.get(sessionId);
		if (!session) return undefined;

		const currentIdx = PHASE_ORDER.indexOf(session.currentPhase);
		if (currentIdx < 0 || currentIdx >= PHASE_ORDER.length - 1) return undefined;

		// Complete current phase
		const now = new Date().toISOString();
		session.phases[session.currentPhase].completed = now;
		if (notes) {
			session.phases[session.currentPhase].notes.push(...notes);
		}
		this.stats.phasesCompleted[session.currentPhase]++;

		// Move to next phase
		const nextPhase = PHASE_ORDER[currentIdx + 1];
		session.currentPhase = nextPhase;
		session.phases[nextPhase].started = now;

		// Check if complete
		if (nextPhase === "documentation" && session.validation?.passed && session.testing?.passed) {
			session.phases[nextPhase].completed = now;
			session.complete = true;
			this.stats.sessionsCompleted++;
		}

		this.saveState();
		return session;
	}

	// Set specific phase
	setPhase(sessionId: string, phase: PluginDevPhase): PluginDevState | undefined {
		const session = this.sessions.get(sessionId);
		if (!session) return undefined;

		const now = new Date().toISOString();
		session.currentPhase = phase;
		session.phases[phase].started = now;

		this.saveState();
		return session;
	}

	// Add notes to phase
	addNotes(sessionId: string, phase: PluginDevPhase, notes: string[]): PluginDevState | undefined {
		const session = this.sessions.get(sessionId);
		if (!session) return undefined;

		session.phases[phase].notes.push(...notes);
		this.saveState();
		return session;
	}

	// Add question
	addQuestion(
		sessionId: string,
		phase: PluginDevPhase,
		question: string,
	): PluginDevState | undefined {
		const session = this.sessions.get(sessionId);
		if (!session) return undefined;

		session.phases[phase].questions.push(question);
		this.saveState();
		return session;
	}

	// Answer question
	answerQuestion(
		sessionId: string,
		phase: PluginDevPhase,
		questionId: string,
		answer: string,
	): PluginDevState | undefined {
		const session = this.sessions.get(sessionId);
		if (!session) return undefined;

		session.phases[phase].answers[questionId] = answer;
		this.saveState();
		return session;
	}

	// Add component
	addComponent(sessionId: string, component: PluginComponentSpec): PluginDevState | undefined {
		const session = this.sessions.get(sessionId);
		if (!session) return undefined;

		session.components.push(component);
		this.stats.componentsCreated[component.type]++;
		this.saveState();
		return session;
	}

	// Update component
	updateComponent(
		sessionId: string,
		componentName: string,
		updates: Partial<PluginComponentSpec>,
	): PluginDevState | undefined {
		const session = this.sessions.get(sessionId);
		if (!session) return undefined;

		const idx = session.components.findIndex((c) => c.name === componentName);
		if (idx >= 0) {
			session.components[idx] = { ...session.components[idx], ...updates };
			this.saveState();
		}
		return session;
	}

	// Record skill usage
	recordSkillUsage(sessionId: string, skill: PluginSkillType): PluginDevState | undefined {
		const session = this.sessions.get(sessionId);
		if (!session) return undefined;

		if (!session.requiredSkills.includes(skill)) {
			session.requiredSkills.push(skill);
		}
		this.stats.skillsUsed[skill]++;
		this.saveState();
		return session;
	}

	// Record agent usage
	recordAgentUsage(sessionId: string, agent: PluginAgentType): PluginDevState | undefined {
		const session = this.sessions.get(sessionId);
		if (!session) return undefined;

		if (!session.agentsUsed.includes(agent)) {
			session.agentsUsed.push(agent);
		}
		this.stats.agentsUsed[agent]++;
		this.saveState();
		return session;
	}

	// Set structure
	setStructure(
		sessionId: string,
		name: string,
		directory: string,
		manifest?: Record<string, unknown>,
	): PluginDevState | undefined {
		const session = this.sessions.get(sessionId);
		if (!session) return undefined;

		session.structure = { name, directory, manifest };
		this.saveState();
		return session;
	}

	// Set validation result
	setValidation(
		sessionId: string,
		passed: boolean,
		errors: string[],
		warnings: string[],
	): PluginDevState | undefined {
		const session = this.sessions.get(sessionId);
		if (!session) return undefined;

		session.validation = { passed, errors, warnings };
		this.stats.validationRuns++;

		// Update pass rate
		const prevPasses = Math.round(this.stats.validationPassRate * (this.stats.validationRuns - 1));
		const newPasses = passed ? prevPasses + 1 : prevPasses;
		this.stats.validationPassRate = newPasses / this.stats.validationRuns;

		this.saveState();
		return session;
	}

	// Set testing result
	setTesting(sessionId: string, passed: boolean, results: string[]): PluginDevState | undefined {
		const session = this.sessions.get(sessionId);
		if (!session) return undefined;

		session.testing = { passed, results };
		this.saveState();
		return session;
	}

	// Complete session
	completeSession(sessionId: string): PluginDevState | undefined {
		const session = this.sessions.get(sessionId);
		if (!session) return undefined;

		const now = new Date().toISOString();
		session.phases[session.currentPhase].completed = now;
		session.complete = true;
		this.stats.sessionsCompleted++;

		// Calculate time
		const createdDate = new Date(session.created);
		const completedDate = new Date(now);
		const minutesDiff = (completedDate.getTime() - createdDate.getTime()) / 60000;
		const prevCount = this.stats.sessionsCompleted - 1;
		if (prevCount > 0) {
			const prevAvg = this.stats.averageTimeMinutes;
			this.stats.averageTimeMinutes =
				(prevAvg * prevCount + minutesDiff) / this.stats.sessionsCompleted;
		} else {
			this.stats.averageTimeMinutes = minutesDiff;
		}

		this.saveState();
		return session;
	}

	// Cancel session
	cancelSession(sessionId: string, reason: string): PluginDevState | undefined {
		const session = this.sessions.get(sessionId);
		if (!session) return undefined;

		session.phases[session.currentPhase].notes.push(`Cancelled: ${reason}`);
		session.complete = true;
		this.saveState();
		return session;
	}

	// Get phase guidance
	getPhaseGuidance(phase: PluginDevPhase): { purpose: string; actions: string[] } {
		return PHASE_GUIDANCE[phase];
	}

	// Get skill
	getSkill(skill: PluginSkillType): PluginSkillDef | undefined {
		return DEFAULT_SKILLS.find((s) => s.type === skill);
	}

	// Get all skills
	getAllSkills(): PluginSkillDef[] {
		return DEFAULT_SKILLS;
	}

	// Get agent
	getAgent(agent: PluginAgentType): PluginAgentDef | undefined {
		return DEFAULT_AGENTS.find((a) => a.type === agent);
	}

	// Get all agents
	getAllAgents(): PluginAgentDef[] {
		return DEFAULT_AGENTS;
	}

	// Get stats
	getStats(): PluginDevStats {
		return this.stats;
	}

	// Reset stats
	resetStats(): void {
		this.stats = this.getDefaultStats();
		this.saveState();
	}

	// Clear old sessions
	clearOldSessions(keepCount?: number): void {
		if (keepCount) {
			const allSessions = this.listSessions("complete")
				.sort((a, b) => b.created.localeCompare(a.created))
				.slice(keepCount);
			for (const session of allSessions) {
				this.sessions.delete(session.id);
			}
		} else {
			this.sessions.clear();
		}
		this.saveState();
	}
}
