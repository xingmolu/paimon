/**
 * Evolution Cost Prediction Module
 *
 * Predicts effort/complexity of implementing a capability before starting.
 * Inspired by task estimation patterns from SWE-agent and planning tools.
 *
 * Features:
 * - Cost estimation based on historical data and complexity factors
 * - Risk factor identification for tasks
 * - Complexity scoring (simple, moderate, complex, very-complex)
 * - Time prediction based on similar past tasks
 * - Integration with existing intelligence tools
 */

import * as fs from "node:fs";
import * as path from "node:path";

// Cost complexity levels
export type ComplexityLevel = "simple" | "moderate" | "complex" | "very-complex";

// Risk factor types
export type RiskFactorType =
	| "new-module"
	| "hook-integration"
	| "tool-chain"
	| "file-modification"
	| "dependency"
	| "testing"
	| "state-persistence"
	| "multi-file"
	| "api-integration"
	| "error-handling";

// Cost estimation factors
export interface CostFactors {
	newModule: boolean; // Creating new module vs modifying existing
	hookIntegration: boolean; // Requires hook system integration
	toolChainChanges: boolean; // Changes to tool chain
	fileCount: number; // Number of files to modify
	dependencies: number; // Number of dependencies
	testingRequired: boolean; // Requires comprehensive tests
	statePersistence: boolean; // Requires state persistence
	apiIntegration: boolean; // Requires API/tool integration
	errorHandling: boolean; // Requires complex error handling
	similarTasks: number; // Number of similar past tasks
}

// Risk factor
export interface RiskFactor {
	type: RiskFactorType;
	description: string;
	impact: number; // 1-10 scale
	mitigation?: string;
}

// Cost prediction result
export interface CostPrediction {
	taskDescription: string;
	taskType: "capability" | "reliability" | "feature";
	complexityLevel: ComplexityLevel;
	estimatedTimeMinutes: number;
	estimatedTimeRange: {
		min: number;
		max: number;
	};
	confidence: number; // 0-100
	riskFactors: RiskFactor[];
	similarTasks: string[];
	recommendations: string[];
	factors: CostFactors;
}

// Historical task data for learning
export interface HistoricalTask {
	taskDescription: string;
	taskType: "capability" | "reliability" | "feature";
	actualTimeMinutes: number;
	complexityLevel: ComplexityLevel;
	factors: CostFactors;
	success: boolean;
	errors: string[];
	date: string;
}

// Statistics for tracking
export interface EvolutionCostStats {
	predictionsTotal: number;
	predictionsByComplexity: Record<ComplexityLevel, number>;
	predictionsByType: Record<string, number>;
	averageAccuracy: number;
	accuracyHistory: number[];
	topRiskFactors: Array<{ type: RiskFactorType; count: number }>;
	recentPredictions: CostPrediction[];
}

// Configuration
export interface EvolutionCostConfig {
	enabled: boolean;
	historyFile: string;
	maxHistorySize: number;
	confidenceThreshold: number;
}

const DEFAULT_CONFIG: EvolutionCostConfig = {
	enabled: true,
	historyFile: "~/.paimon/evolution-cost-history.json",
	maxHistorySize: 200,
	confidenceThreshold: 70,
};

// Complexity weights for scoring
const COMPLEXITY_WEIGHTS: Record<string, number> = {
	newModule: 3,
	hookIntegration: 2,
	toolChainChanges: 2,
	fileCount: 0.5, // per file
	dependencies: 0.3, // per dependency
	testingRequired: 2,
	statePersistence: 1.5,
	apiIntegration: 2,
	errorHandling: 1,
};

// Base time estimates by complexity level (minutes)
const BASE_TIME_ESTIMATES: Record<ComplexityLevel, { min: number; max: number; avg: number }> = {
	simple: { min: 5, max: 15, avg: 10 },
	moderate: { min: 15, max: 30, avg: 20 },
	complex: { min: 30, max: 60, avg: 45 },
	"very-complex": { min: 60, max: 120, avg: 90 },
};

/**
 * Evolution Cost Predictor
 *
 * Main class for predicting evolution task cost/complexity
 */
export class EvolutionCostPredictor {
	private config: EvolutionCostConfig;
	private history: HistoricalTask[] = [];
	private stats: EvolutionCostStats;
	private dataDir: string;

	constructor(config?: Partial<EvolutionCostConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.stats = this.initStats();
		this.dataDir = path.join(process.env.HOME || "~", ".paimon");
		this.loadHistory();
	}

