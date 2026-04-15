/**
 * Linting Manager Module
 *
 * Interactive linting with built-in linters for common languages,
 * auto-fix capabilities, and integration with the evolution workflow.
 *
 * Inspired by Aider's linting and testing integration pattern.
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// Types
export interface LinterConfig {
	id: string;
	name: string;
	language: string;
	command: string;
	args?: string[];
	fileExtensions: string[];
	autoFixCommand?: string;
	autoFixArgs?: string[];
	enabled: boolean;
	priority: number;
}

export interface LintError {
	file: string;
	line: number;
	column?: number;
	message: string;
	rule?: string;
	severity: "error" | "warning" | "info";
	linter: string;
	fixable: boolean;
}

export interface LintResult {
	file: string;
	errors: LintError[];
	fixed: number;
	unfixed: number;
	linter: string;
	duration: number;
}

export interface AutoFixResult {
	file: string;
	fixed: number;
	remaining: LintError[];
	changes: string[];
}

export interface LintingStats {
	totalRuns: number;
	totalErrors: number;
	totalFixed: number;
	byLanguage: Record<string, { runs: number; errors: number; fixed: number }>;
	byLinter: Record<string, { runs: number; errors: number; fixed: number }>;
	autoFixSuccessRate: number;
	lastRun: string;
}

export interface LintingConfig {
	enabled: boolean;
	autoLintAfterEdit: boolean;
	autoFix: boolean;
	runOnSave: boolean;
	lintersPath: string;
	minSeverity: "error" | "warning" | "info";
}

// Default linters for common languages
const DEFAULT_LINTERS: LinterConfig[] = [
	// TypeScript
	{
		id: "tsc",
		name: "TypeScript Compiler",
		language: "typescript",
		command: "npx",
		args: ["tsc", "--noEmit"],
		fileExtensions: [".ts", ".tsx"],
		autoFixCommand: "npx",
		autoFixArgs: ["tsc", "--noEmit", "--fix"],
		enabled: true,
		priority: 10,
	},
	{
		id: "eslint-ts",
		name: "ESLint for TypeScript",
		language: "typescript",
		command: "npx",
		args: ["eslint"],
		fileExtensions: [".ts", ".tsx"],
		autoFixCommand: "npx",
		autoFixArgs: ["eslint", "--fix"],
		enabled: true,
		priority: 9,
	},
	// JavaScript
	{
		id: "eslint-js",
		name: "ESLint for JavaScript",
		language: "javascript",
		command: "npx",
		args: ["eslint"],
		fileExtensions: [".js", ".jsx", ".mjs", ".cjs"],
		autoFixCommand: "npx",
		autoFixArgs: ["eslint", "--fix"],
		enabled: true,
		priority: 9,
	},
	// Python
	{
		id: "pylint",
		name: "Pylint",
		language: "python",
		command: "pylint",
		fileExtensions: [".py"],
		enabled: true,
		priority: 8,
	},
	{
		id: "mypy",
		name: "MyPy",
		language: "python",
		command: "mypy",
		fileExtensions: [".py"],
		enabled: true,
		priority: 9,
	},
	{
		id: "ruff",
		name: "Ruff",
		language: "python",
		command: "ruff",
		args: ["check"],
		fileExtensions: [".py"],
		autoFixCommand: "ruff",
		autoFixArgs: ["check", "--fix"],
		enabled: true,
		priority: 10,
	},
	// Rust
	{
		id: "cargo-clippy",
		name: "Clippy",
		language: "rust",
		command: "cargo",
		args: ["clippy", "--", "-D", "warnings"],
		fileExtensions: [".rs"],
		autoFixCommand: "cargo",
		autoFixArgs: ["clippy", "--fix", "--allow-dirty"],
		enabled: true,
		priority: 9,
	},
	// Go
	{
		id: "golangci-lint",
		name: "golangci-lint",
		language: "go",
		command: "golangci-lint",
		args: ["run"],
		fileExtensions: [".go"],
		autoFixCommand: "golangci-lint",
		autoFixArgs: ["run", "--fix"],
		enabled: true,
		priority: 9,
	},
	// JSON
	{
		id: "jsonlint",
		name: "JSON Lint",
		language: "json",
		command: "npx",
		args: ["jsonlint"],
		fileExtensions: [".json"],
		enabled: true,
		priority: 5,
	},
	// YAML
	{
		id: "yamllint",
		name: "YAML Lint",
		language: "yaml",
		command: "yamllint",
		fileExtensions: [".yaml", ".yml"],
		enabled: true,
		priority: 5,
	},
	// Markdown
	{
		id: "markdownlint",
		name: "Markdown Lint",
		language: "markdown",
		command: "npx",
		args: ["markdownlint"],
		fileExtensions: [".md"],
		autoFixCommand: "npx",
		autoFixArgs: ["markdownlint", "--fix"],
		enabled: true,
		priority: 4,
	},
];

// Auto-fix patterns for common lint errors
const AUTO_FIX_PATTERNS: Array<{
	pattern: RegExp;
	replacement: string;
	description: string;
	languages: string[];
}> = [
	// TypeScript/JavaScript
	{
		pattern: /(['"])use strict\1\s*;?\s*/g,
		replacement: "",
		description: "Remove unnecessary 'use strict' in ES modules",
		languages: ["typescript", "javascript"],
	},
	{
		pattern: /var\s+(\w+)\s*=/g,
		replacement: "const $1=",
		description: "Replace var with const",
		languages: ["typescript", "javascript"],
	},
	{
		pattern: /;(\s*})/g,
		replacement: "$1",
		description: "Remove unnecessary semicolons before closing braces",
		languages: ["typescript", "javascript"],
	},
	{
		pattern: /,\s*([}\]])/g,
		replacement: "$1",
		description: "Remove trailing commas",
		languages: ["typescript", "javascript", "json"],
	},
	// Python
	{
		pattern: /print\s+([^(])/g,
		replacement: "print($1",
		description: "Convert Python 2 print to Python 3",
		languages: ["python"],
	},
	// General
	{
		pattern: /\s+$/gm,
		replacement: "",
		description: "Remove trailing whitespace",
		languages: ["*"],
	},
	{
		pattern: /\t/g,
		replacement: "  ",
		description: "Convert tabs to spaces",
		languages: ["*"],
	},
];

