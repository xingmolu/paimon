/**
 * Unified Evolution Intelligence Module
 *
 * Integrates all intelligence tools (taskPredictor, patternMiner, errorPatterns, rag)
 * into a unified system for smarter task selection and self-evolution decisions.
 *
 * Benefits:
 * - Single entry point for all intelligence-based recommendations
 * - Combined scoring from multiple sources for better predictions
 * - Unified context enrichment from RAG + pattern mining
 * - Error risk assessment with known solutions
 *
 * Inspired by Claude Code's unified intelligence approach and OpenHands' ToM integration.
 */

import { type ErrorPattern, getErrorPatternLearner } from "./error-patterns.js";
import {
	type ComplexityLevel,
	type CostPrediction,
	getEvolutionCostPredictor,
} from "./evolution-cost.js";
import {
	type EvolutionPattern,
	type PatternRecommendation,
	getPatternMiner,
} from "./pattern-miner.js";
import { RagModule, type RagSearchResult } from "./rag.js";
import {
	type PredictorStats,
	type TaskContext,
	type TaskPrediction,
	getTaskPredictor,
} from "./task-predictor.js";

// Re-export TaskContext for convenience
export type { TaskContext } from "./task-predictor.js";

/**
 * Task Decision Score - Combines cost and success for smarter decisions.
 */
export interface TaskDecisionScore {
	// Overall score 0-100 (higher = better decision)
	score: number;
	// Cost component (0-100, lower cost = higher score component)
	costScore: number;
	// Success component (0-100)
	successScore: number;
	// Recommendation based on score
	recommendation: "highly-recommended" | "recommended" | "consider" | "avoid";
	// Reasoning for the score
	reasoning: string;
}

/**
 * Unified intelligence recommendation combining all sources.
 */
export interface UnifiedRecommendation {
	// Task prediction from TaskSuccessPredictor
	prediction: TaskPrediction;
	// Cost prediction from EvolutionCostPredictor
	costPrediction: CostPrediction;
	// Task decision score combining cost and success
	decisionScore: TaskDecisionScore;
	// Pattern-based recommendations from PatternMiner
	patternRecommendations: PatternRecommendation[];
	// Error risk assessment from ErrorPatternLearner
	errorRisks: ErrorRisk[];
	// Relevant context from RAG
	relevantContext: RagSearchResult[];
	// Combined confidence score (0-100)
	combinedConfidence: number;
	// Overall recommendation
	overallRecommendation: string;
	// Suggested approach
	suggestedApproach: string;
	// Key risks to watch
	keyRisks: string[];
	// Key opportunities
	keyOpportunities: string[];
}

/**
 * Error risk with potential solutions.
 */
export interface ErrorRisk {
	errorType: string;
	description: string;
	likelihood: number; // 0-100
	solutions: string[];
}

/**
 * Intelligence analysis result.
 */
export interface IntelligenceAnalysis {
	taskType: string;
	recommendations: UnifiedRecommendation;
	timestamp: string;
	sourcesUsed: string[];
}

/**
 * Intelligence stats combining all modules.
 */
export interface IntelligenceStats {
	predictorStats: PredictorStats;
	costStats: {
		totalPredictions: number;
		averageAccuracy: number;
		byComplexity: Record<ComplexityLevel, number>;
	};
	patternStats: {
		totalPatterns: number;
		averageSuccessRate: number;
	};
	errorPatternStats: {
		totalPatterns: number;
		totalOccurrences: number;
	};
	ragStats: {
		totalDocuments: number;
		uniqueTerms: number;
	};
	combinedAccuracy: number;
}

/**
 * Evolution Intelligence - Unified system for task selection intelligence.
 */
export class EvolutionIntelligence {
	private predictor = getTaskPredictor();
	private costPredictor = getEvolutionCostPredictor();
	private patternMiner = getPatternMiner();
	private errorLearner = getErrorPatternLearner();
	private ragModule = new RagModule();

