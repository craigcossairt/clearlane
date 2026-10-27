// Reads the committed research CSVs behind the October facts. Shared by the numbers CLI and its test.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ResearchTables } from "../src/numbers";
import { parseCsv } from "../src/research";

export const RESEARCH_DIRS = {
  eia: "data/eia930",
  dam_oct: "data/oasis/dam_oct",
  edam_oct: "analysis/option2/oct",
} as const;

const tables = (dir: string) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".csv"))
    .sort()
    .map((f) => parseCsv(readFileSync(join(dir, f), "utf8")));

// null when a folder is missing or empty, or the OASIS folders hold more than one file
export function loadResearch(root: string): ResearchTables | null {
  const dirs = Object.values(RESEARCH_DIRS).map((d) => join(root, d));
  if (!dirs.every(existsSync)) return null;
  const [eia, dam, edam] = dirs.map(tables);
  if (!eia!.length || dam!.length !== 1 || edam!.length !== 1) return null;
  return { eia: eia!, dam_oct: dam![0]!, edam_oct: edam![0]! };
}
