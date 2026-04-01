/**
 * Self-Modification Safety Gates
 *
 * Proactive dangerous pattern detection before code changes.
 * Scans proposed modifications for security risks, breaking patterns,
 * and unsafe operations that could harm self-evolution capability.
 *
 * This enables safer experimentation by catching dangerous changes
 * BEFORE they're applied, reducing failure and rework rate.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Risk levels for detected patterns
 */
export type RiskLevel = "critical" | "high" | "medium" | "low";

/**
 * Category of dangerous pattern
 */
export type PatternCategory =
	| "security" // Security vulnerabilities (eval, exec, injection)
	| "breaking" // Breaking changes (removing exports, changing signatures)
	| "data-loss" // Data loss risks (file deletion, truncation)
	| "workflow" // Protected workflow modifications
	| "dependencies" // Dependency risks (untrusted packages)
	| "configuration" // Config risks (exposing secrets, weak auth)
	| "resource" // Resource risks (infinite loops, memory leaks)
	| "self-modification"; // Self-modification risks (modifying safety gates itself)

/**
 * Detected dangerous pattern
 */
export interface DetectedPattern {
	/** Pattern ID */
	id: string;
	/** Category of pattern */
	category: PatternCategory;
	/** Risk level */
	risk: RiskLevel;
	/** Pattern name */
	name: string;
	/** Description of the risk */
	description: string;
	/** The matched code snippet */
	match: string;
	/** Line number in the code */
	line?: number;
	/** File path (if scanning a specific file) */
	file?: string;
	/** Suggested fix or alternative */
	suggestion: string;
	/** Whether this pattern can be bypassed with approval */
	bypassable: boolean;
	/** Confidence level (0-100) */
	confidence: number;
}

/**
 * Scan result from safety gate check
 */
export interface ScanResult {
	/** Whether the code change passes all safety checks */
	safe: boolean;
	/** All detected patterns */
	patterns: DetectedPattern[];
	/** Critical patterns that block the change */
	critical: DetectedPattern[];
	/** High risk patterns that should be reviewed */
	highRisk: DetectedPattern[];
	/** Summary of the scan */
	summary: string;
	/** Scan timestamp */
	timestamp: string;
	/** Content that was scanned */
	content?: string;
	/** File path that was scanned */
	file?: string;
}

/**
 * Safety gate configuration
 */
export interface SafetyGateConfig {
	/** Enable/disable safety gates */
	enabled: boolean;
	/** Minimum risk level to block (critical always blocks) */
	blockLevel: RiskLevel;
	/** Minimum risk level to warn */
	warnLevel: RiskLevel;
	/** Patterns to ignore (by ID) */
	ignorePatterns: string[];
	/** Files to ignore (glob patterns) */
	ignoreFiles: string[];
	/** Allow bypassing with explicit approval */
	allowBypass: boolean;
	/** Custom patterns to add */
	customPatterns: CustomPattern[];
}

/**
 * Custom pattern definition
 */
export interface CustomPattern {
	/** Pattern ID */
	id: string;
	/** Regex pattern to match */
	pattern: string;
	/** Category */
	category: PatternCategory;
	/** Risk level */
	risk: RiskLevel;
	/** Description */
	description: string;
	/** Suggested fix */
	suggestion: string;
	/** Whether bypassable */
	bypassable: boolean;
}

/**
 * Statistics for safety gate operations
 */
export interface SafetyGateStats {
	/** Total scans performed */
	totalScans: number;
	/** Scans that passed */
	passedScans: number;
	/** Scans that were blocked */
	blockedScans: number;
	/** Scans that had warnings */
	warnedScans: number;
	/** Patterns detected by category */
	byCategory: Record<PatternCategory, number>;
	/** Patterns detected by risk level */
	byRisk: Record<RiskLevel, number>;
	/** Most common patterns detected */
	commonPatterns: { id: string; name: string; count: number }[];
	/** Files that were blocked most often */
	blockedFiles: { file: string; count: number }[];
	/** Bypasses used */
	bypassesUsed: number;
	/** Last scan timestamp */
	lastScan?: string;
}

