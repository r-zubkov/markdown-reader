import { expect, test, type Page } from "@playwright/test";

const sourceMarker = "PWA_LOCAL_DOCUMENT_MARKER_2026";
const deploymentCsp = "default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self' 'sha256-38RhXrc7EdReTKsOm23ZPOCUgniTUUcjky8QOOrQx6o='; style-src-attr 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; manifest-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

test.describe("P05-T02 production PWA", () => {
  test("precache contains only app assets and a ready IndexedDB document reopens offline", async ({ context, page }) => {
    test.setTimeout(60_000);
    await page.goto("/");
    await importDocument(page);
    const readerPath = await page.locator(".library-list__link").getAttribute("href");
    if (readerPath === null) throw new Error("Expected the imported document route.");

    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    await page.goto(readerPath);
    await expect(page.getByText(sourceMarker)).toBeVisible();

    const onlineStorage = await inspectLocalStorageBoundaries(page, sourceMarker);
    expect(onlineStorage.cacheNames.length).toBeGreaterThan(0);
    expect(onlineStorage.cachedUrls.some((url) => new URL(url).pathname.endsWith("/index.html"))).toBe(true);
    expect(onlineStorage.cachedUrls.every(isAppAssetUrl)).toBe(true);
    expect(onlineStorage.cacheContainsDocumentMarker).toBe(false);
    expect(onlineStorage.indexedDbChunkCount).toBeGreaterThan(0);

    await context.setOffline(true);
    // Storage risk has higher global-banner priority than offline; local reading remains available either way.
    await expect(page.getByTestId("platform-status")).toHaveAttribute("data-platform-status", /^(storage-not-persisted|offline)$/u);
    await page.reload();
    await expect(page.getByText(sourceMarker)).toBeVisible();

    await page.goto(readerPath);
    await expect(page.getByText(sourceMarker)).toBeVisible();
    const offlineStorage = await inspectLocalStorageBoundaries(page, sourceMarker);
    expect(offlineStorage.cacheContainsDocumentMarker).toBe(false);
    expect(offlineStorage.indexedDbChunkCount).toBeGreaterThan(0);
  });

  test("loads the production worker and Reader under the deployment CSP", async ({ page }) => {
    const policyErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && /content security policy/iu.test(message.text())) {
        policyErrors.push(message.text());
      }
    });
    await page.route("**/*", async (route) => {
      if (route.request().resourceType() !== "document") {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: {
          ...response.headers(),
          "content-security-policy": deploymentCsp,
        },
      });
    });

    const response = await page.goto("/");
    expect(response?.headers()["content-security-policy"]).toBe(deploymentCsp);
    await page.getByTestId("library-import-trigger").click();
    await page.getByTestId("import-file-input").setInputFiles({
      name: "csp-reader.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# CSP reader\n\nWorker and Reader remain available."),
    });
    await page.locator("a.import-overlay__open").click();
    await expect(page.getByText("Worker and Reader remain available.")).toBeVisible();
    expect(policyErrors).toEqual([]);
  });
});

async function importDocument(page: Page): Promise<void> {
  await page.getByTestId("library-import-trigger").click();
  await page.getByTestId("import-file-input").setInputFiles({
    name: "pwa-offline.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(`# Offline document\n\n${sourceMarker}\n\nReady from IndexedDB.`),
  });
  await expect(page.locator(".import-overlay__notice")).toBeVisible();
  await expect(page.locator(".library-list__link")).toBeVisible();
}

async function inspectLocalStorageBoundaries(page: Page, marker: string): Promise<{
  readonly cacheContainsDocumentMarker: boolean;
  readonly cacheNames: readonly string[];
  readonly cachedUrls: readonly string[];
  readonly indexedDbChunkCount: number;
}> {
  return page.evaluate(async (documentMarker) => {
    const cacheNames = await window.caches.keys();
    const cachedRequests = (await Promise.all(cacheNames.map(async (name) => {
      const cache = await window.caches.open(name);
      return cache.keys();
    }))).flat();
    const cachedUrls = cachedRequests.map((request) => request.url);
    const cachedBodies = await Promise.all(cacheNames.map(async (name) => {
      const cache = await window.caches.open(name);
      return Promise.all((await cache.keys()).map(async (request) => {
        const response = await cache.match(request);
        return response === undefined ? "" : response.clone().text().catch(() => "");
      }));
    }));
    const indexedDbChunkCount = await new Promise<number>((resolve, reject) => {
      const request = indexedDB.open("markdown-reader");
      request.onerror = () => { reject(request.error ?? new Error("IndexedDB open failed.")); };
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("chunks", "readonly");
        const countRequest = transaction.objectStore("chunks").count();
        countRequest.onerror = () => { reject(countRequest.error ?? new Error("Chunk count failed.")); };
        countRequest.onsuccess = () => { resolve(countRequest.result); database.close(); };
      };
    });
    return {
      cacheContainsDocumentMarker: cachedBodies.flat().some((body) => body.includes(documentMarker)),
      cacheNames,
      cachedUrls,
      indexedDbChunkCount,
    };
  }, marker);
}

function isAppAssetUrl(value: string): boolean {
  const { pathname } = new URL(value);
  return pathname === "/index.html"
    || pathname === "/manifest.webmanifest"
    || pathname === "/theme-bootstrap.js"
    || pathname.startsWith("/assets/")
    || pathname.startsWith("/icons/");
}
