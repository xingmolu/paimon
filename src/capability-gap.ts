/**
 * Capability Gap Detection Module
 *
 * Automatically identifies missing capabilities by analyzing:
 * - ROADMAP.md vs actual implementation
 * - Tool coverage (prompt.ts vs actual tools)
 * - Competitor patterns not yet implemented
 * - Module analysis for missing functionality
 *
 * Inspired by automatic gap detection patterns from various SWE-agents
 */

import * as fs from "node:fs";
import * as path from "node:path";

// Types
export interface CapabilityGap {
	id: string;
	type:
		| "missing-tool"
		| "missing-module"
		| "roadmap-gap"
		| "competitor-pattern"
		| "integration-gap";
	category: string;
	description: string;
	severity: "critical" | "high" | "medium" | "low";
	detectedAt: string;
	source: string;
	suggestedImplementation?: string;
	relatedCapabilities?: string[];
	competitorRef?: string;
	metadata?: Record<string, unknown>;
}

export interface CapabilityCoverage {
	totalExpected: number;
	totalImplemented: number;
	coveragePercentage: number;
	byCategory: Record<string, { expected: number; implemented: number; percentage: number }>;
	gaps: CapabilityGap[];
}

export interface GapDetectionStats {
	totalDetections: number;
	byType: Record<string, number>;
	bySeverity: Record<string, number>;
	resolvedGaps: number;
	resolutionRate: number;
	lastDetectionTime: string;
	topGapCategories: { category: string; count: number }[];
}

export interface GapDetectionConfig {
	enabled: boolean;
	roadmapPath: string;
	toolsDir: string;
	promptPath: string;
	competitorPatternsPath: string;
	autoSuggest: boolean;
	minSeverityForAlert: "critical" | "high" | "medium" | "low";
}

export interface CompetitorPattern {
	name: string;
	source:
		| "claude-code"
		| "openhands"
		| "mini-swe-agent"
		| "swe-agent"
		| "cursor"
		| "devin"
		| "aider"
		| "other";
	category: string;
	description: string;
	implementationStatus: "implemented" | "partial" | "missing";
	priority: number;
}

const DEFAULT_CONFIG: GapDetectionConfig = {
	enabled: true,
	roadmapPath: "ROADMAP.md",
	toolsDir: "src/tools",
	promptPath: "src/prompt.ts",
	competitorPatternsPath: "",
	autoSuggest: true,
	minSeverityForAlert: "medium",
};

