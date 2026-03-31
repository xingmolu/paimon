/**
 * Bug Report Generator Module
 *
 * Automatically generates structured bug reports from failed evolution sessions.
 * Captures context, error details, and suggested fixes for future iterations.
 *
 * Inspired by Claude Code's /bug command and OpenHands' session analysis.
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Bug report structure
 */
export interface BugReport {
	id: string;
	title: string;
	timestamp: string;
	context: BugReportContext;
	error: BugReportError;
	attemptedFixes: BugReportAttempt[];
	suggestedFixes: string[];
	metadata: BugReportMetadata;
}

/**
 * Context information for bug report
 */
export interface BugReportContext {
	taskType: "capability" | "reliability" | "feature";
	taskDescription: string;
	skillsUsed: string[];
	timeElapsed: number;
	gitBranch: string;
	recentCommits: string[];
	changedFiles: string[];
}

/**
 * Error details for bug report
 */
export interface BugReportError {
	type: "typescript" | "test" | "lint" | "runtime" | "unknown";
	message: string;
	stack?: string;
	file?: string;
	line?: number;
	relatedPatterns: string[];
}

/**
 * Attempted fix record
 */
export interface BugReportAttempt {
	step: number;
	action: string;
	result: "success" | "partial" | "failed";
	details: string;
}

/**
 * Metadata for bug report
 */
export interface BugReportMetadata {
	firstTrySuccess: boolean;
	reworkCount: number;
	sessionFile?: string;
	trajectoryFile?: string;
}

/**
 * Bug Report Generator class
 */
export class BugReportGenerator {
	private dataDir: string;

	constructor(dataDir = "session_plan") {
		this.dataDir = dataDir;
		this.ensureDataDir();
	}

	/**
	 * Ensure data directory exists
	 */
	private ensureDataDir(): void {
		if (!fs.existsSync(this.dataDir)) {
			fs.mkdirSync(this.dataDir, { recursive: true });
		}
	}

