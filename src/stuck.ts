/**
 * Stuck Detection Module
 *
 * Inspired by OpenHands' StuckDetector - detects when agent is looping
 * and provides recovery options.
 *
 * Loop types detected:
 * - Repeated actions: Same tool/action called repeatedly
 * - Same errors: Same error pattern occurring multiple times
 * - Circular dependencies: Agent bouncing between same states
 */

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Types of loops the agent can get stuck in
 */
export type LoopType = "repeated_action" | "same_error" | "circular_state" | "no_progress";

/**
 * Analysis result when a loop is detected
 */
export interface StuckAnalysis {
	loopType: LoopType;
	loopStartIdx: number;
	detectedAtIteration: number;
	repeatedAction?: string;
	repeatedError?: string;
	stateCycle?: string[];
	suggestions: string[];
}

/**
 * Recovery options for the agent
 */
export interface RecoveryOption {
	id: number;
	description: string;
	action: "restart_before_loop" | "restart_with_last_message" | "quit";
}

/**
 * Message in conversation history for loop detection
 */
export interface HistoryMessage {
	id: number;
	role: "user" | "assistant" | "system";
	content: string;
	action?: string;
	error?: string;
	timestamp: number;
}

/**
 * StuckDetector class for detecting and recovering from loops
 */
export class StuckDetector {
	private history: HistoryMessage[] = [];
	private maxHistorySize = 100;
	private repeatedActionThreshold = 3;
	private repeatedErrorThreshold = 3;
	private noProgressThreshold = 5;
	private stuckAnalysis: StuckAnalysis | null = null;
	private dataDir: string;

	constructor(dataDir?: string) {
		this.dataDir = dataDir || path.join(process.env.HOME || "~", ".paimon");
	}

	/**
	 * Add a message to history for loop detection
	 */
	addMessage(message: HistoryMessage): void {
		this.history.push(message);

		// Keep history bounded
		if (this.history.length > this.maxHistorySize) {
			this.history = this.history.slice(-this.maxHistorySize);
		}
	}

	/**
	 * Check if agent is stuck in a loop
	 */
	isStuck(): boolean {
		this.stuckAnalysis = this.detectLoop();
		return this.stuckAnalysis !== null;
	}

	/**
	 * Get the current stuck analysis
	 */
	getStuckAnalysis(): StuckAnalysis | null {
		return this.stuckAnalysis;
	}

	/**
	 * Detect loop patterns in history
	 */
	private detectLoop(): StuckAnalysis | null {
		if (this.history.length < this.repeatedActionThreshold) {
			return null;
		}

		// Check for repeated actions
		const repeatedAction = this.detectRepeatedActions();
		if (repeatedAction) {
			return repeatedAction;
		}

		// Check for repeated errors
		const repeatedError = this.detectRepeatedErrors();
		if (repeatedError) {
			return repeatedError;
		}

		// Check for no progress (same state repeated)
		const noProgress = this.detectNoProgress();
		if (noProgress) {
			return noProgress;
		}

		return null;
	}

	/**
	 * Detect if same action is being repeated
	 */
	private detectRepeatedActions(): StuckAnalysis | null {
		const assistantMessages = this.history.filter((m) => m.role === "assistant" && m.action);

		if (assistantMessages.length < this.repeatedActionThreshold) {
			return null;
		}

		// Look for last N messages with same action
		const recentActions = assistantMessages
			.slice(-this.repeatedActionThreshold * 2)
			.map((m) => m.action);

		// Check if last threshold messages have the same action
		const lastActions = recentActions.slice(-this.repeatedActionThreshold);
		if (lastActions.length >= this.repeatedActionThreshold) {
			const firstAction = lastActions[0];
			const allSame = lastActions.every((a) => a === firstAction);

			if (allSame && firstAction) {
				// Find where the loop started
				const loopStartIdx = this.findLoopStart("action", firstAction);

				return {
					loopType: "repeated_action",
					loopStartIdx,
					detectedAtIteration: this.history.length,
					repeatedAction: firstAction,
					suggestions: [
						"Try a different approach or tool",
						"Check if the action parameters are correct",
						"Consider using a specialized skill for this task",
					],
				};
			}
		}

		return null;
	}

	/**
	 * Detect if same error is occurring repeatedly
	 */
	private detectRepeatedErrors(): StuckAnalysis | null {
		const errorMessages = this.history.filter((m) => m.role === "assistant" && m.error);

		if (errorMessages.length < this.repeatedErrorThreshold) {
			return null;
		}

		// Look for last N messages with same error
		const recentErrors = errorMessages.slice(-this.repeatedErrorThreshold * 2).map((m) => m.error);

		const lastErrors = recentErrors.slice(-this.repeatedErrorThreshold);
		if (lastErrors.length >= this.repeatedErrorThreshold) {
			const firstError = lastErrors[0];
			const allSame = lastErrors.every((e) => e === firstError);

			if (allSame && firstError) {
				// Find where the loop started
				const loopStartIdx = this.findLoopStart("error", firstError);

				return {
					loopType: "same_error",
					loopStartIdx,
					detectedAtIteration: this.history.length,
					repeatedError: firstError,
					suggestions: [
						"Analyze the error root cause",
						"Try a different implementation approach",
						"Use reflect tool to learn from this failure",
					],
				};
			}
		}

		return null;
	}

