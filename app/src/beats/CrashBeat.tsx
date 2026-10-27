import type { CrashResult } from "@contracts/types";
import { Num } from "../components/Num";
import { COPY } from "../copy";
import { TORUS_FILE } from "../data";
import { heatmapReadings } from "../engineClient";
import { grouped } from "../format";
import type { BeatProps } from "./types";

const CRASH_SOURCE = "engineClient.crash (stub)";

/** Beat 3 (core 6 only starts here). Live results are SIMULATED; Torus facts come from keys. */
export function CrashBeat({ live, call }: BeatProps) {
  const shown = call.second ?? call.first;
  const byHour = live.torus?.events_2025_by_hour.value ?? null;
  const readings = byHour ? heatmapReadings(byHour) : null;
  return (
    <section className="beat" aria-labelledby="beat-crash">
      <h2 id="beat-crash">The call</h2>
      <div className="banner" data-slot="call-banner">
        {shown ? (
          <p>
            Simulated Rocky Mountain Power call: <Num k="enrolled_kw" /> kW
            now. A call of about five and a half minutes.
          </p>
        ) : (
          <p>
            Press C to drop a simulated Rocky Mountain Power call. This space
            stays put either way.
          </p>
        )}
      </div>
      <div className="race">
        <Trace title={COPY.clearlaneLabel} result={shown} slot="call-inset" />
        <Trace title={COPY.priceOnlyLabel} result={call.ghost} slot="call-ghost" />
      </div>
      <p data-slot="second-call">
        {call.second ? (
          <>
            Second press inside the refill window. Shortfall{" "}
            <Live value={call.second.shortfall_kwh} unit="kWh" digits={1} />.
          </>
        ) : (
          "A second press during the refill shows any shortfall here."
        )}
      </p>
      <article className="card published">
        <h3>Published record, separate from this simulation</h3>
        <p>
          <Num k="rmp_events_2025" /> events (Torus, RMP case study). Ramp{" "}
          <Num k="rmp_event_ramp_s" /> against a{" "}
          <Num k="rmp_event_ramp_target_s" /> target. Delivered{" "}
          <Num k="rmp_event_target_pct" /> against a{" "}
          <Num k="rmp_event_band_min_pct" /> to{" "}
          <Num k="rmp_event_band_max_pct" /> band.
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

function Trace({
  title,
  result,
  slot,
}: {
  title: string;
  result: CrashResult | null;
  slot: string;
}) {
  return (
    <article className="panel" data-slot={slot}>
      <h3>{title}</h3>
      <svg
        className="trace"
        viewBox="0 0 320 120"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${title} call trace`}
      >
        <polyline
          fill="none"
          stroke="var(--jam)"
          strokeWidth={3}
          points={result ? tracePoints(result) : ""}
        />
      </svg>
      {result ? (
        <p className="muted">
          Delivered <Live value={result.delivered_pct} unit="%" digits={0} />.
          Spin <Live value={result.spin_kwh} unit="kWh" digits={1} />. Pulse{" "}
          <Live value={result.pulse_kwh} unit="kWh" digits={1} />.
        </p>
      ) : (
        <p className="unavailable">No call yet. {COPY.emptyNotZero}</p>
      )}
    </article>
  );
}

/** Drawing only: every fifth second of Spin kW, scaled to the trace's own peak. */
function tracePoints(result: CrashResult): string {
  const rows = result.trace.filter((row) => row.t_s % 5 === 0);
  const maxT = rows[rows.length - 1]?.t_s || 1;
  const maxKw = Math.max(
    ...rows.map((r) =>
      Math.max(r.requested_kw, Math.abs(r.spin_kw), Math.abs(r.pulse_kw)),
    ),
    1,
  );
  return rows
    .map(
      (r) =>
        `${8 + (r.t_s / maxT) * 300},${100 - (Math.abs(r.spin_kw) / maxKw) * 80}`,
    )
    .join(" ");
}
