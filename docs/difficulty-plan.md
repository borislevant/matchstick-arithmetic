# Matchstick Puzzle Difficulty Expansion and Automatic Generation Plan

Updated 2026-10-15 to include multi-digit numbers, expressions with multiple operands, vertical arithmetic, five difficulty levels, and eventual automatic puzzle generation.

## 1. Goal and scope

Create a clear learning progression from Trivial to Very hard. Increase difficulty through both arithmetic structure and matchstick reasoning: larger numbers, more operands, carrying/borrowing, operator combinations, plausible distractions, and coordinated moves.

The end goal is automatic generation of new, verified puzzles for a requested difficulty and supported arithmetic format. Manual selection is useful for the initial learning catalog, but must not remain a requirement for every generated practice puzzle.

Preserve the existing React application, seven-segment arithmetic, Russian/Hebrew interface, and physical move rules. The original planning change was documentation only. The merged implementation and its release corrections are described below; phase completion still requires each completion gate.

## 2. Baseline and implementation audit

The PR baseline has 40 catalog puzzles: 14 Easy, 16 Medium, and 10 Hard. Easy and Medium use one move; Hard uses two. Labels are editorial and do not yet establish a measured progression.

Before implementation, audit the catalog and reconcile any newer generator, larger-number, or column-layout work with this plan. Existing local work is not automatically part of this PR or a shipped capability. Reuse verified capabilities instead of rebuilding them, and mark roadmap items complete only with supporting checks.

Record every puzzle's arithmetic structure, complete solution set within its move budget, minimum solution distance, learning purpose, and provisional level. Identify shortcuts, repetitive transformations, and missing arithmetic families. Preserve stable IDs, pack access, and saved progress; give materially changed challenges new versioned IDs.

## 3. Arithmetic formats to generate

Number width and operand count are separate settings. A puzzle can contain multi-digit numbers, more than two operands, or both.

| Family | Target structure | Progression |
| --- | --- | --- |
| Short horizontal | `a + b = c`, `a - b = c` | Single-digit facts and obvious changes, then less obvious corrections |
| Multi-digit horizontal | Two-, three-, then four-digit numbers | Place value, carrying, borrowing, and changes across digit positions |
| Multiple operands | `a + b - c = d`, later four operands | Several arithmetic steps and more locations to inspect |
| Mixed operations | `a + b × c = d`, later exact division combinations | Precedence and interacting arithmetic relationships |
| Vertical arithmetic | Numbers stacked by place value, with the result below a separator | Two operands first, then three or more addends; carries/borrows across columns |

Both the starting puzzle and its solved state must use the selected horizontal or vertical format. Vertical arithmetic is a playable board, not merely an alternative solution illustration. Equivalent horizontal and vertical boards may share mathematical content, but layout alone does not establish a harder rating.

Start vertical work with addition/subtraction. Introduce multiplication only after its notation and geometry are verified. Long division, fractions, decimals, and parentheses are deferred until their notation, arithmetic rules, solver coverage, and mobile interaction are explicitly designed. Division initially means exact integer division, with no division by zero.

For every template, specify allowed operators, precedence, signs, number widths, operand count, result width, leading-zero policy, and mutable glyph positions. Width controls must say whether they are maximum widths or require an operand of that width. A legal answer must satisfy the template's declared final-number constraints; all arithmetic answers allowed by those rules must be considered during verification.

## 4. Five difficulty levels

These are candidate-selection guidelines, not automatic labels based on size. Larger numbers and more operands are legitimate sources of difficulty. An obvious correction in a long expression can still be Easy; a compact expression can still be Very hard.

| Level | Initial generation targets | Reasoning and learning goal |
| --- | --- | --- |
| **Trivial** | Two single-digit operands; one move; horizontal first | Learn the move rule through an immediately visible correction and familiar arithmetic |
| **Easy** | Mostly single digits; selected two-digit numbers; usually one move | Inspect the expression and find a direct transformation among few plausible alternatives |
| **Medium** | Two-digit numbers or three operands; introductory vertical addition/subtraction; one or two moves | Compare alternatives; use place value, a carry/borrow, or an operator change |
| **Hard** | Two-/three-digit numbers, mixed operations, or several vertical addends; usually two moves | Coordinate changes across symbols and arithmetic steps; reject convincing dead ends |
| **Very hard** | Larger numbers up to four digits, longer mixed expressions, or interacting column carries/borrows; two moves initially | Sustain reasoning across several plausible approaches; introduce three essential moves only after solver validation |

Keep compact challenges at higher levels alongside larger arithmetic challenges. Avoid increasing number width, operand count, operator complexity, and move count all at once in the learning sequence.

For each candidate, record a difficulty feature vector:

- Maximum number width, operand count, operation mix, layout, and arithmetic skills needed.
- Minimum legal move count and number/type of glyphs that must change.
- Distinct valid final equations, recorded separately from different move orders.
- Defined measures of plausible alternatives and dead ends under a versioned search method.
- Whether moves must be coordinated or pass through an unreadable intermediate glyph.

