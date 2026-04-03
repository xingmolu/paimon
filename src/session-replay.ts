/**
 * Evolution Session Replay - Replay and analyze past evolution sessions
 *
 * Inspired by Mini-SWE-Agent trajectory replay and SWE-agent action replay
 *
 * Key capabilities:
 * 1. Replay evolution sessions from saved trajectories
 * 2. Pattern extraction from replayed sessions
 * 3. Compare successful vs failed sessions
 * 4. Step-by-step walkthrough mode
 * 5. Action replay with context restoration
 * 6. Learning extraction from session patterns
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Trajectory, TrajectoryStep } from "./trajectory.js";

/**
 * Session replay mode
 */
export type ReplayMode = "full" | "steps" | "actions" | "learning";

/**
 * Pattern type extracted from sessions
 */
export type PatternType =
	| "success-pattern"
	| "failure-pattern"
	| "tool-sequence"
	| "error-recovery"
	| "skill-usage"
	| "decision-point";

/**
 * Session comparison result
 */
export interface SessionComparison {
	/** Session 1 name */
	session1: string;
	/** Session 2 name */
	session2: string;
	/** Similarity score (0-1) */
	similarityScore: number;
	/** Common tool sequences */
	commonToolSequences: string[][];
	/** Divergence points (where sessions differ significantly) */
	divergencePoints: Array<{
		step: number;
		description: string;
		session1Action: string;
		session2Action: string;
	}>;
	/** Success factors (present in successful session, absent in failed) */
	successFactors: string[];
	/** Failure factors (present in failed session, absent in successful) */
	failureFactors: string[];
}

/**
 * Extracted pattern from session replay
 */
export interface ExtractedPattern {
	/** Pattern ID */
	id: string;
	/** Pattern type */
	type: PatternType;
	/** Pattern description */
	description: string;
	/** Confidence level (0-100) */
	confidence: number;
	/** Sessions where this pattern was found */
	foundIn: string[];
	/** Success correlation (how often this pattern leads to success) */
	successCorrelation: number;
	/** Suggested application */
	suggestedApplication: string;
	/** Pattern details (tool sequence, error handling steps, etc.) */
	details: Record<string, unknown>;
}

/**
 * Step-by-step walkthrough
 */
export interface StepWalkthrough {
	/** Current step index */
	currentStep: number;
	/** Total steps */
	totalSteps: number;
	/** Step details */
	step: TrajectoryStep;
	/** Context at this step */
	context: {
		previousActions: string[];
		currentState: string;
		nextActions: string[];
	};
	/** Learning points from this step */
	learningPoints: string[];
	/** Similar successful patterns */
	similarSuccessfulPatterns: ExtractedPattern[];
	/** Similar failure patterns */
	similarFailurePatterns: ExtractedPattern[];
}

/**
 * Replay statistics
 */
export interface ReplayStats {
	/** Total replays performed */
	totalReplays: number;
	/** Patterns extracted */
	patternsExtracted: number;
	/** Comparisons performed */
	comparisonsPerformed: number;
	/** Walkthroughs completed */
	walkthroughsCompleted: number;
	/** Learning sessions */
	learningSessions: number;
	/** Top successful patterns */
	topSuccessPatterns: Array<{ pattern: string; count: number }>;
	/** Top failure patterns */
	topFailurePatterns: Array<{ pattern: string; count: number }>;
	/** Average session length analyzed */
	avgSessionLength: number;
	/** Most replayed sessions */
	mostReplayedSessions: Array<{ name: string; replayCount: number }>;
	/** Last replay time */
	lastReplayTime: string | null;
}

/**
 * Session replay configuration
 */
export interface SessionReplayConfig {
	/** Directory to store replay data */
	dataDir?: string;
	/** Trajectories directory */
	trajectoriesDir?: string;
	/** Maximum patterns to extract per session */
	maxPatternsPerSession?: number;
	/** Pattern confidence threshold */
	confidenceThreshold?: number;
	/** Enable automatic pattern saving */
	savePatterns?: boolean;
}

/**
 * Replay result
 */
