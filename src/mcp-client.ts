/**
 * MCP (Model Context Protocol) Client Module
 *
 * Enables Paimon to connect to external MCP servers and use their tools, resources, and prompts.
 * MCP is an open protocol that standardizes how AI agents connect to external data sources and tools.
 *
 * Supported features:
 * - Connect to multiple MCP servers via stdio, SSE, or HTTP
 * - Discover and call tools from MCP servers
 * - Access resources (files, databases, APIs)
 * - Use prompts from MCP servers
 * - Tool filtering and enable/disable management
 *
 * Based on: https://modelcontextprotocol.io/
 * Inspired by: Claude Code MCP integration
 */

import * as childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as path from "node:path";

// Types
export interface MCPServerConfig {
	name: string;
	command?: string;
	args?: string[];
	url?: string;
	env?: Record<string, string>;
	transport: "stdio" | "sse" | "http";
	disabled?: boolean;
	autoStart?: boolean;
	restartOnFailure?: boolean;
	maxRestarts?: number;
	description?: string;
}

export interface MCPTool {
	name: string;
	description: string;
	inputSchema: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
	serverName: string;
}

export interface MCPResource {
	uri: string;
	name: string;
	description?: string;
	mimeType?: string;
	serverName: string;
}

export interface MCPPrompt {
	name: string;
	description?: string;
	arguments?: Array<{
		name: string;
		description?: string;
		required?: boolean;
	}>;
	serverName: string;
}

export interface MCPToolCallResult {
	content: Array<{
		type: "text" | "image" | "resource";
		text?: string;
		data?: string;
		mimeType?: string;
	}>;
	isError?: boolean;
}

export interface MCPResourceContent {
	uri: string;
	mimeType?: string;
	text?: string;
	blob?: string;
}

export interface MCPServerStatus {
	name: string;
	connected: boolean;
	toolsCount: number;
	resourcesCount: number;
	promptsCount: number;
	lastError?: string;
	restartCount: number;
}

export interface MCPClientStats {
	totalServers: number;
	connectedServers: number;
	totalTools: number;
	totalResources: number;
	totalPrompts: number;
	toolCalls: number;
	successfulCalls: number;
	failedCalls: number;
	serverStatuses: MCPServerStatus[];
}

export interface MCPClientConfig {
	servers: MCPServerConfig[];
	autoConnect: boolean;
	timeout: number;
	toolCallTimeout: number;
}

// JSON-RPC types for MCP
interface JSONRPCRequest {
	jsonrpc: "2.0";
	id: number;
	method: string;
	params?: unknown;
}

interface JSONRPCResponse {
	jsonrpc: "2.0";
	id: number;
	result?: unknown;
	error?: {
		code: number;
		message: string;
		data?: unknown;
	};
}

interface JSONRPCNotification {
	jsonrpc: "2.0";
	method: string;
	params?: unknown;
}

// Default configuration
const DEFAULT_CONFIG: MCPClientConfig = {
	servers: [],
	autoConnect: true,
	timeout: 30000,
	toolCallTimeout: 60000,
};

// Sample MCP servers for quick setup
const SAMPLE_MCP_SERVERS: MCPServerConfig[] = [
	{
		name: "filesystem",
		command: "mcp-server-filesystem",
		args: ["--root", process.cwd()],
		transport: "stdio",
		description: "File system operations with configurable access controls",
	},
	{
		name: "git",
		command: "mcp-server-git",
		args: ["--repository", process.cwd()],
		transport: "stdio",
		description: "Git repository operations",
	},
	{
		name: "fetch",
		command: "mcp-server-fetch",
		transport: "stdio",
		description: "Web content fetching and conversion",
	},
	{
		name: "memory",
		command: "mcp-server-memory",
		transport: "stdio",
		description: "Knowledge graph-based persistent memory",
	},
	{
		name: "sequential-thinking",
		command: "mcp-server-sequential-thinking",
		transport: "stdio",
		description: "Dynamic problem-solving through thought sequences",
	},
	{
		name: "time",
		command: "mcp-server-time",
		transport: "stdio",
		description: "Time and timezone conversion",
	},
];

let mcpClientInstance: MCPClient | null = null;

