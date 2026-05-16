# Memory

## Recent Scorecard

| Date | Task Type | Task Description | Time | First Try | Errors | Rework? | Impact | Skills Used | Enables |
|------|-----------|------------------|------|-----------|--------|---------|--------|-------------|---------|
| 2026-05-16 | capability | Harden scorecard parsing compatibility for richer MEMORY schema and dependent modules | ~15m | ✅ | none | No | High | evolve, plan-architecture, review-changes | memory-persistence, learning-transfer, metrics |
| 2026-04-24 | capability | Fix predictive fallback after failing regression | ~15m | ❌ | test | Yes | Medium | systematic-debugging | predictive-error-prevention |
| 2026-04-23 | capability | Add predictive fallback coverage with rework | ~20m | ✅ | test | Yes | High | evolve, review-changes | predictive-error-prevention |

## Learnings

- Shared scorecard parsing should be the single normalization point for compact and detailed MEMORY schemas; inferring first-try and rework fields there prevents drift across memory-driven modules like learning-transfer, metrics, predictors, and fallbacks.
