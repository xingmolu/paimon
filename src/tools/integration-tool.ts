/**
 * Integration Tool (OpenHands Cloud Pattern)
 *
 * Tool for managing external integrations (Slack, Jira, Linear, GitHub, Discord, Webhooks)
 * for notifications and feedback capture during evolution sessions.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { integrationAction } from "../integration-manager.js";

/**
 * Tool for external integrations (OpenHands Cloud pattern).
 *
 * Actions:
 * - add: Add a new integration
 * - get: Get integration by ID
 * - list: List all integrations
 * - update: Update an integration
 * - remove: Remove an integration
 * - enable: Enable an integration
 * - disable: Disable an integration
 * - test: Test an integration
 * - send: Send event to integrations
 * - events: Get event history
 * - clear-events: Clear old events
 * - stats: View statistics
 * - config: View configuration
 * - set-config: Update configuration
 * - enable-all: Enable all integrations
 * - disable-all: Disable all integrations
 * - reset: Reset statistics
 * - types: List available types
 * - help: Show help message
 */
export const integrationTool: AgentTool = {
	name: "integration",
	label: "Integration Manager",
	description:
		"Manage external integrations (Slack, Jira, Linear, GitHub, Discord, Webhooks) for notifications during evolution (OpenHands Cloud Pattern)",
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action: add, get, list, update, remove, enable, disable, test, send, events, clear-events, stats, config, set-config, enable-all, disable-all, reset, types, help",
		}),
		id: Type.Optional(
			Type.String({
				description: "Integration ID for get/update/remove/enable/disable/test actions",
			}),
		),
		type: Type.Optional(
			Type.String({
				description: "Integration type (slack, jira, linear, github, discord, webhook)",
			}),
		),
		name: Type.Optional(
			Type.String({
				description: "Integration name for add/update actions",
			}),
		),
		config: Type.Optional(Type.Object({}, { additionalProperties: Type.Any() })),
		eventType: Type.Optional(
			Type.String({
				description: "Event type for send action",
			}),
		),
		data: Type.Optional(Type.Object({}, { additionalProperties: Type.Any() })),
		integrationId: Type.Optional(
			Type.String({
				description: "Integration ID filter for events action",
			}),
		),
		limit: Type.Optional(
			Type.Number({
				description: "Limit for events action (default: 50)",
			}),
		),
		enabled: Type.Optional(
			Type.Boolean({
				description: "Enabled status for update action",
			}),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const p = params as {
			action: string;
			id?: string;
			type?: string;
			name?: string;
			config?: Record<string, unknown>;
			eventType?: string;
			data?: Record<string, unknown>;
			integrationId?: string;
			limit?: number;
			enabled?: boolean;
		};

		try {
			const result = await integrationAction(p.action, p);

			// If result is already formatted (non-JSON), return as text
			if (typeof result === "string" && !result.startsWith("{")) {
				return {
					content: [{ type: "text", text: result }],
					details: {},
				};
			}

			// Return JSON result
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				details: result as Record<string, unknown>,
			};
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
