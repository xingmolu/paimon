/**
 * Code Completion Module (Cursor Pattern)
 *
 * Provides intelligent code completion suggestions based on codebase analysis.
 * Inspired by Cursor's AI-powered code completion features.
 *
 * Key features:
 * - Code pattern analysis for snippet suggestions
 * - Import suggestions based on codebase imports
 * - Function signature help from codebase analysis
 * - Multi-line code completions based on patterns
 * - Context-aware suggestions from current file context
 */

import * as fs from "node:fs";
import * as path from "node:path";

// Types
export interface CodeCompletion {
	id: string;
	type: "snippet" | "import" | "signature" | "multiline" | "pattern";
	text: string;
	displayText: string;
	description: string;
	filePath: string | null;
	lineRange: { start: number; end: number } | null;
	confidence: number;
	source: "codebase" | "pattern" | "context" | "import";
	trigger: string | null;
	timestamp: string;
}

export interface CodeContext {
	filePath: string;
	content: string;
	cursorLine: number;
	cursorColumn: number;
	language: string;
	surroundingCode: {
		before: string;
		after: string;
		currentLine: string;
	};
	imports: string[];
	symbols: string[];
}

export interface CodePattern {
	id: string;
	name: string;
	pattern: string;
	template: string;
	description: string;
	language: string;
	trigger: string;
	confidence: number;
	usageCount: number;
}

export interface ImportSuggestion {
	module: string;
	name: string;
	type: "default" | "named" | "namespace";
	confidence: number;
	source: string;
}

export interface FunctionSignature {
	name: string;
	parameters: Array<{
		name: string;
		type: string;
		optional: boolean;
		defaultValue?: string;
	}>;
	returnType: string;
	description: string;
	filePath: string;
	line: number;
}

export interface CodeCompletionStats {
	totalCompletions: number;
	byType: Record<string, number>;
	averageConfidence: number;
	topPatterns: Array<{ pattern: string; count: number }>;
	importSuggestionsGenerated: number;
	signaturesExtracted: number;
	lastCompletionTime: string | null;
}

export interface CodeCompletionConfig {
	enabled: boolean;
	maxSuggestions: number;
	minConfidence: number;
	analyzeCodebase: boolean;
	extractSignatures: boolean;
	learnPatterns: boolean;
	patternMinUsage: number;
}

// Default configuration
const DEFAULT_CONFIG: CodeCompletionConfig = {
	enabled: true,
	maxSuggestions: 10,
	minConfidence: 0.5,
	analyzeCodebase: true,
	extractSignatures: true,
	learnPatterns: true,
	patternMinUsage: 2,
};

