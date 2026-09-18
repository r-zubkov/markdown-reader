import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readThemeMirror, ThemePreferenceSelect, ThemeProvider, ThemeToggle } from "./ThemeProvider";

afterEach(() => { window.localStorage.clear(); document.documentElement.removeAttribute("data-theme"); vi.restoreAllMocks(); });
describe("ThemeProvider", () => {
  it("rejects a corrupt mirror and falls back to system", () => { window.localStorage.setItem("markdown-reader.theme", "unexpected"); expect(readThemeMirror()).toBe("system"); });
  it("applies a theme without remounting children", () => {
    render(<ThemeProvider><ThemeToggle /><p>Стабильное содержимое</p></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Выбрать тему" }));
    expect(screen.getByText("Стабильное содержимое")).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBeDefined();
  });
  it("offers and persists the system preference", () => {
    render(<ThemeProvider><ThemePreferenceSelect /></ThemeProvider>);
    const select = screen.getByRole("combobox", { name: "Выбрать тему" });
    fireEvent.change(select, { target: { value: "dark" } });
    expect(window.localStorage.getItem("markdown-reader.theme")).toBe("dark");
    fireEvent.change(select, { target: { value: "system" } });
    expect(window.localStorage.getItem("markdown-reader.theme")).toBe("system");
  });
  it("follows an operating-system theme change while the system preference is active", () => {
    let matches = false;
    const listeners = new Set<EventListener>();
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === "function") listeners.add(listener);
      },
      addListener: vi.fn(),
      dispatchEvent: () => true,
      get matches() { return matches; },
      media: query,
      onchange: null,
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === "function") listeners.delete(listener);
      },
      removeListener: vi.fn(),
    }));
    const layoutChange = vi.fn();
    window.addEventListener("markdown-reader:before-layout-change", layoutChange);
    render(<ThemeProvider><ThemePreferenceSelect /></ThemeProvider>);
    expect(document.documentElement.dataset.theme).toBe("light");

    matches = true;
    listeners.forEach((listener) => { listener(new Event("change")); });

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(layoutChange).toHaveBeenCalledOnce();
    window.removeEventListener("markdown-reader:before-layout-change", layoutChange);
  });
});
