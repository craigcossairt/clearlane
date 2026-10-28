import { useEffect, useMemo, useRef, useState } from "react";
import type { Policy } from "@contracts/types";
import { CrashBeat } from "./beats/CrashBeat";
import { EnvelopeBeat } from "./beats/EnvelopeBeat";
import { Race } from "./beats/Race";
import { Replan } from "./beats/Replan";
import { Ribbon } from "./beats/Ribbon";
import { ScaleBeat } from "./beats/ScaleBeat";
import type { BeatProps, CallState, Live } from "./beats/types";
import { findNumber, NumbersContext, type NumbersState } from "./components/Num";
import { mtClock, mtDate } from "./components/Time";
import { COPY } from "./copy";
import { loadStageData, type StageData } from "./data";
import {
  crash,
  dayLanes,
  defaultSite,
  scriptedCalls,
  solve,
  STUB_ACTIVE,
} from "./engineClient";
import { FlagsContext, parseFlags, type FlagName } from "./flags";
import { KEYMAP, lookup, typedIntoInput } from "./keymap";
import { dayLabel, resolveStageDay } from "./stageDay";

export type BeatId = 1 | 2 | 3 | 4 | 5 | 6;

/** Every registered beat. The digit-rule test renders each one, so a new beat is covered. */
export const BEATS: {
  id: BeatId;
  label: string;
  Component: (p: BeatProps) => JSX.Element;
}[] = [
  { id: 1, label: "Traffic report", Component: Ribbon },
  { id: 2, label: "Race", Component: Race },
  { id: 3, label: "Call", Component: CrashBeat },
  { id: 4, label: "Re-plan", Component: Replan },
  { id: 5, label: "Envelope", Component: EnvelopeBeat },
  { id: 6, label: "Scale", Component: ScaleBeat },
];

/** The race time-lapse: 96 intervals in 15 s. */
const PLAY_MS = 15000;
const FLEET_STEP_MW = 10;
const EMPTY_CALL: CallState = { first: null, ghost: null, second: null };

let cachedData: StageData | null = null;
function defaultData(): StageData {
  cachedData ??= loadStageData();
  return cachedData;
}

export interface AppProps {
  data?: StageData;
  search?: string;
  now?: Date;
  reducedMotion?: boolean;
  /** Overrides `?ff=` and the defaults; the flag-off harness passes an empty set. */
  flags?: ReadonlySet<FlagName>;
}

export function App({ data, search, now, reducedMotion, flags }: AppProps) {
  const stageData = data ?? defaultData();
  const query = search ?? window.location.search;
  const clock = now ?? new Date();
  const resolved = useMemo(
    () => resolveStageDay(stageData, query),
    [stageData, query],
  );
  const numbersState: NumbersState = { state: "ready", numbers: stageData.numbers };
  const flagSet = useMemo(() => flags ?? parseFlags(query), [flags, query]);

  useEffect(() => {
    const theme = new URLSearchParams(query).get("theme");
    if (theme === "dark" || theme === "light")
      document.documentElement.dataset.theme = theme;
  }, [query]);

  if (resolved.state === "failed") {
    document.body.dataset.state = "failed";
    return (
      <div className="failed-state" role="alert">
        <h1>{COPY.failedTitle}</h1>
        <p>
          {COPY.failed}: {resolved.reason}
        </p>
      </div>
    );
  }
  return (
    <NumbersContext.Provider value={numbersState}>
      <FlagsContext.Provider value={flagSet}>
        <Stage
          data={stageData}
          bundleFile={resolved.entry.file}
          query={query}
          now={clock}
          reducedMotion={reducedMotion}
          bundle={resolved.entry.bundle}
        />
      </FlagsContext.Provider>
    </NumbersContext.Provider>
  );
}

