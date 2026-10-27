import type { CrashResult, Provenance, StageNumber } from "@contracts/types";
import { Inline } from "../Provenance";
import type { StageModel } from "../engineClient";

export function CrashBeat({
  stage,
  result,
  ghost,
  second,
  heatmap,
}: {
  stage: StageModel;
  result: CrashResult | null;
  ghost: CrashResult | null;
  second: CrashResult | null;
  heatmap: "mt" | "utc";
}) {
  const shown = second ?? result;
  const counts = heatmap === "mt" ? stage.heatmapMt : stage.heatmapUtc;
  const max = Math.max(...counts, 1);
  return (
    <section className="beat" aria-labelledby="beat-crash">
      <h2 id="beat-crash">The call</h2>
      <div className="banner reserved">
        {shown ? (
          <p>
            Rocky Mountain Power call:{" "}
            <Inline n={stage.number("enrolled_kw")} /> kW now. Simulated. About
            five and a half minutes.
          </p>
        ) : (
          <p>
            Press C during the day to drop a Rocky Mountain Power call. This
            space stays put either way.
          </p>
        )}
      </div>
      <div className="race">
        <Trace title="Simulated Torus-style station" result={shown} />
        <Trace title="Battery-only plan" result={ghost} />
      </div>
      {second ? (
        <p>
          Second press inside the refill window. Shortfall{" "}
          <Inline n={tagged(second.shortfall_kwh, "kWh", 1)} />.
        </p>
      ) : null}
      <article className="card">
        <h3>Published 2025 record, separate from this simulation</h3>
        <p>
          <Inline n={stage.number("events_2025")} /> events. Ramp{" "}
          <Inline n={stage.number("ramp_s")} /> s against a{" "}
          <Inline n={stage.number("ramp_target_s")} /> s target. Delivered{" "}
          <Inline n={stage.number("delivered_pct")} />% against a{" "}
          <Inline n={stage.number("delivered_band_lo")} /> to{" "}
          <Inline n={stage.number("delivered_band_hi")} />% band.
        </p>
        <p className="muted">
          {heatmap === "mt"
            ? "Reading the 2025 heatmap as Mountain time. The source states no time zone."
            : "Reading the 2025 heatmap as UTC, drawn on a Mountain axis (UTC-6). That shift is our assumption."}
        </p>
        <div className="bar-row" aria-hidden="true">
          {counts.map((count, hour) => (
            <i
              key={hour}
              className="lane-shoulder"
              style={{ height: `${(count / max) * 100}%` }}
            />
          ))}
        </div>
      </article>
    </section>
  );
}

function Trace({
  title,
  result,
}: {
  title: string;
  result: CrashResult | null;
}) {
  const points = result ? downsample(result) : "";
  return (
    <article className="panel">
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
          strokeWidth={2}
          points={points}
        />
      </svg>
      {result ? (
        <p className="muted">
          Delivered <Inline n={tagged(result.delivered_pct, "%", 0)} />. Spin{" "}
          <Inline n={tagged(result.spin_kwh, "kWh", 1)} />. Pulse{" "}
          <Inline n={tagged(result.pulse_kwh, "kWh", 1)} />.
        </p>
      ) : (
        <p className="unavailable">No call yet. Empty, not zero.</p>
      )}
    </article>
  );
}

function tagged(value: number, unit: string, digits: number): StageNumber {
  return {
    key: "crash_trace",
    value,
    unit,
    display:
      unit === "%"
        ? `${value.toFixed(digits)}%`
        : `${value.toFixed(digits)} ${unit}`,
    prov: "SIMULATED" satisfies Provenance,
    source: "app/src/stub/crash.ts",
    as_of_mt: "2026-10-27",
  };
}

function downsample(result: CrashResult): string {
  const rows = result.trace.filter((row) => row.t_s % 5 === 0);
  const last = rows[rows.length - 1];
  const maxT = last?.t_s || 1;
  const maxKw = Math.max(
    ...rows.map((row) =>
      Math.max(row.requested_kw, Math.abs(row.spin_kw), Math.abs(row.pulse_kw)),
    ),
    1,
  );
  return rows
    .map((row) => {
      const x = 8 + (row.t_s / maxT) * 300;
      const y = 100 - (Math.abs(row.spin_kw) / maxKw) * 80;
      return `${x},${y}`;
    })
    .join(" ");
}
