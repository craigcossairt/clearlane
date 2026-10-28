// Writes public/derived/rt_replay.json (moonshot, ff_rt_replay): every day of the RT history settled
// three ways (hold the DA plan, re-plan hourly, perfect foresight), with regret per day. No core CLI
// runs this and nothing in the six beats reads the file.
// Usage: npx tsx engine/cli/replay.ts --rt public/data/rt_<start>_<end>.json [--hist file] [--wear W] [--out file]
// Without --wear, W is the calibrated wear price from backtest.json, as on stage.
// Re-plan times are MEASURED and printed, never stored. Exit 2 names a missing input; exit 1 on a
// failed check, with no partial file.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { HistDay } from "../../contracts/types";
import { stableJson } from "../src/json";
import { buildReplay, rtProv, validateReplay } from "../src/replay";
import type { RtHistory } from "../src/replay";
import { defaultSite } from "../src/site";
import { percentile } from "../src/stats";
import { argValue } from "./args";
import { wearUsdMwh } from "./common";

const rtFile = argValue("--rt");
const histFile =
  argValue("--hist") ?? "public/data/hist_2026-05-01_2026-10-27.json";
const out = argValue("--out") ?? "public/derived/rt_replay.json";
const wearArg = argValue("--wear");

for (const f of [rtFile, histFile]) {
  if (!f || !existsSync(f)) {
    console.error(`input not found: ${f ?? "(--rt not given)"}`);
    process.exit(2);
  }
}
if (wearArg !== undefined && !Number.isFinite(Number(wearArg))) {
  console.error("--wear must be a number");
  process.exit(2);
}
const rt = JSON.parse(readFileSync(rtFile!, "utf8")) as RtHistory;
const hist = JSON.parse(readFileSync(histFile, "utf8")) as HistDay[];
if (rt.schema !== "clearlane.rt/v1" || !Array.isArray(rt.days)) {
  console.error(`not a clearlane.rt/v1 file: ${rtFile}`);
  process.exit(2);
}
const simulated = rtProv(rt) === "SIMULATED";
const wear = wearArg !== undefined ? Number(wearArg) : wearUsdMwh();

const t0 = performance.now();
const run = buildReplay(hist, rt, defaultSite(), {
  wear_usd_mwh: wear,
  rt_path: rtFile!,
  da_path: histFile,
});
const totalMs = performance.now() - t0;

const errors = [...run.violations, ...validateReplay(run.result)];
if (run.result.days.length === 0) errors.push("no day could be replayed");
if (errors.length) {
  console.error(
    `rt replay failed its checks:\n  ${errors.slice(0, 40).join("\n  ")}`,
  );
  process.exit(1);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, stableJson(run.result));

const r = run.result;
const s = r.summary;
const usd = (x: number) => `$${x.toFixed(2)}`;
console.log(
  `wrote ${out}: ${r.window.days} days replayed from ${r.window.start_mt} to ${r.window.end_mt}, ` +
    `${r.window.skipped_days.length} skipped, W ${wear} $/MWh${simulated ? ", RT prices SIMULATED" : ""}`,
);
for (const k of r.window.skipped_days)
  console.log(`  skipped ${k.day}: ${k.reason}`);
console.log(
  `net $/MW-day (P50): hold ${usd(s.net_usd_per_mw_day.hold.p50)}, re-plan ${usd(s.net_usd_per_mw_day.replan.p50)}, ` +
    `foresight ${usd(s.net_usd_per_mw_day.foresight.p50)}`,
);
for (const p of ["hold", "replan"] as const) {
  const g = s.regret_usd_per_mw_day[p];
  console.log(
    `regret ${p} $/MW-day: P10 ${usd(g.p10)}, P50 ${usd(g.p50)}, P90 ${usd(g.p90)}, mean ${usd(g.mean)}; ` +
      `sum ${usd(s.regret_sum_usd_per_mw[p])} per MW`,
  );
}
console.log(
  `re-plan vs hold: above on ${s.days_replan_above_hold} days, below on ${s.days_replan_below_hold}, ` +
    `equal on ${s.days_replan_equal_hold}; wins back ` +
    `${s.replan_recovers_pct === null ? "n/a" : `${s.replan_recovers_pct.toFixed(1)}%`} of hold's regret`,
);
console.log(
  `RT evening (HB 18-21) below RT midday (HB 9-16) on ${s.rt_evening_below_midday_days} of ${s.days} days ` +
    `(DA: ${s.da_evening_below_midday_days})`,
);
console.log(
  `settlement structure: ${r.settlement.status} (${r.settlement.rule})`,
);
console.log(
  `MEASURED (not stored): ${run.replan_ms.length} hourly re-plans, median ${percentile(run.replan_ms, 0.5).toFixed(2)} ms, ` +
    `p90 ${percentile(run.replan_ms, 0.9).toFixed(2)} ms, max ${Math.max(...run.replan_ms).toFixed(2)} ms; ` +
    `whole replay ${(totalMs / 1000).toFixed(1)} s`,
);
