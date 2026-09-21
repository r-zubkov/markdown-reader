# Storage health policy

`StorageManager.estimate()` is advisory. The P05-T03 UI uses the centralized `0.90` usage/quota ratio only as an early warning; it never blocks a read, deletes data, or promises that a successful persistence request prevents eviction.

The browser may omit either estimate, reject storage APIs, or deny `persist()`. Those outcomes remain distinct from IndexedDB data errors. `persist()` is called only after the user chooses the banner action. Users are told to retain their original Markdown files because the MVP has no backup or automatic recovery after browser eviction.

The Chromium P05-T03 unit matrix covers omitted APIs, denied persistence, undefined estimates, and the quota threshold. Browser E2E covers persisted remote-media privacy preference and zero third-party image requests while the preference is disabled.
