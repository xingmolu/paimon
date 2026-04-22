/**
 * Agentic Reasoning Memory Module
 *
 * Stores and recalls reasoning chains across evolution iterations to:
 * - Avoid re-exploring same solutions
 * - Learn from past reasoning patterns
 * - Improve convergence speed
 * - Transfer successful reasoning approaches to similar tasks
 *
 * Inspired by cognitive architectures and LLM reasoning patterns
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
	type ScorecardRow,
	isNegativeScorecardResult,
	isPositiveScorecardResult,
	parseScorecardRows,
} from "./scorecard.js";

// Types
export interface ReasoningStep {
	id: string;
	type: "analysis" | "decision" | "action" | "observation" | "conclusion";
	content: string;
	timestamp: string;
	toolUsed?: string;
	toolResult?: string;
	dependencies?: string[];
	confidence?: number;
}

export interface ReasoningChain {
	id: string;
	taskDescription: string;
	taskType: "capability" | "reliability" | "feature";
	steps: ReasoningStep[];
	outcome: "success" | "failure" | "partial";
	durationMs: number;
	filesModified: string[];
	errors?: string[];
	learnings?: string[];
	timestamp: string;
	tags: string[];
}

export interface ReasoningPattern {
	id: string;
	name: string;
	description: string;
	category: string;
	sequence: string[]; // Sequence of step types
	successRate: number;
	occurrences: number;
	taskTypes: ("capability" | "reliability" | "feature")[];
	examples: string[]; // Chain IDs
}

export interface ReasoningMemoryConfig {
	enabled: boolean;
	maxChains: number;
	maxPatterns: number;
	similarityThreshold: number;
	storagePath: string;
	autoExtractPatterns: boolean;
}

export interface ReasoningMemoryStats {
	totalChains: number;
	successfulChains: number;
	failedChains: number;
	patternsExtracted: number;
	averageStepsPerChain: number;
	averageDurationMs: number;
	topPatterns: { name: string; successRate: number; occurrences: number }[];
	recentChains: string[];
}

export interface SimilarChainResult {
	chain: ReasoningChain;
	similarity: number;
	matchingKeywords: string[];
	matchingTags: string[];
	source?: "chain" | "scorecard";
}

// Default configuration
const DEFAULT_CONFIG: ReasoningMemoryConfig = {
	enabled: true,
	maxChains: 500,
	maxPatterns: 100,
	similarityThreshold: 0.3,
	storagePath: path.join(process.env.HOME || ".", ".paimon", "reasoning-memory.json"),
	autoExtractPatterns: true,
};

// Common reasoning patterns to detect
const DEFAULT_PATTERNS: ReasoningPattern[] = [
	{
		id: "analyze-decide-implement-verify",
		name: "Standard Implementation",
		description: "Analyze problem, decide approach, implement, verify",
		category: "implementation",
		sequence: ["analysis", "decision", "action", "observation", "conclusion"],
		successRate: 0.85,
		occurrences: 0,
		taskTypes: ["capability", "feature"],
		examples: [],
	},
	{
		id: "explore-plan-execute-review",
		name: "Exploration-First",
		description: "Explore codebase, plan approach, execute, review results",
		category: "exploration",
		sequence: ["observation", "analysis", "decision", "action", "observation", "conclusion"],
		successRate: 0.9,
		occurrences: 0,
		taskTypes: ["capability", "reliability"],
		examples: [],
	},
	{
		id: "debug-fix-verify",
		name: "Debug Cycle",
		description: "Observe error, analyze cause, fix, verify",
		category: "debugging",
		sequence: ["observation", "analysis", "action", "observation", "conclusion"],
		successRate: 0.75,
		occurrences: 0,
		taskTypes: ["reliability"],
		examples: [],
	},
	{
		id: "research-integrate-test",
		name: "Research Integration",
		description: "Research pattern, integrate into codebase, test",
		category: "research",
		sequence: ["analysis", "observation", "decision", "action", "observation", "conclusion"],
		successRate: 0.88,
		occurrences: 0,
		taskTypes: ["capability"],
		examples: [],
	},
];

let managerInstance: ReasoningMemoryManager | null = null;

export class ReasoningMemoryManager {
	private config: ReasoningMemoryConfig;
	private chains: ReasoningChain[] = [];
	private patterns: ReasoningPattern[] = [];
	private stats: ReasoningMemoryStats;
	private currentChain: ReasoningChain | null = null;

	constructor(config?: Partial<ReasoningMemoryConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.patterns = [...DEFAULT_PATTERNS];
		this.stats = {
			totalChains: 0,
			successfulChains: 0,
			failedChains: 0,
			patternsExtracted: this.patterns.length,
			averageStepsPerChain: 0,
			averageDurationMs: 0,
			topPatterns: [],
			recentChains: [],
		};
		this.loadData();
	}

	// Data persistence
	private loadData(): void {
		try {
			if (fs.existsSync(this.config.storagePath)) {
				const data = JSON.parse(fs.readFileSync(this.config.storagePath, "utf-8"));
				this.chains = data.chains || [];
				this.patterns = data.patterns || this.patterns;
				this.stats = data.stats || this.stats;
			}
		} catch {
			// Start fresh
		}
	}

	private saveData(): void {
		try {
			const dir = path.dirname(this.config.storagePath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(
				this.config.storagePath,
				JSON.stringify(
					{
						chains: this.chains.slice(-this.config.maxChains),
						patterns: this.patterns.slice(0, this.config.maxPatterns),
						stats: this.stats,
						config: this.config,
					},
					null,
					2,
				),
			);
		} catch (error) {
			console.error("Failed to save reasoning memory:", error);
		}
	}

	// Chain management
	public startChain(
		taskDescription: string,
		taskType: "capability" | "reliability" | "feature",
	): string {
		const chain: ReasoningChain = {
			id: `chain-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			taskDescription,
			taskType,
			steps: [],
			outcome: "partial",
			durationMs: 0,
			filesModified: [],
			tags: this.extractTags(taskDescription),
			timestamp: new Date().toISOString(),
		};
		this.currentChain = chain;
		return chain.id;
	}

	public addStep(
		type: ReasoningStep["type"],
		content: string,
		toolUsed?: string,
		toolResult?: string,
		confidence?: number,
	): string | null {
		if (!this.currentChain) return null;

		const step: ReasoningStep = {
			id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			type,
			content,
			timestamp: new Date().toISOString(),
			toolUsed,
			toolResult,
			confidence,
			dependencies: this.currentChain.steps.slice(-2).map((s) => s.id),
		};

		this.currentChain.steps.push(step);
		return step.id;
	}

	public completeChain(
		outcome: "success" | "failure" | "partial",
		filesModified: string[] = [],
		errors: string[] = [],
		learnings: string[] = [],
	): ReasoningChain | null {
		if (!this.currentChain) return null;

		this.currentChain.outcome = outcome;
		this.currentChain.filesModified = filesModified;
		this.currentChain.errors = errors;
		this.currentChain.learnings = learnings;
		this.currentChain.durationMs = this.calculateDuration();

		const completedChain = { ...this.currentChain };
		this.chains.push(completedChain);
		this.updateStats(completedChain);

		if (this.config.autoExtractPatterns && outcome === "success") {
			this.extractPatternFromChain(completedChain);
		}

		this.saveData();
		this.currentChain = null;

		return completedChain;
	}

	public cancelChain(): void {
		this.currentChain = null;
	}

	public getCurrentChain(): ReasoningChain | null {
		return this.currentChain;
	}

	// Memory retrieval
	public findSimilarChains(
		taskDescription: string,
		taskType?: "capability" | "reliability" | "feature",
		limit = 5,
	): SimilarChainResult[] {
		const chainResults = this.findSimilarStoredChains(taskDescription, taskType, limit);
		if (chainResults.length > 0) {
			return chainResults;
		}

		return this.getScorecardFallbackResults(taskDescription, taskType, limit);
	}

	public getReasoningGuidance(
		taskDescription: string,
		taskType?: "capability" | "reliability" | "feature",
	): string {
		const similarChains = this.findSimilarChains(taskDescription, taskType, 3);
		const applicablePatterns = this.findApplicablePatterns(taskType);

		const lines: string[] = ["## Reasoning Memory Guidance", ""];

		if (similarChains.length > 0) {
			const hasScorecardFallback = similarChains.some((result) => result.source === "scorecard");
			lines.push(
				hasScorecardFallback
					? "### Related MEMORY.md Scorecard Entries"
					: "### Similar Past Iterations",
			);
			lines.push("");
			for (const result of similarChains) {
				const outcome =
					result.chain.outcome === "success"
						? "✅"
						: result.chain.outcome === "partial"
							? "⚠️"
							: "❌";
				lines.push(
					`${outcome} **${result.chain.taskDescription.slice(0, 60)}...** (${Math.round(result.similarity * 100)}% similar)`,
				);
				if (result.source === "scorecard") {
					lines.push(`   - Source: MEMORY.md scorecard (${result.chain.taskType})`);
				}
				if (result.chain.learnings && result.chain.learnings.length > 0) {
					lines.push(`   - Learning: ${result.chain.learnings[0].slice(0, 80)}...`);
				}
				lines.push("");
			}
		}

		if (applicablePatterns.length > 0) {
			lines.push("### Recommended Reasoning Patterns");
			lines.push("");
			for (const pattern of applicablePatterns.slice(0, 2)) {
				lines.push(
					`- **${pattern.name}**: ${pattern.description} (${Math.round(pattern.successRate * 100)}% success rate)`,
				);
			}
		}

		if (similarChains.length === 0 && applicablePatterns.length === 0) {
			lines.push("No similar past iterations found. Consider starting with exploration.");
		}

		return lines.join("\n");
	}

	private findSimilarStoredChains(
		taskDescription: string,
		taskType?: "capability" | "reliability" | "feature",
		limit = 5,
	): SimilarChainResult[] {
		const keywords = this.extractKeywords(taskDescription);
		const tags = this.extractTags(taskDescription);
		const results: SimilarChainResult[] = [];

		for (const chain of this.chains) {
			if (taskType && chain.taskType !== taskType) continue;

			const chainKeywords = this.extractKeywords(chain.taskDescription);
			const keywordMatches = keywords.filter((k) => chainKeywords.includes(k));
			const tagMatches = tags.filter((t) => chain.tags.includes(t));

			const keywordSimilarity =
				keywords.length > 0
					? keywordMatches.length / Math.max(keywords.length, chainKeywords.length)
					: 0;
			const tagSimilarity =
				tags.length > 0 ? tagMatches.length / Math.max(tags.length, chain.tags.length) : 0;
			const outcomeBoost =
				chain.outcome === "success" ? 0.2 : chain.outcome === "partial" ? 0.1 : 0;
			const similarity = keywordSimilarity * 0.5 + tagSimilarity * 0.3 + outcomeBoost;

			if (similarity >= this.config.similarityThreshold) {
				results.push({
					chain,
					similarity,
					matchingKeywords: keywordMatches,
					matchingTags: tagMatches,
					source: "chain",
				});
			}
		}

		return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
	}

	private getScorecardFallbackResults(
		taskDescription: string,
		taskType?: "capability" | "reliability" | "feature",
		limit = 5,
	): SimilarChainResult[] {
		const rows = this.loadScorecardRows();
		const keywords = this.extractKeywords(taskDescription);
		const tags = this.extractTags(taskDescription);

		const results = rows
			.filter((row) => !taskType || row.taskType === taskType)
			.map((row) => {
				const rowKeywords = this.extractKeywords(row.description);
				const matchingKeywords = keywords.filter((keyword) => rowKeywords.includes(keyword));
				const rowTags = this.extractTags(row.description);
				const matchingTags = tags.filter((tag) => rowTags.includes(tag));
				const keywordSimilarity =
					keywords.length > 0
						? matchingKeywords.length / Math.max(keywords.length, rowKeywords.length)
						: 0;
				const tagSimilarity =
					tags.length > 0 ? matchingTags.length / Math.max(tags.length, rowTags.length) : 0;
				const successBoost = isPositiveScorecardResult(row.result, row.firstTry) ? 0.2 : 0;
				const similarity = keywordSimilarity * 0.6 + tagSimilarity * 0.2 + successBoost;

				return {
					chain: this.createPseudoChainFromScorecard(row),
					similarity,
					matchingKeywords,
					matchingTags,
					source: "scorecard" as const,
				};
			})
			.filter((result) => result.similarity >= this.config.similarityThreshold)
			.sort((a, b) => b.similarity - a.similarity)
			.slice(0, limit);

		return results;
	}

	private loadScorecardRows(): ScorecardRow[] {
		try {
			const memoryPath = path.join(process.cwd(), "MEMORY.md");
			if (!fs.existsSync(memoryPath)) {
				return [];
			}
			const content = fs.readFileSync(memoryPath, "utf-8");
			return parseScorecardRows(content);
		} catch {
			return [];
		}
	}

	private createPseudoChainFromScorecard(row: ScorecardRow): ReasoningChain {
		const learnings = [
			`Historical ${row.taskType} iteration completed in ${row.time}${row.errors && row.errors !== "none" ? ` with errors: ${row.errors}` : " without recorded errors"}.`,
		];
		if (row.skillsUsed) {
			learnings.push(`Skills used: ${row.skillsUsed}`);
		}
		if (row.enables) {
			learnings.push(`Enabled future work: ${row.enables}`);
		}

		return {
			id: `scorecard-${row.date}-${row.description
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-|-$/g, "")
				.slice(0, 40)}`,
			taskDescription: row.description,
			taskType: (row.taskType as "capability" | "reliability" | "feature") || "capability",
			steps: [],
			outcome: isPositiveScorecardResult(row.result, row.firstTry)
				? "success"
				: isNegativeScorecardResult(row.result, row.firstTry)
					? "failure"
					: "partial",
			durationMs: this.parseDurationMs(row.time),
			filesModified: [],
			errors: row.errors && row.errors !== "none" ? [row.errors] : [],
			learnings,
			timestamp: new Date(`${row.date}T00:00:00.000Z`).toISOString(),
			tags: this.extractTags(row.description),
		};
	}

	private parseDurationMs(value: string): number {
		const match = value.match(/~?(\d+)\s*m/i);
		if (!match) return 0;
		return Number.parseInt(match[1] || "0", 10) * 60 * 1000;
	}

	public getChain(chainId: string): ReasoningChain | undefined {
		return this.chains.find((c) => c.id === chainId);
	}

	public getRecentChains(limit = 10): ReasoningChain[] {
		return [...this.chains].reverse().slice(0, limit);
	}

	// Pattern management
	private extractPatternFromChain(chain: ReasoningChain): void {
		const sequence = chain.steps.map((s) => s.type);

		// Check if this sequence matches an existing pattern
		for (const pattern of this.patterns) {
			if (this.sequencesMatch(sequence, pattern.sequence)) {
				pattern.occurrences++;
				if (chain.outcome === "success") {
					pattern.successRate =
						(pattern.successRate * (pattern.occurrences - 1) + 1) / pattern.occurrences;
				} else {
					pattern.successRate =
						(pattern.successRate * (pattern.occurrences - 1)) / pattern.occurrences;
				}
				if (!pattern.examples.includes(chain.id)) {
					pattern.examples.push(chain.id);
				}
				return;
			}
		}

		// Create new pattern if sequence is unique and useful
		if (chain.steps.length >= 3 && chain.outcome === "success") {
			const newPattern: ReasoningPattern = {
				id: `pattern-${Date.now()}`,
				name: `Custom Pattern ${this.patterns.length + 1}`,
				description: chain.taskDescription.slice(0, 100),
				category: "custom",
				sequence,
				successRate: 1.0,
				occurrences: 1,
				taskTypes: [chain.taskType],
				examples: [chain.id],
			};
			this.patterns.push(newPattern);
		}
	}

	private sequencesMatch(seq1: string[], seq2: string[]): boolean {
		if (seq1.length !== seq2.length) return false;
		return seq1.every((s, i) => s === seq2[i]);
	}

	public findApplicablePatterns(
		taskType?: "capability" | "reliability" | "feature",
	): ReasoningPattern[] {
		let patterns = [...this.patterns];

		if (taskType) {
			patterns = patterns.filter((p) => p.taskTypes.includes(taskType));
		}

		return patterns.sort((a, b) => b.successRate * b.occurrences - a.successRate * a.occurrences);
	}

	public getPattern(patternId: string): ReasoningPattern | undefined {
		return this.patterns.find((p) => p.id === patternId);
	}

	public getAllPatterns(): ReasoningPattern[] {
		return [...this.patterns];
	}

	// Utility methods
	private extractTags(description: string): string[] {
		const tagPatterns = [
			{ pattern: /\b(add|create|implement|build)\b/i, tag: "creation" },
			{ pattern: /\b(fix|repair|resolve|debug)\b/i, tag: "fix" },
			{ pattern: /\b(refactor|improve|optimize|enhance)\b/i, tag: "improvement" },
			{ pattern: /\b(test|verify|validate)\b/i, tag: "testing" },
			{ pattern: /\b(integrate|connect|link)\b/i, tag: "integration" },
			{ pattern: /\b(tool|module|capability|feature)\b/i, tag: "component" },
			{ pattern: /\b(hook|event|trigger)\b/i, tag: "hooks" },
			{ pattern: /\b(memory|learning|persist)\b/i, tag: "memory" },
			{ pattern: /\b(error|fail|crash|bug)\b/i, tag: "error-handling" },
		];

		const tags: string[] = [];
		for (const { pattern, tag } of tagPatterns) {
			if (pattern.test(description)) {
				tags.push(tag);
			}
		}
		return [...new Set(tags)];
	}

	private extractKeywords(text: string): string[] {
		const stopWords = new Set([
			"the",
			"a",
			"an",
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
			"can",
			"need",
			"to",
			"of",
			"in",
			"for",
			"on",
			"with",
			"at",
			"by",
			"from",
			"as",
			"into",
			"through",
			"during",
			"before",
			"after",
			"above",
			"below",
			"between",
			"under",
			"again",
			"further",
			"then",
			"once",
			"here",
			"there",
			"when",
			"where",
			"why",
			"how",
			"all",
			"each",
			"few",
			"more",
			"most",
			"other",
			"some",
			"such",
			"no",
			"nor",
			"not",
			"only",
			"own",
			"same",
			"so",
			"than",
			"too",
			"very",
			"just",
			"and",
			"but",
			"if",
			"or",
			"because",
			"until",
			"while",
			"this",
			"that",
			"these",
			"those",
		]);

		return text
			.toLowerCase()
			.replace(/[^\w\s-]/g, " ")
			.split(/\s+/)
			.filter((word) => word.length > 2 && !stopWords.has(word))
			.slice(0, 20);
	}

	private calculateDuration(): number {
		if (!this.currentChain || this.currentChain.steps.length === 0) return 0;

		const start = new Date(this.currentChain.timestamp).getTime();
		const end = new Date(
			this.currentChain.steps[this.currentChain.steps.length - 1].timestamp,
		).getTime();
		return end - start;
	}

	private updateStats(chain: ReasoningChain): void {
		this.stats.totalChains++;
		if (chain.outcome === "success") this.stats.successfulChains++;
		else if (chain.outcome === "failure") this.stats.failedChains++;

		const totalSteps = this.chains.reduce((sum, c) => sum + c.steps.length, 0);
		this.stats.averageStepsPerChain = totalSteps / this.chains.length;

		const totalDuration = this.chains.reduce((sum, c) => sum + c.durationMs, 0);
		this.stats.averageDurationMs = totalDuration / this.chains.length;

		this.stats.patternsExtracted = this.patterns.length;

		this.stats.topPatterns = this.patterns
			.sort((a, b) => b.occurrences - a.occurrences)
			.slice(0, 5)
			.map((p) => ({
				name: p.name,
				successRate: p.successRate,
				occurrences: p.occurrences,
			}));

		this.stats.recentChains = this.chains.slice(-5).map((c) => c.id);
	}

	// Public API
	public getStats(): ReasoningMemoryStats {
		return { ...this.stats };
	}

	public getConfig(): ReasoningMemoryConfig {
		return { ...this.config };
	}

	public updateConfig(updates: Partial<ReasoningMemoryConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveData();
	}

	public isEnabled(): boolean {
		return this.config.enabled;
	}

	public setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveData();
	}

	public clearChains(): void {
		this.chains = [];
		this.stats = {
			totalChains: 0,
			successfulChains: 0,
			failedChains: 0,
			patternsExtracted: this.patterns.length,
			averageStepsPerChain: 0,
			averageDurationMs: 0,
			topPatterns: [],
			recentChains: [],
		};
		this.saveData();
	}

	public clearPatterns(): void {
		this.patterns = [...DEFAULT_PATTERNS];
		this.stats.patternsExtracted = this.patterns.length;
		this.saveData();
	}

	public reset(): void {
		this.chains = [];
		this.patterns = [...DEFAULT_PATTERNS];
		this.stats = {
			totalChains: 0,
			successfulChains: 0,
			failedChains: 0,
			patternsExtracted: this.patterns.length,
			averageStepsPerChain: 0,
			averageDurationMs: 0,
			topPatterns: [],
			recentChains: [],
		};
		this.saveData();
	}

	// Formatting methods
	public formatChain(chain: ReasoningChain): string {
		const lines: string[] = [
			`## Reasoning Chain: ${chain.id}`,
			"",
			`**Task:** ${chain.taskDescription}`,
			`**Type:** ${chain.taskType}`,
			`**Outcome:** ${chain.outcome === "success" ? "✅ Success" : chain.outcome === "partial" ? "⚠️ Partial" : "❌ Failure"}`,
			`**Duration:** ${Math.round(chain.durationMs / 1000)}s`,
			`**Files Modified:** ${chain.filesModified.length > 0 ? chain.filesModified.join(", ") : "None"}`,
			"",
			"### Reasoning Steps",
			"",
		];

		for (let i = 0; i < chain.steps.length; i++) {
			const step = chain.steps[i];
			const typeIcon =
				step.type === "analysis"
					? "🔍"
					: step.type === "decision"
						? "💡"
						: step.type === "action"
							? "⚡"
							: step.type === "observation"
								? "👁️"
								: "✅";

			lines.push(`${i + 1}. ${typeIcon} **${step.type}**: ${step.content.slice(0, 100)}...`);
			if (step.toolUsed) {
				lines.push(`   - Tool: ${step.toolUsed}`);
			}
		}

		if (chain.learnings && chain.learnings.length > 0) {
			lines.push("", "### Learnings", "");
			for (const learning of chain.learnings) {
				lines.push(`- ${learning}`);
			}
		}

		if (chain.errors && chain.errors.length > 0) {
			lines.push("", "### Errors", "");
			for (const error of chain.errors) {
				lines.push(`- ${error}`);
			}
		}

		return lines.join("\n");
	}

	public formatPattern(pattern: ReasoningPattern): string {
		const lines: string[] = [
			`## Reasoning Pattern: ${pattern.name}`,
			"",
			`**Description:** ${pattern.description}`,
			`**Category:** ${pattern.category}`,
			`**Success Rate:** ${Math.round(pattern.successRate * 100)}%`,
			`**Occurrences:** ${pattern.occurrences}`,
			`**Task Types:** ${pattern.taskTypes.join(", ")}`,
			"",
			"### Sequence",
			"",
			`\`${pattern.sequence.join(" → ")}\``,
			"",
			`**Example Chains:** ${pattern.examples.length}`,
		];

		return lines.join("\n");
	}

	public formatStats(): string {
		const lines: string[] = [
			"## Reasoning Memory Statistics",
			"",
			`**Total Chains:** ${this.stats.totalChains}`,
			`**Successful:** ${this.stats.successfulChains} (${this.stats.totalChains > 0 ? Math.round((this.stats.successfulChains / this.stats.totalChains) * 100) : 0}%)`,
			`**Failed:** ${this.stats.failedChains}`,
			"",
			`**Patterns Extracted:** ${this.stats.patternsExtracted}`,
			`**Average Steps per Chain:** ${this.stats.averageStepsPerChain.toFixed(1)}`,
			`**Average Duration:** ${Math.round(this.stats.averageDurationMs / 1000)}s`,
			"",
			"### Top Patterns",
			"",
		];

		for (const pattern of this.stats.topPatterns) {
			lines.push(
				`- ${pattern.name}: ${Math.round(pattern.successRate * 100)}% success (${pattern.occurrences} occurrences)`,
			);
		}

		return lines.join("\n");
	}
}

// Singleton accessor
export function getReasoningMemoryManager(): ReasoningMemoryManager {
	if (!managerInstance) {
		managerInstance = new ReasoningMemoryManager();
	}
	return managerInstance;
}

export function initReasoningMemoryManager(
	config?: Partial<ReasoningMemoryConfig>,
): ReasoningMemoryManager {
	managerInstance = new ReasoningMemoryManager(config);
	return managerInstance;
}
