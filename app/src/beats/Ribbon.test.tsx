// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import type { StageNumber } from "@contracts/types";
import { afterEach, describe, expect, it } from "vitest";
import { NumbersContext } from "../components/Num";
import { loadStageData } from "../data";
import { dayLanes, defaultSite, scriptedCalls, solve } from "../engineClient";
import { Ribbon } from "./Ribbon";
import type { Live } from "./types";

afterEach(cleanup);

const data = loadStageData();
const entry = data.bundles["2026-10-27"];
if (!entry) throw new Error("the Oct 27 bundle (fixture) is missing");
const bundle = entry.bundle;
const site = defaultSite();
const live: Live = {
  bundle,
  bundleFile: entry.file,
  day: dayLanes(bundle),
  site,
  plans: {
    fixed_overnight: solve(bundle, site, "fixed_overnight"),
    price_only: solve(bundle, site, "price_only"),
    clearlane: solve(bundle, site, "clearlane"),
  },
  torus: data.torus,
  calls: scriptedCalls(bundle, site),
  stub: false,
};

function renderRibbon(numbers: StageNumber[] | null) {
  return render(
    <NumbersContext.Provider value={{ state: "ready", numbers }}>
      <Ribbon
        live={live}
        hour={0}
        call={{ first: null, ghost: null, second: null }}
        backtest={false}
        fleetMw={null}
        onFleet={() => undefined}
      />
    </NumbersContext.Provider>,
  );
}

const laneWords = (root: HTMLElement) =>
  [...root.querySelectorAll("[data-lane] .lane-word")].map((n) => n.textContent);

describe("beat 1 ribbon on the Oct 27 fixture", () => {
  it("labels each hour with its engine lane word: 9 to 16 Clear, 17 Shoulder, 18 to 23 Jam", () => {
    const { container } = renderRibbon(data.numbers);
    const words = laneWords(container);
    expect(words).toHaveLength(24);
    for (let h = 9; h <= 16; h++) expect(words[h]).toBe("Clear");
    expect(words[17]).toBe("Shoulder");
    for (let h = 18; h <= 23; h++) expect(words[h]).toBe("Jam");
  });

  it("colors each cell from the lane it labels, so color is never the only signal", () => {
    const { container } = renderRibbon(data.numbers);
    for (const g of container.querySelectorAll("[data-lane]")) {
      const lane = g.getAttribute("data-lane");
      for (const rect of g.querySelectorAll("rect"))
        expect(rect.getAttribute("fill")).toBe(`var(--${lane})`);
    }
  });

  it("captions the axis 'hour beginning, Mountain time' and tags hour ticks data-axis", () => {
    const { container } = renderRibbon(data.numbers);
    expect(container.textContent).toContain("hour beginning, Mountain time");
    const ticks = container.querySelectorAll("text[data-axis]");
    expect(ticks.length).toBeGreaterThanOrEqual(8);
  });

  it("renders a missing key as 'not computed', never as 0", () => {
    const { container } = renderRibbon(null);
    const nums = [...container.querySelectorAll("[data-num]")];
    expect(nums.length).toBeGreaterThanOrEqual(10);
    for (const n of nums) {
      expect(n.textContent).toContain("not computed");
      expect(n.textContent).not.toMatch(/^\s*\$?0\b/);
    }
  });

  it("reads the peak hour from its key, with the key's display string verbatim", () => {
    const peak: StageNumber = {
      key: "peak_hour_mt",
      value: 18,
      unit: "hour",
      display: "6pm",
      prov: "DERIVED",
      source: "test fixture",
      as_of_mt: "2026-10-27",
    } as StageNumber;
    const { container } = renderRibbon([peak]);
    const el = container.querySelector('[data-num][data-key="peak_hour_mt"]') ??
      [...container.querySelectorAll("[data-num]")].find((n) =>
        n.textContent?.includes("6pm"),
      );
    expect(el?.textContent).toContain("6pm");
  });
});
