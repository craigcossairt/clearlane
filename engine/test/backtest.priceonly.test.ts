// #237: the backtest on price-only HistDay files (every co2_g_kwh null), the PACW and PGE day-ahead
// histories from data #50. CO2 statistics are null with a note, never 0 and never NaN.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { BacktestResult, HistDay } from "@contracts/types";
import {
  backtestDaysPath,
  isPriceOnly,
  runBacktest,
  validateBacktest,
} from "@engine/backtest";
import type { BacktestOutput } from "@engine/backtest";
import { defaultSite } from "@engine/site";
import { repoPath } from "./helpers/fixture";
import { torusFixture } from "./helpers/torus";

const read = (p: string) => readFileSync(repoPath(p), "utf8");
const PACW = "public/data/hist_pacw_2026-05-01_2026-10-27.json";
const PGE = "public/data/hist_pge_2026-10-01_2026-10-27.json";
const CORE = "public/data/hist_2026-05-01_2026-10-27.json";
const pge = JSON.parse(read(PGE)) as HistDay[];
const core = JSON.parse(read(CORE)) as HistDay[];
const t = torusFixture();
const site = defaultSite();
const opts = {
  wear_usd_mwh: 10.95,
  seed: 7,
  by_hour: t.events_2025_by_hour.value,
  by_weekday: t.events_2025_by_weekday.value,
  start_mt: "2026-10-01",
  end_mt: "2026-10-27",
};

describe("price-only detection", () => {
  it("is true when every CO2 value in the window is null", () =>
    expect(isPriceOnly(pge, opts.start_mt, opts.end_mt)).toBe(true));

  it("is false for the PACE history, which has a few null hours only", () =>
    expect(isPriceOnly(core, "2026-05-01", "2026-10-27")).toBe(false));

  it("is true for a PACE window of only Oct 26 and 27, whose CO2 is not published yet", () =>
    expect(isPriceOnly(core, "2026-10-26", "2026-10-27")).toBe(true));

  it("is false when no day in the window is usable (nothing to call price only)", () =>
    expect(isPriceOnly(pge, "2026-01-01", "2026-01-05")).toBe(false));
});

describe("runBacktest on the PGE price-only history", () => {
  const run = runBacktest(pge, site, opts);
  const r = run.result;

  it("validates, with CO2 statistics null for every policy and the dollars intact", () => {
    expect(validateBacktest(r)).toEqual([]);
    expect(r.price_only).toBe(true);
    for (const p of r.policies) {
      expect(p.co2_t_per_mw_day).toBeNull();
      expect(Number.isFinite(p.usd_per_mw_day.p50)).toBe(true);
    }
    expect(run.days.every((d) => d.co2_t_per_mw_day === null)).toBe(true);
  });

  it("labels the run price only and states the window in days", () => {
    expect(r.window).toEqual({
      start_mt: "2026-10-01",
      end_mt: "2026-10-27",
      days: 26,
      missing_days: ["2026-10-01"],
    });
    const notes = (r.notes ?? []).join("\n");
    expect(notes).toMatch(/price only/);
    expect(notes).toMatch(/null, not 0/);
    expect(notes).toMatch(/26-day window/);
    for (const c of [0x2013, 0x2014])
      expect(notes).not.toContain(String.fromCharCode(c));
  });

  it("puts the new keys after the contract keys", () =>
    expect(Object.keys(r)).toEqual([
      "schema",
      "window",
      "wear_usd_mwh",
      "seed",
      "policies",
      "price_only",
      "notes",
    ]));
});

describe("the PACE path does not move", () => {
  const short = { ...opts, start_mt: "2026-10-20", end_mt: "2026-10-27" };
  const r = runBacktest(core, site, short).result;

  it("has exactly the contract keys and finite CO2 statistics", () => {
    expect(Object.keys(r)).toEqual([
      "schema",
      "window",
      "wear_usd_mwh",
      "seed",
      "policies",
    ]);
    for (const p of r.policies)
      expect(Number.isFinite(p.co2_t_per_mw_day!.p50)).toBe(true);
    expect(validateBacktest(r)).toEqual([]);
  });
});

