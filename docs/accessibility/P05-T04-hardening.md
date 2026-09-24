# P05-T04 security, accessibility and browser hardening evidence

Status: **complete with explicit user-approved waivers for NVDA and browser-chrome zoom**.

## Environment

- Date: 2026-09-24.
- OS: Microsoft Windows NT 10.0.26200.0 in the Codex sandbox.
- Node: 24.20.0; pnpm: 11.25.0.
- Playwright: 1.62.1; bundled Chromium: 151.0.7922.34.
- Source baseline: commit `452ef64`; verification used the current P05-T04 worktree.
- Browser scope: desktop Chromium and responsive mobile-Chromium, matching DEC-022.

## Security, privacy and deployment findings

The audit found that a current-pipeline string read from IndexedDB was shape/version checked but was branded without validating the stored HTML itself. IndexedDB is an untrusted boundary, so the repository now parses each requested chunk in a detached template and validates the complete persisted-output allowlist before applying `SanitizedHtml`. Unexpected tags, attributes, generated IDs, links, image forms or policy values return `INVALID_PERSISTED_RECORD`; Reader offers source-Blob recovery and never injects the changed derived record. The canonical pipeline corpus and repository/browser corruption regressions cover this boundary.

The pre-paint theme bootstrap moved from inline HTML to a same-origin classic script. The production artifact now ships `_headers` with the exact CSP and complementary no-referrer, no-sniff, framing and permissions policies. The CSP admits no inline script or `unsafe-eval`; one fixed hash admits React Aria's static pressability rule. Trusted theme/virtualizer style attributes remain allowed because runtime layout requires them, while both pipeline sanitization and repository read validation reject document `style` attributes. A production-preview E2E injects the deployment CSP and proves that the app, import Worker and Reader load without policy errors.

Safe raster data images are restricted at the render boundary to PNG, JPEG, GIF, WebP or AVIF base64 within the central decoded-size limit. HTTPS remote images retain the explicit preference, online and no-referrer policy.

Static production-source review found no `fetch`, XHR, WebSocket, beacon, content logging or runtime cache path. The only application-created third-party request remains an explicitly enabled HTTPS image element. `runtimeCaching` remains empty. `pnpm audit --prod` reported no known vulnerabilities. No source text, stored HTML or full document URL was added to diagnostics or logs.

## Accessibility, responsive and visual matrix

| Check | Evidence | Result |
|---|---|---|
| 320 CSS px / 400% equivalent reflow | Library/header, Reader, import/recovery flows; 44 x 44 CSS px visible targets | Passed; no page overflow |
| 390, 768, 1024, 1120 and 1440 CSS px | One Reader matrix checks content, mobile/desktop TOC breakpoint and fixed-status separation | Passed |
| WCAG text spacing at 320 px | 1.5 line height, 0.12em letter spacing, 0.16em word spacing and 2em paragraph spacing | Passed; actions remain available |
| Light and dark themes | Full-page 1280 x 900 baselines plus axe over `#root`, including storage status | Passed |
| Forced colors and reduced motion | Chromium media emulation at 320 px | Passed; visible 2 px focus and reduced transitions |
| Keyboard and focus | Skip/navigation, import dialog, mobile TOC, settings, replacement, delete dialog, recovery and virtual focus pin coverage | Passed in the complete Chromium suite |
| Large Reader | 181-chunk repository benchmark and 220-section Chromium corpus | Passed; bounded cache/DOM and no sustained gap |
| Real browser zoom | Headless runner covers equivalent CSS-pixel reflow but cannot operate Chrome UI zoom controls; the user explicitly skipped this check on 2026-09-24 | Waived by the user |
| NVDA + Chrome | NVDA is not installed in the sandbox; the user explicitly skipped this check on 2026-09-24 | Waived by the user |

The storage-status reserve now also constrains the fixed desktop TOC, so its final entries cannot be covered by the banner. On the narrowest header, controls wrap and the redundant one-click theme toggle is hidden; the canonical theme select remains available. Full-page visual baselines intentionally include the integrated storage-risk status.

The remote-image error test now awaits the intercepted request abort. Theme axe scans wait for CSS transitions to finish, preventing transient intermediate colors from being mistaken for steady-state contrast. The release Playwright configuration uses one worker because eight simultaneous import Workers and large Reader contexts repeatedly produced host-contention timeouts; all affected scenarios passed immediately with one worker. No timeout or product performance budget was increased.

## Performance evidence

| Metric | Result | Existing budget |
|---|---:|---:|
| 181-chunk staging and bounded repository traversal, including stored-HTML validation | 210.79 ms | less than 5,000 ms |
| Reader cache | 96 | at most 96 |
| Chromium mounted chunks | 16 | at most 48 |
| Chromium longest blank interval in the final full run | 16.60 ms | at most 100 ms |
| Chromium longest main-thread task in the final full run | 61 ms | at most 150 ms |
| Theme target drift in the final full run | 0 px | at most 96 px |

## Verification record

Commands used the workspace-pinned pnpm binary because no global pnpm executable is available.

- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm test` — 29 files, 147 tests passed.
- `pnpm test:security` — 3 files, 12 tests passed.
- `pnpm test:bench` — 4 files, 6 tests passed.
- Targeted visible Reader benchmark — passed with the 210.79 ms measurement above.
- `pnpm build` — passed; 9 application precache entries, no document/runtime-image cache. The existing main-chunk size advisory remains.
- Nested `vite build --base=/reader/` — passed; theme bootstrap, hashed assets, manifest and service-worker entries stay inside the base path.
- `pnpm test:e2e:all` against separately managed development and preview servers — 41 Chromium tests and 2 production-PWA tests passed.
- Focused remote-image/dark-theme stability rerun with `--repeat-each=3` — 9 tests passed.
- `pnpm audit --prod` — no known vulnerabilities.

## Approved manual waivers

The user explicitly waived the NVDA + Chrome manual check and the separate real Chrome 200%/400% zoom check on 2026-09-24. These waivers close the manual gates for P05-T04 only. They do not claim screen-reader compatibility or evidence from Chrome's browser UI zoom controls.

No automated security, integrity, accessibility or performance blocker remains. Any future accessibility certification, screen-reader support claim or material responsive-layout change must replace the applicable waiver with current manual evidence.
