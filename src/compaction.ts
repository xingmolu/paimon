/**
 * Context compaction for long sessions.
 *
 * When conversations get too long, we summarize old messages to prevent
 * context overflow. This module provides:
 *
 * 1. Token usage estimation
 * 2. Automatic compaction triggers
 * 3. LLM-based summarization
 */

import type { Api, Model } from "@mariozechner/pi-ai";

/**
 * Estimate token count for a string.
 * Uses a simple heuristic: ~4 characters per token for most text.
 * This is approximate but sufficient for triggering compaction.
 */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/**
 * A message in the conversation history.
 */
export interface ConversationMessage {
	role: "user" | "assistant";
	content: string;
	timestamp: number;
}

/**
 * Result of a compaction operation.
 */
export interface CompactionResult {
	summary: string;
	messagesSummarized: number;
	messagesKept: number;
	tokensSaved: number;
}

/**
 * Configuration for context compaction.
 */
export interface CompactionConfig {
	/** Maximum tokens before compaction triggers */
	maxTokens: number;
	/** Number of recent messages to keep unsummarized */
	keepRecentMessages: number;
	/** Minimum messages before compaction can occur */
	minMessagesBeforeCompaction: number;
	/** Whether compaction is enabled */
	enabled: boolean;
}

/**
 * Default compaction configuration.
 * Conservative settings to avoid context overflow.
 */
export const DEFAULT_COMPACTION_CONFIG: CompactionConfig = {
	maxTokens: 100000, // 100k tokens - leave room for response
	keepRecentMessages: 10, // Keep last 10 messages
	minMessagesBeforeCompaction: 20, // Don't compact before 20 messages
	enabled: true,
};

/**
 * Context manager tracks conversation history and triggers compaction.
 */
export class ContextManager {
	private messages: ConversationMessage[] = [];
	private summary: string | null = null;
	private config: CompactionConfig;
	private model: Model<Api> | null = null;
	private getApiKey: () => string | null = () => null;

	constructor(config: Partial<CompactionConfig> = {}) {
		this.config = { ...DEFAULT_COMPACTION_CONFIG, ...config };
	}

	/**
	 * Set the model for LLM-based summarization.
	 */
	setModel(model: Model<Api>): void {
		this.model = model;
	}

	/**
	 * Set the API key getter for summarization.
	 */
	setApiKeyGetter(getter: () => string | null): void {
		this.getApiKey = getter;
	}

	/**
	 * Add a message to the conversation history.
	 */
	addMessage(role: "user" | "assistant", content: string): void {
		this.messages.push({
			role,
			content,
			timestamp: Date.now(),
		});
	}

	/**
	 * Get all messages including any summary.
	 */
	getMessages(): ConversationMessage[] {
		return this.summary
			? [{ role: "assistant", content: this.summary, timestamp: Date.now() }, ...this.messages]
			: this.messages;
	}

	/**
	 * Get the current estimated token usage.
	 */
	getTokenUsage(): number {
		let total = 0;
		if (this.summary) {
			total += estimateTokens(this.summary);
		}
		for (const msg of this.messages) {
			total += estimateTokens(msg.content);
		}
		return total;
	}

	/**
	 * Get the number of messages.
	 */
	getMessageCount(): number {
		return this.messages.length;
	}

	/**
	 * Check if compaction should be triggered.
	 */
	shouldCompact(): boolean {
		if (!this.config.enabled) return false;
		if (this.messages.length < this.config.minMessagesBeforeCompaction) return false;
		return this.getTokenUsage() > this.config.maxTokens;
	}

	/**
	 * Compact the conversation history.
	 * Summarizes old messages and keeps recent ones.
	 */
	async compact(): Promise<CompactionResult> {
		if (this.messages.length <= this.config.keepRecentMessages) {
			return {
				summary: "",
				messagesSummarized: 0,
				messagesKept: this.messages.length,
				tokensSaved: 0,
			};
		}

		const toSummarize = this.messages.slice(0, -this.config.keepRecentMessages);
		const toKeep = this.messages.slice(-this.config.keepRecentMessages);

		// Build summary from old messages
		const oldSummary = this.summary || "";
		const messagesText = toSummarize.map((m) => `[${m.role}]: ${m.content}`).join("\n\n");

		const previousContext = oldSummary ? `Previous summary:\n${oldSummary}\n\n` : "";
		const summaryPrompt = `Summarize this conversation, preserving:
- Key decisions made
- Important context about the task
- Any errors encountered and solutions
- Current progress state

${previousContext}Recent messages to summarize:
${messagesText}`;

		// Generate summary using LLM
		const summary = await this.generateSummary(summaryPrompt);

		// Update state
		const oldTokens = this.getTokenUsage();
		this.messages = toKeep;
		this.summary = `[Previous context summary]\n${summary}`;
		const newTokens = this.getTokenUsage();

		return {
			summary: this.summary,
			messagesSummarized: toSummarize.length,
			messagesKept: toKeep.length,
			tokensSaved: oldTokens - newTokens,
		};
	}

	/**
	 * Generate a summary using the LLM.
	 */
	private async generateSummary(prompt: string): Promise<string> {
		if (!this.model || !this.getApiKey) {
			// Fallback: simple truncation
			return "Context was compacted (LLM unavailable for summarization).";
		}

		const apiKey = this.getApiKey();
		if (!apiKey) {
			return "Context was compacted (API key unavailable).";
		}

		try {
			// Call the API directly for summarization
			const response = await fetch(`${this.model.baseUrl}/chat/completions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model: this.model.id,
					messages: [{ role: "user", content: prompt }],
					max_tokens: 2000,
					temperature: 0.3,
				}),
			});

			if (!response.ok) {
				throw new Error(`API error: ${response.status}`);
			}

			const data = (await response.json()) as {
				choices?: Array<{ message?: { content?: unknown } }>;
			};
			const content = data.choices?.[0]?.message?.content;
			if (typeof content === "string") {
				return content;
			}
			return "Context was compacted (summary generation failed).";
		} catch (error) {
			console.error("[Compaction] Error generating summary:", error);
			return "Context was compacted (summarization error).";
		}
	}

	/**
	 * Reset the conversation history.
	 */
	reset(): void {
		this.messages = [];
		this.summary = null;
	}

	/**
	 * Get a summary of the context state for logging.
	 */
	getStatus(): { messages: number; tokens: number; hasSummary: boolean } {
		return {
			messages: this.messages.length,
			tokens: this.getTokenUsage(),
			hasSummary: this.summary !== null,
		};
	}
}
