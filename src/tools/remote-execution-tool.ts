/**
 * Remote Execution Tool
 *
 * Tool interface for remote execution environments.
 * Part of the Remote Execution Environment (SWE-ReX Pattern).
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	getRemoteExecutionManager,
	initRemoteExecutionManager,
	remoteExecutionTool,
} from "../remote-execution.js";

/**
 * Remote Execution tool for sandboxed execution environments.
 */
export const remoteExecutionToolDef: AgentTool = {
	name: "remoteExecution",
	label: "Remote Execution Environment",
	description: `Manage remote execution environments for sandboxed evolution. Supports local, Docker, and remote environments with interactive shell sessions.

Actions:
- execute: Execute command in environment (requires command, optional environmentId)
- create-env: Create new environment (requires environmentType)
- get-env: Get environment details (requires environmentId)
- list-envs: List all environments (optional environmentType filter)
- stop-env: Stop environment (requires environmentId)
- start-session: Start interactive session (requires environmentId, command)
- get-session: Get session output (requires sessionId)
- send-input: Send input to session (requires sessionId, input)
- stop-session: Stop session (requires sessionId)
- availability: Check environment availability (optional environmentType)
- stats: View execution statistics
- config: View/update configuration
- reset: Reset statistics
- cleanup: Cleanup all resources
- help: Show help

Environment Types:
- local: Execute on local machine (default)
- docker: Execute in Docker container (requires dockerImage)
- modal: Execute on Modal (requires modal setup)
- remote: Execute on remote host (requires remoteHost)

Examples:
remoteExecution({action: 'execute', command: 'npm run build'})
remoteExecution({action: 'create-env', environmentType: 'docker', dockerImage: 'node:18'})
remoteExecution({action: 'execute', environmentId: 'env-123', command: 'ls -la'})
remoteExecution({action: 'start-session', environmentId: 'env-123', command: 'ipython'})`,
	parameters: Type.Object({
		action: Type.String({
			description:
				"Action to perform: execute, create-env, get-env, list-envs, stop-env, start-session, get-session, send-input, stop-session, availability, stats, config, reset, cleanup, help",
		}),
		environmentId: Type.Optional(
			Type.String({ description: "Environment ID for environment-specific operations" }),
		),
		environmentType: Type.Optional(
			Type.String({ description: "Environment type: local, docker, modal, remote" }),
		),
		command: Type.Optional(Type.String({ description: "Command to execute" })),
		cwd: Type.Optional(Type.String({ description: "Working directory for execution" })),
		timeout: Type.Optional(
			Type.Number({ description: "Timeout in milliseconds (default: 60000)" }),
		),
		sessionId: Type.Optional(Type.String({ description: "Session ID for session operations" })),
		input: Type.Optional(Type.String({ description: "Input to send to interactive session" })),
		dockerImage: Type.Optional(Type.String({ description: "Docker image for Docker environment" })),
		dockerContainer: Type.Optional(Type.String({ description: "Existing Docker container name" })),
		remoteHost: Type.Optional(
			Type.String({ description: "Remote host address for remote execution" }),
		),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const input = params as Record<string, unknown>;
		const result = await remoteExecutionTool({
			action: input.action as string,
			environmentId: input.environmentId as string | undefined,
			environmentType: input.environmentType as "local" | "docker" | "modal" | "remote" | undefined,
			command: input.command as string | undefined,
			cwd: input.cwd as string | undefined,
			timeout: input.timeout as number | undefined,
			sessionId: input.sessionId as string | undefined,
			input: input.input as string | undefined,
			dockerImage: input.dockerImage as string | undefined,
			dockerContainer: input.dockerContainer as string | undefined,
			remoteHost: input.remoteHost as string | undefined,
		});

		return {
			content: [{ type: "text", text: result }],
			details: result,
		};
	},
};

/**
 * Create Remote Execution tool (for compatibility)
 */
export function createRemoteExecutionTool(): typeof remoteExecutionToolDef {
	return remoteExecutionToolDef;
}

// Export for tools index
export { remoteExecutionTool, getRemoteExecutionManager, initRemoteExecutionManager };

export default remoteExecutionToolDef;