// Default code patterns
const DEFAULT_PATTERNS: CodePattern[] = [
	// TypeScript/JavaScript patterns
	{
		id: "ts-async-function",
		name: "Async Function",
		pattern: "async function",
		template: "async function ${name}(${params}): Promise<${returnType}> {\n\t${body}\n}",
		description: "Async function with Promise return type",
		language: "typescript",
		trigger: "async ",
		confidence: 0.9,
		usageCount: 0,
	},
	{
		id: "ts-arrow-function",
		name: "Arrow Function",
		pattern: "=>",
		template: "const ${name} = (${params}): ${returnType} => {\n\t${body}\n}",
		description: "Arrow function with type annotation",
		language: "typescript",
		trigger: "=>",
		confidence: 0.85,
		usageCount: 0,
	},
	{
		id: "ts-interface",
		name: "Interface",
		pattern: "interface",
		template: "interface ${name} {\n\t${properties}\n}",
		description: "TypeScript interface definition",
		language: "typescript",
		trigger: "interface ",
		confidence: 0.9,
		usageCount: 0,
	},
	{
		id: "ts-type",
		name: "Type Alias",
		pattern: "type ",
		template: "type ${name} = ${definition};",
		description: "TypeScript type alias",
		language: "typescript",
		trigger: "type ",
		confidence: 0.85,
		usageCount: 0,
	},
	{
		id: "ts-try-catch",
		name: "Try-Catch Block",
		pattern: "try {",
		template: "try {\n\t${tryBody}\n} catch (error) {\n\t${catchBody}\n}",
		description: "Try-catch error handling",
		language: "typescript",
		trigger: "try ",
		confidence: 0.8,
		usageCount: 0,
	},
	{
		id: "ts-import",
		name: "Import Statement",
		pattern: "import {",
		template: "import { ${imports} } from '${module}';",
		description: "Named import statement",
		language: "typescript",
		trigger: "import {",
		confidence: 0.95,
		usageCount: 0,
	},
	{
		id: "ts-class",
		name: "Class Definition",
		pattern: "class ",
		template:
			"class ${name} {\n\tconstructor(${params}) {\n\t\t${constructorBody}\n\t}\n\n\t${methods}\n}",
		description: "Class with constructor",
		language: "typescript",
		trigger: "class ",
		confidence: 0.85,
		usageCount: 0,
	},
	{
		id: "ts-export-function",
		name: "Export Function",
		pattern: "export function",
		template: "export function ${name}(${params}): ${returnType} {\n\t${body}\n}",
		description: "Exported function",
		language: "typescript",
		trigger: "export function",
		confidence: 0.9,
		usageCount: 0,
	},
	{
		id: "ts-if-else",
		name: "If-Else Statement",
		pattern: "if (",
		template: "if (${condition}) {\n\t${ifBody}\n} else {\n\t${elseBody}\n}",
		description: "If-else conditional",
		language: "typescript",
		trigger: "if (",
		confidence: 0.75,
		usageCount: 0,
	},
	{
		id: "ts-for-of",
		name: "For-Of Loop",
		pattern: "for (",
		template: "for (const ${item} of ${items}) {\n\t${body}\n}",
		description: "For-of iteration",
		language: "typescript",
		trigger: "for (",
		confidence: 0.7,
		usageCount: 0,
	},
	// Markdown patterns
	{
		id: "md-heading",
		name: "Markdown Heading",
		pattern: "##",
		template: "## ${title}\n\n${content}",
		description: "Markdown heading",
		language: "markdown",
		trigger: "##",
		confidence: 0.9,
		usageCount: 0,
	},
	{
		id: "md-code-block",
		name: "Code Block",
		pattern: "```",
		template: "```${language}\n${code}\n```",
		description: "Markdown code block",
		language: "markdown",
		trigger: "```",
		confidence: 0.95,
		usageCount: 0,
	},
];

// Language detection from file extension
const LANGUAGE_MAP: Record<string, string> = {
	".ts": "typescript",
	".tsx": "typescript",
	".js": "javascript",
	".jsx": "javascript",
	".md": "markdown",
	".json": "json",
	".yaml": "yaml",
	".yml": "yaml",
	".py": "python",
	".go": "go",
	".rs": "rust",
	".java": "java",
	".kt": "kotlin",
	".swift": "swift",
	".c": "c",
	".cpp": "cpp",
	".h": "c",
	".hpp": "cpp",
	".sh": "bash",
	".bash": "bash",
	".zsh": "bash",
};

let managerInstance: CodeCompletionManager | null = null;

export class CodeCompletionManager {
	private config: CodeCompletionConfig;
	private patterns: CodePattern[];
	private stats: CodeCompletionStats;
	private dataPath: string;
	private codebaseImports: Map<string, ImportSuggestion[]>;
	private codebaseSignatures: Map<string, FunctionSignature[]>;

	constructor(configPath?: string) {
		this.config = DEFAULT_CONFIG;
		this.patterns = [...DEFAULT_PATTERNS];
		this.codebaseImports = new Map();
		this.codebaseSignatures = new Map();
		const homeDir = process.env.HOME || ".";
		this.dataPath = path.join(homeDir, ".paimon", "code-completion.json");
		this.stats = {
			totalCompletions: 0,
			byType: {},
			averageConfidence: 0,
			topPatterns: [],
			importSuggestionsGenerated: 0,
			signaturesExtracted: 0,
			lastCompletionTime: null,
		};
		this.loadConfig();
		this.loadData();
	}

	private loadConfig(): void {
		try {
			const homeDir = process.env.HOME || ".";
			const configPath = path.join(homeDir, ".paimon", "code-completion-config.json");
			if (fs.existsSync(configPath)) {
				const loaded = JSON.parse(fs.readFileSync(configPath, "utf-8"));
				this.config = { ...DEFAULT_CONFIG, ...loaded };
			}
		} catch {
			// Use defaults
		}
	}