	private initStats(): EvolutionCostStats {
		return {
			predictionsTotal: 0,
			predictionsByComplexity: {
				simple: 0,
				moderate: 0,
				complex: 0,
				"very-complex": 0,
			},
			predictionsByType: {
				capability: 0,
				reliability: 0,
				feature: 0,
			},
			averageAccuracy: 0,
			accuracyHistory: [],
			topRiskFactors: [],
			recentPredictions: [],
		};
	}

	/**
	 * Load historical task data from file
	 */
	private loadHistory(): void {
		try {
			const filePath = this.getHistoryFilePath();
			if (fs.existsSync(filePath)) {
				const data = fs.readFileSync(filePath, "utf-8");
				const parsed = JSON.parse(data);
				this.history = parsed.history || [];
				this.stats = parsed.stats || this.initStats();
			}
		} catch {
			// File doesn't exist or is invalid, start fresh
			this.history = [];
			this.stats = this.initStats();
		}
	}

	/**
	 * Save historical task data to file
	 */
	private saveHistory(): void {
		try {
			const filePath = this.getHistoryFilePath();
			const dir = path.dirname(filePath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}

			// Trim history if too large
			if (this.history.length > this.config.maxHistorySize) {
				this.history = this.history.slice(-this.config.maxHistorySize);
			}

			const data = {
				history: this.history,
				stats: this.stats,
				config: this.config,
				lastUpdated: new Date().toISOString(),
			};
			fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
		} catch (error) {
			console.error("Failed to save evolution cost history:", error);
		}
	}

	private getHistoryFilePath(): string {
		return this.config.historyFile.replace("~", process.env.HOME || "~");
	}

	/**
	 * Analyze task description to extract cost factors
	 */
	analyzeTaskFactors(
		taskDescription: string,
		taskType: "capability" | "reliability" | "feature",
	): CostFactors {
		const lowerDesc = taskDescription.toLowerCase();

		// Detect factors from description
		const factors: CostFactors = {
			newModule: /create|new module|implement from scratch|build new/i.test(lowerDesc),
			hookIntegration: /hook|pretooluse|stop hook|sessionstart/i.test(lowerDesc),
			toolChainChanges: /tool chain|tool definition|new tool|modify tool/i.test(lowerDesc),
			fileCount: this.estimateFileCount(lowerDesc),
			dependencies: this.estimateDependencies(lowerDesc),
			testingRequired: /test|tests|comprehensive test|test coverage/i.test(lowerDesc),
			statePersistence: /persist|save state|state management|history/i.test(lowerDesc),
			apiIntegration: /api|tool integration|mcp|http/i.test(lowerDesc),
			errorHandling: /error handling|error recovery|error pattern|recovery/i.test(lowerDesc),
			similarTasks: this.findSimilarTasksCount(taskDescription, taskType),
		};

		return factors;
	}

	/**
	 * Estimate number of files to modify from description
	 */
	private estimateFileCount(description: string): number {
		const lowerDesc = description.toLowerCase();

		// Simple heuristic based on keywords
		if (/single file|one file|minimal/i.test(lowerDesc)) return 1;
		if (/module|manager/i.test(lowerDesc)) return 3; // Module + tool + index
		if (/tool integration|new tool/i.test(lowerDesc)) return 4; // Module + tool + index + prompt
		if (/hook|workflow|multi/i.test(lowerDesc)) return 5;
		if (/comprehensive|complete|full/i.test(lowerDesc)) return 6;

		return 2; // Default estimate
	}

	/**
	 * Estimate number of dependencies
	 */
	private estimateDependencies(description: string): number {
		const lowerDesc = description.toLowerCase();

		if (/integration|multiple tools|chain/i.test(lowerDesc)) return 3;
		if (/hook|workflow/i.test(lowerDesc)) return 2;

		return 1; // Default
	}

	/**
	 * Find count of similar past tasks from history
	 */
	private findSimilarTasksCount(
		taskDescription: string,
		taskType: "capability" | "reliability" | "feature",
	): number {
		const keywords = this.extractKeywords(taskDescription);

		return this.history.filter((task) => {
			if (task.taskType !== taskType) return false;

			const taskKeywords = this.extractKeywords(task.taskDescription);
			const overlap = keywords.filter((k) => taskKeywords.includes(k)).length;

			return overlap >= 2; // At least 2 keyword matches
		}).length;
	}

	/**
	 * Extract keywords from task description
	 */
	private extractKeywords(description: string): string[] {
		const stopWords = [
			"the",
			"a",
			"an",
			"for",
			"with",
			"and",
			"or",
			"to",
			"from",
			"in",
			"on",
			"of",
			"is",
			"are",
		];

		return description
			.toLowerCase()
			.split(/\s+|-|_|,/)
			.filter((word) => word.length > 2 && !stopWords.includes(word))
			.filter((word) => /^[a-z]+$/.test(word));
	}

