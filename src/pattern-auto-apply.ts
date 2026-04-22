/**
 * Pattern Auto-Application - Automatic pattern matching and application
 *
 * This module enables automatic recognition of similar task contexts and
 * proactive suggestion or application of learned successful patterns.
 *
 * Inspired by:
 * - Mini-SWE-Agent pattern-based improvements
 * - SWE-agent action replay
 * - Aider context-aware suggestions
 *
 * Key capabilities:
 * 1. Match new tasks against stored patterns
 * 2. Calculate similarity scores based on task context
 * 3. Suggest applicable patterns for new tasks
 * 4. Auto-apply high-confidence patterns
 * 5. Track pattern application success rates
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { normalizeScorecardResult, parseScorecardRows } from "./scorecard.js";
import type { ExtractedPattern, PatternType } from "./session-replay.js";
import { getSessionReplayManager } from "./session-replay.js";

// Re-export PatternType for convenience
export type { PatternType } from "./session-replay.js";

/**
 * Pattern match result
 */
export interface PatternMatch {
	/** Matched pattern */
	pattern: ExtractedPattern;
	/** Similarity score (0-100) */
	similarityScore: number;
	/** Match factors */
	matchFactors: string[];
	/** Recommended application */
	recommendation: string;
	/** Whether auto-apply is recommended */
	autoApplyRecommended: boolean;
}

/**
 * Auto-apply result
 */
export interface AutoApplyResult {
	/** Pattern that was applied */
	patternId: string;
	/** Application success */
	success: boolean;
	/** Actions taken */
	actionsTaken: string[];
	/** Errors encountered */
	errors: string[];
	/** Time saved (estimated minutes) */
	timeSaved: number;
	/** Confidence at application time */
	confidence: number;
}

/**
 * Pattern context for matching
 */
export interface PatternContext {
	/** Task type */
	taskType?: "capability" | "reliability" | "feature";
	/** Task description */
	taskDescription?: string;
	/** Files being worked on */
	files?: string[];
	/** Tools used so far */
	toolsUsed?: string[];
	/** Errors encountered */
	errors?: string[];
	/** Skills available */
	skillsAvailable?: string[];
	/** Keywords from task */
	keywords?: string[];
}

/**
 * Pattern auto-apply configuration
 */
export interface PatternAutoApplyConfig {
	/** Enable auto-apply */
	enabled: boolean;
	/** Minimum similarity score to suggest (0-100) */
	minSimilarityScore: number;
	/** Minimum confidence for auto-apply (0-100) */
	autoApplyConfidenceThreshold: number;
	/** Minimum success correlation for auto-apply (0-1) */
	autoApplySuccessThreshold: number;
	/** Maximum patterns to suggest */
	maxSuggestions: number;
	/** Learn from application results */
	learnFromResults: boolean;
	/** Auto-apply pattern types */
	autoApplyPatternTypes: PatternType[];
	/** Optional MEMORY.md path for scorecard fallbacks */
	memoryPath?: string;
	/** Maximum fallback patterns derived from MEMORY.md */
	fallbackMaxPatterns: number;
}

/**
 * Pattern application record
 */
export interface PatternApplicationRecord {
	/** Record ID */
	id: string;
	/** Pattern ID */
	patternId: string;
	/** Application timestamp */
	timestamp: string;
	/** Context at application time */
	context: PatternContext;
	/** Similarity score */
	similarityScore: number;
	/** Result */
	result: "success" | "partial" | "failed" | "skipped";
	/** Notes */
	notes: string[];
}

/**
 * Auto-apply statistics
 */
export interface AutoApplyStats {
	/** Total matches found */
	totalMatches: number;
	/** Total patterns applied */
	totalApplied: number;
	/** Successful applications */
	successfulApplications: number;
	/** Failed applications */
	failedApplications: number;
	/** Estimated time saved (minutes) */
	totalTimeSaved: number;
	/** Average similarity score */
	avgSimilarityScore: number;
	/** Most applied patterns */
	mostAppliedPatterns: Array<{ patternId: string; count: number; successRate: number }>;
	/** Pattern success rates by type */
	successRatesByType: Record<PatternType, { applied: number; success: number }>;
	/** Recent applications */
	recentApplications: PatternApplicationRecord[];
	/** Last match time */
	lastMatchTime: string | null;
}