	/**
	 * Detect if agent is making no progress (similar content repeatedly)
	 */
	private detectNoProgress(): StuckAnalysis | null {
		const assistantMessages = this.history.filter((m) => m.role === "assistant");

		if (assistantMessages.length < this.noProgressThreshold) {
			return null;
		}

		// Check if last N assistant messages have very similar content
		const recentContent = assistantMessages
			.slice(-this.noProgressThreshold)
			.map((m) => this.normalizeContent(m.content));

		// Check content similarity (if all messages are ~same)
		const firstContent = recentContent[0];
		if (firstContent) {
			const similarityThreshold = 0.8;
			const similarCount = recentContent.filter(
				(c) => this.similarity(c, firstContent) > similarityThreshold,
			).length;

			if (similarCount >= this.noProgressThreshold - 1) {
				const loopStartIdx = this.history.length - this.noProgressThreshold;

				return {
					loopType: "no_progress",
					loopStartIdx,
					detectedAtIteration: this.history.length,
					stateCycle: recentContent.slice(0, 3),
					suggestions: [
						"Ask user for clarification",
						"Break down task into smaller steps",
						"Try a completely different approach",
					],
				};
			}
		}

		return null;
	}

	/**
	 * Find the index where a loop started
	 */
	private findLoopStart(type: "action" | "error", value: string): number {
		for (let i = this.history.length - 1; i >= 0; i--) {
			const msg = this.history[i];
			if (type === "action" && msg.action === value) {
				continue;
			}
			if (type === "error" && msg.error === value) {
				continue;
			}
			// Found the first message that's different - loop starts after this
			return i + 1;
		}
		return 0;
	}

	/**
	 * Normalize content for comparison
	 */
	private normalizeContent(content: string): string {
		// Remove timestamps, IDs, and other variable parts
		return content
			.replace(/\d{4}-\d{2}-\d{2}/g, "DATE")
			.replace(/\d{2}:\d{2}:\d{2}/g, "TIME")
			.replace(/id=\d+/g, "id=N")
			.replace(/\b\d+\b/g, "N")
			.toLowerCase()
			.trim();
	}

	/**
	 * Calculate similarity between two strings (simple Jaccard)
	 */
	private similarity(a: string, b: string): number {
		const wordsA = new Set(a.split(/\s+/));
		const wordsB = new Set(b.split(/\s+/));

		const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
		const union = new Set([...wordsA, ...wordsB]);

		return intersection.size / union.size;
	}

	/**
	 * Get recovery options for the current stuck state
	 */
	getRecoveryOptions(): RecoveryOption[] {
		return [
			{
				id: 1,
				description: "Restart from before loop (preserves earlier progress)",
				action: "restart_before_loop",
			},
			{
				id: 2,
				description: "Restart with last user instruction",
				action: "restart_with_last_message",
			},
			{
				id: 3,
				description: "Quit current task",
				action: "quit",
			},
		];
	}

	/**
	 * Truncate history to a recovery point
	 */
	truncateToRecoveryPoint(recoveryIdx: number): HistoryMessage[] {
		if (recoveryIdx >= this.history.length) {
			return this.history;
		}

		// Keep messages before the loop
		const keptHistory = this.history.slice(0, recoveryIdx);
		this.history = keptHistory;
		this.stuckAnalysis = null;

		return keptHistory;
	}

	/**
	 * Get last user message for restart
	 */
	getLastUserMessage(): HistoryMessage | null {
		for (let i = this.history.length - 1; i >= 0; i--) {
			if (this.history[i].role === "user") {
				return this.history[i];
			}
		}
		return null;
	}

	/**
	 * Reset detector state
	 */
	reset(): void {
		this.history = [];
		this.stuckAnalysis = null;
	}

	/**
	 * Save stuck state to file for persistence
	 */
	saveState(projectId: string): void {
		const stuckPath = path.join(this.dataDir, "stuck-states", `${projectId}.json`);
		const stuckDir = path.dirname(stuckPath);

		if (!fs.existsSync(stuckDir)) {
			fs.mkdirSync(stuckDir, { recursive: true });
		}

		const state = {
			history: this.history,
			stuckAnalysis: this.stuckAnalysis,
			timestamp: Date.now(),
		};

		fs.writeFileSync(stuckPath, JSON.stringify(state, null, 2));
	}

	/**
	 * Load stuck state from file
	 */
	loadState(projectId: string): boolean {
		const stuckPath = path.join(this.dataDir, "stuck-states", `${projectId}.json`);

		if (!fs.existsSync(stuckPath)) {
			return false;
		}

		try {
			const state = JSON.parse(fs.readFileSync(stuckPath, "utf-8"));
			this.history = state.history || [];
			this.stuckAnalysis = state.stuckAnalysis || null;
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Format stuck analysis for display
	 */
	formatStuckAnalysis(): string {
		if (!this.stuckAnalysis) {
			return "No loop detected.";
		}

		const analysis = this.stuckAnalysis;
		let output = "⚠️  Agent detected in a loop!\n\n";
		output += `Loop type: ${analysis.loopType}\n`;
		output += `Detected at iteration: ${analysis.detectedAtIteration}\n`;
		output += `Loop started at: message ${analysis.loopStartIdx}\n\n`;

		if (analysis.repeatedAction) {
			output += `Repeated action: ${analysis.repeatedAction}\n`;
		}
		if (analysis.repeatedError) {
			output += `Repeated error: ${analysis.repeatedError}\n`;
		}
		if (analysis.stateCycle) {
			output += `State cycle: ${analysis.stateCycle.join(" → ")}\n`;
		}

		output += "\nSuggestions:\n";
		for (const suggestion of analysis.suggestions) {
			output += `  • ${suggestion}\n`;
		}

		output += "\nRecovery options:\n";
		for (const option of this.getRecoveryOptions()) {
			output += `  ${option.id}. ${option.description}\n`;
		}

		return output;
	}
}
