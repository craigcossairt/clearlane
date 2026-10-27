import { describe, expect, it } from "vitest";
import type { CrashEvent, Site } from "@contracts/types";
import {
  SECOND_CALL_OFFSET_S,
  defaultSite,
  scriptedCalls,
  simulateCall,
  solve,
} from "@engine/index";
import { loadFixture } from "./helpers/fixture";

const b = loadFixture();
const site = defaultSite();
const clear = solve(b, site, "clearlane");
const ghostPlan = solve(b, site, "price_only");
const [first, second] = scriptedCalls(b, site);
const r1 = simulateCall(clear, site, first);
const r2 = simulateCall(clear, site, second, r1);
const ghost = simulateCall(ghostPlan, site, first);

describe("scripted calls", () => {
  it("start at 6:40pm MT and 180 s after the first ends", () => {
    expect(first.start_utc).toBe("2026-10-28T00:40:00Z");
    expect(first.duration_s).toBe(330);
    expect(first.requested_kw).toBe(250);
    expect(first.prov).toBe("SIMULATED");
    expect(SECOND_CALL_OFFSET_S).toBe(180);
    expect(second.start_utc).toBe("2026-10-28T00:48:30Z");
  });
});

describe("first call on clearlane", () => {
  it("Spin alone delivers 100% with no shortfall", () => {
    expect(r1.delivered_pct).toBeCloseTo(100, 9);
    expect(r1.shortfall_kwh).toBeCloseTo(0, 9);
    expect(r1.pulse_kwh).toBe(0);
    expect(r1.spin_kwh).toBeCloseTo((250 * (330 - 9.5)) / 3600, 1);
    expect(r1.ramp_s).toBe(19);
  });

  it("ramps over 19 s", () => {
    expect(r1.trace[0]!.requested_kw).toBe(0);
    expect(r1.trace[19]!.requested_kw).toBe(250);
    expect(r1.trace[10]!.requested_kw).toBeCloseTo((250 * 10) / 19, 9);
  });

  it("refills Spin within 6 minutes of the call end under the ceiling", () => {
    expect(r1.meter_peak_during_refill_kw).toBeLessThanOrEqual(
      site.host_ceiling_kw,
    );
    const endMs = Date.parse(first.start_utc) + 330_000;
    expect(Date.parse(r1.spin_full_again_utc) - endMs).toBeLessThanOrEqual(
      360_000,
    );
    expect(r1.trace[r1.trace.length - 1]!.spin_soc_kwh).toBeCloseTo(25, 6);
    for (const p of r1.trace)
      expect(p.meter_kw).toBeGreaterThanOrEqual(
        -site.export_limit_kw.value - 1e-9,
      );
  });
});

describe("second press inside the refill window", () => {
  it("reports a shortfall", () => {
    console.log(
      `second call: delivered ${r2.delivered_pct.toFixed(2)}%, shortfall ${r2.shortfall_kwh.toFixed(3)} kWh, spin ${r2.spin_kwh.toFixed(3)} kWh, pulse ${r2.pulse_kwh.toFixed(3)} kWh`,
    );
    expect(r2.shortfall_kwh).toBeGreaterThan(0);
    expect(r2.trace[0]!.spin_soc_kwh).toBeLessThan(25);
  });
});

describe("the battery-only ghost", () => {
  it("misses the first call", () => {
    console.log(
      `ghost: delivered ${ghost.delivered_pct.toFixed(2)}%, shortfall ${ghost.shortfall_kwh.toFixed(3)} kWh`,
    );
    expect(ghost.delivered_pct).toBeLessThan(90);
    expect(ghost.spin_kwh).toBe(0);
    expect(ghost.delivered_pct.toFixed(2)).toBe(GHOST_PCT);
  });
});

describe("refill clamp at the host ceiling", () => {
  // HB 14: host is at the ceiling, so Spin cannot refill until the load drops at HB 16
  const midday: CrashEvent = {
    ...first,
    id: "midday",
    start_utc: "2026-10-27T20:00:00Z",
  };
  const r = simulateCall(clear, site, midday);

  it("slows the refill and never lifts the meter over the ceiling", () => {
    const refill = r.trace.filter((p) => p.t_s >= 330);
    for (const p of refill)
      expect(p.meter_kw).toBeLessThanOrEqual(site.host_ceiling_kw + 1e-9);
    expect(r.meter_peak_during_refill_kw).toBeLessThanOrEqual(
      site.host_ceiling_kw + 1e-9,
    );
    expect(r.trace.length).toBeGreaterThan(330 + 360); // longer than an uncapped 6-minute refill
  });
});

describe("export floor", () => {
  it("caps served kW on a low-host site", () => {
    const low: Site = {
      ...site,
      host_load_kw_15m: Array<number>(96).fill(100),
      host_ceiling_kw: 350,
    };
    const plan = solve(b, low, "clearlane");
    const r = simulateCall(plan, low, first);
    for (const p of r.trace)
      expect(p.meter_kw).toBeGreaterThanOrEqual(
        -low.export_limit_kw.value - 1e-9,
      );
    expect(r.delivered_pct).toBeLessThan(100);
  });
});

// Printed by the first run of this file; the PR quotes it.
const GHOST_PCT = "6.36";

describe("a call in a charging interval", () => {
  it("lets Pulse stop charging and discharge at its full rating", () => {
    const iv = clear.intervals.find(
      (x) => x.pulse_kw > 1 && x.pulse_soc_kwh > site.station.pulse_kwh / 2,
    )!;
    expect(iv).toBeDefined();
    // a small Spin forces Pulse to carry the call
    const weakSpin: Site = {
      ...site,
      station: { ...site.station, spin_kw: 1, spin_kwh: 0.1 },
    };
    const call: CrashEvent = {
      ...first,
      id: "charging",
      start_utc: iv.ts_utc,
      duration_s: 120,
      requested_kw: 2 * site.station.pulse_kw,
    };
    const r = simulateCall(clear, weakSpin, call);
    const deepest = Math.min(...r.trace.map((p) => p.pulse_kw));
    // the old cap (rating less the planned charge) stops at 2 * planned - rating
    expect(deepest).toBeLessThan(2 * iv.pulse_kw - site.station.pulse_kw - 1);
    expect(deepest).toBeGreaterThanOrEqual(-site.station.pulse_kw - 1e-6);
  });
});
