// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import type { StageNumber } from "@contracts/types";
import { afterEach, describe, expect, it } from "vitest";
import { NumbersContext } from "../components/Num";
import { COPY } from "../copy";
import { loadStageData } from "../data";
import {
  dayLanes,
  defaultSite,
  scriptedCalls,
  solve,
  STUB_ACTIVE,
} from "../engineClient";
import { Race } from "./Race";
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
  stub: STUB_ACTIVE,
};

function renderRace(hour: number, numbers: StageNumber[] | null = data.numbers) {
  return render(
    <NumbersContext.Provider value={{ state: "ready", numbers }}>
      <Race
        live={live}
        hour={hour}
        call={{ first: null, ghost: null, second: null }}
        backtest={false}
        fleetMw={null}
        onFleet={() => undefined}
      />
    </NumbersContext.Provider>,
  );
}

describe("beat 2 race", () => {
  it("labels the two stations exactly from copy.ts", () => {
    const { container } = renderRace(0);
    const titles = [...container.querySelectorAll(".panel h3")].map((h) => h.firstChild?.textContent);
    expect(titles).toEqual([
      "Battery on the off-peak rule",
      "Simulated Torus-style station on Clearlane",
    ]);
  });

  it("keeps the end-card slot at rest and fills it only at the end of the day", () => {
    const start = renderRace(0).container;
    expect(start.querySelector('[data-slot="race-end-cards"]')).toBeTruthy();
    expect(start.querySelectorAll(".card")).toHaveLength(0);
    cleanup();
    const end = renderRace(24).container;
    expect(end.querySelectorAll(".card")).toHaveLength(2);
    const text = end.textContent ?? "";
    expect(text).toContain(COPY.valueToSystem);
    expect(text).toContain(
      "Average-emissions estimate (EIA hourly); marginal emissions can differ.",
    );
    expect(text).not.toMatch(/charges at/i);
  });

  it("reads the Clearlane end card from the reference keys beat 6 scales (#184)", () => {
    const card = renderRace(24).container.querySelector('[data-card="clearlane"]');
    if (!card) throw new Error("no clearlane card");
    const keys = [...card.querySelectorAll("[data-num]")].map((n) => n.getAttribute("data-num"));
    expect(keys).toEqual([
      "clearlane_usd_mw_day",
      "race_ratio",
      "clearlane_70",
      "co2_avoided_70",
    ]);
    for (const k of ["clearlane_usd_mw_day", "race_ratio", "clearlane_70"]) {
      const entry = data.numbers?.find((n) => n.key === k);
      if (!entry) continue;
      const el = card.querySelector(`[data-num="${k}"]`);
      expect(el?.textContent).toContain(entry.display);
      expect(el?.getAttribute("data-prov")).toBe(entry.prov);
    }
  });

  it("shows a cycles line and a host meter for each side, in kW only", () => {
    const { container } = renderRace(24);
    expect(container.querySelector('[data-slot="cycles-fixed_overnight"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="cycles-clearlane"]')).toBeTruthy();
    expect(container.textContent).not.toMatch(/\$[\d,.]+\s*(demand|\/kW)/);
  });

  it("keeps the ceiling-aware plans at or under the host ceiling", () => {
    for (const plan of [live.plans.fixed_overnight, live.plans.clearlane])
      expect(plan.host_peak_kw).toBeLessThanOrEqual(site.host_ceiling_kw + 1e-6);
  });

  it("live clearlane value matches clearlane_dp_usd_mw_day to the cent (skips on the stub or without numbers.json)", () => {
    const key = data.numbers?.find((n) => n.key === "clearlane_dp_usd_mw_day");
    if (STUB_ACTIVE || !key) {
      console.info(
        "skipped: needs the real engine and public/derived/numbers.json with clearlane_dp_usd_mw_day",
      );
      return;
    }
    expect(Math.round(live.plans.clearlane.value_usd_per_mw_day * 100)).toBe(
      Math.round(key.value * 100),
    );
  });
});
