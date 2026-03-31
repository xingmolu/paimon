# Memory

Persistent learnings stored across sessions. This file participates in task selection decisions.

---

## Task Types

When evaluating tasks, classify them into these types:

| Type | Description | Priority |
|------|-------------|----------|
| `capability` | Improves self-evolution ability itself | Highest |
| `reliability` | Improves stability/safety/error handling | Medium |
| `feature` | Adds new general functionality | Lower |

**Rule:** Prefer `capability` tasks over `reliability` over `feature`. If 3+ consecutive iterations are `reliability` or `feature`, explain why no `capability` task was available.

---

## Evolution Scorecard

Track effectiveness of recent improvements:

| Date | Task Type | Task Description | Time | First Try | Errors | Rework? | Impact | Skills Used | Enables |
|------|-----------|-----------------|------|-----------|--------|---------|--------|-------------|---------|
| 2026-03-31 | capability | Error Pattern Learning - Learn from error patterns across sessions for automatic solutions | ~15m | ✅ | lint (fixed) | No | High | evolve | error-recovery |
| 2026-03-31 | capability | Trajectory Viewer Tool (Mini-SWE-Agent pattern) - View/analyze agent execution trajectories | ~15m | ✅ | lint (fixed) | No | High | evolve, research | debugging-fine-tuning |
| 2026-03-31 | capability | RAG Context Enrichment (PR-Agent pattern) - Semantic search over past sessions and learnings | ~20m | ✅ | lint (fixed) | No | High | evolve, research | context-reuse |
| 2026-03-31 | capability | Self-authorship tracking (Aider Singularity pattern, 88% metric inspiration) | ~15m | ✅ | lint (fixed) | No | High | evolve, research | self-awareness |
| 2026-03-31 | capability | Template-based prompts (Mini-SWE-Agent pattern, Jinja-style {{ var }} syntax) | ~12m | ✅ | lint (fixed) | No | High | evolve | prompt-customization |
| 2026-03-31 | capability | Baseline mode for minimal agent (RL/fine-tuning experiments) | ~10m | ✅ | lint | No | High | evolve | rl-experiments |
| 2026-03-31 | capability | Complete Issue #22 Phase 12 (extract wrap.ts, prompt.ts, slim agent.ts to 260 lines) | ~10m | ✅ | none | No | High | evolve | modular-architecture-complete |
| 2026-03-31 | capability | Complete modular architecture integration (replace inline tools with buildTools()) | ~15m | ✅ | none | No | High | evolve, plan-architecture | maintainable-codebase |
| 2026-03-31 | capability | Extract meta tools to separate files (plan, assess, reflect, checkpoint, parallel, hook, stuck, repomap, tom) | ~15m | ✅ | none | No | High | evolve, plan-architecture | modular-tools |
| 2026-03-31 | capability | Modular architecture Phase 12 foundation (truncate, file-tools, search-tools, http-tool modules) | ~25m | ✅ | lint | No | Medium | evolve, plan-architecture | modular-architecture-phase-12 |
| 2026-03-31 | capability | Linear history option (Mini-SWE-Agent pattern) | ~15m | ✅ | lint | No | High | evolve, writing-plans | debugging-fine-tuning |
| 2026-03-31 | capability | Modular architecture Phase 1 (types, errors, skills modules) | ~20m | ✅ | lint | Yes | High | evolve | modular-architecture |
| 2026-03-31 | capability | Minimal agent mode (Mini-SWE-Agent pattern) | ~20m | ✅ | none | No | High | evolve, research | minimal-baseline-mode |
| 2026-03-31 | capability | Mini-SWE-Agent simplicity research | ~15m | ✅ | none | No | High | evolve, research, using-superpowers | minimal-agent-mode |
| 2026-03-30 | reliability | Lint fix for biome.json (ignore superpowers) | ~5m | ✅ | none | No | Medium | evolve | enables-commits |
| 2026-03-30 | capability | Theory-of-Mind Module (ToM-SWE) | ~25m | ❌ | TS | Yes | High | evolve, research | user-intent-understanding |
| 2026-03-30 | capability | Repo Map (Aider Pattern) | ~25m | ❌ | lint | Yes | High | evolve, research | codebase-understanding |
| 2026-03-30 | capability | Loop detection & recovery | ~20m | ❌ | lint | Yes | High | evolve, research | autonomous-recovery |
| 2026-03-30 | capability | Specialized subagents for self-evolution | ~15m | ❌ | lint | Yes | High | evolve, explore-code, plan-architecture, review-changes | exploration-planning-review |
| 2026-03-30 | capability | Hook system for pre-tool validation | ~15m | ✅ | lint | Yes | High | evolve, systematic-debugging | proactive-safety |
| 2026-03-30 | capability | Parallel task execution | ~20m | ✅ | TS | Yes | High | evolve, writing-plans, dispatching-parallel-agents | concurrent-operations |
| 2026-03-30 | capability | End-to-end superpowers integration | ~25m | ✅ | lint | Yes | High | evolve, using-superpowers | skill-workflows |
| 2026-03-30 | capability | Checkpoints for rollback | ~15m | ✅ | none | No | High | evolve, systematic-debugging | safer-experiments |
| 2026-03-30 | capability | Reflection on failures | ~10m | ✅ | none | No | High | evolve | auto-learning |
| 2026-03-30 | capability | Error recovery loops | ~20m | ✅ | none | No | High | evolve, systematic-debugging | self-correction |
| 2026-03-30 | capability | Self-assessment tool | ~15m | ✅ | none | No | High | evolve, verification-before-completion | pre-commit-verify |
| 2026-03-30 | capability | Multi-step reasoning | ~10m | ✅ | none | No | Medium | evolve, writing-plans | task-planning |
| 2026-03-30 | capability | Session persistence | ~20m | ✅ | none | No | Medium | evolve, writing-plans | long-running-tasks |
| 2026-03-30 | capability | HTTP tool | ~10m | ✅ | none | No | Medium | evolve | web-access |
| 2026-03-30 | capability | Context compaction | ~15m | ✅ | none | No | Medium | evolve | long-sessions |
| 2026-03-30 | capability | Progressive skill loading | ~15m | ✅ | none | No | Medium | evolve | token-efficiency |
| 2026-03-30 | capability | Evolution value scoring | ~20m | ✅ | none | No | High | evolve, writing-plans | task-selection |
| 2026-03-30 | capability | Enhanced scorecard metrics | ~5m | ✅ | none | No | Medium | evolve | meta-cognition |
| 2026-03-30 | reliability | Fix chat mode bug | ~5m | ✅ | none | No | Medium | systematic-debugging | user-experience |
| 2026-03-30 | capability | Confidence-based scoring for assess | ~10m | ✅ | none | No | High | using-superpowers | better-error-filtering |
| 2026-03-30 | capability | Skill effectiveness tracking | ~10m | ✅ | none | No | High | evolve, using-superpowers, writing-plans | skill-analytics |

