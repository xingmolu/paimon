/**
 * Cross-Session Learning Transfer (RAG Enhancement Pattern)
 *
 * Automatically transfers learnings between related tasks by:
 * 1. Identifying similar past tasks using semantic similarity + RAG enrichment
 * 2. Extracting relevant patterns from successful sessions
 * 3. Warning about patterns from failed sessions
 * 4. Injecting proactive context at task start
 *
 * This improves first-try success rate and reduces rework.
 *
 * RAG Integration (Phase 63):
 * - Uses RagModule.search() for semantic search across MEMORY.md, JOURNAL.md, reflections
 * - Combines RAG TF-IDF scores with keyword similarity for better session matching
 * - Enriches transfer recommendations with RAG context from related documents
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { RagModule, type RagSearchResult } from "./rag.js";
import { parseScorecardRows } from "./scorecard.js";

// Types for learning transfer

export interface TaskSignature {
	taskType: string;
	keywords: string[];
	toolsUsed: string[];
	skillsUsed: string[];
	category: string;
}

export interface SessionLearning {
	sessionId: string;
	taskDescription: string;
	taskSignature: TaskSignature;
	success: boolean;
	firstTry: boolean;
	errors: string[];
	skillsUsed: string[];
	patternsLearned: string[];
	solutionsApplied: string[];
	pitfallsAvoided: string[];
	durationMinutes: number;
	timestamp: string;
}

export interface SimilarityScore {
	sessionId: string;
	taskDescription: string;
	score: number;
	success: boolean;
	matchingFactors: string[];
}

export interface TransferredLearning {
	sourceSession: string;
	relevanceScore: number;
	patterns: string[];
	solutions: string[];
	warnings: string[];
	recommendedSkills: string[];
	avoidPatterns: string[];
}

export interface TransferRecommendation {
	targetTask: string;
	similarSessions: SimilarityScore[];
	transferredLearning: TransferredLearning[];
	overallConfidence: number;
	recommendedApproach: string;
	riskFactors: string[];
}

export interface LearningTransferConfig {
	minSimilarityThreshold: number;
	maxSessionsToConsider: number;
	maxPatternsPerSession: number;
	enableProactiveInjection: boolean;
	dataPath: string;
	excludeOlderThanDays: number;
	memoryPath?: string;
}

export interface LearningTransferStats {
	totalTransfers: number;
	successfulTransfers: number;
	patternsTransferred: number;
	warningsGenerated: number;
	averageSimilarityScore: number;
	topTransferredPatterns: { pattern: string; count: number }[];
	sessionsProcessed: number;
	lastTransferTime: string;
	// RAG enrichment stats
	ragEnrichments: number;
	ragDocumentsFound: number;
	averageRagScore: number;
}

// Default configuration
const DEFAULT_CONFIG: LearningTransferConfig = {
	minSimilarityThreshold: 0.3,
	maxSessionsToConsider: 20,
	maxPatternsPerSession: 5,
	enableProactiveInjection: true,
	dataPath: path.join(process.env.HOME || "/tmp", ".paimon"),
	excludeOlderThanDays: 30,
	memoryPath: path.join(process.cwd(), "MEMORY.md"),
};

/**
 * Learning Transfer Manager
 * Manages cross-session learning transfer for evolution improvement
 */
export class LearningTransferManager {
	private config: LearningTransferConfig;
	private sessions: Map<string, SessionLearning> = new Map();
	private stats: LearningTransferStats;
	private dataFile: string;
	private ragModule = new RagModule();

	constructor(configPath?: string, configOverrides?: Partial<LearningTransferConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...configOverrides };
		this.dataFile = path.join(this.config.dataPath, "learning-transfer.json");
		this.stats = this.getEmptyStats();

		// Load existing data
		this.loadSessions();

		// Load sessions from MEMORY.md scorecard
		this.loadFromMemoryScorecard();

