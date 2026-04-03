/**
 * Learning Output Style Pattern (Claude Code Pattern)
 *
 * Interactive learning mode that requests meaningful code contributions
 * at decision points. Agent identifies opportunities for 5-10 lines of
 * meaningful code and prepares context for human contribution.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Decision point categories
 */
export type DecisionPointCategory =
	| "business-logic" // Multiple valid approaches
	| "error-handling" // Strategy choices
	| "algorithm" // Implementation choices
	| "data-structure" // Structure decisions
	| "ux-decision" // User experience choices
	| "architecture" // Design pattern choices
	| "security" // Security approach choices
	| "performance"; // Performance trade-offs

/**
 * Decision point that merits human contribution
 */
export interface DecisionPoint {
	id: string;
	category: DecisionPointCategory;
	description: string;
	file?: string;
	lineRange?: { start: number; end: number };
	functionName?: string;
	context: string; // Background context for the decision
	tradeoffs: string[]; // Trade-offs to consider
	suggestedLocation?: {
		// Where to write the code
		file: string;
		function?: string;
		afterLine?: number;
		beforeLine?: number;
	};
	estimatedLines: number; // Estimated lines to write (5-10)
	priority: number; // 1-10, higher = more important
	autoImplementable: boolean; // Can agent do this automatically?
}

/**
 * Learning insight about implementation choices
 */
export interface LearningInsight {
	id: string;
	category: "architecture" | "patterns" | "evolution" | "tools" | "skills" | "memory" | "safety";
	title: string;
	description: string;
	reason?: string;
	pattern?: string;
	alternatives?: string[];
	priority: number;
}

/**
 * Learning output style configuration
 */
export interface LearningOutputStyleConfig {
	enabled: boolean;
	interactive: boolean; // Request user contributions
	combineExplanatory: boolean; // Include educational insights
	minDecisionPriority: number; // Minimum priority to request contribution
	maxLinesPerRequest: number; // Maximum lines to request (default 10)
	skipCategories: DecisionPointCategory[]; // Categories to skip
	sessionMode: "evolve" | "chat" | "feature" | "debug";
	verbosity: "brief" | "normal" | "detailed";
}

/**
 * Learning output style statistics
 */
export interface LearningOutputStyleStats {
	sessionsEnhanced: number;
	decisionPointsRequested: number;
	decisionPointsContributed: number;
	decisionPointsAutoImplemented: number;
	insightsShown: number;
	topCategories: { category: DecisionPointCategory; count: number }[];
	topInsights: { insightId: string; count: number }[];
	contributionRate: number; // % of requested contributions that were provided
	lastSession: string;
}

/**
 * Session context for learning mode
 */
export interface SessionContext {
	mode: "evolve" | "chat" | "feature" | "debug";
	filesChanged: string[];
	currentTask?: string;
	taskType?: "capability" | "reliability" | "feature";
	skillsUsed: string[];
	recentErrors?: string[];
}

const DEFAULT_CONFIG: LearningOutputStyleConfig = {
	enabled: true,
	interactive: true,
	combineExplanatory: true,
	minDecisionPriority: 5,
	maxLinesPerRequest: 10,
	skipCategories: [],
	sessionMode: "evolve",
	verbosity: "normal",
};

