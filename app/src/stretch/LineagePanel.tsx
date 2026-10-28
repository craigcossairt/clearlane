import { useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Provenance, TorusPublished } from "@contracts/types";
import { chipText } from "../components/Chip";
import { NumbersContext } from "../components/Num";
import { mtDate } from "../components/Time";
import { COPY } from "../copy";
import { TORUS_FILE } from "../data";
import { useFlag } from "../flags";
import { LINEAGE_KEY } from "../keymap";
import { statusLabel } from "../proof/cards/CrossCheckCard";
import { trapTab } from "../proof/ProofDrawer";
import {
  loadProofSources,
  PROOF_FILES,
  type CrossCheck,
} from "../proof/sources";
import {
  FACTS_FILE,
  focusedChip,
  isLineageKey,
  lineageFor,
  loadFactsRows,
  setLineageKeys,
  setLineageOpener,
  type ChipInfo,
  type FactsRow,
  type Lineage,
} from "./lineage";
import "./lineage.css";

const CLASS_TEXT: Record<Provenance, string> = {
  REAL: COPY.lineageClassReal,
  DERIVED: COPY.lineageClassDerived,
  SIMULATED: COPY.lineageClassSimulated,
  TORUS_PUBLISHED: COPY.lineageClassTorus,
  ASSUMPTION: COPY.lineageClassAssumption,
  MEASURED: COPY.lineageClassMeasured,
};

const FACTS_STATUS: Record<string, string> = {
  VERIFIED: COPY.lineageFactsVerified,
  CONFLICT: COPY.lineageFactsConflict,
  UNCHECKED: COPY.lineageFactsUnchecked,
  "PENDING-ENGINE": COPY.lineageFactsPending,
};

const FACTS_LEVEL: Record<string, string> = {
  "1": COPY.lineageLevel1,
  "2": COPY.lineageLevel2,
  "3": COPY.lineageLevel3,
  "4": COPY.lineageLevel4,
  "5": COPY.lineageLevel5,
};

const CLOSE_KEYS = new Set(["Escape", "PageUp", "PageDown"]);

export type FactsState =
  | { state: "loading" }
  | { state: "ready"; rows: Map<string, FactsRow> }
  | { state: "failed"; reason: string };

function bundledCrossCheck(): CrossCheck | null {
  const s = loadProofSources().crosscheck;
  return s.state === "ok" ? s.data : null;
}

/**
 * The number lineage panel (#91, ff_lineage). With the flag on, every provenance chip takes
 * focus; Enter, I or a click opens this panel with the number's key, value, class, source, date,
 * Torus page, cross-check and fact-ledger row. Esc, I, PageUp, PageDown, Close or a click
 * outside shuts it and focus goes back to the chip. With the flag off it renders nothing.
 */
export function LineagePanel({
  torus,
  crosscheck,
}: {
  torus: TorusPublished | null;
  /** Tests pass a fixture; the stage reads the bundled science/crosscheck.json. */
  crosscheck?: CrossCheck | null;
}) {
  if (!useFlag(LINEAGE_KEY.flag)) return null;
  return (
    <LineageOn
      torus={torus}
      crosscheck={crosscheck === undefined ? bundledCrossCheck() : crosscheck}
    />
  );
}

function LineageOn({
  torus,
  crosscheck,
}: {
  torus: TorusPublished | null;
  crosscheck: CrossCheck | null;
}) {
  const numbersState = useContext(NumbersContext);
  const numbers = numbersState.state === "ready" ? numbersState.numbers : null;
  const [info, setInfo] = useState<ChipInfo | null>(null);
  const [facts, setFacts] = useState<FactsState>({ state: "loading" });
  const openRef = useRef(false);
  const wasOpen = useRef(false);
  const from = useRef<HTMLElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  const show = useCallback((next: ChipInfo, el: HTMLElement) => {
    from.current = el;
    openRef.current = true;
    setInfo(next);
  }, []);
  const hide = useCallback(() => {
    openRef.current = false;
    setInfo(null);
  }, []);

  useEffect(() => {
    setLineageOpener(show);
    return () => setLineageOpener(null);
  }, [show]);

  const open = info !== null;
  useEffect(() => {
    if (open) {
      panel.current?.focus();
    } else if (wasOpen.current) {
      from.current?.focus();
      from.current = null;
    }
    wasOpen.current = open;
  }, [open]);

  // The ledger loads the first time a panel opens.
  useEffect(() => {
    if (!open || facts.state !== "loading") return;
    let alive = true;
    loadFactsRows().then(
      (rows) => alive && setFacts({ state: "ready", rows }),
      (e: unknown) => alive && setFacts({ state: "failed", reason: String(e) }),
    );
    return () => {
      alive = false;
    };
  }, [open, facts.state]);

  // Through lineage.ts's capture listener, so it runs before every other layer's key handler.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!openRef.current) {
        if (!isLineageKey(event) || event.repeat) return;
        const chip = focusedChip();
        if (!chip) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        chip.click();
        return;
      }
      // Open, the panel owns the keyboard: nothing moves the stage or an overlay underneath it.
      // Enter and Space still do their default work on the panel's own Close button.
      event.stopImmediatePropagation();
      if (event.key === "Tab") {
        event.preventDefault();
        trapTab(panel.current, event.shiftKey);
        return;
      }
      const isI = event.key !== "Enter" && isLineageKey(event);
      if (isI && event.repeat) {
        event.preventDefault();
        return;
      }
      if (CLOSE_KEYS.has(event.key) || isI) {
        event.preventDefault();
        hide();
      }
    };
    setLineageKeys(onKey);
    return () => setLineageKeys(null);
  }, [hide]);

  if (!info) return null;
  const lineage = lineageFor(info, numbers, torus, crosscheck);
  return (
    <div className="lineage-backdrop" onClick={hide}>
      <div
        ref={panel}
        className="lineage-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lineage-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="lineage-head">
          <h2 id="lineage-title">{COPY.lineageTitle}</h2>
          <button type="button" className="lineage-close" onClick={hide}>
            {COPY.lineageClose}
          </button>
        </header>
        <LineageRows lineage={lineage} facts={facts} />
      </div>
    </div>
  );
}