// Default configuration
const DEFAULT_CONFIG: PatternAutoApplyConfig = {
	enabled: true,
	minSimilarityScore: 50,
	autoApplyConfidenceThreshold: 80,
	autoApplySuccessThreshold: 0.75,
	maxSuggestions: 5,
	learnFromResults: true,
	autoApplyPatternTypes: ["success-pattern", "tool-sequence", "skill-usage"],
	memoryPath: join(process.cwd(), "MEMORY.md"),
	fallbackMaxPatterns: 5,
};

/**
 * PatternAutoApplier class
 * Manages automatic pattern matching and application
 */
export class PatternAutoApplier {
	private config: PatternAutoApplyConfig;
	private dataPath: string;
	private stats: AutoApplyStats;
	private applicationHistory: PatternApplicationRecord[];
	private receivedPatterns: ExtractedPattern[];

	constructor(config?: Partial<PatternAutoApplyConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.dataPath = join(homedir(), ".paimon", "pattern-auto-apply.json");
		this.applicationHistory = [];
		this.receivedPatterns = [];
		this.stats = this.initStats();
		this.loadState();
		this.registerForPatternFeeds();
	}

	/**
	 * Register to receive patterns from session replay
	 */
	private registerForPatternFeeds(): void {
		// Lazy import to avoid circular dependency
		try {
			const replayManager = getSessionReplayManager();
			replayManager.registerPatternFeedCallback((patterns) => {
				this.receivePatterns(patterns);
			});
		} catch {
			// Session replay not available yet
		}
	}

	/**
	 * Receive patterns from session replay
	 */
	receivePatterns(patterns: ExtractedPattern[]): void {
		for (const pattern of patterns) {
			// Only store high-confidence patterns
			if (pattern.confidence >= this.config.autoApplyConfidenceThreshold) {
				// Check if pattern already exists
				const existingIndex = this.receivedPatterns.findIndex((p) => p.id === pattern.id);
				if (existingIndex === -1) {
					this.receivedPatterns.push(pattern);
				} else {
					// Update existing pattern with new data
					this.receivedPatterns[existingIndex] = pattern;
				}
			}
		}

		// Keep only last 100 patterns
		if (this.receivedPatterns.length > 100) {
			this.receivedPatterns = this.receivedPatterns.slice(-100);
		}

		this.saveState();
	}

	/**
	 * Initialize statistics
	 */
	private initStats(): AutoApplyStats {
		return {
			totalMatches: 0,
			totalApplied: 0,
			successfulApplications: 0,
			failedApplications: 0,
			totalTimeSaved: 0,
			avgSimilarityScore: 0,
			mostAppliedPatterns: [],
			successRatesByType: {
				"success-pattern": { applied: 0, success: 0 },
				"failure-pattern": { applied: 0, success: 0 },
				"tool-sequence": { applied: 0, success: 0 },
				"error-recovery": { applied: 0, success: 0 },
				"decision-point": { applied: 0, success: 0 },
				"skill-usage": { applied: 0, success: 0 },
			},
			recentApplications: [],
			lastMatchTime: null,
		};
	}

	/**
	 * Load state from disk
	 */
	private loadState(): void {
		if (existsSync(this.dataPath)) {
			try {
				const content = readFileSync(this.dataPath, "utf-8");
				const state = JSON.parse(content);
				if (state.stats) {
					this.stats = state.stats;
				}
				if (state.applicationHistory) {
					this.applicationHistory = state.applicationHistory;
				}
				if (state.receivedPatterns) {
					this.receivedPatterns = state.receivedPatterns;
				}
				if (state.config) {
					this.config = { ...this.config, ...state.config };
				}
			} catch {
				// Ignore errors
			}
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
			const state = {
				config: this.config,
				stats: this.stats,
				applicationHistory: this.applicationHistory.slice(-100), // Keep last 100
				receivedPatterns: this.receivedPatterns.slice(-100), // Keep last 100
			};
			writeFileSync(this.dataPath, JSON.stringify(state, null, 2));
		} catch {
			// Ignore errors
		}
	}