const DEFAULT_INSIGHTS: LearningInsight[] = [
	// Architecture insights
	{
		id: "learning-modular-arch",
		category: "architecture",
		title: "Modular Architecture Benefits",
		description:
			"Modular architecture (tools in src/tools/, modules in src/) enables faster iteration and easier debugging. Each module has a single responsibility.",
		reason: "Understanding architecture helps you write code that fits the existing patterns.",
		pattern: "src/tools/*.ts for tools, src/*.ts for core modules",
		alternatives: ["Monolithic agent.ts", "Feature-based directories"],
		priority: 9,
	},
	{
		id: "learning-wrapper-pattern",
		category: "architecture",
		title: "Tool Wrapper System",
		description:
			"Tools are wrapped with logging, caching, and safety checks. Understanding wrappers helps you debug tool behavior.",
		reason: "Wrappers provide safety and observability without changing tool logic.",
		pattern: "wrapTool() in src/wrap.ts",
		priority: 8,
	},

	// Pattern insights
	{
		id: "learning-evolution-value",
		category: "patterns",
		title: "Evolution Value Scoring",
		description:
			"Tasks are scored 1-10 on evolution value: capability (+3 for success rate), reliability (+2 for reducing failures), feature (lower priority).",
		reason: "Higher-scoring tasks improve self-evolution ability more.",
		pattern: "Score before selecting, prefer capability > reliability > feature",
		priority: 10,
	},
	{
		id: "learning-decision-points",
		category: "patterns",
		title: "Interactive Decision Points",
		description:
			"When you see a decision point (business logic, error handling, algorithm choice), pause and ask the user to contribute 5-10 lines of meaningful code.",
		reason: "Learning by doing is more effective than passive observation.",
		pattern: "Request contribution at decision points, implement obvious code directly",
		alternatives: ["Always implement automatically", "Always ask for input"],
		priority: 9,
	},

	// Evolution insights
	{
		id: "learning-capability-first",
		category: "evolution",
		title: "Capability-First Priority",
		description:
			"Capability tasks improve self-evolution ability itself. If 3+ consecutive iterations are not capability, explain why.",
		reason: "Capability tasks compound - they make future iterations better.",
		priority: 10,
	},
	{
		id: "learning-session-persistence",
		category: "evolution",
		title: "Session Persistence",
		description:
			"Sessions are saved to session_plan/ directory. You can resume long tasks across multiple sessions.",
		reason: "Persistence enables complex multi-step tasks.",
		priority: 7,
	},

	// Tool insights
	{
		id: "learning-assess-tool",
		category: "tools",
		title: "Assess Tool for Verification",
		description:
			"Use assess() before saying DONE. It runs build, tests, lint, and provides recommendations.",
		reason: "Pre-commit verification prevents broken commits.",
		pattern: "assess({maxAttempts: 5}) for auto-retry loops",
		priority: 9,
	},
	{
		id: "learning-learning-tool",
		category: "tools",
		title: "Learning Output Style Tool",
		description:
			'Use learningOutputStyle({action: "detect"}) to identify decision points in current context.',
		reason: "Detecting decision points helps you know when to request user contributions.",
		priority: 8,
	},

	// Skills insights
	{
		id: "learning-skill-workflows",
		category: "skills",
		title: "Skill-Based Workflows",
		description:
			"Skills like evolve, explore-code, plan-architecture provide structured workflows for common tasks.",
		reason: "Skills reduce rework by providing proven approaches.",
		pattern: "Read skills/*/SKILL.md before starting a task",
		priority: 8,
	},

	// Memory insights
	{
		id: "learning-scorecard",
		category: "memory",
		title: "Evolution Scorecard",
		description:
			"MEMORY.md contains a scorecard tracking each iteration: task type, time, first try success, errors, impact.",
		reason: "Scorecard data enables metrics and pattern mining.",
		pattern: "Add row after each iteration with task type and results",
		priority: 9,
	},

	// Safety insights
	{
		id: "learning-safety-gates",
		category: "safety",
		title: "Safety Gates for Self-Modification",
		description: "Safety Gates scan code changes for dangerous patterns before they are applied.",
		reason: "Proactive safety prevents breaking changes.",
		pattern: 'safetyGates({action: "scan", content: "..."})',
		priority: 8,
	},
];

/**
 * Decision point detection patterns
 */
const DECISION_POINT_PATTERNS: Array<{
	category: DecisionPointCategory;
	patterns: string[];
	priority: number;
	autoImplementable: boolean;
}> = [
	{
		category: "business-logic",
		patterns: [
			"business logic",
			"multiple valid approaches",
			"design choice",
			"implementation strategy",
			"how should",
			"what approach",
		],
		priority: 8,
		autoImplementable: false,
	},
	{
		category: "error-handling",
		patterns: [
			"error handling",
			"handle error",
			"error strategy",
			"catch block",
			"error recovery",
			"fail gracefully",
		],
		priority: 7,
		autoImplementable: false,
	},
	{
		category: "algorithm",
		patterns: [
			"algorithm",
			"implementation choice",
			"sorting",
			"searching",
			"optimization",
			"data processing",
		],
		priority: 8,
		autoImplementable: false,
	},
	{
		category: "data-structure",
		patterns: ["data structure", "store data", "model design", "schema", "data representation"],
		priority: 7,
		autoImplementable: false,
	},
	{
		category: "ux-decision",
		patterns: [
			"user experience",
			"ux choice",
			"user flow",
			"interaction",
			"display",
			"presentation",
		],
		priority: 6,
		autoImplementable: false,
	},
	{
		category: "architecture",
		patterns: ["architecture", "design pattern", "abstraction", "module structure", "layer design"],
		priority: 9,
		autoImplementable: false,
	},
	{
		category: "security",
		patterns: [
			"security approach",
			"authentication",
			"authorization",
			"encryption",
			"security trade-off",
		],
		priority: 9,
		autoImplementable: false,
	},
	{
		category: "performance",
		patterns: [
			"performance trade-off",
			"optimization choice",
			"caching strategy",
			"lazy loading",
			"batching",
		],
		priority: 7,
		autoImplementable: false,
	},
];

