import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Repo Map - A simplified codebase map inspired by Aider
 *
 * Shows definitions (functions, classes, interfaces) across the codebase
 * to improve codebase understanding without reading every file.
 */

/**
 * Definition extracted from a source file
 */
export interface Definition {
	/** File path relative to root */
	file: string;
	/** Definition name */
	name: string;
	/** Definition type */
	type: "function" | "class" | "interface" | "type" | "const" | "enum" | "method";
	/** Line number */
	line: number;
	/** Signature (optional, for functions) */
	signature?: string;
}

/**
 * Reference to a definition from another file
 */
export interface Reference {
	/** File containing the reference */
	file: string;
	/** Name being referenced */
	name: string;
	/** Import source (if imported) */
	importFrom?: string;
}

/**
 * Symbol usage across files (Multi-File Context - Cursor Pattern)
 */
export interface SymbolUsage {
	/** Symbol name */
	name: string;
	/** File where symbol is defined */
	definedIn: string;
	/** Definition type */
	type: Definition["type"];
	/** Files that use this symbol */
	usedIn: Array<{
		file: string;
		importFrom?: string;
		count: number;
	}>;
	/** Total usage count across all files */
	totalUsageCount: number;
}

/**
 * Change impact analysis (Multi-File Context - Cursor Pattern)
 */
export interface ChangeImpact {
	/** File being changed */
	file: string;
	/** Symbols that would be affected */
	affectedSymbols: Array<{
		name: string;
		type: Definition["type"];
		definedIn: string;
	}>;
	/** Files that depend on this file */
	dependentFiles: Array<{
		file: string;
		reason: string;
		risk: "low" | "medium" | "high";
	}>;
	/** Overall risk level */
	riskLevel: "low" | "medium" | "high" | "critical";
	/** Summary */
	summary: string;
}

/**
 * Related files suggestion (Multi-File Context - Cursor Pattern)
 */
export interface RelatedFiles {
	/** Target file */
	file: string;
	/** Files related to this one */
	related: Array<{
		file: string;
		relation: "imports" | "imported-by" | "shared-types" | "shared-functions" | "same-module";
		strength: number;
	}>;
	/** Recommended edit order */
	editOrder: string[];
	/** Summary */
	summary: string;
}

/**
 * Repo Map configuration
 */
