import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { type Hook, type HookType, globalHookManager } from "./hooks.js";

/**
 * Hookify Pattern - Dynamic Hook Creation from Conversation Patterns
 *
 * Inspired by Claude Code's hookify plugin:
 * - Create custom hooks from conversation patterns or explicit instructions
 * - Simple markdown configuration files with YAML frontmatter
 * - Regex pattern matching for powerful rules
 * - No coding required - just describe the behavior
 * - Easy enable/disable without restarting
 */

/**
 * Hookify rule configuration (YAML frontmatter)
 */
export interface HookifyRuleConfig {
	/** Rule name */
	name: string;
	/** Whether the rule is enabled */
	enabled: boolean;
	/** Hook type: PreToolUse event type (bash, write, edit, etc.) or SessionStart/Stop */
	event: HookType | "bash" | "write" | "edit" | "glob" | "grep" | "read" | "http";
	/** Regex pattern to match */
	pattern: string;
	/** Action: warn (show warning but allow) or block (prevent operation) */
	action: "warn" | "block";
}

/**
 * Hookify rule file (markdown with YAML frontmatter)
 */
export interface HookifyRule {
	/** Rule configuration */
	config: HookifyRuleConfig;
	/** Warning/block message content (markdown body) */
	message: string;
	/** File path */
	path: string;
}

/**
 * Hookify statistics
 */
export interface HookifyStats {
	/** Total rules count */
	totalRules: number;
	/** Enabled rules count */
	enabledRules: number;
	/** Blocked operations count */
	blockedCount: number;
	/** Warning shown count */
	warningCount: number;
	/** Rules by event type */
	rulesByEvent: Record<string, number>;
}

/**
 * Conversation message for analysis
 */
export interface ConversationMessage {
	/** Message role */
	role: "user" | "assistant";
	/** Message content */
	content: string;
	/** Action name if applicable */
	action?: string;
	/** Error if applicable */
	error?: string;
}

/**
 * Analysis result from conversation
 */
export interface ConversationAnalysis {
	/** Detected problematic behaviors */
	behaviors: {
		/** Behavior description */
		description: string;
		/** Suggested pattern */
		pattern: string;
		/** Suggested action */
		action: "warn" | "block";
		/** Confidence level */
		confidence: number;
	}[];
	/** Corrections mentioned */
	corrections: string[];
	/** Frustrations mentioned */
	frustrations: string[];
}

/**
 * Hookify Manager - manages dynamic hook creation from patterns
 */
export class HookifyManager {
	private rulesDir: string;
	private rules: Map<string, HookifyRule> = new Map();
	private stats: HookifyStats;

	constructor(rulesDir?: string) {
		// Default to ~/.paimon/hookify-rules/
		this.rulesDir = rulesDir || join(homedir(), ".paimon", "hookify-rules");
		this.stats = {
			totalRules: 0,
			enabledRules: 0,
			blockedCount: 0,
			warningCount: 0,
			rulesByEvent: {},
		};
		this.loadRules();
	}

	/**
	 * Get the rules directory path
	 */
	getRulesDir(): string {
		return this.rulesDir;
	}

	/**
	 * Load all hookify rules from directory
	 */
	private loadRules(): void {
		if (!existsSync(this.rulesDir)) {
			mkdirSync(this.rulesDir, { recursive: true });
			return;
		}

		const files = readdirSync(this.rulesDir);
		for (const file of files) {
			if (file.endsWith(".md")) {
				const filePath = join(this.rulesDir, file);
				try {
					const rule = this.parseRuleFile(filePath);
					if (rule) {
						this.rules.set(rule.config.name, rule);
						this.updateStats(rule);
					}
				} catch (error) {
					console.error(`Failed to parse rule file ${file}:`, error);
				}
			}
		}
	}

	/**
	 * Parse a hookify rule file (markdown with YAML frontmatter)
	 */
	private parseRuleFile(filePath: string): HookifyRule | null {
		const content = readFileSync(filePath, "utf-8");

		// Parse YAML frontmatter
		const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
		if (!frontmatterMatch) {
			return null;
		}

		const yamlContent = frontmatterMatch[1];
		const message = frontmatterMatch[2].trim();

		// Parse YAML (simple parsing - handle basic fields)
		const config: HookifyRuleConfig = {
			name: "",
			enabled: true,
			event: "PreToolUse",
			pattern: "",
			action: "warn",
		};

		const lines = yamlContent.split("\n");
		for (const line of lines) {
			const match = line.match(/^(\w+):\s*(.+)$/);
			if (match) {
				const key = match[1];
				const value = match[2].trim();

				switch (key) {
					case "name":
						config.name = value;
						break;
					case "enabled":
						config.enabled = value === "true";
						break;
					case "event":
						config.event = value as HookifyRuleConfig["event"];
						break;
					case "pattern":
						config.pattern = value;
						break;
					case "action":
						config.action = value === "block" ? "block" : "warn";
						break;
				}
			}
		}

		if (!config.name || !config.pattern) {
			return null;
		}

		return { config, message, path: filePath };
	}

