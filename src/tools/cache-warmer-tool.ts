/**
 * Cache Warmer Tool (Aider Pattern)
 *
 * Tool for managing cache warming to keep prompt cache alive during long sessions.
 * Reduces API costs by preventing cache expiration.
 *
 * Actions:
 * - start: Start cache warming session
 * - stop: Stop cache warming session
 * - pause: Pause cache warming
 * - resume: Resume paused cache warming
 * - status: Get current status
 * - stats: View cache warming statistics
 * - config: View/update configuration
 * - ping: Perform manual cache ping
 * - enable: Enable cache warming
 * - disable: Disable cache warming
 * - reset: Reset statistics
 * - help: Show help message
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { type CacheWarmer, getCacheWarmer } from "../cache-warmer.js";
import type { CacheWarmerConfig, CacheWarmingStats } from "../cache-warmer.js";

type CacheWarmerAction =
	| "start"
	| "stop"
	| "pause"
	| "resume"
	| "status"
	| "stats"
	| "config"
	| "ping"
	| "enable"
	| "disable"
	| "reset"
	| "help";

function formatStats(stats: CacheWarmingStats): string {
	const lines = [
		"## Cache Warming Statistics",
		"",
		`**Session Started:** ${stats.sessionStartTime}`,
		`**Total Pings:** ${stats.totalPings}`,
		`**Successful Pings:** ${stats.successfulPings}`,
		`**Failed Pings:** ${stats.failedPings}`,
		`**Cache Hit Tokens Preserved:** ${stats.cacheHitTokensPreserved.toLocaleString()}`,
		`**Estimated Cost Saved:** $${stats.estimatedCostSaved.toFixed(4)}`,
		`**Last Ping:** ${stats.lastPingTime || "Never"}`,
		`**Average Ping Duration:** ${stats.averagePingDuration.toFixed(0)}ms`,
	];
	return lines.join("\n");
}

function formatStatus(status: ReturnType<CacheWarmer["getStatus"]>): string {
	const lines = [
		"## Cache Warmer Status",
		"",
		`**Active:** ${status.isWarming ? "✅ Yes" : "❌ No"}`,
		`**Enabled:** ${status.config.enabled ? "✅ Yes" : "❌ No"}`,
		`**Pings Remaining:** ${status.pingsRemaining}`,
		`**Last Cache Hit Tokens:** ${status.lastCacheHitTokens.toLocaleString()}`,
		"",
		"### Configuration",
		`- Keep Alive Delay: ${status.config.keepAliveDelay / 1000 / 60} minutes`,
		`- Max Pings: ${status.config.numCacheWarmingPings}`,
		`- Min Cache Hit Tokens: ${status.config.minCacheHitTokens}`,
	];

	if (status.session) {
		lines.push("", "### Current Session");
		lines.push(`- Session ID: ${status.session.id}`);
		lines.push(`- Started: ${status.session.startTime}`);
		lines.push(`- Pings Completed: ${status.session.pingsCompleted}`);
		lines.push(`- Cache Tokens: ${status.session.cacheHitTokens.toLocaleString()}`);
		lines.push(`- Status: ${status.session.status}`);
	}

	return lines.join("\n");
}

function formatConfig(config: CacheWarmerConfig): string {
	return [
		"## Cache Warmer Configuration",
		"",
		`- **Enabled:** ${config.enabled ? "✅ Yes" : "❌ No"}`,
		`- **Keep Alive Delay:** ${config.keepAliveDelay / 1000 / 60} minutes (${config.keepAliveDelay}ms)`,
		`- **Max Pings:** ${config.numCacheWarmingPings}`,
		`- **Min Cache Hit Tokens:** ${config.minCacheHitTokens}`,
	].join("\n");
}

function getHelpMessage(): string {
	return `## Cache Warmer Tool

Keep prompt cache alive during long sessions to reduce API costs.

### Actions

| Action | Description |
|--------|-------------|
| \`start\` | Start cache warming session |
| \`stop\` | Stop cache warming session |
| \`pause\` | Pause cache warming |
| \`resume\` | Resume paused cache warming |
| \`status\` | Get current status |
| \`stats\` | View cache warming statistics |
| \`config\` | View/update configuration |
| \`ping\` | Perform manual cache ping |
| \`enable\` | Enable cache warming |
| \`disable\` | Disable cache warming |
| \`reset\` | Reset statistics |
| \`help\` | Show this help message |

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| \`keepAliveDelay\` | number | 300000 (5min) | Milliseconds between cache pings |
| \`numCacheWarmingPings\` | number | 100 | Maximum pings per session |
| \`minCacheHitTokens\` | number | 1000 | Minimum cache tokens to consider warming |

### Usage Examples

\`\`\`typescript
// Start cache warming
cacheWarmer({ action: 'start' })

// Check status
cacheWarmer({ action: 'status' })

// View statistics
cacheWarmer({ action: 'stats' })

// Update configuration
cacheWarmer({ action: 'config', keepAliveDelay: 600000 }) // 10 minutes

// Manual ping
cacheWarmer({ action: 'ping' })

// Stop cache warming
cacheWarmer({ action: 'stop' })
\`\`\`

### How It Works

Cache warming prevents prompt cache expiration by periodically sending minimal
API requests to keep cached tokens alive. This is especially useful for:

- Long evolution sessions
- Sessions with large context windows
- Reducing API costs by reusing cached content

### Cost Savings

When cache is preserved:
- Cache hit tokens are ~90% cheaper than new tokens
- Example: 100K cache hit tokens saved = ~$0.27 (at Claude pricing)

### Pattern Source

This capability is inspired by Aider's cache warming implementation:
https://github.com/Aider-AI/aider/blob/main/aider/coders/base_coder.py
`;
}

/**
 * Cache warmer tool for managing prompt cache during long sessions
 */