### Quality Metrics
- First Try Success Rate: 28/35 = 80% (last iteration)
- Average Time: ~14 minutes
- Rework Rate: 8/35 = 23%

### Capability Metrics
- Capability Tasks: 34/35 = 97%
- High Impact Capabilities: 26/34 = 76%
- Capability Velocity: 34 capabilities in 2 days = 17/day

### Error Analysis
- TypeScript Errors: 2
- Test Failures: 0
- Lint Issues: 10
- Runtime Errors: 0

### Skill Effectiveness (Top Used Skills)
1. **evolve** - Used in 23 iterations, 95% success rate when used
2. **using-superpowers** - Used in 4 iterations, skill guidance
3. **systematic-debugging** - Used in 3 iterations, debugging workflow
4. **writing-plans** - Used in 5 iterations, planning workflow
5. **research** - Used in 7 iterations, competitor research
6. **verification-before-completion** - Used in 1 iteration, quality check

### Top Capabilities (by Impact)
1. **Error Pattern Learning** - High impact, learns from error patterns across sessions for automatic solutions (OpenHands/Claude Code pattern)
1. **Trajectory Viewer** - High impact, enables debugging and fine-tuning via trajectory analysis (Mini-SWE-Agent pattern)
1. **Self-Authorship Tracking** - High impact, enables self-awareness for evolution decisions (Aider 88% Singularity pattern)
1. **Template-Based Prompts** - High impact, enables Jinja-style prompt customization (Mini-SWE-Agent pattern)
1. **Baseline Mode** - High impact, enables RL experiments and fine-tuning (Mini-SWE-Agent pattern)
1. **Modular Architecture Complete** - High impact, agent.ts reduced to 260 lines (from 502), fully modular with wrap.ts and prompt.ts extracted
1. **Modular Architecture Integration** - High impact, reduces agent.ts by 80%, single source of truth for tools
1. **Modular Tools Extraction** - High impact, enables codebase maintainability and faster iteration
1. **Linear History** - High impact, enables debugging and fine-tuning data export (Mini-SWE-Agent pattern)
2. **Minimal Agent Mode** - High impact, enables radical architecture simplification (Mini-SWE-Agent pattern, bash-only mode)
3. **Mini-SWE-Agent Simplicity** - High impact, enables radical architecture simplification (Princeton/Stanford pattern)
3. **Theory-of-Mind** - High impact, enables personalized guidance and intent understanding (OpenHands ToM-SWE pattern)
3. **Repo Map** - High impact, enables codebase understanding without reading every file (Aider pattern)
4. **Stuck Detection & Recovery** - High impact, enables autonomous loop recovery (OpenHands pattern)
5. **Hook System** - High impact, enables proactive safety before tool execution
6. **Checkpoints** - High impact, enables safer risky experiments
7. **Reflection** - High impact, enables auto-learning from failures
8. **Error Recovery** - High impact, enables self-correction loops
9. **Self-Assessment** - High impact, enables pre-commit verification
10. **Evolution Scoring** - High impact, enables better task selection
11. **Confidence-Based Scoring** - High impact, enables better error filtering
12. **Superpowers Integration** - High impact, enables skill-based workflows
13. **Parallel Execution** - High impact, enables concurrent operations
14. **Specialized Subagents** - High impact, enables exploration-planning-review
15. **Skill Effectiveness Tracking** - High impact, enables skill analytics

