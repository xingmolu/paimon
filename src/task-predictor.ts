/**
 * Task Success Predictor - Predicts task success likelihood before starting
 *
 * Inspired by pattern mining and meta-analysis patterns from SWE-agent research.
 * Uses historical session data from MEMORY.md scorecard to predict outcomes.
 */

import { isPositiveScorecardResult, parseScorecardRows } from "./scorecard.js";

export interface TaskPrediction {
	successProbability: number; // 0-1 probability of success
	confidence: number; // 0-100 confidence in prediction
	estimatedTime: number; // Estimated minutes to complete
	riskFactors: string[]; // Factors that increase failure risk
	recommendedSkills: string[]; // Skills likely to help
	similarSuccessfulTasks: string[]; // Similar past successes
	similarFailedTasks: string[]; // Similar past failures
}

export interface TaskContext {
	taskDescription: string;
	taskType: "capability" | "reliability" | "feature";
	skillsAvailable: string[];
	complexity?: "low" | "medium" | "high";
}

export interface HistoricalPattern {
	taskType: string;
	avgSuccessRate: number;
	avgTime: number;
	commonErrors: string[];
	successfulSkills: string[];
	failedSkills: string[];
}

export interface PredictionFactors {
	typeSuccessRate: number;
	skillMatchScore: number;
	complexityPenalty: number;
	timeEstimate: number;
	errorRisk: number;
}

export interface PredictorStats {
	totalPredictions: number;
	accuratePredictions: number;
	accuracyRate: number;
	predictionsByType: Record<string, { total: number; accurate: number }>;
}

interface SessionEntry {
	date: string;
	taskType: string;
	taskDescription: string;
	time: string;
	firstTry: string;
	errors: string;
	rework: string;
	impact: string;
	skillsUsed: string;
}

export interface TaskSuccessPredictorOptions {
	memoryPath?: string;
}

/**
 * TaskSuccessPredictor class for predicting task outcomes
 */
export class TaskSuccessPredictor {
	private sessions: SessionEntry[] = [];
	private patterns: HistoricalPattern[] = [];
	private predictions: TaskPrediction[] = [];
	private stats: PredictorStats = {
		totalPredictions: 0,
		accuratePredictions: 0,
		accuracyRate: 0,
		predictionsByType: {},
	};
	private readonly memoryPath: string;

	constructor(options: TaskSuccessPredictorOptions = {}) {
		this.memoryPath = options.memoryPath || "MEMORY.md";
		this.loadSessions();
		this.minePatterns();
	}

	/**
	 * Load sessions from MEMORY.md scorecard
	 */
	private loadSessions(): void {
		try {
			const fs = require("node:fs");
			if (!fs.existsSync(this.memoryPath)) {
				return;
			}

			const content = fs.readFileSync(this.memoryPath, "utf-8");
			const rows = parseScorecardRows(content);

			this.sessions = rows.map((row) => ({
				date: row.date,
				taskType: row.taskType,
				taskDescription: row.description,
				time: row.time,
				firstTry: row.firstTry || row.result || "",
				errors: row.errors || "none",
				rework: row.rework || "",
				impact: row.impact || "",
				skillsUsed: row.skillsUsed || "",
			}));
		} catch {
			// Ignore errors, use empty sessions
		}
	}

	/**
	 * Mine historical patterns from sessions
	 */
	private minePatterns(): void {
		// Type patterns
		const byType: Record<
			string,
			{ successes: number; failures: number; times: number[]; errors: string[] }
		> = {};

		for (const session of this.sessions) {
			const type = session.taskType;
			if (!byType[type]) {
				byType[type] = { successes: 0, failures: 0, times: [], errors: [] };
			}

			if (isPositiveScorecardResult(session.firstTry)) {
				byType[type].successes++;
			} else {
				byType[type].failures++;
			}

			// Parse time
			const timeMatch = session.time.match(/~(\d+)m/);
			if (timeMatch) {
				byType[type].times.push(Number.parseInt(timeMatch[1], 10));
			}

			// Track errors
			if (session.errors && session.errors !== "none") {
				byType[type].errors.push(session.errors);
			}
		}

		// Build patterns
		for (const [type, data] of Object.entries(byType)) {
			const total = data.successes + data.failures;
			const avgTime =
				data.times.length > 0
					? Math.round(data.times.reduce((a, b) => a + b, 0) / data.times.length)
					: 15;

			this.patterns.push({
				taskType: type,
				avgSuccessRate: total > 0 ? data.successes / total : 0.5,
				avgTime,
				commonErrors: this.extractCommonErrors(data.errors),
				successfulSkills: this.extractSuccessfulSkills(type),
				failedSkills: this.extractFailedSkills(type),
			});
		}
	}

