# Session 10 soft-launch QA — 2026-10-01

Tested the production build from `dist/` with browser service workers disabled for deterministic API mocks. The same artifact is deployed to staging. No browser console exceptions or horizontal page overflow occurred.

| Mode actually exercised | Paths and result | First board interactive |
| --- | --- | --- |
| iPhone 13 width, Playwright WebKit 26.6 (Safari engine), touch | Opened free `1+1=3`; used Hint; Reset; touch-moved the stick to `1+1=2`; saw «Верно!»; Reset restored `0 / 1`; switched to Hebrew; verified RTL chrome and centered LTR SVG board. | 170 ms local |
| Pixel 5 width, installed Google Chrome, touch | Opened a locked Champion puzzle; confirmed the lock page; set parent PIN; restored `QA-MOCK-CODE` through a mocked successful `/api/unlock/:code`; confirmed persistence; re-locked the local fixture; confirmed Russian payment failure «Тестовая оплата пока не настроена.» with no stack trace. | 138 ms local |
| Desktop 1440×1000, installed Google Chrome, mouse | Dragged the match in `1+1=3` to solve `1+1=2`; saw «Верно!»; forced a catalog request failure and confirmed the Russian retry page exposes no stack trace. | 88 ms local |

The unlock-code response was mocked because the current xhostd staging channel is static and has no Node API or Stripe keys. Screenshots reviewed: `artifacts/session-10/iphone-webkit.png`, `artifacts/session-10/android-chrome.png`, `artifacts/session-10/desktop-mouse.png`, and `artifacts/catalog-ru.png`.

The same suite was rerun after xhostd staging deployment at `https://staging-matchstick-arithmetic-levant.xhostd.app`. All paths passed with live first-board timings of 1003ms (iPhone-width WebKit), 1140ms (Android-width Chrome), and 1970ms (desktop Chrome). The live catalog suite also touch-solved all 40 puzzles, and the general suite passed all 40 mouse/touch/keyboard/language checks.

Reproduce after `npm run build` and `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort`:

```sh
CHROMIUM_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  TEST_URL=http://127.0.0.1:4173 npm run test:soft-launch
```
