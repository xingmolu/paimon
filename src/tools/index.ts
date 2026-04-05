/**
 * Tool registry for Paimon agent
 *
 * This module exports all tools used by the agent.
 * Tools are organized by category:
 * - File tools: bash, read, write, edit
 * - Search tools: glob, grep, find, ls
 * - HTTP tool: http
 * - Meta tools: plan, assess, reflect, checkpoint, parallel, hook
 * - Module tools: stuck, repomap, tom, singularity, rag, trajectory, errorPatterns, patternMiner, bugReport, commitMsg
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";

import { adaptiveReasoningToolDefinition } from "./adaptive-reasoning-tool.js";
import { agentBuilderTool } from "./agent-builder-tool.js";
// Import extracted tool modules
import { assessTool } from "./assess-tool.js";
import { autoInvokeTool } from "./auto-invoke-tool.js";
import { benchmarkTool } from "./benchmark-tool.js";
import { bugReportTool } from "./bug-report-tool.js";
import { cacheWarmerToolDefinition } from "./cache-warmer-tool.js";
import { capabilityGapToolDef } from "./capability-gap-tool.js";
import { checkpointTool } from "./checkpoint-tool.js";
import { getClipboardTool } from "./clipboard-tool.js";
import { codeCompletionTool } from "./code-completion-tool.js";
import { commitMsgTool } from "./commit-msg-tool.js";
import { contextBudgetTool } from "./context-budget-tool.js";
import { contextImportanceTool } from "./context-importance-tool.js";
import { conventionsToolDefinition } from "./conventions-tool.js";
import { conversationSharingToolDefinition } from "./conversation-sharing-tool.js";
import { diffAwarePlanTool } from "./diff-aware-planning-tool.js";
import { errorPatternsTool } from "./error-patterns-tool.js";
import { evolutionCostToolDef } from "./evolution-cost-tool.js";
import { evolutionStrategyTool } from "./evolution-strategy-tool.js";
import { evolutionTimelineToolDefinition } from "./evolution-timeline-tool.js";
import { explanatoryOutputStyleTool } from "./explanatory-output-style-tool.js";
import { featureDevTool } from "./feature-dev-tool.js";
import { fileTools } from "./file-tools.js";
import { frontendDesignTool } from "./frontend-design-tool.js";
import { gitWorkflowTool } from "./git-workflow-tool.js";
import { hookTool } from "./hook-tool.js";
import { hookifyTool } from "./hookify-tool.js";
import { httpTool } from "./http-tool.js";
import { ideIntegrationTool } from "./ide-integration-tool.js";
import { imageContextTool } from "./image-context-tool.js";
import { integrationTool } from "./integration-tool.js";
import { intelligenceTool } from "./intelligence-tool.js";
import { interactiveApprovalTool } from "./interactive-approval-tool.js";
import { journalTool } from "./journal-tool.js";
import { learningOutputStyleTool } from "./learning-output-style-tool.js";
import { getLearningTransferManager, learningTransferToolDef } from "./learning-transfer-tool.js";
import { mcpTool } from "./mcp-tool.js";
import { metricsTool } from "./metrics-tool.js";
import { modelMigrationToolDefinition } from "./model-migration-tool.js";
import { multiAgentTool } from "./multi-agent-tool.js";
import { multiFileContextTool } from "./multi-file-context-tool.js";
import { notificationsToolDefinition } from "./notification-tool.js";
import { parallelTool } from "./parallel-tool.js";
import { patternAutoApplyToolDef } from "./pattern-auto-apply-tool.js";
import { patternMinerTool } from "./pattern-miner-tool.js";
import { planTool } from "./plan-tool.js";
import { pluginDevTool } from "./plugin-dev-tool.js";
import { pluginsTool } from "./plugins-tool.js";
import { prReviewToolkitTool } from "./pr-review-toolkit-tool.js";
import { predictiveErrorPreventionTool } from "./predictive-error-prevention-tool.js";
import { ragTool } from "./rag-tool.js";
import { ralphLoopTool } from "./ralph-loop-tool.js";
import { reasoningMemoryTool } from "./reasoning-memory-tool.js";
import { reflectTool } from "./reflect-tool.js";
import { regressionTestingToolDef } from "./regression-testing-tool.js";
import { remoteExecutionToolDef } from "./remote-execution-tool.js";
import { repomapTool } from "./repomap-tool.js";
import { roleBasedAgentsToolDef } from "./role-based-agents-tool.js";
import { rouletteTool } from "./roulette-tool.js";
import { safetyGatesTool } from "./safety-gates-tool.js";
import { sdkTool } from "./sdk-tool.js";
import { searchTools } from "./search-tools.js";
import { securityGuidanceTool } from "./security-guidance-tool.js";
import { selfEvaluationToolDef } from "./self-evaluation-tool.js";
import { selfHealingToolWrapper } from "./self-healing-tool.js";
import { sessionReplayToolDef } from "./session-replay-tool.js";
import { singularityTool } from "./singularity-tool.js";
import { stuckTool } from "./stuck-tool.js";
import { syntheticTaskGenToolDef } from "./synthetic-task-gen-tool.js";
import { taskPredictorTool } from "./task-predictor-tool.js";
import { taskTrackingTool } from "./task-tracking-tool.js";
import { tokenTrackingTool } from "./token-tracking-tool.js";
import { tomTool } from "./tom-tool.js";
import { toolCacheTool } from "./tool-cache-tool.js";
import { toolUsageAnalyticsTool } from "./tool-usage-analytics-tool.js";
import { trajectoryTool } from "./trajectory-tool.js";
import { visualProgressTool } from "./visual-progress-tool.js";
import { voiceToCodeToolDefinition } from "./voice-to-code-tool.js";
import { watchToolDef } from "./watch-tool.js";

// Meta tools that have been extracted
export const metaTools: AgentTool[] = [
	planTool,
	assessTool,
	reflectTool,
	checkpointTool,
	parallelTool,
	hookTool,
	stuckTool,
	repomapTool,
	tomTool,
	singularityTool,
	ragTool,
	trajectoryTool,
	errorPatternsTool,
	patternMinerTool,
	bugReportTool,
	commitMsgTool,
	rouletteTool,
	pluginsTool,
	metricsTool,
	taskPredictorTool,
	intelligenceTool,
	sdkTool,
	benchmarkTool,
	safetyGatesTool,
	multiAgentTool,
	tokenTrackingTool,
	toolCacheTool,
	journalTool,
	contextBudgetTool,
	interactiveApprovalTool,
	ralphLoopTool,
	hookifyTool,
	autoInvokeTool,
	explanatoryOutputStyleTool,
	securityGuidanceTool,
	learningOutputStyleTool,
	featureDevTool,
	prReviewToolkitTool,
	pluginDevTool,
	agentBuilderTool,
	selfHealingToolWrapper,
	contextImportanceTool,
	frontendDesignTool,
	remoteExecutionToolDef,
	roleBasedAgentsToolDef,
	syntheticTaskGenToolDef,
	taskTrackingTool,
	selfEvaluationToolDef,
	watchToolDef,
	sessionReplayToolDef,
	patternAutoApplyToolDef,
	learningTransferToolDef,
	evolutionCostToolDef,
	regressionTestingToolDef,
	capabilityGapToolDef,
	diffAwarePlanTool,
	multiFileContextTool,
	visualProgressTool,
	ideIntegrationTool,
	codeCompletionTool,
	reasoningMemoryTool,
	toolUsageAnalyticsTool,
	modelMigrationToolDefinition,
	evolutionStrategyTool,
	evolutionTimelineToolDefinition,
	adaptiveReasoningToolDefinition,
	predictiveErrorPreventionTool,
	gitWorkflowTool,
	voiceToCodeToolDefinition,
	conversationSharingToolDefinition,
	imageContextTool,
	integrationTool,
	cacheWarmerToolDefinition,
	mcpTool,
	getClipboardTool(),
	conventionsToolDefinition,
	notificationsToolDefinition,
];

/**
 * Build complete tool array for the agent
 * All tools are now extracted to modules
 *
 * @returns Combined array of all tools
 */
