import type { Provenance } from "@contracts/types";

/** Chip text names the class, so color is never the only signal. */
export function chipText(prov: Provenance): string {
  return prov.replace("_", " ");
}

export function Chip({
  prov,
  source,
  asOf,
}: {
  prov: Provenance;
  source: string;
  asOf?: string;
}) {
  const title = asOf ? `${source}, as of ${asOf}` : source;
  return (
    <abbr
      className={`chip chip-${prov.toLowerCase()}`}
      title={title}
      data-copy-ok="provenance class name"
    >
      {chipText(prov)}
    </abbr>
  );
}
