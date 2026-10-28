import type { Provenance } from "@contracts/types";
import { COPY } from "../copy";
import { useFlag } from "../flags";
import { LINEAGE_KEY } from "../keymap";
import { openLineage } from "../stretch/lineage";

/** Chip text names the class, so color is never the only signal. */
export function chipText(prov: Provenance): string {
  return prov.replace("_", " ");
}

export function Chip({
  prov,
  source,
  asOf,
  numKey,
  display,
}: {
  prov: Provenance;
  source: string;
  asOf?: string;
  /** The numbers.json key and the value beside the chip, for its lineage panel. */
  numKey?: string;
  display?: string;
}) {
  const lineage = useFlag(LINEAGE_KEY.flag);
  const title = asOf ? `${source}, as of ${asOf}` : source;
  if (!lineage)
    return (
      <abbr
        className={`chip chip-${prov.toLowerCase()}`}
        title={title}
        data-copy-ok="provenance class name"
      >
        {chipText(prov)}
      </abbr>
    );
  // ff_lineage (#91): the chip is a control that opens where its number comes from.
  return (
    <abbr
      className={`chip chip-${prov.toLowerCase()}`}
      title={title}
      data-copy-ok="provenance class name"
      data-lineage=""
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      aria-label={`${chipText(prov)}, ${COPY.lineageOpen}`}
      onClick={(event) =>
        openLineage(
          { key: numKey, display, prov, source, asOf },
          event.currentTarget,
        )
      }
    >
      {chipText(prov)}
    </abbr>
  );
}