	private loadData(): void {
		try {
			if (fs.existsSync(this.dataPath)) {
				const data = JSON.parse(fs.readFileSync(this.dataPath, "utf-8"));
				if (data.patterns) {
					// Merge saved patterns with defaults
					for (const savedPattern of data.patterns) {
						const existing = this.patterns.find((p) => p.id === savedPattern.id);
						if (existing) {
							existing.usageCount = savedPattern.usageCount || 0;
						} else {
							this.patterns.push(savedPattern);
						}
					}
				}
				if (data.stats) {
					this.stats = { ...this.stats, ...data.stats };
				}
			}
		} catch {
			// Start fresh
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
						patterns: this.patterns,
						stats: this.stats,
						config: this.config,
					},
					null,
					2,
				),
			);
		} catch (error) {
			console.error("Failed to save code completion data:", error);
		}
	}

	private updateStats(completion: CodeCompletion): void {
		this.stats.totalCompletions++;
		this.stats.byType[completion.type] = (this.stats.byType[completion.type] || 0) + 1;
		this.stats.lastCompletionTime = completion.timestamp;

		// Update average confidence
		const totalConf = this.stats.averageConfidence * (this.stats.totalCompletions - 1);
		this.stats.averageConfidence =
			(totalConf + completion.confidence) / this.stats.totalCompletions;

		// Update top patterns
		if (completion.trigger) {
			const existing = this.stats.topPatterns.find((p) => p.pattern === completion.trigger);
			if (existing) {
				existing.count++;
			} else {
				this.stats.topPatterns.push({ pattern: completion.trigger, count: 1 });
			}
			this.stats.topPatterns.sort((a, b) => b.count - a.count);
			this.stats.topPatterns = this.stats.topPatterns.slice(0, 10);
		}

		this.saveData();
	}

	// Language detection
	public detectLanguage(filePath: string): string {
		const ext = path.extname(filePath).toLowerCase();
		return LANGUAGE_MAP[ext] || "text";
	}

	// Extract imports from code
	public extractImports(content: string, filePath: string): ImportSuggestion[] {
		const imports: ImportSuggestion[] = [];
		const language = this.detectLanguage(filePath);

		if (language === "typescript" || language === "javascript") {
			// Match: import { X, Y } from 'module'
			const namedImportRegex = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
			let namedMatch: RegExpExecArray | null = namedImportRegex.exec(content);
			while (namedMatch !== null) {
				const names = namedMatch[1].split(",").map((n) => n.trim());
				const module = namedMatch[2];
				for (const name of names) {
					imports.push({
						module,
						name,
						type: "named",
						confidence: 0.9,
						source: filePath,
					});
				}
				namedMatch = namedImportRegex.exec(content);
			}

			// Match: import X from 'module'
			const defaultImportRegex = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
			let defaultMatch: RegExpExecArray | null = defaultImportRegex.exec(content);
			while (defaultMatch !== null) {
				imports.push({
					module: defaultMatch[2],
					name: defaultMatch[1],
					type: "default",
					confidence: 0.9,
					source: filePath,
				});
				defaultMatch = defaultImportRegex.exec(content);
			}

			// Match: import * as X from 'module'
			const namespaceImportRegex = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
			let namespaceMatch: RegExpExecArray | null = namespaceImportRegex.exec(content);
			while (namespaceMatch !== null) {
				imports.push({
					module: namespaceMatch[2],
					name: namespaceMatch[1],
					type: "namespace",
					confidence: 0.85,
					source: filePath,
				});
				namespaceMatch = namespaceImportRegex.exec(content);
			}
		}

		return imports;
	}

	// Extract function signatures from code
	public extractSignatures(content: string, filePath: string): FunctionSignature[] {
		const signatures: FunctionSignature[] = [];
		const language = this.detectLanguage(filePath);

		if (language === "typescript") {
			// Match: function name(params): ReturnType
			const funcRegex = /(?:export\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*(\w+))?/g;
			let funcMatch: RegExpExecArray | null = funcRegex.exec(content);
			while (funcMatch !== null) {
				const name = funcMatch[1];
				const paramsStr = funcMatch[2];
				const returnType = funcMatch[3] || "void";

				const parameters = this.parseParameters(paramsStr);
				signatures.push({
					name,
					parameters,
					returnType,
					description: `Function ${name}`,
					filePath,
					line: this.getLineNumber(content, funcMatch.index),
				});
				funcMatch = funcRegex.exec(content);
			}

			// Match: const name = (params): ReturnType =>
			const arrowRegex =
				/(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*\(([^)]*)\)(?:\s*:\s*(\w+(?:<[^>]+>)?))?\s*=>/g;
			let arrowMatch: RegExpExecArray | null = arrowRegex.exec(content);
			while (arrowMatch !== null) {
				const name = arrowMatch[1];
				const paramsStr = arrowMatch[2];
				const returnType = arrowMatch[3] || "unknown";

				const parameters = this.parseParameters(paramsStr);
				signatures.push({
					name,
					parameters,
					returnType,
					description: `Arrow function ${name}`,
					filePath,
					line: this.getLineNumber(content, arrowMatch.index),
				});
				arrowMatch = arrowRegex.exec(content);
			}
		}

		this.stats.signaturesExtracted += signatures.length;
		return signatures;
	}

	private parseParameters(paramsStr: string): FunctionSignature["parameters"] {
		if (!paramsStr.trim()) return [];

		return paramsStr.split(",").map((param) => {
			const trimmed = param.trim();
			// Match: name?: type or name: type = default
			const optionalMatch = trimmed.match(/^(\w+)\?(\s*:\s*(.+))?$/);
			if (optionalMatch) {
				return {
					name: optionalMatch[1],
					type: optionalMatch[3]?.trim() || "unknown",
					optional: true,
				};
			}

			const defaultMatch = trimmed.match(/^(\w+)(\?)?(?:\s*:\s*(.+?))?(?:\s*=\s*(.+))?$/);
			if (defaultMatch) {
				return {
					name: defaultMatch[1],
					type: defaultMatch[3]?.trim() || "unknown",
					optional: !!defaultMatch[2],
					defaultValue: defaultMatch[4]?.trim(),
				};
			}

			return {
				name: trimmed,
				type: "unknown",
				optional: false,
			};
		});
	}

	private getLineNumber(content: string, index: number): number {
		return content.substring(0, index).split("\n").length;
	}

	// Build code context for completion
	public buildCodeContext(
		filePath: string,
		content: string,
		cursorLine: number,
		cursorColumn: number,
	): CodeContext {
		const lines = content.split("\n");
		const currentLine = lines[cursorLine] || "";
		const before = lines.slice(Math.max(0, cursorLine - 10), cursorLine).join("\n");
		const after = lines.slice(cursorLine + 1, cursorLine + 10).join("\n");

		return {
			filePath,
			content,
			cursorLine,
			cursorColumn,
			language: this.detectLanguage(filePath),
			surroundingCode: {
				before,
				after,
				currentLine,
			},
			imports: this.extractImports(content, filePath).map((i) => i.name),
			symbols: this.extractSymbols(content),
		};
	}

	// Extract symbols from code
	private extractSymbols(content: string): string[] {
		const symbols: string[] = [];
		const symbolRegex = /\b(const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
		let symbolMatch: RegExpExecArray | null = symbolRegex.exec(content);
		while (symbolMatch !== null) {
			symbols.push(symbolMatch[2]);
			symbolMatch = symbolRegex.exec(content);
		}
		return symbols;
	}

	// Generate completions
	public getCompletions(context: CodeContext): CodeCompletion[] {
		if (!this.config.enabled) return [];

		const completions: CodeCompletion[] = [];
		const now = new Date().toISOString();

		// Pattern-based completions
		for (const pattern of this.patterns) {
			if (pattern.language !== context.language) continue;

			const triggerIndex = context.surroundingCode.currentLine.lastIndexOf(pattern.trigger);
			if (triggerIndex !== -1 && triggerIndex <= context.cursorColumn) {
				completions.push({
					id: `pattern-${pattern.id}-${Date.now()}`,
					type: "pattern",
					text: pattern.template,
					displayText: pattern.name,
					description: pattern.description,
					filePath: context.filePath,
					lineRange: { start: context.cursorLine, end: context.cursorLine },
					confidence: pattern.confidence,
					source: "pattern",
					trigger: pattern.trigger,
					timestamp: now,
				});

				// Update usage count
				pattern.usageCount++;
			}
		}

		// Import suggestions
		if (context.surroundingCode.currentLine.includes("import ")) {
			const importCompletions = this.getImportCompletions(context);
			for (const imp of importCompletions) {
				completions.push({
					id: `import-${imp.module}-${imp.name}-${Date.now()}`,
					type: "import",
					text:
						imp.type === "named"
							? `import { ${imp.name} } from '${imp.module}';`
							: `import ${imp.name} from '${imp.module}';`,
					displayText: `Import ${imp.name} from ${imp.module}`,
					description: `Import ${imp.name} from module ${imp.module}`,
					filePath: context.filePath,
					lineRange: { start: context.cursorLine, end: context.cursorLine },
					confidence: imp.confidence,
					source: "import",
					trigger: "import",
					timestamp: now,
				});
			}
		}

		// Signature help
		const signatures = this.getSignatureCompletions(context);
		for (const sig of signatures) {
			completions.push({
				id: `sig-${sig.name}-${Date.now()}`,
				type: "signature",
				text: `${sig.name}(${sig.parameters.map((p) => p.name + (p.optional ? "?" : "")).join(", ")})`,
				displayText: `${sig.name}(...)`,
				description: sig.description,
				filePath: context.filePath,
				lineRange: null,
				confidence: 0.9,
				source: "codebase",
				trigger: sig.name,
				timestamp: now,
			});
		}

		// Sort by confidence and limit
		completions.sort((a, b) => b.confidence - a.confidence);
		const result = completions.slice(0, this.config.maxSuggestions);

		// Update stats
		for (const completion of result) {
			this.updateStats(completion);
		}

		return result;
	}

	private getImportCompletions(context: CodeContext): ImportSuggestion[] {
		const suggestions: ImportSuggestion[] = [];

		// Get imports from codebase cache
		for (const [, imports] of this.codebaseImports) {
			suggestions.push(...imports);
		}

		// Sort by confidence
		suggestions.sort((a, b) => b.confidence - a.confidence);
		this.stats.importSuggestionsGenerated += suggestions.length;

		return suggestions.slice(0, 5);
	}

	private getSignatureCompletions(context: CodeContext): FunctionSignature[] {
		const signatures: FunctionSignature[] = [];

		// Check if we're completing a function call
		const funcCallMatch = context.surroundingCode.currentLine.match(/(\w+)\s*\(/);
		if (funcCallMatch) {
			const funcName = funcCallMatch[1];
			for (const [, sigs] of this.codebaseSignatures) {
				for (const sig of sigs) {
					if (sig.name === funcName) {
						signatures.push(sig);
					}
				}
			}
		}

		return signatures.slice(0, 3);
	}

	// Analyze codebase for completions
	public analyzeCodebase(rootPath: string): {
		importsFound: number;
		signaturesFound: number;
		filesAnalyzed: number;
	} {
		if (!this.config.analyzeCodebase) {
			return { importsFound: 0, signaturesFound: 0, filesAnalyzed: 0 };
		}

		let importsFound = 0;
		let signaturesFound = 0;
		let filesAnalyzed = 0;

		const analyzeDir = (dir: string) => {
			try {
				const entries = fs.readdirSync(dir, { withFileTypes: true });
				for (const entry of entries) {
					const fullPath = path.join(dir, entry.name);
					if (entry.isDirectory()) {
						if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
							analyzeDir(fullPath);
						}
					} else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
						try {
							const content = fs.readFileSync(fullPath, "utf-8");
							const imports = this.extractImports(content, fullPath);
							const signatures = this.extractSignatures(content, fullPath);

							this.codebaseImports.set(fullPath, imports);
							this.codebaseSignatures.set(fullPath, signatures);

							importsFound += imports.length;
							signaturesFound += signatures.length;
							filesAnalyzed++;
						} catch {
							// Skip files that can't be read
						}
					}
				}
			} catch {
				// Skip directories that can't be accessed
			}
		};

		analyzeDir(rootPath);
		this.saveData();

		return { importsFound, signaturesFound, filesAnalyzed };
	}

	// Add custom pattern
	public addPattern(pattern: CodePattern): void {
		const existing = this.patterns.find((p) => p.id === pattern.id);
		if (existing) {
			Object.assign(existing, pattern);
		} else {
			this.patterns.push(pattern);
		}
		this.saveData();
	}

	// Remove pattern
	public removePattern(patternId: string): boolean {
		const index = this.patterns.findIndex((p) => p.id === patternId);
		if (index !== -1) {
			this.patterns.splice(index, 1);
			this.saveData();
			return true;
		}
		return false;
	}

	// Get all patterns
	public getPatterns(): CodePattern[] {
		return [...this.patterns];
	}

	// Get statistics
	public getStats(): CodeCompletionStats {
		return { ...this.stats };
	}

	// Get configuration
	public getConfig(): CodeCompletionConfig {
		return { ...this.config };
	}

	// Update configuration
	public updateConfig(updates: Partial<CodeCompletionConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveData();
	}

	// Enable/disable
	public isEnabled(): boolean {
		return this.config.enabled;
	}

	public setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveData();
	}

	// Reset statistics
	public resetStats(): void {
		this.stats = {
			totalCompletions: 0,
			byType: {},
			averageConfidence: 0,
			topPatterns: [],
			importSuggestionsGenerated: 0,
			signaturesExtracted: 0,
			lastCompletionTime: null,
		};
		this.saveData();
	}

	// Format completions for display
	public formatCompletions(completions: CodeCompletion[]): string {
		if (completions.length === 0) {
			return "No completions available.";
		}

		const lines: string[] = ["## Code Completions", ""];

		for (const completion of completions) {
			lines.push(`### ${completion.displayText}`);
			lines.push(`- **Type:** ${completion.type}`);
			lines.push(`- **Confidence:** ${(completion.confidence * 100).toFixed(0)}%`);
			lines.push(`- **Description:** ${completion.description}`);
			if (completion.trigger) {
				lines.push(`- **Trigger:** ${completion.trigger}`);
			}
			lines.push("");
			lines.push("```");
			lines.push(completion.text);
			lines.push("```");
			lines.push("");
		}

		return lines.join("\n");
	}

	// Format patterns for display
	public formatPatterns(): string {
		const lines: string[] = ["## Code Patterns", ""];

		for (const pattern of this.patterns) {
			lines.push(`### ${pattern.name} (${pattern.id})`);
			lines.push(`- **Language:** ${pattern.language}`);
			lines.push(`- **Trigger:** ${pattern.trigger}`);
			lines.push(`- **Confidence:** ${(pattern.confidence * 100).toFixed(0)}%`);
			lines.push(`- **Usage Count:** ${pattern.usageCount}`);
			lines.push(`- **Description:** ${pattern.description}`);
			lines.push("");
		}

		return lines.join("\n");
	}

	// Format statistics for display
	public formatStats(): string {
		const lines: string[] = [
			"## Code Completion Statistics",
			"",
			`Total Completions: ${this.stats.totalCompletions}`,
			`Average Confidence: ${(this.stats.averageConfidence * 100).toFixed(1)}%`,
			`Import Suggestions: ${this.stats.importSuggestionsGenerated}`,
			`Signatures Extracted: ${this.stats.signaturesExtracted}`,
			"",
			"### By Type",
			"",
		];

		for (const [type, count] of Object.entries(this.stats.byType)) {
			lines.push(`- ${type}: ${count}`);
		}

		if (this.stats.topPatterns.length > 0) {
			lines.push("", "### Top Patterns", "");
			for (const { pattern, count } of this.stats.topPatterns) {
				lines.push(`- ${pattern}: ${count} uses`);
			}
		}

		return lines.join("\n");
	}
}

export function getCodeCompletionManager(): CodeCompletionManager {
	if (!managerInstance) {
		managerInstance = new CodeCompletionManager();
	}
	return managerInstance;
}

export function initCodeCompletionManager(configPath?: string): CodeCompletionManager {
	managerInstance = new CodeCompletionManager(configPath);
	return managerInstance;
}
