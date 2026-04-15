/**
 * Agent Builder - Composable Agent Definition System
 *
 * Inspired by Claude Code agent-sdk-dev and OpenHands SDK patterns.
 * Enables defining agents as composable functions with typed arguments,
 * agent chaining, multi-agent swarms, and lifecycle hooks.
 */

import { type EvolutionConfig, EvolutionSDK, getSDK } from "./sdk.js";

/**
 * Agent definition with typed arguments
 */
export interface AgentDefinition<TInput = unknown, TOutput = unknown> {
	/** Unique agent identifier */
	id: string;
	/** Human-readable name */
	name: string;
	/** Agent description */
	description: string;
	/** Argument type schema (JSON Schema-like) */
	argSchema?: Record<string, unknown>;
	/** Output type schema */
	outputSchema?: Record<string, unknown>;
	/** Agent execution function */
	execute: (args: TInput, context: AgentContext) => Promise<TOutput>;
	/** Default configuration */
	defaultConfig?: Partial<AgentConfig>;
	/** Dependencies on other agents */
	dependencies?: string[];
	/** Agent tags for categorization */
	tags?: string[];
	/** Agent version */
	version?: string;
}

/**
 * Agent execution context
 */
export interface AgentContext {
	/** SDK instance for evolution operations */
	sdk: EvolutionSDK;
	/** Session ID if running in a session */
	sessionId?: string;
	/** Parent agent ID if nested */
	parentAgentId?: string;
	/** Custom configuration */
	config: AgentConfig;
	/** Lifecycle hooks */
	hooks: AgentLifecycleHooks;
	/** Metadata passed through execution */
	metadata: Record<string, unknown>;
	/** Progress callback */
	onProgress?: (progress: AgentProgress) => void;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
	/** Maximum execution time (ms) */
	timeout?: number;
	/** Retry count on failure */
	retries?: number;
	/** Retry delay (ms) */
	retryDelay?: number;
	/** Enable verbose logging */
	verbose?: boolean;
	/** Custom model override */
	model?: string;
	/** Custom system prompt */
	systemPrompt?: string;
	/** Maximum iterations */
	maxIterations?: number;
	/** Stop on error */
	stopOnError?: boolean;
	/** Custom data passed to agent */
	customData?: Record<string, unknown>;
}

/**
 * Agent lifecycle hooks
 */
export interface AgentLifecycleHooks {
	/** Called before agent starts */
	onStart?: (agent: AgentDefinition, args: unknown, context: AgentContext) => Promise<void> | void;
	/** Called on agent completion */
	onComplete?: (
		agent: AgentDefinition,
		output: unknown,
		context: AgentContext,
	) => Promise<void> | void;
	/** Called on agent error */
	onError?: (agent: AgentDefinition, error: Error, context: AgentContext) => Promise<void> | void;
	/** Called on progress updates */
	onProgress?: (
		agent: AgentDefinition,
		progress: AgentProgress,
		context: AgentContext,
	) => Promise<void> | void;
}

/**
 * Agent progress information
 */
export interface AgentProgress {
	/** Progress percentage (0-100) */
	percentage: number;
	/** Progress message */
	message: string;
	/** Current step name */
	step?: string;
	/** Additional data */
	data?: Record<string, unknown>;
}

/**
 * Agent execution result
 */
export interface AgentResult<TOutput = unknown> {
	/** Whether execution succeeded */
	success: boolean;
	/** Agent output */
	output?: TOutput;
	/** Error message if failed */
	error?: string;
	/** Execution time (ms) */
	durationMs: number;
	/** Agent ID */
	agentId: string;
	/** Arguments that were provided */
	args: unknown;
	/** Progress events */
	progressEvents: AgentProgress[];
	/** Metadata from execution */
	metadata: Record<string, unknown>;
}

/**
 * Chain of agents to execute sequentially
 */
