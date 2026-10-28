import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  README_KEYS,
  renderBlock,
  replaceBlock,
} from "./lib/readme-numbers.mjs";

const cli = fileURLToPath(new URL("./readme-numbers.mjs", import.meta.url));
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const num = (key: string, display: string, prov = "DERIVED") => ({
  key,
  value: 1,
  unit: "x",
  display,
  prov,
  source: "engine/src/reference.ts + public/data/bundle_2026-10-27.json",
  as_of_mt: "2026-10-27",
});
const all = README_KEYS.map(({ key }) => num(key, `D(${key})`));
const START = "<!-- numbers:start -->";
const END = "<!-- numbers:end -->";

describe("renderBlock", () => {
  it("writes one row per README key with its display, class and day, in order", () => {
    const block = renderBlock(all);
    const rows = block.split("\n").filter((l) => /\| `[a-z0-9_]+` \|$/.test(l));
    expect(rows).toHaveLength(README_KEYS.length);
    README_KEYS.forEach(({ key }, i) => {
      expect(rows[i]).toContain(`\`${key}\``);
      expect(rows[i]).toContain(`D(${key})`);
      expect(rows[i]).toContain("DERIVED");
    });
    expect(block).toContain("2026-10-27");
  });

  it("throws, naming the key, when numbers.json lacks a README key", () => {
    const missing = README_KEYS[0]!.key;
    expect(() => renderBlock(all.filter((n) => n.key !== missing))).toThrow(
      missing,
    );
  });

  it("writes no em dash", () => {
    expect(renderBlock(all)).not.toContain("—");
  });
});

describe("replaceBlock", () => {
  it("replaces only the text between the markers", () => {
    const text = `intro\n${START}\nold\n${END}\noutro\n`;
    expect(replaceBlock(text, "new")).toBe(
      `intro\n${START}\nnew\n${END}\noutro\n`,
    );
  });

  it("throws when a marker is missing or repeated", () => {
    expect(() => replaceBlock("no markers", "x")).toThrow(/marker/);
    expect(() =>
      replaceBlock(`${START}\n${END}\n${START}\n${END}`, "x"),
    ).toThrow(/marker/);
  });
});

describe("readme-numbers.mjs CLI", () => {
  const fixture = () => {
    const root = mkdtempSync(join(tmpdir(), "readme-"));
    mkdirSync(join(root, "public/derived"), { recursive: true });
    writeFileSync(
      join(root, "public/derived/numbers.json"),
      JSON.stringify(all),
    );
    writeFileSync(join(root, "README.md"), `# T\n${START}\nstale\n${END}\n`);
    return root;
  };
  const run = (...args: string[]) =>
    spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });

  it("--check exits 1 on a stale block, then writing makes --check exit 0", () => {
    const root = fixture();
    expect(run("--root", root, "--check").status).toBe(1);
    expect(run("--root", root).status).toBe(0);
    expect(readFileSync(join(root, "README.md"), "utf8")).toContain(
      `D(${README_KEYS[0]!.key})`,
    );
    expect(run("--root", root, "--check").status).toBe(0);
  });

  it("exits 2 when numbers.json is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "readme-"));
    writeFileSync(join(root, "README.md"), `${START}\n${END}\n`);
    expect(run("--root", root).status).toBe(2);
  });

  it("the committed README block is current with the committed numbers.json", () => {
    const r = run("--root", repoRoot, "--check");
    expect(r.stderr + r.stdout).not.toMatch(/stale|could not run/);
    expect(r.status).toBe(0);
  });
});
