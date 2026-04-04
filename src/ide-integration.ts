/**
 * IDE Integration Module (Cursor Pattern)
 *
 * Enables inline evolution suggestions from IDE environments.
 * Inspired by Cursor's IDE integration for AI-powered code assistance.
 *
 * Key features:
 * - IDE context detection (VSCode, JetBrains, Vim, etc.)
 * - Inline suggestion generation from evolution context
 * - File context management for open files in IDE
 * - Notification system for IDE integration events
 */

import * as fs from "node:fs";
import * as path from "node:path";

// Types
export interface IDEContext {
	detectedIDE: DetectedIDE | null;
	isIDESession: boolean;
	openFiles: string[];
	activeFile: string | null;
	cursorPosition: { line: number; column: number } | null;
	projectRoot: string | null;
	terminalType: string | null;
	editorVersion: string | null;
	lastDetectedAt: string;
}

export type DetectedIDE =
	| "vscode"
	| "jetbrains"
	| "vim"
	| "neovim"
	| "emacs"
	| "sublime"
	| "atom"
	| "cursor"
	| "other";

export interface InlineSuggestion {
	id: string;
	type: "code" | "explanation" | "action" | "warning";
	content: string;
	filePath: string | null;
	lineRange: { start: number; end: number } | null;
	priority: "high" | "medium" | "low";
	source: "evolution-context" | "error-pattern" | "competitor-pattern" | "task-recommendation";
	reason: string;
	timestamp: string;
}

export interface IDENotification {
	id: string;
	level: "info" | "warning" | "error" | "success";
	title: string;
	message: string;
	details?: Record<string, unknown>;
	timestamp: string;
	dismissed: boolean;
}

export interface IDEIntegrationStats {
	totalSessions: number;
	ideSessions: number;
	byIDE: Record<string, number>;
	suggestionsGenerated: number;
	suggestionsApplied: number;
	notificationsSent: number;
	notificationsDismissed: number;
	lastIDESession: string | null;
}

export interface IDEIntegrationConfig {
	enabled: boolean;
	autoDetectIDE: boolean;
	injectContextAtStart: boolean;
	maxOpenFiles: number;
	suggestionPriority: "high" | "medium" | "low";
	notifyOnEvolutionEvents: boolean;
}

// Default config
const DEFAULT_CONFIG: IDEIntegrationConfig = {
	enabled: true,
	autoDetectIDE: true,
	injectContextAtStart: true,
	maxOpenFiles: 20,
	suggestionPriority: "medium",
	notifyOnEvolutionEvents: true,
};

// IDE detection patterns
const IDE_SIGNATURES: Record<string, { envVars: string[]; terminalPatterns: string[] }> = {
	vscode: {
		envVars: ["VSCODE_PID", "VSCODE_IPC_HANDLE", "TERM_PROGRAM=vscode"],
		terminalPatterns: ["vscode", "Visual Studio Code"],
	},
	jetbrains: {
		envVars: ["IDEA_INITIAL_DIRECTORY", "JETBRAINS"],
		terminalPatterns: ["idea", "jetbrains", "intellij"],
	},
	vim: {
		envVars: ["VIM", "VIMRUNTIME"],
		terminalPatterns: ["vim"],
	},
	neovim: {
		envVars: ["NVIM", "NVIM_LISTEN_ADDRESS"],
		terminalPatterns: ["nvim", "neovim"],
	},
	emacs: {
		envVars: ["EMACS", "INSIDE_EMACS"],
		terminalPatterns: ["emacs"],
	},
	sublime: {
		envVars: ["SUBlime_TEXT"],
		terminalPatterns: ["sublime"],
	},
	atom: {
		envVars: ["ATOM_HOME"],
		terminalPatterns: ["atom"],
	},
	cursor: {
		envVars: ["CURSOR_TRACE", "CURSOR"],
		terminalPatterns: ["cursor"],
	},
};

let managerInstance: IDEIntegrationManager | null = null;

export class IDEIntegrationManager {
	private config: IDEIntegrationConfig;
	private context: IDEContext;
	private suggestions: InlineSuggestion[] = [];
	private notifications: IDENotification[] = [];
	private stats: IDEIntegrationStats;
	private dataPath: string;

	constructor(config?: Partial<IDEIntegrationConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.dataPath = path.join(process.env.HOME || ".", ".paimon", "ide-integration.json");
		this.context = {
			detectedIDE: null,
			isIDESession: false,
			openFiles: [],
			activeFile: null,
			cursorPosition: null,
			projectRoot: null,
			terminalType: process.env.TERM_PROGRAM || process.env.TERM || null,
			editorVersion: null,
			lastDetectedAt: new Date().toISOString(),
		};
		this.stats = {
			totalSessions: 0,
			ideSessions: 0,
			byIDE: {},
			suggestionsGenerated: 0,
			suggestionsApplied: 0,
			notificationsSent: 0,
			notificationsDismissed: 0,
			lastIDESession: null,
		};
		this.loadData();
		if (this.config.autoDetectIDE) {
			this.detectIDE();
		}
	}

