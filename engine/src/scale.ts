// Price impact at fleet scale (moonshot #73, flag ff_price_impact). Nothing in the six beats imports
// this module; engine/cli/scale.ts writes public/derived/scale_curve.json for the proof drawer.
//
// Beat 6 scales value linearly with fleet size ("Assumes the fleet does not move prices"). Here the
// day-ahead price in Mountain hour h moves by slope[h] x fleet MW x the fleet's net injection per MW:
// discharge lowers it, charging raises it. Slopes are $/MWh per MW of net load from the data lane's
// price-response table (#47). The race legs are fixed schedules, so they are repriced; the hourly DP
// (fix.py) re-plans seeing its own impact. With every slope 0 each series is its price-taker number.
import type { Bundle, Provenance } from "@contracts/types";
import type { DpResult } from "./dp";
import { dpHourly, snapshotHour } from "./hourly";
import { REF_E_MWH, REF_RTE, referenceRace, scaleUsdPerDay } from "./reference";
import type { RaceLeg } from "./reference";

export const SCALE_FLEET_MW = [70, 140, 250, 500];

const FLEET_LABEL: Record<number, string> = {
  70: "70 MW: the first MOU (January 2025)",
  140: "140 MW: twice the first MOU",
  250: "250 MW: half the MOU ceiling",
  500: "500 MW: the MOU ceiling (up to 500 MW), not installed capacity",
};

const PROVS: Provenance[] = [
  "REAL",
  "DERIVED",
  "SIMULATED",
  "TORUS_PUBLISHED",
  "ASSUMPTION",
  "MEASURED",
];

// Published unit -> factor to $/MWh per MW.
const UNITS: Record<string, number> = {
  "$/MWh per MW": 1,
  "$/MWh per GW": 1 / 1000,
};

export interface SlopeBin {
  hb: number; // Mountain hour beginning
  slope: number; // $/MWh per MW of net load
  lo: number; // the table's interval
  hi: number;
  r2: number | null;
  n: number | null;
  inconclusive: boolean; // as the table flags it
}

export interface PriceResponse {
  prov: Provenance;
  unit: string; // as published; bins are already in $/MWh per MW
  source: string; // repo path of the table
  sources: string[]; // the table's own sources
  caveat: string;
  bins: SlopeBin[]; // 24, ascending hb
}

const isNum = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x);
const numOrNull = (x: unknown): number | null => (isNum(x) ? x : null);

// Table (c) of public/data/response_tables.json: slope of DA LMP on net load per Mountain hour.
// Throws with a plain reason when the table is not usable.
export function readPriceResponse(raw: unknown, source: string): PriceResponse {
  const t = (raw as { price_response?: unknown } | null)?.price_response as
    Record<string, unknown> | undefined;
  if (!t || typeof t !== "object")
    throw new Error(`${source}: no price_response table`);
  const unit = String(t.unit);
  const f = UNITS[unit];
  if (f === undefined)
    throw new Error(
      `${source}: price_response unit "${unit}" is not one of ${Object.keys(UNITS).join(", ")}`,
    );
  const prov = t.prov as Provenance;
  if (!PROVS.includes(prov))
    throw new Error(`${source}: price_response prov "${String(prov)}"`);
  const raws = t.bins;
  if (!Array.isArray(raws) || raws.length !== 24)
    throw new Error(
      `${source}: price_response needs 24 hourly bins, found ${Array.isArray(raws) ? raws.length : "none"}`,
    );
  const bins = raws.map((r: Record<string, unknown>): SlopeBin => {
    const hb = r.hour_mt;
    if (!Number.isInteger(hb) || (hb as number) < 0 || (hb as number) > 23)
      throw new Error(
        `${source}: bin hour ${String(hb)} is not a Mountain hour 0 to 23`,
      );
    const [slope, lo, hi] = [r.slope, r.ci_lo, r.ci_hi];
    if (!isNum(slope))
      throw new Error(`${source}: hour ${String(hb)} slope is not a number`);
    if (!isNum(lo) || !isNum(hi) || !(lo <= slope && slope <= hi))
      throw new Error(
        `${source}: hour ${String(hb)} interval [${String(lo)}, ${String(hi)}] does not contain the slope ${slope}`,
      );
    return {
      hb: hb as number,
      slope: slope * f,
      lo: lo * f,
      hi: hi * f,
      r2: numOrNull(r.r2),
      n: numOrNull(r.n),
      inconclusive: r.inconclusive === true,
    };
  });
  bins.sort((a, b) => a.hb - b.hb);
  bins.forEach((b, i) => {
    if (b.hb !== i)
      throw new Error(`${source}: hour ${i} is missing or an hour is repeated`);
  });
  return {
    prov,
    unit,
    source,
    sources: Array.isArray(t.sources) ? t.sources.map(String) : [],
    caveat: typeof t.caveat === "string" ? t.caveat : "",
    bins,
  };
}

