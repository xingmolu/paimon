/**
 * Desktop Notifications Module (Aider Pattern)
 *
 * Cross-platform desktop notifications for when the agent is waiting for input.
 * Supports macOS (terminal-notifier, AppleScript), Linux (notify-send, zenity),
 * and Windows (PowerShell). Also supports custom notification commands and
 * remote notifications via services like Apprise.
 *
 * Inspired by Aider's notifications feature:
 * https://aider.chat/docs/usage/notifications.html
 */

import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// Types
export interface DesktopNotificationConfig {
	enabled: boolean;
	sound: boolean;
	customCommand: string | null;
	notifyOnComplete: boolean;
	notifyOnError: boolean;
	notifyOnInput: boolean;
	title: string;
}

export interface NotificationStats {
	totalSent: number;
	successful: number;
	failed: number;
	byPlatform: Record<string, number>;
	byType: Record<string, number>;
	lastNotificationTime: string | null;
}

export interface NotificationResult {
	success: boolean;
	method: string;
	error?: string;
}

export type NotificationType = "complete" | "error" | "input" | "custom";

const DEFAULT_CONFIG: DesktopNotificationConfig = {
	enabled: false,
	sound: false,
	customCommand: null,
	notifyOnComplete: true,
	notifyOnError: true,
	notifyOnInput: true,
	title: "Paimon Agent",
};

let managerInstance: NotificationManager | null = null;

export class NotificationManager {
	private config: DesktopNotificationConfig;
	private stats: NotificationStats;
	private dataPath: string;
	private platform: string;

	constructor() {
		this.config = { ...DEFAULT_CONFIG };
		this.platform = os.platform();
		this.dataPath = path.join(process.env.HOME || ".", ".paimon", "notifications.json");
		this.stats = {
			totalSent: 0,
			successful: 0,
			failed: 0,
			byPlatform: {},
			byType: {},
			lastNotificationTime: null,
		};
		this.loadData();
	}

