/**
 * Evolution Strategy Planner - Meta-capability for planning optimal evolution strategies
 *
 * This module analyzes current state, metrics, and capability gaps to recommend
 * optimal evolution strategies. It helps the agent make smarter decisions about
 * what to work on next.
 *
 * Inspired by strategic planning patterns from competitive agents and
 * meta-learning concepts.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { CapabilityGap } from "./capability-gap.js";
import { getCapabilityGapDetector } from "./capability-gap.js";
import { getEvolutionIntelligence } from "./intelligence.js";
import type { EvolutionMetrics } from "./metrics.js";
import { getMetricsTracker } from "./metrics.js";
import { getPatternMiner } from "./pattern-miner.js";
import { parseScorecardRows } from "./scorecard.js";
import { getTaskPredictor } from "./task-predictor.js";

// ============================================================================
// Types
// ============================================================================

export interface EvolutionState {
	capabilitiesImplemented: number;
	capabilitiesTotal: number;
	coveragePercentage: number;
	recentSuccessRate: number;
	averageIterationTime: number;
	topErrors: string[];
	underutilizedTools: string[];
	highFailureTools: string[];
	skillSuccessRates: Record<string, number>;
	daysSinceStart: number;
	capabilityVelocity: number;
}

export interface StrategyRecommendation {
	strategyType: StrategyType;
	priority: number;
	confidence: number;
	description: string;
	rationale: string[];
	expectedBenefit: string;
	riskFactors: string[];
	enablerCapabilities: string[];
	relatedPatterns: string[];
}

export type StrategyType =
	| "fill-gaps"
	| "improve-reliability"
	| "add-new-capability"
	| "optimize-existing"
	| "research-competitors"
	| "integration-improvement"
	| "memory-enhancement"
	| "tool-chain-improvement";

export interface CapabilityEnabler {
	capabilityId: string;
	capabilityName: string;
	enablesCount: number;
	enabledBy: string[];
	priority: number;
}

export interface EvolutionStrategyConfig {
	minConfidenceThreshold: number;
	maxRecommendations: number;
	considerRecentFailures: boolean;
	prioritizeEnablers: boolean;
	analyzeCompetitorGaps: boolean;
	stateFile: string;
	memoryPath: string;
}

export interface StrategyAnalysisResult {
	state: EvolutionState;
	recommendations: StrategyRecommendation[];
	enablers: CapabilityEnabler[];
	strategicDirection: string;
	nextPhaseSuggestion: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: EvolutionStrategyConfig = {
	minConfidenceThreshold: 0.7,
	maxRecommendations: 5,
	considerRecentFailures: true,
	prioritizeEnablers: true,
	analyzeCompetitorGaps: true,
	stateFile: "~/.paimon/evolution-strategy.json",
	memoryPath: path.join(process.cwd(), "MEMORY.md"),
};

const CAPABILITY_ENABLERS: Record<string, string[]> = {
	"self-assessment": ["error-recovery", "reflection"],
	"error-recovery": ["self-healing", "error-patterns"],
	"memory-persistence": ["rag", "learning-transfer"],
	"task-predictor": ["intelligence", "pattern-miner"],
	intelligence: ["evolution-strategy"],
	"capability-gap": ["evolution-strategy"],
	"regression-testing": ["self-assessment"],
	"session-replay": ["pattern-auto-apply"],
	"pattern-miner": ["pattern-auto-apply"],
	"self-healing": ["error-recovery"],
	"multi-agent": ["agent-builder"],
	hooks: ["hookify", "security-guidance"],
	repomap: ["multi-file-context"],
	"evolution-strategy": [], // Meta-capability
};

const STRATEGY_PRIORITIES: Record<StrategyType, number> = {
	"fill-gaps": 90,
	"improve-reliability": 70,
	"add-new-capability": 80,
	"optimize-existing": 60,
	"research-competitors": 50,
	"integration-improvement": 75,
	"memory-enhancement": 65,
	"tool-chain-improvement": 55,
};

// ============================================================================
// Evolution Strategy Planner Class
// ============================================================================

export class EvolutionStrategyPlanner {
	private config: EvolutionStrategyConfig;
	private stateCache: EvolutionState | null = null;

	constructor(config: Partial<EvolutionStrategyConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * Analyze current evolution state
	 */
	async analyzeCurrentState(): Promise<EvolutionState> {
		if (this.stateCache) {
			return this.stateCache;
		}

		// Gather metrics
		const metricsTracker = getMetricsTracker();
		const metrics = metricsTracker.getMetrics();

		// Gather capability gaps
		const gapDetector = getCapabilityGapDetector();
		const gaps = await gapDetector.getAllGaps();

		// Gather patterns
		const patternMiner = getPatternMiner();
		const patterns = await patternMiner.getPatterns();

		// Build state
		const state: EvolutionState = {
			capabilitiesImplemented: this.countImplementedCapabilities(metrics),
			capabilitiesTotal: this.countTotalCapabilities(metrics),
			coveragePercentage: this.calculateCoverage(metrics),
			recentSuccessRate: metrics.successRate.current / 100 || 0.91,
			averageIterationTime: metrics.time.averageMinutes || 14,
			topErrors: this.extractTopErrors(metrics),
			underutilizedTools: this.extractUnderutilizedTools(metrics),
			highFailureTools: this.extractHighFailureTools(metrics),
			skillSuccessRates: this.extractSkillSuccessRates(metrics),
			daysSinceStart: this.calculateDaysSinceStart(),
			capabilityVelocity: metrics.capabilityVelocity.current || 32,
		};

		this.stateCache = state;
		return state;
	}

	/**
	 * Recommend next evolution strategies
	 */
	async recommendNextStrategy(): Promise<StrategyAnalysisResult> {
		const state = await this.analyzeCurrentState();
		const recommendations: StrategyRecommendation[] = [];

		// Strategy 1: Fill gaps
		const gapStrategy = await this.analyzeGapStrategy(state);
		if (gapStrategy) {
			recommendations.push(gapStrategy);
		}

		// Strategy 2: Improve reliability (if recent failures)
		if (state.recentSuccessRate < 0.9 && this.config.considerRecentFailures) {
			recommendations.push(await this.analyzeReliabilityStrategy(state));
		}

		// Strategy 3: Add new capability (if coverage < 95%)
		if (state.coveragePercentage < 95) {
			recommendations.push(await this.analyzeNewCapabilityStrategy(state));
		}

		// Strategy 4: Optimize existing (if underutilized tools)
		if (state.underutilizedTools.length > 0) {
			recommendations.push(await this.analyzeOptimizationStrategy(state));
		}

		// Strategy 5: Integration improvement (if enablers exist)
		if (this.config.prioritizeEnablers) {
			recommendations.push(await this.analyzeIntegrationStrategy(state));
		}

		// Strategy 6: Research competitors
		if (this.config.analyzeCompetitorGaps) {
			recommendations.push(await this.analyzeCompetitorStrategy(state));
		}

		// Strategy 7: Memory enhancement (if days > 30)
		if (state.daysSinceStart > 30) {
			recommendations.push(await this.analyzeMemoryStrategy(state));
		}

		// Sort by priority and confidence
		recommendations.sort((a, b) => {
			const scoreA = a.priority * a.confidence;
			const scoreB = b.priority * b.confidence;
			return scoreB - scoreA;
		});

		// Get capability enablers
		const enablers = await this.predictCapabilityEnablers();

		// Determine strategic direction
		const strategicDirection = this.determineStrategicDirection(state, recommendations);

		// Suggest next phase
		const nextPhaseSuggestion = this.suggestNextPhase(state, recommendations, enablers);

		return {
			state,
			recommendations: recommendations.slice(0, this.config.maxRecommendations),
			enablers,
			strategicDirection,
			nextPhaseSuggestion,
		};
	}

	/**
	 * Predict which capabilities enable others
	 */
	async predictCapabilityEnablers(): Promise<CapabilityEnabler[]> {
		const enablers: CapabilityEnabler[] = [];

		for (const [capabilityId, enablesList] of Object.entries(CAPABILITY_ENABLERS)) {
			const enabledBy = this.findEnabledBy(capabilityId);

			enablers.push({
				capabilityId,
				capabilityName: this.formatCapabilityName(capabilityId),
				enablesCount: enablesList.length,
				enabledBy,
				priority: enablesList.length * 10 + enabledBy.length * 5,
			});
		}

		// Sort by priority (most enabling capabilities first)
		enablers.sort((a, b) => b.priority - a.priority);

		return enablers;
	}

	/**
	 * Get strategic guidance for a specific task
	 */
	async getStrategicGuidance(
		taskDescription: string,
		taskType: string,
	): Promise<{
		recommendation: StrategyRecommendation | null;
		riskLevel: "low" | "medium" | "high";
		enablersToConsider: string[];
		patternsToApply: string[];
	}> {
		const state = await this.analyzeCurrentState();
		const recommendations = await this.recommendNextStrategy();

		// Check if task aligns with strategy
		const aligningRecommendations = recommendations.recommendations.filter((r) =>
			this.taskAlignsWithStrategy(taskDescription, taskType, r),
		);

		const recommendation = aligningRecommendations.length > 0 ? aligningRecommendations[0] : null;

		// Determine risk level
		const riskLevel = this.assessTaskRisk(taskDescription, taskType, state);

		// Get relevant enablers
		const enablersToConsider = recommendations.enablers
			.filter((e) => taskDescription.toLowerCase().includes(e.capabilityId))
			.map((e) => e.capabilityName);

		// Get patterns to apply
		const patternMiner = getPatternMiner();
		const patterns = patternMiner.getPatterns();

		const patternsToApply = patterns.slice(0, 3).map((p) => p.id);

		return {
			recommendation,
			riskLevel,
			enablersToConsider,
			patternsToApply,
		};
	}

	// ============================================================================
	// Private Analysis Methods
	// ============================================================================

	private async analyzeGapStrategy(state: EvolutionState): Promise<StrategyRecommendation | null> {
		const gapDetector = getCapabilityGapDetector();
		const gaps = await gapDetector.getAllGaps();

		if (gaps.length === 0) {
			return null;
		}

		const highSeverityGaps = gaps.filter((g) => g.severity === "critical" || g.severity === "high");

		return {
			strategyType: "fill-gaps",
			priority: STRATEGY_PRIORITIES["fill-gaps"],
			confidence: highSeverityGaps.length > 0 ? 0.95 : 0.8,
			description: `Fill ${gaps.length} identified capability gaps (${highSeverityGaps.length} high priority)`,
			rationale: [
				`${gaps.length} gaps detected in capability coverage`,
				`${highSeverityGaps.length} gaps have critical/high severity`,
				"Filling gaps improves overall system capability",
			],
			expectedBenefit: "Improved capability coverage and reduced future failures",
			riskFactors: ["Some gaps may require complex implementation"],
			enablerCapabilities: this.getEnablersForGaps(gaps),
			relatedPatterns: ["gap-detection", "capability-tracking"],
		};
	}

	private async analyzeReliabilityStrategy(state: EvolutionState): Promise<StrategyRecommendation> {
		return {
			strategyType: "improve-reliability",
			priority: STRATEGY_PRIORITIES["improve-reliability"],
			confidence: 0.85,
			description: `Improve reliability to address ${state.topErrors.length} common error patterns`,
			rationale: [
				`Recent success rate is ${(state.recentSuccessRate * 100).toFixed(1)}% (below 90% target)`,
				`${state.topErrors.length} recurring error patterns identified`,
				"Reliability improvements reduce rework and iteration time",
			],
			expectedBenefit: "Higher success rate, reduced iteration time, fewer failures",
			riskFactors: ["May require deep analysis of error root causes"],
			enablerCapabilities: ["self-healing", "error-patterns", "error-recovery"],
			relatedPatterns: ["error-recovery", "self-correction"],
		};
	}

	private async analyzeNewCapabilityStrategy(
		state: EvolutionState,
	): Promise<StrategyRecommendation> {
		const gapDetector = getCapabilityGapDetector();
		const competitorGaps = await gapDetector.detectCompetitorGaps();

		return {
			strategyType: "add-new-capability",
			priority: STRATEGY_PRIORITIES["add-new-capability"],
			confidence: 0.75,
			description: `Add new capability to reach 95%+ coverage (currently ${state.coveragePercentage}%)`,
			rationale: [
				`Current coverage: ${state.coveragePercentage}%`,
				`Capability velocity: ${state.capabilityVelocity} capabilities/day`,
				`${competitorGaps.length} competitor patterns not yet implemented`,
			],
			expectedBenefit: "Increased capability coverage, competitive feature parity",
			riskFactors: ["New capabilities may introduce integration complexity"],
			enablerCapabilities: ["research", "competitor-analysis"],
			relatedPatterns: ["capability-discovery", "pattern-extraction"],
		};
	}

	private async analyzeOptimizationStrategy(
		state: EvolutionState,
	): Promise<StrategyRecommendation> {
		return {
			strategyType: "optimize-existing",
			priority: STRATEGY_PRIORITIES["optimize-existing"],
			confidence: 0.7,
			description: `Optimize ${state.underutilizedTools.length} underutilized tools`,
			rationale: [
				`${state.underutilizedTools.length} tools are underutilized`,
				`${state.highFailureTools.length} tools have high failure rates`,
				"Optimization improves tool chain efficiency",
			],
			expectedBenefit: "Better tool utilization, reduced token usage, improved efficiency",
			riskFactors: ["May require changes to core tool implementations"],
			enablerCapabilities: ["tool-usage-analytics", "metrics"],
			relatedPatterns: ["tool-optimization", "usage-tracking"],
		};
	}

	private async analyzeIntegrationStrategy(state: EvolutionState): Promise<StrategyRecommendation> {
		const enablers = await this.predictCapabilityEnablers();
		const topEnablers = enablers.filter((e) => e.enablesCount > 0).slice(0, 3);

		return {
			strategyType: "integration-improvement",
			priority: STRATEGY_PRIORITIES["integration-improvement"],
			confidence: 0.8,
			description: `Improve integrations between ${topEnablers.length} key enabler capabilities`,
			rationale: [
				`${topEnablers.length} capabilities enable others`,
				"Integration improvements multiply capability value",
				"Cross-capability integrations reduce redundancy",
			],
			expectedBenefit: "Better capability synergy, reduced code duplication",
			riskFactors: ["Integration changes may affect multiple modules"],
			enablerCapabilities: topEnablers.map((e) => e.capabilityId),
			relatedPatterns: ["integration-pattern", "module-coordination"],
		};
	}

	private async analyzeCompetitorStrategy(state: EvolutionState): Promise<StrategyRecommendation> {
		return {
			strategyType: "research-competitors",
			priority: STRATEGY_PRIORITIES["research-competitors"],
			confidence: 0.65,
			description: "Research competitor agents for new patterns and capabilities",
			rationale: [
				"Competitor research identifies emerging patterns",
				"Claude Code, OpenHands, Aider, Cursor continuously evolve",
				"Proactive research prevents capability gaps",
			],
			expectedBenefit: "Discovered patterns, competitive awareness, ROADMAP enrichment",
			riskFactors: ["Research time investment may not yield immediate results"],
			enablerCapabilities: ["research", "rag"],
			relatedPatterns: ["competitor-analysis", "pattern-mining"],
		};
	}

	private async analyzeMemoryStrategy(state: EvolutionState): Promise<StrategyRecommendation> {
		return {
			strategyType: "memory-enhancement",
			priority: STRATEGY_PRIORITIES["memory-enhancement"],
			confidence: 0.7,
			description: "Enhance memory and learning systems for long-term evolution",
			rationale: [
				`${state.daysSinceStart} days of evolution history`,
				"Memory compression improves context efficiency",
				"Learning transfer improves first-try success",
			],
			expectedBenefit: "Better context management, preserved learnings, improved transfer",
			riskFactors: ["Memory changes may affect existing stored data"],
			enablerCapabilities: ["learning-transfer", "rag", "journal"],
			relatedPatterns: ["memory-compression", "learning-persistence"],
		};
	}

	// ============================================================================
	// Private Helper Methods
	// ============================================================================

	private countImplementedCapabilities(metrics: EvolutionMetrics): number {
		return metrics.capabilityVelocity?.totalCapabilities || 95;
	}

	private countTotalCapabilities(metrics: EvolutionMetrics): number {
		return 100; // Target total capabilities
	}

	private calculateCoverage(metrics: EvolutionMetrics): number {
		const implemented = this.countImplementedCapabilities(metrics);
		return Math.round((implemented / this.countTotalCapabilities(metrics)) * 100);
	}

	private extractTopErrors(metrics: EvolutionMetrics): string[] {
		return metrics.errors?.commonPatterns || [];
	}

	private extractUnderutilizedTools(metrics: EvolutionMetrics): string[] {
		// This would be extracted from tool usage analytics
		return [];
	}

	private extractHighFailureTools(metrics: EvolutionMetrics): string[] {
		// This would be extracted from tool usage analytics
		return [];
	}

	private extractSkillSuccessRates(metrics: EvolutionMetrics): Record<string, number> {
		const result: Record<string, number> = {};
		for (const skill of metrics.skills?.slice(0, 5) || []) {
			result[skill.skill] = skill.successRate;
		}
		return result;
	}

	private calculateDaysSinceStart(): number {
		const memoryPath = this.config.memoryPath || path.join(process.cwd(), "MEMORY.md");

		try {
			if (!fs.existsSync(memoryPath)) {
				return 0;
			}

			const content = fs.readFileSync(memoryPath, "utf-8");
			const rows = parseScorecardRows(content);
			if (rows.length === 0) {
				return 0;
			}

			const timestamps = rows
				.map((row) => new Date(row.date))
				.filter((date) => !Number.isNaN(date.getTime()))
				.map((date) => date.getTime());
			if (timestamps.length === 0) {
				return 0;
			}

			const now = new Date();
			const earliest = Math.min(...timestamps);
			return Math.max(0, Math.floor((now.getTime() - earliest) / (1000 * 60 * 60 * 24)));
		} catch {
			return 0;
		}
	}

	private findEnabledBy(capabilityId: string): string[] {
		const enabledBy: string[] = [];
		for (const [id, enables] of Object.entries(CAPABILITY_ENABLERS)) {
			if (enables.includes(capabilityId)) {
				enabledBy.push(id);
			}
		}
		return enabledBy;
	}

	private formatCapabilityName(capabilityId: string): string {
		return capabilityId
			.split("-")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	}

	private getEnablersForGaps(gaps: CapabilityGap[]): string[] {
		return gaps
			.filter((g) => g.type === "missing-tool" || g.type === "missing-module")
			.slice(0, 5)
			.map((g) => g.id);
	}

	private determineStrategicDirection(
		state: EvolutionState,
		recommendations: StrategyRecommendation[],
	): string {
		if (recommendations.length === 0) {
			return "maintain";
		}

		const topRecommendation = recommendations[0];

		if (state.recentSuccessRate < 0.85) {
			return "stabilize";
		}

		if (state.coveragePercentage < 90) {
			return "expand";
		}

		if (topRecommendation.strategyType === "integration-improvement") {
			return "integrate";
		}

		if (topRecommendation.strategyType === "optimize-existing") {
			return "optimize";
		}

		return "evolve";
	}

	private suggestNextPhase(
		state: EvolutionState,
		recommendations: StrategyRecommendation[],
		enablers: CapabilityEnabler[],
	): string {
		const topRecommendation = recommendations[0];

		if (!topRecommendation) {
			return "No specific phase suggestion - maintain current capabilities";
		}

		const phaseNumber = 75; // Next phase after Phase 74

		switch (topRecommendation.strategyType) {
			case "fill-gaps":
				return `Phase ${phaseNumber}: Fill Capability Gaps - Address ${topRecommendation.enablerCapabilities.length} identified gaps`;
			case "improve-reliability":
				return `Phase ${phaseNumber}: Reliability Enhancement - Improve success rate through error recovery`;
			case "add-new-capability":
				return `Phase ${phaseNumber}: New Capability - Add capability from competitor research`;
			case "integration-improvement":
				return `Phase ${phaseNumber}: Integration Enhancement - Improve cross-capability integrations`;
			case "optimize-existing":
				return `Phase ${phaseNumber}: Optimization - Optimize underutilized tools and high-failure tools`;
			case "memory-enhancement":
				return `Phase ${phaseNumber}: Memory Enhancement - Improve learning persistence and transfer`;
			default:
				return `Phase ${phaseNumber}: Continue Evolution - Follow recommended strategy`;
		}
	}

	private taskAlignsWithStrategy(
		taskDescription: string,
		taskType: string,
		strategy: StrategyRecommendation,
	): boolean {
		const lowerTask = taskDescription.toLowerCase();

		switch (strategy.strategyType) {
			case "fill-gaps":
				return (
					lowerTask.includes("gap") || lowerTask.includes("missing") || lowerTask.includes("fix")
				);
			case "improve-reliability":
				return (
					taskType === "reliability" || lowerTask.includes("error") || lowerTask.includes("bug")
				);
			case "add-new-capability":
				return (
					(taskType === "capability" && lowerTask.includes("add")) ||
					lowerTask.includes("implement")
				);
			case "integration-improvement":
				return lowerTask.includes("integration") || lowerTask.includes("connect");
			case "optimize-existing":
				return lowerTask.includes("optimize") || lowerTask.includes("improve");
			default:
				return false;
		}
	}

	private assessTaskRisk(
		taskDescription: string,
		taskType: string,
		state: EvolutionState,
	): "low" | "medium" | "high" {
		// High risk indicators
		if (
			taskDescription.toLowerCase().includes("rewrite") ||
			taskDescription.toLowerCase().includes("refactor") ||
			taskDescription.toLowerCase().includes("architecture")
		) {
			return "high";
		}

		// Medium risk based on current state
		if (state.recentSuccessRate < 0.9 && taskType === "capability") {
			return "medium";
		}

		// Low risk for simple tasks
		if (
			taskDescription.toLowerCase().includes("fix") ||
			taskDescription.toLowerCase().includes("document") ||
			taskDescription.toLowerCase().includes("update")
		) {
			return "low";
		}

		return "medium";
	}

	/**
	 * Clear state cache
	 */
	clearCache(): void {
		this.stateCache = null;
	}

	/**
	 * Update configuration
	 */
	updateConfig(updates: Partial<EvolutionStrategyConfig>): void {
		this.config = { ...this.config, ...updates };
		this.clearCache();
	}

	/**
	 * Get current configuration
	 */
	getConfig(): EvolutionStrategyConfig {
		return { ...this.config };
	}
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: EvolutionStrategyPlanner | null = null;

export function getEvolutionStrategyPlanner(
	config?: Partial<EvolutionStrategyConfig>,
): EvolutionStrategyPlanner {
	if (!instance) {
		instance = new EvolutionStrategyPlanner(config);
	}
	return instance;
}

export function resetEvolutionStrategyPlanner(): void {
	instance = null;
}
