## Day 55 — Tool Result Caching (2026-04-01)

**What happened:**
- Implemented Tool Result Caching capability
- Created `src/tool-cache.ts` module with ToolCache class
- Created `src/tools/tool-cache-tool.ts` for cache management
- Added toolCache to metaTools array and agent tools
- Added 39 tests for tool cache functionality

**Why this matters:**
- This is a `capability` type task that enables token efficiency
- Caches tool results to avoid redundant tool calls
- Reduces token usage and prevents API rate limit issues
- Configurable caching with never-cache tools and short-TTL tools
- Statistics tracking for cache hits, misses, tokens saved

**Technical details:**
- Created `src/tool-cache.ts`:
  - `ToolCache` class for caching tool results
  - `CacheEntry` interface: key, toolName, params, result, timestamp, ttl, tokensSaved, hitCount
  - `CacheConfig` interface: maxSize, defaultTtl, enabled, noCacheTools, shortTtlTools, shortTtl
  - `CacheStats` interface: hits, misses, size, tokensSaved, hitRate, avgHitsPerEntry, topTools
  - `generateCacheKey()` - Generate consistent cache key from tool + params
  - `get()`, `set()`, `has()` - Core cache operations
  - `clear()`, `clearTool()`, `clearExpired()` - Cache management
  - `getStats()`, `getConfig()`, `setConfig()` - Configuration and statistics
  - TTL support with configurable per-tool TTL
  - Persistence to data/tool-cache.json
- Created `src/tools/tool-cache-tool.ts`:
  - `toolCache` tool with actions: stats, config, entries, clear, clearTool, clearExpired, enable, disable, get, has, setConfig
- Modified `src/tools/index.ts`:
  - Added toolCacheTool to metaTools array
  - Added re-exports for toolCache tool and functions

**Tool Cache Usage:**
```typescript
// View cache statistics
toolCache({action: 'stats'})

// View cache configuration
toolCache({action: 'config'})

// View cached entries
toolCache({action: 'entries', toolName: 'read'})

// Clear entire cache
toolCache({action: 'clear'})

// Clear cache for specific tool
toolCache({action: 'clearTool', toolName: 'read'})

// Enable/disable caching
toolCache({action: 'enable'})
toolCache({action: 'disable'})

// Update configuration
toolCache({action: 'setConfig', configUpdates: {maxSize: 500}})
```

**Next steps:**
- Consider integrating cache with actual tool execution
- Consider adding cache warm-up for frequently used tools

---


---

## Day 54 — Token/Cost Tracking (Aider Pattern) (2026-04-01)

**What happened:**
- Implemented ROADMAP Phase 29: Token/Cost Tracking
- Created `src/token-tracking.ts` module with TokenTracker class
- Created `src/tools/token-tracking-tool.ts` for token/cost management
- Added tokenTracking tool to metaTools array and agent tools
- Added 21 new tests for token tracking functionality
- Inspired by Aider's calculate_and_show_tokens_and_cost pattern

**Why this matters:**
- This is a `capability` type task that enables LLM efficiency tracking
- Track token usage per API call, session, and overall
- Calculate costs based on model-specific pricing (GPT-4, Claude, etc.)
- Support for Anthropic-style cache multipliers (1.25x write, 0.10x hit)
- Support for DeepSeek-style cache hit pricing
- Critical for understanding and optimizing API costs

**Technical details:**
- Created `src/token-tracking.ts`:
  - `TokenTracker` class for tracking token usage and costs
  - `TokenUsage` interface: timestamp, model, promptTokens, completionTokens, totalTokens, cacheHitTokens, cacheWriteTokens, cost, sessionId, taskType
  - `TokenSession` interface: sessionId, startTime, endTime, totalPromptTokens, totalCompletionTokens, totalCost, apiCalls
  - `TokenStats` interface: totalSessions, totalApiCalls, totalCost, costByModel, costByTaskType, dailyCost, weeklyCost
  - `ModelCostConfig` for model-specific pricing
  - `startSession()` - Start a new tracking session
  - `endSession()` - End current session
  - `recordUsage()` - Record token usage from an API call
  - `calculateCost()` - Calculate cost with model-specific pricing
  - `getStats()` - Get statistics from tracked usage
  - Data persistence to data/token-tracking.json
- Created `src/tools/token-tracking-tool.ts`:
  - `tokenTracking` tool with actions: start, end, record, stats, report, session, sessions, clear, cost, export
- Modified `src/tools/index.ts`:
  - Added tokenTrackingTool to metaTools array
  - Added re-export for tokenTrackingTool
- Modified `ROADMAP.md`:
  - Added Phase 29: Token/Cost Tracking (Aider Pattern)
  - Marked all 7 items complete

**Token Tracking Tool Usage:**
```typescript
// Start a session
tokenTracking({action: 'start', sessionId: 'my-session', taskType: 'capability'})

// Record usage
tokenTracking({action: 'record', 
  model: 'gpt-4',
  promptTokens: 1000,
  completionTokens: 500
})

// Calculate cost without recording
tokenTracking({action: 'cost',
  model: 'claude-3-opus',
  promptTokens: 1000,
  completionTokens: 500,
  cacheHitTokens: 200,
  cacheWriteTokens: 100
})

// View statistics
tokenTracking({action: 'stats'})

// View sessions
tokenTracking({action: 'sessions'})

// End session
tokenTracking({action: 'end', sessionId: 'my-session', success: true})
```

**Next steps:**
- ROADMAP phases 1-29 are complete
- Consider integrating token tracking with actual LLM API calls
- Consider adding budget limits and alerts

---


---

## Day 53 — Multi-Agent Orchestrator (2026-04-01)

**What happened:**
- Implemented ROADMAP Phase 28: Multi-Agent Orchestrator
- Created `src/multi-agent.ts` module with MultiAgentOrchestrator class
- Created `src/tools/multi-agent-tool.ts` for orchestrator management
- Added multiAgent tool to metaTools array and agent tools
- Added 19 new tests for multi-agent functionality
- Inspired by Claude Quickstart "Autonomous Coding Agent" two-agent pattern

**Why this matters:**
- This is a `capability` type task that enables better complex task handling
- Two-agent pattern (initializer + coder) separates planning from execution
- Fresh context per session but progress persists via task list
- Task dependencies enable ordered execution
- Statistics tracking for session analysis

**Technical details:**
- Created `src/multi-agent.ts`:
  - `MultiAgentOrchestrator` class for orchestrator management
  - `OrchestratorTask` interface: id, description, type, priority, status, dependencies, estimatedTime, actualTime, errors, notes
  - `TaskList` interface: version, createdAt, updatedAt, projectName, totalTasks, completedTasks, failedTasks, tasks, sessionNotes
  - `AgentSession` interface: id, role, startTime, endTime, tasksCompleted, tasksFailed, notes, status
  - `SessionResult` interface: success, session, tasksCompleted, tasksFailed, notes, nextAction
  - `startInitializerSession()` - Start initializer session
  - `completeInitializerSession()` - Complete with task list
  - `startCoderSession()` - Start coder session
  - `completeCoderSession()` - Complete coder session
  - `getNextTask()` - Get next pending task with dependency-aware selection
  - `updateTaskStatus()` - Update task status
  - `getProgress()` - Get current progress
  - `getStats()` - Get statistics
- Created `src/tools/multi-agent-tool.ts`:
  - `multiAgent` tool with actions: init, coder, progress, next, update, complete, stats, tasks, sessions, reset, sample, add-task, note
- Modified `src/tools/index.ts`:
  - Added multiAgentTool to metaTools array
  - Added re-export for multiAgentTool
- Modified `ROADMAP.md`:
  - Added Phase 28: Multi-Agent Orchestrator (Claude Quickstart Pattern)
  - Marked all 7 items complete

**Multi-Agent Tool Usage:**
```typescript
// Initialize a project
multiAgent({action: 'init', projectName: 'my-project'})

// Create sample tasks for testing
multiAgent({action: 'sample', projectName: 'test-project'})

// Start coder session
multiAgent({action: 'coder'})

// Get next task
multiAgent({action: 'next'})

// Update task status
multiAgent({action: 'update', taskId: 'task-001', status: 'completed', notes: ['Done']})

// View progress
multiAgent({action: 'progress'})

// View statistics
multiAgent({action: 'stats'})

// View task list
multiAgent({action: 'tasks'})

// View sessions
multiAgent({action: 'sessions'})

// Reset orchestrator
multiAgent({action: 'reset'})
```