	/**
	 * Calculate task decision score combining cost and success.
	 */
	private calculateDecisionScore(
		costPrediction: CostPrediction,
		successProbability: number,
	): TaskDecisionScore {
		// Convert cost to score component (lower cost = higher score)
		// simple: 100-80, moderate: 80-60, complex: 60-40, very-complex: 40-20
		const costScoreMap: Record<ComplexityLevel, number> = {
			simple: 95,
			moderate: 70,
			complex: 50,
			"very-complex": 30,
		};

		const costScore = costScoreMap[costPrediction.complexityLevel];
		const successScore = Math.round(successProbability * 100);

		// Weighted combination: success is more important (60%) than cost (40%)
		const score = Math.round(successScore * 0.6 + costScore * 0.4);

		// Determine recommendation based on score
		let recommendation: TaskDecisionScore["recommendation"];
		let reasoning: string;

		if (score >= 75) {
			recommendation = "highly-recommended";
			reasoning = `High success probability (${successScore}%) with reasonable cost (${costPrediction.complexityLevel})`;
		} else if (score >= 55) {
			recommendation = "recommended";
			reasoning = `Good balance of success (${successScore}%) and cost (${costPrediction.complexityLevel})`;
		} else if (score >= 35) {
			recommendation = "consider";
			reasoning = `Moderate success (${successScore}%) with significant cost (${costPrediction.complexityLevel}). Consider alternatives.`;
		} else {
			recommendation = "avoid";
			reasoning = `Low success (${successScore}%) with high cost (${costPrediction.complexityLevel}). Not recommended.`;
		}

		// Adjust reasoning based on risk factors
		if (costPrediction.riskFactors.length > 2) {
			reasoning += ` Has ${costPrediction.riskFactors.length} risk factors.`;
		}

		return {
			score,
			costScore,
			successScore,
			recommendation,
			reasoning,
		};
	}

	/**
	 * Get unified recommendations for a task context.
	 */
	analyze(context: TaskContext): UnifiedRecommendation {
		// 1. Get task prediction
		const prediction = this.predictor.predict(context);

		// 2. Get cost prediction
		const costPrediction = this.costPredictor.predict(context.taskDescription, context.taskType);

		// 3. Calculate decision score combining cost and success
		const decisionScore = this.calculateDecisionScore(
			costPrediction,
			prediction.successProbability,
		);

		// 4. Get pattern recommendations
		const patternRecommendations = this.patternMiner.getRecommendations({
			taskType: context.taskType,
			skillsAvailable: context.skillsAvailable,
			taskDescription: context.taskDescription,
		});

		// 5. Analyze error risks
		const errorRisks = this.analyzeErrorRisks(context);

		// 6. Get relevant context from RAG
		const relevantContext = this.ragModule.search({
			query: context.taskDescription,
			maxResults: 3,
			types: ["learning", "journal", "reflection"],
			includeSnippet: true,
		});

		// 7. Calculate combined confidence
		const combinedConfidence = this.calculateCombinedConfidence(
			prediction,
			costPrediction,
			patternRecommendations,
			errorRisks,
			relevantContext,
		);

		// 8. Generate overall recommendation
		const overallRecommendation = this.generateOverallRecommendation(
			prediction,
			costPrediction,
			decisionScore,
			patternRecommendations,
			errorRisks,
		);

		// 9. Determine suggested approach
		const suggestedApproach = this.determineSuggestedApproach(
			context,
			prediction,
			costPrediction,
			patternRecommendations,
		);

		// 10. Extract key risks and opportunities
		const keyRisks = this.extractKeyRisks(prediction, costPrediction, errorRisks);
		const keyOpportunities = this.extractKeyOpportunities(
			prediction,
			costPrediction,
			patternRecommendations,
			relevantContext,
		);

		return {
			prediction,
			costPrediction,
			decisionScore,
			patternRecommendations,
			errorRisks,
			relevantContext,
			combinedConfidence,
			overallRecommendation,
			suggestedApproach,
			keyRisks,
			keyOpportunities,
		};
	}

	/**
	 * Analyze error risks based on historical patterns.
	 */
	private analyzeErrorRisks(context: TaskContext): ErrorRisk[] {
		const risks: ErrorRisk[] = [];

		// Get common error patterns for this task type
		const patterns = this.patternMiner.getPatterns("error-avoidance");
		const typePatterns = this.errorLearner.getPatterns();

		// Check for high complexity - more errors likely
		if (context.complexity === "high") {
			const typeErrors = typePatterns.filter((p) => p.occurrences > 0);
			for (const pattern of typeErrors.slice(0, 3)) {
				risks.push({
					errorType: pattern.type,
					description: pattern.description,
					likelihood: Math.min(70 + pattern.occurrences * 2, 90),
					solutions: [pattern.solution],
				});
			}
		}

		// Check for missing skills - specific error types
		const missingSkills = (_prediction: TaskPrediction) => {
			const recommended =
				this.predictor.getPatterns().find((p) => p.taskType === context.taskType)
					?.successfulSkills || [];
			return recommended.filter(
				(s) => !context.skillsAvailable.some((a) => a.toLowerCase().includes(s.toLowerCase())),
			);
		};

		const missing = missingSkills(this.predictor.predict(context));
		if (missing.length > 0) {
			// Look for error patterns associated with missing skills
			for (const skill of missing.slice(0, 2)) {
				const relatedPatterns = typePatterns.filter((p) =>
					p.solution.toLowerCase().includes(skill.toLowerCase()),
				);
				if (relatedPatterns.length > 0) {
					risks.push({
						errorType: relatedPatterns[0].type,
						description: `Missing ${skill} skill increases risk of ${relatedPatterns[0].description}`,
						likelihood: 60,
						solutions: relatedPatterns.map((p) => p.solution),
					});
				}
			}
		}

		return risks.slice(0, 5);
	}

