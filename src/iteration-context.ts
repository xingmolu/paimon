/**
 * Iteration Context Tracker - Tracks iteration data during evolution sessions
 *
 * This module provides context for the Self-Evaluation Stop hook,
 * storing task type, description, duration, errors, and skills used
 * during an evolution iteration.
 *
 * Used by:
 * - Self-Evaluation Stop hook to trigger automatic evaluation
 * - Agent to record iteration progress
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Iteration context data
 */
export interface IterationContext {
	/** Unique identifier for this iteration */
	iterationId: string;
	/** When the iteration started */
	startTime: string;
	/** When the iteration ended */
	endTime?: string;
	/** Task type: capability, reliability, or feature */
	taskType: "capability" | "reliability" | "feature";
	/** Description of the task */
	taskDescription: string;
	/** Duration in minutes (calculated from start/end time) */
	durationMinutes?: number;
	/** Whether the task completed successfully */
	success?: boolean;
	/** Errors encountered during iteration */
	errors: string[];
	/** Skills used during iteration */
	skillsUsed: string[];
	/** Whether it succeeded on first try */
	firstTry?: boolean;
	/** Whether rework was required */
	rework?: boolean;
	/** Impact level */
	impact?: "High" | "Medium" | "Low";
	/** Additional notes */
	notes: string[];
}

/**
 * Iteration context manager configuration
 */
export interface IterationContextConfig {
	/** Whether tracking is enabled */
	enabled: boolean;
	/** Auto-start new iteration on session start */
	autoStart: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: IterationContextConfig = {
	enabled: true,
	autoStart: true,
};

/**
 * IterationContextManager class
 * Manages tracking of iteration context for self-evaluation
 */
export class IterationContextManager {
	private config: IterationContextConfig;
	private currentIteration: IterationContext | null = null;
	private completedIterations: IterationContext[] = [];
	private dataPath: string;

	constructor(config?: Partial<IterationContextConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.dataPath = join(homedir(), ".paimon", "iteration-context.json");
		this.loadState();
	}

	/**
	 * Start a new iteration
	 */
	startIteration(data: {
		taskType: "capability" | "reliability" | "feature";
		taskDescription: string;
	}): string {
		const iterationId = `iter-${Date.now()}`;
		const startTime = new Date().toISOString();

		this.currentIteration = {
			iterationId,
			startTime,
			taskType: data.taskType,
			taskDescription: data.taskDescription,
			errors: [],
			skillsUsed: [],
			notes: [],
		};

		this.saveState();
		return iterationId;
	}

	/**
	 * End the current iteration
	 */
	endIteration(data: {
		success: boolean;
		errors?: string[];
		skillsUsed?: string[];
		firstTry?: boolean;
		rework?: boolean;
		impact?: "High" | "Medium" | "Low";
	}): IterationContext | null {
		if (!this.currentIteration) {
			return null;
		}

		const endTime = new Date().toISOString();
		const startTime = new Date(this.currentIteration.startTime).getTime();
		const endTimeMs = new Date(endTime).getTime();
		const durationMinutes = Math.round(((endTimeMs - startTime) / 1000 / 60) * 10) / 10;

		this.currentIteration = {
			...this.currentIteration,
			endTime,
			durationMinutes,
			success: data.success,
			errors: data.errors || this.currentIteration.errors,
			skillsUsed: data.skillsUsed || this.currentIteration.skillsUsed,
			firstTry: data.firstTry,
			rework: data.rework,
			impact: data.impact,
		};

		// Store completed iteration
		this.completedIterations.push(this.currentIteration);

		// Keep only last 100 iterations
		if (this.completedIterations.length > 100) {
			this.completedIterations = this.completedIterations.slice(-100);
		}

		const result = this.currentIteration;
		this.currentIteration = null;
		this.saveState();

		return result;
	}

