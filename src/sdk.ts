/**
 * Evolution SDK - Programmatic API for self-evolution
 *
 * Inspired by OpenHands SDK and mini-swe-agent Python bindings.
 * Enables external tools to drive evolution, batch mode, and CI/CD integration.
 */

import { getErrorPatternLearner } from "./error-patterns.js";
import { type UnifiedRecommendation, getEvolutionIntelligence } from "./intelligence.js";
import { type EvolutionMetrics, getMetricsTracker } from "./metrics.js";
import { type MinimalAgent, type MinimalAgentConfig, createMinimalAgent } from "./minimal-agent.js";
import { type PatternRecommendation, getPatternMiner } from "./pattern-miner.js";
import { RagModule } from "./rag.js";
import { SessionManager } from "./session.js";
import { type TaskPrediction, getTaskPredictor } from "./task-predictor.js";

/**
 * Configuration for SDK evolution session
 */
export interface EvolutionConfig {
	/** API key for the LLM */
	apiKey: string;
	/** Base URL for API endpoint */
	baseUrl?: string;
	/** Model to use */
	model?: string;
	/** Maximum iterations per session */
	maxIterations?: number;
	/** Enable metrics tracking */
	trackMetrics?: boolean;
	/** Enable pattern recommendations */
	usePatterns?: boolean;
	/** Enable error recovery */
	errorRecovery?: boolean;
	/** Custom system prompt override */
	customPrompt?: string;
	/** Timeout per iteration (ms) */
	iterationTimeout?: number;
	/** Enable verbose logging */
	verbose?: boolean;
	/** Working directory for evolution */
	workingDir?: string;
}

/**
 * Result of a single evolution iteration
 */
export interface EvolutionResult {
	/** Whether the iteration succeeded */
	success: boolean;
	/** Description of what was done */
	description: string;
	/** Task type (capability/reliability/feature) */
	taskType: "capability" | "reliability" | "feature";
	/** Time taken in minutes */
	timeMinutes: number;
	/** Errors encountered */
	errors: string[];
	/** Files changed */
	filesChanged: string[];
	/** Recommendations for next iteration */
	nextRecommendations?: PatternRecommendation[];
	/** Metrics snapshot */
	metrics?: EvolutionMetrics;
}

/**
 * Active evolution session
 */
export interface EvolutionSession {
	/** Session ID */
	id: string;
	/** Session start time */
	startTime: Date;
	/** Configuration */
	config: EvolutionConfig;
	/** Number of iterations completed */
	iterationsCompleted: number;
	/** Results from each iteration */
	results: EvolutionResult[];
	/** Current status */
	status: "running" | "paused" | "completed" | "failed";
	/** Agent instance */
	agent?: MinimalAgent;
	/** Error message if failed */
	error?: string;
}

/**
 * Batch evolution configuration
 */
export interface BatchEvolutionConfig {
	/** Number of iterations to run */
	iterations: number;
	/** Task types to focus on */
	focusTypes?: ("capability" | "reliability" | "feature")[];
	/** Stop on first failure */
	stopOnFailure?: boolean;
	/** Minimum success rate threshold */
	successThreshold?: number;
	/** Callback for each iteration */
	onIteration?: (result: EvolutionResult, session: EvolutionSession) => void;
	/** Callback for completion */
	onComplete?: (session: EvolutionSession) => void;
}

/**
 * Batch evolution result
 */
export interface BatchEvolutionResult {
	/** Total iterations run */
	totalIterations: number;
	/** Successful iterations */
	successfulIterations: number;
	/** Success rate */
	successRate: number;
	/** Final session state */
	session: EvolutionSession;
	/** Recommendations from intelligence */
	intelligenceRecommendations?: UnifiedRecommendation;
}

/**
 * Evolution SDK - Programmatic API for self-evolution
 *
 * Usage:
 * ```typescript
 * const sdk = new EvolutionSDK({
 *   apiKey: 'your-api-key',
 *   baseUrl: 'https://api.example.com',
 *   model: 'claude-3-opus'
 * });
 *
 * // Start a session
 * const session = await sdk.startSession();
 *
 * // Run a single iteration
 * const result = await sdk.runIteration(session.id);
 *
 * // Run batch evolution
 * const batchResult = await sdk.batchEvolve({
 *   iterations: 10,
 *   focusTypes: ['capability']
 * });
 *
 * // Get session status
 * const status = sdk.getStatus(session.id);
 *
 * // Stop session
 * sdk.stopSession(session.id);
 * ```
 */
