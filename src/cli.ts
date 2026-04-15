#!/usr/bin/env node
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { type PaimonConfig, createAgent } from "./agent.js";
import { type MinimalAgentConfig, createMinimalAgent } from "./minimal-agent.js";
import { SessionManager, formatSessionList } from "./session.js";

const COLORS = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	green: "\x1b[32m",
	cyan: "\x1b[36m",
	red: "\x1b[31m",
	yellow: "\x1b[33m",
};

function printBanner() {
	console.log(
		`\n${COLORS.bold}${COLORS.cyan}  paimon${COLORS.reset} ${COLORS.dim}— self-evolving AI agent${COLORS.reset}\n`,
	);
}

interface CliOptions {
	mode: "chat" | "evolve";
	session: "new" | "continue" | "resume" | "none";
	file?: string;
	prompt?: string;
	minimal?: boolean;
	linear?: boolean;
}

function parseArgs(args: string[]): CliOptions {
	const options: CliOptions = {
		mode: "chat",
		session: "new",
	};

	// Check for --mode argument or PAIMON_MODE env var
	const modeIndex = args.indexOf("--mode");
	if (modeIndex !== -1 && args[modeIndex + 1]) {
		const modeArg = args[modeIndex + 1];
		if (modeArg === "chat" || modeArg === "evolve") {
			options.mode = modeArg;
		} else {
			console.error(
				`${COLORS.red}Error: Invalid mode "${modeArg}". Use "chat" or "evolve".${COLORS.reset}`,
			);
			process.exit(1);
		}
		args.splice(modeIndex, 2);
	} else if (process.env.PAIMON_MODE === "evolve") {
		options.mode = "evolve";
	}

	// Check for session flags
	if (args.includes("--continue") || args.includes("-c")) {
		options.session = "continue";
		// Remove the flag
		const idx = args.indexOf("--continue");
		if (idx !== -1) args.splice(idx, 1);
		const shortIdx = args.indexOf("-c");
		if (shortIdx !== -1) args.splice(shortIdx, 1);
	}

	if (args.includes("--resume") || args.includes("-r")) {
		options.session = "resume";
		// Remove the flag
		const idx = args.indexOf("--resume");
		if (idx !== -1) args.splice(idx, 1);
		const shortIdx = args.indexOf("-r");
		if (shortIdx !== -1) args.splice(shortIdx, 1);
	}

	if (args.includes("--no-session")) {
		options.session = "none";
		args.splice(args.indexOf("--no-session"), 1);
	}

	// Check for --minimal flag (Mini-SWE-Agent mode)
	if (args.includes("--minimal") || args.includes("-m")) {
		options.minimal = true;
		args.splice(args.indexOf("--minimal"), 1);
		const shortIdx = args.indexOf("-m");
		if (shortIdx !== -1) args.splice(shortIdx, 1);
	}

	// Check for --linear flag (linear history for debugging/fine-tuning)
	if (args.includes("--linear") || args.includes("-l")) {
		options.linear = true;
		args.splice(args.indexOf("--linear"), 1);
		const shortIdx = args.indexOf("-l");
		if (shortIdx !== -1) args.splice(shortIdx, 1);
	}

	// Check for --file
	const fileIndex = args.indexOf("--file");
	if (fileIndex !== -1 && args[fileIndex + 1]) {
		options.file = args[fileIndex + 1];
		args.splice(fileIndex, 2);
	}

	// Remaining args as prompt
	if (args.length > 0 && !args[0].startsWith("--")) {
		options.prompt = args.join(" ");
	}

	return options;
}

async function main() {
	const args = process.argv.slice(2);
	const options = parseArgs(args);

	// Handle session resume
	if (options.session === "resume") {
		const sessionManager = new SessionManager();
		const sessions = sessionManager.list();
		console.log(formatSessionList(sessions));
		console.log(
			`\n${COLORS.dim}Use --continue or -c to resume the latest session.${COLORS.reset}\n`,
		);
		return;
	}

	// Run with file prompt
	if (options.file) {
		if (!existsSync(options.file)) {
			console.error(`${COLORS.red}Error: File not found: ${options.file}${COLORS.reset}`);
			process.exit(1);
		}
		const prompt = readFileSync(options.file, "utf-8");
		await runOnce(prompt, options.mode, options.session, options.minimal, options.linear);
		return;
	}

	// Run with direct prompt
	if (options.prompt) {
		await runOnce(options.prompt, options.mode, options.session, options.minimal, options.linear);
		return;
	}

	// REPL mode
	await runRepl(options.mode, options.session, options.minimal, options.linear);
}

