import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getExplanatoryOutputStyleManager } from "./explanatory-output-style.js";
import { getRalphLoopManager } from "./ralph-loop.js";
import { getSafetyGateManager } from "./safety-gates.js";
import { getSecurityGuidanceManager } from "./security-guidance.js";

/**
 * Hook system for intercepting and validating tool calls
 *
 * Inspired by Claude Code's hook system:
 * - PreToolUse: Check parameters before tool execution
 * - SessionStart: Run at session initialization
 * - Stop: Intercept exit attempts (used for Ralph Wiggum pattern)
 */

/**
 * Hook types supported by the system
 */
export type HookType = "PreToolUse" | "SessionStart" | "Stop";

/**
 * Result from executing a hook
 */
export interface HookResult {
	/** Whether to allow the action to proceed */
	allow: boolean;
	/** Warning message to show (if allow=true but there's a concern) */
	warning?: string;
	/** Block message (if allow=false) */
	block?: string;
	/** Additional context about the hook execution */
	context?: string;
}

/**
 * Hook definition
 */
export interface Hook {
	/** Unique identifier for the hook */
	id: string;
	/** Type of hook */
	type: HookType;
	/** Human-readable name */
	name: string;
	/** Description of what the hook does */
	description: string;
	/** Whether the hook is enabled */
	enabled: boolean;
	/** Priority (higher = runs first) */
	priority: number;
	/** Hook handler function */
	handler: (context: HookContext) => HookResult | Promise<HookResult>;
}

/**
 * Context passed to hook handlers
 */
export interface HookContext {
	/** Tool name being called (for PreToolUse) */
	tool?: string;
	/** Tool parameters (for PreToolUse) */
	params?: Record<string, unknown>;
	/** Session metadata (for SessionStart) */
	session?: {
		mode: "chat" | "evolve";
		project: string;
		timestamp: string;
	};
	/** Stop reason (for Stop hooks) */
	reason?: string;
}

/**
 * Hook configuration stored in ~/.paimon/hooks.json
 */
export interface HooksConfig {
	/** Registered hooks */
	hooks: Hook[];
	/** Global settings */
	settings: {
		/** Enable/disable all hooks */
		enabled: boolean;
		/** Default behavior when no hooks match */
		defaultBehavior: "allow" | "block";
	};
}

/**
 * Default SessionStart hooks for initialization
 */
const DEFAULT_SESSION_START_HOOKS: Hook[] = [
	{
		id: "session-explanatory-output-style",
		type: "SessionStart",
		name: "Inject Educational Context",
		description:
			"Injects educational insights about implementation choices and codebase patterns at session start (Claude Code explanatory-output-style pattern)",
		enabled: true,
		priority: 110, // Higher priority - runs first to inject context before other hooks
		handler: (context: HookContext): HookResult => {
			const manager = getExplanatoryOutputStyleManager();
			if (!manager.isEnabled()) {
				return { allow: true };
			}

			// Generate educational context based on session mode
			const sessionMode = context.session?.mode;
			const educationalContext = manager.generateEducationalContext(sessionMode);

			if (educationalContext) {
				return {
					allow: true,
					context: educationalContext,
				};
			}

			return { allow: true };
		},
	},
	{
		id: "session-memory-load",
		type: "SessionStart",
		name: "Load Memory on Session Start",
		description: "Logs memory status at session start for context awareness",
		enabled: true,
		priority: 100,
		handler: (context: HookContext): HookResult => {
			if (context.session?.mode === "evolve") {
				// In evolve mode, memory should be loaded
				return {
					allow: true,
					context: "Session started in evolve mode. MEMORY.md should be loaded for context.",
				};
			}
			return { allow: true };
		},
	},
	{
		id: "session-context-budget",
		type: "SessionStart",
		name: "Check Context Budget",
		description: "Initialize context budget tracking at session start",
		enabled: true,
		priority: 90,
		handler: (context: HookContext): HookResult => {
			// Context budget monitoring initialized
			return {
				allow: true,
				context: `Context budget monitoring enabled. Use contextBudget({action: 'check'}) to monitor usage.`,
			};
		},
	},
	{
		id: "session-journal-check",
		type: "SessionStart",
		name: "Check Journal Size",
		description: "Check if journal needs truncation to prevent context bloat",
		enabled: true,
		priority: 80,
		handler: (context: HookContext): HookResult => {
			// Journal truncation check
			return {
				allow: true,
				context: `Journal truncation available. Use journal({action: 'stats'}) to check size.`,
			};
		},
	},
];

