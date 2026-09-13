import { useEffect, useRef, useState, type MouseEvent } from "react";

import type { OutlineItem } from "@/domain/content/pipeline-types";
import { appCopy } from "@/shared/i18n/ru";
import { Button } from "@/ui/primitives/button";
import { Sheet, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/ui/primitives/sheet";

interface TableOfContentsProps {
  readonly activeId: string | undefined;
  readonly outline: readonly OutlineItem[];
  readonly onSelect: (id: string, focusTarget: boolean) => void;
}

export function TableOfContents({ activeId, outline, onSelect }: TableOfContentsProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const focusFrameRef = useRef(0);
  useEffect(() => () => { window.cancelAnimationFrame(focusFrameRef.current); }, []);
  if (outline.length === 0) return null;
  const activate = (id: string, event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const keyboard = event.detail === 0;
    onSelect(id, keyboard);
    setOpen(false);
    if (keyboard) focusHeadingAfterSheetCloses(id, focusFrameRef);
    if (!keyboard) queueMicrotask(() => triggerRef.current?.focus());
  };
  return <>
    <nav aria-label={appCopy.a11y.tableOfContents} className="reader-toc reader-toc--desktop"><TocList activeId={activeId} outline={outline} onActivate={activate} /></nav>
    <div className="reader-toc__mobile">
      <SheetTrigger isOpen={open} onOpenChange={setOpen}>
        <Button ref={triggerRef} variant="outline">{appCopy.reader.openToc}</Button>
        <Sheet className="reader-toc__sheet" side="bottom">
          <SheetHeader><SheetTitle>{appCopy.reader.tocTitle}</SheetTitle><SheetDescription>{appCopy.reader.tocDescription}</SheetDescription></SheetHeader>
          <nav aria-label={appCopy.a11y.tableOfContents} className="reader-toc reader-toc--sheet"><TocList activeId={activeId} outline={outline} onActivate={activate} /></nav>
        </Sheet>
      </SheetTrigger>
    </div>
  </>;
}

function focusHeadingAfterSheetCloses(id: string, frameRef: { current: number }): void {
  let attempts = 0;
  let stableFrames = 0;
  const focus = () => {
    attempts += 1;
    const target = document.getElementById(id);
    const overlayOpen = document.querySelector('[role="dialog"]') !== null;
    if (!overlayOpen && target instanceof HTMLElement) {
      const active = document.activeElement;
      const mayRestore = active === document.body || active === target || active?.closest(".reader-toc__mobile") !== null;
      if (!mayRestore) return;
      if (active !== target) {
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
      stableFrames = document.activeElement === target ? stableFrames + 1 : 0;
    }
    if (attempts < 120 && stableFrames < 30) frameRef.current = window.requestAnimationFrame(focus);
  };
  window.cancelAnimationFrame(frameRef.current);
  frameRef.current = window.requestAnimationFrame(focus);
}

function TocList({ activeId, outline, onActivate }: { readonly activeId: string | undefined; readonly outline: readonly OutlineItem[]; readonly onActivate: (id: string, event: MouseEvent<HTMLAnchorElement>) => void }) {
  return <NestedList activeId={activeId} entries={nestOutline(outline)} onActivate={onActivate} />;
}

interface NestedOutlineItem { readonly item: OutlineItem; readonly children: readonly NestedOutlineItem[]; }

function nestOutline(outline: readonly OutlineItem[]): readonly NestedOutlineItem[] {
  const roots: NestedOutlineItem[] = [];
  const stack: { readonly level: number; readonly children: NestedOutlineItem[] }[] = [];
  for (const item of outline) {
    while (stack.length > 0 && (stack[stack.length - 1]?.level ?? 0) >= item.level) stack.pop();
    const entry: NestedOutlineItem = { children: [], item };
    const parent = stack[stack.length - 1];
    if (parent === undefined) roots.push(entry); else parent.children.push(entry);
    stack.push({ children: entry.children as NestedOutlineItem[], level: item.level });
  }
  return roots;
}

function NestedList({ activeId, entries, onActivate }: { readonly activeId: string | undefined; readonly entries: readonly NestedOutlineItem[]; readonly onActivate: (id: string, event: MouseEvent<HTMLAnchorElement>) => void }) {
  return <ol>{entries.map(({ children, item }) => <li className={`reader-toc__item reader-toc__item--level-${String(item.level)}`} key={item.id}><a aria-current={activeId === item.id ? "location" : undefined} href={`#${encodeURIComponent(item.id)}`} onClick={(event) => { onActivate(item.id, event); }}>{item.text}</a>{children.length > 0 ? <NestedList activeId={activeId} entries={children} onActivate={onActivate} /> : null}</li>)}</ol>;
}
