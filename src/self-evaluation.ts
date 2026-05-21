/**
 * Self-Evaluation Manager - Agent self-evaluation for recursive improvement
 *
 * This module implements a recursive evaluation pattern where the agent
 * evaluates its own performance after each evolution iteration,
 * identifying strengths and weaknesses to guide future improvements.
 *
 * Inspired by:
 * - Meta-cognition patterns in AI agents
 * - Feedback loops for continuous improvement
 * - Self-awareness tracking for better decision making
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { type ScorecardRow, normalizeScorecardResult, parseScorecardRows } from "./scorecard.js";

// Evaluation criteria types
export type EvaluationCriterion =
	| "task_success" // Did the task complete successfully?
	| "time_efficiency" // Was the task completed efficiently?
	| "error_handling" // How well were errors handled?
	| "skill_usage" // Were appropriate skills used?
	| "code_quality" // Was the produced code high quality?
	| "learning_quality" // Did new learnings get captured?
	| "capability_gap" // What capabilities were missing?
	| "planning_quality"; // Was the plan well-structured?

// Evaluation result types
export type EvaluationResult = "excellent" | "good" | "adequate" | "needs_improvement" | "poor";

// Performance dimension types
export type PerformanceDimension =
	| "success_rate"
	| "time_efficiency"
	| "error_recovery"
	| "skill_effectiveness"
	| "code_quality"
	| "learning_capture"
	| "capability_velocity";

// Evaluation score for a criterion
export interface CriterionScore {
	criterion: EvaluationCriterion;
	result: EvaluationResult;
	score: number; // 0-100
	notes: string;
	improvementSuggestions: string[];
}

// Self-evaluation result
export interface SelfEvaluation {
	id: string;
	timestamp: string;
	iterationId: string;
	taskType: "capability" | "reliability" | "feature";
	taskDescription: string;
	durationMinutes: number;
	success: boolean;
	errors: string[];
	skillsUsed: string[];
	criterionScores: CriterionScore[];
	overallScore: number; // 0-100
	strengths: string[];
	weaknesses: string[];
	recommendations: string[];
	capabilityGaps: string[];
	nextFocusAreas: string[];
}

// Performance trend analysis
export interface PerformanceTrend {
	dimension: PerformanceDimension;
	currentValue: number;
	previousValue: number;
	trend: "improving" | "stable" | "declining";
	trendPercentage: number;
}

// Self-evaluation configuration
export interface SelfEvaluationConfig {
	enabled: boolean;
	autoEvaluate: boolean; // Evaluate after each iteration
	evaluationThresholds: {
		excellent: number; // >= this score
		good: number;
		adequate: number;
		needsImprovement: number;
		poor: number; // < this score
	};
	historyRetentionDays: number;
	minIterationsForTrend: number;
}

// Statistics
export interface SelfEvaluationStats {
	totalEvaluations: number;
	averageOverallScore: number;
	excellentCount: number;
	goodCount: number;
	adequateCount: number;
	needsImprovementCount: number;
	poorCount: number;
	recentTrends: PerformanceTrend[];
	topStrengths: string[];
	topWeaknesses: string[];
	commonCapabilityGaps: string[];
	averageTimeEfficiency: number;
	successRate: number;
	errorRecoveryRate: number;
}

// Default evaluation thresholds
const DEFAULT_THRESHOLDS = {
	excellent: 90,
	good: 75,
	adequate: 60,
	needsImprovement: 40,
	poor: 20,
};

// Default configuration
const DEFAULT_CONFIG: SelfEvaluationConfig = {
	enabled: true,
	autoEvaluate: true,
	evaluationThresholds: DEFAULT_THRESHOLDS,
	historyRetentionDays: 30,
	minIterationsForTrend: 5,
};

const MEMORY_RECOVERY_LOOKBACK = 10;

/**
 * SelfEvaluationManager class
 * Manages agent self-evaluation for recursive improvement
 */
export class SelfEvaluationManager {
	private config: SelfEvaluationConfig;
	private evaluations: SelfEvaluation[] = [];
	private dataPath: string;

	constructor(config?: Partial<SelfEvaluationConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.dataPath = join(homedir(), ".paimon", "self-evaluation.json");
		this.loadState();
	}

