/**
 * SDK Tool - Manage Evolution SDK via tool interface
 *
 * Provides tool-based access to the EvolutionSDK for:
 * - Starting/stopping sessions
 * - Running iterations
 * - Batch evolution
 * - Getting predictions and recommendations
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type EvolutionConfig,
	EvolutionSDK,
	formatBatchResult,
	formatEvolutionResult,
	formatSDKStats,
	formatSession,
	getSDK,
	initSDK,
} from "../sdk.js";

/**
 * SDK tool for programmatic evolution management.
 */
export const sdkTool: AgentTool = {
	name: "sdk",
	label: "Evolution SDK Management",
	description: `Manage Evolution SDK for programmatic self-evolution.

Actions:
- init: Initialize SDK with configuration
- start: Start a new evolution session
- run: Run a single iteration in a session
- status: Get session status
- stop: Stop a running session
- resume: Resume a paused session
- delete: Delete a session
- batch: Run batch evolution
- sessions: List all sessions
- stats: Get SDK statistics
- predict: Get success prediction for a task
- recommend: Get intelligence recommendations
- match: Match error against known patterns

Example usage:
sdk({action: 'init', apiKey: 'your-key', baseUrl: 'https://api.example.com'})
sdk({action: 'start'})
sdk({action: 'run', sessionId: 'session-123'})
sdk({action: 'batch', iterations: 5, focusTypes: ['capability']})
sdk({action: 'stats'})`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: init, start, run, status, stop, resume, delete, batch, sessions, stats, predict, recommend, match",
		}),
		apiKey: Type.Optional(Type.String({ description: "API key for init action" })),
		baseUrl: Type.Optional(Type.String({ description: "Base URL for init action" })),
		model: Type.Optional(Type.String({ description: "Model to use" })),
		maxIterations: Type.Optional(Type.Number({ description: "Max iterations per session" })),
		sessionId: Type.Optional(
			Type.String({ description: "Session ID for run/status/stop actions" }),
		),
		iterations: Type.Optional(Type.Number({ description: "Number of iterations for batch" })),
		focusTypes: Type.Optional(Type.Array(Type.String(), { description: "Task types to focus on" })),
		stopOnFailure: Type.Optional(Type.Boolean({ description: "Stop batch on first failure" })),
		successThreshold: Type.Optional(Type.Number({ description: "Minimum success rate threshold" })),
		taskDescription: Type.Optional(
			Type.String({ description: "Task description for predict/recommend" }),
		),
		taskType: Type.Optional(
			Type.String({ description: "Task type: capability, reliability, feature" }),
		),
		skillsAvailable: Type.Optional(Type.Array(Type.String(), { description: "Skills available" })),
		complexity: Type.Optional(Type.String({ description: "Task complexity: low, medium, high" })),
		error: Type.Optional(Type.String({ description: "Error message to match" })),
		verbose: Type.Optional(Type.Boolean({ description: "Enable verbose logging" })),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const input = params as Record<string, unknown>;
		const action = input.action as string;

		try {
			switch (action) {
				case "init":
					return handleInit(input);

				case "start":
					return await handleStart();

				case "run":
					return await handleRun(input);

				case "status":
					return handleStatus(input);

				case "stop":
					return handleStop(input);

				case "resume":
					return handleResume(input);

				case "delete":
					return handleDelete(input);

				case "batch":
					return await handleBatch(input);

				case "sessions":
					return handleSessions();

				case "stats":
					return handleStats();

				case "predict":
					return handlePredict(input);

				case "recommend":
					return handleRecommend(input);

				case "match":
					return handleMatch(input);

				default:
					return {
						content: [{ type: "text", text: `Unknown action: ${action}` }],
						details: `Error: Unknown action '${action}'`,
					};
			}
		} catch (e) {
			const errorMessage = e instanceof Error ? e.message : String(e);
			return {
				content: [{ type: "text", text: `Error: ${errorMessage}` }],
				details: `Error: ${errorMessage}`,
			};
		}
	},
};

/**
 * Handle init action
 */
