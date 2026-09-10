import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("P01-T01 app shell", () => {
  test("renders deep links, recovery and a 320px accessible shell", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Библиотека" })).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
    expect(await page.locator("body").evaluate((body) => body.scrollWidth <= window.innerWidth)).toBe(true);

    await page.goto("/documents/example#heading");
    await expect(page.getByRole("heading", { name: "Документ" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Перейти к тексту документа" })).toBeVisible();

    await page.goto("/not-a-route");
    await expect(page.getByRole("heading", { name: "Страница не найдена" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Открыть библиотеку" })).toHaveAttribute("href", "/");

    const violations = await new AxeBuilder({ page }).analyze();
    expect(violations.violations).toEqual([]);
  });
});
