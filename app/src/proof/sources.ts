import type { BacktestResult, Policy } from "@contracts/types";
import { BACKTEST_FILE } from "../data";

/**
 * The proof drawer's files (#90, ff_proof_drawer). Each card reads only its own file, bundled
 * as raw text at build time like data.ts does, so opening the drawer makes no request. A card is
 * added here only once its file is on main; a file that is absent is the empty state and its
 * card does not render, so a late or missing analysis never fails the build.
 */
export const PROOF_FILES = {
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

export interface ProofSources {
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
    backtest: read(raw, PROOF_FILES.backtest, readBacktest),
    crosscheck: read(raw, PROOF_FILES.crosscheck, readCrossCheck),
  };
}

let cache: ProofSources | null = null;
export function loadProofSources(): ProofSources {
  cache ??= assembleProof(
    import.meta.glob(
      [
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
