/**
 * Evolution Pattern Mining Module
 *
 * Mines successful patterns from past evolution sessions to predict optimal approaches.
 * Analyzes MEMORY.md scorecard and session history to extract reusable patterns.
 *
 * Benefits:
 * - Improves task selection by predicting successful approaches
 * - Reduces failure rate by learning from successful patterns
 * - Enhances memory quality by extracting reusable insights
 */

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * A mined evolution pattern
 */
export interface EvolutionPattern {
	id: string;
	type: PatternType;
	description: string;
	// The pattern's key characteristics
	characteristics: PatternCharacteristics;
	// Success metrics
	successRate: number; // 0-100
	firstTryRate: number; // 0-100
	averageTime: number; // minutes
	// Confidence based on sample size
	confidence: number; // 0-100
	sampleSize: number; // number of matching sessions
	// Examples of successful applications
	examples: PatternExample[];
	lastUpdated: string;
}

export type PatternType =
	| "skill-combination" // Skills that work well together
	| "task-type-success" // Task types with high success
	| "time-pattern" // Time patterns for certain tasks
	| "error-avoidance" // Patterns that avoid common errors
	| "approach-pattern"; // General approach patterns

export interface PatternCharacteristics {
	skills?: string[];
	taskType?: string;
	timeRange?: { min: number; max: number };
	errorsAvoided?: string[];
	approach?: string;
}

export interface PatternExample {
	taskDescription: string;
	date: string;
	time: number;
	skillsUsed: string[];
	success: boolean;
	firstTry: boolean;
}

export interface PatternRecommendation {
	pattern: EvolutionPattern;
	reason: string;
	confidence: number;
	suggestedSkills: string[];
	suggestedApproach: string;
	potentialIssues: string[];
}

export interface MiningStats {
	totalPatterns: number;
	byType: Record<string, number>;
	totalSessionsAnalyzed: number;
	averageSuccessRate: number;
	topPatterns: EvolutionPattern[];
}

/**
 * Session data extracted from MEMORY.md scorecard
 */
interface SessionEntry {
	date: string;
	taskType: string;
	taskDescription: string;
	time: number; // minutes
	firstTry: boolean;
	errors: string[];
	rework: boolean;
	impact: string;
	skillsUsed: string[];
	enables: string;
}

/**
 * Pattern Miner for Evolution Intelligence
 */
export class PatternMiner {
	private patterns: Map<string, EvolutionPattern> = new Map();
	private dataDir: string;
	private patternsFile: string;
	private sessions: SessionEntry[] = [];

	constructor(dataDir?: string) {
		this.dataDir = dataDir || this.findDataDir();
		this.patternsFile = path.join(this.dataDir, "evolution-patterns.json");
		this.loadSessionsFromMemory();
		this.loadPatterns();
		this.minePatterns();
	}

	private findDataDir(): string {
		let dir = process.cwd();
		for (let i = 0; i < 10; i++) {
			if (fs.existsSync(path.join(dir, ".git"))) {
				const dataDir = path.join(dir, "data");
				if (!fs.existsSync(dataDir)) {
					fs.mkdirSync(dataDir, { recursive: true });
				}
				return dataDir;
			}
			dir = path.dirname(dir);
		}
		return process.cwd();
	}

	/**
	 * Load sessions from MEMORY.md scorecard
	 */
	private loadSessionsFromMemory(): void {
		const memoryPath = this.findMemoryPath();
		if (!memoryPath || !fs.existsSync(memoryPath)) return;

		const content = fs.readFileSync(memoryPath, "utf-8");
		this.sessions = this.parseScorecard(content);
	}

	private findMemoryPath(): string | null {
		let dir = process.cwd();
		for (let i = 0; i < 10; i++) {
			const memoryPath = path.join(dir, "MEMORY.md");
			if (fs.existsSync(memoryPath)) {
				return memoryPath;
			}
			dir = path.dirname(dir);
		}
		return null;
	}