	/**
	 * Calculate combined confidence from all sources.
	 */
	private calculateCombinedConfidence(
		prediction: TaskPrediction,
		costPrediction: CostPrediction,
		patterns: PatternRecommendation[],
		errorRisks: ErrorRisk[],
		context: RagSearchResult[],
	): number {
		// Base confidence from prediction
		let base = prediction.confidence;

		// Factor in cost confidence
		base = Math.round(base * 0.6 + costPrediction.confidence * 0.4);

		// Boost from pattern matches
		if (patterns.length > 0) {
			const patternConfidence =
				patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
			base = Math.round(base * 0.6 + patternConfidence * 0.4);
		}

		// Boost from relevant context
		if (context.length > 0) {
			base = Math.min(100, base + context.length * 3);
		}

		// Penalty from error risks
		const avgErrorRisk =
			errorRisks.length > 0
				? errorRisks.reduce((sum, r) => sum + r.likelihood, 0) / errorRisks.length
				: 0;
		base = Math.max(20, base - Math.round(avgErrorRisk * 0.1));

		return Math.min(100, Math.max(0, base));
	}

	/**
	 * Generate overall recommendation text.
	 */
	private generateOverallRecommendation(
		prediction: TaskPrediction,
		costPrediction: CostPrediction,
		decisionScore: TaskDecisionScore,
		patterns: PatternRecommendation[],
		errorRisks: ErrorRisk[],
	): string {
		const successPercent = Math.round(prediction.successProbability * 100);
		const costEmoji =
			costPrediction.complexityLevel === "simple"
				? "⚡"
				: costPrediction.complexityLevel === "moderate"
					? "⏱️"
					: costPrediction.complexityLevel === "complex"
						? "🔨"
						: "🏗️";

		// Start with decision score recommendation
		let rec = `${decisionScore.recommendation.toUpperCase().replace("-", " ")}: ${decisionScore.reasoning}`;

		// Add details
		rec += `\n\n**Decision Score:** ${decisionScore.score}/100`;
		rec += ` (Success: ${decisionScore.successScore}%, Cost: ${decisionScore.costScore}%)`;
		rec += `\n**Complexity:** ${costEmoji} ${costPrediction.complexityLevel} (~${costPrediction.estimatedTimeMinutes}m)`;

		if (successPercent >= 80 && errorRisks.length === 0) {
			rec += "\n\nHigh confidence task. Proceed with standard approach.";
		} else if (successPercent < 50 || decisionScore.recommendation === "avoid") {
			rec += "\n\nLow confidence task. Consider breaking down or acquiring missing skills.";
		} else if (errorRisks.length > 2) {
			rec += `\n\nWarning: ${errorRisks.length} error risks detected. Apply suggested solutions.`;
		}

		return rec;
	}

	/**
	 * Determine suggested approach based on all intelligence.
	 */
	private determineSuggestedApproach(
		context: TaskContext,
		prediction: TaskPrediction,
		costPrediction: CostPrediction,
		patterns: PatternRecommendation[],
	): string {
		// If very complex, suggest breaking down
		if (costPrediction.complexityLevel === "very-complex") {
			return "Break into smaller subtasks. Use checkpoints and plan tool. Consider pair-coding with specialized agents.";
		}

		// If complex, suggest planning phase
		if (costPrediction.complexityLevel === "complex") {
			return "Use plan-architecture skill first, then implement step-by-step with verification at each stage.";
		}

		// If patterns available, use their approach
		if (patterns.length > 0 && patterns[0].suggestedApproach) {
			return patterns[0].suggestedApproach;
		}

		// If prediction has recommended skills, use those
		if (prediction.recommendedSkills.length > 0) {
			return `Use skills: ${prediction.recommendedSkills.slice(0, 3).join(", ")}. Follow standard evolution workflow.`;
		}

		// Default approach
		return "Follow standard evolution workflow: context gathering, implementation, verification.";
	}

