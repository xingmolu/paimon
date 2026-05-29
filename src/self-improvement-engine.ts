/**
 * Self-Improvement Suggestion Engine
 *
 * Proactively analyzes the codebase and suggests improvements to the agent.
 * Unlike reactive error handling or task prediction, this is a forward-looking
 * capability that identifies improvement opportunities before they're needed.
 *
 * Benefits:
 * - Proactive identification of improvement opportunities
 * - Code quality suggestions based on best practices
 * - Missing capability detection from competitor patterns
 * - Performance optimization suggestions
 * - Architecture improvement recommendations
 *
 * Inspired by Aider's code analysis patterns and Claude Code's review capabilities.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { getCapabilityGapDetector } from "./capability-gap.js";
import { analyzeContextTasks, buildContextAnalyzeCommand } from "./context-analysis.js";
import type {
	Bottleneck,
	HealthComponents,
	OptimizationRecommendation,
} from "./optimization-dashboard.js";
import { getOptimizationDashboardManager } from "./optimization-dashboard.js";
import { parseScorecardRows } from "./scorecard.js";
import { getToolUsageAnalyticsManager } from "./tool-usage-analytics.js";

/**
 * Improvement category types.
 */
export type ImprovementCategory =
	| "code-quality"
	| "performance"
	| "architecture"
	| "capability"
	| "reliability"
	| "documentation"
	| "testing"
	| "security";

/**
 * Priority level for suggestions.
 */
export type Priority = "critical" | "high" | "medium" | "low";

/**
 * Improvement suggestion.
 */
export interface ImprovementSuggestion {
	id: string;
	category: ImprovementCategory;
	priority: Priority;
	title: string;
	description: string;
	filePath?: string;
	lineNumber?: number;
	suggestedFix?: string;
	impact: string;
	effort: "simple" | "moderate" | "complex" | "very-complex";
	confidence: number; // 0-100
	source:
		| "code-analysis"
		| "competitor-pattern"
		| "usage-analytics"
		| "capability-gap"
		| "best-practice";
	timestamp: string;
}

/**
 * Suggestion engine configuration.
 */
export interface SuggestionEngineConfig {
	enabled: boolean;
	scanOnStartup: boolean;
	minConfidence: number; // 0-100, minimum confidence to include suggestion
	maxSuggestions: number; // Maximum suggestions to return
	scanPatterns: string[]; // File patterns to scan
	excludePatterns: string[]; // Patterns to exclude
}

/**
 * Suggestion engine stats.
 */
export interface SuggestionEngineStats {
	totalSuggestions: number;
	byCategory: Record<ImprovementCategory, number>;
	byPriority: Record<Priority, number>;
	bySource: Record<string, number>;
	averageConfidence: number;
	lastScanTime: string;
	suggestionsAccepted: number;
	suggestionsDismissed: number;
}

/**
 * Code pattern for detection.
 */
interface CodePattern {
	pattern: RegExp;
	category: ImprovementCategory;
	title: string;
	description: string;
	suggestedFix?: string;
	priority: Priority;
}

/**
 * Default configuration.
 */
const DEFAULT_CONFIG: SuggestionEngineConfig = {
	enabled: true,
	scanOnStartup: false,
	minConfidence: 50,
	maxSuggestions: 20,
	scanPatterns: ["src/**/*.ts"],
	excludePatterns: ["**/*.test.ts", "**/*.d.ts"],
};

const SUGGESTION_STALE_AFTER_MS = 1000 * 60 * 60 * 6; // 6 hours

/**
 * Code patterns to detect for improvement suggestions.
 * Note: Using string patterns to avoid security false positives
 */
function getCodePatterns(): CodePattern[] {
	return [
		// Code Quality Patterns
		{
			pattern: /TODO|FIXME|HACK|XXX/g,
			category: "code-quality",
			title: "Unresolved TODO/FIXME comment",
			description: "Found unresolved comment that indicates incomplete work",
			priority: "medium",
		},
		{
			pattern: /console\.(log|warn|error)\([^)]*\)/g,
			category: "code-quality",
			title: "Console logging statement",
			description: "Consider using a proper logging system instead of console",
			priority: "low",
		},
		{
			pattern: /:\s*any\s*[;:\)\[]/g,
			category: "code-quality",
			title: "Use of 'any' type",
			description: "Consider using a more specific type for better type safety",
			priority: "medium",
		},
		{
			pattern: /catch\s*\([^)]*\)\s*\{\s*\}/g,
			category: "reliability",
			title: "Empty catch block",
			description: "Empty catch blocks silently swallow errors. Add error handling.",
			priority: "high",
		},
		// Performance Patterns
		{
			pattern: /\.forEach\s*\([^)]*=>\s*\{[^}]*await/g,
			category: "performance",
			title: "Async in forEach",
			description: "forEach with async doesn't wait. Use for...of with await or Promise.all",
			priority: "medium",
		},
		{
			pattern: /JSON\.(parse|stringify)\s*\(/g,
			category: "performance",
			title: "JSON serialization",
			description: "Consider caching JSON results if called frequently with same data",
			priority: "low",
		},
		// Architecture Patterns
		{
			pattern: /import\s+\*\s+as\s+\w+\s+from/g,
			category: "architecture",
			title: "Namespace import",
			description: "Consider named imports for better tree-shaking",
			priority: "low",
		},
		{
			pattern: /class\s+\w+\s+extends\s+\w+/g,
			category: "architecture",
			title: "Class inheritance",
			description: "Consider composition over inheritance for flexibility",
			priority: "low",
		},
	];
}

