// Pulse cycles are equivalent full cycles on stored energy (#45): kWh drawn out of the battery,
// before the sqrt(RTE) discharge loss, divided by the 500 kWh rating. This is the convention a
// 7,500-cycle warranty counts against.
import { describe, expect, it } from "vitest";
import { buildPlan } from "@engine/plan";
import type { Schedule } from "@engine/plan";
import { defaultSite } from "@engine/site";
import { loadFixture } from "./helpers/fixture";

const b = loadFixture();
const site = defaultSite();
const zeros = () => Array<number>(96).fill(0);

describe("pulse_cycles counts stored-side discharge", () => {
  it("one hour at 250 kW to the grid is 250 / sqrt(0.88) kWh out of Pulse", () => {
    const eta = 0.88 ** 0.5;
    const pulse = zeros();
    const soc = zeros();
    // start at 500 kWh, discharge 4 intervals at 250 kW at the meter (62.5 kWh each to the grid)
    let s = 500;
    for (let t = 0; t < 96; t++) {
      if (t >= 72 && t < 76) {
        pulse[t] = -250;
        s -= 62.5 / eta;
      }
      soc[t] = s;
    }
    const sched: Schedule = {
      pulse_kw: pulse,
      pulse_soc_kwh: soc,
      spin_kw: zeros(),
      spin_soc_kwh: zeros(),
      spin_start_kwh: 0,
    };
    const plan = buildPlan(b, site, sched, {
      policy: "fixed_overnight",
      wear_usd_mwh: 0,
      solve_ms: 0,
    });
    // 250 kWh at the meter / 0.93808 = 266.50 kWh stored, / 500 kWh = 0.53300 cycles
    expect(plan.pulse_cycles).toBeCloseTo(250 / eta / 500, 12);
    expect(plan.pulse_cycles.toFixed(4)).toBe("0.5330");
  });

  it("charging alone is not a cycle", () => {
    const pulse = zeros();
    pulse[10] = 250;
    const plan = buildPlan(
      b,
      site,
      {
        pulse_kw: pulse,
        pulse_soc_kwh: zeros(),
        spin_kw: zeros(),
        spin_soc_kwh: zeros(),
        spin_start_kwh: 0,
      },
      { policy: "fixed_overnight", wear_usd_mwh: 0, solve_ms: 0 },
    );
    expect(plan.pulse_cycles).toBe(0);
  });
});