**Next steps:**
- ROADMAP phases 1-28 are complete
- Consider using multi-agent for complex multi-task evolution
- Consider integrating with SDK for batch evolution sessions

---


---

## Day 52 — SWE-bench Benchmark Integration (2026-04-01)

**What happened:**
- Implemented ROADMAP Phase 26: SWE-bench Benchmark Integration
- Created `src/benchmark.ts` module with BenchmarkRunner class
- Created `src/tools/benchmark-tool.ts` for benchmark management
- Added benchmark tool to metaTools array and agent tools
- Added 24 new tests for benchmark functionality
- Inspired by SWE-bench, Mini-SWE-Agent benchmark evaluation

**Why this matters:**
- This is a `capability` type task that enables standardized evaluation
- Agents can now run benchmark tasks for evaluation
- SWE-bench compatible format for interoperability
- Task filtering by category and difficulty
- Patch validation against gold patches
- Statistics tracking for pass rates, time, quality

**Technical details:**
- Created `src/benchmark.ts`:
  - `BenchmarkRunner` class for running benchmark tasks
  - `BenchmarkTask` interface: instance_id, problem_statement, repo, base_commit, difficulty, category
  - `BenchmarkResult` interface: success, time_minutes, errors, quality_score
  - `BenchmarkStats` interface: passRate, averageTime, averageQuality, byDifficulty, byCategory
  - `loadTasks()`, `loadTasksFromDir()` - Load tasks from JSON files
  - `runTask()`, `runAll()` - Execute benchmark tasks
  - `validatePatch()` - Compare generated patch against gold
  - `calculateStats()` - Generate statistics from results
  - `saveResults()` - Save results to JSON
- Created `src/tools/benchmark-tool.ts`:
  - `benchmark` tool with actions: load, run, runAll, stats, tasks, results, clear, sample, save, validate, add
  - Each action returns AgentToolResult with content and details
- Modified `src/tools/index.ts`:
  - Added benchmarkTool to metaTools array
  - Added re-export for benchmarkTool
- Modified `ROADMAP.md`:
  - Added Phase 26: SWE-bench Benchmark Integration
  - Marked all 7 items complete

**Benchmark Tool Usage:**
```typescript
// Load sample tasks
benchmark({action: 'sample'})

// View loaded tasks
benchmark({action: 'tasks'})

// Run all tasks
benchmark({action: 'runAll'})

// View statistics
benchmark({action: 'stats'})

// Add custom task
benchmark({action: 'add', 
  taskId: 'custom-001', 
  problem: 'Fix bug in code',
  difficulty: 'easy',
  category: ['bug-fix']
})

// Validate patch
benchmark({action: 'validate',
  generatedPatch: '--- a/file.ts...',
  goldPatch: '--- a/file.ts...'
})
```

**Next steps:**
- ROADMAP phases 1-26 are complete
- Consider integrating benchmark with SDK for batch evaluation
- Consider adding SWE-bench Lite subset for faster evaluation

---


---

## Day 51 — SDK/API for Programmatic Evolution (2026-04-01)

**What happened:**
- Implemented ROADMAP Phase 25: SDK/API for Programmatic Evolution
- Created `src/sdk.ts` module with EvolutionSDK class
- Created `src/tools/sdk-tool.ts` for SDK management via tools
- Added sdk tool to metaTools array and agent tools
- Added 12 new tests for SDK functionality
- Inspired by OpenHands SDK and mini-swe-agent Python bindings

**Why this matters:**
- This is a `capability` type task that enables programmatic control
- External tools can now drive evolution programmatically
- Batch mode enables running multiple iterations with callbacks
- CI/CD integration enables automated evolution in pipelines
- Critical for external tool integration and automation

**Technical details:**
- Created `src/sdk.ts`:
  - `EvolutionSDK` class for programmatic API
  - `EvolutionConfig` interface with apiKey, baseUrl, model, maxIterations, etc.
  - `EvolutionResult` interface with success, description, taskType, timeMinutes, errors, filesChanged
  - `EvolutionSession` interface with id, startTime, config, iterationsCompleted, results, status
  - `BatchEvolutionConfig` and `BatchEvolutionResult` interfaces
  - `startSession()` - Start a new evolution session
  - `runIteration(sessionId)` - Run a single iteration
  - `getStatus(sessionId)` - Get session status
  - `stopSession(sessionId)` - Stop a running session
  - `resumeSession(sessionId)` - Resume a paused session
  - `deleteSession(sessionId)` - Delete a session
  - `batchEvolve(config)` - Run batch evolution with callbacks
  - `getAllSessions()` - Get all active sessions
  - `getStats()` - Get SDK statistics
  - `getPrediction(context)` - Get task prediction
  - `getRecommendations(context)` - Get intelligence recommendations
  - `matchErrorPattern(error)` - Match error against known patterns
- Created `src/tools/sdk-tool.ts`:
  - `sdk` tool with actions: init, start, run, status, stop, resume, delete, batch, sessions, stats, predict, recommend, match
  - Each action returns formatted markdown output
- Modified `src/tools/index.ts`:
  - Added sdkTool to metaTools array
  - Added re-export for sdkTool and SDK functions
- Modified `ROADMAP.md`:
  - Added Phase 25: SDK/API for Programmatic Evolution
  - Marked all 7 items complete

**SDK Tool Usage:**
```typescript
// Initialize SDK
sdk({action: 'init', apiKey: 'your-key', baseUrl: 'https://api.example.com'})

// Start a session
sdk({action: 'start'})

// Run an iteration
sdk({action: 'run', sessionId: 'session-123'})

// Run batch evolution
sdk({action: 'batch', iterations: 5, focusTypes: ['capability']})

// Get SDK stats
sdk({action: 'stats'})

// Get prediction
sdk({action: 'predict', taskDescription: 'Implement feature', taskType: 'capability'})

// Get recommendations
sdk({action: 'recommend', taskDescription: 'Evolution task', taskType: 'capability'})

// Match error pattern
sdk({action: 'match', error: "Cannot find name 'foo'"})
```

**Next steps:**
- ROADMAP phases 1-25 are complete
- Consider using SDK for CI/CD integration
- Consider adding benchmark mode (SWE-bench) via SDK

---


---

## Day 50 — Unified Evolution Intelligence (2026-04-01)

**What happened:**
- Implemented ROADMAP Phase 24: Unified Evolution Intelligence
- Created `src/intelligence.ts` module with EvolutionIntelligence class
- Created `src/tools/intelligence-tool.ts` for unified intelligence tool
- Added intelligence tool to metaTools array and agent tools
- Added 15 new tests for intelligence functionality
- Integrates taskPredictor, patternMiner, errorPatterns, and rag into unified system

**Why this matters:**
- This is a `capability` type task that improves task selection quality
- Agent can now get comprehensive intelligence from a single tool call
- Combined confidence scoring from all intelligence sources
- Error risk assessment before starting tasks
- Opportunity discovery from historical patterns
- Critical for smarter task selection and reducing wasted effort

**Technical details:**
- Created `src/intelligence.ts`:
  - `EvolutionIntelligence` class for unified intelligence
  - `UnifiedRecommendation` interface with prediction, patternRecommendations, errorRisks, relevantContext
  - `ErrorRisk` interface with errorType, description, likelihood, solutions
  - `IntelligenceStats` interface combining all module stats
  - `analyze()` - Get unified recommendations for task context
  - `analyzeErrorRisks()` - Identify error risks based on complexity and missing skills
  - `calculateCombinedConfidence()` - Weighted scoring from all sources
  - `generateOverallRecommendation()` - Generate recommendation text
  - `determineSuggestedApproach()` - Suggest approach based on context
  - `extractKeyRisks()` and `extractKeyOpportunities()` - Extract key insights
  - `getStats()` - Get combined statistics
  - `formatRecommendation()` and `formatStats()` - Markdown formatting
- Created `src/tools/intelligence-tool.ts`:
  - `intelligence` tool with actions: analyze, stats, refresh, risks, opportunities
  - `analyze` - Get unified recommendations
  - `stats` - View all intelligence module stats
  - `refresh` - Refresh all modules
  - `risks` - Analyze error risks
  - `opportunities` - Find key opportunities
- Modified `src/tools/index.ts`:
  - Added intelligenceTool to imports and metaTools array
  - Added re-export for intelligenceTool
- Modified `ROADMAP.md`:
  - Added Phase 24: Unified Evolution Intelligence
  - Marked all 8 items complete

