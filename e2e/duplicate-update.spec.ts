import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.describe("P02-T03 duplicate and update decisions", () => {
  test("opens an exact duplicate without creating another Library document", async ({ page }) => {
    await page.goto("/");
    await importMarkdown(page, "original.md", "# Original\n\nLocal document.");
    await page.getByRole("button", { name: "Готово" }).click();
    const original = page.locator(".library-list__link").filter({ hasText: "Original" });
    const originalHref = await original.getAttribute("href");

    await page.getByTestId("library-import-trigger").click();
    await page.getByTestId("import-file-input").setInputFiles({ name: "renamed.md", mimeType: "text/markdown", buffer: Buffer.from("# Original\n\nLocal document.") });
    await expect(page.getByText("Такой Markdown-файл уже есть в библиотеке. Новый документ не был создан.")).toBeVisible();
    await expect(page.locator(".library-list__link")).toHaveCount(1);
    const violations = await new AxeBuilder({ page }).include("[role='dialog']").analyze();
    expect(violations.violations).toEqual([]);
    await page.getByRole("link", { name: /Открыть существующий документ: Original/ }).click();
    await expect(page).toHaveURL(originalHref ?? /\/documents\//);
  });

  test("can add a possible update separately and cancel without touching the existing document", async ({ page }) => {
    await page.goto("/");
    await importMarkdown(page, "guide.md", "# Guide\n\nFirst version.");
    await page.getByRole("button", { name: "Готово" }).click();

    await page.getByTestId("library-import-trigger").click();
    await page.getByTestId("import-file-input").setInputFiles({ name: "guide.md", mimeType: "text/markdown", buffer: Buffer.from("# Guide revised\n\nSecond version.") });
    await expect(page.getByText("Найдена одна возможная версия для обновления. Выберите дальнейшее действие.")).toBeVisible();
    await page.getByRole("button", { name: "Добавить отдельно" }).click();
    await expect(page.locator(".import-overlay__notice")).toContainText("Документ готов.");
    await page.getByRole("button", { name: "Готово" }).click();
    await expect(page.locator(".library-list__link")).toHaveCount(2);

    await page.getByTestId("library-import-trigger").click();
    await page.getByTestId("import-file-input").setInputFiles({ name: "guide.md", mimeType: "text/markdown", buffer: Buffer.from("# Guide third\n\nThird version.") });
    await expect(page.getByText("Найдено несколько возможных версий. Сначала выберите документ.")).toBeVisible();
    await page.getByRole("radio").first().focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("radio").nth(1)).toBeChecked();
    await page.getByRole("button", { name: "Отменить" }).click();
    await expect(page.getByText("Импорт отменён.")).toBeVisible();
    await expect(page.locator(".library-list__link")).toHaveCount(2);
  });

  test("keeps Replace visibly gated until mapped replacement is available", async ({ page }) => {
    await page.goto("/");
    await importMarkdown(page, "guide.md", "# Guide\n\nFirst version.");
    await page.getByRole("button", { name: "Готово" }).click();
    await page.getByTestId("library-import-trigger").click();
    await page.getByTestId("import-file-input").setInputFiles({ name: "guide.md", mimeType: "text/markdown", buffer: Buffer.from("# Guide revised\n\nSecond version.") });
    await expect(page.getByRole("button", { name: "Заменить документ" })).toBeVisible();
    await page.getByRole("button", { name: "Заменить документ" }).click();
    await expect(page.getByText(/требует безопасного переноса позиции чтения/)).toBeVisible();
    await expect(page.locator(".library-list__link")).toHaveCount(1);
  });
});

async function importMarkdown(page: Page, name: string, markdown: string): Promise<void> {
  await page.getByTestId("library-import-trigger").click();
  await page.getByTestId("import-file-input").setInputFiles({ name, mimeType: "text/markdown", buffer: Buffer.from(markdown) });
  await expect(page.locator(".import-overlay__notice")).toContainText("Документ готов.");
}
