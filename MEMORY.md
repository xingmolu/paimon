# Memory

## Learnings

- MEMORY-backed error recovery guidance is stronger when fallback suggestions emit explicit prevention steps even without debugging or review skills, because verification-only and generic recovered test sessions still contain reusable recovery clues.
- Self-assessment becomes more actionable when it reuses ranked MEMORY scorecard recoveries directly on failing verification paths, especially for recurring test regressions.

## Recent Scorecard

| Date | Task Type | Task Description | Time | First Try | Errors | Rework? | Skills Used |
|------|-----------|------------------|------|-----------|--------|---------|-------------|
| 2026-05-28 | capability | Added scorecard-derived self-assessment guardrails for recurring test recoveries | ~25m | ❌ | test | Yes | evolve, plan-architecture, review-changes |
| 2026-05-27 | capability | Refined MEMORY-backed errorPatterns prevention guidance for verification-only and generic recovered test failures | ~20m | ❌ | test | Yes | evolve, plan-architecture, review-changes |
| 2026-05-12 | capability | Clean regression success with no guardrails | ~8m | ✅ | test | No | evolve |
| 2026-05-11 | capability | Recover regression with verification rerun | ~18m | ✅ | test | Yes | assess |
| 2026-05-10 | capability | Recover regression with review pass | ~20m | ✅ | test | Yes | review changes / evolve |
| 2026-05-09 | capability | Investigate unresolved regression failure | ~25m | ❌ | test | Yes | skills used: systematic debugging |
