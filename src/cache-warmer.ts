/**
 * Cache Warmer Module (Aider Pattern)
 *
 * Keeps prompt cache alive during long sessions by periodically pinging the API
 * with minimal requests. This prevents cache expiration and reduces costs on long
 * evolution sessions.
 *
 * Inspired by Aider's cache warming implementation:
 * https://github.com/Aider-AI/aider/blob/main/aider/coders/base_coder.py
 *
 * Key features:
 * - Background thread for cache keepalive
 * - Configurable ping intervals (default 5 minutes)
 * - Token cache hit tracking
 * - Cost savings estimation
 * - Integration with TokenTracker
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// Types
export interface CacheWarmerConfig {
	enabled: boolean;
	keepAliveDelay: number; // milliseconds between cache warming pings
	numCacheWarmingPings: number; // max number of warming pings
	minCacheHitTokens: number; // minimum cache hit tokens to consider warming
}

export interface CacheWarmingStats {
	totalPings: number;
	successfulPings: number;
	failedPings: number;
	cacheHitTokensPreserved: number;
	estimatedCostSaved: number;
	lastPingTime: string | null;
	averagePingDuration: number;
	sessionStartTime: string;
}

export interface CacheWarmingSession {
	id: string;
	startTime: string;
	pingsCompleted: number;
	cacheHitTokens: number;
	status: "active" | "paused" | "stopped";
}

const DEFAULT_CONFIG: CacheWarmerConfig = {
	enabled: false,
	keepAliveDelay: 5 * 60 * 1000, // 5 minutes
	numCacheWarmingPings: 100, // max 100 pings per session
	minCacheHitTokens: 1000, // minimum 1000 cache hit tokens to warm
};

export class CacheWarmer {
	private config: CacheWarmerConfig;
	private stats: CacheWarmingStats;
	private session: CacheWarmingSession | null = null;
	private warmingInterval: NodeJS.Timeout | null = null;
	private dataPath: string;
	private pingsLeft = 0;
	private isWarming = false;
	private lastCacheHitTokens = 0;

	// Callback for performing the actual API ping
	private pingCallback: (() => Promise<{ cacheHitTokens: number; success: boolean }>) | null = null;

	constructor(configPath?: string) {
		this.config = DEFAULT_CONFIG;
		const homeDir = os.homedir();
		this.dataPath = path.join(homeDir, ".paimon", "cache-warmer.json");
		this.stats = this.getDefaultStats();
		this.loadData();
	}

	private getDefaultStats(): CacheWarmingStats {
		return {
			totalPings: 0,
			successfulPings: 0,
			failedPings: 0,
			cacheHitTokensPreserved: 0,
			estimatedCostSaved: 0,
			lastPingTime: null,
			averagePingDuration: 0,
			sessionStartTime: new Date().toISOString(),
		};
	}

	private loadData(): void {
		try {
			if (fs.existsSync(this.dataPath)) {
				const data = JSON.parse(fs.readFileSync(this.dataPath, "utf-8"));
				this.config = { ...DEFAULT_CONFIG, ...data.config };
				this.stats = { ...this.getDefaultStats(), ...data.stats };
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
			console.error("Failed to save cache warmer data:", error);
		}
	}

	/**
	 * Set the callback function that performs the actual API ping
	 */
	public setPingCallback(
		callback: () => Promise<{ cacheHitTokens: number; success: boolean }>,
	): void {
		this.pingCallback = callback;
	}

	/**
	 * Start cache warming session
	 */
	public start(): { success: boolean; message: string; sessionId?: string } {
		if (!this.config.enabled) {
			return { success: false, message: "Cache warming is disabled" };
		}

		if (this.isWarming) {
			return { success: false, message: "Cache warming is already active" };
		}

		this.session = {
			id: `cache-warm-${Date.now()}`,
			startTime: new Date().toISOString(),
			pingsCompleted: 0,
			cacheHitTokens: 0,
			status: "active",
		};

		this.pingsLeft = this.config.numCacheWarmingPings;
		this.isWarming = true;

		// Start the warming interval
		this.warmingInterval = setInterval(() => {
			this.performWarmingPing();
		}, this.config.keepAliveDelay);

		// Schedule first ping sooner (after 30 seconds)
		setTimeout(() => {
			this.performWarmingPing();
		}, 30000);

		this.saveData();

		return {
			success: true,
			message: `Cache warming started. Pings every ${this.config.keepAliveDelay / 1000 / 60} minutes, max ${this.config.numCacheWarmingPings} pings.`,
			sessionId: this.session.id,
		};
	}

	/**
	 * Stop cache warming session
	 */
	public stop(): { success: boolean; message: string; stats?: CacheWarmingStats } {
		if (!this.isWarming) {
			return { success: false, message: "Cache warming is not active" };
		}

		if (this.warmingInterval) {
			clearInterval(this.warmingInterval);
			this.warmingInterval = null;
		}

		this.isWarming = false;
		const sessionStats = { ...this.stats };

		if (this.session) {
			this.session.status = "stopped";
			this.saveData();
		}

		return {
			success: true,
			message: `Cache warming stopped. Completed ${this.session?.pingsCompleted || 0} pings, preserved ~${this.stats.cacheHitTokensPreserved.toLocaleString()} cache tokens.`,
			stats: sessionStats,
		};
	}

	/**
	 * Pause cache warming
	 */
	public pause(): { success: boolean; message: string } {
		if (!this.isWarming) {
			return { success: false, message: "Cache warming is not active" };
		}

		if (this.warmingInterval) {
			clearInterval(this.warmingInterval);
			this.warmingInterval = null;
		}

		if (this.session) {
			this.session.status = "paused";
		}

		return { success: true, message: "Cache warming paused" };
	}

	/**
	 * Resume cache warming
	 */
	public resume(): { success: boolean; message: string } {
		if (!this.session || this.session.status !== "paused") {
			return { success: false, message: "No paused session to resume" };
		}

		this.session.status = "active";

		// Restart the warming interval
		this.warmingInterval = setInterval(() => {
			this.performWarmingPing();
		}, this.config.keepAliveDelay);

		return { success: true, message: "Cache warming resumed" };
	}

	/**
	 * Perform a single warming ping
	 */
	private async performWarmingPing(): Promise<void> {
		if (!this.isWarming || this.pingsLeft <= 0) {
			this.stop();
			return;
		}

		if (!this.pingCallback) {
			console.warn("CacheWarmer: No ping callback set, cannot perform warming ping");
			return;
		}

		const startTime = Date.now();
		this.pingsLeft--;

		try {
			const result = await this.pingCallback();
			const duration = Date.now() - startTime;

			this.stats.totalPings++;
			this.stats.lastPingTime = new Date().toISOString();

			if (result.success) {
				this.stats.successfulPings++;
				this.stats.cacheHitTokensPreserved += result.cacheHitTokens;
				this.lastCacheHitTokens = result.cacheHitTokens;

				if (this.session) {
					this.session.pingsCompleted++;
					this.session.cacheHitTokens += result.cacheHitTokens;
				}

				// Calculate average ping duration
				const totalDuration =
					this.stats.averagePingDuration * (this.stats.totalPings - 1) + duration;
				this.stats.averagePingDuration = totalDuration / this.stats.totalPings;

				// Estimate cost saved (assuming $3 per 1M cached tokens for Claude)
				const costPerToken = 0.000003; // $3 / 1M tokens
				this.stats.estimatedCostSaved += result.cacheHitTokens * costPerToken;
			} else {
				this.stats.failedPings++;
			}

			this.saveData();
		} catch (error) {
			this.stats.failedPings++;
			console.error("Cache warming ping failed:", error);
			this.saveData();
		}
	}

	/**
	 * Perform a manual ping (not counted against warming budget)
	 */
	public async manualPing(): Promise<{
		success: boolean;
		cacheHitTokens: number;
		message: string;
	}> {
		if (!this.pingCallback) {
			return { success: false, cacheHitTokens: 0, message: "No ping callback configured" };
		}

		try {
			const result = await this.pingCallback();
			this.lastCacheHitTokens = result.cacheHitTokens;
			return {
				success: result.success,
				cacheHitTokens: result.cacheHitTokens,
				message: result.success
					? `Cache ping successful. ${result.cacheHitTokens.toLocaleString()} cache hit tokens preserved.`
					: "Cache ping failed",
			};
		} catch (error) {
			return {
				success: false,
				cacheHitTokens: 0,
				message: `Cache ping error: ${error}`,
			};
		}
	}

	/**
	 * Get current status
	 */
	public getStatus(): {
		isWarming: boolean;
		config: CacheWarmerConfig;
		session: CacheWarmingSession | null;
		pingsRemaining: number;
		lastCacheHitTokens: number;
	} {
		return {
			isWarming: this.isWarming,
			config: this.config,
			session: this.session,
			pingsRemaining: this.pingsLeft,
			lastCacheHitTokens: this.lastCacheHitTokens,
		};
	}

	/**
	 * Get statistics
	 */
	public getStats(): CacheWarmingStats {
		return { ...this.stats };
	}

	/**
	 * Get configuration
	 */
	public getConfig(): CacheWarmerConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration
	 */
	public updateConfig(updates: Partial<CacheWarmerConfig>): {
		success: boolean;
		message: string;
		config: CacheWarmerConfig;
	} {
		this.config = { ...this.config, ...updates };
		this.saveData();

		return {
			success: true,
			message: "Configuration updated",
			config: this.config,
		};
	}

	/**
	 * Enable cache warming
	 */
	public enable(): { success: boolean; message: string } {
		this.config.enabled = true;
		this.saveData();
		return { success: true, message: "Cache warming enabled" };
	}

	/**
	 * Disable cache warming
	 */
	public disable(): { success: boolean; message: string } {
		if (this.isWarming) {
			this.stop();
		}
		this.config.enabled = false;
		this.saveData();
		return { success: true, message: "Cache warming disabled" };
	}

	/**
	 * Reset statistics
	 */
	public resetStats(): { success: boolean; message: string } {
		this.stats = this.getDefaultStats();
		this.saveData();
		return { success: true, message: "Statistics reset" };
	}

	/**
	 * Check if cache warming is enabled
	 */
	public isEnabled(): boolean {
		return this.config.enabled;
	}

	/**
	 * Check if actively warming
	 */
	public isActive(): boolean {
		return this.isWarming;
	}
}

// Singleton instance
let cacheWarmerInstance: CacheWarmer | null = null;

export function getCacheWarmer(): CacheWarmer {
	if (!cacheWarmerInstance) {
		cacheWarmerInstance = new CacheWarmer();
	}
	return cacheWarmerInstance;
}

export function resetCacheWarmerInstance(): void {
	if (cacheWarmerInstance) {
		cacheWarmerInstance.stop();
	}
	cacheWarmerInstance = null;
}
