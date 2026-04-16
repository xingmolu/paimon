/**
 * Context Importance Scoring (Aider ChatSummary Pattern).
 *
 * This module provides intelligent context importance scoring for smarter
 * truncation decisions. Inspired by Aider's ChatSummary pattern which
 * tokenizes messages and intelligently splits them based on importance.
 *
 * Features:
 * 1. Message importance scoring based on role, content, and recency
 * 2. Tool result importance analysis
 * 3. Truncation recommendations with estimated savings
 * 4. Integration with ContextBudgetManager for proactive management
 */

import { estimateTokens } from "./compaction.js";

/**
 * Message role types for importance scoring.
 */
export type MessageRole = "system" | "user" | "assistant" | "tool_result";

/**
 * Importance factor categories.
 */
export type ImportanceFactor =
	| "role_weight"
	| "recency"
	| "content_type"
	| "tool_success"
	| "error_presence"
	| "file_reference"
	| "plan_reference"
	| "durable_anchor"
	| "size_factor";

/**
 * Content type classification.
 */
export type ContentType =
	| "system_prompt"
	| "skill_definition"
	| "file_content"
	| "tool_result"
	| "error_message"
	| "plan_output"
	| "user_instruction"
	| "assistant_response"
	| "unknown";

/**
 * Importance level classification.
 */
export type ImportanceLevel = "critical" | "high" | "medium" | "low" | "truncatable";

/**
 * Message importance score breakdown.
 */
export interface MessageImportanceScore {
	/** Overall importance score (0-100) */
	score: number;
	/** Importance level classification */
	level: ImportanceLevel;
	/** Factor breakdown */
	factors: Map<ImportanceFactor, number>;
	/** Content type classification */
	contentType: ContentType;
	/** Estimated tokens */
	tokens: number;
	/** Whether this message can be truncated */
	canTruncate: boolean;
	/** Truncation strategy if applicable */
	truncationStrategy?: "summarize" | "remove" | "keep_summary";
	/** Estimated savings if truncated */
	estimatedSavings?: number;
}

/**
 * Message for importance analysis.
 */
export interface MessageForAnalysis {
	/** Message role */
	role: MessageRole;
	/** Message content */
	content: string;
	/** Message index in conversation */
	index: number;
	/** Total messages in conversation */
	totalMessages: number;
	/** Tool name if tool result */
	toolName?: string;
	/** Whether tool execution was successful */
	toolSuccess?: boolean;
	/** Timestamp if available */
	timestamp?: number;
}

/**
 * Truncation recommendation.
 */
export interface TruncationRecommendation {
	/** Message index to truncate */
	messageIndex: number;
	/** Recommended action */
	action: "summarize" | "remove" | "keep_summary" | "keep_full";
	/** Importance score */
	importanceScore: number;
	/** Estimated token savings */
	estimatedSavings: number;
	/** Reason for recommendation */
	reason: string;
	/** Priority (1 = truncate first) */
	priority: number;
}

/**
 * Context importance analysis result.
 */
export interface ContextImportanceAnalysis {
	/** Total messages analyzed */
	totalMessages: number;
	/** Total estimated tokens */
	totalTokens: number;
	/** Average importance score */
	averageScore: number;
	/** Score distribution by level */
	scoreDistribution: Map<ImportanceLevel, number>;
	/** Truncation recommendations */
	truncationRecommendations: TruncationRecommendation[];
	/** Estimated total savings if recommendations followed */
	estimatedTotalSavings: number;
	/** Critical messages that should never be truncated */
	criticalMessages: number[];
	/** Analysis timestamp */
	timestamp: number;
}

/**
 * Context importance configuration.
 */
export interface ContextImportanceConfig {
	/** Role weights for importance scoring */
	roleWeights: Map<MessageRole, number>;
	/** Recency factor weight */
	recencyWeight: number;
	/** Content type weights */
	contentTypeWeights: Map<ContentType, number>;
	/** Minimum importance score to keep */
	minKeepScore: number;
	/** Maximum truncatable message size */
	maxTruncatableSize: number;
	/** Whether to analyze tool success */
	analyzeToolSuccess: boolean;
	/** Whether to detect file references */
	detectFileReferences: boolean;
	/** Whether to detect plan references */
	detectPlanReferences: boolean;
}