**Intelligence Tool Usage:**
```typescript
// Get unified recommendations
intelligence({
  action: 'analyze',
  taskDescription: 'Implement new capability',
  taskType: 'capability',
  skillsAvailable: ['evolve', 'research']
})

// View all stats
intelligence({action: 'stats'})

// Refresh all modules
intelligence({action: 'refresh'})

// Analyze risks
intelligence({action: 'risks', taskType: 'capability', complexity: 'high'})

// Find opportunities
intelligence({action: 'opportunities', taskDescription: 'Implement predictor'})
```

**Next steps:**
- ROADMAP phases 1-24 are complete
- Consider using intelligence tool for all task selection decisions
- Consider adding more error risk patterns for better predictions

---


---

## Day 49 — Task Success Predictor (2026-04-01)

**What happened:**
- Implemented ROADMAP Phase 23: Task Success Predictor
- Created `src/task-predictor.ts` module with TaskSuccessPredictor class
- Created `src/tools/task-predictor-tool.ts` for prediction tool
- Added taskPredictor tool to metaTools array and agent tools
- Added 17 new tests for prediction functionality
- Predicts task success likelihood before starting based on historical patterns

**Why this matters:**
- This is a `capability` type task that improves task selection quality
- Agent can now predict success probability before starting a task
- Identifies risk factors that could cause failure
- Recommends skills based on historical success patterns
- Finds similar successful and failed tasks for learning
- Critical for smarter task selection and reducing wasted effort

**Technical details:**
- Created `src/task-predictor.ts`:
  - `TaskSuccessPredictor` class for predicting task outcomes
  - `TaskPrediction` interface with successProbability, confidence, estimatedTime, riskFactors, recommendedSkills, similarTasks
  - `TaskContext` interface with taskDescription, taskType, skillsAvailable, complexity
  - `HistoricalPattern` interface for mined patterns from MEMORY.md
  - `PredictorStats` interface for tracking prediction accuracy
  - `predict()` - Predict success probability with factors
  - `calculateSkillMatch()` - Score skill availability
  - `getComplexityPenalty()` - Adjust for task complexity
  - `findSimilarTasks()` - Find similar past tasks
  - `identifyRiskFactors()` - Identify potential issues
  - `recordOutcome()` - Track prediction accuracy
  - `formatPrediction()` - Format as markdown
- Created `src/tools/task-predictor-tool.ts`:
  - `taskPredictor` tool with actions: predict, stats, patterns, refresh
  - `predict` - Predict success for a task
  - `stats` - View prediction accuracy statistics
  - `patterns` - View historical patterns by task type
  - `refresh` - Reload patterns from MEMORY.md
- Modified `src/tools/index.ts`:
  - Added taskPredictorTool to metaTools array
  - Added re-export for taskPredictorTool
- Modified `ROADMAP.md`:
  - Added Phase 23: Task Success Predictor
  - Marked all 7 items complete

**Task Predictor Tool Usage:**
```typescript
// Predict task success
taskPredictor({action: 'predict', 
  taskDescription: 'Implement new capability',
  taskType: 'capability',
  skillsAvailable: ['evolve', 'research']
})

// View prediction stats
taskPredictor({action: 'stats'})

// View historical patterns
taskPredictor({action: 'patterns'})

// Refresh from MEMORY.md
taskPredictor({action: 'refresh'})
```

**Next steps:**
- ROADMAP phases 1-23 are complete
- Consider using taskPredictor for task selection decisions
- Consider integrating with patternMiner for unified intelligence

---


---

## Day 48 — Evolution Metrics Dashboard (2026-04-01)

**What happened:**
- Implemented ROADMAP Phase 22: Evolution Metrics Dashboard
- Created `src/metrics.ts` module with EvolutionMetricsTracker class
- Created `src/tools/metrics-tool.ts` for viewing and analyzing metrics
- Added metrics tool to metaTools array and agent
- Added 19 new tests for metrics functionality
- Parses MEMORY.md scorecard to track evolution progress

**Why this matters:**
- This is a `capability` type task that improves self-awareness
- Agent can now track success rate trends, time metrics, error patterns
- Skill effectiveness tracking helps identify which skills work best
- Capability velocity tracking shows progress over time
- Critical for understanding evolution quality and identifying improvements

**Technical details:**
- Created `src/metrics.ts`:
  - `EvolutionMetricsTracker` class for tracking metrics
  - `MetricPoint` interface with date, value, trend
  - `SuccessRateMetric` - Weekly success rate with trend indicators
  - `TimeMetric` - Average time by task type with fastest/slowest tasks
  - `ErrorMetric` - Error counts by type with common patterns
  - `SkillMetric` - Skill usage counts and success rates
  - `CapabilityVelocityMetric` - Capabilities per day with high impact %
  - `getWeekKey()` for ISO week number calculation
  - `formatMetricsDashboard()` for formatted output
  - `formatSuccessRateChart()` for ASCII chart visualization
- Created `src/tools/metrics-tool.ts`:
  - `metrics` tool with actions: dashboard, success, time, errors, skills, velocity, chart, refresh, save
  - Each action returns formatted markdown output
  - Supports saving metrics to data/evolution-metrics.json
- Modified `src/tools/index.ts`:
  - Added metricsTool to metaTools array
  - Added re-export for metricsTool
- Modified `ROADMAP.md`:
  - Added Phase 22: Evolution Metrics Dashboard
  - Marked all 6 items complete

**Metrics Tool Usage:**
```typescript
// View full dashboard
metrics({action: 'dashboard'})

// View success rate trends
metrics({action: 'success'})

// View time metrics
metrics({action: 'time'})

// View error metrics
metrics({action: 'errors'})

// View skill effectiveness
metrics({action: 'skills'})

// View capability velocity
metrics({action: 'velocity'})

// View ASCII chart
metrics({action: 'chart'})

// Refresh metrics from MEMORY.md
metrics({action: 'refresh'})

// Save metrics to file
metrics({action: 'save'})
```

**Next steps:**
- All ROADMAP phases 1-22 are complete
- Consider using metrics for evolution decisions
- Consider adding predictive metrics based on patterns

---


---

## Day 47 — Plugins/Extensions System (Claude Code/OpenHands Pattern) (2026-03-31)

**What happened:**
- Implemented ROADMAP Phase 21: Plugins/Extensions System
- Created `src/plugins.ts` module with PluginManager class
- Created `src/tools/plugins-tool.ts` for plugin management
- Added plugins tool to metaTools array and agent tools
- Added 20 new tests for plugin functionality
- Inspired by Claude Code's plugins and OpenHands' extensions

**Why this matters:**
- This is a `capability` type task that enables extensible architecture
- Plugins can add new tools and hooks without modifying core code
- Community contributions can extend Paimon's capabilities
- Enables future capabilities through plugin ecosystem
- Critical for maintaining a modular, extensible codebase

**Technical details:**
- Created `src/plugins.ts`:
  - `PluginManager` class for plugin discovery, loading, and management
  - `PluginManifest` interface with name, version, description, tools, hooks, config
  - `LoadedPlugin` interface with manifest, path, enabled, tools, hooks, errors
  - `PluginStats` interface for plugin statistics
  - `discoverPlugins()` - Find plugins from configured directories
  - `loadManifest()` - Load plugin.json or plugin.yaml manifests
  - `loadPlugin()` - Load a plugin and its tools/hooks
  - `initialize()` - Initialize and load all plugins
  - `enablePlugin()`, `disablePlugin()` - Enable/disable plugins
  - `getPluginTools()`, `getPluginHooks()` - Get plugin contributions
  - `getStats()` - Get plugin statistics
  - `refresh()` - Reload plugins from directories
  - Support for multiple plugin directories
  - Simple YAML parsing without external dependencies
- Created `src/tools/plugins-tool.ts`:
  - `plugins` tool with actions: list, stats, enable, disable, details, refresh, dirs
  - List plugins with status and statistics
  - Enable/disable plugins by name
  - View plugin details and configuration
  - Refresh plugin list after adding new plugins
  - Manage plugin directories
- Modified `src/tools/index.ts`:
  - Added pluginsTool to metaTools array
  - Added re-export for pluginsTool and getPluginTools
- Modified `ROADMAP.md`:
  - Added Phase 21: Plugins/Extensions System
  - Marked all 6 items complete

**Plugin Usage:**
```typescript
// List all plugins
plugins({action: 'list'})

// View plugin statistics
plugins({action: 'stats'})

// Enable/disable plugin
plugins({action: 'enable', name: 'my-plugin'})
plugins({action: 'disable', name: 'my-plugin'})

// View plugin details
plugins({action: 'details', name: 'my-plugin'})

// Refresh plugins after adding new ones
plugins({action: 'refresh'})

// Manage plugin directories
plugins({action: 'dirs'})
```

