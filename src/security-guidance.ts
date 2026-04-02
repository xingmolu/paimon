/**
 * Security Guidance Module
 *
 * PreToolUse hook for proactive security pattern detection
 * Inspired by Claude Code security-guidance plugin
 *
 * Monitors 9 security patterns:
 * - Command injection
 * - XSS (Cross-Site Scripting)
 * - eval() usage
 * - Dangerous HTML
 * - pickle deserialization
 * - os.system calls
 * - SQL injection
 * - Path traversal
 * - Sensitive data exposure
 */

import * as fs from "node:fs";
import * as path from "node:path";

// Security pattern categories
export type SecurityCategory =
	| "command-injection"
	| "xss"
	| "eval-usage"
	| "dangerous-html"
	| "pickle-deserialization"
	| "os-system"
	| "sql-injection"
	| "path-traversal"
	| "sensitive-data";

// Risk levels
export type RiskLevel = "critical" | "high" | "medium" | "low";

// Security pattern definition
export interface SecurityPattern {
	id: string;
	category: SecurityCategory;
	name: string;
	description: string;
	pattern: RegExp;
	riskLevel: RiskLevel;
	suggestion: string;
	languages: string[]; // File extensions where this pattern applies
	enabled: boolean;
}

// Security warning
export interface SecurityWarning {
	patternId: string;
	category: SecurityCategory;
	name: string;
	description: string;
	riskLevel: RiskLevel;
	suggestion: string;
	match: string;
	line?: number;
	file?: string;
}

// Scan result
export interface SecurityScanResult {
	warnings: SecurityWarning[];
	hasCritical: boolean;
	hasHigh: boolean;
	summary: string;
	blocked: boolean;
}

// Statistics
export interface SecurityGuidanceStats {
	totalScans: number;
	scansWithWarnings: number;
	scansBlocked: number;
	warningsByCategory: Record<SecurityCategory, number>;
	warningsByRiskLevel: Record<RiskLevel, number>;
	topPatterns: Array<{ patternId: string; count: number }>;
	lastScanTime?: string;
}

// Configuration
export interface SecurityGuidanceConfig {
	enabled: boolean;
	blockCritical: boolean;
	blockHigh: boolean;
	warnMedium: boolean;
	warnLow: boolean;
	maxWarningsToShow: number;
	dataPath: string;
}

