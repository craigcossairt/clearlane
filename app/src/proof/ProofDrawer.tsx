import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { COPY } from "../copy";
import { useFlag } from "../flags";
import { PROOF_KEY, typedIntoInput } from "../keymap";
import { BacktestSpread } from "./cards/BacktestSpread";
import { CallLedgerCard } from "./cards/CallLedgerCard";
import { CrossCheckCard } from "./cards/CrossCheckCard";
import { IntervalsCard } from "./cards/IntervalsCard";
import { RtReplayCard } from "./cards/RtReplayCard";
import { ScaleCurveCard } from "./cards/ScaleCurveCard";
import { SchStudyCard } from "./cards/SchStudyCard";
import { SensitivityCard } from "./cards/SensitivityCard";
import { StepStatsCard } from "./cards/StepStatsCard";
import {
  loadProofSources,
  PROOF_FILES,
  type CardSource,
  type ProofCardId,
  type ProofSources,
} from "./sources";
import "./proof.css";

/**
 * The proof drawer (#90, ff_proof_drawer): Q&A cards for the stretch analyses. P or the Proof
 * pill opens it over the current beat; Esc, P, PageUp, PageDown or Close shuts it and hands focus
 * back, and Tab stays inside it while it is open. It never joins the six beats or their timing,
 * and with the flag off it renders nothing at all.
 */
export function ProofDrawer({
  sources,
  pillClassName = "proof-pill",
  onClosed,
}: {
  /** Tests pass fixture files; the stage reads the bundled ones. */
  sources?: ProofSources;
  /** The presenter footer passes its own pill classes; the stage pins the pill to the corner. */
  pillClassName?: string;
  /** Called on close instead of refocusing what had focus when the drawer opened. */
  onClosed?: () => void;
}) {
  if (!useFlag(PROOF_KEY.flag)) return null;
  return (
    <DrawerOn
      sources={sources ?? loadProofSources()}
      pillClassName={pillClassName}
      onClosed={onClosed}
    />
  );
}

/** The P row of the ? overlay, there only while the drawer's flag is on. */
export function ProofKeyRow() {
  if (!useFlag(PROOF_KEY.flag)) return null;
  return (
    <div style={{ display: "contents" }}>
      <dt data-copy-ok="key names">{PROOF_KEY.keyLabel}</dt>
      <dd data-copy-ok="key action text">{PROOF_KEY.label}</dd>
    </div>
  );
}

/** One renderer per file, so adding a file to PROOF_FILES without its card fails typecheck. */
const CARDS: Record<ProofCardId, (s: ProofSources) => ReactNode> = {
  stepStats: (s) => (
    <ProofCard id="stepStats" title={COPY.proofStepTitle} source={s.stepStats}>
      {(data) => <StepStatsCard data={data} />}
    </ProofCard>
  ),
  backtest: (s) => (
    <ProofCard
      id="backtest"
      title={COPY.proofBacktestTitle}
      source={s.backtest}
    >
      {(result) => <BacktestSpread result={result} />}
    </ProofCard>
  ),
  intervals: (s) => (
    <ProofCard
      id="intervals"
      title={COPY.proofIntervalsTitle}
      source={s.intervals}
    >
      {(data) => <IntervalsCard data={data} />}
    </ProofCard>
  ),
  callLedger: (s) => (
    <ProofCard
      id="callLedger"
      title={COPY.proofLedgerTitle}
      source={s.callLedger}
    >
      {(data) => <CallLedgerCard data={data} />}
    </ProofCard>
  ),
  rtReplay: (s) => (
    <ProofCard id="rtReplay" title={COPY.proofRtTitle} source={s.rtReplay}>
      {(data) => <RtReplayCard data={data} />}
    </ProofCard>
  ),
  schStudy: (s) => (
    <ProofCard id="schStudy" title={COPY.proofSchTitle} source={s.schStudy}>
      {(data) => <SchStudyCard data={data} />}
    </ProofCard>
  ),
  scaleCurve: (s) => (
    <ProofCard
      id="scaleCurve"
      title={COPY.proofScaleTitle}
      source={s.scaleCurve}
    >
      {(data) => <ScaleCurveCard data={data} />}
    </ProofCard>
  ),
  sensitivity: (s) => (
    <ProofCard
      id="sensitivity"
      title={COPY.proofSensTitle}
      source={s.sensitivity}
    >
      {(data) => <SensitivityCard data={data} />}
    </ProofCard>
  ),
  crosscheck: (s) => (
    <ProofCard
      id="crosscheck"
      title={COPY.proofCrossTitle}
      source={s.crosscheck}
    >
      {(data) => <CrossCheckCard data={data} />}
    </ProofCard>
  ),
};

