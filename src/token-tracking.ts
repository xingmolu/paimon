/**
 * Token/Cost Tracking module - Track LLM token usage and costs (Aider pattern)
 *
 * Inspired by Aider's calculate_and_show_tokens_and_cost pattern for tracking
 * API usage, costs, and efficiency metrics.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Token usage record for a single API call
 */
export interface TokenUsage {
	timestamp: string;
	model: string;
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	cacheHitTokens: number;
	cacheWriteTokens: number;
	cost: number;
	sessionId?: string;
	taskType?: string;
	taskDescription?: string;
	success?: boolean;
}

/**
 * Cost configuration for a model
 */
export interface ModelCostConfig {
	inputCostPerToken: number;
	outputCostPerToken: number;
	inputCostPerTokenCacheHit?: number; // For DeepSeek-like models
	cacheWriteMultiplier?: number; // Anthropic-style (1.25x)
	cacheHitMultiplier?: number; // Anthropic-style (0.10x)
}

/**
 * Token tracking session
 */
export interface TokenSession {
	sessionId: string;
	startTime: string;
	endTime?: string;
	totalPromptTokens: number;
	totalCompletionTokens: number;
	totalCost: number;
	totalCacheHits: number;
	totalCacheWrites: number;
	apiCalls: number;
	taskType?: string;
	success?: boolean;
}

/**
 * Token tracking statistics
 */
export interface TokenStats {
	totalSessions: number;
	totalApiCalls: number;
	totalPromptTokens: number;
	totalCompletionTokens: number;
	totalCost: number;
	totalCacheHits: number;
	totalCacheWrites: number;
	averageCostPerSession: number;
	averageTokensPerSession: number;
	averageCostPerCall: number;
	costByModel: Record<string, number>;
	tokensByModel: Record<string, { prompt: number; completion: number }>;
	costByTaskType: Record<string, number>;
	recentUsage: TokenUsage[];
	dailyCost: Record<string, number>;
	weeklyCost: Record<string, number>;
}

/**
 * Token tracking configuration
 */
export interface TokenTrackingConfig {
	dataDir?: string;
	trackSessionUsage?: boolean;
	showCostReport?: boolean;
	defaultModel?: string;
	modelCosts?: Record<string, ModelCostConfig>;
}

// Default model costs (approximate, based on typical LLM pricing)
const DEFAULT_MODEL_COSTS: Record<string, ModelCostConfig> = {
	"gpt-4": {
		inputCostPerToken: 0.00003,
		outputCostPerToken: 0.00006,
	},
	"gpt-4-turbo": {
		inputCostPerToken: 0.00001,
		outputCostPerToken: 0.00003,
	},
	"gpt-3.5-turbo": {
		inputCostPerToken: 0.0000005,
		outputCostPerToken: 0.0000015,
	},
	"claude-3-opus": {
		inputCostPerToken: 0.000015,
		outputCostPerToken: 0.000075,
		cacheWriteMultiplier: 1.25,
		cacheHitMultiplier: 0.1,
	},
	"claude-3-sonnet": {
		inputCostPerToken: 0.000003,
		outputCostPerToken: 0.000015,
		cacheWriteMultiplier: 1.25,
		cacheHitMultiplier: 0.1,
	},
	"claude-3-haiku": {
		inputCostPerToken: 0.00000025,
		outputCostPerToken: 0.00000125,
		cacheWriteMultiplier: 1.25,
		cacheHitMultiplier: 0.1,
	},
	// Default fallback
	default: {
		inputCostPerToken: 0.000001,
		outputCostPerToken: 0.000002,
	},
};

/**
 * Token Tracker - Track LLM API usage and costs
 */
export class TokenTracker {
	config: TokenTrackingConfig;
	private usageLog: TokenUsage[] = [];
	sessions: Map<string, TokenSession> = new Map();
	private currentSession?: TokenSession;
	private dataDir: string;

	constructor(config: TokenTrackingConfig = {}) {
		this.config = {
			dataDir: config.dataDir || "data",
			trackSessionUsage: config.trackSessionUsage ?? true,
			showCostReport: config.showCostReport ?? true,
			defaultModel: config.defaultModel || "default",
			modelCosts: config.modelCosts || DEFAULT_MODEL_COSTS,
		};
		this.dataDir = this.config.dataDir || "data";

		// Ensure directory exists
		if (!existsSync(this.dataDir)) {
			mkdirSync(this.dataDir, { recursive: true });
		}

		// Load existing data
		this.loadData();
	}

