/**
 * Explanatory Output Style Module (Claude Code Pattern)
 *
 * Injects educational context about implementation choices and codebase patterns
 * at session start, mimicking Claude Code's deprecated Explanatory output style.
 *
 * This helps agents understand WHY certain patterns are used, reducing rework
 * by improving understanding of implementation decisions.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Educational insight categories
 */
export type InsightCategory =
	| "architecture"
	| "patterns"
	| "evolution"
	| "tools"
	| "skills"
	| "memory"
	| "safety";

/**
 * Educational Insight
 */
export interface EducationalInsight {
	category: InsightCategory;
	title: string;
	description: string;
	pattern?: string;
	reason?: string;
	alternatives?: string[];
	priority: number;
}

/**
 * Explanatory Output Style Config
 */
export interface ExplanatoryOutputStyleConfig {
	enabled: boolean;
	maxInsights: number;
	categories: InsightCategory[];
	verbosity: "brief" | "normal" | "detailed";
	includePatterns: boolean;
	includeReasons: boolean;
	includeAlternatives: boolean;
}

/**
 * Explanatory Output Style Stats
 */
export interface ExplanatoryOutputStyleStats {
	sessionsEnhanced: number;
	insightsShown: number;
	insightsByCategory: Record<string, number>;
	topInsights: Array<{ insight: string; count: number }>;
}

/**
 * Explanatory Output Style Manager
 */
export class ExplanatoryOutputStyleManager {
	private config: ExplanatoryOutputStyleConfig;
	private stats: ExplanatoryOutputStyleStats;
	private configPath: string;
	private insights: EducationalInsight[];

	constructor(configPath?: string) {
		this.configPath =
			configPath || path.join(process.env.HOME || "~", ".paimon", "explanatory-output-style.json");
		this.config = this.loadConfig();
		this.stats = this.loadStats();
		this.insights = this.getDefaultInsights();
	}