function handleInit(input: Record<string, unknown>): AgentToolResult<unknown> {
	const config: EvolutionConfig = {
		apiKey: (input.apiKey as string) || process.env.BAILIAN_API_KEY || "",
		baseUrl: (input.baseUrl as string) || process.env.BAILIAN_BASE_URL,
		model: (input.model as string) || "claude-3-opus",
		maxIterations: (input.maxIterations as number) || 100,
		verbose: (input.verbose as boolean) || false,
	};

	if (!config.apiKey) {
		return {
			content: [
				{
					type: "text",
					text: "Error: API key required. Provide apiKey parameter or set BAILIAN_API_KEY environment variable.",
				},
			],
			details: "Error: Missing API key",
		};
	}

	initSDK(config);
	return {
		content: [
			{
				type: "text",
				text: `SDK initialized successfully.

Configuration:
- Model: ${config.model}
- Max Iterations: ${config.maxIterations}
- Base URL: ${config.baseUrl || "default"}

Ready to start evolution sessions with sdk({action: "start"})`,
			},
		],
		details: { initialized: true },
	};
}

/**
 * Handle start action
 */
async function handleStart(): Promise<AgentToolResult<unknown>> {
	try {
		const sdk = getSDK();
		const session = await sdk.startSession();
		return {
			content: [{ type: "text", text: formatSession(session) }],
			details: { session },
		};
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		return {
			content: [
				{
					type: "text",
					text: `Error: ${errorMessage}. Initialize SDK first with sdk({action: "init", apiKey: "your-key"})`,
				},
			],
			details: `Error: ${errorMessage}`,
		};
	}
}

/**
 * Handle run action
 */
async function handleRun(input: Record<string, unknown>): Promise<AgentToolResult<unknown>> {
	const sessionId = input.sessionId as string;
	if (!sessionId) {
		return {
			content: [{ type: "text", text: "Error: sessionId required for run action." }],
			details: "Error: Missing sessionId",
		};
	}

	try {
		const sdk = getSDK();
		const result = await sdk.runIteration(sessionId);
		return {
			content: [{ type: "text", text: formatEvolutionResult(result) }],
			details: { result },
		};
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		return {
			content: [{ type: "text", text: `Error: ${errorMessage}` }],
			details: `Error: ${errorMessage}`,
		};
	}
}

/**
 * Handle status action
 */
function handleStatus(input: Record<string, unknown>): AgentToolResult<unknown> {
	const sessionId = input.sessionId as string;
	if (!sessionId) {
		return {
			content: [{ type: "text", text: "Error: sessionId required for status action." }],
			details: "Error: Missing sessionId",
		};
	}

	try {
		const sdk = getSDK();
		const session = sdk.getStatus(sessionId);
		if (!session) {
			return {
				content: [{ type: "text", text: `Session ${sessionId} not found.` }],
				details: { found: false },
			};
		}
		return {
			content: [{ type: "text", text: formatSession(session) }],
			details: { session },
		};
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		return {
			content: [{ type: "text", text: `Error: ${errorMessage}` }],
			details: `Error: ${errorMessage}`,
		};
	}
}

/**
 * Handle stop action
 */
function handleStop(input: Record<string, unknown>): AgentToolResult<unknown> {
	const sessionId = input.sessionId as string;
	if (!sessionId) {
		return {
			content: [{ type: "text", text: "Error: sessionId required for stop action." }],
			details: "Error: Missing sessionId",
		};
	}

	try {
		const sdk = getSDK();
		sdk.stopSession(sessionId);
		const session = sdk.getStatus(sessionId);
		return {
			content: [
				{
					type: "text",
					text: `Session ${sessionId} stopped.\n\n${session ? formatSession(session) : ""}`,
				},
			],
			details: { stopped: true, session },
		};
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		return {
			content: [{ type: "text", text: `Error: ${errorMessage}` }],
			details: `Error: ${errorMessage}`,
		};
	}
}

/**
 * Handle resume action
 */
