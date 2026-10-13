# Matchstick Puzzle Difficulty Expansion Plan

## 1. Goal

Improve the difficulty progression of the matchstick puzzle game while preserving the existing app, seven-segment arithmetic format, and move rules.

This pull request covers research and planning only. No implementation or deployment is included.

## 2. Current-State Findings

- The catalog contains 40 verified puzzles: 14 Easy, 16 Medium, and 10 Hard.
- Easy and Medium puzzles currently allow one move; Hard puzzles allow two.
- Difficulty is assigned manually, without a documented scoring rubric.
- The number of moves alone does not reliably represent puzzle difficulty.
- Puzzle progression and pack ordering may not always provide a smooth increase in challenge.

**Main finding:** Difficulty should reflect how challenging a puzzle is to solve, not only how many moves it requires.

## 3. Proposed Three-Level Difficulty Model

**Easy**
- An obvious or relatively direct solution.
- Few plausible moves to consider.
- Usually requires a local change to one digit or operator.

**Medium**
- The solution is less obvious and requires comparing alternatives.
- The player may need to reconsider a digit or arithmetic operator.
- Several plausible moves may need to be evaluated.

**Hard**
- The player must explore a broader search space or rethink the expression.
- The solution may require coordinated changes across multiple symbols.
- Finding the solution should require more reasoning, not merely an additional move.

Difficulty should be evaluated using legal move options, solution ambiguity, transformation complexity, and search effort. Player completion time, failed attempts, and hint usage can help validate the levels when data is available.

## 4. Proposed Progression and Puzzle Packs

Keep the existing three difficulty levels and current packs:

- **Start:** Introduce the rules and straightforward transformations.
- **Signs:** Develop flexibility in interpreting digits and arithmetic operators.
- **Champion:** Focus on less obvious solutions and strategic reasoning.

First, review and rebalance existing puzzles. Then add new puzzles where there are gaps, especially puzzles that make the Hard level meaningfully more challenging. Pack expansion should follow only after the progression is reviewed.

## 5. Generation and Verification

Generate candidate expressions and enumerate legal stick relocations under the existing rules:

- A stick must move to a different empty slot of the same orientation and length.
- Sticks cannot be rotated or discarded.
- The solution must use exactly the configured number of moves.
- The resulting expression must be a true equality. `≠` is never an accepted solution.
- Every accepted solution must be explicitly recorded and independently verified.

Deduplicate equivalent results and reject invalid or duplicate puzzles. Rank candidates using the difficulty criteria above, followed by manual review.

The verification process should check legal move sequences and enumerate possible outcomes, rather than relying only on predeclared solutions.

## 6. Acceptance Criteria and Tests

Every new puzzle must have:

- A unique ID and valid metadata, including pack, difficulty, and move count.
- A supported seven-segment starting expression that is not already a true equality.
- At least one verified solution reachable through legal moves in exactly the required number of moves.
- Only true equalities as accepted solutions.
- Verified hints and solution reveal behavior.
- A documented reason for its assigned difficulty.
- Tests covering move legality, exact move count, arithmetic correctness, and regression behavior.

Validation should include the existing catalog and all new puzzles, followed by:

- `npm test`
- `npm run build`
- `npm run test:catalog-browser`

Difficulty labels should also be reviewed for consistency across all three levels.

## 7. Implementation Plan

1. Review the existing catalog and classify puzzles using the proposed rubric.
2. Identify gaps and propose new candidate puzzles.
3. Implement generation, verification, and approved catalog changes in a separate follow-up PR.
4. Run all tests and review the resulting difficulty progression.

**Scope and safety:** This PR contains planning documentation only. Implementation requires review and approval. No deployment is authorized by this plan, and secrets must never be committed to GitHub.
