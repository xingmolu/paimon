/**
 * Adaptive Reasoning Strategy Selection Module
 *
 * Automatically selects and adapts reasoning strategies based on:
 * - Task type (capability, reliability, feature)
 * - Context (code exploration, debugging, architecture, implementation)
 * - Historical success rates for different strategies
 * - Current progress and intermediate results
 *
 * Inspired by adaptive strategy patterns from Claude Code and OpenHands
 */

import * as fs from "node:fs";
import * as path from "node:path";

// Types
export type ReasoningStrategy =
	| "analytical"
	| "creative"
	| "systematic"
	| "exploratory"
	| "diagnostic"
	| "architectural"
	| "iterative";

export type TaskContext =
	| "code-exploration"
	| "debugging"
	| "architecture"
	| "implementation"
	| "verification"
	| "research"
	| "planning"
	| "review";

export interface StrategyProfile {
	strategy: ReasoningStrategy;
	description: string;
	strengths: string[];
	weaknesses: string[];
	optimalContexts: TaskContext[];
	optimalTaskTypes: ("capability" | "reliability" | "feature")[];
	estimatedTimeMultiplier: number;
	successRateBonus: number;
}

export interface StrategySelection {
	selectedStrategy: ReasoningStrategy;
	confidence: number;
	reasoning: string;
	alternativeStrategies: Array<{
		strategy: ReasoningStrategy;
		confidence: number;
		reason: string;
	}>;
	adaptationTriggers: string[];
}

export interface StrategyOutcome {
	strategy: ReasoningStrategy;
	taskType: "capability" | "reliability" | "feature";
	context: TaskContext;
	success: boolean;
	timeMinutes: number;
	errorsEncountered: string[];
	skillsUsed: string[];
}

export interface AdaptiveReasoningStats {
	totalSelections: number;
	byStrategy: Record<ReasoningStrategy, { count: number; successRate: number }>;
	byTaskType: Record<string, { count: number; avgSuccessRate: number }>;
	byContext: Record<TaskContext, { count: number; avgSuccessRate: number }>;
	adaptiveChanges: number;
	improvementOverBaseline: number;
	lastSelectionTime: string;
	topPerformingStrategies: Array<{ strategy: ReasoningStrategy; successRate: number }>;
}

export interface AdaptiveReasoningConfig {
	enabled: boolean;
	learningRate: number;
	minSamplesForAdaptation: number;
	explorationRate: number;
	preferLearnedPatterns: boolean;
	adaptOnFailure: boolean;
	trackIntermediateResults: boolean;
}

// Default strategy profiles
const STRATEGY_PROFILES: StrategyProfile[] = [
	{
		strategy: "analytical",
		description: "Systematic breakdown and analysis of the problem with logical deduction",
		strengths: ["debugging", "code-analysis", "error-investigation"],
		weaknesses: ["creative-solutions", "exploratory-tasks"],
		optimalContexts: ["debugging", "verification", "review"],
		optimalTaskTypes: ["reliability"],
		estimatedTimeMultiplier: 1.2,
		successRateBonus: 15,
	},
	{
		strategy: "creative",
		description: "Exploratory approach with novel solutions and innovative thinking",
		strengths: ["new-features", "architecture-design", "problem-solving"],
		weaknesses: ["routine-tasks", "well-defined-problems"],
		optimalContexts: ["architecture", "implementation"],
		optimalTaskTypes: ["capability", "feature"],
		estimatedTimeMultiplier: 1.5,
		successRateBonus: 20,
	},
	{
		strategy: "systematic",
		description: "Step-by-step methodical approach following established patterns",
		strengths: ["implementation", "verification", "maintenance"],
		weaknesses: ["novel-problems", "exploratory-tasks"],
		optimalContexts: ["implementation", "verification", "planning"],
		optimalTaskTypes: ["capability", "reliability"],
		estimatedTimeMultiplier: 0.9,
		successRateBonus: 10,
	},
	{
		strategy: "exploratory",
		description: "Broad exploration of possibilities before converging on solution",
		strengths: ["research", "code-exploration", "learning"],
		weaknesses: ["time-critical-tasks", "well-understood-problems"],
		optimalContexts: ["code-exploration", "research", "architecture"],
		optimalTaskTypes: ["capability"],
		estimatedTimeMultiplier: 1.4,
		successRateBonus: 18,
	},
	{
		strategy: "diagnostic",
		description: "Focused investigation to identify root causes and issues",
		strengths: ["debugging", "error-analysis", "reliability"],
		weaknesses: ["creative-tasks", "new-feature-development"],
		optimalContexts: ["debugging", "verification"],
		optimalTaskTypes: ["reliability"],
		estimatedTimeMultiplier: 1.0,
		successRateBonus: 25,
	},
	{
		strategy: "architectural",
		description: "High-level design thinking with focus on structure and patterns",
		strengths: ["design", "refactoring", "planning"],
		weaknesses: ["detailed-implementation", "bug-fixing"],
		optimalContexts: ["architecture", "planning"],
		optimalTaskTypes: ["capability", "feature"],
		estimatedTimeMultiplier: 1.3,
		successRateBonus: 22,
	},
	{
		strategy: "iterative",
		description: "Rapid cycles of implementation and feedback with continuous refinement",
		strengths: ["implementation", "prototyping", "agile-development"],
		weaknesses: ["complex-planning", "thorough-analysis"],
		optimalContexts: ["implementation", "verification"],
		optimalTaskTypes: ["capability", "feature", "reliability"],
		estimatedTimeMultiplier: 0.8,
		successRateBonus: 12,
	},
];

