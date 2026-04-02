/**
 * Auto-Invoke Skills Module (Claude Code Pattern)
 *
 * Automatically triggers skills based on detected task context.
 * Inspired by Claude Code's frontend-design skill that auto-invokes for frontend work.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Trigger types for auto-invoke rules
 */
export type TriggerType = "file_pattern" | "keyword" | "context" | "tool_usage" | "task_type";

/**
 * Context types for task detection
 */
export type ContextType =
	| "frontend"
	| "backend"
	| "testing"
	| "debugging"
	| "evolution"
	| "refactoring"
	| "documentation"
	| "security";

/**
 * Auto-Invoke Rule
 */
export interface AutoInvokeRule {
	id: string;
	name: string;
	description: string;
	skill: string;
	triggers: AutoInvokeTrigger[];
	priority: number;
	enabled: boolean;
	confidenceThreshold: number;
	createdAt: string;
	lastInvoked?: string;
	invokeCount: number;
}

/**
 * Auto-Invoke Trigger
 */
export interface AutoInvokeTrigger {
	type: TriggerType;
	pattern: string;
	weight: number;
	description?: string;
}

/**
 * Auto-Invoke Config
 */
export interface AutoInvokeConfig {
	enabled: boolean;
	rules: AutoInvokeRule[];
	dataPath: string;
	maxSuggestions: number;
	minConfidence: number;
}

/**
 * Auto-Invoke Stats
 */
export interface AutoInvokeStats {
	totalInvocations: number;
	successfulInvocations: number;
	rulesBySkill: Record<string, number>;
	rulesByTrigger: Record<string, number>;
	topRules: Array<{ rule: string; count: number }>;
	confidenceDistribution: Record<string, number>;
}

/**
 * Auto-Invoke Suggestion
 */
export interface AutoInvokeSuggestion {
	rule: AutoInvokeRule;
	confidence: number;
	matchedTriggers: AutoInvokeTrigger[];
	reason: string;
}

/**
 * Auto-Invoke Manager
 */
export class AutoInvokeManager {
	private config: AutoInvokeConfig;
	private stats: AutoInvokeStats;
	private configPath: string;

	constructor(configPath?: string) {
		this.configPath =
			configPath || path.join(process.env.HOME || "~", ".paimon", "auto-invoke.json");
		this.config = this.loadConfig();
		this.stats = this.loadStats();
	}

