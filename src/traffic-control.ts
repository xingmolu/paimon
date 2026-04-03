/**
 * Traffic Control Module (OpenHands Pattern)
 *
 * Manages API rate limiting and throttling to prevent failures
 * during intense evolution sessions or batch operations.
 *
 * States:
 * - Normal: Default state, no rate limiting
 * - Throttling: Task paused due to rate limit, waiting
 * - Paused: Traffic control temporarily paused (user override)
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// Traffic control states (OpenHands pattern)
export type TrafficControlState = "normal" | "throttling" | "paused";

// Rate limit information from API response
export interface RateLimitInfo {
	/** Is rate limited (429 or similar) */
	isRateLimited: boolean;
	/** Retry after seconds (from header or default) */
	retryAfterSeconds: number;
	/** Error message from API */
	errorMessage?: string;
	/** Timestamp when rate limit was detected */
	detectedAt: number;
	/** API endpoint that triggered rate limit */
	endpoint?: string;
}

// Traffic control configuration
export interface TrafficControlConfig {
	/** Enable traffic control */
	enabled: boolean;
	/** Default retry delay in seconds */
	defaultRetryDelay: number;
	/** Maximum retry delay in seconds */
	maxRetryDelay: number;
	/** Minimum retry delay in seconds */
	minRetryDelay: number;
	/** Exponential backoff multiplier */
	backoffMultiplier: number;
	/** Maximum consecutive rate limit errors before pausing */
	maxConsecutiveErrors: number;
	/** Auto-recovery: return to normal after this many successful calls */
	autoRecoveryThreshold: number;
	/** Warning threshold: warn when approaching rate limit */
	warningThresholdPercent: number;
	/** Log rate limit events */
	logEvents: boolean;
}

// Traffic control statistics
export interface TrafficControlStats {
	/** Total API calls made */
	totalCalls: number;
	/** Number of rate limit errors encountered */
	rateLimitErrors: number;
	/** Number of successful calls after recovery */
	successfulCalls: number;
	/** Number of throttling events */
	throttlingEvents: number;
	/** Number of times paused */
	pauseEvents: number;
	/** Total time spent throttling (seconds) */
	totalThrottleTime: number;
	/** Average retry delay (seconds) */
	averageRetryDelay: number;
	/** Current consecutive errors */
	consecutiveErrors: number;
	/** Current state */
	currentState: TrafficControlState;
	/** Last rate limit event timestamp */
	lastRateLimitAt: number | null;
	/** Rate limit events by endpoint */
	eventsByEndpoint: Record<string, number>;
}

// Traffic control event
export interface TrafficControlEvent {
	/** Event type */
	type:
		| "rate_limit"
		| "throttle_start"
		| "throttle_end"
		| "pause"
		| "resume"
		| "warning"
		| "recovery";
	/** Timestamp */
	timestamp: number;
	/** State before event */
	stateBefore: TrafficControlState;
	/** State after event */
	stateAfter: TrafficControlState;
	/** Retry delay if throttling */
	retryDelay?: number;
	/** Error message */
	errorMessage?: string;
	/** Endpoint */
	endpoint?: string;
	/** Notes */
	notes?: string;
}

const DEFAULT_CONFIG: TrafficControlConfig = {
	enabled: true,
	defaultRetryDelay: 60, // 60 seconds default
	maxRetryDelay: 300, // 5 minutes max
	minRetryDelay: 5, // 5 seconds min
	backoffMultiplier: 2, // Double delay each time
	maxConsecutiveErrors: 5, // Pause after 5 consecutive errors
	autoRecoveryThreshold: 3, // Return to normal after 3 successes
	warningThresholdPercent: 80, // Warn at 80% of rate limit
	logEvents: true,
};

/**
 * TrafficControlManager
 *
 * Manages API rate limiting with throttling states and recovery.
 */
export class TrafficControlManager {
	private state: TrafficControlState = "normal";
	private config: TrafficControlConfig;
	private stats: TrafficControlStats;
	private events: TrafficControlEvent[] = [];
	private currentRetryDelay = 0;
	private throttleStartTime: number | null = null;
	private consecutiveSuccessfulCalls = 0;
	private dataPath: string;

	private static instance: TrafficControlManager | null = null;

	constructor(config?: Partial<TrafficControlConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.stats = this.initStats();
		this.dataPath = path.join(os.homedir(), ".paimon", "traffic-control.json");
		this.loadState();
	}

	static getInstance(config?: Partial<TrafficControlConfig>): TrafficControlManager {
		if (!TrafficControlManager.instance) {
			TrafficControlManager.instance = new TrafficControlManager(config);
		}
		return TrafficControlManager.instance;
	}

	private initStats(): TrafficControlStats {
		return {
			totalCalls: 0,
			rateLimitErrors: 0,
			successfulCalls: 0,
			throttlingEvents: 0,
			pauseEvents: 0,
			totalThrottleTime: 0,
			averageRetryDelay: 0,
			consecutiveErrors: 0,
			currentState: "normal",
			lastRateLimitAt: null,
			eventsByEndpoint: {},
		};
	}