	/**
	 * Start a new tracking session
	 */
	startSession(sessionId: string, taskType?: string): TokenSession {
		const session: TokenSession = {
			sessionId,
			startTime: new Date().toISOString(),
			totalPromptTokens: 0,
			totalCompletionTokens: 0,
			totalCost: 0,
			totalCacheHits: 0,
			totalCacheWrites: 0,
			apiCalls: 0,
			taskType,
		};

		this.sessions.set(sessionId, session);
		this.currentSession = session;

		return session;
	}

	/**
	 * End current session
	 */
	endSession(success?: boolean): TokenSession | undefined {
		if (!this.currentSession) return undefined;

		this.currentSession.endTime = new Date().toISOString();
		this.currentSession.success = success;

		const session = this.currentSession;
		this.currentSession = undefined;
		this.saveData();

		return session;
	}

	/**
	 * Record token usage from an API call
	 */
	recordUsage(usage: Omit<TokenUsage, "timestamp">): TokenUsage {
		const record: TokenUsage = {
			...usage,
			timestamp: new Date().toISOString(),
		};

		this.usageLog.push(record);

		// Update session if active
		if (this.currentSession) {
			this.currentSession.totalPromptTokens += usage.promptTokens;
			this.currentSession.totalCompletionTokens += usage.completionTokens;
			this.currentSession.totalCost += usage.cost;
			this.currentSession.totalCacheHits += usage.cacheHitTokens;
			this.currentSession.totalCacheWrites += usage.cacheWriteTokens;
			this.currentSession.apiCalls++;
		}

		return record;
	}

	/**
	 * Calculate cost from token usage
	 */
	calculateCost(
		model: string,
		promptTokens: number,
		completionTokens: number,
		cacheHitTokens = 0,
		cacheWriteTokens = 0,
	): number {
		const modelConfig =
			this.config.modelCosts?.[model] ||
			this.config.modelCosts?.default ||
			DEFAULT_MODEL_COSTS.default;

		let cost = 0;

		// DeepSeek-style: cache_hit + cache_miss = prompt
		if (modelConfig.inputCostPerTokenCacheHit) {
			cost += modelConfig.inputCostPerTokenCacheHit * cacheHitTokens;
			cost += (promptTokens - cacheHitTokens) * modelConfig.inputCostPerToken;
		} else {
			// Anthropic-style: cache_write (1.25x) + cache_hit (0.10x) + regular
			const cacheWriteMultiplier = modelConfig.cacheWriteMultiplier || 1;
			const cacheHitMultiplier = modelConfig.cacheHitMultiplier || 1;

			cost += cacheWriteTokens * modelConfig.inputCostPerToken * cacheWriteMultiplier;
			cost += cacheHitTokens * modelConfig.inputCostPerToken * cacheHitMultiplier;
			cost += promptTokens * modelConfig.inputCostPerToken;
		}

		cost += completionTokens * modelConfig.outputCostPerToken;

		return cost;
	}

	/**
	 * Format cost value for display
	 */
	formatCost(value: number): string {
		if (value === 0) return "$0.00";
		const magnitude = Math.abs(value);
		if (magnitude >= 0.01) {
			return `$${value.toFixed(2)}`;
		}
		const decimals = Math.max(2, 2 - Math.floor(Math.log10(magnitude)));
		return `$${value.toFixed(decimals)}`;
	}

	/**
	 * Format token count for display
	 */
	formatTokens(tokens: number): string {
		if (tokens >= 1000000) {
			return `${(tokens / 1000000).toFixed(1)}M`;
		}
		if (tokens >= 1000) {
			return `${(tokens / 1000).toFixed(1)}K`;
		}
		return `${tokens}`;
	}

