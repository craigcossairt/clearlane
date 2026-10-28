// The reference race (habit.py) and the Option 2 shift (numbers.py), on any bundle.
// 1 MW / 2 MWh battery, RTE 0.88 (ASSUMPTION, FACTS ref_station). Values are value to RMP's
// system at day-ahead prices, per MW. The off-peak rule is our baseline, never Torus practice.
import type { Bundle } from "@contracts/types";

export const REF_RTE = 0.88;
export const REF_E_MWH = 2;

export interface RaceLeg {
  charge_hb: number[];
  discharge_hb: number[];
  usd_per_mw_day: number;
  charge_mean_usd_mwh: number;
  discharge_mean_usd_mwh: number;
  co2_t_per_mw_day: number; // + avoided
  /** MWh bought from the grid per MW (REF_E_MWH / sqrt(RTE)). ASSUMPTION station. */
  charge_mwh: number;
  /** MWh sold to the grid per MW (REF_E_MWH * sqrt(RTE)). */
  discharge_mwh: number;
  /** charge_mwh at the mean charge price; sell - buy is usd_per_mw_day. */
  buy_usd_per_mw_day: number;
  /** discharge_mwh at the mean discharge price. */
  sell_usd_per_mw_day: number;
}

export interface ReferenceRace {
  fixed: RaceLeg; // "Battery on the off-peak rule"
  timetable: RaceLeg; // charge in the clear lane
  ratio: number;
}

const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);

// habit.py run(): operation order kept so the pins match to the last digit.
function leg(b: Bundle, chg: number[], dis: number[]): RaceLeg {
  const price = (h: number) => b.hours[h]!.lmp_usd_mwh;
  const ci = (h: number) => b.hours[h]!.co2_g_kwh;
  const cg = REF_E_MWH / REF_RTE ** 0.5;
  const dg = REF_E_MWH * REF_RTE ** 0.5;
  const cost = (sum(chg.map(price)) * cg) / chg.length;
  const rev = (sum(dis.map(price)) * dg) / dis.length;
  const co2Add = (sum(chg.map(ci)) * cg) / chg.length / 1000;
  const co2Avoid = (sum(dis.map(ci)) * dg) / dis.length / 1000;
  return {
    charge_hb: chg,
    discharge_hb: dis,
    usd_per_mw_day: rev - cost,
    charge_mean_usd_mwh: sum(chg.map(price)) / chg.length,
    discharge_mean_usd_mwh: sum(dis.map(price)) / dis.length,
    co2_t_per_mw_day: co2Avoid - co2Add,
    charge_mwh: cg,
    discharge_mwh: dg,
    buy_usd_per_mw_day: cost,
    sell_usd_per_mw_day: rev,
  };
}

// Hours from `from` to `to` inclusive, ranked by price (ties go to the earlier hour).
function ranked(b: Bundle, from: number, to: number, dir: 1 | -1): number[] {
  const hs = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return hs.sort(
    (x, y) =>
      dir * (b.hours[x]!.lmp_usd_mwh - b.hours[y]!.lmp_usd_mwh) || x - y,
  );
}

const asc = (xs: number[]) => [...xs].sort((a, z) => a - z);

export function referenceRace(b: Bundle): ReferenceRace {
  const fixed = leg(b, [1, 2, 3, 4], [18, 19]);
  const timetable = leg(b, asc(ranked(b, 9, 17, 1).slice(0, 3)), [18, 19]);
  return {
    fixed,
    timetable,
    ratio: timetable.usd_per_mw_day / fixed.usd_per_mw_day,
  };
}

// Price taker: value scales linearly with fleet size.
export function scaleUsdPerDay(usdPerMwDay: number, fleetMw: number): number {
  return usdPerMwDay * fleetMw;
}

export interface Option2Opts {
  mw: number;
  hours: number;
  window_hb: [number, number];
}

export interface Option2Shift {
  from_hb: number[];
  to_hb: number[];
  mwh: number;
  usd: number;
  co2_t: number; // + avoided; average-emissions estimate
}

// A SIMULATED flexible campus moves load from the priciest hours to the cheapest hours in the
// midday window (no storage, so no losses).
export function option2Shift(
  b: Bundle,
  opts: Option2Opts = { mw: 25, hours: 3, window_hb: [9, 17] },
): Option2Shift {
  const from = asc(ranked(b, 0, 23, -1).slice(0, opts.hours));
  // destination hours never include a source hour, and there must be as many of them
  const to = asc(
    ranked(b, opts.window_hb[0], opts.window_hb[1], 1)
      .filter((h) => !from.includes(h))
      .slice(0, opts.hours),
  );
  if (to.length < opts.hours)
    throw new Error(
      `option2Shift: only ${to.length} free hours in HB ${opts.window_hb[0]}-${opts.window_hb[1]} for ${opts.hours}`,
    );
  const p = (h: number) => b.hours[h]!.lmp_usd_mwh;
  const ci = (h: number) => b.hours[h]!.co2_g_kwh;
  return {
    from_hb: from,
    to_hb: to,
    mwh: opts.mw * opts.hours,
    usd: opts.mw * (sum(from.map(p)) - sum(to.map(p))),
    co2_t: (opts.mw * (sum(from.map(ci)) - sum(to.map(ci)))) / 1000,
  };
}
