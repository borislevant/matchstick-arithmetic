# Puzzle catalog — 40 verified puzzles

The catalog has 14 easy, 16 medium, and 10 hard puzzles. It is grouped into packs: **Старт** (12), **Знаки** (12), and **Чемпион** (16). All starts are false equalities, and the rendered glyphs encode the title exactly. Every accepted reading is a true equality reachable by exactly the stated number of occupied-to-empty relocations, with the same orientation and length. There are no wildcard solutions.

## Corrections required by the existing move rules

The supplied list has 18 starts plus six additional puzzles. Seven starts have no true reading at the requested move count in the fixed seven-segment layout under the no-rotation rule. They have been replaced by the following single-digit corrections. An exhaustive enumeration of readable digit/operator combinations with exactly the allowed segment removals/additions was used to check the supplied starts. Orientation-compatible pairing is required as well as match conservation.

| Requested start | Shipped start → accepted solution | Reason |
| --- | --- | --- |
| 7-1=1 | 7-1=9 → 7-1=6 | Turning 1 into 6 needs four additional sticks; no alternative one-move equality exists. |
| 8-3=8 | 8-3=6 → 8-2=6 | No true one-move reading exists for the supplied start. |
| 3+4=1 | 3+4=9 → 5+4=9 | The optional unary slot exists, but 3-4=-1 needs rotating the plus vertical into a horizontal minus. No orientation-compatible one-move alternative exists. |
| 11-0=9 | 11-6=9 → 11-8=3 | 0→8 adds a horizontal stick while 9→3 removes a vertical stick, requiring rotation. No legal alternative exists. |
| 5+2=11 | 5+9=11 → 5+6=11 | No true one-move reading exists for the supplied start. |
| 6×7=39 | 6×9=39 → 6×6=36 | Multiplication exists, but neither proposed reading nor another true reading is reachable in two compatible relocations from the supplied start. |
| 8+7=9 | 6+7=9 → 5+4=9 | No true two-move reading exists without rotation. |

Two starts are preserved with corrected accepted readings: **6+1=5 → 5+1=6**, because 6-1=5 discards a stick; **0+3=5 → 0+3=3 or 0+5=5**, because 8-3=5 requires rotation and 6+3=9 increases the match count. The unspecified 6+4=3 solution is **5+4=9**.

Changed starts use new IDs when replacing prior catalog entries so saved progress cannot award a different puzzle. The old extra hard 8+3-4=0 entry is removed: × exists, so the requested fallback is unnecessary. Six extra easy/medium entries occupy the last six rows below.

## Verified paths

Cells are numbered **1-based from left to right**, including operators and equals signs. Digit segments: a=top, b=upper-right, c=lower-right, d=bottom, e=lower-left, f=upper-left, g=middle. Operator segments: h=horizontal, v=vertical. For example, 5:c → 5:e moves the final digit's lower-right stick to its lower-left slot. Each arrow is one legal relocation; semicolons separate consecutive moves. Multiple lines show separate accepted solutions.

