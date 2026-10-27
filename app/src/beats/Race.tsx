import type { Plan } from "@contracts/types";
import { Num, useNumber } from "../components/Num";
import { hourLabel } from "../components/Time";
import { COPY } from "../copy";
import { scaleUsdPerDay } from "../engineClient";
import { grouped, usdDay } from "../format";
import type { BeatProps } from "./types";

const ENGINE_SRC = "engine solve (live, this laptop)";

/**
 * Beat 2: the race. Both plans were solved through engineClient before Space is pressed (App
 * builds live.plans on load). The animation plays the live engine plans, so the Clearlane card
 * reads the engine DP's own key (clearlane_dp_usd_mw_day, dp_race_ratio) and its $/day at the
 * MOU size comes from the engine's linear fleet scaling of the live plan: one card never mixes
 * the reference timetable with the DP.
 */
export function Race({ live, hour }: BeatProps) {
  const done = hour >= 24;
  const mou = useNumber("mou_70mw");
  const clear = live.plans.clearlane;
  const clear70 =
    mou !== undefined
      ? scaleUsdPerDay(clear.value_usd_per_mw_day, mou.value)
      : null;
  return (
    <section className="beat" aria-labelledby="beat-race">
      <h2 id="beat-race">{COPY.raceTitle}</h2>
      <p className="muted">
        <span data-slot="race-clock" className="slot-clock">
          {done ? (
            COPY.raceEnd
          ) : (
            <span data-time="">
              {hourLabel(Math.min(23, Math.floor(hour)))}
            </span>
          )}
        </span>{" "}
        {COPY.raceHint}
      </p>
      <div className="race">
        <Station
          plan={live.plans.fixed_overnight}
          title={COPY.fixedLabel}
          hour={hour}
          spin={false}
          live={live}
        />
        <Station
          plan={clear}
          title={COPY.clearlaneLabel}
          hour={hour}
          spin
          live={live}
        />
      </div>
      <div className="cards" data-slot="race-end-cards">
        {done ? (
          <>
            <article className="card" data-card="fixed_overnight">
              <h3>{COPY.fixedLabel}</h3>
              <Num k="fixed_usd_mw_day" width={8} />
              <p className="muted">{COPY.perMwDay}</p>
              <Num k="fixed_70" width={8} />
              <p>
                {COPY.perDayAtMou}, {COPY.valueToSystem}.
              </p>
              <p>
                <Num k="co2_added_70" width={6} /> {COPY.co2AddedAt70}
              </p>
            </article>
            <article className="card" data-card="clearlane">
              <h3>{COPY.clearlaneLabel}</h3>
              <Num k="clearlane_dp_usd_mw_day" width={8} />
              <p className="muted">
                {COPY.perMwDay}, <Num k="dp_race_ratio" width={5} />{" "}
                {COPY.raceRatioTail}
              </p>
              <Num
                value={clear70}
                display={clear70 === null ? "" : usdDay(clear70)}
                prov="DERIVED"
                source={`${ENGINE_SRC}, scaled to mou_70mw`}
                reason={COPY.notComputed}
                width={8}
              />
              <p>
                {COPY.perDayAtMou}, {COPY.valueToSystem}.
              </p>
              <p>
                <Num k="co2_avoided_70" width={6} /> {COPY.co2AvoidedAt70}
              </p>
            </article>
            <p className="muted card-note">{COPY.co2Caveat}</p>
          </>
        ) : (
          <p className="muted">{COPY.raceCardsPending}</p>
        )}
      </div>
    </section>
  );
}

function Station({
  plan,
  title,
  hour,
  spin,
  live,
}: {
  plan: Plan;
  title: string;
  hour: number;
  spin: boolean;
  live: BeatProps["live"];
}) {
  const index = Math.min(95, Math.floor(hour * 4));
  const row = plan.intervals[index];
  // Bar widths only (a share of capacity); no value is printed from them.
  const pulsePct = row
    ? Math.min(100, (row.pulse_soc_kwh / live.site.station.pulse_kwh) * 100)
    : 0;
  const spinPct =
    !spin || !row
      ? 0
      : Math.min(100, (row.spin_soc_kwh / live.site.station.spin_kwh) * 100);
  return (
    <article className="panel" data-policy={plan.policy}>
      <h3>
        {title}:{" "}
        <span className="muted">{spin ? COPY.spinHeld : COPY.noSpin}</span>
      </h3>
      <p className="meter-row">
        {COPY.spinWord}
        <span className="meter" aria-hidden="true">
          <b style={{ width: `${spinPct}%` }} />
        </span>
      </p>
      <p className="meter-row">
        {COPY.pulseWord}
        <span className="meter" aria-hidden="true">
          <b style={{ width: `${pulsePct}%` }} />
        </span>
      </p>
      <Meter plan={plan} hour={hour} ceiling={live.site.host_ceiling_kw} />
      <p data-slot={`cycles-${plan.policy}`}>
        {COPY.cyclesToday}{" "}
        <Num
          value={plan.pulse_cycles}
          display={grouped(plan.pulse_cycles, 2)}
          prov="DERIVED"
          source={ENGINE_SRC}
          width={5}
        />
        {COPY.cyclesBudget} <Num k="pulse_cycle_budget" width={5} />{" "}
        {COPY.cyclesBudgetTail}
      </p>
    </article>
  );
}

function Meter({
  plan,
  hour,
  ceiling,
}: {
  plan: Plan;
  hour: number;
  ceiling: number;
}) {
  const last = Math.min(95, Math.floor(hour * 4));
  const shown = plan.intervals.slice(0, last + 1);
  // Chart scale only: the axis tops out at the larger of the ceiling and the day's peak.
  const peak = Math.max(ceiling, ...plan.intervals.map((r) => r.meter_kw), 1);
  const points = shown
    .map((r) => `${(r.i / 95) * 280 + 8},${78 - (r.meter_kw / peak) * 64}`)
    .join(" ");
  const yCeiling = 78 - (ceiling / peak) * 64;
  return (
    <>
      <p className="muted">
        {COPY.meterCaption}{" "}
        <Num
          value={plan.host_peak_kw}
          display={`${grouped(plan.host_peak_kw, 0)} kW`}
          prov="SIMULATED"
          source={ENGINE_SRC}
          width={9}
        />{" "}
        {COPY.meterCeiling}{" "}
        <Num
          value={ceiling}
          display={`${grouped(ceiling, 0)} kW`}
          prov="SIMULATED"
          source="engine defaultSite (simulated host)"
          width={9}
        />
      </p>
      <svg
        className="trace"
        viewBox="0 0 300 90"
        preserveAspectRatio="none"
        role="img"
        aria-label={COPY.meterAria}
      >
        <line
          x1={8}
          x2={292}
          y1={yCeiling}
          y2={yCeiling}
          stroke="var(--jam)"
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
          strokeDasharray="6 4"
        />
        <polyline
          fill="none"
          stroke="var(--accent)"
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
          points={points}
        />
      </svg>
    </>
  );
}