// Default security patterns (inspired by Claude Code security-guidance plugin)
const DEFAULT_SECURITY_PATTERNS: SecurityPattern[] = [
	// Command Injection
	{
		id: "cmd-injection-shell",
		category: "command-injection",
		name: "Shell Command Injection",
		description: "User input passed directly to shell command execution",
		pattern:
			/(?:exec|spawn|execSync|spawnSync)\s*\(\s*[`'"]\s*\$\{.*\}|(?:exec|spawn|execSync|spawnSync)\s*\(\s*.*\+.*\)/gi,
		riskLevel: "critical",
		suggestion: "Use parameterized commands or sanitize user input before execution",
		languages: [".ts", ".js", ".tsx", ".jsx", ".py"],
		enabled: true,
	},
	{
		id: "cmd-injection-eval",
		category: "eval-usage",
		name: "eval() Usage",
		description: "eval() can execute arbitrary code and is dangerous",
		pattern: /eval\s*\(/gi,
		riskLevel: "critical",
		suggestion: "Avoid eval(). Use JSON.parse() for data or Function() for controlled execution",
		languages: [".ts", ".js", ".tsx", ".jsx"],
		enabled: true,
	},
	{
		id: "cmd-injection-function",
		category: "eval-usage",
		name: "new Function() with User Input",
		description: "Function constructor with dynamic code can be dangerous",
		pattern: /new\s+Function\s*\(\s*[`'"]\s*\$\{.*\}|new\s+Function\s*\(\s*.*\+.*\)/gi,
		riskLevel: "high",
		suggestion: "Avoid dynamic function creation. Use predefined functions instead",
		languages: [".ts", ".js", ".tsx", ".jsx"],
		enabled: true,
	},

	// XSS (Cross-Site Scripting)
	{
		id: "xss-innerhtml",
		category: "xss",
		name: "innerHTML Assignment",
		description: "Direct innerHTML assignment can lead to XSS",
		pattern: /\.innerHTML\s*=\s*[`'"]\s*\$\{.*\}|\.innerHTML\s*=\s*.*\+.*\)/gi,
		riskLevel: "high",
		suggestion: "Use textContent instead of innerHTML, or sanitize HTML before assignment",
		languages: [".ts", ".js", ".tsx", ".jsx", ".html"],
		enabled: true,
	},
	{
		id: "xss-document-write",
		category: "xss",
		name: "document.write()",
		description: "document.write() can lead to XSS vulnerabilities",
		pattern: /document\.write\s*\(/gi,
		riskLevel: "high",
		suggestion: "Avoid document.write(). Use DOM manipulation methods instead",
		languages: [".ts", ".js", ".tsx", ".jsx", ".html"],
		enabled: true,
	},
	{
		id: "xss-unsafe-react",
		category: "xss",
		name: "React dangerouslySetInnerHTML",
		description: "dangerouslySetInnerHTML can lead to XSS",
		pattern: /dangerouslySetInnerHTML\s*:\s*\{/gi,
		riskLevel: "high",
		suggestion: "Avoid dangerouslySetInnerHTML. Sanitize content or use safe rendering",
		languages: [".tsx", ".jsx"],
		enabled: true,
	},

	// Dangerous HTML
	{
		id: "html-unsafe-script",
		category: "dangerous-html",
		name: "Inline Script with User Data",
		description: "Script tag with dynamic content in HTML",
		pattern: /<script[^>]*>[^<]*\$\{.*\}|<script[^>]*>[^<]*\{\{.*\}/gi,
		riskLevel: "high",
		suggestion: "Move scripts to separate files or use safe templating",
		languages: [".html", ".tsx", ".jsx"],
		enabled: true,
	},
	{
		id: "html-event-handler",
		category: "dangerous-html",
		name: "Dynamic Event Handler",
		description: "Event handler with dynamic content",
		pattern: /on\w+\s*=\s*[`'"]\s*\$\{.*\}|on\w+\s*=\s*[`'"]\s*\{\{.*\}/gi,
		riskLevel: "medium",
		suggestion: "Use addEventListener instead of inline event handlers",
		languages: [".html", ".tsx", ".jsx"],
		enabled: true,
	},

	// Pickle Deserialization (Python)
	{
		id: "pickle-load",
		category: "pickle-deserialization",
		name: "pickle.load()",
		description: "pickle.load() can execute arbitrary code during deserialization",
		pattern: /pickle\.load\s*\(|pickle\.loads\s*\(/gi,
		riskLevel: "critical",
		suggestion: "Use JSON or other safe serialization formats instead of pickle",
		languages: [".py"],
		enabled: true,
	},

	// os.system calls
	{
		id: "os-system-call",
		category: "os-system",
		name: "os.system() Call",
		description: "os.system() can execute shell commands with potential injection",
		pattern: /os\.system\s*\(|os\.popen\s*\(|subprocess\.call\s*\([^)]*shell\s*=\s*True/gi,
		riskLevel: "critical",
		suggestion: "Use subprocess.run() with shell=False and parameterized arguments",
		languages: [".py"],
		enabled: true,
	},
	{
		id: "os-exec",
		category: "os-system",
		name: "os.exec*() Call",
		description: "os.exec family can be dangerous with user input",
		pattern: /os\.exec[vl]?[pe]?\s*\(/gi,
		riskLevel: "high",
		suggestion: "Validate and sanitize all inputs before using os.exec",
		languages: [".py"],
		enabled: true,
	},

	// SQL Injection
	{
		id: "sql-injection-string",
		category: "sql-injection",
		name: "SQL String Concatenation",
		description: "SQL query with string concatenation can lead to injection",
		pattern:
			/(?:SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER).*\+.*|(?:SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER).*\$\{.*\}/gi,
		riskLevel: "critical",
		suggestion: "Use parameterized queries or prepared statements",
		languages: [".ts", ".js", ".py", ".sql"],
		enabled: true,
	},
	{
		id: "sql-injection-template",
		category: "sql-injection",
		name: "SQL Template Literal Injection",
		description: "SQL query with template literal interpolation",
		pattern: /[`'"](?:SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER).*\$\{.*\}[`'"]/gi,
		riskLevel: "critical",
		suggestion: "Use parameterized queries instead of template literals",
		languages: [".ts", ".js", ".tsx", ".jsx"],
		enabled: true,
	},

	// Path Traversal
	{
		id: "path-traversal-join",
		category: "path-traversal",
		name: "Path Join with User Input",
		description: "Path operations with user input can lead to traversal",
		pattern:
			/(?:path\.join|path\.resolve)\s*\([^)]*\+.*\)|(?:path\.join|path\.resolve)\s*\([^)]*\$\{.*\}/gi,
		riskLevel: "high",
		suggestion: "Validate and sanitize paths. Use path.basename() to restrict to filenames",
		languages: [".ts", ".js", ".tsx", ".jsx", ".py"],
		enabled: true,
	},
	{
		id: "path-traversal-open",
		category: "path-traversal",
		name: "File Open with User Input",
		description: "Opening files with user-supplied paths can lead to traversal",
		pattern:
			/(?:fs\.readFile|fs\.writeFile|open|fopen)\s*\([^)]*\+.*\)|(?:fs\.readFile|fs\.writeFile|open|fopen)\s*\([^)]*\$\{.*\}/gi,
		riskLevel: "high",
		suggestion: "Validate paths and restrict to safe directories",
		languages: [".ts", ".js", ".tsx", ".jsx", ".py"],
		enabled: true,
	},

	// Sensitive Data Exposure
	{
		id: "sensitive-hardcoded-secret",
		category: "sensitive-data",
		name: "Hardcoded Secret",
		description: "Hardcoded API keys, passwords, or secrets",
		pattern: /(?:password|secret|api_key|apikey|token|auth)\s*[=:]\s*[`'"][^`'"]{8,}[`'"]/gi,
		riskLevel: "critical",
		suggestion: "Use environment variables or secure secret management",
		languages: [".ts", ".js", ".tsx", ".jsx", ".py", ".env"],
		enabled: true,
	},
	{
		id: "sensitive-log-data",
		category: "sensitive-data",
		name: "Logging Sensitive Data",
		description: "Logging potentially sensitive information",
		pattern: /(?:console\.log|logger\.|print)\s*\([^)]*(?:password|secret|token|auth|key)[^)]*\)/gi,
		riskLevel: "high",
		suggestion: "Never log sensitive data. Mask or omit sensitive fields",
		languages: [".ts", ".js", ".tsx", ".jsx", ".py"],
		enabled: true,
	},
];

// Default configuration
const DEFAULT_CONFIG: SecurityGuidanceConfig = {
	enabled: true,
	blockCritical: true,
	blockHigh: false,
	warnMedium: true,
	warnLow: true,
	maxWarningsToShow: 10,
	dataPath: path.join(process.env.HOME || "~", ".paimon", "security-guidance.json"),
};

/**
 * Security Guidance Manager
 * Manages security pattern detection and warnings
 */
export class SecurityGuidanceManager {
	private patterns: SecurityPattern[];
	private config: SecurityGuidanceConfig;
	private stats: SecurityGuidanceStats;
	private dataPath: string;

	constructor(config?: Partial<SecurityGuidanceConfig>) {
		this.patterns = [...DEFAULT_SECURITY_PATTERNS];
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.dataPath = this.config.dataPath;
		this.stats = this.loadStats();
	}

	/**
	 * Scan content for security patterns
	 */
	scanContent(content: string, file?: string): SecurityScanResult {
		if (!this.config.enabled) {
			return {
				warnings: [],
				hasCritical: false,
				hasHigh: false,
				summary: "Security guidance disabled",
				blocked: false,
			};
		}

		const warnings: SecurityWarning[] = [];
		const fileExt = file ? path.extname(file) : "";

		// Check each pattern
		for (const pattern of this.patterns) {
			if (!pattern.enabled) continue;

			// Check if pattern applies to this file type
			if (fileExt && !pattern.languages.includes(fileExt) && !pattern.languages.includes("*")) {
				continue;
			}

			// Find all matches
			const matches = content.matchAll(pattern.pattern);
			for (const match of matches) {
				// Estimate line number
				const beforeMatch = content.substring(0, match.index || 0);
				const lineNum = beforeMatch.split("\n").length;

				warnings.push({
					patternId: pattern.id,
					category: pattern.category,
					name: pattern.name,
					description: pattern.description,
					riskLevel: pattern.riskLevel,
					suggestion: pattern.suggestion,
					match: match[0],
					line: lineNum,
					file,
				});
			}
		}

		// Update statistics
		this.updateStats(warnings);

		// Determine blocking
		const hasCritical = warnings.some((w) => w.riskLevel === "critical");
		const hasHigh = warnings.some((w) => w.riskLevel === "high");
		const blocked =
			(hasCritical && this.config.blockCritical) || (hasHigh && this.config.blockHigh);

		// Generate summary
		const summary = this.generateSummary(warnings);

		return {
			warnings: warnings.slice(0, this.config.maxWarningsToShow),
			hasCritical,
			hasHigh,
			summary,
			blocked,
		};
	}

	/**
	 * Scan file for security patterns
	 */
	scanFile(filePath: string): SecurityScanResult {
		try {
			const content = fs.readFileSync(filePath, "utf-8");
			return this.scanContent(content, filePath);
		} catch {
			return {
				warnings: [],
				hasCritical: false,
				hasHigh: false,
				summary: `Unable to read file: ${filePath}`,
				blocked: false,
			};
		}
	}

	/**
	 * Get all patterns
	 */
	getPatterns(): SecurityPattern[] {
		return [...this.patterns];
	}

	/**
	 * Get patterns by category
	 */
	getPatternsByCategory(category: SecurityCategory): SecurityPattern[] {
		return this.patterns.filter((p) => p.category === category);
	}

	/**
	 * Get patterns by risk level
	 */
	getPatternsByRiskLevel(riskLevel: RiskLevel): SecurityPattern[] {
		return this.patterns.filter((p) => p.riskLevel === riskLevel);
	}

	/**
	 * Get a specific pattern
	 */
	getPattern(patternId: string): SecurityPattern | undefined {
		return this.patterns.find((p) => p.id === patternId);
	}

	/**
	 * Add custom pattern
	 */
	addPattern(pattern: Omit<SecurityPattern, "id" | "enabled">): SecurityPattern {
		const id = `custom-${Date.now()}-${Math.random().toString(36).substring(7)}`;
		const newPattern: SecurityPattern = {
			...pattern,
			id,
			enabled: true,
		};
		this.patterns.push(newPattern);
		this.saveStats();
		return newPattern;
	}

	/**
	 * Remove pattern
	 */
	removePattern(patternId: string): boolean {
		const index = this.patterns.findIndex((p) => p.id === patternId);
		if (index >= 0 && patternId.startsWith("custom-")) {
			this.patterns.splice(index, 1);
			this.saveStats();
			return true;
		}
		return false; // Cannot remove default patterns
	}

	/**
	 * Enable/disable pattern
	 */
	setPatternEnabled(patternId: string, enabled: boolean): boolean {
		const pattern = this.patterns.find((p) => p.id === patternId);
		if (pattern) {
			pattern.enabled = enabled;
			this.saveStats();
			return true;
		}
		return false;
	}

	/**
	 * Get configuration
	 */
	getConfig(): SecurityGuidanceConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration
	 */
	updateConfig(updates: Partial<SecurityGuidanceConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveStats();
	}

	/**
	 * Get statistics
	 */
	getStats(): SecurityGuidanceStats {
		return { ...this.stats };
	}

	/**
	 * Reset statistics
	 */
	resetStats(): void {
		this.stats = {
			totalScans: 0,
			scansWithWarnings: 0,
			scansBlocked: 0,
			warningsByCategory: {
				"command-injection": 0,
				xss: 0,
				"eval-usage": 0,
				"dangerous-html": 0,
				"pickle-deserialization": 0,
				"os-system": 0,
				"sql-injection": 0,
				"path-traversal": 0,
				"sensitive-data": 0,
			},
			warningsByRiskLevel: {
				critical: 0,
				high: 0,
				medium: 0,
				low: 0,
			},
			topPatterns: [],
		};
		this.saveStats();
	}

	/**
	 * Generate summary message
	 */
	private generateSummary(warnings: SecurityWarning[]): string {
		if (warnings.length === 0) {
			return "No security issues detected";
		}

		const critical = warnings.filter((w) => w.riskLevel === "critical").length;
		const high = warnings.filter((w) => w.riskLevel === "high").length;
		const medium = warnings.filter((w) => w.riskLevel === "medium").length;
		const low = warnings.filter((w) => w.riskLevel === "low").length;

		const parts: string[] = [];
		if (critical > 0) parts.push(`${critical} critical`);
		if (high > 0) parts.push(`${high} high`);
		if (medium > 0) parts.push(`${medium} medium`);
		if (low > 0) parts.push(`${low} low`);

		return `Found ${warnings.length} security warnings: ${parts.join(", ")}`;
	}

	/**
	 * Update statistics
	 */
	private updateStats(warnings: SecurityWarning[]): void {
		this.stats.totalScans++;
		this.stats.lastScanTime = new Date().toISOString();

		if (warnings.length > 0) {
			this.stats.scansWithWarnings++;
		}

		if (
			warnings.some((w) => w.riskLevel === "critical" && this.config.blockCritical) ||
			warnings.some((w) => w.riskLevel === "high" && this.config.blockHigh)
		) {
			this.stats.scansBlocked++;
		}

		// Count by category
		for (const warning of warnings) {
			this.stats.warningsByCategory[warning.category]++;
			this.stats.warningsByRiskLevel[warning.riskLevel]++;
		}

		// Update top patterns
		const patternCounts: Record<string, number> = {};
		for (const warning of warnings) {
			patternCounts[warning.patternId] = (patternCounts[warning.patternId] || 0) + 1;
		}

		this.stats.topPatterns = Object.entries(patternCounts)
			.map(([patternId, count]) => ({ patternId, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 10);

		this.saveStats();
	}

	/**
	 * Load statistics from disk
	 */
	private loadStats(): SecurityGuidanceStats {
		try {
			if (fs.existsSync(this.dataPath)) {
				const data = JSON.parse(fs.readFileSync(this.dataPath, "utf-8"));
				return {
					totalScans: data.totalScans || 0,
					scansWithWarnings: data.scansWithWarnings || 0,
					scansBlocked: data.scansBlocked || 0,
					warningsByCategory: data.warningsByCategory || {
						"command-injection": 0,
						xss: 0,
						"eval-usage": 0,
						"dangerous-html": 0,
						"pickle-deserialization": 0,
						"os-system": 0,
						"sql-injection": 0,
						"path-traversal": 0,
						"sensitive-data": 0,
					},
					warningsByRiskLevel: data.warningsByRiskLevel || {
						critical: 0,
						high: 0,
						medium: 0,
						low: 0,
					},
					topPatterns: data.topPatterns || [],
					lastScanTime: data.lastScanTime,
				};
			}
		} catch {
			// Ignore errors
		}

		// Return default stats
		return {
			totalScans: 0,
			scansWithWarnings: 0,
			scansBlocked: 0,
			warningsByCategory: {
				"command-injection": 0,
				xss: 0,
				"eval-usage": 0,
				"dangerous-html": 0,
				"pickle-deserialization": 0,
				"os-system": 0,
				"sql-injection": 0,
				"path-traversal": 0,
				"sensitive-data": 0,
			},
			warningsByRiskLevel: {
				critical: 0,
				high: 0,
				medium: 0,
				low: 0,
			},
			topPatterns: [],
		};
	}

	/**
	 * Save statistics to disk
	 */
	private saveStats(): void {
		try {
			const dir = path.dirname(this.dataPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(
				this.dataPath,
				JSON.stringify(
					{
						...this.stats,
						config: this.config,
						patterns: this.patterns.filter((p) => p.id.startsWith("custom-")),
					},
					null,
					2,
				),
			);
		} catch {
			// Ignore errors
		}
	}
}

// Singleton instance
let securityGuidanceManager: SecurityGuidanceManager | undefined;

/**
 * Get the global SecurityGuidanceManager instance
 */
export function getSecurityGuidanceManager(): SecurityGuidanceManager {
	if (!securityGuidanceManager) {
		securityGuidanceManager = new SecurityGuidanceManager();
	}
	return securityGuidanceManager;
}

/**
 * Reset the global instance
 */
export function resetSecurityGuidanceManager(): void {
	securityGuidanceManager = undefined;
}

// Re-export default patterns for testing
export { DEFAULT_SECURITY_PATTERNS };
