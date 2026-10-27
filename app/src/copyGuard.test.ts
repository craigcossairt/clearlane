import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = import.meta.dirname;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx|css|json|html)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

// Built from parts so this file does not trip its own scan if the rule widens to tests.
const BANNED = [
  String.fromCharCode(0x2014),
  "comprehensive",
  "robust",
  "seamless",
  "leverage",
  "cutting-edge",
  "game-changer",
  ["Torus", "lacks"].join(" "),
  ["Torus", "revenue"].join(" "),
  ["six-minute", "call"].join(" "),
  ["Utah", "regulators"].join(" "),
];

describe("copy guard over app/src", () => {
  it("has no em dash, hype word or Do-not-say phrase", () => {
    const hits: string[] = [];
    for (const file of [...walk(SRC), join(SRC, "..", "index.html")]) {
      const text = readFileSync(file, "utf8").toLowerCase();
      for (const phrase of BANNED) {
        if (text.includes(phrase.toLowerCase())) hits.push(`${relative(SRC, file)}: ${phrase}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
