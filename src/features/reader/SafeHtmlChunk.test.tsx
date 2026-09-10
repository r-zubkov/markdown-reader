import { describe, expect, it } from "vitest";

import { SafeHtmlChunk } from "@/ui/primitives/SafeHtmlChunk";

describe("SafeHtmlChunk", () => {
  it("does not permit an ordinary string at the only HTML injection boundary", () => {
    // @ts-expect-error SanitizedHtml has a repository-owned, unexported-symbol brand.
    const unsafeElement = <SafeHtmlChunk html="<img src=x onerror=alert(1)>" ordinal={0} />;
    expect(unsafeElement.type).toBe(SafeHtmlChunk);
  });
});