export function buildTools(): AgentTool[] {
	return [...fileTools, ...searchTools, httpTool, ...metaTools];
}

/**
 * Build tools description for system prompt
 *
 * @param tools - Array of tools to describe
 * @returns Formatted description of all tools
 */
export function buildToolsDescription(tools: AgentTool[]): string {
	const lines: string[] = [];

	for (const tool of tools) {
		lines.push(`- ${tool.name}: ${tool.description}`);
	}

	return lines.join("\n");
}

// Re-export individual tools for direct access
export { fileTools, searchTools, httpTool };
export { assessTool } from "./assess-tool.js";
export { bugReportTool } from "./bug-report-tool.js";
export { checkpointTool } from "./checkpoint-tool.js";
export { commitMsgTool } from "./commit-msg-tool.js";
export { errorPatternsTool } from "./error-patterns-tool.js";
export { bashTool, readTool, writeTool, editTool } from "./file-tools.js";
export { globTool, grepTool, findTool, lsTool } from "./search-tools.js";
export { hookTool } from "./hook-tool.js";
export { parallelTool } from "./parallel-tool.js";
export { patternMinerTool } from "./pattern-miner-tool.js";
export { planTool, getCurrentPlan, setCurrentPlan } from "./plan-tool.js";
export { ragTool } from "./rag-tool.js";
export { reflectTool } from "./reflect-tool.js";
export { repomapTool } from "./repomap-tool.js";
export { stuckTool } from "./stuck-tool.js";
export { tomTool } from "./tom-tool.js";
export { singularityTool } from "./singularity-tool.js";
export { trajectoryTool } from "./trajectory-tool.js";
export { rouletteTool, initRoulette } from "./roulette-tool.js";
export { pluginsTool, getPluginTools } from "./plugins-tool.js";
export { metricsTool } from "./metrics-tool.js";
export { taskPredictorTool } from "./task-predictor-tool.js";
export { intelligenceTool } from "./intelligence-tool.js";
export { sdkTool, createSDKTool } from "./sdk-tool.js";
export { benchmarkTool } from "./benchmark-tool.js";
export { safetyGatesTool, getSafetyGatesForHook } from "./safety-gates-tool.js";
export { multiAgentTool } from "./multi-agent-tool.js";
export { tokenTrackingTool, getTokenTracker, resetTokenTracker } from "./token-tracking-tool.js";
export { toolCacheTool } from "./tool-cache-tool.js";
export { journalTool } from "./journal-tool.js";
export { contextBudgetTool, createContextBudgetTool } from "./context-budget-tool.js";
export { getToolCache, resetToolCache, ToolCache, generateCacheKey } from "../tool-cache.js";
export {
	journalManager,
	parseJournal,
	getJournalStats,
	truncateJournal,
	listArchives,
	readArchivedEntry,
} from "../journal-manager.js";
export type { JournalEntry, JournalStats, TruncateResult } from "../journal-manager.js";
export {
	getBenchmarkRunner,
	createSampleTasks,
	BenchmarkRunner,
} from "../benchmark.js";
export {
	ContextBudgetManager,
	getGlobalContextBudgetManager,
	initGlobalContextBudgetManager,
	DEFAULT_CONTEXT_BUDGET_CONFIG,
} from "../context-budget.js";
export type {
	ContextBudgetConfig,
	ContextUsageStats,
	ContextBudgetStats,
	OptimizationSuggestion,
} from "../context-budget.js";
export {
	getSDK,
	initSDK,
	EvolutionSDK,
	formatSDKStats,
	formatSession,
	formatEvolutionResult,
	formatBatchResult,
} from "../sdk.js";
export {
	getApprovalManager,
	InteractiveApprovalManager,
	interactiveApprovalTool,
} from "../interactive-approval.js";
export type {
	ApprovalCategory,
	ApprovalRequest,
	ApprovalStatus,
	InteractiveApprovalConfig,
	InteractiveApprovalStats,
} from "../interactive-approval.js";
export {
	getRalphLoopManager,
	RalphLoopManager,
	resetRalphLoopManager,
} from "../ralph-loop.js";
export type {
	RalphLoopState,
	RalphLoopConfig,
	RalphLoopStats,
} from "../ralph-loop.js";
export {
	getHookifyManager,
	HookifyManager,
} from "../hookify.js";
export type {
	HookifyRuleConfig,
	HookifyRule,
	HookifyStats,
	ConversationMessage,
	ConversationAnalysis,
} from "../hookify.js";
export {
	getAutoInvokeManager,
	AutoInvokeManager,
} from "../auto-invoke.js";
export type {
	AutoInvokeRule,
	AutoInvokeTrigger,
	AutoInvokeConfig,
	AutoInvokeStats,
	AutoInvokeSuggestion,
	TriggerType,
	ContextType,
} from "../auto-invoke.js";
export {
	getExplanatoryOutputStyleManager,
	ExplanatoryOutputStyleManager,
} from "../explanatory-output-style.js";
export type {
	InsightCategory,
	EducationalInsight,
	ExplanatoryOutputStyleConfig,
	ExplanatoryOutputStyleStats,
} from "../explanatory-output-style.js";
export {
	getSecurityGuidanceManager,
	SecurityGuidanceManager,
	resetSecurityGuidanceManager,
} from "../security-guidance.js";
export type {
	SecurityCategory,
	RiskLevel,
	SecurityPattern,
	SecurityWarning,
	SecurityScanResult,
	SecurityGuidanceStats,
	SecurityGuidanceConfig,
} from "../security-guidance.js";
export {
	getLearningManager,
	LearningOutputStyleManager,
} from "../learning-output-style.js";
export type {
	DecisionPointCategory,
	DecisionPoint,
	LearningInsight,
	LearningOutputStyleConfig,
	LearningOutputStyleStats,
	SessionContext,
} from "../learning-output-style.js";
export { learningOutputStyleTool } from "./learning-output-style-tool.js";
export { featureDevTool } from "./feature-dev-tool.js";
export {
	getFeatureDevManager,
	FeatureDevManager,
} from "../feature-dev.js";
export type {
	FeaturePhase,
	AgentType,
	AgentFocus,
	AgentTask,
	ClarifyingQuestion,
	ArchitectureApproach,
	ReviewFinding,
	FeatureDevState,
	FeatureDevConfig,
	FeatureDevStats,
} from "../feature-dev.js";
export { prReviewToolkitTool } from "./pr-review-toolkit-tool.js";
export {
	getPRReviewToolkit,
	PRReviewToolkitManager,
} from "../pr-review-toolkit.js";
export type {
	ReviewAgentType,
	ReviewAspect,
	ConfidenceLevel,
	SeverityLevel,
	PRReviewFinding,
	TypeDesignAnalysis,
	TestCoverageAnalysis,
	CommentAnalysis,
	SilentFailureAnalysis,
	SpecializedReviewAgent,
	PRReviewToolkitConfig,
	PRReviewToolkitStats,
	ReviewSession,
	ReviewResult,
} from "../pr-review-toolkit.js";
export { pluginDevTool } from "./plugin-dev-tool.js";
export { PluginDevManager } from "../plugin-dev.js";
export type {
	PluginDevPhase,
	PluginSkillType,
	PluginAgentType,
	PluginComponentType,
	PluginComponentSpec,
	PhaseState,
	PluginDevState,
	PluginSkillDef,
	PluginAgentDef,
	PluginDevConfig,
	PluginDevStats,
} from "../plugin-dev.js";
export { agentBuilderTool } from "./agent-builder-tool.js";
export {
	getAgentBuilder,
	initAgentBuilder,
	AgentBuilder,
	formatAgentResult,
	formatAgentStats,
	formatAgentDefinition,
	formatChainDefinition,
	formatSwarmDefinition,
} from "../agent-builder.js";
export type {
	AgentDefinition,
	AgentContext,
	AgentConfig,
	AgentLifecycleHooks,
	AgentProgress,
	AgentResult,
	AgentChain,
	ChainOutputMapping,
	AgentSwarm,
	SwarmStrategy,
	SwarmCoordinator,
	AgentRegistryRecord,
	AgentBuilderStats,
	AgentBuilderConfig,
} from "../agent-builder.js";
export {
	getSelfHealingManager,
	initSelfHealingManager,
	SelfHealingManager,
	selfHealingTool,
} from "../self-healing.js";
export type {
	SelfHealingCategory,
	SelfHealingSeverity,
	SelfHealingResult,
	SelfHealingPattern,
	SelfHealingFixStrategy,
	SelfHealingContext,
	SelfHealingFixResult,
	SelfHealingStats,
	SelfHealingDetection,
	SelfHealingConfig,
	SelfHealingToolArgs,
} from "../self-healing.js";
export {
	getGlobalContextImportanceScorer,
	initGlobalContextImportanceScorer,
	ContextImportanceScorer,
} from "../context-importance.js";
export type {
	MessageRole,
	ImportanceFactor,
	ContentType,
	ImportanceLevel,
	MessageImportanceScore,
	MessageForAnalysis,
	TruncationRecommendation,
	ContextImportanceAnalysis,
	ContextImportanceConfig,
	ContextImportanceStats,
} from "../context-importance.js";
export { frontendDesignTool } from "./frontend-design-tool.js";
export { FrontendDesignManager } from "../frontend-design.js";
export type {
	DesignPrinciple,
	DesignCategory,
	FrontendContext,
	DesignGuidance,
	FrontendDesignConfig,
	FrontendDesignStats,
} from "../frontend-design.js";
export { remoteExecutionToolDef } from "./remote-execution-tool.js";
export {
	remoteExecutionTool,
	getRemoteExecutionManager,
	initRemoteExecutionManager,
} from "../remote-execution.js";
export type {
	EnvironmentType,
	ShellSessionState,
	ExecutionResult,
	ShellSession,
	RemoteEnvironmentConfig,
	RemoteEnvironment,
	RemoteExecutionStats,
	RemoteExecutionConfig,
	EnvironmentAdapter,
	LocalEnvironmentAdapter,
	DockerEnvironmentAdapter,
	RemoteExecutionManager,
	RemoteExecutionToolArgs,
} from "../remote-execution.js";
export { roleBasedAgentsToolDef } from "./role-based-agents-tool.js";
export {
	getRoleBasedAgentManager,
	RoleBasedAgentManager,
} from "../role-based-agents.js";
export type {
	AgentRole,
	SOPPhase,
	ArtifactType,
	RoleOutput,
	Artifact,
	AgentRoleDefinition,
	SOPWorkflow,
	RoleBasedSession,
	RoleBasedAgentsConfig,
	RoleBasedAgentsStats,
} from "../role-based-agents.js";
export { taskTrackingTool } from "./task-tracking-tool.js";
export {
	getTaskTrackingManager,
	TaskTrackingManager,
	executeTaskTrackingTool,
	taskTrackingToolDefinition,
} from "../task-tracking.js";
export type {
	Task,
	TaskSession,
	TaskTrackingStats,
} from "../task-tracking.js";
export { syntheticTaskGenToolDef } from "./synthetic-task-gen-tool.js";
export {
	getSyntheticTaskGenerator,
	SyntheticTaskGenerator,
	syntheticTaskGenTool,
} from "../synthetic-task-gen.js";
export type {
	SyntheticTaskType,
	TaskDifficulty,
	TaskCategory,
	SyntheticTask,
	GenerationScenario,
	ValidationResult,
	TrainingData,
	SyntheticTaskGenConfig,
	SyntheticTaskGenStats,
} from "../synthetic-task-gen.js";
export { selfEvaluationToolDef } from "./self-evaluation-tool.js";
export {
	getSelfEvaluationManager,
	SelfEvaluationManager,
} from "../self-evaluation.js";
export type {
	EvaluationCriterion,
	EvaluationResult,
	PerformanceDimension,
	CriterionScore,
	SelfEvaluation,
	PerformanceTrend,
	SelfEvaluationConfig,
	SelfEvaluationStats,
} from "../self-evaluation.js";
export { watchToolDef } from "./watch-tool.js";
export {
	FileWatcher,
	getFileWatcher,
	initFileWatcher,
	stopFileWatcher,
	getWatchStats,
} from "../watch.js";
export type {
	WatchActionType,
	AIComment,
	FileChange,
	WatchConfig,
	WatchStats,
} from "../watch.js";
export {
	getIterationContextManager,
	initIterationContextManager,
	IterationContextManager,
} from "../iteration-context.js";
export type {
	IterationContext,
	IterationContextConfig,
} from "../iteration-context.js";
export { sessionReplayToolDef } from "./session-replay-tool.js";
export {
	getSessionReplayManager,
	initSessionReplayManager,
	SessionReplayManager,
} from "../session-replay.js";
export type {
	ReplayMode,
	PatternType,
	ExtractedPattern,
	SessionComparison,
	StepWalkthrough,
	ReplayStats,
	SessionReplayConfig,
	ReplayResult,
} from "../session-replay.js";
export { patternAutoApplyToolDef } from "./pattern-auto-apply-tool.js";
export {
	getPatternAutoApplier,
	initPatternAutoApplier,
	PatternAutoApplier,
} from "../pattern-auto-apply.js";
export type {
	PatternMatch,
	AutoApplyResult,
	PatternContext,
	PatternApplicationRecord,
	PatternAutoApplyConfig,
	AutoApplyStats,
} from "../pattern-auto-apply.js";
export {
	getLearningTransferManager,
	initLearningTransferManager,
} from "../learning-transfer.js";
export type {
	TaskSignature,
	SessionLearning,
	SimilarityScore,
	TransferredLearning,
	TransferRecommendation,
	LearningTransferConfig,
	LearningTransferStats,
	LearningTransferToolArgs,
} from "../learning-transfer.js";
export {
	learningTransferToolDef,
	getLearningTransferManager as getLearningTransferManagerFromTool,
} from "./learning-transfer-tool.js";
export { evolutionCostToolDef, handleEvolutionCostToolCall } from "./evolution-cost-tool.js";
export {
	getEvolutionCostPredictor,
	resetEvolutionCostPredictor,
	EvolutionCostPredictor,
} from "../evolution-cost.js";
export type {
	ComplexityLevel,
	CostFactors,
	RiskFactor,
	RiskFactorType,
	CostPrediction,
	HistoricalTask,
	EvolutionCostStats,
	EvolutionCostConfig,
} from "../evolution-cost.js";
export { regressionTestingToolDef } from "./regression-testing-tool.js";
export {
	getRegressionTester,
	initRegressionTester,
	EvolutionRegressionTester,
} from "../regression-testing.js";
export type {
	RegressionTestResult,
	CapabilityHealth,
	RegressionSnapshot,
	SnapshotComparison,
	RegressionTestingStats,
	RegressionTestingConfig,
} from "../regression-testing.js";
export {
	getCapabilityGapDetector,
	initCapabilityGapDetector,
	CapabilityGapDetector,
} from "../capability-gap.js";
export type {
	CapabilityGap,
	CapabilityCoverage,
	GapDetectionStats,
	GapDetectionConfig,
	CompetitorPattern,
} from "../capability-gap.js";
export { getDiffAwarePlanningManager } from "../diff-aware-planning.js";
export type {
	DiffAnalysis,
	FileChange as DiffPlanningFileChange,
	Hunk,
	Conflict,
	ImpactPrediction,
	DiffAwarePlanningStats,
	DiffAwarePlanningConfig,
} from "../diff-aware-planning.js";
export { diffAwarePlanTool } from "./diff-aware-planning-tool.js";
export { multiFileContextTool } from "./multi-file-context-tool.js";
export { RepoMap } from "../repomap.js";
export type {
	SymbolUsage,
	ChangeImpact,
	RelatedFiles,
} from "../repomap.js";
export {
	getVisualProgressManager,
	VisualProgressManager,
	resetVisualProgressManager,
} from "../visual-progress.js";
export type {
	ProgressPhase,
	StepStatus,
	ProgressStep,
	ProgressSession,
	HistoricalTiming,
	VisualProgressConfig,
	VisualProgressStats,
} from "../visual-progress.js";
export { visualProgressTool } from "./visual-progress-tool.js";
export { ideIntegrationTool } from "./ide-integration-tool.js";
export {
	getIDEIntegrationManager,
	initIDEIntegrationManager,
	IDEIntegrationManager,
} from "../ide-integration.js";
export type {
	IDEContext,
	DetectedIDE,
	InlineSuggestion,
	IDENotification,
	IDEIntegrationStats,
	IDEIntegrationConfig,
} from "../ide-integration.js";
export { codeCompletionTool } from "./code-completion-tool.js";
export {
	getCodeCompletionManager,
	initCodeCompletionManager,
	CodeCompletionManager,
} from "../code-completion.js";
export type {
	CodeCompletion,
	CodeContext,
	CodePattern,
	ImportSuggestion,
	FunctionSignature,
	CodeCompletionStats,
	CodeCompletionConfig,
} from "../code-completion.js";
export {
	getReasoningMemoryManager,
	initReasoningMemoryManager,
	ReasoningMemoryManager,
} from "../reasoning-memory.js";
export type {
	ReasoningStep,
	ReasoningChain,
	ReasoningPattern,
	ReasoningMemoryConfig,
	ReasoningMemoryStats,
	SimilarChainResult,
} from "../reasoning-memory.js";
export {
	getToolUsageAnalyticsManager,
	initToolUsageAnalyticsManager,
	resetToolUsageAnalyticsManager,
	ToolUsageAnalyticsManager,
} from "../tool-usage-analytics.js";
export type {
	ToolUsageRecord,
	ToolUsageStats,
	ToolCombination,
	ToolUsageInsight,
	ToolUsageAnalyticsConfig,
	ToolUsageAnalyticsStats,
} from "../tool-usage-analytics.js";
export { toolUsageAnalyticsTool } from "./tool-usage-analytics-tool.js";
export {
	getModelMigrationManager,
	initModelMigrationManager,
	ModelMigrationManager,
	modelMigrationTool,
} from "../model-migration.js";
export type {
	ModelMigration,
	ModelChange,
	MigrationRule,
	ModelMigrationConfig,
	ModelMigrationStats,
} from "../model-migration.js";
export {
	getEvolutionStrategyPlanner,
	resetEvolutionStrategyPlanner,
	EvolutionStrategyPlanner,
} from "../evolution-strategy.js";
export type {
	EvolutionState,
	StrategyRecommendation,
	StrategyType,
	CapabilityEnabler,
	EvolutionStrategyConfig,
	StrategyAnalysisResult,
} from "../evolution-strategy.js";
export { evolutionStrategyTool } from "./evolution-strategy-tool.js";
export {
	getEvolutionTimelineGenerator,
	initEvolutionTimelineGenerator,
	EvolutionTimelineGenerator,
	evolutionTimelineTool,
} from "../evolution-timeline.js";
export type {
	TimelineEvent,
	TimelineDay,
	TimelinePhase,
	TimelineMilestone,
	EvolutionTimeline,
	TimelineGeneratorConfig,
	TimelineGeneratorStats,
	EvolutionTimelineToolArgs,
} from "../evolution-timeline.js";
export { evolutionTimelineToolDefinition } from "./evolution-timeline-tool.js";
export {
	getAdaptiveReasoningManager,
	initAdaptiveReasoningManager,
	AdaptiveReasoningManager,
} from "../adaptive-reasoning.js";
export type {
	ReasoningStrategy,
	TaskContext,
	StrategyProfile,
	StrategySelection,
	StrategyOutcome,
	AdaptiveReasoningStats,
	AdaptiveReasoningConfig,
} from "../adaptive-reasoning.js";
export { adaptiveReasoningToolDefinition } from "./adaptive-reasoning-tool.js";
export { predictiveErrorPreventionTool } from "./predictive-error-prevention-tool.js";
export {
	getPredictiveErrorPreventionManager,
	initPredictiveErrorPreventionManager,
	PredictiveErrorPreventionManager,
} from "../predictive-error-prevention.js";
export type {
	ErrorPrediction,
	PredictionContext,
	ErrorPattern,
	PredictionStats,
	PredictiveErrorPreventionConfig,
} from "../predictive-error-prevention.js";
export { gitWorkflowTool } from "./git-workflow-tool.js";
export {
	getGitWorkflowManager,
	GitWorkflowManager,
	gitWorkflowTool as gitWorkflowToolImpl,
} from "../git-workflow.js";
export type {
	BranchStatus,
	PullRequestInfo,
	WorkflowResult,
	GitWorkflowConfig,
} from "../git-workflow.js";
export {
	voiceToCodeToolDefinition,
	voiceToCodeToolDefinition as voiceToCodeTool,
} from "./voice-to-code-tool.js";
export {
	getVoiceToCodeManager,
	VoiceToCodeManager,
} from "../voice-to-code.js";
export type {
	VoiceCommand,
	ParsedAction,
	VoiceSession,
	VoiceToCodeConfig,
	VoiceCommandMapping,
	VoiceToCodeStats,
} from "../voice-to-code.js";
export {
	conversationSharingToolDefinition,
	conversationSharingTool,
} from "./conversation-sharing-tool.js";
export {
	getConversationSharingManager,
	ConversationSharingManager,
} from "../conversation-sharing.js";
export type {
	SharedSession,
	SharedMessage,
	SessionMetadata,
	ExportOptions,
	ImportResult,
	SharingStats,
	ConversationSharingConfig,
} from "../conversation-sharing.js";
export { imageContextTool } from "./image-context-tool.js";
export { getManager as getImageContextManager, ImageContextManager } from "../image-context.js";
export type {
	ImageInfo,
	WebPageInfo,
	VisionModel,
	ImageContextStats,
	ImageContextConfig,
} from "../image-context.js";
export { integrationTool } from "./integration-tool.js";
export {
	getIntegrationManager,
	IntegrationManager,
} from "../integration-manager.js";
export type {
	Integration,
	IntegrationEvent,
	NotificationConfig,
	IntegrationConfig,
} from "../integration-manager.js";
export { cacheWarmerToolDefinition } from "./cache-warmer-tool.js";
export {
	getCacheWarmer,
	CacheWarmer,
	resetCacheWarmerInstance,
} from "../cache-warmer.js";
export type {
	CacheWarmerConfig,
	CacheWarmingStats,
	CacheWarmingSession,
} from "../cache-warmer.js";
export { getClipboardTool } from "./clipboard-tool.js";
export {
	ClipboardManager,
	getClipboardManager,
	resetClipboardManager,
} from "../clipboard-manager.js";
export type {
	ClipboardContext,
	ParsedEdit,
	ClipboardConfig,
	ClipboardStats,
} from "../clipboard-manager.js";
export { mcpTool } from "./mcp-tool.js";
export {
	getMCPClient,
	initMCPClient,
	MCPClient,
} from "../mcp-client.js";
export type {
	MCPServerConfig,
	MCPTool as MCPToolType,
	MCPResource,
	MCPPrompt,
	MCPClientStats,
	MCPToolCallResult,
	MCPResourceContent,
	MCPServerStatus,
	MCPClientConfig,
} from "../mcp-client.js";

// Notification Manager exports
export { notificationsToolDefinition } from "./notification-tool.js";
export {
	getNotificationManager,
	NotificationManager,
	sendNotification,
} from "../notification-manager.js";
export type {
	DesktopNotificationConfig,
	NotificationStats,
	NotificationResult,
	NotificationType,
} from "../notification-manager.js";