export interface HourSlope {
  hb: number;
  slope: number; // as estimated, $/MWh per MW
  lo: number;
  hi: number;
  r2: number | null;
  n: number | null;
  used: number; // the slope the curve uses: negative clamped to 0
  used_lo: number;
  used_hi: number;
  clamped: boolean; // the estimate was negative
  inconclusive: boolean; // the interval spans zero (or the table says so)
}

export function prepareSlopes(r: PriceResponse): HourSlope[] {
  return r.bins.map((b) => ({
    hb: b.hb,
    slope: b.slope,
    lo: b.lo,
    hi: b.hi,
    r2: b.r2,
    n: b.n,
    used: Math.max(0, b.slope),
    used_lo: Math.max(0, b.lo),
    used_hi: Math.max(0, b.hi),
    clamped: b.slope < 0,
    inconclusive: b.inconclusive || (b.lo <= 0 && b.hi >= 0),
  }));
}

// A race leg's net grid injection per MW by Mountain hour, + discharge (habit.py's volumes).
export function legInjection(leg: RaceLeg): number[] {
  const q = Array<number>(24).fill(0);
  const cg = REF_E_MWH / REF_RTE ** 0.5;
  const dg = REF_E_MWH * REF_RTE ** 0.5;
  for (const h of leg.charge_hb) q[h]! -= cg / leg.charge_hb.length;
  for (const h of leg.discharge_hb) q[h]! += dg / leg.discharge_hb.length;
  return q;
}

// A fixed schedule at fleet size `mw`: sum of (p - slope x mw x q) x q = price taker - mw x sum(slope x q^2).
export function legAtFleet(
  leg: RaceLeg,
  slopeByHb: number[],
  mw: number,
): number {
  const q = legInjection(leg);
  return (
    leg.usd_per_mw_day -
    mw * q.reduce((a, x, h) => a + slopeByHb[h]! * x * x, 0)
  );
}

// fix.py's hourly DP (1 MW, 2 MWh) at fleet size `mw`, seeing its own impact. The snapshot runs
// HB 1 of the day to HB 0 of the next, so step i takes the slope of Mountain hour snapshotHour(i).
export function dpAtFleet(
  snapshot: number[],
  slopeByHb: number[],
  mw: number,
  W: number,
): DpResult {
  return dpHourly(snapshot, {
    W,
    impact: snapshot.map((_, i) => slopeByHb[snapshotHour(i)]! * mw),
  });
}

export interface ScalePoint {
  fleet_mw: number;
  usd_per_mw_day: number;
  band_low_usd_per_mw_day: number; // every hour at its interval's upper slope
  band_high_usd_per_mw_day: number; // every hour at its interval's lower slope
  usd_per_day: number;
  price_taker_usd_per_day: number;
  pct_of_price_taker: number;
  discharged_mwh_per_mw: number;
}

export interface ScaleSeries {
  id: "fixed_overnight" | "clearlane" | "dp_price_only" | "dp_wear10";
  label: string;
  method: string;
  price_taker_keys: string[]; // numbers.json keys this series equals at slope 0
  price_taker_usd_per_mw_day: number;
  traded_hb: number[]; // Mountain hours the price-taker plan trades
  inconclusive_traded_hb: number[];
  points: ScalePoint[];
}

export interface ScaleCurve {
  schema: "clearlane.scale_curve/v1";
  flag: "ff_price_impact";
  operating_day_mt: string;
  generated_utc: string;
  prov: Provenance; // SIMULATED when the slopes are, else DERIVED
  caveat: string;
  model: string;
  sources: {
    bundle: string;
    snapshot: string;
    response: string;
    response_sources: string[];
    code: string;
  };
  fleet_mw: number[];
  fleet: { mw: number; label: string }[];
  slopes: {
    unit: "$/MWh per MW";
    prov: Provenance;
    caveat: string;
    clamped_hb: number[];
    inconclusive_hb: number[];
    hours: HourSlope[];
  };
  series: ScaleSeries[];
}

export interface ScaleInput {
  bundle: Bundle;
  bundle_path: string;
  snapshot: number[]; // fix.py's vector, research/data/pace_snapshot_<day>.csv
  snapshot_path: string;
  response: PriceResponse;
  generated_utc: string;
}

const CAVEAT =
  "Value to RMP's system at day-ahead prices, per MW of fleet. Beat 6 assumes the fleet does not move prices; this curve estimates how value per MW falls if it does. The slope of PACE price on PACE net load is confounded by gas prices, imports and the wider EDAM footprint that sets the price, so it is an estimate with an interval, not a forecast. 500 MW is the MOU ceiling, not installed capacity.";

