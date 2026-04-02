/**
 * Ralph Loop Manager - Self-referential iteration loop for autonomous evolution
 *
 * Inspired by Claude Code's ralph-wiggum plugin:
 * - Stop hook intercepts exit attempts
 * - Blocks exit and feeds the same prompt back
 * - Creates self-referential feedback loop
 * - Agent autonomously improves by reading its own past work in files
 *
 * Reference: https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum
 */

import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Ralph Loop state
 */
export interface RalphLoopState {
	/** Unique loop ID */
	id: string;
	/** Original prompt to iterate on */
	prompt: string;
	/** Completion promise string that signals task is done */
	completionPromise: string;
	/** Maximum iterations (safety limit) */
	maxIterations: number;
	/** Current iteration count */
	currentIteration: number;
	/** Loop status */
	status: "active" | "completed" | "cancelled" | "max_reached";
	/** When the loop started */
	startedAt: string;
	/** Last iteration timestamp */
	lastIterationAt: string;
	/** Session context (for resumption) */
	sessionContext?: {
		mode: "chat" | "evolve";
		project: string;
	};
	/** Notes from iterations */
	notes?: string[];
}

/**
 * Ralph Loop configuration
 */
export interface RalphLoopConfig {
	/** Directory to store loop state */
	dataDir?: string;
	/** Default max iterations */
	defaultMaxIterations?: number;
	/** Enable/disable Ralph Loop feature */
	enabled?: boolean;
}

/**
 * Ralph Loop statistics
 */
export interface RalphLoopStats {
	/** Total loops started */
	totalLoops: number;
	/** Completed loops */
	completedLoops: number;
	/** Cancelled loops */
	cancelledLoops: number;
	/** Max reached loops */
	maxReachedLoops: number;
	/** Average iterations per loop */
	avgIterations: number;
	/** Average time per loop (ms) */
	avgDuration: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: RalphLoopConfig = {
	dataDir: join(homedir(), ".paimon", "ralph-loops"),
	defaultMaxIterations: 50,
	enabled: true,
};

/**
 * Ralph Loop Manager - manages self-referential iteration loops
 */
export class RalphLoopManager {
	private config: RalphLoopConfig;
	private currentLoop: RalphLoopState | null = null;
	private dataPath: string;

	constructor(config?: Partial<RalphLoopConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.dataPath = this.config.dataDir ?? join(homedir(), ".paimon", "ralph-loops");
		this.ensureDataDir();
		this.currentLoop = this.loadCurrentLoop();
	}

	/**
	 * Ensure data directory exists
	 */
	private ensureDataDir(): void {
		if (!existsSync(this.dataPath)) {
			mkdirSync(this.dataPath, { recursive: true });
		}
	}

	/**
	 * Get path for loop state file
	 */
	private getLoopPath(id: string): string {
		return join(this.dataPath, `loop-${id}.json`);
	}

	/**
	 * Get path for current loop marker
	 */
	private getCurrentLoopPath(): string {
		return join(this.dataPath, "current-loop.json");
	}

	/**
	 * Load current active loop from disk
	 */
	private loadCurrentLoop(): RalphLoopState | null {
		const currentPath = this.getCurrentLoopPath();
		if (existsSync(currentPath)) {
			try {
				const content = readFileSync(currentPath, "utf-8");
				const loop = JSON.parse(content) as RalphLoopState;
				// Only return if still active
				if (loop.status === "active") {
					return loop;
				}
			} catch {
				// Invalid state, ignore
			}
		}
		return null;
	}

	/**
	 * Save loop state to disk
	 */
	private saveLoop(loop: RalphLoopState): void {
		const loopPath = this.getLoopPath(loop.id);
		writeFileSync(loopPath, JSON.stringify(loop, null, 2), "utf-8");

		// Update current loop marker if active
		if (loop.status === "active") {
			writeFileSync(this.getCurrentLoopPath(), JSON.stringify(loop, null, 2), "utf-8");
		}
	}

