/**
 * PR Review Toolkit (Claude Code Pattern)
 *
 * Comprehensive collection of specialized agents for thorough pull request review,
 * covering code comments, test coverage, error handling, type design, code quality,
 * and code simplification.
 *
 * Inspired by Claude Code's pr-review-toolkit plugin pattern.
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Review agent types
 */
export type ReviewAgentType =
	| "comment-analyzer"
	| "pr-test-analyzer"
	| "silent-failure-hunter"
	| "type-design-analyzer"
	| "code-reviewer"
	| "code-simplifier";

/**
 * Review aspect categories
 */
export type ReviewAspect = "comments" | "tests" | "errors" | "types" | "code" | "simplify" | "all";

/**
 * Confidence level for review findings
 */
export type ConfidenceLevel = "low" | "medium" | "high" | "critical";

/**
 * Severity level for review findings (1-10)
 */
export type SeverityLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * Individual review finding
 */
export interface PRReviewFinding {
	id: string;
	agent: ReviewAgentType;
	aspect: ReviewAspect;
	file: string;
	lineStart: number;
	lineEnd: number;
	description: string;
	severity: SeverityLevel;
	confidence: number;
	confidenceLevel: ConfidenceLevel;
	suggestion: string;
	whyItMatters: string;
	category: string;
	timestamp: string;
}

/**
 * Type design analysis result (rated 1-10 on 4 dimensions)
 */
export interface TypeDesignAnalysis {
	typeName: string;
	file: string;
	encapsulation: number;
	invariantExpression: number;
	usefulness: number;
	invariantEnforcement: number;
	overallScore: number;
	issues: string[];
	suggestions: string[];
}

/**
 * Test coverage analysis result
 */
export interface TestCoverageAnalysis {
	file: string;
	behavioralCoverage: number;
	lineCoverage?: number;
	criticalGaps: string[];
	edgeCasesMissing: string[];
	errorConditionsMissing: string[];
	testQuality: number;
	suggestions: string[];
}

/**
 * Comment analysis result
 */
export interface CommentAnalysis {
	file: string;
	accuracy: number;
	completeness: number;
	outdatedComments: string[];
	misleadingComments: string[];
	documentationGaps: string[];
	suggestions: string[];
}

/**
 * Silent failure analysis result
 */
export interface SilentFailureAnalysis {
	file: string;
	catchBlocks: string[];
	silentFailures: string[];
	inadequateHandling: string[];
	missingLogging: string[];
	fallbackBehaviorIssues: string[];
	severity: SeverityLevel;
	suggestions: string[];
}

/**
 * Specialized review agent definition
 */
export interface SpecializedReviewAgent {
	type: ReviewAgentType;
	name: string;
	description: string;
	focus: string;
	analyzes: string[];
	whenToUse: string[];
	triggers: string[];
	confidenceScoring: string;
	outputFormat: string;
	enabled: boolean;
	priority: number;
}

/**
 * PR Review Toolkit configuration
 */
export interface PRReviewToolkitConfig {
	enabled: boolean;
	confidenceThreshold: number;
	maxFindingsPerAgent: number;
	parallelExecution: boolean;
	autoInvokeOnPR: boolean;
	agentsEnabled: Record<ReviewAgentType, boolean>;
	aspectsToReview: ReviewAspect[];
	outputFormat: "terminal" | "comment" | "structured";
	saveHistory: boolean;
}

/**
 * PR Review Toolkit statistics
 */
export interface PRReviewToolkitStats {
	totalReviews: number;
	reviewsByAgent: Record<ReviewAgentType, number>;
	findingsByAgent: Record<ReviewAgentType, number>;
	findingsByAspect: Record<ReviewAspect, number>;
	findingsByConfidence: Record<ConfidenceLevel, number>;
	averageFindingsPerReview: number;
	averageReviewTime: number;
	issuesFixed: number;
	issuesIgnored: number;
	lastReview: string;
	topCategories: { category: string; count: number }[];
}

/**
 * Review session state
 */
export interface ReviewSession {
	id: string;
	prNumber?: number;
	branch?: string;
	files: string[];
	aspects: ReviewAspect[];
	agents: ReviewAgentType[];
	findings: PRReviewFinding[];
	startedAt: string;
	completedAt?: string;
	duration?: number;
	summary?: string;
}

/**
 * Review result
 */
