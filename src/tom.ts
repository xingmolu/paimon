/**
 * Theory-of-Mind Module (ToM) for personalized user understanding.
 *
 * Inspired by OpenHands' ToM-SWE package, this module provides:
 * - Three-Tier Memory: sessions → analyses → profiles
 * - Agent Consultation: Personalized guidance based on user understanding
 * - User Behavior Analysis: Insights from past evolution sessions
 *
 * This helps reduce rework rate by understanding user intent better
 * and improves first try success rate through better context.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

/**
 * User profile containing preferences and working styles.
 */
export interface UserProfile {
	id: string;
	project: string;
	preferences: {
		// Task selection preferences
		preferredTaskTypes: string[]; // capability, reliability, feature
		skillsUsedSuccess: string[]; // Skills that led to success
		skillsUsedFailure: string[]; // Skills that didn't help

		// Working style preferences
		averageIterationTime: number; // Average time per iteration (minutes)
		preferredImplementationStyle: string; // minimal, thorough, exploratory

		// Error patterns
		commonErrors: string[]; // Most frequent error types
		recoveryPatterns: string[]; // How errors were recovered
	};
	analyses: SessionAnalysis[];
	lastUpdated: number;
}

/**
 * Analysis of a single session.
 */
export interface SessionAnalysis {
	sessionId: string;
	date: string;

	// Task info
	taskType: string;
	taskDescription: string;

	// Outcome
	success: boolean;
	firstTry: boolean;
	errors: string[];
	rework: boolean;

	// Process
	timeMinutes: number;
	skillsUsed: string[];

	// Insights extracted
	insights: string[];
	patterns: string[];
}

/**
 * Consultation result providing personalized guidance.
 */
export interface ConsultationResult {
	// Recommended approach
	recommendedTaskType: string;
	recommendedSkills: string[];

	// Warnings based on past failures
	potentialIssues: string[];

	// Personalized tips
	tips: string[];

	// Confidence level
	confidence: number;

	// Profile summary
	profileSummary: string;
}

/**
 * Find the git root directory for the current project.
 */
function findGitRoot(dir: string = process.cwd()): string | null {
	try {
		const gitDir = execSync("git rev-parse --show-toplevel", {
			cwd: dir,
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		}).trim();
		return gitDir || null;
	} catch {
		return null;
	}
}

/**
 * Get the project name.
 */
function getProjectName(): string {
	const gitRoot = findGitRoot();
	if (gitRoot) {
		return basename(gitRoot);
	}
	return basename(process.cwd());
}

/**
 * Generate a unique ID.
 */
