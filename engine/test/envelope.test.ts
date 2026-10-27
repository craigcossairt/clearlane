import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SCH_RULE, buildEnvelope, defaultSite, solve, validateEnvelope } from "@engine/index";
import { loadFixture, repoPath } from "./helpers/fixture";

const b = loadFixture();
const site = defaultSite();
const plan = solve(b, site, "clearlane");
const NOW = "2026-10-27T12:00:00Z";
const env = buildEnvelope(plan, site, b, { generated_utc: NOW });

describe("buildEnvelope on Oct 27", () => {
  it("is a valid clearlane.envelope/v1 with 24 hours", () => {
    expect(validateEnvelope(env)).toEqual([]);
    expect(env.schema).toBe("clearlane.envelope/v1");
    expect(env.hours).toHaveLength(24);
    expect(env.fleet_kw).toBe(250);
    expect(env.sch_rule).toBe(SCH_RULE);
    expect(env.hours.map((h) => h.ts_utc)).toEqual(b.hours.map((h) => h.ts_utc));
  });

  it("flags SCH at HB 18-23", () => {
    expect(env.hours.flatMap((h, i) => (h.system_critical ? [i] : []))).toEqual([18, 19, 20, 21, 22, 23]);
  });

  it("planned_kw is the plan's hourly mean and fits the limits", () => {
    env.hours.forEach((h, hb) => {
      const mean = plan.intervals.slice(hb * 4, hb * 4 + 4).reduce((a, x) => a + x.pulse_kw, 0) / 4;
      expect(h.planned_kw).toBeCloseTo(mean, 9);
      expect(h.max_charge_kw).toBeGreaterThanOrEqual(Math.max(0, h.planned_kw) - 1e-6);
      expect(h.max_discharge_kw).toBeGreaterThanOrEqual(Math.max(0, -h.planned_kw) - 1e-6);
    });
  });

  it("reserves Spin's 250 kW and writes plain reasons", () => {
    for (const h of env.hours) {
      expect(h.reserve_kw).toBe(250);
      expect(h.reason).not.toMatch(new RegExp(`${String.fromCharCode(0x2014)}|${String.fromCharCode(0x2013)}`));
    }
    expect(env.hours[18]!.reason).toMatch(/^System Critical Hour \(our proposal\): Spin holds 250 kW/);
    expect(env.hours[14]!.max_charge_kw).toBe(0); // host at the ceiling
  });

  it("scales every kW to a 70 MW fleet", () => {
    const f = buildEnvelope(plan, site, b, { fleet_kw: 70_000, generated_utc: NOW });
    expect(f.fleet_kw).toBe(70_000);
    f.hours.forEach((h, i) => {
      const o = env.hours[i]!;
      for (const k of ["reserve_kw", "max_charge_kw", "max_discharge_kw", "planned_kw"] as const) {
        expect(h[k]).toBeCloseTo(o[k] * 280, 6);
      }
    });
    expect(f.hours[18]!.reason).toMatch(/70,000 kW/);
  });
});

describe("validateEnvelope rejects", () => {
  const bad = (patch: (e: typeof env) => unknown) => validateEnvelope(patch(structuredClone(env)));
  it("a wrong schema", () => expect(bad((e) => ({ ...e, schema: "x" }))).not.toEqual([]));
  it("23 hours", () => expect(bad((e) => ({ ...e, hours: e.hours.slice(1) }))).not.toEqual([]));
  it("a string system_critical", () =>
    expect(bad((e) => ({ ...e, hours: e.hours.map((h) => ({ ...h, system_critical: "yes" })) }))).not.toEqual([]));
  it("a negative max_charge_kw", () =>
    expect(bad((e) => ({ ...e, hours: e.hours.map((h, i) => (i ? h : { ...h, max_charge_kw: -1 })) }))).not.toEqual([]));
  it("planned_kw outside the limits", () =>
    expect(bad((e) => ({ ...e, hours: e.hours.map((h, i) => (i ? h : { ...h, planned_kw: 9999 })) }))).not.toEqual([]));
  it("an em dash", () => expect(bad((e) => ({ ...e, sch_rule: `a ${String.fromCharCode(0x2014)} b` }))).not.toEqual([]));
});

describe("engine/cli/envelope.ts", () => {
  const run = (args: string[]) =>
    execFileSync(process.execPath, ["--import", "tsx", repoPath("engine/cli/envelope.ts"), ...args], {
      cwd: repoPath("."),
      encoding: "utf8",
    });

  it("is byte-identical for the same --now, with LF and a trailing newline", () => {
    const d1 = mkdtempSync(join(tmpdir(), "env1-"));
    const d2 = mkdtempSync(join(tmpdir(), "env2-"));
    run(["contracts/fixtures/bundle_2026-10-27.json", "--now", NOW, "--out", d1]);
    run(["contracts/fixtures/bundle_2026-10-27.json", "--now", NOW, "--out", d2]);
    const a = readFileSync(join(d1, "envelope_2026-10-27.json"), "utf8");
    expect(a).toBe(readFileSync(join(d2, "envelope_2026-10-27.json"), "utf8"));
    expect(a.endsWith("}\n")).toBe(true);
    expect(a).not.toContain("\r");
  });

  it("exits 2 on a missing bundle", () => {
    let code = 0;
    try {
      run(["nope.json"]);
    } catch (err) {
      code = (err as { status: number }).status;
    }
    expect(code).toBe(2);
  });
});
