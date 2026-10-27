// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
});

describe("stage keyboard", () => {
  it("shows the operating day, provenance, and the race end cards", () => {
    render(<App />);
    expect(screen.getByText("2026-10-27")).toBeTruthy();
    expect(screen.getAllByText("DERIVED").length).toBeGreaterThan(0);
    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByText("$20.06")).toBeTruthy();
    expect(screen.getByText("$58.41")).toBeTruthy();
    expect(
      screen.getAllByText(/value to RMP's system at day-ahead prices/).length,
    ).toBeGreaterThan(0);
    expect(document.body.textContent ?? "").not.toContain("\u2014");
    fireEvent.keyDown(window, { key: "c" });
    expect(screen.getByText(/Rocky Mountain Power call/)).toBeTruthy();
    fireEvent.keyDown(window, { key: "c" });
    expect(screen.getByText(/Second press/)).toBeTruthy();
    fireEvent.keyDown(window, { key: "b" });
    expect(
      screen.getAllByText(/unavailable until the engine backtest/).length,
    ).toBeGreaterThan(0);
    fireEvent.keyDown(window, { key: "t" });
    expect(screen.getByText(/UTC, shown as Mountain/)).toBeTruthy();
  });
});