const DEFAULT_CONFIG: LintingConfig = {
	enabled: true,
	autoLintAfterEdit: false,
	autoFix: true,
	runOnSave: false,
	lintersPath: "",
	minSeverity: "warning",
};

let managerInstance: LintingManager | null = null;

export class LintingManager {
	private config: LintingConfig;
	private linters: Map<string, LinterConfig> = new Map();
	private stats: LintingStats;
	private dataPath: string;

	constructor() {
		this.config = DEFAULT_CONFIG;
		const homeDir = process.env.HOME || ".";
		this.dataPath = path.join(homeDir, ".paimon", "linting-stats.json");
		this.stats = {
			totalRuns: 0,
			totalErrors: 0,
			totalFixed: 0,
			byLanguage: {},
			byLinter: {},
			autoFixSuccessRate: 0,
			lastRun: "",
		};

		this.loadDefaultLinters();
		this.loadConfig();
		this.loadStats();
	}

	private loadDefaultLinters(): void {
		for (const linter of DEFAULT_LINTERS) {
			this.linters.set(linter.id, linter);
		}
	}

	private loadConfig(): void {
		try {
			const homeDir = process.env.HOME || ".";
			const configPath = path.join(homeDir, ".paimon", "linting-config.json");
			if (fs.existsSync(configPath)) {
				const loaded = JSON.parse(fs.readFileSync(configPath, "utf-8"));
				this.config = { ...DEFAULT_CONFIG, ...loaded };
			}
		} catch {
			// Use defaults
		}
	}