	/**
	 * Perform self-evaluation after an evolution iteration
	 */
	evaluate(iterationData: {
		iterationId: string;
		taskType: "capability" | "reliability" | "feature";
		taskDescription: string;
		durationMinutes: number;
		success: boolean;
		errors: string[];
		skillsUsed: string[];
		firstTry: boolean;
		rework: boolean;
		impact: "High" | "Medium" | "Low";
	}): SelfEvaluation {
		const id = `eval-${Date.now()}`;
		const timestamp = new Date().toISOString();

		// Score each criterion
		const criterionScores = this.scoreCriteria(iterationData);

		// Calculate overall score
		const overallScore = this.calculateOverallScore(criterionScores);

		// Identify strengths and weaknesses
		const strengths = this.identifyStrengths(criterionScores);
		const weaknesses = this.identifyWeaknesses(criterionScores);

		// Generate recommendations
		const recommendations = this.generateRecommendations(
			criterionScores,
			weaknesses,
			iterationData,
		);

		// Identify capability gaps
		const capabilityGaps = this.identifyCapabilityGaps(iterationData, weaknesses);

		// Determine next focus areas
		const nextFocusAreas = this.determineNextFocusAreas(
			capabilityGaps,
			recommendations,
			iterationData.taskType,
		);

		const evaluation: SelfEvaluation = {
			id,
			timestamp,
			iterationId: iterationData.iterationId,
			taskType: iterationData.taskType,
			taskDescription: iterationData.taskDescription,
			durationMinutes: iterationData.durationMinutes,
			success: iterationData.success,
			errors: iterationData.errors,
			skillsUsed: iterationData.skillsUsed,
			criterionScores,
			overallScore,
			strengths,
			weaknesses,
			recommendations,
			capabilityGaps,
			nextFocusAreas,
		};

		// Store evaluation
		this.evaluations.push(evaluation);
		this.saveState();

		return evaluation;
	}

	/**
	 * Check if self-evaluation is enabled
	 */
	isEnabled(): boolean {
		return this.config.enabled;
	}

