# Matchstick Arithmetic / גפרורים / Спички

A mobile-first React + TypeScript + Vite game with an Express/Postgres unlock service for the dynamic staging deployment. It lives alongside the existing Dobble project; run commands from this directory. The game has no child accounts, analytics, external fonts, or image service.

## Run

Requires Node.js 22.13+.

```sh
npm install
npm run dev
```

Open http://localhost:5174. Use `npm run build` for the production bundle in `dist/`, `npm run preview` to preview the client, and `npm test` for the client, catalog, rules, and API tests. `npm run test:server` runs only the unlock API suite. The full Node service also needs `DATABASE_URL` and the values documented under Session 8.

## xhostd deployment inventory

The currently live app still uses a **static** template. Session 8 source is ready for a separate Node-template staging deployment. Keep secrets only in xhostd channel environment configuration; never put them in git or the Vite client bundle.

Application: `matchstick-arithmetic` (static). Channels: `staging` and `prod`.

**Staging:** https://staging-matchstick-arithmetic-levant.xhostd.app

Latest staging deployment succeeded on 2026-10-01 (Session 10 commit `6b7800cd0057324b042290670f82c3b5367ff338`, deployment `10adbea2-d44f-4124-b07f-fbfa73409e6b`). Only staging is deployed. Production was auto-created with the app and has no deployed commit. Staging uses the `codex/staging` branch. Because xhostd channel capacity still prevents the Node companion app, this deployment contains the parent-gated frontend and fail-closed payment copy on the existing static channel. Resource IDs and the roadmap are recorded in `AGENT.md`.

The xhostd MCP endpoint is `https://mcp.xhostd.com/mcp`. Its local connection was repaired from an executable entry to an HTTP URL entry, and OAuth sign-in completed. No authorization tokens belong in this repository.

Historical static staging deployment procedure (Sessions 1–7 only; do not use it for the Session 8 Node source):

1. Inspect the xhostd MCP tool schemas and existing applications/channels. Reuse `matchstick-arithmetic` if present; otherwise create it.
2. Create only missing `staging` and `prod` channels with the static template. Channel creation does not authorize a production deployment.
3. Run `npm ci`, `npm run build`, and `npm test`. The production artifact is the contents of `dist/`. xhostd static hosting performs no build and serves the deployment repository root, so copy the **contents** of `dist/` into a separate deployment checkout, with `index.html` at its root. Do not publish the raw source tree or nest the output under `dist/`. No Vite server is required on the static host.
4. Push that artifact checkout to `codex/staging` in `https://git.xhostd.com/levant/matchstick-arithmetic.git`, then call xhostd MCP `deploy(app_name="matchstick-arithmetic", channel="staging", ref="codex/staging")`. Use `get_deploy_log` with the returned ID until its status header reports success. Pushing alone does not deploy. Prefer registered SSH access; if SSH is unavailable, use `get_credentials(scopes=["repo:*"], expires_in=3600)` and an in-memory Git authorization header. Never embed a token in the remote URL or a committed file.
5. Open the staging URL on a phone. Switch to Русский, open the first puzzle (`1+1=3`), and move the last digit's lower-right match to its lower-left slot to make `1+1=2`. Confirm a win, undo/reset, and verify an off-board drop spends no move. Refresh and confirm progress persists.

Do not deploy/promote production unless the current user request explicitly authorizes it with the exact word `promote`. The optional identical-copy allowance for Session 1 is not standing permission for later sessions. Follow the ordered roadmap in `AGENT.md`; do not add features during deployment work.

## Session 10 — soft-launch catalog and QA

The catalog now contains **40 fully verified puzzles** grouped into three visible packs: **Старт** (12), **Знаки** (12), and **Чемпион** (16). Difficulty totals are 14 easy, 16 medium, and 10 hard. The original first 12 free IDs remain unchanged; 28 cards are visible with locks until verified access. Every accepted equality is exercised through the real no-rotation move validator with exactly its stated move budget. Exact paths are in `docs/catalog.md`.

