import { describe, expect, it } from "vitest";
import type { HistDay } from "@contracts/types";
import { clearlaneCyclesPerYr } from "@engine/backtest";
import { defaultSite } from "@engine/site";
import { calibrateWear } from "@engine/wear";
import { loadFixture } from "./helpers/fixture";
import { loadDam } from "./helpers/oasis";

const co2 = loadFixture().hours.map((h) => h.co2_g_kwh);
const hist: HistDay[] = [
  ...loadDam("research/data/oasis/dam_jul"),
  ...loadDam("research/data/oasis/dam_oct"),
].map(([d, p]) => ({ operating_day_mt: d, lmp_usd_mwh: p, co2_g_kwh: co2 }));
const site = defaultSite();
const cal = calibrateWear(hist, site);
const cyc = (w: number) => clearlaneCyclesPerYr(hist, site, w);

describe("wear calibration on the July and October research days", () => {
  it("stays inside the budget, and a cent less does not", () => {
    expect(cal.feasible).toBe(true);
    expect(cal.budget).toBe(300);
    expect(cal.cycles_per_yr).toBeLessThanOrEqual(300);
    expect(cyc(cal.wear_usd_mwh)).toBe(cal.cycles_per_yr);
    if (cal.wear_usd_mwh > 0)
      expect(cyc(Math.round(cal.wear_usd_mwh * 100 - 1) / 100)).toBeGreaterThan(
        300,
      );
  });

  it("reports cycles at W = 10", () => {
    expect(cal.cycles_at_10).toBe(cyc(10));
  });

  it("is deterministic", { timeout: 60_000 }, () => {
    expect(calibrateWear(hist, site)).toEqual(cal);
  });

  it("respects the bracket", () => {
    // a bracket that starts feasible returns its low end
    const high = calibrateWear(hist, site, { lo: 20, hi: 30 });
    expect(high.wear_usd_mwh).toBe(20);
    // a bracket whose top is over budget returns the top, marked infeasible
    const low = calibrateWear(hist, site, { lo: 0, hi: 0.5 });
    if (cyc(0.5) > 300) {
      expect(low.feasible).toBe(false);
      expect(low.wear_usd_mwh).toBe(0.5);
    }
    expect(cal.wear_usd_mwh).toBeGreaterThanOrEqual(0);
    expect(cal.wear_usd_mwh).toBeLessThanOrEqual(60);
  });

  it("returns 0 when W = 0 already meets a looser budget", () => {
    const loose = {
      ...site,
      station: { ...site.station, pulse_cycles_per_yr_budget: 10_000 },
    };
    expect(calibrateWear(hist, loose, { hi: 2 }).wear_usd_mwh).toBe(0);
  });
});
