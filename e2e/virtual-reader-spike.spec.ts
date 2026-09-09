import { expect, test, type Locator, type Page } from "@playwright/test";

const CHUNK_COUNT = 20_000;
const MOUNTED_ITEM_BUDGET = 48;
const CACHE_LIMIT = 96;
const ANCHOR_TOLERANCE_PX = 96;

test.describe("P00-T04 continuous virtual reader", () => {
  test("reaches all markers, keeps focus, and remains bounded", async ({ browserName, page }) => {
    await openSpike(page);
    const metrics = page.getByTestId("virtual-reader-metrics");

    await expect(page.getByText("FIRST MARKER — chunk 0")).toBeVisible();
    await expectBounded(metrics);

    const focusedControl = page.getByRole("button", { name: "Focus target 0" });
    await focusedControl.focus();
    await expect(metrics).toHaveAttribute("data-pinned-index", "0");

    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await expect(page.getByText(`LAST MARKER — chunk ${String(CHUNK_COUNT - 1)}`)).toBeVisible();
    await expect(focusedControl).toBeAttached();
    await expect(focusedControl).toBeFocused();
    await expectBounded(metrics);
    await expectViewportCovered(page);

    await page.getByRole("button", { name: "Middle" }).click();
    await expect(page.getByText(`MIDDLE MARKER — chunk ${String(CHUNK_COUNT / 2)}`)).toBeVisible();
    await expectDriftWithinBudget(metrics);
    await expectViewportCovered(page);

    await page.getByRole("button", { name: "First", exact: true }).click();
    await expect(page.getByText("FIRST MARKER — chunk 0")).toBeVisible();
    await expectBounded(metrics);
    await logMetrics(page, metrics, browserName, "markers-focus");
  });

  test("preserves an anchor through theme, width, image, and viewport changes", async ({
    browserName,
    page,
  }) => {
    await openSpike(page);
    const metrics = page.getByTestId("virtual-reader-metrics");
    await page.getByRole("button", { name: "Middle" }).click();
    await expect(page.getByText(`MIDDLE MARKER — chunk ${String(CHUNK_COUNT / 2)}`)).toBeVisible();

    await page.getByRole("button", { name: "Toggle theme" }).click();
    await expect(page.locator(".virtual-reader-spike--dark")).toBeVisible();
    await expectDriftWithinBudget(metrics);

    await page.getByRole("button", { name: "Toggle width" }).click();
    await expect(page.locator(".virtual-reader-spike__article.is-compact")).toBeVisible();
    await expectDriftWithinBudget(metrics);

    await page.getByRole("button", { name: "Load image above" }).click();
    await expect(page.locator(".virtual-reader-spike__late-image")).toBeAttached();
    await expectDriftWithinBudget(metrics);

    await page.setViewportSize({ height: 720, width: 320 });
    await expectNoPageOverflow(page);
    await expectViewportCovered(page);
    await expectBounded(metrics);
    await logMetrics(page, metrics, browserName, "remeasure-responsive");

    await page.setViewportSize({ height: 390, width: 844 });
    await expectNoPageOverflow(page);
    await expectViewportCovered(page);
    await expectBounded(metrics);
  });

  test("survives rapid forward and reverse document scrolling without a blank viewport", async ({
    browserName,
    page,
  }) => {
    await openSpike(page);
    const metrics = page.getByTestId("virtual-reader-metrics");
    const ratios = [0.12, 0.84, 0.31, 0.97, 0.52, 0.04, 0.76, 0.22];

    const longestBlankGapMs = await measureRapidScrollCoverage(page, ratios);
    expect(longestBlankGapMs).toBeLessThanOrEqual(100);
    await expectViewportCovered(page);
    await expectBounded(metrics);
    console.info(
      "P00-T04 blank gap measurement",
      JSON.stringify({ browserName, longestBlankGapMs }),
    );
    await logMetrics(page, metrics, browserName, "rapid-reverse-scroll");
  });

  for (const candidate of [
    { direct: false, flush: true, name: "flushSync enabled" },
    { direct: true, flush: false, name: "direct DOM updates" },
  ]) {
    test(`compares ${candidate.name} in Chromium`, async ({ browserName, context }) => {
      test.skip(browserName !== "chromium", "Candidate comparison is measured once in Chromium.");
      const page = await context.newPage();
      await openSpike(page, `&flush=${candidate.flush ? "1" : "0"}&direct=${candidate.direct ? "1" : "0"}`);
      const metrics = page.getByTestId("virtual-reader-metrics");

      await page.getByRole("button", { name: "Middle" }).click();
      await expect(page.getByText(`MIDDLE MARKER — chunk ${String(CHUNK_COUNT / 2)}`)).toBeVisible();
      await expect(metrics).toHaveAttribute("data-flush-sync", String(candidate.flush));
      await expect(metrics).toHaveAttribute("data-direct-dom-updates", String(candidate.direct));
      await expectBounded(metrics);
      await expectDriftWithinBudget(metrics);
      await expectViewportCovered(page);
      await logMetrics(page, metrics, browserName, candidate.name);
    });
  }
});

