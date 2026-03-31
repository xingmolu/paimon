// Core agent
export { createAgent, type PaimonConfig } from "./agent.js";

// Types (modular extraction)
export type {
	PlanState,
	AssessmentResult,
	ReflectionResult,
	ErrorPattern,
	ParallelTaskResult,
	ParallelResult,
	ErrorMessage,
} from "./types.js";

// Error handling (modular extraction)
export { extractErrorPatterns, getSuggestionForTsError } from "./errors.js";

// Skills parsing (modular extraction)
export {
	parseFrontmatter,
	buildSkillsIndex,
	type SkillFrontmatter,
	type SkillEntry,
} from "./skills.js";

// Theory-of-Mind module
export {
	type ConsultationResult,
	type SessionAnalysis,
	type UserProfile,
	TomModule,
	formatConsultation,
	formatStats,
} from "./tom.js";

// Minimal agent mode
export {
	type MinimalAgentConfig,
	type MinimalMessage,
	MinimalAgent,
	createMinimalAgent,
} from "./minimal-agent.js";
