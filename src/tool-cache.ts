/**
 * Tool Result Caching Module
 *
 * Caches tool results to avoid redundant tool calls, reducing token usage
 * and preventing API rate limit issues. Inspired by Mini-SWE-Agent's caching
 * patterns and Aider's context efficiency optimizations.
 *
 * Benefits:
 * - Reduces token usage by avoiding duplicate tool calls
 * - Prevents API rate limit issues from repeated calls
 * - Improves iteration efficiency by skipping known results
 * - Tracks cache statistics for optimization analysis
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface CacheEntry {
	/** Unique key for the cache entry (hash of tool + params) */
	key: string;
	/** Tool name that produced this result */
	toolName: string;
	/** Parameters used to call the tool (JSON) */
	params: string;
	/** Cached result content */
	result: string;
	/** Timestamp when cached (epoch ms) */
	timestamp: number;
	/** Time-to-live in milliseconds */
	ttl: number;
	/** Token cost saved by this cache hit */
	tokensSaved: number;
	/** Number of times this entry has been used */
	hitCount: number;
}

export interface CacheConfig {
	/** Maximum number of entries in cache */
	maxSize: number;
	/** Default TTL for entries in milliseconds */
	defaultTtl: number;
	/** Whether caching is enabled */
	enabled: boolean;
	/** Tools to never cache (e.g., bash with dynamic output) */
	noCacheTools: string[];
	/** Tools with short TTL (e.g., file reads that might change) */
	shortTtlTools: string[];
	/** TTL for short TTL tools in milliseconds */
	shortTtl: number;
	/** Estimated tokens saved per cache hit */
	tokensPerHit: number;
}

export interface CacheStats {
	/** Total cache hits */
	hits: number;
	/** Total cache misses */
	misses: number;
	/** Current cache size (number of entries) */
	size: number;
	/** Total tokens saved */
	tokensSaved: number;
	/** Hit rate percentage */
	hitRate: number;
	/** Average hits per entry */
	avgHitsPerEntry: number;
	/** Top cached tools by hit count */
	topTools: { toolName: string; hits: number; tokensSaved: number }[];
	/** Cache entries by tool */
	entriesByTool: { toolName: string; count: number }[];
}

export interface CacheToolResult {
	/** Whether result was from cache */
	fromCache: boolean;
	/** The cached or fresh result */
	result: string;
	/** Cache key used */
	key: string;
	/** Entry if from cache */
	entry?: CacheEntry;
	/** Tokens saved if from cache */
	tokensSaved?: number;
}

const DEFAULT_CONFIG: CacheConfig = {
	maxSize: 1000,
	defaultTtl: 30 * 60 * 1000, // 30 minutes
	enabled: true,
	noCacheTools: ["bash", "edit", "write", "http", "assess", "plan", "stuck", "checkpoint", "hook"],
	shortTtlTools: ["read", "ls", "glob", "grep", "find"],
	shortTtl: 5 * 60 * 1000, // 5 minutes
	tokensPerHit: 100, // Estimated average tokens per cached result
};

const DATA_DIR = path.join(process.cwd(), "data");
const CACHE_FILE = path.join(DATA_DIR, "tool-cache.json");

/**
 * Generate a cache key from tool name and parameters
 */
export function generateCacheKey(toolName: string, params: Record<string, unknown>): string {
	// Sort params for consistent hashing
	const sortedParams = Object.keys(params)
		.sort()
		.map((k) => `${k}=${JSON.stringify(params[k])}`)
		.join("&");
	return `${toolName}:${sortedParams}`;
}

/**
 * Simple hash function for cache keys
 */
function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return Math.abs(hash).toString(36);
}

/**
 * Tool Cache Manager
 */
export class ToolCache {
	private entries: Map<string, CacheEntry> = new Map();
	private config: CacheConfig;
	private stats: { hits: number; misses: number; tokensSaved: number } = {
		hits: 0,
		misses: 0,
		tokensSaved: 0,
	};

	constructor(config: Partial<CacheConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.loadFromFile();
	}

	/**
	 * Check if caching is enabled for a tool
	 */
	isCacheable(toolName: string): boolean {
		if (!this.config.enabled) return false;
		if (this.config.noCacheTools.includes(toolName)) return false;
		return true;
	}

	/**
	 * Get TTL for a tool
	 */
	getTtl(toolName: string): number {
		if (this.config.shortTtlTools.includes(toolName)) {
			return this.config.shortTtl;
		}
		return this.config.defaultTtl;
	}

	/**
	 * Check if cache has result for tool + params
	 */
	has(toolName: string, params: Record<string, unknown>): boolean {
		if (!this.isCacheable(toolName)) return false;

		const key = generateCacheKey(toolName, params);
		const entry = this.entries.get(key);

		if (!entry) return false;

		// Check TTL
		const now = Date.now();
		if (now - entry.timestamp > entry.ttl) {
			this.entries.delete(key);
			this.saveToFile();
			return false;
		}

		return true;
	}

