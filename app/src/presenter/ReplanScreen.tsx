import type { Plan } from "@contracts/types";
import type { CallState, Live } from "../beats/types";
import { Num } from "../components/Num";
import { hourLabel, mtClock } from "../components/Time";
import { COPY, PRESENTER } from "../copy";
import { grouped } from "../format";
import { animAttr } from "./motion";

// Drawing geometry only.
const X0 = 60;
const W = 880;
const TOP = 34;
const H = 170;

/**
 * Screen 5 (#270): the MEASURED re-plan time is the hero; the chart names its axis, the call
 * and the point where the re-plan leaves the morning plan. solve_ms is never cached or typed.
 */
export function ReplanScreen({
  live,
  call,
  hour,
  resumed,
}: {
  live: Live;
  call: CallState;
  hour: number;
  /** Resume has been pressed: the ring at the take-over point pulses as it mounts. */
  resumed?: boolean;
}) {
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
  const leave = replan?.intervals[callIdx];
  const callRight = callIdx > 60;

  return (
    <section
      className="beat p-replan"
      aria-label={COPY.replanTitle}
      data-anim={animAttr()}
    >
      <div className="p-replan-hero" data-slot="replan-line">
        {replan ? (
          <p>
            <span className="p-replan-lead">{PRESENTER.replanHero}</span>{" "}
            <span className="p-replan-ms">
              <Num
                value={replan.solve_ms}
                display={`${grouped(replan.solve_ms, 1)} ms`}
                prov="MEASURED"
                source="performance.now inside the engine solve, this laptop"
                width={9}
              />
            </span>{" "}
            <span className="p-replan-tail">{PRESENTER.replanHeroTail}</span>
          </p>
        ) : (
          <p className="unavailable">
            {COPY.replanEmpty} {COPY.emptyNotZero}
          </p>
        )}
      </div>
      <div className="p-replan-key">
        <span>
          <i className="p-key is-planned" aria-hidden="true" />
          {PRESENTER.replanKeyPlanned}
        </span>
        <span>
          <i className="p-key is-replanned" aria-hidden="true" />
          {PRESENTER.replanKeyReplanned}
        </span>
      </div>
      <svg
        className="chart p-replan-chart"
        viewBox="0 0 960 250"
        role="img"
        aria-label={COPY.replanAria}
        data-slot="replan-chart"
      >
        <text
          x={X0 - 40}
          y={TOP + H / 2}
          className="p-replan-axis"
          transform={`rotate(-90 ${X0 - 40} ${TOP + H / 2})`}
          textAnchor="middle"
        >
          {PRESENTER.replanAxis}
        </text>
        <line
          x1={X0}
          x2={X0 + W}
          y1={TOP + H}
          y2={TOP + H}
          className="p-call-base"
        />
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
            strokeWidth={5}
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
        <text
          x={x(callIdx) + (callRight ? -10 : 10)}
          y={TOP - 10}
          textAnchor={callRight ? "end" : "start"}
          className="p-replan-callmark"
        >
          {PRESENTER.replanCallMark}{" "}
          <tspan data-time="">{mtClock(live.calls.first.start_utc)}</tspan>
        </text>
        {replan && leave ? (
          <g data-slot="replan-leave">
            {resumed ? (
              <circle
                className="p-replan-ring"
                cx={x(callIdx)}
                cy={y(leave.pulse_soc_kwh)}
                r={8}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={3}
              />
            ) : null}
            <circle
              cx={x(callIdx)}
              cy={y(leave.pulse_soc_kwh)}
              r={8}
              fill="var(--accent)"
              stroke="var(--bg)"
              strokeWidth={3}
            />
            <text
              x={x(callIdx) + (callRight ? -16 : 16)}
              y={y(leave.pulse_soc_kwh) + 32}
              textAnchor={callRight ? "end" : "start"}
              className="p-replan-note"
            >
              {PRESENTER.replanTakesOver}
            </text>
          </g>
        ) : null}
        {[0, 6, 12, 18].map((h) => (
          <text
            key={h}
            x={x(h * 4)}
            y={TOP + H + 32}
            className="p-replan-tick"
            data-axis=""
          >
            {hourLabel(live.bundle.hours[h]?.hour_mt ?? h)}
          </text>
        ))}
      </svg>
      <p className="p-replan-cycles" data-slot="replan-cycles" data-detail="">
        {PRESENTER.replanCycles}{" "}
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
        . {PRESENTER.replanCyclesBudget}{" "}
        <Num k="pulse_cycle_budget" width={4} /> {PRESENTER.replanCyclesTail}.
      </p>
    </section>
  );
}