		// Initialize RAG module
		this.ragModule.initialize();
	}

	private getEmptyStats(): LearningTransferStats {
		return {
			totalTransfers: 0,
			successfulTransfers: 0,
			patternsTransferred: 0,
			warningsGenerated: 0,
			averageSimilarityScore: 0,
			topTransferredPatterns: [],
			sessionsProcessed: 0,
			lastTransferTime: new Date().toISOString(),
			// RAG enrichment stats
			ragEnrichments: 0,
			ragDocumentsFound: 0,
			averageRagScore: 0,
		};
	}

	private loadSessions(): void {
		try {
			if (fs.existsSync(this.dataFile)) {
				const data = JSON.parse(fs.readFileSync(this.dataFile, "utf-8"));
				if (data.sessions) {
					for (const [id, session] of Object.entries(
						data.sessions as Record<string, SessionLearning>,
					)) {
						this.sessions.set(id, session);
					}
				}
				if (data.stats) {
					this.stats = { ...this.getEmptyStats(), ...data.stats };
				}
			}
		} catch (error) {
			// Ignore errors, start fresh
		}
	}

	private loadFromMemoryScorecard(): void {
		const memoryPath = this.config.memoryPath || path.join(process.cwd(), "MEMORY.md");
		try {
			if (!fs.existsSync(memoryPath)) return;

			const content = fs.readFileSync(memoryPath, "utf-8");
			const rows = parseScorecardRows(content);
			if (rows.length === 0) return;

			for (const row of rows) {
				const session = this.parseScorecardRow(row);
				if (!session || this.sessions.has(session.sessionId)) continue;
				this.sessions.set(session.sessionId, session);
			}

			this.stats.sessionsProcessed = this.sessions.size;
			this.saveData();
		} catch {
			// Ignore parsing errors
		}
	}

	private parseScorecardRow(row: {
		date: string;
		taskType: string;
		description: string;
		time: string;
		result?: string;
		firstTry?: string;
		errors?: string;
		skillsUsed?: string;
	}): SessionLearning | null {
		const { date, taskType, description, time } = row;
		const errors = row.errors || "none";
		const result = row.result || row.firstTry || "✅";
		const skillsUsed = row.skillsUsed || "";

		if (!date || !taskType || !description || !time) {
			return null;
		}

		const errorList =
			errors === "none"
				? []
				: errors
						.split(",")
						.map((e) => e.trim())
						.filter(Boolean);
		const skillList = skillsUsed
			.split(",")
			.map((skill) => skill.trim())
			.filter(Boolean);
		const keywords = this.extractKeywords(description);
		const sessionId = `scorecard-${date}-${description.slice(0, 30)}`;
		const success = result.includes("✅");

		return {
			sessionId,
			taskDescription: description,
			taskSignature: {
				taskType,
				keywords,
				toolsUsed: [],
				skillsUsed: skillList,
				category: this.extractCategory(description),
			},
			success,
			firstTry: success,
			errors: errorList,
			skillsUsed: skillList,
			patternsLearned: [],
			solutionsApplied: [],
			pitfallsAvoided: errorList,
			durationMinutes: Number.parseInt(time.replace("~", "").replace("m", "")) || 15,
			timestamp: date,
		};
	}

	/**
	 * Extract keywords from text (public for tool access)
	 */
	extractKeywords(text: string): string[] {
		// Extract meaningful keywords from task description
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
			"was",
			"are",
			"were",
			"been",
			"be",
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
			"can",
			"need",
			"module",
			"tool",
			"pattern",
		]);

		const words = text.toLowerCase().split(/\s+|-|\(|\)/);
		return words.filter((w) => w.length > 2 && !stopWords.has(w)).slice(0, 10);
	}

	/**
	 * Extract category from text (public for tool access)
	 */
	extractCategory(text: string): string {
		// Extract category from task description
		const categories = [
			"evolution",
			"intelligence",
			"memory",
			"planning",
			"debugging",
			"frontend",
			"backend",
			"security",
			"testing",
			"benchmark",
			"integration",
			"workflow",
			"agent",
			"plugin",
			"tool",
		];

		for (const cat of categories) {
			if (text.toLowerCase().includes(cat)) return cat;
		}

		return "general";
	}

	private saveData(): void {
		try {
			const dir = path.dirname(this.dataFile);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}

			const data = {
				sessions: Object.fromEntries(this.sessions),
				stats: this.stats,
				config: this.config,
			};

			fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
		} catch (error) {
			// Ignore save errors
		}
	}

	/**
	 * Record a session learning for future transfer
	 */
	recordSession(session: SessionLearning): void {
		// Enhance signature with extracted keywords
		session.taskSignature.keywords = this.extractKeywords(session.taskDescription);
		session.taskSignature.category = this.extractCategory(session.taskDescription);

		this.sessions.set(session.sessionId, session);
		this.stats.sessionsProcessed = this.sessions.size;
		this.saveData();
	}

	/**
	 * Calculate similarity score between two task signatures
	 */
	calculateSimilarity(
		target: TaskSignature,
		source: TaskSignature,
	): { score: number; factors: string[] } {
		let score = 0;
		const factors: string[] = [];

		// Task type match (high weight)
		if (target.taskType === source.taskType) {
			score += 0.3;
			factors.push("same-task-type");
		}

		// Keyword overlap (TF-IDF-like)
		const keywordOverlap = this.calculateKeywordOverlap(target.keywords, source.keywords);
		if (keywordOverlap > 0) {
			score += keywordOverlap * 0.4;
			factors.push(`keyword-match:${keywordOverlap.toFixed(2)}`);
		}

		// Skill overlap
		const skillOverlap = this.calculateSetOverlap(target.skillsUsed, source.skillsUsed);
		if (skillOverlap > 0) {
			score += skillOverlap * 0.2;
			factors.push(`skill-match:${skillOverlap.toFixed(2)}`);
		}

		// Category match
		if (target.category === source.category) {
			score += 0.1;
			factors.push("same-category");
		}

		return { score: Math.min(score, 1), factors };
	}

	private calculateKeywordOverlap(target: string[], source: string[]): number {
		if (target.length === 0 || source.length === 0) return 0;

		const targetSet = new Set(target);
		const sourceSet = new Set(source);

		// Jaccard similarity
		const intersection = new Set([...targetSet].filter((x) => sourceSet.has(x)));
		const union = new Set([...targetSet, ...sourceSet]);

		return intersection.size / union.size;
	}

	private calculateSetOverlap(target: string[], source: string[]): number {
		if (target.length === 0 || source.length === 0) return 0;

		const targetSet = new Set(target);
		const sourceSet = new Set(source);

		const intersection = new Set([...targetSet].filter((x) => sourceSet.has(x)));

		return intersection.size / Math.max(targetSet.size, sourceSet.size);
	}

	/**
	 * Find similar sessions for a target task
	 */
	findSimilarSessions(targetSignature: TaskSignature): SimilarityScore[] {
		const similarities: SimilarityScore[] = [];

		// Filter out old sessions
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - this.config.excludeOlderThanDays);

		for (const [id, session] of this.sessions) {
			// Skip old sessions
			const sessionDate = new Date(session.timestamp);
			if (sessionDate < cutoffDate) continue;

			const { score, factors } = this.calculateSimilarity(targetSignature, session.taskSignature);

			if (score >= this.config.minSimilarityThreshold) {
				similarities.push({
					sessionId: id,
					taskDescription: session.taskDescription,
					score,
					success: session.success,
					matchingFactors: factors,
				});
			}
		}

		// Sort by score descending
		similarities.sort((a, b) => b.score - a.score);

		// Limit to max sessions
		return similarities.slice(0, this.config.maxSessionsToConsider);
	}

	/**
	 * Enrich similarity search with RAG results.
	 * Combines keyword-based similarity with RAG semantic search.
	 */
	enrichWithRag(
		targetDescription: string,
		keywordSimilarities: SimilarityScore[],
	): {
		enrichedSimilarities: SimilarityScore[];
		ragResults: RagSearchResult[];
		combinedConfidence: number;
	} {
		// Search RAG for related documents
		const ragResults = this.ragModule.search({
			query: targetDescription,
			maxResults: 5,
			types: ["learning", "journal", "reflection"],
			includeSnippet: true,
		});

		// Create a map for quick lookup
		const similarityMap = new Map<string, SimilarityScore>();
		for (const sim of keywordSimilarities) {
			similarityMap.set(sim.sessionId, sim);
		}

		// Boost scores for sessions that match RAG results
		// RAG finds semantically related documents that may reference sessions
		for (const ragResult of ragResults) {
			// Check if RAG result references any session
			const doc = ragResult.document;
			const content = doc.content.toLowerCase();

			// Look for session references in RAG documents
			for (const [sessionId, session] of this.sessions) {
				const sessionDesc = session.taskDescription.toLowerCase();
				if (
					content.includes(sessionDesc.slice(0, 30)) ||
					sessionDesc.includes(doc.title.toLowerCase().slice(0, 30))
				) {
					// Boost the similarity score for this session
					const existing = similarityMap.get(sessionId);
					if (existing) {
						// Add RAG boost factor (up to 0.2 additional score)
						existing.score = Math.min(existing.score + ragResult.score * 0.1, 1);
						existing.matchingFactors.push("rag-match");
					} else if (ragResult.score > 0.2) {
						// Add new session from RAG match
						similarityMap.set(sessionId, {
							sessionId,
							taskDescription: session.taskDescription,
							score: ragResult.score * 0.5, // Scale RAG score for new entries
							success: session.success,
							matchingFactors: ["rag-discovered"],
						});
					}
				}
			}
		}

		// Convert back to array and sort
		const enrichedSimilarities = Array.from(similarityMap.values())
			.sort((a, b) => b.score - a.score)
			.slice(0, this.config.maxSessionsToConsider);

		// Calculate combined confidence
		const keywordAvg =
			keywordSimilarities.length > 0
				? keywordSimilarities.reduce((sum: number, s: SimilarityScore) => sum + s.score, 0) /
					keywordSimilarities.length
				: 0;
		const ragAvg =
			ragResults.length > 0
				? ragResults.reduce((sum: number, r: RagSearchResult) => sum + r.score, 0) /
					ragResults.length
				: 0;
		const combinedConfidence = keywordAvg * 0.7 + ragAvg * 0.3; // Weight keyword higher

		// Update stats
		this.stats.ragEnrichments++;
		this.stats.ragDocumentsFound += ragResults.length;
		this.stats.averageRagScore = ragAvg;

		return {
			enrichedSimilarities,
			ragResults,
			combinedConfidence,
		};
	}

	/**
	 * Generate transfer recommendations for a target task
	 */
	generateTransferRecommendation(
		targetTaskDescription: string,
		targetSignature: TaskSignature,
	): TransferRecommendation {
		// Get keyword-based similar sessions
		const keywordSimilarSessions = this.findSimilarSessions(targetSignature);

		// Enrich with RAG search
		const { enrichedSimilarities, ragResults, combinedConfidence } = this.enrichWithRag(
			targetTaskDescription,
			keywordSimilarSessions,
		);

		// Use enriched similarities
		const similarSessions = enrichedSimilarities;

		// Separate successful and failed sessions
		const successfulSessions = similarSessions.filter((s: SimilarityScore) => s.success);
		const failedSessions = similarSessions.filter((s: SimilarityScore) => !s.success);

		// Extract patterns from successful sessions
		const transferredLearning: TransferredLearning[] = [];

		for (const sim of successfulSessions.slice(0, 5)) {
			const session = this.sessions.get(sim.sessionId);
			if (!session) continue;

			transferredLearning.push({
				sourceSession: sim.sessionId,
				relevanceScore: sim.score,
				patterns: session.patternsLearned.slice(0, this.config.maxPatternsPerSession),
				solutions: session.solutionsApplied.slice(0, 3),
				warnings: [],
				recommendedSkills: session.skillsUsed,
				avoidPatterns: session.pitfallsAvoided,
			});
		}

		// Generate warnings from failed sessions
		const warnings: string[] = [];
		const avoidPatterns: string[] = [];

		for (const sim of failedSessions.slice(0, 3)) {
			const session = this.sessions.get(sim.sessionId);
			if (!session) continue;

			const desc = sim.taskDescription.slice(0, 50);
			const errs = session.errors.join(", ");
			warnings.push(`Similar failed session: ${desc}: ${errs}`);
			avoidPatterns.push(...session.pitfallsAvoided);
		}

		// Add warnings to all transferred learning
		for (const learning of transferredLearning) {
			learning.warnings = warnings;
			learning.avoidPatterns = [...learning.avoidPatterns, ...avoidPatterns];
		}

		// Calculate overall confidence using combined confidence from RAG enrichment
		const overallConfidence = similarSessions.length > 0 ? combinedConfidence : 0;

		// Generate recommended approach
		const recommendedApproach = this.generateRecommendedApproach(
			successfulSessions,
			transferredLearning,
		);

		// Generate risk factors
		const riskFactors = this.generateRiskFactors(failedSessions);

		// Add RAG-sourced insights to risk factors if relevant
		for (const ragResult of ragResults.slice(0, 2)) {
			if (ragResult.document.type === "reflection") {
				riskFactors.push(`RAG insight: ${ragResult.snippet.slice(0, 80)}...`);
			}
		}

		// Update stats
		this.stats.totalTransfers++;
		if (transferredLearning.length > 0) {
			this.stats.patternsTransferred += transferredLearning.reduce(
				(sum: number, l: TransferredLearning) => sum + l.patterns.length,
				0,
			);
		}
		this.stats.warningsGenerated += warnings.length;
		this.stats.averageSimilarityScore = overallConfidence;
		this.stats.lastTransferTime = new Date().toISOString();
		this.saveData();

		return {
			targetTask: targetTaskDescription,
			similarSessions,
			transferredLearning,
			overallConfidence,
			recommendedApproach,
			riskFactors,
		};
	}

	private generateRecommendedApproach(
		successfulSessions: SimilarityScore[],
		transferredLearning: TransferredLearning[],
	): string {
		if (successfulSessions.length === 0) {
			return "No similar successful sessions found. Proceed with standard approach.";
		}

		const topSession = successfulSessions[0];
		const topLearning = transferredLearning[0];

		if (!topLearning) {
			const desc = topSession.taskDescription.slice(0, 50);
			return `Similar task: ${desc} succeeded. Review that session for patterns.`;
		}

		const parts: string[] = [];

		if (topLearning.recommendedSkills.length > 0) {
			const skills = topLearning.recommendedSkills.join(", ");
			parts.push(`Consider using skills: ${skills}`);
		}

		if (topLearning.solutions.length > 0) {
			const sols = topLearning.solutions.slice(0, 2).join(", ");
			parts.push(`Previous solutions: ${sols}`);
		}

		return parts.join(". ") || "Review similar successful sessions for patterns.";
	}

	private generateRiskFactors(failedSessions: SimilarityScore[]): string[] {
		const risks: string[] = [];

		for (const sim of failedSessions.slice(0, 3)) {
			const session = this.sessions.get(sim.sessionId);
			if (!session) continue;

			const desc = sim.taskDescription.slice(0, 50);
			const errs = session.errors.join(", ");
			risks.push(`Risk: ${desc} failed with ${errs}`);
		}

		return risks;
	}

	/**
	 * Get proactive context injection for a new task
	 */
	getProactiveContext(taskDescription: string): string {
		const signature: TaskSignature = {
			taskType: this.detectTaskType(taskDescription),
			keywords: this.extractKeywords(taskDescription),
			toolsUsed: [],
			skillsUsed: [],
			category: this.extractCategory(taskDescription),
		};

		const recommendation = this.generateTransferRecommendation(taskDescription, signature);

		if (recommendation.similarSessions.length === 0) {
			// Still try RAG enrichment for context even without similar sessions
			const ragContext = this.ragModule.enrichContext(taskDescription, 3);
			if (ragContext) {
				return ragContext;
			}
			return "";
		}

		const contextParts: string[] = [];

		const conf = (recommendation.overallConfidence * 100).toFixed(0);
		const num = recommendation.similarSessions.length;
		contextParts.push(
			`## Cross-Session Learning Transfer\n\nFound ${num} similar past sessions (confidence: ${conf}%).`,
		);

		if (recommendation.recommendedApproach) {
			contextParts.push(`\n### Recommended Approach\n${recommendation.recommendedApproach}`);
		}

		if (recommendation.transferredLearning.length > 0) {
			const topLearning = recommendation.transferredLearning[0];
			if (topLearning.patterns.length > 0) {
				contextParts.push(
					`\n### Patterns from Similar Sessions\n${topLearning.patterns.join("\n")}`,
				);
			}
		}

		if (recommendation.riskFactors.length > 0) {
			contextParts.push(`\n### Risk Factors\n${recommendation.riskFactors.join("\n")}`);
		}

		// Add RAG-enriched context from MEMORY.md, JOURNAL.md, reflections
		const ragContext = this.ragModule.enrichContext(taskDescription, 2);
		if (ragContext) {
			contextParts.push(`\n${ragContext}`);
		}

		return contextParts.join("\n");
	}

	private detectTaskType(description: string): string {
		if (description.includes("capability")) return "capability";
		if (description.includes("reliability")) return "reliability";
		if (description.includes("feature")) return "feature";
		return "capability"; // Default to capability
	}

	/**
	 * Get statistics
	 */
	getStats(): LearningTransferStats {
		return { ...this.stats };
	}

	/**
	 * Get all sessions
	 */
	getSessions(): SessionLearning[] {
		return Array.from(this.sessions.values());
	}

	/**
	 * Get specific session
	 */
	getSession(sessionId: string): SessionLearning | undefined {
		return this.sessions.get(sessionId);
	}

	/**
	 * Update configuration
	 */
	updateConfig(updates: Partial<LearningTransferConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveData();
	}

	/**
	 * Get configuration
	 */
	getConfig(): LearningTransferConfig {
		return { ...this.config };
	}

	/**
	 * Clear sessions
	 */
	clearSessions(): void {
		this.sessions.clear();
		this.stats = this.getEmptyStats();
		this.saveData();
	}

	/**
	 * Reset statistics
	 */
	resetStats(): void {
		this.stats = this.getEmptyStats();
		this.saveData();
	}
}

