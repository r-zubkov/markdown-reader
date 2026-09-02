# F06. PWA, storage, themes and platform states

## User value

Read already imported documents offline, understand browser-storage risk, apply app updates safely and use a consistent accessible light/dark interface on desktop/mobile. Related: PRD-015–017, TECH-014–015, UX-005–008, NFR-004–009.

## Scope / non-goals

PWA manifest/app-shell precache, prompt update, online/media status, storage estimate/persist UX, stale pipeline/update handshake, theme bootstrap/preferences, remote-image preference and responsive/platform status surfaces. It implements UX-005, UX-006, UX-007 and UX-008 where platform state changes the interface.

Non-goals: background sync, caching remote document images, offline first visit, cross-device sync, guaranteed browser retention, custom service worker, install-prompt growth campaign.

## PWA/offline

- Use `vite-plugin-pwa` `generateSW` and prompt registration. Precache only build/app-shell assets/fonts/icons required for UI.
- IndexedDB remains document store; Cache Storage never duplicates source/chunks.
- Offline navigation to cached `/`/reader SPA shell resolves client routes; ready Document opens from IDB.
- Remote image failure becomes in-flow placeholder. A global offline info state appears only when relevant and never calls local reading an error.
- First visit with no cached shell is unsupported/browser-level failure.

## Update lifecycle

1. `needRefresh` produces persistent banner with Update/Later.
2. Update action checks active import/finalization and schema/protocol safety; while active it is disabled/explained.
3. User-triggered update flushes ReaderState, invokes SW update/reload once.
4. New bundle detects abandoned staging/stale pipeline and follows recovery rules.
5. Failure keeps current app running and offers retry later; no reload loop.

The PWA hook/options use stable callbacks because current plugin docs warn options are captured from first render.

## Storage health

`StorageHealthService` wraps `navigator.storage.estimate/persist/persisted` with capability checks and normalized states:

```ts
type StorageHealth =
  | { status: 'unknown' }
  | { status: 'healthy'; persisted?: boolean; usage?: number; quota?: number }
  | { status: 'risk'; reason: 'not-persisted' | 'near-quota'; usage?: number; quota?: number }
  | { status: 'unavailable'; reason: 'indexeddb' | 'storage-api' };
```

Near-quota threshold must be measured/centralized; estimate is advisory. Request persistence only after user context/success; denial does not block. UI says retain source `.md`; no promise that persistence prevents every eviction. Quota during import is handled by F01 transaction path.

## Theme and remote-resource preferences

- IndexedDB `AppPreferences` source; minimal localStorage theme mirror only for pre-paint.
- Default theme `system`; change instant and triggers anchor-preserving remeasure.
- `remoteImagesEnabled=true` initial assumption, exposed in global menu with clear text «Загружать изображения из интернета».
- When false/offline, sanitized `<img>` content is represented/handled as nonrequesting placeholder; toggling on may retry currently visible HTTPS images. Relative local images always unsupported.
- No third-party font/analytics/network request. CSP and actual requests are audited.

## Global status priority

One persistent banner: fatal storage > actionable storage risk > update > offline. Transient success can toast. Banner insertion must preserve Reader anchor/layout. Dismiss/Later is remembered only for the current event/version, not forever across changed risk.

## Responsive/a11y/platform

Use token/breakpoint rules from `codex-spec/design/ui-design-system.md`; Sheet/Dialogs respect `dvh`, safe area, focus return and mobile address bar. Theme initializes before paint. Banner/toast respects safe areas. Status announcements are deduplicated and do not move focus.

## Edge cases

SW update appears during import; plugin callback uses stale state; offline while image loading; online flaps; storage APIs absent/reject/return undefined quota; private mode IndexedDB unavailable; theme mirror corrupt; OS theme changes under `system`; old tab/new DB schema; multiple tabs update; install at nested path/scope.

## Acceptance criteria

- [ ] After one successful online load, production build launches offline and opens a ready local Document.
- [ ] No document bytes/chunks are stored in Cache Storage or requested from network.
- [ ] Update is user-triggered, blocked during active import and does not loop/lose ReaderState.
- [ ] Storage capability/denial/quota states have honest copy and never auto-delete data.
- [ ] Light/dark/system applies before first paint without visible wrong-theme flash and survives reload.
- [ ] Remote-image off/offline produces no third-party request; on permits only policy-approved HTTPS/data resources.
- [ ] Global status priority and Reader anchor compensation are deterministic.
- [ ] Automated browser matrix plus physical iPhone PWA/Sheet smoke passes.

## Required tests

Preference/storage adapter unit tests; no-flash bootstrap test; SW update controller component tests; production-build Playwright offline/update; network request allowlist assertions; Cache Storage inspection; responsive/two-theme visual and axe checks; physical iPhone install/background/foreground/offline checklist.

## Dependencies

F00 mobile/platform, F01 active job/storage errors, F03/F04 anchor flush/remeasure. Tasks P05-T01/T02/T03/T04.