export class EvolutionSDK {
	private config: EvolutionConfig;
	private sessions: Map<string, EvolutionSession> = new Map();
	private sessionManager: SessionManager;
	private patternMiner = getPatternMiner();
	private errorLearner = getErrorPatternLearner();
	private ragModule = new RagModule();
	private taskPredictor = getTaskPredictor();
	private intelligence = getEvolutionIntelligence();

	constructor(config: EvolutionConfig) {
		this.config = {
			maxIterations: 100,
			trackMetrics: true,
			usePatterns: true,
			errorRecovery: true,
			iterationTimeout: 300000, // 5 minutes
			verbose: false,
			workingDir: process.cwd(),
			...config,
		};
		this.sessionManager = new SessionManager(`${this.config.workingDir}/session_plan`, true);
	}

	/**
	 * Start a new evolution session
	 */
	async startSession(): Promise<EvolutionSession> {
		const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
		const startTime = new Date();

		// Create agent instance
		const agentConfig: MinimalAgentConfig = {
			apiKey: this.config.apiKey,
			baseUrl: this.config.baseUrl || "",
			model: this.config.model || "claude-3-opus",
		};

		const session: EvolutionSession = {
			id,
			startTime,
			config: this.config,
			iterationsCompleted: 0,
			results: [],
			status: "running",
		};

		// Get intelligence recommendations before starting
		if (this.config.usePatterns) {
			const recommendations = this.intelligence.analyze({
				taskDescription: "Start new evolution session",
				taskType: "capability",
				skillsAvailable: ["evolve", "research", "self-improve"],
				complexity: "medium",
			});

			if (this.config.verbose) {
				console.log("Intelligence recommendations:", recommendations.overallRecommendation);
			}
		}

		this.sessions.set(id, session);
		return session;
	}

	/**
	 * Run a single evolution iteration
	 */
	async runIteration(sessionId: string): Promise<EvolutionResult> {
		const session = this.sessions.get(sessionId);
		if (!session) {
			throw new Error(`Session ${sessionId} not found`);
		}

		if (session.status !== "running") {
			throw new Error(`Session ${sessionId} is not running (status: ${session.status})`);
		}

		if (session.iterationsCompleted >= (this.config.maxIterations ?? 100)) {
			session.status = "completed";
			throw new Error(`Session ${sessionId} reached max iterations (${this.config.maxIterations})`);
		}

		const iterationStart = Date.now();

		// Get pattern recommendations for this iteration
		let recommendations: PatternRecommendation[] | undefined;
		if (this.config.usePatterns) {
			recommendations = this.patternMiner.getRecommendations({
				taskType: "capability",
				skillsAvailable: ["evolve", "research"],
			});
		}

		// Get prediction for success
		const prediction = this.taskPredictor.predict({
			taskDescription: "Evolution iteration",
			taskType: "capability",
			skillsAvailable: ["evolve", "research"],
			complexity: "medium",
		});

		if (this.config.verbose) {
			console.log("Success prediction:", prediction.successProbability, "%");
		}

		// Simulate evolution result (actual implementation would call agent)
		const result: EvolutionResult = {
			success: true,
			description: "SDK evolution iteration completed",
			taskType: "capability",
			timeMinutes: Math.round((Date.now() - iterationStart) / 60000),
			errors: [],
			filesChanged: [],
			nextRecommendations: recommendations,
		};

		// Track metrics if enabled
		if (this.config.trackMetrics) {
			result.metrics = getMetricsTracker().getMetrics();
		}

		session.results.push(result);
		session.iterationsCompleted++;

		return result;
	}

	/**
	 * Get session status
	 */
	getStatus(sessionId: string): EvolutionSession | undefined {
		return this.sessions.get(sessionId);
	}

	/**
	 * Stop a running session
	 */
	stopSession(sessionId: string): void {
		const session = this.sessions.get(sessionId);
		if (!session) {
			throw new Error(`Session ${sessionId} not found`);
		}

		session.status = "paused";
		this.sessions.set(sessionId, session);
	}