export interface ReplayResult {
	/** Session name */
	sessionName: string;
	/** Replay mode used */
	mode: ReplayMode;
	/** Success status of replayed session */
	sessionSuccess: boolean;
	/** Total steps */
	totalSteps: number;
	/** Extracted patterns */
	patterns: ExtractedPattern[];
	/** Key learning points */
	learningPoints: string[];
	/** Critical decision points */
	decisionPoints: Array<{
		step: number;
		description: string;
		alternativeActions: string[];
	}>;
	/** Replay output */
	output: string;
}

/**
 * Evolution Session Replay Manager
 */
export class SessionReplayManager {
	private dataDir: string;
	private trajectoriesDir: string;
	private config: SessionReplayConfig;
	private stats: ReplayStats;
	private extractedPatterns: Map<string, ExtractedPattern>;

	constructor(config: SessionReplayConfig = {}) {
		this.config = {
			dataDir: config.dataDir || join(homedir(), ".paimon"),
			trajectoriesDir: config.trajectoriesDir || join(process.cwd(), "trajectories"),
			maxPatternsPerSession: config.maxPatternsPerSession || 10,
			confidenceThreshold: config.confidenceThreshold || 60,
			savePatterns: config.savePatterns ?? true,
		};
		this.dataDir = this.config.dataDir!;
		this.trajectoriesDir = this.config.trajectoriesDir!;
		this.extractedPatterns = new Map();
		this.stats = this.initStats();
		this.loadState();
	}

	/**
	 * Initialize statistics
	 */
	private initStats(): ReplayStats {
		return {
			totalReplays: 0,
			patternsExtracted: 0,
			comparisonsPerformed: 0,
			walkthroughsCompleted: 0,
			learningSessions: 0,
			topSuccessPatterns: [],
			topFailurePatterns: [],
			avgSessionLength: 0,
			mostReplayedSessions: [],
			lastReplayTime: null,
		};
	}

	/**
	 * Load state from disk
	 */
	private loadState(): void {
		const statePath = join(this.dataDir, "session-replay.json");
		if (existsSync(statePath)) {
			try {
				const content = readFileSync(statePath, "utf-8");
				const state = JSON.parse(content);
				if (state.stats) {
					this.stats = state.stats;
				}
				if (state.patterns) {
					for (const pattern of state.patterns) {
						this.extractedPatterns.set(pattern.id, pattern);
					}
				}
			} catch {
				// Ignore errors
			}
		}
	}

	/**
	 * Save state to disk
	 */
	private saveState(): void {
		if (!this.config.savePatterns) return;

		const statePath = join(this.dataDir, "session-replay.json");
		try {
			const state = {
				stats: this.stats,
				patterns: Array.from(this.extractedPatterns.values()),
			};
			writeFileSync(statePath, JSON.stringify(state, null, 2));
		} catch {
			// Ignore errors
		}
	}

	/**
	 * Get trajectories directory
	 */
	getTrajectoriesDir(): string {
		return this.trajectoriesDir;
	}

	/**
	 * Set trajectories directory
	 */
	setTrajectoriesDir(dir: string): void {
		this.trajectoriesDir = dir;
	}