	/**
	 * Update statistics with new rule
	 */
	private updateStats(rule: HookifyRule): void {
		this.stats.totalRules++;
		if (rule.config.enabled) {
			this.stats.enabledRules++;
		}
		const event = rule.config.event;
		this.stats.rulesByEvent[event] = (this.stats.rulesByEvent[event] || 0) + 1;
	}

	/**
	 * Save a rule to file
	 */
	private saveRule(rule: HookifyRule): void {
		const yaml = `---
name: ${rule.config.name}
enabled: ${rule.config.enabled}
event: ${rule.config.event}
pattern: ${rule.config.pattern}
action: ${rule.config.action}
---
${rule.message}`;

		writeFileSync(rule.path, yaml, "utf-8");
	}

	/**
	 * Create a new hookify rule from description
	 */
	createRule(description: string): HookifyRule {
		// Analyze the description to extract pattern and action
		const analysis = this.analyzeDescription(description);

		// Generate rule name from description
		const name = this.generateRuleName(description);

		// Determine event type from description
		const event = this.determineEventType(description);

		// Create rule
		const rule: HookifyRule = {
			config: {
				name,
				enabled: true,
				event,
				pattern: analysis.pattern,
				action: analysis.action,
			},
			message: analysis.message,
			path: join(this.rulesDir, `hookify.${name}.md`),
		};

		// Save rule
		this.rules.set(name, rule);
		this.saveRule(rule);
		this.updateStats(rule);

		// Register with HookManager
		this.registerWithHookManager(rule);

		return rule;
	}

	/**
	 * Analyze a description to extract pattern, action, and message
	 */
	private analyzeDescription(description: string): {
		pattern: string;
		action: "warn" | "block";
		message: string;
	} {
		// Determine action based on keywords
		const action: "warn" | "block" =
			description.toLowerCase().includes("block") ||
			description.toLowerCase().includes("prevent") ||
			description.toLowerCase().includes("don't") ||
			description.toLowerCase().includes("never")
				? "block"
				: "warn";

		// Extract pattern from description
		const pattern = this.extractPattern(description);

		// Generate warning/block message
		const message = this.generateMessage(description, action);

		return { pattern, action, message };
	}