---

## Learnings

### 2026-03-31: Error Pattern Learning for Self-Evolution

**Type:** capability

**Context:** Implementing ROADMAP Phase 16 - Error pattern learning for automatic solutions

**Insight:** Learning from error patterns across sessions provides significant benefits:
1. **Pattern recognition** - Regex-based matching finds known error patterns
2. **Solution suggestions** - Confidence-based recommendations for fixing errors
3. **Cross-session learning** - Patterns persist to data/error-patterns.json
4. **Error classification** - Automatic detection of TypeScript, test, lint, runtime errors
5. **Incremental improvement** - Confidence increases with each occurrence

Implementation details:
- `ErrorPattern` interface with type, pattern, description, solution, confidence, occurrences
- Default patterns for common TypeScript, test, lint, runtime errors
- `detectErrorType()` classifies error by category
- `learnFromError()` extracts and generalizes patterns
- `matchError()` finds known solutions
- `getSuggestions()` returns ranked solutions
- Persistence to data/error-patterns.json

**Trigger:** When encountering errors during self-evolution

**Reuse Rule:** Use `errorPatterns({action: 'match', error: 'message'})` to find solutions. Use `errorPatterns({action: 'learn', error: 'message', solution: 'fix'})` to learn new patterns.

**Priority:** High

---

### 2026-03-30: Theory-of-Mind Module from OpenHands ToM-SWE

