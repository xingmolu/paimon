/**
 * Integration Manager (OpenHands Cloud Pattern)
 *
 * Manages external integrations (Slack, Jira, Linear) for notifications
 * and feedback capture during evolution sessions.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// Types for integrations
export interface Integration {
	id: string;
	type: "slack" | "jira" | "linear" | "github" | "discord" | "webhook";
	name: string;
	enabled: boolean;
	config: Record<string, unknown>;
	createdAt: string;
	lastUsed?: string;
	stats: {
		eventsSent: number;
		eventsFailed: number;
		lastEvent?: string;
	};
}

export interface IntegrationEvent {
	id: string;
	type:
		| "session_start"
		| "session_complete"
		| "task_start"
		| "task_complete"
		| "task_failed"
		| "capability_added"
		| "error"
		| "milestone";
	timestamp: string;
	integrationId: string;
	data: {
		taskType?: string;
		taskDescription?: string;
		duration?: number;
		success?: boolean;
		errors?: string[];
		capability?: string;
		message?: string;
		metadata?: Record<string, unknown>;
	};
	status: "pending" | "sent" | "failed";
	error?: string;
}

export interface NotificationConfig {
	enabled: boolean;
	events: string[]; // Event types to notify on
	template?: string; // Custom message template
	mentions?: string[]; // User IDs to mention
}

export interface IntegrationConfig {
	integrations: Integration[];
	events: IntegrationEvent[];
	notifications: Record<string, NotificationConfig>;
	enabled: boolean;
	retentionDays: number;
}

// Default config
const DEFAULT_CONFIG: IntegrationConfig = {
	integrations: [],
	events: [],
	notifications: {},
	enabled: true,
	retentionDays: 30,
};

// Config file path
const CONFIG_DIR = path.join(os.homedir(), ".paimon");
const CONFIG_FILE = path.join(CONFIG_DIR, "integrations.json");

/**
 * Integration Manager class for managing external integrations
 */
export class IntegrationManager {
	private config: IntegrationConfig;
	private initialized = false;

	constructor() {
		this.config = { ...DEFAULT_CONFIG };
		this.loadConfig();
	}

	/**
	 * Load config from disk
	 */
	private loadConfig(): void {
		try {
			if (fs.existsSync(CONFIG_FILE)) {
				const data = fs.readFileSync(CONFIG_FILE, "utf-8");
				this.config = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
			}
			this.initialized = true;
		} catch (error) {
			console.error("Failed to load integration config:", error);
			this.config = { ...DEFAULT_CONFIG };
			this.initialized = true;
		}
	}

	/**
	 * Save config to disk
	 */
	private saveConfig(): void {
		try {
			if (!fs.existsSync(CONFIG_DIR)) {
				fs.mkdirSync(CONFIG_DIR, { recursive: true });
			}
			fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
		} catch (error) {
			console.error("Failed to save integration config:", error);
		}
	}

	// ==================== Integration Management ====================

	/**
	 * Add a new integration
	 */
	addIntegration(
		type: Integration["type"],
		name: string,
		config: Record<string, unknown>,
	): Integration {
		const id = `${type}-${Date.now()}`;
		const integration: Integration = {
			id,
			type,
			name,
			enabled: true,
			config,
			createdAt: new Date().toISOString(),
			stats: {
				eventsSent: 0,
				eventsFailed: 0,
			},
		};

		this.config.integrations.push(integration);
		this.saveConfig();

		return integration;
	}

	/**
	 * Get an integration by ID
	 */
	getIntegration(id: string): Integration | undefined {
		return this.config.integrations.find((i) => i.id === id);
	}

	/**
	 * List all integrations
	 */
	listIntegrations(type?: Integration["type"]): Integration[] {
		if (type) {
			return this.config.integrations.filter((i) => i.type === type);
		}
		return [...this.config.integrations];
	}

	/**
	 * Update an integration
	 */
	updateIntegration(
		id: string,
		updates: Partial<Pick<Integration, "name" | "enabled" | "config">>,
	): Integration | undefined {
		const index = this.config.integrations.findIndex((i) => i.id === id);
		if (index === -1) return undefined;

		this.config.integrations[index] = {
			...this.config.integrations[index],
			...updates,
		};

		this.saveConfig();
		return this.config.integrations[index];
	}

