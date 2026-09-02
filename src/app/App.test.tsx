import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App bootstrap", () => {
  it("renders the semantic bootstrap placeholder", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Markdown Reader", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("P00-T01")).toBeInTheDocument();
  });
});