	/**
	 * Generate usage report for display
	 */
	generateUsageReport(usage: TokenUsage): string {
		const report: string[] = [];

		report.push("📊 Token Usage Report");
		report.push("─".repeat(40));
		report.push(`Model: ${usage.model}`);
		report.push(`Prompt tokens: ${this.formatTokens(usage.promptTokens)}`);
		report.push(`Completion tokens: ${this.formatTokens(usage.completionTokens)}`);

		if (usage.cacheWriteTokens > 0) {
			report.push(`Cache write: ${this.formatTokens(usage.cacheWriteTokens)} tokens`);
		}
		if (usage.cacheHitTokens > 0) {
			report.push(`Cache hit: ${this.formatTokens(usage.cacheHitTokens)} tokens`);
		}

		report.push(`Total tokens: ${this.formatTokens(usage.totalTokens)}`);
		report.push(`Cost: ${this.formatCost(usage.cost)}`);

		return report.join("\n");
	}

	/**
	 * Get statistics from the tracked usage
	 */
	getStats(): TokenStats {
		const stats: TokenStats = {
			totalSessions: this.sessions.size,
			totalApiCalls: this.usageLog.length,
			totalPromptTokens: 0,
			totalCompletionTokens: 0,
			totalCost: 0,
			totalCacheHits: 0,
			totalCacheWrites: 0,
			averageCostPerSession: 0,
			averageTokensPerSession: 0,
			averageCostPerCall: 0,
			costByModel: {},
			tokensByModel: {},
			costByTaskType: {},
			recentUsage: [],
			dailyCost: {},
			weeklyCost: {},
		};

		// Aggregate from usage log
		for (const usage of this.usageLog) {
			stats.totalPromptTokens += usage.promptTokens;
			stats.totalCompletionTokens += usage.completionTokens;
			stats.totalCost += usage.cost;
			stats.totalCacheHits += usage.cacheHitTokens;
			stats.totalCacheWrites += usage.cacheWriteTokens;

			// By model
			if (!stats.costByModel[usage.model]) {
				stats.costByModel[usage.model] = 0;
			}
			stats.costByModel[usage.model] += usage.cost;

			if (!stats.tokensByModel[usage.model]) {
				stats.tokensByModel[usage.model] = { prompt: 0, completion: 0 };
			}
			stats.tokensByModel[usage.model].prompt += usage.promptTokens;
			stats.tokensByModel[usage.model].completion += usage.completionTokens;

			// By task type
			if (usage.taskType) {
				if (!stats.costByTaskType[usage.taskType]) {
					stats.costByTaskType[usage.taskType] = 0;
				}
				stats.costByTaskType[usage.taskType] += usage.cost;
			}

			// Daily cost
			const date = usage.timestamp.split("T")[0];
			if (!stats.dailyCost[date]) {
				stats.dailyCost[date] = 0;
			}
			stats.dailyCost[date] += usage.cost;

			// Weekly cost (ISO week)
			const weekKey = this.getWeekKey(usage.timestamp);
			if (!stats.weeklyCost[weekKey]) {
				stats.weeklyCost[weekKey] = 0;
			}
			stats.weeklyCost[weekKey] += usage.cost;
		}

		// Calculate averages
		if (stats.totalSessions > 0) {
			stats.averageCostPerSession = stats.totalCost / stats.totalSessions;
			stats.averageTokensPerSession =
				(stats.totalPromptTokens + stats.totalCompletionTokens) / stats.totalSessions;
		}

		if (stats.totalApiCalls > 0) {
			stats.averageCostPerCall = stats.totalCost / stats.totalApiCalls;
		}

		// Recent usage (last 10)
		stats.recentUsage = this.usageLog.slice(-10);

		return stats;
	}

	/**
	 * Get ISO week key from timestamp
	 */
	private getWeekKey(timestamp: string): string {
		const date = new Date(timestamp);
		const year = date.getFullYear();
		const oneJan = new Date(year, 0, 1);
		const days = Math.floor((date.getTime() - oneJan.getTime()) / 86400000);
		const weekNumber = Math.ceil((days + oneJan.getDay() + 1) / 7);
		return `${year}-W${weekNumber.toString().padStart(2, "0")}`;
	}