	/**
	 * Calculate complexity score from factors
	 */
	calculateComplexityScore(factors: CostFactors): number {
		let score = 0;

		score += factors.newModule ? COMPLEXITY_WEIGHTS.newModule : 0;
		score += factors.hookIntegration ? COMPLEXITY_WEIGHTS.hookIntegration : 0;
		score += factors.toolChainChanges ? COMPLEXITY_WEIGHTS.toolChainChanges : 0;
		score += factors.fileCount * COMPLEXITY_WEIGHTS.fileCount;
		score += factors.dependencies * COMPLEXITY_WEIGHTS.dependencies;
		score += factors.testingRequired ? COMPLEXITY_WEIGHTS.testingRequired : 0;
		score += factors.statePersistence ? COMPLEXITY_WEIGHTS.statePersistence : 0;
		score += factors.apiIntegration ? COMPLEXITY_WEIGHTS.apiIntegration : 0;
		score += factors.errorHandling ? COMPLEXITY_WEIGHTS.errorHandling : 0;

		// Reduce complexity if we have similar past tasks (learning transfer)
		if (factors.similarTasks > 0) {
			score -= Math.min(factors.similarTasks * 0.5, 2);
		}

		return Math.max(0, score);
	}

	/**
	 * Determine complexity level from score
	 */
	determineComplexityLevel(score: number): ComplexityLevel {
		if (score <= 3) return "simple";
		if (score <= 7) return "moderate";
		if (score <= 12) return "complex";
		return "very-complex";
	}

	/**
	 * Identify risk factors for a task
	 */
	identifyRiskFactors(factors: CostFactors, taskDescription: string): RiskFactor[] {
		const risks: RiskFactor[] = [];

		if (factors.newModule) {
			risks.push({
				type: "new-module",
				description: "Creating new module requires more planning and integration",
				impact: 5,
				mitigation: "Use existing modules as templates, follow established patterns",
			});
		}

		if (factors.hookIntegration) {
			risks.push({
				type: "hook-integration",
				description: "Hook system integration requires careful handler management",
				impact: 6,
				mitigation: "Test hook execution thoroughly, ensure handlers are properly restored",
			});
		}

		if (factors.toolChainChanges) {
			risks.push({
				type: "tool-chain",
				description: "Tool chain modifications can affect other capabilities",
				impact: 5,
				mitigation: "Update prompt.ts documentation, verify all tools still work",
			});
		}

		if (factors.fileCount > 4) {
			risks.push({
				type: "multi-file",
				description: `Modifying ${factors.fileCount} files increases coordination complexity`,
				impact: factors.fileCount,
				mitigation: "Plan changes carefully, use edit tool for surgical changes",
			});
		}

		if (factors.testingRequired && factors.fileCount > 3) {
			risks.push({
				type: "testing",
				description: "Comprehensive tests across multiple files requires coordination",
				impact: 7,
				mitigation: "Create test file alongside module, test edge cases",
			});
		}

		if (factors.statePersistence) {
			risks.push({
				type: "state-persistence",
				description: "State persistence requires careful serialization handling",
				impact: 4,
				mitigation: "Strip functions before JSON save, restore from defaults on load",
			});
		}

		if (factors.apiIntegration) {
			risks.push({
				type: "api-integration",
				description: "API/tool integration requires proper interface alignment",
				impact: 5,
				mitigation: "Follow existing tool patterns, verify parameter types",
			});
		}

		if (factors.errorHandling) {
			risks.push({
				type: "error-handling",
				description: "Error handling patterns require comprehensive coverage",
				impact: 4,
				mitigation: "Use self-healing patterns, implement graceful fallbacks",
			});
		}

		if (factors.similarTasks === 0 && factors.newModule) {
			risks.push({
				type: "dependency",
				description: "No similar past tasks - no learning transfer available",
				impact: 3,
				mitigation: "Research similar patterns from competitors, plan carefully",
			});
		}

		return risks.sort((a, b) => b.impact - a.impact);
	}

