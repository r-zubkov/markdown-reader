import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const requiredCsp = "default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self' 'sha256-38RhXrc7EdReTKsOm23ZPOCUgniTUUcjky8QOOrQx6o='; style-src-attr 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; manifest-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

describe("deployment security policy", () => {
  it("keeps executable bootstrap code in same-origin files", async () => {
    const indexHtml = await readRootFile("index.html");
    const scripts = [...indexHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/giu)];

    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) {
      expect(script[1]).toMatch(/\bsrc=/iu);
      expect(script[2]?.trim()).toBe("");
    }
    expect(indexHtml).toContain('src="%BASE_URL%theme-bootstrap.js"');
  });

  it("ships a host-readable CSP and complementary response headers", async () => {
    const headers = await readRootFile("public/_headers");

    expect(headers).toContain(`Content-Security-Policy: ${requiredCsp}`);
    expect(headers).toContain("style-src-attr 'unsafe-inline'");
    expect(headers).not.toMatch(/script-src[^;]*'unsafe-inline'/u);
    expect(headers).not.toMatch(/style-src (?!-attr)[^;]*'unsafe-inline'/u);
    expect(headers).not.toContain("'unsafe-eval'");
    expect(headers).toContain("Referrer-Policy: no-referrer");
    expect(headers).toContain("X-Content-Type-Options: nosniff");
    expect(headers).toContain("X-Frame-Options: DENY");
  });
});

async function readRootFile(relativePath: string): Promise<string> {
  return readFile(resolve(process.cwd(), relativePath), "utf8");
}