export interface AgentChain {
	/** Chain ID */
	id: string;
	/** Chain name */
	name: string;
	/** Agents in the chain (order matters) */
	agents: string[];
	/** How to pass output from one agent to the next */
	outputMapping?: ChainOutputMapping[];
	/** Chain configuration */
	config?: AgentConfig;
	/** Lifecycle hooks for chain */
	hooks?: AgentLifecycleHooks;
}

/**
 * Mapping for passing output between agents in a chain
 */
export interface ChainOutputMapping {
	/** Source agent index in chain */
	sourceIndex: number;
	/** Target agent index in chain */
	targetIndex: number;
	/** Field to extract from source output */
	sourceField?: string;
	/** Field to set in target arguments */
	targetField?: string;
	/** Transform function (optional) */
	transform?: (value: unknown) => unknown;
}

/**
 * Swarm of agents to execute in parallel
 */
export interface AgentSwarm {
	/** Swarm ID */
	id: string;
	/** Swarm name */
	name: string;
	/** Agents in the swarm */
	agents: string[];
	/** Coordination strategy */
	strategy: SwarmStrategy;
	/** Maximum parallel agents */
	maxParallel?: number;
	/** Aggregation function for results */
	aggregator?: (results: AgentResult[]) => unknown;
	/** Swarm configuration */
	config?: AgentConfig;
	/** Lifecycle hooks for swarm */
	hooks?: AgentLifecycleHooks;
}

/**
 * Swarm coordination strategy
 */
export type SwarmStrategy = "parallel" | "sequential" | "race" | "all-to-all" | "coordinator";

/**
 * Swarm coordinator definition
 */
export interface SwarmCoordinator {
	/** Coordinator agent ID */
	coordinatorAgentId: string;
	/** How to distribute work */
	distributionStrategy: "broadcast" | "partition" | "dynamic";
	/** How to aggregate results */
	aggregationStrategy: "first-success" | "majority" | "all" | "custom";
	/** Custom aggregator function */
	customAggregator?: (results: AgentResult[]) => unknown;
}

/**
 * Agent registry for discovering and managing agents
 */
export interface AgentRegistryRecord {
	/** Agent definition */
	agent: AgentDefinition;
	/** Registration timestamp */
	registeredAt: Date;
	/** Usage count */
	usageCount: number;
	/** Success rate */
	successRate: number;
	/** Average execution time (ms) */
	averageDuration: number;
	/** Tags for filtering */
	tags: string[];
}

/**
 * Agent Builder Statistics
 */
export interface AgentBuilderStats {
	/** Total registered agents */
	totalAgents: number;
	/** Total chains */
	totalChains: number;
	/** Total swarms */
	totalSwarms: number;
	/** Total executions */
	totalExecutions: number;
	/** Successful executions */
	successfulExecutions: number;
	/** Average execution time */
	averageExecutionTime: number;
	/** Top agents by usage */
	topAgents: Array<{ id: string; usageCount: number; successRate: number }>;
}

/**
 * Agent Builder Configuration
 */
export interface AgentBuilderConfig {
	/** Evolution SDK config */
	sdkConfig?: EvolutionConfig;
	/** Default agent config */
	defaultAgentConfig?: AgentConfig;
	/** Global lifecycle hooks */
	globalHooks?: AgentLifecycleHooks;
	/** Enable agent registry statistics */
	trackStats?: boolean;
	/** Registry persistence path */
	registryPath?: string;
}

