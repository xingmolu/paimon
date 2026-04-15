/**
 * Desktop Notifications Tool (Aider Pattern)
 *
 * Tool for managing desktop notifications when the agent is waiting for input.
 * Cross-platform support for macOS, Linux, and Windows.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { type NotificationType, getNotificationManager } from "../notification-manager.js";
import type { DesktopNotificationConfig, NotificationStats } from "../notification-manager.js";

type NotificationAction =
	| "enable"
	| "disable"
	| "send"
	| "test"
	| "config"
	| "status"
	| "stats"
	| "method"
	| "reset"
	| "help";

function formatConfig(config: DesktopNotificationConfig): string {
	return `## Notification Configuration

- **Enabled:** ${config.enabled ? "Yes" : "No"}
- **Sound:** ${config.sound ? "Yes" : "No"}
- **Custom Command:** ${config.customCommand || "(none)"}
- **Notify on Complete:** ${config.notifyOnComplete ? "Yes" : "No"}
- **Notify on Error:** ${config.notifyOnError ? "Yes" : "No"}
- **Notify on Input:** ${config.notifyOnInput ? "Yes" : "No"}
- **Default Title:** ${config.title}`;
}

function formatStats(stats: NotificationStats): string {
	const rate = stats.totalSent > 0 ? Math.round((stats.successful / stats.totalSent) * 100) : 0;
	return `## Notification Statistics

- **Total Sent:** ${stats.totalSent}
- **Successful:** ${stats.successful}
- **Failed:** ${stats.failed}
- **Success Rate:** ${rate}%
- **Last Notification:** ${stats.lastNotificationTime || "Never"}`;
}

function getHelpMessage(): string {
	return `## Desktop Notifications Tool (Aider Pattern)

Cross-platform desktop notifications for when the agent is waiting for input.

### Actions

| Action | Description |
|--------|-------------|
| \`enable\` | Enable notifications |
| \`disable\` | Disable notifications |
| \`send\` | Send notification (requires message) |
| \`test\` | Send test notification |
| \`config\` | View/update config |
| \`status\` | View current status |
| \`stats\` | View statistics |
| \`method\` | Detect best method |
| \`reset\` | Reset statistics |
| \`help\` | Show this help |

### Usage Examples

\`\`\`typescript
// Enable notifications
notifications({ action: 'enable' })

// Send notification
notifications({ action: 'send', message: 'Task done!' })

// Send with title
notifications({ action: 'send', message: 'Build passed', title: 'Success' })

// Test notifications
notifications({ action: 'test' })

// Configure options
notifications({ action: 'config', sound: true })

// View status
notifications({ action: 'status' })

// Custom notification command for remote notifications
notifications({ action: 'config', customCommand: 'apprise -b "{message}"' })
\`\`\`

### Platform Support

- **macOS:** terminal-notifier (preferred) or AppleScript
- **Linux:** notify-send or zenity
- **Windows:** PowerShell toast notifications

### Custom Commands

Use \`{title}\` and \`{message}\` placeholders in custom commands:

\`\`\`typescript
notifications({ action: 'config', customCommand: 'apprise -b "{message}" "slack://webhook-token"' })
\`\`\`

### Pattern Source

This capability is inspired by Aider's notifications implementation:
https://aider.chat/docs/usage/notifications.html
`;
}

/**
 * Notification tool for desktop notifications when agent is waiting for input
 */