	/**
	 * Format statistics for display
	 */
	formatStats(stats: TokenStats): string {
		const lines: string[] = [];

		lines.push("📊 Token Tracking Statistics");
		lines.push("─".repeat(50));
		lines.push(`Sessions: ${stats.totalSessions}`);
		lines.push(`API Calls: ${stats.totalApiCalls}`);
		lines.push(`Total Prompt Tokens: ${this.formatTokens(stats.totalPromptTokens)}`);
		lines.push(`Total Completion Tokens: ${this.formatTokens(stats.totalCompletionTokens)}`);
		lines.push(
			`Total Tokens: ${this.formatTokens(stats.totalPromptTokens + stats.totalCompletionTokens)}`,
		);
		lines.push(`Total Cost: ${this.formatCost(stats.totalCost)}`);
		lines.push("─".repeat(50));

		if (stats.totalCacheHits > 0 || stats.totalCacheWrites > 0) {
			lines.push("Cache Statistics:");
			lines.push(`  Cache Hits: ${this.formatTokens(stats.totalCacheHits)} tokens`);
			lines.push(`  Cache Writes: ${this.formatTokens(stats.totalCacheWrites)} tokens`);
		}

		lines.push("Averages:");
		lines.push(`  Cost per Session: ${this.formatCost(stats.averageCostPerSession)}`);
		lines.push(`  Tokens per Session: ${this.formatTokens(stats.averageTokensPerSession)}`);
		lines.push(`  Cost per Call: ${this.formatCost(stats.averageCostPerCall)}`);

		// Cost by model
		if (Object.keys(stats.costByModel).length > 0) {
			lines.push("─".repeat(50));
			lines.push("Cost by Model:");
			for (const [model, cost] of Object.entries(stats.costByModel).sort((a, b) => b[1] - a[1])) {
				const tokens = stats.tokensByModel[model];
				lines.push(
					`  ${model}: ${this.formatCost(cost)} (${this.formatTokens(tokens.prompt + tokens.completion)} tokens)`,
				);
			}
		}

		// Cost by task type
		if (Object.keys(stats.costByTaskType).length > 0) {
			lines.push("─".repeat(50));
			lines.push("Cost by Task Type:");
			for (const [type, cost] of Object.entries(stats.costByTaskType).sort((a, b) => b[1] - a[1])) {
				lines.push(`  ${type}: ${this.formatCost(cost)}`);
			}
		}

		// Weekly cost trend
		if (Object.keys(stats.weeklyCost).length > 0) {
			lines.push("─".repeat(50));
			lines.push("Weekly Cost Trend:");
			const weeks = Object.keys(stats.weeklyCost).sort();
			for (const week of weeks.slice(-4)) {
				lines.push(`  ${week}: ${this.formatCost(stats.weeklyCost[week])}`);
			}
		}

		return lines.join("\n");
	}

	/**
	 * Get session details
	 */
	getSession(sessionId: string): TokenSession | undefined {
		return this.sessions.get(sessionId);
	}

	/**
	 * List all sessions
	 */
	listSessions(): TokenSession[] {
		return Array.from(this.sessions.values()).sort(
			(a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
		);
	}

	/**
	 * Clear tracking data
	 */
	clear(): void {
		this.usageLog = [];
		this.sessions.clear();
		this.currentSession = undefined;
		this.saveData();
	}

	/**
	 * Export data for analysis
	 */
	exportData(): { usage: TokenUsage[]; sessions: TokenSession[] } {
		return {
			usage: this.usageLog,
			sessions: this.listSessions(),
		};
	}

	/**
	 * Save data to file
	 */
	private saveData(): void {
		const data = this.exportData();
		const filePath = join(this.dataDir, "token-tracking.json");
		writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
	}

	/**
	 * Load data from file
	 */
	private loadData(): void {
		const filePath = join(this.dataDir, "token-tracking.json");

		if (existsSync(filePath)) {
			try {
				const data = JSON.parse(readFileSync(filePath, "utf-8"));

				if (data.usage && Array.isArray(data.usage)) {
					this.usageLog = data.usage;
				}

				if (data.sessions && Array.isArray(data.sessions)) {
					for (const session of data.sessions) {
						this.sessions.set(session.sessionId, session);
					}
				}
			} catch {
				// Failed to load, start fresh
			}
		}
	}
}

/**
 * Global token tracker instance
 */
let trackerInstance: TokenTracker | null = null;

/**
 * Get or create token tracker instance
 */
export function getTokenTracker(config?: TokenTrackingConfig): TokenTracker {
	if (!trackerInstance) {
		trackerInstance = new TokenTracker(config);
	}
	return trackerInstance;
}

/**
 * Reset token tracker (for testing)
 */
export function resetTokenTracker(): void {
	trackerInstance = null;
}
