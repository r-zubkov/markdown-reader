# P00-T06 mobile UI and platform primitive spike

Status: **complete for the DEC-022 Chromium-only MVP matrix**.

Measured on 2026-09-10 in the Windows Codex sandbox with Node 24.20.0, Playwright 1.62.1 and its local Chromium 151.0.7922.34 binary. The browser binary is a local Playwright test asset and is not committed. Chrome/Chromium desktop plus responsive mobile-Chromium emulation are supported; Firefox, Safari/WebKit, iOS and physical-device address-bar behavior are not release claims under DEC-022.

## Selected base and dependencies

`shadcn@4.21.0` initialized the pinned `components.json` as `aria-nova` with the `nova` preset, React Aria base and the repository alias `@/ui/primitives`. The CLI-generated component source was reviewed and kept locally. Its Windows alias writer emitted a literal `@` directory rather than resolving the TypeScript alias, so the four generated files were moved once into the configured source directory; this is a CLI/environment limitation, not a runtime fallback.

| Responsibility | Selected package/version | License | Result |
|---|---|---|---|
| Accessible modal, Sheet and radio state | `react-aria-components@1.21.1` | Apache-2.0 | Accepted. Dialog/Sheet preserve modal/focus behavior in the harness. |
| Locally versioned component source | `shadcn@4.21.0`, `aria-nova`/`nova` | MIT | Accepted. Button, Dialog, Sheet and RadioGroup source live in `src/ui/primitives`. |
| Utility icons | `lucide-react@1.43.0` | ISC | Accepted for file status symbols. |
| Shell tokens/utilities | `tailwindcss@4.3.3`, `@tailwindcss/vite@4.3.3` | MIT | Accepted. Semantic token layer and `dvh`/safe-area styles compile in the production build. |
| PWA skeleton | `vite-plugin-pwa@1.3.0` | MIT | Accepted for `generateSW` and prompt registration configuration. The production build generated `sw.js`, Workbox runtime, manifest and five precache entries. |
| Browser a11y assertion | `@axe-core/playwright@4.13.0` | MPL-2.0 | Accepted for the mobile overlay harness only. |

The installed React Aria Components release does not export `FileTrigger` or `DropZone`. The selected local fallback is `FileDropField`: a semantic native file input plus drag/drop wrapper in `src/ui/primitives`, with one-file selection, an accept filter and an accessible status. It contains no import business logic and is intentionally reusable by P02-T02. This fallback was chosen under the task's failed-primitive rule and must be reconsidered only if the selected React Aria base exposes a supported equivalent in a later dependency review.

## Harness and passing scenarios

Route: `/spikes/mobile-platform`.

- Dialog is one controlled React Aria overlay with idle, running, decision and error content. Running blocks Escape and outside dismissal; decision content replaces the body without opening a nested modal and moves focus to its new heading.
- The bottom Sheet uses `100dvh`, safe-area padding, a local scroll region and a sticky footer. It contains a deliberately long outline and restores focus to its trigger on dismissal.
- The RadioGroup uses the current `RadioField` plus `RadioButton` API, exposes a description and reports applying, success and error states without a fake percentage.
- `FileDropField` exercises a long Russian-locale label, native file input and a drag target; the file name is shown only after local selection.
- The PWA build supplies a prompt-registration skeleton and an update-status surface. P05-T02 remains responsible for active-import gating, one-time reload and production offline/update lifecycle tests.

## Results

| Check | 320 x 640 portrait | 844 x 390 landscape |
|---|---|---|
| Dialog dynamic replacement | Pass: Escape kept the running overlay open; decision heading received focus; one dialog existed. | Not separately repeated; same Chromium implementation. |
| Sheet footer/return focus | Pass: footer action visible; dismissal returned focus to the opening control. | Pass: footer action visible with no clipped action. |
| Page horizontal overflow | Pass. | Pass. |
| Theme/focus token smoke | Covered by component/harness styles. | Pass: dark token state changed while controls remained usable. |
| axe scan of harness | Pass: zero violations. | Covered by the same supported Chromium harness. |

The two Playwright tests passed on the supported Chromium matrix. RTL component tests passed for dialog focus retention and native file/radio state behavior. The production build passed and emitted the expected PWA assets; Cache Storage policy, offline reload and real update prompt behavior are intentionally deferred to P05-T02.

## Limits and follow-up

- Responsive emulation cannot reproduce a physical mobile browser's collapsing address bar, virtual keyboard, install surface or background/foreground OS lifecycle. `dvh`, safe-area and scroll-lock paths are covered in Chromium emulation; P05-T02/P05-T04 retain the production/manual device checks.
- The PWA skeleton precaches only generated application assets. It does not persist document data in Cache Storage and does not add remote-image caching.
- The harness is a diagnostic route, not the P02 import controller or final visual system. P01-T01, P02-T02, P05-T01 and P05-T02 must compose these primitives under their own contracts.

## Verification record

- `tsc -b` passed.
- `eslint .` passed.
- `vitest run src/features/mobile-platform-spike/MobilePlatformSpike.test.tsx` passed: 2 tests.
- `vitest run` passed: 7 files, 53 tests.
- `vitest run --config vitest.security.config.ts --passWithNoTests` passed: 3 tests.
- `vitest run --config vitest.bench.config.ts --passWithNoTests` passed: 4 tests.
- `vite build` passed: PWA `generateSW`, 5 precache entries, `sw.js` and Workbox runtime emitted.
- Separately started Vite (recorded PID 41860), then `playwright test e2e/mobile-platform-spike.spec.ts --project=chromium` passed: 2 tests. Only that recorded process was stopped afterwards.
- Separately started Vite (recorded PID 18400), then `playwright test --project=chromium` passed: 9 tests. Only that recorded process was stopped afterwards.

P00-T06 closes the final P00 spike and unblocks P01-T01, P02-T02, P05-T01 and P05-T02.