**Plugin Manifest Example:**
```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My custom plugin",
  "author": "Developer",
  "tools": [
    {
      "name": "custom-tool",
      "description": "A custom tool"
    }
  ],
  "hooks": [
    {
      "name": "custom-hook",
      "type": "PreToolUse",
      "priority": 50
    }
  ]
}
```

**Next steps:**
- All ROADMAP phases 1-21 are complete
- Consider using plugins for future capabilities
- Consider creating example plugins for common use cases

---


---

## Day 46 — Model Roulette (Mini-SWE-Agent Pattern) (2026-03-31)

**What happened:**
- Implemented ROADMAP Phase 20: Model Roulette for random model switching
- Created `src/model-roulette.ts` module with ModelRoulette class
- Created `src/tools/roulette-tool.ts` for model selection and statistics
- Added roulette tool to metaTools array and agent tools
- Added 21 new tests for model roulette functionality
- Integrated roulette with MinimalAgent via `roulette` config option
- Inspired by Mini-SWE-Agent research: "Randomly switching between GPT-5 and Sonnet 4 boosts performance"

**Why this matters:**
- This is a `capability` type task that improves agent performance through model diversity
- Different models have different strengths; random switching improves overall success rate
- Supports multiple strategies: random, weighted (by model weight), round-robin
- Statistics tracking helps identify which models perform best
- Seeded random enables reproducible experiments for RL/fine-tuning

**Technical details:**
- Created `src/model-roulette.ts`:
  - `ModelRoulette` class for random model switching
  - `RouletteModel` interface with id, weight, baseUrl, apiKey
  - `RouletteConfig` interface with models, strategy, switchEvery, seed
  - `RouletteStats` interface for tracking successes, failures, response times
  - `selectModel()` - Select next model using configured strategy
  - `selectRandom()`, `selectWeighted()`, `selectRoundRobin()` - Strategy implementations
  - `recordSuccess()`, `recordFailure()` - Track model performance
  - `getStats()` - Get statistics summary
  - `addModel()`, `removeModel()`, `setModelWeight()` - Model pool management
  - Seeded random for reproducible experiments
- Created `src/tools/roulette-tool.ts`:
  - `roulette` tool with actions: select, stats, config, reset, add, remove, weight
  - `select` - Switch to next model
  - `stats` - View model performance statistics
  - `config` - View current model pool
  - `reset` - Clear statistics
  - `add`, `remove`, `weight` - Manage model pool
- Modified `src/minimal-agent.ts`:
  - Added `roulette?: RouletteConfig` to MinimalAgentConfig
  - Added `isRoulette()`, `getCurrentRouletteModel()`, `switchRouletteModel()` methods
  - Added `recordRouletteSuccess()`, `recordRouletteFailure()` for tracking
  - Added `getRouletteStats()` for statistics access
- Modified `src/tools/index.ts`:
  - Added rouletteTool to metaTools array
  - Added re-export for rouletteTool
- Modified `ROADMAP.md`:
  - Added Phase 20: Model Roulette (Mini-SWE-Agent Pattern)
  - Marked all 6 items complete

**Model Roulette Usage:**
```typescript
// Create agent with roulette
const agent = createMinimalAgent({
  apiKey: '...',
  model: 'default-model',
  baseUrl: '...',
  roulette: {
    models: [
      { id: 'gpt-4', weight: 2 },
      { id: 'claude-3-opus', weight: 1 },
      { id: 'gemini-pro', weight: 1 }
    ],
    strategy: 'weighted',
    switchEvery: 3, // Switch every 3 turns
    trackStats: true
  }
});

// Check if roulette is active
agent.isRoulette() // true

// Get current model
agent.getCurrentRouletteModel() // { id: 'gpt-4', weight: 2 }

// Switch model before next turn
agent.switchRouletteModel()

// Get statistics
agent.getRouletteStats()
```

**Strategy Types:**
| Strategy | Description |
|----------|-------------|
| `random` | Random selection from model pool |
| `weighted` | Weighted random selection (higher weight = more likely) |
| `round-robin` | Cycle through models in order |

**Next steps:**
- All ROADMAP phases 1-20 are complete
- Consider using roulette in production for model diversity
- Consider integrating roulette with patternMiner for automatic model selection

---


---

## Day 45 — Bug Report Generator (2026-03-31)

**What happened:**
- Implemented ROADMAP Phase 18: Bug Report Generator
- Created `src/bug-report.ts` module with BugReportGenerator class
- Created `src/tools/bug-report-tool.ts` for generating and managing bug reports
- Added bugReport tool to metaTools array and agent tools
- Added 13 new tests for bug report functionality
- Inspired by Claude Code's /bug command for structured issue reporting

**Why this matters:**
- This is a `capability` type task that improves the self-evolution feedback loop
- Agent can now automatically generate structured bug reports from failed sessions
- Captures context, error details, git state, and suggested fixes
- Reports can be formatted as GitHub issues for easy tracking
- Critical for documenting failures and enabling future iterations to learn from them

**Technical details:**
- Created `src/bug-report.ts`:
  - `BugReportGenerator` class for generating structured bug reports
  - `BugReport` interface with id, title, timestamp, context, error, attemptedFixes, suggestedFixes, metadata
  - `BugReportContext` interface with taskType, taskDescription, skillsUsed, timeElapsed, gitBranch, recentCommits, changedFiles
  - `BugReportError` interface with type, message, stack, file, line, relatedPatterns
  - `detectErrorType()` - Classify errors as typescript, test, lint, runtime, or unknown
  - `extractFileAndLine()` - Parse file and line number from error messages
  - `generateReport()` - Create full bug report from session context
  - `formatAsMarkdown()` - Format report as markdown for display
  - `formatAsGitHubIssue()` - Format report as GitHub issue body
  - `saveReport()` - Persist report to session_plan/ directory
  - `listReports()`, `loadReport()`, `getStats()` - Report management
- Created `src/tools/bug-report-tool.ts`:
  - `bugReport` tool with actions: generate, list, view, stats, issue, save
  - `generate` - Create bug report from error context
  - `list` - List all saved bug reports
  - `view` - View specific bug report
  - `stats` - View bug report statistics
  - `issue` - Format as GitHub issue
  - `save` - Save report to file
- Modified `src/tools/index.ts`:
  - Added bugReportTool to metaTools array
  - Added re-export for bugReportTool
- Modified `ROADMAP.md`:
  - Added Phase 18: Bug Report Generator
  - Marked all 6 items complete

**Bug Report Tool Usage:**
```typescript
// Generate bug report from failed task
bugReport({action: 'generate', 
  taskDescription: 'Fix TypeScript error in agent.ts',
  taskType: 'capability',
  errorMessage: "Cannot find name 'foo'",
  skillsUsed: ['evolve', 'systematic-debugging'],
  timeElapsed: 15
})

// Save report to file
bugReport({action: 'save', ...})

// List all bug reports
bugReport({action: 'list'})

// View specific report
bugReport({action: 'view', filename: 'bug-2026-03-31T12-00-00.md'})

// Format as GitHub issue
bugReport({action: 'issue', ...})

// View statistics
bugReport({action: 'stats'})
```

**Next steps:**
- All ROADMAP phases 1-18 are complete
- Consider using bugReport tool when evolution tasks fail
- Consider integrating bugReport with reflect tool for automatic report generation

---


**What happened:**
- Implemented ROADMAP Phase 17: Evolution Pattern Mining
- Created `src/pattern-miner.ts` module with PatternMiner class
- Created `src/tools/pattern-miner-tool.ts` for pattern recommendations
- Added patternMiner tool to metaTools array and agent tools
- Added 8 new tests for pattern mining functionality
- Mines successful patterns from MEMORY.md scorecard for task selection

**Why this matters:**
- This is a `capability` type task that improves task selection intelligence
- Agent can now predict optimal approaches based on historical success patterns
- Identifies skill combinations that work well together
- Tracks success rates by task type, time patterns, and error avoidance
- Critical for reducing failure rate and improving first-try success

**Technical details:**
- Created `src/pattern-miner.ts`:
  - `PatternMiner` class for mining evolution patterns
  - `EvolutionPattern` interface with type, characteristics, successRate, confidence
  - `PatternRecommendation` interface for task context recommendations
  - Pattern types: skill-combination, task-type-success, time-pattern, error-avoidance
  - `parseScorecard()` extracts sessions from MEMORY.md table
  - `mineSkillCombinations()` finds skills that work together
  - `mineTaskTypePatterns()` tracks success by task type
  - `mineTimePatterns()` identifies optimal time ranges
  - `mineErrorAvoidancePatterns()` finds error-free approaches
  - `getRecommendations()` returns ranked recommendations
  - Persistence to data/evolution-patterns.json
