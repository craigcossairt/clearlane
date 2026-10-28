// Core 13 (#63): the engine runs on any day, and Integration's Oct 28 refresh needs no code change.
// The base day and its bundle come from public/derived/numbers.json (no day or file name is pinned
// here), so after the refresh this proves the day after that one. The synthetic next day is the base
// bundle moved forward 24 h with its prices (offset) and CO2 permuted, so every price- or CO2-driven
// number must move and every day-level key must carry the new day.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type {
  BacktestResult,
  Bundle,
  Envelope,
  StageNumber,
} from "@contracts/types";
import { validateEnvelope } from "@engine/envelope";
import { defaultSite, option2Shift, referenceRace, solve } from "@engine/index";
import { laneThresholds, lanes } from "@engine/lanes";
import { redated, repoPath } from "./helpers/fixture";

const readJson = <T>(p: string) => JSON.parse(readFileSync(p, "utf8")) as T;
const committed = readJson<StageNumber[]>(
  repoPath("public/derived/numbers.json"),
);
const dpRow = committed.find((n) => n.key === "clearlane_dp_usd_mw_day")!;
const BASE_DAY = dpRow.as_of_mt;
const BASE_BUNDLE = /public\/data\/bundle_\d{4}-\d{2}-\d{2}\.json/.exec(
  dpRow.source,
)?.[0];
const base = readJson<Bundle>(repoPath(BASE_BUNDLE ?? "missing"));
const plusDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);
const DAY = plusDays(BASE_DAY, 1);

// A fixed permutation (multiply by 7 mod 24, then add 5) so the cheap and dear hours land elsewhere.
const PERM = Array.from({ length: 24 }, (_, h) => (7 * h + 5) % 24);
// Plus a flat $1.25/MWh, so order-free statistics (min, max, lane thresholds) move as well.
const OFFSET = 1.25;
const prices = PERM.map((i) => base.hours[i]!.lmp_usd_mwh + OFFSET);
// CO2 moves with its price (the same permutation), so fixed-hour CO2 keys move too.
const moved = redated(base, 1, prices);
const next: Bundle = {
  ...moved,
  hours: moved.hours.map((h, i) => ({
    ...h,
    co2_g_kwh: base.hours[PERM[i]!]!.co2_g_kwh,
  })),
};

const cli = (script: string, args: string[]) =>
  execFileSync(
    process.execPath,
    ["--import", "tsx", repoPath(`engine/cli/${script}`), ...args],
    { cwd: repoPath("."), encoding: "utf8" },
  );

describe("the synthetic next-day bundle", () => {
  it("the base comes from numbers.json and names the real bundle for that day", () => {
    expect(BASE_BUNDLE).toBe(`public/data/bundle_${BASE_DAY}.json`);
    expect(base.operating_day_mt).toBe(BASE_DAY);
  });

  it("is the base bundle 24 h later with permuted, offset prices", () => {
    expect(new Set(PERM).size).toBe(24);
    expect(next.operating_day_mt).toBe(DAY);
    next.hours.forEach((h, i) =>
      expect(Date.parse(h.ts_utc) - Date.parse(base.hours[i]!.ts_utc)).toBe(
        86_400_000,
      ),
    );
    const asc = (xs: number[]) => [...xs].sort((a, z) => a - z);
    const want = asc(base.hours.map((h) => h.lmp_usd_mwh));
    asc(prices).forEach((x, i) => expect(x - OFFSET).toBeCloseTo(want[i]!, 9));
    expect(prices).not.toEqual(base.hours.map((h) => h.lmp_usd_mwh));
  });
});

describe("in process, the engine takes every answer from the day's own prices", () => {
  const rank = (hs: number[], dir: 1 | -1) =>
    [...hs]
      .sort((x, y) => dir * (prices[x]! - prices[y]!) || x - y)
      .slice(0, 3)
      .sort((x, y) => x - y);
  const all = Array.from({ length: 24 }, (_, h) => h);

  it("race and option 2 hours", () => {
    expect(referenceRace(next).timetable.charge_hb).toEqual(
      rank(all.slice(9, 18), 1),
    );
    expect(option2Shift(next).from_hb).toEqual(rank(all, -1));
    expect(option2Shift(next).to_hb).toEqual(rank(all.slice(9, 18), 1));
  });

  it("lanes follow the permuted prices", () => {
    const t = laneThresholds(prices);
    const ls = lanes(next);
    ls.forEach((l, h) => {
      if (l === "clear")
        expect(prices[h]!).toBeLessThanOrEqual(t.clear_max_usd);
      if (l === "jam") expect(prices[h]!).toBeGreaterThanOrEqual(t.jam_min_usd);
    });
    expect(ls).not.toEqual(lanes(base));
  });

  it("the 15-minute plan moves", () => {
    const site = defaultSite();
    const a = solve(base, site, "clearlane", { wear_usd_mwh: 10 });
    const z = solve(next, site, "clearlane", { wear_usd_mwh: 10 });
    expect(z.value_usd_per_mw_day).not.toBe(a.value_usd_per_mw_day);
  });
});