/**
 * MCP Client for connecting to Model Context Protocol servers
 */
export class MCPClient extends EventEmitter {
	private config: MCPClientConfig;
	private servers: Map<string, MCPServerConnection> = new Map();
	private tools: Map<string, MCPTool> = new Map();
	private resources: Map<string, MCPResource> = new Map();
	private prompts: Map<string, MCPPrompt> = new Map();
	private stats: {
		toolCalls: number;
		successfulCalls: number;
		failedCalls: number;
	};
	private dataPath: string;
	private requestId = 0;

	constructor(configPath?: string) {
		super();
		this.config = { ...DEFAULT_CONFIG };
		this.dataPath = path.join(process.env.HOME || ".", ".paimon", "mcp-config.json");
		this.stats = {
			toolCalls: 0,
			successfulCalls: 0,
			failedCalls: 0,
		};
		this.loadConfig();
	}

	private loadConfig(): void {
		try {
			if (fs.existsSync(this.dataPath)) {
				const data = JSON.parse(fs.readFileSync(this.dataPath, "utf-8"));
				this.config = { ...DEFAULT_CONFIG, ...data };
				this.stats = data.stats || this.stats;
			}
		} catch {
			// Use defaults
		}
	}

	private saveConfig(): void {
		try {
			const dir = path.dirname(this.dataPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(
				this.dataPath,
				JSON.stringify(
					{
						...this.config,
						stats: this.stats,
					},
					null,
					2,
				),
			);
		} catch (error) {
			console.error("Failed to save MCP config:", error);
		}
	}

	/**
	 * Add an MCP server configuration
	 */
	addServer(config: MCPServerConfig): void {
		const existing = this.config.servers.find((s) => s.name === config.name);
		if (existing) {
			Object.assign(existing, config);
		} else {
			this.config.servers.push(config);
		}
		this.saveConfig();
	}

	/**
	 * Remove an MCP server
	 */
	removeServer(name: string): boolean {
		const index = this.config.servers.findIndex((s) => s.name === name);
		if (index >= 0) {
			this.config.servers.splice(index, 1);
			this.saveConfig();
			return true;
		}
		return false;
	}

	/**
	 * Get all configured servers
	 */
	getServers(): MCPServerConfig[] {
		return [...this.config.servers];
	}

	/**
	 * Connect to a specific MCP server
	 */
	async connectServer(name: string): Promise<boolean> {
		const config = this.config.servers.find((s) => s.name === name);
		if (!config) {
			throw new Error(`MCP server '${name}' not found`);
		}

		if (config.disabled) {
			throw new Error(`MCP server '${name}' is disabled`);
		}

		try {
			const connection = await this.createServerConnection(config);
			this.servers.set(name, connection);

			// Discover tools, resources, prompts
			await this.discoverCapabilities(name);

			this.emit("server-connected", name);
			return true;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.emit("server-error", name, errorMessage);
			throw error;
		}
	}

	/**
	 * Disconnect from a specific MCP server
	 */
	async disconnectServer(name: string): Promise<void> {
		const connection = this.servers.get(name);
		if (connection) {
			await connection.close();
			this.servers.delete(name);

			// Remove tools, resources, prompts from this server
			for (const [toolName, tool] of this.tools) {
				if (tool.serverName === name) {
					this.tools.delete(toolName);
				}
			}
			for (const [uri, resource] of this.resources) {
				if (resource.serverName === name) {
					this.resources.delete(uri);
				}
			}
			for (const [promptName, prompt] of this.prompts) {
				if (prompt.serverName === name) {
					this.prompts.delete(promptName);
				}
			}

			this.emit("server-disconnected", name);
		}
	}

	/**
	 * Connect to all configured servers
	 */
	async connectAll(): Promise<Map<string, Error | null>> {
		const results = new Map<string, Error | null>();

		for (const config of this.config.servers) {
			if (!config.disabled && config.autoStart !== false) {
				try {
					await this.connectServer(config.name);
					results.set(config.name, null);
				} catch (error) {
					results.set(config.name, error instanceof Error ? error : new Error(String(error)));
				}
			}
		}

		return results;
	}

	/**
	 * Disconnect from all servers
	 */
	async disconnectAll(): Promise<void> {
		const disconnectPromises: Promise<void>[] = [];
		for (const name of this.servers.keys()) {
			disconnectPromises.push(this.disconnectServer(name));
		}
		await Promise.all(disconnectPromises);
	}

	/**
	 * Create a server connection based on transport type
	 */
	private async createServerConnection(config: MCPServerConfig): Promise<MCPServerConnection> {
		switch (config.transport) {
			case "stdio":
				return this.createStdioConnection(config);
			case "sse":
				return this.createSSEConnection(config);
			case "http":
				return this.createHTTPConnection(config);
			default:
				throw new Error(`Unsupported transport: ${config.transport}`);
		}
	}

	/**
	 * Create stdio-based MCP connection
	 */
	private async createStdioConnection(config: MCPServerConfig): Promise<MCPServerConnection> {
		if (!config.command) {
			throw new Error("Stdio transport requires 'command' in config");
		}

		const connection = new StdioMCPServerConnection(config, this.config.timeout);
		await connection.initialize();
		return connection;
	}

	/**
	 * Create SSE-based MCP connection
	 */
	private async createSSEConnection(config: MCPServerConfig): Promise<MCPServerConnection> {
		if (!config.url) {
			throw new Error("SSE transport requires 'url' in config");
		}

		const connection = new SSEMCPServerConnection(config, this.config.timeout);
		await connection.initialize();
		return connection;
	}

	/**
	 * Create HTTP-based MCP connection
	 */
	private async createHTTPConnection(config: MCPServerConfig): Promise<MCPServerConnection> {
		if (!config.url) {
			throw new Error("HTTP transport requires 'url' in config");
		}

		const connection = new HTTPMCPServerConnection(config, this.config.timeout);
		await connection.initialize();
		return connection;
	}

	/**
	 * Discover tools, resources, and prompts from a server
	 */
	private async discoverCapabilities(serverName: string): Promise<void> {
		const connection = this.servers.get(serverName);
		if (!connection) return;

		try {
			// Discover tools
			const toolsResult = await connection.sendRequest("tools/list", {});
			if (toolsResult && typeof toolsResult === "object" && "tools" in toolsResult) {
				const tools = (toolsResult as { tools: unknown[] }).tools;
				if (Array.isArray(tools)) {
					for (const tool of tools) {
						if (this.isValidTool(tool)) {
							const mcpTool: MCPTool = {
								name: `${serverName}_${tool.name}`,
								description: tool.description || "",
								inputSchema: tool.inputSchema,
								serverName,
							};
							this.tools.set(mcpTool.name, mcpTool);
						}
					}
				}
			}
		} catch {
			// Server might not support tools
		}

		try {
			// Discover resources
			const resourcesResult = await connection.sendRequest("resources/list", {});
			if (
				resourcesResult &&
				typeof resourcesResult === "object" &&
				"resources" in resourcesResult
			) {
				const resources = (resourcesResult as { resources: unknown[] }).resources;
				if (Array.isArray(resources)) {
					for (const resource of resources) {
						if (this.isValidResource(resource)) {
							const mcpResource: MCPResource = {
								uri: resource.uri,
								name: resource.name,
								description: resource.description,
								mimeType: resource.mimeType,
								serverName,
							};
							this.resources.set(mcpResource.uri, mcpResource);
						}
					}
				}
			}
		} catch {
			// Server might not support resources
		}

		try {
			// Discover prompts
			const promptsResult = await connection.sendRequest("prompts/list", {});
			if (promptsResult && typeof promptsResult === "object" && "prompts" in promptsResult) {
				const prompts = (promptsResult as { prompts: unknown[] }).prompts;
				if (Array.isArray(prompts)) {
					for (const prompt of prompts) {
						if (this.isValidPrompt(prompt)) {
							const mcpPrompt: MCPPrompt = {
								name: prompt.name,
								description: prompt.description,
								arguments: prompt.arguments,
								serverName,
							};
							this.prompts.set(mcpPrompt.name, mcpPrompt);
						}
					}
				}
			}
		} catch {
			// Server might not support prompts
		}
	}

	private isValidTool(
		tool: unknown,
	): tool is { name: string; description?: string; inputSchema: MCPTool["inputSchema"] } {
		return (
			typeof tool === "object" &&
			tool !== null &&
			"name" in tool &&
			typeof (tool as { name: unknown }).name === "string"
		);
	}

	private isValidResource(
		resource: unknown,
	): resource is { uri: string; name: string; description?: string; mimeType?: string } {
		return (
			typeof resource === "object" &&
			resource !== null &&
			"uri" in resource &&
			"name" in resource &&
			typeof (resource as { uri: unknown }).uri === "string" &&
			typeof (resource as { name: unknown }).name === "string"
		);
	}

	private isValidPrompt(
		prompt: unknown,
	): prompt is { name: string; description?: string; arguments?: MCPPrompt["arguments"] } {
		return (
			typeof prompt === "object" &&
			prompt !== null &&
			"name" in prompt &&
			typeof (prompt as { name: unknown }).name === "string"
		);
	}

	/**
	 * Get all available tools
	 */
	getTools(): MCPTool[] {
		return Array.from(this.tools.values());
	}

	/**
	 * Get a specific tool by name
	 */
	getTool(name: string): MCPTool | undefined {
		return this.tools.get(name);
	}

	/**
	 * Get all available resources
	 */
	getResources(): MCPResource[] {
		return Array.from(this.resources.values());
	}

	/**
	 * Get a specific resource by URI
	 */
	getResource(uri: string): MCPResource | undefined {
		return this.resources.get(uri);
	}

	/**
	 * Get all available prompts
	 */
	getPrompts(): MCPPrompt[] {
		return Array.from(this.prompts.values());
	}

	/**
	 * Get a specific prompt by name
	 */
	getPrompt(name: string): MCPPrompt | undefined {
		return this.prompts.get(name);
	}

	/**
	 * Fetch a prompt with arguments from an MCP server
	 */
	async fetchPrompt(name: string, args?: Record<string, string>): Promise<unknown> {
		const prompt = this.prompts.get(name);
		if (!prompt) {
			throw new Error(`Prompt '${name}' not found`);
		}

		const connection = this.servers.get(prompt.serverName);
		if (!connection) {
			throw new Error(`Server '${prompt.serverName}' not connected`);
		}

		return connection.sendRequest("prompts/get", {
			name,
			arguments: args,
		});
	}

	/**
	 * Call a tool on an MCP server
	 */
	async callTool(toolName: string, args: Record<string, unknown>): Promise<MCPToolCallResult> {
		// Find the tool
		const tool = this.tools.get(toolName);
		if (!tool) {
			throw new Error(`Tool '${toolName}' not found`);
		}

		// Get the server connection
		const connection = this.servers.get(tool.serverName);
		if (!connection) {
			throw new Error(`Server '${tool.serverName}' not connected`);
		}

		this.stats.toolCalls++;

		try {
			// Extract the original tool name (without server prefix)
			const originalName = toolName.includes("_")
				? toolName.substring(toolName.indexOf("_") + 1)
				: toolName;

			const result = await connection.sendRequest("tools/call", {
				name: originalName,
				arguments: args,
			});

			this.stats.successfulCalls++;
			this.saveConfig();

			if (result && typeof result === "object" && "content" in result) {
				return result as MCPToolCallResult;
			}

			return {
				content: [{ type: "text", text: JSON.stringify(result) }],
			};
		} catch (error) {
			this.stats.failedCalls++;
			this.saveConfig();
			throw error;
		}
	}

	/**
	 * Read a resource from an MCP server
	 */
	async readResource(uri: string): Promise<MCPResourceContent[]> {
		const resource = this.resources.get(uri);
		if (!resource) {
			throw new Error(`Resource '${uri}' not found`);
		}

		const connection = this.servers.get(resource.serverName);
		if (!connection) {
			throw new Error(`Server '${resource.serverName}' not connected`);
		}

		const result = await connection.sendRequest("resources/read", { uri });

		if (result && typeof result === "object" && "contents" in result) {
			return (result as { contents: MCPResourceContent[] }).contents;
		}

		throw new Error("Invalid resource response");
	}

	/**
	 * Enable a server
	 */
	enableServer(name: string): boolean {
		const config = this.config.servers.find((s) => s.name === name);
		if (config) {
			config.disabled = false;
			this.saveConfig();
			return true;
		}
		return false;
	}

	/**
	 * Disable a server
	 */
	disableServer(name: string): boolean {
		const config = this.config.servers.find((s) => s.name === name);
		if (config) {
			config.disabled = true;
			this.saveConfig();
			return true;
		}
		return false;
	}

	/**
	 * Get server status
	 */
	getServerStatus(name: string): MCPServerStatus | undefined {
		const config = this.config.servers.find((s) => s.name === name);
		if (!config) return undefined;

		const connection = this.servers.get(name);
		return {
			name,
			connected: !!connection,
			toolsCount: Array.from(this.tools.values()).filter((t) => t.serverName === name).length,
			resourcesCount: Array.from(this.resources.values()).filter((r) => r.serverName === name)
				.length,
			promptsCount: Array.from(this.prompts.values()).filter((p) => p.serverName === name).length,
			restartCount: connection?.restartCount || 0,
		};
	}

	/**
	 * Get client statistics
	 */
	getStats(): MCPClientStats {
		const serverStatuses = this.config.servers
			.map((s) => this.getServerStatus(s.name))
			.filter(Boolean) as MCPServerStatus[];

		return {
			totalServers: this.config.servers.length,
			connectedServers: this.servers.size,
			totalTools: this.tools.size,
			totalResources: this.resources.size,
			totalPrompts: this.prompts.size,
			toolCalls: this.stats.toolCalls,
			successfulCalls: this.stats.successfulCalls,
			failedCalls: this.stats.failedCalls,
			serverStatuses,
		};
	}

	/**
	 * Get sample MCP servers
	 */
	getSampleServers(): MCPServerConfig[] {
		return [...SAMPLE_MCP_SERVERS];
	}

	/**
	 * Reset client statistics
	 */
	resetStats(): void {
		this.stats = {
			toolCalls: 0,
			successfulCalls: 0,
			failedCalls: 0,
		};
		this.saveConfig();
	}

	/**
	 * Get configuration
	 */
	getConfig(): MCPClientConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration
	 */
	updateConfig(updates: Partial<MCPClientConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveConfig();
	}

	/**
	 * Close all connections and cleanup
	 */
	async close(): Promise<void> {
		await this.disconnectAll();
		this.removeAllListeners();
	}
}

/**
 * Abstract base class for MCP server connections
 */
abstract class MCPServerConnection {
	protected config: MCPServerConfig;
	protected timeout: number;
	protected initialized = false;
	restartCount = 0;

