// Core 13 (#63): the engine on the data lane's real files, and the committed outputs built from them.
// These never skip: a missing real file is a failure.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type {
  BacktestResult,
  Bundle,
  StageNumber,
  TorusPublished,
} from "@contracts/types";
import { validateBacktest } from "@engine/backtest";
import {
  PULSE_C_RATE,
  PULSE_CYCLE_LIFE,
  RAMP_S,
  SPIN_C_RATE,
  SPIN_RECHARGE_MIN,
  STATION_LIFE_YR,
  DELIVERED_FLOOR_PCT,
} from "@engine/inputs";
import { laneThresholds, lanes } from "@engine/lanes";
import {
  factsRegistry,
  registryWithNewKeys,
  validateNumbers,
} from "@engine/numbers";
import { defaultSite, referenceRace, solve } from "@engine/index";
import { snapshotPrices } from "./helpers/oasis";
import { repoPath } from "./helpers/fixture";

const REAL = {
  bundle: "public/data/bundle_2026-10-27.json",
  hist: "public/data/hist_2026-05-01_2026-10-27.json",
  histMeta: "public/data/hist_2026-05-01_2026-10-27.meta.json",
  torus: "public/data/torus_published.json",
};
const DERIVED = {
  backtest: "public/derived/backtest.json",
  backtestDays: "public/derived/backtest_days.json",
  envelope: "public/derived/envelope_2026-10-27.json",
  numbers: "public/derived/numbers.json",
};
const read = <T>(p: string) =>
  JSON.parse(readFileSync(repoPath(p), "utf8")) as T;

describe("the real files are on main", () => {
  for (const [name, p] of Object.entries({ ...REAL, ...DERIVED }))
    it(`${name}: ${p}`, () => expect(existsSync(repoPath(p))).toBe(true));
});

describe("committed outputs validate", () => {
  it("backtest.json passes validateBacktest", () => {
    expect(validateBacktest(read<BacktestResult>(DERIVED.backtest))).toEqual(
      [],
    );
  });

  it("numbers.json passes validateNumbers against FACTS and newKeys.ts", () => {
    const reg = registryWithNewKeys(
      factsRegistry(readFileSync(repoPath("docs/FACTS.md"), "utf8")),
    );
    expect(validateNumbers(read<StageNumber[]>(DERIVED.numbers), reg)).toEqual(
      [],
    );
  });

  // The stage day comes from numbers.json, so this holds after the Oct 28 refresh too.
  it("numbers.json and that day's envelope were built from the real bundle for the day", () => {
    const dp = read<StageNumber[]>(DERIVED.numbers).find(
      (n) => n.key === "clearlane_dp_usd_mw_day",
    )!;
    expect(dp.source).toContain(`public/data/bundle_${dp.as_of_mt}.json`);
    const env = `public/derived/envelope_${dp.as_of_mt}.json`;
    expect(existsSync(repoPath(env))).toBe(true);
    expect(read<{ operating_day_mt: string }>(env).operating_day_mt).toBe(
      dp.as_of_mt,
    );
  });
});

describe("the live solve on the stage day's real bundle", () => {
  const row = read<StageNumber[]>(DERIVED.numbers).find(
    (n) => n.key === "clearlane_dp_usd_mw_day",
  )!;
  const b = read<Bundle>(`public/data/bundle_${row.as_of_mt}.json`);
  const wear = read<BacktestResult>(DERIVED.backtest).wear_usd_mwh;

  it("equals clearlane_dp_usd_mw_day in numbers.json to the cent", () => {
    const plan = solve(b, defaultSite(), "clearlane", { wear_usd_mwh: wear });
    expect(Math.round(plan.value_usd_per_mw_day * 100)).toBe(
      Math.round(row.value * 100),
    );
  });
});

// habit.py reads research/data/pace_snapshot_2026-10-27.csv (snapshot index 0 = HB 1). The real bundle
// carries the same cent-rounded DAM prices for HB 1-23, so habit.py's pins hold on it unchanged. If the
// data lane moves the bundle to unrounded prices (as #120 does for the fixture), re-pin from the raw DAM.
describe("race and lane pins on the real bundle", () => {
  const b = read<Bundle>(REAL.bundle);
  const p = b.hours.map((h) => h.lmp_usd_mwh);

  it("HB 1-23 are the snapshot habit.py reads; HB 0 is OPR_DT Oct 26 HE 24", () => {
    expect(p.slice(1)).toEqual(snapshotPrices().slice(0, 23));
    expect(p[0]).toBe(30.22);
  });

  it("the reference race is habit.py's", () => {
    const r = referenceRace(b);
    expect(r.fixed.charge_hb).toEqual([1, 2, 3, 4]);
    expect(r.timetable.charge_hb).toEqual([13, 14, 15]);
    expect(r.timetable.discharge_hb).toEqual([18, 19]);
    expect(r.fixed.usd_per_mw_day).toBeCloseTo(20.064746, 6);
    expect(r.timetable.usd_per_mw_day).toBeCloseTo(58.405341, 6);
    expect(r.fixed.usd_per_mw_day.toFixed(2)).toBe("20.06");
    expect(r.timetable.usd_per_mw_day.toFixed(2)).toBe("58.41");
    expect(r.ratio.toFixed(3)).toBe("2.911");
    expect(r.fixed.charge_mean_usd_mwh.toFixed(2)).toBe("39.53");
    expect(r.timetable.charge_mean_usd_mwh.toFixed(2)).toBe("21.55");
  });

  it("the lanes match the fixture pins", () => {
    const t = laneThresholds(p);
    expect(t.clear_max_usd.toFixed(2)).toBe("29.98");
    expect(t.jam_min_usd.toFixed(2)).toBe("47.18");
    const ls = lanes(b);
    const where = (lane: string) =>
      ls.flatMap((l, h) => (l === lane ? [h] : []));
    expect(where("clear")).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
    expect(where("jam")).toEqual([18, 19, 20, 21, 22, 23]);
  });
});

describe("engine/src/inputs.ts agrees with torus_published.json", () => {
  const t = read<TorusPublished>(REAL.torus);

  it("19 s ramp, 10C Spin, 0.5C Pulse, 7,500 cycles, 25 years, 90% floor", () => {
    expect(RAMP_S).toBe(t.ramp_s.value);
    expect(SPIN_C_RATE).toBe(t.spin_c_rate.value);
    expect(PULSE_C_RATE).toBe(t.pulse_c_rate.value);
    expect(PULSE_CYCLE_LIFE).toBe(t.pulse_cycle_life.value);
    expect(STATION_LIFE_YR).toBe(t.pulse_life_yr.value);
    expect(DELIVERED_FLOOR_PCT).toBe(t.delivered_band_pct.value[0]);
    for (const k of [
      "ramp_s",
      "spin_c_rate",
      "pulse_c_rate",
      "pulse_cycle_life",
      "pulse_life_yr",
      "delivered_band_pct",
      "spin_discharge_recharge_min",
    ] as const)
      expect(t[k].prov).toBe("TORUS_PUBLISHED");
  });

  it("6-minute Spin recharge: the published 12-minute cycle less a 6-minute discharge at 10C", () => {
    const dischargeMin = 60 / t.spin_c_rate.value;
    expect(dischargeMin).toBe(6);
    expect(SPIN_RECHARGE_MIN).toBe(
      t.spin_discharge_recharge_min.value - dischargeMin,
    );
  });
});