function Stage({
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
  const live = useMemo<Live>(() => {
    const site = defaultSite();
    const policies: Policy[] = ["fixed_overnight", "price_only", "clearlane"];
    const plans = Object.fromEntries(
      policies.map((p) => [p, solve(bundle, site, p)]),
    ) as Live["plans"];
    return {
      bundle,
      bundleFile,
      day: dayLanes(bundle),
      site,
      plans,
      torus: data.torus,
      calls: scriptedCalls(bundle, site),
      stub: STUB_ACTIVE,
    };
  }, [bundle, bundleFile, data.torus]);

  const fleetRange = useMemo(() => {
    const ctx: NumbersState = { state: "ready", numbers: data.numbers };
    const min = findNumber(ctx, "mou_70mw")?.value;
    const max = findNumber(ctx, "torus_500mw")?.value;
    return min !== undefined && max !== undefined ? { min, max } : null;
  }, [data.numbers]);

  const startBeat = clampBeat(Number(params.get("beat") ?? "1"));
  const startEnd = params.get("step") === "end";
  const motionOff = reducedMotion ?? params.get("motion") === "off";

  const [beat, setBeat] = useState<BeatId>(startBeat);
  const [step, setStep] = useState<"start" | "end">(startEnd ? "end" : "start");
  const [hour, setHour] = useState(startEnd && startBeat === 2 ? 24 : 0);
  const [playing, setPlaying] = useState(false);
  const [call, setCall] = useState<CallState>(() =>
    startEnd && (startBeat === 3 || startBeat === 4)
      ? runCalls(live, startBeat === 3)
      : EMPTY_CALL,
  );
  const [backtest, setBacktest] = useState(startEnd && startBeat === 5);
  const [fleetMw, setFleetMw] = useState<number | null>(
    fleetRange ? (startEnd && startBeat === 6 ? fleetRange.max : fleetRange.min) : null,
  );
  const [help, setHelp] = useState(false);
  const [reduced, setReduced] = useState(motionOff);
  const [scale, setScale] = useState(1);
  const [phone, setPhone] = useState(false);
  const hourRef = useRef(hour);
  hourRef.current = hour;

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

  // One clock for the time-lapse. Pausing and resuming continue from the current hour.
  useEffect(() => {
    if (!playing) return;
    if (reduced) {
      setHour(24);
      setPlaying(false);
      return;
    }
    const fromHour = hourRef.current >= 24 ? 0 : hourRef.current;
    const started = performance.now() - (fromHour / 24) * PLAY_MS;
    let frame = 0;
    const tick = (t: number) => {
      const f = Math.min(1, (t - started) / PLAY_MS);
      setHour(f * 24);
      if (f < 1) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, reduced]);

  useEffect(() => {
    const go = (next: BeatId) => {
      setBeat(next);
      setStep("start");
      setPlaying(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (typedIntoInput(event.target) && event.key !== "Escape") return;
      const binding = lookup(event.key, beat);
      if (!binding) return;
      event.preventDefault();
      switch (binding.action) {
        case "next":
          // On the last beat, Right turns to the close card.
          if (beat === 6) setStep("end");
          else go(clampBeat(beat + 1));
          break;
        case "prev":
          go(clampBeat(beat - 1));
          break;
        case "beat":
          go(clampBeat(Number(event.key)));
          break;
        case "play":
          // After the re-plan, Space resumes the day from the call minute, not from midnight.
          if (beat === 4 && hourRef.current < callHour(live)) setHour(callHour(live));
          setPlaying((p) => !p);
          break;
        case "call":
          setPlaying(false);
          setBeat(3);
          setCall((prev) => {
            if (!prev.first) return runCalls(live, false);
            if (!prev.second)
              return {
                ...prev,
                second: crash(
                  live.plans.clearlane,
                  live.site,
                  live.calls.second,
                  live.torus,
                  live.calls.first,
                ),
              };
            return prev;
          });
          break;
        case "envelope":
          setBacktest(false);
          break;
        case "backtest":
          setBacktest(true);
          setStep("end");
          break;
        case "fleetUp":
        case "fleetDown":
        case "fleetMin":
        case "fleetMax":
          if (!fleetRange) break;
          setFleetMw((mw) => {
            const cur = mw ?? fleetRange.min;
            const next =
              binding.action === "fleetUp"
                ? cur + FLEET_STEP_MW
                : binding.action === "fleetDown"
                  ? cur - FLEET_STEP_MW
                  : binding.action === "fleetMin"
                    ? fleetRange.min
                    : fleetRange.max;
            return Math.max(fleetRange.min, Math.min(fleetRange.max, next));
          });
          break;
        case "reset":
          go(1);
          setHour(0);
          setCall(EMPTY_CALL);
          setBacktest(false);
          setFleetMw(fleetRange ? fleetRange.min : null);
          setHelp(false);
          break;
        case "help":
          setHelp((h) => !h);
          break;
        case "close":
          setHelp(false);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [beat, live, fleetRange]);

  const state = playing
    ? "playing"
    : call.first
      ? beat === 4
        ? "replanned"
        : "call"
      : beat === 2 && hour > 0 && hour < 24
        ? "paused"
        : "ready";
  useEffect(() => {
    document.body.dataset.beat = String(beat);
    document.body.dataset.step = beat === 2 && hour >= 24 ? "end" : step;
    document.body.dataset.state = state;
  }, [beat, step, state, hour]);

  const label = dayLabel(bundle.operating_day_mt, now);
  const props: BeatProps = {
    live,
    hour,
    call,
    backtest,
    fleetMw,
    onFleet: setFleetMw,
    step,
  };
  const Current = BEATS.find((b) => b.id === beat)?.Component ?? Ribbon;

  return (
    <div className={`viewport${phone ? " phone" : ""}`}>
      <div
        className="frame stage"
        style={phone ? undefined : { transform: `scale(${scale})` }}
      >
        <header className="top">
          <h1>{COPY.title}</h1>
          <p>
            {label === "today"
              ? COPY.dayToday
              : label === "tomorrow"
                ? COPY.dayTomorrow
                : COPY.dayCached}{" "}
            <span data-time="">{mtDate(bundle.operating_day_mt)}</span>
          </p>
          <p data-copy-ok="CAISO node id">{COPY.node}</p>
          <p>
            {COPY.snapshotFetched}{" "}
            <span data-time="">{mtClock(bundle.fetched_utc)}</span> {COPY.mt}
          </p>
          <p className="stub-slot" data-slot="stub-banner">
            {live.stub ? (
              <span className="stub-banner">{COPY.stubBanner}</span>
            ) : null}
          </p>
        </header>
        <p className="legend-line">{COPY.chipLegend}</p>
        <nav className="beats" aria-label="Beats">
          {BEATS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={beat === item.id ? "true" : undefined}
              onClick={() => {
                setBeat(item.id);
                setStep("start");
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <main className="main">
          <Current {...props} />
        </main>
        <footer className="foot">
          <p>Press ? for the key map.</p>
        </footer>
        {help ? (
          <div className="keymap" role="dialog" aria-modal="true" aria-label="Key map">
            <dl>
              {KEYMAP.map((b) => (
                <div key={b.action} style={{ display: "contents" }}>
                  <dt data-copy-ok="key names">{b.keyLabel}</dt>
                  <dd data-copy-ok="key action text">{b.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Hours from the bundle's first interval to the scripted call start (time arithmetic only). */
export function callHour(live: Live): number {
  const h0 = live.bundle.hours[0]?.ts_utc;
  if (!h0) return 0;
  return (Date.parse(live.calls.first.start_utc) - Date.parse(h0)) / 3_600_000;
}

function clampBeat(n: number): BeatId {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(6, Math.round(n))) as BeatId;
}

function runCalls(live: Live, withSecond: boolean): CallState {
  const first = crash(live.plans.clearlane, live.site, live.calls.first, live.torus);
  const ghost = crash(live.plans.price_only, live.site, live.calls.first, live.torus);
  const second = withSecond
    ? crash(
        live.plans.clearlane,
        live.site,
        live.calls.second,
        live.torus,
        live.calls.first,
      )
    : null;
  return { first, ghost, second };
}
