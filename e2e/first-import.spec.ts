import { expect, test } from "@playwright/test";

test.describe("P01-T03 first import vertical slice", () => {
  test("imports a safe Markdown file into IndexedDB and retains its Library row after reload", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("import-file-input").setInputFiles({
      name: "walking.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Walking document\n\nA safe paragraph."),
    });
    await expect(page.getByText("Документ готов.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Walking document/ })).toHaveAttribute("href", /\/documents\//);

    await page.reload();
    await expect(page.getByRole("link", { name: /Walking document/ })).toBeVisible();
  });

  test("rejects invalid UTF-8 without publishing a Library document", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("import-file-input").setInputFiles({
      name: "invalid.md",
      mimeType: "text/markdown",
      buffer: Buffer.from([0xc3, 0x28]),
    });
    await expect(page.getByRole("alert")).toContainText("UTF-8");
    await expect(page.locator(".library-list__link")).toHaveCount(0);
  });

  test("cancels a running import without publishing a partial Library document", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto("/");
    const markdown = Array.from({ length: 12_000 }, (_, index) => `# Section ${String(index)}\n\nParagraph ${String(index)}.`).join("\n\n");
    await page.getByTestId("import-file-input").setInputFiles({ name: "cancelled.md", mimeType: "text/markdown", buffer: Buffer.from(markdown) });
    await page.getByRole("button", { name: "Отменить" }).click();
    await expect(page.getByText("Импорт отменён.")).toBeVisible();
    await expect(page.locator(".library-list__link")).toHaveCount(0);
  });
});