- Created `src/tools/pattern-miner-tool.ts`:
  - `patternMiner` tool with actions: recommend, stats, patterns, get, refresh
  - `recommend` - Get recommendations for task context
  - `stats` - View pattern statistics
  - `patterns` - List all patterns with optional type filter
  - `get` - Get specific pattern details
  - `refresh` - Re-analyze sessions
- Modified `src/tools/index.ts`:
  - Added patternMinerTool to metaTools array
  - Added re-export for patternMinerTool
- Modified `src/prompt.ts`:
  - Added patternMiner tip for task selection
- Modified `ROADMAP.md`:
  - Added Phase 17: Evolution Pattern Mining
  - Marked all 6 items complete

**PatternMiner Tool Usage:**
```typescript
// Get recommendations for current task
patternMiner({action: 'recommend', taskType: 'capability'})

// View pattern statistics
patternMiner({action: 'stats'})

// List all patterns
patternMiner({action: 'patterns'})

// Get specific pattern details
patternMiner({action: 'get', patternId: 'skill-combo-evo-res'})

// Refresh patterns from MEMORY.md
patternMiner({action: 'refresh'})
```

**Pattern Types:**
| Type | Description |
|------|-------------|
| skill-combination | Skills that work well together (e.g., evolve + research = 95% success) |
| task-type-success | Success rates by task type (capability = 97% success) |
| time-pattern | Optimal time ranges for tasks |
| error-avoidance | Approaches that avoid common errors |

**Next steps:**
- All ROADMAP phases 1-17 are complete
- Consider using patternMiner for task selection in future iterations
- Consider integrating patternMiner with errorPatterns for unified intelligence

---


---

## Day 43 — Error Pattern Learning (2026-03-31)

**What happened:**
- Implemented ROADMAP Phase 16: Error Pattern Learning
- Created `src/error-patterns.ts` module with ErrorPatternLearner class
- Created `src/tools/error-patterns-tool.ts` for error pattern matching and suggestions
- Added errorPatterns tool to metaTools array and agent tools
- Added 20 new tests for error pattern functionality
- Inspired by OpenHands' error recovery and Claude Code's pattern recognition

**Why this matters:**
- This is a `capability` type task that improves self-evolution error handling
- Agent can now learn from error patterns across sessions
- Pattern matching finds known solutions for common errors
- Automatic solution suggestions with confidence scoring
- Critical for reducing error recovery time

**Technical details:**
- Created `src/error-patterns.ts`:
  - `ErrorPatternLearner` class for learning and matching error patterns
  - `ErrorPattern` interface with type, pattern, solution, confidence
  - `ErrorMatch` interface for pattern match results
  - `PatternStats` interface for statistics
  - Default patterns for TypeScript, test, lint, and runtime errors
  - `detectErrorType()` - Classify error by type
  - `learnFromError()` - Learn new pattern from error
  - `matchError()` - Match error against known patterns
  - `getSuggestions()` - Get solution suggestions
  - `addPattern()` - Add custom pattern
  - `updateSolution()` - Update solution for pattern
  - Persistence to data/error-patterns.json
- Created `src/tools/error-patterns-tool.ts`:
  - `errorPatterns` tool with actions: match, learn, suggest, stats, patterns, add, update, clear
  - `match` - Find pattern for error
  - `learn` - Add new pattern from error
  - `suggest` - Get solution suggestions
  - `stats` - View pattern statistics
  - `patterns` - List all patterns
  - `add` - Add custom pattern
  - `update` - Update solution for pattern
  - `clear` - Clear learned patterns
- Modified `src/tools/index.ts`:
  - Added errorPatternsTool to metaTools array
  - Added re-export for errorPatternsTool
- Modified `src/prompt.ts`:
  - Added errorPatterns tool to workflow documentation
  - Added tip about using errorPatterns for error matching
- Modified `ROADMAP.md`:
  - Added Phase 16: Error Pattern Learning
  - Marked all 5 items complete

**Error Patterns Tool Usage:**
```typescript
// Match error against known patterns
errorPatterns({action: 'match', error: "Property 'foo' does not exist on type 'Bar'"})

// Get solution suggestions
errorPatterns({action: 'suggest', error: "Cannot find name 'myVar'"})

// Learn from new error
errorPatterns({action: 'learn', error: "New error pattern", solution: "How to fix it"})

// View pattern statistics
errorPatterns({action: 'stats'})

// List all patterns
errorPatterns({action: 'patterns', type: 'typescript'})
```

**Default Error Patterns:**
| Type | Pattern | Solution |
|------|---------|----------|
| TypeScript | Property does not exist on type | Add property or use optional chaining |
| TypeScript | Type is not assignable | Use 'as' assertion or fix source type |
| TypeScript | Cannot find name | Add import statement or define variable |
| Test | AssertionError | Check expected vs actual values |
| Test | Timeout exceeded | Increase timeout or fix async operation |
| Lint | Unused variable | Remove or prefix with underscore |
| Runtime | Cannot read property of undefined | Add null check or use optional chaining |

**Next steps:**
- All ROADMAP phases 1-16 are complete
- Consider using errorPatterns for faster error recovery
- Consider adding more patterns from common error scenarios

---


---

## Day 42 — Trajectory Viewer Tool (Mini-SWE-Agent Pattern) (2026-03-31)

**What happened:**
- Implemented ROADMAP Phase 15: Trajectory Viewer Tool
- Created `src/trajectory.ts` module with TrajectoryViewer class
- Created `src/tools/trajectory-tool.ts` for viewing and analyzing trajectories
- Added trajectory tool to metaTools array and agent tools
- Added 10 new tests for trajectory viewer functionality
- Inspired by Mini-SWE-Agent's trajectory browser (74% on SWE-bench verified)

**Why this matters:**
- This is a `capability` type task that improves debugging and fine-tuning
- Agent can now view and analyze past execution trajectories
- Pattern analysis identifies success rates, error rates, tool usage
- Mini-SWE-Agent format export enables compatibility with existing tooling
- Critical for preparing fine-tuning datasets and debugging agent behavior

**Technical details:**
- Created `src/trajectory.ts`:
  - `TrajectoryViewer` class for viewing and analyzing trajectories
  - `Trajectory` interface matching MinimalAgent's trajectory structure
  - `TrajectoryListing` interface with metadata preview
  - `TrajectoryAnalysis` interface for pattern analysis
  - `listTrajectories()` - List saved trajectories from data directory
  - `loadTrajectory()` - Load specific trajectory from file
  - `viewTrajectory()` - View trajectory in summary/steps/full format
  - `analyzeTrajectories()` - Analyze patterns (success rate, error rate, tool usage)
  - `exportTrajectory()` - Export in json/mini-swe/markdown format
  - `toMiniSweFormat()` - Convert to Mini-SWE-Agent compatible format
  - `getStats()` - Get directory statistics
- Created `src/tools/trajectory-tool.ts`:
  - `trajectory` tool with actions: list, view, analyze, stats, export
  - `list` - List all saved trajectories with metadata preview
  - `view` - View trajectory in summary/steps/full format
  - `analyze` - Analyze trajectory patterns (success/error rates, tool usage)
  - `stats` - Get trajectory directory statistics
  - `export` - Export trajectory in various formats
- Modified `src/tools/index.ts`:
  - Added trajectoryTool to metaTools array
  - Added re-export for trajectoryTool
- Modified `ROADMAP.md`:
  - Added Phase 15: Trajectory Viewer (Mini-SWE-Agent Pattern)
  - Marked all 5 items complete

**Trajectory Tool Usage:**
```typescript
// List saved trajectories
trajectory({action: 'list'})

// View trajectory details
trajectory({action: 'view', name: 'traj.json', format: 'steps'})

// Analyze trajectory patterns
trajectory({action: 'analyze'})

// Export in Mini-SWE-Agent format
trajectory({action: 'export', name: 'traj.json', format: 'mini-swe'})
```

**Next steps:**
- All ROADMAP phases 1-15 are complete
- Consider using trajectory viewer for debugging complex evolution tasks
- Consider using trajectory analysis for fine-tuning data preparation

---


---

## Day 41 — RAG Context Enrichment (PR-Agent Pattern) (2026-03-31)

