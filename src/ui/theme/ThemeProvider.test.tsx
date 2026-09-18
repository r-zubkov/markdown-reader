import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { readThemeMirror, ThemePreferenceSelect, ThemeProvider, ThemeToggle } from "./ThemeProvider";

afterEach(() => { window.localStorage.clear(); document.documentElement.removeAttribute("data-theme"); });
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
});
