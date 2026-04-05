/**
 * Browser UI Tool (Aider Pattern)
 *
 * Tool for managing the web-based browser interface for evolution sessions.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type BrowserUIConfig,
	type BrowserUISession,
	type BrowserUIStats,
	getBrowserUIManager,
	resetBrowserUIInstance,
} from "../browser-ui.js";

// Parameter schema using TypeBox
const BrowserUIParameters = Type.Object({
	action: Type.Union([
		Type.Literal("start"),
		Type.Literal("stop"),
		Type.Literal("status"),
		Type.Literal("sessions"),
		Type.Literal("session"),
		Type.Literal("config"),
		Type.Literal("enable"),
		Type.Literal("disable"),
		Type.Literal("stats"),
		Type.Literal("reset"),
		Type.Literal("help"),
	]),
	port: Type.Optional(Type.Number()),
	host: Type.Optional(Type.String()),
	openBrowser: Type.Optional(Type.Boolean()),
	sessionId: Type.Optional(Type.String()),
});

type BrowserUIToolParams = {
	action:
		| "start"
		| "stop"
		| "status"
		| "sessions"
		| "session"
		| "config"
		| "enable"
		| "disable"
		| "stats"
		| "reset"
		| "help";
	port?: number;
	host?: string;
	openBrowser?: boolean;
	sessionId?: string;
};

async function executeBrowserUITool(_toolCallId: string, params: unknown): Promise<string> {
	const typedParams = params as BrowserUIToolParams;
	const manager = getBrowserUIManager();

	switch (typedParams.action) {
		case "start": {
			if (typedParams.port) manager.updateConfig({ port: typedParams.port });
			if (typedParams.host) manager.updateConfig({ host: typedParams.host });
			if (typedParams.openBrowser !== undefined)
				manager.updateConfig({ openBrowser: typedParams.openBrowser });
			manager.enable();
			const result = await manager.start();
			return result.success
				? `Browser UI started: ${result.url}`
				: `Failed to start: ${result.message}`;
		}

		case "stop": {
			const result = await manager.stop();
			return result.success ? "Browser UI stopped" : `Failed to stop: ${result.message}`;
		}

		case "status": {
			const status = manager.getStatus();
			return JSON.stringify(status, null, 2);
		}

		case "sessions": {
			const sessions = manager.getSessions();
			return JSON.stringify(sessions, null, 2);
		}

		case "session": {
			if (!typedParams.sessionId) return "Error: sessionId parameter required";
			const session = manager.getSession(typedParams.sessionId);
			return session
				? JSON.stringify(session, null, 2)
				: `Session not found: ${typedParams.sessionId}`;
		}

		case "config": {
			const config = manager.getConfig();
			return JSON.stringify(config, null, 2);
		}

		case "enable": {
			const result = manager.enable();
			return result.message;
		}

		case "disable": {
			const result = manager.disable();
			return result.message;
		}

		case "stats": {
			const stats = manager.getStats();
			return JSON.stringify(stats, null, 2);
		}

		case "reset": {
			resetBrowserUIInstance();
			return "Browser UI instance reset";
		}

		case "help": {
			return `Browser UI Tool (Aider Pattern)

Actions:
- start: Start the browser UI server (optional: port, host, openBrowser)
- stop: Stop the browser UI server
- status: Get server status
- sessions: List all browser sessions
- session: Get specific session details (requires sessionId)
- config: Get current configuration
- enable: Enable browser UI
- disable: Disable browser UI
- stats: Get statistics
- reset: Reset the browser UI instance
- help: Show this help message

Examples:
- browserUI({action: 'start', port: 8080})
- browserUI({action: 'stop'})
- browserUI({action: 'status'})
- browserUI({action: 'sessions'})

The browser UI provides a web-based interface for running evolution sessions.
Once started, open the URL in your browser to interact with Paimon.

Inspired by Aider's --browser feature:
https://aider.chat/docs/usage/browser.html`;
		}

		default:
			return "Unknown action. Use 'help' to see available actions.";
	}
}

export const browserUITool: AgentTool = {
	name: "browserUI",
	label: "Browser UI",
	description:
		"Manage the web-based browser interface for evolution sessions. Start/stop the server, view sessions, configure settings. Inspired by Aider's --browser feature.",
	parameters: BrowserUIParameters,
	execute: async (
		_toolCallId,
		params,
	): Promise<{
		content: Array<{ type: "text"; text: string }>;
		details: Record<string, unknown>;
	}> => {
		const result = await executeBrowserUITool(_toolCallId, params);
		return {
			content: [{ type: "text", text: result }],
			details: {},
		};
	},
};

export const browserUIToolDefinition: AgentTool = browserUITool;
