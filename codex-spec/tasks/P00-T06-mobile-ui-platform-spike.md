# P00-T06 Mobile UI and platform primitive spike

## Outcome

The repository has a pinned shadcn React Aria base snapshot and validated Dialog/Sheet/RadioGroup/DropZone/PWA mobile harness, with physical-iPhone findings and fallback decisions.

## Why now

The chosen UI base is recent and mobile Safari/focus behavior affects every overlay and Reader layout.

## Read before starting

`AGENTS.md`; `codex-spec/features/risk-spikes.md` Spike E; `codex-spec/design/ui-design-system.md`; `codex-spec/design/screens-and-user-flows.md` O-01/O-04; `codex-spec/features/pwa-storage-platform.md` platform rules.

## Related requirements

TECH-014, UX-003–007, NFR-005, NFR-006; DEC-011, DEC-015.

## Preconditions

P00-T01 complete. Dependencies: P00-T01.

## Scope

- Initialize shadcn with React Aria base, pin `components.json`/preset and install only primitives needed for harness.
- Create responsive harness for dynamic Dialog→decision content, full-height Sheet, described RadioGroup with async apply, FileTrigger/DropZone and focus return.
- Add theme token skeleton/`dvh`/safe-area/scroll-lock behavior sufficient to test.
- Create minimal production-build PWA/offline/update prompt skeleton only as needed for device lifecycle evidence.
- Run automated WebKit and physical iPhone scenarios; document gaps and local direct-React-Aria fallback if a primitive fails.

## Non-goals

No final feature UI, full PWA caching policy, all shadcn components, visual polish or production Import controller.

## Expected files

`components.json`, selected `src/ui/primitives`, harness route/components/tests, platform spike report/checklist, minimal token layer.

## Implementation notes

Do not mix Radix/Base UI implementations. Installed code becomes repository code and must be reviewed. Preserve one overlay controller rather than nesting. Test dynamic viewport/address bar and focus after state replacement.

## UI and states

Idle/running/decision/error overlay samples; TOC-like long Sheet; RadioGroup applying/error; mobile footer/safe area; light/dark focus ring.

## Edge cases

320 px, landscape, long Russian labels, keyboard/screen reader, Escape during running state, background scroll, virtual keyboard/dynamic address bar, reduced motion.

## Acceptance criteria

- [ ] Selected primitives pass keyboard/focus/return/scroll-lock contracts or documented local fallback is selected.
- [ ] 320/390 and iPhone portrait/landscape have no clipped footer/lost close action/background scroll.
- [ ] Dialog content replacement does not return focus to body or create nested modal.
- [ ] Components use one base and committed reproducible configuration.
- [ ] Physical device procedure/result is recorded, not inferred from WebKit only.

## Required tests

RTL component focus tests, axe, Playwright responsive/WebKit harness and physical iPhone manual checklist.

## Verification

Run `pnpm typecheck`, `pnpm lint`, targeted component/a11y tests, `pnpm test`, relevant `pnpm test:e2e:all`, `pnpm build`; run/record physical checklist.

## Completion report

List installed primitives/versions, selected/fallback behavior, automated/physical results, files/commands, gaps and tasks unblocked.