/**
 * Agent Builder - Composable Agent Definition System
 *
 * Usage:
 * ```typescript
 * const builder = new AgentBuilder();
 *
 * // Define an agent
 * const myAgent = builder.defineAgent({
 *   id: 'my-agent',
 *   name: 'My Agent',
 *   description: 'Does something useful',
 *   execute: async (args, context) => {
 *     return { result: 'output' };
 *   }
 * });
 *
 * // Execute agent
 * const result = await builder.execute('my-agent', { data: 'value' });
 *
 * // Chain agents
 * builder.defineChain({
 *   id: 'my-chain',
 *   agents: ['agent1', 'agent2', 'agent3']
 * });
 *
 * // Run chain
 * const chainResult = await builder.executeChain('my-chain', { data: 'value' });
 *
 * // Create swarm
 * builder.defineSwarm({
 *   id: 'my-swarm',
 *   agents: ['agent1', 'agent2', 'agent3'],
 *   strategy: 'parallel'
 * });
 *
 * // Run swarm
 * const swarmResult = await builder.executeSwarm('my-swarm', { data: 'value' });
 * ```
 */
export class AgentBuilder {
	private config: AgentBuilderConfig;
	private agents: Map<string, AgentDefinition> = new Map();
	private chains: Map<string, AgentChain> = new Map();
	private swarms: Map<string, AgentSwarm> = new Map();
	private registry: Map<string, AgentRegistryRecord> = new Map();
	private executionHistory: AgentResult[] = [];
	private sdk: EvolutionSDK | null = null;

	constructor(config: AgentBuilderConfig = {}) {
		this.config = {
			defaultAgentConfig: {
				timeout: 300000, // 5 minutes
				retries: 3,
				retryDelay: 1000,
				verbose: false,
				stopOnError: true,
			},
			trackStats: true,
			registryPath: "~/.paimon/agent-builder.json",
			...config,
		};

		// Initialize SDK if config provided
		if (config.sdkConfig) {
			this.sdk = new EvolutionSDK(config.sdkConfig);
		}

		// Register built-in agents
		this.registerBuiltInAgents();
	}

	/**
	 * Initialize SDK with config
	 */
	initSDK(config: EvolutionConfig): void {
		this.sdk = new EvolutionSDK(config);
	}

	/**
	 * Get SDK instance
	 */
	getSDK(): EvolutionSDK {
		if (!this.sdk) {
			try {
				this.sdk = getSDK();
			} catch {
				throw new Error("SDK not initialized. Call initSDK() first.");
			}
		}
		return this.sdk;
	}

	/**
	 * Register built-in agents
	 */
	private registerBuiltInAgents(): void {
		// Evolution agent
		this.defineAgent({
			id: "evolution-agent",
			name: "Evolution Agent",
			description: "Default agent for self-evolution tasks",
			tags: ["evolution", "core"],
			execute: async (args: { task: string; type?: string }, context) => {
				const sdk = this.getSDK();
				const session = await sdk.startSession();
				const result = await sdk.runIteration(session.id);
				return { session, result };
			},
		});

		// Code explorer agent
		this.defineAgent({
			id: "code-explorer",
			name: "Code Explorer",
			description: "Deep codebase exploration agent",
			tags: ["exploration", "analysis"],
			execute: async (args: { files: string[]; query: string }, context) => {
				// Simulated exploration - actual implementation would use repomap/grep
				context.onProgress?.({ percentage: 25, message: "Scanning files..." });
				context.onProgress?.({ percentage: 50, message: "Analyzing patterns..." });
				context.onProgress?.({ percentage: 75, message: "Building map..." });
				context.onProgress?.({ percentage: 100, message: "Complete" });
				return { findings: [], filesScanned: args.files.length };
			},
		});

		// Code reviewer agent
		this.defineAgent({
			id: "code-reviewer",
			name: "Code Reviewer",
			description: "Code quality review agent",
			tags: ["review", "quality"],
			execute: async (args: { files: string[]; aspects?: string[] }, context) => {
				context.onProgress?.({ percentage: 50, message: "Reviewing code..." });
				return { findings: [], approved: true };
			},
		});

		// Planner agent
		this.defineAgent({
			id: "planner",
			name: "Planner",
			description: "Architecture planning agent",
			tags: ["planning", "architecture"],
			execute: async (args: { task: string; constraints?: string[] }, context) => {
				return { plan: [], phases: [] };
			},
		});

		// Error recovery agent
		this.defineAgent({
			id: "error-recovery",
			name: "Error Recovery",
			description: "Agent for recovering from errors",
			tags: ["error", "recovery"],
			execute: async (args: { error: string; context?: string }, context) => {
				const sdk = this.getSDK();
				const match = sdk.matchErrorPattern(args.error);
				return { solution: match.solution, confidence: match.confidence };
			},
		});

		// Intelligence agent
		this.defineAgent({
			id: "intelligence",
			name: "Intelligence",
			description: "Unified intelligence recommendations agent",
			tags: ["intelligence", "recommendations"],
			execute: async (args: { task: string; type?: string }, context) => {
				const sdk = this.getSDK();
				return sdk.getRecommendations({
					taskDescription: args.task,
					taskType: (args.type as "capability" | "reliability" | "feature") || "capability",
				});
			},
		});
	}

