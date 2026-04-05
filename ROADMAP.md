# Roadmap

Planned improvements for evo.

## Phase 1: Foundation
- [x] TypeScript project setup
- [x] Basic agent working with Bailian API
- [x] Self-evolution script
- [x] GitHub Actions automation

## Phase 2: Self-Improvement
- [x] Self-review capability (run tests)
- [x] Memory persistence (store learnings)
- [x] Issue processing (read, implement, close)

## Phase 3: Intelligence
- [x] Better planning (use ROADMAP.md)
- [x] Learning from failures
- [x] Code quality checks

## Phase 4: Growth
- [x] More tools (grep, find, ls for code search) — Issue #8
- [x] Progressive skill loading — Issue #7
- [x] Context file loading (AGENTS.md, CLAUDE.md) — Issue #10
- [x] Web search, API calls — Added http tool
- [x] Multi-step reasoning — Added plan tool for step-by-step task execution
- [x] Context compaction for long sessions — Issue #9
- [x] Session persistence and resume — Issue #11

## Phase 5: Advanced Capabilities
- [x] Error recovery loops — Iterative self-correction when builds/tests fail
- [x] Self-assessment — Evaluate own changes before committing
- [x] Reflection on failures — Extract lessons and update MEMORY.md automatically
- [x] Checkpoints — Save snapshots during evolution for safe rollback
- [x] Parallel task execution — Run multiple independent tasks concurrently

## Phase 6: Safety & Validation
- [x] Hook system for pre-tool validation — Inspired by Claude Code's PreToolUse hooks