	/**
	 * Parse MEMORY.md scorecard table
	 */
	private parseScorecard(content: string): SessionEntry[] {
		const sessions: SessionEntry[] = [];

		// Find scorecard table
		const scorecardMatch = content.match(/## Evolution Scorecard\n\n.*?\n\n([\s\S]*?)\n\n###/);
		if (!scorecardMatch) return sessions;

		const tableContent = scorecardMatch[1];
		const rows = tableContent
			.split("\n")
			.filter((line) => line.startsWith("|") && !line.includes("---"));

		for (const row of rows.slice(1)) {
			// Skip header
			const cells = row
				.split("|")
				.map((c) => c.trim())
				.filter((c) => c);
			if (cells.length >= 9) {
				const timeStr = cells[3] || "~0m";
				const time = Number.parseInt(timeStr.replace(/[~m]/g, ""), 10) || 0;

				sessions.push({
					date: cells[0] || "",
					taskType: cells[1] || "feature",
					taskDescription: cells[2] || "",
					time,
					firstTry: cells[4] === "✅",
					errors: cells[5] ? cells[5].split(",").map((e) => e.trim()) : [],
					rework: cells[6] === "Yes",
					impact: cells[7] || "Medium",
					skillsUsed: cells[8] ? cells[8].split(",").map((s) => s.trim()) : [],
					enables: cells[9] || "",
				});
			}
		}

		return sessions;
	}

	/**
	 * Load patterns from file
	 */
	private loadPatterns(): void {
		if (fs.existsSync(this.patternsFile)) {
			try {
				const data = JSON.parse(fs.readFileSync(this.patternsFile, "utf-8"));
				for (const pattern of data.patterns || []) {
					this.patterns.set(pattern.id, pattern);
				}
			} catch {
				// Ignore parse errors
			}
		}
	}

	/**
	 * Save patterns to file
	 */
	private savePatterns(): void {
		const data = {
			patterns: Array.from(this.patterns.values()),
			lastUpdated: new Date().toISOString(),
			sessionCount: this.sessions.length,
		};

		const dir = path.dirname(this.patternsFile);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		fs.writeFileSync(this.patternsFile, JSON.stringify(data, null, 2));
	}

	/**
	 * Mine patterns from session history
	 */
	private minePatterns(): void {
		if (this.sessions.length < 3) return; // Need minimum sessions

		// Mine skill combinations
		this.mineSkillCombinations();

		// Mine task type success patterns
		this.mineTaskTypePatterns();

		// Mine time patterns
		this.mineTimePatterns();

		// Mine error avoidance patterns
		this.mineErrorAvoidancePatterns();

		this.savePatterns();
	}

	/**
	 * Mine skill combinations that lead to success
	 */
	private mineSkillCombinations(): void {
		// Group sessions by skill combinations
		const skillCombos: Map<string, SessionEntry[]> = new Map();

		for (const session of this.sessions) {
			if (session.skillsUsed.length === 0) continue;

			// Sort skills for consistent key
			const key = session.skillsUsed.sort().join(",");
			const existing = skillCombos.get(key) || [];
			existing.push(session);
			skillCombos.set(key, existing);
		}

		// Find successful combinations
		for (const [skillsStr, sessions] of skillCombos) {
			if (sessions.length < 2) continue; // Need minimum samples

			const skills = skillsStr.split(",");
			const successes = sessions.filter((s) => s.firstTry);
			const successRate = Math.round((successes.length / sessions.length) * 100);
			const firstTryRate = Math.round((successes.length / sessions.length) * 100);

			// Only store patterns with good success rate
			if (successRate >= 70) {
				const pattern: EvolutionPattern = {
					id: `skill-combo-${skills.map((s) => s.slice(0, 3)).join("-")}`,
					type: "skill-combination",
					description: `Skills ${skills.join(" + ")} have ${successRate}% success rate`,
					characteristics: { skills },
					successRate,
					firstTryRate,
					averageTime: Math.round(sessions.reduce((sum, s) => sum + s.time, 0) / sessions.length),
					confidence: Math.min(95, 50 + sessions.length * 5),
					sampleSize: sessions.length,
					examples: sessions.slice(0, 3).map((s) => ({
						taskDescription: s.taskDescription,
						date: s.date,
						time: s.time,
						skillsUsed: s.skillsUsed,
						success: s.firstTry,
						firstTry: s.firstTry,
					})),
					lastUpdated: new Date().toISOString(),
				};

				this.patterns.set(pattern.id, pattern);
			}
		}
	}

	/**
	 * Mine task type success patterns
	 */
	private mineTaskTypePatterns(): void {
		// Group sessions by task type
		const byType: Map<string, SessionEntry[]> = new Map();

		for (const session of this.sessions) {
			const existing = byType.get(session.taskType) || [];
			existing.push(session);
			byType.set(session.taskType, existing);
		}

		for (const [taskType, sessions] of byType) {
			if (sessions.length < 3) continue;

			const successes = sessions.filter((s) => s.firstTry);
			const successRate = Math.round((successes.length / sessions.length) * 100);
			const highImpact = sessions.filter((s) => s.impact === "High").length;
			const impactRate = Math.round((highImpact / sessions.length) * 100);

			const pattern: EvolutionPattern = {
				id: `task-type-${taskType}`,
				type: "task-type-success",
				description: `${taskType} tasks: ${successRate}% success, ${impactRate}% high impact`,
				characteristics: { taskType },
				successRate,
				firstTryRate: successRate,
				averageTime: Math.round(sessions.reduce((sum, s) => sum + s.time, 0) / sessions.length),
				confidence: Math.min(95, 40 + sessions.length * 3),
				sampleSize: sessions.length,
				examples: sessions
					.filter((s) => s.firstTry && s.impact === "High")
					.slice(0, 3)
					.map((s) => ({
						taskDescription: s.taskDescription,
						date: s.date,
						time: s.time,
						skillsUsed: s.skillsUsed,
						success: s.firstTry,
						firstTry: s.firstTry,
					})),
				lastUpdated: new Date().toISOString(),
			};

			this.patterns.set(pattern.id, pattern);
		}
	}

	/**
	 * Mine time patterns for certain task characteristics
	 */
	private mineTimePatterns(): void {
		// Find tasks that took longer than average vs shorter
		const avgTime = Math.round(
			this.sessions.reduce((sum, s) => sum + s.time, 0) / this.sessions.length,
		);

		const quickSessions = this.sessions.filter((s) => s.time <= avgTime / 2);
		const longSessions = this.sessions.filter((s) => s.time >= avgTime * 2);

		if (quickSessions.length >= 3) {
			const quickSuccessRate = Math.round(
				(quickSessions.filter((s) => s.firstTry).length / quickSessions.length) * 100,
			);

			const pattern: EvolutionPattern = {
				id: "time-pattern-quick",
				type: "time-pattern",
				description: `Tasks under ${Math.round(avgTime / 2)}min have ${quickSuccessRate}% success`,
				characteristics: {
					timeRange: { min: 0, max: Math.round(avgTime / 2) },
				},
				successRate: quickSuccessRate,
				firstTryRate: quickSuccessRate,
				averageTime: Math.round(
					quickSessions.reduce((sum, s) => sum + s.time, 0) / quickSessions.length,
				),
				confidence: Math.min(90, 50 + quickSessions.length * 3),
				sampleSize: quickSessions.length,
				examples: quickSessions.slice(0, 3).map((s) => ({
					taskDescription: s.taskDescription,
					date: s.date,
					time: s.time,
					skillsUsed: s.skillsUsed,
					success: s.firstTry,
					firstTry: s.firstTry,
				})),
				lastUpdated: new Date().toISOString(),
			};

			this.patterns.set(pattern.id, pattern);
		}

		if (longSessions.length >= 3) {
			const longSuccessRate = Math.round(
				(longSessions.filter((s) => s.firstTry).length / longSessions.length) * 100,
			);

			const pattern: EvolutionPattern = {
				id: "time-pattern-long",
				type: "time-pattern",
				description: `Tasks over ${avgTime * 2}min have ${longSuccessRate}% success (plan better)`,
				characteristics: {
					timeRange: { min: avgTime * 2, max: 999 },
					approach: "Requires planning phase",
				},
				successRate: longSuccessRate,
				firstTryRate: longSuccessRate,
				averageTime: Math.round(
					longSessions.reduce((sum, s) => sum + s.time, 0) / longSessions.length,
				),
				confidence: Math.min(85, 50 + longSessions.length * 3),
				sampleSize: longSessions.length,
				examples: longSessions.slice(0, 3).map((s) => ({
					taskDescription: s.taskDescription,
					date: s.date,
					time: s.time,
					skillsUsed: s.skillsUsed,
					success: s.firstTry,
					firstTry: s.firstTry,
				})),
				lastUpdated: new Date().toISOString(),
			};

			this.patterns.set(pattern.id, pattern);
		}
	}

	/**
	 * Mine error avoidance patterns
	 */
	private mineErrorAvoidancePatterns(): void {
		// Find sessions that avoided common errors
		const errorCounts: Map<string, number> = new Map();

		for (const session of this.sessions) {
			for (const error of session.errors) {
				errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
			}
		}

		// Find sessions that succeeded without errors
		const noErrorSessions = this.sessions.filter((s) => s.errors.length === 0 && s.firstTry);

		if (noErrorSessions.length >= 3) {
			// Find common skills in error-free sessions
			const skillCounts: Map<string, number> = new Map();
			for (const session of noErrorSessions) {
				for (const skill of session.skillsUsed) {
					skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
				}
			}

			const topSkills = Array.from(skillCounts.entries())
				.filter(([, count]) => count >= 2)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 5)
				.map(([skill]) => skill);

			const pattern: EvolutionPattern = {
				id: "error-avoidance-clean",
				type: "error-avoidance",
				description: `Error-free sessions often use: ${topSkills.join(", ")}`,
				characteristics: {
					skills: topSkills,
					errorsAvoided: ["lint", "TS", "test"],
				},
				successRate: 100,
				firstTryRate: 100,
				averageTime: Math.round(
					noErrorSessions.reduce((sum, s) => sum + s.time, 0) / noErrorSessions.length,
				),
				confidence: Math.min(95, 60 + noErrorSessions.length * 3),
				sampleSize: noErrorSessions.length,
				examples: noErrorSessions.slice(0, 3).map((s) => ({
					taskDescription: s.taskDescription,
					date: s.date,
					time: s.time,
					skillsUsed: s.skillsUsed,
					success: s.firstTry,
					firstTry: s.firstTry,
				})),
				lastUpdated: new Date().toISOString(),
			};

			this.patterns.set(pattern.id, pattern);
		}
	}