/**
 * Default context importance configuration.
 */
export const DEFAULT_CONTEXT_IMPORTANCE_CONFIG: ContextImportanceConfig = {
	roleWeights: new Map([
		["system", 100], // System messages are always critical
		["user", 70], // User instructions are high importance
		["assistant", 50], // Assistant responses are medium importance
		["tool_result", 40], // Tool results can often be truncated
	]),
	recencyWeight: 0.3, // Recent messages get +30% bonus
	contentTypeWeights: new Map([
		["system_prompt", 100],
		["skill_definition", 90],
		["file_content", 60],
		["plan_output", 70],
		["error_message", 80],
		["tool_result", 40],
		["user_instruction", 70],
		["assistant_response", 50],
		["unknown", 30],
	]),
	minKeepScore: 40, // Messages below 40 are truncatable
	maxTruncatableSize: 5000, // Don't truncate very large messages automatically
	analyzeToolSuccess: true,
	detectFileReferences: true,
	detectPlanReferences: true,
};

/**
 * Context importance statistics.
 */
export interface ContextImportanceStats {
	/** Total analyses performed */
	totalAnalyses: number;
	/** Total truncation recommendations made */
	totalRecommendations: number;
	/** Total estimated savings */
	totalEstimatedSavings: number;
	/** Average importance score across all messages */
	averageImportanceScore: number;
	/** Messages truncated (simulated) */
	messagesTruncated: number;
	/** Critical messages preserved */
	criticalMessagesPreserved: number;
	/** Most common truncation action */
	mostCommonAction: string;
	/** Last analysis timestamp */
	lastAnalysisTimestamp: number | null;
}

/**
 * Context Importance Scorer - Intelligent message importance analysis.
 */
export class ContextImportanceScorer {
	private config: ContextImportanceConfig;
	private stats: ContextImportanceStats = {
		totalAnalyses: 0,
		totalRecommendations: 0,
		totalEstimatedSavings: 0,
		averageImportanceScore: 0,
		messagesTruncated: 0,
		criticalMessagesPreserved: 0,
		mostCommonAction: "keep_full",
		lastAnalysisTimestamp: null,
	};

	constructor(config: Partial<ContextImportanceConfig> = {}) {
		this.config = { ...DEFAULT_CONTEXT_IMPORTANCE_CONFIG, ...config };
	}

