const forbiddenDomainImports = [
  /^react(?:\/.*)?$/,
  /^react-dom(?:\/.*)?$/,
  /^react-router(?:\/.*)?$/,
  /^dexie(?:\/.*)?$/,
  /^@\/app(?:\/.*)?$/,
  /^@\/features(?:\/.*)?$/,
  /^@\/infrastructure(?:\/.*)?$/,
  /^@\/ui(?:\/.*)?$/,
  /^@\/workers(?:\/.*)?$/,
];

function normalizeFilePath(filename) {
  return filename.replaceAll("\\", "/");
}

function isDomainFile(filename) {
  return normalizeFilePath(filename).includes("/src/domain/");
}

function getJsxElementName(node) {
  if (node.type === "JSXIdentifier") {
    return node.name;
  }

  return null;
}

function getJsxAttributeName(node) {
  if (node.type === "JSXIdentifier") {
    return node.name;
  }

  return null;
}

export const markdownReaderBoundaryRules = {
  "domain-no-forbidden-imports": {
    meta: {
      type: "problem",
      docs: {
        description:
          "Prevent domain modules from importing UI, platform, router or storage layers.",
      },
      messages: {
        forbidden:
          "Domain modules must stay pure and cannot import '{{importSource}}'.",
      },
      schema: [],
    },
    create(context) {
      const filename = context.filename ?? "";
      const applies = isDomainFile(filename);

      return {
        ImportDeclaration(node) {
          if (!applies || typeof node.source.value !== "string") {
            return;
          }

          const importSource = node.source.value;
          if (forbiddenDomainImports.some((pattern) => pattern.test(importSource))) {
            context.report({
              node,
              messageId: "forbidden",
              data: { importSource },
            });
          }
        },
      };
    },
  },
  "no-unsafe-inner-html": {
    meta: {
      type: "problem",
      docs: {
        description:
          "Reserve dangerouslySetInnerHTML for the future SafeHtmlChunk boundary.",
      },
      messages: {
        forbidden:
          "dangerouslySetInnerHTML is only allowed inside src/ui/primitives/SafeHtmlChunk.",
      },
      schema: [],
    },
    create(context) {
      const filename = normalizeFilePath(context.filename ?? "");
      const safeHtmlBoundary = filename.endsWith("/src/ui/primitives/SafeHtmlChunk.tsx");

      return {
        JSXAttribute(node) {
          const name = getJsxAttributeName(node.name);
          if (name === "dangerouslySetInnerHTML" && !safeHtmlBoundary) {
            context.report({ node, messageId: "forbidden" });
          }
        },
      };
    },
  },
  "jsx-img-requires-alt": {
    meta: {
      type: "problem",
      docs: {
        description: "Require alt text on JSX img elements.",
      },
      messages: {
        missingAlt: "Images must include an alt attribute.",
      },
      schema: [],
    },
    create(context) {
      return {
        JSXOpeningElement(node) {
          const name = getJsxElementName(node.name);
          if (name !== "img") {
            return;
          }

          const hasAlt = node.attributes.some((attribute) => {
            return (
              attribute.type === "JSXAttribute" &&
              getJsxAttributeName(attribute.name) === "alt"
            );
          });

          if (!hasAlt) {
            context.report({ node, messageId: "missingAlt" });
          }
        },
      };
    },
  },
};

export const markdownReaderBoundaryPlugin = {
  rules: markdownReaderBoundaryRules,
};
