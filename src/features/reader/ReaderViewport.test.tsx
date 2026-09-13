import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReaderChunk } from "@/application/ports/document-repository";
import { PIPELINE_VERSION } from "@/domain/content/pipeline-limits";
import { createReaderRangeExtractor, READER_VIRTUAL_CONFIG } from "@/features/reader/reader-virtual-config";
import { ReaderViewport } from "@/features/reader/ReaderViewport";
import { DexieDocumentRepository } from "@/infrastructure/db/document-repository";
import { createSingleSectionLayouts } from "@/infrastructure/db/storage-atomicity-spike";

class ResizeObserverStub {
  public disconnect(): void { return undefined; }
  public observe(): void { return undefined; }
  public unobserve(): void { return undefined; }
}

describe("ReaderViewport", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    vi.spyOn(window, "scrollBy").mockImplementation(() => undefined);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("renders repository-branded chunks behind bounded production metrics", async () => {
    const chunks = createChunks(0, 0);
    render(<ReaderViewport
      document={{ chunkCount: 1, documentId: "document", layouts: createSingleSectionLayouts(1), outline: [], pipelineVersion: PIPELINE_VERSION, title: "Document", versionId: "version" }}
      focusTarget={false}
      initialChunks={chunks}
      onFatalError={vi.fn()}
      onLocationChange={vi.fn()}
      onTargetSettled={vi.fn()}
      repository={new DexieDocumentRepository(`reader-viewport-${crypto.randomUUID()}`)}
      targetOrdinal={0}
      targetRequestKey="initial"
    />);

    const viewport = screen.getByTestId("reader-viewport");
    await waitFor(() => {
      expect(screen.getByText("Chunk 0")).toBeInTheDocument();
      expect(Number(viewport.dataset.mountedCount)).toBeLessThanOrEqual(READER_VIRTUAL_CONFIG.mountedItemBudget);
      expect(Number(viewport.dataset.cacheCount)).toBeLessThanOrEqual(READER_VIRTUAL_CONFIG.cacheLimit);
    });
  });

  it("keeps a disjoint focus pin in stable ordinal order", () => {
    const range = { count: 100, endIndex: 18, overscan: 8, startIndex: 10 };
    const ordinals = createReaderRangeExtractor(2)(range);
    expect(ordinals[0]).toBe(2);
    expect(ordinals).toEqual([...ordinals].sort((left, right) => left - right));
  });
});

function createChunks(start: number, end: number): readonly ReaderChunk[] {
  return Array.from({ length: end - start + 1 }, (_, index) => ({
    anchors: [], estimatedCost: 100,
    html: { pipelineVersion: PIPELINE_VERSION, value: `<p>Chunk ${String(start + index)}</p>` } as ReaderChunk["html"],
    ordinal: start + index, renderState: "ready" as const,
  }));
}