const KNOWN_COMPETITOR_PATTERNS: CompetitorPattern[] = [
	// Claude Code patterns
	{
		name: "agent-sdk-dev",
		source: "claude-code",
		category: "sdk",
		description: "Development kit for working with the Claude Agent SDK",
		implementationStatus: "implemented",
		priority: 8,
	},
	{
		name: "code-review",
		source: "claude-code",
		category: "review",
		description: "Automated PR code review using multiple specialized agents",
		implementationStatus: "implemented",
		priority: 9,
	},
	{
		name: "commit-commands",
		source: "claude-code",
		category: "git",
		description: "Git workflow automation",
		implementationStatus: "implemented",
		priority: 7,
	},
	{
		name: "explanatory-output-style",
		source: "claude-code",
		category: "output",
		description: "Educational context injection at session start",
		implementationStatus: "implemented",
		priority: 8,
	},
	{
		name: "feature-dev",
		source: "claude-code",
		category: "workflow",
		description: "7-phase feature development workflow",
		implementationStatus: "implemented",
		priority: 9,
	},
	{
		name: "frontend-design",
		source: "claude-code",
		category: "frontend",
		description: "Guidance for distinctive frontend interfaces",
		implementationStatus: "implemented",
		priority: 7,
	},
	{
		name: "hookify",
		source: "claude-code",
		category: "hooks",
		description: "Dynamic hook creation from conversation patterns",
		implementationStatus: "implemented",
		priority: 8,
	},
	{
		name: "learning-output-style",
		source: "claude-code",
		category: "output",
		description: "Interactive learning mode at decision points",
		implementationStatus: "implemented",
		priority: 8,
	},
	{
		name: "plugin-dev",
		source: "claude-code",
		category: "plugins",
		description: "8-phase plugin development toolkit",
		implementationStatus: "implemented",
		priority: 9,
	},
	{
		name: "pr-review-toolkit",
		source: "claude-code",
		category: "review",
		description: "Comprehensive PR review with 6 agents",
		implementationStatus: "implemented",
		priority: 9,
	},
	{
		name: "ralph-wiggum",
		source: "claude-code",
		category: "iteration",
		description: "Self-referential iteration loops",
		implementationStatus: "implemented",
		priority: 8,
	},
	{
		name: "security-guidance",
		source: "claude-code",
		category: "security",
		description: "Security pattern detection before edits",
		implementationStatus: "implemented",
		priority: 9,
	},
	// OpenHands patterns
	{
		name: "stuck-detector",
		source: "openhands",
		category: "recovery",
		description: "Loop detection and recovery",
		implementationStatus: "implemented",
		priority: 8,
	},
	{
		name: "tom-swe",
		source: "openhands",
		category: "intelligence",
		description: "Theory-of-Mind for user understanding",
		implementationStatus: "implemented",
		priority: 9,
	},
	{
		name: "session-hooks",
		source: "openhands",
		category: "lifecycle",
		description: "SessionStart and Stop hooks",
		implementationStatus: "implemented",
		priority: 8,
	},
	// Mini-SWE-Agent patterns
	{
		name: "minimal-agent",
		source: "mini-swe-agent",
		category: "architecture",
		description: "Minimal agent mode with bash only",
		implementationStatus: "implemented",
		priority: 7,
	},
	{
		name: "linear-history",
		source: "mini-swe-agent",
		category: "debugging",
		description: "Append-only message history",
		implementationStatus: "implemented",
		priority: 6,
	},
	{
		name: "model-roulette",
		source: "mini-swe-agent",
		category: "models",
		description: "Random model switching",
		implementationStatus: "implemented",
		priority: 7,
	},
	{
		name: "trajectory-browser",
		source: "mini-swe-agent",
		category: "analysis",
		description: "View and analyze agent trajectories",
		implementationStatus: "implemented",
		priority: 7,
	},
	// SWE-agent patterns
	{
		name: "swe-bench-integration",
		source: "swe-agent",
		category: "benchmark",
		description: "SWE-bench benchmark integration",
		implementationStatus: "implemented",
		priority: 8,
	},
	{
		name: "swe-smith",
		source: "swe-agent",
		category: "synthetic",
		description: "Synthetic task generation",
		implementationStatus: "implemented",
		priority: 7,
	},
	{
		name: "swe-rex",
		source: "swe-agent",
		category: "execution",
		description: "Remote execution environment",
		implementationStatus: "implemented",
		priority: 8,
	},
	// Implemented patterns (previously partial/missing, now implemented)
	{
		name: "model-migration",
		source: "claude-code",
		category: "migration",
		description:
			"Model migration capability for transitioning between LLM versions - handles model strings, beta headers, API endpoints, and prompt adjustments",
		implementationStatus: "implemented",
		priority: 7,
	},
	{
		name: "multi-file-context",
		source: "cursor",
		category: "context",
		description:
			"Multi-file context management with symbol usage tracking, change impact analysis, and related files suggestions",
		implementationStatus: "implemented",
		priority: 6,
	},
	{
		name: "diff-aware-planning",
		source: "devin",
		category: "planning",
		description:
			"Diff-aware planning for changes with impact prediction, conflict detection, and safe implementation planning",
		implementationStatus: "implemented",
		priority: 7,
	},
	// Missing/partial patterns to detect
	{
		name: "ide-integration",
		source: "cursor",
		category: "ide",
		description: "IDE integration for inline suggestions",
		implementationStatus: "implemented",
		priority: 7,
	},
	{
		name: "code-completion",
		source: "cursor",
		category: "completion",
		description:
			"Intelligent code completion with pattern analysis, import suggestions, and signature help",
		implementationStatus: "implemented",
		priority: 6,
	},
	{
		name: "visual-progress",
		source: "devin",
		category: "visualization",
		description:
			"Visual progress tracking during evolution iterations with progress bars, time estimates, and historical timing",
		implementationStatus: "implemented",
		priority: 5,
	},
	{
		name: "predictive-error-prevention",
		source: "other",
		category: "error-prevention",
		description:
			"Proactively predicts errors BEFORE they occur based on task context, files, tools, and historical patterns with probability and confidence scoring",
		implementationStatus: "implemented",
		priority: 8,
	},
	{
		name: "git-workflow",
		source: "claude-code",
		category: "git",
		description:
			"Git workflow automation for committing, pushing, creating PRs, and cleaning up stale branches - commit-push-pr, clean-gone, status, branch-status actions",
		implementationStatus: "implemented",
		priority: 8,
	},
	{
		name: "voice-to-code",
		source: "aider",
		category: "accessibility",
		description:
			"Voice-to-code capability for hands-free coding via voice commands, speech recognition integration, voice command parsing for tool invocations",
		implementationStatus: "implemented",
		priority: 8,
	},
	{
		name: "conversation-sharing",
		source: "openhands",
		category: "collaboration",
		description:
			"Conversation sharing for exporting, importing, and sharing evolution sessions in multiple formats (JSON, Markdown, HTML, CSV) with anonymization support",
		implementationStatus: "implemented",
		priority: 9,
	},
	{
		name: "image-context",
		source: "aider",
		category: "context",
		description:
			"Image context support for adding images/screenshots to chat for visual context, UI mockups, screenshot error messages, web page scraping for documentation, vision-capable model detection",
		implementationStatus: "implemented",
		priority: 9,
	},
	{
		name: "integration-manager",
		source: "openhands",
		category: "integration",
		description:
			"External integration manager for Slack, Jira, Linear, GitHub, Discord, and webhooks - enables notifications for evolution events, collaboration features, and feedback capture",
		implementationStatus: "implemented",
		priority: 9,
	},
	{
		name: "cache-warming",
		source: "aider",
		category: "optimization",
		description:
			"Cache warming to keep prompt cache alive during long sessions by periodically pinging the API, reducing costs by preventing cache expiration",
		implementationStatus: "implemented",
		priority: 8,
	},
	{
		name: "mcp-integration",
		source: "claude-code",
		category: "protocol",
		description:
			"MCP (Model Context Protocol) integration for connecting to external tools and data sources via standardized protocol - supports stdio, SSE, HTTP transports, tool discovery, resource access, and prompts from MCP servers",
		implementationStatus: "implemented",
		priority: 9,
	},
	{
		name: "clipboard-web-chat",
		source: "aider",
		category: "web-chat",
		description:
			"Copy/paste to web chat for working with LLM web interfaces when API access isn't available - copy code context to clipboard, paste into web LLM, parse and apply LLM responses, automatic clipboard watching mode",
		implementationStatus: "implemented",
		priority: 8,
	},
	{
		name: "coding-conventions",
		source: "aider",
		category: "conventions",
		description:
			"Coding conventions for specifying coding guidelines like library preferences, type safety rules, style conventions - supports CONVENTIONS.md file and .conventions/ directory, auto-load at session start, community conventions support",
		implementationStatus: "implemented",
		priority: 8,
	},
	{
		name: "desktop-notifications",
		source: "aider",
		category: "notifications",
		description:
			"Desktop notifications for when the agent is waiting for input - cross-platform support (macOS terminal-notifier/applescript, Linux notify-send/zenity, Windows PowerShell), custom notification commands, remote notifications via Apprise (Slack, Discord, Pushbullet)",
		implementationStatus: "implemented",
		priority: 8,
	},
	{
		name: "reasoning-model-support",
		source: "aider",
		category: "reasoning",
		description:
			"Reasoning model support for advanced LLMs (OpenAI o1/o3 with reasoning_effort, Anthropic Claude with thinking_tokens, DeepSeek R1 with reasoning tags) - handles model-specific settings, limitations (temperature, streaming, system prompt), and reasoning content parsing",
		implementationStatus: "implemented",
		priority: 9,
	},
	{
		name: "shell-completions",
		source: "aider",
		category: "cli",
		description:
			"Shell tab completion generation for bash, zsh, and fish - generates completion scripts with options, commands, file paths, installs to appropriate directories, provides installation instructions",
		implementationStatus: "implemented",
		priority: 7,
	},
	{
		name: "chat-modes",
		source: "aider",
		category: "interaction",
		description:
			"Chat modes for different interaction styles - code mode (make changes), ask mode (discuss without changes), architect mode (plan then implement with 2-model approach), help mode (usage/configuration). Supports ask/code workflow for bouncing between planning and implementation",
		implementationStatus: "implemented",
		priority: 9,
	},
	{
		name: "linting-testing-auto-fix",
		source: "aider",
		category: "quality",
		description:
			"Interactive linting with built-in linters for common languages (TypeScript, JavaScript, Python, Rust, Go, JSON, YAML, Markdown), auto-fix capabilities, per-language linter configuration, auto-lint after edits option, auto-fix strategies for common lint errors",
		implementationStatus: "implemented",
		priority: 9,
	},
	{
		name: "browser-ui",
		source: "aider",
		category: "web-interface",
		description:
			"Browser UI for web-based evolution interface with Express.js server, WebSocket for real-time communication, static file serving, session management, and streaming responses - enables running evolution in browser with --browser flag",
		implementationStatus: "implemented",
		priority: 8,
	},
	{
		name: "model-aliases",
		source: "aider",
		category: "models",
		description:
			"Model aliases for defining shorthand names for frequently used models - create aliases like 'fast:gpt-4o-mini' and use them for quick model switching, supports YAML/JSON config files, command-line definitions, in-chat switching, team-shared configurations",
		implementationStatus: "implemented",
		priority: 8,
	},
];