Russian empty, load-error, and payment-failure states use plain product copy and never render exception details. `tests/soft-launch-qa.mjs` covers the required release paths and measures time to the first interactive board. The performed QA notes and screenshots are listed in `docs/qa-session-10.md`.

Run the release checks against a built preview:

```sh
npm run build
npm test
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
# In another terminal:
CHROMIUM_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  TEST_URL=http://127.0.0.1:4173 npm run test:soft-launch
CHROMIUM_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  TEST_URL=http://127.0.0.1:4173 npm run test:catalog-browser
```

Local production validation passes 81 unit/API checks, 40 general browser checks, 132 access checks, 32 language checks, 52 PWA checks, 62 mobile checks, 69 controls checks, 16 parent-flow checks, and all 40 puzzles touch-solved at 390px. First-board timings were 170ms in iPhone 13-width WebKit, 138ms in Pixel 5-width Chrome, and 88ms in desktop Chrome with a mouse. The deployed HTTPS staging artifact also passes all 40 general checks and touch-solves all 40 puzzles; live first-board timings were 1003ms, 1140ms, and 1970ms respectively.

## Session 8 — Stripe test unlock backend

The production build now runs behind an Express service. `launch.sh` applies the idempotent Postgres migration before starting the server on `XHOST_HTTP_PORT`. The `purchases` table contains `id`, `created_at`, nullable `email`, nullable unique `unlock_code`, unique `provider_ref`, and constrained `status` (`pending`, `paid`, `failed`, or `refunded`). No card fields are accepted, stored, or logged.

The API provides:

- `POST /api/checkout/session` — creates one Stripe Checkout payment for the fixed SKU `full_version` and returns its hosted Checkout URL. The default staging price is a documented test-only 1.00 ILS and can be changed with non-secret channel settings.
- `POST /api/stripe/webhook` — verifies the raw request with the channel's webhook secret, rejects live-mode events, and idempotently records paid or failed Checkout sessions. A paid purchase activates its pre-signed unlock code.
- `GET /api/unlock/:code` — verifies the HMAC signature and paid database row, then returns `{ "ok": true, "product": "full_version" }`.

The client follows Stripe's return URL `/?unlock=CODE`, waits briefly for webhook delivery, verifies the code with the API, and stores `{ unlocked: true, unlockCode: CODE }` under `matchstick-arithmetic-v1`. A code never grants access until the server confirms the corresponding purchase is paid. The shell worker bypasses every `/api/` request.

### xhostd Node staging setup

The existing xhostd application template is immutable and shared by all of its channels, so its static `prod` and dynamic `staging` cannot live in the same application. Preserve the original static app and create a companion Node-template app once the account has two free channel slots; xhostd creates the companion's undeployed `prod` channel automatically, then its `staging` channel can be added. Deploy only the companion staging channel. The current Basic account reports 3 of 3 channel slots used, so this deployment is waiting for capacity or explicit authorization to replace the original app. Do not delete or redeploy either production channel as a workaround.

Configure these values on the **Node staging channel only**, using `.env.example` as names-only documentation:

```text
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_BASE_URL=https://<node-staging-hostname>
UNLOCK_SIGNING_SECRET=<at-least-32-random-characters>
```

Optional non-secret values are `FULL_VERSION_PRICE_MINOR=100` and `FULL_VERSION_CURRENCY=ils`. Placeholders keep the service fail-closed: the catalog loads, health reports Stripe as unconfigured, and checkout returns 503. The server rejects `sk_live_` keys and live-mode webhook events. xhostd supplies `DATABASE_URL`; migrations run at service launch because that value is available only at runtime.