	/**
	 * Get recommendations for a current task context
	 */
	getRecommendations(context: {
		taskType?: string;
		skillsAvailable?: string[];
		taskDescription?: string;
	}): PatternRecommendation[] {
		const recommendations: PatternRecommendation[] = [];

		// Match patterns by task type
		if (context.taskType) {
			const typePattern = this.patterns.get(`task-type-${context.taskType}`);
			if (typePattern) {
				recommendations.push({
					pattern: typePattern,
					reason: `${context.taskType} tasks historically have ${typePattern.successRate}% success`,
					confidence: typePattern.confidence,
					suggestedSkills: typePattern.examples[0]?.skillsUsed || [],
					suggestedApproach: "Follow similar approach to past successful tasks",
					potentialIssues: typePattern.successRate < 80 ? ["Consider better planning phase"] : [],
				});
			}
		}

		// Match skill combinations
		if (context.skillsAvailable && context.skillsAvailable.length > 0) {
			for (const [id, pattern] of this.patterns) {
				if (pattern.type === "skill-combination") {
					const patternSkills = pattern.characteristics.skills || [];
					const matchCount = patternSkills.filter((s) =>
						context.skillsAvailable?.includes(s),
					).length;

					if (matchCount >= patternSkills.length * 0.5) {
						recommendations.push({
							pattern,
							reason: `Using similar skills to successful pattern (${pattern.successRate}% success)`,
							confidence: Math.min(
								pattern.confidence,
								Math.round((matchCount / patternSkills.length) * 100),
							),
							suggestedSkills: patternSkills,
							suggestedApproach: "Combine these skills for higher success",
							potentialIssues: [],
						});
					}
				}
			}
		}

		// Sort by confidence
		return recommendations.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
	}