	/**
	 * Enable or disable self-evaluation
	 */
	setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveState();
	}

	/**
	 * Score each evaluation criterion
	 */
	private scoreCriteria(iterationData: {
		success: boolean;
		durationMinutes: number;
		errors: string[];
		skillsUsed: string[];
		firstTry: boolean;
		rework: boolean;
		impact: "High" | "Medium" | "Low";
	}): CriterionScore[] {
		const scores: CriterionScore[] = [];

		// Task success
		scores.push(this.scoreTaskSuccess(iterationData.success, iterationData.firstTry));

		// Time efficiency
		scores.push(this.scoreTimeEfficiency(iterationData.durationMinutes, iterationData.success));

		// Error handling
		scores.push(this.scoreErrorHandling(iterationData.errors, iterationData.rework));

		// Skill usage
		scores.push(this.scoreSkillUsage(iterationData.skillsUsed, iterationData.success));

		// Code quality (placeholder - would need actual code analysis)
		scores.push(this.scoreCodeQuality(iterationData.success, iterationData.errors));

		// Learning quality
		scores.push(this.scoreLearningQuality(iterationData.success, iterationData.impact));

		// Capability gap
		scores.push(this.scoreCapabilityGap(iterationData.skillsUsed.length, iterationData.success));

		// Planning quality
		scores.push(this.scorePlanningQuality(iterationData.firstTry, iterationData.rework));

		return scores;
	}

	/**
	 * Score task success criterion
	 */
	private scoreTaskSuccess(success: boolean, firstTry: boolean): CriterionScore {
		const score = success ? (firstTry ? 100 : 80) : 20;
		const result = this.getResultFromScore(score);
		const notes = success
			? firstTry
				? "Task completed successfully on first attempt"
				: "Task completed after iterations"
			: "Task failed to complete";

		const suggestions: string[] = [];
		if (!success) {
			suggestions.push("Review error patterns to understand failure causes");
			suggestions.push("Use error recovery loops for self-correction");
		}
		if (success && !firstTry) {
			suggestions.push("Consider better planning to reduce iterations");
			suggestions.push("Use task predictor to assess complexity before starting");
		}

		return {
			criterion: "task_success",
			result,
			score,
			notes,
			improvementSuggestions: suggestions,
		};
	}

	/**
	 * Score time efficiency criterion
	 */
	private scoreTimeEfficiency(durationMinutes: number, success: boolean): CriterionScore {
		// Expected times based on task complexity
		// capability: ~15-20min, reliability: ~10min, feature: ~20-30min
		const expectedMax = 30; // minutes
		const efficiencyRatio = success ? Math.min(expectedMax / durationMinutes, 1.5) : 0.3;
		const score = Math.round(efficiencyRatio * 60 + 40);
		const adjustedScore = Math.max(0, Math.min(100, score));
		const result = this.getResultFromScore(adjustedScore);

		const notes =
			durationMinutes <= expectedMax
				? `Completed in ${durationMinutes} minutes (efficient)`
				: `Completed in ${durationMinutes} minutes (above expected ${expectedMax}min)`;

		const suggestions: string[] = [];
		if (durationMinutes > expectedMax) {
			suggestions.push("Use parallel execution for independent operations");
			suggestions.push("Plan architecture before implementation");
			suggestions.push("Leverage cached tool results");
		}

		return {
			criterion: "time_efficiency",
			result,
			score: adjustedScore,
			notes,
			improvementSuggestions: suggestions,
		};
	}

	/**
	 * Score error handling criterion
	 */
	private scoreErrorHandling(errors: string[], rework: boolean): CriterionScore {
		const errorCount = errors.length;
		const hasRework = rework;

		// Score based on error count and rework
		let score = 100;
		if (errorCount > 0) {
			score -= errorCount * 15; // Each error reduces score
		}
		if (hasRework) {
			score -= 20; // Rework indicates poor error handling
		}
		score = Math.max(0, score);

		const result = this.getResultFromScore(score);
		const notes =
			errorCount === 0
				? "No errors encountered"
				: `${errorCount} error(s) encountered${hasRework ? ", rework required" : ""}`;

		const suggestions: string[] = [];
		if (errorCount > 0) {
			suggestions.push("Use error pattern learning to find known solutions");
			suggestions.push("Implement self-healing patterns for common errors");
		}
		if (hasRework) {
			suggestions.push("Use assess tool before completion to catch issues");
			suggestions.push("Review similar past failures for patterns");
		}

		return {
			criterion: "error_handling",
			result,
			score,
			notes,
			improvementSuggestions: suggestions,
		};
	}

	/**
	 * Score skill usage criterion
	 */
	private scoreSkillUsage(skillsUsed: string[], success: boolean): CriterionScore {
		const skillCount = skillsUsed.length;
		const hasEvolveSkill = skillsUsed.includes("evolve");

		// Good skill usage: 2-4 relevant skills
		let score = 50;
		if (hasEvolveSkill) score += 30;
		if (skillCount >= 2 && skillCount <= 4) score += 20;
		if (success && skillCount > 0) score += 10;
		score = Math.min(100, score);

		const result = this.getResultFromScore(score);
		const notes = `Used ${skillCount} skill(s): ${skillsUsed.join(", ") || "none"}`;

		const suggestions: string[] = [];
		if (skillCount === 0) {
			suggestions.push("Consider using evolve skill for evolution workflow");
			suggestions.push("Use auto-invoke to discover relevant skills");
		}
		if (!hasEvolveSkill && success) {
			suggestions.push("Evolve skill provides structured workflow for better results");
		}

		return {
			criterion: "skill_usage",
			result,
			score,
			notes,
			improvementSuggestions: suggestions,
		};
	}

	/**
	 * Score code quality criterion (placeholder)
	 */
	private scoreCodeQuality(success: boolean, errors: string[]): CriterionScore {
		// In real implementation, this would analyze the actual code
		const hasLintErrors = errors.some((e) => e.toLowerCase().includes("lint"));
		const hasTSErrors = errors.some((e) => e.toLowerCase().includes("typescript"));

		let score = success ? 80 : 40;
		if (hasLintErrors) score -= 15;
		if (hasTSErrors) score -= 20;
		score = Math.max(0, Math.min(100, score));

		const result = this.getResultFromScore(score);
		const notes =
			hasLintErrors || hasTSErrors ? "Quality issues detected" : "Code quality acceptable";

		const suggestions: string[] = [];
		if (hasLintErrors) {
			suggestions.push("Run lint check before completing tasks");
			suggestions.push("Use self-healing for automatic lint fixes");
		}
		if (hasTSErrors) {
			suggestions.push("Run build check before completing tasks");
			suggestions.push("Verify type definitions are complete");
		}

		return {
			criterion: "code_quality",
			result,
			score,
			notes,
			improvementSuggestions: suggestions,
		};
	}

	/**
	 * Score learning quality criterion
	 */
	private scoreLearningQuality(
		success: boolean,
		impact: "High" | "Medium" | "Low",
	): CriterionScore {
		// High impact successes indicate good learning capture
		let score = 60;
		if (success && impact === "High") score = 95;
		else if (success && impact === "Medium") score = 80;
		else if (success) score = 70;
		else if (!success) score = 30; // Failures can still provide learnings

		const result = this.getResultFromScore(score);
		const notes = `Task impact: ${impact}${success ? " (captured)" : " (failed but may provide learning)"}`;

		const suggestions: string[] = [];
		if (!success) {
			suggestions.push("Document failure patterns in MEMORY.md");
			suggestions.push("Use reflection tool to extract lessons");
		}
		if (impact !== "High") {
			suggestions.push("Focus on high-impact capability tasks");
			suggestions.push("Use evolution scoring to prioritize tasks");
		}

		return {
			criterion: "learning_quality",
			result,
			score,
			notes,
			improvementSuggestions: suggestions,
		};
	}

	/**
	 * Score capability gap criterion
	 */
	private scoreCapabilityGap(skillCount: number, success: boolean): CriterionScore {
		// Low skill usage indicates potential capability gaps
		let score = 70;
		if (success && skillCount >= 2) score = 90;
		else if (success && skillCount >= 1) score = 80;
		else if (!success && skillCount === 0) score = 30;

		const result = this.getResultFromScore(score);
		const notes =
			skillCount >= 2
				? "Good capability coverage"
				: skillCount === 0
					? "Potential capability gaps identified"
					: "Limited capability usage";

		const suggestions: string[] = [];
		if (skillCount < 2) {
			suggestions.push("Explore available skills using using-superpowers skill");
			suggestions.push("Use auto-invoke for automatic skill discovery");
			suggestions.push("Review ROADMAP for potential new capabilities");
		}

		return {
			criterion: "capability_gap",
			result,
			score,
			notes,
			improvementSuggestions: suggestions,
		};
	}

	/**
	 * Score planning quality criterion
	 */
	private scorePlanningQuality(firstTry: boolean, rework: boolean): CriterionScore {
		let score = 70;
		if (firstTry && !rework) score = 95;
		else if (firstTry && rework) score = 60;
		else if (!firstTry && !rework) score = 75;
		else score = 40;

		const result = this.getResultFromScore(score);
		const notes =
			firstTry && !rework
				? "Excellent planning - first try success"
				: firstTry && rework
					? "Planning issues - rework required"
					: "Iterative approach used";

		const suggestions: string[] = [];
		if (rework) {
			suggestions.push("Use plan tool for complex multi-step tasks");
			suggestions.push("Create checkpoints before risky changes");
		}
		if (!firstTry) {
			suggestions.push("Use task predictor to assess complexity");
			suggestions.push("Apply intelligence recommendations before starting");
		}

		return {
			criterion: "planning_quality",
			result,
			score,
			notes,
			improvementSuggestions: suggestions,
		};
	}

	/**
	 * Get result category from score
	 */
	private getResultFromScore(score: number): EvaluationResult {
		const thresholds = this.config.evaluationThresholds;
		if (score >= thresholds.excellent) return "excellent";
		if (score >= thresholds.good) return "good";
		if (score >= thresholds.adequate) return "adequate";
		if (score >= thresholds.needsImprovement) return "needs_improvement";
		return "poor";
	}

	/**
	 * Calculate overall score from criterion scores
	 */
	private calculateOverallScore(criterionScores: CriterionScore[]): number {
		// Weighted average of criterion scores
		const weights: Record<EvaluationCriterion, number> = {
			task_success: 3,
			time_efficiency: 2,
			error_handling: 2,
			skill_usage: 1,
			code_quality: 1,
			learning_quality: 2,
			capability_gap: 1,
			planning_quality: 2,
		};

		const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
		const weightedSum = criterionScores.reduce((sum, cs) => {
			return sum + cs.score * weights[cs.criterion];
		}, 0);

		return Math.round(weightedSum / totalWeight);
	}

	/**
	 * Identify strengths from criterion scores
	 */
	private identifyStrengths(criterionScores: CriterionScore[]): string[] {
		const strengths: string[] = [];

		for (const cs of criterionScores) {
			if (cs.result === "excellent" || cs.result === "good") {
				strengths.push(`${cs.criterion}: ${cs.notes}`);
			}
		}

		return strengths;
	}

	/**
	 * Identify weaknesses from criterion scores
	 */
	private identifyWeaknesses(criterionScores: CriterionScore[]): string[] {
		const weaknesses: string[] = [];

		for (const cs of criterionScores) {
			if (cs.result === "needs_improvement" || cs.result === "poor") {
				weaknesses.push(`${cs.criterion}: ${cs.notes}`);
			}
		}

		return weaknesses;
	}

	/**
	 * Generate recommendations
	 */
	private generateRecommendations(
		criterionScores: CriterionScore[],
		weaknesses: string[],
		iterationData: { taskType: string; success: boolean; errors: string[] },
	): string[] {
		const recommendations: string[] = [];

		for (const memorySuggestion of this.getMemoryRecoveryRecommendations(iterationData.errors)) {
			recommendations.push(memorySuggestion);
		}

		// Collect suggestions from weak areas
		for (const cs of criterionScores) {
			if (cs.result === "needs_improvement" || cs.result === "poor") {
				recommendations.push(...cs.improvementSuggestions);
			}
		}

		// Add task-type specific recommendations
		if (!iterationData.success) {
			recommendations.push("Use stuck detection to check for loops");
			recommendations.push("Review error patterns for known solutions");
		}

		// Deduplicate and limit
		return [...new Set(recommendations)].slice(0, 5);
	}

	/**
	 * Identify capability gaps
	 */
	private identifyCapabilityGaps(
		iterationData: { skillsUsed: string[]; errors: string[]; success: boolean },
		weaknesses: string[],
	): string[] {
		const gaps: string[] = [];

		// Check for missing skills
		if (iterationData.skillsUsed.length === 0) {
			gaps.push("skill-discovery: No skills were used during this iteration");
		}
		if (!iterationData.skillsUsed.includes("evolve")) {
			gaps.push("evolve-skill: Evolve skill not used for evolution workflow");
		}

		// Check for error pattern gaps
		const errorTypes = iterationData.errors.map((e) => e.toLowerCase());
		if (errorTypes.some((e) => e.includes("typescript"))) {
			gaps.push("typescript-recovery: Better TypeScript error recovery needed");
		}
		if (errorTypes.some((e) => e.includes("lint"))) {
			gaps.push("lint-recovery: Better lint error recovery needed");
		}
		if (this.hasErrorType(iterationData.errors, "test")) {
			gaps.push("test-recovery: Better recurring test failure recovery guidance needed");
			for (const memoryGap of this.getMemoryRecoveryCapabilityGaps(iterationData.errors)) {
				gaps.push(memoryGap);
			}
		}

		// Check for weakness-based gaps
		if (weaknesses.some((w) => w.includes("planning_quality"))) {
			gaps.push("planning-capability: Better planning and task prediction needed");
		}

		return [...new Set(gaps)];
	}

	/**
	 * Determine next focus areas
	 */
	private determineNextFocusAreas(
		capabilityGaps: string[],
		recommendations: string[],
		taskType: string,
	): string[] {
		const focusAreas: string[] = [];

		// Prioritize capability gaps
		if (capabilityGaps.length > 0) {
			focusAreas.push(`Address capability gap: ${capabilityGaps[0]}`);
		}

		// Add top recommendation
		if (recommendations.length > 0) {
			focusAreas.push(`Implement: ${recommendations[0]}`);
		}

		// Suggest next task type based on current
		if (taskType !== "capability") {
			focusAreas.push("Consider capability tasks for higher evolution impact");
		}

		return focusAreas.slice(0, 3);
	}

	private getMemoryRecoveryRecommendations(errors: string[]): string[] {
		if (!this.hasErrorType(errors, "test")) {
			return [];
		}

		return this.getRecentRecoveryRows("test").map((row) => {
			const normalizedResult = normalizeScorecardResult(row.result, row.firstTry);
			const recoveryNote =
				normalizedResult === "positive"
					? `Reuse the successful recovery path from MEMORY.md (${row.date}: ${row.description})`
					: `Review the failed MEMORY.md attempt before retrying (${row.date}: ${row.description})`;
			const skillNote = row.skillsUsed ? ` Skills used: ${row.skillsUsed}.` : "";
			return `${recoveryNote}.${skillNote}`.trim();
		});
	}

	private getMemoryRecoveryCapabilityGaps(errors: string[]): string[] {
		return this.getRecentRecoveryRows("test", errors).map(
			(row) =>
				`memory-test-recovery: Capture and reuse the ${row.date} ${this.describeMemoryRecoveryResult(row)} path for ${row.description}`,
		);
	}

	private getRecentRecoveryRows(errorType: string, errors?: string[]): ScorecardRow[] {
		if (errors && !this.hasErrorType(errors, errorType)) {
			return [];
		}

		return this.loadScorecardRows()
			.slice(0, MEMORY_RECOVERY_LOOKBACK)
			.filter((row) => this.normalizeScorecardErrors(row.errors).includes(errorType))
			.slice(0, 2);
	}

	private describeMemoryRecoveryResult(row: ScorecardRow): string {
		const normalizedResult = normalizeScorecardResult(row.result, row.firstTry);
		if (normalizedResult === "positive") {
			return "successful recovery";
		}
		if (normalizedResult === "negative") {
			return "failed recovery";
		}
		return "prior recovery";
	}

	private loadScorecardRows(): ScorecardRow[] {
		try {
			const memoryPath = join(process.cwd(), "MEMORY.md");
			if (!existsSync(memoryPath)) {
				return [];
			}
			return parseScorecardRows(readFileSync(memoryPath, "utf-8"));
		} catch {
			return [];
		}
	}

	private normalizeScorecardErrors(errors?: string): string[] {
		const normalized = (errors || "").trim().toLowerCase();
		if (!normalized || normalized === "none") {
			return [];
		}
		return normalized
			.split(/[\/,]|\band\b/)
			.map((part) => part.trim())
			.filter(Boolean)
			.map((part) => {
				if (part === "ts") return "typescript";
				return part;
			});
	}

	private hasErrorType(errors: string[], errorType: string): boolean {
		return errors.some((error) => error.toLowerCase().includes(errorType));
	}

	/**
	 * Get evaluation history
	 */
	getHistory(limit?: number): SelfEvaluation[] {
		const sorted = [...this.evaluations].sort(
			(a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
		);
		return limit ? sorted.slice(0, limit) : sorted;
	}

	/**
	 * Get evaluation by ID
	 */
	getEvaluation(id: string): SelfEvaluation | undefined {
		return this.evaluations.find((e) => e.id === id);
	}

	/**
	 * Get current strengths based on recent evaluations
	 */
	getCurrentStrengths(): string[] {
		const recent = this.getHistory(10);
		const allStrengths = recent.flatMap((e) => e.strengths);

		// Count occurrences
		const counts: Record<string, number> = {};
		for (const s of allStrengths) {
			counts[s] = (counts[s] || 0) + 1;
		}

		// Return top strengths
		return Object.entries(counts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([s]) => s);
	}

	/**
	 * Get current weaknesses based on recent evaluations
	 */
	getCurrentWeaknesses(): string[] {
		const recent = this.getHistory(10);
		const allWeaknesses = recent.flatMap((e) => e.weaknesses);

		// Count occurrences
		const counts: Record<string, number> = {};
		for (const w of allWeaknesses) {
			counts[w] = (counts[w] || 0) + 1;
		}

		// Return top weaknesses
		return Object.entries(counts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([w]) => w);
	}

	/**
	 * Get performance recommendations
	 */
	getRecommendations(): string[] {
		const recent = this.getHistory(5);
		const allRecommendations = recent.flatMap((e) => e.recommendations);

		// Count occurrences
		const counts: Record<string, number> = {};
		for (const r of allRecommendations) {
			counts[r] = (counts[r] || 0) + 1;
		}

		// Return top recommendations
		return Object.entries(counts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([r]) => r);
	}

	/**
	 * Get performance trends
	 */
	getPerformanceTrends(): PerformanceTrend[] {
		const recent = this.getHistory(20);

		if (recent.length < this.config.minIterationsForTrend) {
			return [];
		}

		const trends: PerformanceTrend[] = [];
		const dimensions: PerformanceDimension[] = [
			"success_rate",
			"time_efficiency",
			"error_recovery",
			"skill_effectiveness",
			"code_quality",
			"learning_capture",
			"capability_velocity",
		];

		for (const dim of dimensions) {
			const current = this.calculateDimensionValue(recent.slice(0, 10), dim);
			const previous = this.calculateDimensionValue(recent.slice(10, 20), dim);

			if (previous > 0) {
				const trendPercentage = ((current - previous) / previous) * 100;
				const trend =
					trendPercentage > 5 ? "improving" : trendPercentage < -5 ? "declining" : "stable";

				trends.push({
					dimension: dim,
					currentValue: current,
					previousValue: previous,
					trend,
					trendPercentage: Math.round(trendPercentage),
				});
			}
		}

		return trends;
	}

	/**
	 * Calculate dimension value for trend analysis
	 */
	private calculateDimensionValue(
		evaluations: SelfEvaluation[],
		dimension: PerformanceDimension,
	): number {
		if (evaluations.length === 0) return 0;

		switch (dimension) {
			case "success_rate":
				return (evaluations.filter((e) => e.success).length / evaluations.length) * 100;

			case "time_efficiency":
				return (
					evaluations.reduce((sum, e) => {
						const expectedMax = 30;
						const efficiency = Math.min(expectedMax / e.durationMinutes, 1.5) * 100;
						return sum + efficiency;
					}, 0) / evaluations.length
				);

			case "error_recovery": {
				const withErrors = evaluations.filter((e) => e.errors.length > 0);
				if (withErrors.length === 0) return 100;
				const recovered = withErrors.filter((e) => e.success).length;
				return (recovered / withErrors.length) * 100;
			}

			case "skill_effectiveness": {
				const withSkills = evaluations.filter((e) => e.skillsUsed.length > 0);
				if (withSkills.length === 0) return 0;
				const successWithSkills = withSkills.filter((e) => e.success).length;
				return (successWithSkills / withSkills.length) * 100;
			}

			case "code_quality":
				return (
					evaluations.reduce((sum, e) => {
						const codeQualityScore =
							e.criterionScores.find((cs) => cs.criterion === "code_quality")?.score || 0;
						return sum + codeQualityScore;
					}, 0) / evaluations.length
				);

			case "learning_capture":
				return (
					evaluations.reduce((sum, e) => {
						const learningScore =
							e.criterionScores.find((cs) => cs.criterion === "learning_quality")?.score || 0;
						return sum + learningScore;
					}, 0) / evaluations.length
				);

			case "capability_velocity": {
				// High impact capability tasks count
				const highImpact = evaluations.filter(
					(e) => e.taskType === "capability" && e.success,
				).length;
				return (highImpact / evaluations.length) * 100;
			}

			default:
				return 0;
		}
	}

	/**
	 * Get statistics
	 */
	getStats(): SelfEvaluationStats {
		const total = this.evaluations.length;

		if (total === 0) {
			return {
				totalEvaluations: 0,
				averageOverallScore: 0,
				excellentCount: 0,
				goodCount: 0,
				adequateCount: 0,
				needsImprovementCount: 0,
				poorCount: 0,
				recentTrends: [],
				topStrengths: [],
				topWeaknesses: [],
				commonCapabilityGaps: [],
				averageTimeEfficiency: 0,
				successRate: 0,
				errorRecoveryRate: 0,
			};
		}

		const avgScore = this.evaluations.reduce((sum, e) => sum + e.overallScore, 0) / total;

		const excellent = this.evaluations.filter(
			(e) => e.overallScore >= this.config.evaluationThresholds.excellent,
		).length;
		const good = this.evaluations.filter(
			(e) => e.overallScore >= this.config.evaluationThresholds.good,
		).length;
		const adequate = this.evaluations.filter(
			(e) => e.overallScore >= this.config.evaluationThresholds.adequate,
		).length;
		const needsImprovement = this.evaluations.filter(
			(e) => e.overallScore >= this.config.evaluationThresholds.needsImprovement,
		).length;
		const poor = total - excellent - good - adequate - needsImprovement;

		const successRate = (this.evaluations.filter((e) => e.success).length / total) * 100;

		const avgTime = this.evaluations.reduce((sum, e) => sum + e.durationMinutes, 0) / total;

		const withErrors = this.evaluations.filter((e) => e.errors.length > 0);
		const errorRecoveryRate =
			withErrors.length > 0
				? (withErrors.filter((e) => e.success).length / withErrors.length) * 100
				: 100;

		// Common capability gaps
		const allGaps = this.evaluations.flatMap((e) => e.capabilityGaps);
		const gapCounts: Record<string, number> = {};
		for (const g of allGaps) {
			gapCounts[g] = (gapCounts[g] || 0) + 1;
		}
		const commonGaps = Object.entries(gapCounts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([g]) => g);

		return {
			totalEvaluations: total,
			averageOverallScore: Math.round(avgScore),
			excellentCount: excellent,
			goodCount: good,
			adequateCount: adequate,
			needsImprovementCount: needsImprovement,
			poorCount: poor,
			recentTrends: this.getPerformanceTrends(),
			topStrengths: this.getCurrentStrengths(),
			topWeaknesses: this.getCurrentWeaknesses(),
			commonCapabilityGaps: commonGaps,
			averageTimeEfficiency: Math.round(avgTime),
			successRate: Math.round(successRate),
			errorRecoveryRate: Math.round(errorRecoveryRate),
		};
	}

	/**
	 * Get configuration
	 */
	getConfig(): SelfEvaluationConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration
	 */
	updateConfig(updates: Partial<SelfEvaluationConfig>): SelfEvaluationConfig {
		this.config = { ...this.config, ...updates };
		this.saveState();
		return this.getConfig();
	}

	/**
	 * Clear evaluations
	 */
	clearEvaluations(): void {
		this.evaluations = [];
		this.saveState();
	}

	/**
	 * Reset to defaults
	 */
	reset(): void {
		this.config = DEFAULT_CONFIG;
		this.evaluations = [];
		this.saveState();
	}

	/**
	 * Load state from disk
	 */
	private loadState(): void {
		try {
			if (existsSync(this.dataPath)) {
				const content = readFileSync(this.dataPath, "utf-8");
				const data = JSON.parse(content);
				this.config = { ...DEFAULT_CONFIG, ...data.config };
				this.evaluations = data.evaluations || [];
			}
		} catch {
			// Use defaults on error
			this.config = DEFAULT_CONFIG;
			this.evaluations = [];
		}
	}

	/**
	 * Save state to disk
	 */
	private saveState(): void {
		try {
			const dir = join(homedir(), ".paimon");
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}

			const data = {
				config: this.config,
				evaluations: this.evaluations.slice(-100), // Keep last 100
			};

			writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
		} catch {
			// Silently fail on save error
		}
	}
}

// Singleton instance
let selfEvaluationManager: SelfEvaluationManager | undefined;

/**
 * Get the singleton SelfEvaluationManager instance
 */
export function getSelfEvaluationManager(): SelfEvaluationManager {
	if (!selfEvaluationManager) {
		selfEvaluationManager = new SelfEvaluationManager();
	}
	return selfEvaluationManager;
}

/**
 * Reset the singleton (for testing)
 */
export function resetSelfEvaluationManager(): void {
	selfEvaluationManager = undefined;
}