	private loadStats(): void {
		try {
			if (fs.existsSync(this.dataPath)) {
				const data = JSON.parse(fs.readFileSync(this.dataPath, "utf-8"));
				this.stats = { ...this.stats, ...data };
			}
		} catch {
			// Start fresh
		}
	}

	private saveStats(): void {
		try {
			const dir = path.dirname(this.dataPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(this.dataPath, JSON.stringify(this.stats, null, 2));
		} catch (error) {
			console.error("Failed to save linting stats:", error);
		}
	}

	private updateStats(result: LintResult): void {
		this.stats.totalRuns++;
		this.stats.totalErrors += result.errors.length;
		this.stats.totalFixed += result.fixed;
		this.stats.lastRun = new Date().toISOString();

		const lang = this.linters.get(result.linter)?.language || "unknown";
		if (!this.stats.byLanguage[lang]) {
			this.stats.byLanguage[lang] = { runs: 0, errors: 0, fixed: 0 };
		}
		this.stats.byLanguage[lang].runs++;
		this.stats.byLanguage[lang].errors += result.errors.length;
		this.stats.byLanguage[lang].fixed += result.fixed;

		if (!this.stats.byLinter[result.linter]) {
			this.stats.byLinter[result.linter] = { runs: 0, errors: 0, fixed: 0 };
		}
		this.stats.byLinter[result.linter].runs++;
		this.stats.byLinter[result.linter].errors += result.errors.length;
		this.stats.byLinter[result.linter].fixed += result.fixed;

		if (this.stats.totalErrors > 0) {
			this.stats.autoFixSuccessRate = this.stats.totalFixed / this.stats.totalErrors;
		}

		this.saveStats();
	}

	public isEnabled(): boolean {
		return this.config.enabled;
	}

	public setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveStats();
	}

	public getConfig(): LintingConfig {
		return { ...this.config };
	}

	public updateConfig(updates: Partial<LintingConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveStats();
	}

	public getStats(): LintingStats {
		return { ...this.stats };
	}

	public resetStats(): void {
		this.stats = {
			totalRuns: 0,
			totalErrors: 0,
			totalFixed: 0,
			byLanguage: {},
			byLinter: {},
			autoFixSuccessRate: 0,
			lastRun: "",
		};
		this.saveStats();
	}

	// Linter management
	public getLinters(): LinterConfig[] {
		return Array.from(this.linters.values()).sort((a, b) => b.priority - a.priority);
	}

	public getLinter(id: string): LinterConfig | undefined {
		return this.linters.get(id);
	}

	public addLinter(linter: LinterConfig): void {
		this.linters.set(linter.id, linter);
	}

	public removeLinter(id: string): boolean {
		return this.linters.delete(id);
	}

	public enableLinter(id: string): boolean {
		const linter = this.linters.get(id);
		if (linter) {
			linter.enabled = true;
			return true;
		}
		return false;
	}

	public disableLinter(id: string): boolean {
		const linter = this.linters.get(id);
		if (linter) {
			linter.enabled = false;
			return true;
		}
		return false;
	}

	// Get linters for a specific file
	public getLintersForFile(filePath: string): LinterConfig[] {
		const ext = path.extname(filePath).toLowerCase();
		return this.getLinters().filter((l) => l.enabled && l.fileExtensions.includes(ext));
	}

	// Get linters by language
	public getLintersByLanguage(language: string): LinterConfig[] {
		return this.getLinters().filter(
			(l) => l.enabled && l.language.toLowerCase() === language.toLowerCase(),
		);
	}

	// Run linting on a file
	public runLinting(filePath: string, autoFix = false): LintResult[] {
		if (!this.config.enabled) {
			return [];
		}

		const results: LintResult[] = [];
		const linters = this.getLintersForFile(filePath);

		for (const linter of linters) {
			const result = this.runLinter(linter, filePath, autoFix);
			results.push(result);
			this.updateStats(result);
		}

		return results;
	}

