/**
 * Self-Healing Code Patterns Module
 *
 * Provides automatic detection and correction of common error patterns
 * to reduce manual intervention in error recovery during self-evolution.
 *
 * Inspired by OpenHands error recovery patterns and Aider's auto-fix capabilities.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Categories of self-healing patterns
 */
export type SelfHealingCategory =
	| "typescript"
	| "lint"
	| "test"
	| "runtime"
	| "import"
	| "syntax"
	| "dependency";

/**
 * Severity level of the pattern
 */
export type SelfHealingSeverity = "low" | "medium" | "high" | "critical";

/**
 * Result of a self-healing attempt
 */
export type SelfHealingResult = "success" | "partial" | "failed" | "skipped";

/**
 * Self-healing pattern definition
 */
export interface SelfHealingPattern {
	/** Unique identifier for the pattern */
	id: string;
	/** Category of the pattern */
	category: SelfHealingCategory;
	/** Severity level */
	severity: SelfHealingSeverity;
	/** Human-readable name */
	name: string;
	/** Description of what the pattern detects */
	description: string;
	/** Regex pattern to detect the error */
	detectionPattern: RegExp;
	/** Whether auto-fix is enabled for this pattern */
	autoFixEnabled: boolean;
	/** Whether this pattern requires confirmation before fixing */
	requiresConfirmation: boolean;
	/** Maximum attempts to fix this pattern */
	maxAttempts: number;
	/** Estimated time to fix (in seconds) */
	estimatedFixTime: number;
}

/**
 * Self-healing fix strategy
 */
export interface SelfHealingFixStrategy {
	/** Pattern ID this strategy applies to */
	patternId: string;
	/** Description of the fix */
	description: string;
	/** Function to apply the fix */
	applyFix: (context: SelfHealingContext) => Promise<SelfHealingFixResult>;
	/** Preconditions for applying the fix */
	preconditions?: (context: SelfHealingContext) => boolean;
	/** Post-conditions to verify fix success */
	postconditions?: (context: SelfHealingContext) => Promise<boolean>;
}

/**
 * Context for self-healing
 */
export interface SelfHealingContext {
	/** The error message or content */
	errorContent: string;
	/** File path if applicable */
	filePath?: string;
	/** Original file content before fix */
	originalContent?: string;
	/** Line number where error occurred */
	lineNumber?: number;
	/** Additional metadata */
	metadata?: Record<string, unknown>;
	/** Working directory */
	workingDirectory: string;
}

/**
 * Result of applying a fix
 */
export interface SelfHealingFixResult {
	/** Result status */
	result: SelfHealingResult;
	/** Modified file content if applicable */
	modifiedContent?: string;
	/** Message describing what was done */
	message: string;
	/** Tokens saved by auto-fix (estimated) */
	tokensSaved?: number;
	/** Time taken in milliseconds */
	timeTaken?: number;
	/** Additional details */
	details?: Record<string, unknown>;
}

/**
 * Self-healing session statistics
 */
export interface SelfHealingStats {
	/** Total number of patterns detected */
	totalDetected: number;
	/** Total number of fixes applied */
	totalFixed: number;
	/** Total number of fixes that failed */
	totalFailed: number;
	/** Total number of fixes skipped */
	totalSkipped: number;
	/** Total time spent on fixes (milliseconds) */
	totalTimeSpent: number;
	/** Total tokens saved */
	totalTokensSaved: number;
	/** Breakdown by category */
	byCategory: Record<SelfHealingCategory, { detected: number; fixed: number; failed: number }>;
	/** Breakdown by pattern */
	byPattern: Record<string, { detected: number; fixed: number; failed: number }>;
	/** Success rate */
	successRate: number;
	/** Last detection timestamp */
	lastDetection?: string;
	/** Last fix timestamp */
	lastFix?: string;
}

/**
 * Self-healing detection result
 */
export interface SelfHealingDetection {
	/** Pattern that was detected */
	pattern: SelfHealingPattern;
	/** Match information */
	match: {
		/** Matched text */
		text: string;
		/** Start index */
		start: number;
		/** End index */
		end: number;
		/** Line number if applicable */
		line?: number;
	};
	/** Context extracted from the match */
	context: SelfHealingContext;
	/** Confidence score (0-100) */
	confidence: number;
	/** Whether auto-fix is recommended */
	recommendAutoFix: boolean;
}

/**
 * Self-healing configuration
 */
export interface SelfHealingConfig {
	/** Whether self-healing is enabled */
	enabled: boolean;
	/** Minimum severity level to auto-fix */
	minSeverityForAutoFix: SelfHealingSeverity;
	/** Whether to require confirmation for high severity */
	requireConfirmationForHigh: boolean;
	/** Maximum total fix attempts per session */
	maxTotalAttempts: number;
	/** Whether to log fixes */
	logFixes: boolean;
	/** Whether to track statistics */
	trackStats: boolean;
	/** Custom patterns to add */
	customPatterns?: SelfHealingPattern[];
	/** Patterns to disable */
	disabledPatterns?: string[];
}

// ============================================================================
// Default Patterns
// ============================================================================

/**
 * Default self-healing patterns for common error types
 */
