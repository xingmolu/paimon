/**
 * Chat Modes Manager (Aider Pattern)
 *
 * Manages different interaction modes for the agent:
 * - code: Make changes to code to satisfy requests
 * - ask: Discuss and answer questions without making changes
 * - architect: Architect proposes changes, editor model implements
 * - help: Answer questions about usage, configuration, troubleshooting
 *
 * Inspired by Aider's chat modes feature:
 * https://aider.chat/docs/usage/modes.html
 */

import * as fs from "node:fs";
import * as path from "node:path";

// Types
export type ChatMode = "code" | "ask" | "architect" | "help";

export interface ChatModeConfig {
	description: string;
	systemPromptSuffix: string;
	allowsFileChanges: boolean;
	allowsToolExecution: boolean;
	recommendedModels?: string[];
}

export interface ChatModesState {
	currentMode: ChatMode;
	previousMode: ChatMode | null;
	modeHistory: Array<{
		mode: ChatMode;
		timestamp: string;
		reason?: string;
	}>;
	stats: ChatModesStats;
}

export interface ChatModesStats {
	modeUsage: Record<ChatMode, number>;
	totalModeChanges: number;
	askCodeWorkflowTransitions: number;
	architectModeSessions: number;
	helpModeQueries: number;
	okCommandUsage: number;
}

export interface ChatModesManagerConfig {
	defaultMode: ChatMode;
	persistState: boolean;
	modeTransitionLogging: boolean;
}

// Mode configurations
const CHAT_MODE_CONFIGS: Record<ChatMode, ChatModeConfig> = {
	code: {
		description: "Make changes to your code to satisfy your requests",
		systemPromptSuffix: `You are in CODE mode. You can make changes to files and execute tools to implement the user's requests. Be direct and efficient in your implementation.`,
		allowsFileChanges: true,
		allowsToolExecution: true,
	},
	ask: {
		description: "Discuss and answer questions about code without making changes",
		systemPromptSuffix:
			"You are in ASK mode. You should discuss the code, answer questions, and provide suggestions but NEVER make changes to any files. You can read files to understand the codebase, but do not use write, edit, or any tools that modify files. Focus on explaining, analyzing, and advising.",
		allowsFileChanges: false,
		allowsToolExecution: true, // Can still read files
	},
	architect: {
		description: "Architect proposes changes, then editor model implements them",
		systemPromptSuffix:
			"You are in ARCHITECT mode. First, analyze the request and propose a high-level solution. Then, provide specific file edit instructions for implementation. This mode is useful for complex changes that benefit from planning before execution.",
		allowsFileChanges: true,
		allowsToolExecution: true,
		recommendedModels: ["o1", "o3-mini", "claude-3-7-sonnet"],
	},
	help: {
		description: "Answer questions about usage, configuration, and troubleshooting",
		systemPromptSuffix:
			"You are in HELP mode. Answer questions about how to use the agent, configuration options, troubleshooting, and best practices. Do not make changes to files unless specifically asked to modify configuration.",
		allowsFileChanges: false,
		allowsToolExecution: true,
	},
};

// Default configuration
const DEFAULT_CONFIG: ChatModesManagerConfig = {
	defaultMode: "code",
	persistState: true,
	modeTransitionLogging: true,
};

// Default stats
const DEFAULT_STATS: ChatModesStats = {
	modeUsage: { code: 0, ask: 0, architect: 0, help: 0 },
	totalModeChanges: 0,
	askCodeWorkflowTransitions: 0,
	architectModeSessions: 0,
	helpModeQueries: 0,
	okCommandUsage: 0,
};

let managerInstance: ChatModesManager | null = null;

export class ChatModesManager {
	private state: ChatModesState;
	private config: ChatModesManagerConfig;
	private dataPath: string;

	constructor(config?: Partial<ChatModesManagerConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		const homeDir = process.env.HOME || ".";
		this.dataPath = path.join(homeDir, ".paimon", "chat-modes.json");

		this.state = {
			currentMode: this.config.defaultMode,
			previousMode: null,
			modeHistory: [],
			stats: { ...DEFAULT_STATS },
		};

		if (this.config.persistState) {
			this.loadState();
		}
	}

	private loadState(): void {
		try {
			if (fs.existsSync(this.dataPath)) {
				const data = JSON.parse(fs.readFileSync(this.dataPath, "utf-8"));
				this.state = {
					currentMode: data.currentMode || this.config.defaultMode,
					previousMode: data.previousMode || null,
					modeHistory: data.modeHistory || [],
					stats: { ...DEFAULT_STATS, ...data.stats },
				};
			}
		} catch {
			// Use defaults
		}
	}