	/**
	 * Extract most common error patterns
	 */
	private extractCommonErrors(errors: string[]): string[] {
		const counts: Record<string, number> = {};
		for (const error of errors) {
			const normalized = error.toLowerCase().trim();
			counts[normalized] = (counts[normalized] || 0) + 1;
		}

		return Object.entries(counts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([error]) => error);
	}

	/**
	 * Extract skills from successful sessions of a type
	 */
	private extractSuccessfulSkills(type: string): string[] {
		const skillCounts: Record<string, number> = {};

		for (const session of this.sessions) {
			if (session.taskType !== type || !isPositiveScorecardResult(session.firstTry)) {
				continue;
			}

			const skills = session.skillsUsed
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean);
			for (const skill of skills) {
				skillCounts[skill] = (skillCounts[skill] || 0) + 1;
			}
		}

		return Object.entries(skillCounts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([skill]) => skill);
	}

	/**
	 * Extract skills from failed sessions of a type
	 */
	private extractFailedSkills(type: string): string[] {
		const skillCounts: Record<string, number> = {};

		for (const session of this.sessions) {
			if (session.taskType !== type || isPositiveScorecardResult(session.firstTry)) {
				continue;
			}

			const skills = session.skillsUsed
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean);
			for (const skill of skills) {
				skillCounts[skill] = (skillCounts[skill] || 0) + 1;
			}
		}

		return Object.entries(skillCounts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3)
			.map(([skill]) => skill);
	}

	/**
	 * Predict task success probability
	 */
	predict(context: TaskContext): TaskPrediction {
		// Calculate base probability from type
		const typePattern = this.patterns.find((p) => p.taskType === context.taskType);
		const typeSuccessRate = typePattern?.avgSuccessRate ?? 0.5;

		// Calculate skill match score
		const recommendedSkills = typePattern?.successfulSkills ?? [];
		const skillMatchScore = this.calculateSkillMatch(context.skillsAvailable, recommendedSkills);

		// Calculate complexity penalty
		const complexityPenalty = this.getComplexityPenalty(context.complexity);

		// Calculate error risk
		const errorRisk = this.calculateErrorRisk(typePattern?.commonErrors ?? []);

		// Estimate time
		let estimatedTime = typePattern?.avgTime ?? 15;
		if (context.complexity === "high") {
			estimatedTime *= 2;
		} else if (context.complexity === "low") {
			estimatedTime *= 0.5;
		}

		// Calculate final probability
		const successProbability = Math.max(
			0,
			Math.min(1, typeSuccessRate + skillMatchScore * 0.2 - complexityPenalty - errorRisk * 0.1),
		);

		// Calculate confidence
		const confidence = Math.round(
			(typePattern ? 80 : 50) + skillMatchScore * 10 + (context.skillsAvailable.length > 3 ? 5 : 0),
		);

		// Find similar tasks
		const similarSuccessfulTasks = this.findSimilarTasks(context, true);
		const similarFailedTasks = this.findSimilarTasks(context, false);

		// Identify risk factors
		const riskFactors = this.identifyRiskFactors(context, typePattern);

		// Track prediction
		this.predictions.push({
			successProbability,
			confidence,
			estimatedTime,
			riskFactors,
			recommendedSkills,
			similarSuccessfulTasks,
			similarFailedTasks,
		});
		this.stats.totalPredictions++;

		if (!this.stats.predictionsByType[context.taskType]) {
			this.stats.predictionsByType[context.taskType] = { total: 0, accurate: 0 };
		}
		this.stats.predictionsByType[context.taskType].total++;

		return {
			successProbability,
			confidence,
			estimatedTime,
			riskFactors,
			recommendedSkills,
			similarSuccessfulTasks,
			similarFailedTasks,
		};
	}

	/**
	 * Calculate skill match score (0-1)
	 */
	private calculateSkillMatch(available: string[], recommended: string[]): number {
		if (recommended.length === 0) {
			return 0.5;
		}

		const matches = available.filter((s) =>
			recommended.some((r) => s.toLowerCase().includes(r.toLowerCase())),
		);

		return matches.length / recommended.length;
	}

	/**
	 * Get complexity penalty
	 */
	private getComplexityPenalty(complexity?: string): number {
		switch (complexity) {
			case "high":
				return 0.2;
			case "medium":
				return 0.1;
			case "low":
				return 0;
			default:
				return 0.05; // Unknown complexity
		}
	}

	/**
	 * Calculate error risk from common errors
	 */
	private calculateErrorRisk(commonErrors: string[]): number {
		// More common errors = higher risk
		return Math.min(commonErrors.length * 0.05, 0.2);
	}

	/**
	 * Find similar tasks from history
	 */
	private findSimilarTasks(context: TaskContext, successful: boolean): string[] {
		const keywords = context.taskDescription.toLowerCase().split(/\s+/);
		const results: string[] = [];

		for (const session of this.sessions) {
			if (session.taskType !== context.taskType) {
				continue;
			}

			const isSuccessful = isPositiveScorecardResult(session.firstTry);
			if (isSuccessful !== successful) {
				continue;
			}

			// Check keyword overlap
			const descWords = session.taskDescription.toLowerCase().split(/\s+/);
			const overlap = keywords.filter((k) => descWords.some((d) => d.includes(k) || k.includes(d)));

			if (overlap.length >= 2) {
				results.push(session.taskDescription);
			}
		}

		return results.slice(0, 3);
	}

	/**
	 * Identify risk factors for a task
	 */
	private identifyRiskFactors(context: TaskContext, pattern?: HistoricalPattern): string[] {
		const risks: string[] = [];

		// Low skill availability
		if (context.skillsAvailable.length < 2) {
			risks.push("Limited skill availability");
		}

		// Missing recommended skills
		if (pattern?.successfulSkills) {
			const missingSkills = pattern.successfulSkills.filter(
				(s) => !context.skillsAvailable.some((a) => a.toLowerCase().includes(s.toLowerCase())),
			);
			if (missingSkills.length > 0) {
				risks.push(`Missing recommended skills: ${missingSkills.slice(0, 2).join(", ")}`);
			}
		}

		// High complexity
		if (context.complexity === "high") {
			risks.push("High complexity task");
		}

		// Common error patterns
		if (pattern?.commonErrors && pattern.commonErrors.length > 0) {
			risks.push(`Potential errors: ${pattern.commonErrors.slice(0, 2).join(", ")}`);
		}

		// Low historical success rate
		if (pattern && pattern.avgSuccessRate < 0.7) {
			risks.push(`Low historical success rate (${Math.round(pattern.avgSuccessRate * 100)}%)`);
		}

		return risks;
	}

	/**
	 * Record actual outcome after task completion
	 */
	recordOutcome(context: TaskContext, actualSuccess: boolean, actualTime: number): void {
		// Find matching prediction
		const lastPrediction = this.predictions[this.predictions.length - 1];
		if (!lastPrediction) {
			return;
		}

		// Check accuracy (within 20% threshold)
		const predictedSuccess = lastPrediction.successProbability > 0.5;
		const isAccurate = predictedSuccess === actualSuccess;

		if (isAccurate) {
			this.stats.accuratePredictions++;
			if (this.stats.predictionsByType[context.taskType]) {
				this.stats.predictionsByType[context.taskType].accurate++;
			}
		}

		// Update accuracy rate
		this.stats.accuracyRate =
			this.stats.totalPredictions > 0
				? this.stats.accuratePredictions / this.stats.totalPredictions
				: 0;
	}

	/**
	 * Get prediction statistics
	 */
	getStats(): PredictorStats {
		return {
			...this.stats,
			accuracyRate: Math.round(this.stats.accuracyRate * 100),
		};
	}

	/**
	 * Get historical patterns
	 */
	getPatterns(): HistoricalPattern[] {
		return this.patterns;
	}

	/**
	 * Refresh patterns from MEMORY.md
	 */
	refresh(): void {
		this.sessions = [];
		this.patterns = [];
		this.loadSessions();
		this.minePatterns();
	}

	/**
	 * Format prediction as markdown
	 */
	formatPrediction(prediction: TaskPrediction): string {
		const successPercent = Math.round(prediction.successProbability * 100);
		const successEmoji = successPercent >= 70 ? "✅" : successPercent >= 50 ? "⚠️" : "❌";

		let output = "## Task Success Prediction\n\n";
		output += `**Success Probability:** ${successPercent}% ${successEmoji}\n`;
		output += `**Confidence:** ${prediction.confidence}%\n`;
		output += `**Estimated Time:** ~${prediction.estimatedTime}m\n\n`;

		if (prediction.riskFactors.length > 0) {
			output += "### Risk Factors\n";
			for (const risk of prediction.riskFactors) {
				output += `- ${risk}\n`;
			}
			output += "\n";
		}

		if (prediction.recommendedSkills.length > 0) {
			output += "### Recommended Skills\n";
			for (const skill of prediction.recommendedSkills) {
				output += `- ${skill}\n`;
			}
			output += "\n";
		}

		if (prediction.similarSuccessfulTasks.length > 0) {
			output += "### Similar Successful Tasks\n";
			for (const task of prediction.similarSuccessfulTasks) {
				output += `- ${task}\n`;
			}
			output += "\n";
		}

		if (prediction.similarFailedTasks.length > 0) {
			output += "### Similar Failed Tasks\n";
			output += "(Learn from these failures)\n";
			for (const task of prediction.similarFailedTasks) {
				output += `- ${task}\n`;
			}
			output += "\n";
		}

		return output;
	}
}

// Singleton instance
let predictorInstance: TaskSuccessPredictor | null = null;

/**
 * Get singleton predictor instance
 */
export function getTaskPredictor(): TaskSuccessPredictor {
	if (!predictorInstance) {
		predictorInstance = new TaskSuccessPredictor();
	}
	return predictorInstance;
}
