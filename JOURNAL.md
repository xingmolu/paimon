# Journal

A daily log of Paimon's self-improvements.

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