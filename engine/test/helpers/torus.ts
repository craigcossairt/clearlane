import { readFileSync } from "node:fs";
import type { TorusPublished } from "@contracts/types";
import { repoPath } from "./fixture";

// Tests only: the stage and the CLIs read public/data/torus_published.json.
export const torusFixture = (): TorusPublished =>
  JSON.parse(
    readFileSync(
      repoPath("engine/test/fixtures/torus_published.fixture.json"),
      "utf8",
    ),
  ) as TorusPublished;

// numbers.py's 2025 heatmap counts, 12am..11pm (FACTS rmp_heatmap_by_hour).
export const RMP_HEATMAP_BY_HOUR = torusFixture().events_2025_by_hour.value;
