// October research numbers, recomputed from the committed research CSVs (CAISO OASIS DAM and EIA-930).
// Ports research/analysis/scripts/join_analysis.py (fossil share by price decile), edam_where_vs_when.py
// (EDAM nodes: cheapest node, a 4-hour block moved in time or space) and pace_analysis.py (peak demand).
// Times are naive hour keys in ms: OASIS GMT starts shifted to MDT (UTC-6), EIA local hour ends less one hour.
import { mean } from "./stats";

export interface CsvTable {
  head: string[];
  rows: string[][];
}

// The OASIS and EIA-930 files have no quoted commas; quotes only wrap header names.
export function parseCsv(text: string): CsvTable {
  const [head, ...lines] = text
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/)
    .map((l) => l.split(",").map((c) => c.replace(/^"|"$/g, "")));
  return { head: head!, rows: lines };
}

const HOUR_MS = 3600_000;
const MDT_OFFSET_H = 6; // every research day is before Nov 1 2026

const col = (t: CsvTable, name: string) => {
  const i = t.head.indexOf(name);
  if (i < 0) throw new Error(`CSV has no ${name} column`);
  return i;
};

// "2026-10-01T06:00:00-00:00" -> ms of the naive UTC instant
const gmtMs = (s: string) => {
  const [y, mo, d, h] = [
    s.slice(0, 4),
    s.slice(5, 7),
    s.slice(8, 10),
    s.slice(11, 13),
  ].map(Number);
  return Date.UTC(y!, mo! - 1, d!, h!);
};

// "07/01/2026 1:00:00 AM" -> ms of the naive local instant
const eiaMs = (s: string) => {
  const m = /^(\d\d)\/(\d\d)\/(\d{4}) (\d+):\d\d:\d\d (AM|PM)$/.exec(s);
  if (!m) throw new Error(`bad EIA time ${s}`);
  const h = (Number(m[4]) % 12) + (m[5] === "PM" ? 12 : 0);
  return Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]), h);
};

const val = (s: string | undefined) => {
  const t = (s ?? "").replace(/,/g, "").trim();
  if (!t) return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
};

// Hour beginning MDT -> node -> LMP, LMP rows only, in file order (a repeated hour keeps its first position).
export function oasisLmp(t: CsvTable): Map<number, Map<string, number>> {
  const [ti, ni, ki, vi] = [
    col(t, "INTERVALSTARTTIME_GMT"),
    col(t, "NODE"),
    col(t, "LMP_TYPE"),
    col(t, "MW"),
  ];
  const out = new Map<number, Map<string, number>>();
  for (const r of t.rows) {
    if (r[ki] !== "LMP") continue;
    const k = gmtMs(r[ti]!) - MDT_OFFSET_H * HOUR_MS;
    if (!out.has(k)) out.set(k, new Map());
    out.get(k)!.set(r[ni]!, Number(r[vi]));
  }
  return out;
}

interface EiaHour {
  demand: number | null;
  fossil: number | null;
}

// Hour beginning local -> demand and fossil share. Fossil share is coal plus gas over the positive part of
// coal, gas, hydro, solar, wind, geothermal and other (join_analysis.py's seven fuels).
export function eiaHours(t: CsvTable): Map<number, EiaHour> {
  const gen = (fuel: string) =>
    col(t, `Net Generation (MW) from ${fuel} (Adjusted)`);
  const fuels = [
    "Coal",
    "Natural Gas",
    "Hydropower Excluding Pumped Storage",
    "Solar without Integrated Battery Storage",
    "Wind without Integrated Battery Storage",
    "Geothermal",
    "Other Fuel Sources",
  ].map(gen);
  const [li, da, dr] = [
    col(t, "Local Time at End of Hour"),
    col(t, "Demand (MW) (Adjusted)"),
    col(t, "Demand (MW)"),
  ];
  const out = new Map<number, EiaHour>();
  for (const r of t.rows) {
    const parts = fuels.map((i) => Math.max(val(r[i]) ?? 0, 0));
    const pos = parts.reduce((a, x) => a + x, 0);
    out.set(eiaMs(r[li]!) - HOUR_MS, {
      demand: val(r[da]) || val(r[dr]) || null,
      fossil: pos ? (parts[0]! + parts[1]!) / pos : null,
    });
  }
  return out;
}

