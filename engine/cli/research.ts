// Reads the committed research CSVs behind the October facts. Shared by the numbers CLI and its test.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ResearchTables } from "../src/numbers";
import { parseCsv } from "../src/research";

export const RESEARCH_DIRS = {
  eia: "data/eia930",
  dam_oct: "data/oasis/dam_oct",
  edam_oct: "analysis/option2/oct",
} as const;

// The folder's CSV names, or null when the folder does not exist; any other filesystem error throws.
function csvNames(dir: string): string[] | null {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".csv"))
      .sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

// null when every folder is absent. A present corpus must be complete: a missing folder, an empty
// eia930 folder or an OASIS folder without exactly one CSV throws.
export function loadResearch(root: string): ResearchTables | null {
  const names = Object.values(RESEARCH_DIRS).map((d) =>
    csvNames(join(root, d)),
  );
  if (names.every((n) => n === null)) return null;
  const dirs = Object.values(RESEARCH_DIRS);
  names.forEach((n, i) => {
    if (n === null)
      throw new Error(`research corpus incomplete: ${dirs[i]} is missing`);
  });
  const [eia, dam, edam] = names as string[][];
  if (!eia!.length)
    throw new Error(`research corpus: ${RESEARCH_DIRS.eia} has no CSV`);
  for (const [d, n] of [
    [RESEARCH_DIRS.dam_oct, dam!],
    [RESEARCH_DIRS.edam_oct, edam!],
  ] as const)
    if (n.length !== 1)
      throw new Error(
        `research corpus: ${d} must hold one CSV, found ${n.length}`,
      );
  const read = (d: string, f: string) =>
    parseCsv(readFileSync(join(root, d, f), "utf8"));
  return {
    eia: eia!.map((f) => read(RESEARCH_DIRS.eia, f)),
    dam_oct: read(RESEARCH_DIRS.dam_oct, dam![0]!),
    edam_oct: read(RESEARCH_DIRS.edam_oct, edam![0]!),
  };
}
