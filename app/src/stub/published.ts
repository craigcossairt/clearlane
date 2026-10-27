import type { TorusPublished } from "@contracts/types";

/**
 * No Torus value or URL is typed here. The stub reads what it needs from
 * public/data/torus_published.json, which app/src/data.ts bundles, and fails loudly when the
 * file is absent rather than falling back to a typed value.
 */
export const TORUS_FILE = "public/data/torus_published.json";

export function requireTorus(torus: TorusPublished | null): TorusPublished {
  if (!torus) throw new Error(`failed: ${TORUS_FILE} is missing`);
  return torus;
}