	/**
	 * Estimate time based on complexity and historical data
	 */
	estimateTime(
		complexityLevel: ComplexityLevel,
		factors: CostFactors,
	): { min: number; max: number; avg: number } {
		const baseEstimate = BASE_TIME_ESTIMATES[complexityLevel];

		// Adjust based on historical data
		const similarTasks = this.history.filter((t) => t.complexityLevel === complexityLevel);

		if (similarTasks.length > 0) {
			const avgActual =
				similarTasks.reduce((sum, t) => sum + t.actualTimeMinutes, 0) / similarTasks.length;

			// Blend historical data with base estimate
			return {
				min: Math.round((baseEstimate.min + avgActual * 0.7) / 1.7),
				max: Math.round((baseEstimate.max + avgActual * 1.3) / 2.3),
				avg: Math.round((baseEstimate.avg + avgActual) / 2),
			};
		}

		return baseEstimate;
	}

	/**
	 * Find similar past tasks
	 */
	findSimilarTasks(
		taskDescription: string,
		taskType: "capability" | "reliability" | "feature",
	): HistoricalTask[] {
		const keywords = this.extractKeywords(taskDescription);

		const similar = this.history.filter((task) => {
			if (task.taskType !== taskType) return false;

			const taskKeywords = this.extractKeywords(task.taskDescription);
			const overlap = keywords.filter((k) => taskKeywords.includes(k)).length;

			return overlap >= 2;
		});

		return similar.slice(-5); // Return last 5 similar tasks
	}

	/**
	 * Generate recommendations based on prediction
	 */
	generateRecommendations(prediction: CostPrediction): string[] {
		const recommendations: string[] = [];

		// Complexity-based recommendations
		if (prediction.complexityLevel === "very-complex") {
			recommendations.push("Consider breaking into smaller subtasks");
			recommendations.push("Create checkpoint before starting");
		}

		if (prediction.complexityLevel === "complex") {
			recommendations.push("Plan implementation phases before starting");
			recommendations.push("Use plan tool for multi-step coordination");
		}

		// Risk-based recommendations
		for (const risk of prediction.riskFactors.slice(0, 3)) {
			if (risk.mitigation) {
				recommendations.push(risk.mitigation);
			}
		}

		// Similar task recommendations
		if (prediction.similarTasks.length > 0) {
			recommendations.push(
				`Reference ${prediction.similarTasks.length} similar past tasks for patterns`,
			);

			const successful = this.history.filter(
				(t) => prediction.similarTasks.includes(t.taskDescription) && t.success,
			);

			if (successful.length > 0) {
				recommendations.push("Apply patterns from similar successful tasks");
			}
		}

		// Confidence-based recommendations
		if (prediction.confidence < this.config.confidenceThreshold) {
			recommendations.push("Low confidence estimate - gather more context before starting");
		}

		return recommendations;
	}

	/**
	 * Calculate confidence based on historical data and factors
	 */
	calculateConfidence(factors: CostFactors, similarTasksCount: number): number {
		let confidence = 50; // Base confidence

		// Increase confidence if we have similar tasks
		confidence += Math.min(similarTasksCount * 10, 30);

		// Decrease confidence for new/unknown patterns
		if (factors.newModule && similarTasksCount === 0) {
			confidence -= 15;
		}

		// Increase confidence for established patterns
		if (!factors.newModule && !factors.hookIntegration && !factors.toolChainChanges) {
			confidence += 10;
		}

		// Decrease for high complexity
		const complexityScore = this.calculateComplexityScore(factors);
		if (complexityScore > 12) {
			confidence -= 10;
		}

		return Math.max(10, Math.min(95, confidence));
	}

	/**
	 * Main prediction method
	 */
	predict(
		taskDescription: string,
		taskType: "capability" | "reliability" | "feature",
	): CostPrediction {
		// Analyze factors
		const factors = this.analyzeTaskFactors(taskDescription, taskType);

		// Calculate complexity
		const complexityScore = this.calculateComplexityScore(factors);
		const complexityLevel = this.determineComplexityLevel(complexityScore);

		// Estimate time
		const timeEstimate = this.estimateTime(complexityLevel, factors);

		// Identify risks
		const riskFactors = this.identifyRiskFactors(factors, taskDescription);

		// Find similar tasks
		const similarHistoricalTasks = this.findSimilarTasks(taskDescription, taskType);
		const similarTaskDescriptions = similarHistoricalTasks.map((t) => t.taskDescription);

		// Calculate confidence
		const confidence = this.calculateConfidence(factors, factors.similarTasks);

		// Create prediction
		const prediction: CostPrediction = {
			taskDescription,
			taskType,
			complexityLevel,
			estimatedTimeMinutes: timeEstimate.avg,
			estimatedTimeRange: {
				min: timeEstimate.min,
				max: timeEstimate.max,
			},
			confidence,
			riskFactors,
			similarTasks: similarTaskDescriptions,
			recommendations: [],
			factors,
		};

		// Generate recommendations
		prediction.recommendations = this.generateRecommendations(prediction);

		// Update statistics
		this.stats.predictionsTotal++;
		this.stats.predictionsByComplexity[complexityLevel]++;
		this.stats.predictionsByType[taskType]++;

		// Track recent predictions
		this.stats.recentPredictions.push(prediction);
		if (this.stats.recentPredictions.length > 20) {
			this.stats.recentPredictions = this.stats.recentPredictions.slice(-20);
		}

		// Track top risk factors
		for (const risk of riskFactors) {
			const existing = this.stats.topRiskFactors.find((r) => r.type === risk.type);
			if (existing) {
				existing.count++;
			} else {
				this.stats.topRiskFactors.push({ type: risk.type, count: 1 });
			}
		}
		this.stats.topRiskFactors.sort((a, b) => b.count - a.count);

		this.saveHistory();

		return prediction;
	}