export interface RepoMapConfig {
	/** Maximum tokens for the map output */
	maxTokens: number;
	/** File patterns to include */
	includePatterns: string[];
	/** File patterns to exclude */
	excludePatterns: string[];
	/** Root directory */
	root: string;
	/** Show line numbers */
	showLineNumbers: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: RepoMapConfig = {
	maxTokens: 2048,
	includePatterns: ["**/*.ts", "**/*.js", "**/*.tsx", "**/*.jsx"],
	excludePatterns: ["**/*.test.ts", "**/*.test.js", "**/node_modules/**", "**/dist/**"],
	root: ".",
	showLineNumbers: true,
};

/**
 * Regex patterns for TypeScript/JavaScript definitions
 */
const DEFINITION_PATTERNS: Array<{
	pattern: RegExp;
	type: Definition["type"];
	extract: (match: RegExpMatchArray) => { name: string; signature?: string };
}> = [
	{
		pattern: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/gm,
		type: "function",
		extract: (m) => ({ name: m[1], signature: `(${m[2]})` }),
	},
	{
		pattern:
			/^(?:export\s+)?(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*{/gm,
		type: "method",
		extract: (m) => ({ name: m[1], signature: `(${m[2]})` }),
	},
	{
		pattern: /^(?:export\s+)?class\s+(\w+)/gm,
		type: "class",
		extract: (m) => ({ name: m[1] }),
	},
	{
		pattern: /^(?:export\s+)?interface\s+(\w+)/gm,
		type: "interface",
		extract: (m) => ({ name: m[1] }),
	},
	{
		pattern: /^(?:export\s+)?type\s+(\w+)/gm,
		type: "type",
		extract: (m) => ({ name: m[1] }),
	},
	{
		pattern: /^(?:export\s+)?enum\s+(\w+)/gm,
		type: "enum",
		extract: (m) => ({ name: m[1] }),
	},
	{
		pattern: /^(?:export\s+)?const\s+(\w+)\s*=/gm,
		type: "const",
		extract: (m) => ({ name: m[1] }),
	},
	{
		pattern: /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)/gm,
		type: "function",
		extract: (m) => ({ name: m[1], signature: `(${m[2]})` }),
	},
];

/**
 * Regex patterns for imports/references
 */
const IMPORT_PATTERNS: Array<{
	pattern: RegExp;
	extract: (match: RegExpMatchArray) => { names: string[]; from: string };
}> = [
	{
		pattern: /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g,
		extract: (m) => ({
			names: m[1].split(",").map((n) => n.trim().split(" as ")[0].trim()),
			from: m[2],
		}),
	},
	{
		pattern: /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
		extract: (m) => ({ names: [m[1]], from: m[2] }),
	},
	{
		pattern: /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
		extract: (m) => ({ names: [m[1]], from: m[2] }),
	},
];

/**
 * Repo Map Generator with Multi-File Context (Cursor Pattern)
 */
export class RepoMap {
	private config: RepoMapConfig;
	private definitions: Definition[] = [];
	private references: Reference[] = [];
	private fileScores: Map<string, number> = new Map();
	private symbolUsages: Map<string, SymbolUsage> = new Map();
	private fileDependencies: Map<string, Set<string>> = new Map();
	private scanned = false;

	constructor(config: Partial<RepoMapConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * Check if a file matches include patterns and not exclude patterns
	 */
	private shouldIncludeFile(file: string): boolean {
		// Check exclude patterns first
		for (const pattern of this.config.excludePatterns) {
			if (this.matchPattern(file, pattern)) {
				return false;
			}
		}

		// Check include patterns
		for (const pattern of this.config.includePatterns) {
			if (this.matchPattern(file, pattern)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Simple glob pattern matching
	 * Converts glob patterns to regex for matching
	 */
	private matchPattern(file: string, pattern: string): boolean {
		// Build regex from glob pattern
		// Use a different approach: manually build regex without conflicting replacements
		let regex = "^";

		for (let i = 0; i < pattern.length; i++) {
			const char = pattern[i];
			const nextChar = pattern[i + 1];
			const nextNextChar = pattern[i + 2];

			if (char === "*" && nextChar === "*") {
				// ** matches any directory depth (including none)
				// If followed by /, consume both ** and /
				const charAfterStarStar = pattern[i + 2];
				if (charAfterStarStar === "/" || charAfterStarStar === undefined) {
					regex += "(.*/)?";
					if (charAfterStarStar === "/") {
						i++; // Skip the /
					}
				} else {
					regex += ".*";
				}
				i++; // Skip next *
			} else if (char === "*") {
				// * matches anything except /
				regex += "[^/]*";
			} else if (char === "?") {
				// ? matches single character except /
				regex += "[^/]";
			} else if (char === ".") {
				// Escape dot
				regex += "\\.";
			} else {
				// Literal character
				regex += char;
			}
		}

		regex += "$";

		return new RegExp(regex).test(file);
	}

	/**
	 * Find all source files in the repository
	 */
	private findSourceFiles(dir: string): string[] {
		const files: string[] = [];

		if (!existsSync(dir)) {
			return files;
		}

		const entries = readdirSync(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			const relPath = relative(this.config.root, fullPath);

			if (entry.isDirectory()) {
				// Skip hidden directories and node_modules
				if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
					files.push(...this.findSourceFiles(fullPath));
				}
			} else if (entry.isFile()) {
				if (this.shouldIncludeFile(relPath)) {
					files.push(relPath);
				}
			}
		}

		return files;
	}

	/**
	 * Extract definitions from a source file
	 */
	extractDefinitions(file: string): Definition[] {
		const fullPath = join(this.config.root, file);
		if (!existsSync(fullPath)) {
			return [];
		}

		const content = readFileSync(fullPath, "utf-8");
		const definitions: Definition[] = [];
		let match: RegExpExecArray | null;

		for (const { pattern, type, extract } of DEFINITION_PATTERNS) {
			pattern.lastIndex = 0; // Reset regex state

			match = pattern.exec(content);
			while (match !== null) {
				const { name, signature } = extract(match);
				const lineNumber = content.substring(0, match.index).split("\n").length;

				definitions.push({
					file,
					name,
					type,
					line: lineNumber,
					signature,
				});

				match = pattern.exec(content);
			}
		}

		return definitions;
	}

	/**
	 * Extract references (imports) from a source file
	 */
	extractReferences(file: string): Reference[] {
		const fullPath = join(this.config.root, file);
		if (!existsSync(fullPath)) {
			return [];
		}

		const content = readFileSync(fullPath, "utf-8");
		const references: Reference[] = [];
		let match: RegExpExecArray | null;

		for (const { pattern, extract } of IMPORT_PATTERNS) {
			pattern.lastIndex = 0; // Reset regex state

			match = pattern.exec(content);
			while (match !== null) {
				const { names, from } = extract(match);

				for (const name of names) {
					references.push({
						file,
						name,
						importFrom: from,
					});
				}

				match = pattern.exec(content);
			}
		}

		return references;
	}

	/**
	 * Calculate file importance scores using PageRank-like algorithm
	 */
	private calculateFileScores(): void {
		// Count definitions per file
		const defCounts = new Map<string, number>();
		for (const def of this.definitions) {
			defCounts.set(def.file, (defCounts.get(def.file) || 0) + 1);
		}

		// Count references per file
		const refCounts = new Map<string, number>();
		for (const ref of this.references) {
			refCounts.set(ref.file, (refCounts.get(ref.file) || 0) + 1);
		}

		// Build a simple graph: files that import from other files
		const edges = new Map<string, Set<string>>();
		for (const ref of this.references) {
			const sourceFile = ref.file;
			const targetFile = this.resolveImport(ref.importFrom || "", sourceFile);

			if (targetFile) {
				if (!edges.has(sourceFile)) {
					edges.set(sourceFile, new Set());
				}
				edges.get(sourceFile)?.add(targetFile);
			}
		}

		// Simple scoring: files with many definitions + many imports to them
		const allFiles = new Set([...defCounts.keys(), ...refCounts.keys()]);
		for (const file of allFiles) {
			let score = 0;

			// Base score from definitions
			score += (defCounts.get(file) || 0) * 2;

			// Score from being imported by others
			const incomingEdges = this.countIncomingEdges(file, edges);
			score += incomingEdges * 3;

			// Recently modified files get bonus
			const fullPath = join(this.config.root, file);
			if (existsSync(fullPath)) {
				const stats = statSync(fullPath);
				const mtime = stats.mtime.getTime();
				const now = Date.now();
				const daysSinceModified = (now - mtime) / (1000 * 60 * 60 * 24);
				if (daysSinceModified < 1) {
					score += 5; // Modified today
				} else if (daysSinceModified < 7) {
					score += 2; // Modified this week
				}
			}

			this.fileScores.set(file, score);
		}
	}

	/**
	 * Resolve import path to file path
	 */
	private resolveImport(importPath: string, fromFile: string): string | null {
		// Handle relative imports
		if (importPath.startsWith(".")) {
			const lastSlash = fromFile.lastIndexOf("/");
			const fromDir = lastSlash >= 0 ? fromFile.substring(0, lastSlash + 1) : "";
			const resolved = fromDir + importPath;
			// Add extension
			const extensions = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.js"];
			for (const ext of extensions) {
				const fullPath = join(this.config.root, resolved + ext);
				if (existsSync(fullPath)) {
					return relative(this.config.root, fullPath);
				}
			}
		}

		// Handle absolute imports from project
		const projectImport = join(this.config.root, "src", importPath);
		const extensions = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.js"];
		for (const ext of extensions) {
			const fullPath = projectImport + ext;
			if (existsSync(fullPath)) {
				return relative(this.config.root, fullPath);
			}
		}

		return null;
	}

	/**
	 * Count incoming edges to a file
	 */
	private countIncomingEdges(file: string, edges: Map<string, Set<string>>): number {
		let count = 0;
		for (const [, targets] of edges) {
			if (targets.has(file)) {
				count++;
			}
		}
		return count;
	}

	/**
	 * Estimate token count for text
	 */
	private estimateTokens(text: string): number {
		// Rough estimate: ~4 chars per token for code
		return Math.ceil(text.length / 4);
	}

	/**
	 * Ensure files are scanned before using multi-file context features
	 */
	private ensureScanned(): void {
		if (this.scanned) return;

		// Find and scan all source files
		const files = this.findSourceFiles(this.config.root);

		for (const file of files) {
			this.definitions.push(...this.extractDefinitions(file));
			this.references.push(...this.extractReferences(file));
		}

		// Calculate file importance
		this.calculateFileScores();

		// Build symbol usages and file dependencies
		this.buildSymbolUsages();
		this.buildFileDependencies();

		this.scanned = true;
	}

	/**
	 * Build symbol usage map (Multi-File Context - Cursor Pattern)
	 */
	private buildSymbolUsages(): void {
		// Create a map of definitions by name
		const definitionMap = new Map<string, Definition>();
		for (const def of this.definitions) {
			definitionMap.set(def.name, def);
		}

		// Count usages per file for each symbol
		const usageCounts = new Map<string, Map<string, { count: number; importFrom?: string }>>();

		for (const ref of this.references) {
			const key = ref.name;
			if (!usageCounts.has(key)) {
				usageCounts.set(key, new Map());
			}
			const fileUsages = usageCounts.get(key);
			if (!fileUsages) continue;
			const existing = fileUsages.get(ref.file) || { count: 0, importFrom: ref.importFrom };
			fileUsages.set(ref.file, { count: existing.count + 1, importFrom: ref.importFrom });
		}

		// Build SymbolUsage objects
		for (const [name, fileUsages] of usageCounts) {
			const def = definitionMap.get(name);
			if (!def) continue; // Skip symbols not defined in the codebase

			const usedIn = Array.from(fileUsages.entries())
				.filter(([file]) => file !== def.file) // Exclude definition file
				.map(([file, data]) => ({
					file,
					importFrom: data.importFrom,
					count: data.count,
				}));

			this.symbolUsages.set(name, {
				name,
				definedIn: def.file,
				type: def.type,
				usedIn,
				totalUsageCount: usedIn.reduce((sum, u) => sum + u.count, 0),
			});
		}
	}

	/**
	 * Build file dependency graph (Multi-File Context - Cursor Pattern)
	 */
	private buildFileDependencies(): void {
		for (const ref of this.references) {
			const sourceFile = ref.file;
			const targetFile = this.resolveImport(ref.importFrom || "", sourceFile);

			if (targetFile) {
				if (!this.fileDependencies.has(sourceFile)) {
					this.fileDependencies.set(sourceFile, new Set());
				}
				this.fileDependencies.get(sourceFile)?.add(targetFile);
			}
		}
	}

	/**
	 * Get symbol usages across files (Multi-File Context - Cursor Pattern)
	 */
	getSymbolUsages(symbolName?: string): SymbolUsage[] {
		this.ensureScanned();

		if (symbolName) {
			const usage = this.symbolUsages.get(symbolName);
			return usage ? [usage] : [];
		}

		return Array.from(this.symbolUsages.values());
	}

	/**
	 * Analyze change impact for a file (Multi-File Context - Cursor Pattern)
	 */
	analyzeChangeImpact(file: string): ChangeImpact {
		this.ensureScanned();

		// Find symbols defined in this file
		const affectedSymbols = this.definitions
			.filter((d) => d.file === file)
			.map((d) => ({
				name: d.name,
				type: d.type,
				definedIn: d.file,
			}));

		// Find files that depend on this file
		const dependentFiles: Array<{
			file: string;
			reason: string;
			risk: "low" | "medium" | "high";
		}> = [];

		for (const [sourceFile, deps] of this.fileDependencies) {
			if (deps.has(file)) {
				// Calculate risk based on how many symbols are imported
				const importedSymbols = this.references.filter(
					(r) => r.file === sourceFile && this.resolveImport(r.importFrom || "", r.file) === file,
				).length;

				const risk: "low" | "medium" | "high" =
					importedSymbols > 5 ? "high" : importedSymbols > 2 ? "medium" : "low";

				dependentFiles.push({
					file: sourceFile,
					reason: `Imports ${importedSymbols} symbol(s) from this file`,
					risk,
				});
			}
		}

		// Calculate overall risk level
		const highRiskCount = dependentFiles.filter((d) => d.risk === "high").length;
		const mediumRiskCount = dependentFiles.filter((d) => d.risk === "medium").length;

		let riskLevel: "low" | "medium" | "high" | "critical";
		if (highRiskCount > 3) {
			riskLevel = "critical";
		} else if (highRiskCount > 0) {
			riskLevel = "high";
		} else if (mediumRiskCount > 2) {
			riskLevel = "medium";
		} else {
			riskLevel = "low";
		}

		// Build summary
		const summary =
			`Changing ${file} affects ${affectedSymbols.length} symbol(s) and ${dependentFiles.length} dependent file(s). ` +
			`Risk level: ${riskLevel}`;

		return {
			file,
			affectedSymbols,
			dependentFiles,
			riskLevel,
			summary,
		};
	}

	/**
	 * Get related files for a file (Multi-File Context - Cursor Pattern)
	 */
	getRelatedFiles(file: string): RelatedFiles {
		this.ensureScanned();

		const related: Array<{
			file: string;
			relation: "imports" | "imported-by" | "shared-types" | "shared-functions" | "same-module";
			strength: number;
		}> = [];

		// Files this file imports
		const imports = this.fileDependencies.get(file) || new Set();
		for (const imported of imports) {
			related.push({
				file: imported,
				relation: "imports",
				strength: 3,
			});
		}

		// Files that import this file
		for (const [sourceFile, deps] of this.fileDependencies) {
			if (deps.has(file)) {
				related.push({
					file: sourceFile,
					relation: "imported-by",
					strength: 4,
				});
			}
		}

		// Files with shared types/interfaces
		const thisTypes = this.definitions
			.filter((d) => d.file === file && (d.type === "interface" || d.type === "type"))
			.map((d) => d.name);

		for (const typeName of thisTypes) {
			const usage = this.symbolUsages.get(typeName);
			if (usage) {
				for (const u of usage.usedIn) {
					// Check if already in related
					if (!related.some((r) => r.file === u.file)) {
						related.push({
							file: u.file,
							relation: "shared-types",
							strength: 2,
						});
					}
				}
			}
		}

		// Files in the same module (directory)
		const fileDir = file.substring(0, file.lastIndexOf("/"));
		const sameModuleFiles = this.definitions
			.filter((d) => d.file.startsWith(`${fileDir}/`) && d.file !== file)
			.map((d) => d.file);

		for (const moduleFile of new Set(sameModuleFiles)) {
			if (!related.some((r) => r.file === moduleFile)) {
				related.push({
					file: moduleFile,
					relation: "same-module",
					strength: 1,
				});
			}
		}

		// Sort by strength
		related.sort((a, b) => b.strength - a.strength);

		// Determine edit order (files that should be edited together)
		const editOrder = [file];
		for (const r of related) {
			if (r.relation === "imported-by" || r.relation === "shared-types") {
				editOrder.push(r.file);
			}
		}

		const summary =
			`File ${file} is related to ${related.length} file(s): ` +
			`${imports.size} imports, ${related.filter((r) => r.relation === "imported-by").length} imported-by, ` +
			`${related.filter((r) => r.relation === "shared-types").length} shared-types`;

		return {
			file,
			related,
			editOrder,
			summary,
		};
	}

	/**
	 * Generate the repo map
	 */
	generate(): string {
		this.ensureScanned();

		// Sort definitions by file score
		const sortedDefinitions = [...this.definitions].sort((a, b) => {
			const scoreA = this.fileScores.get(a.file) || 0;
			const scoreB = this.fileScores.get(b.file) || 0;
			return scoreB - scoreA;
		});

		// Build output with token budget
		let output = "# Repo Map\n\n";
		let tokens = this.estimateTokens(output);
		const maxTokens = this.config.maxTokens;

		// Group definitions by file
		const fileDefinitions = new Map<string, Definition[]>();
		for (const def of sortedDefinitions) {
			if (!fileDefinitions.has(def.file)) {
				fileDefinitions.set(def.file, []);
			}
			fileDefinitions.get(def.file)?.push(def);
		}

		// Output files sorted by score
		const sortedFiles = [...fileDefinitions.keys()].sort(
			(a, b) => (this.fileScores.get(b) || 0) - (this.fileScores.get(a) || 0),
		);

		for (const file of sortedFiles) {
			const defs = fileDefinitions.get(file) || [];
			const fileSection = this.formatFileSection(file, defs);
			const sectionTokens = this.estimateTokens(fileSection);

			if (tokens + sectionTokens > maxTokens) {
				// Token budget exhausted, truncate
				output += `\n... (truncated, ${sortedFiles.length - sortedFiles.indexOf(file)} more files)\n`;
				break;
			}

			output += fileSection;
			tokens += sectionTokens;
		}

		return output;
	}

	/**
	 * Format a file's definitions
	 */
	private formatFileSection(file: string, defs: Definition[]): string {
		if (defs.length === 0) {
			return `## ${file}\n\n`;
		}

		let section = `## ${file}\n\n`;

		// Group by type
		const byType = new Map<Definition["type"], Definition[]>();
		for (const def of defs) {
			if (!byType.has(def.type)) {
				byType.set(def.type, []);
			}
			byType.get(def.type)?.push(def);
		}

		// Output each type group
		const typeOrder: Definition["type"][] = [
			"interface",
			"type",
			"class",
			"enum",
			"function",
			"method",
			"const",
		];

		for (const type of typeOrder) {
			const typeDefs = byType.get(type) || [];
			if (typeDefs.length === 0) continue;

			section += `### ${type}s\n`;

			for (const def of typeDefs) {
				const lineInfo = this.config.showLineNumbers ? ` (L${def.line})` : "";
				const sigInfo = def.signature ? def.signature : "";
				section += `- ${def.name}${sigInfo}${lineInfo}\n`;
			}

			section += "\n";
		}

		return section;
	}

	/**
	 * Get definitions for a specific file
	 */
	getDefinitions(file: string): Definition[] {
		return this.definitions.filter((d) => d.file === file);
	}

	/**
	 * Get all definitions
	 */
	getAllDefinitions(): Definition[] {
		return [...this.definitions];
	}

	/**
	 * Get file scores
	 */
	getFileScores(): Map<string, number> {
		return new Map(this.fileScores);
	}
}

/**
 * Generate a repo map for the current project
 */
export function generateRepoMap(root = ".", maxTokens = 2048): string {
	const repoMap = new RepoMap({ root, maxTokens });
	return repoMap.generate();
}
