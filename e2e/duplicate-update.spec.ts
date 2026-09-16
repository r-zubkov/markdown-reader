import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import type * as IdentityModule from "../src/domain/documents/import-identity";
import type * as PipelineModule from "../src/domain/content/markdown-pipeline";
import type * as RepositoryModule from "../src/infrastructure/db/document-repository";

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

  test("does not replace when an explicit Replace with file selects identical bytes", async ({ page }) => {
    const markdown = "# Same document\n\nLocal content.";
    await page.goto("/");
    await importMarkdown(page, "same.md", markdown);
    await page.getByRole("button", { name: "Готово" }).click();
    await page.getByRole("button", { name: /Действия с документом: Same document/ }).click();
    await page.getByRole("menuitem", { name: "Заменить файлом" }).click();
    await expect(page.getByRole("dialog")).toContainText("Заменить «Same document»");
    await page.getByTestId("import-file-input").setInputFiles({ name: "same.md", mimeType: "text/markdown", buffer: Buffer.from(markdown) });
    await expect(page.getByText("Такой Markdown-файл уже есть в библиотеке. Новый документ не был создан.")).toBeVisible();
    await expect(page.locator(".library-list__link")).toHaveCount(1);
    expect(await readyVersionCount(page)).toBe(1);
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

  test("replaces in place with an exact mapped position and removes the old version", async ({ page }) => {
    await page.goto("/");
    await importMarkdown(page, "guide.md", "# Guide\n\nOpening.\n\nKeep this exact paragraph.\n\nClosing.");
    await page.getByRole("button", { name: "Готово" }).click();
    await persistBlock(page, 2);
    await page.getByTestId("library-import-trigger").click();
    await page.getByTestId("import-file-input").setInputFiles({ name: "guide.md", mimeType: "text/markdown", buffer: Buffer.from("# Guide\n\nOpening.\n\nInserted paragraph.\n\nKeep this exact paragraph.\n\nClosing.") });
    await expect(page.getByRole("button", { name: "Заменить документ" })).toBeVisible();
    await page.getByRole("button", { name: "Заменить документ" }).click();
    await expect(page.getByText("Документ заменён. Место чтения перенесено точно.")).toBeVisible();
    await expect(page.locator(".library-list__link")).toHaveCount(1);
    expect(await readyVersionCount(page)).toBe(1);
    await page.getByRole("link", { exact: true, name: "Открыть" }).click();
    await expect(page.getByText(/Место чтения восстановлено приблизительно|Сохранённое место чтения не найдено/)).toHaveCount(0);
  });

  test("reports approximate replacement before Open and once inside Reader", async ({ page }) => {
    await page.goto("/");
    await importMarkdown(page, "manual.md", "# Manual\n\nOverview.\n\n## Setup\n\nPrepare version one.\n\nFinish.");
    await page.getByRole("button", { name: "Готово" }).click();
    await persistBlock(page, 3);
    await page.getByTestId("library-import-trigger").click();
    await page.getByTestId("import-file-input").setInputFiles({ name: "manual.md", mimeType: "text/markdown", buffer: Buffer.from("# Manual\n\nOverview.\n\n## Setup\n\nPrepare version two carefully.\n\nFinish.") });
    await page.getByRole("button", { name: "Заменить документ" }).click();
    await expect(page.getByText(/Место чтения перенесено приблизительно/)).toBeVisible();
    await page.getByRole("link", { exact: true, name: "Открыть" }).click();
    await expect(page.getByText(/Место чтения восстановлено приблизительно/)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/Место чтения восстановлено приблизительно/)).toHaveCount(0);
  });

  test("starts a radical rewrite at the beginning with a one-time Reader notice", async ({ page }) => {
    await page.goto("/");
    await importMarkdown(page, "rewrite.md", "# Alpha reference\n\nAlpha opening.\n\n## Beta details\n\nOld anchor.\n\nAlpha ending.");
    await page.getByRole("button", { name: "Готово" }).click();
    await persistBlock(page, 3);
    await page.getByTestId("library-import-trigger").click();
    await page.getByTestId("import-file-input").setInputFiles({ name: "rewrite.md", mimeType: "text/markdown", buffer: Buffer.from("# Completely new material\n\nUnrelated opening.\n\n## Different subject\n\nUnrelated body.\n\nUnrelated ending.") });
    await page.getByRole("button", { name: "Заменить документ" }).click();
    await expect(page.getByText(/прежнее место чтения не найдено/)).toBeVisible();
    await page.getByRole("link", { exact: true, name: "Открыть" }).click();
    await expect(page.getByText(/Сохранённое место чтения не найдено/)).toBeVisible();
    await expect(page.locator("article")).toHaveAttribute("data-current-block-id", /.+/);
  });

  test("refreshes review after another tab wins the expected-current race", async ({ page }) => {
    await page.goto("/");
    await importMarkdown(page, "conflict.md", "# Conflict\n\nOriginal.");
    await page.getByRole("button", { name: "Готово" }).click();
    await page.getByTestId("library-import-trigger").click();
    await page.getByTestId("import-file-input").setInputFiles({ name: "conflict.md", mimeType: "text/markdown", buffer: Buffer.from("# Conflict\n\nStale choice.") });
    await expect(page.getByRole("button", { name: "Заменить документ" })).toBeVisible();
    const winnerCommitted = await commitWinningReplacement(page);
    expect(winnerCommitted).toBe(true);
    await page.getByRole("button", { name: "Заменить документ" }).click();
    await expect(page.getByText("Документ изменился в другой вкладке.")).toBeVisible();
    await expect(page.getByText("Готовые документы в библиотеке не изменены.")).toBeVisible();
  });
});

