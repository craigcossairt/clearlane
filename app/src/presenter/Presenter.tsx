import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildLive, callHour, runCalls } from "../live";
import { Ribbon } from "../beats/Ribbon";
import { ScaleCard } from "../beats/ScaleBeat";
import { Chip } from "../components/Chip";
import type { CallState, Live } from "../beats/types";
import { findNumber, Num, type NumbersState } from "../components/Num";
import { mtClock, mtDate } from "../components/Time";
import { COPY, PRESENTER } from "../copy";
import { loadDerivedFiles, type StageData } from "../data";
import { grouped } from "../format";
import { dayLabel } from "../stageDay";
import {
  atEnd,
  atStart,
  backState,
  fromQuery,
  nextState,
  SCREENS,
  screenDef,
  stepName,
  type PresenterState,
  type ScreenKey,
} from "./model";
import { ProofDrawer } from "../proof/ProofDrawer";
import { StretchKeyRows } from "../components/StretchKeyRows";
import { RaceScreen } from "./RaceScreen";
import { CallScreen } from "./CallScreen";
import { BacktestLine, EnvelopeScreen } from "./EnvelopeScreen";
import { ReplanScreen } from "./ReplanScreen";
import "./presenter.css";

/** The race replay: 24 hours in the stage's 15 seconds. */
export const REPLAY_MS = 15000;
const EMPTY_CALL: CallState = { first: null, ghost: null, second: null };

const HEADLINES: Record<
  ScreenKey,
  { line?: string; source: string; sourceLong: string }
> = {
  title: { source: PRESENTER.footTitle, sourceLong: PRESENTER.sourceTitle },
  traffic: {
    line: PRESENTER.trafficLine,
    source: PRESENTER.footTraffic,
    sourceLong: PRESENTER.sourceTraffic,
  },
  race: {
    line: PRESENTER.raceLine,
    source: PRESENTER.footRace,
    sourceLong: PRESENTER.sourceRace,
  },
  call: {
    line: PRESENTER.callLine,
    source: PRESENTER.footCall,
    sourceLong: PRESENTER.sourceCall,
  },
  replan: {
    line: PRESENTER.replanLine,
    source: PRESENTER.footReplan,
    sourceLong: PRESENTER.sourceReplan,
  },
  envelope: {
    line: PRESENTER.envelopeLine,
    source: PRESENTER.footEnvelope,
    sourceLong: PRESENTER.sourceEnvelope,
  },
  scale: {
    line: PRESENTER.scaleLine,
    source: PRESENTER.footScale,
    sourceLong: PRESENTER.sourceScale,
  },
  close: {
    line: `${PRESENTER.closeLine} ${PRESENTER.closeWhat}`,
    source: PRESENTER.footClose,
    sourceLong: PRESENTER.sourceClose,
  },
};

interface Play {
  screen: number;
  from: number;
  to: number;
  ms: number;
}

/**
 * Presenter mode (#216, ff_presenter): eight click-through screens over the same live data and
 * engine calls as the stage. State is (screen, actions run); see model.ts. With the flag off
 * this component is never rendered.
 */
