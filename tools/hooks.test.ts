import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) =>
  readFileSync(new URL(`../${p}`, import.meta.url), "utf-8");

// The sensitive-file patterns live in two scripts: block-sensitive-files.sh (Claude Code) and the
// spawn-free sensitive-path.sh (Cursor and Grok, via bin/run-claude-hook.sh). They must match.
const pattern = (src: string, name: string) => {
  const m = src.match(new RegExp(String.raw`^\s*(?:local\s+)?${name}='([^']*)'`, "m"));
  if (!m) throw new Error(`no ${name}= in script`);
  return m[1];
};

describe("sensitive-file hook patterns", () => {
  const canonical = read(".claude/hooks/block-sensitive-files.sh");
  const fast = read(".claude/hooks/sensitive-path.sh");

  it.each([
    ["SECRETS", "secrets"],
    ["LOCKS", "locks"],
    ["GENERATED", "generated"],
  ])("%s matches in both scripts", (upper, lower) => {
    expect(pattern(fast, lower)).toBe(pattern(canonical, upper));
  });

  it("both allow the same template suffixes", () => {
    const suffixes = String.raw`\.(example|sample|template)$`;
    expect(canonical).toContain(`'${suffixes}'`);
    expect(pattern(fast, "templates")).toBe(suffixes);
  });

  it("the fast path spawns nothing: no command substitution or pipes", () => {
    const code = fast
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("#"))
      .join("\n")
      .replace(/'[^']*'|"[^"]*"/g, "''")
      .replace(/\|\|/g, "");
    expect(code).not.toMatch(/\$\(|`/);
    expect(code).not.toMatch(/\|/);
  });
});
