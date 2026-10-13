# Matchstick Arithmetic — project instructions and roadmap

## Scope and rules

- Extend the existing React/TypeScript/Vite app; never rewrite it from scratch.
- Arithmetic matchstick puzzles only, with seven-segment digits. No fish, grid, or picture puzzles.
- A win requires a true equality. `≠` is never a valid win.
- A MOVE picks up an occupied slot A and drops onto a different empty slot B. Preserve the match count. A drop with no snap returns to its source without spending a move.
- Snap only between slots of the same orientation and length; do not automatically rotate sticks. Mobile-first SVG drag-and-snap; pointer hit areas must be at least 44 CSS pixels.
- Default UI language: Russian (Session 4). Preserve saved Russian or Hebrew preferences. Keep English keys ready in source without exposing incomplete English copy.
- No Google Sign-In for children. No analytics SDKs.
- Secrets belong only in xhostd channel environment configuration, never in git or client bundles. Session 8 documents placeholder names in `.env.example`; real values must remain channel-scoped.
- The original app remains static. Session 8's Node/Postgres service must use a dynamic staging channel; never change or deploy production without current authorization.
- Work only on the goal authorized for the current session. Record unrelated defects; fix them only if they block that goal.
- Preserve existing user changes. This working tree already contained modified, deleted, and untracked app files before Session 1.

## Deployment policy

- Hosting provider: xhostd MCP.
- Default deployment target: `staging` only.
- Never deploy or promote `prod` unless the current user message contains the exact word `promote` and authorizes that action.
- Session 1 allowed an identical production copy only after staging loaded, but the selected approach is staging-only. This exception does not carry into future sessions.
- Inspect existing applications and channels before creating anything. Reuse existing resources; create missing resources only.
- End every session with files changed, how to test, staging URL, and known issues.

## Ordered roadmap — do not skip ahead

| Step | Goal |
| --- | --- |
| 0 | Inventory + xhostd channels |
| 1 | Deploy current app to staging + prod; prod only with explicit `promote` authorization. First-session identical-copy exception described above. |
| 2 | Harden snap / moves / segment tests |
| 3 | Puzzle catalog data: 24 puzzles |
| 4 | UX: undo, hint, solution |
| 5 | Progress + free/locked packs |
| 6 | Domain, PWA, legal pages |
| 7 | i18n ru/he |
| 8 | Payments API on dynamic channel |
| 9 | Checkout UX + parent PIN |
| 10 | Polish + 40 puzzles |

Some later-step capabilities already exist. Preserve them; their presence is not permission to expand later steps or mark those steps complete.

## Session 1 goal and status (2026-09-28)

Goal: make the current game playable at an xhostd staging HTTPS URL without changing game mechanics.

- Inventory completed; existing production build is available and passes. No package script change is needed.
- `npm run build` produces the static `dist/` directory; `npm run preview` serves that output locally.
- 24 existing engine/catalog tests passed.
- 43 existing browser checks passed against the production preview using installed Google Chrome, including mouse, touch at 320px/390px, keyboard, languages, move limits, hints, solutions, and persistence.
- No game code or mechanics changed for this session.
- xhostd authorization completed. The static app and its `prod` and `staging` channels were created. Staging deployment succeeded and is running; production has no deployed commit. All 43 browser checks also passed against the live HTTPS staging URL, and all four served files match the local production build byte-for-byte.

## xhostd inventory

| Item | Value / verification |
| --- | --- |
| MCP endpoint | `https://mcp.xhostd.com/mcp` — reachable, requires OAuth |
| App | `matchstick-arithmetic` — `fe57dfa1-a06e-4817-b14a-3c1e5c63fcd1` |
| Staging channel | `staging` — `7bbac5e2-4e31-482f-9718-4e06328987b9`; binding `branch:codex/staging` |
| Production channel | `prod` — `e0d2ae1b-1242-4133-9180-45027acc628c`; created automatically, never deployed |
| Template | Original app is static; Session 8 Node source is ready but not deployed because the account has no free channel slots |
| Build command | `npm run build` |
| Static output | `dist/` |
| Staging HTTPS URL | https://staging-matchstick-arithmetic-levant.xhostd.app |
| Production status | Channel created; no deployed SHA |

The local xhostd MCP entry incorrectly used the endpoint URL as a process `command`. Session 1 replaced it with the HTTP `url` configuration and completed the provider's OAuth flow. Authentication is outside the repository; do not copy credentials into this project.

