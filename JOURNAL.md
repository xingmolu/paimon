# Journal

A daily log of Paimon's self-improvements.

---

## Day 30 — Skill Effectiveness Tracking (2026-03-30)

**What happened:**
- Implemented skill effectiveness tracking in Evolution Scorecard
- Added "Skills Used" column to MEMORY.md scorecard
- Updated src/agent.ts Completion section with skill tracking format
- Updated scripts/evolve.ts scorecard update with skills field
- Updated skills/evolve/SKILL.md scorecard format with Skills Used column
- Added Skill Effectiveness metrics section to MEMORY.md
- Added new learning entry about skill analytics

**Why this matters:**
- This is a `capability` type task that improves self-evolution quality
- Tracking which skills lead to successful outcomes enables better skill selection
- Future iterations can analyze skill effectiveness to prioritize high-impact skills
- Enables data-driven skill matching decisions

**Technical details:**
- Modified MEMORY.md:
  - Added "Skills Used" column to scorecard header
  - Added Skills Used column to all 17 historical entries
  - Added Skill Effectiveness section with top used skills
  - Added new learning entry for skill effectiveness tracking
- Modified src/agent.ts:
  - Updated Completion section scorecard format with Skills Used column
- Modified scripts/evolve.ts:
  - Updated scorecard update section with Skills Used field
- Modified skills/evolve/SKILL.md:
  - Updated scorecard format with Skills Used column
  - Added Skill Effectiveness to Metrics section

**Next steps:**
- Continue improving skill analytics
- Consider adding skill recommendation system based on effectiveness data

---

## Day 29 — Specialized Subagents for Self-Evolution (2026-03-30)

**What happened:**
- Implemented ROADMAP Phase 7 "Specialized Agents"
- Created three new skills inspired by Claude Code's feature-dev plugin:
  - `explore-code` — Deep codebase exploration before making changes (inspired by code-explorer)
  - `plan-architecture` — Architecture planning before implementation (inspired by code-architect)
  - `review-changes` — Code review with confidence-based scoring (inspired by code-reviewer)
- Updated ROADMAP.md with Phase 7
- Fixed lint issues in superpowers skills (helper.js, server.cjs)

**Why this matters:**
- This is a `capability` type task that improves self-evolution quality
- Better exploration reduces blind edits and missed dependencies
- Architecture planning reduces rework from poor design choices
- Code review catches bugs and security issues before committing
- Follows proven patterns from Claude Code's specialized agents

**Technical details:**
- Created `skills/explore-code/SKILL.md`:
  - Four-step exploration process (Entry, Flow, Architecture, Patterns)
  - Output format with file:line references
  - Integration with self-evolution workflow
- Created `skills/plan-architecture/SKILL.md`:
  - Four-step planning process (Patterns, Decision, Blueprint, Sequence)
  - Implementation blueprint format
  - Integration with plan tool for tracking
- Created `skills/review-changes/SKILL.md`:
  - Confidence-based scoring (0-100, ≥80 threshold)
  - Four review areas (Bugs, Security, Quality, Guidelines)
  - Self-review checklist
- Modified ROADMAP.md:
  - Added Phase 7: Specialized Agents
  - Marked all three skills as complete

**Skill Integration:**
| Skill | When to Use | Phase |
|-------|-------------|-------|
| explore-code | Before non-trivial changes | Context Gathering |
| plan-architecture | After exploration, before coding | Implementation |
| review-changes | After implementation, before assess | Self-Assessment |

**Next steps:**
- Continue improving specialized agent capabilities
- Consider adding more specialized skills as needed

---

## Day 28 — Hook System for Pre-Tool Validation (2026-03-30)

**What happened:**
- Implemented ROADMAP Phase 6 (new) "Hook system for pre-tool validation"
- Created `src/hooks.ts` module with HookManager class
- Added `hook` tool for managing hooks (list, enable, disable, status, toggle)
- Implemented PreToolUse hook type with 3 default security hooks:
  - Block dangerous bash commands (rm -rf /, curl | bash, etc.)
  - Block modifications to .github/workflows/ files
  - Warn on dangerous code patterns (eval, exec with user input)
- Tool execution now wrapped with hook checks via `createWrappedTools()`
- Updated both chat and evolve system prompts to document hook tool

**Why this matters:**
- This is a `capability` type task that improves safety and error prevention
- Prevents dangerous actions before they happen (proactive vs reactive)
- Inspired by Claude Code's hooks system (PreToolUse, SessionStart, Stop)
- Agent can manage hooks dynamically via the hook tool
- Better security by default - blocks dangerous patterns automatically

**Technical details:**
- Created `src/hooks.ts`:
  - `HookManager` class with register, execute, enable/disable methods
  - `Hook` interface with id, type, name, description, priority, handler
  - `HookResult` interface with allow, warning, block, context fields
  - 3 default security hooks for dangerous patterns
  - Hooks stored in `~/.paimon/hooks.json`
- Modified `src/agent.ts`:
  - Added `hook` tool for hook management
  - Added `createWrappedTools()` to wrap all tools with PreToolUse hooks
  - Updated `createAgent()` to use wrapped tools
  - Updated frontmatter and system prompts
- All 72 tests pass

**Hook Tool Usage:**
```typescript
// List all hooks
hook({action: 'list'})

// Show hook status
hook({action: 'status'})

// Disable a specific hook
hook({action: 'disable', hookId: 'security-bash-dangerous'})

// Toggle hooks globally
hook({action: 'toggle'})
```

**Default Security Hooks:**
| Hook ID | Priority | Description |
|---------|----------|-------------|
| security-bash-dangerous | 100 | Blocks dangerous shell commands |
| security-write-workflows | 90 | Blocks .github/workflows/ modifications |
| security-code-dangerous | 80 | Warns on eval/exec patterns |

**Next steps:**
- Consider adding SessionStart and Stop hooks
- Add ROADMAP Phase 6 for future capability improvements

---

## Day 27 — Parallel Task Execution (2026-03-30)

