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
import { CrossCheckCard } from "./cards/CrossCheckCard";
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
 * pill opens it over the current beat; Esc, P or Close shuts it and hands focus back. It never
 * joins the six beats or their timing, and with the flag off it renders nothing at all.
 */
export function ProofDrawer({
  sources,
  inline = false,
}: {
  /** Tests pass fixture files; the stage reads the bundled ones. */
  sources?: ProofSources;
  /** In a footer next to other buttons, instead of pinned to the frame's corner. */
  inline?: boolean;
}) {
  if (!useFlag(PROOF_KEY.flag)) return null;
  return <DrawerOn sources={sources ?? loadProofSources()} inline={inline} />;
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
  backtest: (s) => (
    <ProofCard
      id="backtest"
      title={COPY.proofBacktestTitle}
      source={s.backtest}
    >
      {(result) => <BacktestSpread result={result} />}
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

function DrawerOn({
  sources,
  inline,
}: {
  sources: ProofSources;
  inline: boolean;
}) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
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
    } else if (returnTo.current) {
      returnTo.current.focus();
      returnTo.current = null;
    }
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
        if (isKey && !typedIntoInput(event.target)) {
          event.preventDefault();
          show();
        }
        return;
      }
      // Open, the drawer owns the keyboard: beat keys must not move the stage underneath it.
      // Tab, Enter and Space still do their default work on the drawer's own controls.
      event.stopImmediatePropagation();
      if (event.key === "Escape" || isKey) {
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
        className={`proof-pill${inline ? " inline" : ""}`}
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