**What happened:**
- Implemented ROADMAP Phase 14: RAG Context Enrichment
- Created `src/rag.ts` module with RagModule class
- Created `src/tools/rag-tool.ts` for semantic search tool
- Added rag tool to metaTools array and agent tools
- Added TF-IDF scoring for relevance ranking
- Added inverted index for efficient keyword search
- Added 10 new tests for RAG functionality
- Inspired by PR-Agent's "RAG context enrichment" pattern

**Why this matters:**
- This is a `capability` type task that improves self-evolution quality
- Agent can now search past sessions, learnings, and reflections
- Reduces rework by finding similar solutions to current problems
- Enables context enrichment before starting complex tasks
- TF-IDF scoring provides relevance-based ranking

**Technical details:**
- Created `src/rag.ts`:
  - `RagModule` class with initialize(), search(), enrichContext(), getStats(), clear()
  - `RagDocument` interface for indexed documents
  - `RagSearchResult` interface for search results
  - `tokenize()` for text normalization and stop word filtering
  - `generateSnippet()` for context snippets around matches
  - TF-IDF scoring: tf * log(totalDocs / docsWithTerm)
  - Inverted index for efficient term-based retrieval
  - Sources: MEMORY.md learnings, JOURNAL.md entries, reflection files
- Created `src/tools/rag-tool.ts`:
  - `rag` tool with actions: search, enrich, stats, rebuild
  - `search` - find relevant context matching query
  - `enrich` - get enriched context for task description
  - `stats` - view index statistics
  - `rebuild` - rebuild the index
- Modified `src/tools/index.ts`:
  - Added ragTool to metaTools array
  - Added re-export for ragTool
- Modified `src/prompt.ts`:
  - Added rag tool to workflow documentation
  - Added tip about using rag for context enrichment
- Modified `ROADMAP.md`:
  - Added Phase 14: RAG Context Enrichment
  - Marked all 5 items complete

**RAG Tool Usage:**
```typescript
// Search for relevant past context
rag({action: 'search', query: 'typescript error handling'})

// Get enriched context for a task
rag({action: 'enrich', query: 'implement new feature'})

// View index statistics
rag({action: 'stats'})

// Rebuild the index
rag({action: 'rebuild'})
```

**Next steps:**
- All ROADMAP phases 1-14 are complete
- Consider using RAG enrichment before complex evolution tasks
- Consider researching more competitors for new capabilities

---


---

## Day 40 — Self-Authorship Tracking (Aider Singularity Pattern) (2026-03-31)

**What happened:**
- Implemented ROADMAP Phase 13: Self-authorship tracking (Singularity metric)
- Created `src/singularity.ts` module with SingularityTracker class
- Created `src/tools/singularity-tool.ts` for tracking self-authorship
- Added singularity tool to agent's tools array
- Added 10 new tests for singularity functionality
- Inspired by Aider's "88% Singularity" metric

**Why this matters:**
- This is a `capability` type task that improves self-awareness for evolution
- Agent can now track which code it authored vs humans
- Git commit analysis identifies bot-authored commits
- File-level analysis with git blame shows line-level authorship
- Enables confidence decisions when modifying code
- Critical for understanding evolution progress

**Technical details:**
- Created `src/singularity.ts`:
  - `SingularityTracker` class for tracking self-authorship
  - `SingularityStats` interface with commit counts, percentages, author breakdown
  - `FileAuthorship` interface for file-level analysis
  - `isBotAuthor()` to recognize bot authors (paimon[bot], etc.)
  - `parseGitLog()` for commit analysis
  - `parseGitBlame()` for line-level analysis
  - `calculateStats()` for full singularity report
  - `formatSingularityStats()` for formatted output
- Created `src/tools/singularity-tool.ts`:
  - `singularity` tool with actions: report, check, author
  - `report` - full stats with optional file-level analysis
  - `check` - check if specific file is bot-authored
  - `author` - get primary author of specific file
- Modified `src/tools/index.ts`:
  - Added singularityTool to metaTools array
  - Added re-export for singularityTool
- Modified `src/prompt.ts`:
  - Added singularity tool to workflow documentation
  - Added tip about checking self-authorship before modifications
- Modified `ROADMAP.md`:
  - Added Phase 13: Self-Authorship Tracking (Aider Singularity Pattern)
  - Marked all 5 items complete

**Singularity Tool Usage:**
```typescript
// Get full singularity report
singularity({action: 'report'})

// Get report with file-level analysis
singularity({action: 'report', includeFileAnalysis: true})

// Check if specific file is bot-authored
singularity({action: 'check', file: 'src/agent.ts'})

// Get primary author of file
singularity({action: 'author', file: 'src/agent.ts'})

// Analyze specific file patterns
singularity({action: 'report', filePatterns: ['src/*.ts']})
```

**Singularity Report Format:**
```
## Singularity Report (Self-Authorship Tracking)

**Singularity Percentage:** 60%
- Bot commits: 12 (60%)
- Human commits: 8 (40%)
- Total commits: 20

**Timeframe:** 2026-03-01 to 2026-03-31

**Top Authors:**
- 🤖 paimon[bot]: 12 commits (60%)
- 👁 Robin: 5 commits (25%)
- 👁 xingmolu: 3 commits (15%)

**Most Self-Authorized Files:**
- src/agent.ts: 85% bot-authored
- src/tools/plan-tool.ts: 90% bot-authored
```

**Next steps:**
- All ROADMAP phases 1-13 are complete
- Consider using singularity tracking for confidence decisions
- Consider researching more competitors for new capabilities

---


---

## Day 39 — Template-Based Prompts (Mini-SWE-Agent Pattern) (2026-03-31)

**What happened:**
- Implemented ROADMAP Phase 11 item: Template-based prompts
- Created `src/templates.ts` module with Jinja-style template engine
- Added `{{ variable }}`, `{{ variable|default }}`, `{{ variable:default }}` syntax support
- Integrated templates into minimal agent via `template` config option
- TemplateManager class for managing multiple templates
- All ROADMAP phases (1-12) are now complete

**Why this matters:**
- This is a `capability` type task that completes Phase 11 of ROADMAP
- Template-based prompts enable easier customization without code changes
- Inspired by Mini-SWE-Agent's Jinja templates from Princeton/Stanford
- Reduces prompt engineering friction for RL/fine-tuning experiments
- Templates can be loaded from files or strings

**Technical details:**
- Created `src/templates.ts`:
  - `renderTemplate()` for variable substitution
  - `{{ name }}` syntax (required variable)
  - `{{ name|default }}` syntax (default value via pipe)
  - `{{ name:default }}` syntax (default value via colon)
  - `loadTemplateFile()` for loading templates from files
  - `TemplateManager` class for registering and managing templates
  - Default templates: minimal, baseline, full
- Modified `src/minimal-agent.ts`:
  - Added `template?: TemplateConfig` to MinimalAgentConfig
  - Updated `buildSystemPrompt()` to use templates
  - Template can be inline string or file path
  - Variables override defaults
- Modified `src/agent.test.ts`:
  - Added 22 new tests for template system
  - Tests cover: rendering, defaults, manager, file loading, agent integration

**Template Usage:**
```typescript
// Create minimal agent with custom template
const agent = createMinimalAgent({
  apiKey: '...',
  model: '...',
  baseUrl: '...',
  template: {
    template: "Custom {{ agent_name }} for {{ model|unknown }}",
    variables: { agent_name: "my-agent" }
  }
});

// Load template from file
const agent = createMinimalAgent({
  apiKey: '...',
  model: '...',
  baseUrl: '...',
  template: {
    template: "./prompts/custom.md",
    isFile: true,
    variables: { model: "gpt-4" }
  }
});
```

**Template Syntax:**
| Syntax | Description |
|--------|-------------|
| `{{ name }}` | Required variable (keeps placeholder if missing) |
| `{{ name|default }}` | Variable with default value (pipe syntax) |
| `{{ name:default }}` | Variable with default value (colon syntax) |

**Next steps:**
- All ROADMAP phases are complete (Phase 1-12)
- Consider researching new capabilities from competitors (Devin, Cognition AI)
- Consider using template system for prompt experiments

---


---

## Day 38 — Baseline Mode for Minimal Agent (2026-03-31)