async function openSpike(page: Page, suffix = ""): Promise<void> {
  await page.goto(`/spikes/virtual-reader?count=${String(CHUNK_COUNT)}${suffix}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Continuous virtual reader" }),
  ).toBeVisible();
  await expect(page.locator(".virtual-reader-spike__chunk").first()).toBeVisible();
}

async function expectBounded(metrics: Locator): Promise<void> {
  await expect.poll(async () => Number(await metrics.getAttribute("data-mounted-count"))).toBeLessThanOrEqual(MOUNTED_ITEM_BUDGET);
  await expect.poll(async () => Number(await metrics.getAttribute("data-cache-count"))).toBeLessThanOrEqual(CACHE_LIMIT);
}

async function expectDriftWithinBudget(metrics: Locator): Promise<void> {
  await expect.poll(async () => Number(await metrics.getAttribute("data-last-drift-px"))).toBeLessThanOrEqual(ANCHOR_TOLERANCE_PX);
}

async function expectViewportCovered(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(() => {
    const toolbar = document.querySelector(".virtual-reader-spike__toolbar");
    const article = document.querySelector(".virtual-reader-spike__article");
    if (!(toolbar instanceof HTMLElement) || !(article instanceof HTMLElement)) return false;

    const articleRect = article.getBoundingClientRect();
    const readingLine = Math.min(
      window.innerHeight - 8,
      Math.max(8, toolbar.getBoundingClientRect().bottom + 8),
    );
    if (readingLine < articleRect.top || readingLine > articleRect.bottom) return true;

    return [...document.querySelectorAll(".virtual-reader-spike__chunk")].some((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top <= readingLine && rect.bottom >= readingLine;
    });
  })).toBe(true);
}

async function expectNoPageOverflow(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )).toBe(true);
}

async function logMetrics(
  page: Page,
  metrics: Locator,
  browserName: string,
  scenario: string,
): Promise<void> {
  console.info(
    "P00-T04 browser measurement",
    JSON.stringify({
      browserName,
      cacheCount: await metrics.getAttribute("data-cache-count"),
      directDomUpdates: await metrics.getAttribute("data-direct-dom-updates"),
      flushSync: await metrics.getAttribute("data-flush-sync"),
      lastDriftPx: await metrics.getAttribute("data-last-drift-px"),
      longTaskCount: await metrics.getAttribute("data-long-task-count"),
      longestTaskMs: await metrics.getAttribute("data-longest-task-ms"),
      maximumCacheCount: await metrics.getAttribute("data-max-cache-count"),
      maximumMountedCount: await metrics.getAttribute("data-max-mounted-count"),
      mountedChunkElements: await page.locator(".virtual-reader-spike__chunk").count(),
      mountedCount: await metrics.getAttribute("data-mounted-count"),
      readerDescendantElements: await page.locator(".virtual-reader-spike__article *").count(),
      scenario,
    }),
  );
}

async function measureRapidScrollCoverage(
  page: Page,
  ratios: readonly number[],
): Promise<number> {
  return page.evaluate(async (scrollRatios) => new Promise<number>((resolve) => {
    const intervalMs = 32;
    const settleMs = 160;
    const startedAt = performance.now();
    let blankStartedAt: number | null = null;
    let longestBlankGapMs = 0;

    const isCovered = () => {
      const toolbar = document.querySelector(".virtual-reader-spike__toolbar");
      const article = document.querySelector(".virtual-reader-spike__article");
      if (!(toolbar instanceof HTMLElement) || !(article instanceof HTMLElement)) return false;

      const articleRect = article.getBoundingClientRect();
      const readingLine = Math.min(
        window.innerHeight - 8,
        Math.max(8, toolbar.getBoundingClientRect().bottom + 8),
      );
      if (readingLine < articleRect.top || readingLine > articleRect.bottom) return true;

      return [...document.querySelectorAll(".virtual-reader-spike__chunk")].some((element) => {
        const rect = element.getBoundingClientRect();
        return rect.top <= readingLine && rect.bottom >= readingLine;
      });
    };

    scrollRatios.forEach((ratio, index) => {
      window.setTimeout(() => {
        const maximum = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, maximum * ratio);
      }, index * intervalMs);
    });

    const sample = (now: number) => {
      if (isCovered()) {
        if (blankStartedAt !== null) {
          longestBlankGapMs = Math.max(longestBlankGapMs, now - blankStartedAt);
          blankStartedAt = null;
        }
      } else {
        blankStartedAt ??= now;
      }

      const duration = scrollRatios.length * intervalMs + settleMs;
      if (now - startedAt < duration) {
        window.requestAnimationFrame(sample);
        return;
      }

      if (blankStartedAt !== null) {
        longestBlankGapMs = Math.max(longestBlankGapMs, now - blankStartedAt);
      }
      resolve(longestBlankGapMs);
    };
    window.requestAnimationFrame(sample);
  }), ratios);
}