	/**
	 * Match patterns against context
	 */
	matchPatterns(context: PatternContext): PatternMatch[] {
		if (!this.config.enabled) {
			return [];
		}

		const combinedPatterns = this.getCandidatePatterns();
		if (combinedPatterns.length === 0) {
			return [];
		}

		const matches: PatternMatch[] = [];

		for (const pattern of combinedPatterns) {
			const matchResult = this.calculatePatternMatch(pattern, context);
			if (matchResult.similarityScore >= this.config.minSimilarityScore) {
				matches.push(matchResult);
			}
		}

		// Sort by similarity score
		matches.sort((a, b) => b.similarityScore - a.similarityScore);

		// Update stats
		this.stats.totalMatches += matches.length;
		this.stats.lastMatchTime = new Date().toISOString();
		if (matches.length > 0) {
			const totalSimilarity = matches.reduce((sum, m) => sum + m.similarityScore, 0);
			this.stats.avgSimilarityScore = totalSimilarity / matches.length;
		}
		this.saveState();

		return matches.slice(0, this.config.maxSuggestions);
	}

	private getCandidatePatterns(): ExtractedPattern[] {
		const replayManager = getSessionReplayManager();
		const allPatterns = replayManager.getPatterns();

		const combinedPatterns = [...allPatterns];
		for (const receivedPattern of this.receivedPatterns) {
			if (!combinedPatterns.find((p) => p.id === receivedPattern.id)) {
				combinedPatterns.push(receivedPattern);
			}
		}

		if (combinedPatterns.length > 0) {
			return combinedPatterns;
		}

		return this.getScorecardFallbackPatterns();
	}

	private getScorecardFallbackPatterns(): ExtractedPattern[] {
		const memoryPath = this.config.memoryPath;
		if (!memoryPath || !existsSync(memoryPath)) {
			return [];
		}

		try {
			const content = readFileSync(memoryPath, "utf-8");
			const rows = parseScorecardRows(content).slice(0, this.config.fallbackMaxPatterns);
			return rows.map((row, index) => {
				const normalizedResult = normalizeScorecardResult(row.result, row.firstTry);
				const successful = normalizedResult !== "negative";
				const skills = (row.skillsUsed || "")
					.split(",")
					.map((skill) => skill.trim())
					.filter(Boolean);
				const errors = row.errors && row.errors !== "none" ? [row.errors] : [];
				const suggestionParts = [`Reuse the MEMORY.md approach from ${row.date}`];
				if (skills.length > 0) {
					suggestionParts.push(`consider skills: ${skills.join(", ")}`);
				}
				if (row.enables) {
					suggestionParts.push(`enabled follow-on work: ${row.enables}`);
				}

				return {
					id: `scorecard-pattern-${row.date}-${index}`,
					type: successful ? "success-pattern" : "failure-pattern",
					description: row.description,
					confidence: successful ? 78 : 60,
					foundIn: ["MEMORY.md"],
					successCorrelation: successful ? 0.78 : 0.35,
					suggestedApplication: suggestionParts.join("; "),
					details: {
						source: "scorecard",
						date: row.date,
						taskType: row.taskType,
						time: row.time,
						skills,
						errors,
						enables: row.enables || "",
					},
				};
			});
		} catch {
			return [];
		}
	}

