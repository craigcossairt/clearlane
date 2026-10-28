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

export const INTERVALS_KEY = "../../../science/backtest_intervals.json";

const byPolicy = <T,>(fixed_overnight: T, price_only: T, clearlane: T) => ({
  fixed_overnight,
  price_only,
  clearlane,
});

export const INTERVALS_OK = JSON.stringify({
  schema: "clearlane.science.backtest_intervals/v1",
  class: "DERIVED",
  level: 0.9,
  block_len: 7,
  resamples: 2000,
  point: {
    p50: byPolicy(5, 45, 38),
    days_beating_fixed_overnight_pct: byPolicy(0, 100, 91),
  },
  bootstrap: {
    moving_block: {
      p50: byPolicy([-2.5, 9], [40, 52], [33, 48.25]),
      days_beating_fixed_overnight_pct: byPolicy([0, 0], [100, 100], [85.4, 95.6]),
    },
    stationary: { p50: byPolicy([-3, 10], [39, 53], [32.77, 48.9]) },
    iid: { p50: byPolicy([4, 6], [44, 46], [37.5, 38.5]) },
  },
  seed_stability: { moving_block: { max_endpoint_change_usd: 1.01 } },
  point_vs_backtest_json: {
    a: { status: "match" },
    b: { status: "match" },
    c: { status: "mismatch" },
  },
});

export const UNKNOWN_INTERVALS = JSON.stringify({
  schema: "clearlane.science.backtest_intervals/v1",
  level: 0.9,
  block_len: 7,
  resamples: 2000,
  point: { p50: { clearlane: 38 } },
});

export const RT_REPLAY_KEY = "../../../public/derived/rt_replay.json";

const rtPctl = (p10: number, p50: number, p90: number, mean: number) => ({ p10, p50, p90, mean });

export const rtReplay = (status = "UNVERIFIED") =>
  JSON.stringify({
    schema: "clearlane.rt_replay/v1",
    flag: "ff_rt_replay",
    window: { start_mt: "2026-05-01", end_mt: "2026-10-27", days: 179 },
    wear_usd_mwh: 10.95,
    settlement: { rule: "fixture", prov: "ASSUMPTION", status },
    prov: { da_prices: "REAL", rt_prices: "REAL", site: "SIMULATED", values: "DERIVED", forecast: "ASSUMPTION" },
    summary: {
      days: 179,
      net_usd_per_mw_day: {
        hold: rtPctl(0.25, 19.17, 95.4, 34.65),
        replan: rtPctl(-11.18, 18.58, 72.15, 20.43),
        foresight: rtPctl(15.43, 45.6, 127.51, 66.78),
      },
      regret_usd_per_mw_day: {
        hold: rtPctl(8.58, 19.11, 53.98, 32.13),
        replan: rtPctl(10.91, 27.16, 68.35, 46.35),
      },
      days_replan_above_hold: 56,
      days_replan_below_hold: 123,
      rt_evening_below_midday_days: 17,
      da_evening_below_midday_days: 0,
    },
    days: [{ operating_day_mt: "2026-05-02" }],
  });

export const RT_REPLAY_OK = rtReplay();

export const UNKNOWN_RT_REPLAY = JSON.stringify({
  schema: "clearlane.rt_replay/v1",
  window: { start_mt: "2026-05-01", end_mt: "2026-10-27" },
  prov: { values: "DERIVED" },
  summary: {},
});

export const CALL_LEDGER_KEY = "../../../public/derived/call_ledger.json";

const ledgerRow = (
  reading: string,
  policy: string,
  share: number,
  unanswerable: number,
  short: number,
  kwh: number,
) => ({
  reading,
  for_stage: reading === "mt",
  policy,
  calls: 359,
  delivered_at_or_above_90_pct_share: share,
  unanswerable_calls: unanswerable,
  shortfall_calls: short,
  shortfall_kwh: kwh,
});

export const CALL_LEDGER_OK = JSON.stringify({
  schema: "clearlane.call_ledger/v1",
  flag: "ff_call_ledger",
  prov: "SIMULATED",
  replay_density: {
    calls_per_reading: 359,
    backtest_days: 179,
    calls_per_day: 2.005586592178771,
    rate_2025_per_day: 0.9835616438356164,
    ratio_to_2025_rate: 2.039106145251397,
  },
  summary: [
    ledgerRow("mt", "fixed_overnight", 74.09, 93, 94, 2004.13),
    ledgerRow("mt", "price_only", 58.22, 150, 150, 3131.13),
    ledgerRow("mt", "clearlane", 98.61, 5, 17, 82.36),
    ledgerRow("utc", "fixed_overnight", 81.34, 67, 69, 1417.55),
    ledgerRow("utc", "price_only", 54.04, 165, 166, 3431.77),
    ledgerRow("utc", "clearlane", 97.77, 4, 6, 48.64),
  ],
  rows: [{ call_id: "ledger-mt-001" }],
});

export const UNKNOWN_CALL_LEDGER = JSON.stringify({
  schema: "clearlane.call_ledger/v1",
  prov: "SIMULATED",
  replay_density: {
    calls_per_reading: 359,
    backtest_days: 179,
    calls_per_day: 2,
    rate_2025_per_day: 1,
    ratio_to_2025_rate: 2,
  },
  summary: [ledgerRow("utc", "clearlane", 97.77, 4, 6, 48.64)],
});