describe("validateBacktest", () => {
  const good = runBacktest(pge, site, opts).result;
  const bad = (f: (x: BacktestOutput) => unknown) =>
    validateBacktest(
      f(JSON.parse(JSON.stringify(good)) as BacktestOutput),
    ).join("\n");

  it("rejects null CO2 on a run not marked price only", () =>
    expect(bad((x) => ({ ...x, price_only: undefined }))).toMatch(
      /co2_t_per_mw_day/,
    ));

  it("rejects a price-only run that reports CO2", () =>
    expect(
      bad((x) => {
        x.policies[0]!.co2_t_per_mw_day = { p10: 0, p50: 0, p90: 0, mean: 0 };
        return x;
      }),
    ).toMatch(/price only/));

  it("rejects a price-only run without notes", () =>
    expect(bad((x) => ({ ...x, notes: [] }))).toMatch(/notes/));

  it("still rejects NaN CO2 on a core run, the failure #237 reported", () => {
    const core0 = runBacktest(core, site, {
      ...opts,
      start_mt: "2026-10-20",
      end_mt: "2026-10-25",
    }).result as BacktestResult;
    const nan = JSON.parse(JSON.stringify(core0)) as BacktestResult;
    nan.policies[1]!.co2_t_per_mw_day.p10 = Number.NaN;
    expect(validateBacktest(nan).join("\n")).toMatch(
      /price_only: co2_t_per_mw_day.p10 is not finite/,
    );
  });
});

describe("the days file sits next to --out", () => {
  it.each([
    ["public/derived/backtest.json", "public/derived/backtest_days.json"],
    [
      "public/derived/backtest_pacw.json",
      "public/derived/backtest_pacw_days.json",
    ],
    ["out/backtest_pge.json", "out/backtest_pge_days.json"],
    ["out/x", "out/x_days.json"],
  ])("%s writes %s", (out, days) => expect(backtestDaysPath(out)).toBe(days));
});

// The two committed territory files, regenerated by the commands in the PR into a temp folder.
const TERRITORIES = [
  {
    out: "public/derived/backtest_pacw.json",
    args: ["--hist", PACW],
    days: 179,
    window: ["2026-05-01", "2026-10-27"],
  },
  {
    out: "public/derived/backtest_pge.json",
    args: ["--hist", PGE, "--start", "2026-10-01", "--end", "2026-10-27"],
    days: 26,
    window: ["2026-10-01", "2026-10-27"],
  },
] as const;

const cli = (args: readonly string[]) =>
  execFileSync(
    process.execPath,
    ["--import", "tsx", repoPath("engine/cli/backtest.ts"), ...args],
    {
      cwd: repoPath("."),
      encoding: "utf8",
    },
  );

describe.each(TERRITORIES)("committed $out", (x) => {
  const there = existsSync(repoPath(x.out));

  it.skipIf(!there)(
    "is price only, at the stage W, on its labeled window",
    () => {
      const r = JSON.parse(read(x.out)) as BacktestOutput;
      const coreW = (
        JSON.parse(read("public/derived/backtest.json")) as BacktestResult
      ).wear_usd_mwh;
      expect(validateBacktest(r)).toEqual([]);
      expect(r.price_only).toBe(true);
      expect(r.wear_usd_mwh).toBe(coreW);
      expect([r.window.start_mt, r.window.end_mt, r.window.days]).toEqual([
        ...x.window,
        x.days,
      ]);
      const notes = (r.notes ?? []).join("\n");
      expect(notes).toMatch(new RegExp(`${x.days}-day window`));
      expect(notes).toMatch(/format proposal only/);
      expect(notes).toMatch(/calibrated on the PACE history/);
    },
  );

  it.skipIf(!there)(
    "and its days file equal a fresh CLI run, byte for byte",
    () => {
      const dir = mkdtempSync(join(tmpdir(), "bt-terr-"));
      const name = x.out.split("/").pop()!;
      cli([...x.args, "--out", join(dir, name)]);
      expect(readFileSync(join(dir, name), "utf8")).toBe(read(x.out));
      expect(readFileSync(backtestDaysPath(join(dir, name)), "utf8")).toBe(
        read(backtestDaysPath(x.out)),
      );
    },
    60_000,
  );
});