	/**
	 * Calculate pattern match against context
	 */
	private calculatePatternMatch(pattern: ExtractedPattern, context: PatternContext): PatternMatch {
		let score = 0;
		const factors: string[] = [];

		// Task type matching
		if (context.taskType) {
			const patternTaskType = pattern.details.taskType as string;
			if (patternTaskType && patternTaskType === context.taskType) {
				score += 25;
				factors.push(`Task type match: ${context.taskType}`);
			}
		}

		// Keyword matching from description
		if (context.taskDescription && context.keywords) {
			const patternKeywords = this.extractKeywords(pattern.description);
			const matchingKeywords = context.keywords.filter((k) =>
				patternKeywords.some((pk) => pk.includes(k.toLowerCase()) || k.toLowerCase().includes(pk)),
			);
			if (matchingKeywords.length > 0) {
				const keywordScore = Math.min(25, matchingKeywords.length * 5);
				score += keywordScore;
				factors.push(`Keywords: ${matchingKeywords.slice(0, 3).join(", ")}`);
			}
		}

		// Tool sequence matching
		if (context.toolsUsed && pattern.type === "tool-sequence") {
			const patternSequence = pattern.details.sequence as string[];
			if (patternSequence && Array.isArray(patternSequence)) {
				const matchingTools = context.toolsUsed.filter((t) => patternSequence.includes(t));
				if (matchingTools.length > 0) {
					const toolScore = Math.min(25, matchingTools.length * 8);
					score += toolScore;
					factors.push(`Tools match: ${matchingTools.slice(0, 3).join(", ")}`);
				}
			}
		}

		// Error recovery matching
		if (context.errors && context.errors.length > 0 && pattern.type === "error-recovery") {
			const patternError = pattern.details.errorOutput as string;
			if (patternError) {
				const errorMatch = context.errors.some(
					(e) =>
						e.toLowerCase().includes(patternError.toLowerCase().slice(0, 30)) ||
						patternError.toLowerCase().includes(e.toLowerCase().slice(0, 30)),
				);
				if (errorMatch) {
					score += 30;
					factors.push("Similar error pattern");
				}
			}
		}

		// Success correlation bonus
		if (pattern.successCorrelation > 0.7) {
			score += 15;
			factors.push("High success rate pattern");
		}

		// Confidence bonus
		if (pattern.confidence > 80) {
			score += 10;
			factors.push("High confidence pattern");
		}

		// Cap score at 100
		const similarityScore = Math.min(100, score);

		// Determine if auto-apply is recommended
		const autoApplyRecommended =
			similarityScore >= this.config.autoApplyConfidenceThreshold &&
			pattern.successCorrelation >= this.config.autoApplySuccessThreshold &&
			this.config.autoApplyPatternTypes.includes(pattern.type);

		return {
			pattern,
			similarityScore,
			matchFactors: factors,
			recommendation: pattern.suggestedApplication,
			autoApplyRecommended,
		};
	}

	/**
	 * Extract keywords from text
	 */
	private extractKeywords(text: string): string[] {
		const stopWords = new Set([
			"the",
			"a",
			"an",
			"and",
			"or",
			"but",
			"in",
			"on",
			"at",
			"to",
			"for",
			"of",
			"with",
			"by",
			"from",
			"is",
			"are",
			"was",
			"were",
			"be",
			"been",
			"being",
			"have",
			"has",
			"had",
			"do",
			"does",
			"did",
			"will",
			"would",
			"could",
			"should",
			"may",
			"might",
			"must",
			"shall",
			"this",
			"that",
		]);

		return text
			.toLowerCase()
			.split(/\W+/)
			.filter((word) => word.length > 2 && !stopWords.has(word))
			.slice(0, 20);
	}

	/**
	 * Suggest patterns for a context (without auto-applying)
	 */
	suggestPatterns(context: PatternContext): PatternMatch[] {
		return this.matchPatterns(context);
	}

