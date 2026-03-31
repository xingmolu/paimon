/**
 * Model Roulette - Inspired by Mini-SWE-Agent Model Roulette Pattern
 *
 * Randomly switching between models can boost performance by diversifying
 * reasoning approaches. Mini-SWE-Agent research shows "Randomly switching
 * between GPT-5 and Sonnet 4 boosts performance".
 *
 * Key patterns:
 * 1. Model pool - Configure multiple models to choose from
 * 2. Roulette selection - Random model selection at each turn
 * 3. Weighted selection - Optional model weights for preference
 * 4. Statistics tracking - Track which models perform best
 *
 * @see https://www.swebench.com/post-250820-mini-roulette.html
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Model entry in the roulette pool
 */
export interface RouletteModel {
	/** Model identifier (e.g., "gpt-4", "claude-3-opus") */
	id: string;
	/** Model display name */
	name?: string;
	/** Model weight for selection (default: 1.0) */
	weight?: number;
	/** Base URL override for this model (optional) */
	baseUrl?: string;
	/** Custom API key for this model (optional) */
	apiKey?: string;
}

/**
 * Roulette statistics for a model
 */
export interface RouletteModelStats {
	/** Model identifier */
	modelId: string;
	/** Number of times this model was selected */
	selections: number;
	/** Number of successful completions with this model */
	successes: number;
	/** Number of failures with this model */
	failures: number;
	/** Average response time in milliseconds */
	avgResponseTime: number;
	/** Total tokens used by this model */
	totalTokens: number;
}

/**
 * Roulette configuration
 */
export interface RouletteConfig {
	/** Pool of models to select from */
	models: RouletteModel[];
	/** Selection strategy: random, weighted, round-robin */
	strategy?: "random" | "weighted" | "round-robin";
	/** Switch model every N turns (default: 1, switch every turn) */
	switchEvery?: number;
	/** Track statistics for analysis */
	trackStats?: boolean;
	/** Statistics persistence path */
	statsPath?: string;
	/** Seed for reproducible selection (optional, for experiments) */
	seed?: number;
}

/**
 * Roulette selection result
 */
export interface RouletteSelection {
	/** Selected model */
	model: RouletteModel;
	/** Selection reason */
	reason: "random" | "weighted" | "round-robin" | "fallback";
	/** Turn number when selection was made */
	turn: number;
	/** All model weights at time of selection (for weighted strategy) */
	weights?: Record<string, number>;
}

/**
 * Roulette statistics summary
 */
export interface RouletteStatsSummary {
	/** Statistics for each model */
	modelStats: RouletteModelStats[];
	/** Total selections across all models */
	totalSelections: number;
	/** Total successes across all models */
	totalSuccesses: number;
	/** Total failures across all models */
	totalFailures: number;
	/** Best performing model (highest success rate) */
	bestModel?: string;
	/** Overall success rate */
	successRate: number;
	/** Selection strategy used */
	strategy: string;
	/** Timeframe of statistics */
	timeframe?: {
		start: string;
		end: string;
	};
}

/**
 * Model Roulette class for random model switching
 */
export class ModelRoulette {
	private config: RouletteConfig;
	private currentTurn = 0;
	private currentIndex = 0; // For round-robin
	private stats: Map<string, RouletteModelStats> = new Map();
	private seededRandom?: () => number;
	private dataDir: string;

	constructor(config: RouletteConfig, dataDir?: string) {
		this.config = {
			strategy: "random",
			switchEvery: 1,
			trackStats: true,
			...config,
		};

		this.dataDir = dataDir || join(process.cwd(), "data");

		// Initialize stats for each model
		for (const model of this.config.models) {
			this.stats.set(model.id, {
				modelId: model.id,
				selections: 0,
				successes: 0,
				failures: 0,
				avgResponseTime: 0,
				totalTokens: 0,
			});
		}

		// Setup seeded random if provided (for reproducible experiments)
		if (this.config.seed !== undefined) {
			this.seededRandom = this.createSeededRandom(this.config.seed);
		}

		// Load existing stats if tracking enabled
		if (this.config.trackStats) {
			this.loadStats();
		}
	}