| ID | Start | Difficulty / moves | Accepted reading and exact path |
| --- | --- | --- | --- |
| spark-01 | 1+1=3 | easy / 1 | 1+1=2: 5:c → 5:e |
| spark-02-v2 | 7-1=9 | easy / 1 | 7-1=6: 5:b → 5:e |
| spark-03 | 4+5=6 | easy / 1 | 4+5=9: 5:e → 5:b |
| spark-04 | 3+3=8 | easy / 1 | 5+3=8: 1:b → 1:f |
| spark-05 | 8-3=3 | easy / 1 | 8-3=5: 5:b → 5:f<br>8-5=3: 3:b → 3:f |
| spark-06 | 6-1=6 | easy / 1 | 5+1=6: 1:e → 2:v |
| spark-07 | 7+7=0 | easy / 1 | 7+1=8: 3:a → 5:g<br>1+7=8: 1:a → 5:g |
| spark-08 | 6+1=5 | easy / 1 | 5+1=6: 1:e → 5:e |
| spark-09 | 5+1=4 | easy / 1 | 3+1=4: 1:f → 1:b |
| ember-02 | 0+3=5 | easy / 1 | 0+3=3: 5:f → 5:b<br>0+5=5: 3:b → 3:f |
| ember-01 | 9+3=6 | easy / 1 | 5+3=8: 1:b → 5:b |
| spark-10 | 8-3=6 | easy / 1 | 8-2=6: 3:c → 3:e |
| ember-03-v2 | 3+4=9 | medium / 1 | 5+4=9: 1:b → 1:f |
| ember-04-v2 | 11-6=9 | medium / 1 | 11-8=3: 6:f → 4:b |
| ember-05 | 5+9=11 | medium / 1 | 5+6=11: 3:b → 3:e |
| ember-07 | 6+4=3 | medium / 1 | 5+4=9: 1:e → 5:f |
| flame-01-v2 | 6×9=39 | hard / 2 | 6×6=36: 3:b → 3:e; 6:b → 6:e |
| flame-02-v2 | 6+7=9 | hard / 2 | 5+4=9: 1:e → 3:f; 3:a → 3:g |
| spark-11 | 2+3=6 | easy / 1 | 3+3=6: 1:e → 1:c |
| spark-12 | 9-5=9 | easy / 1 | 8-5=3: 5:f → 1:e<br>9-6=3: 5:f → 3:e |
| ember-06 | 9-7=12 | medium / 1 | 5+7=12: 1:b → 2:v |
| ember-08 | 9+5=19 | medium / 1 | 8+5=13: 6:f → 1:e<br>9+6=15: 6:b → 3:e |
| ember-09 | 11-3=9 | medium / 1 | 11-2=9: 4:c → 4:e |
| ember-10 | 8+2=11 | medium / 1 | 8+3=11: 3:e → 3:c |
| champion-01 | 1-1=6 | hard / 2 | 1+1=2: 5:c → 2:v; 5:f → 5:b |
| champion-02 | 1-6=3 | hard / 2 | 1+2=3: 3:c → 2:v; 3:f → 3:b |
| champion-03 | 1+3=5 | hard / 2 | 1+2=3: 3:c → 3:e; 5:f → 5:b |
| champion-04 | 1+7=9 | hard / 2 | 1+3=4: 5:a → 3:d; 5:d → 3:g |
| champion-05 | 4+3=1 | hard / 2 | 1+3=4: 1:f → 5:f; 1:g → 5:g |
| champion-06 | 1+9=7 | hard / 2 | 1+3=4: 3:f → 5:f; 5:a → 5:g |
| champion-07 | 7+1=9 | hard / 2 | 1+4=5: 1:a → 3:g; 5:b → 3:f |
| champion-08 | 4×4=1 | hard / 2 | 1×4=4: 1:f → 5:f; 1:g → 5:g |
| champion-09 | 1-2=9 | medium / 1 | 1+2=3: 5:f → 2:v |
| champion-10 | 1+3=3 | medium / 1 | 1+2=3: 3:c → 3:e |
| champion-11 | 1×3=2 | medium / 1 | 1×2=2: 3:c → 3:e |
| champion-12 | 1-9=4 | medium / 1 | 1+3=4: 3:f → 2:v |
| champion-13 | 1×5=3 | medium / 1 | 1×3=3: 3:f → 3:b |
| champion-14 | 1-4=9 | medium / 1 | 1+4=5: 5:b → 2:v |
| champion-15 | 1-8=7 | medium / 1 | 1+6=7: 3:b → 2:v |
| champion-16 | 1+11=13 | medium / 1 | 1+11=12: 7:c → 7:e |

## Reproduce verification

Run `npm test` for every accepted reading, exact move counts, segment fixtures, pack metadata, and move validation. Build and serve with `npm run build` and `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort`, then run `npm run test:catalog-browser`. The browser script verifies all packs, difficulty filters, title previews, move badges, and solves all 40 puzzles using native Chrome touch events at 390px. Set `TEST_URL` to staging to verify the deployed build. Set `CHROMIUM_PATH` to an installed Chrome if Playwright Chromium is unavailable.
