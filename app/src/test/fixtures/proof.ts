// Proof-drawer card fixtures (#90): the raw text each card's file might hold, keyed the way
// import.meta.glob keys them from app/src/proof. Small on purpose; the real files are checked
// in ProofDrawer.test.tsx through loadProofSources().

export const BACKTEST_KEY = "../../../public/derived/backtest.json";
export const CROSSCHECK_KEY = "../../../science/crosscheck.json";

const pctl = (p10: number, p50: number, p90: number, mean: number) => ({
  p10,
  p50,
  p90,
  mean,
});

const policy = (name: string, usd: ReturnType<typeof pctl>) => ({
  policy: name,
  usd_per_mw_day: usd,
  co2_t_per_mw_day: pctl(0, 0, 0, 0),
  pulse_cycles_per_yr: 300,
  calls_unanswerable_pct: {
    heatmap_as_mt: 1,
    heatmap_as_utc: 2,
    heatmap_as_utc_mst: 3,
  },
  host_ceiling_breaches: 0,
  days_beating_fixed_overnight_pct: 50,
});

export const BACKTEST_OK = JSON.stringify({
  schema: "clearlane.backtest/v1",
  window: {
    start_mt: "2026-05-01",
    end_mt: "2026-10-27",
    days: 179,
    missing_days: ["2026-05-01"],
  },
  wear_usd_mwh: 10,
  seed: 1,
  policies: [
    policy("fixed_overnight", pctl(-10, 5, 50, 15)),
    policy("price_only", pctl(20, 45, 130, 60)),
    policy("clearlane", pctl(1, 38, 115, 51)),
  ],
});

const check = (status: string, extra: Record<string, unknown> = {}) => ({
  facts_key: null,
  inputs: [],
  method: "fixture",
  numbers_key: null,
  pinned: { facts: 1, numbers_json: null },
  science: 1,
  status,
  tolerance: "exact",
  unit: "$/MW-day",
  ...extra,
});

export const CROSSCHECK_OK = JSON.stringify({
  schema: "clearlane.science.crosscheck/v1",
  script: "science/crosscheck.py",
  operating_day_mt: "2026-10-27",
  inputs: [],
  notes: [],
  checks: {
    a_match: check("match"),
    b_match: check("match"),
    c_pending: check("pending"),
    d_off: check("mismatch", {
      facts_key: "d_off",
      pinned: { facts: 58.4053, numbers_json: null },
      science: 58.40968,
      second_path: {
        passes_tolerance: true,
        source: "snapshot prices rounded to cents",
        value: 58.40534,
      },
    }),
  },
});

/** A file that exists but does not parse: the broken state. */
export const BROKEN_TEXT = '{"schema": "clearlane.backtest/v1", "policies": [';

/** Parses, but is not the shape the card reads: the unknown state. */
export const UNKNOWN_BACKTEST = JSON.stringify({
  schema: "clearlane.backtest/v2",
  policies: [],
});
export const UNKNOWN_CROSSCHECK = JSON.stringify({
  schema: "clearlane.science.crosscheck/v1",
  checks: { a: { method: "no status" } },
});
