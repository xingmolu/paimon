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
 * Repo Map Generator
 */
export class RepoMap {
	private config: RepoMapConfig;
	private definitions: Definition[] = [];
	private references: Reference[] = [];
	private fileScores: Map<string, number> = new Map();

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
	 * Generate the repo map
	 */
	generate(): string {
		// Find and scan all source files
		const files = this.findSourceFiles(this.config.root);

		for (const file of files) {
			this.definitions.push(...this.extractDefinitions(file));
			this.references.push(...this.extractReferences(file));
		}

		// Calculate file importance
		this.calculateFileScores();

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
				output += `\n... (truncated, ${files.length - sortedFiles.indexOf(file)} more files)\n`;
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
