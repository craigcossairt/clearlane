import type { Bundle, StageNumber, TorusPublished } from "@contracts/types";

/**
 * The only module that reads JSON files. Everything is bundled at build time with eager
 * import.meta.glob, so the stage makes no runtime data request. A file that does not exist is
 * simply not in the map, which renders as an explicit empty state, never as a build failure
 * or a 0.
 */

export const FIXTURE_FILE = "contracts/fixtures/bundle_2026-10-27.json";
export const NUMBERS_FILE = "public/derived/numbers.json";
export const TORUS_FILE = "public/data/torus_published.json";

export interface BundleEntry {
  bundle: Bundle;
  file: string;
}

export interface StageData {
  /** Keyed by operating_day_mt. */
  bundles: Record<string, BundleEntry>;
  /** null: numbers.json is not computed yet. */
  numbers: StageNumber[] | null;
  torus: TorusPublished | null;
}

type GlobMap = Record<string, unknown>;

const repoPath = (globKey: string) => globKey.replace(/^(\.\.\/)+/, "");

/** Pure assembly from glob maps, so tests can build a StageData for any day. */
export function assemble(
  derived: GlobMap,
  data: GlobMap,
  fixture: GlobMap,
): StageData {
  const bundles: Record<string, BundleEntry> = {};
  const addBundle = (key: string, value: unknown) => {
    const bundle = value as Bundle;
    if (bundle && bundle.schema === "clearlane.bundle/v1") {
      bundles[bundle.operating_day_mt] = { bundle, file: repoPath(key) };
    }
  };
  // The fixture is the fallback; a real bundle for the same day replaces it.
  for (const [key, value] of Object.entries(fixture)) addBundle(key, value);
  let torus: TorusPublished | null = null;
  for (const [key, value] of Object.entries(data)) {
    if (/bundle_\d{4}-\d{2}-\d{2}\.json$/.test(key)) addBundle(key, value);
    else if (key.endsWith("torus_published.json"))
      torus = value as TorusPublished;
  }
  let numbers: StageNumber[] | null = null;
  for (const [key, value] of Object.entries(derived)) {
    if (key.endsWith("numbers.json") && Array.isArray(value))
      numbers = value as StageNumber[];
  }
  return { bundles, numbers, torus };
}

export function loadStageData(): StageData {
  const derived = import.meta.glob("../../public/derived/numbers.json", {
    eager: true,
    import: "default",
  });
  const data = import.meta.glob(
    [
      "../../public/data/bundle_*.json",
      "../../public/data/torus_published.json",
    ],
    { eager: true, import: "default" },
  );
  const fixture = import.meta.glob(
    "../../contracts/fixtures/bundle_2026-10-27.json",
    { eager: true, import: "default" },
  );
  return assemble(derived, data, fixture);
}

/** Resolve a Torus source_id to its URL from torus_published.json's own sources list. */
export function torusSourceUrl(
  torus: TorusPublished | null,
  sourceId: string,
): string {
  const found = torus?.sources?.find((s) => s.id === sourceId);
  return found?.url ?? sourceId;
}
