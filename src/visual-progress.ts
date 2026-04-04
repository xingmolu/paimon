/**
 * Visual Progress Manager (Devin Pattern)
 *
 * Provides real-time progress visualization during evolution iterations.
 * Shows progress bars, phase tracking, and time estimates based on historical patterns.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** Progress phase types */
export type ProgressPhase =
	| "context-gathering"
	| "task-selection"
	| "planning"
	| "implementation"
	| "verification"
	| "completion";

/** Progress step status */
export type StepStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped";

/** Individual progress step */
export interface ProgressStep {
	id: string;
	description: string;
	status: StepStatus;
	startTime?: string;
	endTime?: string;
	estimatedDuration?: number; // in seconds
	actualDuration?: number; // in seconds
	toolsUsed?: string[];
	errorMessage?: string;
}

/** Progress session */
export interface ProgressSession {
	sessionId: string;
	taskType: "capability" | "reliability" | "feature";
	taskDescription: string;
	currentPhase: ProgressPhase;
	steps: ProgressStep[];
	totalSteps: number;
	completedSteps: number;
	startTime: string;
	lastUpdateTime: string;
	estimatedTotalDuration?: number; // in seconds
	estimatedRemaining?: number; // in seconds
	progressPercentage: number;
	status: "active" | "completed" | "failed" | "paused";
}

/** Historical timing data for estimation */
export interface HistoricalTiming {
	taskType: "capability" | "reliability" | "feature";
	phase: ProgressPhase;
	averageDuration: number; // in seconds
	minDuration: number;
	maxDuration: number;
	sampleCount: number;
	lastUpdated: string;
}

/** Visual progress configuration */
export interface VisualProgressConfig {
	/** Enable progress visualization */
	enabled: boolean;
	/** Show progress bar */
	showProgressBar: boolean;
	/** Show time estimates */
	showTimeEstimates: boolean;
	/** Show tool usage indicators */
	showToolUsage: boolean;
	/** Progress bar width (characters) */
	progressBarWidth: number;
	/** Update interval (ms) */
	updateInterval: number;
	/** Use colors in output */
	useColors: boolean;
	/** Store historical timing for estimation */
	storeHistoricalTiming: boolean;
	/** Auto-track tool usage */
	autoTrackToolUsage: boolean;
}

/** Visual progress statistics */
export interface VisualProgressStats {
	sessionsStarted: number;
	sessionsCompleted: number;
	sessionsFailed: number;
	totalDurationMs: number;
	averageDurationMs: number;
	stepsTracked: number;
	historicalTimingsStored: number;
	lastSessionTime: string;
}

const DEFAULT_CONFIG: VisualProgressConfig = {
	enabled: true,
	showProgressBar: true,
	showTimeEstimates: true,
	showToolUsage: true,
	progressBarWidth: 40,
	updateInterval: 1000,
	useColors: true,
	storeHistoricalTiming: true,
	autoTrackToolUsage: true,
};

const STATE_FILE = path.join(process.env.HOME || "~", ".paimon", "visual-progress.json");
const TIMING_FILE = path.join(process.env.HOME || "~", ".paimon", "progress-timing.json");

/**
 * Visual Progress Manager
 * Manages progress visualization during evolution iterations.
 */
export class VisualProgressManager {
	private config: VisualProgressConfig;
	private currentSession: ProgressSession | null = null;
	private sessions: Map<string, ProgressSession> = new Map();
	private historicalTimings: Map<string, HistoricalTiming> = new Map();
	private stats: VisualProgressStats = {
		sessionsStarted: 0,
		sessionsCompleted: 0,
		sessionsFailed: 0,
		totalDurationMs: 0,
		averageDurationMs: 0,
		stepsTracked: 0,
		historicalTimingsStored: 0,
		lastSessionTime: "",
	};
	private startTime = 0;

	constructor(config?: Partial<VisualProgressConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.loadState();
		this.loadHistoricalTimings();
	}