	/**
	 * Create a seeded random number generator (for reproducible experiments)
	 */
	private createSeededRandom(seed: number): () => number {
		let s = seed;
		return () => {
			s = (s * 1103515245 + 12345) & 0x7fffffff;
			return s / 0x7fffffff;
		};
	}

	/**
	 * Get random number ( seeded or true random)
	 */
	private getRandom(): number {
		if (this.seededRandom) {
			return this.seededRandom();
		}
		return Math.random();
	}

	/**
	 * Select next model using configured strategy
	 */
	selectModel(): RouletteSelection {
		this.currentTurn++;

		// Check if we should switch (based on switchEvery config)
		const switchEvery = this.config.switchEvery ?? 1;
		if (this.currentTurn > 1 && (this.currentTurn - 1) % switchEvery !== 0) {
			// Use same model as previous turn
			const lastModel = this.config.models[this.currentIndex];
			if (lastModel) {
				return {
					model: lastModel,
					reason:
						this.config.strategy === "round-robin"
							? "round-robin"
							: this.config.strategy || "random",
					turn: this.currentTurn,
				};
			}
		}

		let selectedModel: RouletteModel;
		let reason: RouletteSelection["reason"];
		const weights: Record<string, number> = {};

		switch (this.config.strategy) {
			case "weighted":
				selectedModel = this.selectWeighted(weights);
				reason = "weighted";
				break;

			case "round-robin":
				selectedModel = this.selectRoundRobin();
				reason = "round-robin";
				break;

			default:
				selectedModel = this.selectRandom();
				reason = "random";
		}

		// Update stats
		const stats = this.stats.get(selectedModel.id);
		if (stats) {
			stats.selections++;
		}

		// Save stats if tracking enabled
		if (this.config.trackStats) {
			this.saveStats();
		}

		return {
			model: selectedModel,
			reason,
			turn: this.currentTurn,
			weights: this.config.strategy === "weighted" ? weights : undefined,
		};
	}

	/**
	 * Random selection from model pool
	 */
	private selectRandom(): RouletteModel {
		const index = Math.floor(this.getRandom() * this.config.models.length);
		this.currentIndex = index;
		return this.config.models[index];
	}

	/**
	 * Weighted selection based on model weights
	 */
	private selectWeighted(weights: Record<string, number>): RouletteModel {
		// Calculate total weight
		let totalWeight = 0;
		for (const model of this.config.models) {
			const weight = model.weight ?? 1.0;
			weights[model.id] = weight;
			totalWeight += weight;
		}

		// Normalize weights and select
		const random = this.getRandom() * totalWeight;
		let cumulative = 0;

		for (const model of this.config.models) {
			cumulative += model.weight ?? 1.0;
			if (random <= cumulative) {
				this.currentIndex = this.config.models.indexOf(model);
				return model;
			}
		}

		// Fallback to last model
		return this.config.models[this.config.models.length - 1];
	}

	/**
	 * Round-robin selection (cycle through models)
	 */
	private selectRoundRobin(): RouletteModel {
		this.currentIndex = (this.currentIndex + 1) % this.config.models.length;
		return this.config.models[this.currentIndex];
	}

	/**
	 * Record success for current model
	 */
	recordSuccess(modelId: string, responseTime?: number, tokens?: number): void {
		const stats = this.stats.get(modelId);
		if (stats) {
			stats.successes++;
			if (responseTime !== undefined) {
				// Update average response time
				const totalTime = stats.avgResponseTime * (stats.successes - 1) + responseTime;
				stats.avgResponseTime = totalTime / stats.successes;
			}
			if (tokens !== undefined) {
				stats.totalTokens += tokens;
			}
			this.saveStats();
		}
	}

