---
name: using-superpowers
description: Use when starting any conversation - establishes how to find and use skills, requiring skill file reading before ANY response including clarifying questions
---

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST read the skill file.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. This is not optional. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## Instruction Priority

Skills override default system prompt behavior, but **user instructions always take precedence**:

1. **User's explicit instructions** (direct requests) — highest priority
2. **Skills** — override default system behavior where they conflict
3. **Default system prompt** — lowest priority

If the user says "don't use TDD" and a skill says "always use TDD," follow the user's instructions. The user is in control.

## How to Access Skills in Paimon

**Use the `read` tool to load skill content:**

```
read skills/<name>/SKILL.md
```

The system prompt includes a Skills section with available skill names and descriptions. When a task matches a skill, read the full SKILL.md file to get detailed instructions.

## Skill Loading Flow

```
User message received
        ↓
Check Skills section in system prompt
        ↓
Might any skill apply? (even 1% chance)
    ├─ YES → read skills/<name>/SKILL.md
    │          ↓
    │       Follow skill instructions exactly
    │          ↓
    │       Respond to task
    │
    └─ NO → Respond directly (including clarifications)
```

## Red Flags

These thoughts mean STOP—you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "I can check git/files quickly" | Files lack conversation context. Check for skills. |
| "Let me gather information first" | Skills tell you HOW to gather information. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "This doesn't count as a task" | Action = task. Check for skills. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "This feels productive" | Undisciplined action wastes time. Skills prevent this. |
| "I know what that means" | Knowing the concept ≠ using the skill. Read it. |

## Skill Priority

When multiple skills could apply, use this order:

1. **Process skills first** (research, self-improve) - these determine HOW to approach the task
2. **Implementation skills second** - these guide execution

"Let's build X" → check for process skills first, then implementation.
"Fix this bug" → check for debugging-related skills first, then domain-specific.

## Skill Types

**Rigid** (TDD, debugging): Follow exactly. Don't adapt away discipline.

**Flexible** (patterns): Adapt principles to context.

The skill itself tells you which.

## User Instructions

Instructions say WHAT, not HOW. "Add X" or "Fix Y" doesn't mean skip workflows.