The static template serves the repository root without a remote build. Publish only the contents of local `dist/` at the root of a separate deployment checkout, using the `codex/staging` branch in `https://git.xhostd.com/levant/matchstick-arithmetic.git`. The working app source stays in this project. Do not push the raw Vite source tree as the static site.

Current deployment commit: `6b7800cd0057324b042290670f82c3b5367ff338`. Staging deploy ID: `10adbea2-d44f-4124-b07f-fbfa73409e6b` (Session 10, 2026-10-01, success). Production has no deployed commit. The current channel is static and has no application environment variables or secrets.

Existing SSH repository access was refused; the upload used an MCP-minted short-lived `repo:*` credential with HTTPS. OAuth and git credentials stayed in process memory; none were written into project files or git configuration.

## Current file map

| File | Responsibility |
| --- | --- |
| `src/components/Board.tsx` | SVG board, previews, segment hit testing, drag/snap, pointer capture, tap/keyboard placement, match animation |
| `src/lib/engine.ts` | Seven-segment encodings, glyph layout, integer arithmetic parser, equality validation, legal moves, solution paths |
| `src/data/puzzles.ts` | Puzzle catalog data: 40 puzzles in Старт/Знаки/Чемпион (14 easy, 16 medium, 10 hard), initial segments, accepted solutions, hint coordinates |
| `src/App.tsx` | Pack-grouped catalog UI and difficulty filters, hash navigation, play state, move budget, undo/reset, hints/solution dialogs, progress UI |
| `src/lib/catalog.ts` | Runtime catalog validation and fresh no-store JSON loading before App mounts |
| `scripts/build-site.ts`, `scripts/sw-template.js` | Static Russian/Hebrew pages, catalog JSON and shell-only service worker build |
| `src/lib/product-content.ts`, `public/page-i18n.js` | Russian/Hebrew legal copy and persisted language switching on static pages |
| `public/manifest.webmanifest`, `public/register-sw.js` | Home-screen installation metadata, registration and install help |
| `public/icon*`, `public/apple-touch-icon.png`, `public/og-image.*`, `scripts/render-brand.mjs` | App icons and reproducible sharing artwork |
| `tests/catalog.test.ts`, `tests/pwa.mjs` | Fresh catalog, static page, installability, offline and worker update checks |
| `src/lib/storage.ts` | Local solved/hinted/unlocked state and verified unlock-code persistence, old-save migration and malformed/blocked-storage handling |
| `src/data/access.ts` | Explicit 12 free IDs and shared access predicate |
| `src/lib/i18n.ts` | Russian/Hebrew chrome, future English keys, persisted language, Russian fallback |
| `src/components/Modal.tsx` | Native dialog wrapper, Escape/close behavior, focus restoration |
| `src/components/Icon.tsx` | Inline SVG icons and logo |
| `src/styles.css` | Responsive styling, RTL support, transitions, reduced motion |
| `src/main.tsx`, `index.html` | App bootstrap, HTML metadata, initial Russian/LTR attributes |
| `public/favicon.svg` | Static favicon |
| `package.json`, `package-lock.json` | Dependencies and dev/build/preview/test commands |
| `vite.config.ts`, `tsconfig.json` | Vite React/Tailwind configuration and TypeScript checks |
| `tests/engine.test.ts` | Segment-map, geometry, 40-puzzle catalog, parser, move, hint, and translation checks |
| `tests/browser.mjs`, `tests/i18n-browser.mjs` | Gameplay regressions plus focused Russian/Hebrew persistence, RTL, and mobile layout checks |
| `tests/mobile.mjs` | 62 native touch/cancellation/snap/win/loss assertions at 320px and 390px |
| `tests/storage.test.ts` | 6 free-set/migration/persistence checks (53 total unit tests) |
| `tests/access-browser.mjs`, `tests/access-fixture.mjs` | 132 real gate/progress checks; unlocked fixture for gameplay regressions |
| `tests/controls.mjs` | 69 play-control checks: layout/44px targets, toasts, undo/reset, hints, solution animation and progress |
| `tests/catalog-browser.mjs` | All 40 puzzles solved with native touch, all packs/difficulty filters/previews/move badges |
| `tests/soft-launch-qa.mjs`, `docs/qa-session-10.md` | iPhone-width WebKit, Android-width Chrome, desktop mouse, performance, friendly-error, lock and mocked-code QA |
| `server/app.js`, `server/index.js` | Express static host and Stripe test checkout/webhook/unlock routes; runtime bootstrap and graceful shutdown |
| `server/purchases.js`, `server/unlock-code.js` | Parameterized Postgres purchase operations and HMAC-signed unlock codes |
| `server/migrations/001_purchases.sql`, `server/migrate.js` | Idempotent purchases schema and launch-time migration |
| `install.sh`, `launch.sh`, `.env.example`, `.gitignore` | xhostd Node build/start hooks, placeholder-only staging environment documentation, and secret/generated-file exclusions |
| `tests/server.test.mjs` | Checkout, test-mode, origin, webhook signature/idempotency, and paid unlock API checks |
| `src/lib/parent-pin.ts` | Four-digit parent PIN validation plus salted PBKDF2 hashing and local verification |
| `tests/parent-pin.test.ts`, `tests/parent-flow.mjs` | PIN storage/fail-closed checks and 320px/390px purchase, restore, success, and cancel flows |
| `docs/catalog.md` | Supplied-example corrections and exact paths for all 40 accepted readings |
| `dist/` | Generated static production output; deploy this, not the source tree |
| `artifacts/` | Generated browser-check screenshots |

