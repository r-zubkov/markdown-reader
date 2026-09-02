# P03-T01 Whole-document TOC and deep links

## Outcome

Reader renders the complete H1–H3 semantic TOC, resolves stable heading IDs to repository chunks/sections and handles explicit hashes without polluting browser history.

## Why now

Both production continuous and sections readers need the same heading resolution/active-location contract.

## Read before starting

`AGENTS.md`; `codex-spec/features/sections-toc-progress.md` TOC; `codex-spec/design/screens-and-user-flows.md` R-01; `codex-spec/architecture/data-and-state.md` outline IDs; `codex-spec/design/ui-design-system.md` TOC/accessibility.

## Related requirements

PRD-005, TECH-013, UX-002, UX-007.

## Preconditions

P01-T04 and P02-T01 complete. Dependencies: P01-T04, P02-T01.

## Scope

- Implement outline query/heading resolver and `TableOfContents` nested link component.
- Wire desktop persistent TOC breakpoint and responsive Sheet trigger using existing primitives.
- Implement explicit hash precedence, invalid/missing heading fallback and replace-history policy.
- Implement keyboard vs pointer focus behavior and throttled active-item contract (basic observer can be refined P03-T04).
- Handle no headings and large/long outline without dropping entries.

## Non-goals

No full continuous adapter changes, section pager, search, collapsible Tree or writing hash on passive scroll.

## Expected files

Reader outline use case/resolver, TOC component/Sheet/hash adapter/styles/strings and tests.

## Implementation notes

Links use generated IDs and `aria-current="location"`. Far target asks Reader window/section port to load target; do not linear-scroll through unloaded chunks. Passive active state must not mutate history.

## UI and states

Persistent/Sheet, active item, loading target, no headings, invalid hash fallback, long headings. Selecting in mobile closes Sheet.

## Edge cases

Repeated IDs, Unicode/encoded hash, hash to H4/nonexistent, target on chunk boundary, direct deep link before metadata, hundreds/thousands of headings, keyboard focus after delayed load.

## Acceptance criteria

- [ ] Every outline H1–H3 appears once in hierarchy and reaches correct generated target.
- [ ] Explicit valid hash overrides saved anchor; invalid hash follows defined fallback/notice.
- [ ] Passive active updates do not grow Back history.
- [ ] Keyboard/pointer focus and mobile Sheet return follow contract.
- [ ] No-headings/long-outline states remain readable and accessible.

## Required tests

Resolver/hash/history unit tests, TOC semantic/focus/axe component tests, deep-link direct-entry and both-width E2E.

## Verification

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build`; manual Back-stack and keyboard Sheet check.

## Completion report

List resolver/hash/focus behavior, files, commands, outline scale evidence, deviations and next reader tasks.
