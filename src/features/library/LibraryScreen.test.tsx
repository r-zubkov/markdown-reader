import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { PIPELINE_VERSION, DexieDocumentRepository } from "@/infrastructure/db/document-repository";
import { deleteStorageAtomicitySpikeDatabase, type StorageAtomicityFailureHooks } from "@/infrastructure/db/storage-atomicity-spike";
import { createStorageChunks, createStorageStageInput } from "@/test/fixtures/storage-atomicity-fixtures";
import { LibraryScreen } from "./LibraryScreen";
import { libraryCopy } from "./copy";

const databaseNames: string[] = [];
afterEach(async () => { await Promise.all(databaseNames.splice(0).map(async (name) => deleteStorageAtomicitySpikeDatabase(name))); });

describe("LibraryScreen delete flow", () => {
  it("requires confirmation, returns focus to its menu on cancel, and sends last-item focus to the empty CTA", async () => {
    const repository = createRepository("success");
    await commitDocument(repository, { documentId: "only-document", jobId: "only-job", title: "Only document", versionId: "only-version" });
    render(<MemoryRouter><LibraryScreen repository={repository} /></MemoryRouter>);

    const menuTrigger = await screen.findByRole("button", { name: `${libraryCopy.actions}: Only document` });
    fireEvent.click(menuTrigger);
    fireEvent.click(await screen.findByRole("menuitem", { name: libraryCopy.deleteDocument.action }));
    const dialog = await screen.findByRole("alertdialog");
    const cancel = screen.getByRole("button", { name: libraryCopy.deleteDocument.cancel });
    await waitFor(() => expect(cancel).toHaveFocus());
    expect(dialog).toHaveTextContent(libraryCopy.deleteDocument.description);

    fireEvent.click(cancel);
    await waitFor(() => expect(menuTrigger).toHaveFocus());

    fireEvent.click(menuTrigger);
    fireEvent.click(await screen.findByRole("menuitem", { name: libraryCopy.deleteDocument.action }));
    fireEvent.click(screen.getByRole("button", { name: libraryCopy.deleteDocument.action }));
    await waitFor(() => {
      const emptyCta = document.querySelector<HTMLElement>("[data-library-empty-cta]");
      expect(emptyCta).toHaveFocus();
    });
    repository.close();
  });

  it("keeps the row and exposes Retry and Cancel after a transactional failure", async () => {
    const repository = createRepository("failure", { beforeDocumentDelete: () => { throw new Error("forced failure"); } });
    await commitDocument(repository, { documentId: "safe-document", jobId: "safe-job", title: "Safe document", versionId: "safe-version" });
    render(<MemoryRouter><LibraryScreen repository={repository} /></MemoryRouter>);

    fireEvent.click(await screen.findByRole("button", { name: `${libraryCopy.actions}: Safe document` }));
    fireEvent.click(await screen.findByRole("menuitem", { name: libraryCopy.deleteDocument.action }));
    fireEvent.click(screen.getByRole("button", { name: libraryCopy.deleteDocument.action }));
    expect(await screen.findByRole("alert")).toHaveTextContent(libraryCopy.deleteDocument.error);
    expect(screen.getByText("Safe document")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: libraryCopy.deleteDocument.retry })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: libraryCopy.deleteDocument.cancel })).toBeInTheDocument();
    repository.close();
  });
});

function createRepository(testName: string, failureHooks?: StorageAtomicityFailureHooks): DexieDocumentRepository {
  const databaseName = `markdown-reader-library-${testName}-${crypto.randomUUID()}`;
  databaseNames.push(databaseName);
  return new DexieDocumentRepository(databaseName, failureHooks);
}

async function commitDocument(repository: DexieDocumentRepository, input: { readonly documentId: string; readonly jobId: string; readonly title: string; readonly versionId: string }): Promise<void> {
  const staged = createStorageStageInput({ ...input, chunkCount: 1 });
  const version = { ...staged, pipelineVersion: PIPELINE_VERSION };
  await repository.stageVersion(version);
  await repository.appendChunkBatch({ batchOrdinal: 0, chunks: createStorageChunks(1, { pipelineVersion: PIPELINE_VERSION }), jobId: version.jobId, versionId: version.versionId });
  await repository.commitVersion({ jobId: version.jobId, readyAt: version.importedAt + 1, versionId: version.versionId });
}
