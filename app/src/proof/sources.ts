import type { BacktestResult, Policy, Provenance } from "@contracts/types";
import { BACKTEST_FILE } from "../data";

/**
 * The proof drawer's files (#90, ff_proof_drawer), in drawer order. Each card reads only its own
 * file, bundled at build time like data.ts does, so opening the drawer makes no request. A card
 * may be wired before its analysis merges: until the file is on main it is absent, the empty
 * state, and its card does not render, so a late or missing analysis never fails the build.
 */
export const PROOF_FILES = {
  stepStats: "science/step_stats.json",
  backtest: BACKTEST_FILE,
  intervals: "science/backtest_intervals.json",
  callLedger: "public/derived/call_ledger.json",
  rtReplay: "public/derived/rt_replay.json",
  crosscheck: "science/crosscheck.json",
} as const;

export type ProofCardId = keyof typeof PROOF_FILES;

/** empty: no file. broken: it will not parse. unknown: it parses, in a shape the card does not read. */
export type CardSource<T> =
  | { state: "empty"; file: string }
  | { state: "broken"; file: string }
  | { state: "unknown"; file: string; reason: string }
  | { state: "ok"; file: string; data: T };

/**
 * science/crosscheck.json, the fields the card reads. Written here until Integration exports a
 * contract type for it; the reader below checks each one.
 */
export interface CrossCheckRow {
  status: string;
  unit?: string;
  tolerance?: string;
  pinned?: { facts?: unknown };
  science?: unknown;
  second_path?: {
    passes_tolerance?: boolean;
    source?: string;
    value?: unknown;
  };
}

export interface CrossCheck {
  schema: "clearlane.science.crosscheck/v1";
  operating_day_mt?: string;
  checks: Record<string, CrossCheckRow>;
}

export interface Binomial {
  n: number;
  k: number;
  p_value: number;
}

/** science/step_stats.json (#108), the fields the card reads. */
export interface StepStats {
  schema: "clearlane.science.step_stats/v1";
  target_hb: number[];
  windows: { october: [string, string]; july: [string, string] };
  per_day: Record<string, { hb: number }>;
  binomial: { october: Binomial; july: Binomial };
  permutation: {
    october_vs_july: {
      b_perms: number;
      observed: { tvd: number };
      tvd: { n_ge: number; p_value: number };
    };
  };
  months?: Record<
    string,
    {
      days: number;
      modal_hb: number[];
      count_at_mode: number;
      median_step: number;
    }
  >;
  reproduction?: Record<string, { status: string }>;
}

export type Interval = [number, number];
type ByPolicy<T> = Record<Policy, T>;

/** science/backtest_intervals.json (#111): resampled 90% intervals on the backtest medians. */
export interface BacktestIntervals {
  schema: "clearlane.science.backtest_intervals/v1";
  level: number;
  block_len: number;
  resamples: number;
  point: {
    p50: ByPolicy<number>;
    days_beating_fixed_overnight_pct: ByPolicy<number>;
  };
  bootstrap: {
    moving_block: {
      p50: ByPolicy<Interval>;
      days_beating_fixed_overnight_pct: ByPolicy<Interval>;
    };
    stationary?: { p50: ByPolicy<Interval> };
  };
  seed_stability?: { moving_block?: { max_endpoint_change_usd?: number } };
  point_vs_backtest_json?: Record<string, { status: string }>;
}

export interface Pctl {
  p10: number;
  p50: number;
  p90: number;
  mean: number;
}

/** public/derived/rt_replay.json (#72): the day replayed on real-time prices three ways. */
export interface RtReplay {
  schema: "clearlane.rt_replay/v1";
  window: { start_mt: string; end_mt: string };
  settlement: { status: string };
  prov: { values: Provenance };
  summary: {
    days: number;
    net_usd_per_mw_day: { hold: Pctl; replan: Pctl; foresight: Pctl };
    regret_usd_per_mw_day: { hold: Pctl; replan: Pctl };
    days_replan_above_hold: number;
    days_replan_below_hold: number;
    rt_evening_below_midday_days: number;
    da_evening_below_midday_days: number;
  };
}

