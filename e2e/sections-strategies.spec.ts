import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("P03-T03 sections and strategies", () => {
  test("selects sections from measured cost, pages safely, and persists a keyboard mode choice", async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 320 });
    await page.goto("/");
    await page.getByTestId("library-import-trigger").click();
    await page.getByTestId("import-file-input").setInputFiles({
      name: "sections.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(createSectionsMarkdown()),
    });
    await page.locator("a.import-overlay__open").click();

    await expect(page.getByTestId("section-reader")).toBeVisible();
    const pager = page.getByRole("navigation", { name: "Навигация по разделам" });
    await expect(pager.getByRole("button", { name: /Предыдущий раздел/u })).toBeDisabled();
    await pager.getByRole("button", { name: /Следующий раздел/u }).click();
    await expect(page.getByText("SECTION_MARKER_1")).toBeVisible();

    await page.locator(".reader__controls button").click();
    await page.getByRole("radio", { name: "Непрерывное чтение", exact: true }).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("reader-viewport")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("reader-viewport")).toBeVisible();

    const violations = await new AxeBuilder({ page }).include("#document-content").analyze();
    expect(violations.violations).toEqual([]);
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflows).toBe(false);
  });
});

function createSectionsMarkdown(): string {
  const lines = ["# Sections corpus", "", "Intro.", ""];
  for (let index = 1; index <= 48; index += 1) {
    lines.push(`## Section ${String(index)}`, "", `SECTION_MARKER_${String(index)} ${"bounded prose ".repeat(70)}`, "");
  }
  return lines.join("\n");
}
