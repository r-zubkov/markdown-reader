import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

import { markdownReaderBoundaryPlugin } from "../../tools/eslint-rules/markdown-reader-boundaries.mjs";

function createBoundaryLinter() {
  return new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.tsx"],
        plugins: {
          "markdown-reader-boundaries": markdownReaderBoundaryPlugin,
        },
        languageOptions: {
          ecmaVersion: "latest",
          parserOptions: {
            ecmaFeatures: {
              jsx: true,
            },
          },
          sourceType: "module",
        },
        rules: {
          "markdown-reader-boundaries/domain-no-forbidden-imports": "error",
          "markdown-reader-boundaries/jsx-img-requires-alt": "error",
        },
      },
    ],
  });
}

describe("markdown-reader ESLint boundaries", () => {
  it("reports forbidden imports from domain modules", async () => {
    const [result] = await createBoundaryLinter().lintText(
      "import { useState } from 'react';\nexport const value = useState;",
      { filePath: "E:/Github/markdown-reader/src/domain/documents/example.tsx" },
    );

    expect(result?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "markdown-reader-boundaries/domain-no-forbidden-imports",
        }),
      ]),
    );
  });

  it("keeps accessibility lint active for JSX images", async () => {
    const [result] = await createBoundaryLinter().lintText(
      "export function Example() { return <img src=\"/cover.png\" />; }",
      { filePath: "E:/Github/markdown-reader/src/app/example.tsx" },
    );

    expect(result?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "markdown-reader-boundaries/jsx-img-requires-alt",
        }),
      ]),
    );
  });
});