export function generateId(): string {
	return `tom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Theory-of-Mind module for personalized user understanding.
 */
export class TomModule {
	private tomDir: string;
	private projectName: string;
	private profile: UserProfile | null = null;

	constructor(baseDir: string = join(homedir(), ".paimon", "tom")) {
		this.tomDir = baseDir;
		this.projectName = getProjectName();
		this.loadProfile();
	}

	/**
	 * Load the user profile from disk.
	 */
	private loadProfile(): void {
		const profilePath = this.getProfilePath();
		if (existsSync(profilePath)) {
			try {
				const content = readFileSync(profilePath, "utf-8");
				this.profile = JSON.parse(content) as UserProfile;
			} catch {
				this.profile = null;
			}
		}
	}

	/**
	 * Save the user profile to disk.
	 */
	private saveProfile(): void {
		if (!this.profile) return;

		const profilePath = this.getProfilePath();
		this.ensureDir(join(this.tomDir, "profiles"));

		this.profile.lastUpdated = Date.now();
		writeFileSync(profilePath, JSON.stringify(this.profile, null, 2), "utf-8");
	}

	/**
	 * Get the profile file path.
	 */
	private getProfilePath(): string {
		return join(this.tomDir, "profiles", `${this.projectName}-profile.json`);
	}

	/**
	 * Get the analyses directory.
	 */
	private getAnalysesDir(): string {
		return join(this.tomDir, "analyses", this.projectName);
	}

	/**
	 * Ensure a directory exists.
	 */
	private ensureDir(dir: string): void {
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
	}

	/**
	 * Initialize a new profile.
	 */
	private initProfile(): UserProfile {
		return {
			id: generateId(),
			project: this.projectName,
			preferences: {
				preferredTaskTypes: ["capability"],
				skillsUsedSuccess: [],
				skillsUsedFailure: [],
				averageIterationTime: 15,
				preferredImplementationStyle: "minimal",
				commonErrors: [],
				recoveryPatterns: [],
			},
			analyses: [],
			lastUpdated: Date.now(),
		};
	}

	/**
	 * Get the current user profile.
	 */
	getProfile(): UserProfile {
		if (!this.profile) {
			this.profile = this.initProfile();
			this.saveProfile();
		}
		return this.profile;
	}

	/**
	 * Analyze a session and extract insights.
	 */
	analyzeSession(sessionData: {
		taskType: string;
		taskDescription: string;
		success: boolean;
		firstTry: boolean;
		errors: string[];
		rework: boolean;
		timeMinutes: number;
		skillsUsed: string[];
	}): SessionAnalysis {
		const analysis: SessionAnalysis = {
			sessionId: generateId(),
			date: new Date().toISOString().split("T")[0],
			taskType: sessionData.taskType,
			taskDescription: sessionData.taskDescription,
			success: sessionData.success,
			firstTry: sessionData.firstTry,
			errors: sessionData.errors,
			rework: sessionData.rework,
			timeMinutes: sessionData.timeMinutes,
			skillsUsed: sessionData.skillsUsed,
			insights: [],
			patterns: [],
		};

		// Extract insights from the session
		if (!sessionData.firstTry && sessionData.errors.length > 0) {
			analysis.insights.push(`First try failed with errors: ${sessionData.errors.join(", ")}`);
		}

		if (sessionData.rework) {
			analysis.insights.push("Rework required - consider better planning");
		}

		if (sessionData.skillsUsed.length > 0 && sessionData.success) {
			analysis.insights.push(`Skills used successfully: ${sessionData.skillsUsed.join(", ")}`);
		}

		// Detect patterns
		if (sessionData.errors.includes("lint")) {
			analysis.patterns.push("lint-error-common");
		}
		if (sessionData.errors.includes("TS")) {
			analysis.patterns.push("typescript-error-common");
		}
		if (sessionData.timeMinutes > 20) {
			analysis.patterns.push("long-iteration");
		}

		// Add analysis to profile
		const profile = this.getProfile();
		profile.analyses.push(analysis);

		// Update preferences based on analysis
		this.updatePreferences(analysis);

		// Save analysis to disk
		this.saveAnalysis(analysis);

		// Save updated profile
		this.saveProfile();

		return analysis;
	}

	/**
	 * Update user preferences based on session analysis.
	 */
	private updatePreferences(analysis: SessionAnalysis): void {
		if (!this.profile) return;

		const prefs = this.profile.preferences;

		// Update skills effectiveness
		if (analysis.success) {
			for (const skill of analysis.skillsUsed) {
				if (!prefs.skillsUsedSuccess.includes(skill)) {
					prefs.skillsUsedSuccess.push(skill);
				}
			}
		} else {
			for (const skill of analysis.skillsUsed) {
				if (!prefs.skillsUsedFailure.includes(skill)) {
					prefs.skillsUsedFailure.push(skill);
				}
			}
		}

		// Update common errors
		for (const error of analysis.errors) {
			if (!prefs.commonErrors.includes(error)) {
				prefs.commonErrors.push(error);
			}
		}

		// Update average iteration time
		const times = this.profile.analyses.map((a) => a.timeMinutes);
		if (times.length > 0) {
			prefs.averageIterationTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
		}

		// Update recovery patterns
		if (analysis.rework && analysis.success) {
			prefs.recoveryPatterns.push(`recovered-from-${analysis.errors.join("-")}`);
		}

		// Update preferred task types based on success
		if (analysis.success && !prefs.preferredTaskTypes.includes(analysis.taskType)) {
			prefs.preferredTaskTypes.push(analysis.taskType);
		}
	}

	/**
	 * Save analysis to disk.
	 */
	private saveAnalysis(analysis: SessionAnalysis): void {
		const analysesDir = this.getAnalysesDir();
		this.ensureDir(analysesDir);

		const filename = `${analysis.date}-${analysis.sessionId}.json`;
		const filepath = join(analysesDir, filename);
		writeFileSync(filepath, JSON.stringify(analysis, null, 2), "utf-8");
	}

	/**
	 * Load all past analyses.
	 */
	loadAnalyses(): SessionAnalysis[] {
		const analysesDir = this.getAnalysesDir();
		if (!existsSync(analysesDir)) return [];

		const files = readdirSync(analysesDir)
			.filter((f) => f.endsWith(".json"))
			.sort();

		const analyses: SessionAnalysis[] = [];
		for (const file of files) {
			try {
				const content = readFileSync(join(analysesDir, file), "utf-8");
				analyses.push(JSON.parse(content) as SessionAnalysis);
			} catch {
				// Skip invalid files
			}
		}

		return analyses;
	}

	/**
	 * Provide consultation for the current task.
	 * Returns personalized guidance based on user profile.
	 */
	consult(currentContext?: string): ConsultationResult {
		const profile = this.getProfile();
		const prefs = profile.preferences;

		// Determine recommended task type
		const recommendedTaskType = prefs.preferredTaskTypes[0] || "capability";

		// Recommend skills based on success history
		const recommendedSkills = prefs.skillsUsedSuccess.slice(0, 3);

		// Identify potential issues based on past failures
		const potentialIssues: string[] = [];
		if (prefs.commonErrors.includes("lint")) {
			potentialIssues.push("Lint errors are common - consider running lint before assess");
		}
		if (prefs.commonErrors.includes("TS")) {
			potentialIssues.push("TypeScript errors occur - check types before implementation");
		}
		if (prefs.recoveryPatterns.length > 3) {
			potentialIssues.push("Frequent rework detected - improve planning phase");
		}

		// Generate personalized tips
		const tips: string[] = [];
		if (prefs.averageIterationTime > 15) {
			tips.push(
				`Average iteration time is ${prefs.averageIterationTime}min - consider smaller changes`,
			);
		}
		if (prefs.skillsUsedSuccess.length > 0) {
			tips.push(`Skills that work well: ${prefs.skillsUsedSuccess.join(", ")}`);
		}

		// Calculate confidence based on profile depth
		const analysisCount = profile.analyses.length;
		const confidence = Math.min(95, 50 + analysisCount * 5);

		// Generate profile summary
		const profileSummary = this.generateProfileSummary(profile);

		return {
			recommendedTaskType,
			recommendedSkills,
			potentialIssues,
			tips,
			confidence,
			profileSummary,
		};
	}

	/**
	 * Generate a summary of the user profile.
	 */
	private generateProfileSummary(profile: UserProfile): string {
		const prefs = profile.preferences;
		const analyses = profile.analyses;

		// Calculate success rate
		const successes = analyses.filter((a) => a.success).length;
		const total = analyses.length;
		const successRate = total > 0 ? Math.round((successes / total) * 100) : 0;

		// Calculate first try success rate
		const firstTrySuccesses = analyses.filter((a) => a.firstTry && a.success).length;
		const firstTryRate = total > 0 ? Math.round((firstTrySuccesses / total) * 100) : 0;

		return [
			`Profile: ${profile.project}`,
			`Sessions analyzed: ${analyses.length}`,
			`Success rate: ${successRate}%`,
			`First try success: ${firstTryRate}%`,
			`Average time: ${prefs.averageIterationTime}min`,
			`Preferred skills: ${prefs.skillsUsedSuccess.slice(0, 3).join(", ") || "none"}`,
			`Common errors: ${prefs.commonErrors.slice(0, 3).join(", ") || "none"}`,
		].join("\n");
	}

	/**
	 * Get statistics from the profile.
	 */
	getStats(): {
		totalSessions: number;
		successRate: number;
		firstTryRate: number;
		reworkRate: number;
		averageTime: number;
		topSkills: string[];
		topErrors: string[];
	} {
		const profile = this.getProfile();
		const analyses = profile.analyses;
		const prefs = profile.preferences;

		const total = analyses.length;
		const successes = analyses.filter((a) => a.success).length;
		const firstTrySuccesses = analyses.filter((a) => a.firstTry).length;
		const reworks = analyses.filter((a) => a.rework).length;

		return {
			totalSessions: total,
			successRate: total > 0 ? Math.round((successes / total) * 100) : 0,
			firstTryRate: total > 0 ? Math.round((firstTrySuccesses / total) * 100) : 0,
			reworkRate: total > 0 ? Math.round((reworks / total) * 100) : 0,
			averageTime: prefs.averageIterationTime,
			topSkills: prefs.skillsUsedSuccess.slice(0, 5),
			topErrors: prefs.commonErrors.slice(0, 5),
		};
	}

	/**
	 * Clear the profile (for testing).
	 */
	clear(): void {
		this.profile = null;
	}
}

/**
 * Format consultation result for display.
 */
export function formatConsultation(result: ConsultationResult): string {
	const lines = [
		"🧠 Theory-of-Mind Consultation",
		"─".repeat(40),
		`Confidence: ${result.confidence}%`,
		"",
		"📋 Recommendations:",
		`  Task type: ${result.recommendedTaskType}`,
		`  Skills: ${result.recommendedSkills.join(", ") || "none"}`,
		"",
		"⚠️ Potential Issues:",
		...result.potentialIssues.map((i) => `  - ${i}`),
		"",
		"💡 Tips:",
		...result.tips.map((t) => `  - ${t}`),
		"",
		"📊 Profile Summary:",
		...result.profileSummary.split("\n").map((l) => `  ${l}`),
	];

	return lines.join("\n");
}

/**
 * Format stats for display.
 */
export function formatStats(stats: ReturnType<TomModule["getStats"]>): string {
	return [
		"📊 Theory-of-Mind Statistics",
		"─".repeat(40),
		`Sessions analyzed: ${stats.totalSessions}`,
		`Success rate: ${stats.successRate}%`,
		`First try success: ${stats.firstTryRate}%`,
		`Rework rate: ${stats.reworkRate}%`,
		`Average time: ${stats.averageTime}min`,
		`Top skills: ${stats.topSkills.join(", ") || "none"}`,
		`Common errors: ${stats.topErrors.join(", ") || "none"}`,
	].join("\n");
}