/**
 * Dangerous pattern definitions
 */
const DANGEROUS_PATTERNS: Array<{
	id: string;
	category: PatternCategory;
	risk: RiskLevel;
	pattern: RegExp;
	name: string;
	description: string;
	suggestion: string;
	bypassable: boolean;
}> = [
	// === CRITICAL: Security vulnerabilities ===
	{
		id: "eval-user-input",
		category: "security",
		risk: "critical",
		pattern: /\beval\s*\([^)]*(?:user|input|req|body|param)/gi,
		name: "eval() with user input",
		description: "eval() can execute arbitrary code - extremely dangerous with user input",
		suggestion: "Use JSON.parse() for data parsing, or sanitize input thoroughly",
		bypassable: false,
	},
	{
		id: "exec-user-input",
		category: "security",
		risk: "critical",
		pattern: /(?:exec|execSync|spawn|spawnSync)\s*\([^)]*(?:user|input|req|body|param)/gi,
		name: "exec() with user input",
		description: "Command execution with user input is a severe security vulnerability",
		suggestion: "Never pass user input directly to exec. Use argument arrays and sanitize",
		bypassable: false,
	},
	{
		id: "sql-injection",
		category: "security",
		risk: "critical",
		pattern: /(?:query|execute)\s*\([^)]*(?:user|input|req|body|param)/gi,
		name: "Potential SQL injection",
		description: "Direct user input in SQL queries can lead to injection attacks",
		suggestion: "Use parameterized queries or prepared statements",
		bypassable: false,
	},
	{
		id: "hardcoded-secret",
		category: "security",
		risk: "critical",
		pattern: /(?:password|secret|api_key|apikey|token|credential)\s*[=:]\s*['"][^'"]{8,}['"]/gi,
		name: "Hardcoded secret/credential",
		description: "Hardcoded secrets can be exposed in source code repositories",
		suggestion: "Use environment variables or secure secret management",
		bypassable: false,
	},

	// === HIGH: Breaking changes ===
	{
		id: "remove-export",
		category: "breaking",
		risk: "high",
		pattern:
			/^export\s+(?:function|class|interface|type|const|let|var)\s+\w+.*\n.*(?:\/\/.*remove|\/\/.*delete|\/\/.*remove)/gm,
		name: "Removing export without deprecation",
		description: "Removing exports can break dependent code without warning",
		suggestion: "Deprecate first with @deprecated annotation, then remove after grace period",
		bypassable: true,
	},
	{
		id: "change-signature",
		category: "breaking",
		risk: "high",
		pattern: /(?:function|method)\s+\w+\s*\([^)]*\).*\n.*(?:\/\/.*change|\/\/.*modify).*param/gm,
		name: "Changing function signature",
		description: "Changing function parameters can break existing callers",
		suggestion: "Add new parameters as optional, or create new function variant",
		bypassable: true,
	},

	// === HIGH: Data loss risks ===
	{
		id: "delete-all-files",
		category: "data-loss",
		risk: "critical",
		pattern: /(?:rm\s+-rf|unlinkSync|rmSync)\s*\([^)]*(?:['"]\.['"]|['"]\/['"]|process\.cwd)/gi,
		name: "Deleting all files",
		description: "Deleting all files or entire directories is irreversible",
		suggestion: "Use specific paths, add safeguards, and require explicit approval",
		bypassable: false,
	},
	{
		id: "truncate-important",
		category: "data-loss",
		risk: "high",
		pattern: /(?:truncate|writeFileSync|writeFile)\s*\([^)]*(?:memory|roadmap|identity|journal)/gi,
		name: "Truncating important files",
		description: "Overwriting important project files can lose valuable data",
		suggestion: "Read existing content first, merge or append instead of truncating",
		bypassable: true,
	},

	// === HIGH: Workflow modifications ===
	{
		id: "modify-workflow",
		category: "workflow",
		risk: "critical",
		pattern: /.github\/workflows\//gi,
		name: "Workflow file modification",
		description: "Modifying CI/CD workflows can break automated processes",
		suggestion: "Workflow files are protected - require explicit user approval",
		bypassable: false,
	},

	// === HIGH: Self-modification risks ===
	{
		id: "modify-safety-gates",
		category: "self-modification",
		risk: "critical",
		pattern: /safety-gates\.ts/gi,
		name: "Modifying safety gates",
		description: "Modifying the safety system itself could disable protections",
		suggestion: "Safety gates modifications require explicit approval and testing",
		bypassable: false,
	},
	{
		id: "modify-hooks",
		category: "self-modification",
		risk: "high",
		pattern: /hooks\.ts/gi,
		name: "Modifying hook system",
		description: "Modifying hooks could bypass security protections",
		suggestion: "Hook modifications should be reviewed carefully",
		bypassable: true,
	},
	{
		id: "modify-evolve-skill",
		category: "self-modification",
		risk: "high",
		pattern: /evolve\/SKILL\.md/gi,
		name: "Modifying evolution skill",
		description: "Modifying the evolution workflow could affect future iterations",
		suggestion: "Evolve skill changes should preserve core safety mechanisms",
		bypassable: true,
	},

	// === MEDIUM: Configuration risks ===
	{
		id: "weak-auth",
		category: "configuration",
		risk: "medium",
		pattern: /(?:auth|authenticate)\s*[=:]\s*['"](?:none|disabled|off)['"]/gi,
		name: "Weak authentication setting",
		description: "Disabling authentication can expose sensitive functionality",
		suggestion: "Keep authentication enabled, use proper auth mechanisms",
		bypassable: true,
	},
	{
		id: "expose-debug",
		category: "configuration",
		risk: "medium",
		pattern: /(?:debug|verbose)\s*[=:]\s*(?:true|1|on)/gi,
		name: "Debug mode enabled",
		description: "Debug mode can expose sensitive information in logs",
		suggestion: "Disable debug mode in production, use conditional debug",
		bypassable: true,
	},

	// === MEDIUM: Resource risks ===
	{
		id: "infinite-loop",
		category: "resource",
		risk: "medium",
		pattern: /while\s*\(\s*true\s*\)/gi,
		name: "Potential infinite loop",
		description: "while(true) without break condition can hang the process",
		suggestion: "Add explicit break conditions or timeout handling",
		bypassable: true,
	},
	{
		id: "no-timeout",
		category: "resource",
		risk: "medium",
		pattern: /(?:fetch|request|http\.get)\s*\([^)]*\)(?![^;]*timeout)/gi,
		name: "Network request without timeout",
		description: "Network requests without timeouts can hang indefinitely",
		suggestion: "Always set reasonable timeouts for network operations",
		bypassable: true,
	},

	// === LOW: Best practices ===
	{
		id: "missing-error-handling",
		category: "security",
		risk: "low",
		pattern: /(?:try\s*\{[^}]*\}\s*)(?!\s*catch)/gi,
		name: "Missing error handling",
		description: "try blocks without catch can leave errors unhandled",
		suggestion: "Add catch blocks to handle errors gracefully",
		bypassable: true,
	},
	{
		id: "console-log-secrets",
		category: "security",
		risk: "low",
		pattern: /console\.(?:log|error|warn)\s*\([^)]*(?:password|secret|key|token)/gi,
		name: "Logging sensitive data",
		description: "Logging secrets or credentials can leak them to logs",
		suggestion: "Never log sensitive data, use sanitized logging",
		bypassable: true,
	},
];