	/**
	 * Score a single message for importance.
	 */
	scoreMessage(message: MessageForAnalysis): MessageImportanceScore {
		const factors = new Map<ImportanceFactor, number>();
		let weightedSum = 0;
		let totalWeight = 0;

		// 1. Role weight (weight: 3.0)
		const roleWeight = this.config.roleWeights.get(message.role) ?? 50;
		factors.set("role_weight", roleWeight);
		weightedSum += roleWeight * 3.0;
		totalWeight += 3.0;

		// 2. Recency factor (more recent = more important) (weight: 1.0)
		const recencyFactor = this.calculateRecencyFactor(message.index, message.totalMessages);
		factors.set("recency", recencyFactor);
		weightedSum += recencyFactor * 1.0;
		totalWeight += 1.0;

		// 3. Content type classification and weight (weight: 2.0)
		const contentType = this.classifyContentType(message);
		const contentWeight = this.config.contentTypeWeights.get(contentType) ?? 30;
		factors.set("content_type", contentWeight);
		weightedSum += contentWeight * 2.0;
		totalWeight += 2.0;

		// 4. Tool success factor (failed tools are more important for debugging) (weight: 0.5)
		if (this.config.analyzeToolSuccess && message.toolSuccess !== undefined) {
			const toolFactor = message.toolSuccess ? 30 : 70;
			factors.set("tool_success", toolFactor);
			weightedSum += toolFactor * 0.5;
			totalWeight += 0.5;
		}

		// 5. Error presence (messages with errors are important) (weight: 1.5)
		const hasError = this.detectError(message.content);
		const errorScore = hasError ? 80 : 20;
		factors.set("error_presence", errorScore);
		weightedSum += errorScore * 1.5;
		totalWeight += 1.5;

		// 6. File reference detection (weight: 0.5)
		if (this.config.detectFileReferences) {
			const hasFileRef = this.detectFileReference(message.content);
			const fileScore = hasFileRef ? 60 : 30;
			factors.set("file_reference", fileScore);
			weightedSum += fileScore * 0.5;
			totalWeight += 0.5;
		}

		// 7. Plan reference detection (weight: 0.5)
		if (this.config.detectPlanReferences) {
			const hasPlanRef = this.detectPlanReference(message.content);
			const planScore = hasPlanRef ? 70 : 30;
			factors.set("plan_reference", planScore);
			weightedSum += planScore * 0.5;
			totalWeight += 0.5;
		}

		// 8. Durable anchor factor (task framing/constraints/acceptance criteria should persist) (weight: 1.5)
		const durableAnchorScore = this.detectDurableAnchor(message);
		factors.set("durable_anchor", durableAnchorScore);
		weightedSum += durableAnchorScore * 1.5;
		totalWeight += 1.5;

		// 9. Size factor (large messages may be truncatable) (weight: 0.5)
		const tokens = estimateTokens(message.content);
		const sizeFactor = this.calculateSizeFactor(tokens);
		factors.set("size_factor", sizeFactor);
		weightedSum += sizeFactor * 0.5;
		totalWeight += 0.5;

		// Calculate weighted average (0-100 scale)
		const normalizedScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;

		// Determine importance level
		const level = this.classifyImportanceLevel(normalizedScore);

		// Determine truncation capability
		const canTruncate = this.canTruncateMessage(normalizedScore, tokens, message.role);
		const truncationStrategy = canTruncate
			? this.determineTruncationStrategy(normalizedScore, tokens, contentType)
			: undefined;
		const estimatedSavings = canTruncate
			? this.calculateSavings(tokens, truncationStrategy ?? "remove")
			: 0;

		return {
			score: normalizedScore,
			level,
			factors,
			contentType,
			tokens,
			canTruncate,
			truncationStrategy,
			estimatedSavings: canTruncate ? estimatedSavings : undefined,
		};
	}

