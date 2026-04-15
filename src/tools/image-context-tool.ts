/**
 * Image Context Tool (Aider Pattern)
 *
 * Tool for managing images and web pages for visual context in code generation.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { imageContextAction } from "../image-context.js";

/**
 * Tool for image context support (Aider images & web pages pattern).
 *
 * Actions:
 * - add: Add image from file path
 * - paste: Add image from base64/clipboard
 * - get: Get image by ID
 * - list: List all images
 * - remove: Remove an image
 * - clear-images: Clear all images
 * - scrape: Scrape web page for documentation
 * - get-page: Get web page by ID
 * - list-pages: List all scraped pages
 * - remove-page: Remove a web page
 * - clear-pages: Clear all web pages
 * - vision-models: List vision-capable models
 * - check-vision: Check if model supports vision
 * - format-images: Format images for context
 * - format-pages: Format web pages for context
 * - data-url: Get image as data URL
 * - stats: View statistics
 * - config: View configuration
 * - enable: Enable image context
 * - disable: Disable image context
 * - clear: Clear all data
 * - reset: Reset statistics
 * - context-size: Get total context size
 * - help: Show help message
 */
export const imageContextTool: AgentTool = {
	name: "imageContext",
	label: "Image Context Support",
	description:
		"Manage images and web pages for visual context in code generation (Aider Pattern). Add screenshots, UI mockups, scrape documentation pages, detect vision-capable models.",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action: add, paste, get, list, remove, clear-images, scrape, get-page, list-pages, remove-page, clear-pages, vision-models, check-vision, format-images, format-pages, data-url, stats, config, enable, disable, clear, reset, context-size, help",
		}),
		path: Type.Optional(
			Type.String({
				description: "Image file path (for add action)",
			}),
		),
		description: Type.Optional(
			Type.String({
				description: "Image description",
			}),
		),
		base64: Type.Optional(
			Type.String({
				description: "Base64 image data (for paste action)",
			}),
		),
		format: Type.Optional(
			Type.String({
				description: "Image format (png, jpg, etc.)",
			}),
		),
		imageId: Type.Optional(
			Type.String({
				description: "Image ID for get/remove/data-url actions",
			}),
		),
		imageIds: Type.Optional(
			Type.Array(Type.String(), {
				description: "Array of image IDs for formatting",
			}),
		),
		url: Type.Optional(
			Type.String({
				description: "URL to scrape (for scrape action)",
			}),
		),
		pageId: Type.Optional(
			Type.String({
				description: "Web page ID for get/remove actions",
			}),
		),
		pageIds: Type.Optional(
			Type.Array(Type.String(), {
				description: "Array of page IDs for formatting",
			}),
		),
		modelId: Type.Optional(
			Type.String({
				description: "Model ID to check for vision support",
			}),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const p = params as {
			action: string;
			path?: string;
			description?: string;
			base64?: string;
			format?: string;
			imageId?: string;
			imageIds?: string[];
			url?: string;
			pageId?: string;
			pageIds?: string[];
			modelId?: string;
		};

		try {
			const result = await imageContextAction(p.action, p);

			// If result is already formatted (non-JSON), return as text
			if (typeof result === "string" && !result.startsWith("{")) {
				return {
					content: [{ type: "text", text: result }],
					details: {},
				};
			}

			// Parse JSON results
			try {
				const parsed = JSON.parse(result);
				return {
					content: [{ type: "text", text: JSON.stringify(parsed, null, 2) }],
					details: parsed,
				};
			} catch {
				return {
					content: [{ type: "text", text: result }],
					details: {},
				};
			}
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Error: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				details: {},
			};
		}
	},
};