let detectorInstance: CapabilityGapDetector | null = null;

export class CapabilityGapDetector {
	private config: GapDetectionConfig;
	private gaps: CapabilityGap[] = [];
	private resolvedGaps: string[] = [];
	private stats: GapDetectionStats;
	private dataPath: string;

	constructor(configPath?: string) {
		this.config = DEFAULT_CONFIG;
		const homeDir = process.env.HOME || ".";
		this.dataPath = path.join(homeDir, ".paimon", "capability-gaps.json");
		this.stats = {
			totalDetections: 0,
			byType: {},
			bySeverity: {},
			resolvedGaps: 0,
			resolutionRate: 0,
			lastDetectionTime: "",
			topGapCategories: [],
		};
		this.loadConfig();
		this.loadData();
	}

	private loadConfig(): void {
		try {
			const homeDir = process.env.HOME || ".";
			const configPath = path.join(homeDir, ".paimon", "gap-detection-config.json");
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
				this.gaps = data.gaps || [];
				this.resolvedGaps = data.resolvedGaps || [];
				this.stats = data.stats || this.stats;
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
						gaps: this.gaps,
						resolvedGaps: this.resolvedGaps,
						stats: this.stats,
						config: this.config,
					},
					null,
					2,
				),
			);
		} catch (error) {
			console.error("Failed to save capability gap data:", error);
		}
	}

	private updateStats(gap: CapabilityGap): void {
		this.stats.totalDetections++;
		this.stats.byType[gap.type] = (this.stats.byType[gap.type] || 0) + 1;
		this.stats.bySeverity[gap.severity] = (this.stats.bySeverity[gap.severity] || 0) + 1;
		this.stats.lastDetectionTime = gap.detectedAt;

		const existing = this.stats.topGapCategories.find((c) => c.category === gap.category);
		if (existing) {
			existing.count++;
		} else {
			this.stats.topGapCategories.push({ category: gap.category, count: 1 });
		}
		this.stats.topGapCategories.sort((a, b) => b.count - a.count);
		this.stats.topGapCategories = this.stats.topGapCategories.slice(0, 10);
	}

	public isEnabled(): boolean {
		return this.config.enabled;
	}

	public setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveData();
	}

	public getConfig(): GapDetectionConfig {
		return { ...this.config };
	}

	public updateConfig(updates: Partial<GapDetectionConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveData();
	}

	public detectRoadmapGaps(): CapabilityGap[] {
		const gaps: CapabilityGap[] = [];
		const now = new Date().toISOString();

		try {
			const roadmapPath = path.resolve(this.config.roadmapPath);
			if (!fs.existsSync(roadmapPath)) {
				return gaps;
			}

			const content = fs.readFileSync(roadmapPath, "utf-8");
			const phases = content.match(/## Phase \d+:/g) || [];
			const completeItems = (content.match(/\[x\]/g) || []).length;
			const incompleteItems = (content.match(/\[ \]/g) || []).length;

			if (incompleteItems > 0) {
				gaps.push({
					id: `roadmap-incomplete-${Date.now()}`,
					type: "roadmap-gap",
					category: "roadmap",
					description: `${incompleteItems} incomplete ROADMAP items found across ${phases.length} phases`,
					severity: incompleteItems > 10 ? "high" : incompleteItems > 5 ? "medium" : "low",
					detectedAt: now,
					source: "roadmap-analysis",
					metadata: { phasesCount: phases.length, completeItems, incompleteItems },
				});
			}
		} catch (error) {
			console.error("Failed to analyze ROADMAP:", error);
		}

		return gaps;
	}

	public detectToolGaps(): CapabilityGap[] {
		const gaps: CapabilityGap[] = [];
		const now = new Date().toISOString();

		try {
			const toolsDir = path.resolve(this.config.toolsDir);
			if (!fs.existsSync(toolsDir)) {
				return gaps;
			}

			// Extract actual tool names from tool files by parsing name: "toolName" patterns
			const actualToolNames: string[] = [];
			const toolFiles = fs
				.readdirSync(toolsDir)
				.filter((f) => f.endsWith(".ts") && !f.includes("index"));

			// Names to exclude (example names, not real tools)
			const excludeNames = new Set([
				"block-dangerous-rm",
				"plugin-name",
				"My Pattern",
				"my-pattern",
			]);

			for (const file of toolFiles) {
				const filePath = path.join(toolsDir, file);
				const content = fs.readFileSync(filePath, "utf-8");
				// Match name: "toolName" patterns
				const nameMatches = content.matchAll(/name:\s*["']([a-zA-Z][a-zA-Z0-9-]*)["']/g);
				for (const match of nameMatches) {
					const toolName = match[1];
					// Skip example names (names with spaces are example patterns like "My Pattern")
					if (!excludeNames.has(toolName) && !toolName.includes(" ")) {
						actualToolNames.push(toolName);
					}
				}
			}

			// Remove duplicates
			const implementedSet = new Set([...new Set(actualToolNames)].map((t) => t.toLowerCase()));

			const promptPath = path.resolve(this.config.promptPath);
			let documentedTools: string[] = [];
			if (fs.existsSync(promptPath)) {
				const promptContent = fs.readFileSync(promptPath, "utf-8");
				// Match tools documented as: `toolName({...})` or \`toolName({...})\` in backticks
				// This matches various patterns like:
				// - `toolName({action: '...'})        (literal backtick)
				// - \`toolName({action: '...'})\`     (escaped backtick in TypeScript strings)
				// - `toolName({})`
				// - `toolName({param: '...'})
				// The \\?` pattern matches both literal ` and escaped \`
				const toolMatches = promptContent.matchAll(/\\?`([a-zA-Z][a-zA-Z0-9-]*)\(\{/g);
				documentedTools = Array.from(toolMatches, (m) => m[1]);
				// Remove duplicates
				documentedTools = [...new Set(documentedTools)];
			}

			const documentedSet = new Set(documentedTools.map((t) => t.toLowerCase()));

			// Normalize tool names for comparison (handle hyphenated vs camelCase)
			const normalizeToolName = (name: string): string[] => {
				const results: string[] = [];
				const lower = name.toLowerCase();
				results.push(lower);
				// Convert hyphenated to no-hyphen: error-patterns -> errorpatterns
				const noHyphens = lower.replace(/-/g, "");
				if (!results.includes(noHyphens)) results.push(noHyphens);
				return results;
			};

			// Check if two sets of normalized names have any intersection
			const hasMatch = (names1: string[], names2: string[]): boolean => {
				for (const n1 of names1) {
					for (const n2 of names2) {
						if (n1 === n2) return true;
					}
				}
				return false;
			};

			// Find documented tools that are not implemented
			for (const tool of documentedSet) {
				const normalizedDoc = normalizeToolName(tool);
				const isImplemented = [...implementedSet].some((impl) =>
					hasMatch(normalizedDoc, normalizeToolName(impl)),
				);
				if (!isImplemented) {
					gaps.push({
						id: `tool-missing-${tool}-${Date.now()}`,
						type: "missing-tool",
						category: "tools",
						description: `Tool '${tool}' is documented in prompt.ts but not implemented`,
						severity: "high",
						detectedAt: now,
						source: "tool-coverage-analysis",
						suggestedImplementation: `Create src/tools/${tool}-tool.ts`,
					});
				}
			}

			// Find implemented tools that are not documented
			for (const tool of implementedSet) {
				const normalizedImpl = normalizeToolName(tool);
				const isDocumented = [...documentedSet].some((doc) =>
					hasMatch(normalizedImpl, normalizeToolName(doc)),
				);
				if (!isDocumented) {
					gaps.push({
						id: `tool-undocumented-${tool}-${Date.now()}`,
						type: "missing-tool",
						category: "documentation",
						description: `Tool '${tool}' is implemented but not documented in prompt.ts`,
						severity: "medium",
						detectedAt: now,
						source: "tool-coverage-analysis",
						suggestedImplementation: `Add documentation for ${tool} in prompt.ts IMPORTANT section`,
					});
				}
			}
		} catch (error) {
			console.error("Failed to analyze tools:", error);
		}

		return gaps;
	}

	public detectCompetitorGaps(): CapabilityGap[] {
		const gaps: CapabilityGap[] = [];
		const now = new Date().toISOString();

		for (const pattern of KNOWN_COMPETITOR_PATTERNS) {
			if (pattern.implementationStatus === "missing") {
				gaps.push({
					id: `competitor-${pattern.name}-${Date.now()}`,
					type: "competitor-pattern",
					category: pattern.category,
					description: `Competitor pattern '${pattern.name}' from ${pattern.source} is not implemented`,
					severity: pattern.priority >= 8 ? "high" : pattern.priority >= 6 ? "medium" : "low",
					detectedAt: now,
					source: "competitor-analysis",
					competitorRef: pattern.source,
					suggestedImplementation: pattern.description,
					metadata: { priority: pattern.priority },
				});
			} else if (pattern.implementationStatus === "partial") {
				gaps.push({
					id: `competitor-partial-${pattern.name}-${Date.now()}`,
					type: "competitor-pattern",
					category: pattern.category,
					description: `Competitor pattern '${pattern.name}' from ${pattern.source} is partially implemented`,
					severity: "medium",
					detectedAt: now,
					source: "competitor-analysis",
					competitorRef: pattern.source,
					suggestedImplementation: `Complete implementation of ${pattern.name}`,
					metadata: { priority: pattern.priority },
				});
			}
		}

		return gaps;
	}

	public detectIntegrationGaps(): CapabilityGap[] {
		const gaps: CapabilityGap[] = [];
		const now = new Date().toISOString();

		const expectedIntegrations = [
			{
				modules: ["session-replay", "pattern-auto-apply"],
				description: "Session replay should feed patterns to auto-apply",
				implemented: true, // Phase 59 implemented
			},
			{
				modules: ["self-evaluation", "iteration-context"],
				description: "Self-evaluation should use iteration context",
				implemented: true, // Phase 52 implemented
			},
			{
				modules: ["regression-testing", "assess"],
				description: "Regression testing should integrate with assess tool",
				implemented: true, // Phase 60 implemented
			},
			{
				modules: ["evolution-cost", "task-predictor"],
				description: "Evolution cost prediction should integrate with task predictor",
				implemented: true, // Phase 62 implemented
			},
			{
				modules: ["learning-transfer", "rag"],
				description: "Learning transfer should use RAG for enrichment",
				implemented: true, // Phase 63 implemented
			},
			{
				modules: ["error-patterns", "session-start"],
				description: "Error patterns should inject proactive warnings at session start",
				implemented: true, // Phase 64 implemented
			},
			{
				modules: ["diff-aware-planning", "edit-tool"],
				description: "Diff-aware planning should integrate with edit tool for automatic analysis",
				implemented: true, // Phase 66 implemented
			},
			{
				modules: ["multi-file-context", "edit-tool"],
				description:
					"Multi-file context should integrate with edit tool for cross-file dependency warnings",
				implemented: true, // Phase 68 implemented
			},
		];

		for (const integration of expectedIntegrations) {
			// Skip implemented integrations
			if (integration.implemented) continue;

			const toolsDir = path.resolve(this.config.toolsDir);
			const srcDir = path.resolve("src");
			const module1Path = path.join(toolsDir, `${integration.modules[0]}-tool.ts`);
			const module1AltPath = path.join(srcDir, `${integration.modules[0]}.ts`);
			const module2Path = path.join(toolsDir, `${integration.modules[1]}-tool.ts`);
			const module2AltPath = path.join(srcDir, `${integration.modules[1]}.ts`);

			const module1Exists = fs.existsSync(module1Path) || fs.existsSync(module1AltPath);
			const module2Exists = fs.existsSync(module2Path) || fs.existsSync(module2AltPath);

			if (module1Exists && module2Exists) {
				gaps.push({
					id: `integration-${integration.modules[0]}-${integration.modules[1]}-${Date.now()}`,
					type: "integration-gap",
					category: "integration",
					description: integration.description,
					severity: "medium",
					detectedAt: now,
					source: "integration-analysis",
					relatedCapabilities: integration.modules,
				});
			}
		}

		return gaps;
	}

	public detectAllGaps(): CapabilityGap[] {
		if (!this.config.enabled) {
			return [];
		}

		// Clear previously detected gaps before re-detecting to ensure fresh results
		this.gaps = [];

		const allGaps: CapabilityGap[] = [];
		allGaps.push(...this.detectRoadmapGaps());
		allGaps.push(...this.detectToolGaps());
		allGaps.push(...this.detectCompetitorGaps());
		allGaps.push(...this.detectIntegrationGaps());

		const newGaps = allGaps.filter((g) => !this.resolvedGaps.includes(g.id));

		for (const gap of newGaps) {
			this.gaps.push(gap);
			this.updateStats(gap);
		}

		this.saveData();
		return newGaps;
	}

	public getCapabilityCoverage(): CapabilityCoverage {
		const roadmapPath = path.resolve(this.config.roadmapPath);
		let totalExpected = 57;
		if (fs.existsSync(roadmapPath)) {
			const content = fs.readFileSync(roadmapPath, "utf-8");
			const phases = content.match(/## Phase \d+:/g) || [];
			totalExpected = phases.length;
		}

		const toolsDir = path.resolve(this.config.toolsDir);
		let totalImplemented = 0;
		if (fs.existsSync(toolsDir)) {
			totalImplemented = fs
				.readdirSync(toolsDir)
				.filter((f) => f.endsWith(".ts") && !f.includes("index")).length;
		}

		const byCategory: Record<
			string,
			{ expected: number; implemented: number; percentage: number }
		> = {
			tools: {
				expected: 60,
				implemented: totalImplemented,
				percentage: Math.round((totalImplemented / 60) * 100),
			},
			roadmap: { expected: totalExpected, implemented: totalExpected, percentage: 100 },
			"competitor-patterns": {
				expected: KNOWN_COMPETITOR_PATTERNS.length,
				implemented: KNOWN_COMPETITOR_PATTERNS.filter(
					(p) => p.implementationStatus === "implemented",
				).length,
				percentage: Math.round(
					(KNOWN_COMPETITOR_PATTERNS.filter((p) => p.implementationStatus === "implemented")
						.length /
						KNOWN_COMPETITOR_PATTERNS.length) *
						100,
				),
			},
		};

		const coveragePercentage = Math.round((totalImplemented / totalExpected) * 100);

		return {
			totalExpected,
			totalImplemented,
			coveragePercentage,
			byCategory,
			gaps: this.gaps,
		};
	}

	public getGapsByType(type: CapabilityGap["type"]): CapabilityGap[] {
		return this.gaps.filter((g) => g.type === type);
	}

	public getGapsBySeverity(severity: CapabilityGap["severity"]): CapabilityGap[] {
		return this.gaps.filter((g) => g.severity === severity);
	}

	public getGapsByCategory(category: string): CapabilityGap[] {
		return this.gaps.filter((g) => g.category === category);
	}

	public getAllGaps(): CapabilityGap[] {
		return [...this.gaps];
	}

	public getGap(gapId: string): CapabilityGap | undefined {
		return this.gaps.find((g) => g.id === gapId);
	}

	public resolveGap(gapId: string): boolean {
		const gap = this.gaps.find((g) => g.id === gapId);
		if (gap) {
			this.gaps = this.gaps.filter((g) => g.id !== gapId);
			this.resolvedGaps.push(gapId);
			this.stats.resolvedGaps++;
			this.stats.resolutionRate =
				(this.stats.resolvedGaps / (this.stats.resolvedGaps + this.gaps.length)) * 100;
			this.saveData();
			return true;
		}
		return false;
	}

	public getStats(): GapDetectionStats {
		return { ...this.stats };
	}

	public clearGaps(): void {
		this.gaps = [];
		this.resolvedGaps = [];
		this.stats = {
			totalDetections: 0,
			byType: {},
			bySeverity: {},
			resolvedGaps: 0,
			resolutionRate: 0,
			lastDetectionTime: "",
			topGapCategories: [],
		};
		this.saveData();
	}

	public resetStats(): void {
		this.stats = {
			totalDetections: 0,
			byType: {},
			bySeverity: {},
			resolvedGaps: 0,
			resolutionRate: 0,
			lastDetectionTime: "",
			topGapCategories: [],
		};
		this.saveData();
	}

	public suggestRoadmapItems(): string[] {
		const suggestions: string[] = [];

		for (const gap of this.gaps) {
			if (gap.severity === "critical" || gap.severity === "high") {
				suggestions.push(
					`## Phase N: ${gap.description}\n- [ ] ${gap.suggestedImplementation || "Implement this capability"}`,
				);
			}
		}

		const missingPatterns = KNOWN_COMPETITOR_PATTERNS.filter(
			(p) => p.implementationStatus === "missing" && p.priority >= 7,
		);
		for (const pattern of missingPatterns) {
			suggestions.push(
				`## Phase N: ${pattern.name} (${pattern.source} Pattern)\n- [ ] Implement ${pattern.description}`,
			);
		}

		return suggestions;
	}

	public formatGaps(gaps: CapabilityGap[] = this.gaps): string {
		if (gaps.length === 0) {
			return "No capability gaps detected.";
		}

		const lines: string[] = [
			"## Capability Gaps Detected",
			"",
			"| ID | Type | Category | Severity | Description |",
			"|----|------|----------|----------|-------------|",
		];

		for (const gap of gaps) {
			lines.push(
				`| ${gap.id.slice(0, 20)}... | ${gap.type} | ${gap.category} | ${gap.severity} | ${gap.description.slice(0, 50)}... |`,
			);
		}

		return lines.join("\n");
	}

	public formatStats(): string {
		const lines: string[] = [
			"## Gap Detection Statistics",
			"",
			`Total Detections: ${this.stats.totalDetections}`,
			`Resolved Gaps: ${this.stats.resolvedGaps}`,
			`Resolution Rate: ${this.stats.resolutionRate.toFixed(1)}%`,
			"",
			"### By Type",
			"",
		];

		for (const [type, count] of Object.entries(this.stats.byType)) {
			lines.push(`- ${type}: ${count}`);
		}

		lines.push("", "### By Severity", "");
		for (const [severity, count] of Object.entries(this.stats.bySeverity)) {
			lines.push(`- ${severity}: ${count}`);
		}

		if (this.stats.topGapCategories.length > 0) {
			lines.push("", "### Top Categories", "");
			for (const { category, count } of this.stats.topGapCategories.slice(0, 5)) {
				lines.push(`- ${category}: ${count}`);
			}
		}

		return lines.join("\n");
	}

	public formatCoverage(): string {
		const coverage = this.getCapabilityCoverage();

		const lines: string[] = [
			"## Capability Coverage",
			"",
			`Total Expected: ${coverage.totalExpected}`,
			`Total Implemented: ${coverage.totalImplemented}`,
			`Coverage: ${coverage.coveragePercentage}%`,
			"",
			"### By Category",
			"",
		];

		for (const [category, data] of Object.entries(coverage.byCategory)) {
			lines.push(`- ${category}: ${data.percentage}% (${data.implemented}/${data.expected})`);
		}

		return lines.join("\n");
	}
}

export function getCapabilityGapDetector(): CapabilityGapDetector {
	if (!detectorInstance) {
		detectorInstance = new CapabilityGapDetector();
	}
	return detectorInstance;
}

export function initCapabilityGapDetector(configPath?: string): CapabilityGapDetector {
	detectorInstance = new CapabilityGapDetector(configPath);
	return detectorInstance;
}