// Bundle keys that use neither prices nor CO2: the site, the scripted calls and the Option 2 size are
// constants, load and solar are kept from the base bundle, and the lane hour counts depend only on
// price ranks (the thresholds are percentiles). Keys whose source does not name a bundle are published
// Torus figures. Any other day-level key equal to the base day's would mean a value was copied.
// (Names such as lane_hours_oct27_clear keep their dates until Integration renames them in FACTS.)
const PRICE_AND_CO2_FREE = new Set([
  "call_duration_s",
  "call_hours_2025",
  "campus_mwh",
  "enrolled_kw",
  "host_ceiling_kw",
  "lane_hours_oct27_clear",
  "lane_hours_oct27_jam",
  "load_peak_oct27_mw",
  "mou_share_of_peak_oct27",
  "net_load_climb_mw",
  "net_load_max_oct27",
  "solar_4pm_to_6pm_mw_4pm",
  "solar_4pm_to_6pm_mw_6pm",
]);

describe("next-day readiness (the Oct 28 refresh): numbers.ts and envelope.ts on a synthetic day", () => {
  const dir = mkdtempSync(join(tmpdir(), "nextday-"));
  const bundlePath = join(dir, `bundle_${DAY}.json`);
  const numbersOut = join(dir, "numbers.json");
  // The base day is the committed numbers.json; realdata.test.ts proves it is in step with the CLI.
  const byBase = new Map(committed.map((n) => [n.key, n]));
  const baseDayKeys = new Set(
    committed.filter((n) => n.as_of_mt === BASE_DAY).map((n) => n.key),
  );
  let out: StageNumber[] = [];
  let ms = Number.NaN;

  beforeAll(() => {
    writeFileSync(bundlePath, JSON.stringify(next, null, 2) + "\n");
    const t0 = performance.now();
    cli("numbers.ts", [bundlePath, "--out", numbersOut]);
    cli("envelope.ts", [bundlePath, "--out", dir]);
    ms = performance.now() - t0; // MEASURED, printed only
    console.log(
      `${DAY} refresh (numbers + envelope): ${(ms / 1000).toFixed(1)} s`,
    );
    out = readJson<StageNumber[]>(numbersOut);
  }, 180_000);

  it("runs in under 60 s", () => expect(ms).toBeLessThan(60_000));

  it("writes envelope_<day>.json, valid, for the next day", () => {
    const f = join(dir, `envelope_${DAY}.json`);
    expect(existsSync(f)).toBe(true);
    const env = readJson<Envelope>(f);
    expect(validateEnvelope(env)).toEqual([]);
    expect(env.operating_day_mt).toBe(DAY);
    expect(env.hours.map((h) => h.ts_utc)).toEqual(
      next.hours.map((h) => h.ts_utc),
    );
  });

  it("every key built from the bundle has the next day as as_of_mt", () => {
    const fromBundle = out.filter((n) =>
      n.source.includes(bundlePath.replace(/\\/g, "/")),
    );
    expect(fromBundle.length).toBeGreaterThan(20);
    for (const n of fromBundle)
      expect([n.key, n.as_of_mt]).toEqual([n.key, DAY]);
  });

  it("the day-level keys are the base day-level keys, now dated the next day", () => {
    const dayKeys = out.filter((n) => n.as_of_mt === DAY).map((n) => n.key);
    // keys dated to a fixed day (history, research) keep that day and their base value
    for (const n of out.filter((x) => x.as_of_mt !== DAY)) {
      expect(n.as_of_mt).toBe(byBase.get(n.key)?.as_of_mt);
      expect([n.key, n.value]).toEqual([n.key, byBase.get(n.key)!.value]);
    }
    expect(dayKeys.length).toBeGreaterThan(20);
    for (const k of dayKeys) expect(baseDayKeys.has(k)).toBe(true);
    // the same key list: day-level keys move to the new day, fixed-date keys stay
    expect(out.map((n) => n.key).sort()).toEqual(
      committed.map((n) => n.key).sort(),
    );
  });

  it("no day-level value is copied from the base day", () => {
    const same = out.filter(
      (n) => n.as_of_mt === DAY && byBase.get(n.key)?.value === n.value,
    );
    const copied = same
      .filter((n) => n.source.includes("bundle_"))
      .map((n) => n.key)
      .filter((k) => !PRICE_AND_CO2_FREE.has(k));
    expect(copied).toEqual([]);
    // and most day-level keys did move
    expect(same.length).toBeLessThan(
      out.filter((n) => n.as_of_mt === DAY).length / 2,
    );
  });

  it("the day's site value equals a live solve with the committed wear price", () => {
    const w = readJson<BacktestResult>(
      repoPath("public/derived/backtest.json"),
    ).wear_usd_mwh;
    const plan = solve(next, defaultSite(), "clearlane", { wear_usd_mwh: w });
    const row = out.find((n) => n.key === "clearlane_dp_usd_mw_day")!;
    expect(Math.round(row.value * 100)).toBe(
      Math.round(plan.value_usd_per_mw_day * 100),
    );
  });
});
