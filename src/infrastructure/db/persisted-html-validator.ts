import { PIPELINE_LIMITS } from "@/domain/content/pipeline-limits";

const allowedTags = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "img",
  "input",
  "li",
  "ol",
  "p",
  "pre",
  "section",
  "span",
  "strong",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

const attributeNames: Readonly<Record<string, ReadonlySet<string>>> = {
  a: new Set(["aria-describedby", "aria-label", "class", "data-footnote-backref", "data-footnote-ref", "href", "id", "rel", "target"]),
  code: new Set(["class"]),
  h1: new Set(["id"]),
  h2: new Set(["class", "id"]),
  h3: new Set(["id"]),
  h4: new Set(["id"]),
  h5: new Set(["id"]),
  h6: new Set(["id"]),
  img: new Set(["alt", "decoding", "loading", "referrerpolicy", "src"]),
  input: new Set(["checked", "disabled", "type"]),
  li: new Set(["class", "id"]),
  ol: new Set(["aria-describedby", "aria-label", "class"]),
  section: new Set(["class", "data-footnotes"]),
  span: new Set(["class", "role"]),
  sup: new Set(["id"]),
  table: new Set(["aria-describedby", "aria-label"]),
  td: new Set(["align"]),
  th: new Set(["align"]),
  ul: new Set(["aria-describedby", "aria-label", "class"]),
};

const maximumPersistedChunkCharacters = PIPELINE_LIMITS.maxFileBytes * 8;

/**
 * Validates, but never repairs, serialized pipeline output before the repository
 * applies the SanitizedHtml brand. A mismatch is treated as corrupt derived data.
 */
export function isPersistedHtmlAllowed(value: string): boolean {
  if (value.length > maximumPersistedChunkCharacters) return false;

  const template = document.createElement("template");

  try {
    template.innerHTML = value;
  } catch {
    return false;
  }

  return [...template.content.childNodes].every((node) => isAllowedNode(node));
}

function isAllowedNode(node: Node): boolean {
  if (node.nodeType === Node.TEXT_NODE) return true;
  if (node.nodeType !== Node.ELEMENT_NODE) return false;

  const element = node as Element;
  const tagName = element.localName;

  if (!allowedTags.has(tagName) || !hasOnlyAllowedAttributes(element, tagName)) return false;
  if (!hasAllowedAttributeValues(element, tagName)) return false;
  if (!hasAllowedTableContext(element, tagName)) return false;

  return [...element.childNodes].every((child) => isAllowedNode(child));
}

function hasOnlyAllowedAttributes(element: Element, tagName: string): boolean {
  const allowed = attributeNames[tagName] ?? new Set<string>();
  return [...element.attributes].every((attribute) => allowed.has(attribute.name));
}

function hasAllowedAttributeValues(element: Element, tagName: string): boolean {
  const id = element.getAttribute("id");
  if (id !== null && !isGeneratedId(id)) return false;

  switch (tagName) {
    case "a":
      return isAllowedAnchor(element);
    case "code":
      return hasAllowedClasses(element, [/^hljs$/u, /^language-[a-z0-9-]+$/u]);
    case "h2":
      return hasAllowedClasses(element, [/^sr-only$/u]);
    case "img":
      return isAllowedImage(element);
    case "input":
      return element.getAttribute("type") === "checkbox" && element.hasAttribute("disabled");
    case "li":
      return hasAllowedClasses(element, [/^task-list-item$/u]);
    case "ol":
    case "ul":
      return hasAllowedClasses(element, [/^contains-task-list$/u]);
    case "section":
      return element.hasAttribute("data-footnotes") && hasAllowedClasses(element, [/^footnotes$/u]);
    case "span":
      return isAllowedSpan(element);
    case "td":
    case "th": {
      const align = element.getAttribute("align");
      return align === null || align === "left" || align === "center" || align === "right";
    }
    default:
      return true;
  }
}

function isAllowedAnchor(element: Element): boolean {
  if (!hasAllowedClasses(element, [/^data-footnote-backref$/u])) return false;

  const href = element.getAttribute("href");
  const target = element.getAttribute("target");
  const rel = element.getAttribute("rel");

  if (href === null) return target === null && rel === null;
  if ((href.startsWith("#") && isGeneratedId(href.slice(1))) || /^mailto:[^\s]+$/u.test(href)) {
    return target === null && rel === null;
  }

  if (!/^https?:\/\//u.test(href) || target !== "_blank") return false;

  const relations = new Set((rel ?? "").split(/\s+/u).filter(Boolean));
  return relations.size === 2 && relations.has("noopener") && relations.has("noreferrer");
}

function isAllowedImage(element: Element): boolean {
  const source = element.getAttribute("src");

  return source !== null
    && (isCanonicalHttpsUrl(source) || isAllowedRasterDataImage(source))
    && element.getAttribute("decoding") === "async"
    && element.getAttribute("loading") === "lazy"
    && element.getAttribute("referrerpolicy") === "no-referrer";
}

function isAllowedSpan(element: Element): boolean {
  if (!hasAllowedClasses(element, [/^mdr-image-placeholder$/u, /^hljs(?:-[a-z0-9-]+)?$/u])) return false;

  const role = element.getAttribute("role");
  const classes = classTokens(element);
  return classes.includes("mdr-image-placeholder") ? role === "note" : role === null;
}

function hasAllowedClasses(element: Element, patterns: readonly RegExp[]): boolean {
  return classTokens(element).every((token) => patterns.some((pattern) => pattern.test(token)));
}

function classTokens(element: Element): readonly string[] {
  return (element.getAttribute("class") ?? "").split(/\s+/u).filter(Boolean);
}

function hasAllowedTableContext(element: Element, tagName: string): boolean {
  if (tagName === "tbody" || tagName === "thead" || tagName === "tr" || tagName === "td" || tagName === "th") {
    for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
      if (parent.localName === "table") return true;
    }
    return false;
  }
  return true;
}

function isCanonicalHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.href === value;
  } catch {
    return false;
  }
}

function isGeneratedId(value: string): boolean {
  return /^mdr-[^\s"'<>]+$/u.test(value);
}

function isAllowedRasterDataImage(value: string): boolean {
  const match = /^data:image\/(png|jpeg|gif|webp|avif);base64,([a-z0-9+/=]+)$/iu.exec(value);
  const encoded = match?.[2];
  if (encoded === undefined) return false;
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  return Math.floor((encoded.length * 3) / 4) - padding <= PIPELINE_LIMITS.safeDataImageBytes;
}