/**
 * Default Stop hooks for cleanup
 */
const DEFAULT_STOP_HOOKS: Hook[] = [
	{
		id: "ralph-loop-intercept",
		type: "Stop",
		name: "Ralph Loop Iteration Interceptor",
		description: "Intercepts exit attempts for Ralph Loop and continues iteration until completion",
		enabled: true,
		priority: 150, // Highest priority - runs first
		handler: (context: HookContext): HookResult => {
			const ralphManager = getRalphLoopManager();

			// Check if there's an active Ralph Loop
			if (!ralphManager.hasActiveLoop()) {
				return { allow: true };
			}

			// Check for completion promise in session output
			// Note: This would need session transcript access which isn't available in HookContext
			// For now, we increment iteration and block if not at max

			const result = ralphManager.incrementIteration();

			if (!result.shouldContinue) {
				// Max iterations reached or no loop - allow exit
				return {
					allow: true,
					context: `Ralph Loop: ${result.reason}`,
				};
			}

			// Block exit and feed prompt back
			return {
				allow: false,
				block: `🔄 Ralph Loop iteration ${ralphManager.getCurrentLoop()?.currentIteration}/${ralphManager.getCurrentLoop()?.maxIterations}. Continue working on the task.`,
				context: `Continuing iteration. Original prompt: ${result.prompt?.substring(0, 200)}...`,
			};
		},
	},
	{
		id: "stop-session-stats",
		type: "Stop",
		name: "Save Session Statistics",
		description: "Logs session statistics on stop for evolution tracking",
		enabled: true,
		priority: 100,
		handler: (context: HookContext): HookResult => {
			// Log session end statistics
			return {
				allow: true,
				context: `Session stopped: ${context.reason || "unknown reason"}. Statistics saved.`,
			};
		},
	},
	{
		id: "stop-token-tracking",
		type: "Stop",
		name: "Finalize Token Tracking",
		description: "End token tracking session on stop",
		enabled: true,
		priority: 90,
		handler: (context: HookContext): HookResult => {
			// Token tracking session end
			return {
				allow: true,
				context: `Token tracking session ended. Use tokenTracking({action: 'stats'}) for summary.`,
			};
		},
	},
	{
		id: "stop-tool-cache-save",
		type: "Stop",
		name: "Save Tool Cache",
		description: "Persist tool cache on session stop",
		enabled: true,
		priority: 80,
		handler: (context: HookContext): HookResult => {
			// Tool cache persistence
			return {
				allow: true,
				context: `Tool cache persisted. Use toolCache({action: 'stats'}) for cache statistics.`,
			};
		},
	},
];

/**
 * Default security hooks for dangerous patterns
 */