const DEFAULT_PATTERNS: SelfHealingPattern[] = [
	// TypeScript Import Errors
	{
		id: "ts-import-missing",
		category: "typescript",
		severity: "high",
		name: "Missing Import",
		description: "Detects missing import statements that cause TypeScript errors",
		detectionPattern:
			/Cannot find name \S+\.\s+Did you mean to import it\?|Cannot find name \S+|is not defined/g,
		autoFixEnabled: true,
		requiresConfirmation: false,
		maxAttempts: 3,
		estimatedFixTime: 5,
	},
	{
		id: "ts-import-type-missing",
		category: "typescript",
		severity: "high",
		name: "Missing Type Import",
		description: "Detects missing type imports",
		detectionPattern:
			/Cannot find namespace \S+|Cannot find type \S+|Module \S+ has no exported member/g,
		autoFixEnabled: true,
		requiresConfirmation: false,
		maxAttempts: 3,
		estimatedFixTime: 5,
	},
	// Lint Errors
	{
		id: "lint-unused-var",
		category: "lint",
		severity: "low",
		name: "Unused Variable",
		description: "Detects unused variables that cause lint errors",
		detectionPattern: /is declared but its value is never read|Unused variable \S+/g,
		autoFixEnabled: true,
		requiresConfirmation: false,
		maxAttempts: 1,
		estimatedFixTime: 2,
	},
	{
		id: "lint-missing-semicolon",
		category: "lint",
		severity: "low",
		name: "Missing Semicolon",
		description: "Detects missing semicolons",
		detectionPattern: /Missing semicolon|Expected ';' but found/g,
		autoFixEnabled: true,
		requiresConfirmation: false,
		maxAttempts: 1,
		estimatedFixTime: 1,
	},
	{
		id: "lint-trailing-comma",
		category: "lint",
		severity: "low",
		name: "Trailing Comma",
		description: "Detects trailing comma issues",
		detectionPattern: /Unexpected trailing comma|Missing trailing comma/g,
		autoFixEnabled: true,
		requiresConfirmation: false,
		maxAttempts: 1,
		estimatedFixTime: 1,
	},
	{
		id: "lint-prefer-const",
		category: "lint",
		severity: "low",
		name: "Prefer Const",
		description: "Detects let declarations that should be const",
		detectionPattern: /is never reassigned\.\s+Use 'const' instead|Prefer 'const' over 'let'/g,
		autoFixEnabled: true,
		requiresConfirmation: false,
		maxAttempts: 1,
		estimatedFixTime: 1,
	},
	// Syntax Errors
	{
		id: "syntax-missing-brace",
		category: "syntax",
		severity: "critical",
		name: "Missing Brace",
		description: "Detects missing braces",
		detectionPattern: /Missing closing brace|Expected '}'|Unclosed block/g,
		autoFixEnabled: true,
		requiresConfirmation: true,
		maxAttempts: 2,
		estimatedFixTime: 5,
	},
	{
		id: "syntax-missing-paren",
		category: "syntax",
		severity: "critical",
		name: "Missing Parenthesis",
		description: "Detects missing parentheses",
		detectionPattern: /Missing closing parenthesis|Expected '\)'|Unclosed expression/g,
		autoFixEnabled: true,
		requiresConfirmation: true,
		maxAttempts: 2,
		estimatedFixTime: 5,
	},
	// Test Errors
	{
		id: "test-missing-await",
		category: "test",
		severity: "medium",
		name: "Missing Await",
		description: "Detects missing await in async tests",
		detectionPattern:
			/This expression is not awaitable|Promise returned by .+ is not awaited|Missing await/g,
		autoFixEnabled: true,
		requiresConfirmation: false,
		maxAttempts: 1,
		estimatedFixTime: 2,
	},
	{
		id: "test-timeout",
		category: "test",
		severity: "medium",
		name: "Test Timeout",
		description: "Detects test timeout issues",
		detectionPattern: /Test timed out|Timeout of \d+ms exceeded/g,
		autoFixEnabled: false,
		requiresConfirmation: true,
		maxAttempts: 1,
		estimatedFixTime: 10,
	},
	// Dependency Errors
	{
		id: "dep-missing-module",
		category: "dependency",
		severity: "high",
		name: "Missing Module",
		description: "Detects missing module dependencies",
		detectionPattern: /Cannot find module \S+|Module not found: \S+/g,
		autoFixEnabled: true,
		requiresConfirmation: true,
		maxAttempts: 1,
		estimatedFixTime: 30,
	},
	// Runtime Errors
	{
		id: "runtime-null-undefined",
		category: "runtime",
		severity: "high",
		name: "Null/Undefined Access",
		description: "Detects potential null/undefined property access",
		detectionPattern:
			/Cannot read properties of null|Cannot read properties of undefined|Object is possibly 'null'|Object is possibly 'undefined'/g,
		autoFixEnabled: true,
		requiresConfirmation: false,
		maxAttempts: 2,
		estimatedFixTime: 5,
	},
];

// ============================================================================
// Default Fix Strategies
// ============================================================================

/**
 * Default fix strategies for common patterns
 */
