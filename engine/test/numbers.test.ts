import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type {
  BacktestResult,
  HistDay,
  StageNumber,
  TorusPublished,
} from "@contracts/types";
import { stableJson } from "@engine/json";
import { NEW_KEYS } from "@engine/newKeys";
import {
  buildNumbers,
  factsRegistry,
  largestStep,
  registryWithNewKeys,
  snapshotPricesFromCsv,
  stepHourDays,
  validateNumbers,
} from "@engine/numbers";
import type { NumberInputs } from "@engine/numbers";
import { DEFAULT_WEAR_USD_MWH } from "@engine/policies";
import { defaultSite } from "@engine/site";
import { loadFixture, redated, repoPath } from "./helpers/fixture";
import { loadDam } from "./helpers/oasis";

const read = (p: string) => readFileSync(repoPath(p), "utf8");
const facts = factsRegistry(read("docs/FACTS.md"));
const reg = registryWithNewKeys(facts);
const BUNDLE = "contracts/fixtures/bundle_2026-10-27.json";
const SNAP = "research/data/pace_snapshot_2026-10-27.csv";
const TORUS = "public/data/torus_published.json";
const inputs: NumberInputs = {
  bundle: loadFixture(),
  bundle_path: BUNDLE,
  site: defaultSite(),
  wear_usd_mwh: DEFAULT_WEAR_USD_MWH,
  snapshot: { prices: snapshotPricesFromCsv(read(SNAP)), path: SNAP },
  torus: { data: JSON.parse(read(TORUS)) as TorusPublished, path: TORUS },
};
const nums = buildNumbers(inputs, reg);
const byKey = new Map(nums.map((n) => [n.key, n]));
const v = (k: string) => {
  const n = byKey.get(k);
  if (!n) throw new Error(`missing ${k}`);
  return n.value;
};

describe("the FACTS registry", () => {
  it("parses keys and classes from the key column", () => {
    expect(facts.get("fixed_usd_mw_day")).toBe("DERIVED");
    expect(facts.get("peak_price")).toBe("REAL");
    expect(facts.get("rmp_events_2025")).toBe("TORUS_PUBLISHED");
    expect(facts.get("solve_ms")).toBe("MEASURED");
    expect(facts.has("C1")).toBe(false);
  });

  it("new keys are not already FACTS rows", () => {
    for (const k of Object.keys(NEW_KEYS)) expect(facts.has(k)).toBe(false);
  });
});