**Type:** capability

**Context:** Implementing ROADMAP Phase 10 - Theory-of-Mind module inspired by OpenHands' ToM-SWE package

**Insight:** OpenHands' ToM-SWE package provides personalized user understanding through:
1. **Three-Tier Memory**: Cleaned sessions → Session analyses → User profiles
2. **Agent Consultation**: Personalized guidance based on user preferences and working styles
3. **Session Analysis**: Extract insights from past sessions to improve future iterations
4. **Preference Tracking**: Track skills that work, common errors, and average iteration times
5. **Confidence Scoring**: Calculate confidence based on analysis depth

**Trigger:** When needing to understand user intent or provide personalized guidance during self-evolution

**Reuse Rule:** Use `tom({action: 'consult'})` before complex tasks to get personalized recommendations. Use `tom({action: 'analyze', sessionData: {...}})` after each iteration to build user profile.

**Priority:** High

---

### 2026-03-30: Loop Detection and Recovery from OpenHands

**Type:** capability

**Context:** Implementing ROADMAP Phase 8 - stuck detection and recovery inspired by OpenHands' StuckDetector

**Insight:** OpenHands has a sophisticated StuckDetector that detects multiple loop types and provides recovery options:
1. **Loop types detected**: repeated_action (same tool called 3+ times), same_error (same error 3+ times), no_progress (similar content 5+ times)
2. **Recovery options**: restart before loop (preserves earlier progress), restart with last message (try different approach), quit task
3. **Memory truncation**: Can truncate conversation history to recovery points to remove loop context
4. **Autonomous operation**: Critical for long-running sessions without human intervention

**Trigger:** When agent appears stuck in a loop during autonomous evolution

**Reuse Rule:** Call `stuck({action: 'check'})` periodically during long tasks. If stuck, use `stuck({action: 'recover', recoveryOption: N})` to recover.

**Priority:** High

---

### 2026-03-30: Specialized Subagents for Self-Evolution

**Type:** capability

**Context:** Implementing ROADMAP Phase 7 - specialized skills for exploration, planning, and review

**Insight:** Specialized subagents (explore-code, plan-architecture, review-changes) improve self-evolution quality by providing dedicated roles for each phase:
1. **explore-code** - Deep codebase exploration before changes reduces blind edits
2. **plan-architecture** - Architecture planning before coding reduces rework
3. **review-changes** - Code review with confidence scoring catches bugs early
4. Each skill should be invoked at specific workflow stages (Context → Planning → Assessment)
5. Confidence-based scoring (≥80 threshold) filters false positives from real issues

**Trigger:** When making non-trivial code changes requiring multiple files

**Reuse Rule:** Always invoke explore-code before complex changes, plan-architecture before implementation, review-changes before assess.

**Priority:** High

---

### 2026-03-30: Hook System for Pre-Tool Validation

**Type:** capability

**Context:** Implementing hook system inspired by Claude Code's hooks (PreToolUse, SessionStart, Stop)

**Insight:** Hook systems provide proactive safety by intercepting tool calls before execution:
1. **PreToolUse hooks** - Check parameters before tool execution, can block or warn
2. **Priority-based execution** - Higher priority hooks run first, enabling layered security
3. **Default security hooks** - Block dangerous patterns (rm -rf /, curl | bash) and protected paths
4. **Dynamic management** - Hooks can be enabled/disabled at runtime via hook tool
5. **Wrapped tool execution** - All tools wrapped to check hooks before execution

**Trigger:** When implementing safety or validation mechanisms

**Reuse Rule:** Wrap tool execution with PreToolUse hooks. Use priority 100 for critical security, 90 for important validations, 80 for warnings.

**Priority:** High

---

### 2026-03-30: Confidence-Based Scoring for Error Filtering

**Type:** capability

**Context:** Implementing confidence-based scoring for the assess tool after researching Claude Code's code-review plugin