	constructor(config: MCPServerConfig, timeout: number) {
		this.config = config;
		this.timeout = timeout;
	}

	abstract initialize(): Promise<void>;
	abstract sendRequest(method: string, params?: unknown): Promise<unknown>;
	abstract close(): Promise<void>;

	protected generateRequestId(): number {
		return Date.now() + Math.floor(Math.random() * 1000);
	}
}

/**
 * Stdio-based MCP server connection
 */
class StdioMCPServerConnection extends MCPServerConnection {
	private process: childProcess.ChildProcess | null = null;
	private pendingRequests = new Map<
		number,
		{ resolve: (value: unknown) => void; reject: (error: Error) => void }
	>();
	private buffer = "";
	private requestTimeout = 60000;

	async initialize(): Promise<void> {
		if (!this.config.command) {
			throw new Error("No command specified for stdio transport");
		}

		this.process = childProcess.spawn(this.config.command, this.config.args || [], {
			env: { ...process.env, ...this.config.env },
			stdio: ["pipe", "pipe", "pipe"],
		});

		if (!this.process.stdout || !this.process.stdin) {
			throw new Error("Failed to create stdio streams");
		}

		this.process.stdout.on("data", (data: Buffer) => {
			this.handleData(data.toString());
		});

		this.process.stderr?.on("data", (data: Buffer) => {
			// Log stderr for debugging
			console.error(`MCP Server [${this.config.name}] stderr:`, data.toString());
		});

		this.process.on("error", (error) => {
			console.error(`MCP Server [${this.config.name}] error:`, error);
		});

		this.process.on("exit", (code) => {
			console.log(`MCP Server [${this.config.name}] exited with code:`, code);
			this.initialized = false;

			// Reject pending requests
			for (const [, { reject }] of this.pendingRequests) {
				reject(new Error("Server process exited"));
			}
			this.pendingRequests.clear();
		});

		// Send initialize request
		await this.sendInitialize();

		this.initialized = true;
	}