	// Run a specific linter
	private runLinter(linter: LinterConfig, filePath: string, autoFix = false): LintResult {
		const startTime = Date.now();
		const result: LintResult = {
			file: filePath,
			errors: [],
			fixed: 0,
			unfixed: 0,
			linter: linter.id,
			duration: 0,
		};

		try {
			// Check if file exists
			if (!fs.existsSync(filePath)) {
				result.errors.push({
					file: filePath,
					line: 0,
					message: "File not found",
					severity: "error",
					linter: linter.id,
					fixable: false,
				});
				result.duration = Date.now() - startTime;
				return result;
			}

			// Run auto-fix if requested
			if (autoFix && linter.autoFixCommand) {
				const fixCmd = `${linter.autoFixCommand} ${(linter.autoFixArgs || []).join(" ")} "${filePath}"`;
				try {
					execSync(fixCmd, {
						cwd: path.dirname(filePath),
						encoding: "utf-8",
						stdio: ["pipe", "pipe", "pipe"],
						timeout: 30000,
					});
				} catch {
					// Fix may have partial success
				}
			}

			// Run linting command
			const cmd = `${linter.command} ${(linter.args || []).join(" ")} "${filePath}"`;
			const output = execSync(cmd, {
				cwd: path.dirname(filePath),
				encoding: "utf-8",
				stdio: ["pipe", "pipe", "pipe"],
				timeout: 30000,
			});

			// Parse output for errors
			result.errors = this.parseLinterOutput(output, linter.id, filePath);
			result.unfixed = result.errors.length;
		} catch (error: unknown) {
			// Linter may exit with non-zero on errors
			const execError = error as { stdout?: string; stderr?: string; message?: string };
			const output = execError.stdout || execError.stderr || execError.message || "";
			result.errors = this.parseLinterOutput(output, linter.id, filePath);
			result.unfixed = result.errors.length;
		}

		result.duration = Date.now() - startTime;
		return result;
	}

	// Parse linter output to extract errors
	private parseLinterOutput(output: string, linterId: string, filePath: string): LintError[] {
		const errors: LintError[] = [];
		const lines = output.split("\n");

		for (const line of lines) {
			// Try different error patterns
			let match: RegExpMatchArray | null;

			// Pattern: file:line:column: message
			match = line.match(/^(.+?):(\d+):(\d+):\s*(.+)$/);
			if (match) {
				errors.push({
					file: match[1] || filePath,
					line: Number.parseInt(match[2], 10),
					column: Number.parseInt(match[3], 10),
					message: match[4] || line,
					severity: line.toLowerCase().includes("error") ? "error" : "warning",
					linter: linterId,
					fixable: this.isFixable(match[4] || ""),
				});
				continue;
			}

			// Pattern: file:line: message
			match = line.match(/^(.+?):(\d+):\s*(.+)$/);
			if (match) {
				errors.push({
					file: match[1] || filePath,
					line: Number.parseInt(match[2], 10),
					message: match[3] || line,
					severity: line.toLowerCase().includes("error") ? "error" : "warning",
					linter: linterId,
					fixable: this.isFixable(match[3] || ""),
				});
				continue;
			}

			// Pattern: error/warning: message
			match = line.match(/^(error|warning|info):\s*(.+)$/i);
			if (match) {
				errors.push({
					file: filePath,
					line: 0,
					message: match[2] || line,
					severity: (match[1]?.toLowerCase() || "warning") as "error" | "warning" | "info",
					linter: linterId,
					fixable: this.isFixable(match[2] || ""),
				});
				continue;
			}

			// Pattern: E/W/I: message (like pylint)
			match = line.match(/^([EWIF])(\d+):\s*(.+)$/);
			if (match) {
				errors.push({
					file: filePath,
					line: 0,
					message: match[3] || line,
					rule: match[1] + match[2],
					severity: match[1] === "E" ? "error" : match[1] === "W" ? "warning" : "info",
					linter: linterId,
					fixable: this.isFixable(match[3] || ""),
				});
			}
		}

		return errors;
	}

