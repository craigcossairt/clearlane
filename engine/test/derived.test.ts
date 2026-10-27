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
      expect(readFileSync(`${dir}/${f}`, "utf8")).not.toContain("�");
  });
});