	/**
	 * Analyze a full conversation for importance and truncation recommendations.
	 */
	analyzeConversation(messages: MessageForAnalysis[]): ContextImportanceAnalysis {
		this.stats.totalAnalyses++;
		const timestamp = Date.now();
		this.stats.lastAnalysisTimestamp = timestamp;

		const scores: MessageImportanceScore[] = [];
		const scoreDistribution = new Map<ImportanceLevel, number>();
		const truncationRecommendations: TruncationRecommendation[] = [];
		const criticalMessages: number[] = [];

		let totalTokens = 0;
		let totalScore = 0;
		let estimatedTotalSavings = 0;

		// Initialize distribution
		scoreDistribution.set("critical", 0);
		scoreDistribution.set("high", 0);
		scoreDistribution.set("medium", 0);
		scoreDistribution.set("low", 0);
		scoreDistribution.set("truncatable", 0);

		// Score each message
		for (const message of messages) {
			const score = this.scoreMessage(message);
			scores.push(score);
			totalTokens += score.tokens;
			totalScore += score.score;

			// Update distribution
			const currentCount = scoreDistribution.get(score.level) ?? 0;
			scoreDistribution.set(score.level, currentCount + 1);

			// Track critical messages
			if (score.level === "critical") {
				criticalMessages.push(message.index);
				this.stats.criticalMessagesPreserved++;
			}

			// Generate truncation recommendation
			if (score.canTruncate && score.truncationStrategy) {
				const recommendation: TruncationRecommendation = {
					messageIndex: message.index,
					action: score.truncationStrategy,
					importanceScore: score.score,
					estimatedSavings: score.estimatedSavings ?? 0,
					reason: this.generateRecommendationReason(score),
					priority: this.calculateTruncationPriority(score, message.index, messages.length),
				};
				truncationRecommendations.push(recommendation);
				estimatedTotalSavings += score.estimatedSavings ?? 0;
				this.stats.totalRecommendations++;
			}
		}

		// Sort recommendations by priority
		truncationRecommendations.sort((a, b) => a.priority - b.priority);

		// Update stats
		this.stats.totalEstimatedSavings += estimatedTotalSavings;
		this.stats.averageImportanceScore =
			(this.stats.averageImportanceScore * (this.stats.totalAnalyses - 1) +
				totalScore / messages.length) /
			this.stats.totalAnalyses;

		// Track most common action
		if (truncationRecommendations.length > 0) {
			const actionCounts = new Map<string, number>();
			for (const rec of truncationRecommendations) {
				const count = actionCounts.get(rec.action) ?? 0;
				actionCounts.set(rec.action, count + 1);
			}
			let maxCount = 0;
			let mostCommon = "keep_full";
			for (const [action, count] of actionCounts) {
				if (count > maxCount) {
					maxCount = count;
					mostCommon = action;
				}
			}
			this.stats.mostCommonAction = mostCommon;
		}

		return {
			totalMessages: messages.length,
			totalTokens,
			averageScore: totalScore / messages.length,
			scoreDistribution,
			truncationRecommendations,
			estimatedTotalSavings,
			criticalMessages,
			timestamp,
		};
	}

	/**
	 * Get truncation recommendations for a specific target savings.
	 */
	getRecommendationsForTarget(
		messages: MessageForAnalysis[],
		targetSavings: number,
	): TruncationRecommendation[] {
		const analysis = this.analyzeConversation(messages);
		const recommendations: TruncationRecommendation[] = [];
		let accumulatedSavings = 0;

		for (const rec of analysis.truncationRecommendations) {
			if (accumulatedSavings >= targetSavings) {
				break;
			}
			recommendations.push(rec);
			accumulatedSavings += rec.estimatedSavings;
		}

		return recommendations;
	}

	/**
	 * Calculate recency factor (0-100).
	 * More recent messages get higher scores.
	 */
	private calculateRecencyFactor(index: number, total: number): number {
		if (total <= 1) return 100;

		const normalizedIndex = index / (total - 1);
		const initialAnchorCount = Math.max(2, Math.ceil(total * 0.1));
		const recentAnchorCount = Math.max(3, Math.ceil(total * 0.2));

		// Preserve a small initial anchor window for task framing and constraints.
		if (index < initialAnchorCount) {
			return Math.max(75, 100 - index * 10);
		}

		// Preserve the recent working set most strongly.
		if (index >= total - recentAnchorCount) {
			const distanceFromEnd = total - 1 - index;
			return Math.max(85, 100 - distanceFromEnd * 5);
		}

		// Stale middle conversation should decay to avoid long-term context drift.
		const midpointDistance = Math.abs(normalizedIndex - 0.5) * 2; // 0 at middle, 1 near edges
		return Math.round(20 + midpointDistance * 35); // 20-55 range for middle history
	}

	/**
	 * Classify content type based on message content.
	 */
	private classifyContentType(message: MessageForAnalysis): ContentType {
		const content = message.content.toLowerCase();

		// System prompt detection
		if (message.role === "system") {
			if (content.includes("skill") || content.includes("superpowers")) {
				return "skill_definition";
			}
			return "system_prompt";
		}

		// User instruction detection
		if (message.role === "user") {
			return "user_instruction";
		}

		// Tool result detection
		if (message.role === "tool_result") {
			return "tool_result";
		}

		// Error detection
		if (
			content.includes("error") ||
			content.includes("failed") ||
			content.includes("exception") ||
			content.includes("timeout")
		) {
			return "error_message";
		}

		// Plan output detection
		if (
			content.includes("plan") ||
			content.includes("step") ||
			content.includes("phase") ||
			content.includes("roadmap")
		) {
			return "plan_output";
		}

		// File content detection
		if (
			content.includes("read file") ||
			content.includes("file content") ||
			content.includes("```typescript") ||
			content.includes("```javascript")
		) {
			return "file_content";
		}

		// Assistant response
		if (message.role === "assistant") {
			return "assistant_response";
		}

		return "unknown";
	}

