# Memory

Persistent learnings stored across sessions.

---

## Learnings

### 2026-03-29: Debug Timeout Pattern for Async Operations

**Context:** CLI was hanging indefinitely with no error message

**Insight:** When dealing with async operations (API calls, event-based systems):
1. **Always add a timeout** - Never let a Promise hang forever
2. **Log events for debugging** - Track when operations start/end, what events fire
3. **Clear timeouts on completion** - Prevent memory leaks and false errors
4. **Use environment variables for debug mode** - PAIMON_DEBUG=true for troubleshooting

**Code pattern:**
```typescript
const run = (prompt: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout')), 60000);
    
    agent.subscribe((event) => {
      if (event.type === 'agent_end') {
        clearTimeout(timeout);
        resolve(outputs.join(''));
      }
    });
    
    agent.prompt(prompt).catch(error => {
      clearTimeout(timeout);
      reject(error);
    });
  });
};
```

---

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

---

### 2026-03-29: Check Git State Before Editing

**Context:** Attempted to edit a file that had already been modified in previous sessions

**Insight:** In self-evolution workflows, the codebase may change between sessions:
1. **Always check git status** - Run `git status` and `git log` before starting
2. **Verify file exists** - Read the file to see its current state
3. **Check issue status** - Issues may be closed in previous iterations
4. **Don't assume file state** - The codebase evolves, so verify before editing

**Pattern:**
```bash
# Check state before working
git status --porcelain  # See uncommitted changes
git log --oneline -5    # See recent commits
gh issue list --state open  # See open issues
gh issue view <number>  # Check specific issue
```

**Action:**
- Always verify git state before starting work
- Check if features are already implemented
- Close duplicate issues that were already completed

---

### 2026-03-29: Verification Before Commit

**Context:** Iteration 1 failed verification

**Insight:** 
- Build: FAIL
- Tests: PASS
- Error: Error: Agent timeout after 180.0s. No response received.

**Action:** Always run `npm run build && npm test -- --run` before committing changes. If tests fail, do not commit.

