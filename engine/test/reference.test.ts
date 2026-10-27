import { describe, expect, it } from "vitest";
import { option2Shift, referenceRace, scaleUsdPerDay } from "@engine/index";
import { loadFixture, redated } from "./helpers/fixture";

const b = loadFixture();
const race = referenceRace(b);

// habit.py's EIA hour-ending table, shifted with ci[h] = he[h + 1]
const HE: Record<number, number> = {
  1: 697,
  2: 697,
  3: 695,
  4: 694,
  5: 698,
  6: 704,
  7: 709,
  8: 698,
  9: 623,
  10: 534,
  11: 485,
  12: 461,
  13: 455,
  14: 450,
  15: 443,
  16: 446,
  17: 464,
  18: 531,
  19: 629,
  20: 673,
  21: 676,
  22: 682,
  23: 684,
  24: 693,
};

describe("reference race on the Oct 27 fixture (habit.py)", () => {
  it("pins the values", () => {
    expect(race.fixed.usd_per_mw_day).toBeCloseTo(20.064746, 6);
    expect(race.timetable.usd_per_mw_day).toBeCloseTo(58.405341, 6);
    expect(race.fixed.usd_per_mw_day.toFixed(2)).toBe("20.06");
    expect(race.timetable.usd_per_mw_day.toFixed(2)).toBe("58.41");
    expect(race.ratio.toFixed(3)).toBe("2.911");
  });

  it("pins the hours and prices", () => {
    expect(race.fixed.charge_hb).toEqual([1, 2, 3, 4]);
    expect(race.timetable.charge_hb).toEqual([13, 14, 15]);
    expect(race.timetable.discharge_hb).toEqual([18, 19]);
    expect(race.fixed.charge_mean_usd_mwh.toFixed(2)).toBe("39.53");
    expect(race.timetable.charge_mean_usd_mwh.toFixed(2)).toBe("21.55");
    expect(race.fixed.discharge_mean_usd_mwh).toBeCloseTo(55.615, 9);
  });

  it("pins CO2 to 1e-4 t/MW-day", () => {
    expect(Math.abs(race.fixed.co2_t_per_mw_day - -0.262493)).toBeLessThan(
      1e-4,
    );
    expect(Math.abs(race.timetable.co2_t_per_mw_day - 0.269798)).toBeLessThan(
      1e-4,
    );
  });

  it("uses the bundle's hour-beginning CO2, which equals habit.py's ci[h] = he[h + 1]", () => {
    for (const h of [1, 2, 3, 4, 13, 14, 15, 18, 19])
      expect(b.hours[h]!.co2_g_kwh).toBe(HE[h + 1]);
  });

  it("scales linearly", () => {
    const usd = (x: number) =>
      x.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    expect(usd(scaleUsdPerDay(race.fixed.usd_per_mw_day, 70))).toBe("1,404.53");
    expect(usd(scaleUsdPerDay(race.timetable.usd_per_mw_day, 70))).toBe(
      "4,088.37",
    );
    expect(usd(scaleUsdPerDay(race.fixed.usd_per_mw_day, 500))).toBe(
      "10,032.37",
    );
    expect(usd(scaleUsdPerDay(race.timetable.usd_per_mw_day, 500))).toBe(
      "29,202.67",
    );
  });
});

describe("option 2 shift (numbers.py)", () => {
  it("moves 25 MW x 3 h from the priciest hours to the cheapest midday hours", () => {
    const s = option2Shift(b, { mw: 25, hours: 3, window_hb: [9, 17] });
    expect(s.from_hb).toEqual([18, 19, 20]);
    expect(s.to_hb).toEqual([13, 14, 15]);
    expect(s.mwh).toBe(75);
    expect(s.usd.toFixed(2)).toBe("2550.75");
    // CO2 avoided: 25 MW x (evening minus midday hour-beginning g/kWh) / 1000
    expect(s.co2_t).toBeCloseTo(
      (25 * (629 + 673 + 676 - (450 + 443 + 446))) / 1000,
      9,
    );
  });

  it("defaults to the pinned case", () => {
    expect(option2Shift(b)).toEqual(
      option2Shift(b, { mw: 25, hours: 3, window_hb: [9, 17] }),
    );
  });
});

describe("a second day", () => {
  it("takes its race and shift hours from its own prices", () => {
    const p = b.hours.map((h) => h.lmp_usd_mwh);
    const d2 = redated(b, 1, [...p.slice(12), ...p.slice(0, 12)]);
    const r = referenceRace(d2);
    // expected hours come from d2's own prices: the 3 cheapest of HB 9-17 and the 3 priciest of the day
    const q = d2.hours.map((h) => h.lmp_usd_mwh);
    const pick = (hs: number[], dir: 1 | -1) =>
      [...hs]
        .sort((x, y) => dir * (q[x]! - q[y]!) || x - y)
        .slice(0, 3)
        .sort((x, y) => x - y);
    const all = Array.from({ length: 24 }, (_, h) => h);
    expect(r.timetable.charge_hb).toEqual(pick(all.slice(9, 18), 1));
    expect(option2Shift(d2).from_hb).toEqual(pick(all, -1));
    expect(option2Shift(d2).from_hb).toEqual([6, 7, 8]); // old HB 18-20 moved 12 hours
  });
});
