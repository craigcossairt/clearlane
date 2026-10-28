// Flag-off test for the price-only backtest (#237, ff_territories): the territory runs never move the
// PACE backtest, its days file or numbers.json, and the stage numbers never read a price-only file.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { HistDay, TorusPublished } from "@contracts/types";
import { FLAGS } from "@contracts/flags";
import { runBacktest } from "@engine/backtest";
import { stableJson } from "@engine/json";
import { defaultSite } from "@engine/site";
import { repoPath } from "./helpers/fixture";

const read = (p: string) => readFileSync(repoPath(p), "utf8");
const PGE = "public/data/hist_pge_2026-10-01_2026-10-27.json";
const core = JSON.parse(read("public/derived/backtest.json")) as {
  wear_usd_mwh: number;
  seed: number;
};
const torus = JSON.parse(
  read("public/data/torus_published.json"),
) as TorusPublished;
const opts = {
  wear_usd_mwh: core.wear_usd_mwh,
  seed: core.seed,
  by_hour: torus.events_2025_by_hour.value,
  by_weekday: torus.events_2025_by_weekday.value,
};
const site = defaultSite();

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}
const cli = (name: string, args: string[]) =>
  spawnSync(
    process.execPath,
    ["--import", "tsx", repoPath(`engine/cli/${name}.ts`), ...args],
    { cwd: repoPath("."), encoding: "utf8" },
  );

describe("ff_territories off", () => {
  it("is registered and off by default", () =>
    expect(FLAGS.ff_territories.default).toBe(false));

  it("numbers.json reads no territory file", () =>
    expect(read("public/derived/numbers.json")).not.toMatch(
      /backtest_(pacw|pge)|hist_(pacw|pge)/,
    ));
});

describe("a price-only run leaves the PACE backtest byte-identical", () => {
  it("in process: after a PGE run, the PACE backtest reproduces backtest.json and backtest_days.json", () => {
    const pge = JSON.parse(read(PGE)) as HistDay[];
    const territory = runBacktest(pge, site, {
      ...opts,
      start_mt: "2026-10-01",
      end_mt: "2026-10-27",
    });
    expect(territory.result.price_only).toBe(true);
    const hist = JSON.parse(
      read("public/data/hist_2026-05-01_2026-10-27.json"),
    ) as HistDay[];
    const run = runBacktest(hist, site, opts);
    expect(run.result.price_only).toBeUndefined();
    expect(stableJson(run.result)).toBe(read("public/derived/backtest.json"));
    expect(stableJson(run.days)).toBe(
      read("public/derived/backtest_days.json"),
    );
  }, 60_000);

  it("the CLI's PACE path writes the committed backtest.json and backtest_days.json bytes", () => {
    const dir = mkdtempSync(join(tmpdir(), "bt-core-"));
    const r = cli("backtest", [
      "--wear",
      String(core.wear_usd_mwh),
      "--out",
      join(dir, "backtest.json"),
    ]);
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(join(dir, "backtest.json"), "utf8")).toBe(
      read("public/derived/backtest.json"),
    );
    expect(readFileSync(join(dir, "backtest_days.json"), "utf8")).toBe(
      read("public/derived/backtest_days.json"),
    );
  }, 60_000);

  it("the price-only CLI writes only its --out pair: every committed file keeps its bytes", () => {
    const watched = [
      ...files(repoPath("public/derived")),
      ...files(repoPath("public/data")),
      ...files(repoPath("contracts")),
    ];
    const hash = () =>
      watched.map(
        (f) =>
          `${f} ${createHash("sha256").update(readFileSync(f)).digest("hex")}`,
      );
    const before = hash();
    const dir = mkdtempSync(join(tmpdir(), "bt-pge-off-"));
    const r = cli("backtest", [
      "--hist",
      PGE,
      "--start",
      "2026-10-01",
      "--end",
      "2026-10-27",
      "--out",
      join(dir, "backtest_pge.json"),
    ]);
    expect(r.status, r.stderr).toBe(0);
    expect(readdirSync(dir).sort()).toEqual([
      "backtest_pge.json",
      "backtest_pge_days.json",
    ]);
    expect(hash()).toEqual(before);
    expect(files(repoPath("public/derived")).length).toBe(
      watched.filter((f) => f.startsWith(repoPath("public/derived"))).length,
    );
  }, 60_000);
});

describe("the numbers CLI", () => {
  it("refuses a price-only backtest and writes nothing", () => {
    const out = join(mkdtempSync(join(tmpdir(), "num-po-")), "numbers.json");
    const r = cli("numbers", [
      "public/data/bundle_2026-10-27.json",
      "--backtest",
      "public/derived/backtest_pge.json",
      "--out",
      out,
    ]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/price-only backtest/);
    expect(existsSync(out)).toBe(false);
  }, 60_000);
});