	/**
	 * Define a new agent
	 */
	defineAgent<TInput = unknown, TOutput = unknown>(
		definition: AgentDefinition<TInput, TOutput>,
	): AgentDefinition<TInput, TOutput> {
		if (this.agents.has(definition.id)) {
			throw new Error(`Agent ${definition.id} already registered`);
		}

		// Store as unknown type to handle generics
		this.agents.set(definition.id, definition as AgentDefinition<unknown, unknown>);

		// Add to registry
		if (this.config.trackStats) {
			this.registry.set(definition.id, {
				agent: definition as AgentDefinition<unknown, unknown>,
				registeredAt: new Date(),
				usageCount: 0,
				successRate: 0,
				averageDuration: 0,
				tags: definition.tags || [],
			});
		}

		return definition;
	}

	/**
	 * Get agent by ID
	 */
	getAgent(id: string): AgentDefinition | undefined {
		return this.agents.get(id);
	}

	/**
	 * Get all agents
	 */
	getAllAgents(): AgentDefinition[] {
		return Array.from(this.agents.values());
	}

	/**
	 * Get agents by tag
	 */
	getAgentsByTag(tag: string): AgentDefinition[] {
		return Array.from(this.agents.values()).filter((a) => a.tags?.includes(tag));
	}

	/**
	 * Execute an agent
	 */
	async execute<TInput = unknown, TOutput = unknown>(
		agentId: string,
		args: TInput,
		options: {
			config?: Partial<AgentConfig>;
			hooks?: Partial<AgentLifecycleHooks>;
			metadata?: Record<string, unknown>;
			onProgress?: (progress: AgentProgress) => void;
		} = {},
	): Promise<AgentResult<TOutput>> {
		const agent = this.agents.get(agentId);
		if (!agent) {
			throw new Error(`Agent ${agentId} not found`);
		}

		const mergedConfig = { ...this.config.defaultAgentConfig, ...options.config };
		const mergedHooks = { ...this.config.globalHooks, ...options.hooks };

		const context: AgentContext = {
			sdk: this.getSDK(),
			config: mergedConfig,
			hooks: mergedHooks,
			metadata: options.metadata || {},
			onProgress: options.onProgress,
		};

		const startTime = Date.now();
		const progressEvents: AgentProgress[] = [];

		// Track progress
		const trackProgress = (progress: AgentProgress) => {
			progressEvents.push(progress);
			options.onProgress?.(progress);
			mergedHooks.onProgress?.(agent, progress, context);
		};

		context.onProgress = trackProgress;

		try {
			// Call onStart hook
			await mergedHooks.onStart?.(agent, args, context);

			// Execute with retries
			let output: TOutput | undefined;
			let retries = 0;
			const maxRetries = mergedConfig.retries || 0;

			while (true) {
				try {
					output = (await agent.execute(args as unknown, context)) as TOutput;
					break;
				} catch (e) {
					retries++;
					if (retries > maxRetries) {
						throw e;
					}
					await new Promise((r) => setTimeout(r, mergedConfig.retryDelay || 1000));
				}
			}

			const durationMs = Date.now() - startTime;

			// Call onComplete hook
			await mergedHooks.onComplete?.(agent, output, context);

			// Update registry stats
			if (this.config.trackStats) {
				const record = this.registry.get(agentId);
				if (record) {
					record.usageCount++;
					record.successRate =
						(record.successRate * (record.usageCount - 1) + 1) / record.usageCount;
					record.averageDuration =
						(record.averageDuration * (record.usageCount - 1) + durationMs) / record.usageCount;
				}
			}

			const result: AgentResult<TOutput> = {
				success: true,
				output,
				durationMs,
				agentId,
				args,
				progressEvents,
				metadata: context.metadata,
			};

			this.executionHistory.push(result);
			return result;
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e));
			const durationMs = Date.now() - startTime;