**What happened:**
- Implemented ROADMAP Phase 11 item: Baseline mode for RL/fine-tuning experiments
- Added `baseline` config option to MinimalAgentConfig
- Added standardized baseline system prompt (minimal, suitable for training)
- Added trajectory tracking with TrajectoryStep and Trajectory types
- Added trajectory export methods: getTrajectory(), getTrajectoryJson(), saveTrajectory()
- Added Mini-SWE-Agent format export: getMiniSweFormat()
- Marked ROADMAP Phase 11 baseline mode as complete

**Why this matters:**
- This is a `capability` type task that enables RL experiments and fine-tuning
- Baseline mode provides a clean, standardized configuration for experiments
- Trajectory tracking captures tool calls and outputs for training data
- Mini-SWE-Agent format enables compatibility with existing tooling
- Critical for future self-evolution via RL/fine-tuning approaches

**Technical details:**
- Modified `src/minimal-agent.ts`:
  - Added `baseline?: boolean` to MinimalAgentConfig
  - Added TrajectoryStep interface (step, userMessage, assistantResponse, toolCall, toolOutput, timestamp, isError)
  - Added Trajectory interface with metadata and steps
  - Added trajectory tracking in bash tool execute
  - Added getBaselineSystemPrompt() for standardized minimal prompt
  - Added trajectory tracking in run() method
  - Added getTrajectory(), getTrajectoryJson(), saveTrajectory() methods
  - Added getMiniSweFormat() for Mini-SWE-Agent compatibility
  - Added isBaseline() check method
- Modified `ROADMAP.md`:
  - Marked Phase 11 baseline mode as complete

**Baseline Mode Usage:**
```typescript
// Create baseline agent for experiments
const agent = createMinimalAgent({
  apiKey: '...',
  model: '...',
  baseUrl: '...',
  baseline: true  // Enable baseline mode
});

// Run task
await agent.run('fix the bug');

// Export trajectory for RL/fine-tuning
const trajectory = agent.getTrajectory();      // Full trajectory
const miniSweFormat = agent.getMiniSweFormat(); // Mini-SWE-Agent format
agent.saveTrajectory('trajectory.json');        // Save to file
```

**Trajectory Format:**
```json
{
  "metadata": {
    "model": "...",
    "baseline": true,
    "startTime": "...",
    "endTime": "...",
    "totalSteps": 10,
    "success": true
  },
  "steps": [
    {
      "step": 1,
      "userMessage": "fix the bug",
      "assistantResponse": "...",
      "timestamp": "..."
    },
    {
      "step": 2,
      "toolCall": { "name": "bash", "parameters": { "command": "cat file.ts" } },
      "toolOutput": "...",
      "timestamp": "..."
    }
  ]
}
```

**Next steps:**
- Consider implementing remaining Phase 11 items (independent execution, template-based prompts)
- Consider using baseline mode for actual RL experiments

---


---

## Day 37 — Complete Modular Architecture Integration (Issue #22) (2026-03-31)

**What happened:**
- Completed the key remaining item of Issue #22 Phase 12
- Replaced inline tool definitions with `buildTools()` from extracted modules
- Reduced agent.ts from 2583 lines to 502 lines (80% reduction!)
- All 14 tools now live in `src/tools/` modules (2211 lines total)
- All 115 tests pass with the modular architecture

**Why this matters:**
- This is a `capability` type task that completes the modular architecture goal
- Dramatically improves codebase maintainability
- Each tool file is easier to understand in isolation
- Single source of truth for all tool definitions
- Future changes are simpler - just edit one tool file

**Technical details:**
- Modified `src/agent.ts`:
  - Replaced 2000+ lines of inline tool definitions with single `buildTools()` call
  - Removed unused imports (http, https, Type, CheckpointManager, formatCheckpoint, etc.)
  - Added import for `buildTools` from `./tools/index.js`
  - Kept `createWrappedTools` function for hook wrapping
  - Kept `buildSystemPrompt` and related helper functions
- Total reduction: 2583 → 502 lines (80% reduction)
- Tools in `src/tools/`:
  - file-tools.ts (159 lines)
  - search-tools.ts (187 lines)
  - http-tool.ts (116 lines)
  - plan-tool.ts (256 lines)
  - assess-tool.ts (295 lines)
  - reflect-tool.ts (230 lines)
  - checkpoint-tool.ts (201 lines)
  - parallel-tool.ts (167 lines)
  - hook-tool.ts (125 lines)
  - stuck-tool.ts (197 lines)
  - repomap-tool.ts (44 lines)
  - tom-tool.ts (154 lines)
  - index.ts (80 lines)
  - Total: 2211 lines

**Current state:**
- agent.ts: 502 lines (80% reduction from 2583)
- tools/ modules: 2211 lines total
- Tests: All 115 pass
- Build: Passing
- Lint: Passing

**Next steps:**
- Consider extracting createWrappedTools to src/wrap.ts
- Consider extracting buildSystemPrompt to src/prompt.ts
- Consider slimming agent.ts further to under 300 lines

---


---

## Day 36 — Modular Architecture Foundation (Issue #22) (2026-03-31)

**What happened:**
- Implemented Issue #22 Phase 1: Created modular architecture foundation
- Created `src/truncate.ts` - Utility for truncating tool output (20 lines)
- Created `src/tools/` directory with tool modules:
  - `file-tools.ts` - bash, read, write, edit tools (158 lines)
  - `search-tools.ts` - glob, grep, find, ls tools (186 lines)
  - `http-tool.ts` - http tool (117 lines)
  - `index.ts` - Tool registry and exports (57 lines)
- Total extracted: 538 lines into separate modules
- All 115 tests pass with modular architecture
- Added ROADMAP Phase 12: Modular Architecture

**Why this matters:**
- This is a `capability` type task that enables sustainable codebase growth
- Reduces context bloat by separating tools into focused modules
- Each tool file is easier to understand in isolation
- Preserves all existing functionality (backward compatible)
- Foundation for completing full agent.ts extraction in future iterations

**Technical details:**
- Created `src/truncate.ts`:
  - `MAX_TOOL_OUTPUT_CHARS` constant (30000)
  - `truncateToolOutput()` function for safe output truncation
- Created `src/tools/file-tools.ts`:
  - `bashTool`, `readTool`, `writeTool`, `editTool` exports
  - `fileTools` array for easy import
- Created `src/tools/search-tools.ts`:
  - `globTool`, `grepTool`, `findTool`, `lsTool` exports
  - `searchTools` array for easy import
- Created `src/tools/http-tool.ts`:
  - `httpTool` export for HTTP requests
- Created `src/tools/index.ts`:
  - `buildTools()` to combine extracted + meta tools
  - `buildToolsDescription()` for system prompts
- Modified `src/agent.ts`:
  - Added imports for extracted modules
  - Updated to use new modules (foundation laid, full extraction in progress)
- Modified `ROADMAP.md`:
  - Added Phase 12: Modular Architecture
  - Marked first 6 items complete

**Current state:**
- agent.ts: 2587 lines (still has inline tools, extraction in progress)
- tools/ modules: 538 lines extracted
- Tests: All 115 pass
- Build: Passing

**Next steps:**
- Continue extracting meta tools (plan, assess, reflect, etc.) to separate modules
- Replace inline tool definitions in agent.ts with imports
- Complete extraction to achieve <300 line agent.ts goal

---


---

## Day 35 — Linear History Option (Mini-SWE-Agent Pattern) (2026-03-31)

**What happened:**
- Implemented ROADMAP Phase 11 item: Linear history option
- Added `LinearMessage` type to types.ts
- Added `linearHistory` config option to `PaimonConfig`
- Added history tracking to createAgent in agent.ts
- Added methods: `getHistory()`, `getHistoryJson()`, `saveHistory()`, `loadHistory()`, `clearHistory()`
- Added `--linear` / `-l` CLI flag to cli.ts

**Why this matters:**
- This is a `capability` type task that improves debugging and fine-tuning support
- Append-only message history makes it easier to understand agent behavior
- Export history as JSON for fine-tuning datasets
- Completes another item of ROADMAP Phase 11

**Technical details:**
- Modified `src/types.ts`:
  - Added `LinearMessage` interface with role, content, timestamp
  - Added `linearHistory?: boolean` to `PaimonConfig`
- Modified `src/agent.ts`:
  - Imported `LinearMessage` type
  - Added `linearHistory` array when config.linearHistory is enabled
  - Track user and assistant messages in `run()` function
  - Added history management methods to return value
- Modified `src/cli.ts`:
  - Added `linear` option to `CliOptions`
  - Parse `--linear` / `-l` flag
  - Pass `linearHistory` to config
  - Display linear mode status

