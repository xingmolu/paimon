/**
 * Singularity Tracking Module (Aider Pattern)
 *
 * Tracks self-authorship percentage - how much code was written by Paimon vs humans.
 * Inspired by Aider's "88% Singularity" metric.
 *
 * This enables self-awareness for evolution:
 * - Know which code Paimon authored vs humans
 * - Track evolution progress over time
 * - Make better decisions about modifying code
 */

import { execSync } from "node:child_process";

/**
 * Author classification for commits
 */
export interface AuthorClassification {
	name: string;
	isBot: boolean;
	botName?: string;
}

/**
 * Singularity statistics for a codebase
 */
export interface SingularityStats {
	/** Total commits analyzed */
	totalCommits: number;
	/** Commits by Paimon/bot */
	botCommits: number;
	/** Commits by humans */
	humanCommits: number;
	/** Self-authorship percentage (Singularity metric) */
	singularityPercentage: number;
	/** Lines authored by bot vs human (if available) */
	linesByBot?: number;
	linesByHuman?: number;
	/** Breakdown by author */
	authors: AuthorBreakdown[];
	/** Analysis period */
	timeframe: {
		from: string;
		to: string;
	};
	/** File-level analysis */
	fileAnalysis?: FileAuthorship[];
}

/**
 * Author breakdown for statistics
 */
export interface AuthorBreakdown {
	name: string;
	isBot: boolean;
	commitCount: number;
	percentage: number;
}

/**
 * File-level authorship analysis
 */
export interface FileAuthorship {
	file: string;
	botLines: number;
	humanLines: number;
	totalLines: number;
	botPercentage: number;
	primaryAuthor: string;
}

/**
 * Singularity configuration
 */
export interface SingularityConfig {
	/** Bot author names to recognize */
	botNames?: string[];
	/** Include file-level analysis */
	includeFileAnalysis?: boolean;
	/** Maximum commits to analyze */
	maxCommits?: number;
	/** Filter by file patterns */
	filePatterns?: string[];
}

/**
 * Default bot names to recognize as Paimon-authored
 */
const DEFAULT_BOT_NAMES = ["paimon[bot]", "paimon-bot", "Paimon[bot]", "paimon"];

/**
 * Find git root directory
 */
