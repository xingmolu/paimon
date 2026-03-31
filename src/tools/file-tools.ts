/**
 * File operation tools: bash, read, write, edit
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { truncateToolOutput } from "../truncate.js";

/**
 * Bash tool - Execute shell commands
 */
export const bashTool: AgentTool = {
	name: "bash",
	label: "Execute Shell Command",
	description: "Execute a shell command",
	parameters: Type.Object({
		command: Type.String({ description: "The shell command to execute" }),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
		const { command } = params as { command: string };
		try {
			const output = execSync(command, {
				encoding: "utf-8",
				timeout: 120000,
				maxBuffer: 10 * 1024 * 1024,
			});
			const text = truncateToolOutput(output || "(empty)", `bash: ${command}`);
			return {
				content: [{ type: "text", text }],
				details: text,
			};
		} catch (e) {
			const error = e instanceof Error ? e.message : String(e);
			return {
				content: [{ type: "text", text: `Error: ${error}` }],
				details: `Error: ${error}`,
			};
		}
	},
};

/**
 * Read tool - Read file contents
 */
export const readTool: AgentTool = {
	name: "read",
	label: "Read File",
	description: "Read a file from the filesystem",
	parameters: Type.Object({
		path: Type.String({ description: "The file path" }),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
		const { path } = params as { path: string };
		try {
			if (!existsSync(path)) {
				return {
					content: [{ type: "text", text: "Error: File not found" }],
					details: "Error: File not found",
				};
			}
			const content = readFileSync(path, "utf-8");
			const numbered = content
				.split("\n")
				.map((l, i) => `${i + 1}: ${l}`)
				.join("\n");
			return {
				content: [{ type: "text", text: truncateToolOutput(numbered, path) }],
				details: truncateToolOutput(numbered, path),
			};
		} catch (e) {
			const error = e instanceof Error ? e.message : String(e);
			return {
				content: [{ type: "text", text: `Error: ${error}` }],
				details: `Error: ${error}`,
			};
		}
	},
};

/**
 * Write tool - Write content to file
 */
export const writeTool: AgentTool = {
	name: "write",
	label: "Write File",
	description: "Write content to a file",
	parameters: Type.Object({
		path: Type.String({ description: "The file path" }),
		content: Type.String({ description: "Content to write" }),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
		const { path, content } = params as { path: string; content: string };
		try {
			writeFileSync(path, content, "utf-8");
			return {
				content: [{ type: "text", text: "File written successfully" }],
				details: "File written successfully",
			};
		} catch (e) {
			const error = e instanceof Error ? e.message : String(e);
			return {
				content: [{ type: "text", text: `Error: ${error}` }],
				details: `Error: ${error}`,
			};
		}
	},
};

/**
 * Edit tool - Replace text in file
 */
export const editTool: AgentTool = {
	name: "edit",
	label: "Edit File",
	description: "Edit a file by replacing text",
	parameters: Type.Object({
		path: Type.String(),
		oldText: Type.String(),
		newText: Type.String(),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
		const { path, oldText, newText } = params as {
			path: string;
			oldText: string;
			newText: string;
		};
		try {
			if (!existsSync(path)) {
				return {
					content: [{ type: "text", text: "Error: File not found" }],
					details: "Error: File not found",
				};
			}
			const content = readFileSync(path, "utf-8");
			if (!content.includes(oldText)) {
				return {
					content: [{ type: "text", text: "Error: Text not found in file" }],
					details: "Error: Text not found in file",
				};
			}
			writeFileSync(path, content.replace(oldText, newText), "utf-8");
			return {
				content: [{ type: "text", text: "Edit applied successfully" }],
				details: "Edit applied successfully",
			};
		} catch (e) {
			const error = e instanceof Error ? e.message : String(e);
			return {
				content: [{ type: "text", text: `Error: ${error}` }],
				details: `Error: ${error}`,
			};
		}
	},
};

/** All file operation tools */
export const fileTools: AgentTool[] = [bashTool, readTool, writeTool, editTool];
