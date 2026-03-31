/**
 * Plugin Manager for Paimon Agent
 *
 * This module provides a plugin system inspired by Claude Code's plugins
 * and OpenHands' extensions. Plugins can add new tools, hooks, and capabilities.
 *
 * Plugin structure:
 * - Manifest file (plugin.yaml or plugin.json) defines metadata
 * - Tools are dynamically loaded and registered
 * - Hooks extend validation/safety mechanisms
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { Hook, HookType } from "./hooks.js";

/**
 * Plugin manifest interface
 * Defines the structure of a plugin.yaml or plugin.json file
 */
export interface PluginManifest {
	/** Unique plugin identifier */
	name: string;
	/** Plugin version (semver format) */
	version: string;
	/** Human-readable description */
	description?: string;
	/** Plugin author */
	author?: string;
	/** Required minimum Paimon version */
	minPaimonVersion?: string;
	/** Tool definitions to add */
	tools?: PluginToolDefinition[];
	/** Hook definitions to add */
	hooks?: PluginHookDefinition[];
	/** Configuration schema */
	config?: Record<string, PluginConfigField>;
	/** Plugin dependencies */
	dependencies?: string[];
	/** Plugin is enabled by default */
	enabled?: boolean;
	/** Plugin priority (higher = earlier execution) */
	priority?: number;
}

/**
 * Plugin tool definition from manifest
 */
export interface PluginToolDefinition {
	/** Tool name (must be unique) */
	name: string;
	/** Tool description for agent */
	description: string;
	/** Tool parameters schema (JSON Schema style) */
	parameters?: Record<string, unknown>;
	/** Tool handler module path */
	handler?: string;
	/** Tool is enabled */
	enabled?: boolean;
}

/**
 * Plugin hook definition from manifest
 */
export interface PluginHookDefinition {
	/** Hook name */
	name: string;
	/** Hook type: PreToolUse, PostToolUse, SessionStart, Stop */
	type: "PreToolUse" | "PostToolUse" | "SessionStart" | "Stop";
	/** Hook priority (higher = earlier execution) */
	priority?: number;
	/** Hook handler module path */
	handler?: string;
	/** Tools to match (for PreToolUse/PostToolUse) */
	tools?: string[];
	/** Hook is enabled */
	enabled?: boolean;
}

/**
 * Plugin configuration field
 */
export interface PluginConfigField {
	/** Field type */
	type: "string" | "number" | "boolean" | "array" | "object";
	/** Default value */
	default?: unknown;
	/** Field description */
	description?: string;
	/** Field is required */
	required?: boolean;
}

/**
 * Loaded plugin instance
 */
export interface LoadedPlugin {
	/** Plugin manifest */
	manifest: PluginManifest;
	/** Plugin directory path */
	path: string;
	/** Plugin is enabled */
	enabled: boolean;
	/** Loaded tools */
	tools: AgentTool[];
	/** Loaded hooks */
	hooks: Hook[];
	/** Plugin configuration */
	config: Record<string, unknown>;
	/** Load errors */
	errors: string[];
	/** Load timestamp */
	loadedAt: Date;
}

/**
 * Plugin statistics
 */
export interface PluginStats {
	/** Total plugins discovered */
	total: number;
	/** Enabled plugins */
	enabled: number;
	/** Disabled plugins */
	disabled: number;
	/** Plugins with errors */
	errors: number;
	/** Total tools added */
	tools: number;
	/** Total hooks added */
	hooks: number;
}

/**
 * Plugin Manager class
 * Handles plugin discovery, loading, and management
 */
export class PluginManager {
	private plugins: Map<string, LoadedPlugin> = new Map();
	private pluginDirs: string[] = [];
	private dataDir: string;
	private initialized = false;

	/**
	 * Create a new PluginManager
	 * @param dataDir - Data directory for plugin state
	 * @param pluginDirs - Additional plugin directories to search
	 */
	constructor(dataDir?: string, pluginDirs?: string[]) {
		this.dataDir = dataDir || this.findDataDir();
		this.pluginDirs = pluginDirs || [];

		// Add default plugin directories
		this.pluginDirs.push(join(this.dataDir, "plugins"));
		this.pluginDirs.push(join(process.cwd(), "plugins"));
	}

	/**
	 * Find data directory by traversing up
	 */
	private findDataDir(): string {
		for (let i = 0; i < 10; i++) {
			const dir = join(process.cwd(), ...Array(i).fill(".."), "data");
			if (existsSync(dir)) return dir;
		}
		return join(process.cwd(), "data");
	}