async function runOnce(
	prompt: string,
	mode: "chat" | "evolve",
	sessionMode: "new" | "continue" | "none",
	minimal?: boolean,
	linear?: boolean,
) {
	const config = getConfig(mode);
	// Enable linear history if requested
	if (linear) {
		config.linearHistory = true;
	}
	const sessionManager = new SessionManager(undefined, sessionMode !== "none");
	const debug = process.env.PAIMON_DEBUG === "true" || process.env.PAIMON_DEBUG === "1";

	printBanner();
	console.log(`${COLORS.dim}  model: ${config.model}${COLORS.reset}`);
	console.log(`${COLORS.dim}  mode: ${mode}${COLORS.reset}`);
	if (minimal) {
		console.log(
			`${COLORS.dim}  minimal: enabled (bash-only mode, Mini-SWE-Agent pattern)${COLORS.reset}`,
		);
	}
	if (linear) {
		console.log(
			`${COLORS.dim}  linear: enabled (append-only history for debugging/fine-tuning)${COLORS.reset}`,
		);
	}
	if (sessionMode === "continue" && sessionManager.continue()) {
		console.log(
			`${COLORS.dim}  session: resumed ${sessionManager.getSessionFile()}${COLORS.reset}`,
		);
	} else if (sessionMode !== "none") {
		sessionManager.new();
		console.log(`${COLORS.dim}  session: ${sessionManager.getSessionFile()}${COLORS.reset}`);
	}
	console.log();

	// Save user message
	sessionManager.save("user", prompt);

	try {
		let result: string;
		if (minimal) {
			// Use minimal agent (bash-only)
			const minimalConfig: MinimalAgentConfig = {
				apiKey: config.apiKey,
				model: config.model,
				baseUrl: config.baseUrl,
			};
			const agent = createMinimalAgent(minimalConfig);
			result = await agent.run(prompt, debug);
		} else {
			// Use full agent with all tools
			const agentContext = createAgent(config, sessionManager);
			// Execute SessionStart hooks
			const startMessages = await agentContext.executeSessionStartHooks();
			if (debug && startMessages.length > 0) {
				console.log(`${COLORS.dim}[SessionStart Hooks]${COLORS.reset}`);
				for (const msg of startMessages) {
					console.log(`${COLORS.dim}  ${msg}${COLORS.reset}`);
				}
			}
			result = await agentContext.run(prompt, debug, (delta) => process.stdout.write(delta));
			// Execute Stop hooks
			const stopMessages = await agentContext.executeStopHooks("session_complete");
			if (debug && stopMessages.length > 0) {
				console.log(`${COLORS.dim}[Stop Hooks]${COLORS.reset}`);
				for (const msg of stopMessages) {
					console.log(`${COLORS.dim}  ${msg}${COLORS.reset}`);
				}
			}
		}
		// Save assistant response
		sessionManager.save("assistant", result);
		console.log("\n");
	} catch (error) {
		console.error(
			`${COLORS.red}Error: ${error instanceof Error ? error.message : String(error)}${COLORS.reset}`,
		);
		process.exit(1);
	}
}

