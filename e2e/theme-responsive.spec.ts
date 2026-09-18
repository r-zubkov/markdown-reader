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

    const violations = await new AxeBuilder({ page }).include(".app-frame").analyze();
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
      const violations = await new AxeBuilder({ page }).include(".app-frame").analyze();
      expect(violations.violations).toEqual([]);
      await expect(page.locator(".app-frame")).toHaveScreenshot(`library-${theme}.png`, { animations: "disabled" });
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
});

async function expectNoPageOverflow(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )).toBe(true);
}

async function expectHeaderTargetsAtLeast44Px(page: Page): Promise<void> {
  const targets = page.locator(".app-header a, .app-header button, .app-header select");
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