	/**
	 * Generate unique loop ID
	 */
	private generateId(): string {
		return `ralph-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
	}

	/**
	 * Check if Ralph Loop is enabled
	 */
	isEnabled(): boolean {
		return this.config.enabled ?? true;
	}

	/**
	 * Get current active loop
	 */
	getCurrentLoop(): RalphLoopState | null {
		return this.currentLoop;
	}

	/**
	 * Check if there's an active loop
	 */
	hasActiveLoop(): boolean {
		return this.currentLoop !== null && this.currentLoop.status === "active";
	}

	/**
	 * Start a new Ralph Loop
	 */
	startLoop(
		prompt: string,
		completionPromise: string,
		maxIterations?: number,
		sessionContext?: { mode: "chat" | "evolve"; project: string },
	): RalphLoopState {
		// Cancel any existing loop first
		if (this.currentLoop && this.currentLoop.status === "active") {
			this.cancelLoop(this.currentLoop.id, "New loop started");
		}

		const loop: RalphLoopState = {
			id: this.generateId(),
			prompt,
			completionPromise,
			maxIterations: maxIterations ?? this.config.defaultMaxIterations ?? 50,
			currentIteration: 0,
			status: "active",
			startedAt: new Date().toISOString(),
			lastIterationAt: new Date().toISOString(),
			sessionContext,
			notes: [],
		};

		this.currentLoop = loop;
		this.saveLoop(loop);

		return loop;
	}

	/**
	 * Increment iteration count (called by Stop hook)
	 */
	incrementIteration(): {
		shouldContinue: boolean;
		reason: string;
		prompt?: string;
	} {
		if (!this.currentLoop || this.currentLoop.status !== "active") {
			return { shouldContinue: false, reason: "No active loop" };
		}

		this.currentLoop.currentIteration++;
		this.currentLoop.lastIterationAt = new Date().toISOString();

		// Check max iterations
		if (this.currentLoop.currentIteration >= this.currentLoop.maxIterations) {
			this.currentLoop.status = "max_reached";
			this.saveLoop(this.currentLoop);
			return {
				shouldContinue: false,
				reason: `Max iterations reached (${this.currentLoop.maxIterations})`,
			};
		}

		this.saveLoop(this.currentLoop);

		return {
			shouldContinue: true,
			reason: `Iteration ${this.currentLoop.currentIteration}/${this.currentLoop.maxIterations}`,
			prompt: this.currentLoop.prompt,
		};
	}

	/**
	 * Check if completion promise is found in output
	 */
	checkCompletionPromise(output: string): boolean {
		if (!this.currentLoop) {
			return false;
		}
		return output.includes(this.currentLoop.completionPromise);
	}

	/**
	 * Mark loop as completed
	 */
	completeLoop(id: string, reason?: string): RalphLoopState | null {
		if (!this.currentLoop || this.currentLoop.id !== id) {
			// Try to load the loop from disk
			const loopPath = this.getLoopPath(id);
			if (existsSync(loopPath)) {
				try {
					const content = readFileSync(loopPath, "utf-8");
					const loop = JSON.parse(content) as RalphLoopState;
					loop.status = "completed";
					if (reason) {
						loop.notes = loop.notes || [];
						loop.notes.push(`Completed: ${reason}`);
					}
					this.saveLoop(loop);
					if (this.currentLoop?.id === id) {
						this.currentLoop = null;
					}
					return loop;
				} catch {
					return null;
				}
			}
			return null;
		}

		this.currentLoop.status = "completed";
		this.currentLoop.notes = this.currentLoop.notes || [];
		if (reason) {
			this.currentLoop.notes.push(`Completed: ${reason}`);
		}
		this.saveLoop(this.currentLoop);

		const completedLoop = this.currentLoop;
		this.currentLoop = null;

		return completedLoop;
	}

	/**
	 * Cancel an active loop
	 */
	cancelLoop(id: string, reason?: string): RalphLoopState | null {
		if (!this.currentLoop || this.currentLoop.id !== id) {
			return null;
		}

		this.currentLoop.status = "cancelled";
		this.currentLoop.notes = this.currentLoop.notes || [];
		if (reason) {
			this.currentLoop.notes.push(`Cancelled: ${reason}`);
		}
		this.saveLoop(this.currentLoop);

		const cancelledLoop = this.currentLoop;
		this.currentLoop = null;

		return cancelledLoop;
	}

	/**
	 * Add note to current loop
	 */
	addNote(note: string): boolean {
		if (!this.currentLoop) {
			return false;
		}
		this.currentLoop.notes = this.currentLoop.notes || [];
		this.currentLoop.notes.push(note);
		this.saveLoop(this.currentLoop);
		return true;
	}

	/**
	 * Get loop by ID
	 */
	getLoop(id: string): RalphLoopState | null {
		// Check current loop first
		if (this.currentLoop?.id === id) {
			return this.currentLoop;
		}

		// Load from disk
		const loopPath = this.getLoopPath(id);
		if (existsSync(loopPath)) {
			try {
				const content = readFileSync(loopPath, "utf-8");
				return JSON.parse(content) as RalphLoopState;
			} catch {
				return null;
			}
		}
		return null;
	}

	/**
	 * List all loops (optionally filtered by status)
	 */
	listLoops(status?: "active" | "completed" | "cancelled" | "max_reached"): RalphLoopState[] {
		const loops: RalphLoopState[] = [];

		// Add current loop if it matches filter
		if (this.currentLoop) {
			if (!status || this.currentLoop.status === status) {
				loops.push(this.currentLoop);
			}
		}

		// Load all loops from disk
		try {
			const files = existsSync(this.dataPath) ? readdirSync(this.dataPath) : [];
			for (const file of files) {
				if (file.startsWith("loop-") && file.endsWith(".json")) {
					const filePath = join(this.dataPath, file);
					try {
						const content = readFileSync(filePath, "utf-8");
						const loop = JSON.parse(content) as RalphLoopState;
						if (!status || loop.status === status) {
							// Don't duplicate current loop
							if (!loops.find((l) => l.id === loop.id)) {
								loops.push(loop);
							}
						}
					} catch {
						// Invalid file, skip
					}
				}
			}
		} catch {
			// Can't read directory
		}

		return loops.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
	}

	/**
	 * Get statistics
	 */
	getStats(): RalphLoopStats {
		const loops = this.listLoops();

		const completed = loops.filter((l) => l.status === "completed");
		const cancelled = loops.filter((l) => l.status === "cancelled");
		const maxReached = loops.filter((l) => l.status === "max_reached");

		const totalIterations = loops.reduce((sum, l) => sum + l.currentIteration, 0);
		const avgIterations = loops.length > 0 ? totalIterations / loops.length : 0;

		const totalDuration = loops.reduce((sum, l) => {
			const start = new Date(l.startedAt).getTime();
			const end = new Date(l.lastIterationAt).getTime();
			return sum + (end - start);
		}, 0);
		const avgDuration = loops.length > 0 ? totalDuration / loops.length : 0;

		return {
			totalLoops: loops.length,
			completedLoops: completed.length,
			cancelledLoops: cancelled.length,
			maxReachedLoops: maxReached.length,
			avgIterations,
			avgDuration,
		};
	}

	/**
	 * Clear old loops (keep recent N)
	 */
	clearOldLoops(keepCount = 20): number {
		const loops = this.listLoops();
		const toDelete = loops.filter((l) => l.status !== "active").slice(keepCount);

		let deleted = 0;
		for (const loop of toDelete) {
			const loopPath = this.getLoopPath(loop.id);
			try {
				if (existsSync(loopPath)) {
					unlinkSync(loopPath);
					deleted++;
				}
			} catch {
				// Can't delete
			}
		}

		return deleted;
	}

	/**
	 * Format loop for display
	 */
	formatLoop(loop: RalphLoopState): string {
		const statusEmoji = {
			active: "🔄",
			completed: "✅",
			cancelled: "❌",
			max_reached: "⚠️",
		};

		const duration =
			(new Date(loop.lastIterationAt).getTime() - new Date(loop.startedAt).getTime()) / 1000;

		let output = `${statusEmoji[loop.status]} Ralph Loop: ${loop.id}\n`;
		output += `   Status: ${loop.status}\n`;
		output += `   Iterations: ${loop.currentIteration}/${loop.maxIterations}\n`;
		output += `   Duration: ${Math.round(duration)}s\n`;
		output += `   Started: ${loop.startedAt}\n`;
		output += `   Completion Promise: "${loop.completionPromise}"\n`;
		output += `   Prompt: ${loop.prompt.substring(0, 100)}${loop.prompt.length > 100 ? "..." : ""}\n`;

		if (loop.notes && loop.notes.length > 0) {
			output += `   Notes: ${loop.notes.length} entries\n`;
		}

		return output;
	}

	/**
	 * Format loops list for display
	 */
	formatLoopsList(loops: RalphLoopState[]): string {
		if (loops.length === 0) {
			return "No Ralph Loops found.";
		}

		let output = "🔄 Ralph Loops\n";
		output += `${"─".repeat(50)}\n`;
		output += `Total: ${loops.length} loops\n`;
		output += `${"─".repeat(50)}\n\n`;

		for (const loop of loops) {
			output += `${this.formatLoop(loop)}\n`;
		}

		return output;
	}

	/**
	 * Format statistics for display
	 */
	formatStats(stats: RalphLoopStats): string {
		let output = "📊 Ralph Loop Statistics\n";
		output += `${"─".repeat(50)}\n`;
		output += `Total Loops: ${stats.totalLoops}\n`;
		output += `Completed: ${stats.completedLoops} (${Math.round((stats.completedLoops / stats.totalLoops) * 100) || 0}%)\n`;
		output += `Cancelled: ${stats.cancelledLoops}\n`;
		output += `Max Reached: ${stats.maxReachedLoops}\n`;
		output += `Avg Iterations: ${Math.round(stats.avgIterations)}\n`;
		output += `Avg Duration: ${Math.round(stats.avgDuration / 1000)}s\n`;

		return output;
	}
}

/**
 * Global Ralph Loop Manager instance
 */
let globalRalphLoopManager: RalphLoopManager | null = null;

/**
 * Get or create global Ralph Loop Manager
 */
export function getRalphLoopManager(config?: Partial<RalphLoopConfig>): RalphLoopManager {
	if (!globalRalphLoopManager) {
		globalRalphLoopManager = new RalphLoopManager(config);
	}
	return globalRalphLoopManager;
}

/**
 * Reset global manager (for testing)
 */
export function resetRalphLoopManager(): void {
	globalRalphLoopManager = null;
}