	// State management

	getState(): TrafficControlState {
		return this.state;
	}

	setState(newState: TrafficControlState, reason?: string): void {
		const oldState = this.state;
		this.state = newState;
		this.stats.currentState = newState;

		if (newState === "paused") {
			this.stats.pauseEvents++;
		}

		this.addEvent({
			type: newState === "paused" ? "pause" : newState === "normal" ? "resume" : "throttle_start",
			timestamp: Date.now(),
			stateBefore: oldState,
			stateAfter: newState,
			notes: reason,
		});

		this.saveState();
	}

	// Rate limit detection

	detectRateLimit(error: unknown, endpoint?: string): RateLimitInfo {
		// Check for 429 Too Many Requests
		const errorObj = error as Record<string, unknown>;
		const status = errorObj?.status as number | undefined;
		const statusCode = errorObj?.statusCode as number | undefined;
		const message = (errorObj?.message as string) || String(error);

		// Check for rate limit indicators
		const isRateLimited =
			status === 429 ||
			statusCode === 429 ||
			message.includes("rate limit") ||
			message.includes("too many requests") ||
			message.includes("quota exceeded") ||
			message.includes("API limit");

		// Extract retry-after from headers or error
		let retryAfterSeconds = this.config.defaultRetryDelay;

		// Check for retry-after header
		const headers = errorObj?.headers as Record<string, string> | undefined;
		if (headers?.["retry-after"]) {
			const retryAfter = Number.parseInt(headers["retry-after"], 10);
			if (retryAfter > 0) {
				retryAfterSeconds = Math.min(retryAfter, this.config.maxRetryDelay);
			}
		}

		// Check for retry-after in message
		const retryMatch = message.match(/retry\s*(?:after|in)\s*(\d+)\s*(second|minute|sec|min)/i);
		if (retryMatch) {
			const value = Number.parseInt(retryMatch[1], 10);
			const unit = retryMatch[2].toLowerCase();
			if (unit.includes("min")) {
				retryAfterSeconds = Math.min(value * 60, this.config.maxRetryDelay);
			} else {
				retryAfterSeconds = Math.min(value, this.config.maxRetryDelay);
			}
		}

		return {
			isRateLimited,
			retryAfterSeconds,
			errorMessage: message,
			detectedAt: Date.now(),
			endpoint,
		};
	}

	// Handle rate limit error

	handleRateLimitError(error: unknown, endpoint?: string): TrafficControlState {
		if (!this.config.enabled) {
			return this.state;
		}

		const rateLimitInfo = this.detectRateLimit(error, endpoint);

		if (!rateLimitInfo.isRateLimited) {
			// Not a rate limit error, reset consecutive errors
			this.stats.consecutiveErrors = 0;
			return this.state;
		}

		// Update stats
		this.stats.rateLimitErrors++;
		this.stats.consecutiveErrors++;
		this.stats.lastRateLimitAt = rateLimitInfo.detectedAt;

		if (endpoint) {
			this.stats.eventsByEndpoint[endpoint] = (this.stats.eventsByEndpoint[endpoint] || 0) + 1;
		}

		// Calculate retry delay with exponential backoff
		const newRetryDelay = Math.min(
			Math.max(
				this.currentRetryDelay * this.config.backoffMultiplier || rateLimitInfo.retryAfterSeconds,
				this.config.minRetryDelay,
			),
			this.config.maxRetryDelay,
		);
		this.currentRetryDelay = newRetryDelay;

		// Update average retry delay
		this.stats.averageRetryDelay =
			(this.stats.averageRetryDelay * this.stats.throttlingEvents + newRetryDelay) /
			(this.stats.throttlingEvents + 1);

		// Check if should pause
		if (this.stats.consecutiveErrors >= this.config.maxConsecutiveErrors) {
			this.setState(
				"paused",
				`Max consecutive errors (${this.config.maxConsecutiveErrors}) reached`,
			);
			return "paused";
		}

		// Start throttling
		this.setState("throttling", `Rate limit detected: ${rateLimitInfo.errorMessage}`);
		this.stats.throttlingEvents++;
		this.throttleStartTime = Date.now();

		this.addEvent({
			type: "rate_limit",
			timestamp: Date.now(),
			stateBefore: this.state,
			stateAfter: "throttling",
			retryDelay: newRetryDelay,
			errorMessage: rateLimitInfo.errorMessage,
			endpoint,
		});

		return "throttling";
	}

	// Handle successful API call