	/**
	 * Apply a specific pattern
	 */
	applyPattern(patternId: string, context: PatternContext): AutoApplyResult {
		const patterns = this.getCandidatePatterns();
		const pattern = patterns.find((p) => p.id === patternId);

		if (!pattern) {
			return {
				patternId,
				success: false,
				actionsTaken: [],
				errors: ["Pattern not found"],
				timeSaved: 0,
				confidence: 0,
			};
		}

		const actions: string[] = [];
		const errors: string[] = [];
		let timeSaved = 0;

		// Apply based on pattern type
		switch (pattern.type) {
			case "tool-sequence": {
				const sequence = pattern.details.sequence as string[];
				if (sequence && Array.isArray(sequence)) {
					actions.push(`Suggested tool sequence: ${sequence.join(" → ")}`);
					timeSaved = sequence.length * 2; // ~2 min per tool step
				}
				break;
			}
			case "error-recovery": {
				const recoverySequence = pattern.details.recoverySequence as string[];
				if (recoverySequence && Array.isArray(recoverySequence)) {
					actions.push(`Recovery sequence: ${recoverySequence.join(" → ")}`);
					timeSaved = 5; // Error recovery saves ~5 min
				}
				break;
			}
			case "skill-usage": {
				const skills = pattern.details.skills as string[];
				if (skills && Array.isArray(skills)) {
					actions.push(`Recommended skills: ${skills.join(", ")}`);
					timeSaved = 3; // Skill suggestion saves ~3 min
				}
				break;
			}
			case "success-pattern": {
				actions.push(`Apply pattern: ${pattern.description}`);
				timeSaved = 10; // Success pattern saves ~10 min
				break;
			}
			case "decision-point": {
				actions.push(`Consider decision: ${pattern.description}`);
				timeSaved = 2;
				break;
			}
			default:
				errors.push(`Unknown pattern type: ${pattern.type}`);
		}

		const success = actions.length > 0 && errors.length === 0;

		// Record application
		const record: PatternApplicationRecord = {
			id: `app-${Date.now()}`,
			patternId,
			timestamp: new Date().toISOString(),
			context,
			similarityScore: pattern.confidence,
			result: success ? "success" : errors.length > 0 ? "failed" : "partial",
			notes: actions,
		};

		this.applicationHistory.push(record);
		this.stats.totalApplied++;
		if (success) {
			this.stats.successfulApplications++;
		} else {
			this.stats.failedApplications++;
		}
		this.stats.totalTimeSaved += timeSaved;

		// Update pattern type stats
		if (this.stats.successRatesByType[pattern.type]) {
			this.stats.successRatesByType[pattern.type].applied++;
			if (success) {
				this.stats.successRatesByType[pattern.type].success++;
			}
		}

		// Update most applied patterns
		const existingEntry = this.stats.mostAppliedPatterns.find((p) => p.patternId === patternId);
		if (existingEntry) {
			existingEntry.count++;
			existingEntry.successRate = existingEntry.count / (existingEntry.count + (success ? 0 : 1));
		} else {
			this.stats.mostAppliedPatterns.push({
				patternId,
				count: 1,
				successRate: success ? 1 : 0,
			});
		}
		this.stats.mostAppliedPatterns.sort((a, b) => b.count - a.count);
		this.stats.mostAppliedPatterns = this.stats.mostAppliedPatterns.slice(0, 10);

		// Update recent applications
		this.stats.recentApplications = this.applicationHistory.slice(-10);

		this.saveState();

		return {
			patternId,
			success,
			actionsTaken: actions,
			errors,
			timeSaved,
			confidence: pattern.confidence,
		};
	}

	/**
	 * Auto-apply best matching patterns
	 */
	autoApplyPatterns(context: PatternContext): AutoApplyResult[] {
		if (!this.config.enabled) {
			return [];
		}

		const matches = this.matchPatterns(context);
		const results: AutoApplyResult[] = [];

		for (const match of matches) {
			if (match.autoApplyRecommended) {
				const result = this.applyPattern(match.pattern.id, context);
				results.push(result);
			}
		}

		return results;
	}

	/**
	 * Get all available patterns with match potential
	 */
	getAvailablePatterns(): ExtractedPattern[] {
		return this.getCandidatePatterns();
	}

	/**
	 * Get patterns by type
	 */
	getPatternsByType(type: PatternType): ExtractedPattern[] {
		return this.getCandidatePatterns().filter((pattern) => pattern.type === type);
	}

	/**
	 * Get statistics
	 */
	getStats(): AutoApplyStats {
		return this.stats;
	}

	/**
	 * Get application history
	 */
	getApplicationHistory(limit?: number): PatternApplicationRecord[] {
		const history = [...this.applicationHistory].reverse();
		return limit ? history.slice(0, limit) : history;
	}