	/**
	 * Resume a paused session
	 */
	resumeSession(sessionId: string): void {
		const session = this.sessions.get(sessionId);
		if (!session) {
			throw new Error(`Session ${sessionId} not found`);
		}

		if (session.status !== "paused") {
			throw new Error(`Session ${sessionId} is not paused (status: ${session.status})`);
		}

		session.status = "running";
		this.sessions.set(sessionId, session);
	}

	/**
	 * Delete a session
	 */
	deleteSession(sessionId: string): void {
		const session = this.sessions.get(sessionId);
		if (!session) {
			throw new Error(`Session ${sessionId} not found`);
		}

		session.status = "completed";
		this.sessions.delete(sessionId);
	}

	/**
	 * Run batch evolution
	 */
	async batchEvolve(config: BatchEvolutionConfig): Promise<BatchEvolutionResult> {
		const session = await this.startSession();
		const results: EvolutionResult[] = [];

		for (let i = 0; i < config.iterations; i++) {
			try {
				const result = await this.runIteration(session.id);
				results.push(result);

				// Call iteration callback
				if (config.onIteration) {
					config.onIteration(result, session);
				}

				// Check success threshold
				if (config.stopOnFailure && !result.success) {
					session.status = "failed";
					break;
				}

				// Check minimum success rate
				if (config.successThreshold) {
					const successRate = results.filter((r) => r.success).length / results.length;
					if (successRate < config.successThreshold && results.length >= 5) {
						session.status = "failed";
						session.error = `Success rate ${successRate.toFixed(2)} below threshold ${config.successThreshold}`;
						break;
					}
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				const failedResult: EvolutionResult = {
					success: false,
					description: `Iteration failed: ${errorMessage}`,
					taskType: "capability",
					timeMinutes: 0,
					errors: [errorMessage],
					filesChanged: [],
				};
				results.push(failedResult);
				session.results.push(failedResult);

				if (config.stopOnFailure) {
					session.status = "failed";
					session.error = errorMessage;
					break;
				}
			}
		}

		if (session.status === "running") {
			session.status = "completed";
		}

		// Get final intelligence recommendations
		const intelligenceRecommendations = this.intelligence.analyze({
			taskDescription: "Batch evolution completed",
			taskType: "capability",
			skillsAvailable: ["evolve", "research"],
			complexity: "medium",
		});

		const batchResult: BatchEvolutionResult = {
			totalIterations: results.length,
			successfulIterations: results.filter((r) => r.success).length,
			successRate: results.filter((r) => r.success).length / results.length,
			session,
			intelligenceRecommendations,
		};

		// Call completion callback
		if (config.onComplete) {
			config.onComplete(session);
		}

		return batchResult;
	}

	/**
	 * Get all active sessions
	 */
	getAllSessions(): EvolutionSession[] {
		return Array.from(this.sessions.values()).filter((s) => s.status === "running");
	}

	/**
	 * Get SDK statistics
	 */
	getStats(): SDKStats {
		const sessions = Array.from(this.sessions.values());
		return {
			totalSessions: sessions.length,
			activeSessions: sessions.filter((s) => s.status === "running").length,
			completedSessions: sessions.filter((s) => s.status === "completed").length,
			failedSessions: sessions.filter((s) => s.status === "failed").length,
			totalIterations: sessions.reduce((sum, s) => sum + s.iterationsCompleted, 0),
			averageSuccessRate:
				sessions.length > 0
					? sessions.reduce((sum, s) => {
							const successRate =
								s.results.length > 0
									? s.results.filter((r) => r.success).length / s.results.length
									: 0;
							return sum + successRate;
						}, 0) / sessions.length
					: 0,
		};
	}

	/**
	 * Get predictions for a task
	 */
	getPrediction(context: {
		taskDescription: string;
		taskType: "capability" | "reliability" | "feature";
		skillsAvailable?: string[];
		complexity?: "low" | "medium" | "high";
	}): TaskPrediction {
		return this.taskPredictor.predict({
			taskDescription: context.taskDescription,
			taskType: context.taskType,
			skillsAvailable: context.skillsAvailable || ["evolve"],
			complexity: context.complexity || "medium",
		});
	}

	/**
	 * Get intelligence recommendations
	 */
	getRecommendations(context: {
		taskDescription: string;
		taskType: "capability" | "reliability" | "feature";
		skillsAvailable?: string[];
		complexity?: "low" | "medium" | "high";
	}): UnifiedRecommendation {
		return this.intelligence.analyze({
			taskDescription: context.taskDescription,
			taskType: context.taskType,
			skillsAvailable: context.skillsAvailable || ["evolve"],
			complexity: context.complexity || "medium",
		});
	}

	/**
	 * Match error against known patterns
	 */
	matchErrorPattern(error: string): {
		pattern: string | null;
		solution: string | null;
		confidence: number;
	} {
		const match = this.errorLearner.matchError(error);
		return {
			pattern: match?.pattern.pattern || null,
			solution: match?.pattern.solution || null,
			confidence: match?.pattern.confidence || 0,
		};
	}
}

/**
 * SDK statistics
 */
export interface SDKStats {
	totalSessions: number;
	activeSessions: number;
	completedSessions: number;
	failedSessions: number;
	totalIterations: number;
	averageSuccessRate: number;
}

/**
 * Get global SDK instance
 */
let sdkInstance: EvolutionSDK | null = null;

export function getSDK(config?: EvolutionConfig): EvolutionSDK {
	if (!sdkInstance && config) {
		sdkInstance = new EvolutionSDK(config);
	}
	if (!sdkInstance) {
		throw new Error("SDK not initialized. Call getSDK with config first.");
	}
	return sdkInstance;
}

/**
 * Initialize SDK with config
 */
export function initSDK(config: EvolutionConfig): EvolutionSDK {
	sdkInstance = new EvolutionSDK(config);
	return sdkInstance;
}

/**
 * Format SDK stats as markdown
 */
export function formatSDKStats(stats: SDKStats): string {
	return `## SDK Statistics

| Metric | Value |
|--------|-------|
| Total Sessions | ${stats.totalSessions} |
| Active Sessions | ${stats.activeSessions} |
| Completed Sessions | ${stats.completedSessions} |
| Failed Sessions | ${stats.failedSessions} |
| Total Iterations | ${stats.totalIterations} |
| Average Success Rate | ${stats.averageSuccessRate.toFixed(2)}% |
`;
}

/**
 * Format evolution result as markdown
 */
export function formatEvolutionResult(result: EvolutionResult): string {
	const statusEmoji = result.success ? "✅" : "❌";
	return `## Evolution Result ${statusEmoji}

- **Task Type:** ${result.taskType}
- **Description:** ${result.description}
- **Time:** ${result.timeMinutes} minutes
- **Files Changed:** ${result.filesChanged.length > 0 ? result.filesChanged.join(", ") : "None"}
- **Errors:** ${result.errors.length > 0 ? result.errors.join(", ") : "None"}
`;
}

/**
 * Format session as markdown
 */
export function formatSession(session: EvolutionSession): string {
	const statusEmoji =
		session.status === "running"
			? "🔄"
			: session.status === "completed"
				? "✅"
				: session.status === "failed"
					? "❌"
					: "⏸️";

	const successRate =
		session.results.length > 0
			? session.results.filter((r) => r.success).length / session.results.length
			: 0;

	return `## Evolution Session ${statusEmoji}

- **Session ID:** ${session.id}
- **Started:** ${session.startTime.toISOString()}
- **Status:** ${session.status}
- **Iterations:** ${session.iterationsCompleted}
- **Success Rate:** ${successRate.toFixed(2)}%

### Recent Results
${session.results
	.slice(-5)
	.map((r) => formatEvolutionResult(r))
	.join("\n")}
`;
}

/**
 * Format batch result as markdown
 */
export function formatBatchResult(result: BatchEvolutionResult): string {
	return `## Batch Evolution Result

- **Total Iterations:** ${result.totalIterations}
- **Successful:** ${result.successfulIterations}
- **Success Rate:** ${result.successRate.toFixed(2)}%

${formatSession(result.session)}

### Intelligence Recommendations
${
	result.intelligenceRecommendations
		? `**Overall:** ${result.intelligenceRecommendations.overallRecommendation}
**Confidence:** ${result.intelligenceRecommendations.combinedConfidence}%
`
		: "None"
}
`;
}