	/**
	 * Default auto-invoke rules
	 */
	private getDefaultRules(): AutoInvokeRule[] {
		return [
			{
				id: "frontend-work",
				name: "Frontend Work",
				description: "Auto-invoke frontend-design skill for frontend work",
				skill: "frontend-design",
				triggers: [
					{
						type: "file_pattern",
						pattern: "\\.(css|scss|sass|less)$",
						weight: 0.8,
						description: "CSS/SCSS files",
					},
					{
						type: "file_pattern",
						pattern: "\\.(tsx|jsx|vue|svelte)$",
						weight: 0.7,
						description: "Frontend framework files",
					},
					{
						type: "keyword",
						pattern: "(frontend|ui|ux|style|design|layout|css|animation)",
						weight: 0.6,
						description: "Frontend keywords",
					},
					{ type: "context", pattern: "frontend", weight: 0.9, description: "Frontend context" },
				],
				priority: 10,
				enabled: true,
				confidenceThreshold: 0.5,
				createdAt: new Date().toISOString(),
				invokeCount: 0,
			},
			{
				id: "debugging-work",
				name: "Debugging Work",
				description: "Auto-invoke systematic-debugging skill for debugging tasks",
				skill: "systematic-debugging",
				triggers: [
					{
						type: "keyword",
						pattern: "(debug|fix|bug|error|fail|crash|exception|issue)",
						weight: 0.7,
						description: "Debug keywords",
					},
					{ type: "context", pattern: "debugging", weight: 0.9, description: "Debugging context" },
					{
						type: "tool_usage",
						pattern: "assess|reflect",
						weight: 0.5,
						description: "Assessment tools used",
					},
				],
				priority: 9,
				enabled: true,
				confidenceThreshold: 0.4,
				createdAt: new Date().toISOString(),
				invokeCount: 0,
			},
			{
				id: "evolution-work",
				name: "Evolution Work",
				description: "Auto-invoke evolve skill for self-evolution tasks",
				skill: "evolve",
				triggers: [
					{ type: "context", pattern: "evolution", weight: 0.9, description: "Evolution context" },
					{
						type: "keyword",
						pattern: "(evolve|self-improve|self-evolution|improve myself)",
						weight: 0.8,
						description: "Evolution keywords",
					},
					{
						type: "file_pattern",
						pattern: "MEMORY\\.md|ROADMAP\\.md|JOURNAL\\.md",
						weight: 0.7,
						description: "Evolution files",
					},
				],
				priority: 10,
				enabled: true,
				confidenceThreshold: 0.5,
				createdAt: new Date().toISOString(),
				invokeCount: 0,
			},
			{
				id: "architecture-work",
				name: "Architecture Work",
				description: "Auto-invoke plan-architecture skill for architecture tasks",
				skill: "plan-architecture",
				triggers: [
					{
						type: "keyword",
						pattern: "(architecture|design|structure|module|refactor|organize)",
						weight: 0.7,
						description: "Architecture keywords",
					},
					{
						type: "context",
						pattern: "refactoring",
						weight: 0.8,
						description: "Refactoring context",
					},
					{
						type: "file_pattern",
						pattern: "src/",
						weight: 0.3,
						description: "Source files (generic)",
					},
				],
				priority: 8,
				enabled: true,
				confidenceThreshold: 0.5,
				createdAt: new Date().toISOString(),
				invokeCount: 0,
			},
			{
				id: "code-exploration",
				name: "Code Exploration",
				description: "Auto-invoke explore-code skill for codebase exploration",
				skill: "explore-code",
				triggers: [
					{
						type: "keyword",
						pattern: "(understand|explore|analyze|trace|follow|deep dive)",
						weight: 0.7,
						description: "Exploration keywords",
					},
					{
						type: "file_pattern",
						pattern: ".+",
						weight: 0.2,
						description: "Any file (low weight)",
					},
					{
						type: "tool_usage",
						pattern: "grep|glob|find|repomap",
						weight: 0.6,
						description: "Search tools used",
					},
				],
				priority: 7,
				enabled: true,
				confidenceThreshold: 0.4,
				createdAt: new Date().toISOString(),
				invokeCount: 0,
			},
			{
				id: "review-work",
				name: "Review Work",
				description: "Auto-invoke review-changes skill for code review",
				skill: "review-changes",
				triggers: [
					{
						type: "keyword",
						pattern: "(review|check|verify|validate|assess|inspect)",
						weight: 0.7,
						description: "Review keywords",
					},
					{ type: "tool_usage", pattern: "assess", weight: 0.8, description: "Assess tool used" },
					{
						type: "context",
						pattern: "evolution",
						weight: 0.5,
						description: "Evolution context (pre-commit)",
					},
				],
				priority: 9,
				enabled: true,
				confidenceThreshold: 0.5,
				createdAt: new Date().toISOString(),
				invokeCount: 0,
			},
			{
				id: "research-work",
				name: "Research Work",
				description: "Auto-invoke research skill for research tasks",
				skill: "research",
				triggers: [
					{
						type: "keyword",
						pattern: "(research|study|learn|find|search|web|documentation|docs)",
						weight: 0.7,
						description: "Research keywords",
					},
					{ type: "tool_usage", pattern: "http|curl", weight: 0.8, description: "HTTP tools used" },
					{
						type: "context",
						pattern: "evolution",
						weight: 0.4,
						description: "Evolution context (competitor research)",
					},
				],
				priority: 7,
				enabled: true,
				confidenceThreshold: 0.4,
				createdAt: new Date().toISOString(),
				invokeCount: 0,
			},
			{
				id: "testing-work",
				name: "Testing Work",
				description: "Auto-invoke test-driven-development skill for testing tasks",
				skill: "test-driven-development",
				triggers: [
					{
						type: "file_pattern",
						pattern: "\\.test\\.ts|\\.spec\\.ts|test/",
						weight: 0.8,
						description: "Test files",
					},
					{
						type: "keyword",
						pattern: "(test|spec|assert|expect|mock|fixture)",
						weight: 0.7,
						description: "Testing keywords",
					},
					{ type: "context", pattern: "testing", weight: 0.9, description: "Testing context" },
				],
				priority: 8,
				enabled: true,
				confidenceThreshold: 0.5,
				createdAt: new Date().toISOString(),
				invokeCount: 0,
			},
			{
				id: "writing-plans",
				name: "Writing Plans",
				description: "Auto-invoke writing-plans skill for planning tasks",
				skill: "writing-plans",
				triggers: [
					{ type: "tool_usage", pattern: "plan", weight: 0.9, description: "Plan tool used" },
					{
						type: "keyword",
						pattern: "(plan|step|phase|workflow|process|roadmap)",
						weight: 0.7,
						description: "Planning keywords",
					},
				],
				priority: 8,
				enabled: true,
				confidenceThreshold: 0.5,
				createdAt: new Date().toISOString(),
				invokeCount: 0,
			},
			{
				id: "parallel-work",
				name: "Parallel Work",
				description: "Auto-invoke dispatching-parallel-agents skill for parallel tasks",
				skill: "dispatching-parallel-agents",
				triggers: [
					{
						type: "tool_usage",
						pattern: "parallel",
						weight: 0.9,
						description: "Parallel tool used",
					},
					{
						type: "keyword",
						pattern: "(parallel|concurrent|simultaneous|batch|multiple)",
						weight: 0.7,
						description: "Parallel keywords",
					},
				],
				priority: 7,
				enabled: true,
				confidenceThreshold: 0.5,
				createdAt: new Date().toISOString(),
				invokeCount: 0,
			},
		];
	}

