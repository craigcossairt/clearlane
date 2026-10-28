import { useEffect, useState } from "react";
import type { CrashResult, CrashTracePoint } from "@contracts/types";
import type { CallState, Live } from "../beats/types";
import { INSET_PLAY_MS } from "../beats/CrashBeat";
import { Num } from "../components/Num";
import { mtClock } from "../components/Time";
import { COPY, PRESENTER } from "../copy";
import { STUB_ACTIVE } from "../engineClient";
import { grouped } from "../format";
import { motionOff } from "./motion";

const CRASH_SOURCE = STUB_ACTIVE
  ? "engineClient.crash (stub)"
  : "engine crash (live, this laptop)";

/** The traces draw over INSET_PLAY_MS, keyed by the call's event id, as on the stage. */
function usePlayhead(playId: string | null): number {
  const [f, setF] = useState(1);
  useEffect(() => {
    if (!playId || motionOff()) {
      setF(1);
      return;
    }
    const started = performance.now();
    let frame = 0;
    const tick = (t: number) => {
      const next = Math.min(1, (t - started) / INSET_PLAY_MS);
      setF(next);
      if (next < 1) frame = requestAnimationFrame(tick);
    };
    setF(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playId]);
  return f;
}

function Live({
  value,
  unit,
  digits,
  width,
}: {
  value: number;
  unit: string;
  digits: number;
  width?: number;
}) {
  return (
    <Num
      value={value}
      display={`${grouped(value, digits)}${unit === "%" ? "" : " "}${unit}`}
      prov="SIMULATED"
      source={CRASH_SOURCE}
      width={width}
    />
  );
}

/**
 * Screen 4 (#270): two large traces side by side, each led by its Delivered share. Our
 * simulation and Torus's published record share one row below, kept in separate halves.
 */
export function CallScreen({ live, call }: { live: Live; call: CallState }) {
  const shown = call.second ?? call.first;
  const f = usePlayhead(shown ? shown.event_id : null);
  const all = [shown, call.ghost].filter((r): r is CrashResult => r !== null);
  const maxKw = Math.max(
    1,
    ...all.flatMap((r) =>
      r.trace.map((p) =>
        Math.max(p.requested_kw, Math.abs(p.spin_kw), Math.abs(p.pulse_kw)),
      ),
    ),
  );
  const maxT = Math.max(...all.map((r) => r.trace.length), 1);
  const startUtc = shown
    ? (call.second ? live.calls.second : live.calls.first).start_utc
    : null;
  const nowS = shown ? Math.floor(f * (shown.trace.length - 1)) : 0;
  const clockUtc = startUtc
    ? new Date(Date.parse(startUtc) + nowS * 1000).toISOString()
    : null;
  const scales = { maxKw, maxT };

  return (
    <section
      className="beat crash-beat p-call"
      aria-label={COPY.crashTitle}
      data-anim={motionOff() ? "off" : "on"}
    >
      <div
        className={`p-call-banner${shown ? "" : " is-waiting"}`}
        data-slot="call-banner"
      >
        <div className="reserve">
          <p
            className={shown ? undefined : "off"}
            aria-hidden={shown ? undefined : true}
          >
            {COPY.crashBanner} <Num k="enrolled_kw" width={4} />{" "}
            {COPY.crashBannerKw}
          </p>
          <p
            className={shown ? "off" : undefined}
            aria-hidden={shown ? true : undefined}
          >
            {PRESENTER.callPrompt}
          </p>
        </div>
        <span className="slot-clock" data-slot="call-clock">
          {clockUtc ? (
            <>
              {COPY.simClock} <span data-time="">{mtClock(clockUtc)}</span>{" "}
              {COPY.mt}
            </>
          ) : null}
        </span>
      </div>
      <div className="p-call-traces">
        <Trace
          title={COPY.clearlaneLabel}
          result={shown}
          slot="call-inset"
          f={f}
          scales={scales}
          lead
          second={call.second !== null}
        />
        <Trace
          title={COPY.priceOnlyLabel}
          result={call.ghost}
          slot="call-ghost"
          f={f}
          scales={scales}
        />
      </div>
      <p className="p-call-legend">
        <span className="p-key is-requested" aria-hidden="true" />
        {PRESENTER.callTraceLegend}
      </p>
      <div className="p-call-facts" data-detail="">
        <article className="p-call-fact is-sim" data-slot="call-result">
          <h3>{PRESENTER.callSimTitle}</h3>
          {shown ? (
            <p>
              {PRESENTER.callSpinBack}{" "}
              <span data-time="">{mtClock(shown.spin_full_again_utc)}</span>{" "}
              {COPY.mt}. {COPY.meterRefill}{" "}
              <Live
                value={shown.meter_peak_during_refill_kw}
                unit="kW"
                digits={0}
              />
              .
            </p>
          ) : (
            <p className="unavailable">{PRESENTER.callWaiting}</p>
          )}
          <p data-slot="second-call">
            {call.second ? (
              <>
                {PRESENTER.secondRule} {COPY.shortfall}{" "}
                <Live value={call.second.shortfall_kwh} unit="kWh" digits={1} />
                .
              </>
            ) : (
              PRESENTER.secondPrompt
            )}
          </p>
        </article>
        <article className="p-call-fact is-published">
          <h3>{PRESENTER.callPublishedTitle}</h3>
          <p>
            <Num k="rmp_events_2025" width={3} />{" "}
            {/* The year is part of the FACTS wording for rmp_events_2025, not a stage number. */}
            <span data-copy-ok="">{COPY.eventsTail}</span>{" "}
            {PRESENTER.callPublishedRamp} <Num k="rmp_event_ramp_s" width={3} />{" "}
            {PRESENTER.callPublishedSeconds}{" "}
            <Num k="rmp_event_ramp_target_s" width={3} />{" "}
            {PRESENTER.callPublishedDelivered}{" "}
            <Num k="rmp_event_target_pct" width={4} />.
          </p>
        </article>
      </div>
    </section>
  );
}

// Drawing geometry only.
const W = 600;
const H = 220;
const X = (t: number, s: { maxT: number }) => (t / s.maxT) * W;
const Y = (kw: number, s: { maxKw: number }) => H - (kw / s.maxKw) * (H - 8);

function series(
  rows: CrashTracePoint[],
  pick: (p: CrashTracePoint) => number,
  s: { maxKw: number; maxT: number },
): string {
  return rows
    .filter((_p, i) => i % 5 === 0 || i === rows.length - 1)
    .map((p) => `${X(p.t_s, s)},${Y(pick(p), s)}`)
    .join(" ");
}

function Trace({
  title,
  result,
  slot,
  f,
  scales,
  lead,
  second,
}: {
  title: string;
  result: CrashResult | null;
  slot: string;
  f: number;
  scales: { maxKw: number; maxT: number };
  lead?: boolean;
  /** This card shows the second call. */
  second?: boolean;
}) {
  const rows = result
    ? result.trace.slice(0, Math.max(1, Math.ceil(f * result.trace.length)))
    : [];
  const asked = result
    ? `0,${H} ${series(result.trace, (p) => p.requested_kw, scales)} ${X(
        result.trace[result.trace.length - 1]!.t_s,
        scales,
      )},${H}`
    : "";
  const done = f >= 1;
  const line = (
    key: string,
    cls: string,
    pick: (p: CrashTracePoint) => number,
  ) => (
    <polyline
      key={key}
      data-series={key}
      className={cls}
      fill="none"
      vectorEffect="non-scaling-stroke"
      points={series(rows, pick, scales)}
    />
  );
  return (
    <article
      className={`p-call-trace${lead ? " is-lead" : ""}`}
      data-slot={slot}
      data-done={result ? (done ? "yes" : "no") : undefined}
    >
      <h3>{title}</h3>
      <div className="p-call-hero">
        {result ? (
          <>
            <span className="p-call-pct">
              <Live
                value={result.delivered_pct}
                unit="%"
                digits={0}
                width={5}
              />
            </span>
            <span className="p-call-pct-label">
              {second
                ? PRESENTER.callSecondDeliveredOf
                : PRESENTER.callDeliveredOf}
            </span>
          </>
        ) : (
          <span className="unavailable">{PRESENTER.callWaiting}</span>
        )}
      </div>
      <svg
        className="p-call-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${title}: ${COPY.crashAria}`}
      >
        <line x1={0} x2={W} y1={H} y2={H} className="p-call-base" />
        {result ? (
          <>
            <polygon
              data-series="requested"
              className="p-call-asked"
              points={asked}
            />
            {/* Pulse's line includes power it was already selling, so the battery-only card
                does not draw it: there it would read as answering the call (judge review 2). */}
            {lead
              ? line("pulse", "p-call-pulse", (p) => Math.max(0, -p.pulse_kw))
              : null}
            {/* Spin answering: discharge only, so the refill after the call is not drawn as help. */}
            {line("spin", "p-call-spin", (p) => Math.max(0, -p.spin_kw))}
          </>
        ) : null}
      </svg>
    </article>
  );
}
