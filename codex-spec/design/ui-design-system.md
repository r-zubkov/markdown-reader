# UI design system

## Direction and stack

Visual direction: technical editorial — quiet reading surface, precise utility chrome, no bookshelf skeuomorphism and no IDE imitation.

- `shadcn/ui` initialized with React Aria base (`--base aria`); installed source is reviewed and versioned in `src/ui/primitives`.
- Tailwind CSS 4 styles shell/components. CSS custom properties define semantic tokens.
- Rendered Markdown uses a dedicated CSS layer and `.reader-content` namespace; feature utilities must not target arbitrary descendants inside sanitized HTML.
- Lucide React supplies line icons. Dynamic icon lookup is forbidden unless measured need exists.
- TanStack Virtual is not a visual primitive and remains behind `ReaderViewport`.

The later UI blueprint supersedes the earlier CSS Modules recommendation only for presentation. Domain/storage/worker modules remain framework-agnostic.

## Component sourcing rules

| Need | Use directly/wrap | Own component |
|---|---|---|
| Button, Progress, Skeleton, Spinner, Alert | Adapted shadcn primitive | — |
| Dialog, AlertDialog, Sheet, Popover, DropdownMenu | shadcn React Aria base through app conventions | `ResponsiveOverlay` when one flow changes shell by width |
| RadioGroup/ToggleGroup | React Aria-based shadcn; RadioGroup for described options | `ReadingSettings` composition |
| FileTrigger/DropZone | React Aria components, locally wrapped for tokens/errors | `FileDropField` |
| Toast/live region | One app-level provider/primitive | `GlobalStatusRegion` |
| Library row | Primitive buttons/menu only | `DocumentItem`, `DocumentList` |
| TOC | Semantic `<nav><ol>` links, not ARIA Tree | `TableOfContents` |
| Reader | No kit prose component | `ReaderViewport`, `SafeHtmlChunk`, `.reader-content` |
| Pager/progress/storage/media/errors | Compose primitives | `SectionPager`, `ReadingProgress`, `StorageStatusBanner`, `ExternalMediaFallback`, `RouteErrorState` |

Do not install two primitive bases for the same behavior. Do not overwrite a locally adapted shadcn file with CLI output without reviewing diff. Avoid generic `BaseComponent`, prop soup and local one-off button variants.

## Semantic tokens

Palette is `DERIVED` from the approved visual direction and remains replaceable through roles.

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `--app-bg` | `#F3F4F2` | `#101215` | Outer app background |
| `--surface` | `#FFFFFF` | `#181B20` | Controls/overlays/document items |
| `--surface-raised` | `#F8F9F8` | `#20242A` | Hover/raised surface |
| `--reader-bg` | `#FCFCF8` | `#14171B` | Document surface |
| `--text` | `#1C1E21` | `#E9ECF1` | Primary text |
| `--text-muted` | `#646A73` | `#A6ADB8` | Secondary text |
| `--border` | `#D9DCE1` | `#2C323B` | Boundaries/dividers |
| `--accent` | `#315FD6` | `#8EACFF` | Action/current/focus |
| `--accent-contrast` | `#FFFFFF` | `#101522` | Text on accent |
| `--success` | `#237A4B` | `#68D59A` | Success |
| `--warning` | `#9A6200` | `#F1C66B` | Recoverable/storage warning |
| `--danger` | `#B42318` | `#FF8A82` | Error/destructive |
| `--code-bg` | `#F0F2F4` | `#1D2229` | Code |
| `--selection` | `#C9D7FF` | `#324A78` | Text selection |

Feature code references roles, never raw hex. Both themes require measured text ≥4.5:1, large text ≥3:1 and UI/focus boundary ≥3:1; token values may be adjusted centrally to pass.

## Typography

Self-host fonts only; no third-party font request.

- UI/headings: `Inter Variable`, fallback `ui-sans-serif, system-ui, sans-serif`.
- Reader body: `Source Serif 4 Variable`, fallback `Charter, Georgia, serif`.
- Code: `JetBrains Mono Variable`, fallback `ui-monospace, SFMono-Regular, Consolas, monospace`.

If bundle audit rejects optional font files, system fallbacks are accepted without changing layout contracts.

| Role | Desktop | Mobile | Line height |
|---|---:|---:|---:|
| Metadata | 12 px | 12 px | 1.45 |
| UI secondary/button | 14 px | 14 px | 1.5 |
| UI base | 16 px | 16 px | 1.5 |
| Reader body | 18 px | 17 px | 1.72 / 1.68 |
| Reader H3 | 22 px | 20 px | 1.35 |
| Reader H2 | 28 px | 25 px | 1.25 |
| Reader H1 | 38 px | 32 px | 1.15 |
| Screen title | 32 px | 28 px | 1.2 |
| Code | 13.5–14 px | 13 px | 1.55 |

Prose measure targets 66–78 characters; max column 800 px. No justification. Source heading levels remain semantic; CSS controls visual size.

## Spacing, radius, elevation and layers

Spacing scale: `2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96` px. New arbitrary values require measured reason.

- Radius: 4 code/chip, 8 controls, 12 document items/sections, 16 large overlays.
- Controls: 36 compact desktop, 40 default desktop, 44 touch/mobile.
- Icons: 16/18/20/24 px, stroke 1.75–2.
- Shadows: `shadow-1 0 1px 2px rgb(0 0 0/.06)`, `shadow-2 0 8px 24px rgb(0 0 0/.12)`, overlay `0 20px 60px rgb(0 0 0/.18)`. Dark relies more on border.
- Z-order: content → sticky toolbar/TOC → banner → popover/menu → modal sheet/dialog → toast/live overlay. Define named tokens; no arbitrary `z-[9999]`.
- Reader is not a shadowed card. App/reader tone and whitespace create separation.

