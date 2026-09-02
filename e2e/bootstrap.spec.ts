import { expect, test } from "@playwright/test";

test("renders the bootstrap screen", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Markdown Reader", level: 1 }),
  ).toBeVisible();
});
