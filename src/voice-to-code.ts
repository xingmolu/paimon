/**
 * Voice-to-Code Module (Aider Pattern)
 *
 * Enables hands-free coding via voice commands.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export interface VoiceCommand {
	id: string;
	transcript: string;
	timestamp: string;
	parsedAction?: ParsedAction;
	executed: boolean;
	result?: string;
}

export interface ParsedAction {
	tool: string;
	action?: string;
	params: Record<string, unknown>;
	confidence: number;
}

export interface VoiceSession {
	id: string;
	startedAt: string;
	endedAt?: string;
	commands: VoiceCommand[];
	status: "active" | "paused" | "ended";
}

export interface VoiceToCodeConfig {
	enabled: boolean;
	language: string;
	continuous: boolean;
	autoExecute: boolean;
	confidenceThreshold: number;
	whisperModel: string;
	whisperApiKey?: string;
	wakeWord?: string;
	commands: VoiceCommandMapping[];
}

export interface VoiceCommandMapping {
	pattern: RegExp | string;
	tool: string;
	action?: string;
	paramGroups: string[];
	description: string;
}

export interface VoiceToCodeStats {
	totalSessions: number;
	totalCommands: number;
	successfulCommands: number;
	failedCommands: number;
	averageConfidence: number;
	commandsByTool: Record<string, number>;
	lastSessionTime: string;
}

const DEFAULT_COMMANDS: VoiceCommandMapping[] = [
	{
		pattern: /create (?:a )?(?:new )?file (?:called )?(.+)/i,
		tool: "write",
		paramGroups: ["path"],
		description: "Create a new file",
	},
	{
		pattern: /read (?:the )?file (.+)/i,
		tool: "read",
		paramGroups: ["path"],
		description: "Read a file",
	},
	{
		pattern: /edit (.+) (?:to|and) (?:change|replace) (.+) (?:with|to) (.+)/i,
		tool: "edit",
		paramGroups: ["path", "oldText", "newText"],
		description: "Edit a file",
	},
	{
		pattern: /run (.+)/i,
		tool: "bash",
		paramGroups: ["command"],
		description: "Run a shell command",
	},
	{
		pattern: /(?:search|find) for (.+) in (.+)/i,
		tool: "grep",
		paramGroups: ["pattern", "path"],
		description: "Search for pattern in files",
	},
	{
		pattern: /(?:list|show) files (?:in )?(.+)/i,
		tool: "glob",
		paramGroups: ["pattern"],
		description: "List files matching pattern",
	},
	{
		pattern: /commit (?:changes )?(?:with message )?(.+)/i,
		tool: "bash",
		paramGroups: ["message"],
		description: "Commit changes with message",
	},
	{
		pattern: /run tests/i,
		tool: "bash",
		paramGroups: [],
		description: "Run tests",
	},
	{
		pattern: /build (?:the )?project/i,
		tool: "bash",
		paramGroups: [],
		description: "Build the project",
	},
	{
		pattern: /start (?:a )?plan (?:for )?(.+)/i,
		tool: "plan",
		paramGroups: ["steps"],
		description: "Start a new plan",
	},
	{
		pattern: /assess (?:changes|quality)/i,
		tool: "assess",
		paramGroups: [],
		description: "Run self-assessment",
	},
	{
		pattern: /create (?:a )?checkpoint/i,
		tool: "checkpoint",
		paramGroups: [],
		description: "Create a checkpoint",
	},
];

const DEFAULT_CONFIG: VoiceToCodeConfig = {
	enabled: true,
	language: "en-US",
	continuous: false,
	autoExecute: false,
	confidenceThreshold: 0.7,
	whisperModel: "whisper-1",
	commands: DEFAULT_COMMANDS,
};

let voiceInstance: VoiceToCodeManager | null = null;

export class VoiceToCodeManager {
	private config: VoiceToCodeConfig;
	private currentSession: VoiceSession | null = null;
	private sessions: VoiceSession[] = [];
	private commandHistory: VoiceCommand[] = [];
	private stats: VoiceToCodeStats;
	private dataPath: string;

	constructor() {
		this.config = { ...DEFAULT_CONFIG };
		const homeDir = process.env.HOME || ".";
		this.dataPath = path.join(homeDir, ".paimon", "voice-to-code.json");
		this.stats = {
			totalSessions: 0,
			totalCommands: 0,
			successfulCommands: 0,
			failedCommands: 0,
			averageConfidence: 0,
			commandsByTool: {},
			lastSessionTime: "",
		};
		this.loadConfig();
		this.loadData();
	}

	private loadConfig(): void {
		try {
			const homeDir = process.env.HOME || ".";
			const configPath = path.join(homeDir, ".paimon", "voice-config.json");
			if (fs.existsSync(configPath)) {
				const loaded = JSON.parse(fs.readFileSync(configPath, "utf-8"));
				this.config = { ...DEFAULT_CONFIG, ...loaded };
				this.config.commands = this.config.commands.map((cmd) => ({
					...cmd,
					pattern: typeof cmd.pattern === "string" ? new RegExp(cmd.pattern, "i") : cmd.pattern,
				}));
			}
		} catch {
			// Use defaults
		}
	}

	private loadData(): void {
		try {
			if (fs.existsSync(this.dataPath)) {
				const data = JSON.parse(fs.readFileSync(this.dataPath, "utf-8"));
				this.sessions = data.sessions || [];
				this.commandHistory = data.commandHistory || [];
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
			const configForSave = {
				...this.config,
				commands: this.config.commands.map((cmd) => ({
					...cmd,
					pattern: cmd.pattern instanceof RegExp ? cmd.pattern.source : cmd.pattern,
				})),
			};
			fs.writeFileSync(
				this.dataPath,
				JSON.stringify(
					{
						sessions: this.sessions,
						commandHistory: this.commandHistory.slice(-100),
						stats: this.stats,
						config: configForSave,
					},
					null,
					2,
				),
			);
		} catch (error) {
			console.error("Failed to save voice-to-code data:", error);
		}
	}

	private updateStats(command: VoiceCommand, success: boolean): void {
		this.stats.totalCommands++;
		if (success) {
			this.stats.successfulCommands++;
		} else {
			this.stats.failedCommands++;
		}

		if (command.parsedAction) {
			this.stats.commandsByTool[command.parsedAction.tool] =
				(this.stats.commandsByTool[command.parsedAction.tool] || 0) + 1;
		}

		const totalConfidence =
			this.stats.averageConfidence * (this.stats.totalCommands - 1) +
			(command.parsedAction?.confidence || 0);
		this.stats.averageConfidence = totalConfidence / this.stats.totalCommands;
	}

	public isEnabled(): boolean {
		return this.config.enabled;
	}

	public setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveData();
	}

	public getConfig(): VoiceToCodeConfig {
		return { ...this.config };
	}

	public updateConfig(updates: Partial<VoiceToCodeConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveData();
	}

	public startSession(): VoiceSession {
		const sessionId = `session-${Date.now()}`;
		const session: VoiceSession = {
			id: sessionId,
			startedAt: new Date().toISOString(),
			commands: [],
			status: "active",
		};
		this.currentSession = session;
		this.sessions.push(session);
		this.stats.totalSessions++;
		this.stats.lastSessionTime = session.startedAt;
		this.saveData();
		return session;
	}

	public endSession(): VoiceSession | null {
		if (!this.currentSession) {
			return null;
		}
		this.currentSession.status = "ended";
		this.currentSession.endedAt = new Date().toISOString();
		const session = this.currentSession;
		this.currentSession = null;
		this.saveData();
		return session;
	}

	public pauseSession(): VoiceSession | null {
		if (!this.currentSession) {
			return null;
		}
		this.currentSession.status = "paused";
		this.saveData();
		return this.currentSession;
	}

	public resumeSession(): VoiceSession | null {
		if (!this.currentSession || this.currentSession.status !== "paused") {
			return null;
		}
		this.currentSession.status = "active";
		this.saveData();
		return this.currentSession;
	}

	public getCurrentSession(): VoiceSession | null {
		return this.currentSession;
	}

	public parseTranscript(transcript: string): ParsedAction | null {
		const trimmed = transcript.trim();
		let bestMatch: ParsedAction | null = null;
		let bestConfidence = 0;

		for (const mapping of this.config.commands) {
			const pattern =
				mapping.pattern instanceof RegExp ? mapping.pattern : new RegExp(mapping.pattern, "i");
			const match = trimmed.match(pattern);

			if (match) {
				const matchLength = match[0].length;
				const confidence = Math.min(1, matchLength / trimmed.length);

				const params: Record<string, unknown> = {};
				for (let i = 0; i < mapping.paramGroups.length && i + 1 < match.length; i++) {
					params[mapping.paramGroups[i]] = match[i + 1] || "";
				}

				if (mapping.tool === "bash" && mapping.paramGroups.includes("message")) {
					const msg = match[1] || "";
					params.command = `git commit -m "${msg}"`;
				}

				if (mapping.tool === "plan" && mapping.paramGroups.includes("steps")) {
					params.action = "create";
					params.steps = [match[1] || ""];
				}

				if (mapping.tool === "bash" && mapping.paramGroups.length === 0) {
					if (transcript.toLowerCase().includes("tests")) {
						params.command = "npm test";
					} else if (transcript.toLowerCase().includes("build")) {
						params.command = "npm run build";
					}
				}

				if (mapping.tool === "checkpoint") {
					params.action = "create";
				}

				if (confidence > bestConfidence) {
					bestConfidence = confidence;
					bestMatch = {
						tool: mapping.tool,
						action: mapping.action,
						params,
						confidence,
					};
				}
			}
		}

		return bestMatch;
	}

	public processTranscript(transcript: string): VoiceCommand {
		const cmdId = `cmd-${Date.now()}`;
		const parsed = this.parseTranscript(transcript);
		const command: VoiceCommand = {
			id: cmdId,
			transcript,
			timestamp: new Date().toISOString(),
			executed: false,
			parsedAction: parsed ?? undefined,
		};

		this.commandHistory.push(command);
		if (this.currentSession) {
			this.currentSession.commands.push(command);
		}

		this.saveData();
		return command;
	}

	public markExecuted(commandId: string, result: string): boolean {
		const command = this.commandHistory.find((c) => c.id === commandId);
		if (command) {
			command.executed = true;
			command.result = result;
			this.updateStats(command, true);
			this.saveData();
			return true;
		}
		return false;
	}

	public markFailed(commandId: string, error: string): boolean {
		const command = this.commandHistory.find((c) => c.id === commandId);
		if (command) {
			command.result = error;
			this.updateStats(command, false);
			this.saveData();
			return true;
		}
		return false;
	}

	public async transcribeAudio(audioPath: string): Promise<{ text: string; confidence: number }> {
		if (!this.config.whisperApiKey) {
			return this.transcribeLocally(audioPath);
		}

		try {
			const formData = new FormData();
			formData.append("file", fs.createReadStream(audioPath));
			formData.append("model", this.config.whisperModel);

			const apiKey = this.config.whisperApiKey;
			const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
				},
				body: formData as unknown as string,
			});

			const data = (await response.json()) as { text?: string };
			return {
				text: data.text || "",
				confidence: 0.9,
			};
		} catch (error) {
			console.error("Whisper transcription failed:", error);
			return {
				text: "",
				confidence: 0,
			};
		}
	}

	private async transcribeLocally(
		audioPath: string,
	): Promise<{ text: string; confidence: number }> {
		try {
			const result = await new Promise<string>((resolve, reject) => {
				const proc = spawn("whisper", [audioPath, "--output-format", "txt"], {
					stdio: ["ignore", "pipe", "pipe"],
				});
				let output = "";
				proc.stdout?.on("data", (data) => {
					output += data.toString();
				});
				proc.on("close", (code) => {
					if (code === 0) {
						resolve(output);
					} else {
						const errMsg = `whisper exited with code ${code}`;
						reject(new Error(errMsg));
					}
				});
			});
			return { text: result.trim(), confidence: 0.8 };
		} catch {
			return {
				text: "[Transcription not available - install whisper or configure Whisper API]",
				confidence: 0,
			};
		}
	}

	public getHistory(limit = 20): VoiceCommand[] {
		return this.commandHistory.slice(-limit);
	}

	public getSessions(limit = 10): VoiceSession[] {
		return this.sessions.slice(-limit);
	}

	public getSession(sessionId: string): VoiceSession | undefined {
		return this.sessions.find((s) => s.id === sessionId);
	}

	public getStats(): VoiceToCodeStats {
		return { ...this.stats };
	}

	public addCommandMapping(mapping: VoiceCommandMapping): void {
		this.config.commands.push(mapping);
		this.saveData();
	}

	public removeCommandMapping(patternStr: string): boolean {
		const index = this.config.commands.findIndex(
			(c) => (c.pattern instanceof RegExp ? c.pattern.source : c.pattern) === patternStr,
		);
		if (index !== -1) {
			this.config.commands.splice(index, 1);
			this.saveData();
			return true;
		}
		return false;
	}

	public getCommandMappings(): VoiceCommandMapping[] {
		return [...this.config.commands];
	}

	public clearHistory(): void {
		this.commandHistory = [];
		this.saveData();
	}

	public resetStats(): void {
		this.stats = {
			totalSessions: 0,
			totalCommands: 0,
			successfulCommands: 0,
			failedCommands: 0,
			averageConfidence: 0,
			commandsByTool: {},
			lastSessionTime: "",
		};
		this.saveData();
	}

	public getHelp(): string {
		const commands = this.config.commands.map((c) => `- "${c.description}"`).join("\n");
		const lang = this.config.language;
		const autoExec = this.config.autoExecute ? "enabled" : "disabled";
		const threshold = this.config.confidenceThreshold;
		return [
			"## Voice-to-Code Help",
			"",
			"Voice-to-Code allows you to speak coding commands instead of typing them.",
			"",
			"### Available Commands:",
			commands,
			"",
			"### Example Phrases:",
			'- "Create a new file called app.ts"',
			'- "Read the file src/index.ts"',
			'- "Run npm test"',
			'- "Build the project"',
			'- "Commit changes with message fix bug"',
			'- "Start a plan for adding authentication"',
			"",
			"### Configuration:",
			`- Language: ${lang}`,
			`- Auto-execute: ${autoExec}`,
			`- Confidence threshold: ${threshold}`,
		].join("\n");
	}
}

export function getVoiceToCodeManager(): VoiceToCodeManager {
	if (!voiceInstance) {
		voiceInstance = new VoiceToCodeManager();
	}
	return voiceInstance;
}

export default VoiceToCodeManager;