	/**
	 * Get pattern statistics
	 */
	getStats(): MiningStats {
		const patterns = Array.from(this.patterns.values());
		const byType: Record<string, number> = {};

		for (const pattern of patterns) {
			byType[pattern.type] = (byType[pattern.type] || 0) + 1;
		}

		const avgSuccess =
			patterns.length > 0
				? Math.round(patterns.reduce((sum, p) => sum + p.successRate, 0) / patterns.length)
				: 0;

		return {
			totalPatterns: patterns.length,
			byType,
			totalSessionsAnalyzed: this.sessions.length,
			averageSuccessRate: avgSuccess,
			topPatterns: patterns.sort((a, b) => b.successRate - a.successRate).slice(0, 5),
		};
	}

	/**
	 * Get all patterns
	 */
	getPatterns(type?: PatternType): EvolutionPattern[] {
		const patterns = Array.from(this.patterns.values());
		if (type) {
			return patterns.filter((p) => p.type === type);
		}
		return patterns;
	}

	/**
	 * Get pattern by ID
	 */
	getPattern(id: string): EvolutionPattern | undefined {
		return this.patterns.get(id);
	}

	/**
	 * Refresh patterns (reload sessions and re-mine)
	 */
	refresh(): void {
		this.loadSessionsFromMemory();
		this.minePatterns();
		this.savePatterns();
	}
}

