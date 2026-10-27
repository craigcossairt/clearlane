import type { StageNumber } from "@contracts/types";

export function Chip({ prov, source }: { prov: string; source: string }) {
  return (
    <abbr className={`chip chip-${prov.toLowerCase()}`} title={source}>
      {prov}
    </abbr>
  );
}

export function Num({ n }: { n: StageNumber }) {
  return (
    <span className="num">
      <span className="figure">{n.display}</span>
      <Chip prov={n.prov} source={`${n.source}. ${n.unit}`} />
    </span>
  );
}

export function Inline({ n }: { n: StageNumber }) {
  return (
    <span className="inline-num">
      {n.display}
      <Chip prov={n.prov} source={`${n.source}. ${n.unit}`} />
    </span>
  );
}
