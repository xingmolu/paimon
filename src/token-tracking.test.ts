/**
 * Tests for Token/Cost Tracking module
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	TokenSession,
	type TokenTracker,
	type TokenUsage,
	getTokenTracker,
	resetTokenTracker,
} from "./token-tracking.js";

describe("TokenTracker", () => {
	let tracker: TokenTracker;

	beforeEach(() => {
		resetTokenTracker();
		tracker = getTokenTracker({ dataDir: "data/test-tokens" });
		tracker.clear();
	});

	afterEach(() => {
		tracker.clear();
	});

	describe("Session Management", () => {
		it("should start a new session", () => {
			const session = tracker.startSession("test-session-1", "capability");

			expect(session.sessionId).toBe("test-session-1");
			expect(session.taskType).toBe("capability");
			expect(session.totalPromptTokens).toBe(0);
			expect(session.totalCompletionTokens).toBe(0);
			expect(session.totalCost).toBe(0);
			expect(session.apiCalls).toBe(0);
		});

		it("should end a session", () => {
			tracker.startSession("test-session-2");
			const session = tracker.endSession(true);

			expect(session?.sessionId).toBe("test-session-2");
			expect(session?.endTime).toBeDefined();
			expect(session?.success).toBe(true);
		});

		it("should list all sessions", () => {
			tracker.startSession("session-1");
			tracker.startSession("session-2");
			tracker.endSession();

			const sessions = tracker.listSessions();
			expect(sessions.length).toBeGreaterThanOrEqual(2);
		});

		it("should get session by ID", () => {
			tracker.startSession("specific-session");
			const session = tracker.getSession("specific-session");

			expect(session?.sessionId).toBe("specific-session");
		});
	});

	describe("Usage Recording", () => {
		it("should record token usage", () => {
			const usage = tracker.recordUsage({
				model: "gpt-4",
				promptTokens: 1000,
				completionTokens: 500,
				totalTokens: 1500,
				cacheHitTokens: 0,
				cacheWriteTokens: 0,
				cost: 0.06,
			});

			expect(usage.model).toBe("gpt-4");
			expect(usage.promptTokens).toBe(1000);
			expect(usage.completionTokens).toBe(500);
			expect(usage.cost).toBe(0.06);
		});

		it("should update session when recording usage", () => {
			tracker.startSession("usage-session");
			tracker.recordUsage({
				model: "gpt-4",
				promptTokens: 1000,
				completionTokens: 500,
				totalTokens: 1500,
				cacheHitTokens: 100,
				cacheWriteTokens: 0,
				cost: 0.06,
			});

			const session = tracker.getSession("usage-session");
			expect(session?.totalPromptTokens).toBe(1000);
			expect(session?.totalCompletionTokens).toBe(500);
			expect(session?.totalCost).toBe(0.06);
			expect(session?.totalCacheHits).toBe(100);
			expect(session?.apiCalls).toBe(1);
		});

		it("should track multiple API calls in a session", () => {
			tracker.startSession("multi-call-session");
			tracker.recordUsage({
				model: "gpt-4",
				promptTokens: 1000,
				completionTokens: 500,
				totalTokens: 1500,
				cacheHitTokens: 0,
				cacheWriteTokens: 0,
				cost: 0.06,
			});
			tracker.recordUsage({
				model: "gpt-4",
				promptTokens: 2000,
				completionTokens: 1000,
				totalTokens: 3000,
				cacheHitTokens: 500,
				cacheWriteTokens: 200,
				cost: 0.12,
			});

			const session = tracker.getSession("multi-call-session");
			expect(session?.totalPromptTokens).toBe(3000);
			expect(session?.totalCompletionTokens).toBe(1500);
			expect(session?.totalCacheHits).toBe(500);
			expect(session?.totalCacheWrites).toBe(200);
			expect(session?.apiCalls).toBe(2);
		});
	});

	describe("Cost Calculation", () => {
		it("should calculate cost for GPT-4", () => {
			const cost = tracker.calculateCost("gpt-4", 1000, 500);

			// GPT-4: $0.03/1K prompt, $0.06/1K completion
			// 1000 * 0.00003 + 500 * 0.00006 = 0.03 + 0.03 = 0.06
			expect(cost).toBeCloseTo(0.06, 4);
		});

		it("should calculate cost for Claude-3-Opus with cache", () => {
			const cost = tracker.calculateCost("claude-3-opus", 1000, 500, 200, 100);

			// Claude-3-Opus: $0.015/1K input, $0.075/1K output, cache write 1.25x, cache hit 0.10x
			// cache write: 100 * 0.000015 * 1.25 = 0.001875
			// cache hit: 200 * 0.000015 * 0.10 = 0.0003
			// regular: 1000 * 0.000015 = 0.015
			// output: 500 * 0.000075 = 0.0375
			// Total: 0.001875 + 0.0003 + 0.015 + 0.0375 = 0.054675
			expect(cost).toBeCloseTo(0.0547, 4);
		});

		it("should use default model config for unknown models", () => {
			const cost = tracker.calculateCost("unknown-model", 1000, 500);

			// Default: $0.001/1K input, $0.002/1K output
			// 1000 * 0.000001 + 500 * 0.000002 = 0.001 + 0.001 = 0.002
			expect(cost).toBeCloseTo(0.002, 4);
		});
	});

	describe("Statistics", () => {
		it("should get statistics from tracked usage", () => {
			tracker.startSession("stats-session-1", "capability");
			tracker.recordUsage({
				model: "gpt-4",
				promptTokens: 1000,
				completionTokens: 500,
				totalTokens: 1500,
				cacheHitTokens: 0,
				cacheWriteTokens: 0,
				cost: 0.06,
				taskType: "capability",
			});
			tracker.endSession(true);

			tracker.startSession("stats-session-2", "reliability");
			tracker.recordUsage({
				model: "gpt-3.5-turbo",
				promptTokens: 2000,
				completionTokens: 1000,
				totalTokens: 3000,
				cacheHitTokens: 0,
				cacheWriteTokens: 0,
				cost: 0.003,
				taskType: "reliability",
			});
			tracker.endSession(false);

			const stats = tracker.getStats();

			expect(stats.totalSessions).toBeGreaterThanOrEqual(2);
			expect(stats.totalApiCalls).toBeGreaterThanOrEqual(2);
			expect(stats.totalPromptTokens).toBeGreaterThanOrEqual(3000);
			expect(stats.totalCompletionTokens).toBeGreaterThanOrEqual(1500);
			expect(stats.costByModel["gpt-4"]).toBeCloseTo(0.06, 4);
			expect(stats.costByModel["gpt-3.5-turbo"]).toBeCloseTo(0.003, 4);
			expect(stats.costByTaskType.capability).toBeCloseTo(0.06, 4);
			expect(stats.costByTaskType.reliability).toBeCloseTo(0.003, 4);
		});

		it("should calculate averages correctly", () => {
			tracker.startSession("avg-session-1");
			tracker.recordUsage({
				model: "gpt-4",
				promptTokens: 1000,
				completionTokens: 500,
				totalTokens: 1500,
				cacheHitTokens: 0,
				cacheWriteTokens: 0,
				cost: 0.06,
			});
			tracker.endSession();

			tracker.startSession("avg-session-2");
			tracker.recordUsage({
				model: "gpt-4",
				promptTokens: 2000,
				completionTokens: 1000,
				totalTokens: 3000,
				cacheHitTokens: 0,
				cacheWriteTokens: 0,
				cost: 0.12,
			});
			tracker.endSession();

			const stats = tracker.getStats();

			// Average cost per session: (0.06 + 0.12) / 2 = 0.09
			expect(stats.averageCostPerSession).toBeCloseTo(0.09, 4);
			// Average tokens per session: (1500 + 3000) / 2 = 2250
			expect(stats.averageTokensPerSession).toBeCloseTo(2250, 0);
		});

		it("should track recent usage", () => {
			for (let i = 0; i < 15; i++) {
				tracker.recordUsage({
					model: "gpt-4",
					promptTokens: 100,
					completionTokens: 50,
					totalTokens: 150,
					cacheHitTokens: 0,
					cacheWriteTokens: 0,
					cost: 0.006,
				});
			}

			const stats = tracker.getStats();
			expect(stats.recentUsage.length).toBeLessThanOrEqual(10);
		});
	});

	describe("Formatting", () => {
		it("should format costs correctly", () => {
			expect(tracker.formatCost(0)).toBe("$0.00");
			expect(tracker.formatCost(0.06)).toBe("$0.06");
			expect(tracker.formatCost(0.001)).toBe("$0.00100");
			expect(tracker.formatCost(1.5)).toBe("$1.50");
		});

		it("should format tokens correctly", () => {
			expect(tracker.formatTokens(100)).toBe("100");
			expect(tracker.formatTokens(1500)).toBe("1.5K");
			expect(tracker.formatTokens(1500000)).toBe("1.5M");
		});

		it("should generate usage report", () => {
			const usage: TokenUsage = {
				timestamp: new Date().toISOString(),
				model: "gpt-4",
				promptTokens: 1000,
				completionTokens: 500,
				totalTokens: 1500,
				cacheHitTokens: 100,
				cacheWriteTokens: 50,
				cost: 0.06,
			};

			const report = tracker.generateUsageReport(usage);

			expect(report).toContain("gpt-4");
			expect(report).toContain("1.0K");
			expect(report).toContain("$0.06");
			expect(report).toContain("Cache hit");
			expect(report).toContain("Cache write");
		});

		it("should format statistics", () => {
			tracker.startSession("format-session");
			tracker.recordUsage({
				model: "gpt-4",
				promptTokens: 1000,
				completionTokens: 500,
				totalTokens: 1500,
				cacheHitTokens: 0,
				cacheWriteTokens: 0,
				cost: 0.06,
			});
			tracker.endSession();

			const stats = tracker.getStats();
			const formatted = tracker.formatStats(stats);

			expect(formatted).toContain("Token Tracking Statistics");
			expect(formatted).toContain("Sessions");
			expect(formatted).toContain("Total Cost");
			expect(formatted).toContain("gpt-4");
		});
	});

	describe("Data Persistence", () => {
		it("should export data", () => {
			tracker.startSession("export-session");
			tracker.recordUsage({
				model: "gpt-4",
				promptTokens: 1000,
				completionTokens: 500,
				totalTokens: 1500,
				cacheHitTokens: 0,
				cacheWriteTokens: 0,
				cost: 0.06,
			});
			tracker.endSession();

			const data = tracker.exportData();

			expect(data.usage.length).toBeGreaterThanOrEqual(1);
			expect(data.sessions.length).toBeGreaterThanOrEqual(1);
		});

		it("should clear data", () => {
			tracker.startSession("clear-session");
			tracker.recordUsage({
				model: "gpt-4",
				promptTokens: 1000,
				completionTokens: 500,
				totalTokens: 1500,
				cacheHitTokens: 0,
				cacheWriteTokens: 0,
				cost: 0.06,
			});
			tracker.endSession();

			tracker.clear();

			const stats = tracker.getStats();
			expect(stats.totalApiCalls).toBe(0);
			expect(stats.totalSessions).toBe(0);
		});
	});

	describe("Global Instance", () => {
		it("should return same instance from getTokenTracker", () => {
			resetTokenTracker();
			const tracker1 = getTokenTracker();
			const tracker2 = getTokenTracker();

			expect(tracker1).toBe(tracker2);
		});

		it("should create new instance after reset", () => {
			const tracker1 = getTokenTracker();
			resetTokenTracker();
			const tracker2 = getTokenTracker();

			expect(tracker1).not.toBe(tracker2);
		});
	});
});
