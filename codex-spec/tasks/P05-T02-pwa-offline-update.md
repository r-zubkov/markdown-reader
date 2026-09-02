# P05-T02 PWA offline shell and update lifecycle

## Outcome

Production build installs an app shell that reopens offline, reads documents from IndexedDB and applies service-worker updates only through a safe user prompt outside active import.

## Why now

Stable routes/storage are required before caching/update behavior can be tested without masking application bugs.

## Read before starting

`AGENTS.md`; `codex-spec/features/pwa-storage-platform.md` PWA/update; `codex-spec/architecture/system-architecture.md` runtime/CSP; `codex-spec/design/screens-and-user-flows.md` G-01; `codex-spec/testing-and-quality.md` PWA testing.

## Related requirements

PRD-015, TECH-015, NFR-008, UX-006.

## Preconditions

P01-T01/T02 and P00-T06 complete. Dependencies: P01-T01, P01-T02, P00-T06.

## Scope

- Configure manifest/icons/scope and `vite-plugin-pwa` `generateSW` app-shell precache.
- Implement stable-callback update controller and G-01 Update/Later banner.
- Gate update while import/finalize active; flush ReaderState then user-triggered update/reload.
- Add offline routing/ready-document behavior and remote-media nonfatal state integration.
- Add production-build isolated-profile offline/update tests and Cache Storage inspection.

## Non-goals

No custom SW/injectManifest, background sync, remote-image runtime cache, first-offline-visit support or install promotion.

## Expected files

Vite PWA config/manifest/icons, PWA adapter/controller/banner wiring, production E2E fixtures/tests and deployment header notes if needed.

## Implementation notes

Documents/chunks never enter Cache Storage. Avoid timestamp that regenerates SW every build without source change. Update failure must keep current app and avoid loops. Test SPA fallback at deployment/preview constraints.

## UI and states

Offline info, update available/applying/failure/later, update disabled during import, remote image placeholder. One persistent banner priority integrates later with storage.

## Edge cases

Update during import/finalize, old/new tabs, offline update click, nested base path/scope, SW heuristic timing, stale worker protocol after reload, first visit offline.

## Acceptance criteria

- [ ] After online production load, reload/direct local route works offline and opens ready Document.
- [ ] Cache Storage contains app assets only; source/chunks remain IDB.
- [ ] Update requires user action, waits for active import, flushes progress and reloads once.
- [ ] Failure/offline keeps current version usable; no loop/silent reload.
- [ ] Production Chromium/WebKit PWA tests and manual device smoke pass where supported.

## Required tests

Update controller unit/component, isolated service-worker production E2E, offline reader/network/Cache inspection, old/new bundle protocol scenario as feasible.

## Verification

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, production `pnpm preview`, PWA/offline `pnpm test:e2e:all`; clear isolated test profile/SW between cases.

## Completion report

Report cache manifest/scope/update gating/offline behavior, files, commands/browser evidence, deployment requirements and risks.
