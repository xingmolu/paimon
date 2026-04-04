/**
 * Conversation Sharing Tool (OpenHands Pattern)
 *
 * Tool for exporting, importing, and sharing evolution sessions
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { SessionMetadata, SharedMessage } from "../conversation-sharing.js";
import { getConversationSharingManager } from "../conversation-sharing.js";

/**
 * Tool for conversation sharing (OpenHands conversation sharing pattern).
 *
 * Actions:
 * - create: Create a new shareable session
 * - export: Export session to JSON/Markdown/HTML/CSV
 * - import: Import a shared session
 * - share: Generate a share link
 * - get: Get session details
 * - list: List all shared sessions
 * - delete: Delete a session
 * - formats: Show supported export formats
 * - stats: View sharing statistics
 * - config: View configuration
 * - enable: Enable sharing
 * - disable: Disable sharing
 * - clear: Clear all sessions
 * - reset: Reset statistics
 * - help: Show help message
 */
export const conversationSharingToolDefinition: AgentTool = {
	name: "conversationSharing",
	label: "Conversation Sharing",
	description:
		"Manage conversation sharing - export sessions in multiple formats (JSON, Markdown, HTML, CSV), import shared sessions, generate share links, manage session storage",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action: create, export, import, share, get, list, delete, formats, stats, config, enable, disable, clear, reset, help",
		}),
		sessionId: Type.Optional(
			Type.String({
				description: "Session ID for get, export, share, delete actions",
			}),
		),
		title: Type.Optional(
			Type.String({
				description: "Title for create action",
			}),
		),
		description: Type.Optional(
			Type.String({
				description: "Description for create action",
			}),
		),
		messages: Type.Optional(
			Type.Array(
				Type.Object({
					role: Type.String(),
					content: Type.String(),
					timestamp: Type.Optional(Type.String()),
					toolCalls: Type.Optional(
						Type.Array(
							Type.Object({
								tool: Type.String(),
								action: Type.Optional(Type.String()),
								result: Type.Optional(Type.String()),
								success: Type.Optional(Type.Boolean()),
							}),
						),
					),
				}),
			),
		),
		metadata: Type.Optional(
			Type.Object({
				taskType: Type.Optional(Type.String()),
				taskDescription: Type.Optional(Type.String()),
				duration: Type.Optional(Type.Number()),
				success: Type.Optional(Type.Boolean()),
				skillsUsed: Type.Optional(Type.Array(Type.String())),
				errors: Type.Optional(Type.Array(Type.String())),
				filesModified: Type.Optional(Type.Array(Type.String())),
				impact: Type.Optional(Type.String()),
				author: Type.Optional(Type.String()),
			}),
		),
		tags: Type.Optional(Type.Array(Type.String())),
		format: Type.Optional(
			Type.String({
				description: "Export format: json, markdown, html, csv (default: json)",
			}),
		),
		includeToolCalls: Type.Optional(Type.Boolean()),
		includeMetadata: Type.Optional(Type.Boolean()),
		anonymize: Type.Optional(Type.Boolean()),
		data: Type.Optional(
			Type.String({
				description: "Data string for import action",
			}),
		),
		baseUrl: Type.Optional(
			Type.String({
				description: "Base URL for share link generation",
			}),
		),
		limit: Type.Optional(Type.Number()),
		tag: Type.Optional(
			Type.String({
				description: "Filter by tag for list action",
			}),
		),
		type: Type.Optional(
			Type.String({
				description: "Filter by task type for list action",
			}),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const p = params as {
			action: string;
			sessionId?: string;
			title?: string;
			description?: string;
			messages?: Array<{
				role: string;
				content: string;
				timestamp?: string;
				toolCalls?: Array<{ tool: string; action?: string; result?: string; success?: boolean }>;
			}>;
			metadata?: SessionMetadata;
			tags?: string[];
			format?: "json" | "markdown" | "html" | "csv";
			includeToolCalls?: boolean;
			includeMetadata?: boolean;
			anonymize?: boolean;
			data?: string;
			baseUrl?: string;
			limit?: number;
			tag?: string;
			type?: string;
		};

		const manager = getConversationSharingManager();

		try {
			switch (p.action) {
				case "create": {
					if (!p.messages || p.messages.length === 0) {
						return {
							content: [
								{ type: "text", text: "Error: messages array is required for create action" },
							],
							details: {},
						};
					}

					const messages: SharedMessage[] = p.messages.map((m) => ({
						role: m.role as "user" | "assistant" | "system",
						content: m.content,
						timestamp: m.timestamp,
						toolCalls: m.toolCalls,
					}));

					const metadata: SessionMetadata = {
						...p.metadata,
						source: "self",
					};

					const session = manager.createSession(messages, metadata, p.title, p.description, p.tags);

					return {
						content: [
							{
								type: "text",
								text: [
									"Session created successfully!",
									"",
									`**Session ID:** ${session.id}`,
									`**Title:** ${session.title}`,
									`**Messages:** ${session.messages.length}`,
									`**Created:** ${session.createdAt}`,
									`**Expires:** ${session.expiresAt || "Never"}`,
									"",
									`Use \`conversationSharing({action: 'export', sessionId: '${session.id}', format: 'markdown'})\` to export this session.`,
								].join("\n"),
							},
						],
						details: { sessionId: session.id },
					};
				}

				case "export": {
					if (!p.sessionId) {
						return {
							content: [{ type: "text", text: "Error: sessionId is required for export action" }],
							details: {},
						};
					}

					const options = {
						format: p.format || "json",
						includeToolCalls: p.includeToolCalls ?? true,
						includeMetadata: p.includeMetadata ?? true,
						anonymize: p.anonymize ?? false,
					};

					try {
						const exported = manager.exportSession(p.sessionId, options);
						return {
							content: [
								{
									type: "text",
									text: `Session exported successfully!\n\n\`\`\`${options.format}\n${exported}\n\`\`\``,
								},
							],
							details: { format: options.format },
						};
					} catch (error) {
						return {
							content: [
								{
									type: "text",
									text: `Error: ${error instanceof Error ? error.message : String(error)}`,
								},
							],
							details: {},
						};
					}
				}

				case "import": {
					if (!p.data) {
						return {
							content: [{ type: "text", text: "Error: data is required for import action" }],
							details: {},
						};
					}

					const format = p.format === "html" || p.format === "csv" ? "json" : p.format || "json";
					const result = manager.importSession(p.data, format as "json" | "markdown");

					if (result.success) {
						return {
							content: [
								{
									type: "text",
									text: [
										"Session imported successfully!",
										"",
										`**Session ID:** ${result.sessionId}`,
										`**Messages Imported:** ${result.messagesImported}`,
										"",
										`Use \`conversationSharing({action: 'get', sessionId: '${result.sessionId}'})\` to view the session.`,
									].join("\n"),
								},
							],
							details: { sessionId: result.sessionId },
						};
					}
					return {
						content: [
							{ type: "text", text: `Import failed!\n\nErrors: ${result.errors?.join(", ")}` },
						],
						details: {},
					};
				}

				case "share": {
					if (!p.sessionId) {
						return {
							content: [{ type: "text", text: "Error: sessionId is required for share action" }],
							details: {},
						};
					}

					try {
						const link = manager.generateShareLink(p.sessionId, p.baseUrl);
						return {
							content: [
								{
									type: "text",
									text: [
										"Share link generated!",
										"",
										`**Link:** ${link}`,
										"",
										"Note: This is a local share link. The actual sharing requires a sharing server to be configured.",
									].join("\n"),
								},
							],
							details: { link },
						};
					} catch (error) {
						return {
							content: [
								{
									type: "text",
									text: `Error: ${error instanceof Error ? error.message : String(error)}`,
								},
							],
							details: {},
						};
					}
				}

				case "get": {
					if (!p.sessionId) {
						return {
							content: [{ type: "text", text: "Error: sessionId is required for get action" }],
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

					const msgPreview = session.messages
						.slice(0, 5)
						.map((m, i) => {
							const preview = m.content.length > 100 ? `${m.content.slice(0, 100)}...` : m.content;
							return `${i + 1}. **${m.role}**: ${preview}`;
						})
						.join("\n");

					return {
						content: [
							{
								type: "text",
								text: [
									`## Session: ${session.title}`,
									"",
									`**ID:** ${session.id}`,
									`**Created:** ${session.createdAt}`,
									`**Expires:** ${session.expiresAt || "Never"}`,
									session.description ? `\n**Description:** ${session.description}` : "",
									"",
									"### Metadata",
									`- **Type:** ${session.metadata?.taskType || "Unknown"}`,
									`- **Task:** ${session.metadata?.taskDescription || "N/A"}`,
									`- **Duration:** ${session.metadata?.duration ? `${session.metadata.duration} minutes` : "N/A"}`,
									`- **Success:** ${session.metadata?.success !== undefined ? (session.metadata.success ? "✅" : "❌") : "N/A"}`,
									`- **Impact:** ${session.metadata?.impact || "N/A"}`,
									`- **Source:** ${session.metadata?.source || "self"}`,
									session.tags?.length ? `- **Tags:** ${session.tags.join(", ")}` : "",
									"",
									`### Messages (${session.messages.length})`,
									msgPreview,
									session.messages.length > 5
										? `\n... and ${session.messages.length - 5} more messages`
										: "",
								].join("\n"),
							},
						],
						details: { sessionId: session.id },
					};
				}

				case "list": {
					const sessions = manager.listSessions({
						limit: p.limit || 20,
						tag: p.tag,
						type: p.type,
					});

					if (sessions.length === 0) {
						return {
							content: [{ type: "text", text: "No sessions found." }],
							details: {},
						};
					}

					const rows = sessions
						.map((s) => {
							const id = s.id.length > 20 ? `${s.id.slice(0, 20)}...` : s.id;
							const title = s.title.length > 30 ? `${s.title.slice(0, 30)}...` : s.title;
							const taskType = s.metadata?.taskType || "-";
							const date = s.createdAt.split("T")[0];
							return `| ${id} | ${title} | ${taskType} | ${date} | ${s.messages.length} |`;
						})
						.join("\n");

					return {
						content: [
							{
								type: "text",
								text: [
									`## Shared Sessions (${sessions.length})`,
									"",
									"| ID | Title | Type | Created | Messages |",
									"|----|-------|------|---------|----------|",
									rows,
									"",
									"Use `conversationSharing({action: 'get', sessionId: 'ID'})` to view a specific session.",
								].join("\n"),
							},
						],
						details: { count: sessions.length },
					};
				}

				case "delete": {
					if (!p.sessionId) {
						return {
							content: [{ type: "text", text: "Error: sessionId is required for delete action" }],
							details: {},
						};
					}

					const deleted = manager.deleteSession(p.sessionId);
					return {
						content: [
							{
								type: "text",
								text: deleted
									? `Session ${p.sessionId} deleted successfully.`
									: `Session not found: ${p.sessionId}`,
							},
						],
						details: { deleted },
					};
				}

				case "formats": {
					return {
						content: [
							{
								type: "text",
								text: [
									"## Supported Export Formats",
									"",
									"| Format | Description | Best For |",
									"|--------|-------------|----------|",
									"| **json** | Structured JSON format | API integration, backup |",
									"| **markdown** | Human-readable Markdown | Documentation, sharing |",
									"| **html** | Styled HTML page | Browser viewing, archiving |",
									"| **csv** | Comma-separated values | Data analysis, spreadsheets |",
								].join("\n"),
							},
						],
						details: {},
					};
				}

				case "stats": {
					const stats = manager.getStats();
					const exportsByFormat =
						Object.entries(stats.exportsByFormat)
							.map(([fmt, count]) => `- ${fmt}: ${count}`)
							.join("\n") || "- No exports yet";

					const importsBySource =
						Object.entries(stats.importsBySource)
							.map(([src, count]) => `- ${src}: ${count}`)
							.join("\n") || "- No imports yet";

					return {
						content: [
							{
								type: "text",
								text: [
									"## Conversation Sharing Statistics",
									"",
									`**Total Exports:** ${stats.totalExports}`,
									`**Total Imports:** ${stats.totalImports}`,
									`**Sessions Shared:** ${stats.sessionsShared}`,
									"",
									"### Exports by Format",
									exportsByFormat,
									"",
									"### Imports by Source",
									importsBySource,
									"",
									`**Last Export:** ${stats.lastExportTime || "Never"}`,
									`**Last Import:** ${stats.lastImportTime || "Never"}`,
								].join("\n"),
							},
						],
						details: stats,
					};
				}

				case "config": {
					const config = manager.getConfig();
					return {
						content: [
							{
								type: "text",
								text: [
									"## Conversation Sharing Configuration",
									"",
									"| Setting | Value |",
									"|---------|-------|",
									`| **Enabled** | ${config.enabled} |`,
									`| **Data Directory** | ${config.dataDir} |`,
									`| **Max Session Size** | ${(config.maxSessionSize / 1024 / 1024).toFixed(1)} MB |`,
									`| **Default Expiry** | ${config.defaultExpiryDays} days |`,
									`| **Anonymization Allowed** | ${config.allowAnonymization} |`,
									`| **Max Sessions Stored** | ${config.maxSessionsStored} |`,
									"",
									"Use `conversationSharing({action: 'enable'})` or `conversationSharing({action: 'disable'})` to toggle sharing.",
								].join("\n"),
							},
						],
						details: config,
					};
				}

				case "enable": {
					manager.setEnabled(true);
					return {
						content: [{ type: "text", text: "Conversation sharing enabled." }],
						details: {},
					};
				}

				case "disable": {
					manager.setEnabled(false);
					return {
						content: [{ type: "text", text: "Conversation sharing disabled." }],
						details: {},
					};
				}

				case "clear": {
					manager.clearSessions();
					return {
						content: [{ type: "text", text: "All shared sessions cleared." }],
						details: {},
					};
				}

				case "reset": {
					manager.resetStats();
					return {
						content: [{ type: "text", text: "Statistics reset." }],
						details: {},
					};
				}

				case "help": {
					return {
						content: [
							{
								type: "text",
								text: [
									"## Conversation Sharing Tool (OpenHands Pattern)",
									"",
									"Export, import, and share evolution sessions for collaboration.",
									"",
									"### Actions",
									"",
									"| Action | Description |",
									"|--------|-------------|",
									"| `create` | Create a new shareable session |",
									"| `export` | Export session to JSON/Markdown/HTML/CSV |",
									"| `import` | Import a shared session |",
									"| `share` | Generate a share link |",
									"| `get` | Get session details |",
									"| `list` | List all shared sessions |",
									"| `delete` | Delete a session |",
									"| `formats` | Show supported export formats |",
									"| `stats` | View sharing statistics |",
									"| `config` | View configuration |",
									"| `enable` | Enable sharing |",
									"| `disable` | Disable sharing |",
									"| `clear` | Clear all sessions |",
									"| `reset` | Reset statistics |",
									"",
									"### Privacy Features",
									"",
									"- **Anonymization:** Automatically redacts emails, phone numbers, API keys, file paths",
									"- **Expiry:** Sessions automatically expire after configurable days",
									"- **Local Storage:** All sessions stored locally by default",
									"",
									"Inspired by OpenHands Cloud conversation sharing feature.",
								].join("\n"),
							},
						],
						details: {},
					};
				}

				default:
					return {
						content: [
							{
								type: "text",
								text: `Unknown action: ${p.action}. Use 'help' to see available actions.`,
							},
						],
						details: {},
					};
			}
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Error: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				details: {},
			};
		}
	},
};