## Grid and responsive composition

| Width | Layout rule |
|---:|---|
| `<360` | 12 px gutters, critical toolbar controls only, 44 px targets |
| `360–767` | 16 px gutters; single column; TOC/settings/import as full-height Sheet/dialog |
| `768–1119` | Centered reader, TOC/context in side Sheet; library rows may wrap metadata |
| `1120–1439` | Two-column reader: TOC 240–300 px + 32–48 gap + prose ≤800 px |
| `>=1440` | Same grid; only outer whitespace grows; prose never stretches |

- App container max 1040 px; library list max 880 px.
- Header 56 px desktop/tablet, 52 px compact mobile.
- Document viewport owns scrolling. Overlays/long TOC may have their own controlled scroll.
- Use logical properties, `dvh`, safe-area insets and container behavior. At 200–400% zoom composition may cross to narrower layout.
- Persistent TOC only if available layout width ≥1120, not by user-agent/device type.

## Reader content contract

`.reader-content` owns rules for `h1–h6`, paragraphs, lists, task lists, blockquote, links, footnotes, `pre/code`, tables, images, thematic break and safe raw-HTML literal.

- Paragraph/list content wraps; unbroken URL uses `overflow-wrap:anywhere`.
- Inline code wraps only when required to prevent page overflow.
- `pre` and table wrapper use local horizontal scroll; no soft wrap for fenced code by default.
- Table preserves min-content; reduce type by at most one token. Add focusable overflow region only when actual overflow is detected and label it.
- Images `max-inline-size:100%; block-size:auto`; resize triggers chunk remeasurement.
- External link has visible indicator that does not rely only on icon/color.
- Footnote labels/back labels are Russian and accessible; generated IDs use application prefix.
- Task-list checkbox is noninteractive/read-only unless source semantics demand disabled control; it must not enter tab order.
- User raw HTML appears as literal escaped markup, not DOM elements.

## Interactive states

| State | Required expression |
|---|---|
| Hover | Surface/border change only under `(hover:hover)` |
| Focus-visible | 2 px accent ring + 2 px offset; never hidden by toolbar |
| Pressed | Tone and optional ≤1 px movement; not only opacity |
| Selected/current | Tinted surface + marker/weight and semantic state (`aria-current` where applicable) |
| Disabled | Readable text, unavailable semantics and adjacent reason; tooltip alone insufficient |
| Error | Message + icon/border; recovery action when possible |
| Destructive | Danger token + explicit verb; initial focus stays on safe action |
| Busy | `aria-busy`/disabled relevant controls, visible stage; no fake determinate percentage |

Library row is not one giant button with nested buttons. Title can be link; Continue and menu are separate focusable controls.

## Motion

- Fast 120 ms hover/press, standard 180 ms menu/fade, large 240 ms overlay; easing `cubic-bezier(.2,.8,.2,1)`.
- Distant TOC jump does not use long smooth scroll. A brief nonessential orientation highlight may follow stabilization.
- Under `prefers-reduced-motion`, transforms/smooth scroll/insertion movement are removed and opacity transitions shortened.
- Virtualizer stabilization cannot be disguised by animation; sustained jumps are technical defects.

## Theme behavior

- First value `system`; preference `system/light/dark` persists globally.
- Pre-paint mirror prevents wrong-theme flash; IndexedDB remains canonical per `codex-spec/architecture/data-and-state.md`.
- Theme change causes controlled virtual measurements and preserves semantic anchor.
- Syntax colors, focus, selection, blockquote, inline/fenced code and warnings are validated separately in both themes and forced colors.
- Remote images are never inverted.

## Accessibility contract

- Target WCAG 2.2 AA.
- Skip link is first focusable element. Library: header → main. Reader: header/toolbar → TOC nav → main/article.
- Only one `main`; named `nav`; article accessible name comes from Document title without inventing visible author H1.
- Overlays have title/description, correct modal behavior, focus trap when modal, scroll lock and deterministic return.
- Route completion moves focus to screen heading/reader restore status. Pointer TOC selection does not force heading focus; keyboard activation does.
- Virtual window may not unmount focused content. Controller pins/overscans focused element or moves focus to stable reader marker before window change.
- Live announcements: import stage/result, mode switch, approximate restore once, copy result, online/update changes. Never announce scroll percentage continuously.
- 44×44 project minimum for touch controls, 8 px between adjacent icon controls. Inline prose links remain text links with sufficient line height/focus.
- 200% and 400% zoom/reflow, custom text spacing, reduced motion and forced colors are manual gates.

## Icons and copy

- Icon-only allowed only for frequent toolbar controls with `aria-label`; destructive/rare actions require visible text in menus/dialogs.
- Russian strings live in a catalog/module separate from domain codes. Avoid ambiguous «Да/Нет»: use «Заменить документ», «Добавить отдельно», «Удалить документ».
- Error copy: что произошло → что осталось безопасным → что сделать. Do not blame user or lead with internal code.
- Do not show search field, cloud/sync language or fake success for a staging operation.

## Visual prohibitions

- No generic dashboard cards, cover-grid placeholders, gradients/illustrative hero in MVP.
- No page-level horizontal scroll from code/table/image/title.
- No multiple accent colors, raw hex in feature CSS, arbitrary spacing/radius/z-index.
- No Tailwind typography plugin as source of reader semantics unless separately reviewed; `.reader-content` is canonical.
- No overlay nested inside another overlay for O-01→O-02; replace state inside one controlled flow.

## Compatibility note

Tailwind 4 officially targets Safari 16.4+, Chrome 111+ and Firefox 128+ ([upgrade guide](https://tailwindcss.com/docs/upgrade-guide)). Supporting older browsers would require an explicit decision to change styling baseline, not silent degradation.