	private handleData(data: string): void {
		this.buffer += data;

		// Try to parse complete JSON messages
		const lines = this.buffer.split("\n");
		this.buffer = lines.pop() || "";

		for (const line of lines) {
			if (line.trim()) {
				try {
					const response = JSON.parse(line) as JSONRPCResponse;
					const pending = this.pendingRequests.get(response.id);
					if (pending) {
						this.pendingRequests.delete(response.id);
						if (response.error) {
							pending.reject(new Error(response.error.message));
						} else {
							pending.resolve(response.result);
						}
					}
				} catch {
					// Ignore parse errors for partial data
				}
			}
		}
	}

	private async sendInitialize(): Promise<void> {
		const result = await this.sendRequest("initialize", {
			protocolVersion: "2024-11-05",
			capabilities: {
				tools: {},
				resources: {},
				prompts: {},
			},
			clientInfo: {
				name: "paimon",
				version: "1.0.0",
			},
		});

		// Send initialized notification
		this.sendNotification("notifications/initialized", {});

		return result as undefined;
	}

	private sendNotification(method: string, params: unknown): void {
		if (!this.process?.stdin) return;

		const notification: JSONRPCNotification = {
			jsonrpc: "2.0",
			method,
			params,
		};

		this.process.stdin.write(`${JSON.stringify(notification)}\n`);
	}

