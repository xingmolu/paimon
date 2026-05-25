# Memory

## Recent Scorecard

| Date | Task Type | Task Description | Time | First Try | Errors | Rework? | Impact | Skills Used | Enables |
|------|-----------|------------------|------|-----------|--------|---------|--------|-------------|---------|
| 2026-05-25 | capability | Normalize MEMORY-backed error recovery skill parsing so fallback prevention notes survive variant scorecard formatting | ~20m | ✅ | test | Yes | High | evolve, plan-architecture, review-changes | stronger-memory-recovery-guidance |
| 2026-04-24 | capability | Fix predictive fallback after failing regression | ~15m | ❌ | test | Yes | Medium | systematic-debugging | predictive-fallback-recovery |
| 2026-04-23 | capability | Add predictive fallback coverage with rework | ~20m | ✅ | test | Yes | High | evolve, review-changes | predictive-fallback-guidance |

## Learnings

- Normalize MEMORY scorecard skill names before deriving prevention guidance; variant separators like `/`, `+`, and prose prefixes such as `skills used:` otherwise hide reusable recovery advice.

## Metrics

- First Try Success Rate: 2/3 = 67%
- Average Time: ~18 minutes
- Capability Velocity: 1 capability per active session day
- Error Analysis: test = 3
- Skill Effectiveness: evolve = 2/2 successful, review-changes = 2/2 successful, plan-architecture = 1/1 successful
