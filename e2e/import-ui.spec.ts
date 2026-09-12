import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("P02-T02 import overlay", () => {
  test("keeps picker validation and recovery usable at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/");
    await page.getByTestId("library-import-trigger").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByTestId("import-file-input").setInputFiles({
      name: "not-markdown.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("local only"),
    });
    await expect(page.getByRole("alert")).toContainText(".md");
    await expect.poll(async () => page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    )).toBe(true);

    const violations = await new AxeBuilder({ page }).include("[role='dialog']").analyze();
    expect(violations.violations).toEqual([]);

    await page.getByRole("button", { name: "Выбрать файл" }).click();
    await expect(page.getByTestId("import-file-input")).toBeVisible();
  });
});
