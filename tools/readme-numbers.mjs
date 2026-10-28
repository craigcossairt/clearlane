// Usage: node tools/readme-numbers.mjs [--check] [--root <dir>]
// Writes README.md's numbers block from public/derived/numbers.json (#34).
// Exit 0 written (or current, with --check), 1 stale (--check only), 2 could not run.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderBlock, replaceBlock } from "./lib/readme-numbers.mjs";

const args = process.argv.slice(2);
let root = join(dirname(fileURLToPath(import.meta.url)), "..");
let check = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--check") check = true;
  else if (a === "--root" && args[i + 1]) root = resolve(args[++i]);
  else {
    console.error(`readme-numbers: unknown argument ${a}`);
    process.exit(2);
  }
}

let next;
const readmePath = join(root, "README.md");
try {
  const numbersPath = join(root, "public/derived/numbers.json");
  if (!existsSync(numbersPath)) throw new Error(`${numbersPath} is missing`);
  const numbers = JSON.parse(readFileSync(numbersPath, "utf8"));
  const text = readFileSync(readmePath, "utf8");
  next = replaceBlock(text, renderBlock(numbers));
  if (check) {
    if (next !== text) {
      console.error("readme-numbers: README.md numbers block is stale; run node tools/readme-numbers.mjs");
      process.exit(1);
    }
    console.log("readme-numbers: README.md numbers block is current");
    process.exit(0);
  }
} catch (error) {
  console.error(`readme-numbers: could not run: ${error.message}`);
  process.exit(2);
}
writeFileSync(readmePath, next);
console.log("readme-numbers: wrote README.md numbers block");
