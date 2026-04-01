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

import { ErrorPattern, getErrorPatternLearner } from "./error-patterns.js";
import { EvolutionPattern, type PatternRecommendation, getPatternMiner } from "./pattern-miner.js";
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
 * Unified intelligence recommendation combining all sources.
 */
export interface UnifiedRecommendation {
	// Task prediction from TaskSuccessPredictor
	prediction: TaskPrediction;
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
	private patternMiner = getPatternMiner();
	private errorLearner = getErrorPatternLearner();
	private ragModule = new RagModule();

	/**
	 * Get unified recommendations for a task context.
	 */
	analyze(context: TaskContext): UnifiedRecommendation {
		// 1. Get task prediction
		const prediction = this.predictor.predict(context);

		// 2. Get pattern recommendations
		const patternRecommendations = this.patternMiner.getRecommendations({
			taskType: context.taskType,
			skillsAvailable: context.skillsAvailable,
			taskDescription: context.taskDescription,
		});

		// 3. Analyze error risks
		const errorRisks = this.analyzeErrorRisks(context);

		// 4. Get relevant context from RAG
		const relevantContext = this.ragModule.search({
			query: context.taskDescription,
			maxResults: 3,
			types: ["learning", "journal", "reflection"],
			includeSnippet: true,
		});

		// 5. Calculate combined confidence
		const combinedConfidence = this.calculateCombinedConfidence(
			prediction,
			patternRecommendations,
			errorRisks,
			relevantContext,
		);

		// 6. Generate overall recommendation
		const overallRecommendation = this.generateOverallRecommendation(
			prediction,
			patternRecommendations,
			errorRisks,
		);

		// 7. Determine suggested approach
		const suggestedApproach = this.determineSuggestedApproach(
			context,
			prediction,
			patternRecommendations,
		);

		// 8. Extract key risks and opportunities
		const keyRisks = this.extractKeyRisks(prediction, errorRisks);
		const keyOpportunities = this.extractKeyOpportunities(
			prediction,
			patternRecommendations,
			relevantContext,
		);

		return {
			prediction,
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
		patterns: PatternRecommendation[],
		errorRisks: ErrorRisk[],
		context: RagSearchResult[],
	): number {
		// Base confidence from prediction
		let base = prediction.confidence;

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
		patterns: PatternRecommendation[],
		errorRisks: ErrorRisk[],
	): string {
		const successPercent = Math.round(prediction.successProbability * 100);

		if (successPercent >= 80 && errorRisks.length === 0) {
			return `High confidence task (${successPercent}% success probability). Proceed with standard approach.`;
		}

		if (successPercent >= 70 && patterns.length > 0) {
			return `Good confidence (${successPercent}%) with pattern support. Use recommended skills for best results.`;
		}

		if (successPercent < 50) {
			return `Low confidence (${successPercent}%). Consider breaking down task or acquiring missing skills first.`;
		}

		if (errorRisks.length > 2) {
			return `Moderate confidence (${successPercent}%) but with error risks. Apply suggested solutions proactively.`;
		}

		return `Proceed with caution (${successPercent}% confidence). Monitor for key risks.`;
	}

	/**
	 * Determine suggested approach based on all intelligence.
	 */
	private determineSuggestedApproach(
		context: TaskContext,
		prediction: TaskPrediction,
		patterns: PatternRecommendation[],
	): string {
		// If high complexity, suggest planning phase
		if (context.complexity === "high") {
			return "Use plan-architecture skill first, then implement step-by-step with checkpoints.";
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
	private extractKeyRisks(prediction: TaskPrediction, errorRisks: ErrorRisk[]): string[] {
		const risks: string[] = [];

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
		patterns: PatternRecommendation[],
		context: RagSearchResult[],
	): string[] {
		const opportunities: string[] = [];

		// Pattern opportunities
		if (patterns.length > 0) {
			opportunities.push(`Apply ${patterns.length} successful patterns from history`);
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
		const patternStats = this.patternMiner.getStats();
		const errorStats = this.errorLearner.getStats();
		const ragStats = this.ragModule.getStats();

		// Calculate combined accuracy
		const combinedAccuracy = Math.round(
			predictorStats.accuracyRate * 0.4 +
				patternStats.averageSuccessRate * 0.3 +
				(100 - Math.min(errorStats.totalOccurrences * 5, 50)) * 0.3,
		);

		return {
			predictorStats,
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
		this.patternMiner.refresh();
		this.ragModule.initialize();
	}

	/**
	 * Format recommendation as markdown.
	 */
	formatRecommendation(rec: UnifiedRecommendation): string {
		const lines: string[] = [
			"## Unified Evolution Intelligence Recommendation",
			"",
			`**Combined Confidence:** ${rec.combinedConfidence}%`,
			`**Success Probability:** ${Math.round(rec.prediction.successProbability * 100)}%`,
			`**Estimated Time:** ~${rec.prediction.estimatedTime}m`,
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
