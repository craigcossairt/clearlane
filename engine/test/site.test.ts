import { describe, expect, it } from "vitest";
import { defaultSite, lanes, stepLimits } from "@engine/index";
import * as inputs from "@engine/inputs";
import { loadFixture } from "./helpers/fixture";

const site = defaultSite();
const host = site.host_load_kw_15m;
const b = loadFixture();
const flat = (v: number) => Array<number>(96).fill(v);

describe("defaultSite", () => {
  it("is the simulated Utah manufacturer with the briefed station", () => {
    expect(site.label).toBe("Simulated Utah manufacturer");
    const s = site.station;
    expect([
      s.spin_kw,
      s.spin_kwh,
      s.pulse_kw,
      s.pulse_kwh,
      s.enrolled_kw,
    ]).toEqual([250, 25, 250, 500, 250]);
    expect(s.rte).toEqual({
      value: 0.88,
      prov: "ASSUMPTION",
      source_id: "engine/src/inputs.ts",
    });
    expect(s.pulse_cycles_per_yr_budget).toBe(300);
    expect(s.spin_recharge_min).toBe(6);
    expect(site.export_limit_kw.value).toBe(0);
    expect(site.export_limit_kw.prov).toBe("ASSUMPTION");
    expect(site.demand_charge_usd_kw_month).toBeNull();
    expect(host).toHaveLength(96);
    expect(site.host_ceiling_kw).toBe(Math.max(...host));
  });

  it("the ceiling binds on at least one clear-lane interval on Oct 27", () => {
    const ls = lanes(b);
    const lim = stepLimits(site, {
      ceiling: true,
      sch: null,
      spin_avail_kw: flat(250),
      other_load_kw: flat(0),
    });
    const bound = host.flatMap((_, t) =>
      ls[Math.floor(t / 4)] === "clear" &&
      lim.charge_kw[t]! < site.station.pulse_kw
        ? [t]
        : [],
    );
    expect(bound.length).toBeGreaterThan(0);
  });

  it("host is at least pulse_kw + enrolled_kw through HB 17-20", () => {
    for (let t = 17 * 4; t < 21 * 4; t++) {
      expect(host[t]!).toBeGreaterThanOrEqual(
        site.station.pulse_kw + site.station.enrolled_kw,
      );
    }
  });

  it("host is at or under the ceiling everywhere", () => {
    for (const kw of host) expect(kw).toBeLessThanOrEqual(site.host_ceiling_kw);
  });

  it("keeps the Torus-derived inputs in one module", () => {
    expect(inputs.RAMP_S).toBe(19);
    expect(inputs.SPIN_C_RATE).toBe(10);
    expect(inputs.PULSE_C_RATE).toBe(0.5);
    expect(inputs.SPIN_RECHARGE_MIN).toBe(6);
    expect(inputs.PULSE_CYCLES_PER_YR).toBe(300);
  });
});
