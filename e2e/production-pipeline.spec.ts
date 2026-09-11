import { expect, test } from "@playwright/test";

test("production worker imports and renders the supported semantic/security corpus", async ({ page }) => {
  const markdown = [
    "# Production pipeline",
    "",
    "[Jump to details](#details) and [external](https://example.com/docs).",
    "",
    "## Features",
    "",
    "- [x] Task list",
    "",
    "| Feature | State |",
    "| --- | --- |",
    "| GFM | ready |",
    "",
    "```ts",
    "const answer: number = 42;",
    "```",
    "",
    "First reference.[^shared]",
    "",
    "## Details",
    "",
    "Repeated reference.[^shared]",
    "",
    "<script>globalThis.pipelineExecuted = true</script>",
    "",
    "[^shared]: One shared footnote.",
  ].join("\n");

  await page.goto("/");
  await page.getByTestId("import-file-input").setInputFiles({
    name: "production-corpus.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(markdown),
  });
  await expect(page.getByText("Документ готов.")).toBeVisible();
  await page.getByRole("link", { name: /Production pipeline/ }).click();

  await expect(page.locator(".reader-content h1")).toContainText("Production pipeline");
  await expect(page.getByRole("columnheader", { name: "Feature", exact: true })).toBeVisible();
  await expect(page.locator("code.hljs.language-typescript")).toContainText("answer");
  await expect(page.locator("section.footnotes")).toHaveCount(1);
  await expect(page.locator("a[data-footnote-backref]")).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Jump to details" })).toHaveAttribute("href", "#mdr-h-details-1");
  await expect(page.getByRole("link", { name: "external" })).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.locator(".reader-content script")).toHaveCount(0);
  await expect(page.locator("main")).toContainText("<script>globalThis.pipelineExecuted = true</script>");
  expect(await page.evaluate(() => "pipelineExecuted" in globalThis)).toBe(false);
});
