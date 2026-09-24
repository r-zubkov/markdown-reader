import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { ReaderBlockAnchorSnapshot, SanitizedHtml } from "@/application/ports/document-repository";
import { PIPELINE_LIMITS } from "@/domain/content/pipeline-limits";
import { markMeaningfulBlocks } from "@/features/reader/reader-location-observer";
import { useRemoteImagesPolicy } from "@/features/platform-status/PlatformStatusProvider";
import { platformStatusCopy } from "@/features/platform-status/copy";
import { appCopy } from "@/shared/i18n/ru";

interface SafeHtmlChunkProps {
  readonly anchors?: readonly ReaderBlockAnchorSnapshot[];
  readonly html: SanitizedHtml;
  readonly ordinal: number;
}

/** The sole HTML injection boundary; its input can only originate in the validated repository. */
export const SafeHtmlChunk = memo(function SafeHtmlChunk({ anchors = [], html, ordinal }: SafeHtmlChunkProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [failedMediaCount, setFailedMediaCount] = useState(0);
  const { enabled: remoteImagesEnabled, online } = useRemoteImagesPolicy();
  const renderedHtml = useMemo(() => applyMediaPolicy(html.value, { enabled: remoteImagesEnabled, online }), [html.value, remoteImagesEnabled, online]);

  useEffect(() => { setFailedMediaCount(0); }, [renderedHtml]);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (content !== null) markMeaningfulBlocks(content, anchors);
  }, [anchors, renderedHtml]);

  useEffect(() => {
    const content = contentRef.current;
    if (content === null) return;
    const cleanups: (() => void)[] = [];
    const resizeObservers: ResizeObserver[] = [];

    for (const table of content.querySelectorAll("table")) {
      if (table.parentElement?.classList.contains("reader-content__table-scroll")) continue;
      const wrapper = document.createElement("div");
      wrapper.className = "reader-content__table-scroll";
      table.before(wrapper);
      wrapper.append(table);
      const updateOverflow = () => {
        const overflowing = wrapper.scrollWidth > wrapper.clientWidth + 1;
        wrapper.tabIndex = overflowing ? 0 : -1;
        if (overflowing) {
          wrapper.setAttribute("role", "region");
          wrapper.setAttribute("aria-label", appCopy.reader.scrollableTable);
        } else {
          wrapper.removeAttribute("role");
          wrapper.removeAttribute("aria-label");
        }
      };
      const observer = new ResizeObserver(updateOverflow);
      observer.observe(wrapper);
      resizeObservers.push(observer);
      updateOverflow();
    }

    for (const code of content.querySelectorAll("pre")) {
      const updateOverflow = () => {
        const overflowing = code.scrollWidth > code.clientWidth + 1;
        code.tabIndex = overflowing ? 0 : -1;
        if (overflowing) {
          code.setAttribute("role", "region");
          code.setAttribute("aria-label", appCopy.reader.scrollableCode);
        } else {
          code.removeAttribute("role");
          code.removeAttribute("aria-label");
        }
      };
      const observer = new ResizeObserver(updateOverflow);
      observer.observe(code);
      resizeObservers.push(observer);
      updateOverflow();
    }

    for (const image of content.querySelectorAll("img")) {
      const loaded = () => {
        image.dataset.readerMediaState = "ready";
      };
      const failed = () => {
        image.dataset.readerMediaState = navigator.onLine ? "error" : "offline";
        image.hidden = true;
        setFailedMediaCount((count) => count + 1);
      };
      image.addEventListener("load", loaded);
      image.addEventListener("error", failed, { once: true });
      cleanups.push(() => {
        image.removeEventListener("load", loaded);
        image.removeEventListener("error", failed);
      });
      if (image.complete) {
        if (image.naturalWidth > 0) loaded(); else failed();
      } else {
        image.dataset.readerMediaState = "loading";
      }
    }

    return () => {
      for (const observer of resizeObservers) observer.disconnect();
      for (const cleanup of cleanups) cleanup();
    };
  }, [renderedHtml]);

  return <>
    <div className="reader-content reader-chunk__content" data-reader-ordinal={ordinal} dangerouslySetInnerHTML={{ __html: renderedHtml }} ref={contentRef} />
    {failedMediaCount > 0 ? <p className="reader-content__media-error" role="status">{navigator.onLine ? appCopy.reader.mediaError : appCopy.reader.mediaOffline}</p> : null}
  </>;
}, (previous, next) => previous.ordinal === next.ordinal && previous.anchors === next.anchors && previous.html.pipelineVersion === next.html.pipelineVersion && previous.html.value === next.html.value);

/** Runs inside the sole validated HTML boundary before the browser can fetch an image. */
export function applyMediaPolicy(html: string, policy: { readonly enabled: boolean; readonly online: boolean }): string {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");
  for (const image of document.body.querySelectorAll("img")) {
    const source = image.getAttribute("src") ?? "";
    const allowedDataImage = isAllowedRasterDataImage(source);
    const allowedRemoteImage = isHttpsUrl(source) && policy.enabled && policy.online;
    if (allowedDataImage || allowedRemoteImage) {
      image.setAttribute("loading", "lazy");
      image.setAttribute("referrerpolicy", "no-referrer");
      continue;
    }
    const placeholder = document.createElement("span");
    placeholder.className = "reader-content__media-placeholder";
    placeholder.setAttribute("role", "img");
    placeholder.setAttribute("aria-label", image.alt || (isHttpsUrl(source) ? platformStatusCopy.remoteImagesBlocked : platformStatusCopy.localImageUnsupported));
    placeholder.textContent = isHttpsUrl(source) ? platformStatusCopy.remoteImagesBlocked : platformStatusCopy.localImageUnsupported;
    image.replaceWith(placeholder);
  }
  return document.body.innerHTML;
}

function isHttpsUrl(value: string): boolean {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function isAllowedRasterDataImage(value: string): boolean {
  const match = /^data:image\/(png|jpeg|gif|webp|avif);base64,([a-z0-9+/=]+)$/iu.exec(value);
  const encoded = match?.[2];
  if (encoded === undefined) return false;
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  return Math.floor((encoded.length * 3) / 4) - padding <= PIPELINE_LIMITS.safeDataImageBytes;
}
