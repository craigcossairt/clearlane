// Flag-off test for ff_rt_replay (#72): with the flag off nothing in the six beats reaches the replay,
// and running it leaves every core output and pin byte-identical.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { HistDay, Plan } from "@contracts/types";
import { FLAGS } from "@contracts/flags";
import { stableJson } from "@engine/json";
import { siteDefaultExport } from "@engine/siteExport";
import {
  buildEnvelope,
  defaultSite,
  dpHourly,
  option2Shift,
  referenceRace,
  solve,
} from "@engine/index";
import { buildReplay } from "@engine/replay";
import type { RtHistory } from "@engine/replay";
import { wearUsdMwh } from "../cli/common";
import { loadFixture, repoPath } from "./helpers/fixture";

const RT_FIX = "engine/test/fixtures/rt_replay.rt.fixture.json";
const DA_FIX = "engine/test/fixtures/rt_replay.hist.fixture.json";
const read = (p: string) => readFileSync(repoPath(p), "utf8");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}
const IMPORTS_REPLAY = /from\s+["'][^"']*\/replay["']/;

describe("ff_rt_replay off", () => {
  it("is registered and off by default", () =>
    expect(FLAGS.ff_rt_replay.default).toBe(false));

  it("no core module, core CLI or app file imports the replay", () => {
    const hits = [
      ...files(repoPath("engine/src")),
      ...files(repoPath("engine/cli")),
      ...files(repoPath("app/src")),
    ].filter(
      (f) =>
        !/[\\/]replay\.ts$/.test(f) &&
        IMPORTS_REPLAY.test(readFileSync(f, "utf8")),
    );
    expect(hits).toEqual([]);
    expect(read("engine/src/index.ts")).not.toMatch(/replay/);
  });
});

// Every core output the stage or a core CLI produces, with MEASURED times left out.
function coreOutputs(): string {
  const b = loadFixture();
  const site = defaultSite();
  const W = wearUsdMwh(repoPath("public/derived/backtest.json"));
  const strip = (p: Plan) => ({ ...p, solve_ms: 0 });
  const plans = (["fixed_overnight", "price_only", "clearlane"] as const).map(
    (p) => strip(solve(b, site, p, { wear_usd_mwh: W })),
  );
  return stableJson({
    plans,
    envelope: buildEnvelope(plans[2]!, site, b, {
      generated_utc: "2026-10-27T00:00:00Z",
    }),
    site: siteDefaultExport(),
    race: referenceRace(b),
    option2: option2Shift(b),
    hourly: [0, 10, 15].map((w) =>
      dpHourly(
        b.hours.map((h) => h.lmp_usd_mwh),
        { W: w },
      ),
    ),
  });
}

describe("running the replay leaves core outputs byte-identical", () => {
  it("in process: the pinned core outputs before and after a replay are the same bytes", () => {
    const before = coreOutputs();
    const run = buildReplay(
      JSON.parse(read(DA_FIX)) as HistDay[],
      JSON.parse(read(RT_FIX)) as RtHistory,
      defaultSite(),
      { wear_usd_mwh: 10.95, rt_path: RT_FIX, da_path: DA_FIX },
    );
    expect(run.result.days.length).toBe(3);
    expect(coreOutputs()).toBe(before);
  });

  it("the CLI writes only its --out file: every committed core file keeps its bytes", () => {
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
    const out = join(mkdtempSync(join(tmpdir(), "rtr-off-")), "rt_replay.json");
    execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        repoPath("engine/cli/replay.ts"),
        "--rt",
        RT_FIX,
        "--hist",
        DA_FIX,
        "--out",
        out,
      ],
      { cwd: repoPath("."), encoding: "utf8" },
    );
    expect(hash()).toEqual(before);
    expect(files(repoPath("public/derived")).length).toBe(
      watched.filter((f) => f.startsWith(repoPath("public/derived"))).length,
    );
  });
});
