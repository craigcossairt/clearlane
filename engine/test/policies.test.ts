import { describe, expect, it } from "vitest";
import { checkPlan, defaultSite, referenceRace, solve } from "@engine/index";
import { loadFixture } from "./helpers/fixture";

const b = loadFixture();
const site = defaultSite();
const fixed = solve(b, site, "fixed_overnight");
const priceOnly = solve(b, site, "price_only");
const clear = solve(b, site, "clearlane");

describe("solve() returns full plans", () => {
  it.each([fixed, priceOnly, clear])(
    "$policy has 96 intervals and the plan fields",
    (p) => {
      expect(p.intervals).toHaveLength(96);
      expect(p.intervals[0]!.ts_utc).toBe("2026-10-27T06:00:00Z");
      expect(p.intervals[95]!.ts_utc).toBe("2026-10-28T05:45:00Z");
      expect(p.site_id).toBe(site.id);
      expect(p.operating_day_mt).toBe("2026-10-27");
      expect(Number.isFinite(p.solve_ms) && p.solve_ms >= 0).toBe(true);
      for (const iv of p.intervals) {
        expect(iv.meter_kw).toBeCloseTo(
          site.host_load_kw_15m[iv.i]! + iv.pulse_kw + iv.spin_kw,
          9,
        );
      }
      expect(p.value_usd_per_mw_day).toBeCloseTo(p.value_usd / 0.25, 9);
    },
  );

  it("marks lanes and SCH", () => {
    expect(clear.intervals[40]!.lane).toBe("clear"); // HB 10
    expect(clear.intervals[72]!.lane).toBe("jam"); // HB 18
    expect(clear.intervals.filter((iv) => iv.system_critical)).toHaveLength(24); // HB 18-23
  });
});

describe("fixed_overnight is the off-peak rule", () => {
  const race = referenceRace(b);
  it("equals the reference race to the cent", () => {
    expect(fixed.value_usd_per_mw_day).toBeCloseTo(
      race.fixed.usd_per_mw_day,
      6,
    );
    expect(fixed.value_usd_per_mw_day.toFixed(2)).toBe("20.06");
    // co2_avoided_kg per 0.25 MW -> t/MW-day
    expect(Math.abs(fixed.co2_avoided_kg / 1000 / 0.25 - -0.2625)).toBeLessThan(
      1e-4,
    );
  });

  it("fills from empty over HB 1-4 and empties over HB 18-19, with no Spin", () => {
    const iv = fixed.intervals;
    expect(iv[3]!.pulse_soc_kwh).toBe(0);
    expect(iv[19]!.pulse_soc_kwh).toBeCloseTo(500, 9);
    expect(iv[79]!.pulse_soc_kwh).toBeCloseTo(0, 9);
    const active = iv
      .filter((x) => x.pulse_kw !== 0)
      .map((x) => Math.floor(x.i / 4));
    expect([...new Set(active)]).toEqual([1, 2, 3, 4, 18, 19]);
    expect(iv.every((x) => x.spin_kw === 0 && x.spin_soc_kwh === 0)).toBe(true);
    expect(fixed.pulse_cycles).toBeCloseTo(0.88 ** 0.5, 9); // 500 kWh stored x eta / 500 kWh
  });
});

describe("price_only and clearlane", () => {
  it("clearlane stays under the host ceiling; price_only does not", () => {
    expect(clear.host_peak_kw).toBeLessThanOrEqual(site.host_ceiling_kw);
    expect(priceOnly.host_peak_kw).toBeGreaterThan(site.host_ceiling_kw);
  });

  it("price_only is worth at least clearlane", () => {
    expect(priceOnly.value_usd).toBeGreaterThanOrEqual(clear.value_usd);
    expect(priceOnly.wear_usd_mwh).toBe(0);
    expect(clear.wear_usd_mwh).toBe(10);
  });

  it("clearlane keeps Spin full on standby; price_only has no Spin", () => {
    expect(
      clear.intervals.every((x) => x.spin_soc_kwh === 25 && x.spin_kw === 0),
    ).toBe(true);
    expect(priceOnly.intervals.every((x) => x.spin_soc_kwh === 0)).toBe(true);
  });

  it("spare_kw follows the formula", () => {
    for (const x of clear.intervals) {
      const want = Math.min(250 + (250 - Math.abs(x.pulse_kw)), x.meter_kw + 0);
      expect(x.spare_kw).toBeCloseTo(want, 9);
    }
  });

  it("takes the wear option", () => {
    expect(solve(b, site, "clearlane", { wear_usd_mwh: 0 }).wear_usd_mwh).toBe(
      0,
    );
  });

  it("every solved plan is clean", () => {
    expect(checkPlan(fixed, site)).toEqual([]);
    expect(checkPlan(priceOnly, site)).toEqual([]);
    expect(checkPlan(clear, site)).toEqual([]);
  });

  it("prints the clearlane value (candidate clearlane_dp_usd_mw_day)", () => {
    console.log(
      `clearlane ${clear.value_usd_per_mw_day.toFixed(6)} $/MW-day, price_only ${priceOnly.value_usd_per_mw_day.toFixed(6)}, cycles ${clear.pulse_cycles.toFixed(4)}`,
    );
    expect(clear.value_usd_per_mw_day).toBeGreaterThan(
      fixed.value_usd_per_mw_day,
    );
  });
});