export async function conversationSharingTool(params: {
	action: string;
	sessionId?: string;
	title?: string;
	description?: string;
	messages?: Array<{
		role: string;
		content: string;
		timestamp?: string;
		toolCalls?: Array<{ tool: string; action?: string; result?: string; success?: boolean }>;
	}>;
	metadata?: SessionMetadata;
	tags?: string[];
	format?: "json" | "markdown" | "html" | "csv";
	includeToolCalls?: boolean;
	includeMetadata?: boolean;
	anonymize?: boolean;
	data?: string;
	baseUrl?: string;
	limit?: number;
	tag?: string;
	type?: string;
}): Promise<string> {
	const manager = getConversationSharingManager();

	try {
		switch (params.action) {
			case "create": {
				if (!params.messages || params.messages.length === 0) {
					return "Error: messages array is required for create action";
				}

				const messages: SharedMessage[] = params.messages.map((m) => ({
					role: m.role as "user" | "assistant" | "system",
					content: m.content,
					timestamp: m.timestamp,
					toolCalls: m.toolCalls,
				}));

				const metadata: SessionMetadata = {
					...params.metadata,
					source: "self",
				};

				const session = manager.createSession(
					messages,
					metadata,
					params.title,
					params.description,
					params.tags,
				);

				return `Session created successfully!

**Session ID:** ${session.id}
**Title:** ${session.title}
**Messages:** ${session.messages.length}
**Created:** ${session.createdAt}
**Expires:** ${session.expiresAt || "Never"}

Use \`conversationSharing({action: 'export', sessionId: '${session.id}', format: 'markdown'})\` to export this session.`;
			}

			case "export": {
				if (!params.sessionId) {
					return "Error: sessionId is required for export action";
				}

				const options = {
					format: params.format || "json",
					includeToolCalls: params.includeToolCalls ?? true,
					includeMetadata: params.includeMetadata ?? true,
					anonymize: params.anonymize ?? false,
				};

				try {
					const exported = manager.exportSession(params.sessionId, options);
					return `Session exported successfully!\n\n\`\`\`${options.format}\n${exported}\n\`\`\``;
				} catch (error) {
					return `Error: ${error instanceof Error ? error.message : String(error)}`;
				}
			}

			case "import": {
				if (!params.data) {
					return "Error: data is required for import action";
				}

				const format =
					params.format === "html" || params.format === "csv" ? "json" : params.format || "json";
				const result = manager.importSession(params.data, format as "json" | "markdown");

				if (result.success) {
					return `Session imported successfully!

**Session ID:** ${result.sessionId}
**Messages Imported:** ${result.messagesImported}

Use \`conversationSharing({action: 'get', sessionId: '${result.sessionId}'})\` to view the session.`;
				}
				return `Import failed!\n\nErrors: ${result.errors?.join(", ")}`;
			}

			case "share": {
				if (!params.sessionId) {
					return "Error: sessionId is required for share action";
				}

				try {
					const link = manager.generateShareLink(params.sessionId, params.baseUrl);
					return `Share link generated!

**Link:** ${link}

Note: This is a local share link. The actual sharing requires a sharing server to be configured.`;
				} catch (error) {
					return `Error: ${error instanceof Error ? error.message : String(error)}`;
				}
			}

			case "get": {
				if (!params.sessionId) {
					return "Error: sessionId is required for get action";
				}

				const session = manager.getSession(params.sessionId);
				if (!session) {
					return `Session not found: ${params.sessionId}`;
				}

				const msgPreview = session.messages
					.slice(0, 5)
					.map((m, i) => {
						const preview = m.content.length > 100 ? `${m.content.slice(0, 100)}...` : m.content;
						return `${i + 1}. **${m.role}**: ${preview}`;
					})
					.join("\n");

				return `## Session: ${session.title}

**ID:** ${session.id}
**Created:** ${session.createdAt}
**Expires:** ${session.expiresAt || "Never"}
${session.description ? `\n**Description:** ${session.description}` : ""}

### Metadata
- **Type:** ${session.metadata?.taskType || "Unknown"}
- **Task:** ${session.metadata?.taskDescription || "N/A"}
- **Duration:** ${session.metadata?.duration ? `${session.metadata.duration} minutes` : "N/A"}
- **Success:** ${session.metadata?.success !== undefined ? (session.metadata.success ? "✅" : "❌") : "N/A"}
- **Impact:** ${session.metadata?.impact || "N/A"}
- **Source:** ${session.metadata?.source || "self"}
${session.tags?.length ? `- **Tags:** ${session.tags.join(", ")}` : ""}

### Messages (${session.messages.length})
${msgPreview}
${session.messages.length > 5 ? `\n... and ${session.messages.length - 5} more messages` : ""}`;
			}

			case "list": {
				const sessions = manager.listSessions({
					limit: params.limit || 20,
					tag: params.tag,
					type: params.type,
				});

				if (sessions.length === 0) {
					return "No sessions found.";
				}

				const rows = sessions
					.map((s) => {
						const id = s.id.length > 20 ? `${s.id.slice(0, 20)}...` : s.id;
						const title = s.title.length > 30 ? `${s.title.slice(0, 30)}...` : s.title;
						const taskType = s.metadata?.taskType || "-";
						const date = s.createdAt.split("T")[0];
						return `| ${id} | ${title} | ${taskType} | ${date} | ${s.messages.length} |`;
					})
					.join("\n");

				return `## Shared Sessions (${sessions.length})

| ID | Title | Type | Created | Messages |
|----|-------|------|---------|----------|
${rows}

Use \`conversationSharing({action: 'get', sessionId: 'ID'})\` to view a specific session.`;
			}

			case "delete": {
				if (!params.sessionId) {
					return "Error: sessionId is required for delete action";
				}

				const deleted = manager.deleteSession(params.sessionId);
				return deleted
					? `Session ${params.sessionId} deleted successfully.`
					: `Session not found: ${params.sessionId}`;
			}

			case "formats": {
				return `## Supported Export Formats

| Format | Description | Best For |
|--------|-------------|----------|
| **json** | Structured JSON format | API integration, backup |
| **markdown** | Human-readable Markdown | Documentation, sharing |
| **html** | Styled HTML page | Browser viewing, archiving |
| **csv** | Comma-separated values | Data analysis, spreadsheets |`;
			}

			case "stats": {
				const stats = manager.getStats();
				const exportsByFormat =
					Object.entries(stats.exportsByFormat)
						.map(([fmt, count]) => `- ${fmt}: ${count}`)
						.join("\n") || "- No exports yet";

				const importsBySource =
					Object.entries(stats.importsBySource)
						.map(([src, count]) => `- ${src}: ${count}`)
						.join("\n") || "- No imports yet";

				return `## Conversation Sharing Statistics

**Total Exports:** ${stats.totalExports}
**Total Imports:** ${stats.totalImports}
**Sessions Shared:** ${stats.sessionsShared}

### Exports by Format
${exportsByFormat}

### Imports by Source
${importsBySource}

**Last Export:** ${stats.lastExportTime || "Never"}
**Last Import:** ${stats.lastImportTime || "Never"}`;
			}

			case "config": {
				const config = manager.getConfig();
				return `## Conversation Sharing Configuration

| Setting | Value |
|---------|-------|
| **Enabled** | ${config.enabled} |
| **Data Directory** | ${config.dataDir} |
| **Max Session Size** | ${(config.maxSessionSize / 1024 / 1024).toFixed(1)} MB |
| **Default Expiry** | ${config.defaultExpiryDays} days |
| **Anonymization Allowed** | ${config.allowAnonymization} |
| **Max Sessions Stored** | ${config.maxSessionsStored} |

Use \`conversationSharing({action: 'enable'})\` or \`conversationSharing({action: 'disable'})\` to toggle sharing.`;
			}

			case "enable": {
				manager.setEnabled(true);
				return "Conversation sharing enabled.";
			}

			case "disable": {
				manager.setEnabled(false);
				return "Conversation sharing disabled.";
			}

			case "clear": {
				manager.clearSessions();
				return "All shared sessions cleared.";
			}

			case "reset": {
				manager.resetStats();
				return "Statistics reset.";
			}

			case "help": {
				return `## Conversation Sharing Tool (OpenHands Pattern)

Export, import, and share evolution sessions for collaboration.

### Actions

| Action | Description |
|--------|-------------|
| \`create\` | Create a new shareable session |
| \`export\` | Export session to JSON/Markdown/HTML/CSV |
| \`import\` | Import a shared session |
| \`share\` | Generate a share link |
| \`get\` | Get session details |
| \`list\` | List all shared sessions |
| \`delete\` | Delete a session |
| \`formats\` | Show supported export formats |
| \`stats\` | View sharing statistics |
| \`config\` | View configuration |
| \`enable\` | Enable sharing |
| \`disable\` | Disable sharing |
| \`clear\` | Clear all sessions |
| \`reset\` | Reset statistics |

### Privacy Features

- **Anonymization:** Automatically redacts emails, phone numbers, API keys, file paths
- **Expiry:** Sessions automatically expire after configurable days
- **Local Storage:** All sessions stored locally by default

Inspired by OpenHands Cloud conversation sharing feature.`;
			}

			default:
				return `Unknown action: ${params.action}. Use 'help' to see available actions.`;
		}
	} catch (error) {
		return `Error: ${error instanceof Error ? error.message : String(error)}`;
	}
}

export default conversationSharingToolDefinition;
