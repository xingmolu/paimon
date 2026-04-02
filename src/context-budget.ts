/**
 * Context Budget Monitoring for proactive context window management.
 *
 * This module provides tools for monitoring and managing context usage
 * before it becomes a problem. Unlike reactive compaction, this enables
 * the agent to proactively manage its context budget.
 *
 * Features:
 * 1. Real-time context usage monitoring
 * 2. Proactive warnings before hitting limits
 * 3. Optimization suggestions
 * 4. Integration with existing compaction module
 */

import { estimateTokens } from "./compaction.js";

/**
 * Context health status levels.
 */
export type ContextHealthStatus = "healthy" | "warning" | "critical" | "overflow";

/**
 * Context budget configuration.
 */
export interface ContextBudgetConfig {
	/** Maximum context window tokens */
	maxContextWindow: number;
	/** Warning threshold percentage (e.g., 70 = warn at 70% usage) */
	warningThresholdPercent: number;
	/** Critical threshold percentage (e.g., 85 = critical at 85% usage) */
	criticalThresholdPercent: number;
	/** Recommended buffer for response tokens */
	responseBufferTokens: number;
	/** Whether monitoring is enabled */
	enabled: boolean;
}

/**
 * Default context budget configuration.
 */
export const DEFAULT_CONTEXT_BUDGET_CONFIG: ContextBudgetConfig = {
	maxContextWindow: 128000, // Bailian/GLM-4 context window
	warningThresholdPercent: 70, // Warn at 70% usage
	criticalThresholdPercent: 85, // Critical at 85% usage
	responseBufferTokens: 8000, // Leave room for response
	enabled: true,
};

/**
 * Context usage statistics.
 */
export interface ContextUsageStats {
	/** Current estimated token usage */
	currentTokens: number;
	/** Maximum available tokens (context window - response buffer) */
	maxAvailableTokens: number;
	/** Usage percentage */
	usagePercent: number;
	/** Health status */
	healthStatus: ContextHealthStatus;
	/** Recommended actions */
	recommendations: string[];
	/** Time of check */
	timestamp: number;
}

/**
 * Context budget history entry.
 */
export interface ContextBudgetHistoryEntry {
	timestamp: number;
	tokens: number;
	usagePercent: number;
	healthStatus: ContextHealthStatus;
	trigger: string; // What triggered the check
}

/**
 * Context budget statistics.
 */
export interface ContextBudgetStats {
	/** Total checks performed */
	totalChecks: number;
	/** Current usage */
	currentUsage: ContextUsageStats;
	/** History of checks */
	history: ContextBudgetHistoryEntry[];
	/** Average usage */
	averageUsage: number;
	/** Peak usage */
	peakUsage: number;
	/** Warning count */
	warningCount: number;
	/** Critical count */
	criticalCount: number;
	/** Overflow count */
	overflowCount: number;
	/** Last check timestamp */
	lastCheckTimestamp: number | null;
}

/**
 * Optimization suggestion.
 */
export interface OptimizationSuggestion {
	/** Action type */
	action: "truncate_output" | "compact_history" | "reduce_tools" | "archive_memory" | "clear_cache";
	/** Description of the action */
	description: string;
	/** Estimated token savings */
	estimatedSavings: number;
	/** Priority (1 = highest) */
	priority: number;
	/** Whether this action can be executed automatically */
	autoExecutable: boolean;
}

/**
 * Context reduction action execution result.
 */
export interface ContextReductionResult {
	/** Action that was executed */
	action: string;
	/** Whether the action was successful */
	success: boolean;
	/** Actual token savings (estimated) */
	tokenSavings: number;
	/** Description of what was done */
	description: string;
	/** Timestamp */
	timestamp: number;
}

/**
 * Context reduction action execution log.
 */
export interface ContextReductionLog {
	/** Total actions executed */
	totalActions: number;
	/** Total token savings */
	totalSavings: number;
	/** Last reduction timestamp */
	lastReduction: number | null;
	/** Action history */
	history: ContextReductionResult[];
}

/**
 * Context Budget Manager - Proactive context window monitoring.
 */
export class ContextBudgetManager {
	private config: ContextBudgetConfig;
	private history: ContextBudgetHistoryEntry[] = [];
	private totalChecks = 0;
	private peakUsage = 0;
	private warningCount = 0;
	private criticalCount = 0;
	private overflowCount = 0;
	private currentTokenEstimate = 0;
	private reductionLog: ContextReductionLog = {
		totalActions: 0,
		totalSavings: 0,
		lastReduction: null,
		history: [],
	};

