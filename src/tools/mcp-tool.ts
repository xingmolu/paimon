/**
 * MCP (Model Context Protocol) Tool
 *
 * Tool for managing MCP server connections and calling external tools.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { MCPClient, getMCPClient, initMCPClient } from "../mcp-client.js";
import type {
	MCPClientStats,
	MCPPrompt,
	MCPResource,
	MCPServerConfig,
	MCPTool as MCPToolType,
} from "../mcp-client.js";

interface MCPToolArgs {
	action: string;
	name?: string;
	command?: string;
	args?: string[];
	url?: string;
	transport?: "stdio" | "sse" | "http";
	env?: Record<string, string>;
	toolName?: string;
	arguments?: Record<string, unknown>;
	uri?: string;
	promptName?: string;
	promptArgs?: Record<string, string>;
	disabled?: boolean;
	autoStart?: boolean;
	limit?: number;
}

const HELP_TEXT = `
MCP (Model Context Protocol) Tool - Connect to external tools and data sources

Actions:
  add              Add a new MCP server configuration
                   Required: name, transport
                   Optional: command, args, url, env, disabled, autoStart
                   
  get              Get a specific server configuration
                   Required: name
                   
  list             List all configured servers
                   
  remove           Remove a server configuration
                   Required: name
                   
  enable           Enable a disabled server
                   Required: name
                   
  disable          Disable a server (prevents auto-connection)
                   Required: name
                   
  connect          Connect to a specific server
                   Required: name
                   
  disconnect       Disconnect from a specific server
                   Required: name
                   
  connect-all      Connect to all enabled servers
                   
  disconnect-all   Disconnect from all servers
                   
  tools            List all available tools from connected servers
                   Optional: limit
                   
  tool             Get details of a specific tool
                   Required: toolName
                   
  call-tool        Call a tool on an MCP server
                   Required: toolName, arguments
                   
  resources        List all available resources from connected servers
                   Optional: limit
                   
  resource         Get details of a specific resource
                   Required: uri
                   
  read-resource    Read content from a resource
                   Required: uri
                   
  prompts          List all available prompts from connected servers
                   Optional: limit
                   
  prompt           Get details of a specific prompt
                   Required: promptName
                   
  get-prompt       Get a prompt with arguments
                   Required: promptName
                   Optional: promptArgs
                   
  status           Get server connection status
                   Required: name
                   
  stats            Get client statistics
                   
  samples          List sample MCP server configurations
                   
  reset            Reset client statistics
                   
  config           View or update configuration
                   
  help             Show this help message

Examples:
  # Add a filesystem MCP server
  mcp({action: 'add', name: 'filesystem', transport: 'stdio', command: 'mcp-server-filesystem', args: ['--root', '/path/to/project']})
  
  # Connect to a server
  mcp({action: 'connect', name: 'filesystem'})
  
  # List available tools
  mcp({action: 'tools'})
  
  # Call a tool
  mcp({action: 'call-tool', toolName: 'filesystem_read_file', arguments: {path: 'README.md'}})
  
  # Read a resource
  mcp({action: 'read-resource', uri: 'file:///path/to/file.txt'})
  
  # Get statistics
  mcp({action: 'stats'})
  
Transport Types:
  - stdio: Launch a local process and communicate via stdin/stdout
  - sse: Connect via Server-Sent Events (HTTP)
  - http: Connect via HTTP POST requests
`;

function formatServerConfig(config: MCPServerConfig): string {
	const lines = [`**${config.name}**`, `  Transport: ${config.transport}`];
	if (config.command) {
		lines.push(`  Command: ${config.command}${config.args ? ` ${config.args.join(" ")}` : ""}`);
	}
	if (config.url) {
		lines.push(`  URL: ${config.url}`);
	}
	if (config.disabled) {
		lines.push("  Status: Disabled");
	}
	if (config.autoStart === false) {
		lines.push("  Auto-start: No");
	}
	return lines.join("\n");
}

function formatTool(tool: MCPToolType): string {
	const lines = [
		`**${tool.name}**`,
		`  Server: ${tool.serverName}`,
		`  Description: ${tool.description || "No description"}`,
	];
	if (tool.inputSchema.properties) {
		const props = Object.keys(tool.inputSchema.properties);
		if (props.length > 0) {
			lines.push(`  Parameters: ${props.join(", ")}`);
		}
	}
	if (tool.inputSchema.required && tool.inputSchema.required.length > 0) {
		lines.push(`  Required: ${tool.inputSchema.required.join(", ")}`);
	}
	return lines.join("\n");
}

function formatResource(resource: MCPResource): string {
	const lines = [
		`**${resource.name}**`,
		`  URI: ${resource.uri}`,
		`  Server: ${resource.serverName}`,
	];
	if (resource.description) {
		lines.push(`  Description: ${resource.description}`);
	}
	if (resource.mimeType) {
		lines.push(`  MIME Type: ${resource.mimeType}`);
	}
	return lines.join("\n");
}

function formatPrompt(prompt: MCPPrompt): string {
	const lines = [`**${prompt.name}**`, `  Server: ${prompt.serverName}`];
	if (prompt.description) {
		lines.push(`  Description: ${prompt.description}`);
	}
	if (prompt.arguments && prompt.arguments.length > 0) {
		lines.push(
			`  Arguments: ${prompt.arguments.map((a) => a.name + (a.required ? "*" : "")).join(", ")}`,
		);
	}
	return lines.join("\n");
}

function formatStats(stats: MCPClientStats): string {
	const lines = [
		"# MCP Client Statistics",
		"",
		"## Overview",
		"| Metric | Value |",
		"|--------|-------|",
		`| Total Servers | ${stats.totalServers} |`,
		`| Connected Servers | ${stats.connectedServers} |`,
		`| Total Tools | ${stats.totalTools} |`,
		`| Total Resources | ${stats.totalResources} |`,
		`| Total Prompts | ${stats.totalPrompts} |`,
		"",
		"## Tool Calls",
		"| Metric | Value |",
		"|--------|-------|",
		`| Total Calls | ${stats.toolCalls} |`,
		`| Successful | ${stats.successfulCalls} |`,
		`| Failed | ${stats.failedCalls} |`,
		`| Success Rate | ${stats.toolCalls > 0 ? Math.round((stats.successfulCalls / stats.toolCalls) * 100) : 0}% |`,
	];

	if (stats.serverStatuses.length > 0) {
		lines.push("");
		lines.push("## Server Status");
		lines.push("| Server | Connected | Tools | Resources | Prompts | Restarts |");
		lines.push("|--------|-----------|-------|-----------|---------|----------|");
		for (const status of stats.serverStatuses) {
			lines.push(
				`| ${status.name} | ${status.connected ? "✅" : "❌"} | ${status.toolsCount} | ${status.resourcesCount} | ${status.promptsCount} | ${status.restartCount} |`,
			);
		}
	}

	return lines.join("\n");
}

async function handleMCPToolCall(args: MCPToolArgs): Promise<string> {
	const client = getMCPClient();

	switch (args.action) {
		case "add": {
			if (!args.name) {
				return "Error: 'name' is required for add action";
			}
			if (!args.transport) {
				return "Error: 'transport' is required for add action";
			}

			const config: MCPServerConfig = {
				name: args.name,
				transport: args.transport,
				command: args.command,
				args: args.args,
				url: args.url,
				env: args.env,
				disabled: args.disabled,
				autoStart: args.autoStart,
			};

			client.addServer(config);
			return `Added MCP server '${args.name}'\n\n${formatServerConfig(config)}`;
		}

		case "get": {
			if (!args.name) {
				return "Error: 'name' is required for get action";
			}

			const servers = client.getServers();
			const server = servers.find((s) => s.name === args.name);
			if (!server) {
				return `Server '${args.name}' not found`;
			}
			return formatServerConfig(server);
		}

		case "list": {
			const servers = client.getServers();
			if (servers.length === 0) {
				return "No MCP servers configured. Use 'samples' action to see available servers.";
			}

			const lines = ["# Configured MCP Servers", ""];
			for (const server of servers) {
				lines.push(formatServerConfig(server));
				lines.push("");
			}
			return lines.join("\n");
		}

		case "remove": {
			if (!args.name) {
				return "Error: 'name' is required for remove action";
			}

			const removed = client.removeServer(args.name);
			if (removed) {
				return `Removed MCP server '${args.name}'`;
			}
			return `Server '${args.name}' not found`;
		}

		case "enable": {
			if (!args.name) {
				return "Error: 'name' is required for enable action";
			}

			const enabled = client.enableServer(args.name);
			if (enabled) {
				return `Enabled MCP server '${args.name}'`;
			}
			return `Server '${args.name}' not found`;
		}

		case "disable": {
			if (!args.name) {
				return "Error: 'name' is required for disable action";
			}

			const disabled = client.disableServer(args.name);
			if (disabled) {
				return `Disabled MCP server '${args.name}'`;
			}
			return `Server '${args.name}' not found`;
		}

		case "connect": {
			if (!args.name) {
				return "Error: 'name' is required for connect action";
			}

			try {
				await client.connectServer(args.name);
				const status = client.getServerStatus(args.name);
				return `Connected to MCP server '${args.name}'\n\nTools: ${status?.toolsCount || 0}\nResources: ${status?.resourcesCount || 0}\nPrompts: ${status?.promptsCount || 0}`;
			} catch (error) {
				return `Failed to connect to '${args.name}': ${error instanceof Error ? error.message : String(error)}`;
			}
		}

		case "disconnect": {
			if (!args.name) {
				return "Error: 'name' is required for disconnect action";
			}

			await client.disconnectServer(args.name);
			return `Disconnected from MCP server '${args.name}'`;
		}

		case "connect-all": {
			const results = await client.connectAll();
			const lines = ["# MCP Server Connection Results", ""];

			for (const [name, error] of results) {
				if (error) {
					lines.push(`❌ ${name}: ${error.message}`);
				} else {
					lines.push(`✅ ${name}: Connected`);
				}
			}

			return lines.join("\n");
		}

		case "disconnect-all": {
			await client.disconnectAll();
			return "Disconnected from all MCP servers";
		}

		case "tools": {
			const tools = client.getTools();
			if (tools.length === 0) {
				return "No tools available. Connect to MCP servers first.";
			}

			const limit = args.limit || 20;
			const displayTools = tools.slice(0, limit);

			const lines = [`# Available MCP Tools (${tools.length} total)`, ""];
			for (const tool of displayTools) {
				lines.push(formatTool(tool));
				lines.push("");
			}

			if (tools.length > limit) {
				lines.push(`... and ${tools.length - limit} more tools`);
			}

			return lines.join("\n");
		}

		case "tool": {
			if (!args.toolName) {
				return "Error: 'toolName' is required for tool action";
			}

			const tool = client.getTool(args.toolName);
			if (!tool) {
				return `Tool '${args.toolName}' not found`;
			}

			const lines = ["# Tool Details", "", formatTool(tool)];
			lines.push("");
			lines.push("## Input Schema");
			lines.push("```json");
			lines.push(JSON.stringify(tool.inputSchema, null, 2));
			lines.push("```");

			return lines.join("\n");
		}

		case "call-tool": {
			if (!args.toolName) {
				return "Error: 'toolName' is required for call-tool action";
			}

			try {
				const result = await client.callTool(args.toolName, args.arguments || {});

				const lines = [`# Tool Call Result: ${args.toolName}`, ""];

				for (const content of result.content) {
					if (content.type === "text") {
						lines.push(content.text || "");
					} else if (content.type === "image") {
						lines.push(`[Image: ${content.mimeType || "unknown"}]`);
					} else if (content.type === "resource") {
						lines.push(`[Resource: ${content.text || "unknown"}]`);
					}
				}

				if (result.isError) {
					lines.unshift("⚠️ **Error Response**");
				}

				return lines.join("\n");
			} catch (error) {
				return `Tool call failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		}

		case "resources": {
			const resources = client.getResources();
			if (resources.length === 0) {
				return "No resources available. Connect to MCP servers first.";
			}

			const limit = args.limit || 20;
			const displayResources = resources.slice(0, limit);

			const lines = [`# Available MCP Resources (${resources.length} total)`, ""];
			for (const resource of displayResources) {
				lines.push(formatResource(resource));
				lines.push("");
			}

			if (resources.length > limit) {
				lines.push(`... and ${resources.length - limit} more resources`);
			}

			return lines.join("\n");
		}

		case "resource": {
			if (!args.uri) {
				return "Error: 'uri' is required for resource action";
			}

			const resource = client.getResource(args.uri);
			if (!resource) {
				return `Resource '${args.uri}' not found`;
			}

			return `# Resource Details\n\n${formatResource(resource)}`;
		}

		case "read-resource": {
			if (!args.uri) {
				return "Error: 'uri' is required for read-resource action";
			}

			try {
				const contents = await client.readResource(args.uri);

				const lines = [`# Resource Content: ${args.uri}`, ""];

				for (const content of contents) {
					if (content.text) {
						lines.push(content.text);
					} else if (content.blob) {
						lines.push(
							`[Binary data: ${content.mimeType || "unknown"}, ${content.blob.length} bytes base64]`,
						);
					}
				}

				return lines.join("\n");
			} catch (error) {
				return `Failed to read resource: ${error instanceof Error ? error.message : String(error)}`;
			}
		}

		case "prompts": {
			const prompts = client.getPrompts();
			if (prompts.length === 0) {
				return "No prompts available. Connect to MCP servers first.";
			}

			const limit = args.limit || 20;
			const displayPrompts = prompts.slice(0, limit);

			const lines = [`# Available MCP Prompts (${prompts.length} total)`, ""];
			for (const prompt of displayPrompts) {
				lines.push(formatPrompt(prompt));
				lines.push("");
			}

			if (prompts.length > limit) {
				lines.push(`... and ${prompts.length - limit} more prompts`);
			}

			return lines.join("\n");
		}

		case "prompt": {
			if (!args.promptName) {
				return "Error: 'promptName' is required for prompt action";
			}

			const prompt = client.getPrompt(args.promptName);
			if (!prompt) {
				return `Prompt '${args.promptName}' not found`;
			}

			return `# Prompt Details\n\n${formatPrompt(prompt)}`;
		}

		case "get-prompt": {
			if (!args.promptName) {
				return "Error: 'promptName' is required for get-prompt action";
			}

			try {
				const result = await client.fetchPrompt(args.promptName, args.promptArgs);
				return `# Prompt: ${args.promptName}\n\n\`\`\`\n${JSON.stringify(result, null, 2)}\n\`\`\``;
			} catch (error) {
				return `Failed to get prompt: ${error instanceof Error ? error.message : String(error)}`;
			}
		}

		case "status": {
			if (!args.name) {
				return "Error: 'name' is required for status action";
			}

			const status = client.getServerStatus(args.name);
			if (!status) {
				return `Server '${args.name}' not found`;
			}

			const lines = [
				`# Server Status: ${status.name}`,
				"",
				"| Metric | Value |",
				"|--------|-------|",
				`| Connected | ${status.connected ? "✅" : "❌"} |`,
				`| Tools | ${status.toolsCount} |`,
				`| Resources | ${status.resourcesCount} |`,
				`| Prompts | ${status.promptsCount} |`,
				`| Restarts | ${status.restartCount} |`,
			];

			return lines.join("\n");
		}

		case "stats": {
			return formatStats(client.getStats());
		}

		case "samples": {
			const samples = client.getSampleServers();
			const lines = [
				"# Sample MCP Server Configurations",
				"",
				"These are example MCP servers you can add:",
				"",
			];

			for (const sample of samples) {
				lines.push(formatServerConfig(sample));
				lines.push("");
			}

			lines.push("## Usage Example");
			lines.push("```");
			lines.push(
				`mcp({action: 'add', name: 'filesystem', transport: 'stdio', command: 'mcp-server-filesystem', args: ['--root', '/path/to/project']})`,
			);
			lines.push("```");

			return lines.join("\n");
		}

		case "reset": {
			client.resetStats();
			return "MCP client statistics reset";
		}

		case "config": {
			const config = client.getConfig();
			return `# MCP Client Configuration\n\n\`\`\`json\n${JSON.stringify(config, null, 2)}\n\`\`\``;
		}

		case "help": {
			return HELP_TEXT;
		}

		default:
			return `Unknown action: ${args.action}\n\nUse 'help' action to see available actions.`;
	}
}

export const mcpTool: AgentTool = {
	name: "mcp",
	label: "MCP Client",
	description:
		"Manage MCP (Model Context Protocol) connections - connect to external tools and data sources via standardized protocol. Actions: add, list, connect, disconnect, tools, call-tool, resources, read-resource, prompts, stats, samples, help",
	parameters: Type.Object({
		action: Type.Union([
			Type.Literal("add"),
			Type.Literal("get"),
			Type.Literal("list"),
			Type.Literal("remove"),
			Type.Literal("enable"),
			Type.Literal("disable"),
			Type.Literal("connect"),
			Type.Literal("disconnect"),
			Type.Literal("connect-all"),
			Type.Literal("disconnect-all"),
			Type.Literal("tools"),
			Type.Literal("tool"),
			Type.Literal("call-tool"),
			Type.Literal("resources"),
			Type.Literal("resource"),
			Type.Literal("read-resource"),
			Type.Literal("prompts"),
			Type.Literal("prompt"),
			Type.Literal("get-prompt"),
			Type.Literal("status"),
			Type.Literal("stats"),
			Type.Literal("samples"),
			Type.Literal("reset"),
			Type.Literal("config"),
			Type.Literal("help"),
		]),
		name: Type.Optional(
			Type.String({
				description:
					"Server name for add/get/remove/enable/disable/connect/disconnect/status actions",
			}),
		),
		transport: Type.Optional(
			Type.Union([Type.Literal("stdio"), Type.Literal("sse"), Type.Literal("http")], {
				description: "Transport type for add action",
			}),
		),
		command: Type.Optional(Type.String({ description: "Command to execute for stdio transport" })),
		args: Type.Optional(Type.Array(Type.String(), { description: "Arguments for the command" })),
		url: Type.Optional(Type.String({ description: "URL for SSE or HTTP transport" })),
		env: Type.Optional(
			Type.Record(Type.String(), Type.String(), {
				description: "Environment variables for the server process",
			}),
		),
		toolName: Type.Optional(Type.String({ description: "Tool name for tool/call-tool actions" })),
		arguments: Type.Optional(
			Type.Record(Type.String(), Type.Any(), { description: "Arguments for call-tool action" }),
		),
		uri: Type.Optional(
			Type.String({ description: "Resource URI for resource/read-resource actions" }),
		),
		promptName: Type.Optional(
			Type.String({ description: "Prompt name for prompt/get-prompt actions" }),
		),
		promptArgs: Type.Optional(
			Type.Record(Type.String(), Type.String(), { description: "Arguments for get-prompt action" }),
		),
		disabled: Type.Optional(Type.Boolean({ description: "Whether the server is disabled" })),
		autoStart: Type.Optional(
			Type.Boolean({ description: "Whether to auto-start the server on connect-all" }),
		),
		limit: Type.Optional(Type.Number({ description: "Maximum number of items to list" })),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const typedArgs = params as MCPToolArgs;
		if (!typedArgs?.action) {
			return {
				content: [{ type: "text", text: "Error: 'action' parameter is required" }],
				details: {},
			};
		}
		const result = await handleMCPToolCall(typedArgs);
		return {
			content: [{ type: "text", text: result }],
			details: {},
		};
	},
};

export { MCPClient };
export type { MCPServerConfig, MCPToolType, MCPResource, MCPPrompt, MCPClientStats };
