#!/usr/bin/env node
import "dotenv/config";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createAgent } from "../src/agent.js";

const COLORS = {
	reset: "\x1b[0m",
	dim: "\x1b[2m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	cyan: "\x1b[36m",
	red: "\x1b[31m",
};

const DATE = new Date().toISOString().split("T")[0];
const MAX_ITERATIONS = 3;

function verifyBuild(): boolean {
	try {
		execSync("npm run build", { encoding: "utf-8", stdio: "pipe", timeout: 60000 });
		return true;
	} catch {
		return false;
	}
}

function verifyTests(): boolean {
	try {
		execSync("npm test -- --run", { encoding: "utf-8", stdio: "pipe", timeout: 60000 });
		return true;
	} catch {
		return false;
	}
}

function writeReflection(
	iteration: number,
	error: string,
	buildOk: boolean,
	testOk: boolean,
): void {
	const dir = "session_plan";
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	const reflection = `# Reflection — Iteration ${iteration}

## Status
- Build: ${buildOk ? "PASS" : "FAIL"}
- Tests: ${testOk ? "PASS" : "FAIL"}

## Error
${error}

## Analysis
I need to analyze why this iteration failed.

## Next Steps
1. Fix the issue identified above
2. Re-run build and tests before committing

---
Generated at ${new Date().toISOString()}
`;

	writeFileSync(`${dir}/reflection_${iteration}.md`, reflection);

	// Also update MEMORY.md with learning
	const learning = `\n\n---

### ${DATE}: Verification Before Commit

**Context:** Iteration ${iteration} failed verification

**Insight:** 
- Build: ${buildOk ? "PASS" : "FAIL"}
- Tests: ${testOk ? "PASS" : "FAIL"}
- Error: ${error.slice(0, 200)}

**Action:** Always run \`npm run build && npm test -- --run\` before committing changes. If tests fail, do not commit.

`;

	if (existsSync("MEMORY.md")) {
		const memory = readFileSync("MEMORY.md", "utf-8");
		if (!memory.includes("Verification Before Commit")) {
			writeFileSync("MEMORY.md", memory + learning);
		}
	}
}

async function main() {
	console.log(`\n${COLORS.cyan}=== Paimon Evolution ===${COLORS.reset}`);
	console.log(`${COLORS.dim}Date: ${DATE}${COLORS.reset}\n`);

	const apiKey = process.env.DASHSCOPE_API_KEY || process.env.PAIMON_API_KEY;
	if (!apiKey) {
		console.error("Error: Set DASHSCOPE_API_KEY or PAIMON_API_KEY");
		process.exit(1);
	}
	console.log(
		`API Key found: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}\n`,
	);

	// Build
	console.log("→ Building...");
	try {
		execSync("npm run build", { encoding: "utf-8", stdio: "pipe" });
		console.log(`${COLORS.green}  OK${COLORS.reset}\n`);
	} catch {
		console.error("Build failed");
		process.exit(1);
	}

	// Get issues
	let issues = "No issues (gh CLI not available)";
	try {
		issues = execSync("gh issue list --state open --limit 10", {
			encoding: "utf-8",
		});
	} catch {}

	const prompt = `# Self-Evolution Mission

Date: ${DATE}

## Available Skills
- \`research\` — Search web, study other agents (Claude Code, Codex, Cursor, etc.)
- \`self-improve\` — Guidelines for self-improvement
- \`using-superpowers\` — How to use skills effectively

## Your Code
- Use \`glob src/**/*.ts\` to find source files
- Use \`read src/agent.ts\` to understand the agent

## Open Issues
${issues}

## Competitors to Study
- **Claude Code** — Anthropic's CLI agent, excellent tool use
- **OpenAI Codex** — Strong at code generation
- **Cursor** — IDE integration, context management

Study them with:
\`\`\`bash
curl -s https://raw.githubusercontent.com/anthropics/claude-code/main/README.md | head -100
\`\`\`

## Rules
- Do NOT modify files in \`.github/workflows/\` directory
- Do NOT modify this evolution script
- Make minimal, focused changes

## Task Priority
1. **Open Issues** — If any, implement the most important one
2. **ROADMAP.md** — Pick the next uncompleted item
3. **Competitor Research** — Learn from others and adapt good ideas

## Process
1. Read IDENTITY.md, JOURNAL.md, ROADMAP.md
2. Check if skills apply (use \`read skills/research/SKILL.md\`)
3. Study competitors if implementing something new
4. Pick ONE improvement
5. Implement → Test (\`npm run build && npm test -- --run\`) → Commit

## IMPORTANT: Verification Required
Your changes will NOT be committed if:
- Build fails
- Tests fail
- Agent timeout/error occurs

When verification fails, a reflection is written to session_plan/reflection_N.md.
Read it to understand what went wrong.

Start now. Begin by reading ROADMAP.md and checking for open issues.`;

	// Run iterations
	for (let i = 1; i <= MAX_ITERATIONS; i++) {
		console.log(`${COLORS.cyan}=== Iteration ${i}/${MAX_ITERATIONS} ===${COLORS.reset}\n`);

		const { run } = createAgent({
			apiKey,
			model: process.env.PAIMON_MODEL || "glm-5",
			baseUrl: process.env.PAIMON_BASE_URL || "https://coding.dashscope.aliyuncs.com/v1",
			skillsDir: "./skills",
			memoryPath: "./MEMORY.md",
			mode: "evolve", // Always use evolve mode for self-evolution
		});

		let runError: string | null = null;
		let resultText = "";

		try {
			resultText = await run(prompt);
			console.log(`\n${resultText}\n`);
		} catch (e) {
			runError = String(e);
			console.error(`${COLORS.red}Error: ${e}${COLORS.reset}`);
		}

		// Check if changes were made
		const status = execSync("git status --porcelain", { encoding: "utf-8" });
		if (!status.trim()) {
			console.log(`${COLORS.yellow}  No changes in iteration ${i}${COLORS.reset}\n`);
			continue;
		}

		// Verify before committing
		console.log("→ Verifying build and tests...");
		const buildOk = verifyBuild();
		const testOk = verifyTests();

		console.log(`  Build: ${buildOk ? `${COLORS.green}PASS` : `${COLORS.red}FAIL`}${COLORS.reset}`);
		console.log(
			`  Tests: ${testOk ? `${COLORS.green}PASS` : `${COLORS.red}FAIL`}${COLORS.reset}\n`,
		);

		if (!buildOk || !testOk || runError) {
			// Write reflection and do NOT commit
			writeReflection(
				i,
				runError || (buildOk ? "" : "Build failed") || "Tests failed",
				buildOk,
				testOk,
			);
			console.log(`${COLORS.red}✗ Verification failed. Changes NOT committed.${COLORS.reset}`);
			console.log(
				`${COLORS.yellow}  Reflection written to session_plan/reflection_${i}.md${COLORS.reset}\n`,
			);
			continue;
		}

		// Commit verified changes
		console.log("→ Committing verified changes...");
		execSync("git add -A", { encoding: "utf-8" });
		execSync(`git commit -m "paimon: ${DATE} iteration ${i} (verified)"`, {
			encoding: "utf-8",
		});
		console.log(`${COLORS.green}  ✓ Done${COLORS.reset}\n`);
	}

	// Push
	console.log("→ Pushing...");
	try {
		execSync("git push", { encoding: "utf-8" });
		console.log(`${COLORS.green}  Pushed${COLORS.reset}\n`);
	} catch {
		console.log(`${COLORS.yellow}  No changes${COLORS.reset}\n`);
	}

	console.log(`${COLORS.cyan}=== Complete ===${COLORS.reset}\n`);
}

main().catch(console.error);
