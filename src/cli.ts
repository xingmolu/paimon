#!/usr/bin/env node
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { type PaimonConfig, createAgent } from "./agent.js";
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
		await runOnce(prompt, options.mode, options.session);
		return;
	}

	// Run with direct prompt
	if (options.prompt) {
		await runOnce(options.prompt, options.mode, options.session);
		return;
	}

	// REPL mode
	await runRepl(options.mode, options.session);
}

async function runOnce(
	prompt: string,
	mode: "chat" | "evolve",
	sessionMode: "new" | "continue" | "none",
) {
	const config = getConfig(mode);
	const sessionManager = new SessionManager(undefined, sessionMode !== "none");
	const { run } = createAgent(config, sessionManager);
	const debug = process.env.PAIMON_DEBUG === "true" || process.env.PAIMON_DEBUG === "1";

	printBanner();
	console.log(`${COLORS.dim}  model: ${config.model}${COLORS.reset}`);
	console.log(`${COLORS.dim}  mode: ${mode}${COLORS.reset}`);
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
		const result = await run(prompt, debug, (delta) => process.stdout.write(delta));
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

async function runRepl(mode: "chat" | "evolve", sessionMode: "new" | "continue" | "none") {
	const config = getConfig(mode);
	const sessionManager = new SessionManager(undefined, sessionMode !== "none");
	const { agent, run } = createAgent(config, sessionManager);
	const debug = process.env.PAIMON_DEBUG === "true" || process.env.PAIMON_DEBUG === "1";

	printBanner();
	console.log(`${COLORS.dim}  model: ${config.model}`);
	console.log(`${COLORS.dim}  mode: ${mode}${COLORS.reset}`);

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
			console.log(`\n${COLORS.dim}  bye${COLORS.reset}\n`);
			rl.close();
			break;
		}

		// Save user message
		const userMsg = sessionManager.save("user", trimmed, lastAssistantId);

		try {
			const result = await run(trimmed, debug, (delta) => process.stdout.write(delta));
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
		baseUrl: process.env.PAIMON_BASE_URL || "https://coding.dashscope.aliyuncs.com/v1",
		skillsDir: "./skills",
		memoryPath: "./MEMORY.md",
		mode,
	};
}

main().catch(console.error);
