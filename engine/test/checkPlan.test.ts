import { describe, expect, it } from "vitest";
import type { Plan, PlanInterval } from "@contracts/types";
import { checkPlan, defaultSite, solve } from "@engine/index";
import { loadFixture } from "./helpers/fixture";

const b = loadFixture();
const site = defaultSite();
const clear = solve(b, site, "clearlane");

const edit = (p: Plan, t: number, patch: Partial<PlanInterval>): Plan => ({
  ...p,
  intervals: p.intervals.map((iv) => (iv.i === t ? { ...iv, ...patch } : iv)),
});

describe("checkPlan flags hand-built bad plans", () => {
  it("meter over the ceiling", () => {
    const v = checkPlan(
      edit(clear, 56, { meter_kw: 900, pulse_kw: 100 }),
      site,
    );
    expect(v.join(" ")).toMatch(/ceiling/);
  });

  it("does not hold price_only to the ceiling", () => {
    const po = solve(b, site, "price_only");
    expect(checkPlan(po, site)).toEqual([]);
  });

  it("meter under minus the export limit", () => {
    expect(
      checkPlan(edit(clear, 4, { meter_kw: -10 }), site).join(" "),
    ).toMatch(/export/);
  });

  it("SoC outside [0, pulse_kwh]", () => {
    expect(
      checkPlan(edit(clear, 10, { pulse_soc_kwh: 501 }), site).join(" "),
    ).toMatch(/SoC/);
    expect(
      checkPlan(edit(clear, 10, { pulse_soc_kwh: -1 }), site).join(" "),
    ).toMatch(/SoC/);
  });

  it("Pulse power over its rating", () => {
    expect(
      checkPlan(edit(clear, 10, { pulse_kw: -300 }), site).join(" "),
    ).toMatch(/power/);
  });

  it("terminal SoC below the start", () => {
    expect(
      checkPlan(edit(clear, 95, { pulse_soc_kwh: 0 }), site).join(" "),
    ).toMatch(/terminal/);
  });

  it("SCH cap broken", () => {
    // Spin at 40% before HB 19's first interval caps discharge at 109 kW
    const bad = edit(edit(clear, 75, { spin_soc_kwh: 10 }), 76, {
      pulse_kw: -200,
    });
    expect(checkPlan(bad, site).join(" ")).toMatch(/SCH/);
  });

  it("wrong interval count or ts_utc order", () => {
    expect(
      checkPlan({ ...clear, intervals: clear.intervals.slice(1) }, site).join(
        " ",
      ),
    ).toMatch(/96/);
    const swapped = clear.intervals.map((iv, i) =>
      i === 3 ? { ...iv, ts_utc: clear.intervals[4]!.ts_utc } : iv,
    );
    expect(checkPlan({ ...clear, intervals: swapped }, site).join(" ")).toMatch(
      /order/,
    );
  });
});

describe("checkPlan rejects non-finite values", () => {
  it("flags NaN meter, power and SoC, and a NaN terminal SoC", () => {
    const site = defaultSite();
    const plan = solve(loadFixture(), site, "clearlane");
    const bad: Plan = {
      ...plan,
      intervals: plan.intervals.map((x, k) =>
        k === 10
          ? { ...x, meter_kw: Number.NaN, pulse_kw: Number.NaN }
          : k === 95
            ? { ...x, pulse_soc_kwh: Number.NaN }
            : x,
      ),
    };
    const v = checkPlan(bad, site).join(" ");
    expect(v).toMatch(/meter_kw is not finite/);
    expect(v).toMatch(/pulse_kw is not finite/);
    expect(v).toMatch(/pulse_soc_kwh is not finite/);
    expect(v).toMatch(/terminal Pulse SoC/);
  });
});