const MODEL =
  "The price in each Mountain hour moves by slope x fleet MW x the fleet's net injection per MW: discharge lowers it, charging raises it. Negative slopes are clamped to zero and flagged; an hour whose interval spans zero is marked inconclusive. The off-peak rule and the timetable are fixed schedules, repriced. The hourly DP (1 MW, 2 MWh, as fix.py) re-plans seeing its own price impact. The band puts every hour at its interval's upper slope (low) and lower slope (high).";

const discharged = (acts: number[]) =>
  acts.filter((g) => g > 0).reduce((a, g) => a + g, 0);
const sortedHours = (hs: number[]) => [...new Set(hs)].sort((a, b) => a - b);

export function scaleCurve(x: ScaleInput): ScaleCurve {
  const hours = prepareSlopes(x.response);
  const at = (k: "used" | "used_lo" | "used_hi") => hours.map((h) => h[k]);
  const inconclusive = hours.filter((h) => h.inconclusive).map((h) => h.hb);
  const race = referenceRace(x.bundle);

  type Valuer = (s: number[], mw: number) => { v: number; dis: number };
  const build = (
    id: ScaleSeries["id"],
    label: string,
    method: string,
    keys: string[],
    traded: number[],
    value: Valuer,
  ): ScaleSeries => {
    const pt = value(
      at("used").map(() => 0),
      0,
    ).v;
    return {
      id,
      label,
      method,
      price_taker_keys: keys,
      price_taker_usd_per_mw_day: pt,
      traded_hb: traded,
      inconclusive_traded_hb: traded.filter((h) => inconclusive.includes(h)),
      points: SCALE_FLEET_MW.map((mw) => {
        const mid = value(at("used"), mw);
        return {
          fleet_mw: mw,
          usd_per_mw_day: mid.v,
          band_low_usd_per_mw_day: value(at("used_hi"), mw).v,
          band_high_usd_per_mw_day: value(at("used_lo"), mw).v,
          usd_per_day: scaleUsdPerDay(mid.v, mw),
          price_taker_usd_per_day: scaleUsdPerDay(pt, mw),
          pct_of_price_taker: (mid.v / pt) * 100,
          discharged_mwh_per_mw: mid.dis,
        };
      }),
    };
  };

  const leg =
    (l: RaceLeg): Valuer =>
    (s, mw) => ({ v: legAtFleet(l, s, mw), dis: REF_E_MWH * REF_RTE ** 0.5 });
  const legHours = (l: RaceLeg) =>
    sortedHours([...l.charge_hb, ...l.discharge_hb]);
  const dp =
    (W: number): Valuer =>
    (s, mw) => {
      const r = dpAtFleet(x.snapshot, s, mw, W);
      return { v: r.gross, dis: discharged(r.acts) };
    };
  const dpHours = (W: number) =>
    sortedHours(
      dpHourly(x.snapshot, { W }).acts.flatMap((g, i) =>
        Math.abs(g) > 1e-9 ? [snapshotHour(i)] : [],
      ),
    );

  return {
    schema: "clearlane.scale_curve/v1",
    flag: "ff_price_impact",
    operating_day_mt: x.bundle.operating_day_mt,
    generated_utc: x.generated_utc,
    prov: x.response.prov === "SIMULATED" ? "SIMULATED" : "DERIVED",
    caveat: CAVEAT,
    model: MODEL,
    sources: {
      bundle: x.bundle_path,
      snapshot: x.snapshot_path,
      response: x.response.source,
      response_sources: x.response.sources,
      code: "engine/src/scale.ts",
    },
    fleet_mw: SCALE_FLEET_MW,
    fleet: SCALE_FLEET_MW.map((mw) => ({ mw, label: FLEET_LABEL[mw]! })),
    slopes: {
      unit: "$/MWh per MW",
      prov: x.response.prov,
      caveat: x.response.caveat,
      clamped_hb: hours.filter((h) => h.clamped).map((h) => h.hb),
      inconclusive_hb: inconclusive,
      hours,
    },
    series: [
      build(
        "fixed_overnight",
        "Battery on the off-peak rule",
        "fixed schedule, repriced",
        ["fixed_usd_mw_day", "fixed_70", "fixed_500"],
        legHours(race.fixed),
        leg(race.fixed),
      ),
      build(
        "clearlane",
        "Clearlane timetable: charge in the clear lane",
        "fixed schedule, repriced",
        ["clearlane_usd_mw_day", "clearlane_70", "clearlane_500"],
        legHours(race.timetable),
        leg(race.timetable),
      ),
      build(
        "dp_price_only",
        "Battery-only plan: hourly DP, no wear",
        "hourly DP, re-planned seeing its own impact",
        ["price_only_usd_mw_day"],
        dpHours(0),
        dp(0),
      ),
      build(
        "dp_wear10",
        "Hourly DP with wear at $10/MWh",
        "hourly DP, re-planned seeing its own impact",
        ["wear10_usd_mw_day"],
        dpHours(10),
        dp(10),
      ),
    ],
  };
}