	/**
	 * Record failure for current model
	 */
	recordFailure(modelId: string, responseTime?: number): void {
		const stats = this.stats.get(modelId);
		if (stats) {
			stats.failures++;
			if (responseTime !== undefined) {
				// Update average response time (counting failures too)
				const totalOps = stats.successes + stats.failures;
				const totalTime = stats.avgResponseTime * (totalOps - 1) + responseTime;
				stats.avgResponseTime = totalTime / totalOps;
			}
			this.saveStats();
		}
	}

	/**
	 * Get statistics summary
	 */
	getStats(): RouletteStatsSummary {
		const modelStats = Array.from(this.stats.values());
		const totalSelections = modelStats.reduce((sum, s) => sum + s.selections, 0);
		const totalSuccesses = modelStats.reduce((sum, s) => sum + s.successes, 0);
		const totalFailures = modelStats.reduce((sum, s) => sum + s.failures, 0);

		// Find best model by success rate
		let bestModel: string | undefined;
		let bestSuccessRate = 0;
		for (const stat of modelStats) {
			if (stat.selections > 0) {
				const rate = stat.successes / stat.selections;
				if (rate > bestSuccessRate) {
					bestSuccessRate = rate;
					bestModel = stat.modelId;
				}
			}
		}

		return {
			modelStats,
			totalSelections,
			totalSuccesses,
			totalFailures,
			bestModel,
			successRate: totalSelections > 0 ? totalSuccesses / totalSelections : 0,
			strategy: this.config.strategy || "random",
		};
	}

	/**
	 * Load statistics from file
	 */
	private loadStats(): void {
		const statsPath = this.config.statsPath || join(this.dataDir, "roulette-stats.json");
		if (existsSync(statsPath)) {
			try {
				const data = JSON.parse(readFileSync(statsPath, "utf-8")) as RouletteModelStats[];
				for (const stat of data) {
					this.stats.set(stat.modelId, stat);
				}
			} catch {
				// Ignore parse errors, start fresh
			}
		}
	}

	/**
	 * Save statistics to file
	 */
	private saveStats(): void {
		const statsPath = this.config.statsPath || join(this.dataDir, "roulette-stats.json");
		const data = Array.from(this.stats.values());
		try {
			writeFileSync(statsPath, JSON.stringify(data, null, 2), "utf-8");
		} catch {
			// Ignore save errors
		}
	}

	/**
	 * Reset statistics
	 */
	resetStats(): void {
		for (const model of this.config.models) {
			this.stats.set(model.id, {
				modelId: model.id,
				selections: 0,
				successes: 0,
				failures: 0,
				avgResponseTime: 0,
				totalTokens: 0,
			});
		}
		this.saveStats();
	}

	/**
	 * Get current turn number
	 */
	getCurrentTurn(): number {
		return this.currentTurn;
	}

	/**
	 * Get current model index (for round-robin)
	 */
	getCurrentIndex(): number {
		return this.currentIndex;
	}

	/**
	 * Get model pool
	 */
	getModels(): RouletteModel[] {
		return [...this.config.models];
	}

	/**
	 * Add model to pool
	 */
	addModel(model: RouletteModel): void {
		this.config.models.push(model);
		this.stats.set(model.id, {
			modelId: model.id,
			selections: 0,
			successes: 0,
			failures: 0,
			avgResponseTime: 0,
			totalTokens: 0,
		});
	}

	/**
	 * Remove model from pool
	 */
	removeModel(modelId: string): boolean {
		const index = this.config.models.findIndex((m) => m.id === modelId);
		if (index !== -1) {
			this.config.models.splice(index, 1);
			this.stats.delete(modelId);
			return true;
		}
		return false;
	}