	async sendRequest(method: string, params?: unknown): Promise<unknown> {
		return new Promise((resolve, reject) => {
			if (!this.process?.stdin) {
				reject(new Error("Process not running"));
				return;
			}

			const id = this.generateRequestId();
			const request: JSONRPCRequest = {
				jsonrpc: "2.0",
				id,
				method,
				params,
			};

			this.pendingRequests.set(id, { resolve, reject });

			// Set timeout
			setTimeout(() => {
				if (this.pendingRequests.has(id)) {
					this.pendingRequests.delete(id);
					reject(new Error(`Request timeout for ${method}`));
				}
			}, this.requestTimeout);

			this.process.stdin.write(`${JSON.stringify(request)}\n`);
		});
	}

	async close(): Promise<void> {
		if (this.process) {
			this.process.kill();
			this.process = null;
		}
		this.initialized = false;
	}
}

/**
 * SSE-based MCP server connection (placeholder for future implementation)
 */
class SSEMCPServerConnection extends MCPServerConnection {
	async initialize(): Promise<void> {
		// SSE transport implementation would go here
		// This requires eventsource or similar library
		throw new Error("SSE transport not yet implemented");
	}

	async sendRequest(method: string, params?: unknown): Promise<unknown> {
		throw new Error("SSE transport not yet implemented");
	}

	async close(): Promise<void> {
		this.initialized = false;
	}
}

/**
 * HTTP-based MCP server connection (placeholder for future implementation)
 */
class HTTPMCPServerConnection extends MCPServerConnection {
	async initialize(): Promise<void> {
		// HTTP transport implementation would go here
		throw new Error("HTTP transport not yet implemented");
	}

	async sendRequest(method: string, params?: unknown): Promise<unknown> {
		throw new Error("HTTP transport not yet implemented");
	}

	async close(): Promise<void> {
		this.initialized = false;
	}
}

/**
 * Get the global MCP client instance
 */
export function getMCPClient(): MCPClient {
	if (!mcpClientInstance) {
		mcpClientInstance = new MCPClient();
	}
	return mcpClientInstance;
}

/**
 * Initialize the MCP client
 */
export function initMCPClient(config?: Partial<MCPClientConfig>): MCPClient {
	mcpClientInstance = new MCPClient();
	if (config) {
		mcpClientInstance.updateConfig(config);
	}
	return mcpClientInstance;
}

/**
 * Reset the MCP client instance
 */
export function resetMCPClient(): void {
	if (mcpClientInstance) {
		mcpClientInstance.close();
	}
	mcpClientInstance = null;
}