In the Stripe Dashboard, stay in test mode and register `https://<node-staging-hostname>/api/stripe/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `checkout.session.async_payment_failed`. Copy that endpoint's test signing secret to the staging channel, redeploy staging so its environment is refreshed, then test from a fresh browser profile:

1. Open a locked puzzle and choose the unlock button.
2. Complete hosted Checkout with Stripe's test card `4242 4242 4242 4242`, any future expiry date, and any valid CVC.
3. Confirm the browser returns with `?unlock=...`, shows the translated success state, removes the query string, and opens the full catalog.
4. Reload and confirm the saved code restores access. Clear site data and revisit the old return URL to confirm the API restores access only while its paid row exists.
5. Send an invalid code or webhook signature and confirm the API denies it; verify the browser bundle contains no `sk_`, `whsec_`, or signing secret.

Local API verification needs no Stripe account or Postgres because it uses in-memory test doubles and a real signed webhook payload:

```sh
npm run test:server
npm test
```

`npm test` currently passes 64 tests, including checkout shape, origin validation, test-mode enforcement, signature verification, idempotent webhook processing, paid-code verification, PIN hashing, and storage migration. Production remains undeployed.

## Session 9 — parent-only purchase flow

Purchase and restore actions are protected by a four-digit parent PIN on each device. The first parent action asks an adult to create the PIN; later actions require it. The browser stores only a random salt and a PBKDF2-SHA-256 hash under `matchstick-parent-pin-v1`, never the four plaintext digits. This is a local parental speed bump rather than an account credential, so clearing site data also clears the PIN.

A locked puzzle's **Разблокировать** button opens the PIN gate. Only a successful PIN check reveals the two parent actions:

- **Купить один раз** opens test-mode Stripe Checkout for «Полная версия». The interface states that this is a one-time purchase with no subscription.
- **У меня есть код** sends the entered code to `GET /api/unlock/:code`. Only `{ "ok": true, "product": "full_version" }` persists access and the code.

Free child play screens contain no checkout control. Parent settings in the header and catalog footer use the same PIN gate and let the parent change the device PIN or restore a code. Stripe returns to `/success?unlock=CODE`; `/cancel` explains in Russian that access was unchanged. Both routes are emitted as static entry points and also work through the Node fallback. Russian is the default and Hebrew copy remains complete.

Run the focused flow against a production preview with the API mocked in-browser:

```sh
npm run build
npm test
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
CHROMIUM_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  TEST_URL=http://127.0.0.1:4173 npm run test:parent
```

The focused suite checks 320px and 390px touch layouts, first-use PIN setup, plaintext exclusion, wrong-PIN rejection, child-screen isolation, one-time/no-subscription copy, invalid and valid code restore, test checkout, verified success persistence, and Russian cancel copy. Local validation passes 64 unit/API tests, 16 parent-flow checks, 98 access checks, 38 general browser checks, 32 language checks, 52 PWA checks, 62 native-touch checks, 69 controls checks, and all 24 catalog solutions. The deployed HTTPS staging site passes 18 parent-flow checks, including mocked success paths and the real static channel's fail-closed Russian checkout/restore messages, plus all 38 general gameplay checks. The visual-viewport offset is included in native-touch test coordinates so installed Chrome's mobile toolbar does not skew SVG taps.

Local production verification:

```sh
npm run build
npm test
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
# In a second terminal:
TEST_URL=http://127.0.0.1:4173 npm run test:browser
```

If bundled Playwright Chromium is unavailable, install it with `npx playwright install chromium`, or use an installed Chrome on macOS:

```sh
CHROMIUM_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' TEST_URL=http://127.0.0.1:4173 npm run test:browser
```

Session 1 validation: production build, 24 rules/catalog tests, and 43 browser checks passed against the local built app. Browser checks cover 320px/390px touch layouts. All 43 browser checks also passed against the live staging HTTPS URL, and all four served files match the tested build byte-for-byte. Physical-phone and Safari verification remain manual follow-ups. At Session 1 the game defaulted to Hebrew; Session 4 changed the default to Russian. No game mechanics were changed.

## Session 6 — product pages and PWA

Russian pages have real static URLs and work without JavaScript:

- `/parents` — ages 6–12, arithmetic play, no ads/accounts, planned one-time purchase (no payments now).
- `/privacy` — no app tracking or child accounts; progress/settings stay in the browser. Explains ordinary hosting connection data, storage removal, and future payment notice.
- `/rules` — exactly five rules, including match conservation and no `≠` victory.

The site footer links to these pages and provides Android/iOS home-screen instructions. When Chrome offers installation, it also exposes an Install button. The manifest is named **Спички: уравнения**, uses standalone display and the dark wood theme, with 192px/512px icons and an Apple touch icon. `public/og-image.png` is a 1200×630 Russian text image linked in the HTML Open Graph metadata. Existing matchstick favicon artwork is reused with a PNG fallback.

### Build, content freshness, and offline behavior

`npm run build` now runs Vite and `scripts/build-site.ts`, producing page directories, `puzzles.json`, and a versioned service worker. The authored catalog stays in `src/data/puzzles.ts`; its 24 entries and rules are unchanged. At startup `src/lib/catalog.ts` fetches `/puzzles.json` with `cache: no-store` before mounting the game. The service worker also uses network-only, no-store fetching for that URL. There is no bundled/offline puzzle fallback.

Only the shell (HTML, JS, CSS, icons and product pages) is cached. An offline refresh shows a Russian connection/retry message; saved progress is not cleared. Existing in-memory play can continue until a reload. A shell update removes older caches owned by this app without clearing progress or unrelated caches. Page navigations use the network first. Tests change a real HTTP catalog response with a one-year cache header and confirm that refresh displays the new data.

Use production preview to check the pages/PWA; the development server supplies fresh puzzle JSON but does not generate the information pages or service worker:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
# In another terminal (set CHROMIUM_PATH to installed Chrome if needed):
TEST_URL=http://127.0.0.1:4173 npm run test:pwa
```

