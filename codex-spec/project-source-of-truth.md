# Project Source of Truth

## Problem and Value

Markdown files are inconvenient to read for long periods inside an editor, while directly rendering a large document into one HTML tree creates a heavy DOM and does not preserve reading context. The product imports a local UTF-8 `.md`, safely converts it into a formatted document, stores it in the browser and returns the user to the last meaningful location, without a backend or sending content to a server.

## User and Context

One role: the owner of a local Markdown-document library in the current browser profile/origin. Desktop and mobile have equal priority. Any valid Markdown file is supported within confirmed limits; the important stress case is a large technical document with code, tables, long lists, links, footnotes and uneven heading structure.

## Canonical MVP Scenarios

1. Open the library, choose exactly one `.md`, see honest processing stages and cancel before commit.
2. After successful atomic finalization, see the document at the top of the list and open it.
3. Read the whole document as CommonMark + GFM with safely recognized code highlighting.
4. Navigate through the full-document `H1-H3` table of contents in continuous or sections mode.
5. Switch mode/strategy while staying at the same semantic anchor.
6. Close/reload and continue from an exact position or a clearly marked approximate position.
7. Avoid creating an exact duplicate; for a similar changed file, choose replace, separate or cancel.
8. Delete a document only after confirmation.
9. After the first online visit, launch the app shell offline and read already saved documents.

## MVP Boundary

- Browser-only SPA/PWA, statically served over HTTPS.
- React UI; pure TypeScript domain/pipeline modules; Web Worker for heavy processing.
- Local IndexedDB library, source Blob, versioned derived chunks and reader state.
- Continuous virtual reader and sections reader.
- Split strategies: `auto`, `h1`, `h2`, `h3`, `whole`; internal safe chunks always operate.
- Auto initial mode: a document with low measured render cost uses continuous, a document with high measured cost uses sections; the threshold is defined by PoC and applies only before explicit user choice.
- Semantic progress, full-document TOC, duplicate/update/delete and storage/recovery states.
- Light, dark and system theme preference; Russian UI locale; WCAG 2.2 AA baseline.
- HTTPS remote images according to privacy policy; relative local resources are not imported.

## Key Product Rules

- No mode truncates or loses content. Paragraph/list/table/quote/code block content is not split in the middle; a huge indivisible node gets a safe fallback.
- `whole` is one logical navigation section, not a way to disable chunking/virtualization.
- Split strategy defines sections layout. In continuous mode it is saved as the setting for a future switch and does not change the single-stream visual model.
- Normal open restores the saved anchor; an explicit URL hash heading has priority once and then becomes the new current position.
- Exact duplicate is determined by SHA-256 of the source bytes. Filename/title are only a possible-update heuristic; the user has the final decision.
- Replace keeps `documentId`, keeps the old ready version until commit and tries to map progress: exact -> approximate -> start with notice.
- Title: first `H1`, otherwise filename without extension. Repeated headings get deterministic unique IDs.
- Library starts at `/`, sorts by last activity and uses `documentId` as the stable tie-breaker.
- Successful import remains in the library and offers an Open Document action; this is reversible UX assumption `ASM-002`.
- Raw HTML is shown as inert escaped content; it is never executed.

## After MVP

Priority: backup/export + restore -> full-document search -> typography controls -> bookmarks -> notes/collections -> local asset packages -> optional sync. Each capability requires its own schema/feature spec.

## Explicitly Excluded

Backend, accounts, cloud sync, cross-device transfer, server analytics, search in MVP, editing/authoring, MDX, executable HTML, Mermaid/LaTeX/plugins, folders/archives, linked local images, notes/bookmarks/tags, SSR/RSC, desktop shell, AI and store/catalog.

## Constraints

- Storage is origin-scoped, with quota/eviction controlled by the browser; the user must retain the original file. MVP does not promise backup.
- Maximum file size, chunk cost, DOM window, overscan, supported highlight grammars and anchor tolerance are fixed only after PoC.
- Tailwind CSS 4 sets the technical browser floor at Safari 16.4+, Chrome 111+ and Firefox 128+; the release target is current stable desktop Chromium/Firefox/Safari and mobile Safari/Chrome while respecting that floor.
- First visit without network is not supported. After successful installation, the app shell works offline.

## Glossary

| Term | Canonical meaning |
|---|---|
| Document | Stable user-facing record of an imported Markdown file |
| Document version | One import of a document's source bytes and derived data |
| Source blob | Original `.md` bytes sufficient for rebuild |
| Chunk | Internal safe render unit between top-level AST nodes |
| Section | User-facing navigation part of the layout; contains one or more chunks |
| Outline | `H1-H3` hierarchy for the whole version |
| Reading mode | `continuous` or `sections` |
| Split strategy | `auto`, `h1`, `h2`, `h3`, `whole` |
| Semantic anchor | Heading path plus block location and ratios used to restore position |
| Ready version | The only published current version of a document |
| Staging version | Incomplete import, invisible as a document until commit |
| Pipeline version | Version of the parse/sanitize/highlight/serialization algorithm |
| Exact restore | Restoring the same semantic block with high confidence |
| Approximate restore | Fallback by heading/overall ratio with a visible notice |