	/**
	 * Extract key risks from prediction and error analysis.
	 */
	private extractKeyRisks(
		prediction: TaskPrediction,
		costPrediction: CostPrediction,
		errorRisks: ErrorRisk[],
	): string[] {
		const risks: string[] = [];

		// From cost prediction
		for (const risk of costPrediction.riskFactors.slice(0, 2)) {
			risks.push(`${risk.type}: ${risk.description}`);
		}

		// From prediction
		for (const risk of prediction.riskFactors.slice(0, 2)) {
			risks.push(risk);
		}

		// From error analysis
		for (const error of errorRisks.slice(0, 2)) {
			risks.push(`${error.errorType}: ${error.description}`);
		}

		return risks.slice(0, 5);
	}

	/**
	 * Extract key opportunities from intelligence.
	 */
	private extractKeyOpportunities(
		prediction: TaskPrediction,
		costPrediction: CostPrediction,
		patterns: PatternRecommendation[],
		context: RagSearchResult[],
	): string[] {
		const opportunities: string[] = [];

		// Pattern opportunities
		if (patterns.length > 0) {
			opportunities.push(`Apply ${patterns.length} successful patterns from history`);
		}

		// Similar tasks opportunity
		if (costPrediction.similarTasks.length > 0) {
			opportunities.push(`${costPrediction.similarTasks.length} similar past tasks for reference`);
		}

		// Context opportunities
		if (context.length > 0) {
			const docTypes = context.map((c) => c.document.type);
			if (docTypes.includes("learning")) {
				opportunities.push("Learn from past similar learnings");
			}
			if (docTypes.includes("journal")) {
				opportunities.push("Reference past successful implementations");
			}
		}

		// Similar task opportunities
		if (prediction.similarSuccessfulTasks.length > 0) {
			opportunities.push(
				`${prediction.similarSuccessfulTasks.length} similar successful tasks to learn from`,
			);
		}

		return opportunities;
	}

	/**
	 * Get combined statistics from all intelligence modules.
	 */
	getStats(): IntelligenceStats {
		const predictorStats = this.predictor.getStats();
		const costStats = this.costPredictor.getStats();
		const patternStats = this.patternMiner.getStats();
		const errorStats = this.errorLearner.getStats();
		const ragStats = this.ragModule.getStats();

		// Calculate combined accuracy
		const combinedAccuracy = Math.round(
			predictorStats.accuracyRate * 0.3 +
				costStats.averageAccuracy * 0.2 +
				patternStats.averageSuccessRate * 0.3 +
				(100 - Math.min(errorStats.totalOccurrences * 5, 50)) * 0.2,
		);

		return {
			predictorStats,
			costStats: {
				totalPredictions: costStats.predictionsTotal,
				averageAccuracy: costStats.averageAccuracy,
				byComplexity: costStats.predictionsByComplexity,
			},
			patternStats: {
				totalPatterns: patternStats.totalPatterns,
				averageSuccessRate: patternStats.averageSuccessRate,
			},
			errorPatternStats: {
				totalPatterns: errorStats.totalPatterns,
				totalOccurrences: errorStats.totalOccurrences,
			},
			ragStats: {
				totalDocuments: ragStats.totalDocuments,
				uniqueTerms: ragStats.uniqueTerms,
			},
			combinedAccuracy,
		};
	}

	/**
	 * Refresh all intelligence modules.
	 */
	refresh(): void {
		this.predictor.refresh();
		this.costPredictor = getEvolutionCostPredictor();
		this.patternMiner.refresh();
		this.ragModule.initialize();
	}