export function Presenter({
  data,
  bundle,
  bundleFile,
  query,
  now,
  reducedMotion,
}: {
  data: StageData;
  bundle: Live["bundle"];
  bundleFile: string;
  query: string;
  now: Date;
  reducedMotion?: boolean;
}) {
  const params = useMemo(() => new URLSearchParams(query), [query]);
  const live = useMemo(
    () => buildLive(bundle, bundleFile, data.torus),
    [bundle, bundleFile, data.torus],
  );
  // Both calls are solved once, on first need (the call screen or anything after it).
  const callsRef = useRef<CallState | null>(null);
  const bothCalls = useCallback((): CallState => {
    callsRef.current ??= runCalls(live, true);
    return callsRef.current;
  }, [live]);

  const fleetRange = useMemo(() => {
    const ctx: NumbersState = { state: "ready", numbers: data.numbers };
    const min = findNumber(ctx, "mou_70mw")?.value;
    const max = findNumber(ctx, "torus_500mw")?.value;
    return min !== undefined && max !== undefined ? { min, max } : null;
  }, [data.numbers]);

  const motionOff = reducedMotion ?? params.get("motion") === "off";
  const [st, setSt] = useState<PresenterState>(() => fromQuery(params));
  const [play, setPlay] = useState<Play | null>(null);
  const [playHour, setPlayHour] = useState(0);
  const [fleetDrag, setFleetDrag] = useState<number | null>(null);
  const [overlay, setOverlay] = useState<"sources" | "keys" | null>(null);
  const [reduced, setReduced] = useState(motionOff);
  const [scale, setScale] = useState(1);
  const [phone, setPhone] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const cHour = useMemo(() => callHour(live), [live]);

  useEffect(() => {
    if (motionOff || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener?.("change", apply);
    return () => media.removeEventListener?.("change", apply);
  }, [motionOff]);

  useEffect(() => {
    const fit = () => {
      setPhone(window.innerWidth < 768);
      setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // One clock for the replay and the resume. Reduced motion lands on the end state at once.
  useEffect(() => {
    if (!play) return;
    if (reduced) {
      setPlay(null);
      return;
    }
    const started = performance.now();
    let frame = 0;
    const tick = (t: number) => {
      const f = Math.min(1, (t - started) / play.ms);
      setPlayHour(play.from + f * (play.to - play.from));
      if (f < 1) frame = requestAnimationFrame(tick);
      else setPlay(null);
    };
    setPlayHour(play.from);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [play, reduced]);

  /** Land on a state; `animate` plays the screen's replay or resume when it has just run. */
  const go = useCallback(
    (next: PresenterState, animate: boolean) => {
      setSt(next);
      setFleetDrag(null);
      const key = screenDef(next.screen).key;
      // The clock is set in the same update as the play, so the first frame never shows the
      // last replay's (or resume's) hour.
      if (animate && !reduced && next.actions === 1 && key === "race") {
        setPlayHour(0);
        setPlay({ screen: next.screen, from: 0, to: 24, ms: REPLAY_MS });
      } else if (
        animate &&
        !reduced &&
        next.actions === 1 &&
        key === "replan"
      ) {
        setPlayHour(cHour);
        setPlay({
          screen: next.screen,
          from: cHour,
          to: 24,
          ms: (REPLAY_MS * Math.max(0, 24 - cHour)) / 24,
        });
      } else setPlay(null);
    },
    [reduced, cHour],
  );

  const onNext = useCallback(() => {
    // Next during a running replay jumps it to its end; the next Next leaves the screen.
    if (play) {
      setPlay(null);
      return;
    }
    go(nextState(st), true);
  }, [play, st, go]);
  const onBack = useCallback(() => go(backState(st), false), [st, go]);

  // Focus returns to the stage container after any click, so Space or Enter never re-fires a
  // button the presenter clicked earlier.
  const refocus = () => rootRef.current?.focus({ preventScroll: true });
  const click = (fn: () => void) => () => {
    fn();
    refocus();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" && event.key !== "Escape") return;
      // While an overlay is open the clicker keys do nothing; only ? and Escape reach it.
      if (overlay && event.key !== "?" && event.key !== "Escape") return;
      switch (event.key) {
        case "ArrowRight":
        case "PageDown":
          event.preventDefault();
          onNext();
          break;
        case "ArrowLeft":
        case "PageUp":
          event.preventDefault();
          onBack();
          break;
        case "Home":
          event.preventDefault();
          go(atStart(1), false);
          break;
        case "?":
          event.preventDefault();
          setOverlay((o) => (o === "keys" ? null : "keys"));
          break;
        case "Escape":
          setOverlay(null);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext, onBack, go, overlay]);

  // An open overlay takes focus (its Close button); closing it hands focus back to the stage.
  const overlayRef = useRef<HTMLDivElement>(null);
  const hadOverlay = useRef(false);
  useEffect(() => {
    if (overlay) {
      overlayRef.current
        ?.querySelector<HTMLButtonElement>('[data-action="overlay-close"]')
        ?.focus({ preventScroll: true });
    } else if (hadOverlay.current) {
      rootRef.current?.focus({ preventScroll: true });
    }
    hadOverlay.current = overlay !== null;
  }, [overlay]);
  /** Tab and Shift+Tab cycle inside the overlay. */
  const trapTab = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const items = [
      ...(overlayRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])',
      ) ?? []),
    ];
    if (items.length === 0) return;
    event.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLElement);
    const step = event.shiftKey ? -1 : 1;
    const next = at < 0 ? 0 : (at + step + items.length) % items.length;
    items[next]!.focus({ preventScroll: true });
  };

  const def = screenDef(st.screen);
  const step = stepName(st);
  useEffect(() => {
    const b = document.body.dataset;
    b.mode = "presenter";
    b.screen = String(st.screen);
    b.step = step;
    b.actions = String(st.actions);
    b.state = play ? "playing" : "ready";
  }, [st, step, play]);
  useEffect(
    () => () => {
      const b = document.body.dataset;
      delete b.mode;
      delete b.screen;
      delete b.actions;
    },
    [],
  );

  // Screen state from (screen, actions), with earlier screens finished.
  const callState: CallState =
    st.screen < 4
      ? EMPTY_CALL
      : st.screen === 4
        ? st.actions === 0
          ? EMPTY_CALL
          : st.actions === 1
            ? { ...bothCalls(), second: null }
            : bothCalls()
        : bothCalls();
  const playing = play !== null && play.screen === st.screen;
  const raceHour = st.actions === 0 ? null : playing ? playHour : 24;
  const replanHour = st.actions === 0 ? cHour : playing ? playHour : 24;
  const fleetMw = fleetRange
    ? (fleetDrag ??
      (st.screen === 7 && st.actions === 0 ? fleetRange.min : fleetRange.max))
    : null;

  const label = dayLabel(bundle.operating_day_mt, now);
  const dayWord =
    label === "today"
      ? COPY.dayToday
      : label === "tomorrow"
        ? COPY.dayTomorrow
        : COPY.dayCached;
  const head = HEADLINES[def.key];
  const isAction = (n: number) => st.actions >= n;

  const actionButtons = (() => {
    switch (def.key) {
      case "race":
        return (
          <PillButton
            primary={!isAction(1)}
            onClick={click(() => go({ screen: 3, actions: 1 }, true))}
            slot="action-replay"
          >
            {PRESENTER.replay}
          </PillButton>
        );
      case "call":
        return (
          <>
            <PillButton
              primary={!isAction(1)}
              pressed={isAction(1)}
              onClick={click(() =>
                go({ screen: 4, actions: Math.max(1, st.actions) }, false),
              )}
              slot="action-call-now"
            >
              {PRESENTER.callNow}
            </PillButton>
            <PillButton
              primary={isAction(1) && !isAction(2)}
              pressed={isAction(2)}
              onClick={click(() => go({ screen: 4, actions: 2 }, false))}
              slot="action-call-again"
            >
              {PRESENTER.callAgain}
            </PillButton>
          </>
        );
      case "replan":
        return (
          <PillButton
            primary={!isAction(1)}
            onClick={click(() => go({ screen: 5, actions: 1 }, true))}
            slot="action-resume"
          >
            {PRESENTER.resume}
          </PillButton>
        );
      case "envelope":
        return isAction(1) ? (
          <PillButton
            onClick={click(() => go({ screen: 6, actions: 0 }, false))}
            slot="action-backtest"
          >
            {PRESENTER.showEnvelope}
          </PillButton>
        ) : (
          <PillButton
            primary
            onClick={click(() => go({ screen: 6, actions: 1 }, false))}
            slot="action-backtest"
          >
            {PRESENTER.showBacktest}
          </PillButton>
        );
      case "scale":
        return (
          <span className="p-detail-actions" data-detail="">
            <PillButton
              pressed={fleetDrag === null && !isAction(1)}
              onClick={click(() => go({ screen: 7, actions: 0 }, false))}
              slot="action-fleet-min"
            >
              <Num k="mou_70mw" width={3} /> {PRESENTER.fleetMin}
            </PillButton>
            <PillButton
              primary={!isAction(1)}
              pressed={fleetDrag === null && isAction(1)}
              onClick={click(() => go({ screen: 7, actions: 1 }, false))}
              slot="action-fleet-max"
            >
              <Num k="torus_500mw" width={3} /> {PRESENTER.fleetMax}
            </PillButton>
          </span>
        );
      default:
        return null;
    }
  })();

  const headline = (() => {
    switch (def.key) {
      case "traffic":
        return PRESENTER.trafficHeadline;
      case "race":
        return (
          <>
            {PRESENTER.raceHeadlinePre} <Num k="race_ratio" width={4} />
            <br /> {PRESENTER.raceHeadlinePost}
          </>
        );
      case "call":
        return PRESENTER.callHeadline;
      case "replan":
        return PRESENTER.replanHeadline;
      case "envelope":
        return isAction(1)
          ? PRESENTER.backtestScoreHeadline
          : PRESENTER.envelopeHeadline;
      case "scale":
        return PRESENTER.scaleHeadline;
      case "close":
        return PRESENTER.closeHeadline;
      default:
        return null;
    }
  })();
  const line =
    def.key === "envelope" && isAction(1) ? <BacktestLine /> : head.line;

  const hero = (() => {
    switch (def.key) {
      case "title":
        return (
          <TitleHero
            day={bundle.operating_day_mt}
            onStart={click(() => go(atStart(2), false))}
          />
        );
      case "traffic":
        return (
          <Ribbon
            live={live}
            hour={0}
            call={EMPTY_CALL}
            backtest={false}
            fleetMw={null}
            onFleet={() => undefined}
            presenter
          />
        );
      case "race":
        return <RaceScreen live={live} hour={raceHour} />;
      case "call":
        return <CallScreen live={live} call={callState} />;
      case "replan":
        return <ReplanScreen live={live} call={callState} hour={replanHour} />;
      case "envelope":
        return <EnvelopeScreen live={live} backtest={isAction(1)} />;
      case "scale":
        return (
          <ScaleHero
            fleetMw={fleetMw}
            range={fleetRange}
            onDrag={(mw) => setFleetDrag(mw)}
          />
        );
      case "close":
        return <CloseHero />;
    }
  })();

  return (
    <div
      ref={rootRef}
      className={`viewport p-viewport${phone ? " phone" : ""}`}
      data-mode="presenter"
      tabIndex={-1}
    >
      <div
        className="frame p-frame"
        data-screen-key={def.key}
        style={phone ? undefined : { transform: `scale(${scale})` }}
      >
        <nav className="p-progress" aria-label={PRESENTER.progressAria}>
          {SCREENS.map((s) => (
            <button
              key={s.n}
              type="button"
              className={`p-seg${s.n < st.screen ? " is-done" : ""}${s.n === st.screen ? " is-current" : ""}`}
              aria-current={s.n === st.screen ? "step" : undefined}
              onClick={click(() => go(atStart(s.n), false))}
            >
              <span className="p-seg-bar" aria-hidden="true" />
              <span className="p-seg-label">{s.label}</span>
            </button>
          ))}
        </nav>
        <main className="p-main">
          {def.key === "title" ? null : (
            <header className="p-head">
              <h1 className="p-headline" data-slot="headline">
                {headline}
              </h1>
              <div className="p-subrow">
                {line ? <p className="p-line">{line}</p> : <span />}
                {actionButtons ? (
                  <div className="p-actions">{actionButtons}</div>
                ) : null}
              </div>
            </header>
          )}
          <div className={`p-hero p-hero-${def.key}`}>{hero}</div>
        </main>
        <footer className="p-foot">
          <p className="p-day">
            {dayWord}{" "}
            <span data-time="">{mtDate(bundle.operating_day_mt)}</span>.{" "}
            {COPY.snapshotFetched}{" "}
            <span data-time="">{mtClock(bundle.fetched_utc)}</span> {COPY.mt}
          </p>
          <p className="p-src">{head.source}</p>
          <div className="p-nav">
            <PillButton
              onClick={click(() => setOverlay("sources"))}
              quiet
              slot="sources"
            >
              {PRESENTER.sources}
            </PillButton>
            <ProofDrawer
              pillClassName="p-pill p-pill-quiet"
              onClosed={refocus}
            />
            <PillButton onClick={click(onBack)} slot="back">
              {PRESENTER.back}
            </PillButton>
            <PillButton onClick={click(onNext)} primary slot="next">
              {PRESENTER.next}
            </PillButton>
          </div>
        </footer>
      </div>
      {overlay ? (
        <div
          ref={overlayRef}
          className="p-overlay"
          onKeyDown={trapTab}
          role="dialog"
          aria-modal="true"
          aria-label={
            overlay === "keys" ? PRESENTER.keysTitle : PRESENTER.sourcesTitle
          }
          onClick={click(() => setOverlay(null))}
        >
          <div className="p-overlay-card" onClick={(e) => e.stopPropagation()}>
            {overlay === "keys" ? (
              <>
                <h2>{PRESENTER.keysTitle}</h2>
                <dl className="p-keys">
                  {PRESENTER.keys.map(([k, v]) => (
                    <div key={k} style={{ display: "contents" }}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                  <StretchKeyRows />
                </dl>
              </>
            ) : (
              <>
                <h2>{PRESENTER.provenanceTitle}</h2>
                <p>{COPY.chipLegend}</p>
                <h2>{PRESENTER.sourcesTitle}</h2>
                <ul className="p-sources">
                  {SCREENS.map((s) => (
                    <li key={s.n}>
                      <strong>{s.label}.</strong> {HEADLINES[s.key].sourceLong}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <PillButton
              onClick={click(() => setOverlay(null))}
              slot="overlay-close"
            >
              {PRESENTER.closeOverlay}
            </PillButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PillButton({
  children,
  onClick,
  primary,
  pressed,
  quiet,
  slot,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  pressed?: boolean;
  quiet?: boolean;
  slot: string;
}) {
  return (
    <button
      type="button"
      className={`p-pill${primary ? " p-pill-primary" : ""}${quiet ? " p-pill-quiet" : ""}`}
      aria-pressed={pressed === undefined ? undefined : pressed}
      data-action={slot}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function TitleHero({ day, onStart }: { day: string; onStart: () => void }) {
  return (
    <section className="p-title" aria-labelledby="p-wordmark">
      <div className="p-brand">
        <h1 id="p-wordmark" className="p-wordmark">
          {COPY.title}
        </h1>
      </div>
      <p className="p-title-line">{PRESENTER.titleLine}</p>
      <p className="p-title-detail">{PRESENTER.titleDetail}</p>
      <dl className="p-title-facts">
        <div>
          <dt>{PRESENTER.operatingDay}</dt>
          <dd>
            <span data-time="">{mtDate(day)}</span>
          </dd>
        </div>
        <div>
          <dt>{PRESENTER.titleNode}</dt>
          <dd data-copy-ok="CAISO node id">{COPY.node}</dd>
        </div>
      </dl>
      <div className="p-actions">
        <PillButton primary onClick={onStart} slot="action-start">
          {PRESENTER.start}
        </PillButton>
      </div>
    </section>
  );
}

function ScaleHero({
  fleetMw,
  range,
  onDrag,
}: {
  fleetMw: number | null;
  range: { min: number; max: number } | null;
  onDrag: (mw: number) => void;
}) {
  return (
    <section className="p-scale" aria-label={COPY.scaleTitle}>
      <div className="p-scale-row">
        <p className="p-scale-size">
          {COPY.fleetSize}{" "}
          <span className="slot-fleet" data-slot="fleet-value">
            <FleetNum fleetMw={fleetMw} width={8} />
          </span>
        </p>
        <input
          className="slider p-slider"
          type="range"
          min={range?.min ?? 0}
          max={range?.max ?? 0}
          step={10}
          value={fleetMw ?? 0}
          disabled={!range}
          aria-label={COPY.fleetAria}
          onChange={(event) => onDrag(Number(event.target.value))}
        />
      </div>
      <div className="p-scale-cards" data-slot="scale-cards">
        {(
          [
            [COPY.fixedLabel, "fixed_usd_mw_day"],
            [COPY.clearlaneLabel, "clearlane_usd_mw_day"],
          ] as const
        ).map(([title, perMwKey]) => (
          <div className="p-scale-col" key={perMwKey}>
            <ScaleCard title={title} perMwKey={perMwKey} fleetMw={fleetMw} />
            <p className="p-scale-arith" data-detail="">
              <Num k={perMwKey} width={4} /> {PRESENTER.scalePerMw}{" "}
              <span className="p-op">{PRESENTER.scaleTimes}</span>{" "}
              <FleetNum fleetMw={fleetMw} />
            </p>
          </div>
        ))}
      </div>
      <p className="p-scale-caveat">{PRESENTER.scaleCaveat}</p>
    </section>
  );
}

/** The fleet size as the slider holds it: SIMULATED between the two MOU keys. */
function FleetNum({
  fleetMw,
  width,
}: {
  fleetMw: number | null;
  width?: number;
}) {
  return fleetMw !== null ? (
    <Num
      value={fleetMw}
      display={`${grouped(fleetMw, 0)} MW`}
      prov="SIMULATED"
      source="fleet slider, between mou_70mw and torus_500mw"
      width={width}
    />
  ) : (
    <Num k="mou_70mw" width={width} />
  );
}

/**
 * Screen 8 (#271): the ask spelled out in the supporting line, three numbers the judges already
 * saw, the two close lines, and the Option 2 campus as a quieter card beside them.
 */
function CloseHero() {
  return (
    <section className="p-close" data-slot="close-card">
      <p className="p-repo">{PRESENTER.closeRepo}</p>
      <dl className="p-saw" aria-label={PRESENTER.sawAria}>
        <div>
          <dd>
            <Num k="race_ratio" width={4} />
          </dd>
          <dt>{PRESENTER.sawRatio}</dt>
        </div>
        <div>
          <dd>
            <Num k="calls_missed_by_policy_clearlane_mt" width={4} />
          </dd>
          <dt>{PRESENTER.sawCalls}</dt>
        </div>
        <div>
          <dd>
            <Num k="share_days_beating" width={4} />
          </dd>
          <dt>{PRESENTER.sawDays}</dt>
        </div>
      </dl>
      <div className="p-close-body">
        <div className="p-close-lines">
          <p className="close-line">{COPY.closeLine1}</p>
          <p className="close-line">{COPY.closeLine2}</p>
        </div>
        <aside className="p-campus" data-detail="">
          <h3>
            {COPY.campusTitle}{" "}
            <Chip
              prov="SIMULATED"
              source="Option 2 campus shift (engine), simulated"
            />
          </h3>
          <p>
            {COPY.campusLine1} <Num k="campus_mwh" /> {COPY.campusLine2}{" "}
            <Num k="campus_usd" />.
          </p>
          <p className="p-campus-note">
            {COPY.simulated} {COPY.notTorusProduct}
          </p>
        </aside>
      </div>
    </section>
  );
}