export interface LedgerRow {
  reading: string;
  for_stage: boolean;
  policy: Policy;
  calls: number;
  delivered_at_or_above_90_pct_share: number;
  unanswerable_calls: number;
  shortfall_calls: number;
  shortfall_kwh: number;
}

/**
 * public/derived/call_ledger.json (#68), its summary parts only. The per-call rows stay out of
 * the bundle: see loadProofSources.
 */
export interface CallLedger {
  schema: "clearlane.call_ledger/v1";
  prov: Provenance;
  replay_density: {
    calls_per_reading: number;
    backtest_days: number;
    calls_per_day: number;
    rate_2025_per_day: number;
    ratio_to_2025_rate: number;
  };
  summary: LedgerRow[];
}

export interface ProofSources {
  stepStats: CardSource<StepStats>;
  backtest: CardSource<BacktestResult>;
  intervals: CardSource<BacktestIntervals>;
  callLedger: CardSource<CallLedger>;
  rtReplay: CardSource<RtReplay>;
  crosscheck: CardSource<CrossCheck>;
}

/** A reader returns the typed data, or a string saying why the shape is not the expected one. */
type Reader<T> = (json: unknown) => T | string;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);

const POLICIES: Policy[] = ["fixed_overnight", "price_only", "clearlane"];
const PROVS: Provenance[] = [
  "REAL",
  "DERIVED",
  "SIMULATED",
  "TORUS_PUBLISHED",
  "ASSUMPTION",
  "MEASURED",
];
const isProv = (v: unknown): v is Provenance => PROVS.includes(v as Provenance);

export const readBacktest: Reader<BacktestResult> = (json) => {
  if (!isObj(json) || json.schema !== "clearlane.backtest/v1")
    return `schema is not clearlane.backtest/v1`;
  if (!isObj(json.window) || !Array.isArray(json.window.missing_days))
    return "no window";
  if (!Array.isArray(json.policies)) return "no policies";
  for (const p of json.policies) {
    if (!isObj(p) || !POLICIES.includes(p.policy as Policy))
      return "unknown policy";
    const v = p.usd_per_mw_day;
    if (
      !isObj(v) ||
      !finite(v.p10) ||
      !finite(v.p50) ||
      !finite(v.p90) ||
      !finite(v.mean)
    )
      return `${String(p.policy)} has no usd_per_mw_day percentiles`;
  }
  return json as unknown as BacktestResult;
};

export const readCrossCheck: Reader<CrossCheck> = (json) => {
  if (!isObj(json) || json.schema !== "clearlane.science.crosscheck/v1")
    return "schema is not clearlane.science.crosscheck/v1";
  if (!isObj(json.checks)) return "no checks";
  for (const [name, row] of Object.entries(json.checks)) {
    if (!isObj(row) || typeof row.status !== "string")
      return `${name} has no status`;
  }
  return json as unknown as CrossCheck;
};

const isWindow = (v: unknown) =>
  Array.isArray(v) && v.length === 2 && v.every((d) => typeof d === "string");
const isBinomial = (v: unknown) =>
  isObj(v) && finite(v.n) && finite(v.k) && finite(v.p_value);

export const readStepStats: Reader<StepStats> = (json) => {
  if (!isObj(json) || json.schema !== "clearlane.science.step_stats/v1")
    return "schema is not clearlane.science.step_stats/v1";
  if (!Array.isArray(json.target_hb) || !json.target_hb.every(finite))
    return "no target_hb";
  if (
    !isObj(json.windows) ||
    !isWindow(json.windows.october) ||
    !isWindow(json.windows.july)
  )
    return "no October and July windows";
  if (!isObj(json.per_day)) return "no per_day";
  for (const [day, row] of Object.entries(json.per_day)) {
    if (!isObj(row) || !finite(row.hb)) return `${day} has no hb`;
  }
  const b = json.binomial;
  if (!isObj(b) || !isBinomial(b.october) || !isBinomial(b.july))
    return "no October and July binomial tests";
  const perm = isObj(json.permutation)
    ? json.permutation.october_vs_july
    : null;
  if (
    !isObj(perm) ||
    !finite(perm.b_perms) ||
    !isObj(perm.observed) ||
    !finite(perm.observed.tvd) ||
    !isObj(perm.tvd) ||
    !finite(perm.tvd.n_ge) ||
    !finite(perm.tvd.p_value)
  )
    return "no October against July permutation test";
  return json as unknown as StepStats;
};