	// Check if an error is fixable
	private isFixable(message: string): boolean {
		const fixablePatterns = [
			/unused/i,
			/missing semicolon/i,
			/trailing/i,
			/prefer const/i,
			/prefer-const/i,
			/no-unused/i,
			/indent/i,
			/space/i,
			/quote/i,
			/comma/i,
		];

		return fixablePatterns.some((p) => p.test(message));
	}

	// Apply auto-fix patterns to content
	public applyAutoFixPatterns(
		content: string,
		language: string,
	): { content: string; changes: string[] } {
		const changes: string[] = [];
		let newContent = content;

		for (const pattern of AUTO_FIX_PATTERNS) {
			if (pattern.languages.includes("*") || pattern.languages.includes(language)) {
				const matches = content.match(pattern.pattern);
				if (matches && matches.length > 0) {
					newContent = newContent.replace(pattern.pattern, pattern.replacement);
					changes.push(pattern.description);
				}
			}
		}

		return { content: newContent, changes };
	}

	// Run auto-fix on multiple files
	public runAutoFix(files: string[]): AutoFixResult[] {
		const results: AutoFixResult[] = [];

		for (const file of files) {
			const lintResults = this.runLinting(file, true);
			const fileResult: AutoFixResult = {
				file,
				fixed: 0,
				remaining: [],
				changes: [],
			};

			for (const result of lintResults) {
				fileResult.fixed += result.fixed;
				fileResult.remaining.push(...result.errors);
			}

			results.push(fileResult);
		}

		return results;
	}

	// Check if auto-lint after edit is enabled
	public shouldAutoLintAfterEdit(): boolean {
		return this.config.enabled && this.config.autoLintAfterEdit;
	}

	// Run linting on directory
	public runLintingOnDirectory(dirPath: string, recursive = true): Map<string, LintResult[]> {
		const results = new Map<string, LintResult[]>();

		try {
			const files = fs.readdirSync(dirPath, { withFileTypes: true });

			for (const file of files) {
				const fullPath = path.join(dirPath, file.name);

				if (file.isDirectory() && recursive && !file.name.startsWith(".")) {
					const subResults = this.runLintingOnDirectory(fullPath, true);
					for (const [filePath, result] of subResults) {
						results.set(filePath, result);
					}
				} else if (file.isFile()) {
					const ext = path.extname(file.name);
					const linters = this.getLintersForFile(fullPath);
					if (linters.length > 0) {
						const result = this.runLinting(fullPath);
						if (result.length > 0) {
							results.set(fullPath, result);
						}
					}
				}
			}
		} catch (error) {
			console.error(`Failed to lint directory ${dirPath}:`, error);
		}

		return results;
	}

	// Format lint results for display
	public formatResults(results: LintResult[]): string {
		if (results.length === 0) {
			return "✅ No lint errors found";
		}

		const lines: string[] = ["## Linting Results\n"];

		for (const result of results) {
			if (result.errors.length === 0 && result.fixed === 0) {
				continue;
			}

			lines.push(`### ${result.file}`);
			lines.push(`- Linter: ${result.linter}`);
			lines.push(`- Errors: ${result.errors.length}`);
			lines.push(`- Fixed: ${result.fixed}`);
			lines.push(`- Duration: ${result.duration}ms`);
			lines.push("");

			if (result.errors.length > 0) {
				lines.push("#### Errors:");
				for (const error of result.errors) {
					const loc =
						error.line > 0 ? `:${error.line}${error.column ? `:${error.column}` : ""}` : "";
					lines.push(`- ${error.file}${loc}: ${error.message} [${error.severity}]`);
				}
				lines.push("");
			}
		}

		return lines.join("\n");
	}