	/**
	 * Get cached result for tool + params
	 */
	get(toolName: string, params: Record<string, unknown>): CacheToolResult | null {
		if (!this.isCacheable(toolName)) {
			return null;
		}

		const key = generateCacheKey(toolName, params);
		const entry = this.entries.get(key);

		if (!entry) {
			this.stats.misses++;
			return null;
		}

		// Check TTL
		const now = Date.now();
		if (now - entry.timestamp > entry.ttl) {
			this.entries.delete(key);
			this.stats.misses++;
			this.saveToFile();
			return null;
		}

		// Cache hit
		entry.hitCount++;
		this.stats.hits++;
		this.stats.tokensSaved += this.config.tokensPerHit;
		entry.tokensSaved += this.config.tokensPerHit;

		return {
			fromCache: true,
			result: entry.result,
			key,
			entry,
			tokensSaved: this.config.tokensPerHit,
		};
	}

	/**
	 * Store result in cache
	 */
	set(toolName: string, params: Record<string, unknown>, result: string): CacheEntry | null {
		if (!this.isCacheable(toolName)) return null;

		// Check max size
		if (this.entries.size >= this.config.maxSize) {
			// Remove oldest entries
			this.evictOldest(Math.floor(this.config.maxSize * 0.1)); // Remove 10%
		}

		const key = generateCacheKey(toolName, params);
		const ttl = this.getTtl(toolName);

		const entry: CacheEntry = {
			key,
			toolName,
			params: JSON.stringify(params),
			result,
			timestamp: Date.now(),
			ttl,
			tokensSaved: 0,
			hitCount: 0,
		};

		this.entries.set(key, entry);
		this.saveToFile();

		return entry;
	}

	/**
	 * Evict oldest entries to free space
	 */
	private evictOldest(count: number): void {
		const sortedEntries = [...this.entries.values()].sort((a, b) => a.timestamp - b.timestamp);

		for (let i = 0; i < Math.min(count, sortedEntries.length); i++) {
			this.entries.delete(sortedEntries[i].key);
		}
	}

	/**
	 * Clear entire cache
	 */
	clear(): void {
		this.entries.clear();
		this.stats = { hits: 0, misses: 0, tokensSaved: 0 };
		this.saveToFile();
	}

	/**
	 * Clear cache for specific tool
	 */
	clearTool(toolName: string): number {
		let cleared = 0;
		for (const [key, entry] of this.entries) {
			if (entry.toolName === toolName) {
				this.entries.delete(key);
				cleared++;
			}
		}
		this.saveToFile();
		return cleared;
	}

	/**
	 * Clear expired entries
	 */
	clearExpired(): number {
		const now = Date.now();
		let cleared = 0;
		for (const [key, entry] of this.entries) {
			if (now - entry.timestamp > entry.ttl) {
				this.entries.delete(key);
				cleared++;
			}
		}
		this.saveToFile();
		return cleared;
	}

	/**
	 * Get cache statistics
	 */
	getStats(): CacheStats {
		const totalCalls = this.stats.hits + this.stats.misses;
		const hitRate = totalCalls > 0 ? (this.stats.hits / totalCalls) * 100 : 0;

		// Group by tool
		const toolHits = new Map<string, { hits: number; tokensSaved: number }>();
		const toolEntries = new Map<string, number>();

		for (const entry of this.entries.values()) {
			const current = toolHits.get(entry.toolName) || { hits: 0, tokensSaved: 0 };
			current.hits += entry.hitCount;
			current.tokensSaved += entry.tokensSaved;
			toolHits.set(entry.toolName, current);

			const count = toolEntries.get(entry.toolName) || 0;
			toolEntries.set(entry.toolName, count + 1);
		}

		// Sort by hits
		const topTools = [...toolHits.entries()]
			.map(([toolName, data]) => ({ toolName, ...data }))
			.sort((a, b) => b.hits - a.hits)
			.slice(0, 10);

		const entriesByTool = [...toolEntries.entries()]
			.map(([toolName, count]) => ({ toolName, count }))
			.sort((a, b) => b.count - a.count);

		const avgHitsPerEntry =
			this.entries.size > 0
				? [...this.entries.values()].reduce((sum, e) => sum + e.hitCount, 0) / this.entries.size
				: 0;

		return {
			hits: this.stats.hits,
			misses: this.stats.misses,
			size: this.entries.size,
			tokensSaved: this.stats.tokensSaved,
			hitRate,
			avgHitsPerEntry,
			topTools,
			entriesByTool,
		};
	}

	/**
	 * Get current configuration
	 */
	getConfig(): CacheConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration
	 */
	setConfig(updates: Partial<CacheConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveToFile();
	}

	/**
	 * Get specific entry
	 */
	getEntry(key: string): CacheEntry | undefined {
		return this.entries.get(key);
	}

	/**
	 * List all entries (optionally filtered by tool)
	 */
	listEntries(toolName?: string): CacheEntry[] {
		const entries = [...this.entries.values()];
		if (toolName) {
			return entries.filter((e) => e.toolName === toolName);
		}
		return entries;
	}

	/**
	 * Enable caching
	 */
	enable(): void {
		this.config.enabled = true;
		this.saveToFile();
	}

	/**
	 * Disable caching
	 */
	disable(): void {
		this.config.enabled = false;
		this.saveToFile();
	}

