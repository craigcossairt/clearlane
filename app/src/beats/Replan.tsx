import type { Plan } from "@contracts/types";
import { Num } from "../components/Num";
import { hourLabel } from "../components/Time";
import { COPY, PRESENTER } from "../copy";
import { grouped } from "../format";
import type { BeatProps } from "./types";

// Drawing geometry only.
const X0 = 40;
const W = 880;
const TOP = 12;
const H = 150;

/**
 * Beat 4: the rest of the day re-solved from the station's actual state after the call.
 * solve_ms is MEASURED live by the engine and never cached, stored or typed; its slot is
 * reserved before the re-plan exists.
 */
export function Replan({ live, call, hour, presenter }: BeatProps) {
  const result = call.second ?? call.first;
  const plan = live.plans.clearlane;
  const replan = result?.replan ?? null;
  const callIdx = Math.max(
    0,
    Math.min(
      95,
      Math.floor(
        ((Date.parse(live.calls.first.start_utc) -
          Date.parse(live.bundle.hours[0]!.ts_utc)) /
          3_600_000) *
          4,
      ),
    ),
  );
  const cap = Math.max(live.site.station.pulse_kwh, 1);
  const playIdx = hour >= 24 || hour === 0 ? 95 : Math.floor(hour * 4);
  const x = (i: number) => X0 + (i / 95) * W;
  const y = (kwh: number) => TOP + H - (kwh / cap) * H;
  const pts = (p: Plan, from: number, to: number) =>
    p.intervals
      .slice(from, to + 1)
      .map((r) => `${x(r.i)},${y(r.pulse_soc_kwh)}`)
      .join(" ");

  return (
    <section className="beat" aria-labelledby="beat-replan">
      <h2 id="beat-replan">{COPY.replanTitle}</h2>
      <div className="card" data-slot="replan-line">
        {replan ? (
          <p>
            {COPY.replannedIn}{" "}
            <Num
              value={replan.solve_ms}
              display={`${grouped(replan.solve_ms, 1)} ms`}
              prov="MEASURED"
              source="performance.now inside the engine solve, this laptop"
              width={9}
            />
            . <span className="muted">{COPY.replanNote}</span>
          </p>
        ) : (
          <p className="unavailable">
            {COPY.replanEmpty} {COPY.emptyNotZero}
          </p>
        )}
      </div>
      <svg
        className="chart"
        viewBox="0 0 960 200"
        role="img"
        aria-label={COPY.replanAria}
        data-slot="replan-chart"
      >
        <polyline
          data-series="planned"
          fill="none"
          stroke="var(--muted)"
          strokeWidth={3}
          strokeDasharray="6 4"
          points={pts(plan, 0, 95)}
        />
        {replan ? (
          <polyline
            data-series="replanned"
            fill="none"
            stroke="var(--accent)"
            strokeWidth={4}
            points={pts(replan, callIdx, Math.max(callIdx, playIdx))}
          />
        ) : null}
        <line
          x1={x(callIdx)}
          x2={x(callIdx)}
          y1={TOP}
          y2={TOP + H}
          stroke="var(--jam)"
          strokeWidth={3}
        />
        {[0, 6, 12, 18].map((h) => (
          <text
            key={h}
            x={x(h * 4)}
            y={TOP + H + 26}
            fill="var(--muted)"
            fontSize={14}
            data-axis=""
          >
            {hourLabel(live.bundle.hours[h]?.hour_mt ?? h)}
          </text>
        ))}
      </svg>
      <p className="muted">
        {presenter ? PRESENTER.replanLegend : COPY.replanLegend}
      </p>
      <p data-slot="replan-cycles">
        {COPY.cyclesToday}{" "}
        {replan ? (
          <Num
            value={replan.pulse_cycles}
            display={grouped(replan.pulse_cycles, 2)}
            prov="DERIVED"
            source="engine re-plan (live, this laptop)"
            width={5}
          />
        ) : (
          <Num k="cycles_today" width={5} />
        )}
        {COPY.cyclesBudget} <Num k="pulse_cycle_budget" width={5} />{" "}
        {COPY.cyclesBudgetTail}
      </p>
    </section>
  );
}