**What happened:**
- Implemented ROADMAP Phase 5 "Parallel task execution"
- Added `parallel` tool for running multiple independent shell commands concurrently
- Inspired by dispatching-parallel-agents skill from obra/superpowers
- Uses Promise.all to coordinate concurrent execution
- Added 5 new tests for parallel tool

**Why this matters:**
- This is a `capability` type task that improves self-evolution efficiency
- Agent can now run multiple independent tasks simultaneously
- Time savings: lint + typecheck + tests can run in parallel instead of sequentially
- Completes ROADMAP Phase 5 - all Advanced Capabilities are now implemented

**Technical details:**
- Modified `src/agent.ts`:
  - Added `spawn` import from node:child_process
  - Added `ParallelTaskResult` and `ParallelResult` interfaces
  - Added `parallel` tool with tasks array and timeout parameters
  - Updated frontmatter and system prompts to document parallel tool
- Modified `src/agent.test.ts`:
  - Added 5 tests for parallel tool

**Parallel Tool Usage:**
```typescript
parallel({
  tasks: [
    { name: "Lint check", command: "npm run lint" },
    { name: "Type check", command: "npm run typecheck" },
    { name: "Unit tests", command: "npm test -- --run" }
  ],
  timeout: 120000
})
```

**Output Format:**
```
⚡ Parallel Execution Results
──────────────────────────────────────────────────
Total time: 5.23s
Tasks: 3 (2 ✅, 1 ❌, 0 ⏱️)
──────────────────────────────────────────────────

✅ Lint check
   Command finished in 3.45s (exit code: 0)
   
❌ Type check
   Command finished in 4.12s (exit code: 1)
   Error: ...
```

**Next steps:**
- All ROADMAP Phase 5 items are complete
- Consider adding Phase 6 for future capabilities

---

## Day 0 — Project Creation

**What happened:**
- Created new TypeScript project based on pi-mono
- Set up basic agent with tools (bash, read, write, edit, glob)
- Configured for Bailian API (GLM-5)

**Next steps:**
- Push to GitHub
- Set up GitHub Actions
- First self-evolution run

---

## Day 1 — Test Suite (2026-03-29)

**What happened:**
- Added comprehensive test suite (`src/agent.test.ts`)
- 17 tests covering all tools: bash, read, write, edit, glob
- Added agent module tests for createAgent function

**Why this matters:**
- Enables "Self-review capability" from Phase 2 roadmap
- Agent can now run `npm test` to verify code changes
- Foundation for safer self-modification

**Next steps:**
- Add GitHub Actions test step
- Memory persistence
- Issue processing

---

## Day 2 — Memory Persistence (2026-03-29)

**What happened:**
- Created `MEMORY.md` for storing learnings across sessions
- Added `memoryPath` config option to `PaimonConfig`
- Modified `buildSystemPrompt` to load and include memory contents
- Updated workflow to: read memory → work → update memory

**Why this matters:**
- Agent can now remember learnings between sessions
- Implements Issue #1 (Add memory persistence to store learnings)
- Completes first item of Phase 2 roadmap

**Next steps:**
- Issue processing (read GitHub issues, implement, close)
- Better planning using ROADMAP.md

---

## Day 3 — Claude Code Best Practices (2026-03-29)

