# P05-T03 Storage health, privacy and global statuses

## Outcome

Storage estimate/persistence/quota/recovery UX, remote-image preference and deterministic global status priority are integrated without data deletion, privacy surprises or Reader jumps.

## Why now

PWA/global shell and import/storage errors now exist; one platform layer can normalize them before release hardening.

## Read before starting

`AGENTS.md`; `codex-spec/features/pwa-storage-platform.md` storage/preferences/status; `codex-spec/design/screens-and-user-flows.md` G-01/L-01; `codex-spec/architecture/data-and-state.md` quota/preferences; `codex-spec/architecture/system-architecture.md` security policy.

## Related requirements

PRD-017, NFR-004, NFR-007–008, UX-006/008; DEC-016.

## Preconditions

P05-T02, P02-T02 and P01-T02 complete. Dependencies: P05-T02, P02-T02, P01-T02.

## Scope

- Implement capability-safe StorageHealthService and normalized states.
- Request persistence only with user context; expose denial/unknown/near-quota without false guarantees.
- Integrate import quota/stale/corrupt recovery copy and no-clear-first policy.
- Implement persisted global remote-images preference, render/network enforcement and retry/placeholder behavior.
- Implement one-banner priority/dismiss event semantics and Reader anchor compensation; deduplicate live updates.

## Non-goals

No backup/export, guaranteed quota threshold unsupported by evidence, automatic cleanup, remote cache or telemetry.

## Expected files

Platform storage/privacy adapters, preference/UI/menu/status/banner components/strings, network/recovery tests.

## Implementation notes

`estimate()` advisory and may omit values. Near-quota threshold centralized from evidence. Preference default follows ASM-004 unless explicitly changed/recorded. Disabling remote images must prevent request, not merely hide loaded element.

## UI and states

Healthy hidden, unknown, not-persisted risk, near-quota, unavailable/fatal; offline/update priority; remote on/off/offline/error. Banner actions stack on mobile and never auto-focus.

## Edge cases

APIs absent/reject, quota undefined/zero, denial then later grant, online flaps, remote image already visible, data image vs HTTPS, banner appears above current Reader anchor, corrupt preference.

## Acceptance criteria

- [ ] Capability/denial/quota states are accurate/actionable and never auto-delete/clear.
- [ ] Existing ready data survives quota/recovery paths; user is told to retain source file.
- [ ] Remote off/offline makes zero third-party requests; on allows only content policy.
- [ ] Status priority/dismiss/live behavior is deterministic and banner does not shift semantic anchor beyond tolerance.
- [ ] Mobile/keyboard/a11y states pass.

## Required tests

Storage adapter unit matrix, import quota integration, status priority/component/axe, network allowlist E2E, Reader banner-anchor E2E, preference reload.

## Verification

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:security`, `pnpm test:e2e:all`, `pnpm build`; inspect controlled network requests.

## Completion report

List normalized states/threshold/default/privacy behavior, files, commands/evidence, browser API limitations and backup risk.
