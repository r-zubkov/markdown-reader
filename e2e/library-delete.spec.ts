import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.describe("P04-T01 Library delete lifecycle", () => {
  test("requires confirmation, cancels safely, deletes the last item and preserves 320 px reflow", async ({ page }) => {
    await page.setViewportSize({ height: 720, width: 320 });
    await page.goto("/");
    await importMarkdown(page, "delete-me.md", "# Delete me\n\nLocal document.");
    await page.locator(".import-overlay__footer button").first().click();

    const menuTrigger = page.getByRole("button", { name: "Действия с документом: Delete me" });
    await menuTrigger.click();
    await page.getByRole("menuitem", { name: "Удалить документ" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Документ, настройки и прогресс чтения");
    await expect(page.getByRole("button", { name: "Отмена" })).toBeFocused();
    expect((await new AxeBuilder({ page }).include("[role='alertdialog']").analyze()).violations).toEqual([]);

    await page.getByRole("button", { name: "Отмена" }).click();
    await expect(menuTrigger).toBeFocused();

    await menuTrigger.click();
    await page.getByRole("menuitem", { name: "Удалить документ" }).click();
    await page.getByRole("button", { name: "Удалить документ" }).click();
    await expect(page.locator(".library-list__link")).toHaveCount(0);
    await expect(page.locator("[data-library-empty-cta]")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("keeps the Document visible and offers recovery when IndexedDB deletion fails", async ({ page }) => {
    await page.goto("/");
    await importMarkdown(page, "safe.md", "# Safe document\n\nLocal document.");
    await page.locator(".import-overlay__footer button").first().click();

    await page.evaluate(() => {
      type ObjectStoreDelete = (this: IDBObjectStore, key: IDBValidKey | IDBKeyRange) => IDBRequest<undefined>;
      const isObjectStoreDelete = (value: unknown): value is ObjectStoreDelete => typeof value === "function";
      const originalDelete: unknown = Object.getOwnPropertyDescriptor(IDBObjectStore.prototype, "delete")?.value;
      if (!isObjectStoreDelete(originalDelete)) throw new Error("IndexedDB delete is unavailable.");
      IDBObjectStore.prototype.delete = function deleteDocumentRecord(key: IDBValidKey | IDBKeyRange): IDBRequest<undefined> {
        if (this.name === "documents") throw new DOMException("Forced delete failure", "UnknownError");
        return Reflect.apply(originalDelete, this, [key]);
      };
    });
    await page.getByRole("button", { name: "Действия с документом: Safe document" }).click();
    await page.getByRole("menuitem", { name: "Удалить документ" }).click();
    await page.getByRole("button", { name: "Удалить документ" }).click();
    await expect(page.getByRole("alert")).toContainText("Не удалось удалить документ");
    await expect(page.locator(".library-list__link")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Повторить удаление" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Отмена" })).toBeVisible();
  });
});

async function importMarkdown(page: Page, name: string, markdown: string): Promise<void> {
  await page.getByTestId("library-import-trigger").click();
  await page.getByTestId("import-file-input").setInputFiles({ name, mimeType: "text/markdown", buffer: Buffer.from(markdown) });
  await expect(page.locator(".import-overlay__notice")).toBeVisible();
}