## What already works

- All 40 catalog entries have true accepted equalities reachable by exactly their stated move counts using the same orientation and length. Every accepted reading is replayed through the real move validator.
- Safe integer equality parsing supports addition, subtraction, multiplication precedence, and unary minus; no `eval`, inequalities, or unknown segment shapes can win.
- Legal moves require occupied source and distinct empty destination. Invalid drops cost no move; the move budget blocks excess moves.
- SVG dragging and return transitions, same-orientation/length snapping, tap placement, and keyboard placement are implemented.
- Difficulty filters, hash puzzle links, undo/reset, two-stage hints, and solution demonstrations work. Demonstrations do not award a solve.
- Progress and language persist locally; malformed or blocked storage does not stop play.
- Hebrew/Russian UI and RTL handling work; equations and the SVG board remain centered LTR. Tested catalog/long-equation layouts fit 320px and 390px viewports.

## Session 2 — harden snap / moves / segment tests

- Source changes: engine geometry/compatibility and snap validation, Board pointer cancellation/capture handling, immediate loss feedback, and translated no-rotation/unavailable-solution copy. Catalog data unchanged.
- Pointer, tap, keyboard, hints, and demonstration moves all enforce compatibility. The nearest slot is resolved before occupancy checks, avoiding unwanted adjacent snaps at small screen sizes.
- No move is spent on same-slot, occupied, incompatible, outside-radius, cancelled, or lost-pointer-capture drops. Cancelling another pointer does not cancel the active drag.
- Victory still requires the existing exact move budget, a valid numeric equality, and an accepted reading or wildcard. Unreadable glyphs are reported after every drop; remaining moves can finish an intermediate construction. Exhausted boards lock until Undo/Reset.
- Local verification passed: build, 39 unit tests, 43 general browser checks, 62 focused native-touch checks. The live HTTPS staging deployment also passed all 62 focused mobile checks, and all four served files matched the tested build byte-for-byte. xhostd reports staging running at the recorded SHA; prod still has no deployed SHA.
- Required playtest verified at 320px and 390px in Russian: `1+1=3` → drag last digit lower-right (`4:2`) to lower-left (`4:4`) → `1+1=2` → one counted move → «Верно!» victory toast/status and saved progress. Screenshots: `artifacts/session2-touch-320.png`, `artifacts/session2-touch-390.png`.
- Deployment target remains the existing static staging channel only. Step 3 was subsequently authorized below.

## Session 3 — data-driven catalog (2026-09-29)

- Exactly 24 reachable arithmetic puzzles: 14 easy, 8 medium, 2 hard. Every title matches its initial glyphs. Every accepted solution is a true equality reachable in exactly the stated move count with compatible segments.
- Seven impossible supplied starts have single-digit corrections; two preserved starts need alternative accepted solutions. `docs/catalog.md` records the reasons and exact paths for all readings. Six additional easy/medium puzzles complete the catalog. Multiplication exists, so no fallback extra hard puzzle is needed.
- Existing catalog filters, previews, and move badges already consume the data and are now verified across all 24 entries. Changed-start IDs prevent stale saved progress from awarding another puzzle.
- Fixed one catalog-blocking engine defect: crossing operator slots share a center, which previously hid an empty compatible vertical destination behind an occupied horizontal slot. Same-center selection now respects orientation without changing the move rules or snap radius.
- Local checks pass: build, 47 unit tests, 42 general browser checks, 62 focused mobile checks, and all 24 catalog puzzles solved with native touch at 390px. The required `1+1=3` → `1+1=2` victory path still passes at 320px/390px.
- Live HTTPS staging also passes all 24 touch solutions and all 62 focused mobile checks. xhostd reports the recorded Session 3 SHA running; production still has no deployed SHA.
- JavaScript and CSS match the tested build byte-for-byte. Favicon/HTML byte verification hit a TLS timeout; retry approval review exceeded its deadline. Browser loading and gameplay verification succeeded.
- No payments, new puzzle types, or later-roadmap features added in Session 3. Step 4 was subsequently authorized below.