export interface ReviewResult {
	session: ReviewSession;
	findings: PRReviewFinding[];
	filteredFindings: PRReviewFinding[];
	summary: string;
	recommendations: string[];
	confidenceScore: number;
}

// ============================================================================
// Default Configuration and Agents
// ============================================================================

const DEFAULT_AGENTS: SpecializedReviewAgent[] = [
	{
		type: "comment-analyzer",
		name: "Comment Analyzer",
		description: "Analyzes code comment accuracy and maintainability",
		focus: "Code comment accuracy and maintainability",
		analyzes: [
			"Comment accuracy vs actual code",
			"Documentation completeness",
			"Comment rot and technical debt",
			"Misleading or outdated comments",
		],
		whenToUse: [
			"After adding documentation",
			"Before finalizing PRs with comment changes",
			"When reviewing existing comments",
		],
		triggers: [
			"Check if the comments are accurate",
			"Review the documentation I added",
			"Analyze comments for technical debt",
		],
		confidenceScoring: "Identifies issues with high confidence in accuracy checks",
		outputFormat: "Clear issue identification with file/line refs, explanation, suggestions",
		enabled: true,
		priority: 60,
	},
	{
		type: "pr-test-analyzer",
		name: "PR Test Analyzer",
		description: "Analyzes test coverage quality and completeness",
		focus: "Test coverage quality and completeness",
		analyzes: [
			"Behavioral vs line coverage",
			"Critical gaps in test coverage",
			"Test quality and resilience",
			"Edge cases and error conditions",
		],
		whenToUse: [
			"After creating a PR",
			"When adding new functionality",
			"To verify test thoroughness",
		],
		triggers: [
			"Check if the tests are thorough",
			"Review test coverage for this PR",
			"Are there any critical test gaps?",
		],
		confidenceScoring: "Rates test gaps 1-10 (10 = critical, must add)",
		outputFormat: "Coverage analysis with gaps identified, severity ratings, suggestions",
		enabled: true,
		priority: 70,
	},
	{
		type: "silent-failure-hunter",
		name: "Silent Failure Hunter",
		description: "Hunts for silent failures and inadequate error handling",
		focus: "Error handling and silent failures",
		analyzes: [
			"Silent failures in catch blocks",
			"Inadequate error handling",
			"Inappropriate fallback behavior",
			"Missing error logging",
		],
		whenToUse: [
			"After implementing error handling",
			"When reviewing try/catch blocks",
			"Before finalizing PRs with error handling",
		],
		triggers: [
			"Review the error handling",
			"Check for silent failures",
			"Analyze catch blocks in this PR",
		],
		confidenceScoring: "Flags severity of error handling issues",
		outputFormat: "Silent failure locations with severity, explanation, fix suggestions",
		enabled: true,
		priority: 80,
	},
	{
		type: "type-design-analyzer",
		name: "Type Design Analyzer",
		description: "Analyzes type design quality and invariant expression",
		focus: "Type design quality and invariants",
		analyzes: [
			"Type encapsulation (rated 1-10)",
			"Invariant expression (rated 1-10)",
			"Type usefulness (rated 1-10)",
			"Invariant enforcement (rated 1-10)",
		],
		whenToUse: [
			"When introducing new types",
			"During PR creation with data models",
			"When refactoring type designs",
		],
		triggers: [
			"Review the UserAccount type design",
			"Analyze type design in this PR",
			"Check if this type has strong invariants",
		],
		confidenceScoring: "Rates 4 dimensions on 1-10 scale",
		outputFormat: "Type analysis with dimension scores, issues, improvement suggestions",
		enabled: true,
		priority: 75,
	},
	{
		type: "code-reviewer",
		name: "Code Reviewer",
		description: "General code review for project guidelines compliance",
		focus: "General code review for project guidelines",
		analyzes: ["CLAUDE.md compliance", "Style violations", "Bug detection", "Code quality issues"],
		whenToUse: [
			"After writing or modifying code",
			"Before committing changes",
			"Before creating pull requests",
		],
		triggers: [
			"Review my recent changes",
			"Check if everything looks good",
			"Review this code before I commit",
		],
		confidenceScoring: "Scores issues 0-100 (91-100 = critical)",
		outputFormat: "Issue identification with confidence, severity, file links, suggestions",
		enabled: true,
		priority: 90,
	},
	{
		type: "code-simplifier",
		name: "Code Simplifier",
		description: "Analyzes code for simplification opportunities",
		focus: "Code simplification and refactoring",
		analyzes: [
			"Code clarity and readability",
			"Unnecessary complexity and nesting",
			"Redundant code and abstractions",
			"Consistency with project standards",
			"Overly compact or clever code",
		],
		whenToUse: [
			"After writing or modifying code",
			"After passing code review",
			"When code works but feels complex",
		],
		triggers: ["Simplify this code", "Make this clearer", "Refine this implementation"],
		confidenceScoring: "Identifies complexity and suggests simplifications with confidence",
		outputFormat: "Simplification opportunities with current vs suggested code, rationale",
		enabled: true,
		priority: 50,
	},
];

