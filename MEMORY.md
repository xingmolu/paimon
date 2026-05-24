# Memory

## Recent Scorecard

| Date | Task Type | Task Description | Time | First Try | Errors | Rework? | Impact | Skills Used | Enables |
|------|-----------|------------------|------|-----------|--------|---------|--------|-------------|---------|
| 2026-05-24 | capability | Rank and deduplicate MEMORY-backed self-evaluation recovery guidance and capability gaps | ~20m | ❌ | lint | Yes | High | evolve, plan-architecture, review-changes, verification-before-completion | stronger-self-evaluation-recovery-guidance |
| 2026-05-23 | capability | Rank MEMORY-backed error-pattern fallback suggestions by recovery signal and add prevention guidance | ~20m | ❌ | TS, test | Yes | High | evolve, writing-plans, review-changes, verification-before-completion | stronger-error-recovery-guidance |
| 2026-04-24 | capability | Fix predictive fallback after failing regression | ~15m | ❌ | test | Yes | Medium | systematic-debugging | predictive-fallback-recovery |
| 2026-04-23 | capability | Add predictive fallback coverage with rework | ~20m | ✅ | test | Yes | High | evolve, review-changes | predictive-fallback-guidance |

## Metrics

- First Try Success Rate: 1/4 = 25%
- Average Time: ~19 minutes
- Capability Velocity: 4 capabilities logged
- Error Analysis: lint 1, test 3, TS 1
- Skill Effectiveness: evolve 3 uses, review-changes 3 uses, systematic-debugging 1 use, plan-architecture 1 use, verification-before-completion 2 uses

## Learnings

- When MEMORY-backed recovery guidance exists in multiple modules, rank unresolved failures ahead of successful rework examples and deduplicate repeated descriptions so self-assessment surfaces the most actionable recovery path first.
- Prevention notes tied to the recorded skills used in successful/failed recoveries make MEMORY-backed self-evaluation recommendations more reusable across future regression failures.