	/**
	 * Record an error during iteration
	 */
	recordError(error: string): void {
		if (this.currentIteration) {
			this.currentIteration.errors.push(error);
			this.saveState();
		}
	}

	/**
	 * Record a skill used during iteration
	 */
	recordSkillUsed(skill: string): void {
		if (this.currentIteration && !this.currentIteration.skillsUsed.includes(skill)) {
			this.currentIteration.skillsUsed.push(skill);
			this.saveState();
		}
	}

	/**
	 * Add a note to the current iteration
	 */
	addNote(note: string): void {
		if (this.currentIteration) {
			this.currentIteration.notes.push(note);
			this.saveState();
		}
	}

	/**
	 * Get current iteration context
	 */
	getCurrentIteration(): IterationContext | null {
		return this.currentIteration;
	}

	/**
	 * Get recent completed iterations
	 */
	getRecentIterations(limit = 10): IterationContext[] {
		return this.completedIterations.slice(-limit);
	}

	/**
	 * Check if tracking is enabled
	 */
	isEnabled(): boolean {
		return this.config.enabled;
	}

	/**
	 * Enable or disable tracking
	 */
	setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveState();
	}

	/**
	 * Get statistics
	 */
	getStats(): {
		totalIterations: number;
		successfulIterations: number;
		failedIterations: number;
		averageDuration: number;
		byTaskType: Record<string, number>;
		topSkills: string[];
	} {
		const total = this.completedIterations.length;
		const successful = this.completedIterations.filter((i) => i.success).length;
		const failed = total - successful;

		const totalDuration = this.completedIterations.reduce(
			(sum, i) => sum + (i.durationMinutes || 0),
			0,
		);
		const avgDuration = total > 0 ? Math.round((totalDuration / total) * 10) / 10 : 0;

		const byTaskType: Record<string, number> = {};
		for (const iter of this.completedIterations) {
			byTaskType[iter.taskType] = (byTaskType[iter.taskType] || 0) + 1;
		}

		const skillCounts: Record<string, number> = {};
		for (const iter of this.completedIterations) {
			for (const skill of iter.skillsUsed) {
				skillCounts[skill] = (skillCounts[skill] || 0) + 1;
			}
		}
		const topSkills = Object.entries(skillCounts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([skill]) => skill);

		return {
			totalIterations: total,
			successfulIterations: successful,
			failedIterations: failed,
			averageDuration: avgDuration,
			byTaskType,
			topSkills,
		};
	}

	/**
	 * Clear all iteration data
	 */
	clear(): void {
		this.currentIteration = null;
		this.completedIterations = [];
		this.saveState();
	}

	/**
	 * Load state from disk
	 */
	private loadState(): void {
		if (existsSync(this.dataPath)) {
			try {
				const content = readFileSync(this.dataPath, "utf-8");
				const data = JSON.parse(content);
				this.completedIterations = data.completedIterations || [];
				this.config = { ...DEFAULT_CONFIG, ...data.config };
			} catch {
				// Ignore parse errors
			}
		}
	}

	/**
	 * Save state to disk
	 */
	private saveState(): void {
		const dir = join(homedir(), ".paimon");
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}

		writeFileSync(
			this.dataPath,
			JSON.stringify(
				{
					currentIteration: this.currentIteration,
					completedIterations: this.completedIterations,
					config: this.config,
				},
				null,
				2,
			),
			"utf-8",
		);
	}
}

// Global instance
let globalIterationContextManager: IterationContextManager | null = null;

/**
 * Get the global iteration context manager
 */
export function getIterationContextManager(): IterationContextManager {
	if (!globalIterationContextManager) {
		globalIterationContextManager = new IterationContextManager();
	}
	return globalIterationContextManager;
}

/**
 * Initialize the global iteration context manager
 */
export function initIterationContextManager(
	config?: Partial<IterationContextConfig>,
): IterationContextManager {
	globalIterationContextManager = new IterationContextManager(config);
	return globalIterationContextManager;
}
