import { expect, test, type Page } from "@playwright/test";

test.describe("P03-T02 production continuous reader", () => {
  test.describe.configure({ mode: "serial", timeout: 60_000 });
  test("reaches first, middle and last real-pipeline chunks with bounded DOM/cache and a focus pin", async ({ page }) => {
    await page.addInitScript(() => {
      Reflect.set(window, "__readerLongestTask", 0);
      if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
        new PerformanceObserver((list) => {
          const longest = Math.max(0, ...list.getEntries().map((entry) => entry.duration));
          Reflect.set(window, "__readerLongestTask", Math.max(Number(Reflect.get(window, "__readerLongestTask")), longest));
        }).observe({ buffered: true, type: "longtask" });
      }
    });
    await importContinuousCorpus(page);
    const viewport = page.getByTestId("reader-viewport");

    await expect(page.getByText("FIRST_READER_MARKER")).toBeVisible();
    await startBlankGapMeasurement(page);
    await page.getByRole("link", { name: "Section 110", exact: true }).first().click();
    await expect(page.locator("#mdr-h-section-110-1")).toBeVisible();
    await expect(page.getByText("MIDDLE_READER_MARKER")).toBeVisible();
    await expect(viewport).toHaveAttribute("aria-busy", "false");
    const themeFocusTarget = page.locator("#mdr-h-section-110-1");
    await themeFocusTarget.evaluate((element: HTMLElement) => {
      element.tabIndex = -1;
      element.focus({ preventScroll: true });
    });
    await expect(themeFocusTarget).toBeFocused();
    const beforeThemeTop = await themeFocusTarget.evaluate((element) => element.getBoundingClientRect().top);
    await page.getByRole("button", { name: "Выбрать тему" }).evaluate((button: HTMLButtonElement) => { button.click(); });
    await expect(viewport).toHaveAttribute("data-remeasuring", "true");
    await expect(viewport).toHaveAttribute("data-remeasuring", "false");
    await expect(themeFocusTarget).toBeFocused();
    await expect.poll(async () => Math.abs(
      await themeFocusTarget.evaluate((element) => element.getBoundingClientRect().top) - beforeThemeTop,
    )).toBeLessThanOrEqual(96);
    const afterThemeTop = await themeFocusTarget.evaluate((element) => element.getBoundingClientRect().top);
    const themeDriftPx = Math.abs(afterThemeTop - beforeThemeTop);
    await page.getByRole("link", { name: "Section 220", exact: true }).first().click();
    await expect(page.locator("#mdr-h-section-220-1")).toBeVisible();
    await expect(page.getByText("LAST_READER_MARKER")).toBeVisible();
    const longestBlankGapMs = await stopBlankGapMeasurement(page);
    expect(longestBlankGapMs).toBeLessThanOrEqual(100);

    await expect.poll(async () => Number(await viewport.getAttribute("data-mounted-count"))).toBeLessThanOrEqual(48);
    await expect.poll(async () => Number(await viewport.getAttribute("data-cache-count"))).toBeLessThanOrEqual(96);

    await page.getByRole("link", { name: "Section 1", exact: true }).first().click();
    await expect(viewport).toHaveAttribute("data-target-ordinal", "1");
    await expect(viewport).toHaveAttribute("aria-busy", "false");
    const focusLink = page.getByRole("link", { name: "Pinned focus target" });
    await focusLink.focus();
    await page.mouse.wheel(0, 100_000);
    await page.waitForTimeout(250);
    await expect(focusLink).toBeFocused();
    await expect(focusLink).toHaveCount(1);
    await expect.poll(async () => Number(await viewport.getAttribute("data-cache-count"))).toBeLessThanOrEqual(96);
    const longestTaskMs = await page.evaluate(() => Number(Reflect.get(window, "__readerLongestTask")));
    expect(longestTaskMs).toBeLessThanOrEqual(150);
    console.info("P03-T02 browser measurement", JSON.stringify({
      cacheCount: Number(await viewport.getAttribute("data-cache-count")),
      longestBlankGapMs,
      longestTaskMs,
      mountedCount: Number(await viewport.getAttribute("data-mounted-count")),
      themeDriftPx,
    }));
  });

  test("keeps mobile reflow local and reports a failed remote image without losing prose", async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 320 });
    await page.route("https://assets.example/reader.png", (route) => { void route.abort(); });
    await importContinuousCorpus(page);
    await page.locator(".reader-toc__mobile button").click();
    await page.getByRole("link", { name: "Section 110", exact: true }).click();
    await expect(page.getByTestId("reader-viewport")).toHaveAttribute("data-target-ordinal", "110");
    await expect(page.getByTestId("reader-viewport")).toHaveAttribute("aria-busy", "false");

    await expect(page.locator("#mdr-h-section-110-1")).toBeVisible();
    await expect(page.getByText(/Изображение не загрузилось/u)).toBeVisible();
    const pageOverflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(pageOverflows).toBe(false);
    await expect.poll(async () => Number(await page.getByTestId("reader-viewport").getAttribute("data-mounted-count"))).toBeLessThanOrEqual(48);

    const beforeResizeTop = await page.locator("#mdr-h-section-110-1").evaluate((element) => element.getBoundingClientRect().top);
    await page.setViewportSize({ height: 390, width: 844 });
    await expect(page.getByTestId("reader-viewport")).toHaveAttribute("data-remeasuring", "true");
    await expect(page.getByTestId("reader-viewport")).toHaveAttribute("data-remeasuring", "false");
    await expect.poll(async () => Math.abs(
      await page.locator("#mdr-h-section-110-1").evaluate((element) => element.getBoundingClientRect().top) - beforeResizeTop,
    )).toBeLessThanOrEqual(96);
    const afterResizeTop = await page.locator("#mdr-h-section-110-1").evaluate((element) => element.getBoundingClientRect().top);
    console.info("P05-T01 responsive anchor measurement", JSON.stringify({
      afterResizeTop,
      beforeResizeTop,
      driftPx: Math.abs(afterResizeTop - beforeResizeTop),
    }));
    expect(Math.abs(afterResizeTop - beforeResizeTop)).toBeLessThanOrEqual(96);
  });

  test("restores a saved semantic anchor directly in the middle of the corpus", async ({ page }) => {
    await importContinuousCorpus(page);
    await page.getByRole("link", { name: "Section 110", exact: true }).first().click();
    const viewport = page.getByTestId("reader-viewport");
    await expect.poll(async () => Number(await viewport.getAttribute("data-target-ordinal"))).toBeGreaterThanOrEqual(109);
    expect(Number(await viewport.getAttribute("data-target-ordinal"))).toBeLessThanOrEqual(110);
    await expect(viewport).toHaveAttribute("aria-busy", "false");
    await page.waitForTimeout(900);
    await page.evaluate(() => { history.replaceState(history.state, "", location.pathname); });
    await page.reload();

    await expect.poll(async () => Number(await viewport.getAttribute("data-target-ordinal"))).toBeGreaterThanOrEqual(109);
    expect(Number(await viewport.getAttribute("data-target-ordinal"))).toBeLessThanOrEqual(110);
    await expect(page.getByText("MIDDLE_READER_MARKER")).toBeVisible();
    await expect.poll(async () => Number(await viewport.getAttribute("data-cache-count"))).toBeLessThanOrEqual(96);
  });
});