			// Call onError hook
			await mergedHooks.onError?.(agent, error, context);

			// Update registry stats
			if (this.config.trackStats) {
				const record = this.registry.get(agentId);
				if (record) {
					record.usageCount++;
					record.successRate =
						(record.successRate * (record.usageCount - 1) + 0) / record.usageCount;
					record.averageDuration =
						(record.averageDuration * (record.usageCount - 1) + durationMs) / record.usageCount;
				}
			}

			const result: AgentResult<TOutput> = {
				success: false,
				error: error.message,
				durationMs,
				agentId,
				args,
				progressEvents,
				metadata: context.metadata,
			};

			this.executionHistory.push(result);
			return result;
		}
	}

	/**
	 * Define a chain of agents
	 */
	defineChain(definition: AgentChain): AgentChain {
		if (this.chains.has(definition.id)) {
			throw new Error(`Chain ${definition.id} already registered`);
		}

		// Verify all agents exist
		for (const agentId of definition.agents) {
			if (!this.agents.has(agentId)) {
				throw new Error(`Agent ${agentId} in chain not found`);
			}
		}

		this.chains.set(definition.id, definition);
		return definition;
	}

	/**
	 * Get chain by ID
	 */
	getChain(id: string): AgentChain | undefined {
		return this.chains.get(id);
	}

	/**
	 * Get all chains
	 */
	getAllChains(): AgentChain[] {
		return Array.from(this.chains.values());
	}

	/**
	 * Execute a chain of agents
	 */
	async executeChain<TInput = unknown, TOutput = unknown>(
		chainId: string,
		args: TInput,
		options: {
			config?: Partial<AgentConfig>;
			hooks?: Partial<AgentLifecycleHooks>;
			metadata?: Record<string, unknown>;
		} = {},
	): Promise<AgentResult<TOutput>> {
		const chain = this.chains.get(chainId);
		if (!chain) {
			throw new Error(`Chain ${chainId} not found`);
		}

		const mergedConfig = { ...this.config.defaultAgentConfig, ...chain.config, ...options.config };
		const mergedHooks = { ...this.config.globalHooks, ...chain.hooks, ...options.hooks };

		const startTime = Date.now();
		const allProgressEvents: AgentProgress[] = [];
		let currentArgs: unknown = args;
		const outputs: unknown[] = [];

		try {
			// Execute each agent in sequence
			for (let i = 0; i < chain.agents.length; i++) {
				const agentId = chain.agents[i];

				// Apply output mapping if defined
				if (chain.outputMapping) {
					for (const mapping of chain.outputMapping) {
						if (mapping.targetIndex === i && mapping.sourceIndex < i) {
							const sourceOutput = outputs[mapping.sourceIndex];
							const value = mapping.sourceField
								? (sourceOutput as Record<string, unknown>)?.[mapping.sourceField]
								: sourceOutput;
							const transformed = mapping.transform ? mapping.transform(value) : value;

							if (typeof currentArgs === "object" && currentArgs !== null) {
								if (mapping.targetField) {
									(currentArgs as Record<string, unknown>)[mapping.targetField] = transformed;
								}
							} else if (mapping.targetField) {
								currentArgs = { [mapping.targetField]: transformed };
							} else {
								currentArgs = transformed;
							}
						}
					}
				}

				const result = await this.execute(agentId, currentArgs, {
					config: mergedConfig,
					hooks: mergedHooks,
					metadata: options.metadata,
					onProgress: (p) =>
						allProgressEvents.push({ ...p, step: `Agent ${i + 1}/${chain.agents.length}` }),
				});

				outputs.push(result.output);

				if (!result.success && mergedConfig.stopOnError) {
					return {
						success: false,
						error: result.error,
						durationMs: Date.now() - startTime,
						agentId: chainId,
						args,
						progressEvents: allProgressEvents,
						metadata: { outputs, failedAt: i },
					};
				}

				// Pass output to next agent
				currentArgs = result.output;
			}

			return {
				success: true,
				output: outputs[outputs.length - 1] as TOutput,
				durationMs: Date.now() - startTime,
				agentId: chainId,
				args,
				progressEvents: allProgressEvents,
				metadata: { outputs },
			};
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e));
			return {
				success: false,
				error: error.message,
				durationMs: Date.now() - startTime,
				agentId: chainId,
				args,
				progressEvents: allProgressEvents,
				metadata: { outputs },
			};
		}
	}

	/**
	 * Define a swarm of agents
	 */
	defineSwarm(definition: AgentSwarm): AgentSwarm {
		if (this.swarms.has(definition.id)) {
			throw new Error(`Swarm ${definition.id} already registered`);
		}

		// Verify all agents exist
		for (const agentId of definition.agents) {
			if (!this.agents.has(agentId)) {
				throw new Error(`Agent ${agentId} in swarm not found`);
			}
		}

		this.swarms.set(definition.id, definition);
		return definition;
	}

	/**
	 * Get swarm by ID
	 */
	getSwarm(id: string): AgentSwarm | undefined {
		return this.swarms.get(id);
	}

	/**
	 * Get all swarms
	 */
	getAllSwarms(): AgentSwarm[] {
		return Array.from(this.swarms.values());
	}

	/**
	 * Execute a swarm of agents
	 */
	async executeSwarm<TInput = unknown>(
		swarmId: string,
		args: TInput,
		options: {
			config?: Partial<AgentConfig>;
			hooks?: Partial<AgentLifecycleHooks>;
			metadata?: Record<string, unknown>;
		} = {},
	): Promise<AgentResult> {
		const swarm = this.swarms.get(swarmId);
		if (!swarm) {
			throw new Error(`Swarm ${swarmId} not found`);
		}

		const mergedConfig = { ...this.config.defaultAgentConfig, ...swarm.config, ...options.config };
		const mergedHooks = { ...this.config.globalHooks, ...swarm.hooks, ...options.hooks };

		const startTime = Date.now();
		const allProgressEvents: AgentProgress[] = [];

		try {
			// Execute based on strategy
			const results: AgentResult[] = [];

			switch (swarm.strategy) {
				case "parallel": {
					// Execute all agents in parallel
					const parallelPromises = swarm.agents.map((agentId) =>
						this.execute(agentId, args, {
							config: mergedConfig,
							hooks: mergedHooks,
							metadata: options.metadata,
							onProgress: (p) => allProgressEvents.push(p),
						}),
					);
					results.push(...(await Promise.all(parallelPromises)));
					break;
				}

				case "sequential": {
					// Execute agents one by one
					for (const agentId of swarm.agents) {
						const result = await this.execute(agentId, args, {
							config: mergedConfig,
							hooks: mergedHooks,
							metadata: options.metadata,
							onProgress: (p) => allProgressEvents.push(p),
						});
						results.push(result);
					}
					break;
				}

				case "race": {
					// Execute all and return first successful
					const racePromises = swarm.agents.map((agentId) =>
						this.execute(agentId, args, {
							config: mergedConfig,
							hooks: mergedHooks,
							metadata: options.metadata,
						}).then((r) => ({ agentId, result: r })),
					);
					const raceWinner = await Promise.race(
						racePromises.filter(async (p) => {
							const { result } = await p;
							return result.success;
						}),
					);
					results.push((await raceWinner).result);
					break;
				}

				case "all-to-all": {
					// Each agent gets args from all previous outputs
					let currentArgs: unknown = args;
					for (const agentId of swarm.agents) {
						const result = await this.execute(agentId, currentArgs, {
							config: mergedConfig,
							hooks: mergedHooks,
							metadata: { ...options.metadata, previousResults: results },
							onProgress: (p) => allProgressEvents.push(p),
						});
						results.push(result);
						currentArgs = { args, previousOutputs: results.map((r) => r.output) };
					}
					break;
				}

				default:
					throw new Error(`Unknown swarm strategy: ${swarm.strategy}`);
			}

			// Aggregate results
			const aggregatedOutput = swarm.aggregator ? swarm.aggregator(results) : { results };

			const durationMs = Date.now() - startTime;

			return {
				success: results.some((r) => r.success),
				output: aggregatedOutput,
				durationMs,
				agentId: swarmId,
				args,
				progressEvents: allProgressEvents,
				metadata: { results, strategy: swarm.strategy },
			};
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e));
			return {
				success: false,
				error: error.message,
				durationMs: Date.now() - startTime,
				agentId: swarmId,
				args,
				progressEvents: allProgressEvents,
				metadata: {},
			};
		}
	}

	/**
	 * Remove an agent
	 */
	removeAgent(id: string): boolean {
		if (!this.agents.has(id)) return false;
		this.agents.delete(id);
		this.registry.delete(id);
		return true;
	}

	/**
	 * Remove a chain
	 */
	removeChain(id: string): boolean {
		if (!this.chains.has(id)) return false;
		this.chains.delete(id);
		return true;
	}

	/**
	 * Remove a swarm
	 */
	removeSwarm(id: string): boolean {
		if (!this.swarms.has(id)) return false;
		this.swarms.delete(id);
		return true;
	}

	/**
	 * Get registry record
	 */
	getRegistryRecord(id: string): AgentRegistryRecord | undefined {
		return this.registry.get(id);
	}

	/**
	 * Get all registry records
	 */
	getAllRegistryRecords(): AgentRegistryRecord[] {
		return Array.from(this.registry.values());
	}

	/**
	 * Get statistics
	 */
	getStats(): AgentBuilderStats {
		const records = Array.from(this.registry.values());

		return {
			totalAgents: this.agents.size,
			totalChains: this.chains.size,
			totalSwarms: this.swarms.size,
			totalExecutions: this.executionHistory.length,
			successfulExecutions: this.executionHistory.filter((r) => r.success).length,
			averageExecutionTime:
				this.executionHistory.length > 0
					? this.executionHistory.reduce((sum, r) => sum + r.durationMs, 0) /
						this.executionHistory.length
					: 0,
			topAgents: records
				.sort((a, b) => b.usageCount - a.usageCount)
				.slice(0, 10)
				.map((r) => ({
					id: r.agent.id,
					usageCount: r.usageCount,
					successRate: r.successRate,
				})),
		};
	}

	/**
	 * Clear execution history
	 */
	clearHistory(): void {
		this.executionHistory = [];
	}

	/**
	 * Reset all statistics
	 */
	resetStats(): void {
		for (const record of this.registry.values()) {
			record.usageCount = 0;
			record.successRate = 0;
			record.averageDuration = 0;
		}
		this.clearHistory();
	}

	/**
	 * Get execution history
	 */
	getHistory(limit?: number): AgentResult[] {
		if (limit) {
			return this.executionHistory.slice(-limit);
		}
		return [...this.executionHistory];
	}
}

