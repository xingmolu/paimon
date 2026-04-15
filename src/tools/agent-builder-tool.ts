/**
 * Agent Builder Tool - Tool interface for composable agent system
 *
 * Provides tool-based access to the AgentBuilder for:
 * - Defining and executing agents
 * - Creating agent chains and swarms
 * - Managing agent registry
 * - Tracking execution statistics
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type AgentBuilder,
	type AgentBuilderConfig,
	type AgentConfig,
	type AgentLifecycleHooks,
	type AgentProgress,
	type AgentResult,
	formatAgentDefinition,
	formatAgentResult,
	formatAgentStats,
	formatChainDefinition,
	formatSwarmDefinition,
	getAgentBuilder,
	initAgentBuilder,
} from "../agent-builder.js";

/**
 * Agent Builder tool for composable agent management.
 */
export const agentBuilderTool: AgentTool = {
	name: "agentBuilder",
	label: "Composable Agent Builder",
	description: `Manage composable agent definitions for self-evolution.

Actions:
- init: Initialize agent builder with configuration
- define: Define a new agent
- execute: Execute an agent
- chain: Define a chain of agents
- execute-chain: Execute a chain
- swarm: Define a swarm of agents
- execute-swarm: Execute a swarm
- agents: List all agents
- agent: Get agent details
- chains: List all chains
- swarms: List all swarms
- registry: View agent registry
- stats: View builder statistics
- history: View execution history
- remove: Remove an agent/chain/swarm
- reset: Reset statistics
- help: Get help

Example usage:
agentBuilder({action: 'init', apiKey: 'your-key'})
agentBuilder({action: 'define', id: 'my-agent', name: 'My Agent', description: 'Does work'})
agentBuilder({action: 'execute', agentId: 'code-explorer', args: {files: ['src/*.ts'], query: 'agent'}})
agentBuilder({action: 'chain', id: 'my-chain', agents: ['code-explorer', 'code-reviewer']})
agentBuilder({action: 'execute-chain', chainId: 'my-chain', args: {files: ['src/*.ts']}})
agentBuilder({action: 'swarm', id: 'my-swarm', agents: ['agent1', 'agent2'], strategy: 'parallel'})
agentBuilder({action: 'stats'})`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action: init, define, execute, chain, execute-chain, swarm, execute-swarm, agents, agent, chains, swarms, registry, stats, history, remove, reset, help",
		}),
		apiKey: Type.Optional(Type.String({ description: "API key for init" })),
		baseUrl: Type.Optional(Type.String({ description: "Base URL for init" })),
		model: Type.Optional(Type.String({ description: "Model for init" })),
		id: Type.Optional(Type.String({ description: "Agent/chain/swarm ID" })),
		name: Type.Optional(Type.String({ description: "Agent/chain/swarm name" })),
		description: Type.Optional(Type.String({ description: "Agent description" })),
		agentId: Type.Optional(Type.String({ description: "Agent ID to execute" })),
		chainId: Type.Optional(Type.String({ description: "Chain ID to execute" })),
		swarmId: Type.Optional(Type.String({ description: "Swarm ID to execute" })),
		agents: Type.Optional(Type.Array(Type.String(), { description: "Agent IDs for chain/swarm" })),
		args: Type.Optional(
			Type.Record(Type.String(), Type.Unknown(), { description: "Arguments for execution" }),
		),
		strategy: Type.Optional(
			Type.String({ description: "Swarm strategy: parallel, sequential, race, all-to-all" }),
		),
		tags: Type.Optional(Type.Array(Type.String(), { description: "Agent tags" })),
		timeout: Type.Optional(Type.Number({ description: "Execution timeout (ms)" })),
		retries: Type.Optional(Type.Number({ description: "Retry count" })),
		verbose: Type.Optional(Type.Boolean({ description: "Enable verbose logging" })),
		limit: Type.Optional(Type.Number({ description: "Limit for history" })),
		type: Type.Optional(Type.String({ description: "Type to remove: agent, chain, swarm" })),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const input = params as Record<string, unknown>;
		const action = input.action as string;

		try {
			switch (action) {
				case "init":
					return handleInit(input);

				case "define":
					return handleDefine(input);

				case "execute":
					return await handleExecute(input);

				case "chain":
					return handleChain(input);

				case "execute-chain":
					return await handleExecuteChain(input);

				case "swarm":
					return handleSwarm(input);

				case "execute-swarm":
					return await handleExecuteSwarm(input);

				case "agents":
					return handleAgents();

				case "agent":
					return handleAgent(input);

				case "chains":
					return handleChains();

				case "swarms":
					return handleSwarms();

				case "registry":
					return handleRegistry();

				case "stats":
					return handleStats();

				case "history":
					return handleHistory(input);

				case "remove":
					return handleRemove(input);

				case "reset":
					return handleReset();

				case "help":
					return handleHelp();

				default:
					return {
						content: [
							{
								type: "text",
								text: `Unknown action: ${action}. Use 'help' for available actions.`,
							},
						],
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
	const config: AgentBuilderConfig = {
		sdkConfig: {
			apiKey: (input.apiKey as string) || process.env.BAILIAN_API_KEY || "",
			baseUrl: (input.baseUrl as string) || process.env.BAILIAN_BASE_URL,
			model: (input.model as string) || "claude-3-opus",
		},
		defaultAgentConfig: {
			timeout: (input.timeout as number) || 300000,
			retries: (input.retries as number) || 3,
			verbose: (input.verbose as boolean) || false,
		},
	};

	initAgentBuilder(config);
	return {
		content: [
			{
				type: "text",
				text: `Agent Builder initialized successfully.

Configuration:
- Model: ${config.sdkConfig?.model}
- Timeout: ${config.defaultAgentConfig?.timeout}ms
- Retries: ${config.defaultAgentConfig?.retries}

Built-in agents registered:
- evolution-agent: Default agent for self-evolution tasks
- code-explorer: Deep codebase exploration agent
- code-reviewer: Code quality review agent
- planner: Architecture planning agent
- error-recovery: Agent for recovering from errors
- intelligence: Unified intelligence recommendations agent

Ready to use with agentBuilder({action: "agents"})`,
			},
		],
		details: { initialized: true },
	};
}

/**
 * Handle define action
 */
function handleDefine(input: Record<string, unknown>): AgentToolResult<unknown> {
	const builder = getBuilderOrInit();
	const id = input.id as string;
	const name = (input.name as string) || id;
	const description = (input.description as string) || `Agent ${id}`;
	const tags = (input.tags as string[]) || [];

	if (!id) {
		return {
			content: [{ type: "text", text: "Error: Agent ID required. Use 'id' parameter." }],
			details: "Error: Missing agent ID",
		};
	}

	try {
		const agent = builder.defineAgent({
			id,
			name,
			description,
			tags,
			execute: async (args: unknown) => {
				// Default implementation - override with custom execute logic
				return { message: `Agent ${id} executed with args`, args };
			},
		});

		return {
			content: [
				{
					type: "text",
					text: `Agent defined successfully.\n\n${formatAgentDefinition(agent)}`,
				},
			],
			details: { agent: { id, name, description, tags } },
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
 * Handle execute action
 */
async function handleExecute(input: Record<string, unknown>): Promise<AgentToolResult<unknown>> {
	const builder = getBuilderOrInit();
	const agentId = input.agentId as string;
	const args = (input.args as Record<string, unknown>) || {};

	if (!agentId) {
		return {
			content: [{ type: "text", text: "Error: Agent ID required. Use 'agentId' parameter." }],
			details: "Error: Missing agentId",
		};
	}

	const result = await builder.execute(agentId, args, {
		config: {
			timeout: input.timeout as number,
			retries: input.retries as number,
			verbose: input.verbose as boolean,
		},
		onProgress: (progress: AgentProgress) => {
			if (input.verbose as boolean) {
				console.log(`[${progress.percentage}%] ${progress.message}`);
			}
		},
	});

	return {
		content: [{ type: "text", text: formatAgentResult(result) }],
		details: { result },
	};
}

/**
 * Handle chain action
 */
function handleChain(input: Record<string, unknown>): AgentToolResult<unknown> {
	const builder = getBuilderOrInit();
	const id = input.id as string;
	const name = (input.name as string) || id;
	const agents = (input.agents as string[]) || [];

	if (!id) {
		return {
			content: [{ type: "text", text: "Error: Chain ID required. Use 'id' parameter." }],
			details: "Error: Missing chain ID",
		};
	}

	if (agents.length === 0) {
		return {
			content: [
				{
					type: "text",
					text: "Error: Agent list required. Use 'agents' parameter with array of agent IDs.",
				},
			],
			details: "Error: Missing agents",
		};
	}

	try {
		const chain = builder.defineChain({
			id,
			name,
			agents,
		});

		return {
			content: [
				{
					type: "text",
					text: `Chain defined successfully.\n\n${formatChainDefinition(chain)}`,
				},
			],
			details: { chain: { id, name, agents } },
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
 * Handle execute-chain action
 */
async function handleExecuteChain(
	input: Record<string, unknown>,
): Promise<AgentToolResult<unknown>> {
	const builder = getBuilderOrInit();
	const chainId = input.chainId as string;
	const args = (input.args as Record<string, unknown>) || {};

	if (!chainId) {
		return {
			content: [{ type: "text", text: "Error: Chain ID required. Use 'chainId' parameter." }],
			details: "Error: Missing chainId",
		};
	}

	const result = await builder.executeChain(chainId, args);

	return {
		content: [{ type: "text", text: formatAgentResult(result) }],
		details: { result },
	};
}

/**
 * Handle swarm action
 */
function handleSwarm(input: Record<string, unknown>): AgentToolResult<unknown> {
	const builder = getBuilderOrInit();
	const id = input.id as string;
	const name = (input.name as string) || id;
	const agents = (input.agents as string[]) || [];
	const strategy =
		(input.strategy as "parallel" | "sequential" | "race" | "all-to-all") || "parallel";

	if (!id) {
		return {
			content: [{ type: "text", text: "Error: Swarm ID required. Use 'id' parameter." }],
			details: "Error: Missing swarm ID",
		};
	}

	if (agents.length === 0) {
		return {
			content: [
				{
					type: "text",
					text: "Error: Agent list required. Use 'agents' parameter with array of agent IDs.",
				},
			],
			details: "Error: Missing agents",
		};
	}

	try {
		const swarm = builder.defineSwarm({
			id,
			name,
			agents,
			strategy,
		});

		return {
			content: [
				{
					type: "text",
					text: `Swarm defined successfully.\n\n${formatSwarmDefinition(swarm)}`,
				},
			],
			details: { swarm: { id, name, agents, strategy } },
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
 * Handle execute-swarm action
 */
async function handleExecuteSwarm(
	input: Record<string, unknown>,
): Promise<AgentToolResult<unknown>> {
	const builder = getBuilderOrInit();
	const swarmId = input.swarmId as string;
	const args = (input.args as Record<string, unknown>) || {};

	if (!swarmId) {
		return {
			content: [{ type: "text", text: "Error: Swarm ID required. Use 'swarmId' parameter." }],
			details: "Error: Missing swarmId",
		};
	}

	const result = await builder.executeSwarm(swarmId, args);

	return {
		content: [{ type: "text", text: formatAgentResult(result) }],
		details: { result },
	};
}

/**
 * Handle agents action
 */
function handleAgents(): AgentToolResult<unknown> {
	const builder = getBuilderOrInit();
	const agents = builder.getAllAgents();

	return {
		content: [
			{
				type: "text",
				text: `## Registered Agents (${agents.length})\n\n${agents.map((a) => `- **${a.id}**: ${a.name} - ${a.description}`).join("\n")}`,
			},
		],
		details: { agents: agents.map((a) => ({ id: a.id, name: a.name })) },
	};
}

/**
 * Handle agent action
 */
function handleAgent(input: Record<string, unknown>): AgentToolResult<unknown> {
	const builder = getBuilderOrInit();
	const id = input.id as string;

	if (!id) {
		return {
			content: [{ type: "text", text: "Error: Agent ID required. Use 'id' parameter." }],
			details: "Error: Missing agent ID",
		};
	}

	const agent = builder.getAgent(id);
	if (!agent) {
		return {
			content: [{ type: "text", text: `Agent ${id} not found.` }],
			details: { found: false },
		};
	}

	const record = builder.getRegistryRecord(id);

	return {
		content: [
			{
				type: "text",
				text: `${formatAgentDefinition(agent)}
${
	record
		? `### Statistics
- Usage Count: ${record.usageCount}
- Success Rate: ${(record.successRate * 100).toFixed(1)}%
- Average Duration: ${record.averageDuration.toFixed(0)}ms`
		: ""
}`,
			},
		],
		details: { agent, record },
	};
}

/**
 * Handle chains action
 */
function handleChains(): AgentToolResult<unknown> {
	const builder = getBuilderOrInit();
	const chains = builder.getAllChains();

	return {
		content: [
			{
				type: "text",
				text: `## Registered Chains (${chains.length})\n\n${chains.map((c) => `- **${c.id}**: ${c.name} (${c.agents.length} agents)`).join("\n")}`,
			},
		],
		details: { chains: chains.map((c) => ({ id: c.id, name: c.name })) },
	};
}

/**
 * Handle swarms action
 */
function handleSwarms(): AgentToolResult<unknown> {
	const builder = getBuilderOrInit();
	const swarms = builder.getAllSwarms();

	return {
		content: [
			{
				type: "text",
				text: `## Registered Swarms (${swarms.length})\n\n${swarms.map((s) => `- **${s.id}**: ${s.name} (${s.strategy}, ${s.agents.length} agents)`).join("\n")}`,
			},
		],
		details: { swarms: swarms.map((s) => ({ id: s.id, name: s.name })) },
	};
}

/**
 * Handle registry action
 */
function handleRegistry(): AgentToolResult<unknown> {
	const builder = getBuilderOrInit();
	const records = builder.getAllRegistryRecords();

	return {
		content: [
			{
				type: "text",
				text: `## Agent Registry\n\n${records
					.map(
						(r) => `### ${r.agent.id}
- Name: ${r.agent.name}
- Usage: ${r.usageCount}
- Success Rate: ${(r.successRate * 100).toFixed(1)}%
- Avg Duration: ${r.averageDuration.toFixed(0)}ms
- Tags: ${r.tags.join(", ") || "none"}`,
					)
					.join("\n\n")}`,
			},
		],
		details: { records },
	};
}

/**
 * Handle stats action
 */
function handleStats(): AgentToolResult<unknown> {
	const builder = getBuilderOrInit();
	const stats = builder.getStats();

	return {
		content: [{ type: "text", text: formatAgentStats(stats) }],
		details: { stats },
	};
}

/**
 * Handle history action
 */
function handleHistory(input: Record<string, unknown>): AgentToolResult<unknown> {
	const builder = getBuilderOrInit();
	const limit = (input.limit as number) || 10;
	const history = builder.getHistory(limit);

	return {
		content: [
			{
				type: "text",
				text: `## Execution History (last ${limit})\n\n${history
					.map(
						(r, i) => `### ${i + 1}. ${r.agentId} ${r.success ? "✅" : "❌"}
- Duration: ${r.durationMs}ms
- Error: ${r.error || "none"}`,
					)
					.join("\n\n")}`,
			},
		],
		details: { history },
	};
}

/**
 * Handle remove action
 */
function handleRemove(input: Record<string, unknown>): AgentToolResult<unknown> {
	const builder = getBuilderOrInit();
	const id = input.id as string;
	const type = (input.type as string) || "agent";

	if (!id) {
		return {
			content: [{ type: "text", text: "Error: ID required. Use 'id' parameter." }],
			details: "Error: Missing ID",
		};
	}

	let removed = false;
	switch (type) {
		case "chain":
			removed = builder.removeChain(id);
			break;
		case "swarm":
			removed = builder.removeSwarm(id);
			break;
		default:
			removed = builder.removeAgent(id);
	}

	return {
		content: [
			{
				type: "text",
				text: removed ? `${type} ${id} removed.` : `${type} ${id} not found.`,
			},
		],
		details: { removed, type, id },
	};
}

/**
 * Handle reset action
 */
function handleReset(): AgentToolResult<unknown> {
	const builder = getBuilderOrInit();
	builder.resetStats();

	return {
		content: [{ type: "text", text: "Statistics reset successfully." }],
		details: { reset: true },
	};
}

/**
 * Handle help action
 */
function handleHelp(): AgentToolResult<unknown> {
	return {
		content: [
			{
				type: "text",
				text: `## Agent Builder Help

Agent Builder enables defining composable agents that can be chained or run in parallel swarms.

### Actions

| Action | Description | Parameters |
|--------|-------------|------------|
| init | Initialize builder | apiKey, baseUrl, model, timeout, retries |
| define | Define new agent | id, name, description, tags |
| execute | Execute agent | agentId, args, timeout, retries |
| chain | Define agent chain | id, name, agents[] |
| execute-chain | Execute chain | chainId, args |
| swarm | Define agent swarm | id, name, agents[], strategy |
| execute-swarm | Execute swarm | swarmId, args |
| agents | List all agents | - |
| agent | Get agent details | id |
| chains | List all chains | - |
| swarms | List all swarms | - |
| registry | View registry | - |
| stats | View statistics | - |
| history | View history | limit |
| remove | Remove agent/chain/swarm | id, type |
| reset | Reset stats | - |

### Swarm Strategies

- **parallel**: Execute all agents simultaneously
- **sequential**: Execute agents one by one
- **race**: Return first successful result
- **all-to-all**: Each agent gets all previous outputs

### Built-in Agents

| Agent | Description | Tags |
|-------|-------------|------|
| evolution-agent | Default self-evolution agent | evolution, core |
| code-explorer | Deep codebase exploration | exploration, analysis |
| code-reviewer | Code quality review | review, quality |
| planner | Architecture planning | planning, architecture |
| error-recovery | Error recovery agent | error, recovery |
| intelligence | Unified recommendations | intelligence |

### Examples

\`\`\`typescript
// Initialize
agentBuilder({action: 'init'})

// Execute built-in agent
agentBuilder({action: 'execute', agentId: 'code-explorer', args: {files: ['src/*.ts'], query: 'agent'}})

// Define custom chain
agentBuilder({action: 'chain', id: 'review-chain', agents: ['code-explorer', 'code-reviewer']})

// Execute chain
agentBuilder({action: 'execute-chain', chainId: 'review-chain', args: {files: ['src/*.ts']}})

// Define parallel swarm
agentBuilder({action: 'swarm', id: 'parallel-review', agents: ['code-reviewer', 'planner'], strategy: 'parallel'})

// View stats
agentBuilder({action: 'stats'})
\`\`\`
`,
			},
		],
		details: {},
	};
}

/**
 * Get builder or initialize with defaults
 */
function getBuilderOrInit(): AgentBuilder {
	try {
		return getAgentBuilder();
	} catch {
		// Initialize with empty config - SDK will be initialized lazily
		return getAgentBuilder({});
	}
}

/**
 * Create agent builder tool (for compatibility)
 */
export function createAgentBuilderTool(): typeof agentBuilderTool {
	return agentBuilderTool;
}

export default agentBuilderTool;