	private saveState(): void {
		if (!this.config.persistState) return;

		try {
			const dir = path.dirname(this.dataPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(this.dataPath, JSON.stringify(this.state, null, 2));
		} catch (error) {
			console.error("Failed to save chat modes state:", error);
		}
	}

	// Get current mode
	public getMode(): ChatMode {
		return this.state.currentMode;
	}

	// Get mode configuration
	public getModeConfig(mode: ChatMode): ChatModeConfig {
		return CHAT_MODE_CONFIGS[mode];
	}

	// Set mode
	public setMode(mode: ChatMode, reason?: string): void {
		if (this.state.currentMode === mode) return;

		const previousMode = this.state.currentMode;
		this.state.previousMode = previousMode;
		this.state.currentMode = mode;

		// Update stats
		this.state.stats.modeUsage[mode]++;
		this.state.stats.totalModeChanges++;

		// Track ask-code workflow transitions
		if (
			(previousMode === "ask" && mode === "code") ||
			(previousMode === "code" && mode === "ask")
		) {
			this.state.stats.askCodeWorkflowTransitions++;
		}

		// Track architect mode sessions
		if (mode === "architect") {
			this.state.stats.architectModeSessions++;
		}

		// Track help mode queries
		if (mode === "help") {
			this.state.stats.helpModeQueries++;
		}

		// Add to history
		this.state.modeHistory.unshift({
			mode,
			timestamp: new Date().toISOString(),
			reason,
		});

		// Limit history size
		if (this.state.modeHistory.length > 100) {
			this.state.modeHistory = this.state.modeHistory.slice(0, 100);
		}

		this.saveState();

		if (this.config.modeTransitionLogging) {
			console.log(`Chat mode changed: ${previousMode} → ${mode}${reason ? ` (${reason})` : ""}`);
		}
	}

	// Get all modes
	public getModes(): Array<{ mode: ChatMode; config: ChatModeConfig }> {
		return (Object.keys(CHAT_MODE_CONFIGS) as ChatMode[]).map((mode) => ({
			mode,
			config: CHAT_MODE_CONFIGS[mode],
		}));
	}

	// Get system prompt suffix for current mode
	public getSystemPromptSuffix(): string {
		return CHAT_MODE_CONFIGS[this.state.currentMode].systemPromptSuffix;
	}

	// Check if mode allows file changes
	public allowsFileChanges(): boolean {
		return CHAT_MODE_CONFIGS[this.state.currentMode].allowsFileChanges;
	}

	// Check if mode allows tool execution
	public allowsToolExecution(): boolean {
		return CHAT_MODE_CONFIGS[this.state.currentMode].allowsToolExecution;
	}

	// Get recommended models for current mode
	public getRecommendedModels(): string[] | undefined {
		return CHAT_MODE_CONFIGS[this.state.currentMode].recommendedModels;
	}

	// Get mode history
	public getHistory(limit = 20): Array<{
		mode: ChatMode;
		timestamp: string;
		reason?: string;
	}> {
		return this.state.modeHistory.slice(0, limit);
	}

	// Get stats
	public getStats(): ChatModesStats {
		return { ...this.state.stats };
	}

	// Get state
	public getState(): ChatModesState {
		return {
			currentMode: this.state.currentMode,
			previousMode: this.state.previousMode,
			modeHistory: this.state.modeHistory,
			stats: this.state.stats,
		};
	}

	// Reset to defaults
	public reset(): void {
		this.state = {
			currentMode: this.config.defaultMode,
			previousMode: null,
			modeHistory: [],
			stats: { ...DEFAULT_STATS },
		};
		this.saveState();
	}

	// Get config
	public getConfig(): ChatModesManagerConfig {
		return { ...this.config };
	}

	// Update config
	public updateConfig(updates: Partial<ChatModesManagerConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveState();
	}

	// Get workflow guidance (Aider's ask/code workflow pattern)
	public getWorkflowGuidance(): string {
		return `## Ask/Code Workflow (Recommended)

A recommended workflow is to bounce back and forth between \`ask\` and \`code\` modes:

1. Use \`ask\` mode to discuss what you want to do, get suggestions or options, and provide feedback on the approach
2. Once the plan is understood, switch to \`code\` mode to have the agent start editing files

The conversation and decision-making from ask mode will help ensure the correct code changes are performed.

Example:
- Switch to ask mode: \`chatModes({action: 'ask'})\`
- Discuss the approach
- Switch to code mode: \`chatModes({action: 'code'})\`
- Say "go ahead" to execute the plan

## Architect Mode

For complex changes, use \`architect\` mode:
- The architect model proposes how to solve the coding request
- An editor model then translates the proposal into specific file edits
- Especially useful with reasoning models like o1, o3-mini

Example:
- Switch to architect mode: \`chatModes({action: 'architect'})\`
- Describe the complex change needed
- The agent will plan and then implement in stages`;
	}

	// Get mode indicator for prompt
	public getModeIndicator(): string {
		const mode = this.state.currentMode;
		if (mode === "code") return ">"; // Default prompt
		return `${mode}>`;
	}

	// Track ok command usage
	public trackOkUsage(): void {
		this.state.stats.okCommandUsage++;
		this.saveState();
	}
}

// Singleton instance
export function getChatModesManager(): ChatModesManager {
	if (!managerInstance) {
		managerInstance = new ChatModesManager();
	}
	return managerInstance;
}

// Convenience functions
export function getCurrentMode(): ChatMode {
	return getChatModesManager().getMode();
}

export function setChatMode(mode: ChatMode, reason?: string): void {
	getChatModesManager().setMode(mode, reason);
}

export function getModeSystemPromptSuffix(): string {
	return getChatModesManager().getSystemPromptSuffix();
}

export function modeAllowsFileChanges(): boolean {
	return getChatModesManager().allowsFileChanges();
}

export function getModeIndicator(): string {
	return getChatModesManager().getModeIndicator();
}