/**
 * Security patterns to detect (for security category suggestions)
 */
function getSecurityPatterns(): CodePattern[] {
	return [
		{
			pattern: /\beval\s*\(/g,
			category: "security",
			title: "Dynamic code execution",
			description: "Dynamic code execution is dangerous. Review and use safer alternatives",
			priority: "critical",
		},
		{
			pattern: /new\s+Function\s*\(/g,
			category: "security",
			title: "Dynamic Function creation",
			description: "Dynamic function creation can be unsafe. Review usage",
			priority: "high",
		},
	];
}

/**
 * Competitor patterns that could be added.
 */
const COMPETITOR_SUGGESTIONS: Omit<ImprovementSuggestion, "id" | "timestamp">[] = [
	{
		category: "capability",
		priority: "medium",
		title: "Auto-context detection",
		description: "Automatically detect which files need to be read based on task description",
		impact: "Reduces context gathering time and improves accuracy",
		effort: "moderate",
		confidence: 70,
		source: "competitor-pattern",
	},
	{
		category: "capability",
		priority: "low",
		title: "Interactive tutorial mode",
		description: "Guide users through using Paimon with interactive tutorials",
		impact: "Improves user onboarding and adoption",
		effort: "moderate",
		confidence: 60,
		source: "competitor-pattern",
	},
	{
		category: "performance",
		priority: "medium",
		title: "Parallel file analysis",
		description: "Analyze multiple files in parallel for faster codebase understanding",
		impact: "Faster codebase exploration for large projects",
		effort: "moderate",
		confidence: 75,
		source: "competitor-pattern",
	},
	{
		category: "capability",
		priority: "low",
		title: "Code generation templates",
		description: "Pre-defined templates for common code generation patterns",
		impact: "Faster implementation of common patterns",
		effort: "simple",
		confidence: 65,
		source: "competitor-pattern",
	},
];

/**
 * Self-Improvement Suggestion Engine
 * Analyzes codebase and suggests improvements proactively.
 */
export class SelfImprovementEngine {
	private config: SuggestionEngineConfig;
	private stats: SuggestionEngineStats;
	private suggestions: Map<string, ImprovementSuggestion> = new Map();
	private dataPath: string;
	private dismissedIds: Set<string> = new Set();
	private readonly fingerprintPrefix = "self-improvement";

	constructor(configPath?: string) {
		this.config = DEFAULT_CONFIG;
		this.dataPath = path.join(process.env.HOME || ".", ".paimon", "suggestions.json");
		this.stats = this.getDefaultStats();
		this.loadData();
	}

	private getDefaultStats(): SuggestionEngineStats {
		return {
			totalSuggestions: 0,
			byCategory: {
				"code-quality": 0,
				performance: 0,
				architecture: 0,
				capability: 0,
				reliability: 0,
				documentation: 0,
				testing: 0,
				security: 0,
			},
			byPriority: {
				critical: 0,
				high: 0,
				medium: 0,
				low: 0,
			},
			bySource: {},
			averageConfidence: 0,
			lastScanTime: "",
			suggestionsAccepted: 0,
			suggestionsDismissed: 0,
		};
	}

	private loadData(): void {
		try {
			if (fs.existsSync(this.dataPath)) {
				const data = JSON.parse(fs.readFileSync(this.dataPath, "utf-8"));
				this.config = { ...DEFAULT_CONFIG, ...data.config };
				this.stats = { ...this.getDefaultStats(), ...data.stats };
				this.dismissedIds = new Set(data.dismissedIds || []);
				if (data.suggestions) {
					for (const s of data.suggestions) {
						this.suggestions.set(s.id, s);
					}
				}
			}
		} catch {
			// Use defaults
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
						config: this.config,
						stats: this.stats,
						dismissedIds: Array.from(this.dismissedIds),
						suggestions: Array.from(this.suggestions.values()),
					},
					null,
					2,
				),
			);
		} catch (error) {
			console.error("Failed to save suggestion data:", error);
		}
	}

	private toSlug(value: string): string {
		return value
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 60);
	}

	private buildSuggestionId(suggestion: Omit<ImprovementSuggestion, "id">): string {
		const fingerprintParts = [
			this.fingerprintPrefix,
			suggestion.source,
			suggestion.category,
			suggestion.priority,
			suggestion.filePath ?? "global",
			suggestion.lineNumber?.toString() ?? "0",
			suggestion.title,
		];
		return this.toSlug(fingerprintParts.join("-"));
	}

	private createSuggestion(
		suggestion: Omit<ImprovementSuggestion, "id" | "timestamp"> & {
			filePath?: string;
			lineNumber?: number;
		},
	): ImprovementSuggestion {
		const baseSuggestion: Omit<ImprovementSuggestion, "id"> = {
			...suggestion,
			timestamp: new Date().toISOString(),
		};
		return {
			...baseSuggestion,
			id: this.buildSuggestionId(baseSuggestion),
		};
	}

	private deduplicateSuggestions(suggestions: ImprovementSuggestion[]): ImprovementSuggestion[] {
		const deduplicated = new Map<string, ImprovementSuggestion>();
		for (const suggestion of suggestions) {
			const normalized = { ...suggestion, id: this.buildSuggestionId(suggestion) };
			const existing = deduplicated.get(normalized.id);
			if (!existing || normalized.confidence > existing.confidence) {
				deduplicated.set(normalized.id, normalized);
			}
		}
		return Array.from(deduplicated.values());
	}

	private isInternalDetectorDefinitionPath(normalizedPath: string): boolean {
		const internalDetectorFiles = new Set([
			"src/hooks.ts",
			"src/prompt.ts",
			"src/safety-gates.ts",
			"src/security-guidance.ts",
			"src/tools/assess-tool.ts",
		]);
		return internalDetectorFiles.has(normalizedPath);
	}

	private isLowSignalCodeSuggestion(suggestion: ImprovementSuggestion): boolean {
		if (suggestion.source !== "code-analysis" || !suggestion.filePath) {
			return false;
		}

		const normalizedPath = suggestion.filePath.replace(/\\/g, "/");
		if (
			normalizedPath.startsWith("dist/") ||
			normalizedPath.endsWith(".d.ts") ||
			normalizedPath.endsWith(".test.ts")
		) {
			return true;
		}

		if (
			suggestion.category === "security" &&
			this.isInternalDetectorDefinitionPath(normalizedPath)
		) {
			return true;
		}

		return false;
	}

	private isDuplicateCapabilitySuggestion(suggestion: ImprovementSuggestion): boolean {
		if (suggestion.source !== "competitor-pattern") {
			return false;
		}

		const implementedCompetitorTitles = new Set([
			"Auto-context detection",
			"Parallel file analysis",
			"Code generation templates",
		]);

		return implementedCompetitorTitles.has(suggestion.title);
	}

	private filterSuggestions(suggestions: ImprovementSuggestion[]): ImprovementSuggestion[] {
		const health = this.safeGetDashboardHealth();
		const hasConcreteRecentSuccessEvidence = this.hasConcreteRecentSuccessEvidence(suggestions);
		return suggestions.filter(
			(suggestion) =>
				!this.isLowSignalCodeSuggestion(suggestion) &&
				!this.isDuplicateCapabilitySuggestion(suggestion) &&
				!this.isLowSignalRecentSuccessSuggestion(suggestion) &&
				!this.isAlreadyCapturedRecurringGuardrailSuggestion(suggestion) &&
				!this.isSatisfiedBestPracticeSuggestion(
					suggestion,
					health,
					hasConcreteRecentSuccessEvidence,
					suggestions,
				),
		);
	}

	private getDashboardManager(): {
		getHealth(): {
			status: "excellent" | "good" | "fair" | "poor";
			overallScore: number;
			components?: Partial<HealthComponents>;
		};
		identifyBottlenecks(): Bottleneck[];
		getRecommendations(): OptimizationRecommendation[];
	} {
		return getOptimizationDashboardManager();
	}

	private safeGetDashboardHealth(): {
		status: "excellent" | "good" | "fair" | "poor";
		overallScore: number;
		components?: Partial<HealthComponents>;
	} | null {
		try {
			return this.getDashboardManager().getHealth();
		} catch {
			return null;
		}
	}

	private isRedundantImplementedEnablerSuggestion(suggestion: ImprovementSuggestion): boolean {
		if (suggestion.source !== "best-practice") {
			return false;
		}

		const description = suggestion.description.toLowerCase();
		if (!description.includes("recommended enablers:")) {
			return false;
		}

		if (description.includes("likely starting files")) {
			return false;
		}

		const implementedEnablerTitles = new Set([
			"self-assessment",
			"error-recovery",
			"reflection",
			"better-planning",
			"tool-chain-reliability",
			"repo-map",
			"auto-invoke-skills",
			"unified-intelligence",
			"memory-persistence",
			"rag",
			"learning-transfer",
			"self-healing",
			"error-patterns",
		]);
		const enablerSection = description.split("recommended enablers:")[1]?.split(".")[0] ?? "";
		const recommendedEnablers = enablerSection
			.split(/,| and /)
			.map((enabler) => enabler.trim())
			.filter(Boolean);
		if (recommendedEnablers.length === 0) {
			return false;
		}

		return recommendedEnablers.every((enabler) => implementedEnablerTitles.has(enabler));
	}

	private hasActionableWeakSignalSkillEvidence(suggestion: ImprovementSuggestion): boolean {
		if (suggestion.title !== "Capture reusable lessons from weak-signal skills") {
			return false;
		}

		const description = suggestion.description.toLowerCase();
		const hasSpecificSkill = /around\s+[a-z0-9-]+\s*\(/.test(description);
		const hasActionablePrompt =
			description.includes("record what worked") ||
			description.includes("record what failed") ||
			description.includes("when to invoke these skills");
		return hasSpecificSkill && hasActionablePrompt;
	}

	private hasConcreteRecentSuccessEvidence(suggestions: ImprovementSuggestion[]): boolean {
		return suggestions.some((suggestion) => {
			if (suggestion.source !== "best-practice") {
				return false;
			}

			if (suggestion.title === "Promote proven memory-backed tasks") {
				return suggestion.description
					.toLowerCase()
					.includes("recent successful iterations include");
			}

			return suggestion.title === "Preserve successful skill combinations in memory";
		});
	}

	private loadRecentJournalEntries(): string[] {
		const journalPath = path.join(process.cwd(), "JOURNAL.md");
		try {
			if (!fs.existsSync(journalPath)) {
				return [];
			}

			return fs
				.readFileSync(journalPath, "utf-8")
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line.startsWith("- "))
				.map((line) => line.replace(/^-\s*\d{4}-\d{2}-\d{2}\s+—\s+\w+\s+—\s*/u, ""))
				.filter(Boolean)
				.slice(0, 8);
		} catch {
			return [];
		}
	}

	private getMemoryFilePath(): string {
		return process.env.PAIMON_SELF_IMPROVEMENT_MEMORY_PATH || path.join(process.cwd(), "MEMORY.md");
	}

	private loadRecentScorecardDescriptions(): string[] {
		const memoryPath = this.getMemoryFilePath();
		try {
			if (!fs.existsSync(memoryPath)) {
				return [];
			}

			return parseScorecardRows(fs.readFileSync(memoryPath, "utf-8"))
				.map((row) => row.description.trim().toLowerCase())
				.filter(Boolean)
				.slice(0, 8);
		} catch {
			return [];
		}
	}

	private isLowSignalRecentSuccessSuggestion(suggestion: ImprovementSuggestion): boolean {
		if (suggestion.source !== "best-practice") {
			return false;
		}

		if (suggestion.title !== "Promote proven memory-backed tasks") {
			return false;
		}

		const normalizedDescription = suggestion.description.toLowerCase();
		if (!normalizedDescription.includes("recent successful iterations include")) {
			return false;
		}

		const successfulIterationsSection = normalizedDescription
			.split("recent successful iterations include")[1]
			?.split(". use these concrete wins")[0]
			?.trim();
		if (!successfulIterationsSection) {
			return false;
		}

		const describedIterations = successfulIterationsSection
			.split(";")
			.map((entry) => entry.trim())
			.filter(Boolean);
		if (describedIterations.length === 0) {
			return false;
		}

		const currentJournalEntries = new Set(
			this.loadRecentJournalEntries().map((entry) => entry.toLowerCase()),
		);
		const currentScorecardDescriptions = new Set(this.loadRecentScorecardDescriptions());
		if (currentJournalEntries.size === 0 && currentScorecardDescriptions.size === 0) {
			return false;
		}

		return describedIterations.every(
			(entry) => currentJournalEntries.has(entry) || currentScorecardDescriptions.has(entry),
		);
	}

	private isAlreadyCapturedRecurringGuardrailSuggestion(
		suggestion: ImprovementSuggestion,
	): boolean {
		if (suggestion.source !== "best-practice") {
			return false;
		}

		if (suggestion.title !== "Turn recurring errors into reusable guardrails") {
			return false;
		}

		const normalizedDescription = suggestion.description.toLowerCase();
		if (
			!normalizedDescription.includes("recent iterations still show recurring test errors") &&
			!normalizedDescription.includes("prevention checklist") &&
			!normalizedDescription.includes("preferred recovery steps")
		) {
			return false;
		}

		const currentJournalEntries = this.loadRecentJournalEntries().map((entry) =>
			entry.toLowerCase(),
		);
		const currentScorecardDescriptions = this.loadRecentScorecardDescriptions();
		if (currentJournalEntries.length === 0 && currentScorecardDescriptions.length === 0) {
			return false;
		}

		return (
			currentJournalEntries.some(
				(entry) =>
					entry.includes("recurring test") &&
					(entry.includes("guardrail") ||
						entry.includes("error-recovery") ||
						entry.includes("prevention guidance")),
			) ||
			currentScorecardDescriptions.some(
				(entry) =>
					entry.includes("recurring test") &&
					(entry.includes("guardrail") ||
						entry.includes("error-recovery") ||
						entry.includes("prevention guidance")),
			)
		);
	}

	private hasConcreteRecurringErrorGuardrailEvidence(
		suggestion: ImprovementSuggestion,
		suggestions: ImprovementSuggestion[],
	): boolean {
		if (suggestion.title !== "Reduce recurring errors") {
			return false;
		}

		return suggestions.some((existingSuggestion) => {
			if (
				existingSuggestion.id === suggestion.id ||
				existingSuggestion.source !== "best-practice"
			) {
				return false;
			}

			if (existingSuggestion.title !== "Turn recurring errors into reusable guardrails") {
				return false;
			}

			const description = existingSuggestion.description.toLowerCase();
			return (
				description.includes("recent iterations still show recurring test errors") ||
				description.includes("prevention checklist") ||
				description.includes("preferred recovery steps")
			);
		});
	}

	private hasConcreteActionableBestPracticeAlternative(
		suggestion: ImprovementSuggestion,
		suggestions: ImprovementSuggestion[],
	): boolean {
		if (suggestion.source !== "best-practice") {
			return false;
		}

		const actionableBestPracticeTitles = new Set([
			"Capture reusable lessons from weak-signal skills",
			"Expand error-recovery enablers",
			"Strengthen self-assessment enablers",
			"Improve planning and tool-chain enablers",
			"Promote tool-discovery enablers",
			"Invest in memory-persistence enablers",
			"Turn recurring errors into reusable guardrails",
			"Promote proven memory-backed tasks",
			"Reduce recurring errors",
		]);

		return suggestions.some((existingSuggestion) => {
			if (existingSuggestion.id === suggestion.id) {
				return false;
			}

			if (existingSuggestion.source !== "best-practice") {
				return false;
			}

			if (!actionableBestPracticeTitles.has(existingSuggestion.title)) {
				return false;
			}

			return existingSuggestion.priority === "high" || existingSuggestion.priority === "critical";
		});
	}

	private isSatisfiedBestPracticeSuggestion(
		suggestion: ImprovementSuggestion,
		health: {
			status: "excellent" | "good" | "fair" | "poor";
			overallScore: number;
			components?: Partial<HealthComponents>;
		} | null,
		hasConcreteRecentSuccessEvidence = false,
		suggestions: ImprovementSuggestion[] = [],
	): boolean {
		if (suggestion.source !== "best-practice") {
			return false;
		}

		if (this.isRedundantImplementedEnablerSuggestion(suggestion)) {
			return true;
		}

		if (
			suggestion.title === "Capture reusable lessons from weak-signal skills" &&
			!this.hasActionableWeakSignalSkillEvidence(suggestion)
		) {
			return true;
		}

		if (suggestion.title.startsWith("Optimization dashboard health is ")) {
			if (health?.status === "excellent" || health?.status === "good") {
				return true;
			}

			const hasConcreteActionableBestPracticeAlternative =
				this.hasConcreteActionableBestPracticeAlternative(suggestion, suggestions);
			return hasConcreteActionableBestPracticeAlternative;
		}

		if (suggestion.title === "Strengthen self-assessment enablers") {
			return (health?.components?.successRate ?? 0) >= 90;
		}

		if (suggestion.title === "Expand error-recovery enablers") {
			return (health?.components?.errorRate ?? 0) >= 85;
		}

		if (suggestion.title === "Improve planning and tool-chain enablers") {
			return (health?.components?.timeEfficiency ?? 0) >= 75;
		}

		if (suggestion.title === "Promote tool-discovery enablers") {
			return (health?.components?.capabilityUtilization ?? 0) >= 60;
		}

		if (suggestion.title === "Invest in memory-persistence enablers") {
			return (health?.components?.memoryQuality ?? 0) >= 80;
		}

		if (suggestion.title === "Capture reusable lessons from weak-signal skills") {
			return (health?.components?.memoryQuality ?? 0) >= 80;
		}

		if (suggestion.title === "Turn recurring errors into reusable guardrails") {
			return (health?.components?.memoryQuality ?? 0) >= 80;
		}

		if (suggestion.title === "Promote proven memory-backed tasks") {
			return (health?.components?.memoryQuality ?? 0) >= 80;
		}

		if (
			hasConcreteRecentSuccessEvidence &&
			(suggestion.title === "Record why recent work was lower impact" ||
				suggestion.title === "Bottleneck: memory-quality")
		) {
			return true;
		}

		if (suggestion.title === "Record why recent work was lower impact") {
			return (health?.components?.memoryQuality ?? 0) >= 80;
		}

		if (suggestion.title === "Strengthen learning capture") {
			return (
				suggestion.description.trim() ===
				"Recent iteration history suggests memory quality or impact capture can improve."
			);
		}

		if (suggestion.title === "Improve iteration speed") {
			return (health?.components?.timeEfficiency ?? 0) >= 70;
		}

		if (suggestion.title === "Reduce recurring errors") {
			if ((health?.components?.errorRate ?? 0) >= 85) {
				return true;
			}

			if (this.hasConcreteRecurringErrorGuardrailEvidence(suggestion, suggestions)) {
				return true;
			}

			return this.hasConcreteActionableBestPracticeAlternative(suggestion, suggestions);
		}

		if (suggestion.title === "Increase tool utilization") {
			return (health?.components?.capabilityUtilization ?? 0) >= 60;
		}

		return false;
	}

	/**
	 * Scan codebase for improvement suggestions.
	 */
	async scanCodebase(rootDir = "."): Promise<ImprovementSuggestion[]> {
		if (!this.config.enabled) return [];

		const suggestions: ImprovementSuggestion[] = [];

		// 1. Scan for code patterns
		const codeSuggestions = await this.scanCodePatterns(rootDir);
		suggestions.push(...codeSuggestions);

		// 2. Get capability gap suggestions
		const gapSuggestions = this.getCapabilityGapSuggestions();
		suggestions.push(...gapSuggestions);

		// 3. Get usage analytics suggestions
		const usageSuggestions = this.getUsageAnalyticsSuggestions();
		suggestions.push(...usageSuggestions);

		// 4. Add competitor pattern suggestions
		suggestions.push(...this.getCompetitorSuggestions());

		// 5. Add context-aware auto-context suggestions
		suggestions.push(...this.getContextAwareSuggestions());

		// 6. Add optimization dashboard suggestions
		suggestions.push(...this.getDashboardSuggestions());

		const deduplicated = this.deduplicateSuggestions(suggestions);
		const actionable = this.filterSuggestions(deduplicated);

		// Filter by confidence and dismissed
		const filtered = actionable
			.filter((s) => s.confidence >= this.config.minConfidence)
			.filter((s) => !this.dismissedIds.has(s.id))
			.sort((a, b) => {
				const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
				return priorityOrder[a.priority] - priorityOrder[b.priority] || b.confidence - a.confidence;
			})
			.slice(0, this.config.maxSuggestions);

		// Store suggestions
		for (const s of filtered) {
			this.suggestions.set(s.id, s);
		}

		// Update stats
		this.stats.lastScanTime = new Date().toISOString();
		this.stats.totalSuggestions = this.suggestions.size;
		this.updateStats();
		this.saveData();

		return filtered;
	}

	/**
	 * Scan files for code patterns.
	 */
	private async scanCodePatterns(rootDir: string): Promise<ImprovementSuggestion[]> {
		const suggestions: ImprovementSuggestion[] = [];

		const scanDir = async (dir: string): Promise<void> => {
			const entries = fs.readdirSync(dir, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);

				if (entry.isDirectory()) {
					if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
						await scanDir(fullPath);
					}
				} else if (entry.isFile() && fullPath.endsWith(".ts")) {
					// Check exclude patterns
					const relativePath = path.relative(rootDir, fullPath);
					if (
						this.config.excludePatterns.some((p) => relativePath.includes(p.replace("**/", "")))
					) {
						continue;
					}

					const fileSuggestions = this.scanFile(fullPath, rootDir);
					suggestions.push(...fileSuggestions);
				}
			}
		};

		await scanDir(rootDir);
		return suggestions;
	}

	/**
	 * Scan a single file for patterns.
	 */
	private scanFile(filePath: string, rootDir: string): ImprovementSuggestion[] {
		const suggestions: ImprovementSuggestion[] = [];

		try {
			const content = fs.readFileSync(filePath, "utf-8");
			const allPatterns = [...getCodePatterns(), ...getSecurityPatterns()];

			for (const pattern of allPatterns) {
				let match: RegExpExecArray | null = null;
				const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);

				match = regex.exec(content);
				while (match !== null) {
					// Find line number
					const lineNumber = content.substring(0, match.index).split("\n").length;

					const suggestion = this.createSuggestion({
						category: pattern.category,
						priority: pattern.priority,
						title: pattern.title,
						description: pattern.description,
						filePath: path.relative(rootDir, filePath),
						lineNumber,
						suggestedFix: pattern.suggestedFix,
						impact: `Improves ${pattern.category}`,
						effort: "simple",
						confidence: 80,
						source: "code-analysis",
					});

					suggestions.push(suggestion);

					match = regex.exec(content);
				}
			}
		} catch {
			// Skip files that can't be read
		}

		return suggestions;
	}

	/**
	 * Get suggestions from capability gap detection.
	 */
	private getCapabilityGapSuggestions(): ImprovementSuggestion[] {
		const suggestions: ImprovementSuggestion[] = [];

		try {
			const detector = getCapabilityGapDetector();
			const gaps = detector.getAllGaps();

			for (const gap of gaps.slice(0, 5)) {
				const suggestion = this.createSuggestion({
					category: "capability",
					priority:
						gap.severity === "critical" ? "critical" : gap.severity === "high" ? "high" : "medium",
					title: `Missing capability: ${gap.type}`,
					description: gap.description,
					impact: "Fills identified capability gap",
					effort: "moderate",
					confidence: 85,
					source: "capability-gap",
				});

				suggestions.push(suggestion);
			}
		} catch {
			// Skip if capability gap detector not available
		}

		return suggestions;
	}

	/**
	 * Get suggestions from usage analytics.
	 */
	private getUsageAnalyticsSuggestions(): ImprovementSuggestion[] {
		const suggestions: ImprovementSuggestion[] = [];

		try {
			const analytics = getToolUsageAnalyticsManager();
			const insights = analytics.analyzeUsage();

			for (const insight of insights.slice(0, 3)) {
				if (insight.type === "underutilized") {
					const suggestion = this.createSuggestion({
						category: "capability",
						priority: "low",
						title: `Underutilized tool: ${insight.toolName}`,
						description: `Tool ${insight.toolName} has low usage. Consider promoting it or improving documentation.`,
						impact: "Increases tool adoption and capability utilization",
						effort: "simple",
						confidence: 70,
						source: "usage-analytics",
					});
					suggestions.push(suggestion);
				} else if (insight.type === "high_failure") {
					const suggestion = this.createSuggestion({
						category: "reliability",
						priority: "high",
						title: `High failure tool: ${insight.toolName}`,
						description: `Tool ${insight.toolName} has high failure rate. Consider improving error handling.`,
						impact: "Improves reliability and reduces failures",
						effort: "moderate",
						confidence: 80,
						source: "usage-analytics",
					});
					suggestions.push(suggestion);
				}
			}
		} catch {
			// Skip if analytics not available
		}

		return suggestions;
	}

	/**
	 * Get competitor-based suggestions.
	 */
	private getCompetitorSuggestions(): ImprovementSuggestion[] {
		return COMPETITOR_SUGGESTIONS.map((suggestion) => this.createSuggestion(suggestion));
	}

	private getContextAwareSuggestions(): ImprovementSuggestion[] {
		try {
			const bestAnalyses = analyzeContextTasks([
				{
					taskDescription:
						"Add a new self-evolution capability tool with tests and tool registration",
					minimumConfidence: 0.45,
					maxFiles: 3,
				},
				{
					taskDescription:
						"Improve reliability of a failing evolution tool by updating implementation and tests",
					minimumConfidence: 0.45,
					maxFiles: 3,
				},
				{
					taskDescription:
						"Turn recurring test failures into reusable error-recovery guardrails across memory-backed modules",
					minimumConfidence: 0.45,
					maxFiles: 3,
				},
				{
					taskDescription:
						"Improve memory-backed task selection by refining learning transfer, predictive fallback ranking, and related tests",
					minimumConfidence: 0.45,
					maxFiles: 3,
				},
				{
					taskDescription:
						"Refactor a self-improvement capability while keeping documentation and tests aligned",
					minimumConfidence: 0.45,
					maxFiles: 3,
				},
			]);

			return bestAnalyses
				.slice(0, 3)
				.map(({ taskDescription, analysis, topFiles, confidencePercent }) => {
					const topFileList = topFiles.join(", ");
					const likelyFilesLabel =
						analysis.confidence >= 0.7 ? "Start with" : "Likely starting files include";
					return this.createSuggestion({
						category: "capability",
						priority: analysis.confidence >= 0.7 ? "high" : "medium",
						title: `Use auto-context detection for: ${taskDescription}`,
						description: `The existing context tool found ${analysis.suggestedFiles.length} relevant files (${confidencePercent}% context confidence) for a representative evolution task. ${likelyFilesLabel} ${topFileList}.`,
						suggestedFix: `Run ${buildContextAnalyzeCommand(taskDescription)} before implementation to identify likely files automatically.`,
						impact:
							"Reduces context gathering time and improves file-target selection for capability, reliability, and memory-backed evolution work using the existing context capability",
						effort: "simple",
						confidence: 82,
						source: "best-practice",
					});
				});
		} catch {
			return [];
		}
	}

	private getDashboardSuggestions(): ImprovementSuggestion[] {
		try {
			const dashboard = this.getDashboardManager();
			const suggestions: ImprovementSuggestion[] = [];
			const health = dashboard.getHealth();

			if (health.status === "fair" || health.status === "poor") {
				suggestions.push(
					this.createSuggestion({
						category: "capability",
						priority: health.status === "poor" ? "critical" : "high",
						title: `Optimization dashboard health is ${health.status}`,
						description: `Live evolution health is ${health.overallScore}/100. Prioritize improvements that address the weakest dashboard signals.`,
						impact: "Improves task prioritization with real evolution health signals",
						effort: "simple",
						confidence: 88,
						source: "best-practice",
					}),
				);
			}

			for (const bottleneck of dashboard.identifyBottlenecks()) {
				suggestions.push(
					this.createSuggestion({
						category:
							bottleneck.type === "high-error"
								? "reliability"
								: bottleneck.type === "memory-issues"
									? "capability"
									: "performance",
						priority: bottleneck.impact >= 70 ? "high" : "medium",
						title: `Bottleneck: ${bottleneck.name}`,
						description: `${bottleneck.description} ${bottleneck.suggestion}`,
						impact: "Targets a live bottleneck detected from recent evolution data",
						effort: "moderate",
						confidence: 84,
						source: "best-practice",
					}),
				);
			}

			for (const recommendation of dashboard.getRecommendations()) {
				suggestions.push(
					this.createSuggestion({
						category:
							recommendation.category === "memory"
								? "capability"
								: recommendation.category === "reliability"
									? "reliability"
									: recommendation.category,
						priority: recommendation.priority,
						title: recommendation.title,
						description: recommendation.description,
						suggestedFix: recommendation.expectedImpact,
						impact: recommendation.expectedImpact,
						effort: recommendation.effort === "complex" ? "complex" : recommendation.effort,
						confidence: 86,
						source: "best-practice",
					}),
				);
			}

			return suggestions;
		} catch {
			return [];
		}
	}

	private hasCachedSuggestions(): boolean {
		return Array.from(this.suggestions.values()).some(
			(suggestion) => !this.dismissedIds.has(suggestion.id),
		);
	}

	private isLastScanStale(): boolean {
		if (!this.stats.lastScanTime) {
			return true;
		}

		const lastScan = Date.parse(this.stats.lastScanTime);
		if (Number.isNaN(lastScan)) {
			return true;
		}

		return Date.now() - lastScan > SUGGESTION_STALE_AFTER_MS;
	}

	async getSuggestionsWithRefresh(
		category?: ImprovementCategory,
		priority?: Priority,
		rootDir = ".",
	): Promise<ImprovementSuggestion[]> {
		const needsRefresh = !this.hasCachedSuggestions() || this.isLastScanStale();
		if (needsRefresh) {
			try {
				await this.scanCodebase(rootDir);
			} catch {
				// Fall back to cached suggestions if refresh fails
			}
		}

		return this.getSuggestions(category, priority);
	}

	/**
	 * Get all suggestions.
	 */
	getSuggestions(category?: ImprovementCategory, priority?: Priority): ImprovementSuggestion[] {
		let filtered = Array.from(this.suggestions.values()).filter(
			(s) => !this.dismissedIds.has(s.id),
		);

		if (category) {
			filtered = filtered.filter((s) => s.category === category);
		}

		if (priority) {
			filtered = filtered.filter((s) => s.priority === priority);
		}

		return filtered.sort((a, b) => {
			const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
			return priorityOrder[a.priority] - priorityOrder[b.priority];
		});
	}

	/**
	 * Get a specific suggestion.
	 */
	getSuggestion(id: string): ImprovementSuggestion | undefined {
		return this.suggestions.get(id);
	}

	/**
	 * Accept a suggestion (mark as useful).
	 */
	acceptSuggestion(id: string): { success: boolean; message: string } {
		const suggestion = this.suggestions.get(id);
		if (!suggestion) {
			return { success: false, message: "Suggestion not found" };
		}

		this.stats.suggestionsAccepted++;
		this.dismissedIds.add(id);
		this.saveData();

		return { success: true, message: `Suggestion accepted: ${suggestion.title}` };
	}

	/**
	 * Dismiss a suggestion.
	 */
	dismissSuggestion(id: string): { success: boolean; message: string } {
		const suggestion = this.suggestions.get(id);
		if (!suggestion) {
			return { success: false, message: "Suggestion not found" };
		}

		this.stats.suggestionsDismissed++;
		this.dismissedIds.add(id);
		this.saveData();

		return { success: true, message: `Suggestion dismissed: ${suggestion.title}` };
	}

	/**
	 * Clear dismissed suggestions.
	 */
	clearDismissed(): { success: boolean; message: string; count: number } {
		const count = this.dismissedIds.size;
		this.dismissedIds.clear();
		this.saveData();

		return { success: true, message: `Cleared ${count} dismissed suggestions`, count };
	}

	/**
	 * Update statistics.
	 */
	private updateStats(): void {
		const suggestions = Array.from(this.suggestions.values());

		// Reset counts
		for (const cat of Object.keys(this.stats.byCategory) as ImprovementCategory[]) {
			this.stats.byCategory[cat] = 0;
		}
		for (const pri of Object.keys(this.stats.byPriority) as Priority[]) {
			this.stats.byPriority[pri] = 0;
		}
		this.stats.bySource = {};

		// Count
		let totalConfidence = 0;
		for (const s of suggestions) {
			this.stats.byCategory[s.category]++;
			this.stats.byPriority[s.priority]++;
			this.stats.bySource[s.source] = (this.stats.bySource[s.source] || 0) + 1;
			totalConfidence += s.confidence;
		}

		this.stats.averageConfidence =
			suggestions.length > 0 ? Math.round(totalConfidence / suggestions.length) : 0;
	}

	/**
	 * Get statistics.
	 */
	getStats(): SuggestionEngineStats {
		return { ...this.stats };
	}

	/**
	 * Get configuration.
	 */
	getConfig(): SuggestionEngineConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration.
	 */
	updateConfig(updates: Partial<SuggestionEngineConfig>): {
		success: boolean;
		config: SuggestionEngineConfig;
	} {
		this.config = { ...this.config, ...updates };
		this.saveData();
		return { success: true, config: this.config };
	}

	/**
	 * Enable/disable suggestion engine.
	 */
	setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveData();
	}

	/**
	 * Reset statistics.
	 */
	resetStats(): { success: boolean; message: string } {
		this.stats = this.getDefaultStats();
		this.suggestions.clear();
		this.saveData();
		return { success: true, message: "Statistics and suggestions reset" };
	}

	/**
	 * Format suggestions as markdown.
	 */
	formatSuggestions(suggestions: ImprovementSuggestion[]): string {
		const priorityEmoji: Record<Priority, string> = {
			critical: "🔴",
			high: "🟠",
			medium: "🟡",
			low: "🟢",
		};

		const categoryEmoji: Record<ImprovementCategory, string> = {
			"code-quality": "📝",
			performance: "⚡",
			architecture: "🏛️",
			capability: "🔧",
			reliability: "🛡️",
			documentation: "📚",
			testing: "🧪",
			security: "🔒",
		};

		const lines: string[] = [
			"## Self-Improvement Suggestions",
			"",
			`Found ${suggestions.length} improvement opportunities:`,
			"",
		];

		// Group by priority
		const byPriority = suggestions.reduce(
			(acc, s) => {
				if (!acc[s.priority]) acc[s.priority] = [];
				acc[s.priority].push(s);
				return acc;
			},
			{} as Record<Priority, ImprovementSuggestion[]>,
		);

		for (const priority of ["critical", "high", "medium", "low"] as Priority[]) {
			const items = byPriority[priority];
			if (!items || items.length === 0) continue;

			lines.push(`### ${priorityEmoji[priority]} ${priority.toUpperCase()} (${items.length})`);
			lines.push("");

			for (const s of items) {
				lines.push(`#### ${categoryEmoji[s.category]} ${s.title}`);
				lines.push(`- **ID:** ${s.id}`);
				lines.push(`- **Category:** ${s.category}`);
				lines.push(`- **Description:** ${s.description}`);
				if (s.filePath) {
					lines.push(`- **File:** ${s.filePath}${s.lineNumber ? `:${s.lineNumber}` : ""}`);
				}
				lines.push(`- **Impact:** ${s.impact}`);
				lines.push(`- **Effort:** ${s.effort}`);
				lines.push(`- **Confidence:** ${s.confidence}%`);
				lines.push(`- **Source:** ${s.source}`);
				lines.push("");
			}
		}

		return lines.join("\n");
	}

	/**
	 * Format stats as markdown.
	 */
	formatStats(stats: SuggestionEngineStats): string {
		const lines: string[] = [
			"## Self-Improvement Engine Statistics",
			"",
			`**Total Suggestions:** ${stats.totalSuggestions}`,
			`**Average Confidence:** ${stats.averageConfidence}%`,
			`**Last Scan:** ${stats.lastScanTime || "Never"}`,
			`**Accepted:** ${stats.suggestionsAccepted}`,
			`**Dismissed:** ${stats.suggestionsDismissed}`,
			"",
			"### By Category",
			"",
		];

		for (const [cat, count] of Object.entries(stats.byCategory)) {
			if (count > 0) {
				lines.push(`- ${cat}: ${count}`);
			}
		}

		lines.push("", "### By Priority", "");

		for (const [pri, count] of Object.entries(stats.byPriority)) {
			if (count > 0) {
				lines.push(`- ${pri}: ${count}`);
			}
		}

		lines.push("", "### By Source", "");

		for (const [source, count] of Object.entries(stats.bySource)) {
			lines.push(`- ${source}: ${count}`);
		}

		return lines.join("\n");
	}
}

// Singleton instance
let engineInstance: SelfImprovementEngine | null = null;

/**
 * Get singleton engine instance.
 */
export function getSelfImprovementEngine(): SelfImprovementEngine {
	if (!engineInstance) {
		engineInstance = new SelfImprovementEngine();
	}
	return engineInstance;
}

/**
 * Reset singleton instance.
 */
export function resetSelfImprovementEngine(): void {
	engineInstance = null;
}