	/**
	 * Get configuration
	 */
	getConfig(): PatternAutoApplyConfig {
		return this.config;
	}

	/**
	 * Update configuration
	 */
	updateConfig(updates: Partial<PatternAutoApplyConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveState();
	}

	/**
	 * Check if auto-apply is enabled
	 */
	isEnabled(): boolean {
		return this.config.enabled;
	}

	/**
	 * Enable or disable auto-apply
	 */
	setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveState();
	}

	/**
	 * Reset statistics
	 */
	resetStats(): void {
		this.stats = this.initStats();
		this.applicationHistory = [];
		this.saveState();
	}

	/**
	 * Clear application history
	 */
	clearHistory(): void {
		this.applicationHistory = [];
		this.stats.recentApplications = [];
		this.saveState();
	}

	/**
	 * Format statistics for display
	 */
	formatStats(): string {
		const lines: string[] = ["## Pattern Auto-Apply Statistics\n"];

		lines.push(`**Enabled:** ${this.config.enabled ? "Yes" : "No"}`);
		lines.push(`**Total Matches:** ${this.stats.totalMatches}`);
		lines.push(`**Total Applied:** ${this.stats.totalApplied}`);
		lines.push(
			`**Success Rate:** ${
				this.stats.totalApplied > 0
					? `${Math.round((this.stats.successfulApplications / this.stats.totalApplied) * 100)}%`
					: "N/A"
			}`,
		);
		lines.push(`**Total Time Saved:** ~${this.stats.totalTimeSaved} minutes`);
		lines.push(`**Avg Similarity:** ${Math.round(this.stats.avgSimilarityScore)}%\n`);

		// Most applied patterns
		if (this.stats.mostAppliedPatterns.length > 0) {
			lines.push("### Most Applied Patterns");
			for (const p of this.stats.mostAppliedPatterns.slice(0, 5)) {
				lines.push(
					`- ${p.patternId}: ${p.count} applications (${Math.round(p.successRate * 100)}% success)`,
				);
			}
			lines.push("");
		}

		// Success rates by type
		lines.push("### Success Rates by Pattern Type");
		for (const [type, data] of Object.entries(this.stats.successRatesByType)) {
			if (data.applied > 0) {
				const rate = Math.round((data.success / data.applied) * 100);
				lines.push(`- ${type}: ${data.applied} applied, ${rate}% success`);
			}
		}

		return lines.join("\n");
	}

	/**
	 * Format matches for display
	 */
	formatMatches(matches: PatternMatch[]): string {
		if (matches.length === 0) {
			return "No matching patterns found.";
		}

		const lines: string[] = [`## Pattern Matches (${matches.length})\n`];

		for (let i = 0; i < matches.length; i++) {
			const match = matches[i];
			lines.push(`### ${i + 1}. ${match.pattern.description}`);
			lines.push(`**Type:** ${match.pattern.type}`);
			lines.push(`**Similarity:** ${match.similarityScore}%`);
			lines.push(`**Confidence:** ${match.pattern.confidence}%`);
			lines.push(`**Success Correlation:** ${Math.round(match.pattern.successCorrelation * 100)}%`);
			lines.push(
				`**Auto-Apply:** ${match.autoApplyRecommended ? "✅ Recommended" : "⏸️ Manual review"}`,
			);
			lines.push(`**Match Factors:** ${match.matchFactors.join(", ")}`);
			lines.push(`**Recommendation:** ${match.recommendation}`);
			lines.push("");
		}

		return lines.join("\n");
	}
}

// Singleton instance
let autoApplierInstance: PatternAutoApplier | null = null;

/**
 * Get singleton PatternAutoApplier instance
 */
export function getPatternAutoApplier(): PatternAutoApplier {
	if (!autoApplierInstance) {
		autoApplierInstance = new PatternAutoApplier();
	}
	return autoApplierInstance;
}

/**
 * Initialize PatternAutoApplier with config
 */
export function initPatternAutoApplier(
	config?: Partial<PatternAutoApplyConfig>,
): PatternAutoApplier {
	autoApplierInstance = new PatternAutoApplier(config);
	return autoApplierInstance;
}
