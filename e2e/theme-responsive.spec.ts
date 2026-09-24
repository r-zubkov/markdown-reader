import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.describe("P05-T01 theme and responsive editorial UI", () => {
  test("applies the mirrored preference before the first app paint and keeps all header actions at 320px", async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem("markdown-reader.theme-seeded") !== "true") {
        localStorage.setItem("markdown-reader.theme", "dark");
        sessionStorage.setItem("markdown-reader.theme-seeded", "true");
      }
    });
    let releaseApp = () => { /* Assigned before the route can resolve. */ };
    const appGate = new Promise<void>((resolve) => { releaseApp = resolve; });
    await page.route("**/src/main.tsx", async (route) => {
      await appGate;
      await route.continue();
    });
    await page.setViewportSize({ height: 640, width: 320 });
    await page.goto("/", { waitUntil: "commit" });

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    releaseApp();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("combobox", { name: "Выбрать тему" })).toHaveValue("system");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("markdown-reader.theme"))).toBe("system");
    await expectNoPageOverflow(page);
    await expectHeaderTargetsAtLeast44Px(page);

    await page.getByRole("combobox", { name: "Выбрать тему" }).selectOption("dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("markdown-reader.theme"))).toBe("dark");
    await page.reload();
    await expect(page.getByRole("combobox", { name: "Выбрать тему" })).toHaveValue("dark");

    await page.getByRole("combobox", { name: "Выбрать тему" }).selectOption("system");
    await expect(page.getByRole("combobox", { name: "Выбрать тему" })).toHaveValue("system");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("markdown-reader.theme"))).toBe("system");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.reload();
    await expect(page.getByRole("combobox", { name: "Выбрать тему" })).toHaveValue("system");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expectNoPageOverflow(page);
    await expectHeaderTargetsAtLeast44Px(page);

    const violations = await new AxeBuilder({ page }).include("#root").analyze();
    expect(violations.violations).toEqual([]);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`keeps the library editorial and readable in ${theme} theme`, async ({ page }) => {
      await page.setViewportSize({ height: 900, width: 1280 });
      await page.goto("/");
      await page.getByRole("combobox", { name: "Выбрать тему" }).selectOption(theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("combobox", { name: "Выбрать тему" })).toHaveValue(theme);
      await expect(page.getByRole("heading", { name: "Библиотека" })).toBeVisible();
      await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState === "finished"));
      const violations = await new AxeBuilder({ page }).include("#root").analyze();
      expect(violations.violations).toEqual([]);
      await expect(page).toHaveScreenshot(`library-${theme}.png`, { animations: "disabled" });
    });
  }

  test("keeps forced colors and reduced motion usable at compact reflow", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    await page.setViewportSize({ height: 640, width: 320 });
    await page.goto("/");

    await expect.poll(() => page.evaluate(() => ({
      forcedColors: matchMedia("(forced-colors: active)").matches,
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    }))).toEqual({ forcedColors: true, reducedMotion: true });
    await expectNoPageOverflow(page);
    const importButton = page.getByTestId("library-import-trigger");
    await importButton.focus();
    const focusAndMotion = await importButton.evaluate((element) => {
      const style = getComputedStyle(element);
      const durationMs = style.transitionDuration.split(",").map((value) => {
        const duration = Number.parseFloat(value);
        return value.trim().endsWith("ms") ? duration : duration * 1_000;
      });
      return {
        maximumTransitionMs: Math.max(...durationMs),
        outlineWidth: Number.parseFloat(style.outlineWidth),
      };
    });
    expect(focusAndMotion.maximumTransitionMs).toBeLessThanOrEqual(0.1);
    expect(focusAndMotion.outlineWidth).toBeGreaterThanOrEqual(2);
  });

  test("keeps Reader controls, TOC and status separate across the release width matrix", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("library-import-trigger").click();
    await page.getByTestId("import-file-input").setInputFiles({
      name: "responsive-matrix.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# First\n\nReadable prose.\n\n## Second\n\nMore prose.\n\n### Third\n\nFinal prose."),
    });
    await page.locator("a.import-overlay__open").click();
    await expect(page.locator("#mdr-h-first-1")).toBeVisible();

    for (const width of [390, 768, 1024, 1120, 1440]) {
      await page.setViewportSize({ height: 900, width });
      await expectNoPageOverflow(page);
      await expect(page.locator("#mdr-h-first-1")).toBeVisible();
      if (width >= 1120) {
        await expect(page.locator(".reader-toc--desktop")).toBeVisible();
        await expect(page.locator(".reader-toc__mobile")).toBeHidden();
        const surfaces = await page.evaluate(() => {
          const toc = document.querySelector<HTMLElement>(".reader-toc--desktop")?.getBoundingClientRect();
          const status = document.querySelector<HTMLElement>(".platform-status")?.getBoundingClientRect();
          return toc && status ? { statusTop: status.top, tocBottom: toc.bottom } : null;
        });
        expect(surfaces).not.toBeNull();
        expect(surfaces?.tocBottom).toBeLessThanOrEqual(surfaces?.statusTop ?? 0);
      } else {
        await expect(page.locator(".reader-toc--desktop")).toBeHidden();
        await expect(page.locator(".reader-toc__mobile")).toBeVisible();
      }
    }
  });

  test("reflows at the 400 percent equivalent width with WCAG text spacing", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 320 });
    await page.goto("/");
    await page.addStyleTag({
      content: `
        body * {
          line-height: 1.5 !important;
          letter-spacing: .12em !important;
          word-spacing: .16em !important;
        }
        p { margin-block-end: 2em !important; }
      `,
    });

    await expectNoPageOverflow(page);
    await expect(page.getByTestId("library-import-trigger")).toBeVisible();
    await expectHeaderTargetsAtLeast44Px(page);
  });
});

async function expectNoPageOverflow(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )).toBe(true);
}

async function expectHeaderTargetsAtLeast44Px(page: Page): Promise<void> {
  const targets = page.locator(".app-header a:visible, .app-header button:visible, .app-header select:visible");
  const boxes = await targets.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { height: rect.height, width: rect.width };
  }));
  expect(boxes.length).toBeGreaterThan(0);
  for (const box of boxes) {
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
}