/**
 * Patterns that indicate code should be implemented directly (not request contribution)
 */
const AUTO_IMPLEMENT_PATTERNS: string[] = [
	"boilerplate",
	"repetitive",
	"obvious implementation",
	"simple crud",
	"configuration",
	"setup",
	"trivial",
	"standard pattern",
	"straightforward",
];

/**
 * Learning Output Style Manager
 *
 * Manages interactive learning mode for requesting meaningful code
 * contributions at decision points.
 */
export class LearningOutputStyleManager {
	private config: LearningOutputStyleConfig;
	private stats: LearningOutputStyleStats;
	private insights: LearningInsight[];
	private configPath: string;

	constructor(configPath?: string) {
		this.configPath =
			configPath || path.join(process.env.HOME || ".", ".paimon", "learning-output-style.json");
		this.config = DEFAULT_CONFIG;
		this.stats = {
			sessionsEnhanced: 0,
			decisionPointsRequested: 0,
			decisionPointsContributed: 0,
			decisionPointsAutoImplemented: 0,
			insightsShown: 0,
			topCategories: [],
			topInsights: [],
			contributionRate: 0,
			lastSession: "",
		};
		this.insights = [...DEFAULT_INSIGHTS];
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
				if (data.insights) {
					this.insights = [...DEFAULT_INSIGHTS, ...data.insights];
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
						insights: this.insights.filter((i) => !DEFAULT_INSIGHTS.find((d) => d.id === i.id)),
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
	 * Generate educational context for session start
	 */
	public generateEducationalContext(sessionContext?: SessionContext): string {
		if (!this.config.enabled) {
			return "";
		}

		const mode = sessionContext?.mode || this.config.sessionMode;
		const relevantInsights = this.getRelevantInsights(mode, sessionContext);

		let context = "";

		// Learning mode header
		if (this.config.interactive) {
			context += this.formatLearningModeHeader(mode);
		}

		// Educational insights
		if (this.config.combineExplanatory && relevantInsights.length > 0) {
			context += `\n${this.formatInsightsBlock(relevantInsights)}`;
		}

		// Mode-specific tips
		context += `\n${this.formatModeTips(mode)}`;

		// Update stats
		this.stats.sessionsEnhanced++;
		this.stats.insightsShown += relevantInsights.length;
		this.stats.lastSession = new Date().toISOString();
		this.saveState();

		return context;
	}

	/**
	 * Format learning mode header
	 */
	private formatLearningModeHeader(mode: string): string {
		return `## Learning Mode Active

When implementing, identify decision points where your input matters:
- **Request contribution**: Business logic, error handling, algorithm choices, architecture decisions
- **Implement directly**: Boilerplate, obvious implementations, configuration, simple CRUD

At decision points, you'll be asked to write 5-10 lines of meaningful code.
`;
	}

	/**
	 * Format insights block
	 */
	private formatInsightsBlock(insights: LearningInsight[]): string {
		const maxInsights =
			this.config.verbosity === "brief" ? 2 : this.config.verbosity === "detailed" ? 5 : 3;

		const topInsights = insights.sort((a, b) => b.priority - a.priority).slice(0, maxInsights);

		let block = "★ Educational Insights ─────────────────────────────────────\n";

		for (const insight of topInsights) {
			block += `\n**${insight.title}**\n`;
			block += `${insight.description}\n`;
			if (this.config.verbosity === "detailed" && insight.reason) {
				block += `_Reason: ${insight.reason}_\n`;
			}
			if (insight.pattern) {
				block += `Pattern: ${insight.pattern}\n`;
			}

			// Track insight shown
			const existing = this.stats.topInsights.find((i) => i.insightId === insight.id);
			if (existing) {
				existing.count++;
			} else {
				this.stats.topInsights.push({ insightId: insight.id, count: 1 });
			}
		}

		block += "\n─────────────────────────────────────────────────────────────\n";
		return block;
	}

	/**
	 * Format mode-specific tips
	 */
	private formatModeTips(mode: string): string {
		const tips: Record<string, string[]> = {
			evolve: [
				"Read MEMORY.md scorecard to understand past patterns",
				"Score tasks before selecting - prefer capability tasks",
				"Use assess() before saying DONE",
			],
			chat: [
				"Identify decision points in user requests",
				"Request contributions for meaningful code choices",
			],
			feature: [
				"Use explore-code skill before making changes",
				"Use plan-architecture skill for design decisions",
				"Request contribution at architecture decision points",
			],
			debug: [
				"Use systematic-debugging skill for structured approach",
				"Request contribution for error handling strategies",
			],
		};

		const modeTips = tips[mode] || tips.chat;
		return `\n**${mode} mode tips:**\n${modeTips.map((t) => `- ${t}`).join("\n")}\n`;
	}

	/**
	 * Get insights relevant to current mode and context
	 */
	private getRelevantInsights(mode: string, context?: SessionContext): LearningInsight[] {
		const categoryPriority: Record<string, string[]> = {
			evolve: ["patterns", "evolution", "memory", "tools", "safety"],
			chat: ["patterns", "tools", "skills"],
			feature: ["architecture", "patterns", "skills", "tools"],
			debug: ["patterns", "tools", "safety"],
		};

		const priorityCategories = categoryPriority[mode] || categoryPriority.chat;

		// Filter by category priority
		const filtered = this.insights.filter(
			(i) => priorityCategories.includes(i.category) && i.priority >= 5,
		);

		// Add context-specific insights
		if (context?.taskType === "capability") {
			const capabilityInsight = this.insights.find((i) => i.id === "learning-capability-first");
			if (capabilityInsight) filtered.push(capabilityInsight);
		}
		if (context?.recentErrors && context.recentErrors.length > 0) {
			const assessInsight = this.insights.find((i) => i.id === "learning-assess-tool");
			if (assessInsight) filtered.push(assessInsight);
		}

		return filtered;
	}

	/**
	 * Detect decision points in context
	 */
	public detectDecisionPoints(
		taskDescription: string,
		files?: string[],
		currentCode?: string,
	): DecisionPoint[] {
		const points: DecisionPoint[] = [];

		// Check task description for decision patterns
		for (const patternGroup of DECISION_POINT_PATTERNS) {
			for (const pattern of patternGroup.patterns) {
				if (taskDescription.toLowerCase().includes(pattern.toLowerCase())) {
					// Check if this should be auto-implemented
					const isAuto = AUTO_IMPLEMENT_PATTERNS.some((p) =>
						taskDescription.toLowerCase().includes(p.toLowerCase()),
					);

					if (!isAuto && patternGroup.priority >= this.config.minDecisionPriority) {
						points.push({
							id: `dp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
							category: patternGroup.category,
							description: `Decision point detected: ${pattern}`,
							context: taskDescription,
							tradeoffs: this.getTradeoffsForCategory(patternGroup.category),
							estimatedLines: 5 + Math.floor(Math.random() * 6),
							priority: patternGroup.priority,
							autoImplementable: patternGroup.autoImplementable,
						});
					}
				}
			}
		}

		// Sort by priority
		return points.sort((a, b) => b.priority - a.priority);
	}

	/**
	 * Get tradeoffs for a decision category
	 */
	private getTradeoffsForCategory(category: DecisionPointCategory): string[] {
		const tradeoffs: Record<DecisionPointCategory, string[]> = {
			"business-logic": [
				"Flexibility vs simplicity",
				"Performance vs maintainability",
				"Feature completeness vs time",
			],
			"error-handling": [
				"Robustness vs complexity",
				"User experience vs strictness",
				"Logging verbosity vs noise",
			],
			algorithm: [
				"Time complexity vs space complexity",
				"Accuracy vs speed",
				"General vs specific solution",
			],
			"data-structure": [
				"Memory efficiency vs access speed",
				"Flexibility vs type safety",
				"Normalization vs redundancy",
			],
			"ux-decision": [
				"Simplicity vs feature completeness",
				"Consistency vs innovation",
				"Accessibility vs aesthetics",
			],
			architecture: [
				"Coupling vs cohesion",
				"Abstraction vs direct implementation",
				"Flexibility vs complexity",
			],
			security: [
				"Security vs usability",
				"Encryption strength vs performance",
				"Strictness vs convenience",
			],
			performance: ["Speed vs memory", "Latency vs throughput", "Caching vs freshness"],
		};
		return tradeoffs[category] || [];
	}

	/**
	 * Format decision point request for user
	 */
	public formatDecisionPointRequest(point: DecisionPoint): string {
		let request = `\n## Decision Point: ${point.category}

**Context:** ${point.context}

**Trade-offs to consider:**
${point.tradeoffs.map((t) => `- ${t}`).join("\n")}

`;

		if (point.suggestedLocation) {
			request += `**Suggested location:** ${point.suggestedLocation.file}`;
			if (point.suggestedLocation.function) {
				request += ` in ${point.suggestedLocation.function}()`;
			}
			if (point.suggestedLocation.afterLine) {
				request += ` after line ${point.suggestedLocation.afterLine}`;
			}
			request += "\n";
		}

		request += `\n**Please write ${point.estimatedLines} lines implementing your preferred approach.**\n`;

		return request;
	}

	/**
	 * Record that a decision point was requested
	 */
	public recordDecisionPointRequested(point: DecisionPoint): void {
		this.stats.decisionPointsRequested++;

		// Update category stats
		const existing = this.stats.topCategories.find((c) => c.category === point.category);
		if (existing) {
			existing.count++;
		} else {
			this.stats.topCategories.push({ category: point.category, count: 1 });
		}

		this.saveState();
	}

	/**
	 * Record that a contribution was provided
	 */
	public recordContributionProvided(pointId: string): void {
		this.stats.decisionPointsContributed++;
		this.updateContributionRate();
		this.saveState();
	}

	/**
	 * Record that code was auto-implemented
	 */
	public recordAutoImplemented(pointId: string): void {
		this.stats.decisionPointsAutoImplemented++;
		this.updateContributionRate();
		this.saveState();
	}

	/**
	 * Update contribution rate
	 */
	private updateContributionRate(): void {
		const total = this.stats.decisionPointsRequested;
		const contributed = this.stats.decisionPointsContributed;
		this.stats.contributionRate = total > 0 ? (contributed / total) * 100 : 0;
	}

	/**
	 * Get current configuration
	 */
	public getConfig(): LearningOutputStyleConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration
	 */
	public updateConfig(updates: Partial<LearningOutputStyleConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveState();
	}

	/**
	 * Get statistics
	 */
	public getStats(): LearningOutputStyleStats {
		return { ...this.stats };
	}

	/**
	 * Get all insights
	 */
	public getInsights(): LearningInsight[] {
		return [...this.insights];
	}

	/**
	 * Get specific insight
	 */
	public getInsight(id: string): LearningInsight | undefined {
		return this.insights.find((i) => i.id === id);
	}

	/**
	 * Get insights by category
	 */
	public getInsightsByCategory(category: string): LearningInsight[] {
		return this.insights.filter((i) => i.category === category);
	}

	/**
	 * Add custom insight
	 */
	public addInsight(insight: LearningInsight): void {
		if (!this.insights.find((i) => i.id === insight.id)) {
			this.insights.push(insight);
			this.saveState();
		}
	}

	/**
	 * Remove custom insight
	 */
	public removeInsight(id: string): boolean {
		const index = this.insights.findIndex((i) => i.id === id);
		if (index > -1 && !DEFAULT_INSIGHTS.find((d) => d.id === id)) {
			this.insights.splice(index, 1);
			this.saveState();
			return true;
		}
		return false;
	}

	/**
	 * Reset statistics
	 */
	public resetStats(): void {
		this.stats = {
			sessionsEnhanced: 0,
			decisionPointsRequested: 0,
			decisionPointsContributed: 0,
			decisionPointsAutoImplemented: 0,
			insightsShown: 0,
			topCategories: [],
			topInsights: [],
			contributionRate: 0,
			lastSession: "",
		};
		this.saveState();
	}

	/**
	 * Enable/disable learning mode
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
let learningManagerInstance: LearningOutputStyleManager | null = null;

/**
 * Get the learning output style manager instance
 */
export function getLearningManager(): LearningOutputStyleManager {
	if (!learningManagerInstance) {
		learningManagerInstance = new LearningOutputStyleManager();
	}
	return learningManagerInstance;
}