	/**
	 * Detect if content contains an error.
	 */
	private detectError(content: string): boolean {
		const errorPatterns = [
			"error",
			"failed",
			"exception",
			"timeout",
			"crash",
			"bug",
			"fix",
			"issue",
			"problem",
		];
		const lowerContent = content.toLowerCase();
		return errorPatterns.some((pattern) => lowerContent.includes(pattern));
	}

	/**
	 * Detect if content references a file.
	 */
	private detectFileReference(content: string): boolean {
		const filePatterns = [
			"read file",
			"write file",
			"edit file",
			"src/",
			".ts",
			".js",
			".json",
			"file:",
			"path:",
		];
		const lowerContent = content.toLowerCase();
		return filePatterns.some((pattern) => lowerContent.includes(pattern));
	}

	/**
	 * Detect if content references a plan.
	 */
	private detectPlanReference(content: string): boolean {
		const planPatterns = [
			"plan",
			"roadmap",
			"phase",
			"step",
			"task",
			"workflow",
			"implement",
			"complete",
		];
		const lowerContent = content.toLowerCase();
		return planPatterns.some((pattern) => lowerContent.includes(pattern));
	}

	/**
	 * Detect messages that encode durable task anchors worth preserving across long sessions.
	 */
	private detectDurableAnchor(message: MessageForAnalysis): number {
		const lowerContent = message.content.toLowerCase();
		const durablePatterns = [
			"must",
			"do not",
			"always",
			"never",
			"required",
			"acceptance criteria",
			"success criteria",
			"constraint",
			"selected:",
			"reason:",
			"goal",
			"task selection",
			"implement",
			"verify",
			"commit",
			"push",
			"build",
			"test",
			"issue #",
			"roadmap",
			"src/",
			".ts",
			"files to modify",
			"build sequence",
		];
		const lightweightNoisePatterns = [
			"progress update",
			"still working",
			"continuing",
			"verbose tool output",
			"routine update",
			"status update",
		];

		const durableHits = durablePatterns.filter((pattern) => lowerContent.includes(pattern)).length;
		const noiseHits = lightweightNoisePatterns.filter((pattern) =>
			lowerContent.includes(pattern),
		).length;

		let score = 20 + Math.min(4, durableHits) * 18 - noiseHits * 10;

		if (message.role === "system") {
			score += 15;
		} else if (message.role === "user") {
			score += 10;
		}

		if (message.index < Math.max(3, Math.ceil(message.totalMessages * 0.15))) {
			score += 10;
		}

		return Math.max(10, Math.min(100, score));
	}

	/**
	 * Calculate size factor (larger messages may be truncatable).
	 */
	private calculateSizeFactor(tokens: number): number {
		// Small messages (< 500 tokens) are less truncatable
		if (tokens < 500) return 80;
		// Medium messages (500-2000) are somewhat truncatable
		if (tokens < 2000) return 50;
		// Large messages (> 2000) are truncatable
		return 20;
	}

	/**
	 * Classify importance level based on score.
	 */
	private classifyImportanceLevel(score: number): ImportanceLevel {
		if (score >= 80) return "critical";
		if (score >= 60) return "high";
		if (score >= 40) return "medium";
		if (score >= 20) return "low";
		return "truncatable";
	}