	/**
	 * Load config from disk
	 */
	private loadConfig(): AutoInvokeConfig {
		try {
			if (fs.existsSync(this.configPath)) {
				const data = fs.readFileSync(this.configPath, "utf-8");
				const config = JSON.parse(data) as AutoInvokeConfig;
				// Merge with default rules (keep user-added rules)
				const defaultRules = this.getDefaultRules();
				const userRules = config.rules.filter((r) => !defaultRules.some((d) => d.id === r.id));
				config.rules = [...defaultRules, ...userRules];
				return config;
			}
		} catch {
			// Ignore errors, use defaults
		}

		return {
			enabled: true,
			rules: this.getDefaultRules(),
			dataPath: this.configPath,
			maxSuggestions: 3,
			minConfidence: 0.3,
		};
	}

	/**
	 * Load stats from disk
	 */
	private loadStats(): AutoInvokeStats {
		const statsPath = path.join(path.dirname(this.configPath), "auto-invoke-stats.json");
		try {
			if (fs.existsSync(statsPath)) {
				const data = fs.readFileSync(statsPath, "utf-8");
				return JSON.parse(data) as AutoInvokeStats;
			}
		} catch {
			// Ignore errors
		}

		return {
			totalInvocations: 0,
			successfulInvocations: 0,
			rulesBySkill: {},
			rulesByTrigger: {},
			topRules: [],
			confidenceDistribution: {},
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
		const statsPath = path.join(path.dirname(this.configPath), "auto-invoke-stats.json");
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
	 * Analyze context for auto-invoke suggestions
	 */
	analyzeContext(
		files: string[],
		keywords: string[],
		toolsUsed: string[],
		taskType?: string,
		taskDescription?: string,
	): AutoInvokeSuggestion[] {
		if (!this.config.enabled) {
			return [];
		}

		const suggestions: AutoInvokeSuggestion[] = [];
		const enabledRules = this.config.rules
			.filter((r) => r.enabled)
			.sort((a, b) => b.priority - a.priority);

		for (const rule of enabledRules) {
			const matchedTriggers: AutoInvokeTrigger[] = [];
			let totalWeight = 0;

			for (const trigger of rule.triggers) {
				const match = this.matchTrigger(
					trigger,
					files,
					keywords,
					toolsUsed,
					taskType,
					taskDescription,
				);
				if (match) {
					matchedTriggers.push(trigger);
					totalWeight += trigger.weight;
				}
			}

			if (matchedTriggers.length > 0) {
				// Use max weight of matched triggers for confidence
				// This ensures a single strong match can trigger the rule
				const maxWeight = Math.max(...matchedTriggers.map((t) => t.weight));
				// Also factor in how many triggers matched (bonus for multiple matches)
				const matchBonus = (matchedTriggers.length / rule.triggers.length) * 0.2;
				const confidence = Math.min(maxWeight + matchBonus, 1.0);
				if (confidence >= Math.max(rule.confidenceThreshold, this.config.minConfidence)) {
					suggestions.push({
						rule,
						confidence,
						matchedTriggers,
						reason: this.generateReason(rule, matchedTriggers),
					});
				}
			}
		}

		// Return top suggestions
		return suggestions
			.sort((a, b) => b.confidence - a.confidence)
			.slice(0, this.config.maxSuggestions);
	}

	/**
	 * Match a trigger against context
	 */
	private matchTrigger(
		trigger: AutoInvokeTrigger,
		files: string[],
		keywords: string[],
		toolsUsed: string[],
		taskType?: string,
		taskDescription?: string,
	): boolean {
		try {
			const regex = new RegExp(trigger.pattern, "i");

			switch (trigger.type) {
				case "file_pattern":
					return files.some((f) => regex.test(f));

				case "keyword":
					return (
						keywords.some((k) => regex.test(k)) ||
						(taskDescription !== undefined && regex.test(taskDescription))
					);

				case "context":
					return taskType !== undefined && regex.test(taskType);

				case "tool_usage":
					return toolsUsed.some((t) => regex.test(t));

				case "task_type":
					return taskType !== undefined && regex.test(taskType);

				default:
					return false;
			}
		} catch {
			return false;
		}
	}

	/**
	 * Generate reason for suggestion
	 */
	private generateReason(rule: AutoInvokeRule, matchedTriggers: AutoInvokeTrigger[]): string {
		const triggerDescs = matchedTriggers
			.map((t) => t.description || `${t.type}: ${t.pattern}`)
			.join(", ");
		return `Detected: ${triggerDescs}`;
	}

	/**
	 * Record invocation
	 */
	recordInvocation(ruleId: string, successful: boolean): void {
		this.stats.totalInvocations++;
		if (successful) {
			this.stats.successfulInvocations++;
		}

		// Update rule stats
		const rule = this.config.rules.find((r) => r.id === ruleId);
		if (rule) {
			rule.invokeCount++;
			rule.lastInvoked = new Date().toISOString();

			// Update skill stats
			this.stats.rulesBySkill[rule.skill] = (this.stats.rulesBySkill[rule.skill] || 0) + 1;

			// Update trigger stats
			for (const trigger of rule.triggers) {
				this.stats.rulesByTrigger[trigger.type] =
					(this.stats.rulesByTrigger[trigger.type] || 0) + 1;
			}

			// Update top rules
			const existing = this.stats.topRules.find((r) => r.rule === ruleId);
			if (existing) {
				existing.count++;
			} else {
				this.stats.topRules.push({ rule: ruleId, count: 1 });
			}
			this.stats.topRules.sort((a, b) => b.count - a.count);
			this.stats.topRules = this.stats.topRules.slice(0, 10);
		}

		this.saveStats();
		this.saveConfig();
	}

	/**
	 * Add custom rule
	 */
	addRule(rule: Omit<AutoInvokeRule, "createdAt" | "invokeCount">): AutoInvokeRule {
		const fullRule: AutoInvokeRule = {
			...rule,
			createdAt: new Date().toISOString(),
			invokeCount: 0,
		};

		// Check for duplicate
		const existing = this.config.rules.find((r) => r.id === rule.id);
		if (existing) {
			// Update existing rule
			Object.assign(existing, fullRule);
		} else {
			this.config.rules.push(fullRule);
		}

		this.saveConfig();
		return fullRule;
	}

	/**
	 * Remove rule
	 */
	removeRule(ruleId: string): boolean {
		const index = this.config.rules.findIndex((r) => r.id === ruleId);
		if (index >= 0) {
			// Don't remove default rules, just disable them
			const defaultRules = this.getDefaultRules();
			if (defaultRules.some((d) => d.id === ruleId)) {
				this.config.rules[index].enabled = false;
			} else {
				this.config.rules.splice(index, 1);
			}
			this.saveConfig();
			return true;
		}
		return false;
	}

	/**
	 * Enable/disable rule
	 */
	setRuleEnabled(ruleId: string, enabled: boolean): boolean {
		const rule = this.config.rules.find((r) => r.id === ruleId);
		if (rule) {
			rule.enabled = enabled;
			this.saveConfig();
			return true;
		}
		return false;
	}

	/**
	 * Get rule by ID
	 */
	getRule(ruleId: string): AutoInvokeRule | undefined {
		return this.config.rules.find((r) => r.id === ruleId);
	}

	/**
	 * List rules
	 */
	listRules(enabledOnly?: boolean): AutoInvokeRule[] {
		if (enabledOnly) {
			return this.config.rules.filter((r) => r.enabled);
		}
		return this.config.rules;
	}

	/**
	 * Get stats
	 */
	getStats(): AutoInvokeStats {
		return this.stats;
	}

	/**
	 * Get config
	 */
	getConfig(): AutoInvokeConfig {
		return this.config;
	}

	/**
	 * Set config
	 */
	setConfig(updates: Partial<AutoInvokeConfig>): void {
		Object.assign(this.config, updates);
		this.saveConfig();
	}

	/**
	 * Reset to defaults
	 */
	reset(): void {
		this.config = {
			enabled: true,
			rules: this.getDefaultRules(),
			dataPath: this.configPath,
			maxSuggestions: 3,
			minConfidence: 0.3,
		};
		this.stats = {
			totalInvocations: 0,
			successfulInvocations: 0,
			rulesBySkill: {},
			rulesByTrigger: {},
			topRules: [],
			confidenceDistribution: {},
		};
		this.saveConfig();
		this.saveStats();
	}

	/**
	 * Clear stats
	 */
	clearStats(): void {
		this.stats = {
			totalInvocations: 0,
			successfulInvocations: 0,
			rulesBySkill: {},
			rulesByTrigger: {},
			topRules: [],
			confidenceDistribution: {},
		};
		this.saveStats();
	}
}

// Singleton instance
let autoInvokeInstance: AutoInvokeManager | null = null;

/**
 * Get AutoInvokeManager instance
 */
export function getAutoInvokeManager(): AutoInvokeManager {
	if (!autoInvokeInstance) {
		autoInvokeInstance = new AutoInvokeManager();
	}
	return autoInvokeInstance;
}