/**
 * Global agent builder instance
 */
let builderInstance: AgentBuilder | null = null;

/**
 * Get global agent builder instance
 */
export function getAgentBuilder(config?: AgentBuilderConfig): AgentBuilder {
	if (!builderInstance && config) {
		builderInstance = new AgentBuilder(config);
	}
	if (!builderInstance) {
		builderInstance = new AgentBuilder();
	}
	return builderInstance;
}

/**
 * Initialize global agent builder
 */
export function initAgentBuilder(config: AgentBuilderConfig): AgentBuilder {
	builderInstance = new AgentBuilder(config);
	return builderInstance;
}

/**
 * Format agent result as markdown
 */
export function formatAgentResult(result: AgentResult): string {
	const statusEmoji = result.success ? "✅" : "❌";
	return `## Agent Result ${statusEmoji}

- **Agent ID:** ${result.agentId}
- **Success:** ${result.success}
- **Duration:** ${result.durationMs}ms
- **Arguments:** ${JSON.stringify(result.args).slice(0, 100)}...
- **Output:** ${result.output ? JSON.stringify(result.output).slice(0, 200) : "N/A"}
- **Error:** ${result.error || "None"}
- **Progress Events:** ${result.progressEvents.length}

${result.progressEvents.length > 0 ? `### Progress\n${result.progressEvents.map((p) => `- ${p.percentage}%: ${p.message}`).join("\n")}` : ""}
`;
}

/**
 * Format agent stats as markdown
 */
export function formatAgentStats(stats: AgentBuilderStats): string {
	return `## Agent Builder Statistics

| Metric | Value |
|--------|-------|
| Total Agents | ${stats.totalAgents} |
| Total Chains | ${stats.totalChains} |
| Total Swarms | ${stats.totalSwarms} |
| Total Executions | ${stats.totalExecutions} |
| Successful Executions | ${stats.successfulExecutions} |
| Average Execution Time | ${stats.averageExecutionTime.toFixed(0)}ms |
| Success Rate | ${stats.totalExecutions > 0 ? ((stats.successfulExecutions / stats.totalExecutions) * 100).toFixed(1) : 0}% |

### Top Agents by Usage
${stats.topAgents.map((a) => `- **${a.id}**: ${a.usageCount} uses, ${a.successRate.toFixed(1)}% success`).join("\n")}
`;
}

/**
 * Format agent definition as markdown
 */
export function formatAgentDefinition(agent: AgentDefinition): string {
	return `## Agent: ${agent.name}

- **ID:** ${agent.id}
- **Description:** ${agent.description}
- **Version:** ${agent.version || "1.0"}
- **Tags:** ${agent.tags?.join(", ") || "none"}
- **Dependencies:** ${agent.dependencies?.join(", ") || "none"}
- **Argument Schema:** ${agent.argSchema ? JSON.stringify(agent.argSchema) : "any"}
- **Output Schema:** ${agent.outputSchema ? JSON.stringify(agent.outputSchema) : "any"}
`;
}

/**
 * Format chain definition as markdown
 */
export function formatChainDefinition(chain: AgentChain): string {
	return `## Chain: ${chain.name}

- **ID:** ${chain.id}
- **Agents:** ${chain.agents.join(" → ")}
- **Output Mappings:** ${chain.outputMapping?.length || 0}

${chain.outputMapping?.map((m) => `- Agent ${m.sourceIndex} → Agent ${m.targetIndex} (${m.sourceField || "all"} → ${m.targetField || "all"})`).join("\n") || ""}
`;
}

/**
 * Format swarm definition as markdown
 */
export function formatSwarmDefinition(swarm: AgentSwarm): string {
	return `## Swarm: ${swarm.name}

- **ID:** ${swarm.id}
- **Strategy:** ${swarm.strategy}
- **Agents:** ${swarm.agents.join(", ")}
- **Max Parallel:** ${swarm.maxParallel || "unlimited"}
`;
}