	/**
	 * Determine if a message can be truncated.
	 */
	private canTruncateMessage(score: number, tokens: number, role: MessageRole): boolean {
		// System messages are never truncated
		if (role === "system") return false;
		// Critical messages are never truncated
		if (score >= 80) return false;
		// Very small messages have negligible savings
		if (tokens < 100) return false;
		// Score below threshold is truncatable
		return score < this.config.minKeepScore;
	}

	/**
	 * Determine truncation strategy for a message.
	 */
	private determineTruncationStrategy(
		score: number,
		tokens: number,
		contentType: ContentType,
	): "summarize" | "remove" | "keep_summary" {
		// Large tool results can be summarized
		if (contentType === "tool_result" && tokens > 1000) {
			return "summarize";
		}
		// Very low score messages can be removed entirely
		if (score < 20) {
			return "remove";
		}
		// Medium importance messages should keep a summary
		return "keep_summary";
	}

	/**
	 * Calculate estimated savings from truncation.
	 */
	private calculateSavings(tokens: number, strategy: string): number {
		switch (strategy) {
			case "remove":
				return tokens;
			case "summarize":
				return tokens * 0.7; // Keep 30% as summary
			case "keep_summary":
				return tokens * 0.5; // Keep 50% as summary
			default:
				return 0;
		}
	}

	/**
	 * Generate reason for truncation recommendation.
	 */
	private generateRecommendationReason(score: MessageImportanceScore): string {
		const reasons: string[] = [];

		if (score.score < 20) {
			reasons.push("Very low importance score");
		} else if (score.score < 40) {
			reasons.push("Below minimum keep threshold");
		}

		if (score.tokens > 2000) {
			reasons.push("Large message size");
		}

		if (score.contentType === "tool_result") {
			reasons.push("Tool result can be summarized");
		}

		if (!score.factors.get("error_presence")) {
			reasons.push("No error information to preserve");
		}

		return reasons.join("; ") || "Truncatable based on scoring algorithm";
	}

	/**
	 * Calculate truncation priority (lower = truncate first).
	 */
	private calculateTruncationPriority(
		score: MessageImportanceScore,
		index: number,
		total: number,
	): number {
		// Lower importance = higher priority (lower number) for truncation
		const importancePriority = 100 - score.score;
		// Older messages = higher priority for truncation
		const agePriority = (1 - index / total) * 50;
		// Larger size = higher priority for truncation
		const sizePriority = Math.min(50, score.tokens / 100);

		return Math.round(importancePriority + agePriority + sizePriority);
	}

	/**
	 * Get statistics.
	 */
	getStats(): ContextImportanceStats {
		return { ...this.stats };
	}

	/**
	 * Get configuration.
	 */
	getConfig(): ContextImportanceConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration.
	 */
	updateConfig(newConfig: Partial<ContextImportanceConfig>): void {
		this.config = { ...this.config, ...newConfig };
	}

	/**
	 * Reset statistics.
	 */
	reset(): void {
		this.stats = {
			totalAnalyses: 0,
			totalRecommendations: 0,
			totalEstimatedSavings: 0,
			averageImportanceScore: 0,
			messagesTruncated: 0,
			criticalMessagesPreserved: 0,
			mostCommonAction: "keep_full",
			lastAnalysisTimestamp: null,
		};
	}
}

// Global instance for tracking across the agent
let globalContextImportanceScorer: ContextImportanceScorer | null = null;

/**
 * Get the global context importance scorer.
 */
export function getGlobalContextImportanceScorer(): ContextImportanceScorer {
	if (!globalContextImportanceScorer) {
		globalContextImportanceScorer = new ContextImportanceScorer();
	}
	return globalContextImportanceScorer;
}

/**
 * Initialize the global context importance scorer with config.
 */
export function initGlobalContextImportanceScorer(
	config: Partial<ContextImportanceConfig> = {},
): ContextImportanceScorer {
	globalContextImportanceScorer = new ContextImportanceScorer(config);
	return globalContextImportanceScorer;
}

/**
 * Re-export estimateTokens for convenience.
 */
export { estimateTokens };
