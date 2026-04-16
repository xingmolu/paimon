#!/usr/bin/env node
import "dotenv/config";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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

function archiveJournal(): void {
	if (!existsSync("JOURNAL.md")) return;

	const content = readFileSync("JOURNAL.md", "utf-8");
	const dayEntries = content.split(/(?=^## Day )/m).filter(Boolean);
	if (dayEntries.length === 0) return;

	const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
	const recent: string[] = [];
	const archived: string[] = [];

	for (const entry of dayEntries) {
		const m = entry.match(/## Day \d+ — .+ \((\d{4}-\d{2}-\d{2})\)/);
		if (!m) {
			recent.push(entry);
			continue;
		}
		(new Date(m[1]) < cutoff ? archived : recent).push(entry);
	}

	if (archived.length === 0) return;

	const archiveDir = "JOURNAL_ARCHIVE";
	if (!existsSync(archiveDir)) mkdirSync(archiveDir, { recursive: true });

	const month =
		archived.flatMap((e) => {
			const m = e.match(/\((\d{4}-\d{2})/);
			return m ? [m[1]] : [];
		})[0] || DATE.slice(0, 7);
	const archivePath = join(archiveDir, `${month}.md`);
	const existing = existsSync(archivePath) ? readFileSync(archivePath, "utf-8") : "";
	writeFileSync(archivePath, `${existing}\n${archived.join("\n")}`, "utf-8");

	const header =
		(content.match(/^# Journal[\s\S]*?\n---\n/) || [])[0] ||
		"# Journal\n\nA daily log of Paimon's self-improvements.\n\n---\n";
	writeFileSync("JOURNAL.md", `${header}\n${recent.join("\n")}`, "utf-8");
	console.log(`${COLORS.dim}  Archived ${archived.length} old journal entries${COLORS.reset}\n`);
}

async function main() {
	console.log(`\n${COLORS.cyan}=== Paimon Evolution ===${COLORS.reset}`);
	console.log(`${COLORS.dim}Date: ${DATE}${COLORS.reset}\n`);

	const apiKey = process.env.PAIMON_API_KEY;
	if (!apiKey) {
		console.error("Error: Set PAIMON_API_KEY");
		process.exit(1);
	}

	// Archive old journal entries
	console.log("→ Archiving old journal entries...");
	archiveJournal();

	// Build
	console.log("→ Building...");
	try {
		execSync("npm run build", { encoding: "utf-8", stdio: "pipe" });
		console.log(`${COLORS.green}  OK${COLORS.reset}\n`);
	} catch {
		console.error("Build failed");
		process.exit(1);
	}

	// Gather context for the agent
	const issues = (() => {
		try {
			return execSync("gh issue list --state open --limit 10", { encoding: "utf-8" });
		} catch {
			return "No issues (gh CLI not available)";
		}
	})();

	const draftBranches = (() => {
		try {
			const b = execSync("git branch -r --list 'origin/evolve/*' --format='%(refname:short)'", {
				encoding: "utf-8",
			}).trim();
			return b
				? `Previous evolution branches:\n  - ${b
						.split("\n")
						.filter((x) => x.trim())
						.join(
							"\n  - ",
						)}\n\nUse \`git diff main..origin/evolve/DATE-iterN\` to see what was attempted.`
				: "No draft branches";
		} catch {
			return "No draft branches";
		}
	})();

	const recentCommits = (() => {
		try {
			return execSync("git log --oneline -10", { encoding: "utf-8" });
		} catch {
			return "N/A";
		}
	})();

	const superpowersDir = "skills/superpowers";
	const superpowersSkills = existsSync(superpowersDir)
		? readdirSync(superpowersDir, { withFileTypes: true })
				.filter((e) => e.isDirectory())
				.map((e) => e.name)
		: [];
	console.log(
		`${COLORS.dim}Superpowers: ${superpowersSkills.length} skills loaded${COLORS.reset}\n`,
	);

	const prompt = `# Self-Evolution Mission

Date: ${DATE}

You are Paimon, an autonomous self-improving AI agent. You have full control over this session. You decide what to improve, implement it, verify it, and commit it.

## Available Skills
${superpowersSkills.map((s) => `- \`${s}\``).join("\n")}

Read any skill with: \`read skills/superpowers/<name>/SKILL.md\`

## Context
- **Recent commits:**
${recentCommits
	.split("\n")
	.map((l) => `  ${l}`)
	.join("\n")}

- **Draft branches:**
${draftBranches}

- **Open GitHub Issues:**
${issues}

## How to Work

You are fully autonomous. You must:

1. **Gather context** — Read IDENTITY.md, MEMORY.md, ROADMAP.md, JOURNAL.md, skills/evolve/SKILL.md
2. **Plan** — Select the highest-value task (prefer capability > reliability > feature). Use the evolution value scoring from skills/evolve/SKILL.md
3. **Implement** — Write minimal, focused code
4. **Verify yourself** — Run \`npm run build && npm test -- --run\`. If it fails, **fix it yourself** and retry. Do NOT stop until build and tests pass.
5. **Commit** — Use git: \`git add -A && git commit -m "paimon: <description>"\`
6. **Push** — Use git: \`git push\`
7. **Record** — Update MEMORY.md scorecard, JOURNAL.md, and ROADMAP.md as appropriate

You can do multiple improvements in this session. Keep going until you've exhausted the time or have nothing valuable left to improve.

## Rules
- Do NOT modify files in \`.github/workflows/\` directory
- Do NOT modify scripts/evolve.ts
- Always verify (\`npm run build && npm test -- --run\`) before committing
- If build/tests fail, fix the error and retry — never leave broken code committed
- Make minimal, focused changes
- If there are draft branches from previous sessions, prioritize completing/fixing them first

## What to Improve

Read skills/evolve/SKILL.md for the detailed workflow with evolution value scoring. Prioritize tasks that improve your own ability to evolve (capability > reliability > feature).

Start now. Read skills/evolve/SKILL.md first, then gather context and begin.`;

	// Run a single long session — the agent is fully autonomous
	console.log(`${COLORS.cyan}→ Starting autonomous evolution session${COLORS.reset}\n`);

	const { run } = createAgent({
		apiKey,
		model: process.env.PAIMON_MODEL || "gpt-5.4",
		baseUrl: process.env.PAIMON_BASE_URL || "https://api.86gamestore.com/v1",
		skillsDir: "./skills",
		memoryPath: "./MEMORY.md",
		mode: "evolve",
	});

	try {
		const resultText = await run(prompt);
		console.log(`\n${resultText}\n`);
	} catch (e) {
		console.error(`${COLORS.red}Session error: ${e}${COLORS.reset}`);
	}

	console.log(`${COLORS.cyan}=== Session Complete ===${COLORS.reset}\n`);
}

main().catch(console.error);