function findGitRoot(dir: string = process.cwd()): string | null {
	try {
		const result = execSync("git rev-parse --show-toplevel", {
			cwd: dir,
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		return result.trim();
	} catch {
		return null;
	}
}

/**
 * Check if author is a bot
 */
function isBotAuthor(author: string, botNames: string[]): boolean {
	return botNames.some(
		(botName) =>
			author.toLowerCase().includes(botName.toLowerCase()) ||
			botName.toLowerCase().includes(author.toLowerCase()),
	);
}

/**
 * Parse git log output for author information
 */
function parseGitLog(logOutput: string, botNames: string[]): AuthorBreakdown[] {
	const authorCounts: Map<string, number> = new Map();
	const lines = logOutput.split("\n").filter((line) => line.trim());

	for (const line of lines) {
		// Format: "commit_hash author_name"
		const parts = line.split(" ");
		if (parts.length >= 2) {
			const author = parts.slice(1).join(" ");
			const count = authorCounts.get(author) || 0;
			authorCounts.set(author, count + 1);
		}
	}

	const total = lines.length;
	const breakdowns: AuthorBreakdown[] = [];

	for (const [author, count] of authorCounts.entries()) {
		breakdowns.push({
			name: author,
			isBot: isBotAuthor(author, botNames),
			commitCount: count,
			percentage: total > 0 ? Math.round((count / total) * 100) : 0,
		});
	}

	// Sort by commit count
	breakdowns.sort((a, b) => b.commitCount - a.commitCount);

	return breakdowns;
}

/**
 * Get git blame output for a file
 */
function getGitBlame(file: string, gitRoot: string): string | null {
	try {
		const result = execSync(`git blame --line-porcelain "${file}"`, {
			cwd: gitRoot,
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		return result;
	} catch {
		return null;
	}
}

/**
 * Parse git blame output to count lines by author
 */
function parseGitBlame(
	blameOutput: string,
	botNames: string[],
): { botLines: number; humanLines: number; authors: Map<string, number> } {
	const lines = blameOutput.split("\n");
	let botLines = 0;
	let humanLines = 0;
	const authors: Map<string, number> = new Map();

	// Git blame porcelain format has "author <name>" lines
	for (const line of lines) {
		if (line.startsWith("author ")) {
			const author = line.substring(7).trim();
			const count = authors.get(author) || 0;
			authors.set(author, count + 1);

			if (isBotAuthor(author, botNames)) {
				botLines++;
			} else {
				humanLines++;
			}
		}
	}

	return { botLines, humanLines, authors };
}

/**
 * Analyze file authorship
 */
function analyzeFileAuthorship(
	gitRoot: string,
	filePatterns: string[],
	botNames: string[],
): FileAuthorship[] {
	try {
		// Get list of tracked files matching patterns
		let filesCommand = "git ls-files";
		if (filePatterns.length > 0) {
			filesCommand = `git ls-files ${filePatterns.map((p) => `"${p}"`).join(" ")}`;
		}

		const filesOutput = execSync(filesCommand, {
			cwd: gitRoot,
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});

		const files = filesOutput.split("\n").filter((f) => f.trim());
		const fileAnalysis: FileAuthorship[] = [];

		// Analyze up to 50 files to avoid performance issues
		const filesToAnalyze = files.slice(0, 50);

		for (const file of filesToAnalyze) {
			if (!file.endsWith(".ts") && !file.endsWith(".js")) {
				continue; // Only analyze TypeScript/JavaScript files
			}

			const blameOutput = getGitBlame(file, gitRoot);
			if (blameOutput) {
				const { botLines, humanLines, authors } = parseGitBlame(blameOutput, botNames);
				const totalLines = botLines + humanLines;

				if (totalLines > 0) {
					// Find primary author
					let primaryAuthor = "unknown";
					let maxLines = 0;
					for (const [author, count] of authors.entries()) {
						if (count > maxLines) {
							maxLines = count;
							primaryAuthor = author;
						}
					}

					fileAnalysis.push({
						file,
						botLines,
						humanLines,
						totalLines,
						botPercentage: Math.round((botLines / totalLines) * 100),
						primaryAuthor,
					});
				}
			}
		}

		// Sort by bot percentage (highest first)
		fileAnalysis.sort((a, b) => b.botPercentage - a.botPercentage);

		return fileAnalysis;
	} catch {
		return [];
	}
}

/**
 * Singularity class for tracking self-authorship
 */
export class SingularityTracker {
	private config: SingularityConfig;
	private gitRoot: string | null;
	private botNames: string[];

	constructor(config: SingularityConfig = {}) {
		this.config = config;
		this.gitRoot = findGitRoot();
		this.botNames = config.botNames || DEFAULT_BOT_NAMES;
	}

	/**
	 * Calculate singularity statistics for the codebase
	 */
	calculateStats(): SingularityStats {
		if (!this.gitRoot) {
			throw new Error("Not in a git repository");
		}

		// Get commit history with authors
		const maxCommits = this.config.maxCommits || 1000;
		const logFormat = "--format=%H %an";
		let logCommand = `git log ${logFormat} -n ${maxCommits}`;

		// Add file pattern filter if specified
		if (this.config.filePatterns && this.config.filePatterns.length > 0) {
			logCommand += ` -- ${this.config.filePatterns.map((p) => `"${p}"`).join(" ")}`;
		}

		const logOutput = execSync(logCommand, {
			cwd: this.gitRoot,
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});

		// Parse author breakdown
		const authors = parseGitLog(logOutput, this.botNames);

		// Calculate totals
		let botCommits = 0;
		let humanCommits = 0;

		for (const author of authors) {
			if (author.isBot) {
				botCommits += author.commitCount;
			} else {
				humanCommits += author.commitCount;
			}
		}

		const totalCommits = botCommits + humanCommits;
		const singularityPercentage =
			totalCommits > 0 ? Math.round((botCommits / totalCommits) * 100) : 0;

		// Get timeframe
		let fromDate = "unknown";
		let toDate = "unknown";

		try {
			const firstCommit = execSync("git log --reverse --format=%ci -n 1", {
				cwd: this.gitRoot,
				encoding: "utf-8",
				stdio: ["pipe", "pipe", "pipe"],
			});
			const lastCommit = execSync("git log --format=%ci -n 1", {
				cwd: this.gitRoot,
				encoding: "utf-8",
				stdio: ["pipe", "pipe", "pipe"],
			});
			fromDate = firstCommit.trim().split(" ")[0];
			toDate = lastCommit.trim().split(" ")[0];
		} catch {
			// Keep "unknown" values
		}

		// File-level analysis if requested
		let fileAnalysis: FileAuthorship[] | undefined;
		let linesByBot: number | undefined;
		let linesByHuman: number | undefined;

		if (this.config.includeFileAnalysis) {
			fileAnalysis = analyzeFileAuthorship(
				this.gitRoot,
				this.config.filePatterns || [],
				this.botNames,
			);

			// Sum up lines
			linesByBot = fileAnalysis.reduce((sum, f) => sum + f.botLines, 0);
			linesByHuman = fileAnalysis.reduce((sum, f) => sum + f.humanLines, 0);
		}

		return {
			totalCommits,
			botCommits,
			humanCommits,
			singularityPercentage,
			linesByBot,
			linesByHuman,
			authors,
			timeframe: {
				from: fromDate,
				to: toDate,
			},
			fileAnalysis,
		};
	}

	/**
	 * Check if a specific file is primarily bot-authored
	 */
	isFileBotAuthored(file: string): boolean {
		if (!this.gitRoot) {
			return false;
		}

		const blameOutput = getGitBlame(file, this.gitRoot);
		if (!blameOutput) {
			return false;
		}

		const { botLines, humanLines } = parseGitBlame(blameOutput, this.botNames);
		const totalLines = botLines + humanLines;

		return totalLines > 0 && botLines / totalLines > 0.5;
	}

	/**
	 * Get the primary author of a file
	 */
	getFilePrimaryAuthor(file: string): string | null {
		if (!this.gitRoot) {
			return null;
		}

		const blameOutput = getGitBlame(file, this.gitRoot);
		if (!blameOutput) {
			return null;
		}

		const { authors } = parseGitBlame(blameOutput, this.botNames);

		let primaryAuthor = null;
		let maxLines = 0;

		for (const [author, count] of authors.entries()) {
			if (count > maxLines) {
				maxLines = count;
				primaryAuthor = author;
			}
		}

		return primaryAuthor;
	}
}

/**
 * Format singularity stats for display
 */
export function formatSingularityStats(stats: SingularityStats): string {
	const lines: string[] = [];

	lines.push("## Singularity Report (Self-Authorship Tracking)");
	lines.push("");
	lines.push(`**Singularity Percentage:** ${stats.singularityPercentage}%`);
	lines.push(
		`- Bot commits: ${stats.botCommits} (${Math.round((stats.botCommits / stats.totalCommits) * 100)}%)`,
	);
	lines.push(
		`- Human commits: ${stats.humanCommits} (${Math.round((stats.humanCommits / stats.totalCommits) * 100)}%)`,
	);
	lines.push(`- Total commits: ${stats.totalCommits}`);
	lines.push("");
	lines.push(`**Timeframe:** ${stats.timeframe.from} to ${stats.timeframe.to}`);
	lines.push("");

	if (stats.linesByBot !== undefined && stats.linesByHuman !== undefined) {
		const totalLines = stats.linesByBot + stats.linesByHuman;
		lines.push("**Line-Level Analysis:**");
		lines.push(
			`- Bot-authored lines: ${stats.linesByBot} (${Math.round((stats.linesByBot / totalLines) * 100)}%)`,
		);
		lines.push(
			`- Human-authored lines: ${stats.linesByHuman} (${Math.round((stats.linesByHuman / totalLines) * 100)}%)`,
		);
		lines.push("");
	}

	if (stats.authors.length > 0) {
		lines.push("**Top Authors:**");
		for (const author of stats.authors.slice(0, 5)) {
			const badge = author.isBot ? "🤖" : "👤";
			lines.push(
				`- ${badge} ${author.name}: ${author.commitCount} commits (${author.percentage}%)`,
			);
		}
		lines.push("");
	}

	if (stats.fileAnalysis && stats.fileAnalysis.length > 0) {
		lines.push("**Most Self-Authorized Files:**");
		for (const file of stats.fileAnalysis.slice(0, 10)) {
			if (file.botPercentage >= 50) {
				lines.push(
					`- ${file.file}: ${file.botPercentage}% bot-authored (${file.botLines}/${file.totalLines} lines)`,
				);
			}
		}
	}

	return lines.join("\n");
}

/**
 * Generate singularity report for current codebase
 */
export function generateSingularityReport(options: SingularityConfig = {}): SingularityStats {
	const tracker = new SingularityTracker(options);
	return tracker.calculateStats();
}