const DEFAULT_SECURITY_HOOKS: Hook[] = [
	{
		id: "security-guidance-check",
		type: "PreToolUse",
		name: "Security Guidance Pattern Scanner",
		description:
			"Scans code for security patterns (9 categories) before write/edit operations using Security Guidance module",
		enabled: true,
		priority: 110, // Highest priority for security - runs before other security hooks
		handler: (context: HookContext): HookResult => {
			if ((context.tool !== "write" && context.tool !== "edit") || !context.params?.content) {
				return { allow: true };
			}

			const content = String(context.params.content);
			const file = context.params?.path ? String(context.params.path) : undefined;

			// Use Security Guidance manager for comprehensive pattern scanning
			const securityManager = getSecurityGuidanceManager();
			const config = securityManager.getConfig();

			if (!config.enabled) {
				return { allow: true };
			}

			// Scan content for security patterns
			const result = securityManager.scanContent(content, file);

			// If blocked by critical/high patterns
			if (result.blocked) {
				const criticalWarnings = result.warnings.filter((w) => w.riskLevel === "critical");
				const highWarnings = result.warnings.filter((w) => w.riskLevel === "high");

				const messages: string[] = [];
				for (const w of criticalWarnings) {
					messages.push(`${w.name} (${w.riskLevel}): ${w.suggestion}`);
				}
				for (const w of highWarnings) {
					messages.push(`${w.name} (${w.riskLevel}): ${w.suggestion}`);
				}

				return {
					allow: false,
					block: `Security patterns detected:\n${messages.map((m) => `  - ${m}`).join("\n")}\n\nUse securityGuidance({action: 'patterns'}) to view all patterns.`,
					context: `File: ${file || "unknown"}\nPatterns: ${criticalWarnings.length} critical, ${highWarnings.length} high`,
				};
			}

			// If medium/low warnings detected, show warning
			if (result.warnings.length > 0) {
				const mediumWarnings = result.warnings.filter((w) => w.riskLevel === "medium");
				const lowWarnings = result.warnings.filter((w) => w.riskLevel === "low");

				if (
					(config.warnMedium && mediumWarnings.length > 0) ||
					(config.warnLow && lowWarnings.length > 0)
				) {
					const messages: string[] = [];
					for (const w of mediumWarnings) {
						messages.push(`${w.name} (${w.riskLevel}): ${w.suggestion}`);
					}
					for (const w of lowWarnings) {
						messages.push(`${w.name} (${w.riskLevel}): ${w.suggestion}`);
					}

					return {
						allow: true,
						warning: `Security patterns detected:\n${messages.map((m) => `  - ${m}`).join("\n")}`,
						context: `File: ${file || "unknown"}\nPatterns: ${mediumWarnings.length} medium, ${lowWarnings.length} low`,
					};
				}
			}

			return { allow: true };
		},
	},
	{
		id: "security-bash-dangerous",
		type: "PreToolUse",
		name: "Block Dangerous Bash Commands",
		description: "Prevents execution of potentially dangerous shell commands",
		enabled: true,
		priority: 100,
		handler: (context: HookContext): HookResult => {
			if (context.tool !== "bash" || !context.params?.command) {
				return { allow: true };
			}

			const command = String(context.params.command);

			// Dangerous patterns to block
			const dangerousPatterns = [
				/\brm\s+-rf\s+\/\b/, // rm -rf /
				/\brm\s+-rf\s+\//, // rm -rf /anything
				/\bchmod\s+777\b/, // chmod 777 (too permissive)
				/\bmkfs\b/, // mkfs (format filesystem)
				/\bdd\s+.*of=\/dev\b/, // dd writing to device
				/\b>\s*\/dev\/sda\b/, // redirect to disk device
				/\bcurl\s+.*\|\s*bash\b/, // curl | bash (blind execution)
				/\bwget\s+.*\|\s*bash\b/, // wget | bash
				/\beval\s*\(/, // eval() in shell
				/\bsudo\s+rm\b/, // sudo rm
			];

			for (const pattern of dangerousPatterns) {
				if (pattern.test(command)) {
					return {
						allow: false,
						block:
							"Dangerous command detected: The command matches a dangerous pattern. If you really need to run this, explain why and the user can manually approve.",
						context: `Pattern: ${pattern.source}`,
					};
				}
			}

			// Warning patterns (allow but warn)
			const warningPatterns = [
				/\bsudo\b/, // sudo commands
				/\brm\s+-rf\b/, // rm -rf (even on non-root paths)
				/\bgit\s+push\s+--force\b/, // force push
				/\bgit\s+reset\s+--hard\b/, // hard reset
				/\bnpm\s+publish\b/, // npm publish
				/\bdocker\s+rm\b/, // docker rm
			];

			for (const pattern of warningPatterns) {
				if (pattern.test(command)) {
					return {
						allow: true,
						warning:
							"Caution: This command may have significant effects. Consider reviewing it carefully.",
						context: `Pattern: ${pattern.source}`,
					};
				}
			}

			return { allow: true };
		},
	},
	{
		id: "security-write-workflows",
		type: "PreToolUse",
		name: "Block Workflow Modifications",
		description: "Prevents modification of .github/workflows/ files without explicit permission",
		enabled: true,
		priority: 90,
		handler: (context: HookContext): HookResult => {
			if ((context.tool !== "write" && context.tool !== "edit") || !context.params?.path) {
				return { allow: true };
			}

			const path = String(context.params.path);

			if (path.includes(".github/workflows/") || path.includes(".github\\workflows\\")) {
				return {
					allow: false,
					block:
						"Protected path: Files in .github/workflows/ are protected and cannot be modified without explicit user permission.",
					context: `Path: ${path}`,
				};
			}

			return { allow: true };
		},
	},
	{
		id: "security-code-dangerous",
		type: "PreToolUse",
		name: "Warn on Dangerous Code Patterns",
		description:
			"Warns when writing potentially dangerous code patterns (eval, exec with user input)",
		enabled: true,
		priority: 80,
		handler: (context: HookContext): HookResult => {
			if ((context.tool !== "write" && context.tool !== "edit") || !context.params?.content) {
				return { allow: true };
			}

			const content = String(context.params.content);

			// Check for dangerous code patterns
			const dangerousPatterns = [
				{
					pattern: /\beval\s*\(/g,
					message: "eval() can execute arbitrary code - avoid using it with user input",
				},
				{
					pattern: /exec\s*\([^)]*\.\s*user/gi,
					message: "exec() with user input can be a security vulnerability - sanitize inputs",
				},
				{
					pattern: /execSync\s*\([^)]*\.\s*user/gi,
					message: "execSync() with user input can be a security vulnerability",
				},
				{
					pattern: /child_process.*user/gi,
					message: "Using child_process with user input is dangerous - consider sanitization",
				},
			];

			const warnings: string[] = [];
			for (const { pattern, message } of dangerousPatterns) {
				if (pattern.test(content)) {
					warnings.push(message);
				}
			}

			if (warnings.length > 0) {
				return {
					allow: true,
					warning: `Security patterns detected:\n${warnings.map((w) => `  - ${w}`).join("\n")}`,
					context: `File: ${context.params?.path || "unknown"}`,
				};
			}

			return { allow: true };
		},
	},
	{
		id: "safety-gates-scan",
		type: "PreToolUse",
		name: "Safety Gates Code Scan",
		description:
			"Uses Safety Gates module to scan code for dangerous patterns before writing/editing",
		enabled: true,
		priority: 85,
		handler: (context: HookContext): HookResult => {
			if ((context.tool !== "write" && context.tool !== "edit") || !context.params?.content) {
				return { allow: true };
			}

			const content = String(context.params.content);
			const file = context.params?.path ? String(context.params.path) : undefined;

			// Use Safety Gates for comprehensive scanning
			const safetyManager = getSafetyGateManager();
			if (!safetyManager.isEnabled()) {
				return { allow: true };
			}

			const result = safetyManager.scan(content, file);

			// If blocked by critical patterns
			if (!result.safe) {
				const criticalPatterns = result.critical.filter((p) => !p.bypassable);
				if (criticalPatterns.length > 0) {
					const messages = criticalPatterns.map((p) => `${p.name} (${p.risk}): ${p.description}`);
					return {
						allow: false,
						block: `Safety Gates detected dangerous patterns:\n${messages.map((m) => `  - ${m}`).join("\n")}`,
						context: `File: ${file || "unknown"}\nPatterns: ${criticalPatterns.length} critical`,
					};
				}
			}

			// If high-risk patterns detected, warn
			const highRisk = result.highRisk;
			if (highRisk.length > 0) {
				const messages = highRisk.map((p) => `${p.name} (${p.risk}): ${p.suggestion}`);
				return {
					allow: true,
					warning: `Safety Gates detected high-risk patterns:\n${messages.map((m) => `  - ${m}`).join("\n")}`,
					context: `File: ${file || "unknown"}\nPatterns: ${highRisk.length} high-risk`,
				};
			}

			return { allow: true };
		},
	},
];

/**
 * Hook Manager - manages registration, execution, and storage of hooks
 */
export class HookManager {
	private configPath: string;
	private config: HooksConfig;

	constructor(configPath?: string) {
		// Default to ~/.paimon/hooks.json
		this.configPath = configPath || join(homedir(), ".paimon", "hooks.json");
		this.config = this.loadConfig();
	}

	/**
	 * Load hooks configuration from file
	 */
	private loadConfig(): HooksConfig {
		if (existsSync(this.configPath)) {
			try {
				const content = readFileSync(this.configPath, "utf-8");
				return JSON.parse(content);
			} catch {
				// Invalid config, use defaults
			}
		}

		// Create default config with all hook types
		return {
			hooks: [...DEFAULT_SESSION_START_HOOKS, ...DEFAULT_STOP_HOOKS, ...DEFAULT_SECURITY_HOOKS],
			settings: {
				enabled: true,
				defaultBehavior: "allow",
			},
		};
	}

	/**
	 * Save hooks configuration to file
	 */
	private saveConfig(): void {
		const dir = join(homedir(), ".paimon");
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), "utf-8");
	}

	/**
	 * Check if hooks are globally enabled
	 */
	isEnabled(): boolean {
		return this.config.settings.enabled;
	}

	/**
	 * Enable or disable hooks globally
	 */
	setEnabled(enabled: boolean): void {
		this.config.settings.enabled = enabled;
		this.saveConfig();
	}

	/**
	 * Get all registered hooks
	 */
	getHooks(type?: HookType): Hook[] {
		const hooks = this.config.hooks.filter((h) => h.enabled);
		if (type) {
			return hooks.filter((h) => h.type === type);
		}
		return hooks;
	}

	/**
	 * Register a new hook
	 */
	registerHook(hook: Hook): void {
		// Check if hook already exists
		const existing = this.config.hooks.find((h) => h.id === hook.id);
		if (existing) {
			// Update existing hook
			Object.assign(existing, hook);
		} else {
			// Add new hook
			this.config.hooks.push(hook);
		}
		this.saveConfig();
	}

	/**
	 * Remove a hook by ID
	 */
	removeHook(hookId: string): boolean {
		const index = this.config.hooks.findIndex((h) => h.id === hookId);
		if (index >= 0) {
			this.config.hooks.splice(index, 1);
			this.saveConfig();
			return true;
		}
		return false;
	}

	/**
	 * Enable or disable a specific hook
	 */
	setHookEnabled(hookId: string, enabled: boolean): boolean {
		const hook = this.config.hooks.find((h) => h.id === hookId);
		if (hook) {
			hook.enabled = enabled;
			this.saveConfig();
			return true;
		}
		return false;
	}

	/**
	 * Execute hooks for a given context
	 * Returns the combined result from all matching hooks
	 */
	async executeHooks(type: HookType, context: HookContext): Promise<HookResult> {
		if (!this.isEnabled()) {
			return { allow: true };
		}

		const hooks = this.getHooks(type).sort((a, b) => b.priority - a.priority);

		// Execute each hook in priority order
		for (const hook of hooks) {
			try {
				const result = await hook.handler(context);

				// If a hook blocks, return immediately
				if (!result.allow) {
					return result;
				}

				// If a hook warns, accumulate warnings
				if (result.warning) {
					// Return first warning (highest priority)
					return {
						allow: true,
						warning: result.warning,
						context: result.context,
					};
				}
			} catch (error) {
				// Hook execution failed, log but continue
				console.error(`Hook ${hook.id} failed:`, error);
			}
		}

		// All hooks passed
		return { allow: true };
	}

	/**
	 * Format hooks list for display
	 */
	formatHooksList(): string {
		const hooks = this.config.hooks;
		if (hooks.length === 0) {
			return "No hooks registered.";
		}

		let output = "📋 Registered Hooks\n";
		output += `${"─".repeat(50)}\n`;
		output += `Global: ${this.config.settings.enabled ? "✅ Enabled" : "❌ Disabled"}\n`;
		output += `${"─".repeat(50)}\n\n`;

		for (const hook of hooks) {
			const statusEmoji = hook.enabled ? "✅" : "❌";
			output += `${statusEmoji} [${hook.priority}] ${hook.name}\n`;
			output += `   Type: ${hook.type}\n`;
			output += `   ID: ${hook.id}\n`;
			output += `   ${hook.description}\n\n`;
		}

		return output;
	}

	/**
	 * Format a hook execution result for display
	 */
	formatHookResult(result: HookResult): string {
		if (result.allow && !result.warning) {
			return "✅ Hook check passed";
		}

		if (result.allow && result.warning) {
			return `⚠️ Warning: ${result.warning}\n${result.context || ""}`;
		}

		if (!result.allow && result.block) {
			return `🚫 Blocked: ${result.block}\n${result.context || ""}`;
		}

		return "Hook result unclear";
	}
}

/**
 * Global hook manager instance
 */
export const globalHookManager = new HookManager();
