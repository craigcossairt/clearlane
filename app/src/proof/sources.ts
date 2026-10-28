import type { BacktestResult, Policy } from "@contracts/types";
import { BACKTEST_FILE } from "../data";

/**
 * The proof drawer's files (#90, ff_proof_drawer). Each card reads only its own file, bundled
 * as raw text at build time like data.ts does, so opening the drawer makes no request. A card is
 * added here only once its file is on main; a file that is absent is the empty state and its
 * card does not render, so a late or missing analysis never fails the build.
 */
export const PROOF_FILES = {
  stepStats: "science/step_stats.json",
  backtest: BACKTEST_FILE,
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
    { days: number; modal_hb: number[]; count_at_mode: number; median_step: number }
  >;
  reproduction?: Record<string, { status: string }>;
}

export interface ProofSources {
  stepStats: CardSource<StepStats>;
  backtest: CardSource<BacktestResult>;
  crosscheck: CardSource<CrossCheck>;
}

/** A reader returns the typed data, or a string saying why the shape is not the expected one. */
type Reader<T> = (json: unknown) => T | string;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);

const POLICIES: Policy[] = ["fixed_overnight", "price_only", "clearlane"];

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
  if (!isObj(json.windows) || !isWindow(json.windows.october) || !isWindow(json.windows.july))
    return "no October and July windows";
  if (!isObj(json.per_day)) return "no per_day";
  for (const [day, row] of Object.entries(json.per_day)) {
    if (!isObj(row) || !finite(row.hb)) return `${day} has no hb`;
  }
  const b = json.binomial;
  if (!isObj(b) || !isBinomial(b.october) || !isBinomial(b.july))
    return "no October and July binomial tests";
  const perm = isObj(json.permutation) ? json.permutation.october_vs_july : null;
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

const repoPath = (globKey: string) => globKey.replace(/^(\.\.\/)+/, "");

function read<T>(
  raw: Record<string, unknown>,
  file: string,
  reader: Reader<T>,
): CardSource<T> {
  const entry = Object.entries(raw).find(([key]) => repoPath(key) === file);
  if (!entry || typeof entry[1] !== "string") return { state: "empty", file };
  let json: unknown;
  try {
    json = JSON.parse(entry[1]);
  } catch {
    return { state: "broken", file };
  }
  const out = reader(json);
  return typeof out === "string"
    ? { state: "unknown", file, reason: out }
    : { state: "ok", file, data: out };
}

/** Pure assembly from a raw-text glob map, so tests can feed fixture files. */
export function assembleProof(raw: Record<string, unknown>): ProofSources {
  return {
    stepStats: read(raw, PROOF_FILES.stepStats, readStepStats),
    backtest: read(raw, PROOF_FILES.backtest, readBacktest),
    crosscheck: read(raw, PROOF_FILES.crosscheck, readCrossCheck),
  };
}

let cache: ProofSources | null = null;
export function loadProofSources(): ProofSources {
  cache ??= assembleProof(
    import.meta.glob(
      [
        "../../../science/step_stats.json",
        "../../../public/derived/backtest.json",
        "../../../science/crosscheck.json",
      ],
      {
        eager: true,
        query: "?raw",
        import: "default",
      },
    ),
  );
  return cache;
}