// Singleton instance
let learningTransferManagerInstance: LearningTransferManager | null = null;

export function getLearningTransferManager(): LearningTransferManager {
	if (!learningTransferManagerInstance) {
		learningTransferManagerInstance = new LearningTransferManager();
	}
	return learningTransferManagerInstance;
}

export function initLearningTransferManager(
	configPath?: string,
	configOverrides?: Partial<LearningTransferConfig>,
): LearningTransferManager {
	learningTransferManagerInstance = new LearningTransferManager(configPath, configOverrides);
	return learningTransferManagerInstance;
}

// Tool interface
export interface LearningTransferToolArgs {
	action:
		| "transfer"
		| "similar"
		| "sessions"
		| "session"
		| "record"
		| "context"
		| "stats"
		| "config"
		| "update-config"
		| "clear"
		| "reset"
		| "help";
	taskDescription?: string;
	taskType?: string;
	sessionId?: string;
	session?: SessionLearning;
	configUpdates?: Partial<LearningTransferConfig>;
}

export function learningTransferTool(args: LearningTransferToolArgs): string {
	const manager = getLearningTransferManager();

	switch (args.action) {
		case "transfer": {
			if (!args.taskDescription) {
				return "Error: taskDescription required for transfer action";
			}

			const signature: TaskSignature = {
				taskType: args.taskType || "capability",
				keywords: manager.extractKeywords(args.taskDescription),
				toolsUsed: [],
				skillsUsed: [],
				category: manager.extractCategory(args.taskDescription),
			};

			const recommendation = manager.generateTransferRecommendation(
				args.taskDescription,
				signature,
			);

			let output = `## Transfer Recommendation for "${args.taskDescription}"\n\n`;
			const conf = (recommendation.overallConfidence * 100).toFixed(0);
			output += `**Overall Confidence:** ${conf}%\n`;
			output += `**Similar Sessions Found:** ${recommendation.similarSessions.length}\n\n`;

			if (recommendation.similarSessions.length > 0) {
				output += "### Similar Sessions\n";
				for (const sim of recommendation.similarSessions.slice(0, 5)) {
					const desc = sim.taskDescription.slice(0, 50);
					const score = (sim.score * 100).toFixed(0);
					const status = sim.success ? "✅ success" : "❌ failed";
					output += `- **${desc}...** (score: ${score}%, ${status})\n`;
					output += `  Matching factors: ${sim.matchingFactors.join(", ")}\n`;
				}
			}

			if (recommendation.recommendedApproach) {
				output += `\n### Recommended Approach\n${recommendation.recommendedApproach}\n`;
			}

			if (recommendation.transferredLearning.length > 0) {
				output += "\n### Transferred Patterns\n";
				for (const learning of recommendation.transferredLearning.slice(0, 3)) {
					if (learning.patterns.length > 0) {
						output += `From "${learning.sourceSession}":\n`;
						output += `- Patterns: ${learning.patterns.join(", ")}\n`;
						output += `- Recommended skills: ${learning.recommendedSkills.join(", ")}\n`;
					}
				}
			}

			if (recommendation.riskFactors.length > 0) {
				output += "\n### ⚠️ Risk Factors\n";
				for (const risk of recommendation.riskFactors) {
					output += `- ${risk}\n`;
				}
			}

			return output;
		}

		case "similar": {
			if (!args.taskDescription) {
				return "Error: taskDescription required for similar action";
			}

			const signature: TaskSignature = {
				taskType: args.taskType || "capability",
				keywords: manager.extractKeywords(args.taskDescription),
				toolsUsed: [],
				skillsUsed: [],
				category: manager.extractCategory(args.taskDescription),
			};

			const similar = manager.findSimilarSessions(signature);

			if (similar.length === 0) {
				return `No similar sessions found for "${args.taskDescription}"`;
			}

			let output = `## Similar Sessions for "${args.taskDescription}"\n\n`;
			for (const sim of similar) {
				const desc = sim.taskDescription.slice(0, 50);
				const score = (sim.score * 100).toFixed(0);
				const status = sim.success ? "✅" : "❌";
				output += `- **${sim.sessionId}: "${desc}..." (score: ${score}%, ${status})\n`;
				output += `  Factors: ${sim.matchingFactors.join(", ")}\n`;
			}

			return output;
		}

		case "sessions": {
			const sessions = manager.getSessions();
			if (sessions.length === 0) {
				return "No sessions recorded";
			}

			let output = `## Recorded Sessions (${sessions.length})\n\n`;
			for (const session of sessions.slice(0, 20)) {
				const desc = session.taskDescription.slice(0, 40);
				const status = session.success ? "✅" : "❌";
				output += `- **${session.sessionId}: "${desc}..." (${status}, ${session.durationMinutes}m)\n`;
			}

			return output;
		}

		case "session": {
			if (!args.sessionId) {
				return "Error: sessionId required for session action";
			}

			const session = manager.getSession(args.sessionId);
			if (!session) {
				return `Session "${args.sessionId}" not found`;
			}

			let output = `## Session: ${args.sessionId}\n\n`;
			output += `**Task:** ${session.taskDescription}\n`;
			output += `**Type:** ${session.taskSignature.taskType}\n`;
			output += `**Success:** ${session.success ? "✅" : "❌"} (first try: ${session.firstTry ? "✅" : "❌"})\n`;
			output += `**Duration:** ${session.durationMinutes} minutes\n`;
			output += `**Skills Used:** ${session.skillsUsed.join(", ") || "none"}\n`;
			output += `**Errors:** ${session.errors.join(", ") || "none"}\n`;
			output += `**Keywords:** ${session.taskSignature.keywords.join(", ") || "none"}\n`;
			output += `**Patterns Learned:** ${session.patternsLearned.join(", ") || "none"}\n`;
			output += `**Solutions Applied:** ${session.solutionsApplied.join(", ") || "none"}\n`;

			return output;
		}

		case "record": {
			if (!args.session) {
				return "Error: session object required for record action";
			}

			manager.recordSession(args.session);
			return `Session "${args.session.sessionId}" recorded successfully`;
		}

		case "context": {
			if (!args.taskDescription) {
				return "Error: taskDescription required for context action";
			}

			const context = manager.getProactiveContext(args.taskDescription);
			if (!context) {
				return `No relevant context found for "${args.taskDescription}"`;
			}

			return context;
		}

		case "stats": {
			const stats = manager.getStats();
			let output = "## Learning Transfer Statistics\n\n";
			output += `**Total Transfers:** ${stats.totalTransfers}\n`;
			output += `**Patterns Transferred:** ${stats.patternsTransferred}\n`;
			output += `**Warnings Generated:** ${stats.warningsGenerated}\n`;
			const avgConf = (stats.averageSimilarityScore * 100).toFixed(0);
			output += `**Average Similarity Score:** ${avgConf}%\n`;
			output += `**Sessions Processed:** ${stats.sessionsProcessed}\n`;
			output += `**Last Transfer:** ${stats.lastTransferTime}\n`;

			// RAG enrichment stats
			output += "\n### RAG Enrichment\n";
			output += `**RAG Enrichments:** ${stats.ragEnrichments}\n`;
			output += `**RAG Documents Found:** ${stats.ragDocumentsFound}\n`;
			const avgRag = (stats.averageRagScore * 100).toFixed(0);
			output += `**Average RAG Score:** ${avgRag}%\n`;

			if (stats.topTransferredPatterns.length > 0) {
				output += "\n### Top Transferred Patterns\n";
				for (const item of stats.topTransferredPatterns.slice(0, 5)) {
					output += `- ${item.pattern} (${item.count} times)\n`;
				}
			}

			return output;
		}

		case "config": {
			const config = manager.getConfig();
			let output = "## Learning Transfer Configuration\n\n";
			output += `**Min Similarity Threshold:** ${config.minSimilarityThreshold}\n`;
			output += `**Max Sessions to Consider:** ${config.maxSessionsToConsider}\n`;
			output += `**Max Patterns Per Session:** ${config.maxPatternsPerSession}\n`;
			output += `**Proactive Injection:** ${config.enableProactiveInjection ? "enabled" : "disabled"}\n`;
			output += `**Exclude Older Than (days):** ${config.excludeOlderThanDays}\n`;
			output += `**Data Path:** ${config.dataPath}\n`;

			return output;
		}

		case "update-config": {
			if (!args.configUpdates) {
				return "Error: configUpdates required for update-config action";
			}

			manager.updateConfig(args.configUpdates);
			return `Configuration updated: ${Object.keys(args.configUpdates).join(", ")}`;
		}

		case "clear": {
			manager.clearSessions();
			return "All sessions cleared";
		}

		case "reset": {
			manager.resetStats();
			return "Statistics reset";
		}

		case "help": {
			return `## Learning Transfer Tool

Automatically transfers learnings between related tasks.

### Actions

| Action | Description | Required Args |
|--------|-------------|---------------|
| transfer | Generate transfer recommendation | taskDescription, taskType (optional) |
| similar | Find similar sessions | taskDescription, taskType (optional) |
| sessions | List all recorded sessions | none |
| session | Get specific session details | sessionId |
| record | Record a new session | session object |
| context | Get proactive context injection | taskDescription |
| stats | View statistics | none |
| config | View configuration | none |
| update-config | Update configuration | configUpdates |
| clear | Clear all sessions | none |
| reset | Reset statistics | none |
| help | Show this help | none |

### Example Usage

// Get transfer recommendation
learningTransfer({action: 'transfer', taskDescription: 'Add self-healing patterns'})

// Find similar sessions
learningTransfer({action: 'similar', taskDescription: 'Implement error recovery'})

// Get proactive context
learningTransfer({action: 'context', taskDescription: 'Add new capability'})

// View statistics
learningTransfer({action: 'stats'})

### How It Works

1. Extracts keywords and category from task description
2. Calculates similarity score with past sessions
3. Transfers patterns from successful similar sessions
4. Warns about patterns from failed similar sessions
5. Recommends approach based on past success

This improves first-try success rate and reduces rework.
`;
		}

		default:
			return `Unknown action: ${args.action}. Use 'help' for available actions.`;
	}
}