/** The panel's rows. Exported so a test can render the panel for every numbers.json key. */
export function LineageRows({
  lineage: l,
  facts,
}: {
  lineage: Lineage;
  facts: FactsState;
}) {
  return (
    <dl className="lineage-rows">
      <dt>{COPY.lineageKey}</dt>
      <dd>
        {l.key ? (
          <code data-copy-ok="numbers.json key" data-lineage-key="">
            {l.key}
          </code>
        ) : (
          COPY.lineageLive
        )}
      </dd>
      {l.display ? (
        <>
          <dt>{COPY.lineageShown}</dt>
          <dd>
            <span
              className="lineage-value"
              data-copy-ok="the number as shown"
              data-lineage-value=""
            >
              {l.display}
            </span>
          </dd>
        </>
      ) : null}
      <dt>{COPY.lineageClass}</dt>
      <dd data-lineage-class={l.prov}>
        <span
          className={`chip chip-${l.prov.toLowerCase()}`}
          data-copy-ok="provenance class name"
        >
          {chipText(l.prov)}
        </span>{" "}
        {CLASS_TEXT[l.prov]}
      </dd>
      <dt>{COPY.lineageSource}</dt>
      <dd>
        <ul className="lineage-sources" data-lineage-source="">
          {l.parts.map((p) => (
            <li key={p.text}>
              <code data-copy-ok="source path or URL">{p.text}</code>
              {p.torus ? (
                <>
                  , {COPY.lineageRetrieved}{" "}
                  <span data-time="">{p.torus.retrieved_utc}</span>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </dd>
      {l.key && l.prov === "TORUS_PUBLISHED" ? (
        <>
          <dt>{COPY.lineageTorus}</dt>
          <dd data-lineage-torus="">
            {l.torus.length === 0 ? (
              <>
                {COPY.lineageTorusNone}{" "}
                <code data-copy-ok="file path">{TORUS_FILE}</code>.
              </>
            ) : (
              l.torus.map((m) => (
                <p key={m.field}>
                  <code data-copy-ok="file path">{TORUS_FILE}</code>{" "}
                  {COPY.lineageTorusField}{" "}
                  <code data-copy-ok="field name">{m.field}</code>:{" "}
                  <code data-copy-ok="Torus page URL" data-torus-url="">
                    {m.ref.url}
                  </code>
                  , {COPY.lineageRetrieved}{" "}
                  <span data-time="">{m.ref.retrieved_utc}</span>
                </p>
              ))
            )}
          </dd>
        </>
      ) : null}
      {l.asOf ? (
        <>
          <dt>{COPY.lineageAsOf}</dt>
          <dd>
            <span data-time="">
              {/^\d{4}-\d{2}-\d{2}$/.test(l.asOf) ? mtDate(l.asOf) : l.asOf}
            </span>
          </dd>
        </>
      ) : null}
      {l.cross ? (
        <>
          <dt>{COPY.lineageCross}</dt>
          <dd data-lineage-cross={l.cross.row.status}>
            {COPY.lineageCrossLead}{" "}
            <strong>{statusLabel(l.cross.row.status)}</strong>.
            {l.cross.row.tolerance ? (
              <>
                {" "}
                {COPY.proofTolerance}{" "}
                <span data-copy-ok="tolerance text from the cross-check file">
                  {l.cross.row.tolerance}
                </span>
                .
              </>
            ) : null}
            {l.cross.row.second_path?.passes_tolerance === true &&
            l.cross.row.second_path.source ? (
              <>
                {" "}
                {COPY.proofSecondPath} {COPY.proofFrom}{" "}
                <span data-copy-ok="second path source">
                  {l.cross.row.second_path.source}
                </span>
                : {COPY.proofSecondPathPasses}.
              </>
            ) : null}{" "}
            <code data-copy-ok="file path">{PROOF_FILES.crosscheck}</code>
          </dd>
        </>
      ) : null}
      {l.key ? (
        <>
          <dt>{COPY.lineageFacts}</dt>
          <dd data-lineage-facts={facts.state}>
            <FactsLine keyName={l.key} facts={facts} />
          </dd>
        </>
      ) : null}
    </dl>
  );
}

function FactsLine({ keyName, facts }: { keyName: string; facts: FactsState }) {
  if (facts.state === "loading") return <>{COPY.lineageFactsLoading}</>;
  const file = <code data-copy-ok="file path">{FACTS_FILE}</code>;
  if (facts.state === "failed")
    return (
      <>
        {COPY.lineageFactsFailed} {file}
      </>
    );
  const row = facts.rows.get(keyName);
  if (!row)
    return (
      <>
        {COPY.lineageFactsMissing} {file}.
      </>
    );
  return (
    <>
      <span data-facts-status={row.status}>
        {FACTS_STATUS[row.status] ?? (
          <span data-copy-ok="status from the fact ledger">{row.status}</span>
        )}
      </span>{" "}
      {FACTS_LEVEL[row.lvl] ?? null} {file}
    </>
  );
}
