/**
 * Coding Conventions Manager (Aider Pattern)
 *
 * Manages coding conventions for the agent to follow when writing code.
 * Inspired by Aider's CONVENTIONS.md pattern for specifying coding guidelines.
 *
 * Features:
 * - Load conventions from CONVENTIONS.md file
 * - Load conventions from .conventions/ directory
 * - Apply conventions when generating code
 * - Auto-load conventions at session start
 * - Default conventions for common patterns
 * - Community conventions support
 */

import * as fs from "node:fs";
import * as path from "node:path";

// Types
export interface CodingConvention {
	id: string;
	name: string;
	category: ConventionCategory;
	description: string;
	rules: ConventionRule[];
	enabled: boolean;
	priority: number;
	source: ConventionSource;
	createdAt: string;
	updatedAt: string;
}

export type ConventionCategory =
	| "libraries"
	| "types"
	| "style"
	| "patterns"
	| "testing"
	| "documentation"
	| "security"
	| "performance"
	| "accessibility"
	| "custom";

export type ConventionSource = "file" | "directory" | "default" | "community" | "user";

export interface ConventionRule {
	id: string;
	description: string;
	example?: string;
	antiExample?: string;
	severity: "error" | "warning" | "info";
}

export interface ConventionsConfig {
	enabled: boolean;
	autoLoad: boolean;
	conventionsPath: string;
	detectConventions: boolean;
	enforceConventions: boolean;
	ignorePatterns: string[];
}

export interface ConventionsStats {
	totalConventions: number;
	byCategory: Record<string, number>;
	bySource: Record<string, number>;
	timesApplied: number;
	issuesFound: number;
	issuesFixed: number;
	lastLoaded: string;
}

const DEFAULT_CONFIG: ConventionsConfig = {
	enabled: true,
	autoLoad: true,
	conventionsPath: "CONVENTIONS.md",
	detectConventions: true,
	enforceConventions: true,
	ignorePatterns: ["node_modules/**", "dist/**", ".git/**"],
};

// Default conventions
const DEFAULT_CONVENTIONS: CodingConvention[] = [
	{
		id: "typescript-types",
		name: "TypeScript Type Safety",
		category: "types",
		description: "Use TypeScript types everywhere possible. Prefer explicit types over 'any'.",
		rules: [
			{
				id: "ts-explicit-types",
				description: "Always use explicit types for function parameters and return values",
				example: "function greet(name: string): string { return `Hello, ${name}`; }",
				severity: "warning",
			},
			{
				id: "ts-no-any",
				description: "Avoid 'any' type. Use 'unknown' if type is truly unknown.",
				antiExample: "const data: any = JSON.parse(json);",
				severity: "error",
			},
		],
		enabled: true,
		priority: 8,
		source: "default",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	},
	{
		id: "async-await",
		name: "Async/Await Pattern",
		category: "patterns",
		description: "Use async/await instead of .then() chains for asynchronous code.",
		rules: [
			{
				id: "async-prefer-await",
				description: "Prefer async/await over .then() chains",
				example: "const data = await fetch(url);",
				antiExample: "fetch(url).then(response => response.json()).then(data => ...);",
				severity: "info",
			},
		],
		enabled: true,
		priority: 6,
		source: "default",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	},
	{
		id: "error-handling",
		name: "Error Handling",
		category: "patterns",
		description: "Always handle errors appropriately. Use try/catch for async operations.",
		rules: [
			{
				id: "error-try-catch",
				description: "Wrap async operations in try/catch blocks",
				example: "try { const data = await fetchData(); } catch (error) { handleError(error); }",
				severity: "warning",
			},
		],
		enabled: true,
		priority: 9,
		source: "default",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	},
	{
		id: "naming-conventions",
		name: "Naming Conventions",
		category: "style",
		description: "Follow consistent naming conventions for variables, functions, and classes.",
		rules: [
			{
				id: "naming-camelCase",
				description: "Use camelCase for variables and functions",
				example: "const userName = 'John'; function getUser() { }",
				severity: "info",
			},
			{
				id: "naming-PascalCase",
				description: "Use PascalCase for classes and types",
				example: "class UserService { } interface UserData { }",
				severity: "info",
			},
			{
				id: "naming-UPPER_CASE",
				description: "Use UPPER_CASE for constants",
				example: "const MAX_RETRIES = 3;",
				severity: "info",
			},
		],
		enabled: true,
		priority: 5,
		source: "default",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	},
	{
		id: "import-organization",
		name: "Import Organization",
		category: "style",
		description: "Organize imports in a consistent order: built-in, external, internal.",
		rules: [
			{
				id: "import-order",
				description: "Order imports: built-in modules, external packages, internal modules",
				example:
					"import fs from 'fs';\nimport express from 'express';\nimport { utils } from './utils';",
				severity: "info",
			},
		],
		enabled: true,
		priority: 4,
		source: "default",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	},
	{
		id: "documentation-comments",
		name: "Documentation Comments",
		category: "documentation",
		description: "Add JSDoc comments for public functions and classes.",
		rules: [
			{
				id: "doc-jsdoc",
				description: "Add JSDoc comments for public APIs",
				example:
					"/**\n * Fetches user data from the API\n * @param userId - The user's unique identifier\n * @returns The user data object\n */\nasync function fetchUser(userId: string): Promise<UserData> { }",
				severity: "info",
			},
		],
		enabled: true,
		priority: 5,
		source: "default",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	},
];

