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

The deployment CSP must preserve the architecture target: `default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self'; img-src 'self' data: https:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; connect-src 'self'`. HTTPS remote images are the only allowed third-party content requests and remain subject to the application preference/policy.
