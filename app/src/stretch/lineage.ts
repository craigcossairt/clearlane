import type {
  Provenance,
  SourceRef,
  StageNumber,
  TorusPublished,
} from "@contracts/types";
import type { CrossCheck, CrossCheckRow } from "../proof/sources";

/**
 * Number lineage (#91, ff_lineage): where a number on screen comes from. Everything here is
 * read from files, never written by hand: numbers.json for the key, class, source and date,
 * torus_published.json for Torus pages, science/crosscheck.json for the independent check and
 * docs/FACTS.md for the ledger row.
 */

/** What a chip knows about the number beside it. */
export interface ChipInfo {
  /** The numbers.json key; absent for a live engine value or a chip on a label. */
  key?: string;
  display?: string;
  prov: Provenance;
  source: string;
  asOf?: string;
}

export interface SourcePart {
  text: string;
  isUrl: boolean;
  /** The Torus source this URL is, from torus_published.json's own sources list. */
  torus?: SourceRef;
}

export interface TorusMatch {
  /** The torus_published.json field holding this value. */
  field: string;
  ref: SourceRef;
}

export interface CrossCheckLine {
  /** The check's name in crosscheck.json. */
  id: string;
  row: CrossCheckRow;
}

export interface Lineage {
  key?: string;
  display?: string;
  prov: Provenance;
  asOf?: string;
  parts: SourcePart[];
  /** Only for TORUS_PUBLISHED values. */
  torus: TorusMatch[];
  /** null: crosscheck.json does not list this key, so nothing is said about a check. */
  cross: CrossCheckLine | null;
}

const isUrl = (s: string) => /^https?:\/\//.test(s);

/** A numbers.json source is one or more repo paths or URLs joined by " + ". */
export function sourceParts(
  source: string,
  torus: TorusPublished | null,
): SourcePart[] {
  return source
    .split(" + ")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((text) => {
      const url = isUrl(text);
      const ref = url ? torus?.sources?.find((r) => r.url === text) : undefined;
      return ref ? { text, isUrl: url, torus: ref } : { text, isUrl: url };
    });
}

/**
 * The torus_published.json fields that hold this number: same value (or one end of a band)
 * and a source whose URL is one of the number's own source URLs.
 */
export function torusMatches(
  n: { value: number; source: string },
  torus: TorusPublished | null,
): TorusMatch[] {
  if (!torus?.sources) return [];
  const urls = new Set(sourceParts(n.source, torus).map((p) => p.text));
  const out: TorusMatch[] = [];
  for (const [field, tagged] of Object.entries(torus)) {
    if (field === "sources" || field === "notes") continue;
    const t = tagged as { value?: unknown; source_id?: unknown };
    const ref = torus.sources.find((r) => r.id === t.source_id);
    if (!ref || !urls.has(ref.url)) continue;
    const holds = Array.isArray(t.value)
      ? t.value.includes(n.value)
      : t.value === n.value;
    if (holds) out.push({ field, ref });
  }
  return out;
}

/** The crosscheck.json row for a key, by its name, facts_key or numbers_key. */
export function crossCheckFor(
  key: string | undefined,
  cc: CrossCheck | null,
): CrossCheckLine | null {
  if (!key || !cc) return null;
  for (const [id, row] of Object.entries(cc.checks)) {
    const nk = row.numbers_key;
    const listed =
      id === key ||
      row.facts_key === key ||
      nk === key ||
      (Array.isArray(nk) && nk.includes(key));
    if (listed) return { id, row };
  }
  return null;
}

export function lineageFor(
  info: ChipInfo,
  numbers: StageNumber[] | null,
  torus: TorusPublished | null,
  cc: CrossCheck | null,
): Lineage {
  const n = info.key ? numbers?.find((x) => x.key === info.key) : undefined;
  // A keyed chip reads its own numbers.json entry; the chip's props are the fallback.
  const prov = n?.prov ?? info.prov;
  const source = n?.source ?? info.source;
  return {
    key: n?.key,
    display: n?.display ?? info.display,
    prov,
    asOf: n?.as_of_mt ?? info.asOf,
    parts: sourceParts(source, torus),
    torus: n && prov === "TORUS_PUBLISHED" ? torusMatches(n, torus) : [],
    cross: crossCheckFor(n?.key, cc),
  };
}

export const FACTS_FILE = "docs/FACTS.md";

export interface FactsRow {
  /** VERIFIED, UNCHECKED, CONFLICT or PENDING-ENGINE; anything else is kept as written. */
  status: string;
  /** The certainty level, one to five. */
  lvl: string;
}

const STATUSES = ["PENDING-ENGINE", "VERIFIED", "UNCHECKED", "CONFLICT"];

/** Key -> status and level from FACTS.md's eight-column rows. The first row for a key wins. */
export function parseFactsRows(markdown: string): Map<string, FactsRow> {
  const rows = new Map<string, FactsRow>();
  for (const line of markdown.split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith("|")) continue;
    const c = t
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((x) => x.trim());
    if (c.length !== 8 || !/^[a-z][a-z0-9_]*$/.test(c[0]!) || rows.has(c[0]!))
      continue;
    const statusText = c[7]!;
    const status =
      STATUSES.find((s) => statusText.startsWith(s)) ??
      statusText.split(/[\s.(]/)[0]!;
    rows.set(c[0]!, { status, lvl: c[6]!.match(/[1-5]/)?.[0] ?? c[6]! });
  }
  return rows;
}

// Not eager: the ledger is large, so it loads only when a lineage panel first needs it.
const FACTS_GLOB = import.meta.glob("../../../docs/FACTS.md", {
  query: "?raw",
  import: "default",
});

let factsPromise: Promise<Map<string, FactsRow>> | null = null;
export function loadFactsRows(): Promise<Map<string, FactsRow>> {
  const load = Object.values(FACTS_GLOB)[0];
  factsPromise ??= load
    ? load().then((md) => parseFactsRows(md as string))
    : Promise.reject(new Error(`${FACTS_FILE} is not bundled`));
  return factsPromise;
}

type Opener = (info: ChipInfo, from: HTMLElement) => void;
let opener: Opener | null = null;

/** The panel registers itself while it is mounted; a chip calls openLineage on click. */
export function setLineageOpener(fn: Opener | null): void {
  opener = fn;
}

export function openLineage(info: ChipInfo, from: HTMLElement): void {
  opener?.(info, from);
}

export const LINEAGE_CHIP = ".chip[data-lineage]";
export const LINEAGE_PANEL = ".lineage-panel";

/** The chip with keyboard focus, if any. */
export function focusedChip(): HTMLElement | null {
  const el = document.activeElement;
  return el instanceof HTMLElement && el.matches(LINEAGE_CHIP) ? el : null;
}

/** I or Enter without a modifier: the keys that open a focused chip's lineage. */
export function isLineageKey(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  return event.key === "Enter" || event.key.toLowerCase() === "i";
}

/**
 * True when the lineage panel should get this key before any other overlay: the panel is open,
 * or I or Enter lands on a focused chip. With ff_lineage off there is no panel and no chip
 * takes focus, so this is always false.
 */
export function lineageOwnsKey(event: KeyboardEvent): boolean {
  if (document.querySelector(LINEAGE_PANEL)) return true;
  return isLineageKey(event) && focusedChip() !== null;
}
