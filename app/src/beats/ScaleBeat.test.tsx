// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { COPY } from "../copy";
import { loadStageData } from "../data";
import { scaleUsdPerDay } from "../engineClient";

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
const key = (k: string) => data.numbers?.find((n) => n.key === k);

describe("beat 6 scale and close", () => {
  it("fleet scaling at the slider ends equals the pinned 70 and 500 MW keys (skips without numbers.json)", () => {
    const mou = key("mou_70mw");
    const top = key("torus_500mw");
    if (!mou || !top) {
      console.info("skipped: public/derived/numbers.json is not on this branch yet");
      return;
    }
    const pairs: [string, number, string][] = [
      ["fixed_usd_mw_day", mou.value, "fixed_70"],
      ["clearlane_usd_mw_day", mou.value, "clearlane_70"],
      ["fixed_usd_mw_day", top.value, "fixed_500"],
      ["clearlane_usd_mw_day", top.value, "clearlane_500"],
    ];
    for (const [perMw, mw, pinned] of pairs)
      expect(Math.round(scaleUsdPerDay(key(perMw)!.value, mw))).toBe(
        Math.round(key(pinned)!.value),
      );
  });

  it("shows the slider caveats, and Right turns to the close card with a SIMULATED chip and both lines", () => {
    const { container } = render(<App data={data} now={NOW} search="?beat=6&motion=off" />);
    expect(container.textContent).toContain(COPY.mouCeiling);
    expect(container.textContent).toContain(COPY.priceTaker);
    expect(container.querySelector('[data-slot="fleet-value"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="close-card"]')).toBeNull();
    act(() => {
      fireEvent.keyDown(window, { key: "ArrowRight" });
    });
    expect(document.body.dataset.beat).toBe("6");
    expect(document.body.dataset.step).toBe("end");
    const close = container.querySelector('[data-slot="close-card"]')!;
    expect(close).toBeTruthy();
    expect(close.querySelector(".chip")?.textContent).toBe("SIMULATED");
    expect(close.textContent).toContain(
      "In Utah, compute should follow the sun in time, not in space.",
    );
    expect(close.textContent).toContain(
      "Clearlane: fill up when the road is clear, and keep Spin ready for the crash.",
    );
    expect(close.textContent).toContain("not a Torus data-center product");
  });

  it("?beat=6&step=end opens on the close card", () => {
    const { container } = render(
      <App data={data} now={NOW} search="?beat=6&step=end&motion=off" />,
    );
    expect(container.querySelector('[data-slot="close-card"]')).toBeTruthy();
  });
});
