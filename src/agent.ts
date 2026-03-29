import {
  type Model,
  type Api,
} from '@mariozechner/pi-ai';
import { Agent, type AgentTool, type AgentEvent, type AgentToolResult } from '@mariozechner/pi-agent-core';
import { Type } from '@sinclair/typebox';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { globSync } from 'glob';

export interface PaimonConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  skillsDir?: string;
}

const tools: AgentTool[] = [
  {
    name: 'bash',
    label: 'Execute Shell Command',
    description: 'Execute a shell command',
    parameters: Type.Object({
      command: Type.String({ description: 'The shell command to execute' }),
    }),
    execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
      const { command } = params as { command: string };
      try {
        const output = execSync(command, {
          encoding: 'utf-8',
          timeout: 120000,
          maxBuffer: 10 * 1024 * 1024,
        });
        return {
          content: [{ type: 'text', text: output || '(empty)' }],
          details: output || '(empty)',
        };
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: 'text', text: `Error: ${error}` }],
          details: `Error: ${error}`,
        };
      }
    },
  },
  {
    name: 'read',
    label: 'Read File',
    description: 'Read a file from the filesystem',
    parameters: Type.Object({
      path: Type.String({ description: 'The file path' }),
    }),
    execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
      const { path } = params as { path: string };
      try {
        if (!existsSync(path)) {
          return {
            content: [{ type: 'text', text: 'Error: File not found' }],
            details: 'Error: File not found',
          };
        }
        const content = readFileSync(path, 'utf-8');
        const numbered = content.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
        return {
          content: [{ type: 'text', text: numbered }],
          details: numbered,
        };
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: 'text', text: `Error: ${error}` }],
          details: `Error: ${error}`,
        };
      }
    },
  },
  {
    name: 'write',
    label: 'Write File',
    description: 'Write content to a file',
    parameters: Type.Object({
      path: Type.String({ description: 'The file path' }),
      content: Type.String({ description: 'Content to write' }),
    }),
    execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
      const { path, content } = params as { path: string; content: string };
      try {
        writeFileSync(path, content, 'utf-8');
        return {
          content: [{ type: 'text', text: 'File written successfully' }],
          details: 'File written successfully',
        };
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: 'text', text: `Error: ${error}` }],
          details: `Error: ${error}`,
        };
      }
    },
  },
  {
    name: 'edit',
    label: 'Edit File',
    description: 'Edit a file by replacing text',
    parameters: Type.Object({
      path: Type.String(),
      oldText: Type.String(),
      newText: Type.String(),
    }),
    execute: async (_toolCallId, params): Promise<AgentToolResult<string>> => {
      const { path, oldText, newText } = params as { path: string; oldText: string; newText: string };
      try {
        if (!existsSync(path)) {
          return {
            content: [{ type: 'text', text: 'Error: File not found' }],
            details: 'Error: File not found',
          };
        }
        const content = readFileSync(path, 'utf-8');
        if (!content.includes(oldText)) {
          return {
            content: [{ type: 'text', text: 'Error: Text not found in file' }],
            details: 'Error: Text not found in file',
          };
        }
        writeFileSync(path, content.replace(oldText, newText), 'utf-8');
        return {
          content: [{ type: 'text', text: 'Edit applied successfully' }],
          details: 'Edit applied successfully',
        };
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: 'text', text: `Error: ${error}` }],
          details: `Error: ${error}`,
        };
      }
    },
  },
  {
    name: 'glob',
    label: 'Find Files',
    description: 'Find files matching a glob pattern',
    parameters: Type.Object({
      pattern: Type.String({ description: 'Glob pattern' }),
    }),
    execute: async (_toolCallId, params): Promise<AgentToolResult<string[]>> => {
      const { pattern } = params as { pattern: string };
      try {
        const files = globSync(pattern);
        const result = files.length > 0 ? files.join('\n') : '(no matches)';
        return {
          content: [{ type: 'text', text: result }],
          details: files,
        };
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: 'text', text: `Error: ${error}` }],
          details: [],
        };
      }
    },
  },
];

function createModel(config: PaimonConfig): Model<Api> {
  return {
    id: config.model,
    name: config.model,
    api: 'openai-completions',
    provider: 'bailian',
    baseUrl: config.baseUrl,
    reasoning: false,
    input: ['text', 'image'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 4096,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  };
}

export function createAgent(config: PaimonConfig): { agent: Agent; run: (prompt: string) => Promise<string> } {
  const model = createModel(config);
  const systemPrompt = buildSystemPrompt(config.skillsDir);

  const agent = new Agent();
  agent.setModel(model);
  agent.setSystemPrompt(systemPrompt);
  agent.setTools(tools);

  const run = (prompt: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const outputs: string[] = [];

      agent.subscribe((event: AgentEvent) => {
        if (event.type === 'message_update' || event.type === 'message_end') {
          const content = event.message.content;
          if (Array.isArray(content)) {
            for (const c of content) {
              if (c.type === 'text') {
                outputs.push(c.text);
              }
            }
          }
        }
        if (event.type === 'agent_end') {
          resolve(outputs.join(''));
        }
        if (event.type === 'turn_end' && (event.message as any).errorMessage) {
          reject(new Error((event.message as any).errorMessage));
        }
      });

      agent.prompt(prompt).catch(reject);
    });
  };

  return { agent, run };
}

function buildSystemPrompt(skillsDir?: string): string {
  let prompt = `You are evo, a self-evolving AI agent.

Your goal is to improve yourself. You can read your own code, make changes, run tests, and commit improvements.

## Tools
- bash: Execute shell commands
- read: Read a file
- write: Write a file
- edit: Edit a file by replacing text
- glob: Find files by pattern

## Workflow
1. Read IDENTITY.md to understand your purpose
2. Read JOURNAL.md to see what you've done
3. Read ROADMAP.md to see what's planned
4. Pick ONE improvement
5. Implement → Test → Commit

When done, say "DONE" and summarize.`;

  if (skillsDir && existsSync(join(skillsDir, 'SKILLS.md'))) {
    prompt += '\n\n## Skills\n' + readFileSync(join(skillsDir, 'SKILLS.md'), 'utf-8');
  }

  return prompt;
}