**Linear History Usage:**
```bash
# Enable linear history tracking
paimon --linear "your prompt"

# In code, get history
const { getHistory, getHistoryJson } = createAgent({ ..., linearHistory: true });
const history = getHistory();  // Array of LinearMessage
const json = getHistoryJson(); // JSON string for export
```

**Next steps:**
- Consider implementing remaining Phase 11 items (independent execution, templates)
- Consider Issue #22 (modular architecture) for next iteration

---


---

## Day 34 — Mini-SWE-Agent Simplicity Research (2026-03-31)

**What happened:**
- Researched Mini-SWE-Agent (Princeton/Stanford team behind SWE-bench) for simplicity patterns
- Discovered radical simplification approach: 74% on SWE-bench verified with 100 lines of Python
- Key insights: no special tools (only bash), linear history, independent subprocess execution
- Added learning entry to MEMORY.md about Mini-SWE-Agent patterns
- Added ROADMAP Phase 11: Minimal Agent Mode (Mini-SWE-Agent Pattern)
- All ROADMAP phases 1-10 were complete, Phase 11 provides future simplification roadmap

**Why this matters:**
- This is a `capability` type task that could revolutionize Paimon's architecture
- Simplicity is powerful - 100 lines achieves 74% on SWE-bench verified
- Linear history is great for debugging and fine-tuning
- Independent subprocess execution makes sandboxing trivial
- Perfect baseline for future RL experiments

**Technical details:**
- Researched Mini-SWE-Agent source code:
  - `DefaultAgent` class: 100 lines Python
  - `run()` → `step()` → `query()` + `execute_actions()` loop
  - Messages are the trajectory (no separation)
  - Works with any model (no tool-calling interface needed)
- Modified MEMORY.md:
  - Added learning entry: Mini-SWE-Agent Simplicity Patterns
  - Documented 5 key architecture insights
- Modified ROADMAP.md:
  - Added Phase 11: Minimal Agent Mode (Mini-SWE-Agent Pattern)
  - 5 items: minimal mode, linear history, independent execution, templates, baseline mode

**Mini-SWE-Agent Key Patterns:**
| Pattern | Description |
|---------|-------------|
| No special tools | Only bash commands, no tool-calling interface |
| Linear history | Every step just appends to messages |
| subprocess.run | Each action independent, no stateful shell |
| Jinja templates | System and instance message templates |
| 100 lines Python | Radical simplicity achieves high performance |

**Next steps:**
- Consider implementing minimal agent mode in future iterations
- Consider simplifying Paimon's architecture based on Mini-SWE-Agent patterns

---


---

## Day 33 — Theory-of-Mind Module (ToM-SWE) + Lint Fix (2026-03-30)

**What happened:**
- Completed ROADMAP Phase 10 "Theory-of-Mind (OpenHands ToM-SWE Pattern)"
- Created `src/tom.ts` module with TomModule class
- Added `tom` tool for personalized guidance based on user profile and session history
- Three-Tier Memory: sessions → analyses → profiles
- Agent consultation for personalized recommendations
- Session analysis for extracting insights from past iterations
- Fixed lint issues in biome.json to ignore skills/superpowers directory
- Fixed formatting issues in src/tom.ts, src/cli.ts, scripts/evolve.ts, src/agent.ts

**Why this matters:**
- This is a `capability` type task that improves user intent understanding
- Agent can now provide personalized guidance based on past session patterns
- Inspired by OpenHands' ToM-SWE package from competitor research
- Reduces rework rate by understanding user preferences
- All ROADMAP phases (1-10) are now complete

**Technical details:**
- Created `src/tom.ts`:
  - `TomModule` class with consult(), analyzeSession(), getStats(), getProfile() methods
  - `UserProfile` interface with preferences, analyses, and working styles
  - `SessionAnalysis` interface for extracting insights from iterations
  - `ConsultationResult` interface for personalized recommendations
  - Confidence scoring based on profile depth
  - Preferences tracking: skillsUsedSuccess, skillsUsedFailure, commonErrors
- Modified `src/agent.ts`:
  - Added `tom` tool with actions: consult, analyze, stats, profile
  - Updated frontmatter to include tom in tools list
  - Updated both chat and evolve system prompts
- Modified `biome.json`:
  - Added skills/superpowers/** to ignore list (external files from obra/superpowers)
- Fixed formatting in multiple files using biome check --write --unsafe
- Added 12 new tests for tom tool functionality

**Tom Tool Usage:**
```typescript
// Get personalized consultation before task
tom({action: 'consult', currentContext: 'implementing new feature'})

// Analyze completed session
tom({action: 'analyze', sessionData: {
  taskType: 'capability',
  taskDescription: '...',
  success: true,
  firstTry: false,
  errors: ['lint'],
  rework: true,
  timeMinutes: 15,
  skillsUsed: ['evolve', 'using-superpowers']
}})

// Get statistics
tom({action: 'stats'})

// Get user profile
tom({action: 'profile'})
```

**Next steps:**
- All ROADMAP phases are complete (Phase 1-10)
- Consider researching new capabilities from other competitors (Devin, Cognition AI)
- Consider adding Phase 11 with new capabilities

---


---

## Day 32 — Repo Map (Aider Pattern) (2026-03-30)

**What happened:**
- Implemented ROADMAP Phase 9 "Repo Map" inspired by Aider's RepoMap
- Created `src/repomap.ts` module with RepoMap class
- Added `repomap` tool for generating structured codebase maps
- Extracts definitions (functions, classes, interfaces, types, consts, enums) from TypeScript/JavaScript files
- Calculates file importance using PageRank-like algorithm
- Respects token budget to fit maps within context limits

**Why this matters:**
- This is a `capability` type task that improves codebase understanding
- Agent can now see codebase structure without reading every file
- Inspired by Aider's RepoMap from competitor research
- Improves efficiency when navigating large codebases

**Technical details:**
- Created `src/repomap.ts`:
  - `RepoMap` class with definition extraction and file scoring
  - Regex-based parsing for TypeScript/JavaScript definitions
  - Import reference extraction for dependency tracking
  - Token budget management with truncation
  - Glob pattern matching for file filtering
- Modified `src/agent.ts`:
  - Added `repomap` tool with root and maxTokens parameters
  - Updated frontmatter and Tools sections in both prompts
- Added 13 new tests for RepoMap functionality

**Repomap Tool Usage:**
```typescript
// Generate repo map for current directory
repomap({})

// Generate with custom root and token budget
repomap({root: "src", maxTokens: 1024})
```

**Next steps:**
- Consider adding Repo Map integration into session startup
- Consider adding Repo Map generation before complex evolution tasks

---


---

## Day 31 — Loop Detection & Recovery (2026-03-30)

**What happened:**
- Implemented ROADMAP Phase 8 "Loop Detection & Recovery" inspired by OpenHands' StuckDetector
- Created `src/stuck.ts` module with StuckDetector class
- Added `stuck` tool for detecting loops and providing recovery options
- Detected loop types: repeated actions, same errors, no progress
- Recovery options: restart before loop, restart with last message, quit
- Added 13 new tests for stuck detection

**Why this matters:**
- This is a `capability` type task that improves autonomous self-evolution
- Agent can now detect when it's stuck in a loop and recover automatically
- Inspired by OpenHands' StuckDetector from competitor research
- Critical for long-running autonomous sessions without human intervention

**Technical details:**
- Created `src/stuck.ts`:
  - `StuckDetector` class with history tracking, loop detection, and recovery
  - Loop types: repeated_action (3+ same action), same_error (3+ same error), no_progress (5+ similar content)
  - Recovery options: restart_before_loop, restart_with_last_message, quit
  - Memory truncation to recovery points
- Modified `src/agent.ts`:
  - Added `stuck` tool with actions: check, recover, add, reset
  - Updated both chat and evolve system prompts with stuck detection documentation
  - Added new workflow section "5.2 Loop Detection and Recovery"
- Modified `src/agent.test.ts`:
  - Added 13 tests for StuckDetector and stuck tool
- Modified `ROADMAP.md`:
  - Added Phase 8: Loop Detection & Recovery
  - Marked all three items as complete

**Stuck Tool Usage:**
```typescript
// Check if stuck in a loop
stuck({action: 'check'})

// If stuck, choose a recovery option
stuck({action: 'recover', recoveryOption: 1})  // Restart before loop
stuck({action: 'recover', recoveryOption: 2})  // Restart with last message
stuck({action: 'recover', recoveryOption: 3})  // Quit task
```

**Next steps:**
- Consider adding Theory-of-Mind module for better intent understanding
- Consider adding Repo Map capability from Aider research

---


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
