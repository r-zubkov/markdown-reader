import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MobilePlatformSpike } from "./MobilePlatformSpike";

describe("P00-T06 mobile-platform primitive harness", () => {
  it("keeps focus inside the same dialog when content changes", async () => {
    render(<MobilePlatformSpike />);

    fireEvent.click(screen.getByRole("button", { name: "Открыть проверку импорта" }));
    fireEvent.click(screen.getByRole("button", { name: "Start local preparation" }));

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("heading", { name: "Подготавливаем документ" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Request cancellation" }));
    const decisionTitle = await screen.findByRole("heading", {
      name: "Выберите безопасное действие",
    });

    await waitFor(() => {
      expect(decisionTitle).toHaveFocus();
    });
    expect(document.body).not.toHaveFocus();
  });

  it("accepts a local file and applies a radio choice asynchronously", async () => {
    render(<MobilePlatformSpike />);

    fireEvent.change(screen.getByTestId("mobile-platform-file-input"), {
      target: { files: [new File(["# marker"], "длинное-имя-документа.md", { type: "text/markdown" })] },
    });
    expect(screen.getByText(/Файл выбран для локальной проверки/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("By sections"));
    expect(screen.getByText("Применяем настройку чтения…")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Настройка применена.")).toBeInTheDocument();
    });
  });
});
