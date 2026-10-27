import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..", "..");
const design = readFileSync(join(root, "DESIGN.md"), "utf8");
const css = readFileSync(join(import.meta.dirname, "styles", "tokens.css"), "utf8");

/** DESIGN.md rows: | `--a` / `--b` | `#l1` / `#l2` | `#d1` / `#d2` | use | */
function designTokens(): Record<string, { light: string; dark: string }> {
  const out: Record<string, { light: string; dark: string }> = {};
  for (const line of design.split("\n")) {
    if (!line.startsWith("| `--")) continue;
    const cells = line.split("|").map((c) => c.trim());
    const names = [...(cells[1] ?? "").matchAll(/`(--[a-z-]+)`/g)].map((m) => m[1] ?? "");
    const light = [...(cells[2] ?? "").matchAll(/`(#[0-9a-f]{6})`/gi)].map((m) => m[1] ?? "");
    const dark = [...(cells[3] ?? "").matchAll(/`(#[0-9a-f]{6})`/gi)].map((m) => m[1] ?? "");
    names.forEach((n, i) => {
      out[n] = { light: light[i] ?? "", dark: dark[i] ?? "" };
    });
  }
  return out;
}

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[a-z-]+):\s*(#[0-9a-f]{6})/gi)) out[m[1] ?? ""] = m[2] ?? "";
  return out;
}

describe("tokens.css matches DESIGN.md", () => {
  const tokens = designTokens();

  it("reads the DESIGN.md table", () => {
    expect(Object.keys(tokens).length).toBeGreaterThanOrEqual(11);
  });

  it("dark is the default on :root", () => {
    const dark = block(":root {");
    for (const [name, v] of Object.entries(tokens)) expect(dark[name], name).toBe(v.dark);
  });

  it("light applies under prefers-color-scheme and under ?theme=light", () => {
    const media = block(':root:not([data-theme="dark"])');
    const forced = block(':root[data-theme="light"]');
    for (const [name, v] of Object.entries(tokens)) {
      expect(media[name], name).toBe(v.light);
      expect(forced[name], name).toBe(v.light);
    }
  });

  it("uses no color literal outside the DESIGN.md set", () => {
    const allowed = new Set(
      Object.values(tokens).flatMap((v) => [v.light.toLowerCase(), v.dark.toLowerCase()]),
    );
    const used = [...css.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase());
    expect(used.filter((c) => !allowed.has(c))).toEqual([]);
  });
});
