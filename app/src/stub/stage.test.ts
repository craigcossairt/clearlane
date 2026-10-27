import { describe, expect, it } from "vitest";
import { loadStageData } from "../data";
import {
  crash,
  dayLanes,
  defaultSite,
  scriptedCalls,
  solve,
  STUB_ACTIVE,
} from "../engineClient";

const data = loadStageData();
const entry = data.bundles["2026-10-27"];
if (!entry) throw new Error("the Oct 27 bundle (fixture) is missing");
const bundle = entry.bundle;
const site = defaultSite();
const calls = scriptedCalls(bundle, site);
const clearlane = solve(bundle, site, "clearlane");
const priceOnly = solve(bundle, site, "price_only");

const hoursWhere = (lanes: string[], lane: string) =>
  lanes.flatMap((l, h) => (l === lane ? [h] : []));

describe("engine client on the Oct 27 fixture", () => {
  it("pins lanes: clear HB 9am to HB 4pm, shoulder HB 5pm, jam HB 6pm to HB 11pm", () => {
    const day = dayLanes(bundle);
    expect(hoursWhere(day.lanes, "clear")).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
    expect(hoursWhere(day.lanes, "jam")).toEqual([18, 19, 20, 21, 22, 23]);
    expect(day.lanes[17]).toBe("shoulder");
    for (const h of [18, 19, 20, 21, 22, 23]) expect(day.critical[h]).toBe(true);
  });

  it("places the scripted call at 6:40pm MT from hours[].ts_utc and runs 330 s at the enrolled kW", () => {
    expect(calls.first.start_utc).toBe("2026-10-28T00:40:00Z");
    expect(calls.first.duration_s).toBe(330);
    expect(calls.first.requested_kw).toBe(site.station.enrolled_kw);
  });

  it("serves the first call from Spin alone with no shortfall", () => {
    const first = crash(clearlane, site, calls.first, data.torus);
    expect(first.shortfall_kwh).toBe(0);
    expect(first.spin_kwh).toBeGreaterThan(0);
    expect(first.meter_peak_during_refill_kw).toBeLessThanOrEqual(site.host_ceiling_kw);
    expect(first.replan.solve_ms).toBeGreaterThanOrEqual(0);
  });

  it("reports a shortfall above 0 for a second call inside the refill window", () => {
    const second = crash(clearlane, site, calls.second, data.torus, calls.first);
    expect(second.shortfall_kwh).toBeGreaterThan(0);
    expect(second.meter_peak_during_refill_kw).toBeLessThanOrEqual(site.host_ceiling_kw);
  });

  it("runs the battery-only ghost on the price_only plan with no Spin", () => {
    const ghost = crash(priceOnly, site, calls.first, data.torus);
    expect(ghost.spin_kwh).toBe(0);
    expect(ghost.shortfall_kwh).toBeGreaterThan(0);
  });

  // price_only is the "Battery-only plan": no Spin reserve and no host ceiling, by design.
  it("keeps the host meter at or under the ceiling in every interval (ceiling-aware policies)", () => {
    for (const policy of ["fixed_overnight", "clearlane"] as const) {
      for (const row of solve(bundle, site, policy).intervals) {
        expect(row.meter_kw).toBeLessThanOrEqual(site.host_ceiling_kw);
      }
    }
  });

  it.runIf(STUB_ACTIVE)("stub only: fails loudly instead of typing Torus values when torus_published.json is absent", () => {
    expect(() => crash(clearlane, site, calls.first, null)).toThrow(/torus_published\.json/);
  });
});