const CLOSE_KEYS = new Set(["Escape", "PageUp", "PageDown"]);
const FOCUSABLE = 'button, [href], input, [tabindex]:not([tabindex="-1"])';

/** Tab and Shift+Tab cycle through the drawer's own controls, as the presenter's dialogs do. */
function trapTab(panel: HTMLElement | null, back: boolean) {
  const items = [...(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
  if (items.length === 0) return;
  const at = items.indexOf(document.activeElement as HTMLElement);
  const step = back ? -1 : 1;
  const next =
    at < 0
      ? back
        ? items.length - 1
        : 0
      : (at + step + items.length) % items.length;
  items[next]!.focus();
}

function DrawerOn({
  sources,
  pillClassName,
  onClosed,
}: {
  sources: ProofSources;
  pillClassName: string;
  onClosed?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const wasOpen = useRef(false);
  const closed = useRef(onClosed);
  closed.current = onClosed;
  const returnTo = useRef<HTMLElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLButtonElement>(null);

  const show = useCallback((from?: HTMLElement | null) => {
    const active = from ?? document.activeElement;
    returnTo.current =
      active instanceof HTMLElement && active !== document.body ? active : null;
    openRef.current = true;
    setOpen(true);
  }, []);
  const hide = useCallback(() => {
    openRef.current = false;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (open) {
      panel.current?.focus();
    } else if (wasOpen.current) {
      if (closed.current) closed.current();
      else returnTo.current?.focus();
      returnTo.current = null;
    }
    wasOpen.current = open;
  }, [open]);

  // Capture phase, so it runs before the stage's own key handler on window.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const isKey =
        event.key.toLowerCase() === PROOF_KEY.key &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey;
      if (!openRef.current) {
        // Held P must not flicker the drawer, and it never opens over another open dialog.
        if (
          isKey &&
          !event.repeat &&
          !typedIntoInput(event.target) &&
          !document.querySelector('[role="dialog"][aria-modal="true"]')
        ) {
          event.preventDefault();
          show();
        }
        return;
      }
      // Open, the drawer owns the keyboard: beat keys must not move the stage underneath it.
      // This listener stops the event before React sees it, so Tab is kept inside here.
      // Enter and Space still do their default work on the drawer's own controls.
      event.stopImmediatePropagation();
      if (event.key === "Tab") {
        event.preventDefault();
        trapTab(panel.current, event.shiftKey);
        return;
      }
      if (isKey && event.repeat) {
        event.preventDefault();
        return;
      }
      // The presenter's clicker sends PageUp and PageDown: either one closes the drawer.
      if (CLOSE_KEYS.has(event.key) || isKey) {
        event.preventDefault();
        hide();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [show, hide]);

  const ids = (Object.keys(PROOF_FILES) as ProofCardId[]).filter(
    (id) => sources[id].state !== "empty",
  );

  return (
    <>
      <button
        ref={pill}
        type="button"
        className={pillClassName}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-keyshortcuts="P"
        onClick={() => (openRef.current ? hide() : show(pill.current))}
      >
        {COPY.proofPill}
      </button>
      {open ? (
        <div className="proof-backdrop" onClick={hide}>
          <div
            ref={panel}
            className="proof-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={COPY.proofTitle}
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="proof-head">
              <h2>{COPY.proofTitle}</h2>
              <button type="button" className="proof-close" onClick={hide}>
                {COPY.proofClose}
              </button>
            </header>
            <p className="proof-intro">{COPY.proofIntro}</p>
            {ids.length === 0 ? (
              <p className="proof-state">{COPY.proofNone}</p>
            ) : null}
            {ids.map((id) => (
              <Fragment key={id}>{CARDS[id](sources)}</Fragment>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

/** The frame every card shares: title, the file it reads, then the card or its state. */
export function ProofCard<T>({
  id,
  title,
  source,
  children,
}: {
  id: ProofCardId;
  title: string;
  source: CardSource<T>;
  children: (data: T) => ReactNode;
}) {
  return (
    <article
      className="proof-card"
      data-card={id}
      data-card-state={source.state}
      aria-labelledby={`proof-card-${id}`}
    >
      <h3 id={`proof-card-${id}`}>{title}</h3>
      <p className="proof-reads">
        {COPY.proofReads} <code data-copy-ok="file path">{source.file}</code>
      </p>
      {source.state === "ok" ? (
        children(source.data)
      ) : (
        <p className={`proof-state proof-state-${source.state}`}>
          {source.state === "empty"
            ? COPY.proofEmpty
            : source.state === "broken"
              ? COPY.proofBroken
              : COPY.proofUnknown}
          {source.state === "unknown" ? (
            <>
              {" "}
              <span data-copy-ok="parse reason from the reader">
                {source.reason}
              </span>
            </>
          ) : null}
        </p>
      )}
    </article>
  );
}
