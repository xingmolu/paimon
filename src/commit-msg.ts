/**
 * Auto-commit message generation (Aider pattern).
 *
 * Generates conventional commit messages from git diffs using LLM analysis.
 * This improves commit history quality for self-evolution debugging and tracking.
 *
 * Based on Aider's commit message generation system.
 */

import { execSync } from "node:child_process";
import type { Api, Model } from "@mariozechner/pi-ai";

/**
 * Conventional commit types.
 */
export type CommitType =
	| "feat"
	| "fix"
	| "build"
	| "chore"
	| "ci"
	| "docs"
	| "style"
	| "refactor"
	| "perf"
	| "test";

/**
 * Commit message generated from diff analysis.
 */
export interface GeneratedCommitMessage {
	type: CommitType;
	scope?: string;
	description: string;
	fullMessage: string;
	confidence: number;
	filesChanged: string[];
	linesAdded: number;
	linesRemoved: number;
}

/**
 * Diff statistics for a commit.
 */
export interface DiffStats {
	files: string[];
	linesAdded: number;
	linesRemoved: number;
	diffContent: string;
}

/**
 * Configuration for commit message generation.
 */
export interface CommitMsgConfig {
	/** Maximum characters for commit message (default: 72) */
	maxLength: number;
	/** Model to use for generation (optional, falls back to simple rules) */
	model?: Model<Api>;
	/** API key getter for LLM calls */
	getApiKey?: () => string | null;
	/** Include scope in commit message */
	includeScope: boolean;
}

/**
 * Default configuration.
 */
export const DEFAULT_COMMIT_MSG_CONFIG: CommitMsgConfig = {
	maxLength: 72,
	includeScope: true,
};

/**
 * Commit message generator using Aider pattern.
 */
export class CommitMessageGenerator {
	private config: CommitMsgConfig;

	constructor(config: Partial<CommitMsgConfig> = {}) {
		this.config = { ...DEFAULT_COMMIT_MSG_CONFIG, ...config };
	}

	/**
	 * Set the model for LLM-based generation.
	 */
	setModel(model: Model<Api>): void {
		this.config.model = model;
	}

	/**
	 * Set the API key getter.
	 */
	setApiKeyGetter(getter: () => string | null): void {
		this.config.getApiKey = getter;
	}

	/**
	 * Get git diff for staged changes.
	 */
	getStagedDiff(): DiffStats | null {
		try {
			const diffContent = execSync("git diff --cached", {
				encoding: "utf-8",
				maxBuffer: 10 * 1024 * 1024,
			});

			if (!diffContent.trim()) {
				return null;
			}

			return this.parseDiff(diffContent);
		} catch {
			return null;
		}
	}

	/**
	 * Get git diff for unstaged changes.
	 */
	getUnstagedDiff(): DiffStats | null {
		try {
			const diffContent = execSync("git diff", {
				encoding: "utf-8",
				maxBuffer: 10 * 1024 * 1024,
			});

			if (!diffContent.trim()) {
				return null;
			}

			return this.parseDiff(diffContent);
		} catch {
			return null;
		}
	}

	/**
	 * Get git diff for all changes (staged + unstaged).
	 */
	getAllDiff(): DiffStats | null {
		const staged = this.getStagedDiff();
		const unstaged = this.getUnstagedDiff();

		if (!staged && !unstaged) {
			return null;
		}

		if (!staged) return unstaged;
		if (!unstaged) return staged;

		// Combine both diffs
		return {
			files: [...new Set([...staged.files, ...unstaged.files])],
			linesAdded: staged.linesAdded + unstaged.linesAdded,
			linesRemoved: staged.linesRemoved + unstaged.linesRemoved,
			diffContent: `${staged.diffContent}\n${unstaged.diffContent}`,
		};
	}

	/**
	 * Parse diff content to extract statistics.
	 */
	private parseDiff(diffContent: string): DiffStats {
		const files: string[] = [];
		let linesAdded = 0;
		let linesRemoved = 0;

		// Parse files from diff headers
		const fileMatches = diffContent.matchAll(/^diff --git a\/(.+) b\/(.+)$/gm);
		for (const match of fileMatches) {
			files.push(match[2]); // Use the 'b/' path (destination)
		}

		// Count added/removed lines (exclude diff headers)
		const lines = diffContent.split("\n");
		for (const line of lines) {
			if (line.startsWith("+") && !line.startsWith("++")) {
				linesAdded++;
			} else if (line.startsWith("-") && !line.startsWith("--")) {
				linesRemoved++;
			}
		}

		return {
			files,
			linesAdded,
			linesRemoved,
			diffContent,
		};
	}

