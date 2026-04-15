/**
 * Shell Completion Tool
 *
 * Generates shell tab completion scripts for bash, zsh, and fish.
 * Inspired by Aider's --shell-completions feature.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import {
	type ShellCompletionConfig,
	getShellCompletionGenerator,
	resetShellCompletionGenerator,
} from "../shell-completion.js";

type ShellCompletionAction =
	| "generate"
	| "install"
	| "bash"
	| "zsh"
	| "fish"
	| "instructions"
	| "config"
	| "stats"
	| "reset"
	| "help";
type ShellType = "bash" | "zsh" | "fish";

interface ToolParams {
	action: ShellCompletionAction;
	shell?: ShellType | "auto";
	commandName?: string;
}

// Helper to convert 'auto' to a specific shell
function resolveShell(
	shell: ShellType | "auto" | undefined,
	generator: ReturnType<typeof getShellCompletionGenerator>,
): ShellType | undefined {
	if (shell === "auto" || shell === undefined) {
		const config = generator.getConfig();
		if (config.shell === "auto") {
			// After detection, config.shell will be bash/zsh/fish
			return config.shell as ShellType;
		}
		return config.shell as ShellType;
	}
	return shell;
}

function formatConfig(config: ShellCompletionConfig): string {
	return `## Shell Completion Configuration

| Setting | Value |
|---------|-------|
| Enabled | ${config.enabled} |
| Shell | ${config.shell} |
| Command Name | ${config.commandName} |
| Install Dir | ${config.installDir || "default"} |

## Available Shells
- bash: GNU Bourne-Again Shell
- zsh: Z Shell
- fish: Friendly Interactive Shell
- auto: Auto-detect from $SHELL

## Usage
\`\`\`bash
# Generate for auto-detected shell
shellCompletion({action: 'generate'})

# Generate for specific shell
shellCompletion({action: 'bash'})
shellCompletion({action: 'zsh'})
shellCompletion({action: 'fish'})

# Install completion script
shellCompletion({action: 'install'})

# Get installation instructions
shellCompletion({action: 'instructions'})
\`\`\`
`;
}

function getHelpMessage(): string {
	return `## Shell Completion Tool

Generate shell tab completion scripts for bash, zsh, and fish.

### Actions

| Action | Description |
|--------|-------------|
| \`generate\` | Generate completion script for auto-detected or specified shell |
| \`install\` | Install completion script to appropriate directory |
| \`bash\` | Generate bash completion script |
| \`zsh\` | Generate zsh completion script |
| \`fish\` | Generate fish completion script |
| \`instructions\` | Get installation instructions for current shell |
| \`config\` | View current configuration |
| \`stats\` | View generation and installation statistics |
| \`reset\` | Reset statistics and configuration to defaults |
| \`help\` | Show this help message |

### Examples

\`\`\`typescript
// Generate completion for current shell
shellCompletion({action: 'generate'})

// Generate bash completion
shellCompletion({action: 'bash'})

// Install completion script
shellCompletion({action: 'install'})

// Generate for custom command name
shellCompletion({action: 'generate', commandName: 'my-agent'})
\`\`\`

### Installation

#### Bash
\`\`\`bash
# One-time
source <(evo shell-completion bash)

# Permanent (add to ~/.bashrc)
eval "$(evo shell-completion bash)"
\`\`\`

#### Zsh
\`\`\`zsh
# One-time
source <(evo shell-completion zsh)

# Permanent (add to ~/.zshrc)
eval "$(evo shell-completion zsh)"
\`\`\`

#### Fish
\`\`\`fish
# One-time
evo shell-completion fish | source

# Permanent (install to completions)
evo shell-completion install fish
\`\`\`

### Features

- Tab completion for commands and options
- Option argument suggestions (models, skills)
- File path completion
- Cross-platform support (Linux, macOS, Windows via WSL)

### Pattern Source

This capability is inspired by Aider's shell-completions implementation:
https://aider.chat/docs/config.html
`;
}

/**
 * Shell completion tool for generating tab completion scripts
 */
