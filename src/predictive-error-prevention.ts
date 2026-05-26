/**
 * Predictive Error Prevention Module
 *
 * Proactively predicts errors BEFORE they occur based on:
 * - Task type and description patterns
 * - Files being modified
 * - Tools being used
 * - Historical error patterns
 * - Time-based patterns
 * - Code complexity indicators
 *
 * Unlike reactive errorPatterns tool that matches errors after they occur,
 * this module predicts errors proactively to prevent them from happening.
 *
 * Inspired by predictive error prevention patterns from various SWE-agents
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { type ScorecardRow, normalizeScorecardResult, parseScorecardRows } from "./scorecard.js";

// Types
export interface ErrorPrediction {
	id: string;
	predictedErrorType: string;
	probability: number; // 0-1
	confidence: number; // 0-1
	context: {
		taskType?: string;
		filePatterns?: string[];
		toolSequence?: string[];
		timeContext?: string;
		complexityIndicators?: string[];
	};
	preventionSuggestions: string[];
	relatedPatterns: string[];
	detectedAt: string;
	source?: "pattern" | "memory";
}

export interface PredictionContext {
	taskType?: string;
	taskDescription?: string;
	files?: string[];
	toolsUsed?: string[];
	recentErrors?: string[];
	codeComplexity?: number;
	timeOfDay?: number;
	sessionLength?: number;
}

export interface ErrorPattern {
	id: string;
	errorType: string;
	triggerConditions: {
		taskTypes?: string[];
		filePatterns?: string[];
		toolSequences?: string[][];
		complexityThreshold?: number;
		timePatterns?: string[];
	};
	occurrences: number;
	successRate: number; // Rate of successful recovery
	lastOccurred: string;
	preventionStrategies: string[];
}

export interface PredictionStats {
	totalPredictions: number;
	correctPredictions: number;
	falsePositives: number;
	predictionAccuracy: number;
	byErrorType: Record<string, { predicted: number; occurred: number; prevented: number }>;
	byTaskType: Record<string, { predictions: number; accuracy: number }>;
	preventionSuccessRate: number;
	averageLeadTime: number; // Minutes before error would have occurred
}

export interface PredictiveErrorPreventionConfig {
	enabled: boolean;
	minProbability: number; // Minimum probability to show warning
	minConfidence: number; // Minimum confidence to show warning
	proactiveWarnings: boolean;
	sessionStartPredictions: boolean;
	preToolUseChecks: boolean;
	learningEnabled: boolean;
	patternRetentionDays: number;
}

// Default prediction patterns based on common error scenarios
const DEFAULT_ERROR_PATTERNS: ErrorPattern[] = [
	{
		id: "typescript-import-error",
		errorType: "typescript",
		triggerConditions: {
			filePatterns: ["*.ts", "*.tsx"],
			toolSequences: [["edit", "bash"]],
			taskTypes: ["capability", "feature"],
		},
		occurrences: 0,
		successRate: 0.85,
		lastOccurred: "",
		preventionStrategies: [
			"Run `npm run build` after edits to catch import errors early",
			"Check for missing exports in modified files",
			"Verify import paths use correct relative paths",
		],
	},
	{
		id: "lint-error-unused-var",
		errorType: "lint",
		triggerConditions: {
			filePatterns: ["*.ts", "*.tsx", "*.js"],
			toolSequences: [["edit"]],
			taskTypes: ["capability", "feature", "reliability"],
		},
		occurrences: 0,
		successRate: 0.95,
		lastOccurred: "",
		preventionStrategies: [
			"Remove unused variables before running lint",
			"Use underscore prefix for intentionally unused variables",
			"Check if variable is used in template strings or JSX",
		],
	},
	{
		id: "test-timeout-error",
		errorType: "test",
		triggerConditions: {
			taskTypes: ["capability", "reliability"],
			toolSequences: [["edit", "assess"]],
			complexityThreshold: 50,
		},
		occurrences: 0,
		successRate: 0.7,
		lastOccurred: "",
		preventionStrategies: [
			"Add proper timeouts to async tests",
			"Mock external dependencies",
			"Check for infinite loops in test code",
		],
	},
	{
		id: "file-not-found-error",
		errorType: "runtime",
		triggerConditions: {
			toolSequences: [["read"], ["edit"]],
		},
		occurrences: 0,
		successRate: 0.9,
		lastOccurred: "",
		preventionStrategies: [
			"Verify file exists before reading/editing",
			"Use glob to find correct file paths",
			"Check for case sensitivity in file names",
		],
	},
	{
		id: "hook-handler-error",
		errorType: "runtime",
		triggerConditions: {
			filePatterns: ["src/hooks.ts", "src/hook*.ts"],
			taskTypes: ["capability"],
		},
		occurrences: 0,
		successRate: 0.8,
		lastOccurred: "",
		preventionStrategies: [
			"Ensure hook handlers are properly serialized",
			"Restore handlers from defaults when loading from JSON",
			"Test hook execution after modifications",
		],
	},
	{
		id: "context-overflow-error",
		errorType: "runtime",
		triggerConditions: {
			complexityThreshold: 80,
			taskTypes: ["capability"],
		},
		occurrences: 0,
		successRate: 0.75,
		lastOccurred: "",
		preventionStrategies: [
			"Use contextBudget tool to monitor usage",
			"Truncate large file contents before adding to context",
			"Use repomap instead of reading entire files",
		],
	},
	{
		id: "regex-pattern-error",
		errorType: "typescript",
		triggerConditions: {
			filePatterns: ["*.ts"],
			taskTypes: ["reliability", "capability"],
		},
		occurrences: 0,
		successRate: 0.85,
		lastOccurred: "",
		preventionStrategies: [
			"Test regex patterns with sample inputs",
			"Escape special characters in regex patterns",
			"Use verbose regex with comments for complex patterns",
		],
	},
	{
		id: "git-conflict-error",
		errorType: "runtime",
		triggerConditions: {
			toolSequences: [["edit", "edit", "edit"]],
			taskTypes: ["capability", "feature"],
		},
		occurrences: 0,
		successRate: 0.9,
		lastOccurred: "",
		preventionStrategies: [
			"Check git status before multiple edits",
			"Use checkpoints before risky changes",
			"Pull latest changes before starting",
		],
	},
];

const DEFAULT_CONFIG: PredictiveErrorPreventionConfig = {
	enabled: true,
	minProbability: 0.3,
	minConfidence: 0.5,
	proactiveWarnings: true,
	sessionStartPredictions: true,
	preToolUseChecks: true,
	learningEnabled: true,
	patternRetentionDays: 30,
};

const MEMORY_FALLBACK_LOOKBACK = 10;

let managerInstance: PredictiveErrorPreventionManager | null = null;

export class PredictiveErrorPreventionManager {
	private config: PredictiveErrorPreventionConfig;
	private patterns: ErrorPattern[];
	private predictions: ErrorPrediction[];
	private stats: PredictionStats;
	private dataPath: string;

	constructor(configPath?: string) {
		this.config = DEFAULT_CONFIG;
		this.patterns = [...DEFAULT_ERROR_PATTERNS];
		this.predictions = [];
		this.dataPath = path.join(
			process.env.HOME || ".",
			".paimon",
			"predictive-error-prevention.json",
		);
		this.stats = this.initStats();
		this.loadConfig();
		this.loadData();
	}

	private initStats(): PredictionStats {
		return {
			totalPredictions: 0,
			correctPredictions: 0,
			falsePositives: 0,
			predictionAccuracy: 0,
			byErrorType: {},
			byTaskType: {},
			preventionSuccessRate: 0,
			averageLeadTime: 0,
		};
	}

	private loadConfig(): void {
		try {
			const configPath = path.join(
				process.env.HOME || ".",
				".paimon",
				"predictive-error-prevention-config.json",
			);
			if (fs.existsSync(configPath)) {
				const loaded = JSON.parse(fs.readFileSync(configPath, "utf-8"));
				this.config = { ...DEFAULT_CONFIG, ...loaded };
			}
		} catch {
			// Use defaults
		}
	}

	private loadData(): void {
		try {
			if (fs.existsSync(this.dataPath)) {
				const data = JSON.parse(fs.readFileSync(this.dataPath, "utf-8"));
				if (data.patterns) {
					// Merge loaded patterns with defaults
					const loadedIds = new Set(data.patterns.map((p: ErrorPattern) => p.id));
					for (const pattern of data.patterns) {
						const defaultIndex = this.patterns.findIndex((p) => p.id === pattern.id);
						if (defaultIndex >= 0) {
							this.patterns[defaultIndex] = pattern;
						} else {
							this.patterns.push(pattern);
						}
					}
				}
				if (data.predictions) {
					this.predictions = data.predictions;
				}
				if (data.stats) {
					this.stats = data.stats;
				}
			}
		} catch {
			// Start fresh
		}
	}

	private saveData(): void {
		try {
			const dir = path.dirname(this.dataPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(
				this.dataPath,
				JSON.stringify(
					{
						patterns: this.patterns,
						predictions: this.predictions.slice(-100), // Keep last 100
						stats: this.stats,
						config: this.config,
					},
					null,
					2,
				),
			);
		} catch (error) {
			console.error("Failed to save predictive error prevention data:", error);
		}
	}

	// Main prediction method
	public predict(context: PredictionContext): ErrorPrediction[] {
		if (!this.config.enabled) {
			return [];
		}

		const predictions = this.generatePredictions(context);

		// Store predictions
		for (const pred of predictions) {
			this.predictions.push(pred);
			this.updateStats(pred, context);
		}

		this.saveData();
		return predictions;
	}

	private generatePredictions(context: PredictionContext): ErrorPrediction[] {
		const predictions: ErrorPrediction[] = [];
		const now = new Date().toISOString();
		for (const pattern of this.patterns) {
			const probability = this.calculateProbability(pattern, context);
			const confidence = this.calculateConfidence(pattern, context);

			if (probability >= this.config.minProbability && confidence >= this.config.minConfidence) {
				predictions.push({
					id: `pred-${pattern.id}-${Date.now()}`,
					predictedErrorType: pattern.errorType,
					probability,
					confidence,
					context: {
						taskType: context.taskType,
						filePatterns: context.files?.map((f) => path.extname(f)),
						toolSequence: context.toolsUsed,
						timeContext: this.getTimeContext(context.timeOfDay),
					},
					preventionSuggestions: pattern.preventionStrategies,
					relatedPatterns: [pattern.id],
					detectedAt: now,
					source: "pattern",
				});
			}
		}

		for (const fallback of this.getMemoryFallbackPredictions(context, now)) {
			predictions.push(fallback);
		}

		predictions.sort((a, b) => b.probability * b.confidence - a.probability * a.confidence);
		return predictions;
	}

	private calculateProbability(pattern: ErrorPattern, context: PredictionContext): number {
		let probability = 0.1; // Base probability

		// Task type match
		if (context.taskType && pattern.triggerConditions.taskTypes?.includes(context.taskType)) {
			probability += 0.3;
		}

		// File pattern match
		if (context.files && pattern.triggerConditions.filePatterns) {
			const matchingFiles = context.files.filter((f) =>
				pattern.triggerConditions.filePatterns?.some((p) => {
					const ext = path.extname(f);
					return p.includes(ext) || p.includes("*");
				}),
			);
			if (matchingFiles.length > 0) {
				probability += 0.2 * Math.min(matchingFiles.length / context.files.length, 1);
			}
		}

		// Tool sequence match
		if (context.toolsUsed && pattern.triggerConditions.toolSequences) {
			for (const seq of pattern.triggerConditions.toolSequences) {
				if (this.matchesSequence(context.toolsUsed, seq)) {
					probability += 0.25;
					break;
				}
			}
		}

		// Complexity threshold
		if (context.codeComplexity && pattern.triggerConditions.complexityThreshold) {
			if (context.codeComplexity > pattern.triggerConditions.complexityThreshold) {
				probability += 0.2;
			}
		}

		// Recent errors
		if (context.recentErrors?.includes(pattern.errorType)) {
			probability += 0.15;
		}

		// Historical success rate adjustment
		probability *= pattern.successRate;

		return Math.min(probability, 1);
	}

	private calculateConfidence(pattern: ErrorPattern, context: PredictionContext): number {
		// Confidence is based on how many trigger conditions match
		let confidence = 0.3; // Base confidence

		let matchedConditions = 0;
		let totalConditions = 0;

		if (pattern.triggerConditions.taskTypes) {
			totalConditions++;
			if (context.taskType && pattern.triggerConditions.taskTypes.includes(context.taskType)) {
				matchedConditions++;
			}
		}

		if (pattern.triggerConditions.filePatterns) {
			totalConditions++;
			if (
				context.files?.some((f) =>
					pattern.triggerConditions.filePatterns?.some((p) => f.endsWith(p.replace("*", ""))),
				)
			) {
				matchedConditions++;
			}
		}

		if (pattern.triggerConditions.toolSequences) {
			totalConditions++;
			const toolsUsed = context.toolsUsed;
			if (
				toolsUsed &&
				pattern.triggerConditions.toolSequences.some((seq) => this.matchesSequence(toolsUsed, seq))
			) {
				matchedConditions++;
			}
		}

		if (pattern.triggerConditions.complexityThreshold) {
			totalConditions++;
			if (
				context.codeComplexity &&
				context.codeComplexity > pattern.triggerConditions.complexityThreshold
			) {
				matchedConditions++;
			}
		}

		if (totalConditions > 0) {
			confidence += 0.7 * (matchedConditions / totalConditions);
		}

		// Adjust for pattern occurrence rate
		if (pattern.occurrences > 5) {
			confidence *= 1.1; // Boost for well-established patterns
		}

		return Math.min(confidence, 1);
	}

	private matchesSequence(used: string[], pattern: string[]): boolean {
		// Check if pattern appears consecutively in used
		for (let i = 0; i <= used.length - pattern.length; i++) {
			let match = true;
			for (let j = 0; j < pattern.length; j++) {
				if (used[i + j] !== pattern[j]) {
					match = false;
					break;
				}
			}
			if (match) return true;
		}
		return false;
	}

	private getTimeContext(timeOfDay?: number): string {
		const hour = timeOfDay ?? new Date().getHours();
		if (hour >= 6 && hour < 12) return "morning";
		if (hour >= 12 && hour < 18) return "afternoon";
		if (hour >= 18 && hour < 22) return "evening";
		return "night";
	}

	private getMemoryFallbackPredictions(
		context: PredictionContext,
		detectedAt: string,
	): ErrorPrediction[] {
		const rows = this.loadScorecardRows();
		if (rows.length === 0) {
			return [];
		}

		const relevantRows = rows
			.filter((row) => !context.taskType || row.taskType === context.taskType)
			.slice(0, MEMORY_FALLBACK_LOOKBACK);
		if (relevantRows.length === 0) {
			return [];
		}

		const errorSignals = new Map<
			string,
			{
				count: number;
				failureCount: number;
				successCount: number;
				unknownCount: number;
				suggestions: string[];
				relatedPatterns: Set<string>;
			}
		>();

		const rankedRows = relevantRows
			.map((row, index) => ({ row, index }))
			.sort((a, b) => this.compareMemoryFallbackRows(a.row, b.row, a.index, b.index));

		for (const { row } of rankedRows) {
			const normalizedErrors = this.normalizeScorecardErrors(row.errors);
			const result = normalizeScorecardResult(row.result, row.firstTry);
			const rework = this.normalizeScorecardReworkFlag(row.rework);
			for (const errorType of normalizedErrors) {
				const preventionNote = this.buildMemoryPreventionNote(
					errorType,
					row.skillsUsed,
					rework,
					result,
				);
				const signal = errorSignals.get(errorType) ?? {
					count: 0,
					failureCount: 0,
					successCount: 0,
					unknownCount: 0,
					suggestions: [],
					relatedPatterns: new Set<string>(),
				};
				signal.count++;
				if (result === "negative") {
					signal.failureCount++;
				} else if (result === "positive") {
					signal.successCount++;
				} else {
					signal.unknownCount++;
				}
				signal.relatedPatterns.add(`scorecard-${row.date}`);

				for (const suggestion of this.buildMemoryFallbackSuggestions({
					errorType,
					result,
					row,
					contextTaskType: context.taskType,
					preventionNote,
					rework,
				})) {
					if (!signal.suggestions.includes(suggestion)) {
						signal.suggestions.push(suggestion);
					}
				}

				errorSignals.set(errorType, signal);
			}
		}

		const fallbackPredictions: ErrorPrediction[] = [];
		for (const [errorType, signal] of errorSignals) {
			const weightedCount =
				signal.failureCount * 1.25 + signal.unknownCount + signal.successCount * 0.75;
			const probability = Math.min(0.2 + weightedCount * 0.15, 0.65);
			const confidence = Math.min(
				0.45 +
					(signal.failureCount * 0.15 + signal.unknownCount * 0.12 + signal.successCount * 0.08),
				0.85,
			);
			if (probability < this.config.minProbability || confidence < this.config.minConfidence) {
				continue;
			}

			fallbackPredictions.push({
				id: `pred-memory-${errorType}-${Date.now()}`,
				predictedErrorType: errorType,
				probability,
				confidence,
				context: {
					taskType: context.taskType,
					filePatterns: context.files?.map((file) => path.extname(file)),
					toolSequence: context.toolsUsed,
					timeContext: this.getTimeContext(context.timeOfDay),
					complexityIndicators: ["memory-scorecard-fallback"],
				},
				preventionSuggestions: signal.suggestions.slice(0, 4),
				relatedPatterns: Array.from(signal.relatedPatterns),
				detectedAt,
				source: "memory",
			});
		}

		return fallbackPredictions;
	}

	private compareMemoryFallbackRows(
		a: ScorecardRow,
		b: ScorecardRow,
		indexA: number,
		indexB: number,
	) {
		const priorityDelta = this.getMemoryFallbackPriority(a) - this.getMemoryFallbackPriority(b);
		if (priorityDelta !== 0) {
			return priorityDelta;
		}

		return indexA - indexB;
	}

	private getMemoryFallbackPriority(row: ScorecardRow): number {
		const result = normalizeScorecardResult(row.result, row.firstTry);
		const rework = this.normalizeScorecardReworkFlag(row.rework);
		const normalizedSkills = this.normalizeSkillNames(row.skillsUsed);
		const hasDebugging = normalizedSkills.includes("systematic-debugging");
		const hasReview = normalizedSkills.includes("review-changes");
		const hasAssess = normalizedSkills.includes("assess");

		if (result === "negative") {
			return hasDebugging ? 0 : hasReview ? 1 : 2;
		}
		if (result === "positive" && rework) {
			if (hasReview) return 3;
			if (hasDebugging || hasAssess) return 4;
			return 5;
		}
		if (result === "positive") {
			return hasDebugging || hasReview || hasAssess ? 6 : 7;
		}
		return 8;
	}

	private buildMemoryFallbackSuggestions({
		errorType,
		result,
		row,
		contextTaskType,
		preventionNote,
		rework,
	}: {
		errorType: string;
		result: "positive" | "negative" | "unknown";
		row: ScorecardRow;
		contextTaskType?: string;
		preventionNote: string;
		rework: boolean;
	}): string[] {
		const taskType = contextTaskType || row.taskType;
		const suggestions: string[] = [];
		const hasExplicitRework = typeof row.rework === "string" && row.rework.trim().length > 0;

		if (result === "negative") {
			suggestions.push(
				`Recent MEMORY.md failure on ${row.date}: ${row.description}. This ${errorType} issue remained unresolved in ${taskType} work.${preventionNote}`,
			);
		} else if (result === "positive" && rework) {
			suggestions.push(
				`Recent recovered ${taskType} session on ${row.date}: ${row.description}. ${errorType} issues required rework before finishing cleanly.${preventionNote}`,
			);
		} else if (result === "positive" && hasExplicitRework) {
			suggestions.push(
				`Recent clean ${taskType} success on ${row.date}: ${row.description}. Review it as a lower-priority reference for avoiding ${errorType} regressions.`,
			);
		} else if (result === "positive") {
			suggestions.push(
				`Recent successful ${taskType} work on ${row.date}: ${row.description}. Review it as a lower-priority reference for avoiding ${errorType} regressions.`,
			);
		} else {
			suggestions.push(
				`Recent MEMORY.md scorecard entry on ${row.date} recorded ${errorType} errors for ${taskType} work; review similar fixes before implementation.`,
			);
		}

		if (row.skillsUsed && result === "positive") {
			suggestions.push(
				`Reuse skills from recent successful work when applicable: ${row.skillsUsed}`,
			);
		}
		if (row.description) {
			suggestions.push(`Relevant recent task: ${row.description}`);
		}

		return suggestions;
	}

	private buildMemoryPreventionNote(
		errorType: string,
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
				return ` Prevention: re-run systematic-debugging before editing to isolate the failing ${errorType} path.`;
			}
			if (hasReview) {
				return ` Prevention: inspect the last review-changes findings before retrying so the unresolved ${errorType} path does not repeat.`;
			}
		}
		if (rework && hasReview) {
			return ` Prevention: run review-changes before assess/build-test so similar ${errorType} regressions are caught earlier.`;
		}
		if (result === "positive" && rework && hasAssess) {
			return ` Prevention: after fixing the ${errorType} issue, rerun assess/build-test immediately to confirm the recovery path stays green.`;
		}
		if (result === "positive" && hasDebugging) {
			return ` Prevention: reuse systematic-debugging early if the ${errorType} failure pattern reappears.`;
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

	private loadScorecardRows(): ScorecardRow[] {
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

	private normalizeScorecardErrors(
		errors?: string,
	): Array<"typescript" | "test" | "lint" | "runtime"> {
		const normalized = (errors || "").trim().toLowerCase();
		if (!normalized || normalized === "none") {
			return [];
		}
		const mapped = normalized
			.split(/[\/,]|\band\b/)
			.map((part) => part.trim())
			.filter(Boolean)
			.map((part) => {
				if (part === "ts") return "typescript";
				return part;
			});
		return mapped.filter(
			(part): part is "typescript" | "test" | "lint" | "runtime" =>
				part === "typescript" || part === "test" || part === "lint" || part === "runtime",
		);
	}

	private updateStats(prediction: ErrorPrediction, context: PredictionContext): void {
		this.stats.totalPredictions++;

		// By error type
		if (!this.stats.byErrorType[prediction.predictedErrorType]) {
			this.stats.byErrorType[prediction.predictedErrorType] = {
				predicted: 0,
				occurred: 0,
				prevented: 0,
			};
		}
		this.stats.byErrorType[prediction.predictedErrorType].predicted++;

		// By task type
		if (context.taskType) {
			if (!this.stats.byTaskType[context.taskType]) {
				this.stats.byTaskType[context.taskType] = { predictions: 0, accuracy: 0 };
			}
			this.stats.byTaskType[context.taskType].predictions++;
		}
	}

	// Record that a prediction was correct (error occurred)
	public recordOccurrence(predictionId: string): void {
		const prediction = this.predictions.find((p) => p.id === predictionId);
		if (prediction) {
			if (!this.stats.byErrorType[prediction.predictedErrorType]) {
				this.stats.byErrorType[prediction.predictedErrorType] = {
					predicted: 0,
					occurred: 0,
					prevented: 0,
				};
			}
			this.stats.byErrorType[prediction.predictedErrorType].occurred++;
			this.stats.correctPredictions++;
			this.updateAccuracy();
			this.saveData();
		}
	}

	// Record that a prevention was successful (error avoided)
	public recordPrevention(predictionId: string): void {
		const prediction = this.predictions.find((p) => p.id === predictionId);
		if (prediction) {
			if (!this.stats.byErrorType[prediction.predictedErrorType]) {
				this.stats.byErrorType[prediction.predictedErrorType] = {
					predicted: 0,
					occurred: 0,
					prevented: 0,
				};
			}
			this.stats.byErrorType[prediction.predictedErrorType].prevented++;
			this.updateAccuracy();
			this.saveData();
		}
	}

	// Record that a prediction was false positive (error never occurred)
	public recordFalsePositive(predictionId: string): void {
		this.stats.falsePositives++;
		this.updateAccuracy();
		this.saveData();
	}

	private updateAccuracy(): void {
		const total = this.stats.correctPredictions + this.stats.falsePositives;
		if (total > 0) {
			this.stats.predictionAccuracy = this.stats.correctPredictions / total;
		}
	}

	// Get proactive warnings for a task
	public getWarnings(context: PredictionContext): string[] {
		if (!this.config.proactiveWarnings) {
			return [];
		}

		const predictions = this.predict(context);
		const warnings: string[] = [];

		for (const pred of predictions.slice(0, 3)) {
			// Top 3 predictions
			const probStr = Math.round(pred.probability * 100);
			const confStr = Math.round(pred.confidence * 100);
			const sourceLabel = pred.source === "memory" ? " [MEMORY]" : "";
			warnings.push(
				`⚠️ Predicted error${sourceLabel}: ${pred.predictedErrorType} (${probStr}% probability, ${confStr}% confidence)`,
			);
			if (pred.preventionSuggestions.length > 0) {
				warnings.push(`   Prevention: ${pred.preventionSuggestions[0]}`);
			}
		}

		return warnings;
	}

	// Get session start predictions
	public getSessionStartPredictions(
		taskType?: string,
		taskDescription?: string,
	): ErrorPrediction[] {
		if (!this.config.sessionStartPredictions) {
			return [];
		}

		return this.predict({
			taskType,
			taskDescription,
		});
	}

	// Get pre-tool-use check
	public getPreToolUseCheck(tool: string, context: PredictionContext): ErrorPrediction[] | null {
		if (!this.config.preToolUseChecks) {
			return null;
		}

		// Add the tool to the sequence
		const toolsUsed = [...(context.toolsUsed || []), tool];
		return this.predict({
			...context,
			toolsUsed,
		});
	}

	// Learn from an error that occurred
	public learnFromError(
		errorType: string,
		context: PredictionContext,
		preventionWorked: boolean,
	): void {
		if (!this.config.learningEnabled) {
			return;
		}

		// Find matching pattern
		const matchingPattern = this.patterns.find((p) => p.errorType === errorType);
		if (matchingPattern) {
			matchingPattern.occurrences++;
			matchingPattern.lastOccurred = new Date().toISOString();
			if (preventionWorked) {
				matchingPattern.successRate = Math.min(matchingPattern.successRate + 0.01, 1);
			}
		} else {
			// Create new pattern
			this.patterns.push({
				id: `learned-${errorType}-${Date.now()}`,
				errorType,
				triggerConditions: {
					taskTypes: context.taskType ? [context.taskType] : undefined,
					filePatterns: context.files?.map((f) => path.extname(f)).filter(Boolean) as string[],
					toolSequences: context.toolsUsed ? [context.toolsUsed] : undefined,
				},
				occurrences: 1,
				successRate: preventionWorked ? 0.8 : 0.5,
				lastOccurred: new Date().toISOString(),
				preventionStrategies: [],
			});
		}

		this.saveData();
	}

	// Add custom pattern
	public addPattern(pattern: ErrorPattern): void {
		this.patterns.push(pattern);
		this.saveData();
	}

	// Remove pattern
	public removePattern(patternId: string): boolean {
		const index = this.patterns.findIndex((p) => p.id === patternId);
		if (index >= 0) {
			this.patterns.splice(index, 1);
			this.saveData();
			return true;
		}
		return false;
	}

	// Getters
	public isEnabled(): boolean {
		return this.config.enabled;
	}

	public setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveData();
	}

	public getConfig(): PredictiveErrorPreventionConfig {
		return { ...this.config };
	}

	public updateConfig(updates: Partial<PredictiveErrorPreventionConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveData();
	}

	public getPatterns(): ErrorPattern[] {
		return [...this.patterns];
	}

	public getPattern(patternId: string): ErrorPattern | undefined {
		return this.patterns.find((p) => p.id === patternId);
	}

	public getPredictions(): ErrorPrediction[] {
		return [...this.predictions];
	}

	public getStats(): PredictionStats {
		return { ...this.stats };
	}

	public resetStats(): void {
		this.stats = this.initStats();
		this.saveData();
	}

	public clearPredictions(): void {
		this.predictions = [];
		this.saveData();
	}

	// Format predictions for display
	public formatPredictions(predictions: ErrorPrediction[] = this.predictions): string {
		if (predictions.length === 0) {
			return "No error predictions.";
		}

		const lines: string[] = [
			"## Predicted Errors",
			"",
			"| Error Type | Probability | Confidence | Prevention |",
			"|------------|-------------|------------|------------|",
		];

		for (const pred of predictions.slice(0, 10)) {
			const probStr = `${Math.round(pred.probability * 100)}%`;
			const confStr = `${Math.round(pred.confidence * 100)}%`;
			const prevention = pred.preventionSuggestions[0]?.slice(0, 40) || "N/A";
			const label =
				pred.source === "memory" ? `${pred.predictedErrorType} (memory)` : pred.predictedErrorType;
			lines.push(`| ${label} | ${probStr} | ${confStr} | ${prevention}... |`);
		}

		return lines.join("\n");
	}

	// Format stats for display
	public formatStats(): string {
		const lines: string[] = [
			"## Prediction Statistics",
			"",
			`- **Total Predictions:** ${this.stats.totalPredictions}`,
			`- **Correct Predictions:** ${this.stats.correctPredictions}`,
			`- **False Positives:** ${this.stats.falsePositives}`,
			`- **Accuracy:** ${Math.round(this.stats.predictionAccuracy * 100)}%`,
			`- **Prevention Success Rate:** ${Math.round(this.stats.preventionSuccessRate * 100)}%`,
			"",
			"### By Error Type",
			"",
			"| Error Type | Predicted | Occurred | Prevented |",
			"|------------|-----------|----------|-----------|",
		];

		for (const [errorType, stats] of Object.entries(this.stats.byErrorType)) {
			lines.push(`| ${errorType} | ${stats.predicted} | ${stats.occurred} | ${stats.prevented} |`);
		}

		return lines.join("\n");
	}
}

// Singleton instance getter
export function getPredictiveErrorPreventionManager(): PredictiveErrorPreventionManager {
	if (!managerInstance) {
		managerInstance = new PredictiveErrorPreventionManager();
	}
	return managerInstance;
}

export function initPredictiveErrorPreventionManager(
	config?: PredictiveErrorPreventionConfig,
): PredictiveErrorPreventionManager {
	managerInstance = new PredictiveErrorPreventionManager();
	if (config) {
		managerInstance.updateConfig(config);
	}
	return managerInstance;
}

export function resetPredictiveErrorPreventionManager(): void {
	managerInstance = null;
}