	/**
	 * Start a new progress session
	 */
	startSession(
		taskType: "capability" | "reliability" | "feature",
		taskDescription: string,
	): ProgressSession {
		const sessionId = `progress-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
		const now = new Date().toISOString();

		// Get estimated duration from historical data
		const estimatedTotalDuration = this.getEstimatedDuration(taskType);

		this.currentSession = {
			sessionId,
			taskType,
			taskDescription,
			currentPhase: "context-gathering",
			steps: [],
			totalSteps: 0,
			completedSteps: 0,
			startTime: now,
			lastUpdateTime: now,
			estimatedTotalDuration,
			estimatedRemaining: estimatedTotalDuration,
			progressPercentage: 0,
			status: "active",
		};

		this.sessions.set(sessionId, this.currentSession);
		this.startTime = Date.now();
		this.stats.sessionsStarted++;

		this.saveState();
		this.displayProgress();

		return this.currentSession;
	}

	/**
	 * Add a step to the current session
	 */
	addStep(
		description: string,
		estimatedDuration?: number,
		toolsUsed?: string[],
	): ProgressStep | null {
		if (!this.currentSession) return null;

		const stepId = `step-${this.currentSession.steps.length + 1}`;
		const step: ProgressStep = {
			id: stepId,
			description,
			status: "pending",
			estimatedDuration,
			toolsUsed,
		};

		this.currentSession.steps.push(step);
		this.currentSession.totalSteps++;
		this.currentSession.lastUpdateTime = new Date().toISOString();
		this.stats.stepsTracked++;

		this.saveState();
		this.displayProgress();

		return step;
	}

	/**
	 * Update step status
	 */
	updateStep(stepId: string, status: StepStatus, errorMessage?: string): ProgressStep | null {
		if (!this.currentSession) return null;

		const step = this.currentSession.steps.find((s) => s.id === stepId);
		if (!step) return null;

		const now = new Date().toISOString();
		step.status = status;

		if (status === "in_progress" && !step.startTime) {
			step.startTime = now;
		}

		if ((status === "completed" || status === "failed" || status === "skipped") && step.startTime) {
			step.endTime = now;
			step.actualDuration =
				(new Date(step.endTime).getTime() - new Date(step.startTime).getTime()) / 1000;

			// Store historical timing for estimation
			if (status === "completed" && this.config.storeHistoricalTiming) {
				this.storeHistoricalTiming(
					this.currentSession.taskType,
					this.currentSession.currentPhase,
					step.actualDuration,
				);
			}
		}

		if (errorMessage) {
			step.errorMessage = errorMessage;
		}

		// Update counts
		this.currentSession.completedSteps = this.currentSession.steps.filter(
			(s) => s.status === "completed" || s.status === "skipped",
		).length;

		// Update progress percentage
		this.currentSession.progressPercentage = Math.round(
			(this.currentSession.completedSteps / this.currentSession.totalSteps) * 100,
		);

		// Update remaining estimate
		this.updateRemainingEstimate();

		this.currentSession.lastUpdateTime = now;
		this.saveState();
		this.displayProgress();

		return step;
	}

	/**
	 * Set current phase
	 */
	setPhase(phase: ProgressPhase): void {
		if (!this.currentSession) return;

		this.currentSession.currentPhase = phase;
		this.currentSession.lastUpdateTime = new Date().toISOString();
		this.saveState();
		this.displayProgress();
	}

	/**
	 * Record tool usage
	 */
	recordToolUsage(toolName: string): void {
		if (!this.currentSession || !this.config.autoTrackToolUsage) return;

		// Find the current in-progress step
		const currentStep = this.currentSession.steps.find((s) => s.status === "in_progress");
		if (currentStep) {
			if (!currentStep.toolsUsed) {
				currentStep.toolsUsed = [];
			}
			if (!currentStep.toolsUsed.includes(toolName)) {
				currentStep.toolsUsed.push(toolName);
			}
		}

		this.saveState();
	}

	/**
	 * Complete the session
	 */
	completeSession(success: boolean, summary?: string): ProgressSession | null {
		if (!this.currentSession) return null;

		const now = new Date().toISOString();
		const durationMs = Date.now() - this.startTime;

		this.currentSession.status = success ? "completed" : "failed";
		this.currentSession.lastUpdateTime = now;
		this.currentSession.progressPercentage = 100;

		if (success) {
			this.stats.sessionsCompleted++;
		} else {
			this.stats.sessionsFailed++;
		}

		this.stats.totalDurationMs += durationMs;
		this.stats.averageDurationMs = this.stats.totalDurationMs / this.stats.sessionsCompleted;
		this.stats.lastSessionTime = now;

		this.saveState();
		this.saveHistoricalTimings();
		this.displayCompletion(success, summary);

		const completedSession = this.currentSession;
		this.currentSession = null;

		return completedSession;
	}

	/**
	 * Get current session status
	 */
	getCurrentSession(): ProgressSession | null {
		return this.currentSession;
	}

	/**
	 * Get all sessions
	 */
	getSessions(limit?: number): ProgressSession[] {
		const sessions = Array.from(this.sessions.values()).reverse();
		return limit ? sessions.slice(0, limit) : sessions;
	}

	/**
	 * Get session by ID
	 */
	getSession(sessionId: string): ProgressSession | undefined {
		return this.sessions.get(sessionId);
	}

	/**
	 * Get estimated duration for task type
	 */
	getEstimatedDuration(taskType: "capability" | "reliability" | "feature"): number {
		const timings = Array.from(this.historicalTimings.values()).filter(
			(t) => t.taskType === taskType,
		);

		if (timings.length === 0) {
			// Default estimates based on task type
			switch (taskType) {
				case "capability":
					return 900; // 15 minutes
				case "reliability":
					return 600; // 10 minutes
				case "feature":
					return 1200; // 20 minutes
			}
		}

		// Average across all phases for this task type
		const totalAvg = timings.reduce((sum, t) => sum + t.averageDuration, 0);
		return Math.round(totalAvg / timings.length) * 5; // Multiply by ~5 phases
	}

	/**
	 * Get estimated remaining time
	 */
	getEstimatedRemaining(): number {
		if (!this.currentSession) return 0;

		const elapsed = (Date.now() - this.startTime) / 1000;
		const estimated = this.currentSession.estimatedTotalDuration || 900;

		// Use actual progress to refine estimate
		const progressRatio = this.currentSession.progressPercentage / 100;
		const remaining = Math.max(0, estimated - elapsed * progressRatio);

		return Math.round(remaining);
	}

	/**
	 * Get statistics
	 */
	getStats(): VisualProgressStats {
		return { ...this.stats };
	}

	/**
	 * Get configuration
	 */
	getConfig(): VisualProgressConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration
	 */
	updateConfig(updates: Partial<VisualProgressConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveState();
	}

	/**
	 * Reset statistics
	 */
	resetStats(): void {
		this.stats = {
			sessionsStarted: 0,
			sessionsCompleted: 0,
			sessionsFailed: 0,
			totalDurationMs: 0,
			averageDurationMs: 0,
			stepsTracked: 0,
			historicalTimingsStored: 0,
			lastSessionTime: "",
		};
		this.historicalTimings.clear();
		this.saveState();
		this.saveHistoricalTimings();
	}

	/**
	 * Clear all sessions
	 */
	clearSessions(): void {
		this.sessions.clear();
		this.currentSession = null;
		this.saveState();
	}

	/**
	 * Format progress for display
	 */
	formatProgress(): string {
		if (!this.currentSession) return "";

		const lines: string[] = [];
		const session = this.currentSession;

		// Header
		lines.push("## Evolution Progress");
		lines.push("");
		lines.push(`**Task:** ${session.taskDescription}`);
		lines.push(`**Type:** ${session.taskType}`);
		lines.push(`**Phase:** ${session.currentPhase}`);
		lines.push("");

		// Progress bar
		if (this.config.showProgressBar) {
			const percentage = session.progressPercentage;
			const filled = Math.round((percentage / 100) * this.config.progressBarWidth);
			const empty = this.config.progressBarWidth - filled;

			const bar = this.config.useColors
				? `[${"█".repeat(filled)}${"░".repeat(empty)}] ${percentage}%`
				: `[${"#".repeat(filled)}${"-".repeat(empty)}] ${percentage}%`;

			lines.push(`Progress: ${bar}`);
			lines.push("");
		}

		// Time estimates
		if (this.config.showTimeEstimates) {
			const elapsed = Math.round((Date.now() - this.startTime) / 1000);
			const remaining = session.estimatedRemaining || this.getEstimatedRemaining();

			lines.push(`**Elapsed:** ${this.formatDuration(elapsed)}`);
			lines.push(`**Remaining:** ~${this.formatDuration(remaining)}`);
			lines.push("");
		}

		// Steps
		lines.push("### Steps");
		lines.push("");

		for (const step of session.steps) {
			const statusIcon = this.getStatusIcon(step.status);
			const duration = step.actualDuration ? ` (${this.formatDuration(step.actualDuration)})` : "";

			lines.push(`${statusIcon} ${step.description}${duration}`);

			if (step.errorMessage) {
				lines.push(`   ⚠️ Error: ${step.errorMessage}`);
			}
		}

		// Pending steps indicator
		const pendingCount = session.steps.filter((s) => s.status === "pending").length;
		if (pendingCount > 0) {
			lines.push(`   ... ${pendingCount} more pending steps`);
		}

		return lines.join("\n");
	}

	/**
	 * Format completion summary
	 */
	formatCompletion(success: boolean, summary?: string): string {
		const lines: string[] = [];

		const icon = success ? "✅" : "❌";
		const status = success ? "Completed successfully" : "Failed";

		lines.push(`## ${icon} Evolution ${status}`);
		lines.push("");

		if (this.currentSession) {
			const duration = Math.round((Date.now() - this.startTime) / 1000);
			lines.push(`**Task:** ${this.currentSession.taskDescription}`);
			lines.push(`**Duration:** ${this.formatDuration(duration)}`);
			lines.push(
				`**Steps:** ${this.currentSession.completedSteps}/${this.currentSession.totalSteps}`,
			);
			lines.push("");
		}

		if (summary) {
			lines.push(summary);
		}

		return lines.join("\n");
	}