	/**
	 * Update model weight
	 */
	setModelWeight(modelId: string, weight: number): boolean {
		const model = this.config.models.find((m) => m.id === modelId);
		if (model) {
			model.weight = weight;
			return true;
		}
		return false;
	}

	/**
	 * Check if roulette is configured properly
	 */
	isValid(): boolean {
		return this.config.models.length >= 2;
	}
}

/**
 * Get singleton instance of ModelRoulette
 */
let rouletteInstance: ModelRoulette | null = null;

export function getModelRoulette(config?: RouletteConfig, dataDir?: string): ModelRoulette {
	if (!rouletteInstance && config) {
		rouletteInstance = new ModelRoulette(config, dataDir);
	}
	if (!rouletteInstance) {
		throw new Error("ModelRoulette not initialized. Provide config first.");
	}
	return rouletteInstance;
}

/**
 * Reset singleton instance (for testing)
 */
export function resetModelRoulette(): void {
	rouletteInstance = null;
}

/**
 * Format roulette statistics for display
 */
export function formatRouletteStats(stats: RouletteStatsSummary): string {
	const lines: string[] = [
		"## Model Roulette Statistics",
		"",
		`**Strategy:** ${stats.strategy}`,
		`**Total Selections:** ${stats.totalSelections}`,
		`**Success Rate:** ${(stats.successRate * 100).toFixed(1)}%`,
		"",
		"### Model Performance",
		"",
	];

	// Sort by success rate descending
	const sortedStats = [...stats.modelStats].sort((a, b) => {
		const rateA = a.selections > 0 ? a.successes / a.selections : 0;
		const rateB = b.selections > 0 ? b.successes / b.selections : 0;
		return rateB - rateA;
	});

	for (const ms of sortedStats) {
		const successRate =
			ms.selections > 0 ? ((ms.successes / ms.selections) * 100).toFixed(1) : "0.0";
		const avgTime = ms.avgResponseTime > 0 ? `${ms.avgResponseTime.toFixed(0)}ms` : "N/A";
		lines.push(
			`- **${ms.modelId}**: ${successRate}% success (${ms.selections} selections, avg ${avgTime})`,
		);
	}

	if (stats.bestModel) {
		lines.push("", `**Best Model:** ${stats.bestModel}`);
	}

	return lines.join("\n");
}

/**
 * Roulette tool for agent integration
 */
export function rouletteTool(args: {
	action: "select" | "stats" | "config" | "reset" | "add" | "remove" | "weight";
	modelId?: string;
	weight?: number;
	model?: RouletteModel;
}): string {
	const roulette = getModelRoulette();

	switch (args.action) {
		case "select": {
			const selection = roulette.selectModel();
			return `Selected model: ${selection.model.id} (${selection.reason} selection on turn ${selection.turn})`;
		}

		case "stats": {
			const stats = roulette.getStats();
			return formatRouletteStats(stats);
		}

		case "config": {
			const models = roulette.getModels();
			return `Model pool: ${models.map((m) => `${m.id}(${m.weight ?? 1})`).join(", ")}`;
		}

		case "reset": {
			roulette.resetStats();
			return "Statistics reset";
		}

		case "add": {
			if (args.model) {
				roulette.addModel(args.model);
				return `Added model: ${args.model.id}`;
			}
			return "Error: model parameter required";
		}

		case "remove": {
			if (args.modelId) {
				const removed = roulette.removeModel(args.modelId);
				return removed ? `Removed model: ${args.modelId}` : `Model not found: ${args.modelId}`;
			}
			return "Error: modelId parameter required";
		}

		case "weight": {
			if (args.modelId && args.weight !== undefined) {
				const updated = roulette.setModelWeight(args.modelId, args.weight);
				return updated
					? `Updated ${args.modelId} weight to ${args.weight}`
					: `Model not found: ${args.modelId}`;
			}
			return "Error: modelId and weight parameters required";
		}

		default:
			return `Unknown action: ${args.action}`;
	}
}
