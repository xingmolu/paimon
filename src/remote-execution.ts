/**
 * Remote Execution Environment (SWE-ReX Pattern)
 *
 * Enables sandboxed shell environments for safer self-evolution.
 * Supports local, Docker, and remote execution environments.
 * Provides shell session management for interactive commands.
 *
 * Inspired by SWE-ReX: https://github.com/SWE-agent/SWE-ReX
 */

import { type ChildProcess, execSync, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// Types

export type EnvironmentType = "local" | "docker" | "modal" | "remote";
export type ShellSessionState = "running" | "finished" | "error" | "timeout";

export interface ExecutionResult {
	stdout: string;
	stderr: string;
	exitCode: number;
	command: string;
	duration: number;
	timedOut: boolean;
}

export interface ShellSession {
	id: string;
	sessionId: string;
	command: string;
	state: ShellSessionState;
	stdout: string[];
	stderr: string[];
	startTime: Date;
	endTime?: Date;
	exitCode?: number;
	cwd: string;
	interactive: boolean;
	process?: ChildProcess;
}

export interface RemoteEnvironmentConfig {
	type: EnvironmentType;
	cwd?: string;
	timeout?: number;
	dockerImage?: string;
	dockerContainer?: string;
	remoteHost?: string;
	remoteUser?: string;
	remoteKeyPath?: string;
	env?: Record<string, string>;
}

export interface RemoteEnvironment {
	id: string;
	type: EnvironmentType;
	config: RemoteEnvironmentConfig;
	sessions: Map<string, ShellSession>;
	isActive: boolean;
	startTime: Date;
}

export interface RemoteExecutionStats {
	totalExecutions: number;
	totalSessions: number;
	successfulExecutions: number;
	failedExecutions: number;
	averageDuration: number;
	environmentsCreated: number;
	environmentsActive: number;
	byEnvironmentType: Record<EnvironmentType, number>;
	bySessionState: Record<ShellSessionState, number>;
	lastExecution?: ExecutionResult;
	history: ExecutionResult[];
}

export interface RemoteExecutionConfig {
	defaultTimeout: number;
	maxSessionsPerEnvironment: number;
	maxEnvironments: number;
	persistState: boolean;
	statePath: string;
	logExecutions: boolean;
}

// Default configuration

const DEFAULT_CONFIG: RemoteExecutionConfig = {
	defaultTimeout: 60000, // 60 seconds
	maxSessionsPerEnvironment: 5,
	maxEnvironments: 10,
	persistState: true,
	statePath: path.join(os.homedir(), ".paimon", "remote-execution.json"),
	logExecutions: true,
};

// Shell Session Manager

export class ShellSessionManager {
	private sessions: Map<string, ShellSession> = new Map();
	private maxSessions: number;

	constructor(maxSessions = 5) {
		this.maxSessions = maxSessions;
	}

	createSession(
		sessionId: string,
		command: string,
		cwd: string,
		interactive = false,
	): ShellSession {
		const id = `session-${sessionId}-${Date.now()}`;
		const session: ShellSession = {
			id,
			sessionId,
			command,
			state: "running",
			stdout: [],
			stderr: [],
			startTime: new Date(),
			cwd,
			interactive,
		};
		this.sessions.set(id, session);
		return session;
	}

	getSession(id: string): ShellSession | undefined {
		return this.sessions.get(id);
	}

	updateSession(id: string, updates: Partial<ShellSession>): ShellSession | undefined {
		const session = this.sessions.get(id);
		if (session) {
			Object.assign(session, updates);
			this.sessions.set(id, session);
		}
		return session;
	}

	finishSession(id: string, exitCode: number, state: ShellSessionState): ShellSession | undefined {
		return this.updateSession(id, {
			endTime: new Date(),
			exitCode,
			state,
		});
	}

	listSessions(sessionId?: string): ShellSession[] {
		const sessions = Array.from(this.sessions.values());
		if (sessionId) {
			return sessions.filter((s) => s.sessionId === sessionId);
		}
		return sessions;
	}

	clearFinishedSessions(): number {
		const finishedIds: string[] = [];
		for (const [id, session] of this.sessions) {
			if (
				session.state === "finished" ||
				session.state === "error" ||
				session.state === "timeout"
			) {
				finishedIds.push(id);
			}
		}
		for (const id of finishedIds) {
			this.sessions.delete(id);
		}
		return finishedIds.length;
	}

	getActiveSessionCount(): number {
		return Array.from(this.sessions.values()).filter((s) => s.state === "running").length;
	}
}

// Environment Adapters

export interface EnvironmentAdapter {
	execute(
		command: string,
		cwd?: string,
		timeout?: number,
		env?: Record<string, string>,
	): ExecutionResult;
	startInteractiveSession(command: string, cwd?: string): ShellSession;
	isAvailable(): boolean;
	getEnvironmentType(): EnvironmentType;
}

export class LocalEnvironmentAdapter implements EnvironmentAdapter {
	private defaultCwd: string;
	private defaultTimeout: number;

	constructor(defaultCwd?: string, defaultTimeout = 60000) {
		this.defaultCwd = defaultCwd || process.cwd();
		this.defaultTimeout = defaultTimeout;
	}

	execute(
		command: string,
		cwd?: string,
		timeout?: number,
		env?: Record<string, string>,
	): ExecutionResult {
		const startTime = Date.now();
		const actualTimeout = timeout || this.defaultTimeout;
		const actualCwd = cwd || this.defaultCwd;
		const mergedEnv = { ...process.env, ...env };

		try {
			const stdout = execSync(command, {
				cwd: actualCwd,
				timeout: actualTimeout,
				encoding: "utf-8",
				env: mergedEnv,
				maxBuffer: 10 * 1024 * 1024, // 10MB
			});

			return {
				stdout: stdout.toString(),
				stderr: "",
				exitCode: 0,
				command,
				duration: Date.now() - startTime,
				timedOut: false,
			};
		} catch (error: unknown) {
			const err = error as { stdout?: string; stderr?: string; status?: number; killed?: boolean };
			return {
				stdout: err.stdout?.toString() || "",
				stderr: err.stderr?.toString() || (error instanceof Error ? error.message : String(error)),
				exitCode: err.status || 1,
				command,
				duration: Date.now() - startTime,
				timedOut: err.killed || false,
			};
		}
	}

	startInteractiveSession(command: string, cwd?: string): ShellSession {
		const actualCwd = cwd || this.defaultCwd;
		const sessionId = `local-${Date.now()}`;
		const session: ShellSession = {
			id: sessionId,
			sessionId: "default",
			command,
			state: "running",
			stdout: [],
			stderr: [],
			startTime: new Date(),
			cwd: actualCwd,
			interactive: true,
		};

		const childProcess = spawn(command, [], {
			cwd: actualCwd,
			shell: true,
			stdio: ["pipe", "pipe", "pipe"],
		});

		session.process = childProcess;

		childProcess.stdout?.on("data", (data: Buffer) => {
			session.stdout.push(data.toString());
		});

		childProcess.stderr?.on("data", (data: Buffer) => {
			session.stderr.push(data.toString());
		});

		childProcess.on("close", (code: number) => {
			session.state = code === 0 ? "finished" : "error";
			session.exitCode = code;
			session.endTime = new Date();
		});

		childProcess.on("error", (err: Error) => {
			session.state = "error";
			session.stderr.push(err.message);
			session.endTime = new Date();
		});

		return session;
	}

	isAvailable(): boolean {
		return true; // Local execution is always available
	}

	getEnvironmentType(): EnvironmentType {
		return "local";
	}
}

export class DockerEnvironmentAdapter implements EnvironmentAdapter {
	private dockerImage: string;
	private dockerContainer?: string;
	private defaultTimeout: number;
	private containerStarted = false;

	constructor(dockerImage: string, dockerContainer?: string, defaultTimeout = 60000) {
		this.dockerImage = dockerImage;
		this.dockerContainer = dockerContainer;
		this.defaultTimeout = defaultTimeout;
	}

	async startContainer(): Promise<string> {
		if (this.dockerContainer) {
			// Use existing container
			try {
				execSync(`docker start ${this.dockerContainer}`, { timeout: 10000 });
				this.containerStarted = true;
				return this.dockerContainer;
			} catch {
				// Container might not exist, create new one
			}
		}

		// Create new container
		const containerName = `paimon-env-${Date.now()}`;
		try {
			execSync(`docker run -d --name ${containerName} ${this.dockerImage}`, { timeout: 30000 });
			this.dockerContainer = containerName;
			this.containerStarted = true;
			return containerName;
		} catch (error: unknown) {
			const err = error as Error;
			throw new Error(`Failed to start Docker container: ${err.message}`);
		}
	}

	async stopContainer(): Promise<void> {
		if (this.dockerContainer && this.containerStarted) {
			try {
				execSync(`docker stop ${this.dockerContainer}`, { timeout: 10000 });
				this.containerStarted = false;
			} catch {
				// Ignore errors when stopping
			}
		}
	}

	execute(
		command: string,
		cwd?: string,
		timeout?: number,
		env?: Record<string, string>,
	): ExecutionResult {
		const startTime = Date.now();
		const actualTimeout = timeout || this.defaultTimeout;

		if (!this.containerStarted || !this.dockerContainer) {
			return {
				stdout: "",
				stderr: "Docker container not started. Call startContainer() first.",
				exitCode: 1,
				command,
				duration: 0,
				timedOut: false,
			};
		}

		// Build docker exec command
		let dockerCmd = `docker exec ${this.dockerContainer}`;
		if (cwd) {
			dockerCmd += ` --workdir ${cwd}`;
		}
		if (env) {
			for (const [key, value] of Object.entries(env)) {
				dockerCmd += ` --env ${key}=${value}`;
			}
		}
		dockerCmd += ` ${command}`;

		try {
			const stdout = execSync(dockerCmd, {
				timeout: actualTimeout,
				encoding: "utf-8",
				maxBuffer: 10 * 1024 * 1024,
			});

			return {
				stdout: stdout.toString(),
				stderr: "",
				exitCode: 0,
				command,
				duration: Date.now() - startTime,
				timedOut: false,
			};
		} catch (error: unknown) {
			const err = error as { stdout?: string; stderr?: string; status?: number; killed?: boolean };
			return {
				stdout: err.stdout?.toString() || "",
				stderr: err.stderr?.toString() || (error instanceof Error ? error.message : String(error)),
				exitCode: err.status || 1,
				command,
				duration: Date.now() - startTime,
				timedOut: err.killed || false,
			};
		}
	}

	startInteractiveSession(command: string, cwd?: string): ShellSession {
		const sessionId = `docker-${this.dockerContainer}-${Date.now()}`;
		const session: ShellSession = {
			id: sessionId,
			sessionId: "docker",
			command,
			state: "running",
			stdout: [],
			stderr: [],
			startTime: new Date(),
			cwd: cwd || "/",
			interactive: true,
		};

		if (!this.containerStarted || !this.dockerContainer) {
			session.state = "error";
			session.stderr.push("Docker container not started");
			session.endTime = new Date();
			return session;
		}

		// Use docker exec -it for interactive sessions
		let dockerCmd = `docker exec -i ${this.dockerContainer}`;
		if (cwd) {
			dockerCmd += ` --workdir ${cwd}`;
		}
		dockerCmd += ` sh -c "${command}"`;

		const childProcess = spawn(dockerCmd, [], {
			shell: true,
			stdio: ["pipe", "pipe", "pipe"],
		});

		session.process = childProcess;

		childProcess.stdout?.on("data", (data: Buffer) => {
			session.stdout.push(data.toString());
		});

		childProcess.stderr?.on("data", (data: Buffer) => {
			session.stderr.push(data.toString());
		});

		childProcess.on("close", (code: number) => {
			session.state = code === 0 ? "finished" : "error";
			session.exitCode = code;
			session.endTime = new Date();
		});

		return session;
	}

	isAvailable(): boolean {
		try {
			execSync("docker --version", { timeout: 5000 });
			return true;
		} catch {
			return false;
		}
	}

	getEnvironmentType(): EnvironmentType {
		return "docker";
	}
}

// Remote Execution Manager

export class RemoteExecutionManager {
	private config: RemoteExecutionConfig;
	private environments: Map<string, RemoteEnvironment> = new Map();
	private sessionManager: ShellSessionManager;
	private adapters: Map<EnvironmentType, EnvironmentAdapter> = new Map();
	private stats: RemoteExecutionStats;

	constructor(configPath?: string) {
		this.config = DEFAULT_CONFIG;
		this.sessionManager = new ShellSessionManager(this.config.maxSessionsPerEnvironment);
		this.stats = this.initStats();

		// Initialize default adapters
		this.adapters.set("local", new LocalEnvironmentAdapter());

		// Load persisted state
		if (this.config.persistState && configPath) {
			this.loadState(configPath);
		} else if (this.config.persistState) {
			this.loadState(this.config.statePath);
		}
	}

	private initStats(): RemoteExecutionStats {
		return {
			totalExecutions: 0,
			totalSessions: 0,
			successfulExecutions: 0,
			failedExecutions: 0,
			averageDuration: 0,
			environmentsCreated: 0,
			environmentsActive: 0,
			byEnvironmentType: {
				local: 0,
				docker: 0,
				modal: 0,
				remote: 0,
			},
			bySessionState: {
				running: 0,
				finished: 0,
				error: 0,
				timeout: 0,
			},
			history: [],
		};
	}

	private loadState(configPath: string): void {
		try {
			if (fs.existsSync(configPath)) {
				const data = fs.readFileSync(configPath, "utf-8");
				const state = JSON.parse(data);
				if (state.stats) {
					this.stats = state.stats;
				}
			}
		} catch {
			// Ignore errors loading state
		}
	}

	private saveState(): void {
		if (!this.config.persistState) return;
		try {
			const state = { stats: this.stats };
			const dir = path.dirname(this.config.statePath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(this.config.statePath, JSON.stringify(state, null, 2));
		} catch {
			// Ignore errors saving state
		}
	}

	// Create environment

	createEnvironment(config: RemoteEnvironmentConfig): RemoteEnvironment {
		if (this.environments.size >= this.config.maxEnvironments) {
			throw new Error(`Maximum environments (${this.config.maxEnvironments}) reached`);
		}

		const id = `env-${config.type}-${Date.now()}`;
		const environment: RemoteEnvironment = {
			id,
			type: config.type,
			config,
			sessions: new Map(),
			isActive: true,
			startTime: new Date(),
		};

		// Initialize appropriate adapter
		if (config.type === "docker" && config.dockerImage) {
			this.adapters.set(
				config.type,
				new DockerEnvironmentAdapter(config.dockerImage, config.dockerContainer),
			);
		} else if (config.type === "local") {
			// Already initialized
		}

		this.environments.set(id, environment);
		this.stats.environmentsCreated++;
		this.stats.environmentsActive++;
		this.stats.byEnvironmentType[config.type]++;

		return environment;
	}

	// Get environment

	getEnvironment(id: string): RemoteEnvironment | undefined {
		return this.environments.get(id);
	}

	listEnvironments(type?: EnvironmentType): RemoteEnvironment[] {
		const envs = Array.from(this.environments.values());
		if (type) {
			return envs.filter((e) => e.type === type);
		}
		return envs;
	}

	// Execute command in environment

	execute(
		environmentId: string,
		command: string,
		cwd?: string,
		timeout?: number,
		env?: Record<string, string>,
	): ExecutionResult {
		const environment = this.environments.get(environmentId);
		if (!environment) {
			throw new Error(`Environment ${environmentId} not found`);
		}

		const adapter = this.adapters.get(environment.type);
		if (!adapter) {
			throw new Error(`No adapter for environment type ${environment.type}`);
		}

		const result = adapter.execute(
			command,
			cwd || environment.config.cwd,
			timeout || this.config.defaultTimeout,
			env || environment.config.env,
		);

		// Update stats
		this.stats.totalExecutions++;
		if (result.exitCode === 0) {
			this.stats.successfulExecutions++;
		} else {
			this.stats.failedExecutions++;
		}
		this.stats.averageDuration =
			(this.stats.averageDuration * (this.stats.totalExecutions - 1) + result.duration) /
			this.stats.totalExecutions;
		this.stats.lastExecution = result;
		this.stats.history.push(result);
		if (this.stats.history.length > 100) {
			this.stats.history = this.stats.history.slice(-100);
		}

		this.saveState();
		return result;
	}

	// Execute in default local environment

	executeLocal(
		command: string,
		cwd?: string,
		timeout?: number,
		env?: Record<string, string>,
	): ExecutionResult {
		const localAdapter = this.adapters.get("local");
		if (!localAdapter) {
			throw new Error("Local adapter not available");
		}

		const result = localAdapter.execute(command, cwd, timeout || this.config.defaultTimeout, env);

		// Update stats
		this.stats.totalExecutions++;
		if (result.exitCode === 0) {
			this.stats.successfulExecutions++;
		} else {
			this.stats.failedExecutions++;
		}
		this.stats.byEnvironmentType.local++;
		this.stats.lastExecution = result;
		this.saveState();

		return result;
	}

	// Start interactive session

	startSession(environmentId: string, command: string, cwd?: string): ShellSession {
		const environment = this.environments.get(environmentId);
		if (!environment) {
			throw new Error(`Environment ${environmentId} not found`);
		}

		const adapter = this.adapters.get(environment.type);
		if (!adapter) {
			throw new Error(`No adapter for environment type ${environment.type}`);
		}

		const session = adapter.startInteractiveSession(command, cwd || environment.config.cwd);
		session.sessionId = environmentId;
		environment.sessions.set(session.id, session);

		this.stats.totalSessions++;
		this.stats.bySessionState[session.state]++;
		this.saveState();

		return session;
	}

	// Get session output

	getSessionOutput(sessionId: string): {
		stdout: string;
		stderr: string;
		state: ShellSessionState;
	} {
		const session = this.sessionManager.getSession(sessionId);
		if (!session) {
			// Check environments
			for (const env of this.environments.values()) {
				const s = env.sessions.get(sessionId);
				if (s) {
					return {
						stdout: s.stdout.join("\n"),
						stderr: s.stderr.join("\n"),
						state: s.state,
					};
				}
			}
			throw new Error(`Session ${sessionId} not found`);
		}

		return {
			stdout: session.stdout.join("\n"),
			stderr: session.stderr.join("\n"),
			state: session.state,
		};
	}

	// Send input to session

	sendInput(sessionId: string, input: string): boolean {
		const session = this.sessionManager.getSession(sessionId);
		if (!session || !session.process || session.state !== "running") {
			// Check environments
			for (const env of this.environments.values()) {
				const s = env.sessions.get(sessionId);
				if (s?.process && s.state === "running") {
					s.process.stdin?.write(`${input}\n`);
					return true;
				}
			}
			return false;
		}

		session.process.stdin?.write(`${input}\n`);
		return true;
	}

	// Stop session

	stopSession(sessionId: string): boolean {
		const session = this.sessionManager.getSession(sessionId);
		if (!session || !session.process) {
			// Check environments
			for (const env of this.environments.values()) {
				const s = env.sessions.get(sessionId);
				if (s?.process) {
					s.process.kill();
					s.state = "finished";
					s.endTime = new Date();
					this.stats.bySessionState.running--;
					this.stats.bySessionState.finished++;
					this.saveState();
					return true;
				}
			}
			return false;
		}

		session.process.kill();
		this.sessionManager.finishSession(sessionId, 0, "finished");
		this.stats.bySessionState.running--;
		this.stats.bySessionState.finished++;
		this.saveState();
		return true;
	}

	// Stop environment

	stopEnvironment(id: string): boolean {
		const environment = this.environments.get(id);
		if (!environment) return false;

		// Stop all sessions
		for (const [sessionId] of environment.sessions) {
			this.stopSession(sessionId);
		}

		// Stop container if Docker
		if (environment.type === "docker") {
			const adapter = this.adapters.get("docker") as DockerEnvironmentAdapter;
			adapter?.stopContainer();
		}

		environment.isActive = false;
		this.stats.environmentsActive--;
		this.saveState();
		return true;
	}

	// Get stats

	getStats(): RemoteExecutionStats {
		return this.stats;
	}

	// Reset stats

	resetStats(): void {
		this.stats = this.initStats();
		this.saveState();
	}

	// Check environment availability

	checkAvailability(type: EnvironmentType): boolean {
		const adapter = this.adapters.get(type);
		return adapter ? adapter.isAvailable() : false;
	}

	// Configure

	updateConfig(updates: Partial<RemoteExecutionConfig>): void {
		Object.assign(this.config, updates);
		if (updates.maxSessionsPerEnvironment) {
			this.sessionManager = new ShellSessionManager(updates.maxSessionsPerEnvironment);
		}
	}

	getConfig(): RemoteExecutionConfig {
		return this.config;
	}

	// Cleanup

	cleanup(): void {
		// Stop all active environments
		for (const [id] of this.environments) {
			this.stopEnvironment(id);
		}

		// Clear finished sessions
		this.sessionManager.clearFinishedSessions();

		// Save final state
		this.saveState();
	}
}

// Singleton instance

let remoteExecutionManagerInstance: RemoteExecutionManager | null = null;

export function getRemoteExecutionManager(): RemoteExecutionManager {
	if (!remoteExecutionManagerInstance) {
		remoteExecutionManagerInstance = new RemoteExecutionManager();
	}
	return remoteExecutionManagerInstance;
}

export function initRemoteExecutionManager(configPath?: string): RemoteExecutionManager {
	remoteExecutionManagerInstance = new RemoteExecutionManager(configPath);
	return remoteExecutionManagerInstance;
}

// Tool interface

export interface RemoteExecutionToolArgs {
	action: string;
	environmentId?: string;
	environmentType?: EnvironmentType;
	command?: string;
	cwd?: string;
	timeout?: number;
	env?: Record<string, string>;
	sessionId?: string;
	input?: string;
	envConfig?: RemoteEnvironmentConfig;
	managerConfig?: Partial<RemoteExecutionConfig>;
	dockerImage?: string;
	dockerContainer?: string;
	remoteHost?: string;
}

export async function remoteExecutionTool(args: RemoteExecutionToolArgs): Promise<string> {
	const manager = getRemoteExecutionManager();

	switch (args.action) {
		case "execute": {
			if (!args.command) return "Error: command required";
			if (args.environmentId) {
				const result = manager.execute(
					args.environmentId,
					args.command,
					args.cwd,
					args.timeout,
					args.env,
				);
				return JSON.stringify(result, null, 2);
			}
			const result = manager.executeLocal(args.command, args.cwd, args.timeout, args.env);
			return JSON.stringify(result, null, 2);
		}

		case "create-env": {
			if (!args.environmentType) return "Error: environmentType required";
			const config: RemoteEnvironmentConfig = {
				type: args.environmentType,
				cwd: args.cwd,
				timeout: args.timeout,
				dockerImage: args.dockerImage,
				dockerContainer: args.dockerContainer,
				remoteHost: args.remoteHost,
				env: args.env,
			};
			const env = manager.createEnvironment(config);
			return JSON.stringify(env, null, 2);
		}

		case "get-env": {
			if (!args.environmentId) return "Error: environmentId required";
			const env = manager.getEnvironment(args.environmentId);
			return env ? JSON.stringify(env, null, 2) : `Environment ${args.environmentId} not found`;
		}

		case "list-envs": {
			const envs = manager.listEnvironments(args.environmentType);
			return JSON.stringify(
				envs.map((e) => ({ id: e.id, type: e.type, isActive: e.isActive })),
				null,
				2,
			);
		}

		case "stop-env": {
			if (!args.environmentId) return "Error: environmentId required";
			const stopped = manager.stopEnvironment(args.environmentId);
			return stopped
				? `Environment ${args.environmentId} stopped`
				: `Failed to stop ${args.environmentId}`;
		}

		case "start-session": {
			if (!args.environmentId || !args.command) return "Error: environmentId and command required";
			const session = manager.startSession(args.environmentId, args.command, args.cwd);
			return JSON.stringify({ id: session.id, state: session.state }, null, 2);
		}

		case "get-session": {
			if (!args.sessionId) return "Error: sessionId required";
			const output = manager.getSessionOutput(args.sessionId);
			return JSON.stringify(output, null, 2);
		}

		case "send-input": {
			if (!args.sessionId || !args.input) return "Error: sessionId and input required";
			const sent = manager.sendInput(args.sessionId, args.input);
			return sent ? `Input sent to ${args.sessionId}` : `Failed to send input to ${args.sessionId}`;
		}

		case "stop-session": {
			if (!args.sessionId) return "Error: sessionId required";
			const stopped = manager.stopSession(args.sessionId);
			return stopped ? `Session ${args.sessionId} stopped` : `Failed to stop ${args.sessionId}`;
		}

		case "availability": {
			const type = args.environmentType || "local";
			const available = manager.checkAvailability(type);
			return `${type}: ${available ? "available" : "not available"}`;
		}

		case "stats": {
			const stats = manager.getStats();
			return JSON.stringify(stats, null, 2);
		}

		case "config": {
			if (args.managerConfig) {
				manager.updateConfig(args.managerConfig);
			}
			return JSON.stringify(manager.getConfig(), null, 2);
		}

		case "reset": {
			manager.resetStats();
			return "Statistics reset";
		}

		case "cleanup": {
			manager.cleanup();
			return "Cleanup complete";
		}

		case "help": {
			return `Remote Execution Tool (SWE-ReX Pattern)

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
- help: Show this help

Environment Types:
- local: Execute on local machine (default)
- docker: Execute in Docker container (requires dockerImage)
- modal: Execute on Modal (requires modal setup)
- remote: Execute on remote host (requires remoteHost)

Examples:
remoteExecution({action: 'execute', command: 'npm run build'})
remoteExecution({action: 'create-env', environmentType: 'docker', dockerImage: 'node:18'})
remoteExecution({action: 'execute', environmentId: 'env-123', command: 'ls -la'})
remoteExecution({action: 'start-session', environmentId: 'env-123', command: 'ipython'})`;
		}

		default:
			return `Unknown action: ${args.action}. Use 'help' for available actions.`;
	}
}
