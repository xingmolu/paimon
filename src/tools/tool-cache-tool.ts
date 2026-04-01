/**
 * Tool Cache Tool
 *
 * Provides tool interface for managing the tool result cache.
 * Allows viewing stats, configuration, entries, and managing the cache.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { type CacheConfig, type ToolCache, getToolCache } from "../tool-cache.js";

/**
 * Create the tool cache management tool
 */
export const toolCacheTool: AgentTool = {
	name: "toolCache",
	label: "Tool Cache Manager",
	description: `Manage tool result cache - view stats, clear cache, configure settings.
    
Actions:
- stats: View cache statistics (hits, misses, tokens saved)
- config: View or update cache configuration
- entries: View cached entries (optionally filtered by tool)
- clear: Clear entire cache
- clearTool: Clear cache for specific tool
- clearExpired: Clear expired entries
- enable: Enable caching
- disable: Disable caching
- get: Get specific cached entry
- has: Check if entry exists for tool + params
- setConfig: Update cache configuration

Usage:
toolCache({action: 'stats'})
toolCache({action: 'config'})
toolCache({action: 'entries', toolName: 'read'})
toolCache({action: 'clear'})
toolCache({action: 'clearTool', toolName: 'read'})`,
	parameters: Type.Object({
		action: Type.String({
			description: "Action to perform",
		}),
		toolName: Type.Optional(
			Type.String({
				description: "Tool name for filtering or clearing",
			}),
		),
		key: Type.Optional(
			Type.String({
				description: "Cache key for get action",
			}),
		),
		params: Type.Optional(
			Type.Object(
				{},
				{
					description: "Parameters for has action",
				},
			),
		),
		configUpdates: Type.Optional(
			Type.Object(
				{
					maxSize: Type.Optional(Type.Number()),
					defaultTtl: Type.Optional(Type.Number()),
					enabled: Type.Optional(Type.Boolean()),
					shortTtl: Type.Optional(Type.Number()),
					tokensPerHit: Type.Optional(Type.Number()),
				},
				{
					description: "Configuration updates for setConfig action",
				},
			),
		),
		limit: Type.Optional(
			Type.Number({
				description: "Maximum entries to show (default 20)",
			}),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const { action, toolName, key, limit } = params as {
			action: string;
			toolName?: string;
			key?: string;
			limit?: number;
		};

		try {
			const cache = getToolCache();

			switch (action) {
				case "stats":
					return handleStats(cache);

				case "config":
					return handleConfig(cache);

				case "entries":
					return handleEntries(cache, toolName, limit || 20);

				case "clear":
					return handleClear(cache);

				case "clearTool":
					return handleClearTool(cache, toolName);

				case "clearExpired":
					return handleClearExpired(cache);

				case "enable":
					return handleEnable(cache);

				case "disable":
					return handleDisable(cache);

				case "get":
					return handleGet(cache, key);

				case "has":
					return handleHas(cache, toolName, params);

				case "setConfig":
					return handleSetConfig(cache, params);

				default:
					return {
						content: [
							{
								type: "text",
								text: `Error: Unknown action '${action}'. Use: stats, config, entries, clear, clearTool, clearExpired, enable, disable, get, has, setConfig`,
							},
						],
						details: `Error: Unknown action '${action}'`,
					};
			}
		} catch (e) {
			const error = e instanceof Error ? e.message : String(e);
			return {
				content: [{ type: "text", text: `Error: ${error}` }],
				details: `Error: ${error}`,
			};
		}
	},
};

function handleStats(cache: ToolCache): AgentToolResult<unknown> {
	const stats = cache.getStats();
	const config = cache.getConfig();

	const lines: string[] = [
		"## Tool Cache Statistics",
		"",
		"| Metric | Value |",
		"|--------|-------|",
		`| Status | ${config.enabled ? "✅ Enabled" : "❌ Disabled"} |`,
		`| Cache Hits | ${stats.hits} |`,
		`| Cache Misses | ${stats.misses} |`,
		`| Hit Rate | ${stats.hitRate.toFixed(1)}% |`,
		`| Cache Size | ${stats.size}/${config.maxSize} entries |`,
		`| Tokens Saved | ~${stats.tokensSaved} |`,
		`| Avg Hits/Entry | ${stats.avgHitsPerEntry.toFixed(1)} |`,
		"",
	];

	if (stats.topTools.length > 0) {
		lines.push("### Top Cached Tools", "");
		lines.push("| Tool | Hits | Tokens Saved |");
		lines.push("|------|------|-------------|");
		for (const tool of stats.topTools.slice(0, 5)) {
			lines.push(`| ${tool.toolName} | ${tool.hits} | ~${tool.tokensSaved} |`);
		}
		lines.push("");
	}

	lines.push("**Benefits:**");
	lines.push("- Avoids redundant tool calls (saves tokens)");
	lines.push("- Prevents API rate limit issues");
	lines.push("- Faster iteration by skipping known results");

	return {
		content: [{ type: "text", text: lines.join("\n") }],
		details: { stats, config },
	};
}

function handleConfig(cache: ToolCache): AgentToolResult<unknown> {
	const config = cache.getConfig();

	const lines: string[] = [
		"## Tool Cache Configuration",
		"",
		"| Setting | Value |",
		"|---------|-------|",
		`| Enabled | ${config.enabled ? "✅" : "❌"} |`,
		`| Max Size | ${config.maxSize} entries |`,
		`| Default TTL | ${config.defaultTtl / 60000} minutes |`,
		`| Short TTL | ${config.shortTtl / 60000} minutes |`,
		`| Est. Tokens/Hit | ${config.tokensPerHit} |`,
		"",
		"### Never Cached Tools",
		"",
		"These tools have dynamic output and are never cached:",
	];

	for (const t of config.noCacheTools) {
		lines.push(`- ${t}`);
	}

	lines.push(
		"",
		"### Short TTL Tools",
		"",
		"These tools may have changing output and use short TTL:",
	);
	for (const t of config.shortTtlTools) {
		lines.push(`- ${t}`);
	}

	lines.push(
		"",
		"**Usage:**",
		`Use toolCache({action: 'setConfig', configUpdates: {...}}) to update.`,
	);

	return {
		content: [{ type: "text", text: lines.join("\n") }],
		details: { config },
	};
}

function handleEntries(cache: ToolCache, toolName?: string, limit = 20): AgentToolResult<unknown> {
	const entries = cache.listEntries(toolName).slice(0, limit);
	const now = Date.now();

	const lines: string[] = [
		`## Cache Entries (${entries.length}${toolName ? ` for ${toolName}` : ""})`,
		"",
	];

	if (entries.length === 0) {
		lines.push("No entries found.");
		return {
			content: [{ type: "text", text: lines.join("\n") }],
			details: { count: 0 },
		};
	}

	lines.push("| Key | Tool | Age | TTL Left | Hits | Tokens Saved |");
	lines.push("|-----|------|-----|----------|------|-------------|");

	for (const entry of entries) {
		const age = Math.floor((now - entry.timestamp) / 60000);
		const ttlLeft = Math.max(0, Math.floor((entry.ttl - (now - entry.timestamp)) / 60000));
		const keyShort = entry.key.length > 40 ? `${entry.key.substring(0, 40)}...` : entry.key;
		lines.push(
			`| ${keyShort} | ${entry.toolName} | ${age}m | ${ttlLeft}m | ${entry.hitCount} | ~${entry.tokensSaved} |`,
		);
	}

	lines.push("", `**Total entries:** ${cache.listEntries(toolName).length}`);

	return {
		content: [{ type: "text", text: lines.join("\n") }],
		details: { entries, total: cache.listEntries(toolName).length },
	};
}

function handleClear(cache: ToolCache): AgentToolResult<unknown> {
	const statsBefore = cache.getStats();
	cache.clear();

	const lines: string[] = [
		"## Cache Cleared",
		"",
		"| Before | After |",
		"|--------|-------|",
		`| ${statsBefore.size} entries | 0 entries |`,
		`| ${statsBefore.hits} hits | 0 hits |`,
		`| ~${statsBefore.tokensSaved} tokens saved | 0 tokens |`,
		"",
		"✅ Cache has been cleared.",
	];

	return {
		content: [{ type: "text", text: lines.join("\n") }],
		details: { cleared: statsBefore.size },
	};
}

function handleClearTool(cache: ToolCache, toolName?: string): AgentToolResult<unknown> {
	if (!toolName) {
		return {
			content: [
				{
					type: "text",
					text: "Error: Missing toolName parameter.\n\nUsage: toolCache({action: 'clearTool', toolName: 'read'})",
				},
			],
			details: "Error: Missing toolName",
		};
	}

	const cleared = cache.clearTool(toolName);

	const lines: string[] = [
		`## Cache Cleared for Tool: ${toolName}`,
		"",
		`✅ Cleared ${cleared} entries for ${toolName}.`,
	];

	return {
		content: [{ type: "text", text: lines.join("\n") }],
		details: { toolName, cleared },
	};
}

function handleClearExpired(cache: ToolCache): AgentToolResult<unknown> {
	const cleared = cache.clearExpired();

	const lines: string[] = [
		"## Expired Entries Cleared",
		"",
		`✅ Cleared ${cleared} expired entries.`,
		"",
		`Current cache size: ${cache.getStats().size} entries.`,
	];

	return {
		content: [{ type: "text", text: lines.join("\n") }],
		details: { cleared, newSize: cache.getStats().size },
	};
}

function handleEnable(cache: ToolCache): AgentToolResult<unknown> {
	cache.enable();

	const lines: string[] = [
		"## Cache Enabled",
		"",
		"✅ Tool result caching is now enabled.",
		"",
		"Benefits:",
		"- Reduces token usage",
		"- Prevents rate limit issues",
		"- Faster iteration",
	];

	return {
		content: [{ type: "text", text: lines.join("\n") }],
		details: { enabled: true },
	};
}

function handleDisable(cache: ToolCache): AgentToolResult<unknown> {
	cache.disable();

	const lines: string[] = [
		"## Cache Disabled",
		"",
		"❌ Tool result caching is now disabled.",
		"",
		"All tool calls will execute fresh.",
	];

	return {
		content: [{ type: "text", text: lines.join("\n") }],
		details: { enabled: false },
	};
}

function handleGet(cache: ToolCache, key?: string): AgentToolResult<unknown> {
	if (!key) {
		return {
			content: [
				{
					type: "text",
					text: "Error: Missing key parameter.\n\nUsage: toolCache({action: 'get', key: 'cache-key'})",
				},
			],
			details: "Error: Missing key",
		};
	}

	const entry = cache.getEntry(key);

	if (!entry) {
		return {
			content: [
				{
					type: "text",
					text: `Error: Entry not found for key: ${key}\n\nUse 'entries' action to list available entries.`,
				},
			],
			details: `Error: Entry not found for key ${key}`,
		};
	}

	const lines: string[] = [
		"## Cache Entry",
		"",
		"| Property | Value |",
		"|----------|-------|",
		`| Key | ${entry.key} |`,
		`| Tool | ${entry.toolName} |`,
		`| Parameters | ${entry.params.substring(0, 100)}${entry.params.length > 100 ? "..." : ""} |`,
		`| Age | ${Math.floor((Date.now() - entry.timestamp) / 60000)} minutes |`,
		`| TTL | ${Math.floor(entry.ttl / 60000)} minutes |`,
		`| Hits | ${entry.hitCount} |`,
		`| Tokens Saved | ~${entry.tokensSaved} |`,
		"",
		"### Cached Result",
		"",
		entry.result.substring(0, 500) + (entry.result.length > 500 ? "..." : ""),
	];

	return {
		content: [{ type: "text", text: lines.join("\n") }],
		details: { entry },
	};
}

function handleHas(
	cache: ToolCache,
	toolName?: string,
	params?: unknown,
): AgentToolResult<unknown> {
	if (!toolName) {
		return {
			content: [
				{
					type: "text",
					text: "Error: Missing toolName parameter.\n\nUsage: toolCache({action: 'has', toolName: 'read', params: {path: 'file.ts'}})",
				},
			],
			details: "Error: Missing toolName",
		};
	}

	const checkParams =
		((params as Record<string, unknown>)?.params as Record<string, unknown>) || {};
	const has = cache.has(toolName, checkParams);

	const lines: string[] = [
		"## Cache Check",
		"",
		"| Tool | Cached |",
		"|------|--------|",
		`| ${toolName} | ${has ? "✅ Yes" : "❌ No"} |`,
	];

	if (has) {
		lines.push("", "Use 'get' action with the key to retrieve the cached result.");
	}

	return {
		content: [{ type: "text", text: lines.join("\n") }],
		details: { toolName, has },
	};
}

function handleSetConfig(cache: ToolCache, params: unknown): AgentToolResult<unknown> {
	const configUpdates = (params as Record<string, unknown>)?.configUpdates as
		| Partial<CacheConfig>
		| undefined;

	if (!configUpdates || Object.keys(configUpdates).length === 0) {
		return {
			content: [
				{
					type: "text",
					text: "Error: Missing configUpdates parameter.\n\nUsage: toolCache({action: 'setConfig', configUpdates: {maxSize: 500, enabled: true}})",
				},
			],
			details: "Error: Missing configUpdates",
		};
	}

	const oldConfig = cache.getConfig();
	cache.setConfig(configUpdates);
	const newConfig = cache.getConfig();

	const lines: string[] = [
		"## Configuration Updated",
		"",
		"| Setting | Old | New |",
		"|---------|-----|-----|",
	];

	for (const key of Object.keys(configUpdates)) {
		const k = key as keyof CacheConfig;
		lines.push(`| ${k} | ${formatValue(oldConfig[k])} | ${formatValue(newConfig[k])} |`);
	}

	lines.push("", "✅ Configuration has been updated.");

	return {
		content: [{ type: "text", text: lines.join("\n") }],
		details: { oldConfig, newConfig, updates: configUpdates },
	};
}

function formatValue(value: unknown): string {
	if (typeof value === "boolean") {
		return value ? "✅" : "❌";
	}
	if (typeof value === "number") {
		// Convert milliseconds to minutes for TTL values
		if (value > 1000) {
			return `${value / 60000}m`;
		}
		return String(value);
	}
	if (Array.isArray(value)) {
		return value.join(", ");
	}
	return String(value);
}
