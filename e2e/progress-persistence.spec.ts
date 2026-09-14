import { expect, test, type Page } from "@playwright/test";

test.describe("P03-T04 semantic progress persistence", () => {
  test.describe.configure({ mode: "serial", timeout: 60_000 });

  test("restores after automatic scroll persistence, mode/strategy changes, hash priority and pagehide", async ({ page }) => {
    await importProgressCorpus(page);
    const viewport = page.getByTestId("reader-viewport");
    await expect(viewport).toHaveAttribute("aria-busy", "false");

    await page.getByRole("link", { name: "Progress section 24", exact: true }).first().click();
    await expect(page.getByText("PROGRESS_MARKER_24")).toBeVisible();
    await expect(viewport).toHaveAttribute("aria-busy", "false");
    await page.mouse.wheel(0, 50);
    await expect(viewport).toHaveAttribute("aria-busy", "false");
    await page.waitForTimeout(150);
    await expect(page.locator(".reader-progress")).not.toContainText("0 %");
    const activeHeading = page.locator('.reader-toc--desktop a[aria-current="location"]');
    await expect(activeHeading).toHaveText(/Progress section 2[34]/u);
    await page.evaluate(() => { window.dispatchEvent(new PageTransitionEvent("pagehide")); });
    await expect(page.locator("#document-content")).not.toHaveAttribute("data-current-block-id", "");
    const savedBlockId = await page.locator("#document-content").getAttribute("data-current-block-id");
    if (savedBlockId === null) throw new Error("Expected a flushed semantic block ID.");
    expect(savedBlockId).toBe(await blockAtReadingLine(page));
    const savedBlockHeading = await headingForBlock(page, savedBlockId);
    await page.locator(".reader-toolbar a").click();
    await expect(page.locator(".library-item__progress")).not.toContainText("0 %");
    await page.locator(".library-list__link").click();
    await expect(viewport).toHaveAttribute("aria-busy", "false");
    await expect(viewport).toHaveAttribute("data-target-block-id", savedBlockId);
    const restoredBlock = page.locator(`[data-reader-block-id="${savedBlockId}"]`);
    await expect(restoredBlock).toHaveCount(1);
    await expect.poll(async () => restoredBlock.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.top <= 72 && rect.bottom > 72) return 0;
      return Math.min(Math.abs(rect.top - 72), Math.abs(rect.bottom - 72));
    })).toBeLessThanOrEqual(96);
    const restoredHeadingLocator = page.locator('.reader-toc--desktop a[aria-current="location"]');
    await expect.poll(async () => {
      const restoredHeading = (await restoredHeadingLocator.textContent())?.trim();
      if (restoredHeading === undefined || restoredHeading.length === 0) return Number.POSITIVE_INFINITY;
      return Math.abs(headingNumber(restoredHeading) - headingNumber(savedBlockHeading));
    }).toBeLessThanOrEqual(1);

    await page.locator(".reader__controls button").evaluate((button: HTMLButtonElement) => { button.click(); });
    await page.getByRole("radio", { name: "По разделам", exact: true }).focus();
    await page.keyboard.press("Space");
    await expect(page.getByTestId("section-reader")).toBeVisible();
    await expect(page.getByTestId("section-reader")).not.toHaveAttribute("data-target-block-id", "");
    await closeSettings(page);
    const sectionContext = await page.locator(".section-context").textContent();
    const modeHeading = sectionContext?.split("—").at(-1)?.trim();
    if (modeHeading === undefined || modeHeading.length === 0) throw new Error("Expected restored section context.");
    const modeMarker = `PROGRESS_MARKER_${String(headingNumber(modeHeading))}`;

    await page.locator(".reader__controls button").evaluate((button: HTMLButtonElement) => { button.click(); });
    await page.getByRole("radio", { name: "По H1", exact: true }).focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("radio", { name: "По H1", exact: true })).toBeChecked();
    await expect(page.getByTestId("section-reader")).not.toHaveAttribute("data-target-block-id", "");
    await closeSettings(page);
    await expect(page.getByText(modeMarker)).toBeVisible();

    await page.goto(`${new URL(page.url()).pathname}#mdr-h-progress-section-3-1`);
    await expect(page.getByText(/^PROGRESS_MARKER_3\s/u)).toBeVisible();
    await expect(page.locator('.reader-toc--desktop a[aria-current="location"]')).toHaveText("Progress section 3");
    expect(await page.locator("#mdr-h-progress-section-3-1").evaluate((element) => Math.abs(element.getBoundingClientRect().top - 72))).toBeLessThanOrEqual(96);

    await page.evaluate(() => { window.dispatchEvent(new PageTransitionEvent("pagehide")); });
    await page.locator(".reader-toolbar a").click();
    await expect(page.locator(".library-item__progress")).not.toContainText("0 %");
  });
});

async function importProgressCorpus(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByTestId("library-import-trigger").click();
  await page.getByTestId("import-file-input").setInputFiles({
    name: "progress.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(createProgressMarkdown()),
  });
  await page.locator("a.import-overlay__open").click();
  if (!await page.getByTestId("reader-viewport").isVisible()) {
    await page.locator(".reader__controls button").click();
    await page.getByRole("radio", { name: "Непрерывное чтение", exact: true }).focus();
    await page.keyboard.press("Space");
  }
  await expect(page.getByTestId("reader-viewport")).toBeVisible();
  if (await page.getByRole("dialog").isVisible()) await closeSettings(page);
}

async function closeSettings(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

function createProgressMarkdown(): string {
  const lines = ["# Progress corpus", "", "Start.", ""];
  for (let index = 1; index <= 40; index += 1) {
    lines.push(`## Progress section ${String(index)}`, "", `PROGRESS_MARKER_${String(index)} ${"semantic progress prose ".repeat(24)}`, "");
  }
  return lines.join("\n");
}

function headingNumber(heading: string): number {
  const value = Number(heading.split(" ").at(-1));
  if (!Number.isInteger(value)) throw new Error(`Expected a numbered progress heading, received: ${heading}`);
  return value;
}

async function blockAtReadingLine(page: Page): Promise<string | undefined> {
  return page.locator("[data-reader-block-id]").evaluateAll((elements) => elements
    .map((element) => ({ element: element as HTMLElement, rect: element.getBoundingClientRect() }))
    .filter(({ rect }) => rect.bottom > 72)
    .sort((left, right) => left.rect.top - right.rect.top)[0]?.element.dataset.readerBlockId);
}

async function headingForBlock(page: Page, blockId: string): Promise<string> {
  const heading = await page.locator("[data-reader-block-id]").evaluateAll((elements, targetBlockId) => {
    const targetIndex = elements.findIndex((element) => (element as HTMLElement).dataset.readerBlockId === targetBlockId);
    for (let index = targetIndex; index >= 0; index -= 1) {
      const element = elements[index];
      if (element?.matches("h1, h2, h3") === true) return element.textContent.trim();
    }
    return undefined;
  }, blockId);
  if (heading === undefined || heading.length === 0) throw new Error(`Expected a heading for semantic block ${blockId}.`);
  return heading;
}
