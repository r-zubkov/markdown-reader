import { describe, expect, it } from "vitest";

import { runMarkdownPipelineFromText } from "@/domain/content/markdown-pipeline";
import { isPersistedHtmlAllowed } from "@/infrastructure/db/persisted-html-validator";
import { createPipelineCorpus } from "@/test/corpus/pipeline-corpus";

describe("persisted HTML trust boundary", () => {
  it("accepts every canonical pipeline chunk in the security corpus", async () => {
    for (const fixture of createPipelineCorpus()) {
      const result = await runMarkdownPipelineFromText(fixture.markdown, fixture.fileName);
      if (!result.ok) throw new Error(`Pipeline failed for ${fixture.id}: ${result.error.code}`);

      for (const chunk of result.value.chunks) {
        expect(isPersistedHtmlAllowed(chunk.html), fixture.id).toBe(true);
      }
    }
  });

  it.each([
    '<p data-unexpected="true">Unexpected attribute</p>',
    '<form><button type="submit">Unexpected control</button></form>',
    '<img alt="x" decoding="async" loading="lazy" referrerpolicy="no-referrer" src="data:image/png;base64,iVBORw0KGgo=" onload="unexpected()">',
    '<a href="https://example.com/" rel="noopener" target="_blank">Incomplete external-link policy</a>',
    '<span id="mdr-unexpected">Unexpected identifier owner</span>',
    '<iframe srcdoc="Unexpected embedded document"></iframe>',
  ])("rejects derived markup outside the canonical allowlist", (html) => {
    expect(isPersistedHtmlAllowed(html)).toBe(false);
  });
});
