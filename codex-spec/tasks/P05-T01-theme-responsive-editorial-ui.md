# P05-T01 Theme and responsive editorial UI

## Outcome

All MVP surfaces implement the approved technical-editorial token system, light/dark/system no-flash themes and responsive compositions from 320 through wide desktop.

## Why now

Core behavior is stable enough for visual work without repeatedly invalidating reader measurements or overlay states.

## Read before starting

`AGENTS.md`; `codex-spec/design/ui-design-system.md`; `codex-spec/design/screens-and-user-flows.md`; P00-T06 report; `codex-spec/features/pwa-storage-platform.md` theme preference.

## Related requirements

PRD-016, TECH-014, UX-001–008, NFR-005, NFR-009.

## Preconditions

P01-T01, P03-T04, P00-T06 complete. Dependencies: P01-T01, P03-T04, P00-T06.

## Scope

- Finalize semantic variables, app/reader typography, spacing/radius/elevation/layers and Lucide conventions.
- Implement global preference + pre-paint mirror/no-flash; system change and virtual remeasurement preserve anchor.
- Complete responsive AppHeader/ReaderToolbar/Library/Reader/TOC/overlays/settings/pager/status surfaces at all ranges.
- Finish `.reader-content` supported elements, syntax colors, code/table/image overflow and long Russian content.
- Add two-theme visual/contrast/forced-color/reduced-motion/zoom checks and screenshot baselines where stable.

## Non-goals

No brand redesign beyond provisional tokens, user typography controls, focus mode, decorative covers/illustrations or new components without need.

## Expected files

Theme/token/global/reader CSS, preference/bootstrap components, responsive component styles/tests/screenshots and font assets if bundle-approved.

## Implementation notes

Feature styles use semantic tokens. Do not let Tailwind descendant utilities become reader prose contract. Fonts self-host or use documented system fallback. Theme change must not reset location.

## UI and states

Every L/R/O/G state in both themes where visually distinct; responsive transition at 360/768/1120; 320 compact; long/error/busy/focus/disabled/destructive.

## Edge cases

System theme changes mid-read, corrupt mirror, first PWA paint, 400% zoom, long filename/heading, wide table/code, landscape safe area, forced colors, reduced motion.

## Acceptance criteria

- [ ] No wrong-theme flash on cold/reload production preview; preference survives and system mode follows OS.
- [ ] Light/dark contrast/focus/syntax/status checks pass or central tokens are corrected.
- [ ] Required widths/zoom have no page overflow/lost action; TOC/overlays transition correctly.
- [ ] Reader anchor/focus survives theme/font/width remeasurement.
- [ ] UI remains technical-editorial and avoids prohibited generic patterns.

## Required tests

Theme bootstrap/unit, responsive component/axe, visual screenshots both themes/viewports, reader remeasure E2E, contrast/manual forced-colors/reduced-motion/zoom.

## Verification

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, relevant visual/a11y scripts, `pnpm test:e2e:all`, `pnpm build`; manual width/theme/zoom matrix.

## Completion report

List tokens/components/viewports/themes, visual/a11y evidence, files, commands, font/bundle decision, deviations and remaining brand placeholder.