	/**
	 * Format recommendation as markdown.
	 */
	formatRecommendation(rec: UnifiedRecommendation): string {
		const decisionEmoji =
			rec.decisionScore.recommendation === "highly-recommended"
				? "🌟"
				: rec.decisionScore.recommendation === "recommended"
					? "✅"
					: rec.decisionScore.recommendation === "consider"
						? "⚠️"
						: "❌";

		const costEmoji =
			rec.costPrediction.complexityLevel === "simple"
				? "⚡"
				: rec.costPrediction.complexityLevel === "moderate"
					? "⏱️"
					: rec.costPrediction.complexityLevel === "complex"
						? "🔨"
						: "🏗️";

		const lines: string[] = [
			"## Unified Evolution Intelligence Recommendation",
			"",
			`**Decision Score:** ${decisionEmoji} ${rec.decisionScore.score}/100`,
			`**Recommendation:** ${rec.decisionScore.recommendation.toUpperCase().replace("-", " ")}`,
			"",
			"### Decision Breakdown",
			"| Factor | Score | Value |",
			"|--------|-------|-------|",
			`| Success | ${rec.decisionScore.successScore}/100 | ${Math.round(rec.prediction.successProbability * 100)}% probability |`,
			`| Cost | ${rec.decisionScore.costScore}/100 | ${costEmoji} ${rec.costPrediction.complexityLevel} (~${rec.costPrediction.estimatedTimeMinutes}m) |`,
			"",
			`**Combined Confidence:** ${rec.combinedConfidence}%`,
			`**Estimated Time:** ~${rec.costPrediction.estimatedTimeRange.min}-${rec.costPrediction.estimatedTimeRange.max}m`,
			"",
			"### Overall Recommendation",
			rec.overallRecommendation,
			"",
			"### Suggested Approach",
			rec.suggestedApproach,
			"",
		];

		if (rec.keyRisks.length > 0) {
			lines.push("### Key Risks");
			for (const risk of rec.keyRisks) {
				lines.push(`- ⚠️ ${risk}`);
			}
			lines.push("");
		}

		if (rec.keyOpportunities.length > 0) {
			lines.push("### Key Opportunities");
			for (const opp of rec.keyOpportunities) {
				lines.push(`- ✨ ${opp}`);
			}
			lines.push("");
		}

		if (rec.patternRecommendations.length > 0) {
			lines.push("### Pattern Recommendations");
			for (const pattern of rec.patternRecommendations.slice(0, 3)) {
				lines.push(`- ${pattern.pattern.description} (${pattern.confidence}% confidence)`);
			}
			lines.push("");
		}

		if (rec.errorRisks.length > 0) {
			lines.push("### Error Risk Assessment");
			for (const error of rec.errorRisks) {
				lines.push(`- ${error.errorType}: ${error.likelihood}% likelihood`);
				if (error.solutions.length > 0) {
					lines.push(`  - Solution: ${error.solutions[0]}`);
				}
			}
			lines.push("");
		}

		if (rec.relevantContext.length > 0) {
			lines.push("### Relevant Past Context");
			for (const ctx of rec.relevantContext.slice(0, 2)) {
				lines.push(`- ${ctx.document.title} (${ctx.document.type})`);
				lines.push(`  > ${ctx.snippet.slice(0, 100)}...`);
			}
			lines.push("");
		}

		return lines.join("\n");
	}

	/**
	 * Format stats as markdown.
	 */
	formatStats(stats: IntelligenceStats): string {
		const lines: string[] = [
			"## Evolution Intelligence Statistics",
			"",
			`**Combined Accuracy:** ${stats.combinedAccuracy}%`,
			"",
			"### Predictor Stats",
			`- Total Predictions: ${stats.predictorStats.totalPredictions}`,
			`- Accuracy Rate: ${stats.predictorStats.accuracyRate}%`,
			"",
			"### Cost Prediction Stats",
			`- Total Predictions: ${stats.costStats.totalPredictions}`,
			`- Average Accuracy: ${stats.costStats.averageAccuracy}%`,
			`- Simple: ${stats.costStats.byComplexity.simple}`,
			`- Moderate: ${stats.costStats.byComplexity.moderate}`,
			`- Complex: ${stats.costStats.byComplexity.complex}`,
			`- Very Complex: ${stats.costStats.byComplexity["very-complex"]}`,
			"",
			"### Pattern Stats",
			`- Total Patterns: ${stats.patternStats.totalPatterns}`,
			`- Average Success Rate: ${stats.patternStats.averageSuccessRate}%`,
			"",
			"### Error Pattern Stats",
			`- Total Patterns: ${stats.errorPatternStats.totalPatterns}`,
			`- Total Occurrences: ${stats.errorPatternStats.totalOccurrences}`,
			"",
			"### RAG Stats",
			`- Total Documents: ${stats.ragStats.totalDocuments}`,
			`- Unique Terms: ${stats.ragStats.uniqueTerms}`,
		];

		return lines.join("\n");
	}
}

// Singleton instance
let intelligenceInstance: EvolutionIntelligence | null = null;

/**
 * Get singleton intelligence instance.
 */
export function getEvolutionIntelligence(): EvolutionIntelligence {
	if (!intelligenceInstance) {
		intelligenceInstance = new EvolutionIntelligence();
	}
	return intelligenceInstance;
}
