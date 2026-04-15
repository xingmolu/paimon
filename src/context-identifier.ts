/**
 * Context Identifier Module (Aider Pattern)
 *
 * Automatically identifies which files need to be edited for a given request.
 * Analyzes task descriptions, codebase structure, and symbol relationships
 * to suggest relevant files before starting implementation.
 *
 * Inspired by Aider's /context command:
 * https://aider.chat/docs/usage/commands.html#context
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// Types
export interface FileSuggestion {
	path: string;
	relevance: number; // 0-1
	reason: string;
	symbols: string[];
	category: "primary" | "secondary" | "reference";
}

export interface SymbolInfo {
	name: string;
	type: "class" | "function" | "interface" | "type" | "variable" | "constant";
	file: string;
	line?: number;
	description?: string;
}

export interface ContextAnalysis {
	taskDescription: string;
	suggestedFiles: FileSuggestion[];
	relevantSymbols: SymbolInfo[];
	confidence: number; // 0-1
	reasoning: string;
}

export interface ContextIdentifierConfig {
	enabled: boolean;
	maxSuggestions: number;
	minRelevance: number;
	includeTests: boolean;
	includeConfigs: boolean;
}

export interface ContextIdentifierStats {
	totalAnalyses: number;
	filesSuggested: number;
	primaryFilesSuggested: number;
	avgConfidence: number;
	topCategories: { category: string; count: number }[];
}

const DEFAULT_CONFIG: ContextIdentifierConfig = {
	enabled: true,
	maxSuggestions: 10,
	minRelevance: 0.3,
	includeTests: false,
	includeConfigs: true,
};

// Keyword patterns for different types of tasks
const TASK_PATTERNS: Record<string, string[]> = {
	// File type patterns
	typescript: [".ts", ".tsx", "typescript", "ts"],
	javascript: [".js", ".jsx", "javascript", "js"],
	python: [".py", "python"],
	rust: [".rs", "rust"],
	go: [".go", "golang"],
	// Feature patterns
	tool: ["tool", "command", "action", "execute"],
	hook: ["hook", "pretooluse", "posttooluse", "sessionstart", "stop"],
	skill: ["skill", "workflow", "guide"],
	module: ["module", "manager", "service"],
	test: ["test", "spec", "coverage"],
	config: ["config", "settings", "options"],
	// Architecture patterns
	api: ["api", "endpoint", "route", "handler"],
	ui: ["ui", "component", "frontend", "css", "html"],
	database: ["database", "db", "sql", "query", "model"],
	// Operation patterns
	add: ["add", "create", "new", "implement"],
	fix: ["fix", "bug", "error", "issue", "resolve"],
	update: ["update", "modify", "change", "edit"],
	remove: ["remove", "delete", "deprecate"],
	refactor: ["refactor", "restructure", "reorganize"],
};

// Symbol patterns for different file types
const SYMBOL_PATTERNS: Record<string, RegExp> = {
	typescript:
		/(?:export\s+)?(?:class|function|interface|type|const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)/g,
	javascript: /(?:export\s+)?(?:class|function|const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)/g,
	python: /(?:class|def)\s+([A-Za-z_][A-Za-z0-9_]*)/g,
	rust: /(?:pub\s+)?(?:struct|enum|fn|trait|impl)\s+([A-Za-z_][A-Za-z0-9_]*)/g,
	go: /(?:func|type|struct|interface)\s+([A-Za-z_][A-Za-z0-9_]*)/g,
};

let managerInstance: ContextIdentifierManager | null = null;

export class ContextIdentifierManager {
	private config: ContextIdentifierConfig;
	private stats: ContextIdentifierStats;
	private dataPath: string;
	private symbolCache: Map<string, SymbolInfo[]> = new Map();
	private fileContentCache: Map<string, string> = new Map();

	constructor() {
		this.config = DEFAULT_CONFIG;
		const homeDir = process.env.HOME || ".";
		this.dataPath = path.join(homeDir, ".paimon", "context-identifier.json");
		this.stats = {
			totalAnalyses: 0,
			filesSuggested: 0,
			primaryFilesSuggested: 0,
			avgConfidence: 0,
			topCategories: [],
		};
		this.loadData();
	}

	private loadData(): void {
		try {
			if (fs.existsSync(this.dataPath)) {
				const data = JSON.parse(fs.readFileSync(this.dataPath, "utf-8"));
				this.config = { ...DEFAULT_CONFIG, ...data.config };
				this.stats = { ...this.stats, ...data.stats };
			}
		} catch {
			// Use defaults
		}
	}

	private saveData(): void {
		try {
			const dir = path.dirname(this.dataPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(
				this.dataPath,
				JSON.stringify(
					{
						config: this.config,
						stats: this.stats,
					},
					null,
					2,
				),
			);
		} catch (error) {
			console.error("Failed to save context identifier data:", error);
		}
	}

	// Analyze task description to extract keywords and patterns
	private extractKeywords(taskDescription: string): string[] {
		const keywords: string[] = [];
		const lowerDesc = taskDescription.toLowerCase();

		// Extract words
		const words = lowerDesc.match(/\b[a-z][a-z0-9_-]*\b/g) || [];
		keywords.push(...words);

		// Extract file references
		const fileRefs = taskDescription.match(/[a-zA-Z0-9_/.-]+\.[a-z]{1,4}/g) || [];
		keywords.push(...fileRefs.map((f) => f.toLowerCase()));

		// Extract symbol references (CamelCase, snake_case)
		const symbols = taskDescription.match(/[A-Z][a-z]+[A-Z][a-zA-Z]*|[a-z]+_[a-z_]+/g) || [];
		keywords.push(...symbols.map((s) => s.toLowerCase()));

		return [...new Set(keywords)];
	}

	// Determine task type from description
	private determineTaskType(taskDescription: string): string[] {
		const types: string[] = [];
		const lowerDesc = taskDescription.toLowerCase();

		for (const [type, patterns] of Object.entries(TASK_PATTERNS)) {
			for (const pattern of patterns) {
				if (lowerDesc.includes(pattern)) {
					types.push(type);
					break;
				}
			}
		}

		return types;
	}

	// Get all files in the repository
	private getRepositoryFiles(): string[] {
		try {
			const output = execSync("git ls-files", {
				encoding: "utf-8",
				cwd: process.cwd(),
			});
			return output.split("\n").filter((f) => f.trim());
		} catch {
			// Fallback to glob
			return this.globFiles("**/*.{ts,js,py,rs,go,json,yaml,yml,md}");
		}
	}

	private globFiles(pattern: string): string[] {
		const files: string[] = [];
		const cwd = process.cwd();

		const walk = (dir: string) => {
			try {
				const entries = fs.readdirSync(dir, { withFileTypes: true });
				for (const entry of entries) {
					const fullPath = path.join(dir, entry.name);
					if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
						walk(fullPath);
					} else if (entry.isFile()) {
						files.push(path.relative(cwd, fullPath));
					}
				}
			} catch {
				// Skip directories we can't read
			}
		};

		walk(cwd);
		return files;
	}

	// Extract symbols from a file
	public extractSymbols(filePath: string): SymbolInfo[] {
		if (this.symbolCache.has(filePath)) {
			return this.symbolCache.get(filePath) ?? [];
		}

		const symbols: SymbolInfo[] = [];
		const ext = path.extname(filePath);
		const pattern = SYMBOL_PATTERNS[ext.replace(".", "")];

		if (!pattern) {
			this.symbolCache.set(filePath, symbols);
			return symbols;
		}

		try {
			const fullPath = path.resolve(process.cwd(), filePath);
			if (!fs.existsSync(fullPath)) {
				this.symbolCache.set(filePath, symbols);
				return symbols;
			}

			const content = fs.readFileSync(fullPath, "utf-8");
			this.fileContentCache.set(filePath, content);

			const lines = content.split("\n");
			let match: RegExpExecArray | null = null;
			const patternCopy = new RegExp(pattern.source, pattern.flags);

			match = patternCopy.exec(content);
			while (match !== null) {
				const symbolName = match[1];
				const position = match.index;
				const lineNumber = content.substring(0, position).split("\n").length;

				// Determine symbol type from match
				const matchText = match[0];
				let type: SymbolInfo["type"] = "function";
				if (matchText.includes("class ")) type = "class";
				else if (matchText.includes("interface ")) type = "interface";
				else if (matchText.includes("type ")) type = "type";
				else if (matchText.includes("const ") || matchText.includes("let ")) type = "variable";

				symbols.push({
					name: symbolName,
					type,
					file: filePath,
					line: lineNumber,
				});

				match = patternCopy.exec(content);
			}
		} catch {
			// Skip files we can't read
		}

		this.symbolCache.set(filePath, symbols);
		return symbols;
	}

	// Calculate relevance score for a file
	private calculateRelevance(filePath: string, keywords: string[], taskTypes: string[]): number {
		let score = 0;
		const lowerPath = filePath.toLowerCase();

		// Check keyword matches in filename
		for (const keyword of keywords) {
			if (lowerPath.includes(keyword)) {
				score += 0.1;
			}
		}

		// Check task type patterns
		for (const type of taskTypes) {
			const patterns = TASK_PATTERNS[type] || [];
			for (const pattern of patterns) {
				if (lowerPath.includes(pattern)) {
					score += 0.15;
					break;
				}
			}
		}

		// Check symbol matches
		const symbols = this.extractSymbols(filePath);
		for (const symbol of symbols) {
			const lowerSymbol = symbol.name.toLowerCase();
			for (const keyword of keywords) {
				if (lowerSymbol.includes(keyword) || keyword.includes(lowerSymbol)) {
					score += 0.2;
					break;
				}
			}
		}

		// Boost for source files
		const ext = path.extname(filePath);
		if ([".ts", ".js", ".py", ".rs", ".go"].includes(ext)) {
			score *= 1.2;
		}

		// Penalize test files unless explicitly requested
		if (!taskTypes.includes("test") && (filePath.includes("test") || filePath.includes("spec"))) {
			score *= 0.3;
		}

		// Penalize config files unless explicitly requested
		if (!taskTypes.includes("config")) {
			if ([".json", ".yaml", ".yml", ".toml"].includes(ext)) {
				score *= 0.5;
			}
		}

		return Math.min(score, 1);
	}

	// Main analysis method
	public analyze(taskDescription: string): ContextAnalysis {
		const keywords = this.extractKeywords(taskDescription);
		const taskTypes = this.determineTaskType(taskDescription);

		const files = this.getRepositoryFiles();
		const suggestions: FileSuggestion[] = [];

		for (const file of files) {
			const relevance = this.calculateRelevance(file, keywords, taskTypes);

			if (relevance >= this.config.minRelevance) {
				const symbols = this.extractSymbols(file)
					.filter((s) =>
						keywords.some(
							(k) => s.name.toLowerCase().includes(k) || k.includes(s.name.toLowerCase()),
						),
					)
					.slice(0, 5);

				const category: FileSuggestion["category"] =
					relevance >= 0.7 ? "primary" : relevance >= 0.4 ? "secondary" : "reference";

				suggestions.push({
					path: file,
					relevance,
					reason: this.generateReason(file, keywords, taskTypes),
					symbols: symbols.map((s) => s.name),
					category,
				});
			}
		}

		// Sort by relevance and limit
		suggestions.sort((a, b) => b.relevance - a.relevance);
		const topSuggestions = suggestions.slice(0, this.config.maxSuggestions);

		// Calculate overall confidence
		const avgRelevance =
			topSuggestions.reduce((sum, s) => sum + s.relevance, 0) / (topSuggestions.length || 1);
		const confidence = Math.min(avgRelevance * (topSuggestions.length / 3), 1);

		// Update stats
		this.stats.totalAnalyses++;
		this.stats.filesSuggested += topSuggestions.length;
		this.stats.primaryFilesSuggested += topSuggestions.filter(
			(s) => s.category === "primary",
		).length;
		this.stats.avgConfidence =
			(this.stats.avgConfidence * (this.stats.totalAnalyses - 1) + confidence) /
			this.stats.totalAnalyses;
		this.saveData();

		return {
			taskDescription,
			suggestedFiles: topSuggestions,
			relevantSymbols: topSuggestions.flatMap((s) =>
				s.symbols.map((name) => ({
					name,
					type: "function" as const,
					file: s.path,
				})),
			),
			confidence,
			reasoning: this.generateReasoning(taskTypes, topSuggestions, confidence),
		};
	}

	private generateReason(file: string, keywords: string[], taskTypes: string[]): string {
		const reasons: string[] = [];
		const lowerPath = file.toLowerCase();

		for (const type of taskTypes) {
			const patterns = TASK_PATTERNS[type] || [];
			for (const pattern of patterns) {
				if (lowerPath.includes(pattern)) {
					reasons.push(`Matches ${type} pattern: ${pattern}`);
					break;
				}
			}
		}

		for (const keyword of keywords.slice(0, 3)) {
			if (lowerPath.includes(keyword)) {
				reasons.push(`Contains keyword: ${keyword}`);
			}
		}

		return reasons.length > 0 ? reasons.join("; ") : "Relevant to task context";
	}

	private generateReasoning(
		taskTypes: string[],
		suggestions: FileSuggestion[],
		confidence: number,
	): string {
		const parts: string[] = [];

		if (taskTypes.length > 0) {
			parts.push(`Detected task types: ${taskTypes.join(", ")}`);
		}

		const primaryCount = suggestions.filter((s) => s.category === "primary").length;
		const secondaryCount = suggestions.filter((s) => s.category === "secondary").length;

		parts.push(`Found ${primaryCount} primary and ${secondaryCount} secondary files`);

		if (confidence >= 0.7) {
			parts.push("High confidence: files strongly match task context");
		} else if (confidence >= 0.4) {
			parts.push("Moderate confidence: partial matches found");
		} else {
			parts.push("Low confidence: limited matches, may need manual file selection");
		}

		return `${parts.join(". ")}.`;
	}

	// Get suggestions for a specific file
	public suggestForFile(filePath: string): FileSuggestion[] {
		const symbols = this.extractSymbols(filePath);
		const files = this.getRepositoryFiles();
		const suggestions: FileSuggestion[] = [];

		// Find files that reference symbols from this file
		for (const file of files) {
			if (file === filePath) continue;

			const fileContent = this.fileContentCache.get(file) || this.readFileContent(file);
			if (!fileContent) continue;

			const matchingSymbols: string[] = [];
			for (const symbol of symbols) {
				if (fileContent.includes(symbol.name)) {
					matchingSymbols.push(symbol.name);
				}
			}

			if (matchingSymbols.length > 0) {
				suggestions.push({
					path: file,
					relevance: matchingSymbols.length / symbols.length,
					reason: `References symbols: ${matchingSymbols.join(", ")}`,
					symbols: matchingSymbols,
					category: matchingSymbols.length >= 2 ? "secondary" : "reference",
				});
			}
		}

		return suggestions
			.sort((a, b) => b.relevance - a.relevance)
			.slice(0, this.config.maxSuggestions);
	}

	private readFileContent(filePath: string): string | null {
		try {
			const fullPath = path.resolve(process.cwd(), filePath);
			if (fs.existsSync(fullPath)) {
				const content = fs.readFileSync(fullPath, "utf-8");
				this.fileContentCache.set(filePath, content);
				return content;
			}
		} catch {
			// Skip
		}
		return null;
	}

	// Get related files based on shared symbols
	public getRelatedFiles(filePath: string): string[] {
		const symbols = this.extractSymbols(filePath);
		const related: Set<string> = new Set();

		for (const file of this.getRepositoryFiles()) {
			if (file === filePath) continue;

			const fileSymbols = this.extractSymbols(file);
			for (const symbol of symbols) {
				if (fileSymbols.some((s) => s.name === symbol.name)) {
					related.add(file);
					break;
				}
			}
		}

		return Array.from(related);
	}

	// Configuration methods
	public isEnabled(): boolean {
		return this.config.enabled;
	}

	public setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveData();
	}

	public getConfig(): ContextIdentifierConfig {
		return { ...this.config };
	}

	public updateConfig(updates: Partial<ContextIdentifierConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveData();
	}

	public getStats(): ContextIdentifierStats {
		return { ...this.stats };
	}

	public resetStats(): void {
		this.stats = {
			totalAnalyses: 0,
			filesSuggested: 0,
			primaryFilesSuggested: 0,
			avgConfidence: 0,
			topCategories: [],
		};
		this.saveData();
	}

	public clearCache(): void {
		this.symbolCache.clear();
		this.fileContentCache.clear();
	}
}

// Singleton instance
export function getContextIdentifierManager(): ContextIdentifierManager {
	if (!managerInstance) {
		managerInstance = new ContextIdentifierManager();
	}
	return managerInstance;
}

export function resetContextIdentifierInstance(): void {
	managerInstance = null;
}
