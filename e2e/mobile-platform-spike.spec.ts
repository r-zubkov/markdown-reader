import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.describe("P00-T06 mobile UI and platform primitives", () => {
  test("keeps the dynamic dialog, Sheet, and mobile layout usable at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await openSpike(page);

    await page.getByRole("button", { name: "Открыть проверку импорта" }).click();
    await page.getByRole("button", { name: "Start local preparation" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("mobile-platform-spike")).toHaveAttribute(
      "data-overlay-stage",
      "running",
    );

    await page.getByRole("button", { name: "Request cancellation" }).click();
    const decisionTitle = page.getByRole("heading", { name: "Выберите безопасное действие" });
    await expect(decisionTitle).toBeFocused();
    await expect(page.getByRole("dialog")).toHaveCount(1);

    await page.getByRole("button", { name: "Закрыть" }).click();
    await page.getByRole("button", { name: "Открыть длинное оглавление" }).click();
    await expect(page.getByRole("heading", { name: "Оглавление документа" })).toBeVisible();
    await expect(page.locator(".mobile-platform-spike__sheet")).toBeVisible();
    await expectNoPageOverflow(page);

    const violations = await new AxeBuilder({ page })
      .include(".mobile-platform-spike")
      .analyze();
    expect(violations.violations).toEqual([]);

    await page.getByRole("button", { name: "Готово" }).click();
    await expect(page.getByRole("button", { name: "Открыть длинное оглавление" })).toBeFocused();
  });

  test("has no clipped action or horizontal overflow in 390px landscape", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await openSpike(page);

    await page.getByRole("button", { name: "Toggle theme" }).click();
    await expect(page.getByTestId("mobile-platform-spike")).toHaveClass(/mobile-platform-spike--dark/);

    await page.getByRole("button", { name: "Открыть длинное оглавление" }).click();
    await expect(page.getByRole("button", { name: "Готово" })).toBeVisible();
    await expectNoPageOverflow(page);
  });
});

async function openSpike(page: Page): Promise<void> {
  await page.goto("/spikes/mobile-platform");
  await expect(page.getByRole("heading", { name: "Mobile UI and platform primitives" })).toBeVisible();
}

async function expectNoPageOverflow(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )).toBe(true);
}