let managerInstance: CodingConventionsManager | null = null;

export class CodingConventionsManager {
	private config: ConventionsConfig;
	private conventions: Map<string, CodingConvention> = new Map();
	private stats: ConventionsStats;
	private dataPath: string;

	constructor(configPath?: string) {
		this.config = { ...DEFAULT_CONFIG };
		const homeDir = process.env.HOME || process.cwd();
		this.dataPath = path.join(homeDir, ".paimon", "coding-conventions.json");
		this.stats = {
			totalConventions: 0,
			byCategory: {},
			bySource: {},
			timesApplied: 0,
			issuesFound: 0,
			issuesFixed: 0,
			lastLoaded: "",
		};

		this.loadConfig();
		this.loadData();
		this.loadDefaultConventions();

		if (this.config.autoLoad) {
			this.loadConventionsFromFile();
			this.loadConventionsFromDirectory();
		}
	}

	private loadConfig(): void {
		try {
			const homeDir = process.env.HOME || process.cwd();
			const configPath = path.join(homeDir, ".paimon", "conventions-config.json");
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
				this.stats = data.stats || this.stats;
				// Load user-added conventions
				if (data.conventions) {
					for (const convention of data.conventions) {
						this.conventions.set(convention.id, convention);
					}
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
						conventions: Array.from(this.conventions.values()).filter((c) => c.source === "user"),
						stats: this.stats,
						config: this.config,
					},
					null,
					2,
				),
			);
		} catch (error) {
			console.error("Failed to save coding conventions data:", error);
		}
	}

	private loadDefaultConventions(): void {
		for (const convention of DEFAULT_CONVENTIONS) {
			this.conventions.set(convention.id, convention);
		}
		this.updateStats();
	}

	private updateStats(): void {
		const conventions = Array.from(this.conventions.values());
		this.stats.totalConventions = conventions.length;

		// Reset counts
		this.stats.byCategory = {};
		this.stats.bySource = {};

		// Count by category and source
		for (const convention of conventions) {
			this.stats.byCategory[convention.category] =
				(this.stats.byCategory[convention.category] || 0) + 1;
			this.stats.bySource[convention.source] = (this.stats.bySource[convention.source] || 0) + 1;
		}
	}

	/**
	 * Load conventions from CONVENTIONS.md file (Aider pattern)
	 */
	public loadConventionsFromFile(): boolean {
		const conventionsPath = path.resolve(this.config.conventionsPath);

		if (!fs.existsSync(conventionsPath)) {
			return false;
		}

		try {
			const content = fs.readFileSync(conventionsPath, "utf-8");
			const parsed = this.parseConventionsFile(content, conventionsPath);

			for (const convention of parsed) {
				this.conventions.set(convention.id, convention);
			}

			this.stats.lastLoaded = new Date().toISOString();
			this.updateStats();
			return true;
		} catch (error) {
			console.error("Failed to load conventions from file:", error);
			return false;
		}
	}

	/**
	 * Parse CONVENTIONS.md file content into conventions
	 */
	private parseConventionsFile(content: string, filePath: string): CodingConvention[] {
		const conventions: CodingConvention[] = [];
		const lines = content.split("\n");
		const currentConvention: Partial<CodingConvention> | null = null;
		const currentRules: ConventionRule[] = [];

		for (const line of lines) {
			const trimmed = line.trim();

			// Skip empty lines
			if (!trimmed) continue;

			// Parse as rule (lines starting with -)
			if (trimmed.startsWith("- ")) {
				const ruleText = trimmed.substring(2);
				currentRules.push({
					id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
					description: ruleText,
					severity: "info",
				});
			}
		}

		// If we have rules but no explicit convention, create one from the file
		if (currentRules.length > 0 || lines.some((l) => l.trim())) {
			const convention: CodingConvention = {
				id: `file-${path.basename(filePath, ".md")}`,
				name: "Project Conventions",
				category: "custom",
				description: `Conventions loaded from ${path.basename(filePath)}`,
				rules:
					currentRules.length > 0
						? currentRules
						: [
								{
									id: `rule-${Date.now()}`,
									description: content.trim(),
									severity: "info",
								},
							],
				enabled: true,
				priority: 7,
				source: "file",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};
			conventions.push(convention);
		}

		return conventions;
	}

	/**
	 * Load conventions from .conventions/ directory
	 */
	public loadConventionsFromDirectory(): boolean {
		const conventionsDir = path.resolve(".conventions");

		if (!fs.existsSync(conventionsDir)) {
			return false;
		}

		try {
			const files = fs.readdirSync(conventionsDir);
			let loaded = false;

			for (const file of files) {
				if (file.endsWith(".md") || file.endsWith(".json")) {
					const filePath = path.join(conventionsDir, file);
					const content = fs.readFileSync(filePath, "utf-8");

					if (file.endsWith(".json")) {
						try {
							const convention = JSON.parse(content);
							if (convention.id && convention.name) {
								convention.source = "directory";
								this.conventions.set(convention.id, convention);
								loaded = true;
							}
						} catch {
							// Skip invalid JSON
						}
					} else {
						const parsed = this.parseConventionsFile(content, filePath);
						for (const convention of parsed) {
							this.conventions.set(convention.id, convention);
							loaded = true;
						}
					}
				}
			}

			if (loaded) {
				this.stats.lastLoaded = new Date().toISOString();
				this.updateStats();
			}
			return loaded;
		} catch (error) {
			console.error("Failed to load conventions from directory:", error);
			return false;
		}
	}

	/**
	 * Get formatted conventions for prompt injection
	 */
	public getConventionsForPrompt(): string {
		const conventions = Array.from(this.conventions.values())
			.filter((c) => c.enabled)
			.sort((a, b) => b.priority - a.priority);

		if (conventions.length === 0) {
			return "";
		}

		const lines: string[] = ["## Coding Conventions", ""];

		for (const convention of conventions) {
			lines.push(`### ${convention.name}`);
			lines.push("");
			lines.push(convention.description);
			lines.push("");

			if (convention.rules.length > 0) {
				lines.push("**Rules:**");
				for (const rule of convention.rules) {
					lines.push(`- ${rule.description}`);
					if (rule.example) {
						lines.push(`  - Example: ${rule.example}`);
					}
					if (rule.antiExample) {
						lines.push(`  - Avoid: ${rule.antiExample}`);
					}
				}
				lines.push("");
			}
		}

		return lines.join("\n");
	}

	/**
	 * Get all conventions
	 */
	public getConventions(): CodingConvention[] {
		return Array.from(this.conventions.values());
	}

	/**
	 * Get convention by ID
	 */
	public getConvention(id: string): CodingConvention | undefined {
		return this.conventions.get(id);
	}

	/**
	 * Add a convention
	 */
	public addConvention(
		convention: Omit<CodingConvention, "id" | "createdAt" | "updatedAt">,
	): CodingConvention {
		const id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		const newConvention: CodingConvention = {
			...convention,
			id,
			source: convention.source || "user",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		this.conventions.set(id, newConvention);
		this.updateStats();
		this.saveData();

		return newConvention;
	}

	/**
	 * Update a convention
	 */
	public updateConvention(id: string, updates: Partial<CodingConvention>): CodingConvention | null {
		const existing = this.conventions.get(id);
		if (!existing) return null;

		const updated: CodingConvention = {
			...existing,
			...updates,
			id, // Preserve ID
			updatedAt: new Date().toISOString(),
		};

		this.conventions.set(id, updated);
		this.updateStats();
		this.saveData();

		return updated;
	}

	/**
	 * Remove a convention
	 */
	public removeConvention(id: string): boolean {
		const result = this.conventions.delete(id);
		if (result) {
			this.updateStats();
			this.saveData();
		}
		return result;
	}

	/**
	 * Enable/disable a convention
	 */
	public setConventionEnabled(id: string, enabled: boolean): boolean {
		const convention = this.conventions.get(id);
		if (!convention) return false;

		convention.enabled = enabled;
		convention.updatedAt = new Date().toISOString();
		this.updateStats();
		this.saveData();

		return true;
	}

	/**
	 * Get conventions by category
	 */
	public getConventionsByCategory(category: ConventionCategory): CodingConvention[] {
		return Array.from(this.conventions.values()).filter((c) => c.category === category);
	}

	/**
	 * Get conventions by source
	 */
	public getConventionsBySource(source: ConventionSource): CodingConvention[] {
		return Array.from(this.conventions.values()).filter((c) => c.source === source);
	}

	/**
	 * Record convention application
	 */
	public recordApplication(issuesFound = 0, issuesFixed = 0): void {
		this.stats.timesApplied++;
		this.stats.issuesFound += issuesFound;
		this.stats.issuesFixed += issuesFixed;
		this.saveData();
	}

	/**
	 * Get statistics
	 */
	public getStats(): ConventionsStats {
		return { ...this.stats };
	}

	/**
	 * Get configuration
	 */
	public getConfig(): ConventionsConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration
	 */
	public updateConfig(updates: Partial<ConventionsConfig>): ConventionsConfig {
		this.config = { ...this.config, ...updates };
		this.saveData();
		return this.getConfig();
	}

	/**
	 * Enable/disable conventions
	 */
	public setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveData();
	}

	/**
	 * Check if conventions are enabled
	 */
	public isEnabled(): boolean {
		return this.config.enabled;
	}

	/**
	 * Reset statistics
	 */
	public resetStats(): { success: boolean; message: string } {
		this.stats = {
			totalConventions: this.conventions.size,
			byCategory: {},
			bySource: {},
			timesApplied: 0,
			issuesFound: 0,
			issuesFixed: 0,
			lastLoaded: "",
		};
		this.updateStats();
		this.saveData();

		return { success: true, message: "Statistics reset successfully" };
	}

	/**
	 * Clear all user conventions
	 */
	public clearConventions(): { success: boolean; message: string; count: number } {
		const userConventions = Array.from(this.conventions.values()).filter(
			(c) => c.source === "user",
		);
		const count = userConventions.length;

		for (const convention of userConventions) {
			this.conventions.delete(convention.id);
		}

		this.updateStats();
		this.saveData();

		return { success: true, message: `Cleared ${count} user conventions`, count };
	}
}

/**
 * Get singleton instance
 */
export function getCodingConventionsManager(): CodingConventionsManager {
	if (!managerInstance) {
		managerInstance = new CodingConventionsManager();
	}
	return managerInstance;
}

/**
 * Reset singleton instance (for testing)
 */
export function resetCodingConventionsManager(): void {
	managerInstance = null;
}