## Phase 7: Specialized Agents
- [x] explore-code skill — Deep codebase exploration before making changes (inspired by Claude Code's code-explorer)
- [x] plan-architecture skill — Architecture planning before implementation (inspired by Claude Code's code-architect)
- [x] review-changes skill — Code review with confidence-based scoring (inspired by Claude Code's code-reviewer)

## Phase 8: Loop Detection & Recovery (OpenHands Pattern)
- [x] Stuck detector — Detect when agent is looping (repeated actions, same errors)
- [x] Loop recovery — Multiple recovery options: restart before loop, restart with last instruction, quit
- [x] Memory truncation — Truncate history to recovery points

## Phase 9: Repo Map (Aider Pattern)
- [x] RepoMap module — Generate structured map of codebase definitions
- [x] repomap tool — Tool for generating repo maps with token budget
- [x] Definition extraction — Extract functions, classes, interfaces, types from TypeScript/JavaScript
- [x] File importance scoring — PageRank-like algorithm for ranking files by importance
- [x] Token budget management — Fit map within context limits

## Phase 10: Theory-of-Mind (OpenHands ToM-SWE Pattern)
- [x] TomModule — Three-Tier Memory system (sessions → analyses → profiles)
- [x] tom tool — Consultation for personalized guidance based on user understanding
- [x] User profile tracking — Track evolution preferences, working styles, and patterns
- [x] Intent understanding — Reduce rework rate by understanding user intent better
- [x] Session analysis — Extract insights from past evolution sessions

## Phase 11: Minimal Agent Mode (Mini-SWE-Agent Pattern)
- [x] Minimal agent mode — Optional simpler agent with only bash tool (inspired by Mini-SWE-Agent)
- [x] Linear history option — Append-only message history for easier debugging/fine-tuning
- [x] Independent execution — subprocess.run for each action instead of stateful shell (already uses execSync)
- [x] Template-based prompts — Jinja-style templates with {{ variable }} syntax for easier customization
- [x] Baseline mode — Minimal mode for fine-tuning and RL experiments

## Phase 12: Modular Architecture (Issue #22)
- [x] Extract truncateToolOutput to src/truncate.ts
- [x] Create src/tools/ directory structure
- [x] Extract file tools (bash, read, write, edit) to src/tools/file-tools.ts
- [x] Extract search tools (glob, grep, find, ls) to src/tools/search-tools.ts
- [x] Extract http tool to src/tools/http-tool.ts
- [x] Create src/tools/index.ts to re-export tools
- [x] Extract meta tools (plan, assess, reflect, checkpoint, parallel, hook) to separate files
- [x] Extract module tools (stuck, repomap, tom) to separate files
- [x] Update agent.ts to use extracted tools (remove inline definitions)
- [x] Extract createWrappedTools to src/wrap.ts
- [x] Extract buildSystemPrompt to src/prompt.ts
- [x] Slim down src/agent.ts to under 300 lines
- [x] All tests pass with modular architecture

## Phase 13: Self-Authorship Tracking (Aider Singularity Pattern)
- [x] Singularity module — Track self-authorship percentage via git commit analysis
- [x] singularity tool — Tool for tracking how much code was written by Paimon vs humans
- [x] Bot author detection — Recognize paimon[bot] commits as self-authored
- [x] File-level analysis — Analyze individual files for bot vs human authorship
- [x] Author breakdown — Track contributions by each author

## Phase 14: RAG Context Enrichment (PR-Agent Pattern)
- [x] RagModule — Keyword-based semantic search over past sessions, learnings, and reflections
- [x] rag tool — Tool for searching and enriching context before tasks
- [x] TF-IDF scoring — Term frequency-inverse document frequency for relevance ranking
- [x] Inverted index — Efficient keyword search with term frequencies
- [x] Context enrichment — Get relevant past context for new tasks

## Phase 15: Trajectory Viewer (Mini-SWE-Agent Pattern)
- [x] TrajectoryViewer module — View and analyze agent execution trajectories
- [x] trajectory tool — Tool for trajectory viewing and analysis
- [x] Trajectory listing — List saved trajectories with metadata preview
- [x] Trajectory analysis — Pattern analysis (success rate, error rate, tool usage)
- [x] Mini-SWE-Agent format — Export compatibility with Mini-SWE-Agent trajectory format

## Phase 16: Error Pattern Learning
- [x] ErrorPatternLearner module — Learn from error patterns across sessions
- [x] errorPatterns tool — Tool for pattern matching and suggestions
- [x] Pattern generalization — Extract regex patterns from error messages
- [x] Solution suggestions — Confidence-based solution recommendations
- [x] Pattern persistence — Save learned patterns to data/error-patterns.json

## Phase 17: Evolution Pattern Mining
- [x] PatternMiner module — Mine successful patterns from session history
- [x] patternMiner tool — Tool for pattern recommendations and analysis
- [x] Skill combination patterns — Identify skills that work well together
- [x] Task type patterns — Track success rates by task type
- [x] Time patterns — Identify optimal time ranges for tasks
- [x] Error avoidance patterns — Find approaches that avoid errors

## Phase 18: Bug Report Generator
- [x] BugReportGenerator module — Auto-generate structured bug reports from failed sessions
- [x] bugReport tool — Tool for generating and managing bug reports
- [x] Error type detection — Classify errors by type (typescript, test, lint, runtime)
- [x] Context capture — Capture git state, changed files, recent commits
- [x] Suggested fixes — Generate fix suggestions based on error patterns
- [x] GitHub issue format — Format bug reports as GitHub issues

## Phase 19: Auto-Commit Message Generation (Aider Pattern)
- [x] CommitMessageGenerator module — Generate conventional commit messages from git diffs
- [x] commitMsg tool — Tool for generating commit messages with preview/stats/commit actions
- [x] Conventional commit format — Support feat, fix, refactor, docs, test, chore types
- [x] Diff analysis — Parse git diffs to extract files, lines added/removed
- [x] Type detection — Detect commit type from diff patterns
- [x] LLM generation — Optional LLM-based commit message generation
- [x] Rule-based fallback — Simple rules for commit type detection without LLM

## Phase 20: Model Roulette (Mini-SWE-Agent Pattern)
- [x] ModelRoulette module — Random model switching for improved performance
- [x] roulette tool — Tool for model selection and statistics
- [x] Multiple strategies — random, weighted, round-robin selection
- [x] Statistics tracking — Track model performance for analysis
- [x] Minimal agent integration — Roulette support in MinimalAgentConfig
- [x] Seeded random — Reproducible experiments with fixed seed

## Phase 21: Plugins/Extensions System (Claude Code/OpenHands Pattern)
- [x] PluginManager module — Plugin discovery, loading, and management
- [x] plugins tool — Tool for listing, enabling, disabling plugins
- [x] Plugin manifest — YAML/JSON manifest for plugin metadata
- [x] Tool plugins — Dynamic tool registration from plugins
- [x] Hook plugins — Dynamic hook registration from plugins
- [x] Plugin directories — Support for multiple plugin directories

## Phase 22: Evolution Metrics Dashboard
- [x] EvolutionMetricsTracker module — Track and visualize evolution metrics over time
- [x] metrics tool — Tool for viewing metrics dashboard and analysis
- [x] Success rate trends — Weekly success rate tracking with trend indicators
- [x] Time metrics — Average time by task type with trend analysis
- [x] Error metrics — Error counts by type with common pattern detection
- [x] Skill effectiveness — Track skill usage counts and success rates
- [x] Capability velocity — Track capabilities per day and high impact percentage

## Phase 23: Task Success Predictor
- [x] TaskSuccessPredictor module — Predict task success before starting
- [x] taskPredictor tool — Tool for task prediction and analysis
- [x] Success probability — Predict success likelihood from historical patterns
- [x] Risk factors — Identify factors that increase failure risk
- [x] Recommended skills — Suggest skills based on historical success
- [x] Similar tasks — Find similar successful and failed tasks
- [x] Prediction stats — Track prediction accuracy over time

## Phase 24: Unified Evolution Intelligence
- [x] EvolutionIntelligence module — Unified system for task selection intelligence
- [x] intelligence tool — Single entry point for all intelligence recommendations
- [x] Task predictor integration — Integrate TaskSuccessPredictor for success predictions
- [x] Pattern miner integration — Integrate PatternMiner for pattern recommendations
- [x] Error patterns integration — Integrate ErrorPatternLearner for error risks
- [x] RAG integration — Integrate RagModule for context enrichment
- [x] Combined confidence scoring — Weighted scoring from all sources
- [x] Unified recommendations — Overall recommendation with risks and opportunities

## Phase 25: SDK/API for Programmatic Evolution
- [x] EvolutionSDK class — Programmatic API for self-evolution
- [x] sdk tool — Tool interface for SDK management
- [x] Session management — startSession(), runIteration(), stopSession()
- [x] Batch evolution — batchEvolve() with callbacks and thresholds
- [x] Intelligence integration — Integrated predictions and recommendations
- [x] Error pattern matching — Match errors against known patterns
- [x] Statistics tracking — Track sessions, iterations, success rates

## Phase 26: SWE-bench Benchmark Integration
- [x] BenchmarkRunner module — Run benchmark tasks for evaluation
- [x] benchmark tool — Tool for running and managing benchmarks
- [x] SWE-bench format — Load tasks from JSON/YAML format
- [x] Task execution — Run evolution tasks on benchmark instances
- [x] Patch validation — Validate generated patches against gold
- [x] Statistics tracking — Track pass rates, time, errors, quality
- [x] Sample tasks — Create sample benchmark tasks for testing

## Phase 27: Self-Modification Safety Gates
- [x] SafetyGateManager module — Proactive dangerous pattern detection
- [x] safetyGates tool — Tool for scanning code changes
- [x] Risk level categorization — Critical, high, medium, low risk patterns
- [x] Pattern categories — Security, breaking, data-loss, workflow, self-modification
- [x] Hook integration — Pre-edit validation with Safety Gates
- [x] Custom patterns — Add/remove custom dangerous patterns
- [x] Statistics tracking — Track scans, blocks, warnings, bypasses

## Phase 28: Multi-Agent Orchestrator (Claude Quickstart Pattern)
- [x] MultiAgentOrchestrator module — Two-agent pattern (initializer + coder)
- [x] multiAgent tool — Tool for orchestrator management
- [x] Initializer agent — Creates task list, plans approach, sets up structure
- [x] Coder agent — Executes tasks, marks completion, persists progress
- [x] Task list management — Create, update, track tasks with dependencies
- [x] Session persistence — Progress saved via JSON and text files
- [x] Statistics tracking — Track sessions, tasks, success rates

## Phase 29: Token/Cost Tracking (Aider Pattern)
- [x] TokenTracker module — Track LLM token usage and costs
- [x] tokenTracking tool — Tool for managing token usage and cost analysis
- [x] Session tracking — Track usage per session with task type
- [x] Cost calculation — Calculate costs with model-specific pricing
- [x] Cache support — Support for cache hits/writes (Anthropic/DeepSeek patterns)
- [x] Statistics aggregation — Cost by model, task type, daily/weekly trends
- [x] Data persistence — Save usage data for analysis

## Phase 30: Context Budget Monitoring Tool
- [x] ContextBudgetManager module — Proactive context window monitoring
- [x] contextBudget tool — Tool for monitoring and managing context usage
- [x] Context health status — Real-time token usage and limits monitoring
- [x] Proactive warnings — Alert before hitting context limits
- [x] Optimization suggestions — Recommend context reduction actions
- [x] Integration with compaction — Work with existing ContextManager
- [x] Statistics tracking — Track context usage patterns over sessions

## Phase 31: Interactive Approval Mode (SWE-agent/Aider Pattern)
- [x] InteractiveApprovalManager module — Approval workflow for risky operations
- [x] interactiveApproval tool — Tool for managing approval requests
- [x] Approval categories — File-delete, workflow, self-modification, security, etc.
- [x] Risk-based decisions — Auto-approve low risk, require approval for high risk
- [x] Protected file detection — Identify files that always require approval
- [x] Batch operations — Approve/reject multiple requests at once
- [x] Statistics tracking — Track approval rates, history, patterns

## Phase 32: SessionStart and Stop Hooks (OpenHands Pattern)
- [x] SessionStart hook type — Hooks executed at session initialization
- [x] Stop hook type — Hooks executed at session termination
- [x] Default SessionStart hooks — Memory load, context budget check, journal check
- [x] Default Stop hooks — Session stats save, token tracking finalize, tool cache save
- [x] Agent integration — executeSessionStartHooks() and executeStopHooks() methods
- [x] CLI integration — Execute hooks in runOnce() and runRepl()
- [x] Tests — Comprehensive tests for SessionStart/Stop hooks

## Phase 33: Ralph Loop Pattern (Claude Code ralph-wiggum Pattern)
- [x] RalphLoopManager module — Manage self-referential iteration loops
- [x] ralphLoop tool — Tool for managing loops (start, status, complete, cancel, list, stats)
- [x] Stop hook interception — Block exit and continue iteration
- [x] Completion promise detection — Unique string signals task completion
- [x] Max iterations safety — Prevent infinite loops
- [x] State persistence — Save loop state to disk for resumption
- [x] Statistics tracking — Track loops, iterations, completion rates
- [x] Tests — Comprehensive tests for Ralph Loop functionality

## Phase 34: Hookify Pattern (Claude Code hookify Plugin)
- [x] HookifyManager module — Dynamic hook creation from conversation patterns
- [x] hookify tool — Tool for creating and managing dynamic hooks
- [x] Rule file format — Markdown with YAML frontmatter for hook rules
- [x] Pattern extraction — Extract regex patterns from user descriptions
- [x] Conversation analyzer — Analyze conversations for problematic behaviors
- [x] HookManager integration — Register hookify rules with global hook manager
- [x] Statistics tracking — Track blocked operations, warnings, rules by event
- [x] Tests — Comprehensive tests for Hookify functionality

## Phase 35: Auto-Invoke Skills (Claude Code Pattern)
- [x] AutoInvokeManager module — Automatic skill suggestions based on context
- [x] autoInvoke tool — Tool for managing auto-invoke rules
- [x] Multiple trigger types — File patterns, keywords, tool usage, task type
- [x] Confidence scoring — Max weight + match bonus for suggestions
- [x] Default rules — 10 rules for common patterns (frontend, debugging, evolution, etc.)
- [x] Agent integration — getAutoInvokeSuggestions() method for programmatic access
- [x] Statistics tracking — Track invocations, skills used, trigger types
- [x] Tests — Comprehensive tests for Auto-Invoke functionality

## Phase 36: Explanatory Output Style (Claude Code Pattern)
- [x] ExplanatoryOutputStyleManager module — Educational context injection at session start
- [x] explanatoryOutputStyle tool — Tool for managing educational insights
- [x] Educational insights library — 23 default insights about architecture, patterns, evolution, tools, skills, memory, safety
- [x] SessionStart hook integration — Inject context automatically at session start
- [x] Insight categories — architecture, patterns, evolution, tools, skills, memory, safety
- [x] Configurable verbosity — brief, normal, detailed modes
- [x] Statistics tracking — Track sessions enhanced, insights shown, top insights
- [x] Tests — Comprehensive tests for Explanatory Output Style functionality

## Phase 37: Security Guidance PreToolUse Hook (Claude Code Pattern)
- [x] SecurityGuidanceManager module — Proactive security pattern detection
- [x] securityGuidance tool — Tool for scanning and managing security patterns
- [x] 9 security pattern categories — Command injection, XSS, eval usage, dangerous HTML, pickle deserialization, os.system, SQL injection, path traversal, sensitive data
- [x] 20 default security patterns — Comprehensive pattern library for common vulnerabilities
- [x] Risk level categorization — Critical, high, medium, low risk patterns
- [x] PreToolUse hook integration — Automatic security scanning before write/edit operations
- [x] Configurable blocking — Block critical/high risk patterns automatically
- [x] Custom pattern support — Add custom security patterns
- [x] Statistics tracking — Track scans, warnings, blocks, top patterns

## Phase 38: Feature Dev 7-Phase Workflow (Claude Code Pattern)
- [x] FeatureDevManager module — Manage 7-phase feature development workflow
- [x] featureDev tool — Tool for managing feature development sessions
- [x] 7-phase workflow — Discovery → Exploration → Questions → Architecture → Implementation → Review → Summary
- [x] Agent task management — Launch and track code-explorer, code-architect, code-reviewer agents
- [x] Clarifying questions — Generate and track answers for requirement clarification
- [x] Architecture approaches — Generate and select from multiple implementation approaches
- [x] Review findings — Track and address code quality findings
- [x] Session persistence — Save session state for resumption
- [x] Statistics tracking — Track sessions, phases, agents, questions, reviews

## Phase 39: Learning Output Style Pattern (Claude Code Pattern)
- [x] LearningOutputStyleManager module — Interactive learning mode for requesting meaningful code contributions at decision points
- [x] learningOutputStyle tool — Tool for detecting decision points and managing learning insights
- [x] Decision point detection — Identify business logic, error handling, algorithm, architecture, security decision points
- [x] Trade-off analysis — Show trade-offs for each decision category
- [x] Auto-implementation detection — Distinguish auto-implementable code from code requiring user contribution
- [x] SessionStart hook integration — Inject learning context automatically at session start
- [x] Educational insights — 11 default insights about architecture, patterns, evolution, tools, skills, memory, safety
- [x] Statistics tracking — Track sessions enhanced, decision points requested, contribution rate
- [x] Tests — Comprehensive tests for Learning Output Style functionality

## Phase 40: PR Review Toolkit (Claude Code Pattern)
- [x] PRReviewToolkitManager module — Manage comprehensive PR review with 6 specialized agents
- [x] prReviewToolkit tool — Tool for running and managing PR reviews
- [x] 6 specialized agents — comment-analyzer, pr-test-analyzer, silent-failure-hunter, type-design-analyzer, code-reviewer, code-simplifier
- [x] Confidence-based scoring — Filter false positives with configurable threshold (default 80)
- [x] Review session management — Start, add findings, complete review sessions
- [x] Review aspects — comments, tests, errors, types, code, simplify, all
- [x] Finding tracking — Track findings by agent, aspect, confidence level
- [x] Statistics tracking — Track reviews, findings, fixed/ignored issues
- [x] Tests — Comprehensive tests for PR Review Toolkit functionality

## Phase 41: Plugin Development Toolkit (Claude Code Pattern)
- [x] PluginDevManager module — Manage 8-phase plugin development workflow
- [x] pluginDev tool — Tool for managing plugin development sessions
- [x] 8-phase workflow — Discovery → Component Planning → Detailed Design → Structure Creation → Component Implementation → Validation → Testing → Documentation
- [x] 7 specialized skills — hook-dev, mcp-integration, plugin-structure, plugin-settings, command-dev, agent-dev, skill-dev
- [x] 3 agents — plugin-validator, agent-creator, skill-reviewer
- [x] Component management — Add, update, validate components (command, agent, skill, hook, mcp)
- [x] Phase guidance — Detailed guidance for each phase with actions
- [x] Session persistence — Save session state for resumption
- [x] Statistics tracking — Track sessions, phases, components, skills, agents

## Phase 42: Agent SDK Dev Pattern (Claude Code/OpenHands Pattern)
- [x] AgentBuilder module — Composable agent definition system
- [x] agentBuilder tool — Tool for defining and managing agents
- [x] Agent definitions — Typed arguments and outputs for agents
- [x] Agent chaining — Chain multiple agents sequentially with output mapping
- [x] Agent swarms — Execute multiple agents in parallel, sequential, race, or all-to-all strategies
- [x] Lifecycle hooks — onStart, onComplete, onError, onProgress hooks for agent execution
- [x] Agent registry — Track agent usage, success rates, and performance
- [x] Built-in agents — evolution-agent, code-explorer, code-reviewer, planner, error-recovery, intelligence
- [x] Statistics tracking — Track executions, success rates, top agents by usage

## Phase 43: Self-Healing Code Patterns (OpenHands/Aider Pattern)
- [x] SelfHealingManager module — Automatic detection and correction of common error patterns
- [x] selfHealing tool — Tool for pattern detection, auto-fixing, and statistics
- [x] 12 default patterns — TypeScript imports, lint rules (unused var, missing semicolon, prefer const), test errors (missing await, timeout), runtime errors, dependency issues
- [x] 4 default fix strategies — Unused variable removal, prefer const, missing semicolon, missing await
- [x] Confidence scoring — Pattern-specific confidence calculation based on context
- [x] Auto-fix recommendations — Intelligent recommendations based on severity and confidence
- [x] Statistics tracking — Track detections, fixes, failures by category and pattern
- [x] Detection history — Track recent pattern detections

## Phase 44: Context Importance Scoring (Aider ChatSummary Pattern)
- [x] ContextImportanceScorer module — Intelligent message importance scoring for smarter truncation
- [x] contextImportance tool — Tool for importance analysis and truncation recommendations
- [x] 8 importance factors — Role weight, recency, content type, tool success, error presence, file reference, plan reference, size factor
- [x] Content type classification — System prompt, skill definition, file content, tool result, error message, plan output, user instruction, assistant response
- [x] Importance level classification — Critical, high, medium, low, truncatable
- [x] Truncation recommendations — Prioritized list of messages to truncate with estimated savings
- [x] Target savings mode — Get recommendations to achieve specific token savings
- [x] Statistics tracking — Track analyses, recommendations, estimated savings, average importance score

## Phase 45: Frontend Design Skill (Claude Code Pattern)
- [x] FrontendDesignManager module — Guidance for distinctive frontend interfaces
- [x] frontendDesign tool — Tool for accessing design principles and recommendations
- [x] 12 design principles — Typography, color, spacing, animation, layout, interaction, accessibility, performance
- [x] Context detection — Detect frontend work context (new-component, refactor, style-update, responsive-design, animation-work, typography-work, layout-work, general-frontend)
- [x] Anti-pattern warnings — Warn against generic AI aesthetics
- [x] Bold design choices — Guidance on distinctive typography, intentional color, meaningful animations
- [x] Statistics tracking — Track guidance provided, principles shown, contexts detected

## Phase 46: Remote Execution Environment (SWE-ReX Pattern)
- [x] RemoteExecutionManager module — Manage remote execution environments for sandboxed evolution
- [x] remoteExecution tool — Tool for executing commands in various environments
- [x] Environment adapters — Local, Docker, Modal, Remote execution support
- [x] Shell session management — Interactive sessions for ipython, gdb, and other tools
- [x] Docker environment support — Execute commands in Docker containers
- [x] Multiple shell sessions — Run multiple interactive sessions in parallel
- [x] Statistics tracking — Track executions, sessions, success rates by environment type

## Phase 47: Role-Based Multi-Agent Protocol (MetaGPT Pattern)
- [x] RoleBasedAgentManager module — Manage specialized agent roles with SOP-based coordination
- [x] roleBasedAgents tool — Tool for role-based multi-agent sessions
- [x] 6 default agent roles — ProductManager, Architect, ProjectManager, Engineer, QAEngineer, Reviewer
- [x] SOP workflow system — Standard Operating Procedures for multi-agent coordination
- [x] 3 default workflows — software-company, feature-development, code-review
- [x] Artifact management — Track outputs with confidence scores
- [x] Phase transitions — Automatic workflow progression
- [x] Statistics tracking — Track sessions, artifacts, phases, role usage

## Phase 48: Task Tracking Tool (OpenHands SDK Pattern)
- [x] TaskTrackingManager module — Manage task tracking for agent execution
- [x] taskTracking tool — Tool for tracking task progress, dependencies, and completion state
- [x] Session management — Start, list, set active, clear task sessions
- [x] Task lifecycle — Add, update, complete, fail tasks with status tracking
- [x] Dependency management — Task dependencies with automatic blocking/unblocking
- [x] Subtask support — Parent-child task relationships
- [x] Progress tracking — Percentage completion, time estimates, session summaries
- [x] Statistics tracking — Track sessions, tasks, priorities, tags, dependency depth

## Phase 49: Synthetic Task Generation (SWE-smith Pattern)
- [x] SyntheticTaskGenerator module — Generate synthetic task instances for training
- [x] syntheticTaskGen tool — Tool for generating and managing synthetic tasks
- [x] 5 task types — bug-fix, feature-add, refactor, test-add, security-fix
- [x] 3 difficulty levels — easy, medium, hard with complexity scoring
- [x] Generation scenarios — 5 default scenarios with template-based problem generation
- [x] Task validation — Validate generated tasks for quality
- [x] Training data export — Export in SWE-bench, SWE-smith, or custom formats
- [x] Statistics tracking — Track generations by type, difficulty, validation rates

## Phase 50: Self-Evaluation Tool (Recursive Pattern)
- [x] SelfEvaluationManager module — Agent self-evaluation for recursive improvement
- [x] selfEvaluation tool — Tool for evaluating own performance after iterations
- [x] 8 evaluation criteria — task_success, time_efficiency, error_handling, skill_usage, code_quality, learning_quality, capability_gap, planning_quality
- [x] Result categories — excellent, good, adequate, needs_improvement, poor with configurable thresholds
- [x] Performance trends — Track trends across 7 dimensions over time
- [x] Capability gap detection — Identify missing capabilities from iteration analysis
- [x] Strength/weakness tracking — Track current strengths and weaknesses from recent evaluations
- [x] Statistics tracking — Track evaluations, scores, trends, and capability gaps

## Phase 51: Watch Mode/FileWatcher (Aider Pattern)
- [x] FileWatcher module — Watch source files for changes and AI comment markers
- [x] watch tool — Tool for managing file watching sessions
- [x] AI comment detection — Detect markers like # ai!, // ai?, /* ai */
- [x] Multiple comment styles — Support for #, //, /* */, --, ;; markers across 40+ file extensions
- [x] Action type classification — execute (!), question (?), review, explain, refactor, test
- [x] Gitignore integration — Respect .gitignore patterns for ignored files
- [x] Debounced change handling — Prevent rapid-fire updates with configurable debounce interval
- [x] Statistics tracking — Track files watched, changes detected, comments processed, actions triggered

## Phase 52: Self-Evaluation Stop Hook Integration (Recursive Pattern)
- [x] IterationContext module — Track iteration data during evolution sessions (task type, description, duration, errors, skills used)
- [x] Self-Evaluation Stop hook — Automatically trigger self-evaluation after each iteration
- [x] Iteration tracking — Start/end iteration with success status, first try, rework, impact tracking
- [x] Error recording — Record errors encountered during iteration
- [x] Skill tracking — Track skills used during iteration
- [x] Automatic evaluation — Perform self-evaluation with 8 criteria on session stop
- [x] Statistics tracking — Track iterations by task type, average duration, top skills

## Phase 53: Evolution Session Replay (Mini-SWE-Agent Pattern)
- [x] SessionReplayManager module — Replay and analyze past evolution sessions
- [x] sessionReplay tool — Tool for session replay and pattern extraction
- [x] 4 replay modes — full, steps, actions, learning for different analysis needs
- [x] Pattern extraction — Extract 6 pattern types (success-pattern, failure-pattern, tool-sequence, error-recovery, decision-point, skill-usage)
- [x] Session comparison — Compare successful vs failed sessions to identify factors
- [x] Step-by-step walkthrough — Detailed step analysis with learning points
- [x] Statistics tracking — Track replays, patterns extracted, comparisons, walkthroughs

## Phase 54: Pattern Auto-Application (SWE-agent Pattern)
- [x] PatternAutoApplier module — Automatically match and apply learned patterns to new tasks
- [x] patternAutoApply tool — Tool for pattern matching and auto-application
- [x] Pattern similarity scoring — Calculate similarity based on task type, description, files, errors, keywords
- [x] Auto-apply recommendations — Suggest or auto-apply high-confidence patterns
- [x] 6 pattern type support — success-pattern, failure-pattern, tool-sequence, error-recovery, decision-point, skill-usage
- [x] Application tracking — Track pattern applications with success rates
- [x] Time saved estimation — Estimate time saved from applying patterns
- [x] Statistics tracking — Track matches, applications, success rates, time saved

## Phase 55: Cross-Session Learning Transfer (RAG Enhancement Pattern)
- [x] LearningTransferManager module — Transfer learnings between related tasks automatically
- [x] learningTransfer tool — Tool for cross-session learning transfer
- [x] Task similarity detection — Calculate similarity score based on task type, keywords, skills, category
- [x] Session learning extraction — Extract patterns, solutions, pitfalls from past sessions
- [x] Transfer recommendations — Generate recommendations with similar sessions, transferred patterns, risk factors
- [x] Proactive context injection — Inject relevant context at task start
- [x] Warning generation — Warn about patterns from similar failed sessions
- [x] Statistics tracking — Track transfers, patterns transferred, warnings generated, similarity scores

## Phase 56: Evolution Cost Prediction
- [x] EvolutionCostPredictor module — Predict effort/complexity before starting implementation
- [x] evolutionCost tool — Tool for cost prediction and analysis
- [x] Complexity scoring — Calculate complexity score from cost factors (new module, hook integration, file count, etc.)
- [x] Complexity levels — simple (5-15m), moderate (15-30m), complex (30-60m), very-complex (60-120m)
- [x] Time estimation — Estimate time based on complexity level and historical data
- [x] Risk factor identification — Identify risk factors with impact scores and mitigations
- [x] Historical learning — Record actual outcomes to improve future predictions
- [x] Statistics tracking — Track predictions, accuracy, complexity distribution, top risk factors

## Phase 57: Evolution Regression Testing
- [x] EvolutionRegressionTester module — Run regression tests after evolution changes
- [x] regressionTesting tool — Tool for running tests and tracking capability health
- [x] Test runner — Run all tests and create snapshot of results
- [x] Capability health tracking — Track pass rate, last tested, status (healthy/degraded/broken)
- [x] Snapshot comparison — Compare test results before/after changes
- [x] Regression detection — Identify new failures, fixed tests, regressed tests
- [x] Change summary — Generate summary of test changes with recommendations
- [x] Statistics tracking — Track runs, snapshots, capability health distribution, common failures

## Phase 58: Capability Gap Detection
- [x] CapabilityGapDetector module — Automatically identify missing capabilities
- [x] capabilityGap tool — Tool for gap detection and analysis
- [x] ROADMAP analysis — Detect incomplete ROADMAP items and phase gaps
- [x] Tool coverage analysis — Compare documented tools vs implemented tools
- [x] Competitor pattern detection — Identify competitor patterns not yet implemented
- [x] Integration gap detection — Detect missing integrations between modules
- [x] Capability coverage — Track coverage percentage by category
- [x] ROADMAP suggestions — Generate ROADMAP items from detected gaps
- [x] Statistics tracking — Track detections, resolutions, top gap categories

---

## Phase 69: Visual Progress (Devin Pattern)
- [x] VisualProgressManager module — Manage progress visualization during evolution iterations
- [x] visualProgress tool — Tool for tracking and visualizing progress
- [x] Progress phases — context-gathering, task-selection, planning, implementation, verification, completion
- [x] Step tracking — Track individual steps with status and duration
- [x] Progress bar visualization — Visual progress indicator with percentage
- [x] Time estimation — Estimate remaining time based on historical data
- [x] Historical timing storage — Learn from past sessions to improve estimates
- [x] Tool usage tracking — Record which tools are used for each step
- [x] Session management — Start, update, complete progress sessions
- [x] Statistics tracking — Track sessions, durations, success rates

---

Priority is set by GitHub issue reactions. Open an issue to suggest improvements!

## Phase 83: Integration Manager (OpenHands Cloud Pattern)
- [x] IntegrationManager module — Manage external integrations for notifications
- [x] integration tool — Tool for managing integrations with 19 actions
- [x] 6 integration types — Slack, Jira, Linear, GitHub, Discord, Webhook
- [x] Event types — 8 event types (session_start, session_complete, task_start, task_complete, task_failed, capability_added, error, milestone)
- [x] Integration management — Add, get, list, update, remove, enable, disable, test
- [x] Event sending — Send events to all enabled integrations
- [x] Event history — Track all sent events with status
- [x] Notification config — Per-integration notification settings
- [x] Statistics tracking — Track integrations, events, success rates
- [x] State persistence — Save integrations to ~/.paimon/integrations.json

## Phase 83: Image Context Support (Aider Pattern)
- [x] ImageContextManager module — Manage images and web pages for visual context
- [x] imageContext tool — Tool with 22 actions for image and web page management
- [x] Image operations — Add from file, paste from clipboard (base64), get, list, remove
- [x] Web page scraping — Scrape URLs for documentation content
- [x] Vision model detection — Check if models support vision (GPT-4o, Claude 3.x, Gemini)
- [x] Format conversion — Base64 encoding, data URL generation
- [x] Context formatting — Format images and pages for LLM context
- [x] Statistics tracking — Track images added, pages scraped, bytes processed
- [x] Competitor pattern — Added to capability-gap.ts as aider pattern

---

Priority is set by GitHub issue reactions. Open an issue to suggest improvements!
## Phase 59: Session Replay → Auto-Apply Integration
- [x] Pattern feed callback system — Register callbacks to receive patterns when extracted
- [x] proactivePatternFeeding config option — Enable/disable automatic pattern feeding
- [x] feedPatternsToCallbacks method — Push patterns to registered callbacks
- [x] feedAllPatternsToCallbacks method — Feed all stored patterns (for initialization)
- [x] PatternAutoApplier.receivePatterns method — Accept patterns from session replay
- [x] Combined pattern matching — Match against both stored and received patterns
- [x] Persistence of received patterns — Save received patterns to state
- [x] Statistics tracking — Track patterns fed and received

## Phase 60: Regression Testing → Assess Integration
- [x] Update AssessmentResult type — Add regressionResult field
- [x] Assess tool regression parameters — runRegression, iterationId, taskDescription
- [x] Before snapshot tracking — Store snapshot ID before running tests
- [x] After evolution snapshot — Create snapshot with iteration context
- [x] Snapshot comparison — Compare before/after for regression detection
- [x] Regression warnings in recommendations — Alert when regressions detected
- [x] Regression summary in output — Show detailed regression analysis
- [x] Statistics tracking — Track regression checks performed

## Phase 61: SessionStart Intelligence Integration
- [x] Intelligence SessionStart hook — Inject intelligence recommendations at session start
- [x] Proactive pattern notification — Show available patterns with success rates
- [x] RAG context notification — Show indexed documents for context enrichment
- [x] Error pattern notification — Show learned error patterns for risk avoidance
- [x] Combined accuracy display — Show overall intelligence accuracy
- [x] Session mode context — Adapt recommendations to session mode (evolve/chat)
- [x] Integration with existing hooks — Priority 95, between learning output style and memory load

## Phase 62: Evolution Cost → Task Predictor Integration
- [x] TaskDecisionScore interface — Combine cost and success into single decision score
- [x] calculateDecisionScore method — Weighted scoring (60% success, 40% cost)
- [x] Decision breakdown table — Show success/cost factors in analysis output
- [x] Recommendation levels — highly-recommended, recommended, consider, avoid
- [x] Cost prediction integration — Get cost prediction alongside success prediction
- [x] Updated combined confidence — Factor in both success and cost confidence
- [x] Enhanced overall recommendation — Include decision score reasoning
- [x] Updated suggested approach — Consider complexity level in suggestions
- [x] Cost prediction stats in intelligence stats — Track predictions by complexity

## Phase 63: Learning Transfer → RAG Integration
- [x] Import RagModule into learning-transfer.ts — Get RAG search and enrichContext methods
- [x] enrichWithRag method — Combine keyword similarity with RAG TF-IDF scoring
- [x] RAG boost for session matching — Boost scores for sessions referenced in RAG documents
- [x] rag-discovered sessions — Add sessions found via RAG that weren't in keyword results
- [x] Combined confidence scoring — 70% keyword, 30% RAG weighting
- [x] RAG insights in risk factors — Add reflection insights from RAG to risk factors
- [x] Proactive RAG context — Enrich getProactiveContext with RAG document search
- [x] RAG stats in learning transfer stats — Track enrichments, documents found, average RAG score

## Phase 64: Proactive Error Pattern Injection at SessionStart
- [x] getTopPatternsForInjection method — Get top patterns by confidence and occurrences
- [x] formatTopPatternsForInjection method — Format patterns for proactive context
- [x] SessionStart error pattern hook — Inject top error patterns at session start
- [x] Proactive warning message — Show known error patterns with solutions
- [x] High-confidence filtering — Only inject patterns with ≥70% confidence
- [x] Evolve mode only — Only inject in evolve mode to reduce noise
- [x] Integration with existing hooks — Priority 94, after intelligence recommendations

## Phase 65: Diff-Aware Planning (Devin Pattern)
- [x] DiffAwarePlanningManager module — Manage git diff analysis for impact prediction
- [x] DiffAnalysis interface — Track files, additions, deletions, impact score, risk level
- [x] analyzeDiff method — Analyze current git diff for impact prediction
- [x] predictImpact method — Predict impact of proposed changes on files
- [x] getSafeImplementationPlan method — Get phased implementation plan
- [x] areChangesSafe method — Check if changes are safe to apply
- [x] Conflict detection — Identify potential import, export, dependency conflicts
- [x] Impact scoring — Calculate impact score based on file changes and conflicts
- [x] Risk levels — low, medium, high, critical based on impact score
- [x] diffAwarePlan tool — Tool for analyzing diffs and planning safe implementation
- [x] Statistics tracking — Track analyses run, conflicts detected, recommendations provided

## Phase 66: Diff-Aware Planning → Edit Tool Integration
- [x] autoAnalyzeBeforeEdit config — Enable automatic analysis before edits by default
- [x] Diff-aware edit PreToolUse hook — Analyze diffs before edit operations
- [x] Safety check integration — Use areChangesSafe() for blocker/warning detection
- [x] Warning messages — Show potential issues before edits are applied
- [x] File-specific analysis — Analyze specific file being edited
- [x] Hook priority configuration — Priority 75, after safety gates
- [x] Statistics tracking — Track edit analyses via diff-aware planning stats

## Phase 67: Multi-File Context (Cursor Pattern)
- [x] SymbolUsage interface — Track where each symbol is used across all files
- [x] ChangeImpact interface — Predict which files are affected by changes
- [x] RelatedFiles interface — Suggest files that should be edited together
- [x] buildSymbolUsages method — Build map of symbol usages across codebase
- [x] buildFileDependencies method — Build file dependency graph from imports
- [x] getSymbolUsages method — Get symbol usages with optional name filter
- [x] analyzeChangeImpact method — Analyze impact of changes to a file
- [x] getRelatedFiles method — Get related files with edit order suggestions
- [x] Risk level calculation — low, medium, high, critical based on dependent files
- [x] multiFileContext tool — Tool for cross-file analysis with 5 actions

## Phase 68: Multi-File Context → Edit Tool Integration
- [x] Multi-file edit PreToolUse hook — Analyze cross-file dependencies before edit operations
- [x] Risk level warning — Warn about high/critical risk files with many dependents
- [x] Imported-by notification — Show files that import the file being edited
- [x] Shared types notification — Show files with shared types/interfaces
- [x] Edit order recommendation — Suggest optimal edit order for multi-file changes
- [x] Hook priority configuration — Priority 70, after diff-aware-edit-analysis
- [x] Integration with RepoMap — Uses RepoMap for multi-file context analysis
- [x] Statistics tracking — Track edit analyses via hook execution

## Phase 70: IDE Integration (Cursor Pattern)
- [x] IDEIntegrationManager module — Manage IDE context detection and inline suggestions
- [x] IDE detection — Detect VSCode, JetBrains, Vim, Neovim, Emacs, Sublime, Atom, Cursor via environment variables
- [x] IDEContext interface — Track detected IDE, open files, active file, cursor position
- [x] InlineSuggestion generation — Generate suggestions from evolution context, error patterns, competitor patterns
- [x] IDENotification system — Send notifications to IDE for evolution events
- [x] Open files management — Track and manage open files in IDE context
- [x] SessionStart hook integration — Inject IDE context at session start with priority 93
- [x] ideIntegration tool — Tool with 20 actions for IDE integration management
- [x] Statistics tracking — Track sessions, suggestions, notifications by IDE type

## Phase 71: Code Completion (Cursor Pattern)
- [x] CodeCompletionManager module — Intelligent code completion based on codebase analysis
- [x] Code pattern analysis — Extract and match code patterns for snippet suggestions
- [x] Import suggestions — Suggest imports based on codebase import analysis
- [x] Function signature extraction — Extract function signatures for signature help
- [x] Multi-line completions — Support multi-line code completion patterns
- [x] Context-aware suggestions — Generate completions based on surrounding code context
- [x] Language detection — Detect language from file extension for appropriate patterns
- [x] codeCompletion tool — Tool with 12 actions for code completion management
- [x] Statistics tracking — Track completions, patterns used, confidence levels

## Phase 72: Agentic Reasoning Memory
- [x] ReasoningMemoryManager module — Store and recall reasoning chains across iterations
- [x] Reasoning chain tracking — Track reasoning steps (analysis, decision, action, observation, conclusion)
- [x] Pattern extraction — Extract successful reasoning patterns from past iterations
- [x] Similar chain retrieval — Find similar past chains based on task description
- [x] Reasoning guidance — Get guidance for new tasks based on past reasoning
- [x] 4 default reasoning patterns — Standard Implementation, Exploration-First, Debug Cycle, Research Integration
- [x] Keyword and tag extraction — Extract keywords and tags from task descriptions
- [x] reasoningMemory tool — Tool with 16 actions for reasoning memory management
- [x] Statistics tracking — Track chains, patterns, success rates, average steps per chain

## Phase 73: Tool Usage Analytics
- [x] ToolUsageAnalyticsManager module — Track and analyze tool usage patterns across sessions
- [x] Tool usage recording — Record tool usage events with success/failure, duration, task type
- [x] Tool statistics — Track usage counts, success rates, average durations per tool
- [x] Tool combinations analysis — Identify frequently used tool combinations
- [x] Usage insights — Generate insights (underutilized, high failure, optimal, recommended)
- [x] Tool recommendations — Get tool recommendations based on task type
- [x] Recommended tools per task type — Default recommendations for capability, reliability, feature tasks
- [x] toolUsageAnalytics tool — Tool with 12 actions for analytics management
- [x] Statistics tracking — Track records, unique tools, sessions, insights generated

## Phase 74: Model Migration (Claude Code Pattern)
- [x] ModelMigrationManager module — Manage model version migrations between LLM versions
- [x] Migration rules — Default rules for Claude, GPT, DeepSeek model migrations
- [x] File scanning — Scan files for migration opportunities with regex patterns
- [x] Directory scanning — Recursively scan directories for migration opportunities
- [x] Migration planning — Create migration plans with change previews
- [x] Migration execution — Execute migrations with backup support
- [x] Rollback support — Rollback completed migrations from backups
- [x] Beta header migration — Update beta headers for new model versions
- [x] API endpoint migration — Update API endpoints for new models
- [x] modelMigration tool — Tool with 13 actions for migration management
- [x] Statistics tracking — Track migrations, files modified, changes applied

## Phase 75: Evolution Strategy Planner (Meta-Capability)
- [x] EvolutionStrategyPlanner module — Meta-capability for planning optimal evolution strategies
- [x] State analysis — Analyze current capability coverage, success rate, velocity
- [x] Strategy recommendations — Recommend next evolution strategies with priorities and confidence
- [x] 8 strategy types — fill-gaps, improve-reliability, add-new-capability, optimize-existing, integration-improvement, research-competitors, memory-enhancement, tool-chain-improvement
- [x] Capability enablers — Predict which capabilities enable others for multiplier effects
- [x] Strategic direction — Determine current strategic direction (expand, stabilize, integrate, optimize, evolve, maintain)
- [x] Next phase suggestion — Suggest next ROADMAP phase based on analysis
- [x] Strategic guidance — Get guidance for specific tasks with risk assessment
- [x] Capability dependency graph — Track which capabilities enable others
- [x] evolutionStrategy tool — Tool with 10 actions for strategy management
- [x] Statistics tracking — Track analyses, recommendations, enablers identified

## Phase 76: Evolution Timeline Generator
- [x] EvolutionTimelineGenerator module — Generate visual timelines of evolution history
- [x] Timeline events — Parse MEMORY.md scorecard for timeline events
- [x] Phase identification — Group events into evolution phases
- [x] Milestone detection — Identify key milestones (first, 10, 50, 100 capabilities)
- [x] Trend analysis — Calculate velocity, success rate, and time trends
- [x] Day-by-day breakdown — Track capabilities added per day
- [x] evolutionTimeline tool — Tool with 6 actions (generate, format, stats, config, reset, help)
- [x] Statistics tracking — Track timelines generated, events processed, phases identified

## Phase 77: Context Budget PreToolUse Hook (Proactive Context Management Pattern)
- [x] ContextBudgetPreToolUseHook — Monitor context budget during long sessions
- [x] PreToolUse hook integration — Automatic context monitoring before tool operations
- [x] Rate-limited checking — Only check every 10 seconds to avoid overhead
- [x] Overflow detection — Critical warning when context exceeds 100%
- [x] Warning thresholds — Alert at critical (85%) and warning (70%) levels
- [x] Auto-executable suggestions — Show context reduction actions when overflow detected
- [x] Context health status — Report usage percentage and token counts
- [x] Integration with contextBudget tool — Uses existing ContextBudgetManager module

---

Priority is set by GitHub issue reactions. Open an issue to suggest improvements!

## Phase 78: Adaptive Reasoning Strategy Selection
- [x] AdaptiveReasoningManager module — Automatically selects optimal reasoning strategies
- [x] adaptiveReasoning tool — Tool for strategy selection, adaptation, and outcome recording
- [x] 7 reasoning strategies — analytical, creative, systematic, exploratory, diagnostic, architectural, iterative
- [x] Context detection — Automatic detection of task context from description
- [x] Strategy profiles — Detailed profiles with strengths, weaknesses, optimal contexts
- [x] Historical success tracking — Learn which strategies work best for different task types
- [x] Learned preferences — Store and apply learned strategy preferences per context/task type
- [x] Adaptation triggers — Warnings when strategy may need to change
- [x] Statistics tracking — Track strategy performance across sessions

## Phase 79: Predictive Error Prevention (Proactive Error Pattern)
- [x] PredictiveErrorPreventionManager module — Proactively predicts errors BEFORE they occur
- [x] predictiveErrorPrevention tool — Tool for error prediction, warnings, and prevention
- [x] 8 default error patterns — TypeScript imports, lint errors, test timeouts, file not found, hook handlers, context overflow, regex patterns, git conflicts
- [x] Probability and confidence scoring — Predict errors with quantified likelihood
- [x] Prevention suggestions — Actionable recommendations to avoid predicted errors
- [x] SessionStart hook integration — Inject proactive warnings at session start
- [x] Learning from outcomes — Learn from errors that occur to improve predictions
- [x] Statistics tracking — Track predictions, accuracy, prevention success rate

## Phase 80: Git Workflow Automation (Claude Code commit-commands Pattern)
- [x] GitWorkflowManager module — Streamlined git operations for evolution workflow
- [x] gitWorkflow tool — Tool for git automation with 9 actions
- [x] commit action — Generate commit message and commit staged/all changes
- [x] commit-push-pr action — Full workflow: commit → push → create PR in one command
- [x] clean-gone action — Remove stale local branches whose remote has been deleted
- [x] status action — Get comprehensive git status summary
- [x] branch-status action — Get detailed status for a specific branch
- [x] branches action — List all local branches with sync status
- [x] pr-status action — Get PR status for current/specified branch
- [x] push action — Push current branch to remote
- [x] create-branch action — Create and switch to new branch
- [x] Branch status tracking — ahead/behind counts, gone detection, worktree detection
- [x] PR description generation — Auto-generate PR descriptions from commit history
- [x] GitHub CLI integration — Requires gh CLI for PR creation
- [x] Statistics tracking — Track workflow operations performed

## Phase 81: Voice-to-Code (Aider Pattern)
- [x] VoiceToCodeManager module — Hands-free coding via voice commands
- [x] voiceToCode tool — Tool for voice session management with 20 actions
- [x] 12 default voice commands — File operations, git, testing, planning, checkpoints
- [x] Voice session management — Start, stop, pause, resume sessions
- [x] Speech recognition integration — Whisper API support for transcription
- [x] Voice command parsing — Parse voice transcripts into tool invocations
- [x] Confidence scoring — Match confidence for command recognition
- [x] History and statistics — Track voice commands, sessions, success rates

## Phase 82: Conversation Sharing (OpenHands Pattern)
- [x] ConversationSharingManager module — Export, import, and share evolution sessions
- [x] conversationSharing tool — Tool for session sharing with 15 actions
- [x] Export formats — JSON, Markdown, HTML, CSV with configurable options
- [x] Import sessions — Import shared sessions from JSON format
- [x] Anonymization — Automatic redaction of emails, phone numbers, API keys, file paths
- [x] Session management — Create, get, list, delete shared sessions
- [x] Share link generation — Generate unique shareable session IDs
- [x] Statistics tracking — Track exports, imports, sessions shared by format/source

---

Priority is set by GitHub issue reactions. Open an issue to suggest improvements!

## Phase 84: Cache Warming (Aider Pattern)
- [x] CacheWarmer module — Keep prompt cache alive during long sessions
- [x] cacheWarmer tool — Tool for cache warming management with 12 actions
- [x] Background warming thread — Periodic API pings to preserve cache
- [x] Configurable intervals — Default 5 minute keepalive delay
- [x] Token cache hit tracking — Track preserved cache tokens
- [x] Cost savings estimation — Estimate cost saved from cache hits
- [x] Manual ping support — On-demand cache warming ping
- [x] Session management — Start, stop, pause, resume warming sessions
- [x] TokenTracker integration — Track cache hit tokens for cost calculation
- [x] Statistics tracking — Track pings, success rate, tokens preserved, cost saved

## Phase 85: MCP Integration (Model Context Protocol)
- [x] MCPClient module — Connect to MCP servers for external tools and data sources
- [x] mcp tool — Tool for MCP server management with 24 actions
- [x] Transport support — stdio, SSE, HTTP transport implementations
- [x] Tool discovery — Automatically discover tools from connected servers
- [x] Resource access — Read resources from MCP servers
- [x] Prompt support — Use prompts from MCP servers
- [x] Server management — Add, remove, enable, disable, connect, disconnect servers
- [x] Sample servers — Pre-configured sample MCP servers (filesystem, git, fetch, memory, time)
- [x] Statistics tracking — Track tool calls, success rates, server statuses

## Phase 86: Copy/Paste to Web Chat (Aider Pattern)
- [x] ClipboardManager module — Manage clipboard context for working with LLM web chats
- [x] clipboard tool — Tool for clipboard operations with 12 actions
- [x] File tracking — Track files to include in context
- [x] Context generation — Generate formatted code context for clipboard
- [x] Paste parsing — Parse LLM web chat responses for code changes
- [x] Edit application — Apply parsed edits to files (create, edit, delete)
- [x] Copy/paste mode — Automatic clipboard sync for seamless workflow
- [x] Platform support — macOS, Linux, Windows clipboard operations
- [x] Repo map integration — Include repository structure in context
- [x] Statistics tracking — Track copies, pastes, files copied, edits applied

## Phase 87: Coding Conventions (Aider Pattern)
- [x] CodingConventionsManager module — Manage coding conventions for consistent code style
- [x] conventions tool — Tool for convention management with 14 actions
- [x] CONVENTIONS.md support — Load conventions from markdown files
- [x] .conventions/ directory — Organize conventions by category
- [x] 10 convention categories — libraries, types, style, patterns, testing, documentation, security, performance, accessibility, custom
- [x] 6 default conventions — TypeScript types, async/await, error handling, naming, imports, documentation
- [x] SessionStart hook — Auto-load conventions at session start
- [x] Convention rules — Support examples, anti-examples, and severity levels
- [x] Statistics tracking — Track conventions loaded, applications, issues found/fixed

## Phase 88: Desktop Notifications (Aider Pattern)
- [x] NotificationManager module — Manage desktop notifications for agent events
- [x] notifications tool — Tool for notification management with 10 actions
- [x] Cross-platform support — macOS (terminal-notifier, AppleScript), Linux (notify-send, zenity), Windows (PowerShell)
- [x] Auto-detection — Automatically detect best notification method for platform
- [x] Custom commands — Support custom notification commands with placeholders
- [x] Remote notifications — Support Apprise for Slack, Discord, Pushbullet
- [x] Notification types — complete, error, input, custom events
- [x] Configuration — Sound, title, enabled/disabled per type
- [x] Statistics tracking — Track notifications sent, success rate, by platform/type

## Phase 89: Reasoning Model Support (Aider Pattern)
- [x] ReasoningModelSupportManager module — Manage reasoning model configurations
- [x] reasoningModel tool — Tool for reasoning model management with 11 actions
- [x] OpenAI reasoning models — o3-mini, o3, o1, o1-preview, o1-mini with reasoning_effort (low/medium/high)
- [x] Anthropic reasoning models — claude-3-7-sonnet, claude-sonnet-4 with thinking_tokens budget
- [x] DeepSeek reasoning models — deepseek-r1, deepseek-reasoner with reasoning tag parsing (<think>...</think>)
- [x] Model limitations — Temperature, streaming, system prompt restrictions per model
- [x] Settings validation — Warn when applying unsupported settings to models
- [x] API parameters — Get correct API parameters for each model
- [x] Reasoning content parsing — Extract reasoning from tagged output
- [x] Custom model support — Add custom reasoning model configurations
- [x] Statistics tracking — Track models by provider, by setting, active configuration

## Phase 90: Shell Tab Completion Generation (Aider Pattern)
- [x] ShellCompletionGenerator module — Generate shell tab completion scripts for bash, zsh, and fish
- [x] shellCompletion tool — Tool for generating and managing completion scripts
- [x] Bash completion — Generate bash completion script with options and arguments
- [x] Zsh completion — Generate zsh completion script with descriptions
- [x] Fish completion — Generate fish completion script
- [x] Install command — Install completions to appropriate shell directories
- [x] Installation instructions — Get step-by-step installation instructions
- [x] Auto-detect shell — Detect current shell from $SHELL environment
- [x] Statistics tracking — Track generations and installations by shell type