const DEFAULT_CONFIG: AdaptiveReasoningConfig = {
	enabled: true,
	learningRate: 0.3,
	minSamplesForAdaptation: 5,
	explorationRate: 0.1,
	preferLearnedPatterns: true,
	adaptOnFailure: true,
	trackIntermediateResults: true,
};

let managerInstance: AdaptiveReasoningManager | null = null;

export class AdaptiveReasoningManager {
	private config: AdaptiveReasoningConfig;
	private stats: AdaptiveReasoningStats;
	private outcomes: StrategyOutcome[] = [];
	private dataPath: string;
	private strategyProfiles: Map<ReasoningStrategy, StrategyProfile>;
	private learnedPreferences: Map<string, Map<ReasoningStrategy, number>>;

	constructor(configPath?: string) {
		this.config = DEFAULT_CONFIG;
		this.strategyProfiles = new Map(STRATEGY_PROFILES.map((p) => [p.strategy, p]));
		this.learnedPreferences = new Map();
		const homeDir = process.env.HOME || ".";
		this.dataPath = path.join(homeDir, ".paimon", "adaptive-reasoning.json");
		this.stats = this.initStats();
		this.loadState();
	}

	private initStats(): AdaptiveReasoningStats {
		const byStrategy = {} as Record<ReasoningStrategy, { count: number; successRate: number }>;
		for (const strategy of this.getStrategies()) {
			byStrategy[strategy] = { count: 0, successRate: 0 };
		}

		return {
			totalSelections: 0,
			byStrategy,
			byTaskType: {
				capability: { count: 0, avgSuccessRate: 0 },
				reliability: { count: 0, avgSuccessRate: 0 },
				feature: { count: 0, avgSuccessRate: 0 },
			},
			byContext: {} as Record<TaskContext, { count: number; avgSuccessRate: number }>,
			adaptiveChanges: 0,
			improvementOverBaseline: 0,
			lastSelectionTime: "",
			topPerformingStrategies: [],
		};
	}

	private loadState(): void {
		try {
			// Validate path to prevent traversal
			const resolvedPath = path.resolve(this.dataPath);
			const homeDir = process.env.HOME || ".";
			const allowedDir = path.resolve(homeDir);
			if (!resolvedPath.startsWith(allowedDir)) {
				return;
			}

			if (fs.existsSync(resolvedPath)) {
				const data = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
				this.outcomes = data.outcomes || [];
				this.stats = { ...this.stats, ...data.stats };
				if (data.learnedPreferences) {
					for (const [key, value] of Object.entries(data.learnedPreferences)) {
						const map = new Map<ReasoningStrategy, number>();
						for (const [k, v] of Object.entries(value as Record<string, number>)) {
							map.set(k as ReasoningStrategy, v);
						}
						this.learnedPreferences.set(key, map);
					}
				}
			}
		} catch {
			// Start fresh
		}
	}