	constructor(config: Partial<ContextBudgetConfig> = {}) {
		this.config = { ...DEFAULT_CONTEXT_BUDGET_CONFIG, ...config };
	}

	/**
	 * Update the current token estimate.
	 * This should be called whenever context changes.
	 */
	updateTokenEstimate(tokens: number): void {
		this.currentTokenEstimate = tokens;
	}

	/**
	 * Add to the token estimate (e.g., after tool output).
	 */
	addTokens(tokens: number): void {
		this.currentTokenEstimate += tokens;
	}

	/**
	 * Get the current token estimate.
	 */
	getTokenEstimate(): number {
		return this.currentTokenEstimate;
	}

	/**
	 * Check context budget and get usage statistics.
	 */
	checkBudget(trigger = "manual"): ContextUsageStats {
		this.totalChecks++;

		const maxAvailable = this.config.maxContextWindow - this.config.responseBufferTokens;
		const usagePercent = (this.currentTokenEstimate / maxAvailable) * 100;
		const timestamp = Date.now();

		// Determine health status
		let healthStatus: ContextHealthStatus;
		if (usagePercent >= 100) {
			healthStatus = "overflow";
			this.overflowCount++;
		} else if (usagePercent >= this.config.criticalThresholdPercent) {
			healthStatus = "critical";
			this.criticalCount++;
		} else if (usagePercent >= this.config.warningThresholdPercent) {
			healthStatus = "warning";
			this.warningCount++;
		} else {
			healthStatus = "healthy";
		}

		// Track peak usage
		if (this.currentTokenEstimate > this.peakUsage) {
			this.peakUsage = this.currentTokenEstimate;
		}

		// Generate recommendations
		const recommendations = this.generateRecommendations(healthStatus, usagePercent);

		// Add to history (limit to last 100 entries)
		this.history.push({
			timestamp,
			tokens: this.currentTokenEstimate,
			usagePercent,
			healthStatus,
			trigger,
		});
		if (this.history.length > 100) {
			this.history.shift();
		}

		return {
			currentTokens: this.currentTokenEstimate,
			maxAvailableTokens: maxAvailable,
			usagePercent,
			healthStatus,
			recommendations,
			timestamp,
		};
	}

	/**
	 * Generate recommendations based on health status.
	 */
	private generateRecommendations(status: ContextHealthStatus, usagePercent: number): string[] {
		const recommendations: string[] = [];

		if (status === "overflow") {
			recommendations.push("CRITICAL: Context overflow detected. Immediate action required.");
			recommendations.push("Run compaction immediately to summarize old messages.");
			recommendations.push("Consider truncating large tool outputs.");
		} else if (status === "critical") {
			recommendations.push("WARNING: Context usage at critical level (~85%+).");
			recommendations.push("Proactively compact conversation history.");
			recommendations.push("Archive old JOURNAL entries to reduce context.");
		} else if (status === "warning") {
			recommendations.push("Context usage approaching limits (~70%+).");
			recommendations.push("Consider proactively truncating tool outputs.");
			recommendations.push("Review and archive old memory entries.");
		} else {
			recommendations.push("Context usage is healthy.");
			recommendations.push("No immediate action required.");
		}

		// Add specific suggestions based on usage
		if (usagePercent > 50) {
			recommendations.push(`Current usage: ${Math.round(usagePercent)}% of context window.`);
		}

		return recommendations;
	}

	/**
	 * Get optimization suggestions for reducing context usage.
	 */
	getOptimizationSuggestions(): OptimizationSuggestion[] {
		const suggestions: OptimizationSuggestion[] = [];
		const usagePercent = (this.currentTokenEstimate / this.config.maxContextWindow) * 100;

		if (usagePercent > 60) {
			// Suggest truncating tool outputs - auto-executable
			suggestions.push({
				action: "truncate_output",
				description: "Truncate large tool outputs to essential information",
				estimatedSavings: Math.round(this.currentTokenEstimate * 0.15),
				priority: 1,
				autoExecutable: true,
			});
		}

		if (usagePercent > 70) {
			// Suggest compacting history - auto-executable
			suggestions.push({
				action: "compact_history",
				description: "Summarize old conversation messages",
				estimatedSavings: Math.round(this.currentTokenEstimate * 0.25),
				priority: 2,
				autoExecutable: true,
			});
		}

		if (usagePercent > 80) {
			// Suggest reducing tools in context - not auto-executable (requires manual decision)
			suggestions.push({
				action: "reduce_tools",
				description: "Load minimal set of tools for current task",
				estimatedSavings: Math.round(this.currentTokenEstimate * 0.1),
				priority: 3,
				autoExecutable: false,
			});
		}

		if (usagePercent > 85) {
			// Suggest archiving memory - not auto-executable (requires user confirmation)
			suggestions.push({
				action: "archive_memory",
				description: "Archive old MEMORY.md entries to separate file",
				estimatedSavings: Math.round(this.currentTokenEstimate * 0.2),
				priority: 4,
				autoExecutable: false,
			});
		}

		// Always suggest clearing cache - auto-executable
		suggestions.push({
			action: "clear_cache",
			description: "Clear tool result cache to free up memory",
			estimatedSavings: 500, // Approximate
			priority: 5,
			autoExecutable: true,
		});

		return suggestions;
	}