	/**
	 * Generate commit message from diff.
	 */
	async generate(diff?: DiffStats): Promise<GeneratedCommitMessage | null> {
		const diffStats = diff || this.getStagedDiff();

		if (!diffStats || diffStats.files.length === 0) {
			return null;
		}

		// Try LLM-based generation first
		if (this.config.model && this.config.getApiKey) {
			const llmMessage = await this.generateWithLLM(diffStats);
			if (llmMessage) {
				return llmMessage;
			}
		}

		// Fall back to rule-based generation
		return this.generateWithRules(diffStats);
	}

	/**
	 * Generate commit message using LLM (Aider pattern).
	 */
	private async generateWithLLM(diffStats: DiffStats): Promise<GeneratedCommitMessage | null> {
		if (!this.config.model || !this.config.getApiKey) {
			return null;
		}

		const apiKey = this.config.getApiKey();
		if (!apiKey) {
			return null;
		}

		// Truncate diff if too large
		const maxDiffTokens = 8000;
		let diffContent = diffStats.diffContent;
		if (diffContent.length > maxDiffTokens * 4) {
			diffContent = `${diffContent.slice(0, maxDiffTokens * 4)}\n... (diff truncated)`;
		}

		const prompt = `You are an expert software engineer that generates concise, one-line Git commit messages based on the provided diffs.
Review the diffs carefully.
Generate a one-line commit message for those changes.
The commit message should be structured as follows: <type>: <description>
Use these for <type>: fix, feat, build, chore, ci, docs, style, refactor, perf, test

Ensure the commit message:
- Starts with the appropriate prefix.
- Is in the imperative mood (e.g., "add feature" not "added feature" or "adding feature").
- Does not exceed 72 characters.

Reply only with the one-line commit message, without any additional text, explanations, or line breaks.

Files changed: ${diffStats.files.join(", ")}
Lines added: ${diffStats.linesAdded}, removed: ${diffStats.linesRemoved}

Diff:
${diffContent}`;

		try {
			const response = await fetch(`${this.config.model.baseUrl}/chat/completions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model: this.config.model.id,
					messages: [{ role: "user", content: prompt }],
					max_tokens: 100,
					temperature: 0.3,
				}),
			});

			if (!response.ok) {
				throw new Error(`API error: ${response.status}`);
			}

			const data = (await response.json()) as {
				choices?: Array<{ message?: { content?: unknown } }>;
			};
			const content = data.choices?.[0]?.message?.content;
			if (typeof content !== "string") {
				return null;
			}

			// Parse the LLM response
			return this.parseCommitMessage(content, diffStats, 95);
		} catch (error) {
			console.error("[CommitMsg] LLM generation error:", error);
			return null;
		}
	}

	/**
	 * Generate commit message using simple rules (fallback).
	 */
	private generateWithRules(diffStats: DiffStats): GeneratedCommitMessage {
		const type = this.detectCommitType(diffStats);
		const scope = this.detectScope(diffStats);
		const description = this.generateDescription(diffStats, type);

		let fullMessage = `${type}: ${description}`;
		if (scope && this.config.includeScope) {
			fullMessage = `${type}(${scope}): ${description}`;
		}

		// Truncate to max length
		if (fullMessage.length > this.config.maxLength) {
			fullMessage = `${fullMessage.slice(0, this.config.maxLength - 3)}...`;
		}

		return {
			type,
			scope,
			description,
			fullMessage,
			confidence: 70,
			filesChanged: diffStats.files,
			linesAdded: diffStats.linesAdded,
			linesRemoved: diffStats.linesRemoved,
		};
	}

	/**
	 * Detect commit type from diff patterns.
	 */
	private detectCommitType(diffStats: DiffStats): CommitType {
		const { files, diffContent } = diffStats;

		// Check for test files
		if (files.some((f) => f.includes(".test.") || f.includes("_test.") || f.includes("test/"))) {
			return "test";
		}

		// Check for CI/workflow files
		if (files.some((f) => f.includes(".github/") || f.includes("workflow") || f.includes("ci"))) {
			return "ci";
		}

		// Check for docs
		if (files.some((f) => f.endsWith(".md") || f.includes("docs/") || f.startsWith("README"))) {
			return "docs";
		}

		// Check for build/package files
		if (
			files.some(
				(f) =>
					f === "package.json" ||
					f === "package-lock.json" ||
					f === "tsconfig.json" ||
					f === "biome.json" ||
					f.endsWith(".toml"),
			)
		) {
			return "build";
		}

		// Check for style changes (no logic changes)
		if (
			diffContent.includes("format") ||
			diffContent.includes("indent") ||
			diffContent.includes("whitespace") ||
			(diffStats.linesAdded > 0 && diffStats.linesRemoved > 0 && !this.hasLogicChanges(diffContent))
		) {
			return "style";
		}

		// Check for performance improvements
		if (
			diffContent.includes("perf") ||
			diffContent.includes("optimize") ||
			diffContent.includes("cache") ||
			diffContent.includes("benchmark")
		) {
			return "perf";
		}

		// Check for fix patterns
		if (
			diffContent.includes("fix") ||
			diffContent.includes("bug") ||
			diffContent.includes("error") ||
			diffContent.includes("catch") ||
			diffContent.includes("handle")
		) {
			return "fix";
		}

		// Check for refactor patterns
		if (
			diffContent.includes("refactor") ||
			diffContent.includes("extract") ||
			diffContent.includes("move") ||
			diffContent.includes("rename") ||
			(diffStats.linesAdded > 0 && diffStats.linesRemoved > 0 && files.length === 1)
		) {
			return "refactor";
		}

		// Default to feat for new functionality
		if (diffStats.linesAdded > diffStats.linesRemoved * 2) {
			return "feat";
		}

		// Default to chore for misc changes
		return "chore";
	}

	/**
	 * Check if diff has logic changes.
	 */
	private hasLogicChanges(diffContent: string): boolean {
		// Look for function/class/interface changes
		const logicPatterns = [
			/function\s+\w+/,
			/class\s+\w+/,
			/interface\s+\w+/,
			/export\s+/,
			/import\s+/,
			/const\s+\w+\s*=/,
			/let\s+\w+\s*=/,
			/if\s*\(/,
			/for\s*\(/,
			/while\s*\(/,
			/return\s+/,
		];

		for (const pattern of logicPatterns) {
			if (pattern.test(diffContent)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Detect scope from file paths.
	 */
	private detectScope(diffStats: DiffStats): string | undefined {
		const files = diffStats.files;

		if (files.length === 0) {
			return undefined;
		}

		// Common scope patterns
		const scopePatterns: Record<string, string> = {
			"src/tools/": "tools",
			"src/skills/": "skills",
			"skills/": "skills",
			"src/": "core",
			"dist/": "build",
			"data/": "data",
			".github/": "ci",
		};

		for (const [pattern, scope] of Object.entries(scopePatterns)) {
			if (files.every((f) => f.startsWith(pattern) || f.includes(pattern))) {
				return scope;
			}
		}

		// Single file scope
		if (files.length === 1) {
			const file = files[0];
			const basename = file.split("/").pop()?.split(".")[0];
			return basename;
		}

		return undefined;
	}

	/**
	 * Generate description from diff.
	 */
	private generateDescription(diffStats: DiffStats, type: CommitType): string {
		const { files } = diffStats;

		// For single file, use file name
		if (files.length === 1) {
			const basename = files[0].split("/").pop()?.split(".")[0];
			if (type === "feat") {
				return `add ${basename}`;
			}
			if (type === "fix") {
				return `fix ${basename}`;
			}
			if (type === "refactor") {
				return `refactor ${basename}`;
			}
			return `update ${basename}`;
		}

		// For multiple files, summarize
		if (files.length <= 3) {
			const scopes = files.map((f) => f.split("/").pop()?.split(".")[0]).filter(Boolean);
			const summary = scopes.join(", ");
			if (type === "feat") {
				return `add ${summary}`;
			}
			if (type === "fix") {
				return `fix ${summary}`;
			}
			if (type === "refactor") {
				return `refactor ${summary}`;
			}
			return `update ${summary}`;
		}

		// For many files, use generic description
		if (type === "feat") {
			return `add ${files.length} new features`;
		}
		if (type === "fix") {
			return `fix issues in ${files.length} files`;
		}
		if (type === "refactor") {
			return `refactor ${files.length} files`;
		}

		return `update ${files.length} files`;
	}

	/**
	 * Parse LLM response into commit message.
	 */
	private parseCommitMessage(
		response: string,
		diffStats: DiffStats,
		confidence: number,
	): GeneratedCommitMessage | null {
		// Extract conventional commit format: type(scope): description or type: description
		const match = response.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);
		if (!match) {
			// Try to parse as plain description
			return {
				type: "chore",
				description: response.slice(0, 60),
				fullMessage: `chore: ${response.slice(0, 60)}`,
				confidence: 50,
				filesChanged: diffStats.files,
				linesAdded: diffStats.linesAdded,
				linesRemoved: diffStats.linesRemoved,
			};
		}

		const [, type, scope, description] = match;

		// Validate type
		const validTypes: CommitType[] = [
			"feat",
			"fix",
			"build",
			"chore",
			"ci",
			"docs",
			"style",
			"refactor",
			"perf",
			"test",
		];
		const commitType = validTypes.includes(type as CommitType) ? (type as CommitType) : "chore";

		let fullMessage = `${commitType}: ${description}`;
		if (scope) {
			fullMessage = `${commitType}(${scope}): ${description}`;
		}

		return {
			type: commitType,
			scope,
			description,
			fullMessage,
			confidence,
			filesChanged: diffStats.files,
			linesAdded: diffStats.linesAdded,
			linesRemoved: diffStats.linesRemoved,
		};
	}

	/**
	 * Generate and apply commit message directly.
	 */
	async generateAndCommit(): Promise<string | null> {
		const message = await this.generate();
		if (!message) {
			return null;
		}

		try {
			execSync(`git commit -m "${message.fullMessage}"`, { encoding: "utf-8" });
			return message.fullMessage;
		} catch {
			return null;
		}
	}
}

// Global instance
let generator: CommitMessageGenerator | null = null;

/**
 * Get the global commit message generator.
 */
export function getCommitMessageGenerator(
	config?: Partial<CommitMsgConfig>,
): CommitMessageGenerator {
	if (!generator) {
		generator = new CommitMessageGenerator(config);
	}
	return generator;
}

/**
 * Format generated commit message for display.
 */
export function formatCommitMessage(msg: GeneratedCommitMessage): string {
	const lines = [
		"## Generated Commit Message",
		`**Message:** ${msg.fullMessage}`,
		`**Type:** ${msg.type}`,
		`**Confidence:** ${msg.confidence}%`,
		`**Files:** ${msg.filesChanged.length} (${msg.filesChanged.slice(0, 3).join(", ")}${msg.filesChanged.length > 3 ? ", ..." : ""})`,
		`**Changes:** +${msg.linesAdded} -${msg.linesRemoved}`,
	];

	return lines.join("\n");
}

/**
 * Tool implementation for commit message generation.
 */
export async function commitMsgTool(args: {
	action: "generate" | "stats" | "commit" | "preview";
	diffType?: "staged" | "unstaged" | "all";
}): Promise<string> {
	const gen = getCommitMessageGenerator();

	switch (args.action) {
		case "generate": {
			const diff =
				args.diffType === "unstaged"
					? gen.getUnstagedDiff()
					: args.diffType === "all"
						? gen.getAllDiff()
						: gen.getStagedDiff();

			if (!diff) {
				return "No changes to generate commit message from.";
			}

			const msg = await gen.generate(diff);
			if (!msg) {
				return "Failed to generate commit message.";
			}

			return formatCommitMessage(msg);
		}

		case "stats": {
			const staged = gen.getStagedDiff();
			const unstaged = gen.getUnstagedDiff();

			const stats = [
				"## Git Diff Statistics",
				"",
				"### Staged Changes",
				staged
					? `- Files: ${staged.files.length}\n- Lines: +${staged.linesAdded} -${staged.linesRemoved}`
					: "No staged changes",
				"",
				"### Unstaged Changes",
				unstaged
					? `- Files: ${unstaged.files.length}\n- Lines: +${unstaged.linesAdded} -${unstaged.linesRemoved}`
					: "No unstaged changes",
			];

			return stats.join("\n");
		}

		case "preview": {
			// Preview what the commit message would look like
			const previewDiff = gen.getStagedDiff();
			if (!previewDiff) {
				return "No staged changes. Stage changes first with `git add`.";
			}

			const previewMsg = await gen.generate(previewDiff);
			if (!previewMsg) {
				return "Failed to preview commit message.";
			}

			return [
				"## Commit Message Preview",
				"",
				"```",
				previewMsg.fullMessage,
				"```",
				"",
				"**Analysis:**",
				`- Type: ${previewMsg.type}`,
				`- Scope: ${previewMsg.scope || "none"}`,
				`- Confidence: ${previewMsg.confidence}%`,
				`- Files changed: ${previewMsg.filesChanged.join(", ")}`,
			].join("\n");
		}

		case "commit": {
			const commitResult = await gen.generateAndCommit();
			if (!commitResult) {
				return "Failed to commit. Make sure there are staged changes.";
			}
			return `Successfully committed with message: "${commitResult}"`;
		}

		default:
			return "Unknown action. Use: generate, stats, preview, or commit";
	}
}