## Session 4 — child-friendly play controls (2026-09-29)

- Top: back, starting equation title, difficulty, moves used/allowed. Board follows, then five consistently placed labeled controls: Undo, Reset, Hint, Check, Solution. Next/retry actions are separate and do not replace the five controls.
- Russian is the default for new visits and unavailable/invalid language storage. Valid saved Hebrew/English preferences remain respected. Russian result toasts are exactly «Верно!», «Ещё не сходится», and «Ходы закончились»; unreadable glyph details remain visible below the status.
- Existing completed-move history restores both board occupancy and match identities one move at a time. Reset restores the initial board, clears undo/hints, and cancels demonstration timers.
- First hint highlights the source; second tap highlights the destination. Hints cost no moves. Solution confirmation animates an accepted layout and marks hinted immediately; Check remains disabled after a reveal so it cannot award an independent solve.
- All five controls fit a 320×844 viewport. Play actions, back, header controls, and numbered scrollable puzzle navigation meet 44px targets. Screenshot review completed for the narrow Russian play screen.
- Local validation passed: production build, 47 unit tests, 69 controls checks, 42 general browser checks, 62 focused mobile checks, and all 24 catalog puzzles solved with native touch. Puzzles and engine/Board move mechanics are unchanged.
- Files changed: `src/App.tsx`, `src/styles.css`, `src/lib/i18n.ts`, `index.html`, `package.json`, `tests/browser.mjs`, `tests/mobile.mjs`, new `tests/controls.mjs`, `README.md`, `AGENT.md`; generated build and screenshots refreshed.
- Static staging deployment succeeded. All 69 controls checks and 62 focused mobile checks also pass against the live HTTPS site at 320px/390px. xhostd confirms the Session 4 SHA is running and production has no deployed commit.
- Only static staging may be deployed. No payments or later-roadmap features were added. Step 5 was subsequently authorized below.

## Session 5 — progress and local content gate (2026-09-29)

- `matchstick-arithmetic-v1` stores `{ solvedIds, hintedIds, unlocked }`. Legacy saves preserve valid marks and default locked. Only boolean `true` grants full access. Malformed/blocked storage remains safe.
- Free IDs are explicitly documented in `src/data/access.ts`: `spark-01`, `spark-02-v2`, `spark-03`, `spark-04`, `spark-05`, `spark-06`, `spark-07`, `spark-08`, `spark-09`, `ember-02`, `ember-01`, `spark-10` (first 12 easy/medium entries, currently all easy).
- All 24 catalog cards remain visible, with lock icons for the remaining 12. A parent-level gate covers cards, direct hashes, Next, and numbered navigation; locked pages render only a preview and unlock prompt.
- «Разблокировать» requires the exact Russian temporary-free confirmation before setting `unlocked: true`. No network purchase, backend, or payment SDK is involved. Cancellation preserves the lock.
- Catalog reports «Решено X / 24» and checkmarks. Confirmed progress reset clears solved/hinted marks and preserves the unlock flag, as stated in the dialog. New saves and cross-tab access changes update the UI.
- Local validation: build, 53 unit tests, 98 access/progress checks, 42 general browser checks, 69 controls checks, 62 mobile checks, all 24 native-touch solutions. Gate and catalog screenshots reviewed at phone widths.
- Files changed: App, storage, translations, styles, new access data, package test script, new storage/access tests and gameplay access fixture, four updated browser suites, README and AGENT; build/screenshots refreshed. Puzzle data and engine/Board mechanics unchanged.
- Static staging deployment succeeded at the recorded Session 5 SHA. All 98 access/progress checks also pass against live HTTPS staging at 320px/390px. xhostd reports staging running and production without a deployed commit.
- Keep static hosting, staging only. Step 6 was subsequently authorized below.

