# F03. Continuous virtual reader

## User value

Read a large document as one uninterrupted stream without loading controls, giant DOM or lost location. Related: PRD-006, PRD-010, PRD-011, TECH-011, UX-002, NFR-001, NFR-005, NFR-006.

## Scope / non-goals

Window/document-scroll virtualizer adapter, bounded repository window, dynamic measurement, far jumps, semantic active block, progressive placeholders, focus safety, theme/resize/image remeasurement and measured fallback.

Non-goals: full-document browser find, search index, whole chunk corpus in memory, custom scroll container unless spike decision explicitly changes DEC-015, fancy auto-hiding toolbar.

## Preconditions

F00 virtualization gate selects TanStack configuration or documented bounded fallback and defines DOM/window/jump/long-task budgets. F02 supplies stable chunk keys/safe HTML. Repository supports ordered range queries.

## Main flow

1. Resolve initial SemanticAnchor to target chunk/block.
2. Request bounded range around target; initialize virtualizer with stable `versionId:ordinal` keys and measured estimates.
3. Render only virtual items through `SafeHtmlChunk`; measure after mount/ResizeObserver.
4. Adjust scroll while preserving semantic anchor under layout changes.
5. Range change fetches/evicts chunks outside bounded cache; user sees continuous document, not pagination.
6. Top visible meaningful block updates LocationController and active TOC/progress throttled.

## Rules

- `useFlushSync`, overscan, estimator and optional `directDomUpdates` equal the approved spike configuration; never copied blindly from example.
- Cache/window size is central measured config and can vary by direction/velocity only within bound.
- Far TOC/restore jump loads target range directly; it does not scroll through every intervening chunk.
- Late image/font/theme/width changes remeasure and keep anchor within tolerance.
- Focused chunk cannot be evicted. Interactive prose links/code copy remain reachable; if window must change, focus goes to stable reader marker with explicit intent.
- Empty/error chunk has bounded height/content and remains part of ordinal flow.
- Progressive loading may show local skeleton/spacer; sustained blank gap is failure.
- Reader progress derives from semantic source position, not virtualizer pixel total alone.

## Component contract

```ts
interface ReaderViewportProps {
  versionId: VersionId;
  initialAnchor: SemanticAnchor | DocumentStart;
  onLocationChange(location: ObservedLocation): void;
  onFatalError(error: ReaderError): void;
}
```

It obtains chunks through injected `ReaderWindowPort`; parents do not pass `chunks[]` for whole document. `SafeHtmlChunk` accepts current-pipeline branded HTML and stable key only.

## States and edge cases

Restoring, ready, fetching leading/trailing range, far-jump, remeasuring, safe-fallback chunk, corrupt/missing chunk, stale pipeline, empty document, image load/error, offline image, focus-pinned item.

Test rapid alternating scroll; extremely variable heights; 20k chunks; duplicate estimates; heading at boundary; page zoom; theme/font change; image resolves above viewport; browser back/forward; resize orientation; 320 px long line/table.

## Accessibility/privacy/performance

Article semantics must remain coherent despite chunk wrappers; wrappers should be neutral where possible. `aria-busy` applies only during meaningful restore/range state. Scroll changes are not announced. External resource preference is enforced; observer does not transmit content. DOM and in-memory chunk count remain within spike budget.

## Acceptance criteria

- [ ] First/middle/last markers of large fixture are reachable in order with no missing/duplicate content.
- [ ] Mounted DOM and cached chunk count stay within recorded budgets.
- [ ] Restore/far TOC jump reaches target within anchor tolerance without linear scroll.
- [ ] Late resize/image/theme changes do not create sustained blank gaps or anchor drift above budget.
- [ ] Focus never disappears because a chunk is unmounted.
- [ ] Physical iPhone Safari and automated target browsers pass the recorded continuous-reader scenario.
- [ ] If candidate fails a gate, sections/manual-window fallback keeps full document readable and roadmap/decision reflect it.

## Required tests

Virtualizer adapter unit tests, component range/focus tests, large deterministic E2E, far-jump/restore/resize/theme/image tests, performance benchmark and physical iPhone checklist. Avoid snapshots of all generated positions.

## Dependencies

F00 virtualization/mobile, F02 chunks, F04 location/TOC. Implementation P03-T02 follows spike P00-T04.
