# Markdown Reader MVP release candidate

Decision: **ACCEPTED** on 2026-09-25.

## Candidate identity

- Code revision: `7bab8e699390eb970ae78fe9b3638e0ff6fd41d3`.
- P05-T05 changes are acceptance/status documentation only; the verified application code is unchanged from that revision.
- Environment: Windows `10.0.26200`, Node `24.20.0`, pnpm `11.25.0`, Playwright `1.62.1`, bundled Chromium `151.0.7922.34`.
- Scope: 52 normalized MVP requirements and 25 atomic tasks (`P00-T01` through `P05-T05`).
- Browser commitment: Chrome 111+ behavior, release-tested with Playwright Chromium; Firefox, Safari/WebKit, iOS and physical iPhone are not claimed.

## Final verification

The environment has no global `pnpm`, so the workspace-pinned Corepack payload was invoked as `node .corepack/v1/pnpm/11.25.0/bin/pnpm.cjs`. This is the same lockfile-pinned pnpm version declared by `package.json`.

| Gate | Result |
|---|---|
| Frozen install | Passed; lockfile already up to date |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed |
| `pnpm test` | 29 files, 147 tests passed |
| `pnpm test:security` | 3 files, 12 tests passed |
| `pnpm test:bench` | 4 files, 6 tests passed |
| `pnpm build` | Passed; Vite 8.1.5, 3,279 modules, 9 app-shell precache entries |
| Chromium release suite | 41 tests passed with one worker against a separately managed Vite process |
| Production PWA/CSP suite | 2 tests passed against a separately managed preview process |
| `pnpm audit --prod` | No known vulnerabilities |
| Repository Markdown local-link audit | 61 files checked; no missing local target |

The existing minified main-chunk size advisory remains nonblocking. It does not change the measured bounded Reader DOM/cache behavior or the approved import limits.

## Release smoke and budgets

The real-Chromium release suite replays the manual-smoke flow: fresh Library, valid/invalid/cancelled import, read/reload, far TOC jump, mode/strategy/theme changes, offline reopen, remote-image blocking, duplicate/update/replace/separate/cancel, delete cancel/success/failure, keyboard focus and the responsive width matrix.

Current production Reader measurements were 16 mounted chunks, 64 cached chunks, 16.60 ms longest blank interval, 63 ms longest main-thread task and 0.25 px responsive anchor drift. The 20,000-chunk spike peaked at 22 mounted chunks, cache 96 and 33.30 ms blank interval. These remain within the accepted budgets of 48 mounted chunks, cache 96, 100 ms blank interval, 150 ms task and 96 px stabilized drift.

Production PWA tests confirm that the shell reopens offline after an online visit, a ready IndexedDB Document remains readable, Cache Storage contains only application assets and the application/Worker/Reader run under the deployment CSP.

## Requirement and evidence reconciliation

Every normalized requirement is represented in the traceability table in `codex-spec/requirements-and-decisions.md` and maps to completed implementation tasks and test/report evidence. The signed checklist is `codex-spec/final-acceptance-checklist.md`. Primary evidence records are:

- `docs/benchmarks/production-pipeline.md` for content, limits and Worker pipeline;
- `docs/benchmarks/storage-atomicity-spike.md` and `docs/benchmarks/storage-health.md` for data integrity and browser-storage limits;
- `docs/benchmarks/virtual-reader-spike.md`, `docs/benchmarks/continuous-reader.md` and `docs/benchmarks/progress-persistence.md` for bounded rendering and semantic position;
- `docs/accessibility/P05-T01-theme-responsive.md` and `docs/accessibility/P05-T04-hardening.md` for responsive, theme, accessibility, CSP and privacy evidence.

No blocking content-loss, XSS, partial-publication, unrecoverable migration, offline-shell or Reader defect is known at acceptance.

## Approved waivers and open item

- NVDA + Chrome was explicitly waived by the user on 2026-09-24 because NVDA is unavailable in the sandbox. Automated axe, semantic markup and keyboard/focus coverage pass, but the release makes no screen-reader compatibility claim.
- Direct Chrome UI 200%/400% zoom was explicitly waived by the user on 2026-09-24. Equivalent 320 CSS px/400% reflow, text spacing and all release widths pass, but this is not evidence from Chrome's zoom controls.
- VoiceOver/Safari/iOS is outside the MVP browser matrix under DEC-022.
- Waiver owner: release maintainer. Expiry: before any screen-reader/browser-zoom compatibility claim or after a material accessibility/responsive-layout change, whichever comes first.
- `OPEN-001` remains the isolated neutral-blue brand accent placeholder. It does not affect behavior, data or release safety.

## Build and deployment handoff

1. Use Node `>=22.22.0` and pnpm `11.25.0` from Corepack/package metadata.
2. Run `pnpm install --frozen-lockfile`, then `pnpm build`.
3. Serve `dist/` from one stable HTTPS origin. Rewrite extensionless routes such as `/documents/:documentId` to `index.html`.
4. Translate `dist/_headers` exactly if the host does not support the `_headers` convention. Keep `sw.js`, `index.html` and the manifest revalidated; hashed assets may be immutable.
5. Do not add runtime/CDN caching for Markdown content or remote images. Source, chunks, preferences and progress remain in IndexedDB.

The complete hosting contract is in `codex-spec/deployment/pwa-hosting.md`.

## User-visible limitations

- Data belongs to the current browser origin/profile and can be evicted by the browser. Users must retain original Markdown files; MVP has no backup/export.
- First offline visit is unsupported. Offline use begins after one successful online production load and service-worker installation.
- HTTPS remote images are the only permitted third-party content request and can be disabled globally. Relative local assets are unsupported.
- Search, editing, sync, accounts, backend, notes, bookmarks, folders/assets and content telemetry are outside MVP.

## Recommended first post-MVP task

Implement the deferred backup/export decision (`DFR-003`) as a separately specified task. It addresses the largest remaining user-data risk without weakening the browser-local architecture. Any work must define an export format, recovery/import validation, version compatibility and privacy behavior before changing schema or UI.
