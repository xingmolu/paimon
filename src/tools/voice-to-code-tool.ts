/**
 * Voice-to-Code Tool (Aider Pattern)
 *
 * Tool for hands-free coding via voice commands.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { VoiceCommandMapping } from "../voice-to-code.js";
import { getVoiceToCodeManager } from "../voice-to-code.js";

/**
 * Tool for voice-to-code capability (Aider voice-to-code pattern).
 *
 * Actions:
 * - start: Start a new voice session
 * - stop: End the current voice session
 * - pause: Pause the current voice session
 * - resume: Resume a paused voice session
 * - status: Get current voice session status
 * - transcribe: Transcribe an audio file to text
 * - parse: Parse a voice transcript into tool action
 * - execute: Parse and prepare for execution
 * - history: View voice command history
 * - sessions: List all voice sessions
 * - session: Get specific session details
 * - commands: List available voice commands
 * - add-command: Add a custom voice command
 * - remove-command: Remove a voice command
 * - config: View or update configuration
 * - stats: View usage statistics
 * - clear: Clear command history
 * - reset: Reset statistics
 * - help: Show help message
 */
export const voiceToCodeToolDefinition: AgentTool = {
	name: "voiceToCode",
	label: "Voice-to-Code",
	description:
		"Manage voice-to-code sessions for hands-free coding via voice commands. Start/stop sessions, transcribe audio, parse voice commands, view history and statistics.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action: start, stop, pause, resume, status, transcribe, parse, execute, history, sessions, session, commands, add-command, remove-command, config, stats, clear, reset, help",
		}),
		transcript: Type.Optional(
			Type.String({
				description: "Voice transcript text to parse (for parse/execute actions)",
			}),
		),
		audioPath: Type.Optional(
			Type.String({
				description: "Path to audio file for transcription (for transcribe action)",
			}),
		),
		sessionId: Type.Optional(
			Type.String({
				description: "Session ID for session-specific actions",
			}),
		),
		commandMapping: Type.Optional(
			Type.Object({
				pattern: Type.String(),
				tool: Type.String(),
				action: Type.Optional(Type.String()),
				paramGroups: Type.Array(Type.String()),
				description: Type.String(),
			}),
		),
		patternStr: Type.Optional(
			Type.String({
				description: "Pattern string to remove (for remove-command action)",
			}),
		),
		config: Type.Optional(
			Type.Object({
				enabled: Type.Optional(Type.Boolean()),
				language: Type.Optional(Type.String()),
				continuous: Type.Optional(Type.Boolean()),
				autoExecute: Type.Optional(Type.Boolean()),
				confidenceThreshold: Type.Optional(Type.Number()),
				whisperModel: Type.Optional(Type.String()),
				whisperApiKey: Type.Optional(Type.String()),
			}),
		),
		limit: Type.Optional(
			Type.Number({
				description: "Limit for history/sessions actions (default: 20)",
			}),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const p = params as {
			action: string;
			transcript?: string;
			audioPath?: string;
			sessionId?: string;
			commandMapping?: VoiceCommandMapping;
			patternStr?: string;
			config?: Record<string, unknown>;
			limit?: number;
		};

		const manager = getVoiceToCodeManager();

		switch (p.action) {
			case "start": {
				const session = manager.startSession();
				return {
					content: [
						{
							type: "text",
							text: `Voice session started: ${session.id}\nStatus: ${session.status}\nStarted at: ${session.startedAt}`,
						},
					],
					details: { sessionId: session.id },
				};
			}

			case "stop": {
				const session = manager.endSession();
				if (!session) {
					return {
						content: [{ type: "text", text: "No active voice session to stop." }],
						details: {},
					};
				}
				const duration = session.endedAt
					? Math.round(
							(new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000,
						)
					: 0;
				return {
					content: [
						{
							type: "text",
							text: `Voice session ended: ${session.id}\nDuration: ${duration}s\nCommands: ${session.commands.length}`,
						},
					],
					details: { sessionId: session.id, duration, commandCount: session.commands.length },
				};
			}

			case "pause": {
				const session = manager.pauseSession();
				if (!session) {
					return {
						content: [{ type: "text", text: "No active voice session to pause." }],
						details: {},
					};
				}
				return {
					content: [{ type: "text", text: `Voice session paused: ${session.id}` }],
					details: { sessionId: session.id },
				};
			}

			case "resume": {
				const session = manager.resumeSession();
				if (!session) {
					return {
						content: [{ type: "text", text: "No paused voice session to resume." }],
						details: {},
					};
				}
				return {
					content: [{ type: "text", text: `Voice session resumed: ${session.id}` }],
					details: { sessionId: session.id },
				};
			}

			case "status": {
				const session = manager.getCurrentSession();
				if (!session) {
					return {
						content: [{ type: "text", text: "No active voice session." }],
						details: {},
					};
				}
				return {
					content: [
						{
							type: "text",
							text: [
								`Session: ${session.id}`,
								`Status: ${session.status}`,
								`Started: ${session.startedAt}`,
								`Commands: ${session.commands.length}`,
							].join("\n"),
						},
					],
					details: { sessionId: session.id, status: session.status },
				};
			}

			case "transcribe": {
				if (!p.audioPath) {
					return {
						content: [{ type: "text", text: "Error: audioPath required for transcribe action." }],
						details: {},
					};
				}
				const result = await manager.transcribeAudio(p.audioPath);
				return {
					content: [
						{
							type: "text",
							text: [
								`Transcription: ${result.text}`,
								`Confidence: ${(result.confidence * 100).toFixed(1)}%`,
							].join("\n"),
						},
					],
					details: { text: result.text, confidence: result.confidence },
				};
			}

			case "parse": {
				if (!p.transcript) {
					return {
						content: [{ type: "text", text: "Error: transcript required for parse action." }],
						details: {},
					};
				}
				const command = manager.processTranscript(p.transcript);
				if (!command.parsedAction) {
					return {
						content: [
							{
								type: "text",
								text: [
									`Transcript: "${command.transcript}"`,
									"No matching command found.",
									"Use 'voiceToCode({action: \"commands\"})' to see available commands.",
								].join("\n"),
							},
						],
						details: { transcript: command.transcript, matched: false },
					};
				}
				return {
					content: [
						{
							type: "text",
							text: [
								`Transcript: "${command.transcript}"`,
								`Parsed Tool: ${command.parsedAction.tool}`,
								`Params: ${JSON.stringify(command.parsedAction.params, null, 2)}`,
								`Confidence: ${(command.parsedAction.confidence * 100).toFixed(1)}%`,
								`Command ID: ${command.id}`,
							].join("\n"),
						},
					],
					details: {
						commandId: command.id,
						tool: command.parsedAction.tool,
						params: command.parsedAction.params,
					},
				};
			}

			case "execute": {
				if (!p.transcript) {
					return {
						content: [{ type: "text", text: "Error: transcript required for execute action." }],
						details: {},
					};
				}
				const command = manager.processTranscript(p.transcript);
				if (!command.parsedAction) {
					return {
						content: [
							{
								type: "text",
								text: [
									`Transcript: "${command.transcript}"`,
									"No matching command found. Cannot execute.",
								].join("\n"),
							},
						],
						details: { transcript: command.transcript, matched: false },
					};
				}
				return {
					content: [
						{
							type: "text",
							text: [
								"Voice Command Parsed:",
								`Tool: ${command.parsedAction.tool}`,
								`Params: ${JSON.stringify(command.parsedAction.params, null, 2)}`,
								"",
								`To execute, run: ${command.parsedAction.tool}(${JSON.stringify(command.parsedAction.params)})`,
								`Command ID: ${command.id}`,
							].join("\n"),
						},
					],
					details: {
						commandId: command.id,
						tool: command.parsedAction.tool,
						params: command.parsedAction.params,
					},
				};
			}

			case "history": {
				const limit = p.limit || 20;
				const history = manager.getHistory(limit);
				if (history.length === 0) {
					return {
						content: [{ type: "text", text: "No voice command history." }],
						details: {},
					};
				}
				const lines = history.map((cmd) => {
					const status = cmd.executed ? "✓" : "○";
					const tool = cmd.parsedAction?.tool || "unknown";
					return `[${status}] ${cmd.transcript} (${tool})`;
				});
				return {
					content: [
						{
							type: "text",
							text: [`Voice Command History (${history.length}):`, ...lines].join("\n"),
						},
					],
					details: { count: history.length },
				};
			}

			case "sessions": {
				const limit = p.limit || 10;
				const sessions = manager.getSessions(limit);
				if (sessions.length === 0) {
					return {
						content: [{ type: "text", text: "No voice sessions recorded." }],
						details: {},
					};
				}
				const lines = sessions.map((s) => {
					const status = s.status === "active" ? "🟢" : s.status === "paused" ? "🟡" : "⚫";
					return `${status} ${s.id}: ${s.commands.length} commands (${s.status})`;
				});
				return {
					content: [
						{
							type: "text",
							text: [`Voice Sessions (${sessions.length}):`, ...lines].join("\n"),
						},
					],
					details: { count: sessions.length },
				};
			}

			case "session": {
				if (!p.sessionId) {
					return {
						content: [{ type: "text", text: "Error: sessionId required for session action." }],
						details: {},
					};
				}
				const session = manager.getSession(p.sessionId);
				if (!session) {
					return {
						content: [{ type: "text", text: `Session not found: ${p.sessionId}` }],
						details: {},
					};
				}
				const commands = session.commands
					.map((c) => `  - [${c.executed ? "✓" : "○"}] ${c.transcript}`)
					.join("\n");
				return {
					content: [
						{
							type: "text",
							text: [
								`Session: ${session.id}`,
								`Status: ${session.status}`,
								`Started: ${session.startedAt}`,
								`Ended: ${session.endedAt || "active"}`,
								"Commands:",
								commands || "  (none)",
							].join("\n"),
						},
					],
					details: { sessionId: session.id, status: session.status },
				};
			}

			case "commands": {
				const commands = manager.getCommandMappings();
				const lines = commands.map(
					(c) => `- "${c.description}" -> ${c.tool}(${c.paramGroups.join(", ")})`,
				);
				return {
					content: [
						{
							type: "text",
							text: [`Voice Commands (${commands.length}):`, ...lines].join("\n"),
						},
					],
					details: { count: commands.length },
				};
			}

			case "add-command": {
				if (!p.commandMapping) {
					return {
						content: [
							{ type: "text", text: "Error: commandMapping required for add-command action." },
						],
						details: {},
					};
				}
				manager.addCommandMapping(p.commandMapping);
				return {
					content: [
						{
							type: "text",
							text: `Voice command added: "${p.commandMapping.description}" -> ${p.commandMapping.tool}`,
						},
					],
					details: { tool: p.commandMapping.tool },
				};
			}

			case "remove-command": {
				if (!p.patternStr) {
					return {
						content: [
							{ type: "text", text: "Error: patternStr required for remove-command action." },
						],
						details: {},
					};
				}
				const removed = manager.removeCommandMapping(p.patternStr);
				return {
					content: [
						{
							type: "text",
							text: removed
								? `Voice command removed: ${p.patternStr}`
								: `Voice command not found: ${p.patternStr}`,
						},
					],
					details: { removed },
				};
			}

			case "config": {
				if (p.config) {
					manager.updateConfig(p.config);
					return {
						content: [
							{
								type: "text",
								text: `Voice config updated: ${JSON.stringify(p.config)}`,
							},
						],
						details: p.config,
					};
				}
				const config = manager.getConfig();
				return {
					content: [
						{
							type: "text",
							text: [
								"Voice-to-Code Configuration:",
								`  Enabled: ${config.enabled}`,
								`  Language: ${config.language}`,
								`  Continuous: ${config.continuous}`,
								`  Auto-execute: ${config.autoExecute}`,
								`  Confidence threshold: ${config.confidenceThreshold}`,
								`  Whisper model: ${config.whisperModel}`,
								`  Commands: ${config.commands.length}`,
							].join("\n"),
						},
					],
					details: config,
				};
			}

			case "stats": {
				const stats = manager.getStats();
				return {
					content: [
						{
							type: "text",
							text: [
								"Voice-to-Code Statistics:",
								`  Total sessions: ${stats.totalSessions}`,
								`  Total commands: ${stats.totalCommands}`,
								`  Successful: ${stats.successfulCommands}`,
								`  Failed: ${stats.failedCommands}`,
								`  Average confidence: ${(stats.averageConfidence * 100).toFixed(1)}%`,
								`  Commands by tool: ${JSON.stringify(stats.commandsByTool)}`,
								`  Last session: ${stats.lastSessionTime || "never"}`,
							].join("\n"),
						},
					],
					details: stats,
				};
			}

			case "clear": {
				manager.clearHistory();
				return {
					content: [{ type: "text", text: "Voice command history cleared." }],
					details: {},
				};
			}

			case "reset": {
				manager.resetStats();
				return {
					content: [{ type: "text", text: "Voice-to-code statistics reset." }],
					details: {},
				};
			}

			case "help": {
				return {
					content: [{ type: "text", text: manager.getHelp() }],
					details: {},
				};
			}

			default:
				return {
					content: [
						{
							type: "text",
							text: `Unknown action: ${p.action}. Use 'help' action for available actions.`,
						},
					],
					details: {},
				};
		}
	},
};

export default voiceToCodeToolDefinition;