	private saveState(): void {
		try {
			const dir = path.dirname(this.dataPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			const learnedPreferencesObj: Record<string, Record<string, number>> = {};
			for (const [key, value] of this.learnedPreferences) {
				learnedPreferencesObj[key] = Object.fromEntries(value);
			}
			fs.writeFileSync(
				this.dataPath,
				JSON.stringify(
					{
						outcomes: this.outcomes.slice(-1000),
						stats: this.stats,
						learnedPreferences: learnedPreferencesObj,
						config: this.config,
					},
					null,
					2,
				),
			);
		} catch (error) {
			console.error("Failed to save adaptive reasoning state:", error);
		}
	}

	public getStrategies(): ReasoningStrategy[] {
		return [
			"analytical",
			"creative",
			"systematic",
			"exploratory",
			"diagnostic",
			"architectural",
			"iterative",
		];
	}

	public getStrategyProfile(strategy: ReasoningStrategy): StrategyProfile | undefined {
		return this.strategyProfiles.get(strategy);
	}

	public getAllStrategyProfiles(): StrategyProfile[] {
		return STRATEGY_PROFILES;
	}

	public detectContext(taskDescription: string, files?: string[]): TaskContext {
		const desc = taskDescription.toLowerCase();

		if (
			desc.includes("bug") ||
			desc.includes("fix") ||
			desc.includes("error") ||
			desc.includes("fail") ||
			desc.includes("issue") ||
			desc.includes("debug")
		) {
			return "debugging";
		}

		if (
			desc.includes("architecture") ||
			desc.includes("design") ||
			desc.includes("structure") ||
			desc.includes("refactor") ||
			desc.includes("plan")
		) {
			return "architecture";
		}

		if (
			desc.includes("research") ||
			desc.includes("study") ||
			desc.includes("investigate") ||
			desc.includes("analyze") ||
			desc.includes("explore")
		) {
			return "research";
		}

		if (
			desc.includes("review") ||
			desc.includes("check") ||
			desc.includes("verify") ||
			desc.includes("validate") ||
			desc.includes("assess")
		) {
			return "review";
		}

		if (desc.includes("plan") || desc.includes("roadmap") || desc.includes("strategy")) {
			return "planning";
		}

		if (
			desc.includes("understand") ||
			desc.includes("explore") ||
			desc.includes("trace") ||
			desc.includes("map") ||
			desc.includes("find")
		) {
			return "code-exploration";
		}

		if (desc.includes("test") || desc.includes("verify") || desc.includes("ensure")) {
			return "verification";
		}

		return "implementation";
	}

	public selectStrategy(
		taskType: "capability" | "reliability" | "feature",
		context: TaskContext,
		taskDescription?: string,
	): StrategySelection {
		const candidates: Array<{ strategy: ReasoningStrategy; score: number; reasoning: string }> = [];

		const preferenceKey = `${context}-${taskType}`;
		const learned = this.learnedPreferences.get(preferenceKey);

		for (const profile of STRATEGY_PROFILES) {
			let score = 50;
			const reasons: string[] = [];

			if (profile.optimalTaskTypes.includes(taskType)) {
				score += 20;
				reasons.push(`Optimal for ${taskType} tasks`);
			}

			if (profile.optimalContexts.includes(context)) {
				score += 25;
				reasons.push(`Well-suited for ${context} context`);
			}

			if (learned && this.config.preferLearnedPatterns) {
				const learnedScore = learned.get(profile.strategy) || 0;
				score += learnedScore * this.config.learningRate * 10;
				if (learnedScore > 0) {
					reasons.push(`Learned preference: +${learnedScore.toFixed(1)}`);
				}
			}

			const historical = this.stats.byStrategy[profile.strategy];
			if (historical.count > 0) {
				const successBonus = historical.successRate * 10;
				score += successBonus;
				reasons.push(`Historical success: ${(historical.successRate * 100).toFixed(0)}%`);
			}

			if (profile.estimatedTimeMultiplier > 1.2) {
				score -= 5;
				reasons.push("Slower strategy");
			} else if (profile.estimatedTimeMultiplier < 0.9) {
				score += 5;
				reasons.push("Faster strategy");
			}

			candidates.push({ strategy: profile.strategy, score, reasoning: reasons.join(". ") });
		}

		candidates.sort((a, b) => b.score - a.score);

		const shouldExplore = Math.random() < this.config.explorationRate;
		const selectedCandidate =
			shouldExplore && candidates.length > 1
				? candidates[1 + Math.floor(Math.random() * (candidates.length - 1))]
				: candidates[0];

		this.stats.totalSelections++;
		this.stats.lastSelectionTime = new Date().toISOString();
		this.stats.byStrategy[selectedCandidate.strategy].count++;

		if (!this.stats.byContext[context]) {
			this.stats.byContext[context] = { count: 0, avgSuccessRate: 0 };
		}
		this.stats.byContext[context].count++;
		this.stats.byTaskType[taskType].count++;

		this.saveState();

		return {
			selectedStrategy: selectedCandidate.strategy,
			confidence: Math.min(100, selectedCandidate.score) / 100,
			reasoning: selectedCandidate.reasoning,
			alternativeStrategies: candidates.slice(1, 4).map((c) => ({
				strategy: c.strategy,
				confidence: Math.min(100, c.score) / 100,
				reason: c.reasoning,
			})),
			adaptationTriggers: this.getAdaptationTriggers(selectedCandidate.strategy, context, taskType),
		};
	}

	private getAdaptationTriggers(
		strategy: ReasoningStrategy,
		context: TaskContext,
		taskType: "capability" | "reliability" | "feature",
	): string[] {
		const triggers: string[] = [];
		const profile = this.strategyProfiles.get(strategy);

		if (!profile) return triggers;

		if (profile.weaknesses.length > 0) {
			triggers.push(
				`If encountering ${profile.weaknesses.join(", ")}, consider alternative strategy`,
			);
		}

		if (!profile.optimalContexts.includes(context)) {
			triggers.push(`Current context (${context}) is not optimal for this strategy`);
		}

		const historical = this.stats.byStrategy[strategy];
		if (historical.count > 10 && historical.successRate < 0.5) {
			triggers.push("Historical success rate below 50% - consider alternatives");
		}

		return triggers;
	}

	public recordOutcome(outcome: StrategyOutcome): void {
		this.outcomes.push(outcome);

		const strategyStats = this.stats.byStrategy[outcome.strategy];
		const prevSuccesses = strategyStats.successRate * strategyStats.count;
		strategyStats.count++;
		strategyStats.successRate = (prevSuccesses + (outcome.success ? 1 : 0)) / strategyStats.count;

		if (!this.stats.byContext[outcome.context]) {
			this.stats.byContext[outcome.context] = { count: 0, avgSuccessRate: 0 };
		}
		const contextStats = this.stats.byContext[outcome.context];
		const prevContextSuccesses = contextStats.avgSuccessRate * contextStats.count;
		contextStats.count++;
		contextStats.avgSuccessRate =
			(prevContextSuccesses + (outcome.success ? 1 : 0)) / contextStats.count;

		const taskStats = this.stats.byTaskType[outcome.taskType];
		const prevTaskSuccesses = taskStats.avgSuccessRate * taskStats.count;
		taskStats.count++;
		taskStats.avgSuccessRate = (prevTaskSuccesses + (outcome.success ? 1 : 0)) / taskStats.count;

		const preferenceKey = `${outcome.context}-${outcome.taskType}`;
		if (!this.learnedPreferences.has(preferenceKey)) {
			this.learnedPreferences.set(preferenceKey, new Map());
		}
		const preferences = this.learnedPreferences.get(preferenceKey);
		if (preferences) {
			const currentScore = preferences.get(outcome.strategy) || 0;
			const adjustment = outcome.success ? 1 : -0.5;
			preferences.set(outcome.strategy, currentScore + adjustment * this.config.learningRate);
		}

		this.updateTopPerformingStrategies();
		this.saveState();
	}

	private updateTopPerformingStrategies(): void {
		const strategies = this.getStrategies()
			.map((s) => ({
				strategy: s,
				successRate: this.stats.byStrategy[s].successRate,
			}))
			.filter((s) => this.stats.byStrategy[s.strategy].count > 0)
			.sort((a, b) => b.successRate - a.successRate)
			.slice(0, 5);

		this.stats.topPerformingStrategies = strategies;
	}

	public adaptStrategy(
		currentStrategy: ReasoningStrategy,
		reason: string,
		context: TaskContext,
		taskType: "capability" | "reliability" | "feature",
	): StrategySelection {
		this.stats.adaptiveChanges++;

		const alternatives = STRATEGY_PROFILES.filter(
			(p) =>
				p.strategy !== currentStrategy &&
				(p.optimalContexts.includes(context) || p.optimalTaskTypes.includes(taskType)),
		);

		if (alternatives.length === 0) {
			return this.selectStrategy(taskType, context);
		}

		const candidates = alternatives.map((p) => {
			let score = 50;
			if (p.optimalContexts.includes(context)) score += 30;
			if (p.optimalTaskTypes.includes(taskType)) score += 20;

			const historical = this.stats.byStrategy[p.strategy];
			if (historical.count > 0) {
				score += historical.successRate * 20;
			}

			return { strategy: p.strategy, score };
		});

		candidates.sort((a, b) => b.score - a.score);

		const newStrategy = candidates[0].strategy;
		const newProfile = this.strategyProfiles.get(newStrategy);

		this.saveState();

		return {
			selectedStrategy: newStrategy,
			confidence: candidates[0].score / 100,
			reasoning: newProfile
				? `Adapted from ${currentStrategy} due to: ${reason}. ${newProfile.description}`
				: `Adapted from ${currentStrategy} due to: ${reason}`,
			alternativeStrategies: candidates.slice(1, 4).map((c) => ({
				strategy: c.strategy,
				confidence: c.score / 100,
				reason: "Alternative adapted strategy",
			})),
			adaptationTriggers: this.getAdaptationTriggers(newStrategy, context, taskType),
		};
	}

	public getRecommendations(
		taskType: "capability" | "reliability" | "feature",
		context?: TaskContext,
	): string[] {
		const recommendations: string[] = [];

		const topStrategies = this.stats.topPerformingStrategies;
		if (topStrategies.length > 0) {
			recommendations.push(
				`Top performing strategies: ${topStrategies.map((s) => s.strategy).join(", ")}`,
			);
		}

		if (context) {
			const preferenceKey = `${context}-${taskType}`;
			const learned = this.learnedPreferences.get(preferenceKey);
			if (learned && learned.size > 0) {
				const sorted = [...learned.entries()].sort((a, b) => b[1] - a[1]);
				recommendations.push(`For ${context} context, prefer: ${sorted[0][0]}`);
			}
		}

		const taskStats = this.stats.byTaskType[taskType];
		if (taskStats.count > 0) {
			recommendations.push(
				`${taskType} tasks have ${(taskStats.avgSuccessRate * 100).toFixed(0)}% success rate`,
			);
		}

		return recommendations;
	}

	public getStats(): AdaptiveReasoningStats {
		return { ...this.stats };
	}

	public getConfig(): AdaptiveReasoningConfig {
		return { ...this.config };
	}

	public updateConfig(updates: Partial<AdaptiveReasoningConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveState();
	}

	public isEnabled(): boolean {
		return this.config.enabled;
	}

	public setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveState();
	}