/** Every policy present, each value passing check. */
const byPolicy = (v: unknown, check: (x: unknown) => boolean) =>
  isObj(v) && POLICIES.every((p) => check(v[p]));
const isInterval = (v: unknown) =>
  Array.isArray(v) && v.length === 2 && v.every(finite) && v[0] <= v[1];

export const readIntervals: Reader<BacktestIntervals> = (json) => {
  if (!isObj(json) || json.schema !== "clearlane.science.backtest_intervals/v1")
    return "schema is not clearlane.science.backtest_intervals/v1";
  if (!finite(json.level) || !finite(json.block_len) || !finite(json.resamples))
    return "no level, block_len or resamples";
  const point = json.point;
  if (
    !isObj(point) ||
    !byPolicy(point.p50, finite) ||
    !byPolicy(point.days_beating_fixed_overnight_pct, finite)
  )
    return "no point values for every policy";
  const mb = isObj(json.bootstrap) ? json.bootstrap.moving_block : null;
  if (
    !isObj(mb) ||
    !byPolicy(mb.p50, isInterval) ||
    !byPolicy(mb.days_beating_fixed_overnight_pct, isInterval)
  )
    return "no moving-block intervals for every policy";
  return json as unknown as BacktestIntervals;
};

const isPctl = (v: unknown) =>
  isObj(v) && finite(v.p10) && finite(v.p50) && finite(v.p90) && finite(v.mean);

export const readRtReplay: Reader<RtReplay> = (json) => {
  if (!isObj(json) || json.schema !== "clearlane.rt_replay/v1")
    return "schema is not clearlane.rt_replay/v1";
  if (
    !isObj(json.window) ||
    typeof json.window.start_mt !== "string" ||
    typeof json.window.end_mt !== "string"
  )
    return "no window";
  // The settlement status must reach the card: an unverified rule is never shown as settled.
  if (!isObj(json.settlement) || typeof json.settlement.status !== "string")
    return "no settlement status";
  if (!isObj(json.prov) || !isProv(json.prov.values))
    return "no provenance for the values";
  const s = json.summary;
  if (!isObj(s)) return "no summary";
  const net = s.net_usd_per_mw_day;
  const regret = s.regret_usd_per_mw_day;
  if (
    !isObj(net) ||
    !isPctl(net.hold) ||
    !isPctl(net.replan) ||
    !isPctl(net.foresight)
  )
    return "no net value percentiles for hold, replan and foresight";
  if (!isObj(regret) || !isPctl(regret.hold) || !isPctl(regret.replan))
    return "no regret percentiles for hold and replan";
  for (const k of [
    "days",
    "days_replan_above_hold",
    "days_replan_below_hold",
    "rt_evening_below_midday_days",
    "da_evening_below_midday_days",
  ])
    if (!finite(s[k])) return `no ${k}`;
  return json as unknown as RtReplay;
};

export const readCallLedger: Reader<CallLedger> = (json) => {
  if (!isObj(json) || json.schema !== "clearlane.call_ledger/v1")
    return "schema is not clearlane.call_ledger/v1";
  if (!isProv(json.prov)) return "no provenance";
  const d = json.replay_density;
  if (
    !isObj(d) ||
    ![
      "calls_per_reading",
      "backtest_days",
      "calls_per_day",
      "rate_2025_per_day",
      "ratio_to_2025_rate",
    ].every((k) => finite(d[k]))
  )
    return "no replay density";
  if (!Array.isArray(json.summary)) return "no summary";
  for (const r of json.summary) {
    if (
      !isObj(r) ||
      typeof r.reading !== "string" ||
      typeof r.for_stage !== "boolean" ||
      !POLICIES.includes(r.policy as Policy) ||
      ![
        "calls",
        "delivered_at_or_above_90_pct_share",
        "unanswerable_calls",
        "shortfall_calls",
        "shortfall_kwh",
      ].every((k) => finite(r[k]))
    )
      return "a summary row is missing a policy, reading or count";
  }
  // The card shows only the stage reading, one row per policy.
  const stage = json.summary.filter((r) => isObj(r) && r.for_stage === true);
  if (POLICIES.some((p) => stage.filter((r) => r.policy === p).length !== 1))
    return "no single stage reading for every policy";
  return json as unknown as CallLedger;
};

