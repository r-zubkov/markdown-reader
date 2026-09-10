import { expect, test } from "@playwright/test";

test.describe("P01-T04 first reader vertical slice", () => {
  test("opens a bounded safe window, saves a semantic anchor, restores it after reload, and returns to Library", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("import-file-input").setInputFiles({
      name: "reader.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Reader document\n\nA safe paragraph.\n\nAnother safe paragraph."),
    });
    await page.getByRole("link", { name: "Открыть" }).click();

    await expect(page.locator("#reader-title")).toHaveText("Reader document");
    await expect(page.locator(".reader-content")).toContainText("A safe paragraph.");
    await expect(page.locator("[data-reader-ordinal]")).toHaveCount(1);
    await page.getByTestId("reader-save-block-0").click();
    await page.reload();
    await expect(page.locator("[data-reader-ordinal='0']")).toBeVisible();

    await page.getByRole("link", { name: "К библиотеке" }).click();
    await expect(page.getByRole("heading", { name: "Библиотека" })).toBeVisible();
  });
});