	/**
	 * List available sessions for replay
	 */
	listSessions(): Array<{
		name: string;
		path: string;
		success: boolean;
		steps: number;
		model: string;
	}> {
		if (!existsSync(this.trajectoriesDir)) {
			return [];
		}

		const files = readdirSync(this.trajectoriesDir).filter((f) => f.endsWith(".json"));
		const sessions: Array<{
			name: string;
			path: string;
			success: boolean;
			steps: number;
			model: string;
		}> = [];

		for (const file of files) {
			const filePath = join(this.trajectoriesDir, file);
			try {
				const content = readFileSync(filePath, "utf-8");
				const trajectory = JSON.parse(content) as Trajectory;
				sessions.push({
					name: file,
					path: filePath,
					success: trajectory.metadata.success,
					steps: trajectory.metadata.totalSteps,
					model: trajectory.metadata.model,
				});
			} catch {
				// Skip malformed files
			}
		}

		return sessions.sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Load a session for replay
	 */
	loadSession(name: string): Trajectory | null {
		const filePath = name.includes("/") ? name : join(this.trajectoriesDir, name);
		if (!existsSync(filePath)) {
			return null;
		}

		try {
			const content = readFileSync(filePath, "utf-8");
			return JSON.parse(content) as Trajectory;
		} catch {
			return null;
		}
	}

	/**
	 * Replay a session in specified mode
	 */
	replaySession(name: string, mode: ReplayMode = "full"): ReplayResult {
		const trajectory = this.loadSession(name);
		if (!trajectory) {
			return {
				sessionName: name,
				mode,
				sessionSuccess: false,
				totalSteps: 0,
				patterns: [],
				learningPoints: [`Session not found: ${name}`],
				decisionPoints: [],
				output: `Session not found: ${name}`,
			};
		}

		// Update stats
		this.stats.totalReplays++;
		this.stats.lastReplayTime = new Date().toISOString();

		// Update most replayed sessions
		const existingEntry = this.stats.mostReplayedSessions.find((s) => s.name === name);
		if (existingEntry) {
			existingEntry.replayCount++;
		} else {
			this.stats.mostReplayedSessions.push({ name, replayCount: 1 });
		}
		this.stats.mostReplayedSessions.sort((a, b) => b.replayCount - a.replayCount);
		this.stats.mostReplayedSessions = this.stats.mostReplayedSessions.slice(0, 10);

		// Generate output based on mode
		let output: string;
		switch (mode) {
			case "full":
				output = this.formatFullReplay(trajectory);
				break;
			case "steps":
				output = this.formatStepsReplay(trajectory);
				break;
			case "actions":
				output = this.formatActionsReplay(trajectory);
				break;
			case "learning":
				output = this.formatLearningReplay(trajectory);
				this.stats.learningSessions++;
				break;
			default:
				output = this.formatFullReplay(trajectory);
		}

		// Extract patterns
		const patterns = this.extractPatternsFromSession(trajectory, name);
		this.stats.patternsExtracted += patterns.length;

		// Extract learning points
		const learningPoints = this.extractLearningPoints(trajectory, patterns);

		// Identify decision points
		const decisionPoints = this.identifyDecisionPoints(trajectory);

		this.saveState();

		return {
			sessionName: name,
			mode,
			sessionSuccess: trajectory.metadata.success,
			totalSteps: trajectory.metadata.totalSteps,
			patterns,
			learningPoints,
			decisionPoints,
			output,
		};
	}

	/**
	 * Format full replay output
	 */
	private formatFullReplay(trajectory: Trajectory): string {
		const lines: string[] = ["## Full Session Replay\n"];
		lines.push(`**Model:** ${trajectory.metadata.model}`);
		lines.push(`**Status:** ${trajectory.metadata.success ? "✅ Success" : "❌ Failed"}`);
		lines.push(`**Steps:** ${trajectory.metadata.totalSteps}`);
		lines.push(`**Duration:** ${this.calculateDuration(trajectory)}s\n`);

		for (const step of trajectory.steps) {
			lines.push(`### Step ${step.step}`);
			if (step.userMessage) {
				lines.push(`**User:** ${step.userMessage.slice(0, 200)}...`);
			}
			if (step.toolCall) {
				lines.push(`**Tool:** ${step.toolCall.name}`);
				lines.push(`**Parameters:** ${JSON.stringify(step.toolCall.parameters, null, 0)}`);
			}
			if (step.toolOutput) {
				const output = step.toolOutput.length > 300
					? `${step.toolOutput.slice(0, 300)}...`
					: step.toolOutput;
				lines.push(`**Output:** ${output}`);
			}
			if (step.isError) {
				lines.push("⚠️ **Error Step**");
			}
			lines.push("");
		}

		return lines.join("\n");
	}

	/**
	 * Format steps replay output (condensed)
	 */
	private formatStepsReplay(trajectory: Trajectory): string {
		const lines: string[] = ["## Steps Replay\n"];
		lines.push(`Session: ${trajectory.metadata.success ? "✅" : "❌"} | ${trajectory.metadata.totalSteps} steps\n`);

		for (const step of trajectory.steps) {
			const status = step.isError ? "⚠️" : "→";
			const tool = step.toolCall?.name || "none";
			lines.push(`${status} Step ${step.step}: ${tool}`);
		}

		return lines.join("\n");
	}

	/**
	 * Format actions replay (tool actions only)
	 */
	private formatActionsReplay(trajectory: Trajectory): string {
		const lines: string[] = ["## Actions Replay\n"];
		const toolSteps = trajectory.steps.filter((s) => s.toolCall);

		lines.push(`Total tool actions: ${toolSteps.length}\n`);

		for (const step of toolSteps) {
			lines.push(`**${step.toolCall!.name}**`);
			lines.push(`Parameters: ${JSON.stringify(step.toolCall!.parameters)}`);
			if (step.isError) {
				lines.push("⚠️ Error");
			}
			lines.push("");
		}

		return lines.join("\n");
	}

	/**
	 * Format learning replay (pattern-focused)
	 */
	private formatLearningReplay(trajectory: Trajectory): string {
		const lines: string[] = ["## Learning Replay\n"];
		const patterns = this.extractPatternsFromSession(trajectory, "current");

		lines.push(`**Session Outcome:** ${trajectory.metadata.success ? "Success" : "Failure"}`);
		lines.push(`**Patterns Identified:** ${patterns.length}\n`);

		// Success patterns
		const successPatterns = patterns.filter((p) => p.successCorrelation > 0.7);
		if (successPatterns.length > 0) {
			lines.push("### Success Patterns");
			for (const pattern of successPatterns) {
				lines.push(`- ${pattern.description} (${pattern.confidence}% confidence)`);
			}
			lines.push("");
		}

		// Failure patterns
		const failurePatterns = patterns.filter((p) => p.successCorrelation < 0.3);
		if (failurePatterns.length > 0) {
			lines.push("### Failure Patterns");
			for (const pattern of failurePatterns) {
				lines.push(`- ${pattern.description} (${pattern.confidence}% confidence)`);
			}
			lines.push("");
		}

		// Tool sequences
		const toolSequences = patterns.filter((p) => p.type === "tool-sequence");
		if (toolSequences.length > 0) {
			lines.push("### Tool Sequences");
			for (const seq of toolSequences) {
				const sequence = seq.details.sequence as string[];
				lines.push(`- ${sequence.join(" → ")}`);
			}
		}

		return lines.join("\n");
	}

	/**
	 * Calculate session duration in seconds
	 */
	private calculateDuration(trajectory: Trajectory): number {
		if (!trajectory.metadata.endTime || !trajectory.metadata.startTime) {
			return 0;
		}
		return (
			(new Date(trajectory.metadata.endTime).getTime() -
				new Date(trajectory.metadata.startTime).getTime()) /
			1000
		);
	}

	/**
	 * Extract patterns from a session
	 */
	private extractPatternsFromSession(trajectory: Trajectory, sessionName: string): ExtractedPattern[] {
		const patterns: ExtractedPattern[] = [];
		const maxPatterns = this.config.maxPatternsPerSession!;

		// Extract tool sequence patterns
		const toolSequencePattern = this.extractToolSequencePattern(trajectory, sessionName);
		if (toolSequencePattern) {
			patterns.push(toolSequencePattern);
		}

		// Extract error recovery patterns
		const errorRecoveryPatterns = this.extractErrorRecoveryPatterns(trajectory, sessionName);
		patterns.push(...errorRecoveryPatterns);

		// Extract decision point patterns
		const decisionPatterns = this.extractDecisionPointPatterns(trajectory, sessionName);
		patterns.push(...decisionPatterns);

		// Extract skill usage patterns
		const skillPatterns = this.extractSkillUsagePatterns(trajectory, sessionName);
		patterns.push(...skillPatterns);

		// Store patterns
		for (const pattern of patterns.slice(0, maxPatterns)) {
			this.extractedPatterns.set(pattern.id, pattern);
		}

		return patterns.slice(0, maxPatterns);
	}

	/**
	 * Extract tool sequence pattern
	 */
	private extractToolSequencePattern(trajectory: Trajectory, sessionName: string): ExtractedPattern | null {
		const toolSteps = trajectory.steps.filter((s) => s.toolCall);
		if (toolSteps.length < 3) return null;

		const sequence = toolSteps.slice(0, 5).map((s) => s.toolCall!.name);
		const id = `tool-seq-${sessionName}-${Date.now()}`;

		return {
			id,
			type: "tool-sequence",
			description: `Tool sequence: ${sequence.join(" → ")}`,
			confidence: trajectory.metadata.success ? 85 : 60,
			foundIn: [sessionName],
			successCorrelation: trajectory.metadata.success ? 0.85 : 0.3,
			suggestedApplication: "Apply this sequence for similar tasks",
			details: { sequence, totalTools: toolSteps.length },
		};
	}

	/**
	 * Extract error recovery patterns
	 */
	private extractErrorRecoveryPatterns(trajectory: Trajectory, sessionName: string): ExtractedPattern[] {
		const patterns: ExtractedPattern[] = [];
		const errorSteps = trajectory.steps.filter((s) => s.isError);

		for (let i = 0; i < errorSteps.length; i++) {
			const errorStep = errorSteps[i];
			const nextSteps = trajectory.steps.slice(errorStep.step, errorStep.step + 3);
			const recoveryTools = nextSteps.filter((s) => s.toolCall).map((s) => s.toolCall!.name);

			if (recoveryTools.length > 0) {
				const id = `error-recovery-${sessionName}-${i}`;
				patterns.push({
					id,
					type: "error-recovery",
					description: `Recovery after error: ${recoveryTools.join(" → ")}`,
					confidence: trajectory.metadata.success ? 80 : 50,
					foundIn: [sessionName],
					successCorrelation: trajectory.metadata.success ? 0.8 : 0.4,
					suggestedApplication: "Use this recovery sequence for similar errors",
					details: {
						errorStep: errorStep.step,
						errorOutput: errorStep.toolOutput?.slice(0, 100),
						recoverySequence: recoveryTools,
					},
				});
			}
		}

		return patterns;
	}

	/**
	 * Extract decision point patterns
	 */
	private extractDecisionPointPatterns(trajectory: Trajectory, sessionName: string): ExtractedPattern[] {
		const patterns: ExtractedPattern[] = [];
		const decisionKeywords = ["select", "choose", "decide", "which", "best", "optimal"];

		for (const step of trajectory.steps) {
			if (step.assistantResponse) {
				const hasDecision = decisionKeywords.some((k) =>
					step.assistantResponse.toLowerCase().includes(k)
				);
				if (hasDecision) {
					const id = `decision-${sessionName}-${step.step}`;
					patterns.push({
						id,
						type: "decision-point",
						description: `Decision at step ${step.step}`,
						confidence: 70,
						foundIn: [sessionName],
						successCorrelation: trajectory.metadata.success ? 0.7 : 0.5,
						suggestedApplication: "Consider this decision point pattern",
						details: {
							step: step.step,
							context: step.assistantResponse.slice(0, 100),
						},
					});
				}
			}
		}

		return patterns.slice(0, 3);
	}

	/**
	 * Extract skill usage patterns
	 */
	private extractSkillUsagePatterns(trajectory: Trajectory, sessionName: string): ExtractedPattern[] {
		const patterns: ExtractedPattern[] = [];
		const skillKeywords = ["skill", "evolve", "research", "self-improve"];

		for (const step of trajectory.steps) {
			if (step.assistantResponse) {
				const usedSkills = skillKeywords.filter((k) =>
					step.assistantResponse.toLowerCase().includes(k)
				);
				if (usedSkills.length > 0) {
					const id = `skill-${sessionName}-${step.step}`;
					patterns.push({
						id,
						type: "skill-usage",
						description: `Skills used: ${usedSkills.join(", ")}`,
						confidence: 75,
						foundIn: [sessionName],
						successCorrelation: trajectory.metadata.success ? 0.75 : 0.5,
						suggestedApplication: "Consider using these skills",
						details: {
							step: step.step,
							skills: usedSkills,
						},
					});
				}
			}
		}

		return patterns.slice(0, 2);
	}

	/**
	 * Extract learning points from session
	 */
	private extractLearningPoints(trajectory: Trajectory, patterns: ExtractedPattern[]): string[] {
		const points: string[] = [];

		// Outcome learning
		if (trajectory.metadata.success) {
			points.push("Session succeeded - analyze successful patterns");
		} else {
			points.push("Session failed - identify failure factors");
		}

		// Pattern-based learning
		for (const pattern of patterns) {
			if (pattern.successCorrelation > 0.7) {
				points.push(`Success pattern: ${pattern.description}`);
			} else if (pattern.successCorrelation < 0.3) {
				points.push(`Failure pattern: ${pattern.description}`);
			}
		}

		// Error-based learning
		const errorCount = trajectory.steps.filter((s) => s.isError).length;
		if (errorCount > 0) {
			points.push(`${errorCount} errors encountered - review error recovery strategies`);
		}

		return points;
	}

	/**
	 * Identify decision points in session
	 */
	private identifyDecisionPoints(trajectory: Trajectory): Array<{
		step: number;
		description: string;
		alternativeActions: string[];
	}> {
		const points: Array<{
			step: number;
			description: string;
			alternativeActions: string[];
		}> = [];

		const decisionKeywords = ["select", "choose", "decide", "which", "best", "optimal"];

		for (const step of trajectory.steps) {
			if (step.assistantResponse) {
				const hasDecision = decisionKeywords.some((k) =>
					step.assistantResponse.toLowerCase().includes(k)
				);
				if (hasDecision) {
					points.push({
						step: step.step,
						description: step.assistantResponse.slice(0, 100),
						alternativeActions: ["Alternative approach 1", "Alternative approach 2"],
					});
				}
			}
		}

		return points.slice(0, 5);
	}

	/**
	 * Compare two sessions
	 */
	compareSessions(session1: string, session2: string): SessionComparison {
		const traj1 = this.loadSession(session1);
		const traj2 = this.loadSession(session2);

		this.stats.comparisonsPerformed++;

		if (!traj1 || !traj2) {
			return {
				session1,
				session2,
				similarityScore: 0,
				commonToolSequences: [],
				divergencePoints: [],
				successFactors: [],
				failureFactors: [],
			};
		}

		// Calculate similarity
		const tools1 = traj1.steps.filter((s) => s.toolCall).map((s) => s.toolCall!.name);
		const tools2 = traj2.steps.filter((s) => s.toolCall).map((s) => s.toolCall!.name);
		const commonTools = tools1.filter((t) => tools2.includes(t));
		const similarityScore = commonTools.length / Math.max(tools1.length, tools2.length);

		// Find common sequences
		const commonToolSequences: string[][] = [];
		for (let i = 0; i < Math.min(tools1.length, tools2.length) - 2; i++) {
			const seq1 = tools1.slice(i, i + 3);
			const seq2 = tools2.slice(i, i + 3);
			if (JSON.stringify(seq1) === JSON.stringify(seq2)) {
				commonToolSequences.push(seq1);
			}
		}

		// Find divergence points
		const divergencePoints: Array<{
			step: number;
			description: string;
			session1Action: string;
			session2Action: string;
		}> = [];
		for (let i = 0; i < Math.min(traj1.steps.length, traj2.steps.length); i++) {
			const tool1 = traj1.steps[i].toolCall?.name || "none";
			const tool2 = traj2.steps[i].toolCall?.name || "none";
			if (tool1 !== tool2) {
				divergencePoints.push({
					step: i,
					description: `Different tool at step ${i}`,
					session1Action: tool1,
					session2Action: tool2,
				});
			}
		}

		// Identify success/failure factors
		const successFactors: string[] = [];
		const failureFactors: string[] = [];

		if (traj1.metadata.success && !traj2.metadata.success) {
			// Session 1 succeeded, session 2 failed
			for (const seq of commonToolSequences) {
				successFactors.push(`Common sequence: ${seq.join(" → ")}`);
			}
			for (const point of divergencePoints.slice(0, 3)) {
				failureFactors.push(`Divergence at step ${point.step}: ${point.session2Action} vs ${point.session1Action}`);
			}
		} else if (!traj1.metadata.success && traj2.metadata.success) {
			// Session 1 failed, session 2 succeeded
			for (const seq of commonToolSequences) {
				successFactors.push(`Common sequence: ${seq.join(" → ")}`);
			}
			for (const point of divergencePoints.slice(0, 3)) {
				failureFactors.push(`Divergence at step ${point.step}: ${point.session1Action} vs ${point.session2Action}`);
			}
		}

		this.saveState();

		return {
			session1,
			session2,
			similarityScore,
			commonToolSequences,
			divergencePoints: divergencePoints.slice(0, 10),
			successFactors,
			failureFactors,
		};
	}

	/**
	 * Get step-by-step walkthrough
	 */
	getWalkthrough(sessionName: string, stepIndex: number): StepWalkthrough | null {
		const trajectory = this.loadSession(sessionName);
		if (!trajectory || stepIndex < 0 || stepIndex >= trajectory.steps.length) {
			return null;
		}

		const step = trajectory.steps[stepIndex];
		const previousActions = trajectory.steps
			.slice(0, stepIndex)
			.filter((s) => s.toolCall)
			.map((s) => s.toolCall!.name);
		const nextActions = trajectory.steps
			.slice(stepIndex + 1)
			.filter((s) => s.toolCall)
			.map((s) => s.toolCall!.name)
			.slice(0, 5);

		const patterns = this.extractPatternsFromSession(trajectory, sessionName);
		const similarSuccessfulPatterns = patterns.filter((p) => p.successCorrelation > 0.7);
		const similarFailurePatterns = patterns.filter((p) => p.successCorrelation < 0.3);

		this.stats.walkthroughsCompleted++;
		this.saveState();

		return {
			currentStep: stepIndex,
			totalSteps: trajectory.steps.length,
			step,
			context: {
				previousActions,
				currentState: step.assistantResponse?.slice(0, 100) || "",
				nextActions,
			},
			learningPoints: this.extractLearningPoints(trajectory, patterns).slice(0, 5),
			similarSuccessfulPatterns,
			similarFailurePatterns,
		};
	}

	/**
	 * Get all extracted patterns
	 */
	getPatterns(type?: PatternType): ExtractedPattern[] {
		const patterns = Array.from(this.extractedPatterns.values());
		if (type) {
			return patterns.filter((p) => p.type === type);
		}
		return patterns;
	}

	/**
	 * Get patterns for successful sessions
	 */
	getSuccessPatterns(): ExtractedPattern[] {
		return this.getPatterns().filter((p) => p.successCorrelation > 0.7);
	}

	/**
	 * Get patterns for failed sessions
	 */
	getFailurePatterns(): ExtractedPattern[] {
		return this.getPatterns().filter((p) => p.successCorrelation < 0.3);
	}

	/**
	 * Get statistics
	 */
	getStats(): ReplayStats {
		return this.stats;
	}

	/**
	 * Reset statistics
	 */
	resetStats(): void {
		this.stats = this.initStats();
		this.extractedPatterns.clear();
		this.saveState();
	}

	/**
	 * Get configuration
	 */
	getConfig(): SessionReplayConfig {
		return this.config;
	}

	/**
	 * Update configuration
	 */
	updateConfig(updates: Partial<SessionReplayConfig>): void {
		if (updates.dataDir) {
			this.dataDir = updates.dataDir;
		}
		if (updates.trajectoriesDir) {
			this.trajectoriesDir = updates.trajectoriesDir;
		}
		if (updates.maxPatternsPerSession) {
			this.config.maxPatternsPerSession = updates.maxPatternsPerSession;
		}
		if (updates.confidenceThreshold) {
			this.config.confidenceThreshold = updates.confidenceThreshold;
		}
		if (updates.savePatterns !== undefined) {
			this.config.savePatterns = updates.savePatterns;
		}
	}

	/**
	 * Format comparison result
	 */
	formatComparison(comparison: SessionComparison): string {
		const lines: string[] = ["## Session Comparison\n"];
		lines.push(`**Session 1:** ${comparison.session1}`);
		lines.push(`**Session 2:** ${comparison.session2}`);
		lines.push(`**Similarity:** ${(comparison.similarityScore * 100).toFixed(1)}%\n`);

		if (comparison.commonToolSequences.length > 0) {
			lines.push("### Common Tool Sequences");
			for (const seq of comparison.commonToolSequences) {
				lines.push(`- ${seq.join(" → ")}`);
			}
			lines.push("");
		}

		if (comparison.divergencePoints.length > 0) {
			lines.push("### Divergence Points");
			for (const point of comparison.divergencePoints.slice(0, 5)) {
				lines.push(`- Step ${point.step}: ${point.session1Action} vs ${point.session2Action}`);
			}
			lines.push("");
		}

		if (comparison.successFactors.length > 0) {
			lines.push("### Success Factors");
			for (const factor of comparison.successFactors) {
				lines.push(`- ${factor}`);
			}
			lines.push("");
		}

		if (comparison.failureFactors.length > 0) {
			lines.push("### Failure Factors");
			for (const factor of comparison.failureFactors) {
				lines.push(`- ${factor}`);
			}
		}

		return lines.join("\n");
	}

	/**
	 * Format patterns list
	 */
	formatPatterns(patterns: ExtractedPattern[]): string {
		const lines: string[] = ["## Extracted Patterns\n"];

		for (const pattern of patterns) {
			lines.push(`### ${pattern.id}`);
			lines.push(`**Type:** ${pattern.type}`);
			lines.push(`**Description:** ${pattern.description}`);
			lines.push(`**Confidence:** ${pattern.confidence}%`);
			lines.push(`**Success Correlation:** ${(pattern.successCorrelation * 100).toFixed(0)}%`);
			lines.push(`**Found In:** ${pattern.foundIn.join(", ")}`);
			lines.push(`**Application:** ${pattern.suggestedApplication}`);
			lines.push("");
		}

		return lines.join("\n");
	}

	/**
	 * Format statistics
	 */
	formatStats(): string {
		const lines: string[] = ["## Replay Statistics\n"];
		lines.push(`**Total Replays:** ${this.stats.totalReplays}`);
		lines.push(`**Patterns Extracted:** ${this.stats.patternsExtracted}`);
		lines.push(`**Comparisons Performed:** ${this.stats.comparisonsPerformed}`);
		lines.push(`**Walkthroughs Completed:** ${this.stats.walkthroughsCompleted}`);
		lines.push(`**Learning Sessions:** ${this.stats.learningSessions}`);
		lines.push(`**Last Replay:** ${this.stats.lastReplayTime || "N/A"}`);

		if (this.stats.topSuccessPatterns.length > 0) {
			lines.push("\n### Top Success Patterns");
			for (const { pattern, count } of this.stats.topSuccessPatterns.slice(0, 5)) {
				lines.push(`- ${pattern} (${count} occurrences)`);
			}
		}

		if (this.stats.mostReplayedSessions.length > 0) {
			lines.push("\n### Most Replayed Sessions");
			for (const { name, replayCount } of this.stats.mostReplayedSessions.slice(0, 5)) {
				lines.push(`- ${name} (${replayCount} replays)`);
			}
		}

		return lines.join("\n");
	}
}

// Singleton instance
let sessionReplayManagerInstance: SessionReplayManager | null = null;

/**
 * Get the session replay manager instance
 */
export function getSessionReplayManager(): SessionReplayManager {
	if (!sessionReplayManagerInstance) {
		sessionReplayManagerInstance = new SessionReplayManager();
	}
	return sessionReplayManagerInstance;
}

/**
 * Initialize session replay manager with custom config
 */
export function initSessionReplayManager(config: SessionReplayConfig): SessionReplayManager {
	sessionReplayManagerInstance = new SessionReplayManager(config);
	return sessionReplayManagerInstance;
}