async function importContinuousCorpus(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByTestId("library-import-trigger").click();
  await page.getByTestId("import-file-input").setInputFiles({
    name: "continuous-reader.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(createContinuousMarkdown()),
  });
  await page.locator("a.import-overlay__open").click();
  await expect(page.locator("#reader-title")).toHaveText("Continuous Corpus");
  await page.locator(".reader__controls button").click();
  await page.getByRole("radio", { name: "Непрерывное чтение", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("reader-viewport")).toBeAttached();
  await page.getByRole("button", { name: "Close" }).evaluate((button: HTMLButtonElement) => { button.click(); });
}


function createContinuousMarkdown(): string {
  const lines = [
    "# Continuous Corpus",
    "",
    "FIRST_READER_MARKER [Pinned focus target](https://example.com/focus)",
    "",
  ];
  for (let section = 1; section <= 220; section += 1) {
    lines.push(`## Section ${String(section)}`, "");
    const marker = section === 110 ? "MIDDLE_READER_MARKER " : section === 220 ? "LAST_READER_MARKER " : "";
    lines.push(`${marker}Deterministic paragraph ${String(section)} with enough prose to exercise dynamic measurement and ordered range loading.`, "");
    if (section === 110) lines.push("![Remote diagram](https://assets.example/reader.png)", "");
    if (section % 40 === 0) lines.push("```text", `wide-code-${String(section)}-${"x".repeat(240)}`, "```", "");
  }
  return lines.join("\n");
}

async function startBlankGapMeasurement(page: Page): Promise<void> {
  await page.evaluate(() => {
    Reflect.set(window, "__readerGapActive", true);
    Reflect.set(window, "__readerGapLongest", 0);
    let uncoveredAt: number | undefined;
    const sample = (now: number) => {
      if (!Reflect.get(window, "__readerGapActive")) return;
      const covered = [...document.querySelectorAll<HTMLElement>(".reader-virtual__chunk")]
        .some((element) => {
          const rect = element.getBoundingClientRect();
          return rect.bottom > 72 && rect.top < window.innerHeight;
        });
      if (covered) uncoveredAt = undefined;
      else {
        uncoveredAt ??= now;
        Reflect.set(window, "__readerGapLongest", Math.max(Number(Reflect.get(window, "__readerGapLongest")), now - uncoveredAt));
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

async function stopBlankGapMeasurement(page: Page): Promise<number> {
  return await page.evaluate(() => {
    Reflect.set(window, "__readerGapActive", false);
    return Number(Reflect.get(window, "__readerGapLongest"));
  });
}
