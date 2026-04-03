/**
 * Core type definitions for Paimon agent.
 * Extracted from agent.ts for modular architecture.
 */

import type { CompactionConfig } from "./compaction.js";
import type { ContextBudgetConfig } from "./context-budget.js";

/**
 * Plan state for multi-step reasoning
 */
export interface PlanState {
	steps: Array<{
		id: number;
		description: string;
		status: "pending" | "in_progress" | "completed" | "skipped";
		notes?: string;
	}>;
	currentStep: number;
	createdAt: string;
	updatedAt: string;
}

/**
 * Regression testing result for assessment
 */
export interface RegressionAssessmentResult {
	/** Whether a regression was detected */
	regressionDetected: boolean;
	/** Number of new test failures */
	newFailures: number;
	/** Number of regressed tests (previously passing, now failing) */
	regressedTests: number;
	/** Number of fixed tests */
	fixedTests: number;
	/** Overall change indicator */
	overallChange: "improved" | "degraded" | "unchanged" | "mixed" | "none";
	/** Summary message */
	summary: string;
}

/**
 * Assessment result for self-review
 */
export interface AssessmentResult {
	buildStatus: "pass" | "fail" | "unknown";
	testStatus: "pass" | "fail" | "unknown";
	lintStatus: "pass" | "fail" | "unknown";
	changedFiles: string[];
	timestamp: string;
	recommendations: string[];
	attempts: number;
	errorPatterns?: ErrorPattern[];
	/** Regression testing results (if enabled) */
	regressionResult?: RegressionAssessmentResult;
}

/**
 * Reflection result for learning from failures
 */
export interface ReflectionResult {
	context: string;
	insight: string;
	action: string;
	formattedEntry: string;
	writtenToMemory: boolean;
}

/**
 * Extracted error pattern from build/test output
 */
export interface ErrorPattern {
	type: "typescript" | "test" | "lint" | "runtime";
	file?: string;
	line?: number;
	message: string;
	suggestion: string;
	/** Confidence score 0-100 (higher = more confident this is a real issue) */
	confidence: number;
}

/**
 * Result from a parallel task execution
 */
export interface ParallelTaskResult {
	name: string;
	status: "success" | "failed" | "timeout";
	exitCode: number | null;
	output: string;
	error?: string;
	duration: number;
}

/**
 * Overall result from parallel tool
 */
export interface ParallelResult {
	success: boolean;
	results: ParallelTaskResult[];
	totalDuration: number;
	successCount: number;
	failedCount: number;
	timedOutCount: number;
}

/**
 * Message in linear history (for debugging/fine-tuning)
 */
export interface LinearMessage {
	role: "user" | "assistant" | "system";
	content: string;
	timestamp?: string;
}

/**
 * Automatic context reduction action types
 */
export type ContextReductionAction =
	| "compact_aggressive"
	| "truncate_outputs"
	| "clear_cache"
	| "reduce_tools"
	| "archive_memory";

/**
 * Automatic context reduction configuration
 */
export interface AutoContextReductionConfig {
	/** Enable automatic context reduction on critical status */
	enabled: boolean;
	/** Actions to execute automatically (ordered by priority) */
	actions: ContextReductionAction[];
	/** Maximum tool output size when truncating (tokens) */
	maxToolOutputTokens?: number;
	/** Compact threshold for aggressive compaction (percentage) */
	compactThreshold?: number;
	/** Whether to log executed actions */
	logActions?: boolean;
}

/**
 * Paimon agent configuration
 */
export interface PaimonConfig {
	apiKey: string;
	model: string;
	baseUrl: string;
	skillsDir?: string;
	memoryPath?: string;
	mode?: "chat" | "evolve";
	/** Enable context compaction for long sessions */
	compaction?: Partial<CompactionConfig> | false;
	/** Enable linear message history for debugging/fine-tuning (Mini-SWE-Agent pattern) */
	linearHistory?: boolean;
	/** Context budget monitoring configuration for proactive context management */
	contextBudget?: Partial<ContextBudgetConfig>;
	/** Automatic context reduction configuration for critical status handling */
	autoContextReduction?: Partial<AutoContextReductionConfig>;
}

/**
 * Error message wrapper
 */
export interface ErrorMessage {
	errorMessage?: string;
}