const DEFAULT_CONFIG: PRReviewToolkitConfig = {
	enabled: true,
	confidenceThreshold: 80,
	maxFindingsPerAgent: 10,
	parallelExecution: true,
	autoInvokeOnPR: true,
	agentsEnabled: {
		"comment-analyzer": true,
		"pr-test-analyzer": true,
		"silent-failure-hunter": true,
		"type-design-analyzer": true,
		"code-reviewer": true,
		"code-simplifier": true,
	},
	aspectsToReview: ["all"],
	outputFormat: "terminal",
	saveHistory: true,
};

// ============================================================================
// PR Review Toolkit Manager Class
// ============================================================================

export class PRReviewToolkitManager {
	private config: PRReviewToolkitConfig;
	private stats: PRReviewToolkitStats;
	private agents: Map<ReviewAgentType, SpecializedReviewAgent>;
	private sessions: Map<string, ReviewSession>;
	private configPath: string;
	private statsPath: string;
	private sessionsPath: string;

	constructor(configPath?: string) {
		this.configPath =
			configPath || path.join(process.env.HOME || "~", ".paimon", "pr-review-toolkit.json");
		this.statsPath = path.join(process.env.HOME || "~", ".paimon", "pr-review-toolkit-stats.json");
		this.sessionsPath = path.join(process.env.HOME || "~", ".paimon", "pr-review-toolkit-sessions");

		this.config = this.loadConfig();
		this.stats = this.loadStats();
		this.agents = new Map();
		this.sessions = new Map();

		for (const agent of DEFAULT_AGENTS) {
			this.agents.set(agent.type, agent);
		}

		this.loadSessions();
	}

	private loadConfig(): PRReviewToolkitConfig {
		try {
			if (fs.existsSync(this.configPath)) {
				const data = fs.readFileSync(this.configPath, "utf-8");
				return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
			}
		} catch {
			// Use defaults
		}
		return { ...DEFAULT_CONFIG };
	}