const DEFAULT_FIX_STRATEGIES: SelfHealingFixStrategy[] = [
	// Fix unused variables
	{
		patternId: "lint-unused-var",
		description: "Remove unused variable declaration or prefix with underscore",
		applyFix: async (context: SelfHealingContext): Promise<SelfHealingFixResult> => {
			const match = context.errorContent.match(/is declared but|Unused variable/);
			if (!match || !context.filePath || !context.originalContent) {
				return {
					result: "failed",
					message: "Cannot extract variable name or missing file context",
				};
			}

			// Extract variable name from error
			const varMatch = context.errorContent.match(/\b(\w+)\s+is declared but/);
			const varName = varMatch ? varMatch[1] : null;
			if (!varName) {
				return { result: "failed", message: "Cannot extract variable name" };
			}

			const startTime = Date.now();
			let modifiedContent = context.originalContent;

			// Pattern 1: Remove unused let/const declaration
			const declPattern = new RegExp(`(let|const|var)\\s+${varName}\\s*(=\\s*[^;]+)?;?\\s*`, "g");
			if (declPattern.test(modifiedContent)) {
				modifiedContent = modifiedContent.replace(declPattern, "");
				return {
					result: "success",
					modifiedContent,
					message: `Removed unused variable ${varName}`,
					tokensSaved: 10,
					timeTaken: Date.now() - startTime,
				};
			}

			// Pattern 2: Prefix with underscore to mark as intentionally unused
			modifiedContent = modifiedContent.replace(
				new RegExp(`(let|const|var)\\s+${varName}`, "g"),
				`$1 _${varName}`,
			);

			return {
				result: "success",
				modifiedContent,
				message: `Prefix unused variable ${varName} with underscore`,
				tokensSaved: 5,
				timeTaken: Date.now() - startTime,
			};
		},
	},
	// Fix prefer const
	{
		patternId: "lint-prefer-const",
		description: "Change let to const for never-reassigned variables",
		applyFix: async (context: SelfHealingContext): Promise<SelfHealingFixResult> => {
			if (!context.filePath || !context.originalContent) {
				return { result: "failed", message: "Missing file context" };
			}

			// Extract variable name from error
			const varMatch = context.errorContent.match(/\b(\w+)\s+is never reassigned/);
			const varName = varMatch ? varMatch[1] : null;
			if (!varName) {
				return { result: "failed", message: "Cannot extract variable name" };
			}

			const startTime = Date.now();

			const modifiedContent = context.originalContent.replace(
				new RegExp(`let\\s+${varName}`, "g"),
				`const ${varName}`,
			);

			if (modifiedContent === context.originalContent) {
				return { result: "failed", message: `Could not find let ${varName} to change to const` };
			}

			return {
				result: "success",
				modifiedContent,
				message: `Changed let ${varName} to const ${varName}`,
				tokensSaved: 3,
				timeTaken: Date.now() - startTime,
			};
		},
	},
	// Fix missing semicolon
	{
		patternId: "lint-missing-semicolon",
		description: "Add missing semicolon",
		applyFix: async (context: SelfHealingContext): Promise<SelfHealingFixResult> => {
			if (!context.filePath || !context.originalContent || !context.lineNumber) {
				return { result: "failed", message: "Missing file context or line number" };
			}

			const startTime = Date.now();
			const lines = context.originalContent.split("\n");
			const lineIndex = context.lineNumber - 1;

			if (lineIndex < 0 || lineIndex >= lines.length) {
				return { result: "failed", message: "Invalid line number" };
			}

			const line = lines[lineIndex];
			if (line.endsWith(";") || line.endsWith("{") || line.endsWith("}")) {
				return { result: "skipped", message: "Line already ends with semicolon or brace" };
			}

			lines[lineIndex] = `${line};`;
			const modifiedContent = lines.join("\n");

			return {
				result: "success",
				modifiedContent,
				message: `Added semicolon to line ${context.lineNumber}`,
				tokensSaved: 1,
				timeTaken: Date.now() - startTime,
			};
		},
	},
	// Fix missing await
	{
		patternId: "test-missing-await",
		description: "Add missing await keyword",
		applyFix: async (context: SelfHealingContext): Promise<SelfHealingFixResult> => {
			if (!context.filePath || !context.originalContent || !context.lineNumber) {
				return { result: "failed", message: "Missing file context or line number" };
			}

			const startTime = Date.now();
			const lines = context.originalContent.split("\n");
			const lineIndex = context.lineNumber - 1;

			if (lineIndex < 0 || lineIndex >= lines.length) {
				return { result: "failed", message: "Invalid line number" };
			}

			const line = lines[lineIndex];

			// Don't modify expect/assert calls
			if (line.includes("expect(") || line.includes("assert(")) {
				return { result: "skipped", message: "Test assertion calls should not have await" };
			}

			// Add await before the likely async call
			const modifiedLine = line.replace(/^(\s*)(\w+)\s*\(/, "$1await $2(");

			if (modifiedLine === line) {
				return { result: "failed", message: "Could not identify async call to add await" };
			}

			lines[lineIndex] = modifiedLine;
			const modifiedContent = lines.join("\n");

			return {
				result: "success",
				modifiedContent,
				message: `Added await to async call on line ${context.lineNumber}`,
				tokensSaved: 5,
				timeTaken: Date.now() - startTime,
			};
		},
	},
];

// ============================================================================
// SelfHealingManager Class
// ============================================================================

/**
 * Manager for self-healing code patterns
 */
export class SelfHealingManager {
	private configPath: string;
	private config: SelfHealingConfig;
	private patterns: Map<string, SelfHealingPattern> = new Map();
	private strategies: Map<string, SelfHealingFixStrategy> = new Map();
	private stats: SelfHealingStats;
	private detectionHistory: SelfHealingDetection[] = [];

	constructor(configPath?: string) {
		this.configPath = configPath || join(homedir(), ".paimon", "self-healing.json");
		this.config = this.loadConfig();
		this.stats = this.loadStats();
		this.initializePatterns();
		this.initializeStrategies();
	}

	/**
	 * Initialize patterns from defaults and config
	 */
	private initializePatterns(): void {
		// Add default patterns
		for (const pattern of DEFAULT_PATTERNS) {
			if (!this.config.disabledPatterns?.includes(pattern.id)) {
				this.patterns.set(pattern.id, pattern);
			}
		}

		// Add custom patterns from config
		if (this.config.customPatterns) {
			for (const pattern of this.config.customPatterns) {
				this.patterns.set(pattern.id, pattern);
			}
		}
	}

	/**
	 * Initialize fix strategies from defaults
	 */
	private initializeStrategies(): void {
		for (const strategy of DEFAULT_FIX_STRATEGIES) {
			this.strategies.set(strategy.patternId, strategy);
		}
	}

	/**
	 * Load configuration from file
	 */
	private loadConfig(): SelfHealingConfig {
		const defaultConfig: SelfHealingConfig = {
			enabled: true,
			minSeverityForAutoFix: "low",
			requireConfirmationForHigh: false,
			maxTotalAttempts: 10,
			logFixes: true,
			trackStats: true,
		};

		try {
			if (existsSync(this.configPath)) {
				const data = readFileSync(this.configPath, "utf-8");
				const loaded = JSON.parse(data) as SelfHealingConfig;
				return { ...defaultConfig, ...loaded };
			}
		} catch {
			// Use defaults on error
		}

		return defaultConfig;
	}

	/**
	 * Save configuration to file
	 */
	private saveConfig(): void {
		try {
			const dir = join(homedir(), ".paimon");
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}
			writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), "utf-8");
		} catch (error) {
			console.error(`[SelfHealing] Failed to save config: ${error}`);
		}
	}

	/**
	 * Load statistics from file
	 */
	private loadStats(): SelfHealingStats {
		const defaultStats: SelfHealingStats = {
			totalDetected: 0,
			totalFixed: 0,
			totalFailed: 0,
			totalSkipped: 0,
			totalTimeSpent: 0,
			totalTokensSaved: 0,
			byCategory: {
				typescript: { detected: 0, fixed: 0, failed: 0 },
				lint: { detected: 0, fixed: 0, failed: 0 },
				test: { detected: 0, fixed: 0, failed: 0 },
				runtime: { detected: 0, fixed: 0, failed: 0 },
				import: { detected: 0, fixed: 0, failed: 0 },
				syntax: { detected: 0, fixed: 0, failed: 0 },
				dependency: { detected: 0, fixed: 0, failed: 0 },
			},
			byPattern: {},
			successRate: 0,
		};

		try {
			const statsPath = join(homedir(), ".paimon", "self-healing-stats.json");
			if (existsSync(statsPath)) {
				const data = readFileSync(statsPath, "utf-8");
				const loaded = JSON.parse(data) as SelfHealingStats;
				return { ...defaultStats, ...loaded };
			}
		} catch {
			// Use defaults on error
		}

		return defaultStats;
	}

	/**
	 * Save statistics to file
	 */
	private saveStats(): void {
		if (!this.config.trackStats) return;

		try {
			const dir = join(homedir(), ".paimon");
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}
			const statsPath = join(dir, "self-healing-stats.json");
			writeFileSync(statsPath, JSON.stringify(this.stats, null, 2), "utf-8");
		} catch (error) {
			console.error(`[SelfHealing] Failed to save stats: ${error}`);
		}
	}

	/**
	 * Update statistics after a fix attempt
	 */
	private updateStats(
		pattern: SelfHealingPattern,
		result: SelfHealingResult,
		timeTaken: number,
		tokensSaved: number,
	): void {
		this.stats.totalDetected++;

		if (result === "success") {
			this.stats.totalFixed++;
		} else if (result === "failed") {
			this.stats.totalFailed++;
		} else if (result === "skipped") {
			this.stats.totalSkipped++;
		}

		this.stats.totalTimeSpent += timeTaken;
		this.stats.totalTokensSaved += tokensSaved;
		this.stats.lastDetection = new Date().toISOString();
		if (result === "success") {
			this.stats.lastFix = new Date().toISOString();
		}

		// Update by category
		const catStats = this.stats.byCategory[pattern.category];
		catStats.detected++;
		if (result === "success") {
			catStats.fixed++;
		} else if (result === "failed") {
			catStats.failed++;
		}

		// Update by pattern
		if (!this.stats.byPattern[pattern.id]) {
			this.stats.byPattern[pattern.id] = { detected: 0, fixed: 0, failed: 0 };
		}
		this.stats.byPattern[pattern.id].detected++;
		if (result === "success") {
			this.stats.byPattern[pattern.id].fixed++;
		} else if (result === "failed") {
			this.stats.byPattern[pattern.id].failed++;
		}

		// Update success rate
		this.stats.successRate =
			this.stats.totalDetected > 0
				? Math.round((this.stats.totalFixed / this.stats.totalDetected) * 100)
				: 0;

		this.saveStats();
	}

	// ============================================================================
	// Public API
	// ============================================================================

	/**
	 * Check if self-healing is enabled
	 */
	isEnabled(): boolean {
		return this.config.enabled;
	}

	/**
	 * Enable or disable self-healing
	 */
	setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveConfig();
	}

	/**
	 * Get current configuration
	 */
	getConfig(): SelfHealingConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration
	 */
	updateConfig(updates: Partial<SelfHealingConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveConfig();

		// Reinitialize patterns if disabled list changed
		if (updates.disabledPatterns) {
			this.initializePatterns();
		}
	}

	/**
	 * Get all patterns
	 */
	getPatterns(): SelfHealingPattern[] {
		return Array.from(this.patterns.values());
	}

	/**
	 * Get patterns by category
	 */
	getPatternsByCategory(category: SelfHealingCategory): SelfHealingPattern[] {
		return Array.from(this.patterns.values()).filter((p) => p.category === category);
	}

	/**
	 * Get patterns by severity
	 */
	getPatternsBySeverity(severity: SelfHealingSeverity): SelfHealingPattern[] {
		return Array.from(this.patterns.values()).filter((p) => p.severity === severity);
	}

	/**
	 * Get a specific pattern
	 */
	getPattern(patternId: string): SelfHealingPattern | undefined {
		return this.patterns.get(patternId);
	}

	/**
	 * Add a custom pattern
	 */
	addPattern(pattern: SelfHealingPattern): void {
		this.patterns.set(pattern.id, pattern);
		if (!this.config.customPatterns) {
			this.config.customPatterns = [];
		}
		this.config.customPatterns.push(pattern);
		this.saveConfig();
	}

	/**
	 * Remove a pattern
	 */
	removePattern(patternId: string): void {
		this.patterns.delete(patternId);
		this.config.disabledPatterns = this.config.disabledPatterns || [];
		this.config.disabledPatterns.push(patternId);
		this.saveConfig();
	}

	/**
	 * Enable a pattern
	 */
	enablePattern(patternId: string): void {
		if (this.config.disabledPatterns) {
			this.config.disabledPatterns = this.config.disabledPatterns.filter((id) => id !== patternId);
			this.initializePatterns();
			this.saveConfig();
		}
	}

	/**
	 * Add a fix strategy
	 */
	addStrategy(strategy: SelfHealingFixStrategy): void {
		this.strategies.set(strategy.patternId, strategy);
	}

	/**
	 * Get statistics
	 */
	getStats(): SelfHealingStats {
		return { ...this.stats };
	}

	/**
	 * Reset statistics
	 */
	resetStats(): void {
		this.stats = {
			totalDetected: 0,
			totalFixed: 0,
			totalFailed: 0,
			totalSkipped: 0,
			totalTimeSpent: 0,
			totalTokensSaved: 0,
			byCategory: {
				typescript: { detected: 0, fixed: 0, failed: 0 },
				lint: { detected: 0, fixed: 0, failed: 0 },
				test: { detected: 0, fixed: 0, failed: 0 },
				runtime: { detected: 0, fixed: 0, failed: 0 },
				import: { detected: 0, fixed: 0, failed: 0 },
				syntax: { detected: 0, fixed: 0, failed: 0 },
				dependency: { detected: 0, fixed: 0, failed: 0 },
			},
			byPattern: {},
			successRate: 0,
		};
		this.saveStats();
	}

	// ============================================================================
	// Detection and Fixing
	// ============================================================================

	/**
	 * Detect patterns in error content
	 */
	detectPatterns(
		errorContent: string,
		filePath?: string,
		workingDirectory?: string,
	): SelfHealingDetection[] {
		const detections: SelfHealingDetection[] = [];

		for (const pattern of this.patterns.values()) {
			const regex = new RegExp(pattern.detectionPattern.source, pattern.detectionPattern.flags);
			let match: RegExpExecArray | null = regex.exec(errorContent);

			while (match !== null) {
				const context: SelfHealingContext = {
					errorContent,
					filePath,
					workingDirectory: workingDirectory || process.cwd(),
					metadata: { matchedText: match[0] },
				};

				// Try to extract line number from error content
				const lineMatch = errorContent.match(/:(\d+):(\d+)/);
				if (lineMatch) {
					context.lineNumber = Number.parseInt(lineMatch[1], 10);
				}

				// Try to load file content if path provided
				if (filePath && existsSync(filePath)) {
					context.originalContent = readFileSync(filePath, "utf-8");
				}

				const confidence = this.calculateConfidence(pattern, match, context);

				const detection: SelfHealingDetection = {
					pattern,
					match: {
						text: match[0],
						start: match.index,
						end: match.index + match[0].length,
						line: context.lineNumber,
					},
					context,
					confidence,
					recommendAutoFix:
						pattern.autoFixEnabled && confidence > 50 && this.shouldAutoFix(pattern, confidence),
				};

				detections.push(detection);
				match = regex.exec(errorContent);
			}
		}

		this.detectionHistory.push(...detections);
		return detections;
	}

	/**
	 * Calculate confidence score for a detection
	 */
	private calculateConfidence(
		pattern: SelfHealingPattern,
		match: RegExpExecArray,
		context: SelfHealingContext,
	): number {
		let confidence = 70; // Base confidence

		// Higher confidence if file context is available
		if (context.filePath && context.originalContent) {
			confidence += 15;
		}

		// Higher confidence if line number is found
		if (context.lineNumber) {
			confidence += 10;
		}

		// Adjust based on pattern severity
		if (pattern.severity === "critical") {
			confidence -= 10; // More careful with critical patterns
		} else if (pattern.severity === "low") {
			confidence += 5;
		}

		// Check if match is specific (has capture groups)
		if (match.length > 1) {
			confidence += 5;
		}

		return Math.min(100, Math.max(0, confidence));
	}

	/**
	 * Determine if auto-fix should be applied
	 */
	private shouldAutoFix(pattern: SelfHealingPattern, confidence: number): boolean {
		if (!this.config.enabled) return false;
		if (!pattern.autoFixEnabled) return false;

		const severityLevels: SelfHealingSeverity[] = ["low", "medium", "high", "critical"];
		const minIndex = severityLevels.indexOf(this.config.minSeverityForAutoFix);
		const patternIndex = severityLevels.indexOf(pattern.severity);

		// Only auto-fix if severity is >= minimum configured
		if (patternIndex < minIndex) return false;

		// Check confirmation requirements
		if (pattern.requiresConfirmation) return false;
		if (this.config.requireConfirmationForHigh && pattern.severity === "high") return false;

		// Check confidence threshold
		if (confidence < 60) return false;

		return true;
	}

	/**
	 * Apply fix for a detection
	 */
	async applyFix(detection: SelfHealingDetection): Promise<SelfHealingFixResult> {
		const strategy = this.strategies.get(detection.pattern.id);
		if (!strategy) {
			return { result: "failed", message: `No fix strategy for pattern '${detection.pattern.id}'` };
		}

		// Check preconditions
		if (strategy.preconditions && !strategy.preconditions(detection.context)) {
			return { result: "skipped", message: "Preconditions not met for fix" };
		}

		const startTime = Date.now();
		try {
			const result = await strategy.applyFix(detection.context);
			result.timeTaken = Date.now() - startTime;

			// Verify postconditions if defined
			if (strategy.postconditions && result.result === "success") {
				const verified = await strategy.postconditions(detection.context);
				if (!verified) {
					result.result = "partial";
					result.message += " (postconditions not verified)";
				}
			}

			// Update statistics
			this.updateStats(
				detection.pattern,
				result.result,
				result.timeTaken || 0,
				result.tokensSaved || 0,
			);

			// Write fixed file if content was modified
			if (result.modifiedContent && detection.context.filePath) {
				writeFileSync(detection.context.filePath, result.modifiedContent, "utf-8");
			}

			if (this.config.logFixes) {
				console.log(`[SelfHealing] ${result.result}: ${result.message} (${result.timeTaken}ms)`);
			}

			return result;
		} catch (error) {
			const result: SelfHealingFixResult = {
				result: "failed",
				message: `Fix attempt failed: ${error}`,
				timeTaken: Date.now() - startTime,
			};
			this.updateStats(detection.pattern, "failed", result.timeTaken || 0, 0);
			return result;
		}
	}

	/**
	 * Auto-fix all detected patterns
	 */
	async autoFixAll(
		errorContent: string,
		filePath?: string,
		workingDirectory?: string,
	): Promise<SelfHealingFixResult[]> {
		const detections = this.detectPatterns(errorContent, filePath, workingDirectory);
		const results: SelfHealingFixResult[] = [];

		let attempts = 0;
		for (const detection of detections) {
			if (attempts >= this.config.maxTotalAttempts) {
				results.push({
					result: "skipped",
					message: "Max total attempts reached",
				});
				break;
			}

			if (detection.recommendAutoFix) {
				const result = await this.applyFix(detection);
				results.push(result);
				attempts++;
			} else {
				results.push({
					result: "skipped",
					message: `Pattern '${detection.pattern.name}' requires confirmation or has low confidence`,
				});
			}
		}

		return results;
	}

	/**
	 * Get detection history
	 */
	getDetectionHistory(): SelfHealingDetection[] {
		return [...this.detectionHistory];
	}

	/**
	 * Clear detection history
	 */
	clearDetectionHistory(): void {
		this.detectionHistory = [];
	}

	/**
	 * Format patterns for display
	 */
	formatPatterns(): string {
		const patterns = this.getPatterns();
		if (patterns.length === 0) {
			return "No self-healing patterns configured.";
		}

		let output = "# Self-Healing Patterns\n\n";
		output += "| ID | Category | Severity | Auto-Fix | Description |\n";
		output += "|----|----------|----------|----------|-------------|\n";

		for (const pattern of patterns) {
			const autoFix = pattern.autoFixEnabled ? "✅" : "❌";
			output += `| ${pattern.id} | ${pattern.category} | ${pattern.severity} | ${autoFix} | ${pattern.description} |\n`;
		}

		return output;
	}

	/**
	 * Format statistics for display
	 */
	formatStats(): string {
		const stats = this.getStats();

		let output = "# Self-Healing Statistics\n\n";
		output += `**Total Detected:** ${stats.totalDetected}\n`;
		output += `**Total Fixed:** ${stats.totalFixed}\n`;
		output += `**Total Failed:** ${stats.totalFailed}\n`;
		output += `**Total Skipped:** ${stats.totalSkipped}\n`;
		output += `**Success Rate:** ${stats.successRate}%\n`;
		output += `**Total Time:** ${Math.round(stats.totalTimeSpent / 1000)}s\n`;
		output += `**Tokens Saved:** ${stats.totalTokensSaved}\n\n`;

		if (stats.lastDetection) {
			output += `**Last Detection:** ${stats.lastDetection}\n`;
		}
		if (stats.lastFix) {
			output += `**Last Fix:** ${stats.lastFix}\n`;
		}

		output += "\n## By Category\n\n";
		for (const [category, catStats] of Object.entries(stats.byCategory)) {
			output += `- **${category}:** ${catStats.detected} detected, ${catStats.fixed} fixed, ${catStats.failed} failed\n`;
		}

		return output;
	}
}

