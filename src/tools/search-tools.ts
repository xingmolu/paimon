/**
 * Search tools: glob, grep, find, ls
 */

import { execSync } from "node:child_process";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { globSync } from "glob";
import { truncateToolOutput } from "../truncate.js";

/**
 * Glob tool - Find files matching patterns
 */
export const globTool: AgentTool = {
	name: "glob",
	label: "Find Files",
	description: "Find files matching a glob pattern",
	parameters: Type.Object({
		pattern: Type.String({ description: "Glob pattern" }),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<string[]>> => {
		const { pattern } = params as { pattern: string };
		try {
			const files = globSync(pattern);
			const result = files.length > 0 ? files.join("\n") : "(no matches)";
			return {
				content: [{ type: "text", text: truncateToolOutput(result, "glob") }],
				details: files,
			};
		} catch (e) {
			const error = e instanceof Error ? e.message : String(e);
			return {
				content: [{ type: "text", text: `Error: ${error}` }],
				details: [],
			};
		}
	},
};

/**
 * Grep tool - Search file contents with regex
 */
export const grepTool: AgentTool = {
	name: "grep",
	label: "Search File Contents",
	description: "Search for patterns in file contents using regex",
	parameters: Type.Object({
		pattern: Type.String({ description: "Regex pattern to search" }),
		path: Type.Optional(Type.String({ description: "Directory or file to search (default: .)" })),
		include: Type.Optional(Type.String({ description: "File pattern to include (e.g., *.ts)" })),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
		const {
			pattern,
			path = ".",
			include,
		} = params as {
			pattern: string;
			path?: string;
			include?: string;
		};
		try {
			// Use grep with -n for line numbers, -r for recursive
			let cmd = "grep -rn";
			if (include) {
				cmd += ` --include="${include}"`;
			}
			cmd += ` "${pattern}" ${path}`;

			const output = execSync(cmd, {
				encoding: "utf-8",
				timeout: 30000,
				maxBuffer: 1024 * 1024,
			});
			const text = truncateToolOutput(output || "(no matches)", `grep: ${pattern}`);
			return {
				content: [{ type: "text", text }],
				details: text,
			};
		} catch (e) {
			// grep returns exit code 1 when no matches, which throws
			const error = e instanceof Error ? e.message : String(e);
			if (error.includes("status 1")) {
				return {
					content: [{ type: "text", text: "(no matches)" }],
					details: "(no matches)",
				};
			}
			return {
				content: [{ type: "text", text: `Error: ${error}` }],
				details: `Error: ${error}`,
			};
		}
	},
};

/**
 * Find tool - Find files by criteria
 */
export const findTool: AgentTool = {
	name: "find",
	label: "Find Files by Criteria",
	description: "Find files by name, type, or modification time",
	parameters: Type.Object({
		path: Type.Optional(Type.String({ description: "Directory to search (default: .)" })),
		name: Type.Optional(Type.String({ description: "File name pattern (e.g., *.ts)" })),
		type: Type.Optional(Type.String({ description: "File type: f (file), d (directory)" })),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<string[]>> => {
		const {
			path = ".",
			name,
			type,
		} = params as {
			path?: string;
			name?: string;
			type?: string;
		};
		try {
			let cmd = `find ${path}`;
			if (type) {
				cmd += ` -type ${type}`;
			}
			if (name) {
				cmd += ` -name "${name}"`;
			}

			const output = execSync(cmd, {
				encoding: "utf-8",
				timeout: 30000,
				maxBuffer: 1024 * 1024,
			});
			const files = output.trim().split("\n").filter(Boolean);
			const result = files.length > 0 ? files.join("\n") : "(no matches)";
			return {
				content: [{ type: "text", text: result }],
				details: files,
			};
		} catch (e) {
			const error = e instanceof Error ? e.message : String(e);
			return {
				content: [{ type: "text", text: `Error: ${error}` }],
				details: [],
			};
		}
	},
};

/**
 * Ls tool - List directory contents
 */
export const lsTool: AgentTool = {
	name: "ls",
	label: "List Directory",
	description: "List directory contents with details",
	parameters: Type.Object({
		path: Type.Optional(Type.String({ description: "Directory to list (default: .)" })),
		long: Type.Optional(Type.Boolean({ description: "Show detailed info (size, date)" })),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<string[]>> => {
		const { path = ".", long = false } = params as {
			path?: string;
			long?: boolean;
		};
		try {
			const cmd = long ? `ls -la ${path}` : `ls -a ${path}`;
			const output = execSync(cmd, {
				encoding: "utf-8",
				timeout: 10000,
			});
			const lines = output.trim().split("\n");
			return {
				content: [{ type: "text", text: output.trim() }],
				details: lines,
			};
		} catch (e) {
			const error = e instanceof Error ? e.message : String(e);
			return {
				content: [{ type: "text", text: `Error: ${error}` }],
				details: [],
			};
		}
	},
};

/** All search tools */
export const searchTools: AgentTool[] = [globTool, grepTool, findTool, lsTool];
