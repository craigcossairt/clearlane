import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stableJson } from "@engine/json";
import { siteDefaultExport } from "@engine/siteExport";
import { readdirSync } from "node:fs";
import type { Envelope } from "@contracts/types";
import { buildEnvelope, defaultSite, solve } from "@engine/index";
import { wearUsdMwh } from "../cli/common";
import { loadFixture } from "./helpers/fixture";
import { repoPath } from "./helpers/fixture";

describe("public/derived stays in step with the engine", () => {
  it("site_default.json equals the CLI output", () => {
    const f = repoPath("public/derived/site_default.json");
    expect(existsSync(f)).toBe(true);
    expect(readFileSync(f, "utf8")).toBe(stableJson(siteDefaultExport()));
  });

  it("envelope_2026-10-27.json equals the CLI output on the fixture", () => {
    const f = repoPath("public/derived/envelope_2026-10-27.json");
    const text = readFileSync(f, "utf8");
    const committed = JSON.parse(text) as Envelope;
    const b = loadFixture();
    const site = defaultSite();
    const plan = solve(b, site, "clearlane", {
      wear_usd_mwh: wearUsdMwh(repoPath("public/derived/backtest.json")),
    });
    const env = buildEnvelope(plan, site, b, {
      generated_utc: committed.generated_utc,
    });
    expect(text).toBe(stableJson(env));
  });

  it("no file in public/derived has an em dash", () => {
    const dir = repoPath("public/derived");
    for (const f of readdirSync(dir))
      expect(readFileSync(`${dir}/${f}`, "utf8")).not.toContain(
        String.fromCharCode(0x2014),
      );
  });
});

// Pins the committed stage numbers that the stored-energy cycle count (#45) moved.
describe("committed numbers.json after the #45 cycle fix", () => {
  const n: { key: string; value: number; display: string }[] = JSON.parse(
    readFileSync(repoPath("public/derived/numbers.json"), "utf8"),
  );
  const d = (k: string) => n.find((x) => x.key === k)!.display;
  const v = (k: string) => n.find((x) => x.key === k)!.value;

  it("wear is calibrated on stored-side cycles and clearlane stays in budget", () => {
    expect(d("wear_usd_mwh")).toBe("$10.95");
    expect(v("cycles_per_year_by_policy_clearlane")).toBeLessThanOrEqual(300);
    expect(v("cycles_per_year_by_policy_clearlane").toFixed(2)).toBe("299.75");
    expect(v("cycles_per_year_by_policy_fixed_overnight").toFixed(6)).toBe(
      "365.000000",
    );
    expect(v("cycles_per_year_by_policy_price_only").toFixed(2)).toBe("625.44");
  });

  it("the Oct 27 site plan at the calibrated wear", () => {
    expect(v("clearlane_dp_usd_mw_day").toFixed(2)).toBe("48.89");
    expect(v("cycles_today").toFixed(2)).toBe("0.95");
    expect(d("dp_race_ratio")).toBe("2.4x");
    expect(d("share_days_beating")).toBe("91%");
  });

  it("the reference race does not depend on cycles or wear", () => {
    expect(v("clearlane_usd_mw_day").toFixed(2)).toBe("58.41");
    expect(d("race_ratio")).toBe("2.9x");
  });
});
