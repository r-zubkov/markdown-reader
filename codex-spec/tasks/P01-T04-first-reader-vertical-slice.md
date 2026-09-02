# P01-T04 First reader vertical slice

## Outcome

A Library Document opens at `/documents/:documentId`, renders repository-validated bounded safe chunks and restores a basic saved semantic anchor after reload.

## Why now

The walking skeleton must prove storage→route→Reader boundaries before full TOC/virtualization/section work.

## Read before starting

`AGENTS.md`; `codex-spec/features/continuous-reader.md` contracts; `codex-spec/features/sections-toc-progress.md` restore basics; `codex-spec/design/screens-and-user-flows.md` R-01; P00-T04 report.

## Related requirements

PRD-003, PRD-006, PRD-011, TECH-005, TECH-011–013, DEC-020.

## Preconditions

P01-T03 and P00-T04 complete. Dependencies: P01-T03, P00-T04.

## Scope

- Implement Reader use case loading Document/current version and bounded repository range.
- Add `SafeHtmlChunk` as sole injection boundary with tested branded input.
- Render a minimal Reader shell and selected spike adapter/config for a small bounded range.
- Save/restore one semantic block anchor through ReaderState using explicit test action or minimal observer.
- Implement missing Document/stale chunk recovery states and Library back link.

## Non-goals

No final large virtual window, TOC/hash, sections/strategies, precise throttle, full reader typography or PWA.

## Expected files

Reader use case/ports/components, SafeHtmlChunk, minimal location adapter, route wiring, tests/E2E.

## Implementation notes

Do not pass whole chunks array from page. `SafeHtmlChunk` cannot export a public brand cast. Basic anchor must align with final contract so P03 extends rather than replaces it.

## UI and states

Restoring, ready, missing Document, stale derived/error; semantic article/toolbar/skip link from shell.

## Edge cases

Direct missing ID, zero chunks, stale pipeline, corrupt chunk, reload at first/last basic block, route back.

## Acceptance criteria

- [ ] Ready Document opens by route and only bounded current-pipeline chunks render.
- [ ] `dangerouslySetInnerHTML` exists only in SafeHtmlChunk and ordinary string cannot be passed by public TS API.
- [ ] Reload returns to saved test anchor/basic block.
- [ ] Missing/stale/corrupt states do not expose raw HTML/error stack.
- [ ] Reader does not keep whole document corpus in React state.

## Required tests

Repository provenance/SafeHtml contract, Reader state components, route missing, E2E open/save/reload/back.

## Verification

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build`; inspect DOM/chunk query manually.

## Completion report

List route/reader/provenance outcome, bounded behavior, files, commands, deliberate gaps and unblocked P02/P03 tasks.
