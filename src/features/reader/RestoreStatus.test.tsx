import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RestoreStatus } from "@/features/reader/ReaderScreen";

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
});
