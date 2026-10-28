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

export const STEP_STATS_KEY = "../../../science/step_stats.json";

const binom = (n: number, k: number, p_value: number) => ({
  n,
  k,
  p_value,
  p0: "2/23",
  expected: (2 * n) / 23,
});

export const STEP_STATS_OK = JSON.stringify({
  schema: "clearlane.science.step_stats/v1",
  class: "DERIVED",
  flag: "off_step_stats",
  script: "science/step_stats.py",
  seed: 108,
  target_hb: [17, 18],
  windows: {
    october: ["2026-10-01", "2026-10-27"],
    july: ["2026-07-01", "2026-07-30"],
  },
  per_day: {
    "2026-07-01": { hb: 14, step: 5 },
    "2026-07-02": { hb: 19, step: 6 },
    "2026-07-31": { hb: 18, step: 7 },
    "2026-10-01": { hb: 18, step: 15 },
    "2026-10-02": { hb: 17, step: 12 },
    "2026-10-03": { hb: 18, step: 16 },
    "2026-10-04": { hb: 6, step: 3 },
  },
  binomial: { october: binom(4, 3, 0.0012), july: binom(2, 0, 1) },
  permutation: {
    october_vs_july: {
      b_perms: 1000,
      seed: 108,
      observed: { tvd: 0.75 },
      tvd: { n_ge: 3, p_value: 0.004 },
    },
  },
  months: {
    "2026-07": { days: 3, modal_hb: [14, 18, 19], count_at_mode: 1, median_step: 6 },
    "2026-10": { days: 4, modal_hb: [18], count_at_mode: 2, median_step: 13.5 },
  },
  reproduction: { a: { status: "match" }, b: { status: "match" }, c: { status: "mismatch" } },
});

export const UNKNOWN_STEP_STATS = JSON.stringify({
  schema: "clearlane.science.step_stats/v1",
  per_day: {},
});