export const cacheWarmerToolDefinition: AgentTool = {
	name: "cacheWarmer",
	label: "Cache Warmer",
	description:
		"Manage cache warming to keep prompt cache alive during long sessions, reducing API costs by preventing cache expiration (Aider pattern)",
	parameters: Type.Object({
		action: Type.Union([
			Type.Literal("start"),
			Type.Literal("stop"),
			Type.Literal("pause"),
			Type.Literal("resume"),
			Type.Literal("status"),
			Type.Literal("stats"),
			Type.Literal("config"),
			Type.Literal("ping"),
			Type.Literal("enable"),
			Type.Literal("disable"),
			Type.Literal("reset"),
			Type.Literal("help"),
		]),
		keepAliveDelay: Type.Optional(Type.Number()),
		numCacheWarmingPings: Type.Optional(Type.Number()),
		minCacheHitTokens: Type.Optional(Type.Number()),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const warmer = getCacheWarmer();
		const { action, keepAliveDelay, numCacheWarmingPings, minCacheHitTokens } = params as {
			action: CacheWarmerAction;
			keepAliveDelay?: number;
			numCacheWarmingPings?: number;
			minCacheHitTokens?: number;
		};

		switch (action) {
			case "start": {
				const result = warmer.start();
				return {
					content: [
						{
							type: "text",
							text: result.success ? `🚀 ${result.message}` : `❌ ${result.message}`,
						},
					],
					details: { sessionId: result.sessionId },
				};
			}

			case "stop": {
				const result = warmer.stop();
				return {
					content: [
						{
							type: "text",
							text: result.success ? `🛑 ${result.message}` : `❌ ${result.message}`,
						},
					],
					details: { stats: result.stats },
				};
			}

			case "pause": {
				const result = warmer.pause();
				return {
					content: [
						{
							type: "text",
							text: result.success ? `⏸️ ${result.message}` : `❌ ${result.message}`,
						},
					],
					details: { success: result.success },
				};
			}

			case "resume": {
				const result = warmer.resume();
				return {
					content: [
						{
							type: "text",
							text: result.success ? `▶️ ${result.message}` : `❌ ${result.message}`,
						},
					],
					details: { success: result.success },
				};
			}

			case "status": {
				const status = warmer.getStatus();
				return {
					content: [
						{
							type: "text",
							text: formatStatus(status),
						},
					],
					details: { status },
				};
			}

			case "stats": {
				const stats = warmer.getStats();
				return {
					content: [
						{
							type: "text",
							text: formatStats(stats),
						},
					],
					details: { stats },
				};
			}

			case "config": {
				if (
					keepAliveDelay !== undefined ||
					numCacheWarmingPings !== undefined ||
					minCacheHitTokens !== undefined
				) {
					const updates: Partial<CacheWarmerConfig> = {};
					if (keepAliveDelay !== undefined) {
						updates.keepAliveDelay = keepAliveDelay;
					}
					if (numCacheWarmingPings !== undefined) {
						updates.numCacheWarmingPings = numCacheWarmingPings;
					}
					if (minCacheHitTokens !== undefined) {
						updates.minCacheHitTokens = minCacheHitTokens;
					}
					const result = warmer.updateConfig(updates);
					return {
						content: [
							{
								type: "text",
								text: `⚙️ Configuration updated:\n${formatConfig(result.config)}`,
							},
						],
						details: { config: result.config },
					};
				}
				const config = warmer.getConfig();
				return {
					content: [
						{
							type: "text",
							text: formatConfig(config),
						},
					],
					details: { config },
				};
			}

			case "ping": {
				const result = await warmer.manualPing();
				return {
					content: [
						{
							type: "text",
							text: result.success ? `📡 ${result.message}` : `❌ ${result.message}`,
						},
					],
					details: { status: warmer.getStatus() },
				};
			}

			case "enable": {
				const result = warmer.enable();
				return {
					content: [
						{
							type: "text",
							text: `✅ ${result.message}`,
						},
					],
					details: { success: result.success },
				};
			}

			case "disable": {
				const result = warmer.disable();
				return {
					content: [
						{
							type: "text",
							text: `❌ ${result.message}`,
						},
					],
					details: { success: result.success },
				};
			}

			case "reset": {
				const result = warmer.resetStats();
				return {
					content: [
						{
							type: "text",
							text: `🔄 ${result.message}`,
						},
					],
					details: { success: result.success },
				};
			}

			case "help": {
				return {
					content: [
						{
							type: "text",
							text: getHelpMessage(),
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
							text: `❌ Unknown action: ${action}\nUse 'help' to see available actions.`,
						},
					],
					details: { error: "unknown action", action },
				};
		}
	},
};

// Re-export for convenience
export { getCacheWarmer, CacheWarmer, resetCacheWarmerInstance } from "../cache-warmer.js";
export type { CacheWarmerConfig, CacheWarmingStats, CacheWarmingSession } from "../cache-warmer.js";
