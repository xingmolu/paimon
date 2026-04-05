/**
 * Browser UI Module (Aider Pattern)
 *
 * Provides a web-based interface for running evolution sessions in a browser.
 * Inspired by Aider's --browser feature:
 * https://aider.chat/docs/usage/browser.html
 *
 * Key features:
 * - HTTP server for web interface (using built-in node:http)
 * - WebSocket for real-time communication (using ws package)
 * - Static file serving for UI assets
 * - Session management for browser clients
 * - Real-time streaming of agent responses
 */

import * as fs from "node:fs";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import { type RawData, WebSocket, WebSocketServer } from "ws";

// Types
export interface BrowserUIConfig {
	enabled: boolean;
	port: number;
	host: string;
	openBrowser: boolean;
	staticDir: string;
}

export interface BrowserUISession {
	id: string;
	startTime: string;
	messages: BrowserUIMessage[];
	status: "active" | "idle" | "closed";
	clientIp: string;
}

export interface BrowserUIMessage {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: string;
}

export interface BrowserUIStats {
	totalSessions: number;
	activeConnections: number;
	totalMessages: number;
	bytesTransferred: number;
	uptime: number;
	serverStartTime: string;
}

const DEFAULT_CONFIG: BrowserUIConfig = {
	enabled: false,
	port: 8080,
	host: "localhost",
	openBrowser: true,
	staticDir: path.join(os.homedir(), ".paimon", "browser-ui"),
};

const MIME_TYPES: Record<string, string> = {
	".html": "text/html",
	".css": "text/css",
	".js": "application/javascript",
	".json": "application/json",
	".png": "image/png",
	".jpg": "image/jpeg",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
};

export class BrowserUIManager {
	private config: BrowserUIConfig;
	private stats: BrowserUIStats;
	private sessions: Map<string, BrowserUISession> = new Map();
	private connections: Map<WebSocket, string> = new Map();
	private dataPath: string;
	private httpServer: http.Server | null = null;
	private wsServer: WebSocketServer | null = null;
	private startTime: string;
	private onMessageCallback: ((sessionId: string, message: string) => Promise<string>) | null =
		null;

	constructor(configPath?: string) {
		this.config = DEFAULT_CONFIG;
		this.dataPath = path.join(os.homedir(), ".paimon", "browser-ui.json");
		this.startTime = new Date().toISOString();
		this.stats = this.getDefaultStats();
		this.loadData();
		this.ensureStaticDir();
	}

	private getDefaultStats(): BrowserUIStats {
		return {
			totalSessions: 0,
			activeConnections: 0,
			totalMessages: 0,
			bytesTransferred: 0,
			uptime: 0,
			serverStartTime: this.startTime,
		};
	}

	private loadData(): void {
		try {
			if (fs.existsSync(this.dataPath)) {
				const data = JSON.parse(fs.readFileSync(this.dataPath, "utf-8"));
				this.config = { ...DEFAULT_CONFIG, ...data.config };
				this.stats = { ...this.getDefaultStats(), ...data.stats };
			}
		} catch {
			// Use defaults
		}
	}