	// Help message
	public getHelp(): string {
		return `
# Linting Manager

Interactive linting with built-in linters for common languages.

## Available Actions

- **run** - Run linting on a file or directory
- **auto-fix** - Run linting with auto-fix enabled
- **linters** - List all available linters
- **linter** - Get details of a specific linter
- **add-linter** - Add a custom linter
- **remove-linter** - Remove a linter
- **enable** - Enable linting
- **disable** - Disable linting
- **config** - View or update configuration
- **stats** - View linting statistics
- **reset** - Reset statistics
- **help** - Show this help message

## Built-in Linters

- **TypeScript**: tsc, eslint-ts
- **JavaScript**: eslint-js
- **Python**: pylint, mypy, ruff
- **Rust**: cargo-clippy
- **Go**: golangci-lint
- **JSON**: jsonlint
- **YAML**: yamllint
- **Markdown**: markdownlint

## Configuration Options

- **enabled**: Enable/disable linting (default: true)
- **autoLintAfterEdit**: Auto-lint after each edit (default: false)
- **autoFix**: Enable auto-fix when possible (default: true)
- **minSeverity**: Minimum severity level to report (default: warning)

## Example Usage

\`\`\`
// Run linting on a file
linting({action: 'run', files: ['src/agent.ts']})

// Run with auto-fix
linting({action: 'auto-fix', files: ['src/**/*.ts']})

// List available linters
linting({action: 'linters'})

// Add custom linter
linting({action: 'add-linter', linter: {...}})
\`\`\`
`.trim();
	}
}

// Singleton instance
export function getLintingManager(): LintingManager {
	if (!managerInstance) {
		managerInstance = new LintingManager();
	}
	return managerInstance;
}

// Tool interface
export interface LintingToolArgs {
	action:
		| "run"
		| "auto-fix"
		| "linters"
		| "linter"
		| "add-linter"
		| "remove-linter"
		| "enable"
		| "disable"
		| "config"
		| "stats"
		| "reset"
		| "help";
	files?: string[];
	linterId?: string;
	linter?: Partial<LinterConfig>;
	config?: Partial<LintingConfig>;
	directory?: string;
	recursive?: boolean;
}