/**
 * Safety Gate Manager - scans code changes for dangerous patterns
 */
export class SafetyGateManager {
	private configPath: string;
	private config: SafetyGateConfig;
	private stats: SafetyGateStats;
	private statsPath: string;

	constructor(configPath?: string) {
		// Default to ~/.paimon/safety-gates.json
		this.configPath = configPath || join(homedir(), ".paimon", "safety-gates.json");
		this.statsPath = join(homedir(), ".paimon", "safety-stats.json");
		this.config = this.loadConfig();
		this.stats = this.loadStats();
	}

	/**
	 * Load safety gate configuration
	 */
	private loadConfig(): SafetyGateConfig {
		if (existsSync(this.configPath)) {
			try {
				const content = readFileSync(this.configPath, "utf-8");
				return JSON.parse(content);
			} catch {
				// Invalid config, use defaults
			}
		}

		// Create default config
		return {
			enabled: true,
			blockLevel: "critical",
			warnLevel: "high",
			ignorePatterns: [],
			ignoreFiles: [],
			allowBypass: true,
			customPatterns: [],
		};
	}

	/**
	 * Load statistics
	 */
	private loadStats(): SafetyGateStats {
		if (existsSync(this.statsPath)) {
			try {
				const content = readFileSync(this.statsPath, "utf-8");
				return JSON.parse(content);
			} catch {
				// Invalid stats, use defaults
			}
		}

		return {
			totalScans: 0,
			passedScans: 0,
			blockedScans: 0,
			warnedScans: 0,
			byCategory: {
				security: 0,
				breaking: 0,
				"data-loss": 0,
				workflow: 0,
				dependencies: 0,
				configuration: 0,
				resource: 0,
				"self-modification": 0,
			},
			byRisk: {
				critical: 0,
				high: 0,
				medium: 0,
				low: 0,
			},
			commonPatterns: [],
			blockedFiles: [],
			bypassesUsed: 0,
		};
	}

