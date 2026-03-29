#!/usr/bin/env node
import 'dotenv/config';
import { createAgent, type PaimonConfig } from './agent.js';
import { createInterface } from 'readline';
import { readFileSync, existsSync } from 'fs';

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function printBanner() {
  console.log(`\n${COLORS.bold}${COLORS.cyan}  paimon${COLORS.reset} ${COLORS.dim}— self-evolving AI agent${COLORS.reset}\n`);
}

async function main() {
  const args = process.argv.slice(2);

  // Check for --file
  const fileIndex = args.indexOf('--file');
  if (fileIndex !== -1 && args[fileIndex + 1]) {
    const filePath = args[fileIndex + 1];
    if (!existsSync(filePath)) {
      console.error(`${COLORS.red}Error: File not found: ${filePath}${COLORS.reset}`);
      process.exit(1);
    }
    const prompt = readFileSync(filePath, 'utf-8');
    await runOnce(prompt);
    return;
  }

  // Direct prompt
  if (args.length > 0 && !args[0].startsWith('--')) {
    await runOnce(args.join(' '));
    return;
  }

  // REPL
  await runRepl();
}

async function runOnce(prompt: string) {
  const config = getConfig();
  const { run } = createAgent(config);

  printBanner();
  console.log(`${COLORS.dim}  model: ${config.model}${COLORS.reset}\n`);

  try {
    const result = await run(prompt);
    console.log(`\n${result}\n`);
  } catch (error) {
    console.error(`${COLORS.red}Error: ${error instanceof Error ? error.message : String(error)}${COLORS.reset}`);
    process.exit(1);
  }
}

async function runRepl() {
  const config = getConfig();
  const { agent, run } = createAgent(config);

  printBanner();
  console.log(`${COLORS.dim}  model: ${config.model}`);
  console.log(`${COLORS.dim}  Type /quit to exit${COLORS.reset}\n`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const prompt = (q: string): Promise<string> => new Promise(r => rl.question(q, r));

  while (true) {
    const input = await prompt(`${COLORS.bold}${COLORS.green}> ${COLORS.reset}`);
    const trimmed = input.trim();

    if (!trimmed) continue;
    if (trimmed === '/quit' || trimmed === '/exit') {
      console.log(`\n${COLORS.dim}  bye${COLORS.reset}\n`);
      rl.close();
      break;
    }

    try {
      const result = await run(trimmed);
      console.log(`\n${result}\n`);
    } catch (error) {
      console.error(`${COLORS.red}Error: ${error instanceof Error ? error.message : String(error)}${COLORS.reset}\n`);
    }
  }
}

function getConfig(): PaimonConfig {
  const apiKey = process.env.DASHSCOPE_API_KEY || process.env.PAIMON_API_KEY;
  if (!apiKey) {
    console.error(`${COLORS.red}Error: Set DASHSCOPE_API_KEY or PAIMON_API_KEY${COLORS.reset}`);
    process.exit(1);
  }

  return {
    apiKey,
    model: process.env.PAIMON_MODEL || 'glm-5',
    baseUrl: process.env.PAIMON_BASE_URL || 'https://coding.dashscope.aliyuncs.com/v1',
    skillsDir: './skills',
    memoryPath: './MEMORY.md',
  };
}

main().catch(console.error);