	/**
	 * Generate a unique bug report ID
	 */
	private generateId(): string {
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 23);
		return `bug-${timestamp}`;
	}

	/**
	 * Get git branch name
	 */
	private getGitBranch(): string {
		try {
			return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
		} catch {
			return "unknown";
		}
	}

	/**
	 * Get recent git commits
	 */
	private getRecentCommits(count = 5): string[] {
		try {
			const log = execSync(`git log --oneline -${count}`, { encoding: "utf-8" }).trim();
			return log.split("\n").filter((line) => line.length > 0);
		} catch {
			return [];
		}
	}

	/**
	 * Get changed files (uncommitted)
	 */
	private getChangedFiles(): string[] {
		try {
			const status = execSync("git status --porcelain", { encoding: "utf-8" }).trim();
			return status
				.split("\n")
				.filter((line) => line.length > 0)
				.map((line) => line.slice(3).trim());
		} catch {
			return [];
		}
	}

	/**
	 * Detect error type from message
	 */
	private detectErrorType(message: string): BugReportError["type"] {
		if (
			message.includes("Type error") ||
			message.includes("TS") ||
			message.includes("Cannot find name") ||
			message.includes("is not assignable")
		) {
			return "typescript";
		}
		if (
			message.includes("AssertionError") ||
			message.includes("Test failed") ||
			message.includes("expected") ||
			message.includes("FAIL")
		) {
			return "test";
		}
		if (
			message.includes("lint") ||
			message.includes("Lint") ||
			message.includes("eslint") ||
			message.includes("biome")
		) {
			return "lint";
		}
		if (
			message.includes("Error:") ||
			message.includes("Exception") ||
			message.includes("timeout") ||
			message.includes("ENOENT")
		) {
			return "runtime";
		}
		return "unknown";
	}

	/**
	 * Extract file and line from error message
	 */
	private extractFileAndLine(message: string): { file?: string; line?: number } {
		// TypeScript error pattern: file.ts(line,col)
		const tsMatch = message.match(/([^\s]+\.ts)\((\d+),\d+\)/);
		if (tsMatch) {
			return { file: tsMatch[1], line: Number.parseInt(tsMatch[2], 10) };
		}

		// General file pattern: file.ts:line
		const generalMatch = message.match(/([^\s]+\.ts):(\d+)/);
		if (generalMatch) {
			return { file: generalMatch[1], line: Number.parseInt(generalMatch[2], 10) };
		}

		return {};
	}

	/**
	 * Generate bug report from error context
	 */
	generateReport(
		taskDescription: string,
		taskType: BugReportContext["taskType"],
		errorMessage: string,
		skillsUsed: string[] = [],
		timeElapsed = 0,
		attemptedFixes: BugReportAttempt[] = [],
		metadata: Partial<BugReportMetadata> = {},
	): BugReport {
		const id = this.generateId();
		const errorType = this.detectErrorType(errorMessage);
		const { file, line } = this.extractFileAndLine(errorMessage);

		const report: BugReport = {
			id,
			title: this.generateTitle(taskDescription, errorType),
			timestamp: new Date().toISOString(),
			context: {
				taskType,
				taskDescription,
				skillsUsed,
				timeElapsed,
				gitBranch: this.getGitBranch(),
				recentCommits: this.getRecentCommits(),
				changedFiles: this.getChangedFiles(),
			},
			error: {
				type: errorType,
				message: errorMessage,
				stack: this.extractStack(errorMessage),
				file,
				line,
				relatedPatterns: this.findRelatedPatterns(errorMessage),
			},
			attemptedFixes,
			suggestedFixes: this.generateSuggestedFixes(errorType, errorMessage),
			metadata: {
				firstTrySuccess: metadata.firstTrySuccess ?? false,
				reworkCount: metadata.reworkCount ?? attemptedFixes.length,
				sessionFile: metadata.sessionFile,
				trajectoryFile: metadata.trajectoryFile,
			},
		};

		return report;
	}

	/**
	 * Generate title from task and error type
	 */
	private generateTitle(taskDescription: string, errorType: BugReportError["type"]): string {
		const typeLabels: Record<string, string> = {
			typescript: "TypeScript",
			test: "Test",
			lint: "Lint",
			runtime: "Runtime",
			unknown: "Unknown",
		};
		const typeLabel = typeLabels[errorType] || errorType;
		const shortDesc = taskDescription.slice(0, 50);
		return `[${typeLabel}] ${shortDesc}${taskDescription.length > 50 ? "..." : ""}`;
	}

	/**
	 * Extract stack trace from error message
	 */
	private extractStack(message: string): string | undefined {
		const stackMatch = message.match(/Stack trace:\n([\s\S]+)/);
		if (stackMatch) {
			return stackMatch[1].trim();
		}

		// Look for at pattern
		const atMatches = message.match(/at .+\n/g);
		if (atMatches && atMatches.length > 0) {
			return atMatches.join("").trim();
		}

		return undefined;
	}

	/**
	 * Find related error patterns
	 */
	private findRelatedPatterns(message: string): string[] {
		const patterns: string[] = [];

		// TypeScript patterns
		if (message.includes("Cannot find name")) {
			patterns.push("missing-import");
			patterns.push("undefined-variable");
		}
		if (message.includes("is not assignable")) {
			patterns.push("type-mismatch");
		}
		if (message.includes("Property")) {
			patterns.push("missing-property");
		}

		// Test patterns
		if (message.includes("expected") && message.includes("received")) {
			patterns.push("assertion-failure");
		}
		if (message.includes("timeout")) {
			patterns.push("async-timeout");
		}

		// Lint patterns
		if (message.includes("unused")) {
			patterns.push("unused-variable");
		}

		return patterns;
	}

	/**
	 * Generate suggested fixes based on error type
	 */
	private generateSuggestedFixes(errorType: BugReportError["type"], message: string): string[] {
		const suggestions: string[] = [];

		switch (errorType) {
			case "typescript":
				if (message.includes("Cannot find name")) {
					suggestions.push("Add missing import statement");
					suggestions.push("Check if variable is defined in scope");
					suggestions.push("Verify export/import paths");
				}
				if (message.includes("is not assignable")) {
					suggestions.push("Add type assertion with `as`");
					suggestions.push("Fix the source type to match expected");
					suggestions.push("Check interface compatibility");
				}
				if (message.includes("Property")) {
					suggestions.push("Add missing property to interface/type");
					suggestions.push("Use optional chaining `?.`");
					suggestions.push("Check if property exists on object");
				}
				break;

			case "test":
				if (message.includes("expected") && message.includes("received")) {
					suggestions.push("Review expected vs actual values");
					suggestions.push("Check test assertions");
					suggestions.push("Verify mock data matches expectations");
				}
				if (message.includes("timeout")) {
					suggestions.push("Increase test timeout");
					suggestions.push("Fix async/await handling");
					suggestions.push("Check for infinite loops");
				}
				break;

			case "lint":
				if (message.includes("unused")) {
					suggestions.push("Remove unused variable/import");
					suggestions.push("Prefix with underscore if intentionally unused");
				}
				suggestions.push("Run linter with --fix flag");
				break;

			case "runtime":
				if (message.includes("ENOENT")) {
					suggestions.push("Verify file path exists");
					suggestions.push("Check file permissions");
				}
				if (message.includes("timeout")) {
					suggestions.push("Add proper timeout handling");
					suggestions.push("Check for blocking operations");
				}
				break;
		}

		// Add general suggestions
		suggestions.push("Review recent commits for related changes");
		suggestions.push("Check MEMORY.md for similar error patterns");

		return suggestions;
	}

	/**
	 * Format bug report as markdown
	 */
	formatAsMarkdown(report: BugReport): string {
		const lines: string[] = [
			`# Bug Report: ${report.title}`,
			"",
			`**ID:** ${report.id}`,
			`**Timestamp:** ${report.timestamp}`,
			`**Type:** ${report.context.taskType}`,
			"",
			"## Context",
			"",
			`**Task:** ${report.context.taskDescription}`,
			`**Skills Used:** ${report.context.skillsUsed.join(", ") || "none"}`,
			`**Time Elapsed:** ${report.context.timeElapsed} minutes`,
			"",
			"### Git State",
			"",
			`**Branch:** ${report.context.gitBranch}`,
			"**Recent Commits:**",
			...report.context.recentCommits.map((c) => `- ${c}`),
			"",
			"**Changed Files:**",
			...(report.context.changedFiles.length > 0
				? report.context.changedFiles.map((f) => `- ${f}`)
				: ["- (none)"]),
			"",
			"## Error Details",
			"",
			`**Type:** ${report.error.type}`,
			"**Message:**",
			"",
			"```",
			report.error.message,
			"```",
			"",
			...(report.error.file
				? [
						`**File:** ${report.error.file}${report.error.line ? ` (line ${report.error.line})` : ""}`,
					]
				: []),
			...(report.error.stack ? ["", "**Stack Trace:**", "", "```", report.error.stack, "```"] : []),
			"",
			"**Related Patterns:**",
			...report.error.relatedPatterns.map((p) => `- ${p}`),
			"",
			"## Attempted Fixes",
			"",
			...(report.attemptedFixes.length > 0
				? report.attemptedFixes.map(
						(a) => `| Step ${a.step} | ${a.action} | ${a.result} | ${a.details.slice(0, 50)}... |`,
					)
				: ["- (none)"]),
			"",
			"## Suggested Fixes",
			"",
			...report.suggestedFixes.map((s, i) => `${i + 1}. ${s}`),
			"",
			"## Metadata",
			"",
			`**First Try Success:** ${report.metadata.firstTrySuccess ? "Yes" : "No"}`,
			`**Rework Count:** ${report.metadata.reworkCount}`,
			...(report.metadata.sessionFile ? [`**Session File:** ${report.metadata.sessionFile}`] : []),
			...(report.metadata.trajectoryFile
				? [`**Trajectory File:** ${report.metadata.trajectoryFile}`]
				: []),
			"",
			"---",
			"",
			"*Generated by Bug Report Generator*",
		];

		return lines.join("\n");
	}

	/**
	 * Save bug report to file
	 */
	saveReport(report: BugReport): string {
		const filename = `${report.id}.md`;
		const filepath = path.join(this.dataDir, filename);
		const content = this.formatAsMarkdown(report);

		fs.writeFileSync(filepath, content, "utf-8");
		return filepath;
	}

	/**
	 * List saved bug reports
	 */
	listReports(): BugReportListing[] {
		const files = fs
			.readdirSync(this.dataDir)
			.filter((f) => f.startsWith("bug-") && f.endsWith(".md"))
			.sort()
			.reverse();

		return files.map((f) => {
			const filepath = path.join(this.dataDir, f);
			const content = fs.readFileSync(filepath, "utf-8");
			return this.parseReportListing(f, content);
		});
	}

	/**
	 * Parse report listing from file content
	 */
	private parseReportListing(filename: string, content: string): BugReportListing {
		const titleMatch = content.match(/# Bug Report: (.+)/);
		const typeMatch = content.match(/\*\*Type:\*\* (\w+)/);
		const taskMatch = content.match(/\*\*Task:\*\* (.+)/);
		const timeMatch = content.match(/\*\*Time Elapsed:\*\* (\d+)/);

		return {
			filename,
			title: titleMatch?.[1] ?? filename,
			taskType: (typeMatch?.[1] as BugReportContext["taskType"]) ?? "unknown",
			taskDescription: taskMatch?.[1]?.slice(0, 60) ?? "",
			timeElapsed: timeMatch ? Number.parseInt(timeMatch[1], 10) : 0,
		};
	}

	/**
	 * Load specific bug report
	 */
	loadReport(filename: string): BugReport | null {
		const filepath = path.join(this.dataDir, filename);
		if (!fs.existsSync(filepath)) {
			return null;
		}

		const content = fs.readFileSync(filepath, "utf-8");
		return this.parseReport(content);
	}

	/**
	 * Parse full bug report from markdown
	 */
	private parseReport(content: string): BugReport {
		const titleMatch = content.match(/# Bug Report: (.+)/);
		const idMatch = content.match(/\*\*ID:\*\* (.+)/);
		const timestampMatch = content.match(/\*\*Timestamp:\*\* (.+)/);
		const typeMatch = content.match(/\*\*Type:\*\* (\w+)/);
		const taskMatch = content.match(/\*\*Task:\*\* (.+)/);
		const skillsMatch = content.match(/\*\*Skills Used:\*\* (.+)/);
		const timeMatch = content.match(/\*\*Time Elapsed:\*\* (\d+)/);
		const branchMatch = content.match(/\*\*Branch:\*\* (.+)/);

		// Extract error message from code block
		const errorBlockMatch = content.match(
			/## Error Details\n\n\*\*Type:\*\* (\w+)\n\*\*Message:\*\*\n\n```\n([\s\S]+?)\n```/,
		);

		return {
			id: idMatch?.[1] ?? "",
			title: titleMatch?.[1] ?? "",
			timestamp: timestampMatch?.[1] ?? "",
			context: {
				taskType: (typeMatch?.[1] as BugReportContext["taskType"]) ?? "unknown",
				taskDescription: taskMatch?.[1] ?? "",
				skillsUsed: skillsMatch?.[1]?.split(", ").filter((s) => s !== "none") ?? [],
				timeElapsed: timeMatch ? Number.parseInt(timeMatch[1], 10) : 0,
				gitBranch: branchMatch?.[1] ?? "unknown",
				recentCommits: [],
				changedFiles: [],
			},
			error: {
				type: (errorBlockMatch?.[1] as BugReportError["type"]) ?? "unknown",
				message: errorBlockMatch?.[2]?.trim() ?? "",
				relatedPatterns: [],
			},
			attemptedFixes: [],
			suggestedFixes: [],
			metadata: {
				firstTrySuccess: false,
				reworkCount: 0,
			},
		};
	}

	/**
	 * Get statistics on bug reports
	 */
	getStats(): BugReportStats {
		const reports = this.listReports();

		const typeCounts: Record<string, number> = {};
		const errorTypeCounts: Record<string, number> = {};

		for (const r of reports) {
			typeCounts[r.taskType] = (typeCounts[r.taskType] || 0) + 1;
		}

		// Load full reports for error type stats
		for (const r of reports) {
			const full = this.loadReport(r.filename);
			if (full) {
				errorTypeCounts[full.error.type] = (errorTypeCounts[full.error.type] || 0) + 1;
			}
		}

		return {
			totalReports: reports.length,
			byTaskType: typeCounts,
			byErrorType: errorTypeCounts,
			averageTime:
				reports.length > 0
					? reports.reduce((sum, r) => sum + r.timeElapsed, 0) / reports.length
					: 0,
		};
	}

	/**
	 * Generate GitHub issue format
	 */
	formatAsGitHubIssue(report: BugReport): string {
		const lines: string[] = [
			"## Bug Report",
			"",
			"### Description",
			report.context.taskDescription,
			"",
			"### Error",
			"```",
			report.error.message,
			"```",
			"",
			"### Context",
			`- **Type:** ${report.context.taskType}`,
			`- **Skills Used:** ${report.context.skillsUsed.join(", ") || "none"}`,
			`- **Time:** ${report.context.timeElapsed} min`,
			...(report.error.file ? [`- **File:** ${report.error.file}`] : []),
			"",
			"### Suggested Fix",
			...report.suggestedFixes.slice(0, 3).map((s, i) => `${i + 1}. ${s}`),
			"",
			"---",
			`*Auto-generated bug report (ID: ${report.id})`,
		];

		return lines.join("\n");
	}
}

/**
 * Bug report listing (summary)
 */
export interface BugReportListing {
	filename: string;
	title: string;
	taskType: BugReportContext["taskType"];
	taskDescription: string;
	timeElapsed: number;
}

/**
 * Bug report statistics
 */
export interface BugReportStats {
	totalReports: number;
	byTaskType: Record<string, number>;
	byErrorType: Record<string, number>;
	averageTime: number;
}

/**
 * Format bug report stats
 */
export function formatBugReportStats(stats: BugReportStats): string {
	const lines: string[] = [
		"## Bug Report Statistics",
		"",
		`**Total Reports:** ${stats.totalReports}`,
		"",
		"**By Task Type:**",
		...Object.entries(stats.byTaskType).map(([type, count]) => `- ${type}: ${count}`),
		"",
		"**By Error Type:**",
		...Object.entries(stats.byErrorType).map(([type, count]) => `- ${type}: ${count}`),
		"",
		`**Average Time:** ${stats.averageTime.toFixed(1)} minutes`,
	];

	return lines.join("\n");
}
