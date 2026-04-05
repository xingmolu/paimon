/**
 * Token Breakdown module - Detailed token usage breakdown display (Aider pattern)
 *
 * Inspired by Aider's /tokens command for showing detailed breakdown of
 * token usage across system messages, chat history, repo map, and files.
 */

import { readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { type TokenTracker, getTokenTracker } from "./token-tracking.js";

/**
 * Token breakdown component
 */
export interface TokenComponent {
	name: string;
	tokens: number;
	cost: number;
	tip?: string;
	category: "system" | "chat" | "repomap" | "file" | "read-only" | "other";
}

/**
 * Token breakdown result
 */
export interface TokenBreakdown {
	model: string;
	contextWindow: number;
	components: TokenComponent[];
	totalTokens: number;
	totalCost: number;
	remainingTokens: number;
	utilizationPercent: number;
	warnings: string[];
}

/**
 * Model context window configuration
 */
export interface ModelContextConfig {
	name: string;
	contextWindow: number;
	inputCostPerToken: number;
	supportsVision: boolean;
}

// Default model configurations
const DEFAULT_MODEL_CONFIGS: Record<string, ModelContextConfig> = {
	"gpt-4o": {
		name: "gpt-4o",
		contextWindow: 128000,
		inputCostPerToken: 0.0000025,
		supportsVision: true,
	},
	"gpt-4o-mini": {
		name: "gpt-4o-mini",
		contextWindow: 128000,
		inputCostPerToken: 0.00000015,
		supportsVision: true,
	},
	"gpt-4-turbo": {
		name: "gpt-4-turbo",
		contextWindow: 128000,
		inputCostPerToken: 0.00001,
		supportsVision: true,
	},
	"gpt-4": {
		name: "gpt-4",
		contextWindow: 8192,
		inputCostPerToken: 0.00003,
		supportsVision: false,
	},
	"gpt-3.5-turbo": {
		name: "gpt-3.5-turbo",
		contextWindow: 16385,
		inputCostPerToken: 0.0000005,
		supportsVision: false,
	},
	"claude-3-opus": {
		name: "claude-3-opus",
		contextWindow: 200000,
		inputCostPerToken: 0.000015,
		supportsVision: true,
	},
	"claude-3-sonnet": {
		name: "claude-3-sonnet",
		contextWindow: 200000,
		inputCostPerToken: 0.000003,
		supportsVision: true,
	},
	"claude-3-haiku": {
		name: "claude-3-haiku",
		contextWindow: 200000,
		inputCostPerToken: 0.00000025,
		supportsVision: true,
	},
	"claude-3-5-sonnet": {
		name: "claude-3-5-sonnet",
		contextWindow: 200000,
		inputCostPerToken: 0.000003,
		supportsVision: true,
	},
	"claude-3-7-sonnet": {
		name: "claude-3-7-sonnet",
		contextWindow: 200000,
		inputCostPerToken: 0.000003,
		supportsVision: true,
	},
	o1: {
		name: "o1",
		contextWindow: 200000,
		inputCostPerToken: 0.000015,
		supportsVision: true,
	},
	"o1-mini": {
		name: "o1-mini",
		contextWindow: 128000,
		inputCostPerToken: 0.000003,
		supportsVision: false,
	},
	"o3-mini": {
		name: "o3-mini",
		contextWindow: 200000,
		inputCostPerToken: 0.0000011,
		supportsVision: true,
	},
	"deepseek-reasoner": {
		name: "deepseek-reasoner",
		contextWindow: 128000,
		inputCostPerToken: 0.00000055,
		supportsVision: false,
	},
	"deepseek-chat": {
		name: "deepseek-chat",
		contextWindow: 64000,
		inputCostPerToken: 0.00000014,
		supportsVision: false,
	},
	default: {
		name: "default",
		contextWindow: 128000,
		inputCostPerToken: 0.000001,
		supportsVision: false,
	},
};

/**
 * Token Breakdown Manager - Generate detailed token breakdowns
 */
export class TokenBreakdownManager {
	private tracker: TokenTracker;
	private modelConfigs: Record<string, ModelContextConfig>;
	private rootDir: string;

	constructor(rootDir = ".") {
		this.tracker = getTokenTracker();
		this.modelConfigs = DEFAULT_MODEL_CONFIGS;
		this.rootDir = rootDir;
	}

	/**
	 * Get model configuration
	 */
	getModelConfig(model: string): ModelContextConfig {
		// Try exact match
		if (this.modelConfigs[model]) {
			return this.modelConfigs[model];
		}

		// Try partial match (e.g., "claude-3-5-sonnet-20241022" matches "claude-3-5-sonnet")
		for (const [key, config] of Object.entries(this.modelConfigs)) {
			if (model.includes(key) || key.includes(model)) {
				return config;
			}
		}

		return this.modelConfigs.default;
	}

	/**
	 * Estimate tokens for a string (rough approximation: ~4 chars per token)
	 */
	estimateTokens(content: string): number {
		return Math.ceil(content.length / 4);
	}

	/**
	 * Estimate tokens for a file
	 */
	estimateFileTokens(filePath: string): number {
		try {
			const stats = statSync(filePath);
			const ext = extname(filePath).toLowerCase();

			// Image files: rough estimate based on file size
			if ([".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) {
				// Images typically use more tokens
				return Math.ceil(stats.size / 100); // rough estimate
			}

			// Text files: read and estimate
			const content = readFileSync(filePath, "utf-8");
			return this.estimateTokens(content);
		} catch {
			return 0;
		}
	}

	/**
	 * Generate token breakdown for current context
	 */
	generateBreakdown(options: {
		model: string;
		systemPrompt?: string;
		chatHistory?: Array<{ role: string; content: string }>;
		repoMap?: string;
		files?: string[];
		readOnlyFiles?: string[];
	}): TokenBreakdown {
		const modelConfig = this.getModelConfig(options.model);
		const components: TokenComponent[] = [];
		const warnings: string[] = [];

		// System prompt
		if (options.systemPrompt) {
			const tokens = this.estimateTokens(options.systemPrompt);
			const cost = tokens * modelConfig.inputCostPerToken;
			components.push({
				name: "System messages",
				tokens,
				cost,
				category: "system",
				tip: "Minimize system prompt size",
			});
		}

		// Chat history
		if (options.chatHistory && options.chatHistory.length > 0) {
			const content = options.chatHistory.map((m) => m.content).join("\n");
			const tokens = this.estimateTokens(content);
			const cost = tokens * modelConfig.inputCostPerToken;
			components.push({
				name: "Chat history",
				tokens,
				cost,
				category: "chat",
				tip: "Use /clear to clear",
			});
		}

		// Repo map
		if (options.repoMap) {
			const tokens = this.estimateTokens(options.repoMap);
			const cost = tokens * modelConfig.inputCostPerToken;
			components.push({
				name: "Repository map",
				tokens,
				cost,
				category: "repomap",
				tip: "Use --map-tokens to resize",
			});
		}

		// Editable files
		if (options.files && options.files.length > 0) {
			for (const file of options.files) {
				const tokens = this.estimateFileTokens(file);
				const cost = tokens * modelConfig.inputCostPerToken;
				components.push({
					name: file,
					tokens,
					cost,
					category: "file",
					tip: "/drop to remove",
				});
			}
		}

		// Read-only files
		if (options.readOnlyFiles && options.readOnlyFiles.length > 0) {
			for (const file of options.readOnlyFiles) {
				const tokens = this.estimateFileTokens(file);
				const cost = tokens * modelConfig.inputCostPerToken;
				components.push({
					name: `${file} (read-only)`,
					tokens,
					cost,
					category: "read-only",
					tip: "/drop to remove",
				});
			}
		}

		// Sort by tokens (descending)
		components.sort((a, b) => b.tokens - a.tokens);

		// Calculate totals
		const totalTokens = components.reduce((sum, c) => sum + c.tokens, 0);
		const totalCost = components.reduce((sum, c) => sum + c.cost, 0);
		const remainingTokens = modelConfig.contextWindow - totalTokens;
		const utilizationPercent = (totalTokens / modelConfig.contextWindow) * 100;

		// Generate warnings
		if (remainingTokens < 0) {
			warnings.push("Context window exhausted! Remove files or clear history.");
		} else if (remainingTokens < 1000) {
			warnings.push("Context window nearly full. Consider /drop or /clear.");
		} else if (utilizationPercent > 80) {
			warnings.push(`Context window ${utilizationPercent.toFixed(0)}% utilized.`);
		}

		return {
			model: options.model,
			contextWindow: modelConfig.contextWindow,
			components,
			totalTokens,
			totalCost,
			remainingTokens,
			utilizationPercent,
			warnings,
		};
	}

	/**
	 * Format breakdown for display
	 */
	formatBreakdown(breakdown: TokenBreakdown): string {
		const lines: string[] = [];

		lines.push(`📊 Token Breakdown for ${breakdown.model}`);
		lines.push("─".repeat(70));
		lines.push("");

		// Header
		const costWidth = 9;
		const tokenWidth = 10;
		const nameWidth = 45;

		lines.push(
			`${"Cost".padStart(costWidth)} ${"Tokens".padStart(tokenWidth)} ${"Component".padEnd(nameWidth)} Tip`,
		);
		lines.push("─".repeat(70));

		// Components
		for (const component of breakdown.components) {
			const cost = this.formatCost(component.cost);
			const tokens = this.formatTokens(component.tokens);
			const name = component.name.slice(0, nameWidth - 1);

			lines.push(
				`${cost.padStart(costWidth)} ${tokens.padStart(tokenWidth)} ${name.padEnd(nameWidth)} ${component.tip || ""}`,
			);
		}

		lines.push("─".repeat(70));

		// Totals
		const totalCost = this.formatCost(breakdown.totalCost);
		const totalTokens = this.formatTokens(breakdown.totalTokens);

		lines.push(`${totalCost.padStart(costWidth)} ${totalTokens.padStart(tokenWidth)} tokens total`);

		// Remaining
		const remaining = this.formatTokens(Math.max(0, breakdown.remainingTokens));
		const limit = this.formatTokens(breakdown.contextWindow);

		if (breakdown.remainingTokens > 1024) {
			lines.push(
				`${"".padStart(costWidth)} ${remaining.padStart(tokenWidth)} tokens remaining in context window`,
			);
		} else if (breakdown.remainingTokens > 0) {
			lines.push(
				`${"".padStart(costWidth)} ${remaining.padStart(tokenWidth)} tokens remaining (use /drop or /clear)`,
			);
		} else {
			lines.push(
				`${"".padStart(costWidth)} ${"0".padStart(tokenWidth)} tokens remaining, window exhausted!`,
			);
		}

		lines.push(
			`${"".padStart(costWidth)} ${limit.padStart(tokenWidth)} tokens max context window size`,
		);

		// Warnings
		if (breakdown.warnings.length > 0) {
			lines.push("");
			for (const warning of breakdown.warnings) {
				lines.push(`⚠️  ${warning}`);
			}
		}

		// Utilization bar
		lines.push("");
		lines.push(this.formatUtilizationBar(breakdown.utilizationPercent));

		return lines.join("\n");
	}

	/**
	 * Format utilization bar
	 */
	formatUtilizationBar(percent: number): string {
		const barWidth = 50;
		const filled = Math.min(Math.floor((percent / 100) * barWidth), barWidth);
		const empty = barWidth - filled;

		const bar = "█".repeat(filled) + "░".repeat(empty);
		let color = "🟢"; // Green

		if (percent > 90) {
			color = "🔴"; // Red
		} else if (percent > 75) {
			color = "🟡"; // Yellow
		} else if (percent > 50) {
			color = "🟠"; // Orange
		}

		return `${color} Context: [${bar}] ${percent.toFixed(1)}%`;
	}

	/**
	 * Format cost value for display
	 */
	formatCost(value: number): string {
		if (value === 0) return "$0.0000";
		const magnitude = Math.abs(value);
		if (magnitude >= 0.01) {
			return `$${value.toFixed(4)}`;
		}
		const decimals = Math.max(4, 4 - Math.floor(Math.log10(magnitude)));
		return `$${value.toFixed(decimals)}`;
	}

	/**
	 * Format token count for display
	 */
	formatTokens(tokens: number): string {
		return tokens.toLocaleString();
	}

	/**
	 * Get quick summary of token breakdown
	 */
	getQuickSummary(breakdown: TokenBreakdown): string {
		const used = this.formatTokens(breakdown.totalTokens);
		const remaining = this.formatTokens(Math.max(0, breakdown.remainingTokens));
		const percent = breakdown.utilizationPercent.toFixed(1);
		const cost = this.formatCost(breakdown.totalCost);

		return `📊 ${used} tokens used, ${remaining} remaining (${percent}% of ${this.formatTokens(breakdown.contextWindow)}), cost: ${cost}`;
	}

	/**
	 * Get cost for specific token count
	 */
	getCostForTokens(model: string, tokens: number): number {
		const modelConfig = this.getModelConfig(model);
		return tokens * modelConfig.inputCostPerToken;
	}

	/**
	 * List available models with their context windows
	 */
	listModels(): string {
		const lines: string[] = [];

		lines.push("📋 Available Models");
		lines.push("─".repeat(50));
		lines.push("Model               Context Window    Cost/1K Tokens");
		lines.push("─".repeat(50));

		const models = Object.values(this.modelConfigs)
			.filter((m) => m.name !== "default")
			.sort((a, b) => b.contextWindow - a.contextWindow);

		for (const model of models) {
			const name = model.name.slice(0, 18).padEnd(18);
			const window = this.formatTokens(model.contextWindow).padStart(12);
			const cost = (model.inputCostPerToken * 1000).toFixed(4).padStart(12);
			lines.push(`${name} ${window}    $${cost}`);
		}

		return lines.join("\n");
	}

	/**
	 * Compare token usage across multiple models
	 */
	compareModels(tokens: number): string {
		const lines: string[] = [];

		lines.push(`📊 Cost Comparison for ${this.formatTokens(tokens)} tokens`);
		lines.push("─".repeat(50));

		const models = Object.values(this.modelConfigs)
			.filter((m) => m.name !== "default")
			.sort((a, b) => a.inputCostPerToken - b.inputCostPerToken);

		for (const model of models) {
			const cost = tokens * model.inputCostPerToken;
			const fits = tokens <= model.contextWindow ? "✅" : "❌";
			const costStr = this.formatCost(cost).padStart(10);
			lines.push(
				`${fits} ${model.name.padEnd(20)} ${costStr}  (${this.formatTokens(model.contextWindow)} window)`,
			);
		}

		return lines.join("\n");
	}

	/**
	 * Get statistics
	 */
	getStats(): { breakdownsGenerated: number; cacheHits: number; cacheMisses: number } {
		return {
			breakdownsGenerated: 0,
			cacheHits: 0,
			cacheMisses: 0,
		};
	}
}

/**
 * Global instance
 */
let managerInstance: TokenBreakdownManager | null = null;

/**
 * Get or create token breakdown manager instance
 */
export function getTokenBreakdownManager(rootDir?: string): TokenBreakdownManager {
	if (!managerInstance) {
		managerInstance = new TokenBreakdownManager(rootDir);
	}
	return managerInstance;
}

/**
 * Reset manager (for testing)
 */
export function resetTokenBreakdownManager(): void {
	managerInstance = null;
}