	handleSuccess(endpoint?: string): void {
		this.stats.totalCalls++;
		this.stats.successfulCalls++;
		this.stats.consecutiveErrors = 0;

		if (this.state === "throttling") {
			// End throttle
			if (this.throttleStartTime) {
				const throttleTime = (Date.now() - this.throttleStartTime) / 1000;
				this.stats.totalThrottleTime += throttleTime;
				this.throttleStartTime = null;
			}

			this.consecutiveSuccessfulCalls++;

			if (this.consecutiveSuccessfulCalls >= this.config.autoRecoveryThreshold) {
				this.setState(
					"normal",
					`Auto-recovery after ${this.config.autoRecoveryThreshold} successes`,
				);
				this.consecutiveSuccessfulCalls = 0;
				this.currentRetryDelay = 0;

				this.addEvent({
					type: "recovery",
					timestamp: Date.now(),
					stateBefore: "throttling",
					stateAfter: "normal",
					endpoint,
				});
			}
		}
	}

	// Get retry delay

	getRetryDelay(): number {
		return this.currentRetryDelay;
	}

	// Should wait before next call

	shouldWait(): boolean {
		return this.state === "throttling" && this.config.enabled;
	}

	// Get wait time remaining

	getWaitTimeRemaining(): number {
		if (this.state !== "throttling" || !this.throttleStartTime) {
			return 0;
		}

		const elapsed = (Date.now() - this.throttleStartTime) / 1000;
		return Math.max(0, this.currentRetryDelay - elapsed);
	}

	// Wait for throttle (async)

	async waitForThrottle(): Promise<void> {
		const waitTime = this.getWaitTimeRemaining();
		if (waitTime > 0) {
			if (this.config.logEvents) {
				console.log(`[TrafficControl] Waiting ${waitTime.toFixed(1)}s due to rate limit`);
			}
			await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
		}
	}

	// Pause/resume

	pause(reason?: string): void {
		this.setState("paused", reason || "Manual pause");
	}

	resume(): void {
		if (this.state === "paused") {
			this.setState("normal", "Manual resume");
			this.stats.consecutiveErrors = 0;
			this.currentRetryDelay = 0;
		}
	}

	// Configuration

	getConfig(): TrafficControlConfig {
		return this.config;
	}

	updateConfig(updates: Partial<TrafficControlConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveState();
	}

	enable(): void {
		this.config.enabled = true;
		this.saveState();
	}

	disable(): void {
		this.config.enabled = false;
		this.saveState();
	}

	// Statistics

	getStats(): TrafficControlStats {
		return { ...this.stats };
	}

	resetStats(): void {
		this.stats = this.initStats();
		this.events = [];
		this.currentRetryDelay = 0;
		this.throttleStartTime = null;
		this.consecutiveSuccessfulCalls = 0;
		this.saveState();
	}

	// Events

	getEvents(limit?: number): TrafficControlEvent[] {
		return limit ? this.events.slice(-limit) : [...this.events];
	}

	getRecentEvents(limit = 10): TrafficControlEvent[] {
		return this.events.slice(-limit);
	}

	clearEvents(): void {
		this.events = [];
		this.saveState();
	}

	private addEvent(event: TrafficControlEvent): void {
		this.events.push(event);
		// Keep max 100 events
		if (this.events.length > 100) {
			this.events = this.events.slice(-100);
		}
		this.saveState();
	}

	// Persistence

	private loadState(): void {
		try {
			if (fs.existsSync(this.dataPath)) {
				const data = JSON.parse(fs.readFileSync(this.dataPath, "utf-8"));
				this.state = data.state || "normal";
				this.config = { ...DEFAULT_CONFIG, ...data.config };
				this.stats = { ...this.initStats(), ...data.stats };
				this.events = data.events || [];
				this.stats.currentState = this.state;
			}
		} catch (error) {
			// Ignore load errors, use defaults
		}
	}

	private saveState(): void {
		try {
			const dir = path.dirname(this.dataPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}

			const data = {
				state: this.state,
				config: this.config,
				stats: this.stats,
				events: this.events,
			};

			fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
		} catch (error) {
			// Ignore save errors
		}
	}

	// Utility methods

	isNormal(): boolean {
		return this.state === "normal";
	}

	isThrottling(): boolean {
		return this.state === "throttling";
	}

	isPaused(): boolean {
		return this.state === "paused";
	}

	isEnabled(): boolean {
		return this.config.enabled;
	}

	// Get status summary

	getStatusSummary(): string {
		const status = {
			state: this.state,
			enabled: this.config.enabled,
			waitTime: this.getWaitTimeRemaining(),
			consecutiveErrors: this.stats.consecutiveErrors,
			rateLimitErrors: this.stats.rateLimitErrors,
			throttleEvents: this.stats.throttlingEvents,
		};

		if (this.state === "throttling") {
			return `Traffic Control: THROTTLING (wait ${status.waitTime.toFixed(1)}s)`;
		}
		if (this.state === "paused") {
			return `Traffic Control: PAUSED (${status.consecutiveErrors} consecutive errors)`;
		}
		return `Traffic Control: NORMAL (${status.rateLimitErrors} rate limits, ${status.throttleEvents} throttles)`;
	}
}

// Singleton getter
export function getTrafficControlManager(
	config?: Partial<TrafficControlConfig>,
): TrafficControlManager {
	return TrafficControlManager.getInstance(config);
}