	/**
	 * Save configuration
	 */
	private saveConfig(): void {
		const dir = join(homedir(), ".paimon");
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), "utf-8");
	}

	/**
	 * Save statistics
	 */
	private saveStats(): void {
		const dir = join(homedir(), ".paimon");
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		writeFileSync(this.statsPath, JSON.stringify(this.stats, null, 2), "utf-8");
	}

	/**
	 * Check if safety gates are enabled
	 */
	isEnabled(): boolean {
		return this.config.enabled;
	}

	/**
	 * Enable or disable safety gates
	 */
	setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveConfig();
	}

	/**
	 * Get current configuration
	 */
	getConfig(): SafetyGateConfig {
		return this.config;
	}

	/**
	 * Update configuration
	 */
	updateConfig(updates: Partial<SafetyGateConfig>): void {
		Object.assign(this.config, updates);
		this.saveConfig();
	}

	/**
	 * Get all patterns (default + custom)
	 */
	getAllPatterns(): Array<{
		id: string;
		category: PatternCategory;
		risk: RiskLevel;
		pattern: RegExp;
		name: string;
		description: string;
		suggestion: string;
		bypassable: boolean;
	}> {
		const allPatterns = [...DANGEROUS_PATTERNS];

		// Add custom patterns
		for (const custom of this.config.customPatterns) {
			allPatterns.push({
				id: custom.id,
				category: custom.category,
				risk: custom.risk,
				pattern: new RegExp(custom.pattern, "gi"),
				name: custom.id,
				description: custom.description,
				suggestion: custom.suggestion,
				bypassable: custom.bypassable,
			});
		}

		// Filter out ignored patterns
		return allPatterns.filter((p) => !this.config.ignorePatterns.includes(p.id));
	}

	/**
	 * Scan code content for dangerous patterns
	 */
	scan(content: string, file?: string): ScanResult {
		const patterns: DetectedPattern[] = [];
		const critical: DetectedPattern[] = [];
		const highRisk: DetectedPattern[] = [];

		// Check if file is ignored
		if (file && this.config.ignoreFiles.some((pattern) => this.matchGlob(file, pattern))) {
			return {
				safe: true,
				patterns: [],
				critical: [],
				highRisk: [],
				summary: `File ${file} is ignored by safety gates`,
				timestamp: new Date().toISOString(),
				file,
			};
		}

		// Get all patterns to check
		const allPatterns = this.getAllPatterns();

		// Split content into lines for line number tracking
		const lines = content.split("\n");

		// Scan for each pattern
		for (const patternDef of allPatterns) {
			for (let lineNum = 0; lineNum < lines.length; lineNum++) {
				const line = lines[lineNum];
				const matches = line.matchAll(patternDef.pattern);

				for (const match of matches) {
					const detected: DetectedPattern = {
						id: patternDef.id,
						category: patternDef.category,
						risk: patternDef.risk,
						name: patternDef.name,
						description: patternDef.description,
						match: match[0],
						line: lineNum + 1,
						file,
						suggestion: patternDef.suggestion,
						bypassable: patternDef.bypassable,
						confidence: this.calculateConfidence(match[0], patternDef),
					};

					patterns.push(detected);

					if (patternDef.risk === "critical") {
						critical.push(detected);
					} else if (patternDef.risk === "high") {
						highRisk.push(detected);
					}
				}
			}
		}

		// Determine if safe based on block level
		const riskLevels: RiskLevel[] = ["critical", "high", "medium", "low"];
		const blockIndex = riskLevels.indexOf(this.config.blockLevel);

		const blockingPatterns = patterns.filter(
			(p) => riskLevels.indexOf(p.risk) <= blockIndex && !p.bypassable,
		);

		const safe = blockingPatterns.length === 0;

		// Update statistics
		this.updateStats(patterns, safe, file);

		// Generate summary
		const summary = this.generateSummary(patterns, safe);

		return {
			safe,
			patterns,
			critical,
			highRisk,
			summary,
			timestamp: new Date().toISOString(),
			content,
			file,
		};
	}

	/**
	 * Calculate confidence for a detected pattern
	 */
	private calculateConfidence(match: string, patternDef: (typeof DANGEROUS_PATTERNS)[0]): number {
		// Higher confidence for exact matches
		if (match.toLowerCase().includes("user") || match.toLowerCase().includes("input")) {
			return 95;
		}

		// Lower confidence for partial matches
		if (match.length < 10) {
			return 70;
		}

		// Default confidence based on category
		switch (patternDef.category) {
			case "security":
				return 90;
			case "self-modification":
				return 85;
			case "breaking":
				return 80;
			case "data-loss":
				return 85;
			case "workflow":
				return 95;
			default:
				return 75;
		}
	}

	/**
	 * Match glob pattern against file path
	 */
	private matchGlob(filePath: string, pattern: string): boolean {
		// Simple glob matching
		const regex = new RegExp(
			pattern
				.replace(/\*\*/g, ".*")
				.replace(/\*/g, "[^/]*")
				.replace(/\?/g, "[^/]")
				.replace(/\./g, "\\."),
		);
		return regex.test(filePath);
	}

	/**
	 * Update statistics after scan
	 */
	private updateStats(patterns: DetectedPattern[], safe: boolean, file?: string): void {
		this.stats.totalScans++;
		this.stats.lastScan = new Date().toISOString();

		if (safe && patterns.length === 0) {
			this.stats.passedScans++;
		} else if (patterns.some((p) => p.risk === "critical" && !p.bypassable)) {
			this.stats.blockedScans++;
		} else {
			this.stats.warnedScans++;
		}

		// Update category counts
		for (const p of patterns) {
			this.stats.byCategory[p.category]++;
			this.stats.byRisk[p.risk]++;

			// Update common patterns
			const existing = this.stats.commonPatterns.find((cp) => cp.id === p.id);
			if (existing) {
				existing.count++;
			} else {
				this.stats.commonPatterns.push({ id: p.id, name: p.name, count: 1 });
			}
		}

		// Update blocked files
		if (file && !safe) {
			const existing = this.stats.blockedFiles.find((bf) => bf.file === file);
			if (existing) {
				existing.count++;
			} else {
				this.stats.blockedFiles.push({ file, count: 1 });
			}
		}

		// Sort and limit common patterns
		this.stats.commonPatterns.sort((a, b) => b.count - a.count);
		this.stats.commonPatterns = this.stats.commonPatterns.slice(0, 10);

		// Sort and limit blocked files
		this.stats.blockedFiles.sort((a, b) => b.count - a.count);
		this.stats.blockedFiles = this.stats.blockedFiles.slice(0, 10);

		this.saveStats();
	}

	/**
	 * Generate summary for scan result
	 */
	private generateSummary(patterns: DetectedPattern[], safe: boolean): string {
		if (safe && patterns.length === 0) {
			return "✅ Code change passed all safety checks";
		}

		if (!safe) {
			const critical = patterns.filter((p) => p.risk === "critical" && !p.bypassable);
			return `🚫 Code change BLOCKED: ${critical.length} critical pattern(s) detected`;
		}

		const warnings = patterns.filter((p) => p.risk === "high");
		if (warnings.length > 0) {
			return `⚠️ Code change passed with warnings: ${warnings.length} high-risk pattern(s) detected`;
		}

		return `✅ Code change passed: ${patterns.length} low/medium risk pattern(s) detected`;
	}

	/**
	 * Get statistics
	 */
	getStats(): SafetyGateStats {
		return this.stats;
	}

	/**
	 * Reset statistics
	 */
	resetStats(): void {
		this.stats = {
			totalScans: 0,
			passedScans: 0,
			blockedScans: 0,
			warnedScans: 0,
			byCategory: {
				security: 0,
				breaking: 0,
				"data-loss": 0,
				workflow: 0,
				dependencies: 0,
				configuration: 0,
				resource: 0,
				"self-modification": 0,
			},
			byRisk: {
				critical: 0,
				high: 0,
				medium: 0,
				low: 0,
			},
			commonPatterns: [],
			blockedFiles: [],
			bypassesUsed: 0,
		};
		this.saveStats();
	}

	/**
	 * Record a bypass
	 */
	recordBypass(): void {
		this.stats.bypassesUsed++;
		this.saveStats();
	}

	/**
	 * Add custom pattern
	 */
	addCustomPattern(pattern: CustomPattern): void {
		// Check if pattern already exists
		const existing = this.config.customPatterns.find((p) => p.id === pattern.id);
		if (existing) {
			Object.assign(existing, pattern);
		} else {
			this.config.customPatterns.push(pattern);
		}
		this.saveConfig();
	}

	/**
	 * Remove custom pattern
	 */
	removeCustomPattern(id: string): boolean {
		const index = this.config.customPatterns.findIndex((p) => p.id === id);
		if (index >= 0) {
			this.config.customPatterns.splice(index, 1);
			this.saveConfig();
			return true;
		}
		return false;
	}

	/**
	 * Add pattern to ignore list
	 */
	ignorePattern(id: string): void {
		if (!this.config.ignorePatterns.includes(id)) {
			this.config.ignorePatterns.push(id);
			this.saveConfig();
		}
	}

	/**
	 * Remove pattern from ignore list
	 */
	unignorePattern(id: string): void {
		const index = this.config.ignorePatterns.indexOf(id);
		if (index >= 0) {
			this.config.ignorePatterns.splice(index, 1);
			this.saveConfig();
		}
	}

	/**
	 * Format scan result for display
	 */
	formatScanResult(result: ScanResult): string {
		let output = "## Safety Gate Scan Result\n";
		output += `${"─".repeat(50)}\n`;

		if (result.safe) {
			output += `✅ ${result.summary}\n`;
		} else {
			output += `🚫 ${result.summary}\n`;
		}

		output += `Timestamp: ${result.timestamp}\n`;
		if (result.file) {
			output += `File: ${result.file}\n`;
		}

		if (result.patterns.length > 0) {
			output += `\n### Detected Patterns (${result.patterns.length})\n`;
			output += `${"─".repeat(50)}\n`;

			// Group by risk level
			const risks: RiskLevel[] = ["critical", "high", "medium", "low"];
			for (const risk of risks) {
				const byRisk = result.patterns.filter((p) => p.risk === risk);
				if (byRisk.length > 0) {
					output += `\n**${risk.toUpperCase()} (${byRisk.length}):**\n`;
					for (const p of byRisk) {
						const bypassIcon = p.bypassable ? "⚠️" : "🚫";
						output += `${bypassIcon} [${p.category}] ${p.name}\n`;
						output += `   Line ${p.line || "?"}: ${p.match}\n`;
						output += `   ${p.description}\n`;
						output += `   Suggestion: ${p.suggestion}\n`;
						output += `   Confidence: ${p.confidence}%\n`;
					}
				}
			}
		}

		return output;
	}

	/**
	 * Format patterns list for display
	 */
	formatPatternsList(): string {
		const patterns = this.getAllPatterns();

		let output = "## Safety Gate Patterns\n";
		output += `${"─".repeat(50)}\n`;
		output += `Total: ${patterns.length} patterns\n`;
		output += `Enabled: ${this.config.enabled ? "✅" : "❌"}\n`;
		output += `Block Level: ${this.config.blockLevel}\n`;
		output += `Warn Level: ${this.config.warnLevel}\n`;
		output += `${"─".repeat(50)}\n\n`;

		// Group by category
		const categories: PatternCategory[] = [
			"security",
			"breaking",
			"data-loss",
			"workflow",
			"dependencies",
			"configuration",
			"resource",
			"self-modification",
		];

		for (const category of categories) {
			const byCategory = patterns.filter((p) => p.category === category);
			if (byCategory.length > 0) {
				output += `### ${category.toUpperCase()} (${byCategory.length})\n`;
				for (const p of byCategory) {
					const riskEmoji =
						p.risk === "critical"
							? "🔴"
							: p.risk === "high"
								? "🟠"
								: p.risk === "medium"
									? "🟡"
									: "🟢";
					const bypassText = p.bypassable ? "bypassable" : "blocked";
					output += `${riskEmoji} ${p.id}: ${p.name} (${bypassText})\n`;
					output += `   ${p.description}\n`;
				}
				output += "\n";
			}
		}

		return output;
	}

	/**
	 * Format statistics for display
	 */
	formatStats(): string {
		let output = "## Safety Gate Statistics\n";
		output += `${"─".repeat(50)}\n`;
		output += `Total Scans: ${this.stats.totalScans}\n`;
		output += `Passed: ${this.stats.passedScans} (${this.percent(this.stats.passedScans, this.stats.totalScans)}%)\n`;
		output += `Blocked: ${this.stats.blockedScans} (${this.percent(this.stats.blockedScans, this.stats.totalScans)}%)\n`;
		output += `Warned: ${this.stats.warnedScans} (${this.percent(this.stats.warnedScans, this.stats.totalScans)}%)\n`;
		output += `Bypasses Used: ${this.stats.bypassesUsed}\n`;
		if (this.stats.lastScan) {
			output += `Last Scan: ${this.stats.lastScan}\n`;
		}
		output += `${"─".repeat(50)}\n\n`;

		if (this.stats.commonPatterns.length > 0) {
			output += "### Most Common Patterns\n";
			for (const p of this.stats.commonPatterns) {
				output += `- ${p.name} (${p.id}): ${p.count} occurrences\n`;
			}
			output += "\n";
		}

		if (this.stats.blockedFiles.length > 0) {
			output += "### Most Blocked Files\n";
			for (const f of this.stats.blockedFiles) {
				output += `- ${f.file}: ${f.count} blocks\n`;
			}
		}

		return output;
	}

	/**
	 * Calculate percentage
	 */
	private percent(value: number, total: number): number {
		if (total === 0) return 0;
		return Math.round((value / total) * 100);
	}
}

/**
 * Global safety gate manager instance
 */
let safetyGateInstance: SafetyGateManager | null = null;

/**
 * Get the global safety gate manager instance
 */
export function getSafetyGateManager(): SafetyGateManager {
	if (!safetyGateInstance) {
		safetyGateInstance = new SafetyGateManager();
	}
	return safetyGateInstance;
}
