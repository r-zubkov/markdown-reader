import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReaderChunk } from "@/application/ports/document-repository";
import { PIPELINE_VERSION } from "@/domain/content/pipeline-limits";
import { SafeHtmlChunk } from "@/ui/primitives/SafeHtmlChunk";

class ResizeObserverStub {
  public disconnect(): void { return undefined; }
  public observe(): void { return undefined; }
  public unobserve(): void { return undefined; }
}

describe("SafeHtmlChunk", () => {
  beforeEach(() => { vi.stubGlobal("ResizeObserver", ResizeObserverStub); });

  it("does not permit an ordinary string at the only HTML injection boundary", () => {
    // @ts-expect-error SanitizedHtml has a repository-owned, unexported-symbol brand.
    const unsafeElement = <SafeHtmlChunk html="<img src=x onerror=alert(1)>" ordinal={0} />;
    expect(unsafeElement.type).toBe(SafeHtmlChunk);
  });

  it("localizes a remote image failure without removing safe prose", async () => {
    const html = { pipelineVersion: PIPELINE_VERSION, value: '<p>Readable text</p><img alt="Diagram" src="https://example.invalid/image.png">' } as ReaderChunk["html"];
    const { container } = render(<SafeHtmlChunk html={html} ordinal={0} />);
    const image = container.querySelector("img");
    if (image === null) throw new Error("Expected image fixture.");
    fireEvent.error(image);

    expect(screen.getByText("Readable text")).toBeVisible();
    expect(await screen.findByText(/Изображение не загрузилось/u)).toBeVisible();
    expect(image).not.toBeVisible();
  });
});
