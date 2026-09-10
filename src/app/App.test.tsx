import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";

function renderAt(path: string) { window.history.pushState({}, "", path); return render(<App />); }
afterEach(() => { window.history.pushState({}, "", "/"); });

describe("App shell routes", () => {
  it("renders the Library with one main landmark and a skip link", () => {
    renderAt("/");
    expect(screen.getByRole("heading", { level: 1, name: "Библиотека" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("link", { name: "Перейти к основному содержимому" })).toHaveAttribute("href", "#main-content");
  });

  it("renders a reader shell for deep links and recovery for unknown routes", () => {
    const view = renderAt("/documents/local-id#section");
    expect(screen.getByRole("heading", { level: 1, name: "Документ" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Перейти к тексту документа" })).toBeInTheDocument();
    view.unmount(); renderAt("/missing");
    expect(screen.getByRole("heading", { level: 1, name: "Страница не найдена" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Открыть библиотеку" })).toHaveAttribute("href", "/");
  });

  it("moves focus to the new route heading after navigation", () => {
    renderAt("/documents/local-id");
    fireEvent.click(screen.getByRole("link", { name: "К библиотеке" }));
    expect(screen.getByRole("heading", { name: "Библиотека" })).toHaveFocus();
  });
});