	// Private methods

	private displayProgress(): void {
		if (!this.config.enabled) return;
		console.log(this.formatProgress());
	}

	private displayCompletion(success: boolean, summary?: string): void {
		if (!this.config.enabled) return;
		console.log(this.formatCompletion(success, summary));
	}

	private updateRemainingEstimate(): void {
		if (!this.currentSession) return;

		// Calculate remaining based on pending steps
		const pendingSteps = this.currentSession.steps.filter((s) => s.status === "pending");
		let remaining = 0;

		for (const step of pendingSteps) {
			remaining += step.estimatedDuration || this.getStepEstimate(step);
		}

		// Add estimate for in-progress steps
		const inProgressSteps = this.currentSession.steps.filter((s) => s.status === "in_progress");
		for (const step of inProgressSteps) {
			if (step.startTime) {
				const elapsed = (Date.now() - new Date(step.startTime).getTime()) / 1000;
				const estimate = step.estimatedDuration || this.getStepEstimate(step);
				remaining += Math.max(0, estimate - elapsed);
			}
		}

		this.currentSession.estimatedRemaining = Math.round(remaining);
	}

	private getStepEstimate(step: ProgressStep): number {
		// Default estimates based on step type
		if (step.toolsUsed?.includes("build") || step.toolsUsed?.includes("test")) {
			return 30; // 30 seconds for build/test
		}
		if (step.toolsUsed?.includes("edit") || step.toolsUsed?.includes("write")) {
			return 15; // 15 seconds for file operations
		}
		return 20; // Default 20 seconds
	}

