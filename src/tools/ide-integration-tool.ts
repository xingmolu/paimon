/**
 * IDE Integration Tool (Cursor Pattern)
 *
 * Tool for IDE integration management - inline suggestions, notifications, context.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { type IDENotification, getIDEIntegrationManager } from "../ide-integration.js";

function executeIDEIntegrationTool(args: Record<string, unknown>): string {
	const manager = getIDEIntegrationManager();
	const action = String(args.action || "");

	switch (action) {
		case "detect": {
			const ide = manager.detectIDE();
			if (ide) {
				return `## IDE Detected\n\n**IDE:** ${ide}\n**Session Type:** IDE-integrated\n**Ready for inline suggestions**`;
			}
			return `## No IDE Detected\n\n**Terminal:** ${process.env.TERM_PROGRAM || process.env.TERM || "unknown"}\n**Session Type:** Terminal-only\n\nIDE integration features available but not active.`;
		}

		case "context": {
			return manager.formatIDEContext();
		}

		case "suggest": {
			const taskType = args.taskType as string;
			const taskDescription = args.taskDescription as string;
			const files = (args.files as string[]) || [];
			if (!taskType || !taskDescription) {
				return "Error: taskType and taskDescription are required for suggest action";
			}
			const suggestion = manager.generateEvolutionContextSuggestion(
				taskType,
				taskDescription,
				files,
			);
			return `## Inline Suggestion Generated\n\n**ID:** ${suggestion.id}\n**Type:** ${suggestion.type}\n**Source:** ${suggestion.source}\n**Priority:** ${suggestion.priority}\n**File:** ${suggestion.filePath || "none"}\n\n### Content:\n\`\`\`\n${suggestion.content}\n\`\`\`\n\nReady for inline display in IDE.`;
		}

		case "suggest-error": {
			const errorPattern = args.errorPattern as string;
			const solution = args.solution as string;
			const filePath = args.filePath as string | undefined;
			if (!errorPattern || !solution) {
				return "Error: errorPattern and solution are required for suggest-error action";
			}
			const suggestion = manager.generateErrorPatternSuggestion(errorPattern, solution, filePath);
			return `## Error Pattern Suggestion Generated\n\n**ID:** ${suggestion.id}\n**Error Pattern:** ${errorPattern}\n**Solution:** ${solution}\n**Priority:** ${suggestion.priority}\n\n### Content:\n\`\`\`\n${suggestion.content}\n\`\`\`\n\nProactive warning for error prevention.`;
		}

		case "suggest-competitor": {
			const patternName = args.patternName as string;
			const description = args.description as string;
			if (!patternName || !description) {
				return "Error: patternName and description are required for suggest-competitor action";
			}
			const suggestion = manager.generateCompetitorPatternSuggestion(patternName, description);
			return `## Competitor Pattern Suggestion Generated\n\n**ID:** ${suggestion.id}\n**Pattern:** ${patternName}\n**Priority:** ${suggestion.priority}\n\n### Content:\n\`\`\`\n${suggestion.content}\n\`\`\`\n\nSuggestion for evolution improvement.`;
		}

		case "suggestions": {
			const limit = (args.limit as number) || 20;
			return manager.formatSuggestions(limit);
		}

		case "suggestion": {
			const suggestionId = args.suggestionId as string;
			if (!suggestionId) {
				return "Error: suggestionId is required for suggestion action";
			}
			const suggestion = manager.getSuggestion(suggestionId);
			if (!suggestion) {
				return `Suggestion '${suggestionId}' not found.`;
			}
			const lines: string[] = [
				`## Suggestion: ${suggestion.id}`,
				"",
				`**Type:** ${suggestion.type}`,
				`**Source:** ${suggestion.source}`,
				`**Priority:** ${suggestion.priority}`,
				`**File:** ${suggestion.filePath || "none"}`,
				`**Line Range:** ${suggestion.lineRange ? `${suggestion.lineRange.start}-${suggestion.lineRange.end}` : "none"}`,
				`**Reason:** ${suggestion.reason}`,
				`**Timestamp:** ${suggestion.timestamp}`,
				"",
				"### Content:",
				"",
				`\`\`\`\n${suggestion.content}\n\`\`\``,
			];
			return lines.join("\n");
		}

		case "apply": {
			const suggestionId = args.suggestionId as string;
			if (!suggestionId) {
				return "Error: suggestionId is required for apply action";
			}
			const applied = manager.applySuggestion(suggestionId);
			if (applied) {
				return `Suggestion '${suggestionId}' marked as applied.`;
			}
			return `Suggestion '${suggestionId}' not found.`;
		}

		case "notify": {
			const level = args.level as IDENotification["level"];
			const title = args.title as string;
			const message = args.message as string;
			const details = args.details as Record<string, unknown> | undefined;
			if (!level || !title || !message) {
				return "Error: level, title, and message are required for notify action";
			}
			const notification = manager.sendNotification(level, title, message, details);
			return `## Notification Sent\n\n**ID:** ${notification.id}\n**Level:** ${notification.level}\n**Title:** ${notification.title}\n**Message:** ${notification.message}\n\nNotification visible in IDE if integrated.`;
		}

		case "notify-event": {
			const eventType = args.eventType as string;
			const description = args.description as string;
			if (!eventType || !description) {
				return "Error: eventType and description are required for notify-event action";
			}
			const notification = manager.notifyEvolutionEvent(eventType, description);
			return `## Evolution Event Notification\n\n**ID:** ${notification.id}\n**Level:** ${notification.level}\n**Event:** ${eventType}\n**Description:** ${notification.message}\n\nNotification sent to IDE.`;
		}

		case "notifications": {
			const limit = (args.limit as number) || 20;
			return manager.formatNotifications(limit);
		}

		case "notification": {
			const notificationId = args.notificationId as string;
			if (!notificationId) {
				return "Error: notificationId is required for notification action";
			}
			const notifications = manager.getRecentNotifications(100);
			const notification = notifications.find((n) => n.id === notificationId);
			if (!notification) {
				return `Notification '${notificationId}' not found.`;
			}
			const lines: string[] = [
				`## Notification: ${notification.id}`,
				"",
				`**Level:** ${notification.level}`,
				`**Title:** ${notification.title}`,
				`**Message:** ${notification.message}`,
				`**Dismissed:** ${notification.dismissed ? "Yes" : "No"}`,
				`**Timestamp:** ${notification.timestamp}`,
			];
			if (notification.details) {
				lines.push("", "**Details:**", "");
				for (const [key, value] of Object.entries(notification.details)) {
					lines.push(`- ${key}: ${value}`);
				}
			}
			return lines.join("\n");
		}

		case "dismiss": {
			const notificationId = args.notificationId as string;
			if (!notificationId) {
				return "Error: notificationId is required for dismiss action";
			}
			const dismissed = manager.dismissNotification(notificationId);
			if (dismissed) {
				return `Notification '${notificationId}' dismissed.`;
			}
			return `Notification '${notificationId}' not found.`;
		}

		case "pending": {
			const pending = manager.getPendingNotifications();
			if (pending.length === 0) {
				return "No pending notifications.";
			}
			const lines: string[] = [
				`## Pending Notifications (${pending.length})`,
				"",
				"| Level | Title | Message |",
				"|-------|-------|---------|",
			];
			for (const n of pending) {
				lines.push(`| ${n.level} | ${n.title.slice(0, 30)} | ${n.message.slice(0, 40)}... |`);
			}
			return lines.join("\n");
		}

		case "files": {
			const openFiles = (args.openFiles as string[]) || [];
			manager.setOpenFiles(openFiles);
			return `## Open Files Set\n\n**Count:** ${openFiles.length} files\n**Max:** ${manager.getConfig().maxOpenFiles}\n\nFiles tracked for IDE context.`;
		}

		case "active-file": {
			const activeFile = args.activeFile as string;
			const line = args.line as number | undefined;
			const column = args.column as number | undefined;
			if (!activeFile) {
				return "Error: activeFile is required for active-file action";
			}
			manager.setActiveFile(activeFile, line && column ? { line, column } : undefined);
			return `## Active File Set\n\n**File:** ${activeFile}\n**Cursor Position:** ${line && column ? `Line ${line}, Column ${column}` : "not set"}\n\nActive file tracked for inline suggestions.`;
		}

		case "stats": {
			return manager.formatStats();
		}

		case "config": {
			const config = manager.getConfig();
			const lines: string[] = [
				"## IDE Integration Configuration",
				"",
				`**Enabled:** ${config.enabled}`,
				`**Auto-detect IDE:** ${config.autoDetectIDE}`,
				`**Inject context at start:** ${config.injectContextAtStart}`,
				`**Max open files:** ${config.maxOpenFiles}`,
				`**Suggestion priority:** ${config.suggestionPriority}`,
				`**Notify on evolution events:** ${config.notifyOnEvolutionEvents}`,
			];
			return lines.join("\n");
		}

		case "enable": {
			manager.setEnabled(true);
			return "IDE integration enabled.";
		}

		case "disable": {
			manager.setEnabled(false);
			return "IDE integration disabled.";
		}

		case "reset": {
			manager.resetStats();
			return "IDE integration statistics reset.";
		}

		case "clear": {
			const target = (args.target as string) || "all";
			if (target === "suggestions") {
				manager.clearSuggestions();
				return "Suggestions cleared.";
			}
			if (target === "notifications") {
				manager.clearNotifications();
				return "Notifications cleared.";
			}
			manager.clearSuggestions();
			manager.clearNotifications();
			return "Suggestions and notifications cleared.";
		}

		case "help": {
			const lines: string[] = [
				"## IDE Integration Tool Help",
				"",
				"### Actions:",
				"",
				"- **detect**: Detect current IDE environment",
				"- **context**: Get current IDE context",
				"- **suggest**: Generate inline suggestion from evolution context",
				"- **suggest-error**: Generate inline suggestion from error pattern",
				"- **suggest-competitor**: Generate inline suggestion from competitor pattern",
				"- **suggestions**: List recent inline suggestions",
				"- **suggestion**: Get specific suggestion details (requires suggestionId)",
				"- **apply**: Mark suggestion as applied (requires suggestionId)",
				"- **notify**: Send IDE notification (requires level, title, message)",
				"- **notify-event**: Send evolution event notification (requires eventType, description)",
				"- **notifications**: List recent notifications",
				"- **notification**: Get specific notification details (requires notificationId)",
				"- **dismiss**: Dismiss a notification (requires notificationId)",
				"- **pending**: Get pending notifications",
				"- **files**: Set open files in IDE (requires openFiles array)",
				"- **active-file**: Set active file (requires activeFile, optional line/column)",
				"- **stats**: View IDE integration statistics",
				"- **config**: View or update configuration",
				"- **enable**: Enable IDE integration",
				"- **disable**: Disable IDE integration",
				"- **reset**: Reset statistics",
				"- **clear**: Clear suggestions or notifications (target: suggestions, notifications, all)",
				"",
				"### Supported IDEs:",
				"",
				"- VSCode (detected via VSCODE_PID)",
				"- JetBrains (detected via IDEA_INITIAL_DIRECTORY)",
				"- Vim (detected via VIM)",
				"- Neovim (detected via NVIM)",
				"- Emacs (detected via EMACS)",
				"- Sublime (detected via SUBlime_TEXT)",
				"- Atom (detected via ATOM_HOME)",
				"- Cursor (detected via CURSOR)",
				"",
				"### Example Usage:",
				"",
				"```",
				"ideIntegration({action: 'detect'})",
				"ideIntegration({action: 'suggest', taskType: 'capability', taskDescription: 'Add new tool', files: ['src/agent.ts']})",
				"ideIntegration({action: 'notify', level: 'success', title: 'Complete', message: 'Task done'})",
				"```",
			];
			return lines.join("\n");
		}

		default:
			return `Unknown action '${action}'. Use 'help' to see available actions.`;
	}
}

export const ideIntegrationTool: AgentTool = {
	name: "ideIntegration",
	label: "IDE Integration",
	description:
		"Manage IDE integration for inline evolution suggestions (Cursor Pattern). Actions: detect, context, suggest, suggest-error, suggest-competitor, suggestions, suggestion, apply, notify, notify-event, notifications, notification, dismiss, pending, files, active-file, stats, config, enable, disable, reset, clear, help.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action: detect, context, suggest, suggest-error, suggest-competitor, suggestions, suggestion, apply, notify, notify-event, notifications, notification, dismiss, pending, files, active-file, stats, config, enable, disable, reset, clear, help",
		}),
		taskType: Type.Optional(
			Type.String({
				description: "Task type for suggest action (capability, reliability, feature)",
			}),
		),
		taskDescription: Type.Optional(
			Type.String({ description: "Task description for suggest action" }),
		),
		files: Type.Optional(
			Type.Array(Type.String(), { description: "Files being worked on for suggest action" }),
		),
		errorPattern: Type.Optional(
			Type.String({ description: "Error pattern for suggest-error action" }),
		),
		solution: Type.Optional(Type.String({ description: "Solution for suggest-error action" })),
		filePath: Type.Optional(
			Type.String({ description: "File path for suggestions/notifications" }),
		),
		patternName: Type.Optional(
			Type.String({ description: "Competitor pattern name for suggest-competitor action" }),
		),
		description: Type.Optional(
			Type.String({ description: "Description for suggest-competitor or notify actions" }),
		),
		suggestionId: Type.Optional(
			Type.String({ description: "Suggestion ID for suggestion/apply actions" }),
		),
		notificationId: Type.Optional(
			Type.String({ description: "Notification ID for notification/dismiss actions" }),
		),
		level: Type.Optional(
			Type.String({ description: "Level for notify action: info, warning, error, success" }),
		),
		title: Type.Optional(Type.String({ description: "Title for notify action" })),
		message: Type.Optional(Type.String({ description: "Message for notify action" })),
		eventType: Type.Optional(Type.String({ description: "Event type for notify-event action" })),
		details: Type.Optional(
			Type.Object({}, { description: "Additional details for notify action" }),
		),
		openFiles: Type.Optional(
			Type.Array(Type.String(), { description: "Open files for files action" }),
		),
		activeFile: Type.Optional(
			Type.String({ description: "Active file path for active-file action" }),
		),
		line: Type.Optional(
			Type.Number({ description: "Cursor line position for active-file action" }),
		),
		column: Type.Optional(
			Type.Number({ description: "Cursor column position for active-file action" }),
		),
		limit: Type.Optional(
			Type.Number({ description: "Limit for suggestions/notifications actions" }),
		),
		target: Type.Optional(
			Type.String({ description: "Target for clear action: suggestions, notifications, all" }),
		),
	}),
	execute: async (
		_toolCallId: string,
		params: unknown,
	): Promise<AgentToolResult<{ success: boolean; action: string }>> => {
		const p = params as Record<string, unknown>;
		const output = executeIDEIntegrationTool(p);
		return {
			content: [{ type: "text", text: output }],
			details: { success: true, action: String(p.action || "") },
		};
	},
};

export default ideIntegrationTool;
