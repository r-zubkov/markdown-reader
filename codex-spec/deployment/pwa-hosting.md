# PWA hosting contract

The production output is a static SPA/PWA and must be served from one stable HTTPS origin. Localhost preview is the only HTTP exception used for development and browser tests.

## Routing and scope

- Rewrite extensionless navigation requests, including `/documents/:documentId`, to the deployed `index.html`.
- Do not rewrite requests for missing files with extensions; they must remain ordinary asset failures.
- Keep the manifest, service worker and application assets under the same deployment base path. The manifest uses relative `id`, `scope` and `start_url` values so a Vite build with `--base=/subpath/` stays inside that subpath.
- A first visit without a network connection is unsupported. After an online production load and service-worker installation, cached shell navigation is supported offline.

## Cache headers

- Serve `sw.js`, `index.html` and `manifest.webmanifest` with revalidation (`Cache-Control: no-cache` or an equivalent policy). Do not give `sw.js` an immutable lifetime.
- Serve hashed files under `assets/` with a long immutable lifetime.
- Icons may use normal revalidation. The generated service worker precaches them with the shell.
- Do not add CDN or service-worker runtime caching for Markdown sources, document routes or remote images. Document sources, derived chunks and ReaderState belong only in IndexedDB.

## Security headers

The production artifact includes `public/_headers`, copied to `dist/_headers`, for static hosts that implement the `_headers` convention. A host with a different configuration format must translate these directives without weakening them:

- CSP: `default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self' 'sha256-38RhXrc7EdReTKsOm23ZPOCUgniTUUcjky8QOOrQx6o='; style-src-attr 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; manifest-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`.
- `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and the checked-in restrictive `Permissions-Policy` are required on application responses.

The single style hash admits React Aria's fixed pressability rule. `style-src-attr 'unsafe-inline'` is limited to style attributes needed by trusted theme/virtualizer code; document HTML is separately sanitized and rejected at repository read if it contains a style attribute. Inline scripts and `unsafe-eval` remain forbidden. The pre-paint theme bootstrap is a same-origin external script. HTTPS remote images are the only allowed third-party content requests and remain subject to the application preference/policy.