export function lintingTool(args: LintingToolArgs): string {
	const manager = getLintingManager();

	switch (args.action) {
		case "run": {
			if (!args.files || args.files.length === 0) {
				return "Error: No files specified for linting. Use 'files' parameter.";
			}

			const allResults: LintResult[] = [];
			for (const file of args.files) {
				const results = manager.runLinting(file, false);
				allResults.push(...results);
			}

			return manager.formatResults(allResults);
		}

		case "auto-fix": {
			if (!args.files || args.files.length === 0) {
				return "Error: No files specified for auto-fix. Use 'files' parameter.";
			}

			const results = manager.runAutoFix(args.files);
			const lines: string[] = ["## Auto-Fix Results\n"];

			for (const result of results) {
				if (result.fixed > 0 || result.remaining.length > 0) {
					lines.push(`### ${result.file}`);
					lines.push(`- Fixed: ${result.fixed} errors`);
					lines.push(`- Remaining: ${result.remaining.length} errors`);

					if (result.changes.length > 0) {
						lines.push("- Changes:");
						for (const change of result.changes) {
							lines.push(`  - ${change}`);
						}
					}
					lines.push("");
				}
			}

			return lines.join("\n");
		}

		case "linters": {
			const linters = manager.getLinters();
			const lines: string[] = ["## Available Linters\n"];

			// Group by language
			const byLanguage: Record<string, LinterConfig[]> = {};
			for (const linter of linters) {
				if (!byLanguage[linter.language]) {
					byLanguage[linter.language] = [];
				}
				byLanguage[linter.language].push(linter);
			}

			for (const [lang, langLinters] of Object.entries(byLanguage)) {
				lines.push(`### ${lang}`);
				for (const linter of langLinters) {
					const status = linter.enabled ? "✅" : "❌";
					const autoFix = linter.autoFixCommand ? " [auto-fix]" : "";
					lines.push(`- ${status} **${linter.id}**: ${linter.name}${autoFix}`);
				}
				lines.push("");
			}

			return lines.join("\n");
		}

		case "linter": {
			if (!args.linterId) {
				return "Error: No linter ID specified. Use 'linterId' parameter.";
			}

			const linter = manager.getLinter(args.linterId);
			if (!linter) {
				return `Error: Linter '${args.linterId}' not found.`;
			}

			const lines: string[] = [`## Linter: ${linter.name}\n`];
			lines.push(`- **ID**: ${linter.id}`);
			lines.push(`- **Language**: ${linter.language}`);
			lines.push(`- **Command**: ${linter.command} ${(linter.args || []).join(" ")}`);
			lines.push(`- **Extensions**: ${linter.fileExtensions.join(", ")}`);
			lines.push(`- **Enabled**: ${linter.enabled ? "Yes" : "No"}`);
			lines.push(`- **Priority**: ${linter.priority}`);

			if (linter.autoFixCommand) {
				lines.push(
					`- **Auto-fix**: ${linter.autoFixCommand} ${(linter.autoFixArgs || []).join(" ")}`,
				);
			}

			return lines.join("\n");
		}

		case "add-linter": {
			if (!args.linter) {
				return "Error: No linter configuration provided. Use 'linter' parameter.";
			}

			const newLinter: LinterConfig = {
				id: args.linter.id || `custom-${Date.now()}`,
				name: args.linter.name || "Custom Linter",
				language: args.linter.language || "unknown",
				command: args.linter.command || "",
				args: args.linter.args || [],
				fileExtensions: args.linter.fileExtensions || [],
				autoFixCommand: args.linter.autoFixCommand,
				autoFixArgs: args.linter.autoFixArgs,
				enabled: args.linter.enabled ?? true,
				priority: args.linter.priority ?? 5,
			};

			manager.addLinter(newLinter);
			return `✅ Added linter '${newLinter.id}' for ${newLinter.language}`;
		}

		case "remove-linter": {
			if (!args.linterId) {
				return "Error: No linter ID specified. Use 'linterId' parameter.";
			}

			if (manager.removeLinter(args.linterId)) {
				return `✅ Removed linter '${args.linterId}'`;
			}
			return `Error: Linter '${args.linterId}' not found.`;
		}

		case "enable": {
			manager.setEnabled(true);
			return "✅ Linting enabled";
		}

		case "disable": {
			manager.setEnabled(false);
			return "❌ Linting disabled";
		}

		case "config": {
			if (args.config) {
				manager.updateConfig(args.config);
				return "✅ Updated configuration";
			}

			const config = manager.getConfig();
			const lines: string[] = ["## Linting Configuration\n"];
			lines.push(`- **Enabled**: ${config.enabled}`);
			lines.push(`- **Auto-lint after edit**: ${config.autoLintAfterEdit}`);
			lines.push(`- **Auto-fix**: ${config.autoFix}`);
			lines.push(`- **Min severity**: ${config.minSeverity}`);

			return lines.join("\n");
		}

		case "stats": {
			const stats = manager.getStats();
			const lines: string[] = ["## Linting Statistics\n"];
			lines.push(`- **Total runs**: ${stats.totalRuns}`);
			lines.push(`- **Total errors**: ${stats.totalErrors}`);
			lines.push(`- **Total fixed**: ${stats.totalFixed}`);
			lines.push(`- **Auto-fix success rate**: ${(stats.autoFixSuccessRate * 100).toFixed(1)}%`);
			lines.push(`- **Last run**: ${stats.lastRun || "Never"}`);

			if (Object.keys(stats.byLanguage).length > 0) {
				lines.push("\n### By Language");
				for (const [lang, data] of Object.entries(stats.byLanguage)) {
					lines.push(
						`- **${lang}**: ${data.runs} runs, ${data.errors} errors, ${data.fixed} fixed`,
					);
				}
			}

			return lines.join("\n");
		}

		case "reset": {
			manager.resetStats();
			return "✅ Statistics reset";
		}

		case "help": {
			return manager.getHelp();
		}

		default:
			return `Unknown action: ${args.action}. Use 'help' to see available actions.`;
	}
}
