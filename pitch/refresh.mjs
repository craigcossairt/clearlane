/**
 * The #99 copy pass in one command, for whichever day Craig picks.
 *
 * node pitch/refresh.mjs
 *
 * 1. Reads the operating day from public/derived/numbers.json.
 * 2. Runs resolve.mjs --strict, then build.mjs (deck and one-pager PDFs).
 * 3. Writes pitch/out/refresh-note.md, the #5 status comment: "refreshed to Oct 28"
 *    or "staying on Oct 27", with the resolver and build output tails.
 *
 * It posts nothing. Post the note with: gh issue comment 5 --body-file pitch/out/refresh-note.md
 *
 * Exit 0: both steps passed. Exit 1: a step failed (the note says which). Exit 2: could not run.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { operatingDay } from "./build.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const tail = (text, n = 8) => text.trimEnd().split(/\r?\n/).slice(-n).join("\n");

/** The #5 comment for a refresh run. day is "Oct 28, 2026" style. */
export function refreshNote(day, steps) {
  const short = day.replace(/, \d{4}$/, "");
  const head = /^Oct 27\b/.test(day) ? "Pitch: staying on Oct 27." : `Pitch: refreshed to ${short}.`;
  const failed = steps.filter((s) => s.status !== 0).map((s) => s.name);
  const lines = [
    head,
    "",
    `Operating day from \`public/derived/numbers.json\`: ${day}.`,
    failed.length ? `**Failed:** ${failed.join(", ")}.` : "Resolver strict and PDF build both passed.",
  ];
  for (const s of steps) lines.push("", `\`${s.cmd}\` (exit ${s.status})`, "```", tail(s.output), "```");
  return lines.join("\n") + "\n";
}

function run(name, args) {
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
  return { name, cmd: `node ${args.join(" ")}`, status: r.status ?? 2, output: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

function main() {
  const numbersPath = join(root, "public", "derived", "numbers.json");
  if (!existsSync(numbersPath)) {
    console.error("could not run: missing public/derived/numbers.json");
    process.exit(2);
  }
  const day = operatingDay(JSON.parse(readFileSync(numbersPath, "utf8")));
  const steps = [run("resolver", ["pitch/resolve.mjs", "--strict"]), run("build", ["pitch/build.mjs"])];
  const note = refreshNote(day, steps);
  const out = join(root, "pitch", "out");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "refresh-note.md"), note, "utf8");
  console.log(note);
  console.log("Post it: gh issue comment 5 --body-file pitch/out/refresh-note.md");
  process.exit(steps.every((s) => s.status === 0) ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