describe("numbers on the Oct 27 fixture", () => {
  it("validates, sorted, with FACTS classes", () => {
    expect(validateNumbers(nums, reg)).toEqual([]);
  });

  it("pins the reference race to the cent", () => {
    expect(v("fixed_usd_mw_day").toFixed(2)).toBe("20.06");
    expect(v("clearlane_usd_mw_day").toFixed(2)).toBe("58.41");
    expect(byKey.get("race_ratio")!.display).toBe("2.9x");
    expect(v("fixed_70").toFixed(0)).toBe("1405");
    expect(v("clearlane_70").toFixed(0)).toBe("4088");
    expect(v("fixed_500").toFixed(0)).toBe("10032");
    expect(v("clearlane_500").toFixed(0)).toBe("29203");
    expect(v("fixed_rule_charge_usd_mwh").toFixed(2)).toBe("39.53");
    expect(v("timetable_charge_usd_mwh").toFixed(2)).toBe("21.55");
    expect(v("race_discharge_usd_mwh").toFixed(2)).toBe("55.62");
    expect(v("co2_fixed_t_per_mw_day").toFixed(4)).toBe("-0.2625");
    expect(v("co2_timetable_t_per_mw_day").toFixed(3)).toBe("0.270");
    expect(v("co2_added_70").toFixed(1)).toBe("18.4");
    expect(v("co2_avoided_70").toFixed(1)).toBe("18.9");
    expect(v("co2_500_fixed_overnight").toFixed(1)).toBe("131.2");
    expect(v("co2_500_clearlane").toFixed(1)).toBe("134.9");
    expect(v("charge_co2_race_fixed_overnight").toFixed(0)).toBe("696");
    expect(v("charge_co2_race_clearlane").toFixed(0)).toBe("446");
    expect(v("discharge_co2_race").toFixed(0)).toBe("651");
    expect(byKey.get("campus_usd")!.display).toBe("$2,551");
    expect(v("campus_mwh")).toBe(75);
  });

  it("pins the fix.py reproductions to the cent, as of Oct 27", () => {
    expect(v("price_only_usd_mw_day").toFixed(2)).toBe("65.79");
    expect(v("wear10_usd_mw_day").toFixed(2)).toBe("57.54");
    expect(v("battery_only_reserve_usd").toFixed(2)).toBe("55.56");
    expect(byKey.get("reserve_cost_pct")!.display).toBe("3.4%");
    const shares = (k: string) =>
      ["_mt", "_utc_mdt", "_utc_mst"].map((s) => byKey.get(k + s)!.display);
    expect(shares("calls_unanswerable_price_only")).toEqual([
      "77%",
      "52%",
      "43%",
    ]);
    expect(shares("calls_unanswerable_wear10")).toEqual(["40%", "18%", "14%"]);
    expect(byKey.get("wear10_usd_mw_day")!.as_of_mt).toBe("2026-10-27");
  });

  it("pins the stage-day numbers", () => {
    const d = (k: string) => byKey.get(k)!.display;
    expect(d("price_min_oct27")).toBe("$21.38");
    expect(d("peak_price")).toBe("$55.78");
    expect(d("peak_over_trough")).toBe("2.6x");
    expect(d("peak_hour_mt")).toBe("6pm");
    expect(d("trough_hour_mt")).toBe("3pm");
    expect(d("overnight_avg")).toBe("$38.71");
    expect(d("midday_avg")).toBe("$22.83");
    expect(d("evening_avg")).toBe("$55.31");
    expect(d("lane_clear_max_usd")).toBe("$29.98");
    expect(d("lane_jam_min_usd")).toBe("$47.18");
    expect([v("lane_hours_oct27_clear"), v("lane_hours_oct27_jam")]).toEqual([
      8, 6,
    ]);
    expect(d("solar_4pm_to_6pm_mw_4pm")).toBe("2,056");
    expect(d("solar_4pm_to_6pm_mw_6pm")).toBe("36");
    expect(d("net_load_climb_mw")).toBe("3,655");
    expect(d("net_load_max_oct27")).toBe("4,709");
    expect(d("load_peak_oct27_mw")).toBe("6,024");
    expect(v("sch_hours_today")).toBe(6);
  });

  it("pins the site plan and the scripted calls", () => {
    expect(v("clearlane_dp_usd_mw_day").toFixed(6)).toBe("55.714123");
    expect(v("cycles_today").toFixed(4)).toBe("1.2195");
    expect(v("enrolled_kw")).toBe(250);
    expect(v("host_ceiling_kw")).toBe(800);
    expect(v("call_duration_s")).toBe(330);
    expect(v("meter_peak_refill_kw")).toBeLessThanOrEqual(v("host_ceiling_kw"));
    expect(v("second_call_delivered_pct").toFixed(2)).toBe("70.68");
    expect(v("second_call_shortfall_kwh").toFixed(3)).toBe("6.514");
    expect(v("second_call_shortfall_kw")).toBeCloseTo(
      (v("second_call_shortfall_kwh") * 3600) / 330,
      9,
    );
  });

  it("sources Torus facts to their URLs", () => {
    for (const k of [
      "rmp_events_2025",
      "rmp_event_ramp_s",
      "torus_pulse_cycles",
      "mou_70mw",
    ]) {
      expect(byKey.get(k)!.prov).toBe("TORUS_PUBLISHED");
      expect(byKey.get(k)!.source).toMatch(/^https:\/\//);
    }
    expect(v("rmp_event_ramp_s")).toBe(19);
    expect(v("rmp_event_ramp_target_s")).toBe(30);
    expect([
      v("rmp_event_target_pct"),
      v("rmp_event_band_min_pct"),
      v("rmp_event_band_max_pct"),
    ]).toEqual([102, 90, 100]);
    expect(v("pulse_cycle_budget")).toBe(300);
    expect(v("spin_kwh_per_kw")).toBe(0.1);
    expect(v("spin_recharge_min")).toBe(6);
  });

  it("never holds a MEASURED value", () => {
    expect(nums.some((n) => n.prov === "MEASURED")).toBe(false);
    expect(byKey.has("solve_ms")).toBe(false);
    expect(byKey.has("replan_ms")).toBe(false);
  });

  it("is identical on rerun", () => {
    expect(stableJson(buildNumbers(inputs, reg))).toBe(stableJson(nums));
  });
});

describe("missing inputs", () => {
  it("leaves out their keys", () => {
    const bare = buildNumbers(
      { ...inputs, snapshot: undefined, torus: undefined },
      reg,
    );
    const keys = new Set(bare.map((n) => n.key));
    expect(keys.has("price_only_usd_mw_day")).toBe(false);
    expect(keys.has("rmp_events_2025")).toBe(false);
    expect(keys.has("calls_unanswerable_wear10_mt")).toBe(false);
    expect(keys.has("fixed_usd_mw_day")).toBe(true);
    expect(validateNumbers(bare, reg)).toEqual([]);
  });
});

describe("a second stage day", () => {
  it("builds and validates with no code change", () => {
    const b = loadFixture();
    const p = b.hours.map((h) => h.lmp_usd_mwh);
    const d2 = redated(b, 1, [...p.slice(12), ...p.slice(0, 12)]);
    const n2 = buildNumbers(
      { ...inputs, bundle: d2, bundle_path: "x.json" },
      reg,
    );
    expect(validateNumbers(n2, reg)).toEqual([]);
    const day = n2.find((n) => n.key === "peak_price")!;
    expect(day.as_of_mt).toBe(d2.operating_day_mt);
  });
});

describe("backtest and history keys", () => {
  const bt: BacktestResult = {
    schema: "clearlane.backtest/v1",
    window: {
      start_mt: "2026-05-01",
      end_mt: "2026-10-27",
      days: 179,
      missing_days: ["2026-05-01"],
    },
    wear_usd_mwh: 9.16,
    seed: 1,
    policies: (["fixed_overnight", "price_only", "clearlane"] as const).map(
      (policy, i) => ({
        policy,
        usd_per_mw_day: { p10: 10 + i, p50: 20 + i, p90: 30 + i, mean: 21 + i },
        co2_t_per_mw_day: { p10: 0, p50: 0, p90: 0, mean: 0 },
        pulse_cycles_per_yr: 300 + i,
        calls_unanswerable_pct: {
          heatmap_as_mt: i,
          heatmap_as_utc: 2 * i,
          heatmap_as_utc_mst: 3 * i,
        },
        host_ceiling_breaches: 0,
        days_beating_fixed_overnight_pct: 40 * i,
      }),
    ),
  };
  const oct: HistDay[] = [...loadDam("research/analysis/option2/oct")].map(
    ([d, p]) => ({
      operating_day_mt: d,
      lmp_usd_mwh: p,
      co2_g_kwh: p.map(() => null),
    }),
  );
  const n = buildNumbers(
    {
      ...inputs,
      backtest: { data: bt, path: "b.json" },
      hist: { data: oct, path: "h.json" },
    },
    reg,
  );
  const k = new Map(n.map((x) => [x.key, x]));

  it("writes the backtest keys as of the window end", () => {
    expect(validateNumbers(n, reg)).toEqual([]);
    expect(k.get("share_days_beating")!.value).toBe(80);
    expect(k.get("clearlane_p50")!.value).toBe(22);
    expect(k.get("backtest_days")!.value).toBe(179);
    expect(k.get("wear_usd_mwh")!.display).toBe("$9.16");
    expect(k.get("cycles_per_year_by_policy_price_only")!.value).toBe(301);
    expect(k.get("calls_missed_by_policy_clearlane_utc_mst")!.value).toBe(6);
    expect(k.get("calls_answered_pct_utc_mdt")!.value).toBe(96);
    expect(k.get("clearlane_p90")!.as_of_mt).toBe("2026-10-27");
  });

  it("pins October's step hour: 24 of 27 days, median step $15.1", () => {
    expect(oct.filter((d) => d.operating_day_mt >= "2026-10-01")).toHaveLength(
      27,
    );
    expect(k.get("oct_step_hour_days")!.display).toBe("24 of 27");
    expect(k.get("oct_step_hour_days_n")!.value).toBe(27);
    expect(k.get("oct_step_median_usd")!.display).toBe("$15.1");
  });

  it("ties go to the earlier step", () => {
    expect(largestStep([1, 2, 1, 2, ...Array(20).fill(0)]).hour).toBe(1);
    expect(stepHourDays([Array(23).fill(1)]).n).toBe(0);
  });
});

describe("validateNumbers rejects", () => {
  const good: StageNumber = byKey.get("peak_price")!;
  const other: StageNumber = byKey.get("price_min_oct27")!;
  const bad = (rows: StageNumber[]) => validateNumbers(rows, reg).join(" ");
  it.each([
    ["a duplicate key", [good, good], /duplicate/],
    ["a non-finite value", [{ ...good, value: Number.NaN }], /not finite/],
    ["a bad prov", [{ ...good, prov: "GUESSED" as never }], /bad prov/],
    [
      "a MEASURED value",
      [{ ...good, key: "solve_ms", prov: "MEASURED" as const }],
      /MEASURED/,
    ],
    [
      "an em dash",
      [{ ...good, display: `55${String.fromCharCode(0x2014)}56` }],
      /dash/,
    ],
    [
      "an en dash",
      [{ ...good, unit: `a${String.fromCharCode(0x2013)}b` }],
      /dash/,
    ],
    ["an unknown key", [{ ...good, key: "made_up_number" }], /not in FACTS/],
    ["an unsorted list", [other, good], /not sorted/],
  ])("%s", (_, rows, re) => expect(bad(rows as StageNumber[])).toMatch(re));
});

describe("public/derived/numbers.json", () => {
  it("equals the CLI output for the inputs on disk", () => {
    const f = repoPath("public/derived/numbers.json");
    expect(existsSync(f)).toBe(true);
    const opt = <T>(p: string, parse: (t: string) => T) =>
      existsSync(repoPath(p)) ? { data: parse(read(p)), path: p } : undefined;
    const backtest = opt(
      "public/derived/backtest.json",
      (t) => JSON.parse(t) as BacktestResult,
    );
    const hist = opt(
      "public/data/hist_2026-05-01_2026-10-27.json",
      (t) => JSON.parse(t) as HistDay[],
    );
    const expected = buildNumbers(
      {
        ...inputs,
        wear_usd_mwh: backtest?.data.wear_usd_mwh ?? DEFAULT_WEAR_USD_MWH,
        backtest,
        hist,
      },
      reg,
    );
    expect(readFileSync(f, "utf8")).toBe(stableJson(expected));
  });
});