// ============================================================================
// Singleton Instance
// ============================================================================

let selfHealingManagerInstance: SelfHealingManager | null = null;

/**
 * Get the global self-healing manager instance
 */
export function getSelfHealingManager(): SelfHealingManager {
	if (!selfHealingManagerInstance) {
		selfHealingManagerInstance = new SelfHealingManager();
	}
	return selfHealingManagerInstance;
}

/**
 * Initialize a new self-healing manager with custom config
 */
export function initSelfHealingManager(configPath?: string): SelfHealingManager {
	selfHealingManagerInstance = new SelfHealingManager(configPath);
	return selfHealingManagerInstance;
}

// ============================================================================
// Tool Interface
// ============================================================================

/**
 * Self-healing tool arguments
 */
export interface SelfHealingToolArgs {
	action:
		| "detect"
		| "fix"
		| "auto-fix"
		| "patterns"
		| "pattern"
		| "categories"
		| "severity"
		| "stats"
		| "config"
		| "enable"
		| "disable"
		| "add"
		| "remove"
		| "reset"
		| "history"
		| "help";
	/** Error content to detect patterns in */
	errorContent?: string;
	/** File path if applicable */
	filePath?: string;
	/** Pattern ID for specific operations */
	patternId?: string;
	/** Category to filter by */
	category?: SelfHealingCategory;
	/** Severity level */
	severity?: SelfHealingSeverity;
	/** Pattern to add */
	pattern?: SelfHealingPattern;
	/** Configuration updates */
	config?: Partial<SelfHealingConfig>;
	/** Working directory */
	workingDirectory?: string;
}