async function runRepl(
	mode: "chat" | "evolve",
	sessionMode: "new" | "continue" | "none",
	minimal?: boolean,
	linear?: boolean,
) {
	const config = getConfig(mode);
	// Enable linear history if requested
	if (linear) {
		config.linearHistory = true;
	}
	const sessionManager = new SessionManager(undefined, sessionMode !== "none");
	const debug = process.env.PAIMON_DEBUG === "true" || process.env.PAIMON_DEBUG === "1";

	// Create appropriate agent based on mode
	let fullAgent: ReturnType<typeof createAgent> | undefined;
	let minimalAgent: ReturnType<typeof createMinimalAgent> | undefined;

	if (minimal) {
		const minimalConfig: MinimalAgentConfig = {
			apiKey: config.apiKey,
			model: config.model,
			baseUrl: config.baseUrl,
		};
		minimalAgent = createMinimalAgent(minimalConfig);
	} else {
		fullAgent = createAgent(config, sessionManager);
		// Execute SessionStart hooks for REPL mode
		if (fullAgent) {
			const startMessages = await fullAgent.executeSessionStartHooks();
			if (debug && startMessages.length > 0) {
				console.log(`${COLORS.dim}[SessionStart Hooks]${COLORS.reset}`);
				for (const msg of startMessages) {
					console.log(`${COLORS.dim}  ${msg}${COLORS.reset}`);
				}
			}
		}
	}

	const { agent, run } = fullAgent || { agent: undefined, run: undefined };

	printBanner();
	console.log(`${COLORS.dim}  model: ${config.model}`);
	console.log(`${COLORS.dim}  mode: ${mode}${COLORS.reset}`);
	if (minimal) {
		console.log(`${COLORS.dim}  minimal: enabled (bash-only mode)${COLORS.reset}`);
	}
	if (linear) {
		console.log(
			`${COLORS.dim}  linear: enabled (append-only history for debugging/fine-tuning)${COLORS.reset}`,
		);
	}

	// Handle session
	if (sessionMode === "continue" && sessionManager.continue()) {
		console.log(
			`${COLORS.dim}  session: resumed ${sessionManager.getSessionFile()}${COLORS.reset}`,
		);
		console.log(
			`${COLORS.dim}  messages: ${sessionManager.getMessages().length} from previous session${COLORS.reset}`,
		);
	} else if (sessionMode !== "none") {
		sessionManager.new();
		console.log(`${COLORS.dim}  session: ${sessionManager.getSessionFile()}${COLORS.reset}`);
	}

	if (debug) {
		console.log(`${COLORS.dim}  debug: enabled${COLORS.reset}\n`);
	} else {
		console.log(`${COLORS.dim}  Type /quit to exit${COLORS.reset}\n`);
	}

	const rl = createInterface({ input: process.stdin, output: process.stdout });
	const prompt = (q: string): Promise<string> => new Promise((r) => rl.question(q, r));

	// Load previous messages into context
	const previousMessages = sessionManager.getMessages();
	let lastAssistantId: string | undefined;
	for (const msg of previousMessages) {
		if (msg.role === "assistant") {
			lastAssistantId = msg.id;
		}
	}

	while (true) {
		const input = await prompt(`${COLORS.bold}${COLORS.green}> ${COLORS.reset}`);
		const trimmed = input.trim();

		if (!trimmed) continue;
		if (trimmed === "/quit" || trimmed === "/exit") {
			// Execute Stop hooks before quitting
			if (fullAgent) {
				const stopMessages = await fullAgent.executeStopHooks("user_quit");
				if (debug && stopMessages.length > 0) {
					console.log(`${COLORS.dim}[Stop Hooks]${COLORS.reset}`);
					for (const msg of stopMessages) {
						console.log(`${COLORS.dim}  ${msg}${COLORS.reset}`);
					}
				}
			}
			console.log(`\n${COLORS.dim}  bye${COLORS.reset}\n`);
			rl.close();
			break;
		}

		// Save user message
		const userMsg = sessionManager.save("user", trimmed, lastAssistantId);

		try {
			let result: string;
			if (minimal && minimalAgent) {
				result = await minimalAgent.run(trimmed, debug);
			} else if (run) {
				result = await run(trimmed, debug, (delta) => process.stdout.write(delta));
			} else {
				throw new Error("Agent not initialized");
			}
			// Save assistant response with reference to user message
			const assistantMsg = sessionManager.save("assistant", result, userMsg.id);
			lastAssistantId = assistantMsg.id;
			console.log("\n");
		} catch (error) {
			console.error(
				`${COLORS.red}Error: ${error instanceof Error ? error.message : String(error)}${COLORS.reset}\n`,
			);
		}
	}
}

function getConfig(mode: "chat" | "evolve" = "chat"): PaimonConfig {
	const apiKey = process.env.DASHSCOPE_API_KEY || process.env.PAIMON_API_KEY;
	if (!apiKey) {
		console.error(`${COLORS.red}Error: Set DASHSCOPE_API_KEY or PAIMON_API_KEY${COLORS.reset}`);
		process.exit(1);
	}

	return {
		apiKey,
		model: process.env.PAIMON_MODEL || "glm-5",
		baseUrl: process.env.PAIMON_BASE_URL || "https://api.z.ai/api/paas/v4",
		skillsDir: "./skills",
		memoryPath: "./MEMORY.md",
		mode,
	};
}

main().catch(console.error);