	/**
	 * Remove an integration
	 */
	removeIntegration(id: string): boolean {
		const index = this.config.integrations.findIndex((i) => i.id === id);
		if (index === -1) return false;

		this.config.integrations.splice(index, 1);
		this.saveConfig();

		return true;
	}

	// ==================== Event Management ====================

	/**
	 * Send an event to all enabled integrations
	 */
	async sendEvent(
		type: IntegrationEvent["type"],
		data: IntegrationEvent["data"],
	): Promise<IntegrationEvent[]> {
		const events: IntegrationEvent[] = [];
		const enabledIntegrations = this.config.integrations.filter((i) => i.enabled);

		for (const integration of enabledIntegrations) {
			const event: IntegrationEvent = {
				id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
				type,
				timestamp: new Date().toISOString(),
				integrationId: integration.id,
				data,
				status: "pending",
			};

			try {
				await this.sendToIntegration(integration, event);
				event.status = "sent";
				integration.stats.eventsSent++;
				integration.stats.lastEvent = event.timestamp;
				integration.lastUsed = event.timestamp;
			} catch (error) {
				event.status = "failed";
				event.error = error instanceof Error ? error.message : String(error);
				integration.stats.eventsFailed++;
			}

			events.push(event);
			this.config.events.push(event);
		}

		this.saveConfig();
		return events;
	}

	/**
	 * Send event to a specific integration
	 */
	private async sendToIntegration(
		integration: Integration,
		event: IntegrationEvent,
	): Promise<void> {
		switch (integration.type) {
			case "slack":
				await this.sendToSlack(integration, event);
				break;
			case "jira":
				await this.sendToJira(integration, event);
				break;
			case "linear":
				await this.sendToLinear(integration, event);
				break;
			case "github":
				await this.sendToGitHub(integration, event);
				break;
			case "discord":
				await this.sendToDiscord(integration, event);
				break;
			case "webhook":
				await this.sendToWebhook(integration, event);
				break;
			default:
				throw new Error(`Unknown integration type: ${integration.type}`);
		}
	}

	// ==================== Integration Implementations ====================

	/**
	 * Send to Slack webhook
	 */
	private async sendToSlack(integration: Integration, event: IntegrationEvent): Promise<void> {
		const webhookUrl = integration.config.webhookUrl as string;
		if (!webhookUrl) {
			throw new Error("Slack webhook URL not configured");
		}

		const message = this.formatSlackMessage(event);
		const response = await fetch(webhookUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(message),
		});