	/**
	 * Save cache to file
	 */
	private saveToFile(): void {
		try {
			if (!fs.existsSync(DATA_DIR)) {
				fs.mkdirSync(DATA_DIR, { recursive: true });
			}

			const data = {
				entries: [...this.entries.values()],
				stats: this.stats,
				config: this.config,
			};

			fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
		} catch (error) {
			// Silently fail - cache is optional
		}
	}

	/**
	 * Load cache from file
	 */
	private loadFromFile(): void {
		try {
			if (fs.existsSync(CACHE_FILE)) {
				const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));

				if (data.entries) {
					for (const entry of data.entries) {
						this.entries.set(entry.key, entry);
					}
				}

				if (data.stats) {
					this.stats = data.stats;
				}

				if (data.config) {
					// Merge saved config with defaults (saved config may be partial)
					this.config = { ...DEFAULT_CONFIG, ...data.config };
				}

				// Clear expired entries on load
				this.clearExpired();
			}
		} catch (error) {
			// Start fresh if load fails
			this.entries.clear();
		}
	}

	/**
	 * Format stats as markdown
	 */
	formatStats(): string {
		const stats = this.getStats();
		const config = this.getConfig();

		let output = "## Tool Cache Statistics\n\n";
		output += "| Metric | Value |\n|--------|-------|\n";
		output += `| Status | ${config.enabled ? "✅ Enabled" : "❌ Disabled"} |\n`;
		output += `| Cache Hits | ${stats.hits} |\n`;
		output += `| Cache Misses | ${stats.misses} |\n`;
		output += `| Hit Rate | ${stats.hitRate.toFixed(1)}% |\n`;
		output += `| Cache Size | ${stats.size}/${config.maxSize} entries |\n`;
		output += `| Tokens Saved | ~${stats.tokensSaved} |\n`;
		output += `| Avg Hits/Entry | ${stats.avgHitsPerEntry.toFixed(1)} |\n`;
		output += `| Max TTL | ${config.defaultTtl / 60000} minutes |\n`;
		output += `| Short TTL | ${config.shortTtl / 60000} minutes |\n\n`;

		if (stats.topTools.length > 0) {
			output += "### Top Cached Tools\n\n";
			output += "| Tool | Hits | Tokens Saved |\n|------|------|-------------|\n";
			for (const tool of stats.topTools) {
				output += `| ${tool.toolName} | ${tool.hits} | ~${tool.tokensSaved} |\n`;
			}
			output += "\n";
		}

		if (stats.entriesByTool.length > 0) {
			output += "### Entries by Tool\n\n";
			output += "| Tool | Count |\n|------|-------|\n";
			for (const tool of stats.entriesByTool.slice(0, 10)) {
				output += `| ${tool.toolName} | ${tool.count} |\n`;
			}
		}

		return output;
	}

	/**
	 * Format config as markdown
	 */
	formatConfig(): string {
		const config = this.getConfig();

		let output = "## Tool Cache Configuration\n\n";
		output += "| Setting | Value |\n|---------|-------|\n";
		output += `| Enabled | ${config.enabled ? "✅" : "❌"} |\n`;
		output += `| Max Size | ${config.maxSize} entries |\n`;
		output += `| Default TTL | ${config.defaultTtl / 60000} minutes |\n`;
		output += `| Short TTL | ${config.shortTtl / 60000} minutes |\n`;
		output += `| Est. Tokens/Hit | ${config.tokensPerHit} |\n\n`;

		output += "### Never Cached Tools\n\n";
		output += `${config.noCacheTools.map((t) => `- ${t}`).join("\n")}\n\n`;

		output += "### Short TTL Tools\n\n";
		output += `${config.shortTtlTools.map((t) => `- ${t}`).join("\n")}\n`;

		return output;
	}

	/**
	 * Format entries as markdown
	 */
	formatEntries(toolName?: string, limit = 20): string {
		const entries = this.listEntries(toolName).slice(0, limit);
		const now = Date.now();

		let output = `## Cache Entries (${entries.length}${toolName ? ` for ${toolName}` : ""})\n\n`;
		output += "| Key | Tool | Age | TTL | Hits | Tokens Saved |\n";
		output += "|-----|------|-----|-----|------|-------------|\n";

		for (const entry of entries) {
			const age = Math.floor((now - entry.timestamp) / 60000);
			const ttlLeft = Math.floor((entry.ttl - (now - entry.timestamp)) / 60000);
			const keyShort = `${entry.key.substring(0, 30)}...`;
			output += `| ${keyShort} | ${entry.toolName} | ${age}m | ${ttlLeft}m | ${entry.hitCount} | ~${entry.tokensSaved} |\n`;
		}

		return output;
	}
}

// Singleton instance for global cache
let globalCache: ToolCache | null = null;

/**
 * Get or create the global cache instance
 */
export function getToolCache(): ToolCache {
	if (!globalCache) {
		globalCache = new ToolCache();
	}
	return globalCache;
}

/**
 * Reset the global cache (for testing)
 */
export function resetToolCache(): void {
	if (globalCache) {
		globalCache.clear();
	}
	globalCache = null;
}
