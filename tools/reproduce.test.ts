import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  EXCLUDED_FIELDS,
  FETCH_TIME_FIELDS,
  diffJson,
  parseManifest,
  renderManifest,
  renderNumbersDoc,
  sha256,
} from "./lib/reproduce.mjs";

const cli = fileURLToPath(new URL("./reproduce.mjs", import.meta.url));
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const run = (...args: string[]) =>
  spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });

describe("manifest", () => {
  it("round-trips, sorted by path", () => {
    const text = renderManifest({
      "public/data/b.json": Buffer.from("b"),
      "public/data/a.json": Buffer.from("a"),
    });
    const m = parseManifest(text);
    expect(m.map((e) => e.path)).toEqual([
      "public/data/a.json",
      "public/data/b.json",
    ]);
    expect(m[0]?.sha).toBe(sha256(Buffer.from("a")));
  });
  it("hashes a CRLF checkout the same as LF", () => {
    expect(sha256(Buffer.from("x\r\ny\r\n"))).toBe(
      sha256(Buffer.from("x\ny\n")),
    );
  });
  it("rejects a malformed line", () => {
    expect(() => parseManifest("nothex  public/data/a.json")).toThrow(
      /bad manifest line/,
    );
  });
});

describe("diffJson", () => {
  const n = (key: string, value: number) => ({
    key,
    value,
    display: String(value),
  });
  it("names the stage key that changed in a numbers array", () => {
    expect(diffJson([n("a", 1), n("b", 2)], [n("a", 1), n("b", 3)])).toEqual([
      "[b]",
    ]);
  });
  it("names an added or removed key", () => {
    expect(diffJson([n("a", 1)], [n("a", 1), n("c", 1)])).toEqual(["[c]"]);
  });
  it("ignores generated_utc and solve_ms at any depth", () => {
    expect(
      diffJson(
        { generated_utc: "x", h: [{ solve_ms: 1, v: 2 }] },
        { generated_utc: "y", h: [{ solve_ms: 9, v: 2 }] },
      ),
    ).toEqual([]);
  });
  it("skips fetch times only when asked", () => {
    const a = { fetched_utc: "x", sources: [{ retrieved_utc: "x" }] };
    const b = { fetched_utc: "y", sources: [{ retrieved_utc: "y" }] };
    expect(diffJson(a, b)).toEqual(["fetched_utc", "sources[0].retrieved_utc"]);
    expect(diffJson(a, b, "", { ...EXCLUDED_FIELDS, ...FETCH_TIME_FIELDS })).toEqual([]);
  });
  it("reports a nested path and a key-order change", () => {
    expect(diffJson({ a: { b: 1 } }, { a: { b: 2 } })).toEqual(["a.b"]);
    expect(diffJson({ a: 1, b: 2 }, { b: 2, a: 1 })).toEqual([
      "(root) (key order)",
    ]);
  });
});

describe("renderNumbersDoc", () => {
  it("writes one row per number with key, display, class, source and day", () => {
    const doc = renderNumbersDoc([
      {
        key: "race_ratio",
        value: 2.9,
        unit: "x",
        display: "2.9x",
        prov: "DERIVED",
        source: "a | b",
        as_of_mt: "2026-10-27",
      },
    ]);
    expect(doc).toContain(
      "| `race_ratio` | 2.9x | DERIVED | a \\| b | 2026-10-27 |",
    );
    expect(doc).not.toMatch(/—/);
  });
});

describe("committed files are current", () => {
  it("tools/manifest.sha256 matches public/data", () => {
    const m = parseManifest(
      readFileSync(join(repoRoot, "tools/manifest.sha256"), "utf8"),
    );
    for (const { sha, path } of m)
      expect(sha256(readFileSync(join(repoRoot, path))), path).toBe(sha);
  });
  it("docs/NUMBERS.md matches public/derived/numbers.json", () => {
    const numbers = JSON.parse(
      readFileSync(join(repoRoot, "public/derived/numbers.json"), "utf8"),
    );
    const doc = readFileSync(join(repoRoot, "docs/NUMBERS.md"), "utf8").replace(
      /\r\n/g,
      "\n",
    );
    expect(doc).toBe(renderNumbersDoc(numbers));
  });
});

describe("reproduce CLI", () => {
  const copy = () => {
    const d = mkdtempSync(join(tmpdir(), "repro-test-"));
    for (const p of [
      "public/data",
      "public/derived",
      "tools/manifest.sha256",
      "docs/NUMBERS.md",
    ])
      cpSync(join(repoRoot, p), join(d, p), { recursive: true });
    return d;
  };
  it("exits 1 and names the file when one input byte is flipped", () => {
    const d = copy();
    const f = join(d, "public/data/torus_published.json");
    writeFileSync(f, readFileSync(f, "utf8") + " ");
    const r = run("--root", d);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(
      "public/data/torus_published.json: SHA-256 differs",
    );
  });
  it("exits 1 for an input missing from the manifest", () => {
    const d = copy();
    writeFileSync(join(d, "public/data/extra.json"), "{}");
    const r = run("--root", d);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(
      "public/data/extra.json: not in tools/manifest.sha256",
    );
  });
  it("exits 2, not 1, when the manifest is missing", () => {
    const d = mkdtempSync(join(tmpdir(), "repro-test-"));
    const r = run("--root", d);
    expect(r.status).toBe(2);
  });
  it("exits 2 on an unknown argument", () => {
    expect(run("--bogus").status).toBe(2);
  });
  it("exits 1 and names the stage key when a committed number is changed", () => {
    const d = copy();
    for (const p of ["research", "docs/FACTS.md"])
      cpSync(join(repoRoot, p), join(d, p), { recursive: true });
    const f = join(d, "public/derived/numbers.json");
    writeFileSync(
      f,
      readFileSync(f, "utf8").replace('"display": "2.9x"', '"display": "3.0x"'),
    );
    const r = run("--root", d);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("[race_ratio]");
    expect(r.stderr).toContain("NOT REPRODUCED: 1 of");
  }, 180_000);
  it("re-derives every stage number on the committed tree", () => {
    const r = run();
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
    const n = JSON.parse(
      readFileSync(join(repoRoot, "public/derived/numbers.json"), "utf8"),
    ).length;
    expect(r.stdout).toContain(`REPRODUCED ${n}/${n} stage numbers`);
  }, 180_000);
});
