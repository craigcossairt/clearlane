import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { examplePaths, handle, ROOT, ROUTES, writeExamples } from "../feed";

const DAY = "2026-10-27";
const PROVS = [
  "REAL",
  "DERIVED",
  "SIMULATED",
  "TORUS_PUBLISHED",
  "ASSUMPTION",
  "MEASURED",
];

type Example = { path: string; status: number; body: Record<string, unknown> };
const example = (route: string): Example =>
  JSON.parse(
    readFileSync(join(ROOT, "api", "examples", `${route}_${DAY}.json`), "utf8"),
  ) as Example;

/** The contract: schema id, data_mode, generated_utc, and a prov beside every value in every row. */
function contractErrors(body: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (
    typeof body.schema !== "string" ||
    !body.schema.startsWith("clearlane.feed.")
  )
    errors.push("schema id");
  if (body.data_mode !== "snapshot") errors.push("data_mode");
  if (
    typeof body.generated_utc !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(body.generated_utc)
  ) {
    errors.push("generated_utc");
  }
  const rows = body.rows as Record<string, unknown>[] | undefined;
  if (!Array.isArray(rows) || rows.length !== 24) errors.push("24 rows");
  for (const [i, row] of (rows ?? []).entries()) {
    for (const [key, cell] of Object.entries(row)) {
      if (key === "ts_utc" || key === "hour_mt") continue;
      const c = cell as { value?: unknown; prov?: unknown };
      if (
        !c ||
        typeof c !== "object" ||
        !("value" in c) ||
        !PROVS.includes(c.prov as string)
      ) {
        errors.push(`row ${i} ${key} has no prov`);
      }
    }
  }
  return errors;
}

describe("lasso-feed contract", () => {
  it("has one committed example per route, matching what the handler returns now", () => {
    const paths = examplePaths(DAY);
    for (const route of ROUTES) {
      const ex = example(route);
      expect(ex.path).toBe(paths[route]);
      expect(handle(ex.path)).toEqual({ status: ex.status, body: ex.body });
    }
  });

  it("signal and envelope examples meet the contract", () => {
    for (const route of ["signal", "envelope"]) {
      const ex = example(route);
      expect(ex.status).toBe(200);
      expect(contractErrors(ex.body)).toEqual([]);
    }
  });

  it("a planted missing prov fails the contract", () => {
    const body = structuredClone(example("signal").body);
    const rows = body.rows as Record<
      string,
      { value: unknown; prov?: string }
    >[];
    delete rows[19]!.lmp_usd_mwh!.prov;
    expect(contractErrors(body)).toEqual(["row 19 lmp_usd_mwh has no prov"]);
    const bare = structuredClone(example("envelope").body);
    (bare.rows as Record<string, unknown>[])[3]!.reserve_kw = 250;
    expect(contractErrors(bare)).toEqual(["row 3 reserve_kw has no prov"]);
  });

  it("signal rows carry the engine lanes and System Critical Hours", () => {
    const rows = example("signal").body.rows as Record<
      string,
      { value: unknown; prov: string }
    >[];
    expect(rows[19]!.lane).toEqual({ value: "jam", prov: "DERIVED" });
    expect(rows.filter((r) => r.system_critical!.value === true)).toHaveLength(
      6,
    );
    expect(rows[0]!.lmp_usd_mwh!.prov).toBe("REAL");
  });

  it("routes without a committed source return 404 with a reason", () => {
    for (const route of ["fleet", "envelope_2030_5"]) {
      const ex = example(route);
      expect(ex.status).toBe(404);
      expect(ex.body.schema).toBe("clearlane.feed.error/v1");
      expect(String(ex.body.reason)).toMatch(/not found|cut/);
    }
    expect(handle("/v1/signal/2026-01-01").status).toBe(404);
    expect(handle("/v1/weather/2026-10-27").status).toBe(404);
    expect(handle("/v2/signal/2026-10-27").status).toBe(404);
  });

  it("the example writer is deterministic", () => {
    const dir = mkdtempSync(join(tmpdir(), "feed-"));
    try {
      writeExamples(DAY, ROOT, dir);
      for (const name of readdirSync(dir)) {
        expect(readFileSync(join(dir, name), "utf8")).toBe(
          readFileSync(join(ROOT, "api", "examples", name), "utf8"),
        );
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
