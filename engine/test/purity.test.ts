import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoPath } from "./helpers/fixture";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

const BANNED = [
  "from 'node:",
  'from "node:',
  "require(",
  "fetch(",
  "document.",
  "window.",
  "process.",
  "Math.random",
  "Date.now(",
  "new Date()",
  "—",
];

describe("engine/src purity", () => {
  const src = files(repoPath("engine/src"));

  it("has source files", () => expect(src.length).toBeGreaterThan(0));

  it.each(BANNED)("no file uses %s", (needle) => {
    const hits = src.filter((f) => readFileSync(f, "utf8").includes(needle));
    expect(hits).toEqual([]);
  });

  it("never assigns a numeric literal to solve_ms", () => {
    const hits = src.filter((f) =>
      /solve_ms\s*[:=]\s*[-+]?\s*[\d.]/.test(readFileSync(f, "utf8")),
    );
    expect(hits).toEqual([]);
  });
});
