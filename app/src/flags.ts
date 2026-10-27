import { FLAGS } from "@contracts/flags";

export type FlagName = keyof typeof FLAGS;

/**
 * Stage flags. Every flag is off unless contracts/flags.ts defaults it on; `?ff=a,b` (names
 * without the ff_ prefix) turns flags on for rehearsal. Unknown names are ignored.
 */
export function parseFlags(search: string): Set<FlagName> {
  const on = new Set<FlagName>();
  for (const [name, def] of Object.entries(FLAGS)) {
    if (def.default) on.add(name as FlagName);
  }
  const raw = new URLSearchParams(search).get("ff");
  if (!raw) return on;
  for (const part of raw.split(",")) {
    const name = `ff_${part.trim().replace(/^ff_/, "")}`;
    if (name in FLAGS) on.add(name as FlagName);
  }
  return on;
}