// Singleton instance
let instance: PatternMiner | null = null;

export function getPatternMiner(): PatternMiner {
	if (!instance) {
		instance = new PatternMiner();
	}
	return instance;
}

/**
 * Format mining stats for display
 */
export function formatMiningStats(stats: MiningStats): string {
	const lines: string[] = [
		"## Evolution Pattern Mining Statistics",
		"",
		`**Total Patterns:** ${stats.totalPatterns}`,
		`**Sessions Analyzed:** ${stats.totalSessionsAnalyzed}`,
		`**Average Success Rate:** ${stats.averageSuccessRate}%`,
		"",
		"**By Pattern Type:**",
	];

	for (const [type, count] of Object.entries(stats.byType)) {
		lines.push(`- ${type}: ${count} patterns`);
	}

	if (stats.topPatterns.length > 0) {
		lines.push("", "**Top Patterns (by success rate):**");
		for (const pattern of stats.topPatterns) {
			lines.push(
				`- ${pattern.id}: ${pattern.successRate}% success (${pattern.sampleSize} samples, ${pattern.confidence}% confidence)`,
			);
		}
	}

	return lines.join("\n");
}

/**
 * Format recommendations for display
 */
export function formatRecommendations(recommendations: PatternRecommendation[]): string {
	if (recommendations.length === 0) {
		return "No pattern recommendations available. Need more session history.";
	}

	const lines: string[] = [
		"## Pattern-Based Recommendations",
		"",
		"Based on past successful sessions:",
	];

	for (const rec of recommendations) {
		lines.push("");
		lines.push(`### ${rec.pattern.description}`);
		lines.push(`- **Confidence:** ${rec.confidence}%`);
		lines.push(`- **Reason:** ${rec.reason}`);
		lines.push(`- **Suggested Skills:** ${rec.suggestedSkills.join(", ")}`);
		lines.push(`- **Suggested Approach:** ${rec.suggestedApproach}`);
		if (rec.potentialIssues.length > 0) {
			lines.push(`- **Potential Issues:** ${rec.potentialIssues.join(", ")}`);
		}
	}

	return lines.join("\n");
}