**Insight:** Confidence scoring (0-100) with threshold filtering dramatically improves error pattern detection quality:
1. **Error type determines confidence** - TypeScript errors with known codes (95%), test failures (80%), lint errors (85-95%)
2. **Default threshold of 80** filters out most false positives while keeping real issues
3. **Confidence display** helps users understand reliability of each suggestion
4. **Threshold adjustment** allows flexibility for different use cases

**Trigger:** When implementing error detection or recommendation systems

**Reuse Rule:** Always add confidence scores to error patterns. Use 80 as default threshold. Show confidence percentages in output.

**Priority:** High

---

### 2026-03-30: Evolution Value Scoring

**Type:** capability

**Context:** Implementing Issue #20 - prioritize self-evolution capability over local infrastructure

**Insight:** Task selection should not be simple priority order (issues → ROADMAP → research). Instead:
1. Score each candidate task on evolution value
2. Consider: future iteration success rate, failure rate reduction, memory quality improvement
3. Explicitly output why this task was selected
4. Track task types and prefer `capability` over `reliability` over `feature`

**Trigger:** When selecting next task to implement

**Reuse Rule:** Before any task selection:
1. List all candidate tasks (issues + ROADMAP items)
2. Classify each as capability/reliability/feature
3. Score each on evolution value (1-10)
4. Select highest-scoring capability task
5. If no capability tasks, explain why

**Priority:** High

---

### 2026-03-29: Debug Timeout Pattern for Async Operations

**Type:** reliability

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

**Trigger:** When creating any async function that returns Promise

**Reuse Rule:** Always wrap event-based Promises with timeout + cleanup

**Priority:** High

---

### 2026-03-29: Claude Code Best Practices Study

**Type:** capability

