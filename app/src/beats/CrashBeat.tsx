import { useEffect, useState } from "react";
import type { CrashResult, CrashTracePoint } from "@contracts/types";
import { Num } from "../components/Num";
import { mtClock } from "../components/Time";
import { COPY } from "../copy";
import { TORUS_FILE } from "../data";
import { heatmapReadings, STUB_ACTIVE } from "../engineClient";
import { grouped } from "../format";
import type { BeatProps } from "./types";

const CRASH_SOURCE = STUB_ACTIVE
  ? "engineClient.crash (stub)"
  : "engine crash (live, this laptop)";
/** The inset plays the whole trace (call plus refill) in about 8 s. */
export const INSET_PLAY_MS = 8000;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  if (new URLSearchParams(window.location.search).get("motion") === "off")
    return true;
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : true;
}

/**
 * One clock for the inset, keyed by the call's event id (the play id). A new result restarts
 * it; the same result never restarts. Reduced motion lands on the end state at once.
 */
function usePlayhead(playId: string | null): number {
  const [f, setF] = useState(1);
  useEffect(() => {
    if (!playId || prefersReducedMotion()) {
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

/** Beat 3: the call. Live results are SIMULATED; Torus facts come from keys, in their own panel. */
export function CrashBeat({ live, call }: BeatProps) {
  const shown = call.second ?? call.first;
  const f = usePlayhead(shown ? shown.event_id : null);
  const byHour = live.torus?.events_2025_by_hour.value ?? null;
  const readings = byHour ? heatmapReadings(byHour) : null;
  const ceiling = live.site.host_ceiling_kw;
  // Shared chart scales so the ghost and the inset compare on the same axes (drawing only).
  const all = [shown, call.ghost].filter((r): r is CrashResult => r !== null);
  const maxKw = Math.max(
    ceiling,
    ...all.flatMap((r) =>
      r.trace.map((p) =>
        Math.max(
          p.requested_kw,
          Math.abs(p.spin_kw),
          Math.abs(p.pulse_kw),
          p.meter_kw,
        ),
      ),
    ),
    1,
  );
  const maxT = Math.max(...all.map((r) => r.trace.length), 1);
  const startUtc = shown
    ? (call.second ? live.calls.second : live.calls.first).start_utc
    : null;
  const nowS = shown ? Math.floor(f * (shown.trace.length - 1)) : 0;
  const clockUtc = startUtc
    ? new Date(Date.parse(startUtc) + nowS * 1000).toISOString()
    : null;
  const scales = { maxKw, maxT, ceiling, spinKwh: live.site.station.spin_kwh };

  return (
    <section className="beat crash-beat" aria-labelledby="beat-crash">
      <h2 id="beat-crash">{COPY.crashTitle}</h2>
      <div className="banner" data-slot="call-banner">
        {shown ? (
          <p>
            {COPY.crashBanner} <Num k="enrolled_kw" /> {COPY.crashBannerKw}{" "}
            {COPY.crashDuration}
          </p>
        ) : (
          <p>{COPY.crashPrompt}</p>
        )}
        <span className="slot-clock" data-slot="call-clock">
          {clockUtc ? (
            <>
              {COPY.simClock} <span data-time="">{mtClock(clockUtc)}</span>{" "}
              {COPY.mt}
            </>
          ) : null}
        </span>
      </div>
      <div className="race">
        <Trace
          title={COPY.clearlaneLabel}
          result={shown}
          slot="call-inset"
          f={f}
          scales={scales}
        />
        <Trace
          title={COPY.priceOnlyLabel}
          result={call.ghost}
          slot="call-ghost"
          f={f}
          scales={scales}
        />
      </div>
      <p className="crash-legend muted">{COPY.crashLegend}</p>
      <p data-slot="second-call">
        {call.second ? (
          <>
            {COPY.secondRule} {COPY.shortfall}{" "}
            <Live value={call.second.shortfall_kwh} unit="kWh" digits={1} />.
          </>
        ) : (
          COPY.secondPrompt
        )}
      </p>
      <div className="cards crash-cards">
        <article className="card simulated" data-slot="call-result">
          <h3>{COPY.ourSimulation}</h3>
          {shown ? (
            <p>
              {COPY.delivered}{" "}
              <Live value={shown.delivered_pct} unit="%" digits={0} />.{" "}
              {COPY.ramp} <Live value={shown.ramp_s} unit="s" digits={0} />.{" "}
              {COPY.spinWord}{" "}
              <Live value={shown.spin_kwh} unit="kWh" digits={1} />,{" "}
              {COPY.pulseWord}{" "}
              <Live value={shown.pulse_kwh} unit="kWh" digits={1} />.{" "}
              {COPY.spinFull}{" "}
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
            <p className="unavailable">
              {COPY.noCallYet} {COPY.emptyNotZero}
            </p>
          )}
        </article>
        <article className="card published">
          <h3>{COPY.publishedTitle}</h3>
          <p>
            <Num k="rmp_events_2025" />{" "}
            {/* The year is part of the FACTS wording for rmp_events_2025, not a stage number. */}
            <span data-copy-ok="">{COPY.eventsTail}</span> {COPY.ramp}{" "}
            <Num k="rmp_event_ramp_s" /> {COPY.against}{" "}
            <Num k="rmp_event_ramp_target_s" /> {COPY.target}.{" "}
            {COPY.delivered} <Num k="rmp_event_target_pct" /> {COPY.against}{" "}
            <Num k="rmp_event_band_min_pct" /> {COPY.ribbonTo}{" "}
            <Num k="rmp_event_band_max_pct" /> {COPY.band}.
          </p>
          <p className="muted">{COPY.heatmapNote}</p>
          {readings ? (
            <div className="heatmaps">
              <Heat label={COPY.heatmapMountain} counts={readings.mountain} />
              <Heat label={COPY.heatmapUtc} counts={readings.utc} />
            </div>
          ) : (
            <p className="unavailable">
              {COPY.unavailable}: {TORUS_FILE} is missing
            </p>
          )}
        </article>
      </div>
    </section>
  );
}

function Heat({ label, counts }: { label: string; counts: number[] }) {
  const max = Math.max(...counts, 1);
  return (
    <figure className="heat">
      <figcaption>{label}</figcaption>
      <div className="bar-row" aria-hidden="true">
        {counts.map((count, hour) => (
          <i
            key={hour}
            className="lane-shoulder"
            style={{ height: `${(count / max) * 100}%` }}
          />
        ))}
      </div>
    </figure>
  );
}

function Live({
  value,
  unit,
  digits,
}: {
  value: number;
  unit: string;
  digits: number;
}) {
  return (
    <Num
      value={value}
      display={`${grouped(value, digits)} ${unit}`}
      prov="SIMULATED"
      source={CRASH_SOURCE}
    />
  );
}

interface Scales {
  maxKw: number;
  maxT: number;
  ceiling: number;
  spinKwh: number;
}

// Drawing geometry only.
const W = 300;
const H = 100;
const X = (t: number, s: Scales) => 8 + (t / s.maxT) * W;
const Y = (kw: number, s: Scales) => H + 4 - (kw / s.maxKw) * H;

function series(
  rows: CrashTracePoint[],
  pick: (p: CrashTracePoint) => number,
  toY: (v: number) => number,
  s: Scales,
): string {
  return rows
    .filter((_p, i) => i % 5 === 0 || i === rows.length - 1)
    .map((p) => `${X(p.t_s, s)},${toY(pick(p))}`)
    .join(" ");
}

function Trace({
  title,
  result,
  slot,
  f,
  scales,
}: {
  title: string;
  result: CrashResult | null;
  slot: string;
  f: number;
  scales: Scales;
}) {
  const rows = result
    ? result.trace.slice(0, Math.max(1, Math.ceil(f * result.trace.length)))
    : [];
  const kwY = (kw: number) => Y(kw, scales);
  const socY = (kwh: number) =>
    H + 4 - (kwh / Math.max(scales.spinKwh, 1)) * H;
  const line = (
    key: string,
    stroke: string,
    pick: (p: CrashTracePoint) => number,
    toY: (v: number) => number,
    dash?: string,
  ) => (
    <polyline
      key={key}
      data-series={key}
      fill="none"
      stroke={stroke}
      strokeWidth={3}
      strokeDasharray={dash}
      vectorEffect="non-scaling-stroke"
      points={series(rows, pick, toY, scales)}
    />
  );
  return (
    <article className="panel" data-slot={slot}>
      <h3>{title}</h3>
      <svg
        className="trace"
        viewBox="0 0 320 112"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${title}: ${COPY.crashAria}`}
      >
        <line
          x1={8}
          x2={308}
          y1={kwY(scales.ceiling)}
          y2={kwY(scales.ceiling)}
          stroke="var(--jam)"
          strokeWidth={3}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
        />
        {result
          ? [
              line("requested", "var(--muted)", (p) => p.requested_kw, kwY),
              line("spin", "var(--accent)", (p) => Math.abs(p.spin_kw), kwY),
              line("pulse", "var(--shoulder)", (p) => Math.abs(p.pulse_kw), kwY),
              line("spin_soc", "var(--ink)", (p) => p.spin_soc_kwh, socY, "2 3"),
              line("meter", "var(--jam)", (p) => p.meter_kw, kwY),
            ]
          : null}
      </svg>
      {result ? (
        <p className="muted">
          {COPY.delivered}{" "}
          <Live value={result.delivered_pct} unit="%" digits={0} />.{" "}
          {COPY.shortfall}{" "}
          <Live value={result.shortfall_kwh} unit="kWh" digits={1} />.
        </p>
      ) : (
        <p className="unavailable">
          {COPY.noCallYet} {COPY.emptyNotZero}
        </p>
      )}
    </article>
  );
}
