import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	CacheConfig,
	CacheEntry,
	ToolCache,
	generateCacheKey,
	getToolCache,
	resetToolCache,
} from "./tool-cache.js";

const DATA_DIR = path.join(process.cwd(), "data");
const CACHE_FILE = path.join(DATA_DIR, "tool-cache.json");

describe("ToolCache", () => {
	let cache: ToolCache;

	beforeEach(() => {
		// Reset global cache and create fresh instance
		resetToolCache();
		cache = new ToolCache();
		// Clear any existing cache file
		if (fs.existsSync(CACHE_FILE)) {
			fs.unlinkSync(CACHE_FILE);
		}
	});

	afterEach(() => {
		// Clean up
		cache.clear();
		if (fs.existsSync(CACHE_FILE)) {
			fs.unlinkSync(CACHE_FILE);
		}
	});

	describe("generateCacheKey", () => {
		it("should generate consistent keys for same tool + params", () => {
			const key1 = generateCacheKey("read", { path: "test.ts" });
			const key2 = generateCacheKey("read", { path: "test.ts" });
			expect(key1).toBe(key2);
		});

		it("should generate different keys for different params", () => {
			const key1 = generateCacheKey("read", { path: "test1.ts" });
			const key2 = generateCacheKey("read", { path: "test2.ts" });
			expect(key1).not.toBe(key2);
		});

		it("should handle sorted params", () => {
			const key1 = generateCacheKey("grep", { pattern: "test", path: "src" });
			const key2 = generateCacheKey("grep", { path: "src", pattern: "test" });
			expect(key1).toBe(key2);
		});
	});

	describe("isCacheable", () => {
		it("should return true for cacheable tools", () => {
			expect(cache.isCacheable("glob")).toBe(true);
			expect(cache.isCacheable("repomap")).toBe(true);
			expect(cache.isCacheable("find")).toBe(true);
		});

		it("should return false for non-cacheable tools", () => {
			expect(cache.isCacheable("bash")).toBe(false);
			expect(cache.isCacheable("edit")).toBe(false);
			expect(cache.isCacheable("write")).toBe(false);
		});

		it("should respect enabled config", () => {
			cache.setConfig({ enabled: false });
			expect(cache.isCacheable("glob")).toBe(false);
			cache.setConfig({ enabled: true });
			expect(cache.isCacheable("glob")).toBe(true);
		});
	});

	describe("getTtl", () => {
		it("should return default TTL for normal tools", () => {
			const defaultTtl = cache.getConfig().defaultTtl;
			expect(cache.getTtl("repomap")).toBe(defaultTtl);
		});

		it("should return short TTL for short TTL tools", () => {
			const shortTtl = cache.getConfig().shortTtl;
			expect(cache.getTtl("read")).toBe(shortTtl);
			expect(cache.getTtl("ls")).toBe(shortTtl);
			expect(cache.getTtl("glob")).toBe(shortTtl);
		});
	});

	describe("set and get", () => {
		it("should store and retrieve cached results", () => {
			const result = "file content here";
			cache.set("glob", { pattern: "*.ts" }, result);

			const cached = cache.get("glob", { pattern: "*.ts" });
			expect(cached).not.toBeNull();
			expect(cached?.fromCache).toBe(true);
			expect(cached?.result).toBe(result);
		});

		it("should return null for non-existent entries", () => {
			const cached = cache.get("glob", { pattern: "*.ts" });
			expect(cached).toBeNull();
		});

		it("should track hits and misses", () => {
			cache.set("glob", { pattern: "*.ts" }, "result");

			// First hit
			cache.get("glob", { pattern: "*.ts" });
			// Second hit
			cache.get("glob", { pattern: "*.ts" });
			// Miss
			cache.get("glob", { pattern: "*.js" });

			const stats = cache.getStats();
			expect(stats.hits).toBe(2);
			expect(stats.misses).toBe(1);
		});

		it("should not cache non-cacheable tools", () => {
			const entry = cache.set("bash", { command: "ls" }, "output");
			expect(entry).toBeNull();

			const cached = cache.get("bash", { command: "ls" });
			expect(cached).toBeNull();
		});

		it("should respect TTL expiration", async () => {
			// Set with very short TTL
			cache.setConfig({ shortTtl: 100 }); // 100ms

			cache.set("read", { path: "test.ts" }, "content");

			// Should be cached immediately
			expect(cache.has("read", { path: "test.ts" })).toBe(true);

			// Wait for TTL to expire
			await new Promise((resolve) => setTimeout(resolve, 150));

			// Should be expired now
			expect(cache.has("read", { path: "test.ts" })).toBe(false);
		});

		it("should track tokens saved", () => {
			cache.set("glob", { pattern: "*.ts" }, "result");
			cache.get("glob", { pattern: "*.ts" });
			cache.get("glob", { pattern: "*.ts" });

			const stats = cache.getStats();
			expect(stats.tokensSaved).toBeGreaterThan(0);
		});
	});

	describe("has", () => {
		it("should return true for cached entries", () => {
			cache.set("glob", { pattern: "*.ts" }, "result");
			expect(cache.has("glob", { pattern: "*.ts" })).toBe(true);
		});

		it("should return false for non-cached entries", () => {
			expect(cache.has("glob", { pattern: "*.ts" })).toBe(false);
		});

		it("should return false for non-cacheable tools", () => {
			expect(cache.has("bash", { command: "ls" })).toBe(false);
		});
	});

	describe("clear", () => {
		it("should clear all entries", () => {
			cache.set("glob", { pattern: "*.ts" }, "result1");
			cache.set("find", { name: "*.ts" }, "result2");

			cache.clear();

			const stats = cache.getStats();
			expect(stats.size).toBe(0);
			expect(cache.has("glob", { pattern: "*.ts" })).toBe(false);
		});

		it("should reset stats", () => {
			cache.set("glob", { pattern: "*.ts" }, "result");
			cache.get("glob", { pattern: "*.ts" });

			cache.clear();

			const stats = cache.getStats();
			expect(stats.hits).toBe(0);
			expect(stats.misses).toBe(0);
			expect(stats.tokensSaved).toBe(0);
		});
	});

	describe("clearTool", () => {
		it("should clear entries for specific tool", () => {
			cache.set("glob", { pattern: "*.ts" }, "result1");
			cache.set("find", { name: "*.ts" }, "result2");

			const cleared = cache.clearTool("glob");

			expect(cleared).toBe(1);
			expect(cache.has("glob", { pattern: "*.ts" })).toBe(false);
			expect(cache.has("find", { name: "*.ts" })).toBe(true);
		});

		it("should return 0 if no entries for tool", () => {
			const cleared = cache.clearTool("bash");
			expect(cleared).toBe(0);
		});
	});

	describe("clearExpired", () => {
		it("should clear expired entries", async () => {
			// Set with very short TTL for read (short TTL tool)
			cache.setConfig({ shortTtl: 50 }); // 50ms

			cache.set("read", { path: "test1.ts" }, "content1");

			// Set with default TTL (long) - use repomap which is NOT in shortTtlTools
			cache.set("repomap", { maxTokens: 1000 }, "result");

			// Wait for short TTL to expire
			await new Promise((resolve) => setTimeout(resolve, 100));

			const cleared = cache.clearExpired();

			expect(cleared).toBe(1); // read entry expired
			expect(cache.has("read", { path: "test1.ts" })).toBe(false);
			expect(cache.has("repomap", { maxTokens: 1000 })).toBe(true);
		});
	});

	describe("getStats", () => {
		it("should return correct statistics", () => {
			cache.set("glob", { pattern: "*.ts" }, "result");
			cache.set("find", { name: "*.ts" }, "result2");
			cache.get("glob", { pattern: "*.ts" });
			cache.get("glob", { pattern: "*.ts" });
			cache.get("find", { name: "*.ts" });
			cache.get("glob", { pattern: "*.js" }); // miss

			const stats = cache.getStats();

			expect(stats.hits).toBe(3);
			expect(stats.misses).toBe(1);
			expect(stats.size).toBe(2);
			expect(stats.hitRate).toBeCloseTo(75, 1); // 3/4 = 75%
			expect(stats.tokensSaved).toBeGreaterThan(0);
		});

		it("should track top tools by hits", () => {
			cache.set("glob", { pattern: "*.ts" }, "result");
			cache.set("find", { name: "*.ts" }, "result2");
			cache.get("glob", { pattern: "*.ts" });
			cache.get("glob", { pattern: "*.ts" });
			cache.get("find", { name: "*.ts" });

			const stats = cache.getStats();

			expect(stats.topTools.length).toBeGreaterThan(0);
			expect(stats.topTools[0].toolName).toBe("glob"); // Most hits
			expect(stats.topTools[0].hits).toBe(2);
		});

		it("should track entries by tool", () => {
			cache.set("glob", { pattern: "*.ts" }, "result1");
			cache.set("glob", { pattern: "*.js" }, "result2");
			cache.set("find", { name: "*.ts" }, "result3");

			const stats = cache.getStats();

			expect(stats.entriesByTool.length).toBeGreaterThan(0);
			// glob should have 2 entries
			const globEntry = stats.entriesByTool.find((e) => e.toolName === "glob");
			expect(globEntry?.count).toBe(2);
		});
	});

	describe("config", () => {
		it("should return current config", () => {
			const config = cache.getConfig();
			expect(config.enabled).toBe(true);
			expect(config.maxSize).toBeGreaterThan(0);
			expect(config.defaultTtl).toBeGreaterThan(0);
		});

		it("should update config", () => {
			cache.setConfig({ maxSize: 500, enabled: false });

			const config = cache.getConfig();
			expect(config.maxSize).toBe(500);
			expect(config.enabled).toBe(false);
		});

		it("should enable and disable", () => {
			cache.disable();
			expect(cache.getConfig().enabled).toBe(false);

			cache.enable();
			expect(cache.getConfig().enabled).toBe(true);
		});
	});

	describe("eviction", () => {
		it("should evict oldest entries when max size reached", () => {
			cache.setConfig({ maxSize: 10 });

			// Add 15 entries
			for (let i = 0; i < 15; i++) {
				cache.set("glob", { pattern: `*${i}.ts` }, `result${i}`);
			}

			// Should have evicted some entries
			const stats = cache.getStats();
			expect(stats.size).toBeLessThanOrEqual(10);
		});
	});

	describe("listEntries", () => {
		it("should list all entries", () => {
			cache.set("glob", { pattern: "*.ts" }, "result1");
			cache.set("find", { name: "*.ts" }, "result2");

			const entries = cache.listEntries();
			expect(entries.length).toBe(2);
		});

		it("should filter by tool", () => {
			cache.set("glob", { pattern: "*.ts" }, "result1");
			cache.set("find", { name: "*.ts" }, "result2");
			cache.set("glob", { pattern: "*.js" }, "result3");

			const entries = cache.listEntries("glob");
			expect(entries.length).toBe(2);
			expect(entries.every((e) => e.toolName === "glob")).toBe(true);
		});
	});

	describe("formatStats", () => {
		it("should format stats as markdown", () => {
			cache.set("glob", { pattern: "*.ts" }, "result");
			cache.get("glob", { pattern: "*.ts" });

			const formatted = cache.formatStats();

			expect(formatted).toContain("Tool Cache Statistics");
			expect(formatted).toContain("Cache Hits");
			expect(formatted).toContain("Enabled");
		});
	});

	describe("formatConfig", () => {
		it("should format config as markdown", () => {
			const formatted = cache.formatConfig();

			expect(formatted).toContain("Tool Cache Configuration");
			expect(formatted).toContain("Never Cached Tools");
			expect(formatted).toContain("bash");
		});
	});

	describe("formatEntries", () => {
		it("should format entries as markdown", () => {
			cache.set("glob", { pattern: "*.ts" }, "result");

			const formatted = cache.formatEntries();

			expect(formatted).toContain("Cache Entries");
			expect(formatted).toContain("glob");
		});

		it("should filter entries by tool", () => {
			cache.set("glob", { pattern: "*.ts" }, "result1");
			cache.set("find", { name: "*.ts" }, "result2");

			const formatted = cache.formatEntries("glob");

			expect(formatted).toContain("glob");
			expect(formatted).not.toContain("find");
		});
	});

	describe("persistence", () => {
		it("should save and load from file", () => {
			cache.set("glob", { pattern: "*.ts" }, "result");
			cache.get("glob", { pattern: "*.ts" });

			// Create new cache to load from file
			const cache2 = new ToolCache();

			const stats = cache2.getStats();
			expect(stats.size).toBeGreaterThan(0);
			expect(cache2.has("glob", { pattern: "*.ts" })).toBe(true);
		});

		it("should persist config updates", () => {
			cache.setConfig({ maxSize: 500 });

			const cache2 = new ToolCache();
			expect(cache2.getConfig().maxSize).toBe(500);
		});
	});
});

describe("getToolCache singleton", () => {
	beforeEach(() => {
		resetToolCache();
		if (fs.existsSync(CACHE_FILE)) {
			fs.unlinkSync(CACHE_FILE);
		}
	});

	afterEach(() => {
		resetToolCache();
		if (fs.existsSync(CACHE_FILE)) {
			fs.unlinkSync(CACHE_FILE);
		}
	});

	it("should return same instance", () => {
		const cache1 = getToolCache();
		const cache2 = getToolCache();
		expect(cache1).toBe(cache2);
	});

	it("should reset to new instance", () => {
		const cache1 = getToolCache();
		cache1.set("glob", { pattern: "*.ts" }, "result");

		resetToolCache();
		const cache2 = getToolCache();

		expect(cache1).not.toBe(cache2);
		expect(cache2.has("glob", { pattern: "*.ts" })).toBe(false);
	});
});
