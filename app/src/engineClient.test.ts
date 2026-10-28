import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { loadStageData, stageWearUsdMwh } from "./data";
import { crash, defaultSite, scriptedCalls, solve, STUB_ACTIVE } from "./engineClient";
import { resolveStageDay } from "./stageDay";

const SRC = join(import.meta.dirname);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

const files = walk(SRC);
const rel = (p: string) => relative(SRC, p).split(sep).join("/");
const isTest = (p: string) => /\.test\.tsx?$/.test(p);
const importsOf = (text: string) =>
  [...text.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1] ?? "");

describe("engine seam", () => {
  it("only engineClient.ts (and the stub itself) imports @engine or app/src/stub", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const r = rel(file);
      if (r === "engineClient.ts" || r.startsWith("stub/") || isTest(file)) continue;
      for (const spec of importsOf(readFileSync(file, "utf8"))) {
        if (spec.startsWith("@engine") || /(^|\/)stub(\/|$)/.test(spec))
          offenders.push(`${r} imports ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the stub does not import @engine (only the client does)", () => {
    const offenders = files
      .filter((f) => rel(f).startsWith("stub/") && !isTest(f))
      .filter((f) => importsOf(readFileSync(f, "utf8")).some((s) => s.startsWith("@engine")))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("the client and the stub make no network calls", () => {
    const offenders = files
      .filter((f) => (rel(f) === "engineClient.ts" || rel(f).startsWith("stub/")) && !isTest(f))
      .filter((f) => /\bfetch\(|XMLHttpRequest/.test(readFileSync(f, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("no Torus URL is typed into app/src outside tests", () => {
    const offenders = files
      .filter((f) => !isTest(f))
      .filter((f) => /torus\.co|datocms-assets|businesswire/.test(readFileSync(f, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});

const cents = (usd: number) => Math.round(usd * 100);

describe("live engine on the stage bundle (#83)", () => {
  const data = loadStageData();
  const resolved = resolveStageDay(data, "");
  if (resolved.state !== "ready") throw new Error(`no stage day: ${resolved.reason}`);
  const bundle = resolved.entry.bundle;
  const site = defaultSite();
  const numberFor = (key: string) => {
    if (!data.numbers) throw new Error("public/derived/numbers.json is missing");
    const entry = data.numbers.find((n) => n.key === key);
    if (!entry) throw new Error(`numbers.json has no ${key}`);
    return entry.value;
  };

  it("runs on the real engine: the stub flag is off", () => {
    expect(STUB_ACTIVE).toBe(false);
  });

  it("fixed_overnight matches fixed_usd_mw_day to the cent", () => {
    const plan = solve(bundle, site, "fixed_overnight");
    expect(cents(plan.value_usd_per_mw_day)).toBe(cents(numberFor("fixed_usd_mw_day")));
  });

  it("clearlane matches clearlane_dp_usd_mw_day to the cent", () => {
    const plan = solve(bundle, site, "clearlane", { wear_usd_mwh: stageWearUsdMwh() });
    expect(cents(plan.value_usd_per_mw_day)).toBe(cents(numberFor("clearlane_dp_usd_mw_day")));
  });

  it("the live clearlane solve uses backtest.json's calibrated wear, as numbers.json does (#45)", () => {
    const wear = stageWearUsdMwh();
    expect(wear).toBe(numberFor("wear_usd_mwh"));
    expect(wear).toBe(10.95);
    const plan = solve(bundle, site, "clearlane", { wear_usd_mwh: wear });
    expect(plan.wear_usd_mwh).toBe(10.95);
    expect(plan.value_usd_per_mw_day.toFixed(2)).toBe("48.89");
    expect(plan.pulse_cycles.toFixed(2)).toBe(numberFor("cycles_today").toFixed(2));
    expect(plan.pulse_cycles.toFixed(2)).toBe("0.95");
    // the research-start default would not match the stage numbers
    expect(cents(solve(bundle, site, "clearlane").value_usd_per_mw_day)).not.toBe(
      cents(numberFor("clearlane_dp_usd_mw_day")),
    );
  });

  it("solve_ms and replan.solve_ms are measured by the engine, never zero or typed", () => {
    const plan = solve(bundle, site, "clearlane");
    expect(Number.isFinite(plan.solve_ms)).toBe(true);
    expect(plan.solve_ms).toBeGreaterThan(0);
    const { first } = scriptedCalls(bundle, site);
    const result = crash(plan, site, first, data.torus);
    expect(result.replan).toBeTruthy();
    expect(Number.isFinite(result.replan?.solve_ms)).toBe(true);
    expect(result.replan?.solve_ms).toBeGreaterThan(0);
    // MEASURED values are never stored in numbers.json.
    expect(data.numbers?.some((n) => /solve_ms|replan_ms/.test(n.key))).toBe(false);
  });
});