/**
 * Self-healing tool implementation
 */
export function selfHealingTool(args: SelfHealingToolArgs): string {
	const manager = getSelfHealingManager();

	switch (args.action) {
		case "detect": {
			if (!args.errorContent) {
				return "Error: errorContent required for detect action";
			}
			const detections = manager.detectPatterns(
				args.errorContent,
				args.filePath,
				args.workingDirectory,
			);
			if (detections.length === 0) {
				return "No self-healing patterns detected in the error content.";
			}

			let output = `# Detected ${detections.length} Patterns\n\n`;
			for (const detection of detections) {
				output += `- **${detection.pattern.name}** (${detection.pattern.id})\n`;
				output += `  - Category: ${detection.pattern.category}\n`;
				output += `  - Severity: ${detection.pattern.severity}\n`;
				output += `  - Confidence: ${detection.confidence}%\n`;
				output += `  - Auto-Fix: ${detection.recommendAutoFix ? "Recommended" : "Not recommended"}\n`;
				output += `  - Match: "${detection.match.text}"\n`;
				if (detection.match.line) {
					output += `  - Line: ${detection.match.line}\n`;
				}
				output += "\n";
			}
			return output;
		}

		case "fix": {
			if (!args.errorContent) {
				return "Error: errorContent required for fix action";
			}
			const detections = manager.detectPatterns(
				args.errorContent,
				args.filePath,
				args.workingDirectory,
			);

			// Find the specific pattern if patternId provided
			const targetDetection = args.patternId
				? detections.find((d) => d.pattern.id === args.patternId)
				: detections.find((d) => d.recommendAutoFix);

			if (!targetDetection) {
				return args.patternId
					? `Pattern '${args.patternId}' not detected or fix not available.`
					: "No auto-fixable pattern detected.";
			}

			// Apply the fix
			manager.applyFix(targetDetection).then((result) => {
				console.log(`[SelfHealing] Fix result: ${result.message}`);
			});

			return `Attempting fix for pattern '${targetDetection.pattern.id}'...\n\nPattern: ${targetDetection.pattern.name}\nMatch: "${targetDetection.match.text}"\n`;
		}

		case "auto-fix": {
			if (!args.errorContent) {
				return "Error: errorContent required for auto-fix action";
			}

			manager
				.autoFixAll(args.errorContent, args.filePath, args.workingDirectory)
				.then((results) => {
					const fixed = results.filter((r) => r.result === "success").length;
					console.log(`[SelfHealing] Auto-fixed ${fixed} of ${results.length} patterns`);
				});

			return `Auto-fixing all detected patterns...\n\nRun 'selfHealing stats' to see results after fixes complete.\n`;
		}

		case "patterns":
			return manager.formatPatterns();

		case "pattern": {
			if (!args.patternId) {
				return "Error: patternId required for pattern action";
			}
			const pattern = manager.getPattern(args.patternId);
			if (!pattern) {
				return `Pattern '${args.patternId}' not found.`;
			}

			let output = `# Pattern: ${pattern.name}\n\n`;
			output += `- **ID:** ${pattern.id}\n`;
			output += `- **Category:** ${pattern.category}\n`;
			output += `- **Severity:** ${pattern.severity}\n`;
			output += `- **Auto-Fix Enabled:** ${pattern.autoFixEnabled ? "Yes" : "No"}\n`;
			output += `- **Requires Confirmation:** ${pattern.requiresConfirmation ? "Yes" : "No"}\n`;
			output += `- **Max Attempts:** ${pattern.maxAttempts}\n`;
			output += `- **Estimated Fix Time:** ${pattern.estimatedFixTime}s\n`;
			output += `\n**Description:** ${pattern.description}\n`;
			output += `\n**Detection Pattern:** ${pattern.detectionPattern.source}\n`;
			return output;
		}

		case "categories": {
			const categories: SelfHealingCategory[] = [
				"typescript",
				"lint",
				"test",
				"runtime",
				"import",
				"syntax",
				"dependency",
			];
			let output = "# Self-Healing Categories\n\n";
			for (const category of categories) {
				const patterns = manager.getPatternsByCategory(category);
				const autoFixCount = patterns.filter((p) => p.autoFixEnabled).length;
				output += `- **${category}:** ${patterns.length} patterns (${autoFixCount} auto-fixable)\n`;
			}
			return output;
		}

		case "severity": {
			if (!args.severity) {
				return "Error: severity required for severity action";
			}
			const patterns = manager.getPatternsBySeverity(args.severity);
			if (patterns.length === 0) {
				return `No patterns with severity '${args.severity}'.`;
			}

			let output = `# Patterns with Severity: ${args.severity}\n\n`;
			for (const pattern of patterns) {
				output += `- **${pattern.id}:** ${pattern.name} (${pattern.category})\n`;
			}
			return output;
		}

		case "stats":
			return manager.formatStats();

		case "config": {
			if (args.config) {
				manager.updateConfig(args.config);
				return `Configuration updated.\n\n${JSON.stringify(manager.getConfig(), null, 2)}`;
			}
			return JSON.stringify(manager.getConfig(), null, 2);
		}

		case "enable":
			manager.setEnabled(true);
			return "Self-healing enabled.";

		case "disable":
			manager.setEnabled(false);
			return "Self-healing disabled.";

		case "add": {
			if (!args.pattern) {
				return "Error: pattern required for add action";
			}
			manager.addPattern(args.pattern);
			return `Pattern '${args.pattern.id}' added successfully.`;
		}

		case "remove": {
			if (!args.patternId) {
				return "Error: patternId required for remove action";
			}
			manager.removePattern(args.patternId);
			return `Pattern '${args.patternId}' removed.`;
		}

		case "reset":
			manager.resetStats();
			return "Statistics reset.";

		case "history": {
			const history = manager.getDetectionHistory();
			if (history.length === 0) {
				return "No detection history.";
			}

			let output = `# Detection History (${history.length} detections)\n\n`;
			for (const detection of history.slice(-20)) {
				output += `- **${detection.pattern.name}** (${detection.confidence}% confidence)\n`;
				output += `  Match: "${detection.match.text.slice(0, 50)}${detection.match.text.length > 50 ? "..." : ""}"\n`;
			}
			return output;
		}

		case "help":
			return `# Self-Healing Tool Help

## Actions

- **detect** - Detect patterns in error content
  - Requires: errorContent
  - Optional: filePath, workingDirectory

- **fix** - Apply fix for detected pattern
  - Requires: errorContent
  - Optional: filePath, patternId, workingDirectory

- **auto-fix** - Auto-fix all detected patterns
  - Requires: errorContent
  - Optional: filePath, workingDirectory

- **patterns** - List all patterns

- **pattern** - Get details of a specific pattern
  - Requires: patternId

- **categories** - List patterns by category

- **severity** - List patterns by severity level
  - Requires: severity (low, medium, high, critical)

- **stats** - View statistics

- **config** - View or update configuration
  - Optional: config object

- **enable** - Enable self-healing

- **disable** - Disable self-healing

- **add** - Add custom pattern
  - Requires: pattern object

- **remove** - Remove a pattern
  - Requires: patternId

- **reset** - Reset statistics

- **history** - View detection history

## Example Usage

selfHealing({action: 'detect', errorContent: 'Cannot find name "foo"', filePath: 'src/test.ts'})
selfHealing({action: 'auto-fix', errorContent: '...lint errors...', filePath: 'src/file.ts'})
selfHealing({action: 'patterns'})
selfHealing({action: 'stats'})
`;

		default:
			return `Unknown action: ${args.action}. Use 'help' action for usage information.`;
	}
}
