# Codex Standing Rules

## Goal

Develop a local browser-only Markdown file reader as a safe, responsive, accessible, production-oriented MVP. The code must preserve all document content, data locality and semantic reading position.

## Before Any Task

1. Read this file, the concrete task file from `codex-spec/tasks/` and its `Read before starting` section.
2. Inspect the real repository structure, `package.json`, lockfile, current git diff and already completed task IDs.
3. Do not repeat completed work and do not overwrite user changes.
4. If code and specification differ substantially, stop and describe the mismatch; do not make a silent choice.

Priority: latest explicit user instruction -> safety/integrity -> `codex-spec/requirements-and-decisions.md` -> task -> feature spec -> architecture/design/data docs -> working assumption.

All paths in specifications are relative to the repository root.

## Documentation Language

`AGENTS.md` and every file under `codex-spec/` are execution documents and must be written in English only. Do not add non-English prose, headings, prompts, acceptance text or literal UI-label examples to these files. The product UI may still require a Russian locale; express that requirement in English and keep exact Russian UI copy in source string catalogs or tests when exact strings are needed.

## Specification Map

- Navigator and execution order: `codex-spec/README.md`.
- Product and MVP boundaries: `codex-spec/project-source-of-truth.md`.
- Requirements, decisions and traceability: `codex-spec/requirements-and-decisions.md`.
- Architecture and data: `codex-spec/architecture/`.
- UI system, screens and flows: `codex-spec/design/`.
- Functional contracts: `codex-spec/features/`.
- Atomic tasks: `codex-spec/tasks/`.
- Phase order: `codex-spec/implementation-roadmap.md`.
- Quality and final acceptance: `codex-spec/testing-and-quality.md` and `codex-spec/final-acceptance-checklist.md`.

The root `README.md` is for humans: it briefly explains the product, actual status and real run commands. Do not turn it into a duplicate of the specifications. All execution documents except this file must remain inside `codex-spec/`.

## Architectural Boundaries

- `domain` is pure TypeScript; it does not import React, DOM, Dexie, router or PWA APIs.
- `infrastructure` implements repository/platform ports; UI does not access IndexedDB or service worker directly.
- `workers` do not import React/UI and communicate through a versioned discriminated-union protocol.
- `features/*` orchestrate use cases and UI; business rules do not live in visual components.
- React state/Context must not store the full source, AST, all chunks or the whole document. IndexedDB is the source of truth for persistent data.
- `SafeHtmlChunk` is the only `dangerouslySetInnerHTML` boundary. It accepts only `SanitizedHtml` returned by repository after `pipelineVersion` validation.
- User-visible split strategy does not disable internal chunking. `whole` means one logical section, not a giant DOM.
- Import/replace always use staging plus atomic commit. An error cannot publish a partial document or damage the current ready version.

Do not add unrequested backend, auth, sync, content telemetry, SSR/RSC, MDX, raw executable HTML, Redux/Zustand/TanStack Query, a custom parser/sanitizer/IndexedDB wrapper or broad refactoring.

## Stack and Dependencies

- React 19.2 with the current compatible security patch, TypeScript strict, Vite 8.1, React Router 8 Declarative Mode, Node `>=22.22`.
- Dexie 4, unified/remark/rehype pipeline, lowlight, Web Worker, TanStack Virtual v3, `vite-plugin-pwa` `generateSW`.
- UI: shadcn/ui with React Aria base, Tailwind CSS 4 for the shell, CSS custom properties and namespaced `.reader-content` CSS; Lucide React.
- `pnpm` and lockfile are the working assumption fixed by the bootstrap task.
- A new dependency needs a concrete responsibility, license/compatibility check and completion-report entry. Do not change the stack because of personal preference.
- Use stable releases and pin resolved versions in the lockfile. Do not invent patch versions: during bootstrap, verify peer/minimum requirements against official documentation.

## TypeScript and Contracts

- `strict` is enabled; avoid `any`, non-null assertions and unchecked casts at trust boundaries.
- External data and persisted records are validated before use. Domain errors are discriminated unions with stable codes; UI maps codes to Russian microcopy.
- IDs use `crypto.randomUUID()`. Times are UTC epoch milliseconds. Ratios are clamped to `[0,1]`.
- Derived state is computed from the canonical source; do not create a second source of truth for progress, mode or current version.
- Changing IndexedDB schema, worker protocol, sanitizer contract or public port interface requires updating the corresponding spec/decision, migration test and compatibility.
- Changing the Markdown/sanitize/highlight pipeline requires a `PIPELINE_VERSION` bump and verified rebuild from `sourceBlob`.

## React, UI and Styles

- Pages compose feature components; reusable primitives live in `src/ui/primitives`.
- Do not reinstall a shadcn component over a locally changed version without diff review. Do not mix Radix/Base UI/React Aria implementations without a `DEC`.
- Feature code uses semantic tokens, not raw hex. Tailwind must not control the internal markup of sanitized Markdown.
- `.reader-content` is isolated by namespace/layer; code/table/image must not create page-level horizontal overflow.
- Light/dark/system, keyboard, focus return, 320 px reflow, reduced motion and 44x44 touch targets are mandatory for affected UI.
- Links are for navigation; buttons are for actions. Do not create an interactive container with nested controls.
- All loading/empty/error/offline/disabled states come from the screen/feature spec; do not replace an actionable error with a single toast.

## Security and Privacy

- File, Markdown, raw HTML, URL, language label and persisted bytes are untrusted.
- Raw HTML is not executed. Sanitizer is the runtime boundary; a TypeScript brand is not protection.
- Block event handlers, inline style, executable/embed tags, DOM-clobbering IDs and unsafe protocols. External image policy and CSP must match.
- Document content is not sent to the network or logged. Remote HTTPS images are the only allowed third-party content request and are controlled by preference/policy.
- Do not add secrets. User-visible diagnostics do not include document text.

## Verification and Completion

After a change, run task-file checks and the relevant regression suite. Baseline gate after bootstrap: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; E2E/a11y/performance when the task requires them.

For Playwright in the Windows/Codex sandbox, the following operational rule applies:

- if the test itself passes but managed `webServer` hangs during teardown, treat it as a sandbox limitation until reproduced in a normal terminal;
- do not change `playwright.config.ts` or normal Playwright/CI behavior only to work around the sandbox;
- for verification, start Vite separately, use `reuseExistingServer`, record the exact Vite PID and stop only that PID after the test;
- never terminate all `node.exe` processes; before termination, verify the exact PID belongs to the Vite process you started;
- change the normal Playwright/CI flow only if the same problem reproduces outside Codex.

A task is not complete if a required check fails, an acceptance criterion is not proven or a hidden blocker remains. The completion report lists:

- changed files and actual outcome;
- commands run with results;
- acceptance criteria;
- deviations from the specification and reasons;
- residual risks/next task.

Update task status or roadmap only with confirmed facts. Do not mark a phase gate green after only one compilation. If public behavior, architectural contract, schema or confirmed commands change, update the corresponding file in `codex-spec/` at the same time; update the root README only with facts useful to a user or developer during ordinary project orientation.
