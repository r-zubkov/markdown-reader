import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("P03-T01 table of contents and deep links", () => {
  test("direct heading hash wins and TOC selection replaces the URL hash", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("library-import-trigger").click();
    await page.getByTestId("import-file-input").setInputFiles({
      name: "outline.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# First\n\nOne.\n\n## Second\n\nTwo.\n\n### Third\n\nThree."),
    });
    await page.getByRole("link", { name: "Открыть", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "Оглавление документа" })).toContainText("Third");
    const documentPath = new URL(page.url()).pathname;
    await page.goto(`${documentPath}#mdr-h-second-1`);
    await expect(page.locator("#mdr-h-second-1")).toBeVisible();
    await page.getByRole("link", { name: "Third", exact: true }).first().click();
    await expect(page).toHaveURL(/#mdr-h-third-1$/);
    const violations = await new AxeBuilder({ page }).include("#document-content").analyze();
    expect(violations.violations).toEqual([]);
  });

  test("mobile Sheet closes after keyboard navigation and sends focus to the heading", async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/");
    await page.getByTestId("library-import-trigger").click();
    await page.getByTestId("import-file-input").setInputFiles({
      name: "outline-mobile.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# First\n\nOne.\n\n## Second\n\nTwo."),
    });
    await page.getByRole("link", { name: "Открыть", exact: true }).click();
    await page.getByRole("button", { name: "Оглавление", exact: true }).click();
    const second = page.getByRole("link", { name: "Second", exact: true });
    await second.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#mdr-h-second-1")).toBeFocused();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