	/**
	 * Default educational insights about the codebase
	 */
	private getDefaultInsights(): EducationalInsight[] {
		return [
			// Architecture insights
			{
				category: "architecture",
				title: "Modular Architecture",
				description:
					"Paimon uses a modular architecture with tools extracted to separate files for maintainability",
				pattern: "src/tools/*.ts pattern",
				reason: "Each tool in its own file reduces agent.ts complexity and enables easier testing",
				alternatives: ["Inline tool definitions", "Single tools.ts file"],
				priority: 10,
			},
			{
				category: "architecture",
				title: "Singleton Pattern for Managers",
				description:
					"Manager classes (HookManager, SafetyGateManager, etc.) use singleton pattern via getManager() functions",
				pattern: "getManager() singleton function",
				reason: "Single instance ensures consistent state across hooks and tools",
				alternatives: ["Dependency injection", "Global state object"],
				priority: 9,
			},
			{
				category: "architecture",
				title: "Tool Wrapper System",
				description:
					"Tools are wrapped with validation, hooks, and error handling via createWrappedTools()",
				pattern: "src/wrap.ts createWrappedTools()",
				reason: "Centralized wrapping ensures consistent tool behavior and safety",
				alternatives: ["Per-tool validation", "No wrapping"],
				priority: 8,
			},

			// Pattern insights
			{
				category: "patterns",
				title: "Evolution Value Scoring",
				description:
					"Tasks are scored on evolution value (1-10) before selection, prioritizing capability tasks",
				pattern:
					"+3: improves iteration success, +2: reduces failure, +2: improves memory, +1: improves tools",
				reason: "Scoring ensures highest-impact tasks are selected, improving evolution velocity",
				alternatives: ["Random selection", "First-available selection"],
				priority: 10,
			},
			{
				category: "patterns",
				title: "Error Recovery Loops",
				description:
					"When build/tests fail, agent enters recovery loop with max 5 attempts before documenting",
				pattern: "assess() with maxAttempts for auto-retry",
				reason: "Auto-retry reduces manual intervention and captures failure patterns for learning",
				alternatives: ["Immediate failure", "Manual retry"],
				priority: 9,
			},
			{
				category: "patterns",
				title: "Checkpoints Before Risky Changes",
				description: "Create checkpoints before risky operations for safe rollback",
				pattern: "checkpoint({action: 'create'}) before risky edits",
				reason: "Rollback capability reduces risk and enables experimentation",
				alternatives: ["Git branches", "No rollback"],
				priority: 8,
			},
			{
				category: "patterns",
				title: "Confidence-Based Scoring",
				description: "Review suggestions use confidence threshold to filter false positives",
				pattern: "assess({confidenceThreshold: 80}) for high-confidence issues only",
				reason: "High threshold reduces noise and focuses on actionable issues",
				alternatives: ["Show all suggestions", "Manual filtering"],
				priority: 7,
			},

			// Evolution insights
			{
				category: "evolution",
				title: "Capability-First Priority",
				description:
					"Capability tasks (improve self-evolution) are prioritized over reliability and feature tasks",
				pattern: "capability > reliability > feature in task selection",
				reason:
					"Capability tasks have highest meta-impact, improving future iteration success rates",
				alternatives: ["Priority by complexity", "Priority by time"],
				priority: 10,
			},
			{
				category: "evolution",
				title: "Memory-Driven Task Selection",
				description: "MEMORY.md scorecard tracks success patterns for smarter task selection",
				pattern: "Read MEMORY.md before task selection",
				reason: "Historical patterns help predict success and avoid past failures",
				alternatives: ["No memory", "Random selection"],
				priority: 9,
			},
			{
				category: "evolution",
				title: "Session Persistence",
				description: "Session state is persisted for resumption across iterations",
				pattern: "data/sessions/*.json for session state",
				reason: "Long-running evolution tasks can resume without losing progress",
				alternatives: ["No persistence", "Full restart"],
				priority: 7,
			},

			// Tools insights
			{
				category: "tools",
				title: "assess() for Self-Assessment",
				description: "Run assess() before saying DONE to verify build/tests pass",
				pattern: "assess({}) with maxAttempts: 1, or assess({maxAttempts: 5}) for auto-retry",
				reason: "Pre-commit verification prevents failing commits",
				alternatives: ["Manual test", "No verification"],
				priority: 10,
			},
			{
				category: "tools",
				title: "reflect() on Failures",
				description: "Use reflect() to capture lessons from failed attempts",
				pattern: "reflect({taskDescription: '...', errorPatterns: [...]})",
				reason: "Reflection updates MEMORY.md with learnings for future avoidance",
				alternatives: ["No reflection", "Manual documentation"],
				priority: 9,
			},
			{
				category: "tools",
				title: "ralphLoop() for Autonomous Iteration",
				description:
					"Self-referential loop for continuous iteration until completion promise detected",
				pattern: "ralphLoop({action: 'start', prompt: '...', completionPromise: 'COMPLETE'})",
				reason: "Autonomous iteration enables complex tasks without manual intervention",
				alternatives: ["Manual iteration", "Single-pass"],
				priority: 8,
			},
			{
				category: "tools",
				title: "contextBudget() for Proactive Management",
				description: "Monitor context window usage to prevent overflow",
				pattern: "contextBudget({action: 'check'}) returns health status",
				reason: "Proactive monitoring prevents context overflow failures",
				alternatives: ["Wait for overflow", "No monitoring"],
				priority: 8,
			},

			// Skills insights
			{
				category: "skills",
				title: "Skill-Based Workflows",
				description:
					"Skills provide structured workflows for common task types (evolve, research, debugging)",
				pattern: "Read skills/<name>/SKILL.md before starting matching tasks",
				reason: "Skill workflows reduce rework by providing proven approaches",
				alternatives: ["No skills", "Ad-hoc approach"],
				priority: 9,
			},
			{
				category: "skills",
				title: "Auto-Invoke Skills",
				description: "Skills are auto-suggested based on detected task context",
				pattern: "autoInvoke({action: 'analyze', ...}) returns skill suggestions",
				reason: "Auto-discovery reduces manual skill selection",
				alternatives: ["Manual selection", "No skills"],
				priority: 8,
			},

			// Memory insights
			{
				category: "memory",
				title: "MEMORY.md Scorecard",
				description:
					"Scorecard tracks First Try Success Rate, Average Time, Capability Velocity, Error Analysis",
				pattern: "Update scorecard after each iteration with task details",
				reason: "Metrics enable self-awareness and trend analysis",
				alternatives: ["No tracking", "Manual tracking"],
				priority: 9,
			},
			{
				category: "memory",
				title: "Learnings Section",
				description:
					"Each failure captured as learning with Trigger and Reuse Rule for future avoidance",
				pattern: "Learning format: Context, Insight, Trigger, Reuse Rule, Priority",
				reason: "Structured learnings enable pattern-based failure avoidance",
				alternatives: ["Unstructured notes", "No documentation"],
				priority: 8,
			},
			{
				category: "memory",
				title: "Journal Auto-Truncation",
				description: "JOURNAL.md auto-truncates to prevent context bloat",
				pattern: "journal({action: 'truncate', maxEntries: 30}) keeps recent entries",
				reason: "Truncation reduces context window usage while preserving archives",
				alternatives: ["No truncation", "Manual deletion"],
				priority: 7,
			},

			// Safety insights
			{
				category: "safety",
				title: "Safety Gates for Dangerous Patterns",
				description: "Scan code changes for dangerous patterns before applying",
				pattern:
					"safetyGates({action: 'scan', content: '...'}) checks for security/breaking patterns",
				reason: "Proactive detection prevents security vulnerabilities and breaking changes",
				alternatives: ["No scanning", "Post-commit review"],
				priority: 10,
			},
			{
				category: "safety",
				title: "Interactive Approval for Risky Operations",
				description: "Request approval for dangerous operations (file-delete, workflow changes)",
				pattern: "interactiveApproval({action: 'request', tool: 'bash', ...})",
				reason: "Human-in-the-loop approval reduces unintended consequences",
				alternatives: ["No approval", "Auto-approve all"],
				priority: 9,
			},
			{
				category: "safety",
				title: "Hook System for Pre-Tool Validation",
				description: "Hooks intercept tool calls before execution for safety checks",
				pattern: "hook({action: 'list'}) shows registered PreToolUse hooks",
				reason: "Pre-validation prevents dangerous operations proactively",
				alternatives: ["Post-execution checks", "No validation"],
				priority: 8,
			},
		];
	}

