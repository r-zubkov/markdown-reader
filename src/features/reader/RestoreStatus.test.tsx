import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { ReaderRecovery, RestoreStatus } from "@/features/reader/ReaderScreen";

describe("RestoreStatus", () => {
  it("keeps exact restore silent and offers both approximate actions once", () => {
    const onContinue = vi.fn();
    const onStart = vi.fn();
    const view = render(<RestoreStatus confidence={undefined} onContinue={onContinue} onStart={onStart} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    view.rerender(<RestoreStatus confidence="approximate" onContinue={onContinue} onStart={onStart} />);
    fireEvent.click(screen.getByRole("button", { name: "Продолжить отсюда" }));
    fireEvent.click(screen.getByRole("button", { name: "Начать сначала" }));
    expect(onContinue).toHaveBeenCalledOnce();
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("offers only Start when no reliable location exists", () => {
    render(<RestoreStatus confidence="none" onContinue={vi.fn()} onStart={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Продолжить отсюда" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Начать сначала" })).toBeInTheDocument();
  });

  it("keeps recovery diagnostics safe and exposes reprocess without auto-focus banners", () => {
    const reprocess = vi.fn();
    render(<MemoryRouter><ReaderRecovery code="STALE_DERIVED" onReprocess={reprocess} text="Safe recovery" /></MemoryRouter>);

    expect(screen.getByRole("heading")).toHaveAttribute("tabindex", "-1");
    expect(screen.getByText("STALE_DERIVED")).toBeVisible();
    expect(screen.getByRole("button", { name: "Подготовить документ заново" })).not.toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Подготовить документ заново" }));
    expect(reprocess).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "К библиотеке" })).toHaveAttribute("href", "/");
  });
});
