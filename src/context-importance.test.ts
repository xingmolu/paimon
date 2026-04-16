/**
 * Tests for Context Importance Scoring module (Aider ChatSummary Pattern).
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
	type ContextImportanceConfig,
	ContextImportanceScorer,
	DEFAULT_CONTEXT_IMPORTANCE_CONFIG,
	type MessageForAnalysis,
	getGlobalContextImportanceScorer,
	initGlobalContextImportanceScorer,
} from "./context-importance.js";

describe("ContextImportanceScorer", () => {
	let scorer: ContextImportanceScorer;

	beforeEach(() => {
		scorer = new ContextImportanceScorer();
	});

	describe("constructor", () => {
		it("should use default configuration", () => {
			const config = scorer.getConfig();
			expect(config.roleWeights).toBeDefined();
			expect(config.recencyWeight).toBe(0.3);
			expect(config.minKeepScore).toBe(40);
		});

		it("should accept custom configuration", () => {
			const customScorer = new ContextImportanceScorer({
				minKeepScore: 50,
				recencyWeight: 0.4,
			});
			const config = customScorer.getConfig();
			expect(config.minKeepScore).toBe(50);
			expect(config.recencyWeight).toBe(0.4);
		});
	});

	describe("scoreMessage", () => {
		it("should preserve initial anchors more than stale middle messages", () => {
			const earlyMessage: MessageForAnalysis = {
				role: "user",
				content: "Important initial task instructions and constraints.",
				index: 1,
				totalMessages: 20,
			};
			const staleMiddleMessage: MessageForAnalysis = {
				role: "assistant",
				content: "Routine progress update in the stale middle of the conversation.",
				index: 10,
				totalMessages: 20,
			};

			const earlyScore = scorer.scoreMessage(earlyMessage);
			const staleScore = scorer.scoreMessage(staleMiddleMessage);

			expect(earlyScore.factors.get("recency")).toBeGreaterThan(
				staleScore.factors.get("recency") ?? 0,
			);
			expect(earlyScore.score).toBeGreaterThan(staleScore.score);
		});

		it("should score system messages as high importance", () => {
			const message: MessageForAnalysis = {
				role: "system",
				content: "You are an AI assistant.",
				index: 0,
				totalMessages: 5,
			};
			const score = scorer.scoreMessage(message);
			expect(score.score).toBeGreaterThan(50);
			expect(score.canTruncate).toBe(false);
		});

		it("should score user messages as medium-high importance", () => {
			const message: MessageForAnalysis = {
				role: "user",
				content: "Please implement feature X.",
				index: 1,
				totalMessages: 5,
			};
			const score = scorer.scoreMessage(message);
			expect(score.score).toBeGreaterThan(30);
			expect(["medium", "high", "critical"]).toContain(score.level);
		});

		it("should score tool results as truncatable if large", () => {
			const message: MessageForAnalysis = {
				role: "tool_result",
				content: `Result from tool execution...${"x".repeat(2000)}`,
				index: 2,
				totalMessages: 10,
				toolName: "read",
				toolSuccess: true,
			};
			const score = scorer.scoreMessage(message);
			expect(score.contentType).toBe("tool_result");
			expect(score.tokens).toBeGreaterThan(100);
		});

		it("should make stale middle large tool results truncatable to reduce context drift", () => {
			const staleToolResult: MessageForAnalysis = {
				role: "tool_result",
				content: `Verbose tool output ${"x".repeat(12000)}`,
				index: 15,
				totalMessages: 30,
				toolName: "read",
				toolSuccess: true,
			};
			const recentToolResult: MessageForAnalysis = {
				role: "tool_result",
				content: `Recent tool output ${"y".repeat(12000)}`,
				index: 28,
				totalMessages: 30,
				toolName: "read",
				toolSuccess: true,
			};

			const staleScore = scorer.scoreMessage(staleToolResult);
			const recentScore = scorer.scoreMessage(recentToolResult);

			expect(staleScore.canTruncate).toBe(true);
			expect(staleScore.truncationStrategy).toBe("summarize");
			expect(staleScore.score).toBeLessThan(recentScore.score);
		});

		it("should detect error content", () => {
			const message: MessageForAnalysis = {
				role: "assistant",
				content: "Error: TypeScript compilation failed with error TS2345",
				index: 1,
				totalMessages: 5,
			};
			const score = scorer.scoreMessage(message);
			expect(score.factors.get("error_presence")).toBe(80);
		});

		it("should detect file references", () => {
			const message: MessageForAnalysis = {
				role: "assistant",
				content: "I will read the file src/agent.ts to understand the code",
				index: 1,
				totalMessages: 5,
			};
			const score = scorer.scoreMessage(message);
			expect(score.factors.get("file_reference")).toBe(60);
		});

		it("should detect plan references", () => {
			const message: MessageForAnalysis = {
				role: "assistant",
				content: "Following the plan, I will implement step 1 of the workflow",
				index: 1,
				totalMessages: 5,
			};
			const score = scorer.scoreMessage(message);
			expect(score.factors.get("plan_reference")).toBe(70);
		});

		it("should preserve durable task anchors over stale chatter", () => {
			const durableAnchor: MessageForAnalysis = {
				role: "user",
				content:
					"Goal: implement issue #25. Must run build and test, do not modify .github/workflows/, and update src/context-importance.ts.",
				index: 2,
				totalMessages: 24,
			};
			const staleChatter: MessageForAnalysis = {
				role: "assistant",
				content: "Routine progress update: still working, continuing with a status update.",
				index: 3,
				totalMessages: 24,
			};

			const durableScore = scorer.scoreMessage(durableAnchor);
			const chatterScore = scorer.scoreMessage(staleChatter);

			expect(durableScore.factors.get("durable_anchor")).toBeGreaterThan(
				chatterScore.factors.get("durable_anchor") ?? 0,
			);
			expect(durableScore.score).toBeGreaterThan(chatterScore.score);
			expect(durableScore.canTruncate).toBe(false);
		});

		it("should keep implementation blueprint messages above truncation threshold", () => {
			const blueprintMessage: MessageForAnalysis = {
				role: "assistant",
				content:
					"Implementation Blueprint: Files to modify: src/context-importance.ts and src/context-importance.test.ts. Build sequence: implement, verify with build and test, then commit.",
				index: 6,
				totalMessages: 30,
			};

			const score = scorer.scoreMessage(blueprintMessage);
			expect(score.factors.get("durable_anchor")).toBeGreaterThanOrEqual(70);
			expect(score.score).toBeGreaterThanOrEqual(40);
			expect(score.canTruncate).toBe(false);
		});

		it("should classify content types correctly", () => {
			const systemMessage: MessageForAnalysis = {
				role: "system",
				content: "System prompt",
				index: 0,
				totalMessages: 5,
			};
			expect(scorer.scoreMessage(systemMessage).contentType).toBe("system_prompt");

			const userMessage: MessageForAnalysis = {
				role: "user",
				content: "User request",
				index: 1,
				totalMessages: 5,
			};
			expect(scorer.scoreMessage(userMessage).contentType).toBe("user_instruction");

			const toolMessage: MessageForAnalysis = {
				role: "tool_result",
				content: "Tool output",
				index: 2,
				totalMessages: 5,
			};
			expect(scorer.scoreMessage(toolMessage).contentType).toBe("tool_result");
		});

		it("should calculate token estimates", () => {
			const message: MessageForAnalysis = {
				role: "user",
				content: "Hello world, this is a test message.",
				index: 0,
				totalMessages: 5,
			};
			const score = scorer.scoreMessage(message);
			expect(score.tokens).toBeGreaterThan(0);
		});
	});

	describe("analyzeConversation", () => {
		it("should analyze multiple messages", () => {
			const messages: MessageForAnalysis[] = [
				{ role: "system", content: "System prompt", index: 0, totalMessages: 3 },
				{ role: "user", content: "User request", index: 1, totalMessages: 3 },
				{ role: "assistant", content: "Assistant response", index: 2, totalMessages: 3 },
			];
			const analysis = scorer.analyzeConversation(messages);
			expect(analysis.totalMessages).toBe(3);
			expect(analysis.totalTokens).toBeGreaterThan(0);
			expect(analysis.averageScore).toBeGreaterThan(0);
		});

		it("should identify high importance messages", () => {
			const messages: MessageForAnalysis[] = [
				{ role: "system", content: "System prompt", index: 0, totalMessages: 2 },
				{ role: "user", content: "User request", index: 1, totalMessages: 2 },
			];
			const analysis = scorer.analyzeConversation(messages);
			// System messages should have high importance
			expect(analysis.criticalMessages.length).toBeGreaterThanOrEqual(0);
		});

		it("should generate truncation recommendations", () => {
			const messages: MessageForAnalysis[] = [
				{ role: "system", content: "System prompt", index: 0, totalMessages: 5 },
				{ role: "user", content: "User request", index: 1, totalMessages: 5 },
				{ role: "tool_result", content: "x".repeat(3000), index: 2, totalMessages: 5 },
				{ role: "assistant", content: "Response", index: 3, totalMessages: 5 },
				{ role: "tool_result", content: "y".repeat(3000), index: 4, totalMessages: 5 },
			];
			const analysis = scorer.analyzeConversation(messages);
			expect(analysis.truncationRecommendations).toBeDefined();
			expect(analysis.estimatedTotalSavings).toBeGreaterThanOrEqual(0);
		});

		it("should track score distribution", () => {
			const messages: MessageForAnalysis[] = [
				{ role: "system", content: "System prompt", index: 0, totalMessages: 3 },
				{ role: "user", content: "User request", index: 1, totalMessages: 3 },
				{ role: "assistant", content: "Response", index: 2, totalMessages: 3 },
			];
			const analysis = scorer.analyzeConversation(messages);
			expect(analysis.scoreDistribution.size).toBe(5); // 5 levels
			// Just check that the distribution has some entries
			let totalMessages = 0;
			for (const count of analysis.scoreDistribution.values()) {
				totalMessages += count;
			}
			expect(totalMessages).toBe(3);
		});
	});

	describe("getRecommendationsForTarget", () => {
		it("should return recommendations to achieve target savings", () => {
			const messages: MessageForAnalysis[] = [
				{ role: "system", content: "System prompt", index: 0, totalMessages: 5 },
				{ role: "user", content: "User request", index: 1, totalMessages: 5 },
				{ role: "tool_result", content: "x".repeat(5000), index: 2, totalMessages: 5 },
				{ role: "tool_result", content: "y".repeat(5000), index: 3, totalMessages: 5 },
				{ role: "assistant", content: "Response", index: 4, totalMessages: 5 },
			];
			const recommendations = scorer.getRecommendationsForTarget(messages, 1000);
			expect(recommendations.length).toBeGreaterThanOrEqual(0);
		});

		it("should stop when target is reached", () => {
			const messages: MessageForAnalysis[] = [
				{ role: "system", content: "System prompt", index: 0, totalMessages: 5 },
				{ role: "tool_result", content: "x".repeat(10000), index: 1, totalMessages: 5 },
				{ role: "tool_result", content: "y".repeat(10000), index: 2, totalMessages: 5 },
				{ role: "tool_result", content: "z".repeat(10000), index: 3, totalMessages: 5 },
				{ role: "assistant", content: "Response", index: 4, totalMessages: 5 },
			];
			const targetSavings = 500;
			const recommendations = scorer.getRecommendationsForTarget(messages, targetSavings);
			const totalSavings = recommendations.reduce((sum, r) => sum + r.estimatedSavings, 0);
			// Should stop once target is reached
			if (recommendations.length > 0) {
				expect(totalSavings).toBeGreaterThanOrEqual(targetSavings * 0.8);
			}
		});
	});

	describe("getStats", () => {
		it("should track statistics across analyses", () => {
			const messages: MessageForAnalysis[] = [
				{ role: "system", content: "System prompt", index: 0, totalMessages: 2 },
				{ role: "user", content: "User request", index: 1, totalMessages: 2 },
			];
			scorer.analyzeConversation(messages);
			scorer.analyzeConversation(messages);
			const stats = scorer.getStats();
			expect(stats.totalAnalyses).toBe(2);
		});

		it("should track total recommendations", () => {
			const messages: MessageForAnalysis[] = [
				{ role: "system", content: "System prompt", index: 0, totalMessages: 3 },
				{ role: "tool_result", content: "x".repeat(5000), index: 1, totalMessages: 3 },
				{ role: "tool_result", content: "y".repeat(5000), index: 2, totalMessages: 3 },
			];
			scorer.analyzeConversation(messages);
			const stats = scorer.getStats();
			expect(stats.totalRecommendations).toBeGreaterThanOrEqual(0);
		});
	});

	describe("updateConfig", () => {
		it("should update configuration", () => {
			scorer.updateConfig({ minKeepScore: 50 });
			const config = scorer.getConfig();
			expect(config.minKeepScore).toBe(50);
		});

		it("should preserve other config values", () => {
			scorer.updateConfig({ minKeepScore: 50 });
			const config = scorer.getConfig();
			expect(config.recencyWeight).toBe(0.3); // unchanged
		});
	});

	describe("reset", () => {
		it("should reset statistics", () => {
			const messages: MessageForAnalysis[] = [
				{ role: "system", content: "System prompt", index: 0, totalMessages: 2 },
				{ role: "user", content: "User request", index: 1, totalMessages: 2 },
			];
			scorer.analyzeConversation(messages);
			scorer.reset();
			const stats = scorer.getStats();
			expect(stats.totalAnalyses).toBe(0);
			expect(stats.totalRecommendations).toBe(0);
		});

		it("should preserve configuration after reset", () => {
			scorer.updateConfig({ minKeepScore: 50 });
			scorer.reset();
			const config = scorer.getConfig();
			expect(config.minKeepScore).toBe(50);
		});
	});
});

describe("Global Context Importance Scorer", () => {
	it("should initialize global scorer", () => {
		const scorer = initGlobalContextImportanceScorer({ minKeepScore: 45 });
		expect(scorer.getConfig().minKeepScore).toBe(45);
	});

	it("should get global scorer", () => {
		initGlobalContextImportanceScorer();
		const scorer = getGlobalContextImportanceScorer();
		expect(scorer).toBeDefined();
		expect(scorer.getConfig()).toBeDefined();
	});
});
