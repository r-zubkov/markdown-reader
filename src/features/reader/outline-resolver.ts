import type { OutlineItem } from "@/domain/content/pipeline-types";

export type HashResolution =
  | { readonly kind: "none" }
  | { readonly kind: "valid"; readonly heading: OutlineItem }
  | { readonly kind: "invalid" };

/** Resolves only persisted H1-H3 IDs; arbitrary fragments never become reader targets. */
export function resolveReaderHash(hash: string, outline: readonly OutlineItem[]): HashResolution {
  if (hash === "") return { kind: "none" };
  let id: string;
  try { id = decodeURIComponent(hash.startsWith("#") ? hash.slice(1) : hash); } catch { return { kind: "invalid" }; }
  if (id === "") return { kind: "invalid" };
  const heading = outline.find((item) => item.id === id);
  return heading === undefined ? { kind: "invalid" } : { kind: "valid", heading };
}

export function replaceReaderHash(id: string): void {
  const encoded = `#${encodeURIComponent(id)}`;
  if (window.location.hash === encoded) return;
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}${encoded}`);
}
