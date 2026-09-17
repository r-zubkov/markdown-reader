# P04-T03 Reader recovery and accessibility record

## Automated evidence

- Reader recovery and partial-chunk behavior are covered by Vitest component and cache tests.
- Reader, TOC, import and delete Chromium coverage includes keyboard activation, focus return, 320 px reflow and axe checks in their respective scenarios.
- Full Chromium coverage is run with one worker in the Windows/Codex environment to avoid the known resize-measurement parallel-load flake.

## Manual Chromium checklist

Run this checklist at 200% zoom and at 320 CSS px after importing a document with headings, a table, code, a remote image and a long section:

1. Use Tab from the skip link through the Reader toolbar, TOC, settings, article links and pager. Confirm every target has a visible focus indicator and controls remain at least 44 px high.
2. Open the mobile TOC with the keyboard, select a heading, and confirm focus reaches the heading after the Sheet closes. Confirm pointer activation does not steal article focus.
3. Focus an interactive item in a continuous virtual chunk, scroll enough to change the window, and confirm the focused item stays mounted or focus moves to the stable Reader target.
4. Force a missing route, stale derived-data state and one corrupt chunk. Confirm the state heading receives route focus, diagnostics contain only a stable code, and Retry, Library and Add actions remain available as applicable.
5. With a screen reader enabled, confirm restore, reprocessing and local range-loading status changes are announced once; scrolling and progress changes must not be announced.

## Screen-reader preparation and remaining gap

The component structure uses landmark, heading, status, dialog and native-link/button semantics for the flows above. NVDA with current Chrome and VoiceOver on macOS/iOS require manual assistive-technology execution outside the Windows/Codex sandbox; this remains a P05 release-audit item. No document text, stack trace or persisted record is exposed in recovery diagnostics.
