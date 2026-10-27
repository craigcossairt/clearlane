// Research CSV readers for pinned tests. Parses like numbers.py load_dam and the snapshot CSV.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoPath } from "./fixture";

function rows(file: string): Record<string, string>[] {
  const [head, ...lines] = readFileSync(file, "utf8").trim().split(/\r?\n/);
  const cols = head!.split(",");
  return lines.map((l) => {
    const cells = l.split(",");
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ""]));
  });
}

// da_lmp_elap_pace in file order: HB 1 of Oct 27 to HB 0 of Oct 28.
export function snapshotPrices(): number[] {
  return rows(repoPath("research/data/pace_snapshot_2026-10-27.csv")).map((r) => Number(r.da_lmp_elap_pace));
}

// Mountain day (GMT - 6 h) -> 24 prices; days without 24 hours are dropped, like load_dam.
export function loadDam(dir: string): Map<string, number[]> {
  const lmp = new Map<string, number>();
  const abs = repoPath(dir);
  for (const f of readdirSync(abs).filter((x) => x.endsWith(".csv"))) {
    for (const r of rows(join(abs, f))) {
      if (r.NODE !== "ELAP_PACE-APND" || r.LMP_TYPE !== "LMP") continue;
      const t = Date.parse(`${r.INTERVALSTARTTIME_GMT!.slice(0, 19)}Z`) - 6 * 3_600_000;
      lmp.set(new Date(t).toISOString().slice(0, 13), Number(r.MW));
    }
  }
  const days = new Map<string, Map<number, number>>();
  for (const [k, v] of lmp) {
    const d = k.slice(0, 10);
    if (!days.has(d)) days.set(d, new Map());
    days.get(d)!.set(Number(k.slice(11, 13)), v);
  }
  const out = new Map<string, number[]>();
  for (const d of [...days.keys()].sort()) {
    const h = days.get(d)!;
    if (h.size === 24) out.set(d, Array.from({ length: 24 }, (_, i) => h.get(i)!));
  }
  return out;
}
