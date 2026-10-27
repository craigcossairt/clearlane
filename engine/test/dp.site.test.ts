import { describe, expect, it } from "vitest";
import type { Site } from "@contracts/types";
import {
  DP_FLOOR_LEVEL,
  defaultSite,
  hold4,
  reachLevels,
  schCapKw,
  solveSiteDP,
  spinAvailKw,
  stepLimits,
  systemCriticalHours,
} from "@engine/index";
import { loadFixture } from "./helpers/fixture";

const site = defaultSite();
const b = loadFixture();
const p96 = hold4(b.hours.map((h) => h.lmp_usd_mwh));
const flat = (v: number) => Array<number>(96).fill(v);
const schHours = systemCriticalHours(b).hours;
const schFlags = Array.from({ length: 96 }, (_, t) =>
  schHours.includes(Math.floor(t / 4)),
);
const STEP_H = 0.25;

// grid kW per interval at the meter (+ charging) from DP acts (+ discharging, kWh per step)
const pulseKw = (acts: number[]) => acts.map((g) => -g / STEP_H);

function clearlaneLike(
  s: Site,
  spinAvail = flat(250),
  sch: boolean[] | null = schFlags,
) {
  const limits = stepLimits(s, {
    ceiling: true,
    sch,
    spin_avail_kw: spinAvail,
    other_load_kw: flat(0),
  });
  return { limits, r: solveSiteDP(p96, s, { W: 10, limits }) };
}

describe("15-minute DP on the simulated site", () => {
  it("reaches 4 levels up and 5 down per step", () => {
    expect(reachLevels(site)).toEqual([4, 5]);
    const free = stepLimits(site, {
      ceiling: false,
      sch: null,
      spin_avail_kw: flat(250),
      other_load_kw: flat(0),
    });
    const r = solveSiteDP(p96, site, { W: 0, limits: free });
    const steps = r.level_path.slice(1).map((l, t) => l - r.level_path[t]!);
    expect(Math.max(...steps)).toBe(4);
    expect(Math.min(...steps)).toBe(-5);
  });

  it("solves 96 steps on 41 levels from and back to level 2", () => {
    const { r } = clearlaneLike(site);
    expect(r.feasible).toBe(true);
    expect(r.acts).toHaveLength(96);
    expect(r.level_path[0]).toBe(DP_FLOOR_LEVEL);
    expect(Math.max(...r.level_path)).toBeLessThanOrEqual(40);
  });

  it("keeps the meter at or under the host ceiling", () => {
    const { r } = clearlaneLike(site);
    pulseKw(r.acts).forEach((kw, t) => {
      expect(site.host_load_kw_15m[t]! + kw).toBeLessThanOrEqual(
        site.host_ceiling_kw + 1e-6,
      );
    });
  });

  it("charges into the clear lane only where the ceiling allows", () => {
    const { r } = clearlaneLike(site);
    // HB 14-15 host is at the ceiling: no charging there
    for (let t = 56; t < 64; t++)
      expect(r.acts[t]!).toBeGreaterThanOrEqual(-1e-9);
  });

  it("keeps the meter at or above minus the export limit on a low-load host", () => {
    const low: Site = {
      ...site,
      host_load_kw_15m: flat(100),
      host_ceiling_kw: 350,
    };
    const { limits, r } = clearlaneLike(low);
    expect(Math.max(...limits.discharge_kw)).toBe(100);
    pulseKw(r.acts).forEach((kw) =>
      expect(100 + kw).toBeGreaterThanOrEqual(
        -low.export_limit_kw.value - 1e-6,
      ),
    );
    expect(Math.min(...pulseKw(r.acts))).toBeLessThan(-50); // it does discharge
  });

  it("applies the SCH cap only in SCH intervals when Spin is at 40%", () => {
    const avail = spinAvailKw(site, 0.4 * site.station.spin_kwh);
    expect(avail).toBeCloseTo((10 * 3600) / 330, 9);
    const cap = schCapKw(site, avail);
    expect(cap).toBeCloseTo(250 - (250 - avail), 9);
    const { limits, r } = clearlaneLike(site, flat(avail));
    limits.discharge_kw.forEach((kw, t) =>
      expect(kw).toBeCloseTo(schFlags[t] ? cap : 250, 9),
    );
    for (let t = 0; t < 96; t++) {
      if (schFlags[t])
        expect(-pulseKw(r.acts)[t]!).toBeLessThanOrEqual(cap + 1e-6);
    }
    // the cap binds: some SCH interval discharges at it, which full Spin would not force
    const sch = pulseKw(r.acts).filter((_, t) => schFlags[t]);
    expect(Math.min(...sch)).toBeLessThan(-(cap - 50)); // within one level of the cap
    const full = clearlaneLike(site).r;
    expect(
      Math.min(...pulseKw(full.acts).filter((_, t) => schFlags[t])),
    ).toBeLessThan(-cap - 1);
  });

  it("ends at or above its start level", () => {
    const { r } = clearlaneLike(site);
    expect(r.level_path[96]!).toBeGreaterThanOrEqual(r.level_path[0]!);
  });
});