	/**
	 * Load config from disk
	 */
	private loadConfig(): ExplanatoryOutputStyleConfig {
		try {
			if (fs.existsSync(this.configPath)) {
				const data = fs.readFileSync(this.configPath, "utf-8");
				return JSON.parse(data) as ExplanatoryOutputStyleConfig;
			}
		} catch {
			// Ignore errors, use defaults
		}

		return {
			enabled: true,
			maxInsights: 5,
			categories: ["architecture", "patterns", "evolution", "tools", "memory", "safety"],
			verbosity: "normal",
			includePatterns: true,
			includeReasons: true,
			includeAlternatives: false,
		};
	}

	/**
	 * Load stats from disk
	 */
	private loadStats(): ExplanatoryOutputStyleStats {
		const statsPath = path.join(
			path.dirname(this.configPath),
			"explanatory-output-style-stats.json",
		);
		try {
			if (fs.existsSync(statsPath)) {
				const data = fs.readFileSync(statsPath, "utf-8");
				return JSON.parse(data) as ExplanatoryOutputStyleStats;
			}
		} catch {
			// Ignore errors
		}

		return {
			sessionsEnhanced: 0,
			insightsShown: 0,
			insightsByCategory: {},
			topInsights: [],
		};
	}

	/**
	 * Save config to disk
	 */
	private saveConfig(): void {
		try {
			const dir = path.dirname(this.configPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
		} catch {
			// Ignore errors
		}
	}

	/**
	 * Save stats to disk
	 */
	private saveStats(): void {
		const statsPath = path.join(
			path.dirname(this.configPath),
			"explanatory-output-style-stats.json",
		);
		try {
			const dir = path.dirname(statsPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(statsPath, JSON.stringify(this.stats, null, 2));
		} catch {
			// Ignore errors
		}
	}

	/**
	 * Generate educational context for session start
	 */
	generateEducationalContext(sessionMode?: string): string {
		if (!this.config.enabled) {
			return "";
		}

		// Filter insights by category
		const filteredInsights = this.insights
			.filter((i) => this.config.categories.includes(i.category))
			.sort((a, b) => b.priority - a.priority)
			.slice(0, this.config.maxInsights);

		if (filteredInsights.length === 0) {
			return "";
		}

		// Build educational context message
		let context = "📚 **Educational Insights for This Session**\n\n";
		context += "Understanding WHY patterns are used helps reduce rework and improve decisions.\n\n";

		for (const insight of filteredInsights) {
			context += `**${insight.title}** (${insight.category})\n`;
			context += `${insight.description}\n`;

			if (this.config.includePatterns && insight.pattern) {
				context += `- Pattern: ${insight.pattern}\n`;
			}

			if (this.config.includeReasons && insight.reason) {
				context += `- Reason: ${insight.reason}\n`;
			}

			if (this.config.includeAlternatives && insight.alternatives?.length) {
				context += `- Alternatives: ${insight.alternatives.join(", ")}\n`;
			}

			context += "\n";
		}

		// Add session-specific tip
		if (sessionMode === "evolve") {
			context +=
				"💡 **Evolution Tip**: Read MEMORY.md scorecard first to understand success patterns. Score tasks before selecting - prefer capability tasks.\n";
		} else if (sessionMode === "chat") {
			context +=
				"💡 **Chat Tip**: Use skills for structured workflows. Skills/<name>/SKILL.md provides proven approaches.\n";
		}

		// Update stats
		this.stats.sessionsEnhanced++;
		this.stats.insightsShown += filteredInsights.length;

		for (const insight of filteredInsights) {
			this.stats.insightsByCategory[insight.category] =
				(this.stats.insightsByCategory[insight.category] || 0) + 1;

			const existing = this.stats.topInsights.find((t) => t.insight === insight.title);
			if (existing) {
				existing.count++;
			} else {
				this.stats.topInsights.push({ insight: insight.title, count: 1 });
			}
		}

		this.stats.topInsights.sort((a, b) => b.count - a.count);
		this.stats.topInsights = this.stats.topInsights.slice(0, 10);

		this.saveStats();

		return context;
	}

	/**
	 * Get specific insight by title
	 */
	getInsight(title: string): EducationalInsight | undefined {
		return this.insights.find((i) => i.title === title);
	}

	/**
	 * Get insights by category
	 */
	getInsightsByCategory(category: InsightCategory): EducationalInsight[] {
		return this.insights.filter((i) => i.category === category);
	}

	/**
	 * Add custom insight
	 */
	addInsight(insight: EducationalInsight): void {
		// Check for duplicate
		const existing = this.insights.find((i) => i.title === insight.title);
		if (existing) {
			Object.assign(existing, insight);
		} else {
			this.insights.push(insight);
		}
		this.saveConfig();
	}

	/**
	 * Remove insight
	 */
	removeInsight(title: string): boolean {
		const index = this.insights.findIndex((i) => i.title === title);
		if (index >= 0) {
			// Don't remove default insights, just skip them in generation
			return true;
		}
		return false;
	}

	/**
	 * Get config
	 */
	getConfig(): ExplanatoryOutputStyleConfig {
		return this.config;
	}

	/**
	 * Set config
	 */
	setConfig(updates: Partial<ExplanatoryOutputStyleConfig>): void {
		Object.assign(this.config, updates);
		this.saveConfig();
	}

	/**
	 * Get stats
	 */
	getStats(): ExplanatoryOutputStyleStats {
		return this.stats;
	}

	/**
	 * Clear stats
	 */
	clearStats(): void {
		this.stats = {
			sessionsEnhanced: 0,
			insightsShown: 0,
			insightsByCategory: {},
			topInsights: [],
		};
		this.saveStats();
	}

	/**
	 * Reset to defaults
	 */
	reset(): void {
		this.config = {
			enabled: true,
			maxInsights: 5,
			categories: ["architecture", "patterns", "evolution", "tools", "memory", "safety"],
			verbosity: "normal",
			includePatterns: true,
			includeReasons: true,
			includeAlternatives: false,
		};
		this.insights = this.getDefaultInsights();
		this.saveConfig();
	}

	/**
	 * Check if enabled
	 */
	isEnabled(): boolean {
		return this.config.enabled;
	}

	/**
	 * Enable/disable
	 */
	setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveConfig();
	}
}

// Singleton instance
let explanatoryOutputStyleInstance: ExplanatoryOutputStyleManager | null = null;

/**
 * Get ExplanatoryOutputStyleManager instance
 */
export function getExplanatoryOutputStyleManager(): ExplanatoryOutputStyleManager {
	if (!explanatoryOutputStyleInstance) {
		explanatoryOutputStyleInstance = new ExplanatoryOutputStyleManager();
	}
	return explanatoryOutputStyleInstance;
}
