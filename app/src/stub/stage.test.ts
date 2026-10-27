import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadStage } from "../engineClient";

const stage = loadStage();

describe("Oct 27 stage stub", () => {
  it("pins lanes: clear 9am-4pm, shoulder at 5pm, jam 6pm-11pm", () => {
    const clear = stage.lanes
      .map((lane, hour) => (lane === "clear" ? hour : -1))
      .filter((hour) => hour >= 0);
    const jam = stage.lanes
      .map((lane, hour) => (lane === "jam" ? hour : -1))
      .filter((hour) => hour >= 0);
    expect(clear).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
    expect(jam).toEqual([18, 19, 20, 21, 22, 23]);
    expect(stage.lanes[17]).toBe("shoulder");
    expect(stage.critical[17]).toBe(false);
    for (const hour of jam) expect(stage.critical[hour]).toBe(true);
  });

  it("pins the reference race, CO2, and the 70 MW scale", () => {
    expect(stage.number("fixed_usd_mw_day").value).toBeCloseTo(20.06, 2);
    expect(stage.number("clearlane_usd_mw_day").value).toBeCloseTo(58.41, 2);
    expect(stage.number("fixed_usd_mw_day").display).toBe("$20.06");
    expect(stage.number("clearlane_usd_mw_day").display).toBe("$58.41");
    expect(stage.number("fixed_70").display).toBe("$1,405");
    expect(stage.number("clearlane_70").display).toBe("$4,088");
    expect(stage.number("co2_fixed_t_mw").value).toBeCloseTo(-0.2625, 3);
    expect(stage.number("co2_clear_t_mw").value).toBeCloseTo(0.27, 2);
    expect(stage.number("co2_added_70").display).toBe("18.4");
    expect(stage.number("co2_avoided_70").display).toBe("18.9");
    expect(stage.number("peak_over_trough").display).toBe("2.6x");
    expect(stage.number("net_load_climb_mw").value).toBeCloseTo(3654.5, 0);
    expect(stage.number("solar_4pm_mw").display).toBe("2,056");
    expect(stage.number("solar_6pm_mw").display).toBe("36");
    expect(stage.number("campus_usd").display).toBe("$2,551");
    expect(stage.number("price_min").value).toBe(21.38);
    expect(stage.number("price_peak").value).toBe(55.78);
  });

  it("answers one call from Spin and shows a shortfall on the second press", () => {
    const first = stage.crash("clearlane", false);
    expect(first.shortfall_kwh).toBe(0);
    expect(first.delivered_pct).toBeGreaterThan(99);
    expect(first.spin_kwh).toBeGreaterThan(0);
    expect(first.meter_peak_during_refill_kw).toBeLessThanOrEqual(
      stage.site.host_ceiling_kw,
    );
    expect(first.replan.solve_ms).toBeGreaterThanOrEqual(0);

    const second = stage.crash("clearlane", true);
    expect(second.shortfall_kwh).toBeGreaterThan(0);
    expect(second.meter_peak_during_refill_kw).toBeLessThanOrEqual(
      stage.site.host_ceiling_kw,
    );

    const ghost = stage.crash("price_only", false);
    expect(ghost.spin_kwh).toBe(0);
    expect(ghost.shortfall_kwh).toBeGreaterThan(0);
  });

  it("keeps the reference plans under the host ceiling", () => {
    for (const policy of ["fixed_overnight", "clearlane"] as const) {
      for (const row of stage.plans[policy].intervals) {
        expect(row.meter_kw).toBeLessThanOrEqual(stage.site.host_ceiling_kw);
      }
    }
  });

  it("does not fetch, and judge-facing copy has no em dash or banned phrase", () => {
    const root = join(import.meta.dirname, "..");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx|json|css)$/.test(name)) files.push(path);
      }
    };
    walk(root);
    const banned = ["Torus " + "lacks", "Torus " + "revenue", "\u2014"];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const isTest = file.endsWith(".test.ts");
      if (
        !isTest &&
        (file.endsWith("engineClient.ts") ||
          file.includes(`${join("src", "stub")}`))
      ) {
        expect(text).not.toContain("fetch(");
      }
      for (const phrase of banned) {
        expect(text, file).not.toContain(phrase);
      }
    }
  });
});
