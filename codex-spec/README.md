# Codex Specification

This directory is the execution source of truth for phased Markdown Reader development. The root `README.md` describes the product for humans; this directory contains requirements, engineering decisions, UX contracts, the roadmap and atomic coding-agent tasks.

## Documentation Language

All files under `codex-spec/` must be written in English only. Do not add non-English prose, headings, prompts, acceptance text or literal UI-label examples here. The product still targets a Russian UI locale where specified; describe that requirement in English and keep exact UI strings in source catalogs or tests when they are needed.

## Canonical Documents

| Document | Canonical for |
|---|---|
| [project-source-of-truth.md](project-source-of-truth.md) | Problems, users, MVP, post-MVP and non-goals |
| [requirements-and-decisions.md](requirements-and-decisions.md) | Requirement IDs, conflicts, decisions, assumptions and traceability |
| [architecture/system-architecture.md](architecture/system-architecture.md) | Modules, dependencies, runtime flows, integrations and trust boundaries |
| [architecture/data-and-state.md](architecture/data-and-state.md) | Entities, IndexedDB, state ownership, serialization and migrations |
| [design/ui-design-system.md](design/ui-design-system.md) | UI stack, tokens, components, themes, responsive behavior and accessibility rules |
| [design/screens-and-user-flows.md](design/screens-and-user-flows.md) | Screens, overlays, states, transitions and screen acceptance |
| [features/](features/) | Functional contracts, edge cases and feature-level tests |
| [testing-and-quality.md](testing-and-quality.md) | Testing strategy, corpus, commands and Definition of Done |
| [implementation-roadmap.md](implementation-roadmap.md) | Phases, dependencies, gates and the product available after each phase |
| [implementation-status.md](implementation-status.md) | Current persistent task-execution status |
| [tasks/](tasks/) | Atomic executable Codex tasks |
| [execution-playbook.md](execution-playbook.md) | Rules for starting and resuming task sessions |
| [final-acceptance-checklist.md](final-acceptance-checklist.md) | Final MVP acceptance |

## Feature Specifications

- `F00` - [risk-spikes.md](features/risk-spikes.md): mandatory technical PoCs;
- `F01` - [import-and-library.md](features/import-and-library.md): import and library;
- `F02` - [markdown-pipeline.md](features/markdown-pipeline.md): parsing, chunking, sanitize and highlight;
- `F03` - [continuous-reader.md](features/continuous-reader.md): bounded continuous reader;
- `F04` - [sections-toc-progress.md](features/sections-toc-progress.md): sections, TOC and semantic position;
- `F05` - [document-lifecycle.md](features/document-lifecycle.md): duplicate, replace and delete;
- `F06` - [pwa-storage-platform.md](features/pwa-storage-platform.md): PWA, storage health, themes and platform states.

## Reading Order

1. Always start with the root [AGENTS.md](../AGENTS.md).
2. On first entry into the project, read `project-source-of-truth.md`, `requirements-and-decisions.md`, `architecture/system-architecture.md` and `implementation-roadmap.md`.
3. Select the next unblocked task and read only the documents listed in its `Read before starting` section.
4. Before changes, compare the specification with the real `package.json`, lockfile, code, git diff and completed-task results.
5. Complete one task, pass its verification and provide the completion report.

The completed tasks are [P00-T01-project-bootstrap.md](tasks/P00-T01-project-bootstrap.md), [P00-T02-content-pipeline-spike.md](tasks/P00-T02-content-pipeline-spike.md), [P00-T03-storage-atomicity-spike.md](tasks/P00-T03-storage-atomicity-spike.md), [P00-T04-virtual-reader-spike.md](tasks/P00-T04-virtual-reader-spike.md), [P00-T05-progress-mapping-spike.md](tasks/P00-T05-progress-mapping-spike.md) and [P00-T06-mobile-ui-platform-spike.md](tasks/P00-T06-mobile-ui-platform-spike.md). The next recommended unblocked task is [P01-T01-app-shell.md](tasks/P01-T01-app-shell.md).

## Naming

Ordinary documents use meaningful names without ordered prefixes: this navigator and the roadmap define order. Feature IDs stay inside feature specs and traceability. Task IDs such as `P03-T04` stay in filenames because they are stable keys for dependency, report and phase gate tracking; the textual part of a filename remains human-readable.

## Status

Specification set: `COMPLETE - QA PASSED`. Implementation: `P00 COMPLETE - P01 WALKING SKELETON NEXT`. Completed task IDs: `P00-T01`, `P00-T02`, `P00-T03`, `P00-T04`, `P00-T05`, `P00-T06`. Pipeline/storage/reader/mapping and mobile-platform proposals remain subject to their required production/browser reruns.
