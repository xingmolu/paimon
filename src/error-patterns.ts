/**
 * Error Pattern Learning Module
 *
 * Learns from error patterns across sessions to provide automatic solutions.
 * Inspired by OpenHands' error recovery and Claude Code's pattern recognition.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { normalizeScorecardResult, parseScorecardRows } from "./scorecard.js";

export interface ErrorPattern {
	id: string;
	type: "typescript" | "test" | "lint" | "runtime";
	pattern: string; // Regex pattern
	description: string;
	solution: string;
	confidence: number; // 0-100
	occurrences: number; // How many times this pattern has been seen
	lastSeen: string; // ISO timestamp
	examples: string[]; // Example error messages
}

export interface ErrorMatch {
	pattern: ErrorPattern;
	match: string;
	suggestion: string;
	confidence: number;
	source?: "pattern" | "memory";
}

export interface PatternStats {
	totalPatterns: number;
	byType: Record<string, number>;
	totalOccurrences: number;
	topPatterns: ErrorPattern[];
}

// Common error patterns with known solutions
const MEMORY_FALLBACK_LOOKBACK = 10;

const DEFAULT_PATTERNS: ErrorPattern[] = [
	// TypeScript errors
	{
		id: "ts-missing-property",
		type: "typescript",
		pattern: "Property '(.+)' does not exist on type '(.+)'",
		description: "Missing property on type",
		solution:
			"Add the missing property to the type definition, or use optional chaining (?.) if the property might be undefined.",
		confidence: 90,
		occurrences: 0,
		lastSeen: new Date().toISOString(),
		examples: [],
	},
	{
		id: "ts-type-mismatch",
		type: "typescript",
		pattern: "Type '(.+)' is not assignable to type '(.+)'",
		description: "Type mismatch in assignment",
		solution:
			"Convert the type using 'as' assertion, or fix the source type to match the target type.",
		confidence: 85,
		occurrences: 0,
		lastSeen: new Date().toISOString(),
		examples: [],
	},
	{
		id: "ts-missing-import",
		type: "typescript",
		pattern: "Cannot find name '(.+)'",
		description: "Missing import or undefined variable",
		solution: "Add the missing import statement at the top of the file, or define the variable.",
		confidence: 95,
		occurrences: 0,
		lastSeen: new Date().toISOString(),
		examples: [],
	},
	{
		id: "ts-undefined-null",
		type: "typescript",
		pattern: "Object is possibly '(.+)'",
		description: "Object may be undefined or null",
		solution: "Add null check or use optional chaining (?.) to safely access the property.",
		confidence: 90,
		occurrences: 0,
		lastSeen: new Date().toISOString(),
		examples: [],
	},
	{
		id: "ts-argument-type",
		type: "typescript",
		pattern: "Argument of type '(.+)' is not assignable to parameter of type '(.+)'",
		description: "Wrong argument type",
		solution: "Convert the argument type or fix the function parameter type definition.",
		confidence: 85,
		occurrences: 0,
		lastSeen: new Date().toISOString(),
		examples: [],
	},

	// Test errors
	{
		id: "test-assertion-failed",
		type: "test",
		pattern: "AssertionError: (.+)",
		description: "Test assertion failed",
		solution:
			"Check the expected vs actual values. The assertion logic may need adjustment or the implementation may be incorrect.",
		confidence: 75,
		occurrences: 0,
		lastSeen: new Date().toISOString(),
		examples: [],
	},
	{
		id: "test-timeout",
		type: "test",
		pattern: "Timeout of (\\d+)ms exceeded",
		description: "Test timed out",
		solution:
			"Increase test timeout or fix the async operation that's hanging. Check for unresolved promises or infinite loops.",
		confidence: 80,
		occurrences: 0,
		lastSeen: new Date().toISOString(),
		examples: [],
	},
	{
		id: "test-snapshot-mismatch",
		type: "test",
		pattern: "Snapshot (.+) mismatched",
		description: "Snapshot test failed",
		solution:
			"Update the snapshot if the change is intentional, or fix the implementation to match the expected snapshot.",
		confidence: 85,
		occurrences: 0,
		lastSeen: new Date().toISOString(),
		examples: [],
	},

	// Lint errors
	{
		id: "lint-unused-var",
		type: "lint",
		pattern: "'(.+)' is (assigned a value but )?never used",
		description: "Unused variable",
		solution: "Remove the unused variable, or prefix it with underscore if intentionally unused.",
		confidence: 95,
		occurrences: 0,
		lastSeen: new Date().toISOString(),
		examples: [],
	},
	{
		id: "lint-missing-dep",
		type: "lint",
		pattern: "React Hook (.+) has a missing dependency: (.+)",
		description: "Missing dependency in React hook",
		solution:
			"Add the missing dependency to the dependency array, or use useCallback/useMemo to stabilize it.",
		confidence: 85,
		occurrences: 0,
		lastSeen: new Date().toISOString(),
		examples: [],
	},
	{
		id: "lint-formatting",
		type: "lint",
		pattern: "(Expected|Unexpected) (.+)",
		description: "Code formatting issue",
		solution:
			"Run the auto-formatter (prettier, biome format, eslint --fix) to fix formatting issues.",
		confidence: 90,
		occurrences: 0,
		lastSeen: new Date().toISOString(),
		examples: [],
	},

	// Runtime errors
	{
		id: "runtime-null-pointer",
		type: "runtime",
		pattern: "Cannot read propert(y|ies) of (undefined|null)",
		description: "Null pointer exception",
		solution:
			"Add null check before accessing property. Use optional chaining (?.) or nullish coalescing (??).",
		confidence: 90,
		occurrences: 0,
		lastSeen: new Date().toISOString(),
		examples: [],
	},
	{
		id: "runtime-not-function",
		type: "runtime",
		pattern: "(.+) is not a function",
		description: "Called non-function value",
		solution:
			"Check that the value is actually a function before calling. Verify import/export syntax.",
		confidence: 85,
		occurrences: 0,
		lastSeen: new Date().toISOString(),
		examples: [],
	},
	{
		id: "runtime-enoent",
		type: "runtime",
		pattern: "ENOENT: no such file or directory, open '(.+)'",
		description: "File not found",
		solution: "Check the file path exists. Create the file or fix the path.",
		confidence: 95,
		occurrences: 0,
		lastSeen: new Date().toISOString(),
		examples: [],
	},
];

export class ErrorPatternLearner {
	private patterns: Map<string, ErrorPattern> = new Map();
	private dataDir: string;
	private patternsFile: string;

	constructor(dataDir?: string) {
		this.dataDir = dataDir || this.findDataDir();
		this.patternsFile = path.join(this.dataDir, "error-patterns.json");
		this.loadPatterns();
	}

	private findDataDir(): string {
		// Find git root and use data directory there
		let dir = process.cwd();
		for (let i = 0; i < 10; i++) {
			if (fs.existsSync(path.join(dir, ".git"))) {
				const dataDir = path.join(dir, "data");
				if (!fs.existsSync(dataDir)) {
					fs.mkdirSync(dataDir, { recursive: true });
				}
				return dataDir;
			}
			dir = path.dirname(dir);
		}
		// Fallback to current directory
		return process.cwd();
	}

	/**
	 * Load patterns from file
	 */
	private loadPatterns(): void {
		// Start with default patterns
		for (const pattern of DEFAULT_PATTERNS) {
			this.patterns.set(pattern.id, pattern);
		}

		// Load learned patterns from file
		if (fs.existsSync(this.patternsFile)) {
			try {
				const data = JSON.parse(fs.readFileSync(this.patternsFile, "utf-8"));
				for (const pattern of data.patterns || []) {
					// Merge with existing patterns, keeping higher occurrence count
					const existing = this.patterns.get(pattern.id);
					if (existing) {
						existing.occurrences = Math.max(existing.occurrences, pattern.occurrences);
						existing.examples = [...new Set([...existing.examples, ...pattern.examples])].slice(
							0,
							5,
						);
					} else {
						this.patterns.set(pattern.id, pattern);
					}
				}
			} catch (e) {
				// Ignore parse errors
			}
		}
	}

	/**
	 * Save patterns to file
	 */
	private savePatterns(): void {
		const data = {
			patterns: Array.from(this.patterns.values()).filter((p) => p.occurrences > 0),
			lastUpdated: new Date().toISOString(),
		};

		const dir = path.dirname(this.patternsFile);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		fs.writeFileSync(this.patternsFile, JSON.stringify(data, null, 2));
	}

	/**
	 * Detect error type from error message
	 */
	detectErrorType(message: string): "typescript" | "test" | "lint" | "runtime" {
		const lower = message.toLowerCase();

		// Check for common lint patterns first
		if (
			lower.includes("never used") ||
			lower.includes("unused") ||
			(lower.includes("'") && lower.includes("is assigned")) ||
			lower.includes("eslint") ||
			lower.includes("biome") ||
			lower.includes("formatting")
		) {
			return "lint";
		}

		if (
			lower.includes("test") ||
			lower.includes("assertion") ||
			lower.includes("expected") ||
			lower.includes("received")
		) {
			return "test";
		}
		if (lower.includes("lint")) {
			return "lint";
		}
		if (
			lower.includes("type") ||
			lower.includes("typescript") ||
			(lower.includes("property") && lower.includes("type")) ||
			lower.includes("cannot find") ||
			lower.includes("is not assignable")
		) {
			return "typescript";
		}
		return "runtime";
	}

	/**
	 * Learn from an error message - extract pattern and add to knowledge base
	 */
	learnFromError(message: string, solution?: string): ErrorPattern | null {
		const type = this.detectErrorType(message);

		// Try to match existing pattern first
		for (const pattern of this.patterns.values()) {
			if (pattern.type === type) {
				const regex = new RegExp(pattern.pattern, "i");
				if (regex.test(message)) {
					pattern.occurrences++;
					pattern.lastSeen = new Date().toISOString();
					if (!pattern.examples.includes(message)) {
						pattern.examples = [message, ...pattern.examples].slice(0, 5);
					}
					this.savePatterns();
					return pattern;
				}
			}
		}

		// Create new pattern from error
		// Extract key parts for pattern generalization
		const generalizedPattern = this.generalizePattern(message, type);
		if (!generalizedPattern) {
			return null;
		}

		const newPattern: ErrorPattern = {
			id: `learned-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
			type,
			pattern: generalizedPattern,
			description: `${type} error pattern`,
			solution: solution || "No known solution yet. Add solution after fixing.",
			confidence: 50, // Low confidence for new patterns
			occurrences: 1,
			lastSeen: new Date().toISOString(),
			examples: [message],
		};

		this.patterns.set(newPattern.id, newPattern);
		this.savePatterns();
		return newPattern;
	}

	/**
	 * Generalize an error message into a regex pattern
	 */
	private generalizePattern(message: string, type: string): string | null {
		// Replace specific values with capture groups
		const pattern = message
			// Replace file paths
			.replace(/['"][^'"]+\.(ts|js|json|md)['"]/g, "'$1'")
			// Replace numbers
			.replace(/\b\d+\b/g, "\\d+")
			// Replace variable names (keep short ones that might be keywords)
			.replace(/\b[a-zA-Z_][a-zA-Z0-9_]{3,}\b/g, "(.+)")
			// Escape special regex chars
			.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
			// Unescape our capture groups
			.replace(/\\\((\.\+)\\\)/g, "(.+)");

		// Validate pattern
		try {
			new RegExp(pattern, "i");
		} catch {
			return null;
		}

		return pattern;
	}

	/**
	 * Match error against known patterns
	 */
	matchError(message: string): ErrorMatch | null {
		const directMatches = this.getSuggestions(message, 1);
		return directMatches[0] ?? null;
	}

	/**
	 * Get suggestions for an error
	 */
	getSuggestions(message: string, maxSuggestions = 3): ErrorMatch[] {
		const suggestions: ErrorMatch[] = [];
		const type = this.detectErrorType(message);

		for (const pattern of this.patterns.values()) {
			if (pattern.type !== type) continue;

			try {
				const regex = new RegExp(pattern.pattern, "i");
				if (regex.test(message)) {
					suggestions.push({
						pattern,
						match: message,
						suggestion: pattern.solution,
						confidence: Math.min(100, pattern.confidence + Math.min(pattern.occurrences * 2, 10)),
						source: "pattern",
					});
				}
			} catch {
				// Invalid regex, skip
			}

			if (suggestions.length >= maxSuggestions) break;
		}

		if (suggestions.length > 0) {
			return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, maxSuggestions);
		}

		return this.getMemorySuggestions(message, type, maxSuggestions);
	}

	private getMemorySuggestions(
		message: string,
		type: "typescript" | "test" | "lint" | "runtime",
		maxSuggestions: number,
	): ErrorMatch[] {
		const rows = this.loadScorecardRows().slice(0, MEMORY_FALLBACK_LOOKBACK);
		const suggestions: ErrorMatch[] = [];
		const seenDescriptions = new Set<string>();
		const rankedRows = rows
			.map((row, index) => ({ row, index }))
			.sort((a, b) => this.compareMemoryFallbackRows(a.row, b.row, a.index, b.index));

		for (const { row } of rankedRows) {
			const normalizedErrors = this.normalizeScorecardErrors(row.errors);
			if (!normalizedErrors.includes(type)) {
				continue;
			}

			const description = row.description.trim();
			if (!description) {
				continue;
			}

			const descriptionKey = description.toLowerCase();
			if (seenDescriptions.has(descriptionKey)) {
				continue;
			}
			seenDescriptions.add(descriptionKey);

			const result = normalizeScorecardResult(row.result, row.firstTry);
			const firstTryText = row.firstTry ? "first try" : "after rework";
			const reworkText = row.rework ? " Rework was required." : "";
			const skillsNote = row.skillsUsed ? ` Skills used: ${row.skillsUsed}.` : "";
			const preventionNote = this.buildMemoryPreventionNote(
				type,
				row.skillsUsed,
				this.normalizeScorecardReworkFlag(row.rework),
				result,
			);
			const summary =
				result === "negative"
					? `Recent MEMORY.md failure on ${row.date}: ${description}. This ${type} issue remained unresolved ${firstTryText}. Review the failing implementation path before retrying.${reworkText}`
					: result === "positive"
						? `Recent successful session on ${row.date} hit ${type} issues during ${description} and recovered ${firstTryText}. Reuse the proven fix path before retrying.${reworkText}`
						: `Recent MEMORY.md history on ${row.date}: ${description}. Review it for prior ${type} recovery context.${reworkText}`;
			const pattern: ErrorPattern = {
				id: `memory-${type}-${row.date}-${suggestions.length}`,
				type,
				pattern: "MEMORY fallback",
				description: `MEMORY.md fallback from ${row.date}`,
				solution: `${summary}${skillsNote}${preventionNote}`,
				confidence: result === "negative" ? 88 : result === "positive" ? 82 : 72,
				occurrences: 1,
				lastSeen: row.date,
				examples: [description],
			};

			suggestions.push({
				pattern,
				match: message,
				suggestion: pattern.solution,
				confidence: pattern.confidence,
				source: "memory",
			});

			if (suggestions.length >= maxSuggestions) {
				break;
			}
		}

		return suggestions;
	}

	private compareMemoryFallbackRows(
		a: ReturnType<typeof parseScorecardRows>[number],
		b: ReturnType<typeof parseScorecardRows>[number],
		indexA: number,
		indexB: number,
	): number {
		const priorityDelta = this.getMemoryFallbackPriority(a) - this.getMemoryFallbackPriority(b);
		if (priorityDelta !== 0) {
			return priorityDelta;
		}

		return indexA - indexB;
	}

	private getMemoryFallbackPriority(row: ReturnType<typeof parseScorecardRows>[number]): number {
		const result = normalizeScorecardResult(row.result, row.firstTry);
		const rework = this.normalizeScorecardReworkFlag(row.rework);
		const normalizedSkills = this.normalizeSkillNames(row.skillsUsed);
		const hasDebugging = normalizedSkills.includes("systematic-debugging");
		const hasReview = normalizedSkills.includes("review-changes");
		const hasAssess = normalizedSkills.includes("assess");

		if (result === "negative") {
			return hasDebugging ? 0 : 1;
		}
		if (result === "positive" && rework) {
			if (hasReview) {
				return 2;
			}
			if (hasDebugging || hasAssess) {
				return 3;
			}
			return 4;
		}
		if (result === "positive") {
			return hasDebugging || hasReview || hasAssess ? 5 : 6;
		}
		return 7;
	}

	private buildMemoryPreventionNote(
		type: "typescript" | "test" | "lint" | "runtime",
		skillsUsed?: string,
		rework?: boolean,
		result?: "positive" | "negative" | "unknown",
	): string {
		const normalizedSkills = this.normalizeSkillNames(skillsUsed);
		const hasReview = normalizedSkills.includes("review-changes");
		const hasDebugging = normalizedSkills.includes("systematic-debugging");
		const hasAssess = normalizedSkills.includes("assess");

		if (result === "negative") {
			if (hasDebugging) {
				return ` Prevention: re-run systematic-debugging before editing to isolate the failing ${type} path.`;
			}
			if (hasReview) {
				return ` Prevention: inspect the last review-changes findings before retrying so the unresolved ${type} path does not repeat.`;
			}
		}
		if (rework && hasReview) {
			return ` Prevention: run review-changes before assess/build-test so similar ${type} regressions are caught earlier.`;
		}
		if (result === "positive" && rework && hasAssess) {
			return ` Prevention: after fixing the ${type} issue, rerun assess/build-test immediately to confirm the recovery path stays green.`;
		}
		if (result === "positive" && hasDebugging) {
			return ` Prevention: reuse systematic-debugging early if the ${type} failure pattern reappears.`;
		}

		return "";
	}

	private normalizeSkillNames(skillsUsed?: string): string[] {
		return (skillsUsed || "")
			.split(/[,/]|\band\b|\+/i)
			.map((skill) => skill.trim().toLowerCase())
			.filter(Boolean)
			.map((skill) => skill.replace(/^skills? used:\s*/u, ""))
			.map((skill) => skill.replace(/^[-*]\s*/u, ""))
			.map((skill) => skill.replace(/\s+/g, "-"))
			.filter(Boolean);
	}

	private normalizeScorecardReworkFlag(rework?: string): boolean {
		const normalized = (rework || "").trim().toLowerCase();
		return (
			normalized === "yes" || normalized === "y" || normalized === "true" || normalized === "✅"
		);
	}

	private loadScorecardRows() {
		try {
			const memoryPath = path.join(process.cwd(), "MEMORY.md");
			if (!fs.existsSync(memoryPath)) {
				return [];
			}
			return parseScorecardRows(fs.readFileSync(memoryPath, "utf-8"));
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
			}) as Array<"typescript" | "test" | "lint" | "runtime">;
	}

	/**
	 * Add a new pattern with known solution
	 */
	addPattern(
		pattern: Omit<ErrorPattern, "id" | "occurrences" | "lastSeen" | "examples">,
	): ErrorPattern {
		const newPattern: ErrorPattern = {
			...pattern,
			id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
			occurrences: 0,
			lastSeen: new Date().toISOString(),
			examples: [],
		};

		this.patterns.set(newPattern.id, newPattern);
		this.savePatterns();
		return newPattern;
	}

	/**
	 * Update solution for an existing pattern
	 */
	updateSolution(patternId: string, solution: string, confidence?: number): boolean {
		const pattern = this.patterns.get(patternId);
		if (!pattern) return false;

		pattern.solution = solution;
		if (confidence !== undefined) {
			pattern.confidence = Math.max(0, Math.min(100, confidence));
		}
		this.savePatterns();
		return true;
	}

	/**
	 * Get top patterns for proactive injection at session start
	 * Returns patterns sorted by occurrences and confidence
	 */
	getTopPatternsForInjection(maxPatterns = 5): Array<{
		id: string;
		type: string;
		description: string;
		solution: string;
		confidence: number;
	}> {
		const patterns = Array.from(this.patterns.values())
			.filter((p) => p.confidence >= 70) // Only high-confidence patterns
			.sort((a, b) => {
				// Sort by: occurrences (primary), confidence (secondary)
				const scoreA = a.occurrences * 10 + a.confidence;
				const scoreB = b.occurrences * 10 + b.confidence;
				return scoreB - scoreA;
			})
			.slice(0, maxPatterns);

		return patterns.map((p) => ({
			id: p.id,
			type: p.type,
			description: p.description,
			solution: p.solution,
			confidence: p.confidence,
		}));
	}

	/**
	 * Format top patterns for proactive injection context
	 */
	formatTopPatternsForInjection(maxPatterns = 5): string {
		const topPatterns = this.getTopPatternsForInjection(maxPatterns);

		if (topPatterns.length === 0) {
			return "";
		}

		const lines: string[] = [
			"## ⚠️ Known Error Patterns (Proactive Warning)",
			"",
			"These patterns have been learned from past sessions. Watch out for them:",
			"",
		];

		for (const pattern of topPatterns) {
			lines.push(`**${pattern.type}: ${pattern.description}**`);
			lines.push(`- Solution: ${pattern.solution}`);
			lines.push(`- Confidence: ${pattern.confidence}%`);
			lines.push("");
		}

		lines.push(
			"Use errorPatterns({action: 'suggest', error: 'your error message'}) when encountering errors.",
		);

		return lines.join("\n");
	}

	/**
	 * Get pattern statistics
	 */
	getStats(): PatternStats {
		const patterns = Array.from(this.patterns.values());
		const byType: Record<string, number> = {};
		let totalOccurrences = 0;

		for (const pattern of patterns) {
			byType[pattern.type] = (byType[pattern.type] || 0) + 1;
			totalOccurrences += pattern.occurrences;
		}

		const topPatterns = patterns
			.filter((p) => p.occurrences > 0)
			.sort((a, b) => b.occurrences - a.occurrences)
			.slice(0, 10);

		return {
			totalPatterns: patterns.length,
			byType,
			totalOccurrences,
			topPatterns,
		};
	}

	/**
	 * Get all patterns
	 */
	getPatterns(type?: "typescript" | "test" | "lint" | "runtime"): ErrorPattern[] {
		const patterns = Array.from(this.patterns.values());
		if (type) {
			return patterns.filter((p) => p.type === type);
		}
		return patterns;
	}

	/**
	 * Get pattern by ID
	 */
	getPattern(id: string): ErrorPattern | undefined {
		return this.patterns.get(id);
	}

	/**
	 * Clear all learned patterns (keep defaults)
	 */
	clearLearned(): void {
		// Remove all non-default patterns
		for (const [id, pattern] of this.patterns) {
			if (
				!id.startsWith("ts-") &&
				!id.startsWith("test-") &&
				!id.startsWith("lint-") &&
				!id.startsWith("runtime-")
			) {
				this.patterns.delete(id);
			}
		}
		this.savePatterns();
	}
}

// Singleton instance
let instance: ErrorPatternLearner | null = null;

export function getErrorPatternLearner(): ErrorPatternLearner {
	if (!instance) {
		instance = new ErrorPatternLearner();
	}
	return instance;
}

/**
 * Format error pattern stats for display
 */
export function formatPatternStats(stats: PatternStats): string {
	const lines: string[] = [
		"## Error Pattern Statistics",
		"",
		`**Total Patterns:** ${stats.totalPatterns}`,
		`**Total Occurrences:** ${stats.totalOccurrences}`,
		"",
		"**By Type:**",
	];

	for (const [type, count] of Object.entries(stats.byType)) {
		lines.push(`- ${type}: ${count} patterns`);
	}

	if (stats.topPatterns.length > 0) {
		lines.push("", "**Top Patterns (by occurrences):**");
		for (const pattern of stats.topPatterns) {
			lines.push(
				`- ${pattern.id}: ${pattern.occurrences} occurrences (${pattern.confidence}% confidence)`,
			);
		}
	}

	return lines.join("\n");
}