	private storeHistoricalTiming(
		taskType: "capability" | "reliability" | "feature",
		phase: ProgressPhase,
		duration: number,
	): void {
		const key = `${taskType}-${phase}`;
		const existing = this.historicalTimings.get(key);

		if (existing) {
			// Update with new sample
			existing.sampleCount++;
			existing.averageDuration =
				(existing.averageDuration * (existing.sampleCount - 1) + duration) / existing.sampleCount;
			existing.minDuration = Math.min(existing.minDuration, duration);
			existing.maxDuration = Math.max(existing.maxDuration, duration);
			existing.lastUpdated = new Date().toISOString();
		} else {
			// Create new entry
			this.historicalTimings.set(key, {
				taskType,
				phase,
				averageDuration: duration,
				minDuration: duration,
				maxDuration: duration,
				sampleCount: 1,
				lastUpdated: new Date().toISOString(),
			});
			this.stats.historicalTimingsStored++;
		}
	}

	private getStatusIcon(status: StepStatus): string {
		switch (status) {
			case "completed":
				return "✅";
			case "in_progress":
				return "🔄";
			case "failed":
				return "❌";
			case "skipped":
				return "⏭️";
			case "pending":
				return "⏳";
		}
	}

	private formatDuration(seconds: number): string {
		if (seconds < 60) {
			return `${seconds}s`;
		}
		const minutes = Math.floor(seconds / 60);
		const secs = seconds % 60;
		if (minutes < 60) {
			return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
		}
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
	}

	private loadState(): void {
		try {
			if (fs.existsSync(STATE_FILE)) {
				const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
				this.sessions = new Map(Object.entries(data.sessions || {}));
				this.stats = data.stats || this.stats;
				this.config = { ...DEFAULT_CONFIG, ...data.config };
			}
		} catch {
			// Ignore errors, use defaults
		}
	}

	private saveState(): void {
		try {
			const dir = path.dirname(STATE_FILE);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}

			const data = {
				sessions: Object.fromEntries(this.sessions),
				stats: this.stats,
				config: this.config,
			};

			fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
		} catch {
			// Ignore errors
		}
	}

	private loadHistoricalTimings(): void {
		try {
			if (fs.existsSync(TIMING_FILE)) {
				const data = JSON.parse(fs.readFileSync(TIMING_FILE, "utf-8"));
				this.historicalTimings = new Map(Object.entries(data));
			}
		} catch {
			// Ignore errors
		}
	}

	private saveHistoricalTimings(): void {
		try {
			const dir = path.dirname(TIMING_FILE);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}

			const data = Object.fromEntries(this.historicalTimings);
			fs.writeFileSync(TIMING_FILE, JSON.stringify(data, null, 2));
		} catch {
			// Ignore errors
		}
	}
}

// Singleton instance
let visualProgressManager: VisualProgressManager | null = null;

/**
 * Get the Visual Progress Manager singleton
 */
export function getVisualProgressManager(
	config?: Partial<VisualProgressConfig>,
): VisualProgressManager {
	if (!visualProgressManager) {
		visualProgressManager = new VisualProgressManager(config);
	}
	return visualProgressManager;
}

/**
 * Reset the Visual Progress Manager (for testing)
 */
export function resetVisualProgressManager(): void {
	visualProgressManager = null;
}