	private loadData(): void {
		try {
			if (fs.existsSync(this.dataPath)) {
				const data = JSON.parse(fs.readFileSync(this.dataPath, "utf-8"));
				this.config = { ...DEFAULT_CONFIG, ...data.config };
				this.stats = { ...this.stats, ...data.stats };
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
			fs.writeFileSync(
				this.dataPath,
				JSON.stringify(
					{
						config: this.config,
						stats: this.stats,
					},
					null,
					2,
				),
			);
		} catch (error) {
			console.error("Failed to save notification data:", error);
		}
	}

	private updateStats(type: NotificationType, success: boolean): void {
		this.stats.totalSent++;
		if (success) {
			this.stats.successful++;
		} else {
			this.stats.failed++;
		}
		this.stats.byPlatform[this.platform] = (this.stats.byPlatform[this.platform] || 0) + 1;
		this.stats.byType[type] = (this.stats.byType[type] || 0) + 1;
		this.stats.lastNotificationTime = new Date().toISOString();
		this.saveData();
	}

	/**
	 * Detect the best notification method for the current platform
	 */
	public detectNotificationMethod(): string {
		switch (this.platform) {
			case "darwin":
				// macOS: Check for terminal-notifier first, then AppleScript
				try {
					childProcess.execSync("which terminal-notifier", { stdio: "pipe" });
					return "terminal-notifier";
				} catch {
					return "applescript";
				}

			case "linux":
				// Linux: Check for notify-send, then zenity
				try {
					childProcess.execSync("which notify-send", { stdio: "pipe" });
					return "notify-send";
				} catch {
					try {
						childProcess.execSync("which zenity", { stdio: "pipe" });
						return "zenity";
					} catch {
						return "none";
					}
				}

			case "win32":
				// Windows: PowerShell
				return "powershell";

			default:
				return "none";
		}
	}

	/**
	 * Send a notification using the best available method
	 */
	public async send(
		message: string,
		type: NotificationType = "custom",
		title?: string,
	): Promise<NotificationResult> {
		if (!this.config.enabled) {
			return {
				success: false,
				method: "disabled",
				error: "Notifications are disabled",
			};
		}

		const notificationTitle = title || this.config.title;
		let result: NotificationResult;

		// Use custom command if set
		if (this.config.customCommand) {
			result = await this.sendWithCustomCommand(
				notificationTitle,
				message,
				this.config.customCommand,
			);
		} else {
			// Use platform-specific method
			switch (this.platform) {
				case "darwin":
					result = await this.sendMacOS(notificationTitle, message);
					break;
				case "linux":
					result = await this.sendLinux(notificationTitle, message);
					break;
				case "win32":
					result = await this.sendWindows(notificationTitle, message);
					break;
				default:
					result = {
						success: false,
						method: "unsupported",
						error: `Unsupported platform: ${this.platform}`,
					};
			}
		}

		this.updateStats(type, result.success);
		return result;
	}

	/**
	 * Send notification on macOS
	 */
	private async sendMacOS(title: string, message: string): Promise<NotificationResult> {
		const method = this.detectNotificationMethod();

		if (method === "terminal-notifier") {
			try {
				const args = ["-title", title, "-message", message];
				if (this.config.sound) {
					args.push("-sound", "default");
				}
				childProcess.execFileSync("terminal-notifier", args);
				return { success: true, method: "terminal-notifier" };
			} catch (error) {
				return {
					success: false,
					method: "terminal-notifier",
					error: String(error),
				};
			}
		}

		if (method === "applescript") {
			try {
				const script = `display notification "${message.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}"${this.config.sound ? ' sound name "default"' : ""}`;
				childProcess.execFileSync("osascript", ["-e", script]);
				return { success: true, method: "applescript" };
			} catch (error) {
				return {
					success: false,
					method: "applescript",
					error: String(error),
				};
			}
		}

		return {
			success: false,
			method: "none",
			error: "No notification method available on macOS",
		};
	}

	/**
	 * Send notification on Linux
	 */
	private async sendLinux(title: string, message: string): Promise<NotificationResult> {
		const method = this.detectNotificationMethod();

		if (method === "notify-send") {
			try {
				const args = [title, message];
				if (this.config.sound) {
					args.push("--hint", "string:sound-name:default");
				}
				childProcess.execFileSync("notify-send", args);
				return { success: true, method: "notify-send" };
			} catch (error) {
				return {
					success: false,
					method: "notify-send",
					error: String(error),
				};
			}
		}

		if (method === "zenity") {
			try {
				childProcess.execFileSync("zenity", ["--notification", "--text", `${title}: ${message}`]);
				return { success: true, method: "zenity" };
			} catch (error) {
				return {
					success: false,
					method: "zenity",
					error: String(error),
				};
			}
		}

		return {
			success: false,
			method: "none",
			error: "No notification method available on Linux",
		};
	}

	/**
	 * Send notification on Windows
	 */
	private async sendWindows(title: string, message: string): Promise<NotificationResult> {
		try {
			// Use PowerShell toast notification
			const script = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

$template = @"
<toast>
    <visual>
        <binding template="ToastText02">
            <text id="1">${title.replace(/"/g, "")}</text>
            <text id="2">${message.replace(/"/g, "")}</text>
        </binding>
    </visual>
</toast>
"@

$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml($template)
$toast = New-Object Windows.UI.Notifications.ToastNotification $xml
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Paimon Agent").Show($toast)
`;

			childProcess.execFileSync("powershell", ["-Command", script.replace(/\n/g, " ")]);
			return { success: true, method: "powershell" };
		} catch {
			// Fallback to simple message box
			try {
				const script = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show("${message.replace(/"/g, "")}", "${title.replace(/"/g, "")}")`;
				childProcess.execFileSync("powershell", ["-Command", script]);
				return { success: true, method: "powershell-msgbox" };
			} catch (error) {
				return {
					success: false,
					method: "powershell",
					error: String(error),
				};
			}
		}
	}

	/**
	 * Send notification using custom command
	 */
	private async sendWithCustomCommand(
		title: string,
		message: string,
		command: string,
	): Promise<NotificationResult> {
		try {
			// Replace placeholders in command
			const processedCommand = command
				.replace(/\{title\}/g, `"${title}"`)
				.replace(/\{message\}/g, `"${message}"`);

			childProcess.execSync(processedCommand, { stdio: "pipe" });
			return { success: true, method: "custom" };
		} catch (error) {
			return {
				success: false,
				method: "custom",
				error: String(error),
			};
		}
	}

	// Configuration methods
	public getConfig(): DesktopNotificationConfig {
		return { ...this.config };
	}

	public updateConfig(updates: Partial<DesktopNotificationConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveData();
	}

	public enable(): void {
		this.config.enabled = true;
		this.saveData();
	}

	public disable(): void {
		this.config.enabled = false;
		this.saveData();
	}

	public isEnabled(): boolean {
		return this.config.enabled;
	}

	// Statistics methods
	public getStats(): NotificationStats {
		return { ...this.stats };
	}

	public resetStats(): void {
		this.stats = {
			totalSent: 0,
			successful: 0,
			failed: 0,
			byPlatform: {},
			byType: {},
			lastNotificationTime: null,
		};
		this.saveData();
	}

	// Status method
	public getStatus(): {
		enabled: boolean;
		platform: string;
		method: string;
		customCommand: string | null;
	} {
		return {
			enabled: this.config.enabled,
			platform: this.platform,
			method: this.detectNotificationMethod(),
			customCommand: this.config.customCommand,
		};
	}

	// Convenience methods for common notification types
	public async notifyComplete(message = "Agent has finished working"): Promise<NotificationResult> {
		if (!this.config.notifyOnComplete) {
			return { success: false, method: "disabled", error: "Complete notifications disabled" };
		}
		return this.send(message, "complete");
	}

	public async notifyError(message = "Agent encountered an error"): Promise<NotificationResult> {
		if (!this.config.notifyOnError) {
			return { success: false, method: "disabled", error: "Error notifications disabled" };
		}
		return this.send(message, "error");
	}

	public async notifyInput(message = "Agent is waiting for input"): Promise<NotificationResult> {
		if (!this.config.notifyOnInput) {
			return { success: false, method: "disabled", error: "Input notifications disabled" };
		}
		return this.send(message, "input");
	}
}

/**
 * Get the global NotificationManager instance
 */
export function getNotificationManager(): NotificationManager {
	if (!managerInstance) {
		managerInstance = new NotificationManager();
	}
	return managerInstance;
}

/**
 * Send a notification using the global manager
 */
export async function sendNotification(
	message: string,
	type: NotificationType = "custom",
	title?: string,
): Promise<NotificationResult> {
	return getNotificationManager().send(message, type, title);
}