export const shellCompletionToolDefinition: AgentTool = {
	name: "shellCompletion",
	label: "Shell Tab Completion",
	description:
		"Generate shell tab completion scripts for bash, zsh, and fish - improves CLI usability with tab completion for commands, options, and file paths (Aider pattern)",
	parameters: Type.Object({
		action: Type.Union(
			[
				Type.Literal("generate"),
				Type.Literal("install"),
				Type.Literal("bash"),
				Type.Literal("zsh"),
				Type.Literal("fish"),
				Type.Literal("instructions"),
				Type.Literal("config"),
				Type.Literal("stats"),
				Type.Literal("reset"),
				Type.Literal("help"),
			],
			{ description: "Action to perform" },
		),
		shell: Type.Optional(
			Type.Union(
				[Type.Literal("bash"), Type.Literal("zsh"), Type.Literal("fish"), Type.Literal("auto")],
				{
					description: "Target shell (default: auto-detect)",
				},
			),
		),
		commandName: Type.Optional(Type.String({ description: "Command name (default: evo)" })),
	}),
	execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
		const generator = getShellCompletionGenerator();
		const { action, shell, commandName } = params as ToolParams;

		// Apply config updates if provided
		if (commandName) {
			generator.updateConfig({ commandName });
		}

		// Resolve 'auto' to a specific shell
		const resolvedShell = resolveShell(shell, generator);

		switch (action) {
			case "generate": {
				const script = generator.generate(resolvedShell);
				const currentShell = generator.getConfig().shell;
				return {
					content: [
						{
							type: "text",
							text: `# ${currentShell.toUpperCase()} Completion Script for ${generator.getConfig().commandName}
# Generated: ${new Date().toISOString()}

${script}`,
						},
					],
					details: { shell: currentShell, commandName: generator.getConfig().commandName },
				};
			}

			case "install": {
				const result = generator.install(resolvedShell);
				if (result.success) {
					return {
						content: [
							{
								type: "text",
								text: `✅ ${result.message}\n\n${generator.getInstallInstructions(resolvedShell)}`,
							},
						],
						details: { path: result.path },
					};
				}
				return {
					content: [{ type: "text", text: `❌ ${result.message}` }],
					details: { error: result.message },
				};
			}

			case "bash": {
				const script = generator.generateBashCompletion();
				return {
					content: [{ type: "text", text: script }],
					details: { shell: "bash" },
				};
			}

			case "zsh": {
				const script = generator.generateZshCompletion();
				return {
					content: [{ type: "text", text: script }],
					details: { shell: "zsh" },
				};
			}

			case "fish": {
				const script = generator.generateFishCompletion();
				return {
					content: [{ type: "text", text: script }],
					details: { shell: "fish" },
				};
			}

			case "instructions": {
				return {
					content: [{ type: "text", text: generator.getInstallInstructions(resolvedShell) }],
					details: {},
				};
			}

			case "config": {
				const config = generator.getConfig();
				return {
					content: [{ type: "text", text: formatConfig(config) }],
					details: { config },
				};
			}

			case "stats": {
				const stats = generator.getStats();
				return {
					content: [
						{
							type: "text",
							text: `## Shell Completion Statistics

| Metric | Value |
|--------|-------|
| Total Generations | ${stats.generations} |
| Total Installations | ${stats.installations} |
| Last Generation | ${stats.lastGenerationTime || "never"} |

### By Shell
| Shell | Generations |
|-------|-------------|
| Bash | ${stats.byShell.bash} |
| Zsh | ${stats.byShell.zsh} |
| Fish | ${stats.byShell.fish} |`,
						},
					],
					details: { stats },
				};
			}

			case "reset": {
				generator.reset();
				return {
					content: [
						{
							type: "text",
							text: "✅ Shell completion statistics and configuration reset to defaults.",
						},
					],
					details: {},
				};
			}

			case "help": {
				return {
					content: [{ type: "text", text: getHelpMessage() }],
					details: {},
				};
			}

			default:
				return {
					content: [
						{
							type: "text",
							text: `❌ Unknown action: ${action}\nUse 'help' to see available actions.`,
						},
					],
					details: { error: "unknown action", action },
				};
		}
	},
};

// Re-export for convenience
export { getShellCompletionGenerator, resetShellCompletionGenerator } from "../shell-completion.js";
export type { ShellCompletionConfig } from "../shell-completion.js";
export { shellCompletionToolDefinition as shellCompletionTool } from "./shell-completion-tool.js";
