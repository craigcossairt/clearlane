// Host frontier (ff_host_frontier): how much evening block a host can give RMP before its monthly
// 15-minute peak moves. A month-to-date billing simulation over Oct 1 to 27 with REAL day-ahead prices
// and SIMULATED host load, for three SIMULATED host archetypes. #66 (the fleet roll-up) closed without
// real archetypes, so the shapes and their day scales here are stand-ins and every break point is
// illustrative. Host results are kW only; the one $ figure is grid value, never Torus revenue.
import type { HistDay, Site } from "@contracts/types";
import { INTERVAL_S, INTERVALS } from "./bundle";
import { weekdayIndex } from "./events";
import { DP_FLOOR_LEVEL, eta, hold4, pulseDz } from "./limits";
import { mulberry32 } from "./rng";
import { defaultSite } from "./site";
import { mean } from "./stats";

const STEP_H = INTERVAL_S / 3600;
const TOL = 1e-9;
const PEAK_TOL_KW = 1e-6;
const BISECT = 50;

export const BLOCK_HOURS_MT = [18, 19, 20, 21]; // HB 6pm-9pm, the evening_avg window
export const BLOCK_STEPS = 10;
export const DAY_NOISE = 0.05; // each day's scale moves up to 5% either way (SIMULATED)

// Days start and end at the DP's floor level (25 kWh of 500), as the day-ahead plans do.
export const startSocKwh = (site: Site) => DP_FLOOR_LEVEL * pulseDz(site);
export const START_SOC_KWH = startSocKwh(defaultSite());

export interface Archetype {
  key: string;
  label: string;
  prov: "SIMULATED";
  shape_kw_15m: number[];
  weekend_scale: number;
  note: string;
}

// Host load by Mountain hour beginning, kW (SIMULATED).
const SCHOOL_KW = [
  220, 220, 220, 220, 220, 240, 320, 480, 640, 720, 760, 780, 780, 760, 700,
  560, 420, 340, 320, 300, 280, 260, 240, 220,
];
const GROCERY_KW = [
  520, 500, 490, 480, 480, 500, 540, 580, 620, 650, 680, 700, 720, 740, 760,
  780, 800, 800, 790, 770, 740, 690, 620, 560,
];

export const ARCHETYPES: Archetype[] = [
  {
    key: "machining_shop",
    label: "Machining shop (SIMULATED; the stage host's shape)",
    prov: "SIMULATED",
    shape_kw_15m: defaultSite().host_load_kw_15m,
    weekend_scale: 0.6,
    note: "The stage host from engine/src/site.ts: an 800 kW peak at HB 2pm-3pm and a second shift to HB 8pm.",
  },
  {
    key: "school",
    label: "School (SIMULATED)",
    prov: "SIMULATED",
    shape_kw_15m: hold4(SCHOOL_KW),
    weekend_scale: 0.45,
    note: "A late-morning peak of 780 kW, about 300 kW in the evening.",
  },
  {
    key: "grocery_refrigeration",
    label: "Grocery refrigeration (SIMULATED)",
    prov: "SIMULATED",
    shape_kw_15m: hold4(GROCERY_KW),
    weekend_scale: 0.85,
    note: "A high refrigeration base and an 800 kW peak at HB 4pm-5pm that runs into the evening block.",
  },
];

