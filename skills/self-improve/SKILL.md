---
name: self-improve
description: Guidelines for self-improvement
tools: [read, write, edit, bash, glob]
---

# Self-Improvement Skill

When improving yourself, follow these guidelines:

## Process

1. **Read** your source code first
   - Use `glob src/**/*.ts` to find files
   - Use `read src/agent.ts` to understand the agent

2. **Plan** your change
   - Make minimal, focused changes
   - One improvement at a time

3. **Implement**
   - Use `edit` for surgical changes
   - Use `write` for new files

4. **Test**
   - Run `npm run build`
   - Run `npm test`

5. **Document**
   - Update JOURNAL.md with what you did

## Priorities

1. Fix bugs first
2. Then add tests
3. Then add features
4. Then refactor

## Rules

- Never commit without testing
- Keep changes minimal
- Document everything