	public resetStats(): void {
		this.stats = this.initStats();
		this.outcomes = [];
		this.learnedPreferences = new Map();
		this.saveState();
	}

	public formatStrategyProfile(strategy: ReasoningStrategy): string {
		const profile = this.strategyProfiles.get(strategy);
		if (!profile) return `Strategy ${strategy} not found.`;

		const lines = [
			`## ${strategy.charAt(0).toUpperCase() + strategy.slice(1)} Strategy`,
			"",
			`**Description:** ${profile.description}`,
			"",
			`**Strengths:** ${profile.strengths.join(", ")}`,
			"",
			`**Weaknesses:** ${profile.weaknesses.join(", ")}`,
			"",
			`**Optimal Contexts:** ${profile.optimalContexts.join(", ")}`,
			"",
			`**Optimal Task Types:** ${profile.optimalTaskTypes.join(", ")}`,
			"",
			`**Time Multiplier:** ${profile.estimatedTimeMultiplier}x`,
			"",
			`**Success Rate Bonus:** +${profile.successRateBonus}%`,
		];

		return lines.join("\n");
	}

	public formatStats(): string {
		const lines = [
			"## Adaptive Reasoning Statistics",
			"",
			`**Total Selections:** ${this.stats.totalSelections}`,
			`**Adaptive Changes:** ${this.stats.adaptiveChanges}`,
			`**Improvement Over Baseline:** ${(this.stats.improvementOverBaseline * 100).toFixed(1)}%`,
			"",
			"### Strategy Performance",
			"",
		];

		for (const strategy of this.getStrategies()) {
			const stats = this.stats.byStrategy[strategy];
			if (stats.count > 0) {
				lines.push(
					`- **${strategy}:** ${(stats.successRate * 100).toFixed(0)}% success (${stats.count} uses)`,
				);
			}
		}

		if (this.stats.topPerformingStrategies.length > 0) {
			lines.push("", "### Top Performing Strategies", "");
			for (const s of this.stats.topPerformingStrategies) {
				lines.push(`- ${s.strategy}: ${(s.successRate * 100).toFixed(0)}% success`);
			}
		}

		return lines.join("\n");
	}
}

export function getAdaptiveReasoningManager(): AdaptiveReasoningManager {
	if (!managerInstance) {
		managerInstance = new AdaptiveReasoningManager();
	}
	return managerInstance;
}

export function initAdaptiveReasoningManager(
	config?: Partial<AdaptiveReasoningConfig>,
): AdaptiveReasoningManager {
	managerInstance = new AdaptiveReasoningManager();
	if (config) {
		managerInstance.updateConfig(config);
	}
	return managerInstance;
}