// One SIMULATED scale per day: the weekend scale on Saturday and Sunday, times up to DAY_NOISE either
// way. Seeded per archetype, so the same seed gives the same days.
export function dayScales(
  days: string[],
  a: Archetype,
  index: number,
  seed: number,
): number[] {
  const rng = mulberry32((seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
  return days.map((d) => {
    const u = rng();
    return (
      (weekdayIndex(d) >= 5 ? a.weekend_scale : 1) *
      (1 + DAY_NOISE * (2 * u - 1))
    );
  });
}

export const hostDay = (a: Archetype, scale: number) =>
  a.shape_kw_15m.map((kw) => kw * scale);

export const blockMask = (): boolean[] =>
  Array.from({ length: INTERVALS }, (_, t) =>
    BLOCK_HOURS_MT.includes(Math.floor(t / 4)),
  );

export type NotDeliverable = "energy" | "export" | "power";

export interface DayPlan {
  feasible: boolean;
  reason: NotDeliverable | null;
  ceiling_kw: number;
  charge_kw: number[];
  discharge_kw: number[];
  soc_kwh: number[]; // INTERVALS + 1
  meter_kw: number[];
  meter_peak_kw: number;
  value_usd: number;
}

// One day held under `ceiling` kW at the meter, with at least `blockKw` of discharge in every block
// interval. Pulse discharges only what that needs and charges in the cheapest earlier intervals that
// stay under the ceiling and inside the battery (ties go to the later interval).
export function planDay(
  prices96: number[],
  host96: number[],
  site: Site,
  ceiling: number,
  blockKw: number,
  mask: boolean[],
): DayPlan {
  const P = site.station.pulse_kw;
  const E = site.station.pulse_kwh;
  const e = eta(site);
  const exp = site.export_limit_kw.value;
  const s0 = startSocKwh(site);
  const need = host96.map((h, t) =>
    Math.max(0, h - ceiling, mask[t] ? blockKw : 0),
  );
  const room = host96.map((h, t) =>
    need[t]! > 0 ? 0 : Math.max(0, Math.min(P, ceiling - h)),
  );
  const charge = new Array<number>(INTERVALS).fill(0);
  const soc = new Array<number>(INTERVALS + 1).fill(s0);
  const path = () => {
    for (let t = 0; t < INTERVALS; t++)
      soc[t + 1] = soc[t]! + charge[t]! * STEP_H * e - (need[t]! * STEP_H) / e;
  };
  const fail = (reason: NotDeliverable): DayPlan => ({
    feasible: false,
    reason,
    ceiling_kw: ceiling,
    charge_kw: charge,
    discharge_kw: need,
    soc_kwh: soc,
    meter_kw: [],
    meter_peak_kw: Number.NaN,
    value_usd: Number.NaN,
  });
  for (let t = 0; t < INTERVALS; t++) {
    if (need[t]! > host96[t]! + exp + TOL) return fail("export");
    if (need[t]! > P + TOL) return fail("power");
  }
  const order = Array.from({ length: INTERVALS }, (_, s) => s).sort(
    (a, b) => prices96[a]! - prices96[b]! || b - a,
  );
  // Buys `deficit` kWh of stored energy from slots before `before`; false if it cannot.
  const buy = (deficit: number, before: number): boolean => {
    for (const s of order) {
      if (deficit <= TOL) break;
      if (s >= before || room[s]! - charge[s]! <= TOL) continue;
      let cap = Infinity;
      for (let k = s + 1; k <= INTERVALS; k++) cap = Math.min(cap, E - soc[k]!);
      const add = Math.min(deficit, (room[s]! - charge[s]!) * STEP_H * e, cap);
      if (add <= TOL) continue;
      charge[s]! += add / (STEP_H * e);
      deficit -= add;
      path();
    }
    return deficit <= TOL;
  };
  path();
  for (let t = 0; t < INTERVALS; t++)
    if (need[t]! > 0 && soc[t + 1]! < -TOL && !buy(-soc[t + 1]!, t))
      return fail("energy");
  if (soc[INTERVALS]! < s0 - TOL && !buy(s0 - soc[INTERVALS]!, INTERVALS))
    return fail("energy");
  const meter = host96.map((h, t) => h + charge[t]! - need[t]!);
  let value = 0;
  for (let t = 0; t < INTERVALS; t++)
    value += (prices96[t]! * (need[t]! - charge[t]!) * STEP_H) / 1000;
  return {
    feasible: true,
    reason: null,
    ceiling_kw: ceiling,
    charge_kw: charge,
    discharge_kw: need,
    soc_kwh: soc,
    meter_kw: meter,
    meter_peak_kw: Math.max(...meter),
    value_usd: value,
  };
}

// The lowest ceiling the day can hold with the block, by bisection; null when no ceiling can.
export function minCeiling(
  prices96: number[],
  host96: number[],
  site: Site,
  blockKw: number,
  mask: boolean[],
): number | null {
  const ok = (c: number) =>
    planDay(prices96, host96, site, c, blockKw, mask).feasible;
  let hi = Math.max(...host96) + site.station.pulse_kw; // charging room is never short here
  if (!ok(hi)) return null;
  let lo = 0;
  if (ok(lo)) return lo;
  for (let i = 0; i < BISECT; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

export interface MonthDay {
  day: string;
  min_ceiling_kw: number;
  ceiling_kw: number;
  meter_peak_kw: number;
  mtd_peak_kw: number;
  value_usd: number;
}

export interface MonthRun {
  block_kw: number;
  deliverable: boolean;
  not_deliverable_reason: string | null;
  days: MonthDay[];
  monthly_peak_kw: number | null;
  grid_value_usd_per_mw_day: number | null;
}

// The month-to-date billing simulation. With the ratchet, each day may run up to the month-to-date peak
// set so far without raising the bill, and never shaves below it; without it, each day holds its own
// lowest ceiling.
export function runMonth(
  days: HistDay[],
  hosts: number[][],
  site: Site,
  blockKw: number,
  o: { ratchet: boolean; mask?: boolean[] },
): MonthRun {
  const mask = o.mask ?? blockMask();
  const rows: MonthDay[] = [];
  let mtd = 0;
  for (let i = 0; i < days.length; i++) {
    const d = days[i]!;
    const prices = hold4(d.lmp_usd_mwh);
    const host = hosts[i]!;
    const cmin = minCeiling(prices, host, site, blockKw, mask);
    if (cmin === null) {
      const why = planDay(
        prices,
        host,
        site,
        Math.max(...host) + site.station.pulse_kw,
        blockKw,
        mask,
      ).reason;
      return {
        block_kw: blockKw,
        deliverable: false,
        not_deliverable_reason:
          why === "export"
            ? `export: on ${d.operating_day_mt} the host's evening load is below ${blockKw} kW and the export limit is ${site.export_limit_kw.value} kW`
            : why === "power"
              ? `power: the block is above Pulse's ${site.station.pulse_kw} kW`
              : `energy: Pulse's ${site.station.pulse_kwh} kWh cannot hold ${blockKw} kW for ${BLOCK_HOURS_MT.length} hours`,
        days: [],
        monthly_peak_kw: null,
        grid_value_usd_per_mw_day: null,
      };
    }
    const ceiling = o.ratchet ? Math.max(mtd, cmin) : cmin;
    const p = planDay(prices, host, site, ceiling, blockKw, mask);
    mtd = Math.max(mtd, p.meter_peak_kw);
    rows.push({
      day: d.operating_day_mt,
      min_ceiling_kw: cmin,
      ceiling_kw: ceiling,
      meter_peak_kw: p.meter_peak_kw,
      mtd_peak_kw: mtd,
      value_usd: p.value_usd,
    });
  }
  return {
    block_kw: blockKw,
    deliverable: true,
    not_deliverable_reason: null,
    days: rows,
    monthly_peak_kw: mtd,
    grid_value_usd_per_mw_day:
      mean(rows.map((r) => r.value_usd)) / (site.station.pulse_kw / 1000),
  };
}

// The comparison: peak shaving alone, with no evening block at all.
export const peakShavingMonth = (
  days: HistDay[],
  hosts: number[][],
  site: Site,
): MonthRun =>
  runMonth(days, hosts, site, 0, {
    ratchet: true,
    mask: new Array<boolean>(INTERVALS).fill(false),
  });

export interface FrontierStep {
  block_kw: number;
  deliverable: boolean;
  not_deliverable_reason: string | null;
  monthly_peak_kw: number | null;
  peak_increase_kw: number | null;
  days_with_higher_day_peak: number | null;
  grid_value_usd_per_mw_day: number | null;
  mtd_peak_kw: number[] | null;
}

export interface FrontierArchetype {
  key: string;
  label: string;
  prov: "SIMULATED";
  note: string;
  shape_kw_by_hour: number[];
  day_scale: {
    prov: "SIMULATED";
    weekend_scale: number;
    noise: number;
    values: number[];
  };
  host_peak_without_storage_kw: number;
  peak_shaving_only: {
    monthly_peak_kw: number;
    grid_value_usd_per_mw_day: number;
  };
  steps: FrontierStep[];
  break_point_kw: number;
  break_point_without_ratchet_kw: number;
  statement: string;
}

export interface HostFrontier {
  schema: "clearlane.host_frontier/v1";
  flag: "ff_host_frontier";
  prov: "SIMULATED";
  window: { start_mt: string; end_mt: string; days: number };
  seed: number;
  prices: { prov: "REAL"; source: string; note: string };
  station: {
    pulse_kw: number;
    pulse_kwh: number;
    rte: number;
    start_soc_kwh: number;
    export_limit_kw: number;
  };
  block: { hours_mt: number[]; label: string; steps_kw: number[] };
  archetypes: FrontierArchetype[];
  notes: string[];
}

// Largest step at and below which every step is deliverable and `ok`.
function breakPoint(runs: MonthRun[], ok: (r: MonthRun) => boolean): number {
  let bp = 0;
  for (const r of runs) {
    if (!r.deliverable || !ok(r)) break;
    bp = r.block_kw;
  }
  return bp;
}

const kw = (x: number) => `${x.toFixed(0)} kW`;

export function buildFrontier(
  hist: HistDay[],
  site: Site,
  o: {
    seed: number;
    start_mt: string;
    end_mt: string;
    hist_path: string;
    ratchet?: boolean;
  },
): HostFrontier {
  const ratchet = o.ratchet ?? true;
  const days = hist
    .filter(
      (d) =>
        d.operating_day_mt >= o.start_mt &&
        d.operating_day_mt <= o.end_mt &&
        d.lmp_usd_mwh.length === 24 &&
        d.lmp_usd_mwh.every(Number.isFinite),
    )
    .sort((a, b) => (a.operating_day_mt < b.operating_day_mt ? -1 : 1));
  const names = days.map((d) => d.operating_day_mt);
  const P = site.station.pulse_kw;
  const steps = Array.from(
    { length: BLOCK_STEPS + 1 },
    (_, i) => (P * i) / BLOCK_STEPS,
  );

  const archetypes = ARCHETYPES.map((a, i): FrontierArchetype => {
    const scales = dayScales(names, a, i, o.seed);
    const hosts = scales.map((s) => hostDay(a, s));
    const month = (x: number, r: boolean) =>
      runMonth(days, hosts, site, x, { ratchet: r });
    const on = steps.map((x) => month(x, ratchet));
    const off = steps.map((x) => month(x, false));
    const base = on[0]!.monthly_peak_kw!;
    const offBase = off[0]!;
    const bp = ratchet
      ? breakPoint(on, (r) => r.monthly_peak_kw! <= base + PEAK_TOL_KW)
      : breakPoint(on, (r) =>
          r.days.every(
            (d, k) =>
              d.meter_peak_kw <= offBase.days[k]!.meter_peak_kw + PEAK_TOL_KW,
          ),
        );
    const bpOff = breakPoint(off, (r) =>
      r.days.every(
        (d, k) =>
          d.meter_peak_kw <= offBase.days[k]!.meter_peak_kw + PEAK_TOL_KW,
      ),
    );
    const shave = peakShavingMonth(days, hosts, site);
    const hostPeak = Math.max(...hosts.flat());
    const next = on.find((r) => r.block_kw > bp);
    const statement =
      (bp === 0
        ? `${a.label}: any evening block in HB 6pm-9pm lifts the month's peak above where peak shaving alone puts it (${kw(base)}, against ${kw(hostPeak)} without storage)`
        : `${a.label}: an evening block of up to ${kw(bp)} in HB 6pm-9pm leaves the month's peak where peak shaving alone puts it (${kw(base)}, against ${kw(hostPeak)} without storage)`) +
      (next === undefined
        ? "."
        : next.deliverable
          ? `; at ${kw(next.block_kw)} it rises ${kw(next.monthly_peak_kw! - base)}.`
          : `; ${kw(next.block_kw)} is not deliverable (${next.not_deliverable_reason!.split(":")[0]}).`) +
      ` Ignoring the month-to-date ratchet, the break point would be ${kw(bpOff)}.`;
    return {
      key: a.key,
      label: a.label,
      prov: "SIMULATED",
      note: a.note,
      shape_kw_by_hour: a.shape_kw_15m.filter((_, t) => t % 4 === 0),
      day_scale: {
        prov: "SIMULATED",
        weekend_scale: a.weekend_scale,
        noise: DAY_NOISE,
        values: scales,
      },
      host_peak_without_storage_kw: hostPeak,
      peak_shaving_only: {
        monthly_peak_kw: shave.monthly_peak_kw!,
        grid_value_usd_per_mw_day: shave.grid_value_usd_per_mw_day!,
      },
      steps: on.map((r) => ({
        block_kw: r.block_kw,
        deliverable: r.deliverable,
        not_deliverable_reason: r.not_deliverable_reason,
        monthly_peak_kw: r.monthly_peak_kw,
        peak_increase_kw: r.deliverable ? r.monthly_peak_kw! - base : null,
        days_with_higher_day_peak: r.deliverable
          ? r.days.filter(
              (d, k) =>
                d.meter_peak_kw > on[0]!.days[k]!.meter_peak_kw + PEAK_TOL_KW,
            ).length
          : null,
        grid_value_usd_per_mw_day: r.grid_value_usd_per_mw_day,
        mtd_peak_kw: r.deliverable ? r.days.map((d) => d.mtd_peak_kw) : null,
      })),
      break_point_kw: bp,
      break_point_without_ratchet_kw: bpOff,
      statement,
    };
  });

  return {
    schema: "clearlane.host_frontier/v1",
    flag: "ff_host_frontier",
    prov: "SIMULATED",
    window: { start_mt: o.start_mt, end_mt: o.end_mt, days: days.length },
    seed: o.seed,
    prices: {
      prov: "REAL",
      source: o.hist_path,
      note: "PACE day-ahead LMP by Mountain hour, held for each 15-minute interval",
    },
    station: {
      pulse_kw: P,
      pulse_kwh: site.station.pulse_kwh,
      rte: site.station.rte.value,
      start_soc_kwh: startSocKwh(site),
      export_limit_kw: site.export_limit_kw.value,
    },
    block: {
      hours_mt: BLOCK_HOURS_MT,
      label: "HB 6pm-9pm (6pm to 10pm MT)",
      steps_kw: steps,
    },
    archetypes,
    notes: [
      "#66 (the fleet roll-up) closed without real host archetypes, so the three host shapes and their day scales are SIMULATED stand-ins. Every break point is illustrative.",
      "The machining shop is the stage host's shape from engine/src/site.ts; the stage host and every stage number are unchanged.",
      "Host results are in kW only: RMP's C&I demand charges are not verified, so no host dollar figure is shown.",
      "Grid value is the day-ahead value of Pulse's net energy at REAL PACE prices, in $/MW-day gross of wear: value to RMP's system, not Torus revenue and not a host bill.",
      "Month-to-date ratchet: each day the host may run up to the month-to-date 15-minute peak set so far without raising its bill, and never shaves below it. The month's peak is the bill's peak.",
      "Peak shaving only (block 0): Pulse discharges just enough to hold the meter at the lowest ceiling the day allows, or at the month-to-date peak if that is higher, and charges in the cheapest intervals that stay under it. A block adds at least the block size of discharge in every HB 6pm-9pm interval.",
      "Not deliverable: Pulse's stored energy cannot hold the block for 4 hours (energy), or the host's evening load is below the block with no export allowed (export).",
      "Break point: the largest block at and below which every step leaves the month's peak where peak shaving alone puts it. Without the ratchet a host would compare each day with its own peak-shaving day; that stricter reading is break_point_without_ratchet_kw.",
      "days_with_higher_day_peak counts the days whose own peak is above the same day's at block 0. Under the ratchet such a day still sits at or under the month-to-date peak, so the bill moves only when peak_increase_kw is above 0.",
      "Each day starts and ends at 25 kWh, as the day-ahead plans do, and is planned with that day's prices and SIMULATED host load known.",
    ],
  };
}
