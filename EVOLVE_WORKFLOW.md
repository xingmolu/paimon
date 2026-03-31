# Evolution Workflow Guide

Read this file when you need details on any workflow step or tool usage.

## Workflow

1. **Gather context**: Read IDENTITY.md, JOURNAL.md, MEMORY.md, ROADMAP.md, `git status`, `git log --oneline -5`
2. **Select task**: Score all candidates, prefer capability > reliability > feature
3. **Implement**: Use `edit` for changes, `write` for new files. Keep minimal.
4. **Verify**: `assess({})` before saying DONE
5. **Complete**: Say "DONE", update JOURNAL.md and MEMORY.md scorecard

## Task Selection Scoring

Score each candidate 1-10:
- +3: Improves future iteration success rate
- +2: Reduces failure/rework rate
- +2: Improves memory/learning quality
- +1: Improves tool chain reliability
- -1 to -3: Implementation complexity

Select highest-scoring capability task.

## Skill Matching

Before starting ANY task, read matched skills: `read skills/superpowers/<name>/SKILL.md`

Priority: process skills (debugging, planning) → implementation skills

## Tool Usage

### plan — Multi-Step Reasoning
```
plan({action: 'create', steps: ['Step 1', 'Step 2', 'Step 3']})
plan({action: 'progress', stepId: 1, status: 'in_progress'})
plan({action: 'progress', stepId: 1, status: 'completed'})
```

### assess — Self-Assessment (REQUIRED before DONE)
```
assess({})                    // Basic check
assess({maxAttempts: 5})      // Auto-retry with error recovery
```

### checkpoint — Safe Rollback
```
checkpoint({action: 'create', description: 'Before risky change'})
checkpoint({action: 'list'})
checkpoint({action: 'restore', checkpointId: 'ckpt-xxx'})
```
Create before risky changes, restore if something goes wrong.

### stuck — Loop Detection
```
stuck({action: 'check'})
stuck({action: 'recover', recoveryOption: 1})  // 1=restart before loop, 2=restart with last msg, 3=quit
```

### reflect — Learn from Failures
```
reflect({taskDescription: "What you tried", errorPatterns: [...]})
```
Use after failed assessments. Auto-updates MEMORY.md.

### parallel — Concurrent Execution
```
parallel({tasks: [{name: "lint", command: "npm run lint"}, {name: "test", command: "npm test"}]})
```

## Learning from Failures

1. Capture exact error message + context
2. Root cause: why did it fail?
3. Extract the lesson/pattern
4. Update MEMORY.md with learning entry

Common patterns:
- **TypeScript**: Missing imports, wrong types, incorrect property access
- **Tests**: Edge cases, behavioral assumptions
- **Runtime**: Missing timeout, infinite loop, unresolved promise
- **API**: Invalid credentials, wrong endpoint

## Scorecard Format

Update MEMORY.md after each iteration:
```
| Date | Task Type | Description | Time | First Try | Errors | Rework? | Impact | Skills Used | Enables |
```

## Security

- Never modify `.github/workflows/` without permission
- Avoid eval(), exec() with user input
- Always run `npm run build && npm test` before committing
- Minimal changes only