**Context:** Researching Claude Code (Anthropic's CLI agent) to adopt best practices

**Insight:** Claude Code uses several powerful patterns:
1. **Structured frontmatter** - Agents have name, description, tools metadata at top
2. **Hooks system** - PreToolUse, SessionStart, Stop hooks for behavior modification
3. **Security reminders** - Pattern matching to warn about dangerous code before it's written
4. **Context injection** - Using !\`command\` to inject dynamic context in prompts
5. **Specialized agents** - Code explorer, architect, reviewer with focused roles
6. **Phased workflows** - Clear stages with specific tasks

**Trigger:** When improving agent capabilities or workflow

**Reuse Rule:** Study successful agents and adapt their patterns. Hooks and security reminders are high-value.

**Action:**
- Added structured frontmatter to system prompt
- Added Security Awareness section
- Added Workflow Stages section with clear phases
- Added Best Practices section from Claude Code patterns
- Keep minimal, focused changes

**Priority:** High

---

### 2026-03-30: Competitor Research Patterns for Self-Evolution

**Type:** capability

**Context:** Researched Claude Code and Cursor to identify improvements for Paimon

**Insight:** Key patterns from successful AI coding agents:
1. **Ralph Wiggum Pattern** — Claude Code uses Stop hooks to intercept exit attempts and continue iteration, enabling autonomous error recovery loops
2. **Checkpoints** — Cursor saves snapshots during agent sessions for safe rollback
3. **Specialized Agents** — Feature development benefits from code-explorer, code-architect, code-reviewer roles
4. **Parallel Launching** — Multiple agents run in parallel for exploration, architecture, and review
5. **Structured Workflows** — Clear phases (Discovery → Exploration → Clarifying → Architecture → Implementation → Review → Summary)

**Trigger:** When planning major capability improvements

**Reuse Rule:** Research competitors before implementing major features. Ralph Wiggum pattern enables autonomous iteration.

**Action:**
- Added ROADMAP Phase 5 with advanced capabilities
- Created skills/evolve/SKILL.md for structured self-evolution
- Error recovery loops should be implemented as core capability
- Consider adding checkpoint mechanism for safe rollback

**Priority:** High

---

### 2026-03-29: Check Git State Before Editing

**Type:** reliability

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

**Trigger:** Before starting any implementation work

**Reuse Rule:** Always run git status && git log && gh issue list before editing files

**Priority:** Medium

---

### 2026-03-30: Issue Closure Verification

**Type:** reliability

**Context:** Issue #11 was closed but ROADMAP showed it as incomplete - no actual implementation existed

**Insight:** When checking issues:
1. **Verify implementation exists** - Check for files mentioned in issue spec
2. **Don't trust issue state alone** - ROADMAP may show incomplete items
3. **Re-implement if needed** - Just because issue is closed doesn't mean it's done

**Pattern:**
```bash
# Before working on "completed" ROADMAP items
ls src/  # Check if implementation files exist
git log --oneline | grep -i <feature>  # Check if commits exist
gh issue view <number>  # Check issue status and comments
```

**Trigger:** When an issue or ROADMAP item appears "complete"

**Reuse Rule:** Verify implementation exists with file checks before assuming something is done

**Priority:** Medium

---

### 2026-03-30: Skill Effectiveness Tracking

**Type:** capability

**Context:** Adding skill analytics to track which skills lead to successful outcomes

**Insight:** Tracking which skills are actively used during iterations enables:
1. **Skill effectiveness analysis** - Identify which skills improve success rates
2. **Better skill selection** - Future iterations can prioritize effective skills
3. **Skill audit trail** - JSONL logging provides detailed skill usage history
4. **Scorecard enhancement** - "Skills Used" column tracks skill-to-outcome mapping

**Trigger:** When evaluating skill effectiveness or improving skill selection

**Reuse Rule:** Log skills used in each iteration to MEMORY.md scorecard. Analyze skill effectiveness metrics to improve future skill matching.

**Priority:** High

---

### 2026-03-30: Repo Map for Codebase Understanding

**Type:** capability

**Context:** Implementing ROADMAP Phase 9 - Repo Map inspired by Aider's RepoMap

**Insight:** Aider's RepoMap provides a structured view of codebase definitions without reading every file:
1. **Definition extraction** - Regex-based parsing for functions, classes, interfaces, types
2. **File importance scoring** - PageRank-like algorithm prioritizes important files
3. **Token budget management** - Fits map within context limits with truncation
4. **Import reference tracking** - Shows dependencies between files
5. **Simpler than tree-sitter** - Regex parsing is sufficient for TypeScript/JavaScript

**Trigger:** When needing to understand codebase structure quickly

**Reuse Rule:** Use `repomap({})` before complex evolution tasks. Generate map at session start for context.

**Priority:** High

---

### 2026-03-31: Modular Architecture Foundation

**Type:** capability

**Context:** Implementing Issue #22 - Split agent.ts into modular architecture

**Insight:** Extracting tools to separate modules provides clear benefits:
1. **Reduced context bloat** - Each tool file is smaller and easier to understand
2. **Better organization** - Tools grouped by category (file, search, http)
3. **Incremental extraction** - Can extract tools progressively without breaking changes
4. **Preserved functionality** - All tests pass with extracted modules

Implementation details:
- `src/truncate.ts` - Utility for truncating tool output (20 lines)
- `src/tools/file-tools.ts` - bash, read, write, edit tools (158 lines)
- `src/tools/search-tools.ts` - glob, grep, find, ls tools (186 lines)
- `src/tools/http-tool.ts` - http tool (117 lines)
- `src/tools/index.ts` - Tool registry and re-exports (57 lines)
- Total extracted: 538 lines (from agent.ts which is still 2587 lines with inline tools)

**Trigger:** When agent.ts grows too large and causes context overflow

**Reuse Rule:** Create tools in separate modules, import via tools/index.ts. Extract utilities first (truncate), then file tools, then search tools, then meta tools.

**Priority:** High

---

### 2026-03-31: Linear History for Debugging/Fine-tuning

**Type:** capability

**Context:** Implementing ROADMAP Phase 11 - Linear history option for main agent (Mini-SWE-Agent pattern)

**Insight:** Linear message history provides significant benefits for debugging and fine-tuning:
1. **Append-only tracking** - Every user/assistant interaction is stored chronologically
2. **Easy export** - JSON format for fine-tuning datasets
3. **Session persistence** - save/load history for long-running sessions
4. **Minimal overhead** - Just an array push per message
5. **CLI flag** - `--linear` or `-l` enables this mode

Implementation details:
- `LinearMessage` type in types.ts: `{ role, content, timestamp }`
- `config.linearHistory: boolean` option
- Methods: `getHistory()`, `getHistoryJson()`, `saveHistory()`, `loadHistory()`, `clearHistory()`
- Methods only available when `linearHistory: true`

**Trigger:** When needing to debug agent behavior or prepare fine-tuning data

**Reuse Rule:** Use `--linear` flag when running long sessions or when debugging agent behavior. Export history with `getHistoryJson()` for analysis.

**Priority:** High

---

### 2026-03-31: Minimal Agent Mode Implementation

**Type:** capability

**Context:** Implementing ROADMAP Phase 11 - Minimal agent mode inspired by Mini-SWE-Agent (Princeton/Stanford)

**Insight:** MinimalAgent class with only bash tool achieves radical simplification:
1. **Bash-only design** - Shell commands can do everything: read files (cat), write files (echo >), search (grep), etc. No need for specialized file tools.
2. **Linear message history** - Append-only history makes debugging and fine-tuning easier. Every interaction is just added to the messages array.
3. **Independent subprocess execution** - execSync for each command, no stateful shell session. Makes sandboxing trivial (just switch execSync with docker exec).
4. **Template-based system prompt** - Easy to customize with custom system prompts via setSystemPrompt() method.
5. **History export/import** - getHistoryJson(), saveHistory(), loadHistory() enable session persistence and fine-tuning data export.

Implementation details:
- ~150 lines for full MinimalAgent class (still very compact)
- CLI flag: `--minimal` or `-m` activates minimal mode
- Full linear history tracking with export/import capability
- Compatible with existing session management

**Trigger:** When a simpler baseline agent is needed for debugging, testing, or fine-tuning experiments

**Reuse Rule:** Use `--minimal` flag to activate minimal mode. The agent will only use bash commands, making it simpler and easier to debug. Use `getHistory()` to export message history for analysis.

**Priority:** High

---

### 2026-03-31: Trajectory Viewer Pattern (Mini-SWE-Agent)

**Type:** capability

**Context:** Implementing ROADMAP Phase 15 - Trajectory viewer inspired by Mini-SWE-Agent's trajectory browser

**Insight:** Mini-SWE-Agent's trajectory browser provides critical debugging and fine-tuning capabilities:
1. **Trajectory visualization** - Step-by-step breakdown of agent execution history
2. **Pattern analysis** - Success rates, error rates, tool usage statistics
3. **Format compatibility** - Mini-SWE-Agent format export enables compatibility with existing tooling
4. **Fine-tuning preparation** - Trajectories can be exported for RL/fine-tuning datasets
5. **Debugging support** - View exactly what the agent did at each step

**Trigger:** When needing to debug agent behavior or prepare fine-tuning data

**Reuse Rule:** Use `trajectory({action: 'list'})` to find trajectories, `trajectory({action: 'view', name: '...'})` to inspect them, and `trajectory({action: 'analyze'})` to find patterns.

**Priority:** High

---

### 2026-03-31: Self-Authorship Tracking (Aider Singularity Pattern)

**Type:** capability

**Context:** Implementing ROADMAP Phase 13 - Self-authorship tracking inspired by Aider's 88% Singularity metric

**Insight:** Aider's "Singularity" metric (88% of code written by itself) provides critical self-awareness for self-evolution:
1. **Self-authorship tracking** - Know which code the agent authored vs humans via git commit analysis
2. **Bot author detection** - Recognize `paimon[bot]` commits as self-authored
3. **File-level analysis** - Git blame shows line-level authorship for individual files
4. **Confidence decisions** - Be more confident modifying bot-authored code (>50% Paimon-authored)
5. **Evolution progress tracking** - Track how much the agent has grown itself over time
6. **Author breakdown** - See contribution percentages by each developer

**Trigger:** When needing to understand code origin before modifications, or tracking evolution progress

**Reuse Rule:** Use `singularity({action: 'report'})` to get full stats. Use `singularity({action: 'check', file: 'path'})` before modifying files. Be more confident with bot-authored code.

**Priority:** High

---

### 2026-03-31: Mini-SWE-Agent Simplicity Patterns

**Type:** capability

**Context:** Researching Mini-SWE-Agent (Princeton/Stanford team) after all ROADMAP phases completed

**Insight:** Mini-SWE-Agent achieves 74% on SWE-bench verified with just 100 lines of Python:
1. **No special tools** - Only bash commands, no tool-calling interface needed. The LM uses shell to its full potential instead of custom tools.
2. **Linear message history** - Every step just appends to messages. No complex history processing. Great for debugging and fine-tuning.
3. **Independent subprocess execution** - `subprocess.run` for each action, no stateful shell session. This makes sandboxing trivial (just switch `subprocess.run` with `docker exec`).
4. **Template-based prompts** - Jinja templates for system and instance messages, easy to customize.
5. **Simplicity is powerful** - "What if our agent was 100x simpler, and still worked nearly as well?" - radical simplification approach.

Key architecture points:
- `DefaultAgent` class: `run()` → `step()` → `query()` + `execute_actions()` loop
- Messages are the trajectory - no separation between messages and history
- Works with any model (doesn't require tool-calling interface)
- Perfect baseline for fine-tuning and RL

**Trigger:** When considering agent architecture simplification or evaluating tool complexity

**Reuse Rule:** Consider minimal agent mode for simpler tasks. Evaluate if current tool complexity is necessary. Use linear history for easier debugging.

**Priority:** High

---

## Memory Format

Each learning entry should have:
- **Type:** capability | reliability | feature
- **Context:** What problem was being solved
- **Insight:** What was learned
- **Trigger:** When this learning should be applied
- **Reuse Rule:** How to apply this in future
- **Priority:** High | Medium | Low
- **Action:** (optional) What was done

---

## Quick Reference

### High Priority Learnings
1. Evolution Value Scoring - Score tasks before selection
2. Timeout Pattern - Always wrap async with timeout
3. Claude Code Patterns - Study and adapt successful agents
4. Competitor Research - Ralph Wiggum, Checkpoints, Specialized Agents

### Task Selection Algorithm
```
1. List candidates (open issues + ROADMAP incomplete items)
2. Classify each: capability | reliability | feature
3. Score each on evolution value (1-10):
   - Future iteration success improvement: +3
   - Failure rate reduction: +2
   - Memory quality improvement: +2
   - Implementation cost: -1 (complex) to -3 (very complex)
4. Select highest-scoring capability task
5. If no capability tasks, select highest-scoring reliability
6. Explain selection in output
```

### When to Use MEMORY.md
- **Before task selection** - Review relevant learnings, check priority
- **After failure** - Check for similar patterns, learn from past
- **When stuck** - Search for trigger conditions, find applicable rules
- **After success** - Add new learning if pattern is reusable

---

### 2026-03-30: Verification Before Commit

**Type:** reliability

**Context:** Iteration 1 failed verification

**Insight:** 
- Build: PASS
- Tests: PASS
- Error: Error: 400 <400> InternalError.Algo.InvalidParameter: Range of input length should be [1, 202745]

**Trigger:** Before committing any changes

**Reuse Rule:** Always run `npm run build && npm test -- --run` before committing. Use assess({}) tool for verification.

**Priority:** High