	private saveConfig(): void {
		try {
			const dir = path.dirname(this.configPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
		} catch {
			// Silently fail
		}
	}

	private loadStats(): PRReviewToolkitStats {
		try {
			if (fs.existsSync(this.statsPath)) {
				const data = fs.readFileSync(this.statsPath, "utf-8");
				return JSON.parse(data);
			}
		} catch {
			// Use defaults
		}
		return this.getDefaultStats();
	}

	private getDefaultStats(): PRReviewToolkitStats {
		return {
			totalReviews: 0,
			reviewsByAgent: {
				"comment-analyzer": 0,
				"pr-test-analyzer": 0,
				"silent-failure-hunter": 0,
				"type-design-analyzer": 0,
				"code-reviewer": 0,
				"code-simplifier": 0,
			},
			findingsByAgent: {
				"comment-analyzer": 0,
				"pr-test-analyzer": 0,
				"silent-failure-hunter": 0,
				"type-design-analyzer": 0,
				"code-reviewer": 0,
				"code-simplifier": 0,
			},
			findingsByAspect: {
				comments: 0,
				tests: 0,
				errors: 0,
				types: 0,
				code: 0,
				simplify: 0,
				all: 0,
			},
			findingsByConfidence: {
				low: 0,
				medium: 0,
				high: 0,
				critical: 0,
			},
			averageFindingsPerReview: 0,
			averageReviewTime: 0,
			issuesFixed: 0,
			issuesIgnored: 0,
			lastReview: "",
			topCategories: [],
		};
	}

	private saveStats(): void {
		try {
			const dir = path.dirname(this.statsPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(this.statsPath, JSON.stringify(this.stats, null, 2));
		} catch {
			// Silently fail
		}
	}

	private loadSessions(): void {
		try {
			if (fs.existsSync(this.sessionsPath)) {
				const files = fs.readdirSync(this.sessionsPath);
				for (const file of files.slice(-50)) {
					if (file.endsWith(".json")) {
						const data = fs.readFileSync(path.join(this.sessionsPath, file), "utf-8");
						const session: ReviewSession = JSON.parse(data);
						this.sessions.set(session.id, session);
					}
				}
			}
		} catch {
			// Silently fail
		}
	}

	private saveSession(session: ReviewSession): void {
		try {
			const dir = this.sessionsPath;
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(path.join(dir, `${session.id}.json`), JSON.stringify(session, null, 2));
		} catch {
			// Silently fail
		}
	}

	isEnabled(): boolean {
		return this.config.enabled;
	}

	setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveConfig();
	}

	getConfig(): PRReviewToolkitConfig {
		return { ...this.config };
	}

	updateConfig(updates: Partial<PRReviewToolkitConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveConfig();
	}

	getAgents(): SpecializedReviewAgent[] {
		return Array.from(this.agents.values());
	}

	getAgent(type: ReviewAgentType): SpecializedReviewAgent | undefined {
		return this.agents.get(type);
	}

	getAgentsByAspect(aspect: ReviewAspect): SpecializedReviewAgent[] {
		const aspectToAgent: Record<ReviewAspect, ReviewAgentType[]> = {
			comments: ["comment-analyzer"],
			tests: ["pr-test-analyzer"],
			errors: ["silent-failure-hunter"],
			types: ["type-design-analyzer"],
			code: ["code-reviewer"],
			simplify: ["code-simplifier"],
			all: [
				"comment-analyzer",
				"pr-test-analyzer",
				"silent-failure-hunter",
				"type-design-analyzer",
				"code-reviewer",
				"code-simplifier",
			],
		};
		const agentTypes = aspectToAgent[aspect] || aspectToAgent.all;
		return agentTypes
			.map((type) => this.agents.get(type))
			.filter((a): a is SpecializedReviewAgent => Boolean(a?.enabled));
	}

	setAgentEnabled(type: ReviewAgentType, enabled: boolean): void {
		const agent = this.agents.get(type);
		if (agent) {
			agent.enabled = enabled;
			this.config.agentsEnabled[type] = enabled;
			this.saveConfig();
		}
	}

	startReview(
		files: string[],
		aspects: ReviewAspect[] = ["all"],
		prNumber?: number,
		branch?: string,
	): ReviewSession {
		const sessionId = `review-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
		const agentsToRun = aspects.includes("all")
			? this.getAgents()
			: aspects.flatMap((a) => this.getAgentsByAspect(a));

		const session: ReviewSession = {
			id: sessionId,
			prNumber,
			branch,
			files,
			aspects,
			agents: agentsToRun.map((a) => a.type),
			findings: [],
			startedAt: new Date().toISOString(),
		};

		this.sessions.set(sessionId, session);
		this.saveSession(session);

		return session;
	}

	addFinding(sessionId: string, finding: PRReviewFinding): void {
		const session = this.sessions.get(sessionId);
		if (session) {
			session.findings.push(finding);
			this.saveSession(session);
			this.stats.findingsByAgent[finding.agent]++;
			this.stats.findingsByAspect[finding.aspect]++;
			this.stats.findingsByConfidence[finding.confidenceLevel]++;
			this.saveStats();
		}
	}

	completeReview(sessionId: string, summary: string): ReviewResult {
		const session = this.sessions.get(sessionId);
		if (!session) {
			throw new Error(`Session ${sessionId} not found`);
		}

		session.completedAt = new Date().toISOString();
		session.duration =
			new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime();
		session.summary = summary;
		this.saveSession(session);

		const filteredFindings = session.findings.filter(
			(f) => f.confidence >= this.config.confidenceThreshold,
		);

		this.stats.totalReviews++;
		for (const agent of session.agents) {
			this.stats.reviewsByAgent[agent]++;
		}
		this.stats.averageFindingsPerReview =
			(this.stats.averageFindingsPerReview * (this.stats.totalReviews - 1) +
				session.findings.length) /
			this.stats.totalReviews;
		this.stats.averageReviewTime =
			(this.stats.averageReviewTime * (this.stats.totalReviews - 1) + (session.duration || 0)) /
			this.stats.totalReviews;
		this.stats.lastReview = session.completedAt;
		this.saveStats();

		const recommendations = this.generateRecommendations(filteredFindings);
		const confidenceScore =
			filteredFindings.length > 0
				? Math.round(
						filteredFindings.reduce((sum, f) => sum + f.confidence, 0) / filteredFindings.length,
					)
				: 100;

		return {
			session,
			findings: session.findings,
			filteredFindings,
			summary,
			recommendations,
			confidenceScore,
		};
	}

	private generateRecommendations(findings: PRReviewFinding[]): string[] {
		const recommendations: string[] = [];
		const critical = findings.filter((f) => f.severity >= 9);
		const high = findings.filter((f) => f.severity >= 7 && f.severity < 9);
		const medium = findings.filter((f) => f.severity >= 5 && f.severity < 7);

		if (critical.length > 0) {
			recommendations.push(
				`Address ${critical.length} critical issues immediately before proceeding`,
			);
		}
		if (high.length > 0) {
			recommendations.push(`Fix ${high.length} high-severity issues before merging`);
		}
		if (medium.length > 0) {
			recommendations.push(`Consider addressing ${medium.length} medium-severity issues`);
		}

		const agentFindings: Record<ReviewAgentType, number> = {
			"comment-analyzer": 0,
			"pr-test-analyzer": 0,
			"silent-failure-hunter": 0,
			"type-design-analyzer": 0,
			"code-reviewer": 0,
			"code-simplifier": 0,
		};
		for (const f of findings) {
			agentFindings[f.agent]++;
		}

		if (agentFindings["pr-test-analyzer"] > 0) {
			recommendations.push("Add missing test cases before merging");
		}
		if (agentFindings["silent-failure-hunter"] > 0) {
			recommendations.push("Add proper error handling and logging");
		}
		if (agentFindings["type-design-analyzer"] > 0) {
			recommendations.push("Strengthen type invariants and validation");
		}
		if (agentFindings["code-simplifier"] > 0) {
			recommendations.push("Consider simplifying complex code sections after core fixes");
		}

		return recommendations;
	}

	getStats(): PRReviewToolkitStats {
		return { ...this.stats };
	}

	getSessionHistory(limit = 10): ReviewSession[] {
		return Array.from(this.sessions.values())
			.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
			.slice(0, limit);
	}

	getSession(sessionId: string): ReviewSession | undefined {
		return this.sessions.get(sessionId);
	}

	markFindingFixed(sessionId: string, findingId: string): void {
		this.stats.issuesFixed++;
		this.saveStats();
	}

	markFindingIgnored(sessionId: string, findingId: string): void {
		this.stats.issuesIgnored++;
		this.saveStats();
	}

	resetStats(): void {
		this.stats = this.getDefaultStats();
		this.saveStats();
	}

	clearSessions(): void {
		this.sessions.clear();
		try {
			if (fs.existsSync(this.sessionsPath)) {
				const files = fs.readdirSync(this.sessionsPath);
				for (const file of files) {
					fs.unlinkSync(path.join(this.sessionsPath, file));
				}
			}
		} catch {
			// Silently fail
		}
	}

	analyzeComments(files: string[]): CommentAnalysis[] {
		return [];
	}

	analyzeTestCoverage(files: string[]): TestCoverageAnalysis[] {
		return [];
	}

	huntSilentFailures(files: string[]): SilentFailureAnalysis[] {
		return [];
	}

	analyzeTypeDesign(files: string[]): TypeDesignAnalysis[] {
		return [];
	}

	formatReviewResult(result: ReviewResult, format: "terminal" | "comment"): string {
		const lines: string[] = [];

		if (format === "comment") {
			lines.push("## PR Review");
			lines.push("");
		} else {
			lines.push("=== PR Review Toolkit Results ===");
			lines.push("");
		}

		lines.push(`**Confidence Score:** ${result.confidenceScore}/100`);
		lines.push(
			`**Findings:** ${result.filteredFindings.length} (filtered from ${result.findings.length})`,
		);
		lines.push("");

		if (result.filteredFindings.length > 0) {
			lines.push("### Findings");
			lines.push("");

			const byAgent: Record<string, PRReviewFinding[]> = {};
			for (const f of result.filteredFindings) {
				if (!byAgent[f.agent]) {
					byAgent[f.agent] = [];
				}
				byAgent[f.agent].push(f);
			}

			for (const [agent, findings] of Object.entries(byAgent)) {
				const agentInfo = this.agents.get(agent as ReviewAgentType);
				lines.push(`**${agentInfo?.name || agent}** (${findings.length} issues)`);
				lines.push("");

				for (let i = 0; i < findings.length; i++) {
					const f = findings[i];
					lines.push(`${i + 1}. ${f.description}`);
					lines.push(`   - File: ${f.file}#${f.lineStart}-${f.lineEnd}`);
					lines.push(`   - Severity: ${f.severity}/10 | Confidence: ${f.confidence}`);
					lines.push(`   - Suggestion: ${f.suggestion}`);
					lines.push("");
				}
			}
		} else {
			lines.push("No high-confidence findings detected.");
			lines.push("");
		}

		if (result.recommendations.length > 0) {
			lines.push("### Recommendations");
			lines.push("");
			for (const r of result.recommendations) {
				lines.push(`- ${r}`);
			}
			lines.push("");
		}

		return lines.join("\n");
	}

	formatAgents(): string {
		const lines: string[] = [];
		lines.push("=== PR Review Toolkit Agents ===");
		lines.push("");

		for (const agent of this.getAgents()) {
			lines.push(`**${agent.name}** (${agent.type})`);
			lines.push(`  Focus: ${agent.focus}`);
			lines.push(`  Enabled: ${agent.enabled}`);
			lines.push(`  Priority: ${agent.priority}`);
			lines.push("");
			lines.push("  Analyzes:");
			for (const item of agent.analyzes) {
				lines.push(`    - ${item}`);
			}
			lines.push("");
		}

		return lines.join("\n");
	}

	formatStats(): string {
		const lines: string[] = [];
		lines.push("=== PR Review Toolkit Statistics ===");
		lines.push("");

		lines.push(`Total Reviews: ${this.stats.totalReviews}`);
		lines.push(`Average Findings/Review: ${this.stats.averageFindingsPerReview.toFixed(1)}`);
		lines.push(`Average Review Time: ${this.stats.averageReviewTime.toFixed(0)}ms`);
		lines.push(`Issues Fixed: ${this.stats.issuesFixed}`);
		lines.push(`Issues Ignored: ${this.stats.issuesIgnored}`);
		if (this.stats.lastReview) {
			lines.push(`Last Review: ${this.stats.lastReview}`);
		}
		lines.push("");

		lines.push("Reviews by Agent:");
		for (const [agent, count] of Object.entries(this.stats.reviewsByAgent)) {
			const agentInfo = this.agents.get(agent as ReviewAgentType);
			lines.push(`  ${agentInfo?.name || agent}: ${count}`);
		}
		lines.push("");

		return lines.join("\n");
	}
}