## Session 6 — product pages and PWA (2026-09-30)

- Added Russian static `/parents`, `/privacy`, `/rules` pages and footer links. Pages work without JavaScript. Parents copy covers ages 6–12, no ads/accounts, and a later one-time purchase. Privacy copy describes browser-local progress and ordinary hosting requests. Rules contain five bullets.
- Manifest: «Спички: уравнения», standalone, dark wood colors, 192px/512px PNGs and Apple touch icon. Added installation instructions and browser-offered Install button, PNG favicon fallback, and simple 1200×630 Russian OG artwork.
- Existing puzzle definitions remain unchanged in `src/data/puzzles.ts`. Build exports `/puzzles.json`; runtime loads it with no-store before mounting App. Only the shell/pages/assets are cached; the worker never caches puzzle JSON. Offline reload displays a retry screen, preserving local progress.
- Build emits static page directories and a versioned worker. Preview redirects bare info paths to their directories, matching static hosting. Use build+preview for PWA/pages; normal Vite dev supplies puzzle JSON only.
- README documents `add_custom_domain` and `verify_custom_domain` with placeholders and returned DNS instructions. No hostname supplied, no domain attached. Production remains unauthorized.
- Local checks include 56 unit tests, 52 PWA/offline/freshness/installation checks, 62 mobile checks, 98 gate checks, 42 general browser checks, and all 24 touch solutions. Physical-device installation remains outstanding.
- Static staging deployment succeeded at the recorded Session 6 SHA. Live HTTPS verification passed 49 PWA/page checks and 62 mobile checks; three additional cache-freshness/upgrade fixture checks passed locally. xhostd confirms staging running and production still without a deployed commit. No domain attached.
- No accounts, trackers, payments, new puzzles, or mechanics changes. Step 7 needs future authorization.

## Session 7 — Russian and Hebrew UI (2026-09-30)

- Russian remains the default. The visible selector offers Russian and Hebrew, persists under `matchstick-language`, and is shared by the app and all three product pages. English translation keys remain available in source for future work.
- Catalog chrome, controls, status messages, product footer, loading/offline states, and `/parents`, `/privacy`, `/rules` are translated. The rules page has exactly five bullets in both languages.
- Hebrew sets the document to RTL. Equation previews and the SVG board explicitly remain LTR and centered, including 320px and 390px phone layouts.
- Product pages keep Russian content as a no-JavaScript fallback and switch to persisted Hebrew when scripts run. No puzzle data, move logic, progress schema, payments, or hosting template changed.
- Local validation passed: production build, 56 unit tests, 38 general browser checks, 32 focused language checks, and 52 PWA/page/offline checks using installed Chrome.
- Static staging deployment succeeded at commit `3cdd354a3e77abf4f1ffe3f310dccc7498812bb9`. Live HTTPS passed all 38 general checks, all 32 language checks, and 49 PWA/page checks. Production still has no deployed commit.

## Session 8 — Stripe test unlock backend (2026-09-30)

- Added an Express/Node service that serves the existing client and exposes checkout, verified webhook, and paid unlock-code routes. Stripe is server-only, checkout is fixed to SKU `full_version`, and both live secret keys and live webhook events are rejected.
- Added an idempotent Postgres `purchases` migration with the required fields. The webhook uses its raw body for signature verification, uses parameterized database operations, and never receives or logs raw card data.
- Replaced the browser-only test unlock with hosted test checkout. The return code is verified by the backend before `unlocked: true` and `unlockCode` are persisted. Existing saves migrate without losing solved/hinted progress.
- Updated Russian, Hebrew, and future English chrome plus privacy/parent copy. The service worker explicitly bypasses `/api/`. No puzzle data, game mechanics, parent PIN, production code, or live Stripe keys were changed.
- Local validation passes: production build, 61 unit/API tests, 4 focused server tests, 38 browser checks, 52 PWA checks, and 98 access checks. The API tests cover signed test webhooks, idempotency, origin rejection, invalid codes/signatures, and unconfigured placeholders.
- xhostd inspection found the existing app's static template is immutable and account-wide. A companion Node app requires two additional channels because xhostd auto-creates an undeployed `prod` channel before `staging`; the Basic account currently uses 3/3 slots (`dobble-live/prod`, `matchstick-arithmetic/prod`, `matchstick-arithmetic/staging`). No staging deployment or environment mutation was attempted. Production remains untouched and undeployed for this app.

