import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

const files = walk(SRC);
const rel = (p: string) => relative(SRC, p).split(sep).join("/");
const isTest = (p: string) => /\.test\.tsx?$/.test(p);
const importsOf = (text: string) =>
  [...text.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1] ?? "");

describe("engine seam", () => {
  it("only engineClient.ts (and the stub itself) imports @engine or app/src/stub", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const r = rel(file);
      if (r === "engineClient.ts" || r.startsWith("stub/") || isTest(file)) continue;
      for (const spec of importsOf(readFileSync(file, "utf8"))) {
        if (spec.startsWith("@engine") || /(^|\/)stub(\/|$)/.test(spec))
          offenders.push(`${r} imports ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the stub does not import @engine (only the client does)", () => {
    const offenders = files
      .filter((f) => rel(f).startsWith("stub/") && !isTest(f))
      .filter((f) => importsOf(readFileSync(f, "utf8")).some((s) => s.startsWith("@engine")))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("the client and the stub make no network calls", () => {
    const offenders = files
      .filter((f) => (rel(f) === "engineClient.ts" || rel(f).startsWith("stub/")) && !isTest(f))
      .filter((f) => /\bfetch\(|XMLHttpRequest/.test(readFileSync(f, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("no Torus URL is typed into app/src outside tests", () => {
    const offenders = files
      .filter((f) => !isTest(f))
      .filter((f) => /torus\.co|datocms-assets|businesswire/.test(readFileSync(f, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