async function importMarkdown(page: Page, name: string, markdown: string): Promise<void> {
  await page.getByTestId("library-import-trigger").click();
  await page.getByTestId("import-file-input").setInputFiles({ name, mimeType: "text/markdown", buffer: Buffer.from(markdown) });
  await expect(page.locator(".import-overlay__notice")).toContainText("Документ готов.", { timeout: 15_000 });
}

async function persistBlock(page: Page, blockIndex: number): Promise<void> {
  const result = await page.evaluate(async (index) => {
    const modulePath = "/src/infrastructure/db/document-repository.ts";
    const repositoryModule = await import(modulePath) as typeof RepositoryModule;
    const repository = new repositoryModule.DexieDocumentRepository();
    try {
      const documents = await repository.listDocuments();
      if (!documents.ok || documents.value[0] === undefined) return false;
      const document = await repository.getCurrentDocument(documents.value[0].documentId);
      if (!document.ok) return false;
      const chunks = await repository.getCurrentChunkWindow({
        documentId: document.value.documentId,
        endOrdinalInclusive: document.value.chunkCount - 1,
        pipelineVersion: document.value.pipelineVersion,
        startOrdinal: 0,
      });
      if (!chunks.ok) return false;
      const selected = chunks.value.flatMap((chunk) => chunk.anchors.map((anchor) => ({ ...anchor, chunkOrdinal: chunk.ordinal })))[index];
      if (selected === undefined) return false;
      const saved = await repository.saveReaderAnchor({
        anchor: { ...selected.anchor, intraBlockRatio: 0.25 },
        documentId: document.value.documentId,
        progressRatio: selected.anchor.overallSourceRatio,
        updatedAt: Date.now(),
      });
      return saved.ok;
    } finally {
      repository.close();
    }
  }, blockIndex);
  expect(result).toBe(true);
}

async function readyVersionCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const request = indexedDB.open("markdown-reader");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => { resolve(request.result); };
      request.onerror = () => { reject(request.error ?? new Error("IndexedDB open failed.")); };
    });
    try {
      const transaction = database.transaction("documentVersions", "readonly");
      const countRequest = transaction.objectStore("documentVersions").count();
      return await new Promise<number>((resolve, reject) => {
        countRequest.onsuccess = () => { resolve(countRequest.result); };
        countRequest.onerror = () => { reject(countRequest.error ?? new Error("IndexedDB count failed.")); };
      });
    } finally {
      database.close();
    }
  });
}

async function commitWinningReplacement(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const repositoryModulePath = "/src/infrastructure/db/document-repository.ts";
    const pipelineModulePath = "/src/domain/content/markdown-pipeline.ts";
    const identityModulePath = "/src/domain/documents/import-identity.ts";
    const repositoryModule = await import(repositoryModulePath) as typeof RepositoryModule;
    const pipelineModule = await import(pipelineModulePath) as typeof PipelineModule;
    const identityModule = await import(identityModulePath) as typeof IdentityModule;
    const repository = new repositoryModule.DexieDocumentRepository();
    try {
      const documents = await repository.listDocuments();
      const target = documents.ok ? documents.value[0] : undefined;
      if (target === undefined) return false;
      const readerState = await repository.getReaderState(target.documentId);
      if (!readerState.ok || readerState.value === undefined) return false;
      const markdown = "# Conflict\n\nWinning version.";
      const bytes = new TextEncoder().encode(markdown);
      const pipeline = await pipelineModule.runMarkdownPipeline(bytes, "conflict.md");
      if (!pipeline.ok) return false;
      const jobId = crypto.randomUUID();
      const versionId = crypto.randomUUID();
      const staged = await repository.stageVersion({
        byteLength: pipeline.value.metadata.byteLength,
        charLength: pipeline.value.metadata.charLength,
        chunkCount: pipeline.value.metadata.chunkCount,
        contentHash: pipeline.value.metadata.contentHash,
        documentId: target.documentId,
        expectedCurrentVersionId: target.currentVersionId,
        fileName: "conflict.md",
        importedAt: Date.now(),
        jobId,
        layouts: pipeline.value.metadata.layouts,
        normalizedFileName: identityModule.normalizeIdentityFileName("conflict.md"),
        normalizedTitle: identityModule.normalizeIdentityText(pipeline.value.metadata.title),
        outline: pipeline.value.metadata.outline,
        pipelineVersion: pipeline.value.metadata.pipelineVersion,
        sourceBlob: new Blob([bytes], { type: "text/markdown" }),
        title: pipeline.value.metadata.title,
        versionId,
      });
      if (!staged.ok) return false;
      for (const batch of pipeline.value.batches) {
        const appended = await repository.appendChunkBatch({ batchOrdinal: batch.batchOrdinal, chunks: batch.chunks, jobId, versionId });
        if (!appended.ok) return false;
      }
      const committed = await repository.commitVersion({ jobId, readyAt: Date.now(), replacementReaderState: readerState.value, versionId });
      return committed.ok;
    } finally {
      repository.close();
    }
  });
}