	/**
	 * Discover plugins from all directories
	 * @returns Array of discovered plugin paths
	 */
	discoverPlugins(): string[] {
		const discovered: string[] = [];

		for (const dir of this.pluginDirs) {
			if (!existsSync(dir)) continue;

			const entries = readdirSync(dir);
			for (const entry of entries) {
				const fullPath = join(dir, entry);
				if (!statSync(fullPath).isDirectory()) continue;

				// Check for manifest file
				const yamlPath = join(fullPath, "plugin.yaml");
				const jsonPath = join(fullPath, "plugin.json");

				if (existsSync(yamlPath) || existsSync(jsonPath)) {
					discovered.push(fullPath);
				}
			}
		}

		return discovered;
	}

	/**
	 * Load plugin manifest from directory
	 * @param pluginPath - Plugin directory path
	 * @returns Plugin manifest or null if invalid
	 */
	loadManifest(pluginPath: string): PluginManifest | null {
		const yamlPath = join(pluginPath, "plugin.yaml");
		const jsonPath = join(pluginPath, "plugin.json");

		try {
			if (existsSync(jsonPath)) {
				const content = readFileSync(jsonPath, "utf-8");
				const parsed = JSON.parse(content);
				// Validate required fields
				if (!parsed.name || !parsed.version) {
					console.error(`Invalid manifest in ${pluginPath}: missing name or version`);
					return null;
				}
				return parsed as PluginManifest;
			}

			if (existsSync(yamlPath)) {
				// Simple YAML parsing (no external dependency)
				const content = readFileSync(yamlPath, "utf-8");
				const parsed = this.parseSimpleYaml(content);
				// Validate required fields
				if (!parsed.name || !parsed.version) {
					console.error(`Invalid manifest in ${pluginPath}: missing name or version`);
					return null;
				}
				return parsed as PluginManifest;
			}
		} catch (error) {
			console.error(`Failed to load manifest from ${pluginPath}:`, error);
		}

		return null;
	}

	/**
	 * Parse simple YAML (basic key-value support)
	 * @param content - YAML content
	 * @returns Parsed object with all values as strings/primitives
	 */
	private parseSimpleYaml(content: string): Partial<PluginManifest> {
		const result: Record<string, unknown> = {};
		const lines = content.split("\n");

		for (const line of lines) {
			// Skip comments and empty lines
			if (line.startsWith("#") || line.trim() === "") continue;

			// Parse key: value
			const colonIndex = line.indexOf(":");
			if (colonIndex === -1) continue;

			const key = line.slice(0, colonIndex).trim();
			const rawValue = line.slice(colonIndex + 1).trim();

			// Parse the value
			let value: unknown = rawValue;

			// Remove quotes from strings
			if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
				value = rawValue.slice(1, -1);
			} else if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
				value = rawValue.slice(1, -1);
			}

			// Parse booleans
			if (rawValue === "true") value = true;
			else if (rawValue === "false") value = false;

			// Parse numbers
			const num = Number(rawValue);
			if (!Number.isNaN(num) && rawValue !== "") {
				value = num;
			}