// ============================================================================
// Singleton Instance
// ============================================================================

let toolkitInstance: PRReviewToolkitManager | null = null;

export function getPRReviewToolkit(): PRReviewToolkitManager {
	if (!toolkitInstance) {
		toolkitInstance = new PRReviewToolkitManager();
	}
	return toolkitInstance;
}

// ============================================================================
// Helper Functions
// ============================================================================

export function generateFindingId(): string {
	return `finding-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getConfidenceLevel(score: number): ConfidenceLevel {
	if (score >= 91) return "critical";
	if (score >= 75) return "high";
	if (score >= 50) return "medium";
	return "low";
}

export function parseReviewAspect(aspect: string): ReviewAspect {
	const validAspects: ReviewAspect[] = [
		"comments",
		"tests",
		"errors",
		"types",
		"code",
		"simplify",
		"all",
	];
	return validAspects.includes(aspect as ReviewAspect) ? (aspect as ReviewAspect) : "all";
}

export function parseAgentType(type: string): ReviewAgentType | null {
	const validTypes: ReviewAgentType[] = [
		"comment-analyzer",
		"pr-test-analyzer",
		"silent-failure-hunter",
		"type-design-analyzer",
		"code-reviewer",
		"code-simplifier",
	];
	return validTypes.includes(type as ReviewAgentType) ? (type as ReviewAgentType) : null;
}
