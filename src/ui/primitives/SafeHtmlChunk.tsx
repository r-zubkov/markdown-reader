import { memo, useEffect, useRef, useState } from "react";

import type { SanitizedHtml } from "@/application/ports/document-repository";
import { appCopy } from "@/shared/i18n/ru";

interface SafeHtmlChunkProps {
  readonly html: SanitizedHtml;
  readonly ordinal: number;
}

/** The sole HTML injection boundary; its input can only originate in the validated repository. */
export const SafeHtmlChunk = memo(function SafeHtmlChunk({ html, ordinal }: SafeHtmlChunkProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [failedMediaCount, setFailedMediaCount] = useState(0);

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
  }, [html]);

  return <>
    <div className="reader-content reader-chunk__content" data-reader-ordinal={ordinal} dangerouslySetInnerHTML={{ __html: html.value }} ref={contentRef} />
    {failedMediaCount > 0 ? <p className="reader-content__media-error" role="status">{navigator.onLine ? appCopy.reader.mediaError : appCopy.reader.mediaOffline}</p> : null}
  </>;
}, (previous, next) => previous.ordinal === next.ordinal && previous.html.pipelineVersion === next.html.pipelineVersion && previous.html.value === next.html.value);