**What happened:**
- Researched Claude Code (Anthropic's CLI agent) to learn best practices
- Studied plugin architecture: hooks, agents, skills, commands
- Enhanced system prompt with structured frontmatter
- Added Security Awareness section with protected paths and dangerous patterns
- Added Workflow Stages with clear phases (Context → Task → Implement → Verify → Commit → Complete)
- Added Best Practices section inspired by Claude Code patterns
- Updated MEMORY.md with research learnings

**Why this matters:**
- Implements Issue #2 (Study Claude Code and adopt best practices)
- Better structure for agent behavior
- Security awareness prevents dangerous modifications
- Clearer workflow improves decision-making

**Next steps:**
- Issue processing (read GitHub issues, implement, close)
- Consider adding hooks system for pre-tool checks

---

## Day 4 — Issue Processing Workflow (2026-03-29)

**What happened:**
- Enhanced system prompt with explicit issue closing workflow
- Added `gh issue close` command to Completion stage
- Added explicit `gh issue list` command to Task Selection stage
- Closed Issue #2 (Study Claude Code) which was completed in Day 3

**Why this matters:**
- Implements ROADMAP Phase 2 "Issue processing" capability
- Agents now have clear workflow for GitHub issue management
- Better integration between code changes and issue tracking

**Next steps:**
- ROADMAP Phase 3: Better planning using ROADMAP.md
- Learning from failures

---

## Day 5 — Fix CLI Hang Issue (2026-03-29)

**What happened:**
- Fixed Issue #3: CLI hangs with no response after user input
- Added 60-second timeout to `agent.run()` function
- Added debug logging via `PAIMON_DEBUG=true` environment variable
- Logs events, timing, and errors for troubleshooting

**Why this matters:**
- Critical bug fix: core functionality was broken
- Users will now see timeout error instead of infinite hang
- Debug mode helps diagnose API connectivity issues

**Technical details:**
- Modified `src/agent.ts`: Added timeout and verbose logging to run()
- Modified `src/cli.ts`: Pass debug flag from PAIMON_DEBUG env var
- Updated return type signature to accept optional verbose parameter

**Next steps:**
- ROADMAP Phase 3: Better planning using ROADMAP.md
- Consider adding API health check on startup

---

## Day 6 — Better Planning with ROADMAP.md (2026-03-29)

**What happened:**
- Enhanced Task Selection stage to explicitly use ROADMAP.md when no issues are open
- Added phase-specific guidance: issues → ROADMAP priorities
- Updated Completion stage to mark ROADMAP items done after completion
- Agent now has clear decision tree: check issues first, fallback to ROADMAP phases

**Why this matters:**
- Implements ROADMAP Phase 3 "Better planning (use ROADMAP.md)"
- Agent can make progress even when there are no open GitHub issues
- Systematic progression through roadmap phases
- Tracks progress by marking completed items

**Technical details:**
- Modified `src/agent.ts`: Enhanced system prompt Task Selection and Completion stages
- Explicit phase listing: Phase 1 & 2 complete, Phase 3 current, Phase 4 future
- Added instruction to update ROADMAP.md when items are completed

---

## Day 9 — Code Quality Checks (2026-03-29)

**What happened:**
- Added biome.json configuration for linting and formatting
- Fixed all lint issues:
  - Used `node:` protocol for Node.js builtin imports
  - Replaced `as any` with proper `ErrorMessage` interface
  - Consistent formatting across all source files
- Configured Biome to ignore `dist/` and `node_modules/`
- Enabled recommended rules plus style and suspicious checks

**Why this matters:**
- Completes ROADMAP Phase 3 "Code quality checks"
- Agent now has consistent code style enforced by tooling
- Prevents common mistakes like untyped `any` usage
- Better code maintainability and readability

**Technical details:**
- Created `biome.json` with formatter and linter settings
- Modified all source files to use `node:` import protocol
- Added `ErrorMessage` interface for type-safe error handling
- Updated package.json scripts: `npm run lint` and `npm run format`

**Next steps:**
- ROADMAP Phase 4: More tools, multi-step reasoning, context management

---

## Day 8 — Separate Chat and Evolve Modes (2026-03-29)

**What happened:**
- Added two operating modes: `chat` (default) and `evolve`
- Implemented `--mode` CLI argument and `PAIMON_MODE` environment variable
- Created separate system prompts for each mode:
  - **chat mode**: Simple assistant, no self-evolution workflow
  - **evolve mode**: Full self-evolution workflow (reading issues, ROADMAP, etc.)
- Updated `scripts/evolve.ts` to always use `evolve` mode for automated runs
- Updated README with mode documentation

**Why this matters:**
- Fixes Issue #4: Users can now have normal conversations without triggering self-evolution
- Simple inputs like "hello" no longer spawn complex workflows
- Automated evolution scripts still work correctly with explicit mode
- Clear separation between interactive chat and self-improvement

**Technical details:**
- Modified `src/agent.ts`: Added `buildChatPrompt()` and `buildEvolvePrompt()` functions
- Modified `src/cli.ts`: Added mode argument parsing and environment variable support
- Modified `scripts/evolve.ts`: Always passes `mode: 'evolve'`
- Modified `README.md`: Added Modes section with usage examples

**Next steps:**
- ROADMAP Phase 3: Code quality checks
- ROADMAP Phase 4: More tools, multi-step reasoning

---

## Day 7 — Learning from Failures (2026-03-29)

**What happened:**
- Added "Learning from Failures" section to system prompt (src/agent.ts:280-315)
- Defined 4-step process: Capture Error → Root Cause Analysis → Extract Lesson → Update Memory
- Added Common Failure Patterns to watch for (TypeScript, tests, runtime hangs, API errors)
- Marked ROADMAP Phase 3 "Learning from failures" as complete

**Why this matters:**
- Implements ROADMAP Phase 3 "Learning from failures" capability
- Agent now has explicit guidance on how to handle and learn from failures
- Creates systematic process for extracting lessons from mistakes
- Helps prevent repeating the same errors

**Technical details:**
- Modified `src/agent.ts`: Added "Learning from Failures" section between Memory and Security Awareness
- Avoided template literal escaping issues by referencing MEMORY.md format instead of inline code block
- Added 4 common failure patterns to watch for

**Next steps:**
- ROADMAP Phase 3: Code quality checks
- ROADMAP Phase 4: More tools, multi-step reasoning, better context management

---

## Day 10 — Fix Chat Mode Duplicated Text Bug (2026-03-29)

**What happened:**
- Fixed Issue #5: Chat mode outputs duplicated text in loop
- Root cause: `message_update` events contain accumulated text, not just new chunks
- Changed event handler to only use `message_end` event for final text

**Why this matters:**
- Critical bug fix: chat mode was unusable with repeated text
- Users now see clean, non-duplicated responses
- Demonstrates importance of understanding event semantics in streaming APIs

**Technical details:**
- Modified `src/agent.ts`: Removed `message_update` from event handler
- The `message_update` event sends the full accumulated message each time
- The `message_end` event has the final complete message text
- Old behavior: `["Hi", "Hi there", "Hi there!"].join("")` = duplicated text
- New behavior: `["Hi there! 👋"]` = clean output

**Next steps:**
- Issue #8: Add grep, find, ls tools for code search
- Issue #13: Implement Evaluator Agent with fix loop

---

## Day 11 — Progressive Skill Loading (2026-03-29)

**What happened:**
- Implemented Issue #7: Progressive skill loading (like pi-coding-agent)
- Added `parseFrontmatter()` function to extract YAML frontmatter from SKILL.md files
- Added `buildSkillsIndex()` function to scan skills directory and build lightweight XML index
- Updated `buildEvolvePrompt()` to use progressive disclosure: only load names/descriptions
- Added instruction for agent to read full SKILL.md on-demand when task matches skill
- Also closed Issue #8 (grep, find, ls tools were already implemented)

**Why this matters:**
- Massive token savings: skill index ~200 tokens vs 10k+ for full skill content
- Agent can discover available skills without bloating prompt
- Skills are loaded on-demand when relevant to task
- Follows Agent Skills standard (agentskills.io) for XML format

**Technical details:**
- Modified `src/agent.ts`: Added `parseFrontmatter()` and `buildSkillsIndex()` functions
- Modified `src/agent.ts`: Updated `buildEvolvePrompt()` to call `buildSkillsIndex()`
- Added `readdirSync` import for scanning skills directory
- XML format includes: `<skill><name>, <description>, <path></skill>`
- Default skills directory: "skills" (configurable via `config.skillsDir`)

**Next steps:**
- Issue #9: Context compaction for long sessions
- Issue #10: Auto-load AGENTS.md context files (partially done via src/context.ts)
- Issue #13: Implement Evaluator Agent with fix loop

---

## Day 11 — Add Code Search Tools (2026-03-29)

**What happened:**
- Implemented Issue #8: Added grep, find, ls tools for code search
- Added 3 new tools to the agent's toolset:
  - `grep`: Search file contents by regex pattern with optional include filter
  - `find`: Find files by name, type, or modification time
  - `ls`: List directory contents with optional detailed view
- Updated system prompts to document new tools
- Added 8 new tests for the tools

**Why this matters:**
- Essential for efficient code navigation and understanding
- Agent can now search for code patterns across files
- Better file discovery capabilities for complex codebases
- Enables more sophisticated code analysis workflows

**Technical details:**
- Modified `src/agent.ts`: Added 3 new tools to tools array
- Updated frontmatter to list all 8 tools: [bash, read, write, edit, glob, grep, find, ls]
- Each tool has proper error handling and timeout limits
- `grep` handles exit code 1 (no matches) gracefully

**Next steps:**
- Issue #13: Implement Evaluator Agent with fix loop
- Issue #7: Implement progressive skill loading

---

## Day 12 — Auto-load AGENTS.md Context Files (2026-03-29)

**What happened:**
- Implemented Issue #10: Auto-load AGENTS.md context files
- Created `src/context.ts` module with context loading functions
- Agent now automatically loads project context from:
  - Global `~/.paimon/AGENTS.md` (user-level settings)
  - Parent directories walking up to git root
  - Current directory's `AGENTS.md` and `CLAUDE.md` (Claude Code compatibility)
- Files are concatenated with clear separators for proper attribution

**Why this matters:**
- Improves project awareness without manual intervention
- Agent understands project conventions automatically
- Claude Code compatibility (also loads CLAUDE.md files)
- Better context for working in unfamiliar projects

**Technical details:**
- Created `src/context.ts`: `loadContextFiles()` function walks directories up to git root
- Modified `src/agent.ts`: Import and call context loader in both chat and evolve prompts
- Added `## Project Context` section to system prompts when context files exist
- Uses `findGitRoot()` to stop walking at repository boundary

**Next steps:**
- Issue #13: Implement Evaluator Agent with fix loop
- Issue #12: Implement Assessment Agent phase

---

## Day 12 — Progressive Skill Loading (2026-03-29)

**What happened:**
- Implemented Issue #7: Progressive skill loading (like pi-coding-agent)
- Added `parseFrontmatter` function to extract name and description from SKILL.md files
- Added `buildSkillsIndex` function to build XML index with only names/descriptions
- Updated `buildEvolvePrompt` to include skills index instead of loading full skill content
- Skills are now loaded on-demand when agent reads the SKILL.md file

**Why this matters:**
- Saves ~10k+ tokens at startup (only ~50 tokens per skill)
- Agent sees skill names/descriptions and loads full instructions when needed
- Follows Agent Skills specification (XML format)
- Better prompt efficiency for many skills

**Technical details:**
- Skills directory structure: skills/<name>/SKILL.md
- Parses YAML frontmatter to extract name and description
- Generates XML format: `<skills><skill><name>...</skill></skills>`
- Agent instructed to use `read skills/<name>/SKILL.md` when needed

**Next steps:**
- Issue #13: Implement Evaluator Agent with fix loop
- Issue #10: Auto-load AGENTS.md context files (already implemented in context.ts)

---

## Day 13 — Context Compaction for Long Sessions (2026-03-29)

**What happened:**
- Implemented Issue #9: Context compaction for long sessions
- Created `src/compaction.ts` module with `ContextManager` class
- Integrated compaction into `createAgent()` function
- Added conversation summary injection into system prompts when compaction occurs
- Features:
  - Token usage estimation (~4 chars per token heuristic)
  - Automatic compaction triggers at 100k tokens
  - LLM-based summarization of old messages
  - Keeps last 10 messages unsummarized
  - Debug logging via verbose mode

**Why this matters:**
- Prevents context overflow in long conversations
- Agent can handle extended sessions without hitting token limits
- Summaries preserve key decisions, errors, and progress
- More efficient use of context window

**Technical details:**
- Created `src/compaction.ts`: `ContextManager` class with `compact()`, `shouldCompact()`, `addMessage()`
- Modified `src/agent.ts`: Integrated context manager into `createAgent()`, added `getContextStatus()` method
- Modified prompt builders: Added `summary` parameter for conversation summary injection
- Configuration via `config.compaction` (can disable with `compaction: false`)
- Type-safe API response parsing for summary generation

**Next steps:**
- Issue #11: Session persistence and resume capability
- Issue #13: Implement Evaluator Agent with fix loop

---

## Day 14 — HTTP Tool for Web Requests (2026-03-30)

**What happened:**
- Added `http` tool for making HTTP requests
- Tool supports GET, POST, PUT, DELETE, PATCH methods
- Automatic JSON parsing with pretty printing
- Configurable timeout (default 30s)
- Custom headers support for API authentication
- Request body support for POST/PUT/PATCH

**Why this matters:**
- Completes ROADMAP Phase 4 "Web search, API calls"
- Agent can now fetch documentation from the web
- Enables competitor research via direct HTTP calls
- Better integration with APIs without relying on bash/curl
- Safer than shell command injection

**Technical details:**
- Modified `src/agent.ts`: Added `http` tool with Node.js native http/https modules
- Added imports for `node:http` and `node:https`
- Parameters: url, method, headers, body, timeout
- Returns formatted response with status, headers, and body
- JSON responses are pretty-printed with 2-space indentation
- Updated frontmatter and system prompts to document http tool
- Added 3 tests for http tool verification

**Next steps:**
- ROADMAP Phase 4: Multi-step reasoning, Session persistence

---

## Day 15 — Session Persistence and Resume (2026-03-30)

**What happened:**
- Implemented Issue #11: Session persistence and resume capability
- Created `src/session.ts` module with SessionManager class
- Added CLI flags: `--continue` (-c), `--resume` (-r), `--no-session`
- Sessions stored as JSONL files in `~/.paimon/sessions/`
- Organized by project (git repository name)
- Added 10 new tests for session functionality

**Why this matters:**
- Agent can now resume interrupted conversations
- Long-running tasks can be continued across sessions
- Sessions organized per-project for better context separation
- Messages have tree structure (parentId) for branching capability

**Technical details:**
- Created `src/session.ts`: SessionManager with new(), continue(), resume(), save() methods
- Modified `src/cli.ts`: Added session flags and integrated session management
- Modified `src/agent.ts`: Added optional SessionManager parameter to createAgent
- JSONL format: Each line is a JSON message with id, role, content, parentId, timestamp
- Auto-detects project name from git root or current directory

**CLI Usage:**
```bash
# Start new session (default)
npm run dev

# Continue latest session
npm run dev -- -c
npm run dev -- --continue

# List previous sessions
npm run dev -- -r
npm run dev -- --resume

# No session (ephemeral)
npm run dev -- --no-session
```

**Next steps:**
- ROADMAP Phase 4: Multi-step reasoning (final item)

---

## Day 16 — Multi-Step Reasoning (2026-03-30)

**What happened:**
- Implemented ROADMAP Phase 4 "Multi-step reasoning"
- Added `plan` tool for creating and managing step-by-step execution plans
- Tool supports 5 actions: create, update, progress, show, clear
- Plan state tracks step status (pending, in_progress, completed, skipped)
- Updated both chat and evolve system prompts with Multi-Step Reasoning section
- Added 3 new tests for plan tool

**Why this matters:**
- Completes ROADMAP Phase 4 - all Growth items are now complete
- Agent can now break down complex tasks into tracked steps
- Visual progress tracking with emoji status indicators
- Better planning and execution for multi-step tasks
- Evolution tasks can be tracked systematically

**Technical details:**
- Added `PlanState` interface in `src/agent.ts`: steps with id, description, status, notes
- Added `plan` tool: action-based API for plan management
- Added `formatPlan()` helper: visual display with emoji status (⬜ 🔄 ✅ ⏭️)
- Modified system prompts: Added Multi-Step Reasoning section with usage examples
- Global plan state shared across agent runs in session

**Plan Tool Usage:**
```typescript
// Create a plan
plan({action: 'create', steps: ['Analyze requirements', 'Implement', 'Test']})

// Mark step as in progress
plan({action: 'progress', stepId: 1, status: 'in_progress'})

// Mark step as completed
plan({action: 'progress', stepId: 1, status: 'completed'})

// Show current plan
plan({action: 'show'})

// Clear plan
plan({action: 'clear'})
```

**Next steps:**
- ROADMAP Phase 4 is now complete
- Consider Phase 5: Advanced capabilities (reflection, self-assessment, error recovery loops)

---

## Day 17 — Fix Superpowers Skill for Paimon (2026-03-30)

**What happened:**
- Fixed Issue #19: Study Claude Code skill installation and fix superpowers
- Researched Claude Code's plugin system from their GitHub repository
- Discovered key differences between Claude Code and Paimon's skill loading:
  - Claude Code: Uses "Skill" tool for skill activation, plugin.json metadata
  - Gemini CLI: Uses "activate_skill" tool
  - Paimon: Uses `read skills/<name>/SKILL.md` via the `read` tool
- Rewrote `skills/using-superpowers/SKILL.md` to work with Paimon's toolset

**Why this matters:**
- Skills must be adapted to each platform's tooling system
- Claude Code's skill format is not universal - requires platform adaptation
- Paimon uses progressive skill loading (names/descriptions in prompt, full content loaded on-demand)
- The skill now properly instructs agents to use `read skills/<name>/SKILL.md`

**Technical details:**
- Researched Claude Code plugins/README.md for skill installation mechanism
- Claude Code plugin structure: `.claude-plugin/plugin.json`, commands/, agents/, skills/, hooks/
- Paimon's simpler approach: skills directory scanned by `buildSkillsIndex()` in src/agent.ts
- Removed references to Claude Code's "Skill" tool and Gemini's "activate_skill"
- Updated skill loading flow to show Paimon's `read` tool approach
- Kept core principles (Red Flags table, Skill Priority, Skill Types)

**Claude Code Skill Installation (research findings):**
- Skills are stored in `skills/<name>/SKILL.md` with YAML frontmatter
- Claude Code uses `/plugin` command to install from marketplaces
- Configuration in `.claude/settings.json` or `.claude-plugin/plugin.json`
- Skills can have hooks (PreToolUse, SessionStart, Stop) for behavior modification
- Plugin structure includes: commands (slash commands), agents (specialized), skills, hooks, MCP servers

**Next steps:**
- Continue ROADMAP Phase 5 planning

---

## Day 18 — Competitor Research and ROADMAP Phase 5 (2026-03-30)

**What happened:**
- Researched Claude Code and Cursor for competitive insights
- Discovered Claude Code's plugin ecosystem:
  - Ralph Wiggum: Self-referential AI loops using Stop hooks for iterative development
  - Feature-dev plugin: 7-phase workflow with specialized agents (code-explorer, code-architect, code-reviewer)
  - Parallel agent launching for exploration, architecture, and review
- Discovered Cursor's features:
  - Checkpoints: Save snapshots during agent sessions for safe rollback
  - Message queuing: Queue follow-up messages while agent is working
  - Structured workflows with clear phases
- Added ROADMAP Phase 5: Advanced Capabilities
- Created skills/evolve/SKILL.md: Dedicated self-evolution skill with error recovery loops

**Why this matters:**
- All ROADMAP phases 1-4 were complete, needed Phase 5 for continued growth
- Error recovery loops are critical for autonomous self-improvement (inspired by Ralph Wiggum)
- The evolve skill provides structured guidance for future evolution sessions
- Competitive research helps identify best practices to adopt

**Technical details:**
- Added Phase 5 to ROADMAP.md with 5 items: error recovery loops, self-assessment, reflection on failures, checkpoints, parallel task execution
- Created skills/evolve/SKILL.md with YAML frontmatter and comprehensive evolution workflow
- Skill includes: Context gathering, Task selection, Planning, Implementation, Verification, Error recovery loop, Completion
- Added common failure patterns table and recovery strategies
- Documented security rules and best practices

**Key Learnings from Competitors:**
1. Claude Code's Ralph Wiggum uses Stop hooks to intercept exit attempts and continue iteration
2. Cursor has checkpoints for safe rollback during agent sessions
3. Feature development workflows benefit from specialized agents (explorer, architect, reviewer)
4. Parallel agent launching improves efficiency for exploration tasks
5. Error recovery is essential for autonomous operation

**Next steps:**
- Implement error recovery loops as code (Phase 5 item)
- Implement checkpoints for safe rollback (Phase 5 item)

---

## Day 19 — Self-Assessment Tool (2026-03-30)

**What happened:**
- Implemented ROADMAP Phase 5 "Self-assessment"
- Added `assess` tool for running automated self-assessment checks
- Tool checks: build, tests, lint, and scans for dangerous patterns
- Added Self-Assessment workflow stage between Verification and Completion
- Agent now must run assess before completing an evolution task

**Why this matters:**
- Critical for autonomous self-improvement safety
- Agent now has a structured self-review process before committing
- Detects security issues (eval, exec with user input) automatically
- Prevents bad changes from being committed without verification

**Technical details:**
- Added `AssessmentResult` interface in `src/agent.ts`
- Added `assess` tool with parameters: runBuild, runTests, runLint (all optional)
- Tool output includes status report with emoji indicators (✅ ❌ ⏭️)
- Lists changed files via git status
- Checks for dangerous patterns in modified TS/JS files
- Updated frontmatter and Tools section in both prompts
- Added Workflow Stage 5: Self-Assessment (REQUIRED) with usage example
- Added 4 new tests for assess tool

**Assess Tool Usage:**
```typescript
// Run full assessment (default)
assess({})

// Skip lint check
assess({runLint: false})

// Only run build check
assess({runBuild: true, runTests: false, runLint: false})
```

**Self-Assessment Workflow:**
1. After implementing changes, run `assess({})`
2. Check the report: Build ✅ Tests ✅ Lint ✅
3. If any checks fail, fix issues and re-run assess
4. Only proceed to Completion when all checks pass

**Next steps:**
- Implement error recovery loops (Phase 5 item)
- Implement checkpoints for safe rollback (Phase 5 item)

---

## Day 20 — Error Recovery Loops (2026-03-30)

**What happened:**
- Implemented ROADMAP Phase 5 "Error recovery loops"
- Enhanced the `assess` tool with automatic retry capability:
  - Added `maxAttempts` parameter for retry loops (default: 1, no retries)
  - Added `extractErrorPatterns()` function to parse build/test/lint errors
  - Added `ErrorPattern` interface with actionable suggestions
  - Added `getSuggestionForTsError()` for TypeScript error code suggestions
- The tool now:
  - Extracts error patterns from failures (TypeScript, test, lint)
  - Provides actionable suggestions for each detected error
  - Auto-fixes lint issues on retry attempts (`npm run lint -- --fix`)
  - Tracks attempt count and progress
- Updated system prompt with "5.1 Error Recovery Loop" section

**Why this matters:**
- Implements the Ralph Wiggum pattern from Claude Code competitor research
- Agent can now automatically retry failed builds/tests with helpful context
- Error pattern extraction accelerates debugging with actionable suggestions
- Auto-fix for lint issues reduces manual intervention
- Critical capability for autonomous self-improvement

**Technical details:**
- Modified `src/agent.ts`:
  - Added `ErrorPattern` interface (type, file, line, message, suggestion)
  - Added `extractErrorPatterns()` function with regex patterns for TS errors, test failures, lint issues
  - Added `getSuggestionForTsError()` lookup table for common TS error codes
  - Modified `assess` tool execute function with retry loop (for attempt 1..maxAttempts)
  - Changed `AssessmentResult.attempts` from optional to required (initialized to 0)
- Updated system prompts with "5.1 Error Recovery Loop" guidance
- All 45 tests pass

**Error Recovery Loop Usage:**
```typescript
// Single attempt (default)
assess({})  // Run once, report results

// Automatic retry with error recovery
assess({maxAttempts: 5})  // Retry up to 5 times
```

**Error Pattern Detection:**
- TypeScript errors (TS codes, type mismatches, missing modules)
- Test failures (FAIL markers, AssertionError messages)
- Lint issues (file:line:col format)
- Module not found errors

**Next steps:**
- Implement reflection on failures (Phase 5 item)
- Implement checkpoints for safe rollback (Phase 5 item)

---

## Day 21 — Reflection on Failures (2026-03-30)

**What happened:**
- Implemented ROADMAP Phase 5 "Reflection on failures"
- Added `reflect` tool for automatic learning extraction from failures
- Tool analyzes error patterns and generates structured MEMORY.md entries
- Automatically appends lessons to MEMORY.md in the correct format
- Updated both chat and evolve system prompts with new tool documentation
- Added "5.2 Reflection on Failures" section to workflow stages

**Why this matters:**
- Completes the failure learning loop: fail → analyze → learn → remember
- Agent can now automatically extract lessons from build/test/lint failures
- MEMORY.md gets updated without manual intervention
- Pattern-based analysis provides actionable insights for future sessions
- Critical for autonomous self-improvement and error prevention

**Technical details:**
- Added `ReflectionResult` interface in `src/agent.ts`
- Added `reflect` tool with parameters:
  - `errorPatterns`: Optional array of ErrorPattern objects
  - `taskDescription`: What was being attempted when failure occurred
  - `writeToMemory`: Boolean to control automatic MEMORY.md writing (default: true)
- Tool analyzes error types (TypeScript, test, lint) and generates:
  - Context: What was being attempted
  - Insight: Root cause analysis based on error patterns
  - Action: How to prevent similar failures
- Smart MEMORY.md insertion: Finds "## Learnings" section and inserts before "## Format"
- Added 7 new tests for the reflect tool
- Updated frontmatter in both prompts to include `reflect` tool

**Reflect Tool Usage:**
```typescript
// After assessment failure
reflect({
  taskDescription: "Implementing new tool",
  errorPatterns: assessmentResult.errorPatterns
})
```

**Next steps:**
- Implement checkpoints for safe rollback (Phase 5 item)
- Implement parallel task execution (Phase 5 item)

---

## Day 22 — Checkpoints for Safe Rollback (2026-03-30)

**What happened:**
- Implemented ROADMAP Phase 5 "Checkpoints — Save snapshots during evolution for safe rollback"
- Created `src/checkpoint.ts` module with CheckpointManager class
- Added `checkpoint` tool to the agent's toolset
- Checkpoints use git stash to save file snapshots
- Agent can create, list, restore, and delete checkpoints
- Updated both chat and evolve system prompts with checkpoint documentation
- Added workflow section 3.1 "Checkpoint Safety" for best practices
- Added 12 new tests for checkpoint functionality

**Why this matters:**
- Completes ROADMAP Phase 5 "Checkpoints" item
- Agent can now save snapshots before risky changes
- Safe rollback capability prevents catastrophic failures
- Inspired by Cursor's checkpoint feature from competitor research
- Better safety for autonomous self-improvement

**Technical details:**
- Created `src/checkpoint.ts`: CheckpointManager class with create(), list(), restore(), delete() methods
- Modified `src/agent.ts`: Added checkpoint tool with actions: create, list, restore, delete
- Checkpoints stored in `~/.paimon/checkpoints/` organized by project
- Uses git stash for reliable file snapshots
- Metadata includes: id, timestamp, description, stashRef, files, project
- Updated frontmatter in both prompts to include `checkpoint` tool
- Added workflow section for checkpoint usage before risky changes

**Checkpoint Tool Usage:**
```typescript
// Create checkpoint before risky change
checkpoint({action: 'create', description: 'Before refactoring X module'})

// List all checkpoints
checkpoint({action: 'list'})

// Restore if something goes wrong
checkpoint({action: 'restore', checkpointId: 'ckpt-123456-abc123'})

// Delete old checkpoint
checkpoint({action: 'delete', checkpointId: 'ckpt-123456-abc123'})
```

**Next steps:**
- ROADMAP Phase 5: Parallel task execution (final item)

---

## Day 26 — End-to-End Superpowers Integration (2026-03-30)

**What happened:**
- Implemented Issue #21: End-to-end superpowers integration in GitHub Actions
- Created `src/superpowers.ts` module for installing superpowers skills from obra/superpowers
- Modified `scripts/evolve.ts` to:
  - Install superpowers before evolution starts
  - Add skill matching phase (output available and matched skills before each iteration)
  - Add skill usage audit logging to `session_plan/skill_audit.jsonl`
- Enhanced `src/agent.ts` skill scanning to support multiple skill roots (project + superpowers)
- Added skill matching instructions to the evolve prompt
- Skills are now tagged with their source (project vs obra/superpowers) for clarity

**Why this matters:**
- This is a `capability` type task that improves self-evolution ability
- Superpowers skills provide structured workflows for common evolution tasks
- Skill matching ensures the right workflow is used before task execution
- Audit logging enables tracking of which superpowers are most valuable
- End-to-end integration means skills work in GitHub Actions, not just locally

**Technical details:**
- Created `src/superpowers.ts`:
  - `installSuperpowers()` - Clones obra/superpowers repo, copies MINIMUM_SKILLS to skills/superpowers
  - `verifySuperpowers()` - Checks if skills are installed
  - `getSuperpowersIndex()` - Returns XML format for prompt injection
  - MINIMUM_SKILLS: using-superpowers, brainstorming, writing-plans, systematic-debugging, verification-before-completion, requesting-code-review
- Modified `scripts/evolve.ts`:
  - Added skill installation before evolution loop
  - Added `matchSkills()` function for keyword-based skill matching
  - Added `writeSkillAudit()` for JSONL audit logging
  - Enhanced prompt with skill matching result before each iteration
- Modified `src/agent.ts`:
  - Enhanced `buildSkillsIndex()` to scan nested superpowers directory
  - Added source attribute to skill XML (project vs obra/superpowers)
  - Added skill matching instructions to evolve prompt

**Superpowers Integration Flow:**
```
GitHub Actions starts
  ↓
evolve.ts installs superpowers
  ↓
buildSkillsIndex scans skills + superpowers
  ↓
Skill matching before each iteration
  ↓
Agent reads matched skills
  ↓
Task executed with skill workflow
  ↓
Audit logged to skill_audit.jsonl
```

**Next steps:**
- ROADMAP Phase 5: Parallel task execution (final item)
- Consider adding skill effectiveness metrics to MEMORY.md scorecard

---

## Day 25 — Confidence-Based Scoring for Error Patterns (2026-03-30)

**What happened:**
- Researched Claude Code plugins for competitive insights
- Discovered confidence-based scoring pattern from code-review plugin (0-100 scoring with ≥80 threshold)
- Enhanced `assess` tool with confidence-based scoring for error patterns
- Added `confidence` field to `ErrorPattern` interface
- Updated `extractErrorPatterns()` to calculate confidence based on error type
- Added `confidenceThreshold` parameter to assess tool (default: 80)
- Recommendations now show confidence scores and filter below threshold
- Updated system prompts to document confidence-based filtering

**Why this matters:**
- This is a `capability` type task that improves assessment quality
- Filters out potential false positives from error pattern detection
- Higher precision in recommendations reduces noise
- Inspired by Claude Code's code-review plugin confidence scoring
- Better signal-to-noise ratio for error diagnosis

**Technical details:**
- Modified `src/agent.ts`:
  - Added `confidence` field to `ErrorPattern` interface
  - Updated `extractErrorPatterns()` with confidence scoring:
    - TypeScript errors with known codes: 95 confidence
    - TypeScript errors with unknown codes: 90 confidence
    - Test failures: 80 confidence
    - Assertion errors: 85 confidence
    - Lint errors: 85-95 confidence (severity-based)
    - Module not found: 95 confidence
    - Type mismatches: 80 confidence
  - Added `confidenceThreshold` parameter to assess tool
  - Updated recommendation generation to show confidence scores
  - Updated error pattern display to filter by threshold
- All 66 tests pass

**Confidence Score Levels:**
| Score | Meaning |
|-------|---------|
| 100 | Absolutely certain, definitely real |
| 75-99 | Highly confident, real and important |
| 50-74 | Moderately confident, real but minor |
| 25-49 | Somewhat confident, might be real |
| 0-24 | Not confident, likely false positive |

**Assess Tool Usage:**
```typescript
// Default threshold (80)
assess({})  // Only show patterns with ≥80% confidence

// Higher threshold (fewer results, higher precision)
assess({confidenceThreshold: 95})

// Lower threshold (more results, more noise)
assess({confidenceThreshold: 50})
```

**Next steps:**
- ROADMAP Phase 5: Parallel task execution (final item)

---

## Day 24 — Enhanced Evolution Scorecard Metrics (2026-03-30)

**What happened:**
- Enhanced Evolution Scorecard with additional metrics for better evolution tracking
- Added new columns: Time (estimation), Errors (error type), Enables (dependency tracking)
- Added detailed Metrics section: Quality metrics, Capability metrics, Error analysis, Top capabilities
- Updated skills/evolve/SKILL.md with enhanced scorecard format and guidance
- Updated src/agent.ts evolve prompt with new scorecard format
- Updated scripts/evolve.ts with enhanced scorecard instructions

**Why this matters:**
- This is a `capability` type task that improves meta-cognition for task selection
- Better metrics enable better feedback loops for evolution value scoring
- Time tracking helps identify efficiency improvements
- Error type distribution helps focus prevention efforts
- "Enables" column shows dependency chains between capabilities
- Top capabilities ranking helps identify most impactful improvements

**Technical details:**
- Modified MEMORY.md:
  - Enhanced Scorecard columns: Date, Task Type, Task Description, Time, First Try, Errors, Rework?, Impact, Enables
  - Added Metrics section with Quality metrics, Capability metrics, Error analysis, Top capabilities
  - Added all previous iterations with enhanced data
- Modified skills/evolve/SKILL.md:
  - Updated Scorecard Update section (7) with enhanced format
  - Added guidance on Time estimation (~Nm format), Errors classification, Enables field
- Modified src/agent.ts:
  - Updated Completion section (6) with enhanced scorecard format
  - Added Time, Errors, Enables column definitions
- Modified scripts/evolve.ts:
  - Updated Scorecard Update section with enhanced format
  - Added column definitions and examples

**Scorecard Enhancement:**
| Column | Purpose | Values |
|--------|---------|--------|
| Time | Efficiency tracking | ~Nm (minutes estimate) |
| Errors | Failure analysis | none, TS, test, lint, runtime |
| Enables | Dependency tracking | List of enabled capabilities |

**New Metrics Section:**
- First Try Success Rate: percentage
- Average Time: minutes
- Capability Velocity: capabilities per day
- Error Analysis: count by type
- Top Capabilities: ranked by impact

**Next steps:**
- ROADMAP Phase 5: Parallel task execution (final item)

---

## Day 23 — Evolution Value Scoring for Task Selection (2026-03-30)

**What happened:**
- Implemented Issue #20: Prioritize self-evolution capability over local infrastructure
- Restructured MEMORY.md with searchable fields (type, trigger, reuse rule, priority)
- Added Evolution Scorecard to track improvement effectiveness
- Added Task Type classification: capability, reliability, feature
- Implemented Evolution Value Scoring algorithm for task selection
- Updated skills/evolve/SKILL.md with new priority framework
- Updated scripts/evolve.ts with task scoring and selection logic
- Updated src/agent.ts with Task Selection with Evolution Value Scoring section

**Why this matters:**
- This is a `capability` type task that improves self-evolution ability itself
- Agent now scores all candidate tasks before selection
- Prefers `capability` tasks over `reliability` over `feature`
- Explicit task selection output with reasoning
- Scorecard tracks evolution impact over time
- MEMORY.md is now a decision-making tool, not just a log

**Technical details:**
- Modified MEMORY.md:
  - Added Task Types section with priority table
  - Added Evolution Scorecard with metrics
  - Restructured Learnings with Type, Trigger, Reuse Rule, Priority fields
  - Added Quick Reference section with task selection algorithm
- Modified skills/evolve/SKILL.md:
  - Added Task Types section
  - Added Evolution Value Scoring Algorithm
  - Added Scorecard Update section
  - Added capability vs reliability vs feature examples
- Modified scripts/evolve.ts:
  - Updated prompt with Task Selection with Evolution Value Scoring section
  - Added scorecard update instruction
  - Added task type classification instruction
- Modified src/agent.ts:
  - Updated Task Selection section in evolve prompt
  - Added Task Types table
  - Added Scoring Algorithm
  - Added Example Output format
  - Updated Completion section with scorecard update

**Task Selection Algorithm:**
```
1. List ALL candidates (issues + ROADMAP items + research opportunities)
2. Classify EACH task as: capability | reliability | feature
3. Score EACH on evolution value (1-10):
   +3: Improves future iteration success rate
   +2: Reduces failure/rework rate
   +2: Improves memory/learning quality
   +1: Improves tool chain reliability
   -1 to -3: Implementation complexity
4. SELECT highest-scoring capability task
5. OUTPUT a task selection table with reasoning
```

**Next steps:**
- ROADMAP Phase 5: Parallel task execution (final item)