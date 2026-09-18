import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.describe("P05-T01 theme and responsive editorial UI", () => {
  test("applies the mirrored preference before the first app paint and keeps all header actions at 320px", async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem("markdown-reader.theme", "dark"); });
    await page.setViewportSize({ height: 640, width: 320 });
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("combobox", { name: "Выбрать тему" })).toHaveValue("dark");
    await expectNoPageOverflow(page);

    await page.getByRole("combobox", { name: "Выбрать тему" }).selectOption("system");
    await expect(page.getByRole("combobox", { name: "Выбрать тему" })).toHaveValue("system");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("markdown-reader.theme"))).toBe("system");
    await expectNoPageOverflow(page);

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
      await expect(page.locator(".app-frame")).toHaveScreenshot(`library-${theme}.png`, { animations: "disabled" });
    });
  }
});

async function expectNoPageOverflow(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )).toBe(true);
}
