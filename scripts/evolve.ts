#!/usr/bin/env node
import "dotenv/config";
import { execSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
const SESSION_DIR = "session_plan";

/**
 * Skill audit logging for tracking superpowers usage
 */
interface SkillAuditEntry {
	timestamp: string;
	iteration: number;
	task: string;
	availableSkills: string[];
	matchedSkills: string[];
	usedSkills: string[];
	result: string;
}

function writeSkillAudit(entry: SkillAuditEntry): void {
	if (!existsSync(SESSION_DIR)) {
		mkdirSync(SESSION_DIR, { recursive: true });
	}

	const auditPath = join(SESSION_DIR, "skill_audit.jsonl");
	const line = `${JSON.stringify(entry)}\n`;
	appendFileSync(auditPath, line, "utf-8");
}

/**
 * Perform skill matching before task execution
 * Returns the skills that match the current task
 */
function matchSkills(
	taskDescription: string,
	availableSkills: string[],
): {
	matchedSkills: string[];
	reasoning: string;
} {
	const matchedSkills: string[] = [];
	const reasoning: string[] = [];

	// Simple keyword-based matching
	const taskLower = taskDescription.toLowerCase();

	// Match by task type keywords
	if (taskLower.includes("fix") || taskLower.includes("bug") || taskLower.includes("debug")) {
		matchedSkills.push("systematic-debugging");
		reasoning.push("systematic-debugging: task involves fixing/debugging");
	}

	if (
		taskLower.includes("plan") ||
		taskLower.includes("implement") ||
		taskLower.includes("feature")
	) {
		matchedSkills.push("writing-plans");
		reasoning.push("writing-plans: task requires planning");
	}

	if (
		taskLower.includes("brainstorm") ||
		taskLower.includes("design") ||
		taskLower.includes("explore")
	) {
		matchedSkills.push("brainstorming");
		reasoning.push("brainstorming: task involves exploration/design");
	}

	if (
		taskLower.includes("review") ||
		taskLower.includes("verify") ||
		taskLower.includes("complete")
	) {
		matchedSkills.push("verification-before-completion");
		reasoning.push("verification-before-completion: task needs verification");
	}

	if (taskLower.includes("request review") || taskLower.includes("code review")) {
		matchedSkills.push("requesting-code-review");
		reasoning.push("requesting-code-review: task involves code review");
	}

	// Always suggest using-superpowers for guidance
	if (
		availableSkills.includes("using-superpowers") &&
		!matchedSkills.includes("using-superpowers")
	) {
		matchedSkills.push("using-superpowers");
		reasoning.push("using-superpowers: provides guidance on skill usage");
	}

	return {
		matchedSkills,
		reasoning: reasoning.join("; "),
	};
}

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

	// Also update MEMORY.md with learning (using new structured format)
	const learning = `\n\n---

### ${DATE}: Verification Before Commit

**Type:** reliability

**Context:** Iteration ${iteration} failed verification

**Insight:** 
- Build: ${buildOk ? "PASS" : "FAIL"}
- Tests: ${testOk ? "PASS" : "FAIL"}
- Error: ${error.slice(0, 200)}

**Trigger:** Before committing any changes

**Reuse Rule:** Always run \`npm run build && npm test -- --run\` before committing. Use assess({}) tool for verification.

**Priority:** High

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

	// Read superpowers skills from directory
	const superpowersDir = "skills/superpowers";
	const superpowersSkills = existsSync(superpowersDir)
		? readdirSync(superpowersDir, { withFileTypes: true })
				.filter((e) => e.isDirectory())
				.map((e) => e.name)
		: [];
	console.log(`${COLORS.dim}Superpowers: ${superpowersSkills.length} skills loaded${COLORS.reset}\n`);

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
- \`evolve\` — Self-evolution workflow with evolution value scoring (READ THIS FIRST)

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

## Task Selection with Evolution Value Scoring (REQUIRED)

**Do NOT just pick the first issue or ROADMAP item.** Instead:

### Step 1: List ALL candidate tasks
- Open GitHub issues (from above)
- ROADMAP incomplete items (read ROADMAP.md)
- Competitor research opportunities

### Step 2: Classify EACH task
- \`capability\` — Improves self-evolution ability itself (HIGHEST PRIORITY)
- \`reliability\` — Improves stability/safety/error handling (MEDIUM)
- \`feature\` — Adds new general functionality (LOWER)

### Step 3: Score EACH task on evolution value (1-10)
Scoring factors:
- +3: Improves future iteration success rate
- +2: Reduces failure/rework rate
- +2: Improves memory/learning quality
- +1: Improves tool chain reliability
- -1 to -3: Implementation complexity

### Step 4: SELECT highest-scoring capability task
If no capability tasks available, select highest-scoring reliability task.

### Step 5: OUTPUT your task selection
Show a table with all candidates, their type, score, and reasoning. Then explain why you selected the task.

Example output format:
\`\`\`
## Task Selection

| Task | Type | Score | Reasoning |
|------|------|-------|-----------|
| Issue #20: Evolution scoring | capability | 9 | Directly improves task selection |
| ROADMAP: Parallel execution | capability | 7 | Improves efficiency |

Selected: Issue #20 (score 9)
Reason: Highest-scoring capability task.
\`\`\`

## Process
1. Read skills/evolve/SKILL.md for detailed workflow
2. Read IDENTITY.md, JOURNAL.md, MEMORY.md, ROADMAP.md
3. Score all candidate tasks and select the best one
4. Implement → Test (\`npm run build && npm test -- --run\`) → Say "DONE"
5. Update MEMORY.md scorecard with this iteration's result

## Scorecard Update (REQUIRED)
After each iteration, add a row to MEMORY.md's Evolution Scorecard:
\`\`\`
| ${DATE} | capability/reliability/feature | Brief description | ~Nm | ✅/❌ | none/TS/test/lint | Yes/No | High/Medium/Low | skill1, skill2 | enabled-capability |
\`\`\`
**Time:** Estimate minutes (e.g., ~10m)
**Errors:** none, TS, test, lint, runtime
**Skills Used:** List skills that were actively used during this iteration
**Enables:** What future capabilities this task enables

## IMPORTANT
- Do NOT run git commit or git push - the script handles this
- Just say "DONE" when complete
- Changes will NOT be committed if build/tests fail
- Always score tasks before selecting — prefer capability tasks

When verification fails, a reflection is written to session_plan/reflection_N.md.

Start now. Read skills/evolve/SKILL.md first, then MEMORY.md, then ROADMAP.md, then score and select a task.`;

	// Run iterations
	for (let i = 1; i <= MAX_ITERATIONS; i++) {
		console.log(`${COLORS.cyan}=== Iteration ${i}/${MAX_ITERATIONS} ===${COLORS.reset}\n`);

		// Skill matching phase
		const availableSkills = [
			...superpowersSkills,
			"evolve",
			"research",
			"self-improve",
			"using-superpowers",
		];
		const skillMatchResult = matchSkills(issues, availableSkills);

		console.log(`${COLORS.cyan}→ Skill Matching${COLORS.reset}`);
		console.log(`${COLORS.dim}  Available: ${availableSkills.join(", ")}${COLORS.reset}`);
		console.log(
			`${COLORS.dim}  Matched: ${skillMatchResult.matchedSkills.join(", ") || "(none)"}${COLORS.reset}`,
		);
		console.log(
			`${COLORS.dim}  Reasoning: ${skillMatchResult.reasoning || "(no direct matches)"}${COLORS.reset}\n`,
		);

		// Create enhanced prompt with skill matching output
		const skillMatchingPrompt = `
## Skill Matching Result (Iteration ${i})

**Available Skills:** ${availableSkills.join(", ")}

**Matched Skills:** ${skillMatchResult.matchedSkills.join(", ") || "None directly matched"}

**Reasoning:** ${skillMatchResult.reasoning || "No keyword-based matches found. Consider reading skills/using-superpowers/SKILL.md for guidance."}

**Recommendation:** If matched skills exist, read them first with \`read skills/superpowers/<name>/SKILL.md\` before starting the task.

`;

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
			resultText = await run(skillMatchingPrompt + prompt);
			console.log(`\n${resultText}\n`);
		} catch (e) {
			runError = String(e);
			console.error(`${COLORS.red}Error: ${e}${COLORS.reset}`);
		}

		// Write skill audit entry
		writeSkillAudit({
			timestamp: new Date().toISOString(),
			iteration: i,
			task: issues.slice(0, 200),
			availableSkills,
			matchedSkills: skillMatchResult.matchedSkills,
			usedSkills: [], // Would need agent output parsing to determine actual usage
			result: runError ? `Error: ${runError}` : "Completed",
		});

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
