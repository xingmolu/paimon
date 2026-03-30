---
name: evolve
description: Use when performing self-evolution tasks - guides the iterative improvement process with evolution value scoring
tools: [bash, read, write, edit, glob, grep, find, ls, http, plan]
---

# Self-Evolution Skill

This skill guides Paimon through self-improvement cycles with evolution value scoring.

## Task Types

| Type | Description | Priority |
|------|-------------|----------|
| `capability` | Improves self-evolution ability itself | Highest |
| `reliability` | Improves stability/safety/error handling | Medium |
| `feature` | Adds new general functionality | Lower |

**Rule:** Prefer `capability` > `reliability` > `feature`. If 3+ consecutive iterations are not `capability`, explain why.

## Evolution Workflow

### 1. Context Gathering
- Read IDENTITY.md to understand purpose
- Read JOURNAL.md to see past work
- Read MEMORY.md to recall learnings and check scorecard
- Read ROADMAP.md to see what's planned
- Check git status and recent commits

### 2. Task Selection with Evolution Value Scoring (REQUIRED)

**Do NOT just pick the first issue or ROADMAP item.** Instead:

```
┌─────────────────────────────────────────────────────────┐
│         EVOLUTION VALUE SCORING ALGORITHM               │
├─────────────────────────────────────────────────────────┤
│ 1. List ALL candidate tasks:                            │
│    - Open GitHub issues                                 │
│    - ROADMAP incomplete items                           │
│    - Competitor research opportunities                   │
│                                                         │
│ 2. Classify EACH task as:                               │
│    - capability: Improves self-evolution ability        │
│    - reliability: Improves stability/safety            │
│    - feature: Adds general functionality                │
│                                                         │
│ 3. Score EACH task on evolution value (1-10):           │
│    +3: Improves future iteration success rate            │
│    +2: Reduces failure/rework rate                       │
│    +2: Improves memory/learning quality                  │
│    +1: Improves tool chain reliability                   │
│    -1 to -3: Implementation complexity                   │
│                                                         │
│ 4. SELECT highest-scoring capability task               │
│                                                         │
│ 5. OUTPUT task selection rationale:                     │
│    - List candidates with type and score                │
│    - Explain why selected task wins                     │
│    - If not capability, explain why none available      │
└─────────────────────────────────────────────────────────┘
```

**Example Output:**
```
## Task Selection

| Task | Type | Score | Reasoning |
|------|------|-------|-----------|
| Issue #20: Evolution scoring | capability | 9 | Directly improves task selection |
| Issue #19: Fix superpowers | reliability | 6 | Fixes broken skill loading |
| ROADMAP: Parallel execution | capability | 7 | Improves efficiency |
| ROADMAP: Checkpoints | capability | 8 | Enables safer experiments |

Selected: Issue #20 (score 9)
Reason: Highest-scoring capability task that directly improves evolution capability.
```

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

### 7. Scorecard Update (REQUIRED)

After each evolution iteration, update the scorecard in MEMORY.md with enhanced metrics:

```
| Date | Task Type | Task Description | Time | First Try | Errors | Rework? | Impact | Skills Used | Enables |
|------|-----------|-----------------|------|-----------|--------|---------|--------|-------------|---------|
| YYYY-MM-DD | capability/reliability/feature | Brief description | ~Nm | ✅/❌ | none/TS/test/lint | Yes/No | High/Medium/Low | skill1, skill2 | enabled-capability |
```

**Time Estimation:** Use "~N minutes" format (e.g., ~5m, ~15m, ~30m)
**Errors:** none, TS (TypeScript), test, lint, runtime
**Skills Used:** List skills that were actively used during this iteration (not just matched)
**Enables:** List what future capabilities this enables (comma-separated)

Also update the Metrics section:
- First Try Success Rate: X/Y = Z%
- Average Time: ~N minutes
- Capability Velocity: X capabilities per day
- Error Analysis: Count of each error type
- Skill Effectiveness: Top used skills by success rate

### 8. Completion
- Update JOURNAL.md with what was done (include task type)
- Update MEMORY.md scorecard with this iteration
- Add learning to MEMORY.md if something new was learned
- Close completed GitHub issues: `gh issue close <number> --comment "Completed"`
- Mark ROADMAP items done: Change `- [ ]` to `- [x]`
- Say "DONE" and summarize

## Capability vs Reliability vs Feature

**Capability tasks improve HOW you evolve:**
- Better task selection
- Better learning/memory
- Better error recovery
- Better self-assessment
- Better planning/reasoning

**Reliability tasks improve STABILITY:**
- Bug fixes
- Error handling
- Timeout fixes
- Crash prevention

**Feature tasks add FUNCTIONALITY:**
- New tools
- New commands
- New integrations
- UI improvements

## Evolution Value Score Examples

| Task | Type | Score | Reasoning |
|------|------|-------|-----------|
| Evolution value scoring | capability | 9 | Directly improves task selection quality |
| Checkpoints for rollback | capability | 8 | Enables safer risky experiments |
| Error recovery loops | capability | 8 | Reduces manual intervention |
| Self-assessment tool | capability | 8 | Pre-commit verification |
| Fix chat mode bug | reliability | 6 | User experience improvement |
| Add HTTP tool | feature | 5 | General functionality |
| Add grep tool | feature | 4 | Nice-to-have for code search |

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
6. **Score before selecting** — Always score tasks, never just pick first
7. **Prefer capability** — Capability tasks have highest evolution impact

## Security Rules

- Never modify `.github/workflows/` without explicit permission
- Avoid eval(), exec() with user input, unescaped shell commands
- Review changes before applying — look for dangerous patterns

## When to Use This Skill

- Starting any self-evolution session
- Implementing improvements to your own codebase
- Fixing bugs in your own code
- Adding new capabilities to yourself