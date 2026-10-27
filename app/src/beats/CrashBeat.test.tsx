// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NumbersContext } from "../components/Num";
import { COPY } from "../copy";
import { loadStageData } from "../data";
import {
  crash,
  dayLanes,
  defaultSite,
  scriptedCalls,
  solve,
  STUB_ACTIVE,
} from "../engineClient";
import { CrashBeat } from "./CrashBeat";
import type { CallState, Live } from "./types";

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
  stub: STUB_ACTIVE,
};
const first = crash(live.plans.clearlane, site, live.calls.first, data.torus);
const ghost = crash(live.plans.price_only, site, live.calls.first, data.torus);
const second = crash(
  live.plans.clearlane,
  site,
  live.calls.second,
  data.torus,
  live.calls.first,
);

// jsdom has no matchMedia here, which the beat treats as reduced motion: end states land at once.
function renderCall(call: CallState) {
  return render(
    <NumbersContext.Provider value={{ state: "ready", numbers: data.numbers }}>
      <CrashBeat
        live={live}
        hour={0}
        call={call}
        backtest={false}
        fleetMw={null}
        onFleet={() => undefined}
      />
    </NumbersContext.Provider>,
  );
}

const slots = ["call-banner", "call-inset", "call-ghost", "second-call", "call-result"];

describe("beat 3 call", () => {
  it("reserves every slot before the call and says so in words, never as 0", () => {
    const { container } = renderCall({ first: null, ghost: null, second: null });
    for (const s of slots)
      expect(container.querySelector(`[data-slot="${s}"]`), s).toBeTruthy();
    expect(container.textContent).toContain(COPY.noCallYet);
  });

  it("shows the banner, the five trace series on both sides, and the simulated clock", () => {
    const { container } = renderCall({ first, ghost, second: null });
    expect(container.textContent).toContain("Simulated Rocky Mountain Power call:");
    expect(container.textContent).toContain("A call of about five and a half minutes.");
    expect(container.textContent).not.toMatch(/six-minute/i);
    for (const s of ["call-inset", "call-ghost"]) {
      const series = [
        ...container.querySelectorAll(`[data-slot="${s}"] polyline[data-series]`),
      ].map((p) => p.getAttribute("data-series"));
      expect(series).toEqual(["requested", "spin", "pulse", "spin_soc", "meter"]);
    }
    expect(container.querySelector('[data-slot="call-clock"] [data-time]')).toBeTruthy();
  });

  it("the first call has no shortfall; the battery-only ghost misses and shows it", () => {
    expect(first.shortfall_kwh).toBe(0);
    expect(ghost.shortfall_kwh).toBeGreaterThan(0);
    expect(ghost.spin_kwh).toBe(0);
  });

  it("the second press states the rule and a shortfall above 0, as SIMULATED", () => {
    const { container } = renderCall({ first, ghost, second });
    const p = container.querySelector('[data-slot="second-call"]')!;
    expect(p.textContent).toContain("the call wins and Pulse diverts");
    const num = p.querySelector("[data-num]")!;
    expect(num.getAttribute("data-prov")).toBe("SIMULATED");
    expect(second.shortfall_kwh).toBeGreaterThan(0);
  });

  it("keeps the published panel apart from the simulated result", () => {
    const { container } = renderCall({ first, ghost, second: null });
    const pub = container.querySelector(".card.published")!;
    const sim = container.querySelector('[data-slot="call-result"]')!;
    expect(pub).not.toBe(sim);
    expect(pub.contains(sim)).toBe(false);
  });

  it("renders only the Mountain heatmap reading, with the Torus provenance line", () => {
    expect(data.torus).not.toBeNull();
    const { container } = renderCall({ first, ghost, second: null });
    const pub = container.querySelector(".card.published")!;
    const heats = pub.querySelectorAll("figure.heat");
    expect(heats).toHaveLength(1);
    expect(heats[0]!.querySelector("figcaption")!.textContent).toBe(
      "Published calls by hour of day, Mountain time",
    );
    // The bars are the published counts in Mountain hour order, not rotated.
    const byHour = data.torus!.events_2025_by_hour.value;
    const bars = [...heats[0]!.querySelectorAll(".bar-row i")].map(
      (i) => (i as HTMLElement).style.height,
    );
    const max = Math.max(...byHour);
    expect(bars).toEqual(byHour.map((c) => `${(c / max) * 100}%`));
    expect(pub.textContent).toContain("Hours in Mountain time, confirmed by Torus.");
    expect(pub.textContent).not.toMatch(/UTC|both readings|no time zone/i);
  });
});
