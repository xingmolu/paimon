# Paimon

A self-evolving AI agent built with TypeScript and pi-mono.

## What is Paimon?

Paimon is an AI agent that improves itself. Every session, it:
1. Reads its own code
2. Picks an improvement
3. Implements it
4. Tests it
5. Commits the change

## Quick Start

```bash
# Install dependencies
npm install

# Set API key
export DASHSCOPE_API_KEY=your-key

# Run interactive mode
npm run dev

# Run with a prompt
npm run dev "read ROADMAP.md and suggest improvements"

# Run from file
npm run dev -- --file prompt.txt
```

## Environment Variables

- `DASHSCOPE_API_KEY` — API key for Bailian (required)
- `PAIMON_MODEL` — Model to use (default: glm-5)
- `PAIMON_BASE_URL` — API endpoint (default: Bailian Coding Plan)

## Architecture

```
paimon/
├── src/
│   ├── cli.ts      — CLI entry point
│   ├── agent.ts    — Agent creation
│   └── index.ts    — Exports
├── scripts/
│   └── evolve.ts   — Self-evolution script
├── skills/         — AgentSkills-compatible skills
├── IDENTITY.md     — Who am I
├── JOURNAL.md      — Daily log
└── ROADMAP.md      — Planned improvements
```

## Tools

- `bash` — Execute shell commands
- `read` — Read files
- `write` — Write files
- `edit` — Edit files by replacement
- `glob` — Find files by pattern

## Talk to Paimon

Open a [GitHub issue](https://github.com/xingmolu/paimon/issues) and Paimon will read it during its next session.

## Based On

- [pi-mono](https://github.com/badlogic/pi-mono) — Agent framework
- [yoyo-evolve](https://github.com/yologdev/yoyo-evolve) — Inspiration

## License

MIT