	/**
	 * Record actual task outcome for learning
	 */
	recordOutcome(
		taskDescription: string,
		taskType: "capability" | "reliability" | "feature",
		actualTimeMinutes: number,
		success: boolean,
		errors: string[],
	): void {
		// Find prediction for this task
		const prediction = this.stats.recentPredictions.find(
			(p) => p.taskDescription === taskDescription && p.taskType === taskType,
		);

		const complexityLevel = prediction?.complexityLevel || "moderate";

		// Create historical task record
		const historicalTask: HistoricalTask = {
			taskDescription,
			taskType,
			actualTimeMinutes,
			complexityLevel,
			factors: prediction?.factors || this.analyzeTaskFactors(taskDescription, taskType),
			success,
			errors,
			date: new Date().toISOString(),
		};

		// Add to history
		this.history.push(historicalTask);

		// Calculate accuracy if we had a prediction
		if (prediction) {
			const accuracy = Math.max(
				0,
				100 - Math.abs(prediction.estimatedTimeMinutes - actualTimeMinutes) * 2,
			);
			this.stats.accuracyHistory.push(accuracy);

			if (this.stats.accuracyHistory.length > 50) {
				this.stats.accuracyHistory = this.stats.accuracyHistory.slice(-50);
			}

			this.stats.averageAccuracy =
				this.stats.accuracyHistory.reduce((sum, a) => sum + a, 0) /
				this.stats.accuracyHistory.length;
		}

		this.saveHistory();
	}

	/**
	 * Get statistics
	 */
	getStats(): EvolutionCostStats {
		return { ...this.stats };
	}

	/**
	 * Get historical tasks
	 */
	getHistory(): HistoricalTask[] {
		return [...this.history];
	}

	/**
	 * Clear history
	 */
	clearHistory(): void {
		this.history = [];
		this.stats = this.initStats();
		this.saveHistory();
	}

	/**
	 * Get configuration
	 */
	getConfig(): EvolutionCostConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration
	 */
	updateConfig(updates: Partial<EvolutionCostConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveHistory();
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
		this.saveHistory();
	}

	/**
	 * Get complexity weights (for reference)
	 */
	getComplexityWeights(): Record<string, number> {
		return { ...COMPLEXITY_WEIGHTS };
	}

	/**
	 * Get base time estimates (for reference)
	 */
	getBaseTimeEstimates(): Record<ComplexityLevel, { min: number; max: number; avg: number }> {
		return { ...BASE_TIME_ESTIMATES };
	}

	/**
	 * Quick cost check - returns just complexity and time estimate
	 */
	quickCheck(
		taskDescription: string,
		taskType: "capability" | "reliability" | "feature",
	): { complexity: ComplexityLevel; estimatedMinutes: number; confidence: number } {
		const factors = this.analyzeTaskFactors(taskDescription, taskType);
		const score = this.calculateComplexityScore(factors);
		const complexity = this.determineComplexityLevel(score);
		const time = this.estimateTime(complexity, factors);
		const confidence = this.calculateConfidence(factors, factors.similarTasks);

		return {
			complexity,
			estimatedMinutes: time.avg,
			confidence,
		};
	}
}

// Singleton instance
let instance: EvolutionCostPredictor | null = null;

/**
 * Get singleton instance of EvolutionCostPredictor
 */
export function getEvolutionCostPredictor(): EvolutionCostPredictor {
	if (!instance) {
		instance = new EvolutionCostPredictor();
	}
	return instance;
}

/**
 * Reset singleton instance
 */
export function resetEvolutionCostPredictor(): void {
	instance = null;
}