		if (!response.ok) {
			throw new Error(`Slack API error: ${response.statusText}`);
		}
	}

	/**
	 * Format Slack message
	 */
	private formatSlackMessage(event: IntegrationEvent): Record<string, unknown> {
		const emoji = this.getEventEmoji(event.type);
		const color = this.getEventColor(event.type);

		return {
			attachments: [
				{
					color,
					blocks: [
						{
							type: "header",
							text: {
								type: "plain_text",
								text: `${emoji} Paimon: ${this.formatEventType(event.type)}`,
							},
						},
						{
							type: "section",
							text: {
								type: "mrkdwn",
								text: this.formatEventDescription(event),
							},
						},
						{
							type: "context",
							elements: [
								{
									type: "mrkdwn",
									text: `_${new Date(event.timestamp).toLocaleString()}_`,
								},
							],
						},
					],
				},
			],
		};
	}

	/**
	 * Send to Jira
	 */
	private async sendToJira(integration: Integration, event: IntegrationEvent): Promise<void> {
		const { baseUrl, apiToken, email } = integration.config as {
			baseUrl: string;
			apiToken: string;
			email: string;
		};

		if (!baseUrl || !apiToken || !email) {
			throw new Error("Jira configuration incomplete");
		}

		// Create a comment on a configured issue or create a new issue
		const issueKey = integration.config.issueKey as string;
		const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");

		if (issueKey) {
			// Add comment to existing issue
			const response = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}/comment`, {
				method: "POST",
				headers: {
					Authorization: `Basic ${auth}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					body: {
						type: "doc",
						version: 1,
						content: [
							{
								type: "paragraph",
								content: [
									{
										type: "text",
										text: this.formatEventDescription(event),
									},
								],
							},
						],
					},
				}),
			});

			if (!response.ok) {
				throw new Error(`Jira API error: ${response.statusText}`);
			}
		}
	}

	/**
	 * Send to Linear
	 */
	private async sendToLinear(integration: Integration, event: IntegrationEvent): Promise<void> {
		const { apiKey, teamId } = integration.config as {
			apiKey: string;
			teamId: string;
		};

		if (!apiKey || !teamId) {
			throw new Error("Linear configuration incomplete");
		}

		// Create a comment on a configured issue
		const issueId = integration.config.issueId as string;

		if (issueId) {
			const response = await fetch("https://api.linear.app/graphql", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					query: `
						mutation CreateComment($issueId: String!, $body: String!) {
							commentCreate(input: { issueId: $issueId, body: $body }) {
								success
								comment { id }
							}
						}
					`,
					variables: {
						issueId,
						body: this.formatEventDescription(event),
					},
				}),
			});

			if (!response.ok) {
				throw new Error(`Linear API error: ${response.statusText}`);
			}
		}
	}

	/**
	 * Send to GitHub (create issue comment or commit status)
	 */
	private async sendToGitHub(integration: Integration, event: IntegrationEvent): Promise<void> {
		const { token, owner, repo } = integration.config as {
			token: string;
			owner: string;
			repo: string;
		};

		if (!token || !owner || !repo) {
			throw new Error("GitHub configuration incomplete");
		}

		const issueNumber = integration.config.issueNumber as number;

		if (issueNumber) {
			const response = await fetch(
				`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						body: this.formatEventDescription(event),
					}),
				},
			);

			if (!response.ok) {
				throw new Error(`GitHub API error: ${response.statusText}`);
			}
		}
	}

	/**
	 * Send to Discord webhook
	 */
	private async sendToDiscord(integration: Integration, event: IntegrationEvent): Promise<void> {
		const webhookUrl = integration.config.webhookUrl as string;
		if (!webhookUrl) {
			throw new Error("Discord webhook URL not configured");
		}

		const embed = {
			title: `${this.getEventEmoji(event.type)} Paimon: ${this.formatEventType(event.type)}`,
			description: this.formatEventDescription(event),
			color: Number.parseInt(this.getEventColor(event.type).replace("#", ""), 16),
			timestamp: event.timestamp,
		};

		const response = await fetch(webhookUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ embeds: [embed] }),
		});

		if (!response.ok) {
			throw new Error(`Discord API error: ${response.statusText}`);
		}
	}

	/**
	 * Send to generic webhook
	 */
	private async sendToWebhook(integration: Integration, event: IntegrationEvent): Promise<void> {
		const webhookUrl = integration.config.url as string;
		if (!webhookUrl) {
			throw new Error("Webhook URL not configured");
		}

		const headers = (integration.config.headers as Record<string, string>) || {};
		const response = await fetch(webhookUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...headers,
			},
			body: JSON.stringify({
				event: event.type,
				timestamp: event.timestamp,
				data: event.data,
			}),
		});

		if (!response.ok) {
			throw new Error(`Webhook error: ${response.statusText}`);
		}
	}

	// ==================== Formatting Helpers ====================

	/**
	 * Get emoji for event type
	 */
	private getEventEmoji(type: IntegrationEvent["type"]): string {
		const emojis: Record<IntegrationEvent["type"], string> = {
			session_start: "🚀",
			session_complete: "✅",
			task_start: "▶️",
			task_complete: "✨",
			task_failed: "❌",
			capability_added: "🎯",
			error: "⚠️",
			milestone: "🏆",
		};
		return emojis[type] || "📢";
	}

	/**
	 * Get color for event type
	 */
	private getEventColor(type: IntegrationEvent["type"]): string {
		const colors: Record<IntegrationEvent["type"], string> = {
			session_start: "#3498db",
			session_complete: "#2ecc71",
			task_start: "#9b59b6",
			task_complete: "#27ae60",
			task_failed: "#e74c3c",
			capability_added: "#f39c12",
			error: "#c0392b",
			milestone: "#f1c40f",
		};
		return colors[type] || "#95a5a6";
	}

	/**
	 * Format event type for display
	 */
	private formatEventType(type: IntegrationEvent["type"]): string {
		const names: Record<IntegrationEvent["type"], string> = {
			session_start: "Session Started",
			session_complete: "Session Completed",
			task_start: "Task Started",
			task_complete: "Task Completed",
			task_failed: "Task Failed",
			capability_added: "Capability Added",
			error: "Error Occurred",
			milestone: "Milestone Reached",
		};
		return names[type] || type;
	}

	/**
	 * Format event description
	 */
	private formatEventDescription(event: IntegrationEvent): string {
		const { type, data } = event;

		switch (type) {
			case "session_start":
				return "Starting new evolution session";
			case "session_complete":
				return `Evolution session completed (${data.duration}s) - ${data.success ? "Success" : "Failed"}`;
			case "task_start":
				return `Starting ${data.taskType} task: ${data.taskDescription}`;
			case "task_complete":
				return `Completed ${data.taskType} task: ${data.taskDescription} (${data.duration}s)`;
			case "task_failed":
				return `Failed ${data.taskType} task: ${data.taskDescription}\nErrors: ${data.errors?.join(", ")}`;
			case "capability_added":
				return `New capability added: ${data.capability}`;
			case "error":
				return `Error: ${data.message}`;
			case "milestone":
				return `Milestone reached: ${data.message}`;
			default:
				return JSON.stringify(data);
		}
	}

	// ==================== Event History ====================

	/**
	 * Get event history
	 */
	getEventHistory(integrationId?: string, limit = 50): IntegrationEvent[] {
		let events = [...this.config.events].reverse();

		if (integrationId) {
			events = events.filter((e) => e.integrationId === integrationId);
		}

		return events.slice(0, limit);
	}

	/**
	 * Clear old events
	 */
	clearOldEvents(): number {
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - this.config.retentionDays);

		const before = this.config.events.length;
		this.config.events = this.config.events.filter((e) => new Date(e.timestamp) > cutoff);
		const removed = before - this.config.events.length;

		this.saveConfig();
		return removed;
	}

	// ==================== Configuration ====================

	/**
	 * Get configuration
	 */
	getConfig(): IntegrationConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration
	 */
	updateConfig(updates: Partial<IntegrationConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveConfig();
	}

	/**
	 * Enable/disable all integrations
	 */
	setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.saveConfig();
	}

	// ==================== Statistics ====================

	/**
	 * Get statistics
	 */
	getStats(): {
		totalIntegrations: number;
		enabledIntegrations: number;
		totalEvents: number;
		eventsByType: Record<string, number>;
		eventsByStatus: Record<string, number>;
		eventsByIntegration: Record<string, number>;
	} {
		const eventsByType: Record<string, number> = {};
		const eventsByStatus: Record<string, number> = {};
		const eventsByIntegration: Record<string, number> = {};

		for (const event of this.config.events) {
			eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
			eventsByStatus[event.status] = (eventsByStatus[event.status] || 0) + 1;
			eventsByIntegration[event.integrationId] =
				(eventsByIntegration[event.integrationId] || 0) + 1;
		}

		return {
			totalIntegrations: this.config.integrations.length,
			enabledIntegrations: this.config.integrations.filter((i) => i.enabled).length,
			totalEvents: this.config.events.length,
			eventsByType,
			eventsByStatus,
			eventsByIntegration,
		};
	}

	/**
	 * Reset statistics
	 */
	resetStats(): void {
		for (const integration of this.config.integrations) {
			integration.stats = {
				eventsSent: 0,
				eventsFailed: 0,
			};
		}
		this.config.events = [];
		this.saveConfig();
	}

	// ==================== Notification Config ====================

	/**
	 * Set notification config for an integration
	 */
	setNotificationConfig(integrationId: string, config: NotificationConfig): void {
		this.config.notifications[integrationId] = config;
		this.saveConfig();
	}

	/**
	 * Get notification config
	 */
	getNotificationConfig(integrationId: string): NotificationConfig | undefined {
		return this.config.notifications[integrationId];
	}

	/**
	 * Test an integration
	 */
	async testIntegration(id: string): Promise<{ success: boolean; error?: string }> {
		const integration = this.getIntegration(id);
		if (!integration) {
			return { success: false, error: "Integration not found" };
		}

		try {
			await this.sendToIntegration(integration, {
				id: "test",
				type: "milestone",
				timestamp: new Date().toISOString(),
				integrationId: id,
				data: { message: "Test notification from Paimon" },
				status: "pending",
			});
			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}
}

// Singleton instance
let managerInstance: IntegrationManager | undefined;

/**
 * Get the global IntegrationManager instance
 */
export function getIntegrationManager(): IntegrationManager {
	if (!managerInstance) {
		managerInstance = new IntegrationManager();
	}
	return managerInstance;
}

/**
 * Execute an integration action
 */
export async function integrationAction(
	action: string,
	params: Record<string, unknown>,
): Promise<unknown> {
	const manager = getIntegrationManager();

	switch (action) {
		case "add":
			return manager.addIntegration(
				params.type as Integration["type"],
				params.name as string,
				(params.config as Record<string, unknown>) || {},
			);

		case "get":
			return manager.getIntegration(params.id as string);

		case "list":
			return manager.listIntegrations(params.type as Integration["type"]);

		case "update":
			return manager.updateIntegration(
				params.id as string,
				{
					name: params.name as string | undefined,
					enabled: params.enabled as boolean | undefined,
					config: params.config as Record<string, unknown> | undefined,
				} as Parameters<typeof manager.updateIntegration>[1],
			);

		case "remove":
			return manager.removeIntegration(params.id as string);

		case "enable":
			return manager.updateIntegration(params.id as string, { enabled: true });

		case "disable":
			return manager.updateIntegration(params.id as string, { enabled: false });

		case "test":
			return manager.testIntegration(params.id as string);

		case "send":
			return manager.sendEvent(
				params.eventType as IntegrationEvent["type"],
				(params.data as IntegrationEvent["data"]) || {},
			);

		case "events":
			return manager.getEventHistory(
				params.integrationId as string,
				params.limit as number | undefined,
			);

		case "clear-events":
			return { removed: manager.clearOldEvents() };

		case "stats":
			return manager.getStats();

		case "config":
			return manager.getConfig();

		case "set-config":
			manager.updateConfig(params.config as IntegrationConfig);
			return { success: true };

		case "enable-all":
			manager.setEnabled(true);
			return { success: true };

		case "disable-all":
			manager.setEnabled(false);
			return { success: true };

		case "reset":
			manager.resetStats();
			return { success: true };

		case "types":
			return {
				types: [
					{ id: "slack", name: "Slack", description: "Send notifications to Slack" },
					{ id: "jira", name: "Jira", description: "Create comments in Jira issues" },
					{ id: "linear", name: "Linear", description: "Create comments in Linear issues" },
					{ id: "github", name: "GitHub", description: "Create comments on GitHub issues" },
					{ id: "discord", name: "Discord", description: "Send notifications to Discord" },
					{ id: "webhook", name: "Webhook", description: "Send to custom webhook" },
				],
				events: [
					{ id: "session_start", name: "Session Start" },
					{ id: "session_complete", name: "Session Complete" },
					{ id: "task_start", name: "Task Start" },
					{ id: "task_complete", name: "Task Complete" },
					{ id: "task_failed", name: "Task Failed" },
					{ id: "capability_added", name: "Capability Added" },
					{ id: "error", name: "Error" },
					{ id: "milestone", name: "Milestone" },
				],
			};

		case "help":
			return {
				actions: [
					"add - Add a new integration (type, name, config)",
					"get - Get integration by ID",
					"list - List all integrations (optional type filter)",
					"update - Update integration (id, name?, enabled?, config?)",
					"remove - Remove an integration",
					"enable - Enable an integration",
					"disable - Disable an integration",
					"test - Test an integration",
					"send - Send event to all enabled integrations",
					"events - Get event history",
					"clear-events - Clear old events",
					"stats - View statistics",
					"config - View configuration",
					"set-config - Update configuration",
					"enable-all - Enable all integrations",
					"disable-all - Disable all integrations",
					"reset - Reset statistics",
					"types - List available integration types and event types",
					"help - Show this help message",
				],
				examples: [
					"integration({action: 'add', type: 'slack', name: 'Team Slack', config: {webhookUrl: 'https://...'}})",
					"integration({action: 'send', eventType: 'task_complete', data: {taskType: 'capability', taskDescription: 'Add tool'}})",
					"integration({action: 'list'})",
				],
			};

		default:
			throw new Error(`Unknown action: ${action}`);
	}
}
