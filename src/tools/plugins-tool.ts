/**
 * Plugin management tool for Paimon agent
 *
 * Provides commands for listing, enabling, disabling, and managing plugins.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type LoadedPlugin,
	type PluginStats,
	formatPluginDetails,
	formatPluginList,
	formatPluginStats,
	getPluginManager,
	resetPluginManager,
} from "../plugins.js";

/**
 * Plugin tool result type
 */
interface PluginToolResult {
	list?: string;
	stats?: PluginStats;
	details?: LoadedPlugin;
	action?: string;
	name?: string;
	error?: string;
	count?: number;
	dirs?: string[];
}

/**
 * Export the plugin management tool definition
 */
export const pluginsTool: AgentTool = {
	name: "plugins",
	label: "Manage Plugins",
	description:
		"Manage plugins and extensions - list, enable, disable, and view plugin details. Plugins extend Paimon with new tools and hooks.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: list (show plugins), stats (statistics), enable/disable (toggle plugin), details (view plugin), refresh (reload plugins), dirs (manage directories)",
		}),
		name: Type.Optional(
			Type.String({
				description: "Plugin name for enable/disable/details actions",
			}),
		),
		dir: Type.Optional(
			Type.String({
				description: "Directory path to add for dirs action",
			}),
		),
	}),
	execute: async (
		_toolCallId: string,
		params: unknown,
	): Promise<AgentToolResult<PluginToolResult>> => {
		const args = params as {
			action: string;
			name?: string;
			dir?: string;
		};

		const manager = getPluginManager();

		// Initialize if not already
		if (!manager.isInitialized()) {
			manager.initialize();
		}

		switch (args.action) {
			case "list": {
				const plugins = manager.getPlugins();
				if (plugins.size === 0) {
					return {
						content: [
							{
								type: "text",
								text: "No plugins found. Create a plugin directory with a plugin.yaml or plugin.json manifest.",
							},
						],
						details: { list: "no plugins" },
					};
				}
				return {
					content: [{ type: "text", text: formatPluginList(plugins) }],
					details: { list: formatPluginList(plugins) },
				};
			}

			case "stats": {
				const stats = manager.getStats();
				return {
					content: [{ type: "text", text: formatPluginStats(stats) }],
					details: { stats },
				};
			}

			case "enable": {
				if (!args.name) {
					return {
						content: [
							{
								type: "text",
								text: "Error: Plugin name required. Use: plugins({action: 'enable', name: 'plugin-name'})",
							},
						],
						details: { action: "enable", error: "name required" },
					};
				}
				const success = manager.enablePlugin(args.name);
				if (success) {
					return {
						content: [
							{
								type: "text",
								text: `Plugin "${args.name}" enabled successfully.`,
							},
						],
						details: { action: "enable", name: args.name },
					};
				}
				return {
					content: [
						{
							type: "text",
							text: `Error: Plugin "${args.name}" not found. Use plugins({action: 'list'}) to see available plugins.`,
						},
					],
					details: { action: "enable", name: args.name, error: "not found" },
				};
			}

			case "disable": {
				if (!args.name) {
					return {
						content: [
							{
								type: "text",
								text: "Error: Plugin name required. Use: plugins({action: 'disable', name: 'plugin-name'})",
							},
						],
						details: { action: "disable", error: "name required" },
					};
				}
				const success = manager.disablePlugin(args.name);
				if (success) {
					return {
						content: [
							{
								type: "text",
								text: `Plugin "${args.name}" disabled successfully.`,
							},
						],
						details: { action: "disable", name: args.name },
					};
				}
				return {
					content: [
						{
							type: "text",
							text: `Error: Plugin "${args.name}" not found. Use plugins({action: 'list'}) to see available plugins.`,
						},
					],
					details: { action: "disable", name: args.name, error: "not found" },
				};
			}

			case "details": {
				if (!args.name) {
					return {
						content: [
							{
								type: "text",
								text: "Error: Plugin name required. Use: plugins({action: 'details', name: 'plugin-name'})",
							},
						],
						details: { action: "details", error: "name required" },
					};
				}
				const plugin = manager.getPlugin(args.name);
				if (!plugin) {
					return {
						content: [
							{
								type: "text",
								text: `Error: Plugin "${args.name}" not found. Use plugins({action: 'list'}) to see available plugins.`,
							},
						],
						details: { action: "details", name: args.name, error: "not found" },
					};
				}
				return {
					content: [{ type: "text", text: formatPluginDetails(plugin) }],
					details: { details: plugin },
				};
			}

			case "refresh": {
				const loaded = manager.refresh();
				return {
					content: [
						{
							type: "text",
							text: `Plugins refreshed. ${loaded.length} plugins loaded from directories.`,
						},
					],
					details: { action: "refresh", count: loaded.length },
				};
			}

			case "dirs": {
				const dirs = manager.getPluginDirs();
				const lines: string[] = ["## Plugin Directories"];
				for (const dir of dirs) {
					lines.push(`- ${dir}`);
				}
				if (args.dir) {
					manager.addPluginDir(args.dir);
					lines.push(`\nAdded new directory: ${args.dir}`);
				}
				return {
					content: [{ type: "text", text: lines.join("\n") }],
					details: { action: "dirs", dirs },
				};
			}

			default:
				return {
					content: [
						{
							type: "text",
							text: `Error: Unknown action '${args.action}'. Available actions: list, stats, enable, disable, details, refresh, dirs`,
						},
					],
					details: { action: args.action, error: "unknown action" },
				};
		}
	},
};

/**
 * Get plugin tools from all enabled plugins
 * @returns Array of plugin-provided tools
 */
export function getPluginTools(): AgentTool[] {
	const manager = getPluginManager();
	if (!manager.isInitialized()) {
		manager.initialize();
	}
	return manager.getPluginTools();
}