			result[key] = value;
		}

		return result;
	}

	/**
	 * Load a plugin from directory
	 * @param pluginPath - Plugin directory path
	 * @returns Loaded plugin or null if invalid
	 */
	loadPlugin(pluginPath: string): LoadedPlugin | null {
		const manifest = this.loadManifest(pluginPath);
		if (!manifest) return null;

		const errors: string[] = [];
		const tools: AgentTool[] = [];
		const hooks: Hook[] = [];

		// Load tools from manifest
		if (manifest.tools) {
			for (const toolDef of manifest.tools) {
				try {
					const tool = this.loadTool(pluginPath, toolDef);
					if (tool) tools.push(tool);
				} catch (error) {
					errors.push(`Tool ${toolDef.name}: ${error}`);
				}
			}
		}

		// Load hooks from manifest
		if (manifest.hooks) {
			for (const hookDef of manifest.hooks) {
				try {
					const hook = this.loadHook(pluginPath, hookDef);
					if (hook) hooks.push(hook);
				} catch (error) {
					errors.push(`Hook ${hookDef.name}: ${error}`);
				}
			}
		}

		const loaded: LoadedPlugin = {
			manifest,
			path: pluginPath,
			enabled: manifest.enabled ?? true,
			tools,
			hooks,
			config: {},
			errors,
			loadedAt: new Date(),
		};

		this.plugins.set(manifest.name, loaded);
		return loaded;
	}

	/**
	 * Load a tool from plugin
	 * @param pluginPath - Plugin directory path
	 * @param toolDef - Tool definition
	 * @returns AgentTool or null
	 */
	private loadTool(pluginPath: string, toolDef: PluginToolDefinition): AgentTool | null {
		// Create a placeholder tool
		return {
			name: toolDef.name,
			label: toolDef.name,
			description: toolDef.description,
			parameters: Type.Object({
				action: Type.Optional(Type.String()),
			}),
			execute: async (_toolCallId: string, params: unknown): Promise<AgentToolResult<string>> => {
				const args = params as Record<string, unknown>;
				return {
					content: [
						{
							type: "text",
							text: `Plugin tool "${toolDef.name}" called with: ${JSON.stringify(args)}\nNote: Add a handler module to implement this tool.`,
						},
					],
					details: `Plugin tool ${toolDef.name} placeholder`,
				};
			},
		};
	}

	/**
	 * Load a hook from plugin
	 * @param pluginPath - Plugin directory path
	 * @param hookDef - Hook definition
	 * @returns Hook or null
	 */
	private loadHook(pluginPath: string, hookDef: PluginHookDefinition): Hook | null {
		// Map hook type to valid HookType
		const hookType: HookType =
			hookDef.type === "PreToolUse" || hookDef.type === "SessionStart" || hookDef.type === "Stop"
				? hookDef.type
				: "PreToolUse"; // Default to PreToolUse

		return {
			id: `${hookDef.name}-${Date.now()}`,
			type: hookType,
			name: hookDef.name,
			description: `Plugin hook from ${hookDef.name}`,
			enabled: hookDef.enabled ?? true,
			priority: hookDef.priority ?? 50,
			handler: async () => {
				return {
					allow: true,
					context: `Plugin hook ${hookDef.name} executed`,
				};
			},
		};
	}

	/**
	 * Initialize and load all plugins
	 * @returns Array of loaded plugins
	 */
	initialize(): LoadedPlugin[] {
		if (this.initialized) return Array.from(this.plugins.values());

		const discovered = this.discoverPlugins();
		const loaded: LoadedPlugin[] = [];

		for (const pluginPath of discovered) {
			const plugin = this.loadPlugin(pluginPath);
			if (plugin) loaded.push(plugin);
		}

		this.initialized = true;
		return loaded;
	}

	/**
	 * Get all loaded plugins
	 * @returns Map of plugin name to loaded plugin
	 */
	getPlugins(): Map<string, LoadedPlugin> {
		return this.plugins;
	}

	/**
	 * Get plugin by name
	 * @param name - Plugin name
	 * @returns Loaded plugin or null
	 */
	getPlugin(name: string): LoadedPlugin | null {
		return this.plugins.get(name) || null;
	}

	/**
	 * Enable a plugin
	 * @param name - Plugin name
	 * @returns True if plugin was enabled
	 */
	enablePlugin(name: string): boolean {
		const plugin = this.plugins.get(name);
		if (!plugin) return false;

		plugin.enabled = true;
		return true;
	}

	/**
	 * Disable a plugin
	 * @param name - Plugin name
	 * @returns True if plugin was disabled
	 */
	disablePlugin(name: string): boolean {
		const plugin = this.plugins.get(name);
		if (!plugin) return false;

		plugin.enabled = false;
		return true;
	}

	/**
	 * Get all enabled plugins
	 * @returns Array of enabled plugins
	 */
	getEnabledPlugins(): LoadedPlugin[] {
		return Array.from(this.plugins.values()).filter((p) => p.enabled);
	}

	/**
	 * Get all tools from enabled plugins
	 * @returns Array of plugin tools
	 */
	getPluginTools(): AgentTool[] {
		const tools: AgentTool[] = [];
		for (const plugin of this.getEnabledPlugins()) {
			tools.push(...plugin.tools);
		}
		return tools;
	}

	/**
	 * Get all hooks from enabled plugins
	 * @returns Array of plugin hooks
	 */
	getPluginHooks(): Hook[] {
		const hooks: Hook[] = [];
		for (const plugin of this.getEnabledPlugins()) {
			hooks.push(...plugin.hooks);
		}
		return hooks;
	}

	/**
	 * Get plugin statistics
	 * @returns Plugin stats
	 */
	getStats(): PluginStats {
		const plugins = Array.from(this.plugins.values());
		const enabled = plugins.filter((p) => p.enabled);
		const disabled = plugins.filter((p) => !p.enabled);
		const errors = plugins.filter((p) => p.errors.length > 0);

		return {
			total: plugins.length,
			enabled: enabled.length,
			disabled: disabled.length,
			errors: errors.length,
			tools: enabled.reduce((sum, p) => sum + p.tools.length, 0),
			hooks: enabled.reduce((sum, p) => sum + p.hooks.length, 0),
		};
	}

	/**
	 * Add a plugin directory
	 * @param dir - Directory path
	 */
	addPluginDir(dir: string): void {
		this.pluginDirs.push(dir);
	}

	/**
	 * Refresh plugins (reload from directories)
	 * @returns Array of newly loaded plugins
	 */
	refresh(): LoadedPlugin[] {
		this.plugins.clear();
		this.initialized = false;
		return this.initialize();
	}

	/**
	 * Check if plugin system is initialized
	 * @returns True if initialized
	 */
	isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * Get plugin directories
	 * @returns Array of plugin directory paths
	 */
	getPluginDirs(): string[] {
		return [...this.pluginDirs];
	}
}