Local Session 6 validation passed: build, 56 unit tests, 52 PWA/page checks, 62 mobile checks, 98 access checks, 42 general browser checks, and all 24 touch solutions. Live HTTPS staging also passed 49 PWA/page checks and 62 mobile checks; the three fixture-only freshness/cache-upgrade checks were run locally. The PWA test checks 320px/390px pages, offline shell, uncached JSON, cache replacement, and installability in a regular temporary Chrome profile. Phone home-screen installation and Safari still need a physical-device check. To regenerate branding PNGs from the committed SVG sources, run `node scripts/render-brand.mjs` with `CHROMIUM_PATH` if required. Normal builds use the committed PNGs and need no browser.

### Custom domain — instructions only

**No hostname has been provided, so no domain is attached.** Do not substitute an invented hostname. Default to staging. Attaching to production additionally requires the user to supply the hostname and explicitly authorize `promote`, after staging verification.

1. Inspect `get_app(app_name="matchstick-arithmetic")` and the latest xhostd MCP schemas. Confirm the exact user-provided hostname and authorized channel.
2. Call `add_custom_domain(app_name="matchstick-arithmetic", channel="staging", domain="<user-provided-hostname>")`. Use `prod` only under the explicit authorization above.
3. Relay the exact DNS instructions returned by xhostd. Have the domain owner create those records at the registrar; never invent IP addresses, record values, or verification tokens.
4. Once DNS is configured, call `verify_custom_domain(app_name="matchstick-arithmetic", channel="staging", domain="<same-hostname>")` (or the authorized production channel). Resolve the returned DNS findings. HTTPS is provided by xhostd after verification.
5. Verify HTTPS, the three direct page URLs, manifest/icons, and `/puzzles.json` freshness on that hostname. For a build intended for that hostname, set the non-secret `PUBLIC_SITE_URL=https://<hostname>` when building so Open Graph image URLs use it. It defaults to the staging origin.
6. A different hostname is a different browser origin: local progress/unlock settings are not transferred automatically. Production deployment remains a separate explicitly authorized action.

