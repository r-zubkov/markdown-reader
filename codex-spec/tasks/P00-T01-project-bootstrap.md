# P00-T01 Project bootstrap

## Outcome

Greenfield repository has a runnable strict React/Vite TypeScript project, reproducible `pnpm` lockfile, target quality scripts and test/browser scaffolding suitable for main thread and Web Worker code.

## Why now

Every spike and feature needs one verified toolchain; package compatibility must be established before architecture evidence is produced.

## Read before starting

`AGENTS.md`; `codex-spec/requirements-and-decisions.md` sections CON-003/DEC-002/003; `codex-spec/architecture/system-architecture.md` modules/dependencies; `codex-spec/testing-and-quality.md` target commands.

## Related requirements

TECH-001, TECH-002, TECH-016, NFR-010; DEC-002, DEC-003.

## Preconditions

No code repository exists, or existing repository inspection confirms it is an empty greenfield target. If code already exists, stop and reconcile instead of overwriting.

Dependencies: none.

## Scope

- Initialize React + TypeScript via Vite 8.1 line and `pnpm`.
- Select current stable patches compatible with React Router 8 requirements and Node `>=22.22`; record resolved versions, not guessed patches.
- Configure strict TS for browser and worker, ESLint including hooks/import boundaries, Vitest + Testing Library + fake IndexedDB, and Playwright Chromium/Firefox/WebKit.
- Create target scripts from `codex-spec/testing-and-quality.md`; a minimal app renders and production build succeeds.
- Establish only needed top-level source/test directories and aliases consistent with `codex-spec/architecture/system-architecture.md`; add base test setup and a smoke test.
- Commit lockfile and update the root human-facing README with verified runtime/package-manager requirements and exact install/dev/test/build commands backed by `package.json`.

## Non-goals

No production screens, Dexie schema, Markdown pipeline, shadcn component installation, service worker, design polish or feature placeholders.

## Expected files

`package.json`, `pnpm-lock.yaml`, Vite/TS/ESLint/Vitest/Playwright configs, minimal `src/main`/app entry, test setup and repository README. Follow actual scaffold paths.

## Implementation notes

Use React Router Declarative package/API only if the minimal entry needs routing; full routes belong P01-T01. Ensure worker TS types do not leak Node globals. Import-boundary enforcement may start with ESLint rules and must be testable. Do not enable experimental React Compiler/Vite modes.

## UI and states

Only a semantic bootstrap placeholder and failure-free mount; no visual system claim.

## Edge cases

Existing files/dirty tree; package peer conflict; Node below minimum; Playwright browsers unavailable locally; ESM config interop. Do not bypass peer/minimum errors with force flags.

## Acceptance criteria

- [ ] Clean install from lockfile succeeds on supported Node.
- [ ] Minimal app starts and production build succeeds.
- [ ] Target scripts exist with documented meaning; unit smoke passes.
- [ ] Strict TS and import-boundary lint foundation are active.
- [ ] Resolved versions satisfy current official React/Router/Vite requirements and are recorded.
- [ ] Root README contains only verified setup/run/check commands and reflects the actual bootstrap status.

## Required tests

One render smoke, one domain-boundary lint/example check, Playwright config discovery without requiring feature E2E.

## Verification

Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; run Playwright test listing/config validation command defined by the scaffold.

## Completion report

List resolved runtime/dependency versions, created configs/files, exact commands/results, any unavailable browser binary check, deviations and the now-unblocked P00 tasks.
