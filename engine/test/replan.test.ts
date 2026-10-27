import { describe, expect, it } from "vitest";
import type { CrashEvent } from "@contracts/types";
import { checkPlan, crash, defaultSite, replanFrom, scriptedCalls, solve, stateAfterCalls } from "@engine/index";
import { loadFixture } from "./helpers/fixture";

const b = loadFixture();
const site = defaultSite();
const clear = solve(b, site, "clearlane");
const [first, second] = scriptedCalls(b, site);
const c1 = crash(clear, site, b, first);
const c2 = crash(clear, site, b, second, c1);
const strip = (p: { solve_ms: number }) => ({ ...p, solve_ms: 0 });

describe("crash() re-plans the rest of the day", () => {
  it("returns a full CrashResult with a 96-interval replan", () => {
    expect(c1.replan.intervals).toHaveLength(96);
    expect(c1.delivered_pct).toBeCloseTo(100, 9);
    expect(Number.isFinite(c1.replan.solve_ms) && c1.replan.solve_ms >= 0).toBe(true);
    expect(c1.terminal_deficit_kwh).toBe(0);
  });

  it("keeps the replans clean after both scripted calls", () => {
    expect(checkPlan(c1.replan, site, undefined, c1.replan_start_index)).toEqual([]);
    expect(checkPlan(c2.replan, site, undefined, c2.replan_start_index)).toEqual([]);
    expect(c2.shortfall_kwh).toBeGreaterThan(0);
  });

  it("copies the morning as executed", () => {
    expect(c1.replan.intervals.slice(0, 74)).toEqual(clear.intervals.slice(0, 74));
  });

  it("equals the original remainder when the call leaves SoC alone and Spin is full again", () => {
    // call 1 uses Spin only, and Spin is full before 7pm, so 7pm onward matches the day-ahead plan
    expect(c1.pulse_kwh).toBe(0);
    expect(c1.replan.intervals.slice(76)).toEqual(clear.intervals.slice(76));
  });

  it("re-plans from the actual Pulse SoC after the second press", () => {
    const at = c2.replan.intervals[75]!.pulse_soc_kwh;
    expect(at).toBeLessThan(clear.intervals[75]!.pulse_soc_kwh);
  });

  it("applies the SCH cap with Spin half full at the re-plan start", () => {
    const st = stateAfterCalls(clear, site, []);
    const half = { ...st, start_index: 72, pulse_soc_kwh: clear.intervals[71]!.pulse_soc_kwh };
    half.spin_soc_start_kwh = st.spin_soc_start_kwh.map((x, t) => (t >= 72 ? 12.5 : x));
    const rp = replanFrom(clear, site, b, half).plan;
    const cap = 250 - (250 - (12.5 * 3600) / 330);
    const dis = rp.intervals.slice(72).filter((x) => x.system_critical).map((x) => -x.pulse_kw);
    expect(Math.max(...dis)).toBeLessThanOrEqual(cap + 1e-6);
    const orig = clear.intervals.slice(72).filter((x) => x.system_critical).map((x) => -x.pulse_kw);
    expect(Math.max(...orig)).toBeGreaterThan(cap);
  });

  it("is deterministic apart from solve_ms", () => {
    expect(strip(crash(clear, site, b, first).replan)).toEqual(strip(c1.replan));
  });

  it("works for the ghost with no Spin", () => {
    const ghost = crash(solve(b, site, "price_only"), site, b, first);
    expect(ghost.delivered_pct).toBeLessThan(90);
    expect(ghost.replan.intervals.every((x) => x.spin_soc_kwh === 0)).toBe(true);
    expect(checkPlan(ghost.replan, site)).toEqual([]);
  });

  it("falls back on the terminal target without throwing", () => {
    // a late call draining Pulse with too little time left to recharge
    const late: CrashEvent = { ...first, id: "late", start_utc: "2026-10-28T05:40:00Z", requested_kw: 500 };
    const r = crash(clear, site, b, late);
    expect(r.replan.intervals).toHaveLength(96);
    expect(r.terminal_deficit_kwh).toBeGreaterThanOrEqual(0);
  });
});