	private saveData(): void {
		try {
			const dir = path.dirname(this.dataPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			this.stats.uptime = Date.now() - new Date(this.startTime).getTime();
			fs.writeFileSync(
				this.dataPath,
				JSON.stringify({ config: this.config, stats: this.stats }, null, 2),
			);
		} catch (error) {
			console.error("Failed to save browser UI data:", error);
		}
	}

	private ensureStaticDir(): void {
		try {
			if (!fs.existsSync(this.config.staticDir)) {
				fs.mkdirSync(this.config.staticDir, { recursive: true });
			}
			const indexPath = path.join(this.config.staticDir, "index.html");
			if (!fs.existsSync(indexPath)) {
				fs.writeFileSync(indexPath, this.getDefaultIndexHtml());
			}
		} catch (error) {
			console.error("Failed to create static directory:", error);
		}
	}

	private getDefaultIndexHtml(): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Paimon - Self-Evolving AI Agent</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #eee; min-height: 100vh; display: flex; flex-direction: column; }
        header { padding: 1rem 2rem; background: rgba(0,0,0,0.3); border-bottom: 1px solid #333; }
        h1 { color: #14b014; font-size: 1.5rem; }
        main { flex: 1; display: flex; flex-direction: column; max-width: 900px; margin: 0 auto; padding: 2rem; width: 100%; }
        #messages { flex: 1; overflow-y: auto; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px; margin-bottom: 1rem; }
        .message { padding: 0.75rem 1rem; margin: 0.5rem 0; border-radius: 8px; max-width: 85%; }
        .message.user { background: #1e3a5f; margin-left: auto; text-align: right; }
        .message.assistant { background: #2d4a2d; margin-right: auto; }
        .message.system { background: #3d3d3d; text-align: center; font-style: italic; max-width: 100%; }
        .input-area { display: flex; gap: 0.5rem; }
        #input { flex: 1; padding: 0.75rem 1rem; border: none; border-radius: 8px; background: #2a2a4a; color: #fff; font-size: 1rem; }
        #input:focus { outline: 2px solid #14b014; }
        button { padding: 0.75rem 1.5rem; background: #14b014; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; }
        button:hover { background: #18c018; }
        button:disabled { background: #555; cursor: not-allowed; }
        .status { padding: 0.5rem 1rem; font-size: 0.875rem; color: #888; }
        .status.connected { color: #14b014; }
        .status.disconnected { color: #e74c3c; }
        pre { white-space: pre-wrap; word-wrap: break-word; }
    </style>
</head>
<body>
    <header><h1>Paimon</h1><div class="status" id="status">Connecting...</div></header>
    <main><div id="messages"></div><div class="input-area"><input type="text" id="input" placeholder="Type your message..." disabled><button id="send" disabled>Send</button></div></main>
    <script>
        const ws = new WebSocket('ws://' + window.location.host + '/ws');
        const messages = document.getElementById('messages');
        const input = document.getElementById('input');
        const sendBtn = document.getElementById('send');
        const status = document.getElementById('status');
        function addMessage(role, content) { const div = document.createElement('div'); div.className = 'message ' + role; const pre = document.createElement('pre'); pre.textContent = content; div.appendChild(pre); messages.appendChild(div); messages.scrollTop = messages.scrollHeight; }
        ws.onopen = function() { status.textContent = 'Connected'; status.className = 'status connected'; input.disabled = false; sendBtn.disabled = false; addMessage('system', 'Connected to Paimon!'); };
        ws.onclose = function() { status.textContent = 'Disconnected'; status.className = 'status disconnected'; input.disabled = true; sendBtn.disabled = true; };
        ws.onmessage = function(event) { const data = JSON.parse(event.data); if (data.type === 'message') addMessage('assistant', data.content); else if (data.type === 'error') addMessage('system', 'Error: ' + data.content); };
        sendBtn.onclick = sendMessage;
        input.onkeydown = function(e) { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } };
        function sendMessage() { const text = input.value.trim(); if (!text) return; addMessage('user', text); ws.send(JSON.stringify({ type: 'message', content: text })); input.value = ''; }
    </script>
</body>
</html>`;
	}

	public setMessageCallback(
		callback: (sessionId: string, message: string) => Promise<string>,
	): void {
		this.onMessageCallback = callback;
	}

	public async start(): Promise<{ success: boolean; message: string; url?: string }> {
		if (!this.config.enabled) return { success: false, message: "Browser UI is disabled" };
		if (this.httpServer) return { success: false, message: "Browser UI is already running" };

		try {
			this.httpServer = http.createServer((req, res) => this.handleRequest(req, res));
			this.wsServer = new WebSocketServer({ server: this.httpServer, path: "/ws" });
			this.wsServer.on("connection", (ws: WebSocket, req) => {
				this.handleConnection(ws, req.socket.remoteAddress || "unknown");
			});
			await new Promise<void>((resolve, reject) => {
				this.httpServer?.listen(this.config.port, this.config.host, () => resolve());
				this.httpServer?.on("error", reject);
			});
			const url = `http://${this.config.host}:${this.config.port}`;
			if (this.config.openBrowser) {
				try {
					const { default: open } = await import("open");
					await open(url);
				} catch {}
			}
			return { success: true, message: `Browser UI started at ${url}`, url };
		} catch (error) {
			return { success: false, message: `Failed to start browser UI: ${error}` };
		}
	}

	private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
		const url = req.url || "/";
		// Health check
		if (url === "/health") {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify({ status: "ok", uptime: Date.now() - new Date(this.startTime).getTime() }),
			);
			return;
		}
		// Sessions API
		if (url === "/api/sessions") {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ sessions: Array.from(this.sessions.values()), stats: this.stats }));
			return;
		}
		// Static files
		const filePath = url === "/" ? "/index.html" : url;
		const fullPath = path.join(this.config.staticDir, filePath);
		const ext = path.extname(fullPath);
		const contentType = MIME_TYPES[ext] || "application/octet-stream";
		fs.readFile(fullPath, (err, data) => {
			if (err) {
				res.writeHead(404, { "Content-Type": "text/plain" });
				res.end("Not Found");
			} else {
				res.writeHead(200, { "Content-Type": contentType });
				res.end(data);
			}
		});
	}

	private handleConnection(ws: WebSocket, clientIp: string): void {
		const sessionId = `browser-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const session: BrowserUISession = {
			id: sessionId,
			startTime: new Date().toISOString(),
			messages: [],
			status: "active",
			clientIp,
		};
		this.sessions.set(sessionId, session);
		this.connections.set(ws, sessionId);
		this.stats.totalSessions++;
		this.stats.activeConnections++;
		this.saveData();
		ws.send(JSON.stringify({ type: "session", sessionId }));
		ws.on("message", async (data: RawData) => {
			try {
				const parsed = JSON.parse(data.toString());
				if (parsed.type === "message" && typeof parsed.content === "string")
					await this.handleMessage(ws, sessionId, parsed.content);
			} catch (error) {
				ws.send(JSON.stringify({ type: "error", content: String(error) }));
			}
		});
		ws.on("close", () => {
			const s = this.sessions.get(sessionId);
			if (s) s.status = "closed";
			this.connections.delete(ws);
			this.stats.activeConnections = Math.max(0, this.stats.activeConnections - 1);
			this.saveData();
		});
	}

	private async handleMessage(ws: WebSocket, sessionId: string, content: string): Promise<void> {
		const session = this.sessions.get(sessionId);
		if (!session) {
			ws.send(JSON.stringify({ type: "error", content: "Session not found" }));
			return;
		}
		session.messages.push({
			id: `msg-${Date.now()}`,
			role: "user",
			content,
			timestamp: new Date().toISOString(),
		});
		this.stats.totalMessages++;
		this.stats.bytesTransferred += content.length;
		this.saveData();
		if (this.onMessageCallback) {
			try {
				const response = await this.onMessageCallback(sessionId, content);
				session.messages.push({
					id: `msg-${Date.now()}`,
					role: "assistant",
					content: response,
					timestamp: new Date().toISOString(),
				});
				this.stats.totalMessages++;
				this.stats.bytesTransferred += response.length;
				this.saveData();
				ws.send(JSON.stringify({ type: "message", content: response }));
			} catch (error) {
				ws.send(JSON.stringify({ type: "error", content: `Failed to process message: ${error}` }));
			}
		} else {
			ws.send(JSON.stringify({ type: "message", content: "No message handler configured." }));
		}
	}

	public async stop(): Promise<{ success: boolean; message: string }> {
		if (!this.httpServer) return { success: false, message: "Browser UI is not running" };
		try {
			for (const [ws] of this.connections) ws.close();
			this.connections.clear();
			if (this.wsServer)
				await new Promise<void>((r) => {
					this.wsServer?.close(() => r());
				});
			await new Promise<void>((r) => {
				this.httpServer?.close(() => r());
			});
			this.httpServer = null;
			this.wsServer = null;
			this.stats.activeConnections = 0;
			this.saveData();
			return { success: true, message: "Browser UI stopped" };
		} catch (error) {
			return { success: false, message: `Failed to stop browser UI: ${error}` };
		}
	}

	public getStatus(): {
		running: boolean;
		config: BrowserUIConfig;
		sessions: number;
		connections: number;
		url: string | null;
	} {
		return {
			running: this.httpServer !== null,
			config: this.config,
			sessions: this.sessions.size,
			connections: this.connections.size,
			url: this.httpServer ? `http://${this.config.host}:${this.config.port}` : null,
		};
	}
	public getStats(): BrowserUIStats {
		return { ...this.stats };
	}
	public getConfig(): BrowserUIConfig {
		return { ...this.config };
	}
	public updateConfig(updates: Partial<BrowserUIConfig>): {
		success: boolean;
		message: string;
		config: BrowserUIConfig;
	} {
		this.config = { ...this.config, ...updates };
		this.saveData();
		return { success: true, message: "Configuration updated", config: this.config };
	}
	public getSession(sessionId: string): BrowserUISession | undefined {
		return this.sessions.get(sessionId);
	}
	public getSessions(): BrowserUISession[] {
		return Array.from(this.sessions.values());
	}
	public enable(): { success: boolean; message: string } {
		this.config.enabled = true;
		this.saveData();
		return { success: true, message: "Browser UI enabled" };
	}
	public disable(): { success: boolean; message: string } {
		if (this.httpServer) this.stop();
		this.config.enabled = false;
		this.saveData();
		return { success: true, message: "Browser UI disabled" };
	}
	public resetStats(): { success: boolean; message: string } {
		this.stats = this.getDefaultStats();
		this.saveData();
		return { success: true, message: "Statistics reset" };
	}
	public broadcast(content: string): void {
		const msg = JSON.stringify({ type: "message", content });
		for (const [ws] of this.connections) if (ws.readyState === WebSocket.OPEN) ws.send(msg);
	}
	public stream(sessionId: string, content: string): void {
		for (const [ws, id] of this.connections)
			if (id === sessionId && ws.readyState === WebSocket.OPEN)
				ws.send(JSON.stringify({ type: "stream", content }));
	}
}

let browserUIInstance: BrowserUIManager | null = null;
export function getBrowserUIManager(): BrowserUIManager {
	if (!browserUIInstance) browserUIInstance = new BrowserUIManager();
	return browserUIInstance;
}
export function resetBrowserUIInstance(): void {
	if (browserUIInstance) browserUIInstance.stop();
	browserUIInstance = null;
}
