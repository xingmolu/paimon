---
name: evolve
description: Use when performing self-evolution tasks - guides the iterative improvement process with error recovery loops
tools: [bash, read, write, edit, glob, grep, find, ls, http, plan]
---

# Self-Evolution Skill

This skill guides Paimon through self-improvement cycles with error recovery.

## Evolution Workflow

### 1. Context Gathering
- Read IDENTITY.md to understand purpose
- Read JOURNAL.md to see past work
- Read MEMORY.md to recall learnings
- Read ROADMAP.md to see what's planned
- Check git status and recent commits

### 2. Task Selection
Priority order:
1. **Open GitHub Issues** — `gh issue list --state open`
2. **ROADMAP items** — Pick next incomplete item from current phase
3. **Competitor research** — Learn and adapt from Claude Code, Cursor, etc.

### 3. Planning (Required for Complex Tasks)
For multi-step tasks, use the plan tool:
```
plan({action: 'create', steps: ['Step 1', 'Step 2', ...]})
```

### 4. Implementation
- Use `edit` for surgical changes (preferred)
- Use `write` for new files only
- Keep changes minimal and focused
- One improvement at a time

### 5. Verification (CRITICAL)
Always run both commands:
```bash
npm run build && npm test -- --run
```

### 6. Error Recovery Loop

If build or tests fail:

```
┌─────────────────────────────────────┐
│     ERROR RECOVERY LOOP             │
├─────────────────────────────────────┤
│ 1. Capture exact error message      │
│ 2. Analyze root cause               │
│ 3. Implement fix                    │
│ 4. Run tests again                  │
│ 5. If still failing, repeat         │
│ 6. Update MEMORY.md with lesson     │
└─────────────────────────────────────┘
```

**Maximum iterations: 5** — If still failing after 5 attempts, document what was tried and what's blocking.

### 7. Completion
- Update JOURNAL.md with what was done
- Update MEMORY.md if something was learned
- Close completed GitHub issues: `gh issue close <number> --comment "Completed"`
- Mark ROADMAP items done: Change `- [ ]` to `- [x]`
- Say "DONE" and summarize

## Common Failure Patterns

| Pattern | Recovery |
|---------|----------|
| TypeScript errors | Check imports, types, property access |
| Test failures | Look for edge cases, wrong assertions |
| Runtime hangs | Check for infinite loops, missing timeouts |
| API errors | Check credentials, endpoints, error handling |

## Best Practices

1. **One change at a time** — Don't batch multiple improvements
2. **Always verify** — Never skip build and test
3. **Document failures** — Every error is a learning opportunity
4. **Minimal changes** — Smallest change that accomplishes the goal
5. **Check git state** — Verify before editing, prevent conflicts

## Security Rules

- Never modify `.github/workflows/` without explicit permission
- Avoid eval(), exec() with user input, unescaped shell commands
- Review changes before applying — look for dangerous patterns

## Example Evolution Session

```
1. Read ROADMAP.md → Phase 5: Error recovery loops (incomplete)
2. Check issues → None open
3. Plan: Create evolve skill with error recovery guidance
4. Write skills/evolve/SKILL.md
5. Run build → Pass
6. Run tests → Pass
7. Update JOURNAL.md
8. Say "DONE" with summary
```

## When to Use This Skill

- Starting any self-evolution session
- Implementing improvements to your own codebase
- Fixing bugs in your own code
- Adding new capabilities to yourself