// Singleton instance
let pluginManager: PluginManager | null = null;

/**
 * Get the PluginManager singleton
 * @param dataDir - Optional data directory
 * @param pluginDirs - Optional plugin directories
 * @returns PluginManager instance
 */
export function getPluginManager(dataDir?: string, pluginDirs?: string[]): PluginManager {
	if (!pluginManager) {
		pluginManager = new PluginManager(dataDir, pluginDirs);
	}
	return pluginManager;
}

/**
 * Reset the PluginManager singleton
 */
export function resetPluginManager(): void {
	pluginManager = null;
}

/**
 * Format plugin list for display
 * @param plugins - Map of loaded plugins
 * @returns Formatted string
 */
export function formatPluginList(plugins: Map<string, LoadedPlugin>): string {
	const lines: string[] = ["## Loaded Plugins"];

	for (const [name, plugin] of plugins) {
		const status = plugin.enabled ? "✅ enabled" : "❌ disabled";
		const errors = plugin.errors.length > 0 ? ` (${plugin.errors.length} errors)` : "";
		const tools = plugin.tools.length > 0 ? ` - ${plugin.tools.length} tools` : "";
		const hooks = plugin.hooks.length > 0 ? ` - ${plugin.hooks.length} hooks` : "";

		lines.push(`- **${name}** v${plugin.manifest.version}: ${status}${errors}${tools}${hooks}`);
		if (plugin.manifest.description) {
			lines.push(`  ${plugin.manifest.description}`);
		}
	}

	return lines.join("\n");
}

/**
 * Format plugin statistics for display
 * @param stats - Plugin statistics
 * @returns Formatted string
 */
export function formatPluginStats(stats: PluginStats): string {
	return `## Plugin Statistics

- Total plugins: ${stats.total}
- Enabled: ${stats.enabled}
- Disabled: ${stats.disabled}
- With errors: ${stats.errors}
- Tools added: ${stats.tools}
- Hooks added: ${stats.hooks}`;
}

/**
 * Format single plugin details for display
 * @param plugin - Loaded plugin
 * @returns Formatted string
 */
export function formatPluginDetails(plugin: LoadedPlugin): string {
	const lines: string[] = [`## Plugin: ${plugin.manifest.name} v${plugin.manifest.version}`];

	lines.push(`- **Status**: ${plugin.enabled ? "Enabled" : "Disabled"}`);
	lines.push(`- **Path**: ${plugin.path}`);
	lines.push(`- **Author**: ${plugin.manifest.author || "Unknown"}`);
	lines.push(`- **Description**: ${plugin.manifest.description || "No description"}`);
	lines.push(`- **Loaded at**: ${plugin.loadedAt.toISOString()}`);

	if (plugin.manifest.minPaimonVersion) {
		lines.push(`- **Min Paimon Version**: ${plugin.manifest.minPaimonVersion}`);
	}

	if (plugin.tools.length > 0) {
		lines.push(`\n### Tools (${plugin.tools.length})`);
		for (const tool of plugin.tools) {
			lines.push(`- ${tool.name}: ${tool.description}`);
		}
	}

	if (plugin.hooks.length > 0) {
		lines.push(`\n### Hooks (${plugin.hooks.length})`);
		for (const hook of plugin.hooks) {
			lines.push(`- ${hook.name} (${hook.type}, priority ${hook.priority})`);
		}
	}

	if (plugin.errors.length > 0) {
		lines.push(`\n### Errors (${plugin.errors.length})`);
		for (const error of plugin.errors) {
			lines.push(`- ${error}`);
		}
	}

	return lines.join("\n");
}