function handleResume(input: Record<string, unknown>): AgentToolResult<unknown> {
	const sessionId = input.sessionId as string;
	if (!sessionId) {
		return {
			content: [{ type: "text", text: "Error: sessionId required for resume action." }],
			details: "Error: Missing sessionId",
		};
	}

	try {
		const sdk = getSDK();
		sdk.resumeSession(sessionId);
		const session = sdk.getStatus(sessionId);
		return {
			content: [
				{
					type: "text",
					text: `Session ${sessionId} resumed.\n\n${session ? formatSession(session) : ""}`,
				},
			],
			details: { resumed: true, session },
		};
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		return {
			content: [{ type: "text", text: `Error: ${errorMessage}` }],
			details: `Error: ${errorMessage}`,
		};
	}
}

/**
 * Handle delete action
 */
function handleDelete(input: Record<string, unknown>): AgentToolResult<unknown> {
	const sessionId = input.sessionId as string;
	if (!sessionId) {
		return {
			content: [{ type: "text", text: "Error: sessionId required for delete action." }],
			details: "Error: Missing sessionId",
		};
	}

	try {
		const sdk = getSDK();
		sdk.deleteSession(sessionId);
		return {
			content: [{ type: "text", text: `Session ${sessionId} deleted.` }],
			details: { deleted: true },
		};
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		return {
			content: [{ type: "text", text: `Error: ${errorMessage}` }],
			details: `Error: ${errorMessage}`,
		};
	}
}

/**
 * Handle batch action
 */
async function handleBatch(input: Record<string, unknown>): Promise<AgentToolResult<unknown>> {
	const iterations = (input.iterations as number) || 5;
	const focusTypes = (input.focusTypes as ("capability" | "reliability" | "feature")[]) || [
		"capability",
	];
	const stopOnFailure = (input.stopOnFailure as boolean) ?? true;
	const successThreshold = (input.successThreshold as number) ?? 0.5;

	try {
		const sdk = getSDK();
		const result = await sdk.batchEvolve({
			iterations,
			focusTypes,
			stopOnFailure,
			successThreshold,
		});
		return {
			content: [{ type: "text", text: formatBatchResult(result) }],
			details: { result },
		};
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		return {
			content: [
				{
					type: "text",
					text: `Error: ${errorMessage}. Initialize SDK first with sdk({action: "init", apiKey: "your-key"})`,
				},
			],
			details: `Error: ${errorMessage}`,
		};
	}
}

/**
 * Handle sessions action
 */
function handleSessions(): AgentToolResult<unknown> {
	try {
		const sdk = getSDK();
		const sessions = sdk.getAllSessions();

		if (sessions.length === 0) {
			return {
				content: [
					{
						type: "text",
						text: 'No active sessions. Start one with sdk({action: "start"})',
					},
				],
				details: { sessions: [] },
			};
		}

		return {
			content: [
				{
					type: "text",
					text: `## Active Sessions (${sessions.length})\n\n${sessions.map((s) => formatSession(s)).join("\n---\n")}`,
				},
			],
			details: { sessions },
		};
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		return {
			content: [{ type: "text", text: `Error: ${errorMessage}` }],
			details: `Error: ${errorMessage}`,
		};
	}
}

/**
 * Handle stats action
 */
function handleStats(): AgentToolResult<unknown> {
	try {
		const sdk = getSDK();
		const stats = sdk.getStats();
		return {
			content: [{ type: "text", text: formatSDKStats(stats) }],
			details: { stats },
		};
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		return {
			content: [
				{
					type: "text",
					text: `Error: ${errorMessage}. Initialize SDK first with sdk({action: "init", apiKey: "your-key"})`,
				},
			],
			details: `Error: ${errorMessage}`,
		};
	}
}

/**
 * Handle predict action
 */
