import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FLAGS } from "@contracts/flags";
import { validate } from "./lib/schema.mjs";

const read = (p: string) =>
  readFileSync(new URL(`../${p}`, import.meta.url), "utf-8");

describe("contracts/flags.ts", () => {
  it("registers exactly the ff_* names in docs/STRETCH.md", () => {
    const named = new Set(read("docs/STRETCH.md").match(/\bff_[a-z0-9_]+/g));
    expect(Object.keys(FLAGS).sort()).toEqual([...named].sort());
  });

  it("defaults every flag to off, with a description", () => {
    for (const [name, f] of Object.entries(FLAGS)) {
      expect(f.default, name).toBe(false);
      expect(f.description.length, name).toBeGreaterThan(10);
    }
  });
});

describe("contracts/envelope.v1.schema.json", () => {
  const schema = JSON.parse(read("contracts/envelope.v1.schema.json"));
  const hour = (h: number) => ({
    ts_utc: `2026-10-27T${String(6 + h).padStart(2, "0")}:00:00Z`,
    system_critical: h >= 18,
    reserve_kw: 250,
    max_charge_kw: 250,
    max_discharge_kw: 250,
    planned_kw: 0,
    reason: "test hour",
  });
  const sample = () => ({
    schema: "clearlane.envelope/v1",
    operating_day_mt: "2026-10-27",
    fleet_kw: 250,
    sch_rule: "test rule",
    hours: Array.from({ length: 24 }, (_, h) => hour(h % 18)),
    generated_utc: "2026-10-27T15:00:00Z",
  });

  it("has the envelope schema id", () => {
    expect(schema.$id).toBe("clearlane.envelope/v1");
  });

  it("accepts a valid envelope", () => {
    expect(validate(schema, sample())).toEqual([]);
  });

  it("rejects a string in system_critical", () => {
    const env = sample();
    (env.hours[3] as Record<string, unknown>).system_critical = "yes";
    expect(validate(schema, env).join("\n")).toMatch(
      /hours\/3\/system_critical/,
    );
  });

  it("rejects a wrong schema tag, 23 hours, a missing field and a non-Z time", () => {
    const env = sample() as Record<string, unknown>;
    env.schema = "clearlane.envelope/v2";
    (env.hours as unknown[]).pop();
    delete env.sch_rule;
    env.generated_utc = "2026-10-27T15:00:00";
    const errs = validate(schema, env).join("\n");
    expect(errs).toMatch(/\/schema/);
    expect(errs).toMatch(/\/hours/);
    expect(errs).toMatch(/sch_rule/);
    expect(errs).toMatch(/generated_utc/);
  });
});