Provider references: [xhostd API/domain operations](https://docs.xhostd.com/api), [static hosting recipe](https://docs.xhostd.com/guides/recipes-static). PWA reference: [MDN installation requirements](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

## Session 7 — Russian and Hebrew UI

The visible language selector offers Russian and Hebrew. Russian remains the default, and the choice persists under `matchstick-language` in `localStorage`. English translation keys remain in `src/lib/i18n.ts` for future work, but English is not exposed as an incomplete product language.

The catalog, controls, status messages, loading/offline state, product footer, and `/parents`, `/privacy`, and `/rules` pages are translated. Hebrew sets the document to RTL. Equation previews and the interactive SVG board keep `direction: ltr` and remain centered so their Western digits and operators do not reorder. Each legal page works in Russian without JavaScript and switches to Hebrew when JavaScript is available.

Run the focused language checks against a production preview:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
# In another terminal (set CHROMIUM_PATH to installed Chrome if needed):
TEST_URL=http://127.0.0.1:4173 npm run test:i18n
```

The focused suite checks 320px and 390px layouts, saved language across product pages and the app, Hebrew RTL, and a centered LTR game board. The general browser suite also plays the required `1+1=3` → `1+1=2` victory path in Russian and Hebrew.

Session 7 validation passed locally: production build, 56 unit tests, 38 general browser checks, 32 focused language checks, and 52 PWA/page/offline checks. The deployed staging HTTPS site passed all 38 general checks, all 32 language checks, and 49 live PWA/page checks. Production remains undeployed.

## Session 5 — saved progress and temporary content access (historical)

This section records the earlier browser-only gate. Session 8 replaces its confirmation unlock action with server-verified Stripe test Checkout while preserving the free list and progress behavior.

Progress stays under `matchstick-arithmetic-v1` with the shape `{ solvedIds: string[], hintedIds: string[], unlocked: boolean }`. Existing saves keep valid solved/hinted IDs and migrate to `unlocked: false`. Only a literal boolean `true` restores full access; invalid or unavailable storage safely starts locked. If saving is blocked, changes remain available for the current session and the existing storage warning is shown.

The free set is the first 12 easy/medium entries, explicitly listed in `src/data/access.ts`:

`spark-01`, `spark-02-v2`, `spark-03`, `spark-04`, `spark-05`, `spark-06`, `spark-07`, `spark-08`, `spark-09`, `ember-02`, `ember-01`, `spark-10`.

All 24 cards remain visible. The other 12 show a lock. Opening one through a card, direct URL, Next, or numbered navigation shows «Доступно в полной версии» instead of an interactive board. «Разблокировать» opens the confirmation «Временно бесплатно на этапе теста. Позже здесь будет оплата.» Cancelling changes nothing; confirming sets `unlocked: true` and opens the selected puzzle. No payment service is called.

The catalog shows «Решено X / 24» and solved checkmarks. Footer «Сбросить прогресс» requires confirmation, clears solved/hinted marks, and **preserves unlocked access**; the dialog states this. Local access changes in another tab are reflected by the gate. This is a local testing flag, not a secure purchase entitlement; clearing browser data removes it.

How to test on a fresh browser profile:

1. Open any of the first 12 cards and play normally. Check that later cards show locks.
2. Open card 13, tap «Разблокировать», cancel, and verify it remains locked.
3. Repeat and confirm. The puzzle opens; reload and verify access stays unlocked.
4. Solve a puzzle or use a hint, return to the catalog, and check saved marks/counts.
5. Cancel and then confirm «Сбросить прогресс». Marks clear while access remains open.

Automated checks (serve a production build first; set `CHROMIUM_PATH` if needed):

```sh
npm test
TEST_URL=http://127.0.0.1:4173 npm run test:access
```

Local validation: build, 53 unit tests, 98 access/progress checks at 320px/390px, 42 general browser checks, 69 control checks, 62 mobile checks, and all 24 touch solutions passed. All 98 access/progress checks also pass on live HTTPS staging at 320px/390px. Production remains undeployed. Gameplay suites use an explicit unlocked fixture; `test:access` separately exercises fresh locked access and real confirmation dialogs.

## Session 4 — play controls

The play screen puts back, equation title, difficulty, and used/allowed moves above the board. Five labeled controls stay below it: **Отменить ход · Заново · Подсказка · Проверить · Решение**. Play controls have at least 44px touch targets; all five fit at 320px width. The existing puzzle navigation now uses larger numbered targets in a horizontal scroll area.

- Undo restores the last completed move, including match positions and remaining moves. Selecting or cancelling a stick, hints, and Check do not create history. Reset restores the initial board and cancels any solution animation.
- Hint tap 1 highlights the stick; tap 2 highlights its destination. Neither consumes a move.
- Solution opens a confirmation, animates a legal accepted layout, and records the puzzle as hinted. It never records an independent solve. Reset enables another attempt.
- Russian status toasts: «Верно!», «Ещё не сходится», «Ходы закончились». Invalid glyph details remain visible. New visits default to Russian; existing language choices are retained.

Validation: build and 47 unit tests, 69 dedicated controls checks at 320px/390px, 42 general browser checks, 62 focused mobile checks, and all 24 native-touch catalog solutions pass locally. All 69 controls checks and 62 mobile checks also passed against live HTTPS staging. No puzzles or payments were added.

To reproduce, build and run the production preview as above, then use:

```sh
TEST_URL=http://127.0.0.1:4173 npm run test:controls
```

Set `CHROMIUM_PATH` to installed Chrome if needed. On a phone, open staging, choose the first puzzle, tap Hint twice, move the highlighted stick to its destination, confirm «Верно!», then Undo and Reset. Try Solution and confirm it shows a hinted layout rather than a solved award. Physical-phone and Safari checks remain manual follow-ups.

## Play and languages

Russian is the default for a fresh visit. Choose Русский or עברית in the header; a saved language preference is respected. All navigation, rules, messages, hints, dialogs, legal pages and accessible labels are translated. Hebrew uses RTL layout while equations and the board remain LTR. Language switching preserves the current board. English keys remain in source for a future release and are not shown as an incomplete product language.

Drag a match to an empty slot, or tap a match and tap its destination. Source and destination must have the same orientation and length; matches do not rotate. Each match has a 44 CSS-pixel pointer hit area; the nearest actual segment wins where hit areas overlap. A drop less than 28 CSS pixels from the nearest slot center snaps only when that slot is empty, different from the source, and compatible. Occupied or incompatible slots block snapping to nearby centers. For crossing operator slots at the same center, the source orientation selects the destination slot. An invalid drop returns the match without consuming a move. Tab and Enter/Space provide a keyboard alternative; Escape cancels selection. Undo and Reset are unlimited.

Exactly the stated number of moves is required. Known digit/operator shapes must form an integer equality using +, − and ×, with normal multiplication precedence. Only explicitly listed solutions are accepted (or any true equality for a puzzle with `"*"`). No `eval` is used. Inequalities, discarded sticks, leading-zero tricks and unknown shapes never count.

Hint 1 marks the source; Hint 2 marks its destination. Hints use the current board and suggest Reset when the known solution is no longer reachable. Show solution animates a known sequence and records hint use; it does **not** mark the puzzle solved. Reset lets the player try independently.

Progress is stored under `matchstick-arithmetic-v1` as `{ solvedIds, hintedIds, unlocked }`. Language uses `matchstick-language`. Malformed or unavailable storage does not prevent play. Reset progress is available in the catalog footer.

## Add a puzzle

Add an entry to `src/data/puzzles.ts` using the `puzzle` helper, for example:

```ts
puzzle('spark-18', '1+1=3', 'easy', 1, ['1+1=2'])
```

The helper creates typed glyph cells, initial segments and first-hint coordinates. A `true` final argument adds an initially empty unary-minus cell immediately after `=`. For custom layouts, use the exported `Puzzle` type and supply glyphs directly. Digits use seven segments in `abcdefg` order, as documented in `src/lib/engine.ts`; +/− share horizontal and vertical slots. Equality has two parallel slots and multiplication two diagonal slots. All matchsticks have equal length.

Every accepted solution must:

1. Map to the same cells and contain only allowed characters.
2. Be arithmetically true, with the starting equation false.
3. Remove and add the same number of occupied segments.
4. Require exactly `movesAllowed` removals **and** additions.
5. Pair every removed stick with a destination of the same orientation and length, and replay successfully through `applyMove`.

Run `npm test`: tests verify every solution, move conservation, exact move distance, hints, parser behavior, invalid moves and translation completeness. Add every intended alternative reading to `acceptedSolutions`.

## Session 3 — verified 24-puzzle catalog

The data-driven catalog contains **24 reachable puzzles: 14 easy, 8 medium, 2 hard**. All/Easy/Medium/Hard filters, equation previews, and move badges use this data directly. Every accepted solution is tested through real legal moves, with exactly the allowed number of relocations and no rotation. Changed starts have new IDs to avoid inheriting solved progress from a different puzzle.

Seven supplied starts needed single-digit corrections because no solution exists under the current rules. Two other starts keep their equations but use corrected accepted readings. See [the complete correction table and all verified paths](docs/catalog.md). No unsolvable entries remain in this catalog.

The full-catalog touch test exposed an existing snapping blocker: horizontal and vertical operator slots share a center. The engine now chooses the compatible orientation at that center while preserving occupied-slot blocking and the existing snap radius.

Validation: build, 47 unit tests, 42 general browser checks, 62 focused mobile checks, and all 24 native-touch catalog solutions pass locally. The catalog test also verifies every difficulty filter, preview title, and move badge. All 24 touch solutions and all 62 focused mobile checks also pass against live HTTPS staging. Production remains undeployed.

```sh
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
# In a second terminal, set CHROMIUM_PATH if needed:
TEST_URL=http://127.0.0.1:4173 npm run test:catalog-browser
TEST_URL=http://127.0.0.1:4173 npm run test:browser
TEST_URL=http://127.0.0.1:4173 npm run test:mobile
```

## Browser checks

With the development server running, use `npx playwright install chromium` once, then `npm run test:browser`. This exercises actual mouse dragging, touch placement at 320px and 390px, keyboard placement, both product languages, filters, hint stages, move limits, two-move solutions, persistence, dialogs and storage failures. `npm run test:i18n` adds focused page-to-app persistence, legal-page RTL, translated footer, and centered LTR board checks. Screenshots are saved under `artifacts/` (currently untracked; no repository `.gitignore` exists). `TEST_URL` can target a production preview; `CHROMIUM_PATH` can select an existing browser executable.

## Main files

- `src/lib/engine.ts` — segment model, safe parser, move validation and hint paths.
- `src/data/puzzles.ts` — the 24-puzzle catalog and explicit accepted solutions.
- `src/lib/i18n.ts` — Russian/Hebrew interface copy and future English keys.
- `src/lib/product-content.ts` — Russian/Hebrew product and legal-page copy.
- `src/components/Board.tsx` — SVG rendering, pointer capture, touch/keyboard selection and match animation.
- `src/App.tsx` — catalog, filters, play, dialogs, progress and navigation.
- `src/styles.css` — wood-table styling, responsive layouts and reduced-motion support.

## Session 2 — mobile drag and win detection

- Pointer, touch, keyboard, hints, and demonstrations share the same orientation/length restrictions. A move requires an occupied source and a different empty destination.
- Off-board, occupied, perpendicular, same-slot, cancelled, and lost-capture drops spend no move. Cancelled drags return the match and leave the next drag usable. A second finger cannot cancel the active drag.
- Every completed move is evaluated. A win requires readable glyphs, a numerically true equality, a listed accepted reading (or `*`), and the existing exact move budget. `≠` never wins.
- Unreadable glyphs are reported immediately. An unreadable intermediate board can still use its remaining move; an exhausted board is locked until Undo or Reset. Loss messages stay visible.
- No puzzles were added or edited. Tests cover all ten independent seven-segment fixtures and lock the `abcdefg` geometry.

**Playtest notes:** On both the local production build and live staging HTTPS deployment, native Chrome touch input at both 320px and 390px starts at `1+1=3`, drags the last digit’s lower-right stick (`4:2`) to its lower-left slot (`4:4`), and produces `1+1=2`. The move counter reads `1 / 1`, the Russian victory status/toast says **«Верно!»**, and solved progress is saved. The same run verifies cancellation, pointer-capture loss, occupied/source/perpendicular drops, 44px stick hit areas, and unreadable/exhausted losing states. Screenshots: `artifacts/session2-touch-320.png` and `artifacts/session2-touch-390.png`.

Validation: production build, 39 unit tests, 43 general browser checks, and 62 focused mobile checks passed locally. All 62 focused mobile checks also passed against the live staging HTTPS URL, including the required victory path. Every served file matches the tested build byte-for-byte. Production remains undeployed.

```sh
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
# In another terminal (set CHROMIUM_PATH if bundled Chromium is unavailable):
TEST_URL=http://127.0.0.1:4173 npm run test:browser
TEST_URL=http://127.0.0.1:4173 npm run test:mobile
# Repeat against staging by setting TEST_URL to the staging HTTPS URL.
```

**Historical catalog conflict (resolved in Session 3):** Six Session 2 entries had no compatible listed solution. Session 3 replaced or removed them and validates every current accepted solution. Session 4 subsequently set Russian as default and enlarged the play controls. Catalog target sizing and physical-phone/Safari testing remain follow-ups.

Session 2 files changed: `src/components/Board.tsx`, `src/lib/engine.ts`, `src/App.tsx`, `src/lib/i18n.ts`, `tests/engine.test.ts`, `tests/browser.mjs`, new `tests/mobile.mjs`, `package.json` (mobile test command), `AGENT.md`, and `README.md`. Generated build files and test screenshots were refreshed. No catalog data or production channel changes were made.

Session 3 files changed: `src/data/puzzles.ts`, `src/lib/engine.ts` (operator overlap blocker), `tests/engine.test.ts`, `tests/browser.mjs`, `tests/mobile.mjs`, new `tests/catalog-browser.mjs`, `package.json`, new `docs/catalog.md`, `AGENT.md`, and `README.md`. Generated `dist/` and test screenshots were refreshed. Existing catalog UI required no component changes.

Session 3 verification limit: staging JavaScript and CSS match the tested build byte-for-byte. The remaining favicon/HTML byte comparison hit a TLS timeout; the retry was rejected because automatic permission approval review exceeded its deadline. Browser navigation and all live gameplay checks succeeded.

Session 4 files changed: `src/App.tsx`, `src/styles.css`, `src/lib/i18n.ts`, `index.html`, `package.json`, `tests/browser.mjs`, `tests/mobile.mjs`, new `tests/controls.mjs`, `README.md`, and `AGENT.md`; generated build files and screenshots refreshed. Catalog data and engine move rules were unchanged.

Session 5 files changed: `src/App.tsx`, `src/lib/storage.ts`, `src/lib/i18n.ts`, `src/styles.css`, new `src/data/access.ts`, `package.json`, new `tests/storage.test.ts`, `tests/access-browser.mjs`, `tests/access-fixture.mjs`, updates to the four existing browser suites, `README.md`, and `AGENT.md`; generated build/screenshots refreshed. Puzzle data and move mechanics were unchanged.

Session 6 files changed: App/footer, main loader, storage catalog import, new `src/lib/catalog.ts`, styles, HTML metadata, Vite/build/test scripts, new page/service-worker/branding build scripts, manifest/icons/OG/register script in `public/`, catalog/PWA tests and storage test setup, README and AGENT. Generated static output and screenshots refreshed. No puzzle definitions, game mechanics, payments, or production settings changed.