function handlePredict(input: Record<string, unknown>): AgentToolResult<unknown> {
	const taskDescription = (input.taskDescription as string) || "Evolution task";
	const taskType = (input.taskType as "capability" | "reliability" | "feature") || "capability";
	const skillsAvailable = (input.skillsAvailable as string[]) || ["evolve"];
	const complexity = (input.complexity as "low" | "medium" | "high") || "medium";

	try {
		const sdk = getSDK();
		const prediction = sdk.getPrediction({
			taskDescription,
			taskType,
			skillsAvailable,
			complexity,
		});

		const text = `## Task Prediction

- **Description:** ${taskDescription}
- **Type:** ${taskType}
- **Complexity:** ${complexity}

### Prediction
- **Success Probability:** ${prediction.successProbability}%
- **Confidence:** ${prediction.confidence}%
- **Estimated Time:** ${prediction.estimatedTime} minutes

### Risk Factors
${prediction.riskFactors.length > 0 ? prediction.riskFactors.map((r) => `- ${r}`).join("\n") : "None identified"}

### Recommended Skills
${prediction.recommendedSkills.length > 0 ? prediction.recommendedSkills.map((s) => `- ${s}`).join("\n") : "None recommended"}
`;

		return {
			content: [{ type: "text", text }],
			details: { prediction },
		};
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		return {
			content: [
				{
					type: "text",
					text: `Error: ${errorMessage}. Initialize SDK first with sdk({action: "init", apiKey: "your-key"})`,
				},
			],
			details: `Error: ${errorMessage}`,
		};
	}
}

/**
 * Handle recommend action
 */
function handleRecommend(input: Record<string, unknown>): AgentToolResult<unknown> {
	const taskDescription = (input.taskDescription as string) || "Evolution task";
	const taskType = (input.taskType as "capability" | "reliability" | "feature") || "capability";
	const skillsAvailable = (input.skillsAvailable as string[]) || ["evolve"];
	const complexity = (input.complexity as "low" | "medium" | "high") || "medium";

	try {
		const sdk = getSDK();
		const recommendation = sdk.getRecommendations({
			taskDescription,
			taskType,
			skillsAvailable,
			complexity,
		});

		const text = `## Intelligence Recommendations

- **Description:** ${taskDescription}
- **Type:** ${taskType}
- **Complexity:** ${complexity}

### Overall Recommendation
${recommendation.overallRecommendation}

- **Combined Confidence:** ${recommendation.combinedConfidence}%
- **Success Probability:** ${recommendation.prediction?.successProbability || "N/A"}%

### Pattern Recommendations
${
	recommendation.patternRecommendations.length > 0
		? recommendation.patternRecommendations
				.map((p) => `- ${p.pattern.description} (${p.confidence}% confidence)`)
				.join("\n")
		: "None"
}

### Error Risks
${
	recommendation.errorRisks.length > 0
		? recommendation.errorRisks
				.map((e) => `- **${e.errorType}**: ${e.description} (likelihood: ${e.likelihood})`)
				.join("\n")
		: "None identified"
}

### Relevant Context
${
	recommendation.relevantContext.length > 0
		? recommendation.relevantContext.map((c) => `- ${c.document.title}`).join("\n")
		: "None found"
}
`;

		return {
			content: [{ type: "text", text }],
			details: { recommendation },
		};
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		return {
			content: [
				{
					type: "text",
					text: `Error: ${errorMessage}. Initialize SDK first with sdk({action: "init", apiKey: "your-key"})`,
				},
			],
			details: `Error: ${errorMessage}`,
		};
	}
}

/**
 * Handle match action
 */
function handleMatch(input: Record<string, unknown>): AgentToolResult<unknown> {
	const error = input.error as string;
	if (!error) {
		return {
			content: [{ type: "text", text: "Error: error message required for match action." }],
			details: "Error: Missing error message",
		};
	}

	try {
		const sdk = getSDK();
		const match = sdk.matchErrorPattern(error);

		if (!match.pattern) {
			return {
				content: [
					{
						type: "text",
						text: `No matching error pattern found for: "${error}"\n\nThe error will be logged for future pattern learning.`,
					},
				],
				details: { found: false },
			};
		}

		return {
			content: [
				{
					type: "text",
					text: `## Error Pattern Match\n\n- **Error:** ${error}\n- **Pattern:** ${match.pattern}\n- **Solution:** ${match.solution}\n- **Confidence:** ${match.confidence}%`,
				},
			],
			details: { match },
		};
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		return {
			content: [
				{
					type: "text",
					text: `Error: ${errorMessage}. Initialize SDK first with sdk({action: "init", apiKey: "your-key"})`,
				},
			],
			details: `Error: ${errorMessage}`,
		};
	}
}

/**
 * Create SDK tool (for compatibility)
 */
export function createSDKTool(): typeof sdkTool {
	return sdkTool;
}

export default sdkTool;
