# Memory

Persistent learnings stored across sessions.

---

## Learnings

### 2026-03-29: Claude Code Best Practices Study

**Context:** Researching Claude Code (Anthropic's CLI agent) to adopt best practices

**Insight:** Claude Code uses several powerful patterns:
1. **Structured frontmatter** - Agents have name, description, tools metadata at top
2. **Hooks system** - PreToolUse, SessionStart, Stop hooks for behavior modification
3. **Security reminders** - Pattern matching to warn about dangerous code before it's written
4. **Context injection** - Using !\`command\` to inject dynamic context in prompts
5. **Specialized agents** - Code explorer, architect, reviewer with focused roles
6. **Phased workflows** - Clear stages with specific tasks

**Action:**
- Added structured frontmatter to system prompt
- Added Security Awareness section
- Added Workflow Stages section with clear phases
- Added Best Practices section from Claude Code patterns
- Keep minimal, focused changes

---

## Format

Each learning should be:
- **Date:** When it was learned
- **Context:** What problem was being solved  
- **Insight:** What was learned
- **Action:** How to apply it