Use these features for provisional ranking, followed by player calibration. Do not treat raw solver runtime, uniqueness, or an extra move as sufficient evidence of human difficulty. Find-any and any future find-all modes require separate difficulty calibration.

## 5. Rules and independent verification

- One move transfers an occupied match to a different empty slot of the same orientation and length. No rotation, creation, or removal of matches.
- A win is a true equality; `≠` is never accepted. Intermediate boards may be unreadable if the current move rules permit them.
- Keep the existing exact-move policy in this expansion. For newly generated puzzles, prove that the minimum number of legal moves to any valid equality equals the configured count, eliminating shorter solutions and meaningless detours.
- Search all answers allowed by the template and rules, including operator changes wherever operators are mutable. Do not discard inconvenient alternative answers just to claim a unique puzzle.
- Replay recorded paths through the gameplay move validator. Compare the solver against a separate exhaustive legal-move reference search on tractable fixtures to detect shared generation/solver assumptions.
- Decorative column lines and alignment marks are immovable and clearly distinguished from matches. Decide explicitly how equality and operator matches behave in vertical layouts.

Return verification status as `complete`, `incomplete`, or `unsupported`, together with the search limits and verifier version. A timeout or partial search cannot establish uniqueness, impossibility, a complete answer count, or minimum distance. Only candidates with complete verification for the required domain can enter the verified catalog or automatic practice pool.

Deduplicate move-order permutations by final equation/board. Deduplicate candidates by canonical starting board and rules; track equivalent layouts and transformation families to avoid repetitive practice. Do not merge expressions across different operator precedence or arithmetic semantics.

## 6. Generation pipeline and architecture

Use one versioned generator/verifier core for offline batch authoring and interactive practice, separate from catalog access/progress and UI presentation.

1. **Request:** choose level, horizontal/vertical format, number widths, operand count, allowed operations, move budget, solution policy, seed, and resource limits.
2. **Construct:** select a supported template and generate a valid target equality satisfying its arithmetic constraints.
3. **Scramble:** apply legal reverse relocations to obtain a readable, false starting equation. A known seed answer establishes a candidate, not its difficulty, minimum distance, or uniqueness.
4. **Verify independently:** enumerate permitted answers, prove minimum distance, and replay legal solution paths. Enforce arithmetic bounds and report completeness explicitly.
5. **Filter and rank:** reject shortcuts, duplicates, inappropriate arithmetic, and candidates outside the requested feature/level profile. Use the easiest available solving route when considering alternative solutions.
6. **Prepare play:** derive reachable hints, solution demonstrations, learning tags, and a short explanation from verified paths. Account for the player's current board and remaining moves.
7. **Deliver:** export a reviewable batch or return a verified practice puzzle. Store reproducibility and provenance metadata with either result.

The versioned schema should include initial occupancy and layout, template/rules versions, move policy/count, accepted final boards/equations and paths, minimum distance, verification status, feature vector, difficulty-model version, learning tags, generator version, seed, and settings. Reproducible links need versions and settings as well as a seed. Keep generated-session state separate from authored catalog progress.

Run interactive searches in a cancellable worker with bounded time, attempts, memory, and board size. Expand supported search sizes only after benchmarks pass on target devices. Larger/more complex puzzles may require offline generation rather than live search.

When a request cannot complete, return a previously verified matching puzzle or explain that the requested configuration is unavailable. Never silently change the requested rules or label a partially checked puzzle verified. No online service is required initially; consider one only if measured generation needs justify it.

## 7. Roadmap and completion gates

Each phase produces reviewable evidence before the next depends on it. The work is capability-based; calendar estimates follow the baseline audit and search benchmarks.

| Phase | Deliverable | Completion gate |
| --- | --- | --- |
| **0 — Audit and specification** | Audit all 40 puzzles and newer local work; define template/schema/rule contracts and five provisional levels | Inventory of reusable work, shortcuts, gaps, and regression fixtures; no unsupported feature marked complete |
| **1 — Verification foundation** | Shared arithmetic/geometry contracts, complete one-/two-move solver, independent reference verifier, versioned export | Known single/multiple-answer cases agree; shortcuts and incomplete searches are detected; paths replay legally |
| **2 — Horizontal generation** | Seeded generation for single-/multi-digit numbers; extend from two operands to three/four operands and mixed operations | Each enabled template has valid generated examples, complete verification, reproducibility, and search benchmarks; unsupported combinations are explicit |
| **3 — Vertical generation** | Playable column addition/subtraction, then multiple addends; assess multiplication separately | Units/tens/hundreds align; carries/borrows evaluate correctly; touch, keyboard, hints, undo, and reveals work in both layouts |
| **4 — Difficulty calibration** | Pilot of five puzzles per level, using existing puzzles where suitable; supervised player sessions | Documented feature definitions, observed difficulty, reclassified outliers, and versioned level profiles; expand toward at least ten reviewed puzzles per level |
| **5 — Automatic practice** | Request a level and supported format; generate, verify, classify, and serve without per-puzzle editorial intervention | Reproducible batches across the supported settings matrix; no unverified delivery; cancellation/fallback and device performance pass; sampled human audits support the levels |
| **6 — Very hard expansion** | Benchmark three-move solving and more demanding mixed/column templates | Independent checks, complete minimum-distance/answer verification within declared limits, and player calibration before enabling each new configuration |