// Largest hourly demand across the files, MW.
export function peakDemandMw(tables: CsvTable[]): number {
  let best = -Infinity;
  for (const t of tables)
    for (const h of eiaHours(t).values())
      if (h.demand !== null && h.demand > best) best = h.demand;
  return best;
}

// PACE hours joined to EIA, ranked by price: mean price and fossil share (%) of the cheapest and priciest tenth.
export function fossilByPriceDecile(
  eia: Map<number, EiaHour>,
  lmp: Map<number, Map<string, number>>,
  node = "ELAP_PACE-APND",
) {
  const keys = [...lmp.keys()].filter((k) => {
    const e = eia.get(k);
    return lmp.get(k)!.has(node) && e?.fossil != null && e.demand;
  });
  const price = (k: number) => lmp.get(k)!.get(node)!;
  const ranked = [...keys].sort((a, z) => price(a) - price(z)); // stable, like Python's sorted
  const n = Math.floor(ranked.length / 10);
  const tenth = (ks: number[]) => ({
    usd_mwh: mean(ks.map(price)),
    fossil_pct: 100 * mean(ks.map((k) => eia.get(k)!.fossil!)),
  });
  return {
    hours: keys.length,
    cheapest: tenth(ranked.slice(0, n)),
    priciest: tenth(ranked.slice(-n)),
  };
}

export const EDAM_NODES = ["ELAP_PACE-APND", "ELAP_PACW-APND", "ELAP_PGE-APND"];

// Over hours priced at every node: how often each node is cheapest, and a 4-hour PACE block per full day
// run at the evening baseline (HB 5pm to 8pm), moved in space (cheapest node, same hours), in time
// (cheapest 4 straight hours at PACE) or both. Block prices are means over days, $/MWh.
export function whereVsWhen(
  lmp: Map<number, Map<string, number>>,
  nodes = EDAM_NODES,
  home = "ELAP_PACE-APND",
) {
  const hrs = [...lmp.keys()]
    .filter((t) => nodes.every((n) => lmp.get(t)!.has(n)))
    .sort((a, z) => a - z);
  const at = (t: number, n: string) => lmp.get(t)!.get(n)!;
  const low = (t: number) => Math.min(...nodes.map((n) => at(t, n)));
  const cheapest = new Map<string, number>(nodes.map((n) => [n, 0]));
  for (const t of hrs) {
    const n = nodes.reduce((b, x) => (at(t, x) < at(t, b) ? x : b));
    cheapest.set(n, cheapest.get(n)! + 1);
  }
  const days = new Map<number, number[]>();
  for (const t of hrs) {
    const d = Math.floor(t / (24 * HOUR_MS));
    if (!days.has(d)) days.set(d, []);
    days.get(d)!.push(t);
  }
  const res = {
    base: [] as number[],
    space: [] as number[],
    time: [] as number[],
    both: [] as number[],
  };
  for (const ts of days.values()) {
    if (ts.length < 24) continue;
    const base = ts.filter((t) => {
      const h = (t / HOUR_MS) % 24;
      return h >= 17 && h <= 20;
    });
    if (base.length < 4) continue;
    const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);
    const block = (f: (t: number) => number) => {
      let best = Infinity;
      for (let i = 0; i + 3 < ts.length; i++)
        best = Math.min(best, sum(ts.slice(i, i + 4).map(f)));
      return best;
    };
    res.base.push(sum(base.map((t) => at(t, home))) / 4);
    res.space.push(sum(base.map(low)) / 4);
    res.time.push(block((t) => at(t, home)) / 4);
    res.both.push(block(low) / 4);
  }
  const b = mean(res.base);
  const saving = (xs: number[]) => (100 * (b - mean(xs))) / b;
  return {
    hours: hrs.length,
    block_days: res.base.length,
    cheapest_share_pct: Object.fromEntries(
      [...cheapest].map(([n, c]) => [n, (100 * c) / hrs.length]),
    ),
    base_usd_mwh: b,
    space_usd_mwh: mean(res.space),
    time_usd_mwh: mean(res.time),
    both_usd_mwh: mean(res.both),
    space_saving_pct: saving(res.space),
    time_saving_pct: saving(res.time),
    both_saving_pct: saving(res.both),
  };
}
