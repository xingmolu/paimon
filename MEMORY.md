# Memory

Persistent learnings stored across sessions.

---

## Task Types

| Type | Description | Priority |
|------|-------------|----------|
| `capability` | Improves self-evolution ability itself | Highest |
| `reliability` | Improves stability/safety/error handling | Medium |
| `feature` | Adds new general functionality | Lower |

**Rule:** Prefer `capability` > `reliability` > `feature`.

---

## Metrics

- First Try Success Rate: 92% (108/117)
- Average Time: ~15 minutes
- Rework Rate: 8%
- Capability Tasks: 95% (111/117)
- Capability Velocity: 37/day

---

## Active Patterns (High Confidence)

1. **Always verify before commit** — Run `npm run build && npm test -- --run` before any commit. Never commit broken code.
2. **Use `edit` over `write`** — Surgical changes reduce errors. Prefer `edit` for modifications.
3. **One change at a time** — Minimal focused changes have higher success rate.
4. **Fix lint at source** — Run `biome check --fix` after edits to prevent accumulation.
5. **Read skills first** — Always read matched skills before starting a task.
6. **Keep parsers aligned with context file schema** — When STRATEGY/MEMORY/JOURNAL formats are refactored, update dependent analyzers and dashboard parsers in the same change to avoid silent degradation.
7. **Filter self-improvement output for actionability** — Suppress suggestions from generated artifacts, tests, and already-implemented competitor ideas so scans stay high-signal and task selection remains trustworthy.
8. **Keep tool aliases and schemas aligned** — If a tool advertises compatibility aliases (`get`, `list`, `format`), include them in the validation schema and normalize them in execution logic; otherwise capability silently degrades despite documentation claiming support.
9. **Update scorecard parsers when MEMORY schema changes** — Compacting or renaming scorecard sections (`Recent Scorecard` vs `Evolution Scorecard`) can silently break downstream learning systems; parsers should accept both current and legacy layouts until all dependents are migrated.
10. **Centralize schema compatibility logic once multiple modules depend on it** — After a context-file refactor, duplicate ad-hoc parsers drift quickly. Shared parsing utilities reduce repeated fixes and keep timeline, metrics, learning, and recommendation systems consistent.
11. **Migrate remaining consumers off bespoke compatibility parsers** — Leaving even one metrics/dashboard consumer on duplicated table parsing reintroduces silent schema drift risk; shared parser adoption should be completed everywhere.
12. **Suppress self-referential analyzer noise at the output layer** — When a code-analysis engine scans files that define detection regexes, prompts, or safety warnings, filter those suggestions after scan generation instead of weakening the underlying detectors; this preserves real findings while improving task-selection signal.
13. **Treat missing scorecard fields as unknown, not negative evidence** — Compact MEMORY scorecards may omit columns like Impact; metrics and recommendation systems should avoid converting absent data into "Low" or 0%-quality conclusions, or they will distort autonomous task selection.
14. **Shared scorecard parser adoption must include predictors, not just analytics** — Task-selection and recommendation systems like task predictors silently lose historical signal when they keep bespoke MEMORY parsers; migrate all memory-driven decision modules to the same compatibility utility and cover both compact and legacy schemas with regression tests.
15. **Tool actions must return action-matching payloads** — If a tool advertises a `config` action, return configuration data and render configuration output, not reused stats payloads; otherwise autonomous tuning and trust in tool affordances degrade silently.
16. **Avoid hardcoded evolution-history dates when MEMORY already records them** — Strategy and planning modules should derive timeline baselines from the shared scorecard parser so compact and legacy MEMORY schemas stay aligned and long-term strategic analysis does not drift.

---

## Weak Signals (Under Observation)

- TypeScript import errors are recurring (7 occurrences). Pattern: forgetting to import new symbols.
- API timeout errors occur during long sessions. May need better timeout handling.
- Context file bloat reduces decision quality over time (addressed by Issue #25).

---

## Recent Scorecard

| Date | Type | Description | Time | Result | Errors |
|------|------|-------------|------|--------|--------|
| 2026-04-19 | capability | Derive evolution strategy history start from MEMORY scorecard parser with regression coverage | ~15m | ✅ | none |
| 2026-04-19 | capability | Fix selfImprovement config action to return configuration data with regression coverage | ~10m | ✅ | none |
| 2026-04-18 | capability | Migrate task predictor scorecard parsing to shared compatibility utility | ~15m | ✅ | none |
| 2026-04-18 | capability | Treat missing impact data as unknown in metrics and memory recommendations | ~15m | ✅ | none |
| 2026-04-17 | capability | Filter self-improvement security false positives from internal detector files | ~10m | ✅ | none |
| 2026-04-17 | capability | Centralize metrics scorecard parsing on shared parser | ~10m | ✅ | none |
| 2026-04-17 | capability | Restore evolution-timeline and pattern-miner scorecard compatibility with shared parser | ~20m | ✅ | none |
| 2026-04-17 | capability | Fix learningTransfer scorecard compatibility with compact and legacy MEMORY schemas | ~15m | ✅ | none |
| 2026-04-17 | capability | Fix context identifier alias compatibility and relevance scoring | ~15m | ✅ | none |
| 2026-04-17 | capability | Filter low-signal self-improvement suggestions | ~15m | ✅ | none |
| 2026-04-16 | capability | Metrics scorecard compatibility fix | ~15m | ✅ | test |
| 2026-04-16 | reliability | Self-improvement engine false positive fix | ~10m | ✅ | none |
| 2026-04-05 | capability | Evolution Optimization Dashboard | ~15m | ✅ | none |
| 2026-04-05 | capability | Fix Capability Gap Detector False Positives | ~10m | ✅ | none |
| 2026-04-05 | capability | OK Shortcut Command (Aider Pattern) | ~10m | ✅ | lint |

---

## Skill Effectiveness

1. **evolve** — 32 iterations, 95% success
2. **research** — 11 iterations, competitor research
3. **writing-plans** — 5 iterations, planning workflow
4. **using-superpowers** — 4 iterations, skill guidance
5. **systematic-debugging** — 3 iterations, debugging workflow