	private loadData(): void {
		try {
			if (fs.existsSync(this.dataPath)) {
				const data = JSON.parse(fs.readFileSync(this.dataPath, "utf-8"));
				this.stats = data.stats || this.stats;
				this.notifications = data.notifications || [];
				this.suggestions = data.suggestions || [];
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
						stats: this.stats,
						notifications: this.notifications.slice(-50), // Keep last 50
						suggestions: this.suggestions.slice(-100), // Keep last 100
						context: this.context,
						config: this.config,
					},
					null,
					2,
				),
			);
		} catch (error) {
			console.error("Failed to save IDE integration data:", error);
		}
	}

	// IDE Detection
	public detectIDE(): DetectedIDE | null {
		const env = process.env;
		const terminal = env.TERM_PROGRAM || env.TERM || "";

		// Check environment variables for each IDE
		for (const [ide, signatures] of Object.entries(IDE_SIGNATURES)) {
			for (const pattern of signatures.envVars) {
				// Check if env var exists or matches pattern
				if (pattern.includes("=")) {
					const [key, value] = pattern.split("=");
					if (env[key] === value) {
						this.updateDetectedIDE(ide as DetectedIDE);
						return ide as DetectedIDE;
					}
				} else {
					if (env[pattern]) {
						this.updateDetectedIDE(ide as DetectedIDE);
						return ide as DetectedIDE;
					}
				}
			}
		}

		// Check terminal type patterns
		const lowerTerminal = terminal.toLowerCase();
		for (const [ide, signatures] of Object.entries(IDE_SIGNATURES)) {
			for (const pattern of signatures.terminalPatterns) {
				if (lowerTerminal.includes(pattern.toLowerCase())) {
					this.updateDetectedIDE(ide as DetectedIDE);
					return ide as DetectedIDE;
				}
			}
		}

		// No IDE detected
		this.context.detectedIDE = null;
		this.context.isIDESession = false;
		this.context.lastDetectedAt = new Date().toISOString();
		return null;
	}

	private updateDetectedIDE(ide: DetectedIDE): void {
		this.context.detectedIDE = ide;
		this.context.isIDESession = true;
		this.context.lastDetectedAt = new Date().toISOString();
		this.stats.totalSessions++;
		this.stats.ideSessions++;
		this.stats.byIDE[ide] = (this.stats.byIDE[ide] || 0) + 1;
		this.stats.lastIDESession = new Date().toISOString();
		this.saveData();
	}

	public getIDEContext(): IDEContext {
		return { ...this.context };
	}

	public isIDESession(): boolean {
		return this.context.isIDESession;
	}

	public getDetectedIDE(): DetectedIDE | null {
		return this.context.detectedIDE;
	}

	// Open Files Management
	public setOpenFiles(files: string[]): void {
		this.context.openFiles = files.slice(0, this.config.maxOpenFiles);
		this.saveData();
	}

	public setActiveFile(filePath: string, cursorPosition?: { line: number; column: number }): void {
		this.context.activeFile = filePath;
		this.context.cursorPosition = cursorPosition || null;
		this.saveData();
	}

	public getOpenFiles(): string[] {
		return [...this.context.openFiles];
	}

	public getActiveFile(): string | null {
		return this.context.activeFile;
	}

	// Inline Suggestion Generation
	public generateInlineSuggestion(
		type: InlineSuggestion["type"],
		content: string,
		source: InlineSuggestion["source"],
		reason: string,
		options?: {
			filePath?: string;
			lineRange?: { start: number; end: number };
			priority?: InlineSuggestion["priority"];
		},
	): InlineSuggestion {
		const suggestion: InlineSuggestion = {
			id: `suggestion-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
			type,
			content,
			filePath: options?.filePath || this.context.activeFile || null,
			lineRange: options?.lineRange || null,
			priority: options?.priority || this.config.suggestionPriority,
			source,
			reason,
			timestamp: new Date().toISOString(),
		};

		this.suggestions.push(suggestion);
		this.stats.suggestionsGenerated++;
		this.saveData();
		return suggestion;
	}

	public generateEvolutionContextSuggestion(
		taskType: string,
		taskDescription: string,
		files: string[],
	): InlineSuggestion {
		const content = this.formatEvolutionContextForIDE(taskType, taskDescription, files);
		return this.generateInlineSuggestion(
			"action",
			content,
			"evolution-context",
			"Current evolution task context for inline assistance",
			{ priority: "high" },
		);
	}

	private formatEvolutionContextForIDE(
		taskType: string,
		taskDescription: string,
		files: string[],
	): string {
		const lines: string[] = [
			`// Evolution Context: ${taskType}`,
			`// Task: ${taskDescription}`,
			`// Files: ${files.slice(0, 5).join(", ")}${files.length > 5 ? ` (+${files.length - 5} more)` : ""}`,
			`// IDE: ${this.context.detectedIDE || "terminal"}`,
			"// Ready for inline suggestions based on evolution context",
		];
		return lines.join("\n");
	}

	public generateErrorPatternSuggestion(
		errorPattern: string,
		solution: string,
		filePath?: string,
	): InlineSuggestion {
		const content = `// Error Pattern Detected: ${errorPattern}\n// Suggested Fix: ${solution}`;
		return this.generateInlineSuggestion(
			"warning",
			content,
			"error-pattern",
			"Proactive error pattern warning from learned patterns",
			{ filePath, priority: "high" },
		);
	}

	public generateCompetitorPatternSuggestion(
		patternName: string,
		description: string,
	): InlineSuggestion {
		const content = `// Competitor Pattern: ${patternName}\n// ${description}`;
		return this.generateInlineSuggestion(
			"explanation",
			content,
			"competitor-pattern",
			"Competitor pattern suggestion for evolution improvement",
			{ priority: "medium" },
		);
	}

	public getRecentSuggestions(limit?: number): InlineSuggestion[] {
		return this.suggestions.slice(-(limit || 20));
	}

	public getSuggestion(suggestionId: string): InlineSuggestion | undefined {
		return this.suggestions.find((s) => s.id === suggestionId);
	}

	public applySuggestion(suggestionId: string): boolean {
		const suggestion = this.getSuggestion(suggestionId);
		if (suggestion) {
			this.stats.suggestionsApplied++;
			this.saveData();
			return true;
		}
		return false;
	}

	public clearSuggestions(): void {
		this.suggestions = [];
		this.saveData();
	}

	// Notification System
	public sendNotification(
		level: IDENotification["level"],
		title: string,
		message: string,
		details?: Record<string, unknown>,
	): IDENotification {
		const notification: IDENotification = {
			id: `notification-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
			level,
			title,
			message,
			details,
			timestamp: new Date().toISOString(),
			dismissed: false,
		};

		this.notifications.push(notification);
		this.stats.notificationsSent++;
		this.saveData();
		return notification;
	}

	public notifyEvolutionEvent(eventType: string, description: string): IDENotification {
		if (!this.config.notifyOnEvolutionEvents) {
			return {
				id: "disabled",
				level: "info",
				title: "Disabled",
				message: "Evolution event notifications disabled",
				timestamp: new Date().toISOString(),
				dismissed: true,
			};
		}

		const level =
			eventType.includes("error") || eventType.includes("fail")
				? "error"
				: eventType.includes("warn")
					? "warning"
					: "success";

		return this.sendNotification(level, `Evolution: ${eventType}`, description, {
			ide: this.context.detectedIDE,
			activeFile: this.context.activeFile,
		});
	}

	public getRecentNotifications(limit?: number): IDENotification[] {
		return this.notifications.slice(-(limit || 20));
	}

	public dismissNotification(notificationId: string): boolean {
		const notification = this.notifications.find((n) => n.id === notificationId);
		if (notification) {
			notification.dismissed = true;
			this.stats.notificationsDismissed++;
			this.saveData();
			return true;
		}
		return false;
	}

	public getPendingNotifications(): IDENotification[] {
		return this.notifications.filter((n) => !n.dismissed);
	}

	public clearNotifications(): void {
		this.notifications = [];
		this.saveData();
	}

	// SessionStart Hook Integration
	public getSessionStartContext(): string {
		if (!this.config.injectContextAtStart) {
			return "";
		}

		const ide = this.detectIDE();
		if (!ide) {
			return "";
		}

		const lines: string[] = [
			"## IDE Integration Context",
			"",
			`**Detected IDE:** ${ide}`,
			`**Terminal:** ${this.context.terminalType || "unknown"}`,
			"**Session Type:** IDE-integrated",
			"",
			"### IDE Integration Features Available:",
			"- Inline suggestions based on evolution context",
			"- Error pattern warnings in active files",
			"- Competitor pattern suggestions",
			"- Evolution event notifications",
			"",
			"### Usage:",
			"- Use `ideIntegration({action: 'suggest', ...})` to generate inline suggestions",
			"- Use `ideIntegration({action: 'notify', ...})` to send IDE notifications",
			"- IDE context is automatically injected at session start",
			"",
		];

		return lines.join("\n");
	}

	// Configuration
	public getConfig(): IDEIntegrationConfig {
		return { ...this.config };
	}

	public updateConfig(updates: Partial<IDEIntegrationConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveData();
	}

	public setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveData();
	}

	public isEnabled(): boolean {
		return this.config.enabled;
	}

	// Statistics
	public getStats(): IDEIntegrationStats {
		return { ...this.stats };
	}

	public resetStats(): void {
		this.stats = {
			totalSessions: 0,
			ideSessions: 0,
			byIDE: {},
			suggestionsGenerated: 0,
			suggestionsApplied: 0,
			notificationsSent: 0,
			notificationsDismissed: 0,
			lastIDESession: null,
		};
		this.saveData();
	}

	// Formatting
	public formatIDEContext(): string {
		const lines: string[] = [
			"## IDE Context",
			"",
			`**Detected IDE:** ${this.context.detectedIDE || "Not detected"}`,
			`**Is IDE Session:** ${this.context.isIDESession ? "Yes" : "No"}`,
			`**Terminal Type:** ${this.context.terminalType || "unknown"}`,
			`**Active File:** ${this.context.activeFile || "none"}`,
			`**Open Files:** ${this.context.openFiles.length} files`,
			`**Last Detected:** ${this.context.lastDetectedAt}`,
		];

		if (this.context.openFiles.length > 0) {
			lines.push("", "### Open Files:", "");
			for (const file of this.context.openFiles.slice(0, 10)) {
				lines.push(`- ${file}`);
			}
			if (this.context.openFiles.length > 10) {
				lines.push(`- ... and ${this.context.openFiles.length - 10} more`);
			}
		}

		return lines.join("\n");
	}

	public formatStats(): string {
		const lines: string[] = [
			"## IDE Integration Statistics",
			"",
			`Total Sessions: ${this.stats.totalSessions}`,
			`IDE Sessions: ${this.stats.ideSessions}`,
			`IDE Session Rate: ${this.stats.totalSessions > 0 ? ((this.stats.ideSessions / this.stats.totalSessions) * 100).toFixed(1) : 0}%`,
			"",
			"### By IDE:",
			"",
		];

		for (const [ide, count] of Object.entries(this.stats.byIDE)) {
			lines.push(`- ${ide}: ${count} sessions`);
		}

		lines.push("", "### Suggestions:", "");
		lines.push(`- Generated: ${this.stats.suggestionsGenerated}`);
		lines.push(`- Applied: ${this.stats.suggestionsApplied}`);
		lines.push(
			`- Apply Rate: ${this.stats.suggestionsGenerated > 0 ? ((this.stats.suggestionsApplied / this.stats.suggestionsGenerated) * 100).toFixed(1) : 0}%`,
		);

		lines.push("", "### Notifications:", "");
		lines.push(`- Sent: ${this.stats.notificationsSent}`);
		lines.push(`- Dismissed: ${this.stats.notificationsDismissed}`);

		return lines.join("\n");
	}

	public formatSuggestions(limit?: number): string {
		const suggestions = this.getRecentSuggestions(limit || 10);
		if (suggestions.length === 0) {
			return "No recent suggestions.";
		}

		const lines: string[] = [
			"## Recent Inline Suggestions",
			"",
			"| ID | Type | Source | Priority | File |",
			"|----|------|--------|----------|------|",
		];

		for (const s of suggestions) {
			lines.push(
				`| ${s.id.slice(0, 20)}... | ${s.type} | ${s.source} | ${s.priority} | ${s.filePath?.slice(0, 30) || "none"} |`,
			);
		}

		return lines.join("\n");
	}

	public formatNotifications(limit?: number): string {
		const notifications = this.getRecentNotifications(limit || 10);
		if (notifications.length === 0) {
			return "No recent notifications.";
		}

		const lines: string[] = [
			"## Recent IDE Notifications",
			"",
			"| Level | Title | Message | Dismissed |",
			"|-------|-------|---------|-----------|",
		];

		for (const n of notifications) {
			lines.push(
				`| ${n.level} | ${n.title.slice(0, 30)} | ${n.message.slice(0, 40)}... | ${n.dismissed ? "Yes" : "No"} |`,
			);
		}

		return lines.join("\n");
	}
}

export function getIDEIntegrationManager(): IDEIntegrationManager {
	if (!managerInstance) {
		managerInstance = new IDEIntegrationManager();
	}
	return managerInstance;
}

export function initIDEIntegrationManager(
	config?: Partial<IDEIntegrationConfig>,
): IDEIntegrationManager {
	managerInstance = new IDEIntegrationManager(config);
	return managerInstance;
}