	/**
	 * Log a context reduction action.
	 */
	logReductionAction(result: ContextReductionResult): void {
		this.reductionLog.totalActions++;
		this.reductionLog.totalSavings += result.tokenSavings;
		this.reductionLog.lastReduction = result.timestamp;
		this.reductionLog.history.push(result);

		// Limit history to 50 entries
		if (this.reductionLog.history.length > 50) {
			this.reductionLog.history.shift();
		}

		// Update current token estimate after reduction
		this.currentTokenEstimate -= result.tokenSavings;
		if (this.currentTokenEstimate < 0) {
			this.currentTokenEstimate = 0;
		}
	}

	/**
	 * Get context reduction log.
	 */
	getReductionLog(): ContextReductionLog {
		return { ...this.reductionLog };
	}

	/**
	 * Get auto-executable suggestions only.
	 */
	getAutoExecutableSuggestions(): OptimizationSuggestion[] {
		return this.getOptimizationSuggestions().filter((s) => s.autoExecutable);
	}

	/**
	 * Get comprehensive statistics.
	 */
	getStats(): ContextBudgetStats {
		const currentUsage = this.checkBudget("stats_query");
		const averageUsage =
			this.history.length > 0
				? this.history.reduce((sum, e) => sum + e.tokens, 0) / this.history.length
				: 0;

		return {
			totalChecks: this.totalChecks,
			currentUsage,
			history: this.history.slice(-20), // Return last 20 entries
			averageUsage: Math.round(averageUsage),
			peakUsage: this.peakUsage,
			warningCount: this.warningCount,
			criticalCount: this.criticalCount,
			overflowCount: this.overflowCount,
			lastCheckTimestamp:
				this.history.length > 0 ? this.history[this.history.length - 1].timestamp : null,
		};
	}

	/**
	 * Get configuration.
	 */
	getConfig(): ContextBudgetConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration.
	 */
	updateConfig(newConfig: Partial<ContextBudgetConfig>): void {
		this.config = { ...this.config, ...newConfig };
	}

	/**
	 * Reset statistics (keep config).
	 */
	reset(): void {
		this.history = [];
		this.totalChecks = 0;
		this.peakUsage = 0;
		this.warningCount = 0;
		this.criticalCount = 0;
		this.overflowCount = 0;
		this.currentTokenEstimate = 0;
		this.reductionLog = {
			totalActions: 0,
			totalSavings: 0,
			lastReduction: null,
			history: [],
		};
	}

	/**
	 * Estimate tokens for a string using the compaction module.
	 */
	static estimateTokens(text: string): number {
		return estimateTokens(text);
	}

	/**
	 * Check if a check is needed based on last check time.
	 */
	shouldCheck(lastCheckTime: number | null, minIntervalMs = 5000): boolean {
		if (lastCheckTime === null) return true;
		return Date.now() - lastCheckTime > minIntervalMs;
	}
}

// Global instance for tracking across the agent
let globalContextBudgetManager: ContextBudgetManager | null = null;

/**
 * Get the global context budget manager.
 */
export function getGlobalContextBudgetManager(): ContextBudgetManager {
	if (!globalContextBudgetManager) {
		globalContextBudgetManager = new ContextBudgetManager();
	}
	return globalContextBudgetManager;
}

/**
 * Initialize the global context budget manager with config.
 */
export function initGlobalContextBudgetManager(
	config: Partial<ContextBudgetConfig> = {},
): ContextBudgetManager {
	globalContextBudgetManager = new ContextBudgetManager(config);
	return globalContextBudgetManager;
}
