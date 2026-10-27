// numbers.json keys that are not (yet) rows in docs/FACTS.md. Each is listed in the PR body for
// Integration to add to FACTS; remove it here once FACTS has the row.
// Empty since Oct 27: the eleven keys listed here moved to FACTS section
// "Engine outputs: split keys and new keys", with the same classes.
import type { Provenance } from "@contracts/types";

export const NEW_KEYS: Record<string, { prov: Provenance; claim: string }> = {};
