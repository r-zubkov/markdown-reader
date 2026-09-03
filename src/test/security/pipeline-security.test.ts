import { describe, expect, it } from "vitest";

import { runMarkdownPipelineFromText } from "@/domain/content/markdown-pipeline";
import type { PipelineRunResult, PipelineSuccess } from "@/domain/content/pipeline-types";
import { createPipelineCorpus } from "@/test/corpus/pipeline-corpus";

describe("Markdown pipeline security corpus", () => {
  it("keeps raw HTML inert and removes executable or clobbering output", async () => {
    const fixture = getMaliciousFixture();
    const success = expectPipelineSuccess(
      await runMarkdownPipelineFromText(fixture.markdown, fixture.fileName),
    );
    const root = renderRoot(success);
    const blockedTags = [
      "script",
      "style",
      "iframe",
      "object",
      "embed",
      "form",
      "base",
      "meta",
      "link",
    ];

    for (const tagName of blockedTags) {
      expect(root.querySelector(tagName)).toBeNull();
    }

    for (const element of Array.from(root.querySelectorAll("*"))) {
      for (const attribute of Array.from(element.attributes)) {
        expect(attribute.name.toLowerCase().startsWith("on")).toBe(false);
        expect(attribute.name).not.toBe("style");
        expect(attribute.name).not.toBe("name");

        if (attribute.name === "id") {
          expect(attribute.value.startsWith("mdr-")).toBe(true);
        }
      }
    }

    expect(root.textContent).toContain("<script>alert('raw-script')</script>");
    expect(warningCount(success, "RAW_HTML_ESCAPED")).toBeGreaterThan(0);
  });

  it("blocks unsafe link protocols while preserving safe link text", async () => {
    const fixture = getMaliciousFixture();
    const success = expectPipelineSuccess(
      await runMarkdownPipelineFromText(fixture.markdown, fixture.fileName),
    );
    const root = renderRoot(success);

    expect(root).toHaveTextContent("javascript link");
    expect(root).toHaveTextContent("encoded protocol");

    for (const link of Array.from(root.querySelectorAll("a[href]"))) {
      const href = link.getAttribute("href") ?? "";
      expect(href).not.toMatch(/^(?:javascript|data|file|blob):/iu);
      expect(href.startsWith("#mdr-") || href.startsWith("https://") || href.startsWith("mailto:")).toBe(
        true,
      );
    }

    expect(warningCount(success, "UNSAFE_URL_BLOCKED")).toBeGreaterThanOrEqual(2);
  });

  it("allows only HTTPS and small safe raster data images", async () => {
    const fixture = getMaliciousFixture();
    const success = expectPipelineSuccess(
      await runMarkdownPipelineFromText(fixture.markdown, fixture.fileName),
    );
    const root = renderRoot(success);
    const images = Array.from(root.querySelectorAll("img"));
    const imageSources = images.map((image) => image.getAttribute("src") ?? "");

    expect(imageSources.some((src) => src.startsWith("https://example.com/image.png"))).toBe(
      true,
    );
    expect(imageSources.some((src) => src.startsWith("data:image/png;base64,"))).toBe(true);
    expect(imageSources.some((src) => src.startsWith("http://"))).toBe(false);
    expect(imageSources.some((src) => src.startsWith("data:image/svg"))).toBe(false);
    expect(root.querySelectorAll(".mdr-image-placeholder").length).toBeGreaterThanOrEqual(3);

    for (const image of images) {
      expect(image.getAttribute("loading")).toBe("lazy");
      expect(image.getAttribute("decoding")).toBe("async");
      expect(image.getAttribute("referrerpolicy")).toBe("no-referrer");
    }

    expect(warningCount(success, "UNSUPPORTED_IMAGE")).toBeGreaterThanOrEqual(3);
  });
});

function getMaliciousFixture() {
  const fixture = createPipelineCorpus().find((candidate) => candidate.id === "malicious");

  if (fixture === undefined) {
    throw new Error("Missing malicious corpus fixture.");
  }

  return fixture;
}

function expectPipelineSuccess(result: PipelineRunResult): PipelineSuccess {
  if (!result.ok) {
    throw new Error(`Pipeline failed with ${result.error.code}.`);
  }

  return result.value;
}

function renderRoot(success: PipelineSuccess): HTMLElement {
  const root = document.createElement("main");
  root.innerHTML = success.chunks.map((chunk) => chunk.html).join("\n");
  return root;
}

function warningCount(success: PipelineSuccess, code: string): number {
  return success.metadata.warnings.find((warning) => warning.code === code)?.count ?? 0;
}
