import { expect, test } from "@playwright/test";

test.describe("P05-T03 storage and remote-media privacy", () => {
  test("persists the remote-media choice and makes no third-party request while it is disabled", async ({ page }) => {
    const remoteRequests: string[] = [];
    await page.route("https://assets.example/privacy-diagram.png", async (route) => {
      remoteRequests.push(route.request().url());
      await route.fulfill({ body: "not-an-image", contentType: "image/png" });
    });
    await page.goto("/");
    await page.getByTestId("library-import-trigger").click();
    await page.getByTestId("import-file-input").setInputFiles({
      name: "privacy.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Privacy\n\n![Diagram](https://assets.example/privacy-diagram.png)"),
    });
    await expect(page.locator(".library-list__link")).toBeVisible();
    await page.getByRole("button", { name: "Готово" }).click();

    await page.getByRole("button", { name: /Внешние изображения: включены/u }).click();
    await expect(page.getByRole("button", { name: /Внешние изображения: выключены/u })).toBeVisible();
    await page.locator(".library-list__link").click();
    await expect(page.locator(".reader-content__media-placeholder")).toBeVisible();
    expect(remoteRequests).toEqual([]);

    await page.getByRole("button", { name: /Внешние изображения: выключены/u }).click();
    await expect.poll(() => remoteRequests.length).toBeGreaterThan(0);
    await page.reload();
    await expect(page.getByRole("button", { name: /Внешние изображения: включены/u })).toBeVisible();
  });
});