const repoPath = (globKey: string) => globKey.replace(/^(\.\.\/)+/, "");

/** A glob entry is raw text to parse, or a file Vite has already parsed (the call ledger). */
function read<T>(
  raw: Record<string, unknown>,
  file: string,
  reader: Reader<T>,
): CardSource<T> {
  const entry = Object.entries(raw).find(([key]) => repoPath(key) === file);
  if (!entry || (typeof entry[1] !== "string" && !isObj(entry[1])))
    return { state: "empty", file };
  let json: unknown = entry[1];
  if (typeof json === "string") {
    try {
      json = JSON.parse(json);
    } catch {
      return { state: "broken", file };
    }
  }
  const out = reader(json);
  return typeof out === "string"
    ? { state: "unknown", file, reason: out }
    : { state: "ok", file, data: out };
}

/** Pure assembly from a glob map of raw text (or parsed files), so tests can feed fixture files. */
export function assembleProof(raw: Record<string, unknown>): ProofSources {
  return {
    stepStats: read(raw, PROOF_FILES.stepStats, readStepStats),
    backtest: read(raw, PROOF_FILES.backtest, readBacktest),
    intervals: read(raw, PROOF_FILES.intervals, readIntervals),
    callLedger: read(raw, PROOF_FILES.callLedger, readCallLedger),
    rtReplay: read(raw, PROOF_FILES.rtReplay, readRtReplay),
    crosscheck: read(raw, PROOF_FILES.crosscheck, readCrossCheck),
  };
}

/** Globs of one file's named parts, merged into one parsed object per file. */
function byFile(
  parts: Record<string, Record<string, unknown>>,
): Record<string, unknown> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [part, files] of Object.entries(parts)) {
    for (const [key, value] of Object.entries(files)) {
      out[key] ??= {};
      out[key][part] = value;
    }
  }
  return out;
}

/**
 * The call ledger (about a megabyte) and the RT replay are almost all per-call and per-day rows
 * the cards never show. Each part a card reads is imported as its own named JSON export, so the
 * build keeps those parts and drops the rows. Like every glob here, an absent file is no entry.
 */
function partFiles(): Record<string, unknown> {
  return {
    ...byFile({
      schema: import.meta.glob("../../../public/derived/call_ledger.json", {
        eager: true,
        import: "schema",
      }),
      prov: import.meta.glob("../../../public/derived/call_ledger.json", {
        eager: true,
        import: "prov",
      }),
      replay_density: import.meta.glob(
        "../../../public/derived/call_ledger.json",
        { eager: true, import: "replay_density" },
      ),
      summary: import.meta.glob("../../../public/derived/call_ledger.json", {
        eager: true,
        import: "summary",
      }),
    }),
    ...byFile({
      schema: import.meta.glob("../../../public/derived/rt_replay.json", {
        eager: true,
        import: "schema",
      }),
      window: import.meta.glob("../../../public/derived/rt_replay.json", {
        eager: true,
        import: "window",
      }),
      settlement: import.meta.glob("../../../public/derived/rt_replay.json", {
        eager: true,
        import: "settlement",
      }),
      prov: import.meta.glob("../../../public/derived/rt_replay.json", {
        eager: true,
        import: "prov",
      }),
      summary: import.meta.glob("../../../public/derived/rt_replay.json", {
        eager: true,
        import: "summary",
      }),
    }),
  };
}

let cache: ProofSources | null = null;
export function loadProofSources(): ProofSources {
  cache ??= assembleProof({
    ...import.meta.glob(
      [
        "../../../science/step_stats.json",
        "../../../public/derived/backtest.json",
        "../../../science/backtest_intervals.json",
        "../../../science/crosscheck.json",
      ],
      {
        eager: true,
        query: "?raw",
        import: "default",
      },
    ),
    ...partFiles(),
  });
  return cache;
}