	/**
	 * Extract regex pattern from description
	 */
	private extractPattern(description: string): string {
		// Common pattern mappings
		const patternMappings: Record<string, string> = {
			// Bash patterns
			"rm -rf": "\\brm\\s+-rf\\b",
			"rm rf": "\\brm\\s+-rf\\b",
			rm: "\\brm\\b",
			sudo: "\\bsudo\\b",
			"curl | bash": "\\bcurl\\s+.*\\|\\s*bash\\b",
			"wget | bash": "\\bwget\\s+.*\\|\\s*bash\\b",
			chmod: "\\bchmod\\b",
			mkfs: "\\bmkfs\\b",
			dd: "\\bdd\\b",
			eval: "\\beval\\s*\\(",
			exec: "\\bexec\\s*\\(",

			// Code patterns
			"console.log": "console\\.log",
			"console.error": "console\\.error",
			debugger: "\\bdebugger\\b",
			alert: "\\balert\\s*\\(",
			TODO: "\\bTODO\\b",
			FIXME: "\\bFIXME\\b",

			// File patterns
			".env": "\\.env",
			credentials: "credentials",
			secrets: "secrets",
			password: "password",

			// Git patterns
			"git push --force": "\\bgit\\s+push\\s+--force\\b",
			"git reset --hard": "\\bgit\\s+reset\\s+--hard\\b",
			"force push": "\\bgit\\s+push\\s+--force\\b",
		};

		// Try to match known patterns
		for (const [keyword, pattern] of Object.entries(patternMappings)) {
			if (description.toLowerCase().includes(keyword.toLowerCase())) {
				return pattern;
			}
		}

		// If no known pattern, try to extract from description
		// Look for quoted strings or command-like patterns
		const quotedMatch = description.match(/`([^`]+)`|'([^']+)'|"([^"]+)"/);
		if (quotedMatch) {
			const extracted = quotedMatch[1] || quotedMatch[2] || quotedMatch[3];
			return extracted.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		}

		// Default: create pattern from key words
		const words = description
			.toLowerCase()
			.replace(/[^\w\s]/g, "")
			.split(/\s+/)
			.filter((w) => w.length > 3 && !["warn", "when", "use", "block", "prevent"].includes(w));

		if (words.length > 0) {
			return `\\b${words[0]}\\b`;
		}

		return ".*";
	}

	/**
	 * Generate warning/block message
	 */
	private generateMessage(description: string, action: "warn" | "block"): string {
		const emoji = action === "block" ? "🚫" : "⚠️";
		const actionText = action === "block" ? "Blocked" : "Warning";

		return `${emoji} **${actionText}: Detected behavior matching your rule**

**Rule:** ${description}

Please:
- Review the operation carefully
- Consider if this matches your intent
- Modify the rule if needed using \`/hookify:configure\`
`;
	}

	/**
	 * Generate rule name from description
	 */
	private generateRuleName(description: string): string {
		// Create a short, unique name from description
		const words = description
			.toLowerCase()
			.replace(/[^\w\s]/g, "")
			.split(/\s+/)
			.filter((w) => w.length > 2)
			.slice(0, 3);

		const baseName = words.join("-") || "rule";
		const timestamp = Date.now().toString(36);

		return `${baseName}-${timestamp}`;
	}

	/**
	 * Determine event type from description
	 */
	private determineEventType(description: string): HookifyRuleConfig["event"] {
		const desc = description.toLowerCase();

		// Bash-related keywords
		if (
			desc.includes("command") ||
			desc.includes("bash") ||
			desc.includes("shell") ||
			desc.includes("rm") ||
			desc.includes("sudo") ||
			desc.includes("curl") ||
			desc.includes("wget") ||
			desc.includes("git")
		) {
			return "bash";
		}

		// File-related keywords
		if (
			desc.includes("write") ||
			desc.includes("create") ||
			desc.includes("file") ||
			desc.includes("path") ||
			desc.includes(".env") ||
			desc.includes("credentials")
		) {
			return "write";
		}

		// Edit-related keywords
		if (desc.includes("edit") || desc.includes("modify") || desc.includes("change")) {
			return "edit";
		}

		// Code-related keywords
		if (desc.includes("console.log") || desc.includes("debugger") || desc.includes("code")) {
			return "edit";
		}

		// Default to PreToolUse (general)
		return "PreToolUse";
	}

	/**
	 * Register hookify rule with HookManager
	 */
	private registerWithHookManager(rule: HookifyRule): void {
		// Convert event type to HookType
		let hookType: HookType = "PreToolUse";
		if (rule.config.event === "SessionStart" || rule.config.event === "Stop") {
			hookType = rule.config.event as HookType;
		}

		// Create Hook from rule
		const hook: Hook = {
			id: `hookify-${rule.config.name}`,
			type: hookType,
			name: `Hookify: ${rule.config.name}`,
			description: `Dynamic hook created from: ${rule.config.pattern}`,
			enabled: rule.config.enabled,
			priority: 50, // Lower priority than built-in hooks
			handler: (context) => {
				// Check if tool matches event
				const tool = context.tool || "";
				const eventToolMap: Record<string, string[]> = {
					bash: ["bash"],
					write: ["write"],
					edit: ["edit"],
					glob: ["glob"],
					grep: ["grep"],
					read: ["read"],
					http: ["http"],
					PreToolUse: [], // All tools
				};

				const matchingTools = eventToolMap[rule.config.event] || [];
				if (matchingTools.length > 0 && !matchingTools.includes(tool)) {
					return { allow: true };
				}

				// Get content to match
				const content =
					tool === "bash"
						? String(context.params?.command || "")
						: tool === "write" || tool === "edit"
							? String(context.params?.content || "") || String(context.params?.path || "")
							: tool === "glob" || tool === "grep" || tool === "find" || tool === "read"
								? String(context.params?.pattern || "") || String(context.params?.path || "")
								: "";

				// Check pattern
				try {
					const regex = new RegExp(rule.config.pattern, "gi");
					if (regex.test(content)) {
						if (rule.config.action === "block") {
							this.stats.blockedCount++;
							return {
								allow: false,
								block: rule.message,
								context: `Pattern: ${rule.config.pattern}`,
							};
						}
						this.stats.warningCount++;
						return {
							allow: true,
							warning: rule.message,
							context: `Pattern: ${rule.config.pattern}`,
						};
					}
				} catch {
					// Invalid regex pattern
				}

				return { allow: true };
			},
		};

		// Register with global hook manager
		globalHookManager.registerHook(hook);
	}

	/**
	 * Analyze conversation to find problematic behaviors
	 */
	analyzeConversation(messages: ConversationMessage[]): ConversationAnalysis {
		const analysis: ConversationAnalysis = {
			behaviors: [],
			corrections: [],
			frustrations: [],
		};

		for (const message of messages) {
			const content = message.content.toLowerCase();

			// Look for corrections
			if (
				(message.role === "assistant" && content.includes("sorry")) ||
				content.includes("fix") ||
				content.includes("correct")
			) {
				analysis.corrections.push(message.content);
			}

			// Look for frustrations
			if (
				content.includes("again") ||
				content.includes("stop") ||
				content.includes("don't") ||
				content.includes("never")
			) {
				analysis.frustrations.push(message.content);
			}

			// Look for errors
			if (message.error) {
				analysis.behaviors.push({
					description: `Error pattern: ${message.error}`,
					pattern: message.action || "unknown",
					action: "warn",
					confidence: 70,
				});
			}
		}

		// Generate suggested behaviors from frustrations
		for (const frustration of analysis.frustrations) {
			const behavior = this.extractBehaviorFromFrustration(frustration);
			if (behavior) {
				analysis.behaviors.push(behavior);
			}
		}

		return analysis;
	}

	/**
	 * Extract behavior suggestion from frustration message
	 */
	private extractBehaviorFromFrustration(
		content: string,
	): ConversationAnalysis["behaviors"][0] | null {
		const lower = content.toLowerCase();

		// Look for "don't X" or "never X" patterns
		const dontMatch = lower.match(/don't\s+(\w+)/);
		const neverMatch = lower.match(/never\s+(\w+)/);
		const stopMatch = lower.match(/stop\s+(\w+)/);

		const actionWord = dontMatch?.[1] || neverMatch?.[1] || stopMatch?.[1];
		if (actionWord) {
			return {
				description: `Block ${actionWord} operations`,
				pattern: `\\b${actionWord}\\b`,
				action: "block",
				confidence: 80,
			};
		}

		return null;
	}

	/**
	 * Get all rules
	 */
	getRules(): HookifyRule[] {
		return Array.from(this.rules.values());
	}

	/**
	 * Get a specific rule by name
	 */
	getRule(name: string): HookifyRule | undefined {
		return this.rules.get(name);
	}

	/**
	 * Enable/disable a rule
	 */
	setRuleEnabled(name: string, enabled: boolean): boolean {
		const rule = this.rules.get(name);
		if (rule) {
			rule.config.enabled = enabled;
			this.saveRule(rule);

			// Update hook manager
			globalHookManager.setHookEnabled(`hookify-${name}`, enabled);

			return true;
		}
		return false;
	}

	/**
	 * Delete a rule
	 */
	deleteRule(name: string): boolean {
		const rule = this.rules.get(name);
		if (rule) {
			// Remove from hook manager
			globalHookManager.removeHook(`hookify-${name}`);

			// Remove from map
			this.rules.delete(name);

			// Delete file
			if (existsSync(rule.path)) {
				writeFileSync(rule.path, "", "utf-8"); // Clear file (can't delete in sandbox)
			}

			this.stats.totalRules--;
			if (rule.config.enabled) {
				this.stats.enabledRules--;
			}

			return true;
		}
		return false;
	}

	/**
	 * Get statistics
	 */
	getStats(): HookifyStats {
		return { ...this.stats };
	}

	/**
	 * Format rules list for display
	 */
	formatRulesList(): string {
		const rules = this.getRules();
		if (rules.length === 0) {
			return "No hookify rules configured. Use `/hookify <description>` to create one.";
		}

		let output = "📋 Hookify Rules\n";
		output += `${"─".repeat(50)}\n`;
		output += `Total: ${rules.length} rules (${this.stats.enabledRules} enabled)\n`;
		output += `${"─".repeat(50)}\n\n`;

		for (const rule of rules) {
			const statusEmoji = rule.config.enabled ? "✅" : "❌";
			const actionEmoji = rule.config.action === "block" ? "🚫" : "⚠️";
			output += `${statusEmoji} ${actionEmoji} ${rule.config.name}\n`;
			output += `   Event: ${rule.config.event}\n`;
			output += `   Pattern: ${rule.config.pattern}\n`;
			output += `   File: ${rule.path}\n\n`;
		}

		return output;
	}

	/**
	 * Clear all rules
	 */
	clearRules(): number {
		const count = this.rules.size;
		for (const [name] of this.rules) {
			this.deleteRule(name);
		}
		this.rules.clear();
		return count;
	}
}

/**
 * Global hookify manager instance
 */
let globalHookifyManager: HookifyManager | null = null;

/**
 * Get or create the global hookify manager
 */
export function getHookifyManager(): HookifyManager {
	if (!globalHookifyManager) {
		globalHookifyManager = new HookifyManager();
	}
	return globalHookifyManager;
}