Phase 4 can use offline-generated candidates and begin as each earlier family becomes available; it need not wait for every advanced template. Phase 5 may initially use a bounded set of calibrated one-/two-move templates and cached verified candidates. Automatically serving such candidates is a fallback, not completion of on-demand generation: at least the declared baseline templates must produce fresh verified puzzles within the interactive budget.

Before Phase 5 is accepted, define and publish numeric latency, success-rate, memory, and batch-size targets based on Phase 2/3 device benchmarks. Record results per template, width, operand count, layout, move budget, and solution policy. Unsupported settings stay disabled rather than weakening verification.

## 8. Calibration and learning progression

Introduce one new demand at a time: obvious digit change -> transfer between symbols -> multi-digit place value -> additional operands or an introductory column layout -> coordinated moves -> mixed operations and interacting carries/borrows. Use short bridge sequences when introducing a new notation or arithmetic skill.

Retain Start, Signs, and Champion as learning packs; use the five levels as a separate difficulty dimension. Audit and reclassify individual puzzles rather than mechanically mapping old Easy/Medium/Hard labels onto the new scale. Preserve free access and existing progress semantics.

For the 25-puzzle pilot, record unaided completion, completion time, failed attempts, and hints through consented supervised sessions, without adding analytics SDKs or child accounts. Distinguish beginners from experienced players, use overlapping puzzle sets, and account for practice order. Set scoring thresholds after observing results. The expected trend is lower unaided completion and greater effort at higher levels, with documented exceptions and reclassification.

An editor reviews the initial catalog and explanations. After template verification and level calibration, automatic practice needs no per-puzzle manual approval. Keep periodic sample reviews, generator/model versioning, regression fixtures, and a way to disable a problematic template. Authored catalog publication remains a separate deliberate action.

## 9. Acceptance criteria and validation

Every published or automatically delivered puzzle must have a false, readable starting expression; supported notation and metadata; at least one true equality; complete required verification; no shorter solution than its configured count; replayable legal paths; working hints/reveal; reproducibility; and a difficulty rationale tied to the current model.

Verification must cover:

- Arithmetic: precedence, multi-digit values, multiple operands, carries/borrows, exact division, zero divisors, leading zeros/sign rules, and safe numeric bounds.
- Geometry and moves: orientation/length, match conservation, mutable signs/equality, cross-row transfers, and decorative separators.
- Solver/generator: independent exhaustive small fixtures, all alternative answers, minimum distance, deduplication, seeded reproducibility, search exhaustion, and unsupported requests.
- Product: all five filters/translations, pack/progress compatibility, worker cancellation/failure, generated-session isolation, and hints after non-solution moves.
- Accessibility/layout: Russian/Hebrew, arithmetic direction, real 320px/390px viewports, 44px interaction targets, readable larger boards, touch/keyboard, and deliberate zoom/scroll where needed.
- Difficulty: reviewed examples at all five levels, bridge sequences, pilot evidence, and sampled automatic outputs matching the requested profiles.

For implementation PRs, run `npm test`, `npm run build`, and `npm run test:catalog-browser`, plus the generator, column-layout, and mobile checks appropriate to the implemented features. Benchmark larger searches separately; passing arithmetic tests does not establish human difficulty or acceptable latency.

For this documentation-only PR, review plan consistency and check the diff; application test results are not evidence of newly implemented functionality.

## 10. Scope boundary and unresolved decisions

This plan authorizes no application implementation, catalog publication, merging, or deployment by itself. Follow-up work should start with the audit and verification foundation, reusing newer verified work where available. Preserve current physical rules and exact move policy; a future move-policy change needs an explicit versioned product decision.

Open decisions to resolve in the relevant phase: performance budgets by device; final calibrated level thresholds; initial supported settings matrix; vertical multiplication notation; and whether any larger templates require offline precomputation. Long division and other deferred notation are not prerequisites for automatic generation of supported puzzles.

Existing staging reference: https://staging-matchstick-arithmetic-levant.xhostd.app. This planning update does not change or revalidate that deployment.


## Release implementation status — 2026-10-27

Version 1.0.1 contains five translated filter labels, bounded offline generation for supported horizontal settings, corrected initial occupancy, deterministic seed IDs, and verification against all reachable true equalities. Regression checks include replay through the game and an independent one-move reference. The original 40-puzzle catalog, access, and progress remain in place; its exhaustive alternative-answer audit is still pending and its entries do not claim complete minimum-distance verification.

The function named `generateVertical` currently generates addition content on a horizontal board and declares that layout explicitly. Column geometry/interaction, calibrated new levels, multiple-operand mixed horizontal templates, automatic practice, cancellable workers, and wider templates remain pending. Phases 0–3 are not considered complete solely because their prototype commits are merged. No generated candidate is automatically added to the published catalog.
