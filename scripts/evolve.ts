#!/usr/bin/env node
import 'dotenv/config';
import { execSync } from 'child_process';
import { createAgent } from '../src/agent.js';

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

const DATE = new Date().toISOString().split('T')[0];
const MAX_ITERATIONS = 3;

async function main() {
  console.log(`\n${COLORS.cyan}=== Paimon Evolution ===${COLORS.reset}`);
  console.log(`${COLORS.dim}Date: ${DATE}${COLORS.reset}\n`);

  const apiKey = process.env.DASHSCOPE_API_KEY || process.env.PAIMON_API_KEY;
  if (!apiKey) {
    console.error('Error: Set DASHSCOPE_API_KEY or PAIMON_API_KEY');
    process.exit(1);
  }

  // Build
  console.log('→ Building...');
  try {
    execSync('npm run build', { encoding: 'utf-8', stdio: 'pipe' });
    console.log(`${COLORS.green}  OK${COLORS.reset}\n`);
  } catch {
    console.error('Build failed');
    process.exit(1);
  }

  // Get issues
  let issues = 'No issues (gh CLI not available)';
  try {
    issues = execSync('gh issue list --state open --limit 10', { encoding: 'utf-8' });
  } catch {}

  const prompt = `# Self-Evolution Mission

Date: ${DATE}

## Your Code
- Use \`glob src/**/*.ts\` to find source files
- Use \`read src/agent.ts\` to understand the agent

## Open Issues
${issues}

## Task
1. Read IDENTITY.md, JOURNAL.md, ROADMAP.md
2. Pick ONE improvement
3. Implement → Test (\`npm run build\`) → Commit

Start now.`;

  // Run iterations
  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    console.log(`${COLORS.cyan}=== Iteration ${i}/${MAX_ITERATIONS} ===${COLORS.reset}\n`);

    const { run } = createAgent({
      apiKey,
      model: process.env.PAIMON_MODEL || 'glm-5',
      baseUrl: process.env.PAIMON_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    });

    try {
      const result = await run(prompt);
      console.log(`\n${result}\n`);
    } catch (e) {
      console.error(`Error: ${e}`);
    }

    // Commit if changes
    const status = execSync('git status --porcelain', { encoding: 'utf-8' });
    if (status.trim()) {
      console.log('→ Committing...');
      execSync('git add -A', { encoding: 'utf-8' });
      execSync(`git commit -m "paimon: ${DATE} iteration ${i}"`, { encoding: 'utf-8' });
      console.log(`${COLORS.green}  Done${COLORS.reset}\n`);
    }
  }

  // Push
  console.log('→ Pushing...');
  try {
    execSync('git push', { encoding: 'utf-8' });
    console.log(`${COLORS.green}  Pushed${COLORS.reset}\n`);
  } catch {
    console.log(`${COLORS.yellow}  No changes${COLORS.reset}\n`);
  }

  console.log(`${COLORS.cyan}=== Complete ===${COLORS.reset}\n`);
}

main().catch(console.error);