/**
 * HTTP tool - Make HTTP requests
 */

import http from "node:http";
import https from "node:https";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";

/**
 * HTTP tool - Make HTTP requests to fetch web content or call APIs
 */
export const httpTool: AgentTool = {
	name: "http",
	label: "HTTP Request",
	description: "Make HTTP requests to fetch web content or call APIs",
	parameters: Type.Object({
		url: Type.String({ description: "The URL to request" }),
		method: Type.Optional(
			Type.String({ description: "HTTP method (GET, POST, etc). Default: GET" }),
		),
		headers: Type.Optional(
			Type.Record(Type.String(), Type.String(), {
				description: "HTTP headers as key-value pairs",
			}),
		),
		body: Type.Optional(Type.String({ description: "Request body (for POST, PUT, PATCH)" })),
		timeout: Type.Optional(Type.Number({ description: "Timeout in milliseconds. Default: 30000" })),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
		const {
			url,
			method = "GET",
			headers = {},
			body,
			timeout = 30000,
		} = params as {
			url: string;
			method?: string;
			headers?: Record<string, string>;
			body?: string;
			timeout?: number;
		};

		return new Promise((resolve) => {
			try {
				const urlObj = new URL(url);
				const isHttps = urlObj.protocol === "https:";
				const client = isHttps ? https : http;

				const options: http.RequestOptions = {
					hostname: urlObj.hostname,
					port: urlObj.port || (isHttps ? 443 : 80),
					path: urlObj.pathname + urlObj.search,
					method: method.toUpperCase(),
					headers: {
						"User-Agent": "Paimon-Agent/1.0",
						...headers,
					},
					timeout,
				};

				const req = client.request(options, (res) => {
					let data = "";
					res.on("data", (chunk) => {
						data += chunk;
					});
					res.on("end", () => {
						// Try to parse as JSON for pretty printing
						try {
							const json = JSON.parse(data);
							const result = `Status: ${res.statusCode}\nHeaders: ${JSON.stringify(res.headers, null, 2)}\n\n${JSON.stringify(json, null, 2)}`;
							resolve({
								content: [{ type: "text", text: result }],
								details: result,
							});
						} catch {
							// Not JSON, return as text
							const result = `Status: ${res.statusCode}\nHeaders: ${JSON.stringify(res.headers, null, 2)}\n\n${data}`;
							resolve({
								content: [{ type: "text", text: result }],
								details: result,
							});
						}
					});
				});

				req.on("error", (error) => {
					resolve({
						content: [{ type: "text", text: `Error: ${error.message}` }],
						details: `Error: ${error.message}`,
					});
				});

				req.on("timeout", () => {
					req.destroy();
					resolve({
						content: [{ type: "text", text: `Error: Request timed out after ${timeout}ms` }],
						details: `Error: Request timed out after ${timeout}ms`,
					});
				});

				if (body) {
					req.write(body);
				}
				req.end();
			} catch (e) {
				const error = e instanceof Error ? e.message : String(e);
				resolve({
					content: [{ type: "text", text: `Error: ${error}` }],
					details: `Error: ${error}`,
				});
			}
		});
	},
};