export const notificationsToolDefinition: AgentTool = {
	name: "notifications",
	label: "Desktop Notifications",
	description:
		"Manage desktop notifications for when the agent is waiting for input (Aider Pattern). Cross-platform support for macOS/Linux/Windows. Actions: enable, disable, send, test, config, status, stats, method, reset, help.",
	parameters: Type.Object({
		action: Type.Union([
			Type.Literal("enable"),
			Type.Literal("disable"),
			Type.Literal("send"),
			Type.Literal("test"),
			Type.Literal("config"),
			Type.Literal("status"),
			Type.Literal("stats"),
			Type.Literal("method"),
			Type.Literal("reset"),
			Type.Literal("help"),
		]),
		message: Type.Optional(Type.String()),
		title: Type.Optional(Type.String()),
		type: Type.Optional(
			Type.Union([
				Type.Literal("complete"),
				Type.Literal("error"),
				Type.Literal("input"),
				Type.Literal("custom"),
			]),
		),
		sound: Type.Optional(Type.Boolean()),
		customCommand: Type.Optional(Type.String()),
		notifyOnComplete: Type.Optional(Type.Boolean()),
		notifyOnError: Type.Optional(Type.Boolean()),
		notifyOnInput: Type.Optional(Type.Boolean()),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const manager = getNotificationManager();
		const {
			action,
			message,
			title,
			type,
			sound,
			customCommand,
			notifyOnComplete,
			notifyOnError,
			notifyOnInput,
		} = params as {
			action: NotificationAction;
			message?: string;
			title?: string;
			type?: NotificationType;
			sound?: boolean;
			customCommand?: string;
			notifyOnComplete?: boolean;
			notifyOnError?: boolean;
			notifyOnInput?: boolean;
		};

		switch (action) {
			case "enable": {
				manager.enable();
				const status = manager.getStatus();
				return {
					content: [
						{
							type: "text",
							text: `✅ Notifications enabled\n\nPlatform: ${status.platform}\nMethod: ${status.method}`,
						},
					],
					details: { status },
				};
			}

			case "disable": {
				manager.disable();
				return {
					content: [{ type: "text", text: "❌ Notifications disabled" }],
					details: { enabled: false },
				};
			}

			case "send": {
				if (!message) {
					return {
						content: [
							{ type: "text", text: "❌ Error: 'message' parameter is required for 'send' action" },
						],
						details: { error: "missing message" },
					};
				}

				const result = await manager.send(message, type || "custom", title);
				if (result.success) {
					return {
						content: [
							{
								type: "text",
								text: `✅ Notification sent successfully (method: ${result.method})`,
							},
						],
						details: { method: result.method },
					};
				}
				return {
					content: [{ type: "text", text: `❌ Failed to send notification: ${result.error}` }],
					details: { error: result.error },
				};
			}

			case "test": {
				const testMessage = message || "Test notification from Paimon Agent";
				const testTitle = title || "Test Notification";
				const result = await manager.send(testMessage, "custom", testTitle);

				if (result.success) {
					return {
						content: [
							{
								type: "text",
								text: `✅ Test notification sent successfully (method: ${result.method})`,
							},
						],
						details: { method: result.method },
					};
				}
				return {
					content: [
						{
							type: "text",
							text: `❌ Failed to send test notification: ${result.error}\n\nInstall a notification system for your platform:\n- macOS: brew install terminal-notifier\n- Linux: apt install libnotify-bin\n- Windows: PowerShell is built-in`,
						},
					],
					details: { error: result.error },
				};
			}

			case "config": {
				const updates: Partial<DesktopNotificationConfig> = {};
				if (sound !== undefined) updates.sound = sound;
				if (customCommand !== undefined) updates.customCommand = customCommand || null;
				if (notifyOnComplete !== undefined) updates.notifyOnComplete = notifyOnComplete;
				if (notifyOnError !== undefined) updates.notifyOnError = notifyOnError;
				if (notifyOnInput !== undefined) updates.notifyOnInput = notifyOnInput;

				if (Object.keys(updates).length > 0) {
					manager.updateConfig(updates);
				}

				const config = manager.getConfig();
				return {
					content: [{ type: "text", text: formatConfig(config) }],
					details: { config },
				};
			}

			case "status": {
				const status = manager.getStatus();
				const config = manager.getConfig();
				return {
					content: [
						{
							type: "text",
							text: `## Notification Status

- **Enabled:** ${status.enabled ? "Yes" : "No"}
- **Platform:** ${status.platform}
- **Detection Method:** ${status.method}
- **Custom Command:** ${status.customCommand || "(none)"}

### Notification Types
- **On Complete:** ${config.notifyOnComplete ? "Yes" : "No"}
- **On Error:** ${config.notifyOnError ? "Yes" : "No"}
- **On Input:** ${config.notifyOnInput ? "Yes" : "No"}`,
						},
					],
					details: { status, config },
				};
			}

			case "stats": {
				const stats = manager.getStats();
				return {
					content: [{ type: "text", text: formatStats(stats) }],
					details: { stats },
				};
			}

			case "method": {
				const method = manager.detectNotificationMethod();
				const platform = process.platform;
				return {
					content: [
						{
							type: "text",
							text: `## Detected Notification Method\n\n**Platform:** ${platform}\n**Best Method:** ${method}`,
						},
					],
					details: { platform, method },
				};
			}

			case "reset": {
				manager.resetStats();
				return {
					content: [{ type: "text", text: "✅ Statistics reset" }],
					details: {},
				};
			}

			case "help": {
				return {
					content: [{ type: "text", text: getHelpMessage() }],
					details: {},
				};
			}

			default:
				return {
					content: [
						{
							type: "text",
							text: `❌ Unknown action: ${action}\nUse 'help' to see available actions.`,
						},
					],
					details: { error: "unknown action", action },
				};
		}
	},
};

// Re-export for convenience
export { getNotificationManager } from "../notification-manager.js";
export type {
	DesktopNotificationConfig,
	NotificationStats,
	NotificationResult,
	NotificationType,
} from "../notification-manager.js";
