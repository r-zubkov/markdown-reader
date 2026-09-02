# F04. Sections, TOC and semantic progress

## User value

Navigate the whole document by its structure, read manageable sections and retain the same meaningful place across sessions, modes and strategies. Related: PRD-005, PRD-007–011, TECH-013, UX-002, UX-007.

## Scope / non-goals

Outline/TOC, deep-link hash policy, sections/pager, auto mode, split strategy selection, ReaderLocationController, persisted ReaderState and restore confidence UI.

Non-goals: search, bookmarks/history of every location, pixel-perfect identical viewport after arbitrary content edits, collapsible ARIA tree.

## TOC rules

- Outline contains entire current version `H1–H3` with source hierarchy and unique generated IDs.
- Render semantic nested list in named `<nav>`; items are links with `aria-current="location"`, not Tree widgets.
- Explicit item activation resolves heading→chunk/section, loads target and updates hash via replace policy. Passive active-heading changes do not write history/hash.
- Keyboard activation moves focus to target heading/stable marker after layout; pointer leaves focus behavior natural. Mobile selection closes Sheet and returns/places focus according to activation method.
- No headings: no empty TOC overlay; trigger hidden/disabled with accessible reason.
- Very large outline uses measured bounded rendering only if needed; it may not remove entries.

## Sections and strategies

- Layout metadata is precomputed/persisted, not recomputed by visual component.
- Section index is zero-based internally, displayed one-based. Previous disabled at first; Next disabled at last; labels include destination title when available.
- Strategy change captures current anchor before selecting new section containing mapped anchor.
- `auto`: structural/cost layout; `h1`/`h2`: user-level headings plus internal chunks; `whole`: one section if policy safe.
- If requested layout has no corresponding headings, it remains valid using deterministic safe boundaries/fallback and explains result only if surprising; full content remains reachable.
- Strategy can be changed while continuous, but affects future sections presentation only.

## Initial mode

On first open/default ReaderState:

1. Compare version analysis against measured `AUTO_SECTIONS_THRESHOLD` (not raw byte size alone if corpus shows better cost metric).
2. Set `readingMode`, `modeOrigin='auto'`.
3. Once user chooses a mode, `modeOrigin='user'`; replacement preserves it unless chosen mode is technically impossible, then defined fallback + notice.

## Location observation and persistence

- Canonical point is top visible meaningful block below toolbar. Meaningful excludes pure spacer/wrapper.
- Controller stores current location outside React render loop; UI receives throttled derived progress/active heading.
- Trailing-throttled IDB writes; explicit TOC/mode/strategy/route leave flush immediately; `pagehide` best effort.
- Library percent is clamped/rounded display of `progressRatio`; 100% policy is based on reaching final meaningful block/ratio threshold defined in tests, not merely opening last section.

## Restore/mapping

Priority on entry: valid explicit hash → saved anchor for current version → mapped anchor from replace/reprocess result → start.

Resolution order within same version: `blockId` → heading path + block ordinal → nearest heading → overall source ratio → start. Cross-version mapping follows F05 and F00 measured algorithm. Result always includes `confidence` and reason.

UI:

- `exact`: no notification;
- `approximate`: one inline notice with Continue/Start, live-announced once;
- `none`: starts at beginning and explicitly says old place could not be restored.

## Edge cases

Repeated headings, reordered sections, heading removed, hash to H4/not-in-outline, invalid hash encoding, anchor in oversized fallback node, first/last section, empty document, layout with one section, rapid double switch, persistence failure, route leave during pending throttle.

## Acceptance criteria

- [ ] TOC lists every H1–H3 exactly once with correct hierarchy and unique target.
- [ ] Heading selection reaches correct content in continuous and sections mode and does not pollute Back history.
- [ ] All layouts cover entire document; pager reaches first through last section without loops/gaps.
- [ ] Initial auto mode and user override behave deterministically and survive reload.
- [ ] Reload/mode/strategy restore passes measured tolerance or displays correct approximate/none state.
- [ ] Scroll updates do not cause React render/IDB write per event.
- [ ] Keyboard focus and mobile Sheet behavior match screen/accessibility contract.

## Required tests

Outline/ID unit tests; layout property tests; LocationController fake-clock throttling; hash adapter/history tests; progress mapping corpus; component TOC/pager/settings; E2E TOC + mode + strategy + reload; keyboard/screen-reader manual checks.

## Dependencies

F00 mapping/mobile, F02 metadata/layouts, F03 continuous adapter, repository ReaderState. Tasks P03-T01/T03/T04.
