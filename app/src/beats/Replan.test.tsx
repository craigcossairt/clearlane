// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { loadStageData } from "../data";

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
afterEach(cleanup);

const data = loadStageData();
const NOW = new Date("2026-10-27T18:00:00Z");
const press = (key: string) =>
  act(() => {
    fireEvent.keyDown(window, { key });
  });

describe("beat 4 re-plan", () => {
  it("reserves the re-plan slot before any call and shows no number in it", () => {
    const { container } = render(
      <App data={data} now={NOW} search="?beat=4&motion=off" />,
    );
    const slot = container.querySelector('[data-slot="replan-line"]')!;
    expect(slot).toBeTruthy();
    expect(slot.querySelector("[data-num]")).toBeNull();
    expect(container.querySelector('[data-series="replanned"]')).toBeNull();
  });

  it("?beat=4&step=end renders the re-planned day with a MEASURED solve time", () => {
    const { container } = render(
      <App data={data} now={NOW} search="?beat=4&step=end&motion=off" />,
    );
    const slot = container.querySelector('[data-slot="replan-line"]')!;
    expect(slot.textContent).toContain("Re-planned in");
    const num = slot.querySelector("[data-num]")!;
    expect(num.getAttribute("data-prov")).toBe("MEASURED");
    expect(num.textContent).toMatch(/ms/);
    expect(container.querySelector('[data-series="replanned"]')).toBeTruthy();
    const cycles = container.querySelector('[data-slot="replan-cycles"] [data-num]')!;
    expect(cycles.getAttribute("data-prov")).toBe("DERIVED");
    expect(document.body.dataset.state).toBe("replanned");
  });

  it("R after a call and a re-plan returns to exactly the fresh-load state", () => {
    const fresh = render(<App data={data} now={NOW} search="?motion=off" />);
    const freshHtml = fresh.container.innerHTML;
    const freshBody = { ...document.body.dataset };
    cleanup();
    const run = render(<App data={data} now={NOW} search="?motion=off" />);
    press("2");
    press(" ");
    press("c");
    press("c");
    press("ArrowRight");
    expect(document.body.dataset.beat).toBe("4");
    expect(run.container.textContent).toContain("Re-planned in");
    press(" ");
    press("r");
    expect(run.container.innerHTML).toBe(freshHtml);
    expect({ ...document.body.dataset }).toEqual(freshBody);
  });
});