## Session 9 — parent-only purchase flow (2026-10-01)

- Added a parent settings entry and a first-use four-digit PIN gate. Only a salted PBKDF2-SHA-256 hash is stored under `matchstick-parent-pin-v1`; invalid, corrupt, or blocked storage fails closed.
- Locked content now opens PIN setup/verification before showing **Купить один раз** or **У меня есть код**. Free child play screens have no checkout action, and wrong PINs never call checkout.
- Restore validates the entered code through `GET /api/unlock/:code` before persisting access. Checkout returns to `/success?unlock=CODE`; `/cancel` is a dedicated Russian-first cancellation page. Copy says «Полная версия» is a one-time purchase with no subscription.
- Russian, Hebrew, parent/privacy copy, mobile styles, API URL tests, and access regressions were updated. Puzzle data and game mechanics remain unchanged.
- Local validation passes: build, 64 unit/API tests, 16 parent-flow checks, 98 access checks, 38 general browser checks, 32 language checks, 52 PWA checks, 62 native-touch checks, 69 controls checks, and all 24 catalog solutions. Screenshots were reviewed at 320px/390px.
- Dynamic xhostd staging remains blocked by the Basic account's 3/3 channel limit. The generated parent-gated frontend was deployed to the existing static staging channel at `5fd7407d31bf94b0d44da9e1802fa809db569047`; checkout and code restore there fail closed because `/api` is unavailable. Live HTTPS passes 18 parent-flow checks (mocked success plus real unavailable states) and all 38 gameplay checks. Production remains untouched.

## Session 10 — soft-launch quality (2026-10-01)

- Expanded the catalog to 40 unique false starting equations: 14 easy, 16 medium, and 10 hard. Every accepted equality is reachable through exactly its stated one or two orientation-compatible relocations. `docs/catalog.md` records all exact paths.
- Added pack metadata and grouped the catalog into **Старт** (12), **Знаки** (12), and **Чемпион** (16). The original 12 free IDs and their order remain unchanged; the other 28 cards remain visible and locked until verified access.
- Added Russian empty-catalog copy and verified catalog-load/payment failures are friendly Russian text with no stack traces. Existing Hebrew chrome remains complete; equation previews and the play board stay LTR.
- Local production checks pass: build, 81 unit/API checks, 40 general browser checks, 132 access checks, 32 language checks, 52 PWA checks, 62 mobile checks, 69 controls checks, 16 parent-flow checks, and all 40 puzzles touch-solved at 390px.
- Actual soft-launch QA passed in iPhone 13-width WebKit, Pixel 5-width installed Chrome, and desktop installed Chrome with mouse. Tested free solve, lock, hint, reset, Hebrew, mocked unlock-code restore, Russian payment failure, and catalog error. First board ready times were 170ms, 138ms, and 88ms locally. See `docs/qa-session-10.md`.
- Static staging deployment succeeded at `6b7800cd0057324b042290670f82c3b5367ff338` (deploy `10adbea2-d44f-4124-b07f-fbfa73409e6b`). Live HTTPS passes all 40 general checks and touch-solves all 40 puzzles. The three live first-board timings were 1003ms, 1140ms, and 1970ms. Production remains untouched with no deployed SHA.

## Known issues and unfinished work

- Shell-only offline support intentionally requires a connection to load puzzles after refresh. Home-screen installation on physical iOS/Android devices remains unverified. No custom hostname is attached.

- Session 8's Node deployment is blocked on xhostd channel capacity. Live staging runs the Session 9 parent-gated frontend on the static template; the tested Node/Postgres API source has not been published.

- Stripe test credentials and signing values have not been supplied. Placeholders are committed only as names/documentation and fail closed; real values must be added to the future Node staging channel environment.

- The parent PIN is intentionally device-local and is not account authentication. Clearing browser data removes it. The dynamic API is still required for real checkout and restore behavior.

- The real unlock API and hosted Checkout client are implemented locally, but the current static staging channel cannot run them. A custom domain and production payments are not configured.
- iPhone-width WebKit and Android-width Chrome emulation pass; physical-device installation and physical Safari/Chrome remain outstanding.
- Playwright's matching bundled Chromium is absent on this machine; the current checks passed using `CHROMIUM_PATH` pointed at installed Chrome.
- The repository now ignores local environment files, dependencies, generated output, and screenshots. `.env.example` is the only environment file allowed in git and contains placeholders only.
