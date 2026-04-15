/**
 * Conversation Sharing Module (OpenHands Pattern)
 *
 * Enables sharing evolution sessions for collaboration:
 * - Export sessions in multiple formats (JSON, Markdown, HTML)
 * - Import shared sessions
 * - Generate shareable session IDs
 * - Session anonymization for privacy
 *
 * Inspired by OpenHands Cloud conversation sharing feature
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

// Types
export interface SharedSession {
	id: string;
	title: string;
	description?: string;
	createdAt: string;
	expiresAt?: string;
	messages: SharedMessage[];
	metadata: SessionMetadata;
	tags?: string[];
}

export interface SharedMessage {
	role: "user" | "assistant" | "system";
	content: string;
	timestamp?: string;
	toolCalls?: ToolCall[];
	metadata?: Record<string, unknown>;
}

export interface ToolCall {
	tool: string;
	action?: string;
	params?: Record<string, unknown>;
	result?: string;
	success?: boolean;
}

export interface SessionMetadata {
	taskType?: "capability" | "reliability" | "feature";
	taskDescription?: string;
	duration?: number; // minutes
	success?: boolean;
	skillsUsed?: string[];
	errors?: string[];
	filesModified?: string[];
	impact?: "High" | "Medium" | "Low";
	source: string; // "self" | "imported" | "shared"
	author?: string;
	anonymized?: boolean;
}

export interface ExportOptions {
	format: "json" | "markdown" | "html" | "csv";
	includeToolCalls: boolean;
	includeMetadata: boolean;
	anonymize: boolean;
	includeTimestamps: boolean;
	prettyPrint: boolean;
}

export interface ImportResult {
	success: boolean;
	sessionId?: string;
	errors?: string[];
	warnings?: string[];
	messagesImported: number;
}

export interface SharingStats {
	totalExports: number;
	totalImports: number;
	sessionsShared: number;
	exportsByFormat: Record<string, number>;
	importsBySource: Record<string, number>;
	lastExportTime?: string;
	lastImportTime?: string;
}

export interface ConversationSharingConfig {
	enabled: boolean;
	dataDir: string;
	maxSessionSize: number; // bytes
	defaultExpiryDays: number;
	allowAnonymization: boolean;
	maxSessionsStored: number;
}

// Default configuration
const DEFAULT_CONFIG: ConversationSharingConfig = {
	enabled: true,
	dataDir: path.join(process.env.HOME || ".", ".paimon", "shared-sessions"),
	maxSessionSize: 10 * 1024 * 1024, // 10MB
	defaultExpiryDays: 30,
	allowAnonymization: true,
	maxSessionsStored: 100,
};

// Sensitive patterns to anonymize
const SENSITIVE_PATTERNS = [
	{ pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: "[EMAIL]" },
	{ pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: "[PHONE]" },
	{
		pattern: /\b(?:api[_-]?key|token|secret|password|credential)\s*[=:]\s*['"]?[^'"\s,}]+['"]?/gi,
		replacement: "[REDACTED]",
	},
	{
		pattern: /\b(?:sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|xox[baprs]-[a-zA-Z0-9-]+)/g,
		replacement: "[API_KEY]",
	},
	{ pattern: /\/Users\/[^/\s]+/g, replacement: "/Users/[USER]" },
	{ pattern: /\/home\/[^/\s]+/g, replacement: "/home/[USER]" },
	{ pattern: /C:\\Users\\[^\\s]+/g, replacement: "C:\\Users\\[USER]" },
];

export class ConversationSharingManager {
	private config: ConversationSharingConfig;
	private sessions: Map<string, SharedSession> = new Map();
	private stats: SharingStats;
	private dataPath: string;

	constructor(config?: Partial<ConversationSharingConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.dataPath = path.join(this.config.dataDir, "sessions.json");
		this.stats = {
			totalExports: 0,
			totalImports: 0,
			sessionsShared: 0,
			exportsByFormat: {},
			importsBySource: {},
		};
		this.ensureDataDir();
		this.loadData();
	}

	private ensureDataDir(): void {
		if (!fs.existsSync(this.config.dataDir)) {
			fs.mkdirSync(this.config.dataDir, { recursive: true });
		}
	}

	private loadData(): void {
		try {
			if (fs.existsSync(this.dataPath)) {
				const data = JSON.parse(fs.readFileSync(this.dataPath, "utf-8"));
				this.stats = data.stats || this.stats;
				if (data.sessions) {
					for (const session of data.sessions) {
						this.sessions.set(session.id, session);
					}
				}
			}
		} catch {
			// Start fresh
		}
	}

	private saveData(): void {
		try {
			const data = {
				sessions: Array.from(this.sessions.values()),
				stats: this.stats,
				config: this.config,
			};
			fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
		} catch (error) {
			console.error("Failed to save conversation sharing data:", error);
		}
	}

	private generateId(): string {
		return `share-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
	}

	private anonymizeContent(content: string): string {
		let anonymized = content;
		for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
			anonymized = anonymized.replace(pattern, replacement);
		}
		return anonymized;
	}

	// Create a shareable session from messages
	public createSession(
		messages: SharedMessage[],
		metadata: SessionMetadata,
		title?: string,
		description?: string,
		tags?: string[],
	): SharedSession {
		const now = new Date().toISOString();
		const expiresAt = new Date(
			Date.now() + this.config.defaultExpiryDays * 24 * 60 * 60 * 1000,
		).toISOString();

		const session: SharedSession = {
			id: this.generateId(),
			title: title || `Evolution Session - ${now.split("T")[0]}`,
			description,
			createdAt: now,
			expiresAt,
			messages,
			metadata: {
				...metadata,
				source: metadata.source || "self",
			},
			tags,
		};

		// Enforce max sessions limit
		if (this.sessions.size >= this.config.maxSessionsStored) {
			this.pruneOldSessions();
		}

		this.sessions.set(session.id, session);
		this.saveData();
		return session;
	}

	private pruneOldSessions(): void {
		const sorted = Array.from(this.sessions.entries()).sort(
			(a, b) => new Date(b[1].createdAt).getTime() - new Date(a[1].createdAt).getTime(),
		);

		// Keep only the most recent sessions
		const toRemove = sorted.slice(this.config.maxSessionsStored - 10);
		for (const [id] of toRemove) {
			this.sessions.delete(id);
		}
	}

	// Export session to a specific format
	public exportSession(sessionId: string, options: Partial<ExportOptions> = {}): string {
		const session = this.sessions.get(sessionId);
		if (!session) {
			throw new Error(`Session not found: ${sessionId}`);
		}

		const opts: ExportOptions = {
			format: options.format || "json",
			includeToolCalls: options.includeToolCalls ?? true,
			includeMetadata: options.includeMetadata ?? true,
			anonymize: options.anonymize ?? false,
			includeTimestamps: options.includeTimestamps ?? true,
			prettyPrint: options.prettyPrint ?? true,
		};

		let exported: string;
		switch (opts.format) {
			case "markdown":
				exported = this.exportToMarkdown(session, opts);
				break;
			case "html":
				exported = this.exportToHtml(session, opts);
				break;
			case "csv":
				exported = this.exportToCsv(session, opts);
				break;
			default:
				exported = this.exportToJson(session, opts);
		}

		this.stats.totalExports++;
		this.stats.exportsByFormat[opts.format] = (this.stats.exportsByFormat[opts.format] || 0) + 1;
		this.stats.lastExportTime = new Date().toISOString();
		this.saveData();

		return exported;
	}

	private exportToJson(session: SharedSession, opts: ExportOptions): string {
		const exportData = {
			id: session.id,
			title: session.title,
			description: session.description,
			createdAt: opts.includeTimestamps ? session.createdAt : undefined,
			messages: session.messages.map((msg) => this.processMessage(msg, opts)),
			metadata: opts.includeMetadata ? session.metadata : undefined,
			tags: session.tags,
		};

		return JSON.stringify(exportData, null, opts.prettyPrint ? 2 : 0);
	}

	private exportToMarkdown(session: SharedSession, opts: ExportOptions): string {
		const lines: string[] = [];

		// Header
		lines.push(`# ${session.title}`);
		lines.push("");
		if (session.description) {
			lines.push(`> ${session.description}`);
			lines.push("");
		}

		// Metadata
		if (opts.includeMetadata && session.metadata) {
			lines.push("## Metadata");
			lines.push("");
			if (session.metadata.taskType) lines.push(`- **Type:** ${session.metadata.taskType}`);
			if (session.metadata.taskDescription)
				lines.push(`- **Task:** ${session.metadata.taskDescription}`);
			if (session.metadata.duration)
				lines.push(`- **Duration:** ${session.metadata.duration} minutes`);
			if (session.metadata.success !== undefined)
				lines.push(`- **Success:** ${session.metadata.success ? "✅" : "❌"}`);
			if (session.metadata.impact) lines.push(`- **Impact:** ${session.metadata.impact}`);
			if (session.tags?.length) lines.push(`- **Tags:** ${session.tags.join(", ")}`);
			lines.push("");
		}

		// Messages
		lines.push("## Conversation");
		lines.push("");

		for (const msg of session.messages) {
			const content = opts.anonymize ? this.anonymizeContent(msg.content) : msg.content;
			const timestamp = opts.includeTimestamps && msg.timestamp ? ` _(${msg.timestamp})_` : "";

			if (msg.role === "user") {
				lines.push(`### 👤 User${timestamp}`);
			} else if (msg.role === "assistant") {
				lines.push(`### 🤖 Assistant${timestamp}`);
			} else {
				lines.push(`### ⚙️ System${timestamp}`);
			}
			lines.push("");
			lines.push("```");
			lines.push(content);
			lines.push("```");
			lines.push("");

			// Tool calls
			if (opts.includeToolCalls && msg.toolCalls?.length) {
				for (const tc of msg.toolCalls) {
					lines.push(`**Tool:** \`${tc.tool}${tc.action ? `.${tc.action}` : ""}()\``);
					if (tc.success !== undefined) {
						lines.push(`- **Success:** ${tc.success ? "✅" : "❌"}`);
					}
					lines.push("");
				}
			}
		}

		return lines.join("\n");
	}

	private exportToHtml(session: SharedSession, opts: ExportOptions): string {
		const escapeHtml = (str: string): string =>
			str
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;");

		const lines: string[] = [];
		lines.push("<!DOCTYPE html>");
		lines.push("<html lang='en'>");
		lines.push("<head>");
		lines.push("<meta charset='UTF-8'>");
		lines.push(`<title>${escapeHtml(session.title)}</title>`);
		lines.push("<style>");
		lines.push(
			"body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }",
		);
		lines.push(".message { margin: 16px 0; padding: 12px; border-radius: 8px; }");
		lines.push(".user { background: #e3f2fd; }");
		lines.push(".assistant { background: #f5f5f5; }");
		lines.push(".system { background: #fff3e0; }");
		lines.push("pre { white-space: pre-wrap; word-wrap: break-word; }");
		lines.push(".metadata { color: #666; font-size: 0.9em; margin-bottom: 20px; }");
		lines.push(
			".tool-call { background: #e8f5e9; padding: 8px; margin: 8px 0; border-radius: 4px; }",
		);
		lines.push("</style>");
		lines.push("</head>");
		lines.push("<body>");
		lines.push(`<h1>${escapeHtml(session.title)}</h1>`);

		if (session.description) {
			lines.push(`<p><em>${escapeHtml(session.description)}</em></p>`);
		}

		// Metadata
		if (opts.includeMetadata && session.metadata) {
			lines.push("<div class='metadata'>");
			if (session.metadata.taskType) lines.push(`<p>Type: ${session.metadata.taskType}</p>`);
			if (session.metadata.duration)
				lines.push(`<p>Duration: ${session.metadata.duration} minutes</p>`);
			if (session.metadata.success !== undefined) {
				lines.push(`<p>Success: ${session.metadata.success ? "✅" : "❌"}</p>`);
			}
			lines.push("</div>");
		}

		// Messages
		for (const msg of session.messages) {
			const content = opts.anonymize ? this.anonymizeContent(msg.content) : msg.content;
			const roleClass = msg.role;
			const roleLabel = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);

			lines.push(`<div class="message ${roleClass}">`);
			lines.push(`<strong>${roleLabel}</strong>`);
			if (opts.includeTimestamps && msg.timestamp) {
				lines.push(` <em>${msg.timestamp}</em>`);
			}
			lines.push(`<pre>${escapeHtml(content)}</pre>`);

			// Tool calls
			if (opts.includeToolCalls && msg.toolCalls?.length) {
				for (const tc of msg.toolCalls) {
					lines.push("<div class='tool-call'>");
					lines.push(`<code>${tc.tool}${tc.action ? `.${tc.action}` : ""}()</code>`);
					if (tc.success !== undefined) {
						lines.push(` ${tc.success ? "✅" : "❌"}`);
					}
					lines.push("</div>");
				}
			}

			lines.push("</div>");
		}

		lines.push("</body>");
		lines.push("</html>");

		return lines.join("\n");
	}

	private exportToCsv(session: SharedSession, opts: ExportOptions): string {
		const lines: string[] = [];

		// Header
		const headers = ["role", "content"];
		if (opts.includeTimestamps) headers.push("timestamp");
		if (opts.includeToolCalls) headers.push("tool_calls");
		lines.push(headers.join(","));

		// Messages
		for (const msg of session.messages) {
			const content = opts.anonymize ? this.anonymizeContent(msg.content) : msg.content;
			const row = [
				msg.role,
				`"${content.replace(/"/g, '""')}"`, // Escape quotes
			];
			if (opts.includeTimestamps) {
				row.push(msg.timestamp || "");
			}
			if (opts.includeToolCalls) {
				const tools =
					msg.toolCalls?.map((tc) => `${tc.tool}${tc.action ? `.${tc.action}` : ""}`).join(";") ||
					"";
				row.push(`"${tools}"`);
			}
			lines.push(row.join(","));
		}

		return lines.join("\n");
	}

	private processMessage(msg: SharedMessage, opts: ExportOptions): SharedMessage {
		return {
			role: msg.role,
			content: opts.anonymize ? this.anonymizeContent(msg.content) : msg.content,
			timestamp: opts.includeTimestamps ? msg.timestamp : undefined,
			toolCalls: opts.includeToolCalls ? msg.toolCalls : undefined,
			metadata: msg.metadata,
		};
	}

	// Import a session from exported data
	public importSession(data: string, format: "json" | "markdown" = "json"): ImportResult {
		const result: ImportResult = {
			success: false,
			messagesImported: 0,
		};

		try {
			let session: SharedSession;

			if (format === "json") {
				session = this.importFromJson(data);
			} else {
				result.errors = ["Markdown import not yet implemented"];
				return result;
			}

			// Validate session
			if (!session.messages || !Array.isArray(session.messages)) {
				result.errors = ["Invalid session: missing messages array"];
				return result;
			}

			// Generate new ID for imported session
			session.id = this.generateId();
			session.metadata = {
				...session.metadata,
				source: "imported",
			};

			this.sessions.set(session.id, session);

			this.stats.totalImports++;
			this.stats.importsBySource.imported = (this.stats.importsBySource.imported || 0) + 1;
			this.stats.lastImportTime = new Date().toISOString();
			this.saveData();

			result.success = true;
			result.sessionId = session.id;
			result.messagesImported = session.messages.length;
		} catch (error) {
			result.errors = [`Import failed: ${error instanceof Error ? error.message : String(error)}`];
		}

		return result;
	}

	private importFromJson(data: string): SharedSession {
		const parsed = JSON.parse(data);

		return {
			id: parsed.id || this.generateId(),
			title: parsed.title || "Imported Session",
			description: parsed.description,
			createdAt: parsed.createdAt || new Date().toISOString(),
			messages: parsed.messages || [],
			metadata: parsed.metadata || { source: "imported" },
			tags: parsed.tags,
		};
	}

	// Get a session by ID
	public getSession(sessionId: string): SharedSession | undefined {
		return this.sessions.get(sessionId);
	}

	// List all sessions
	public listSessions(
		options: { limit?: number; tag?: string; type?: string } = {},
	): SharedSession[] {
		let sessions = Array.from(this.sessions.values());

		// Filter by tag
		const tagFilter = options.tag;
		if (tagFilter) {
			sessions = sessions.filter((s) => s.tags?.includes(tagFilter));
		}

		// Filter by type
		if (options.type) {
			sessions = sessions.filter((s) => s.metadata?.taskType === options.type);
		}

		// Sort by creation date (newest first)
		sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

		// Apply limit
		if (options.limit) {
			sessions = sessions.slice(0, options.limit);
		}

		return sessions;
	}

	// Delete a session
	public deleteSession(sessionId: string): boolean {
		const deleted = this.sessions.delete(sessionId);
		if (deleted) {
			this.saveData();
		}
		return deleted;
	}

	// Generate a share link (for local use)
	public generateShareLink(sessionId: string, baseUrl?: string): string {
		const session = this.sessions.get(sessionId);
		if (!session) {
			throw new Error(`Session not found: ${sessionId}`);
		}

		const base = baseUrl || "https://share.paimon.dev";
		this.stats.sessionsShared++;
		this.saveData();

		return `${base}/session/${sessionId}`;
	}

	// Get statistics
	public getStats(): SharingStats {
		return { ...this.stats };
	}

	// Get configuration
	public getConfig(): ConversationSharingConfig {
		return { ...this.config };
	}

	// Update configuration
	public updateConfig(updates: Partial<ConversationSharingConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveData();
	}

	// Clear all sessions
	public clearSessions(): void {
		this.sessions.clear();
		this.saveData();
	}

	// Reset statistics
	public resetStats(): void {
		this.stats = {
			totalExports: 0,
			totalImports: 0,
			sessionsShared: 0,
			exportsByFormat: {},
			importsBySource: {},
		};
		this.saveData();
	}

	// Check if sharing is enabled
	public isEnabled(): boolean {
		return this.config.enabled;
	}

	// Enable/disable sharing
	public setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveData();
	}
}

// Singleton instance
let managerInstance: ConversationSharingManager | null = null;

export function getConversationSharingManager(): ConversationSharingManager {
	if (!managerInstance) {
		managerInstance = new ConversationSharingManager();
	}
	return managerInstance;
}

export function resetConversationSharingManager(): void {
	managerInstance = null;
}
