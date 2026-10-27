import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stableJson } from "@engine/json";
import { siteDefaultExport } from "@engine/siteExport";
import { repoPath } from "./helpers/fixture";

describe("public/derived stays in step with the engine", () => {
  it("site_default.json equals the CLI output", () => {
    const f = repoPath("public/derived/site_default.json");
    expect(existsSync(f)).toBe(true);
    expect(readFileSync(f, "utf8")).toBe(stableJson(siteDefaultExport()));
  });
});
