import type { Plan } from "@contracts/types";
import { clock } from "../format";
import { Inline, Num } from "../Provenance";
import type { StageModel } from "../engineClient";

export function Race({ stage, hour }: { stage: StageModel; hour: number }) {
  const done = hour >= 24;
  const left = stage.plans.fixed_overnight;
  const right = stage.plans.clearlane;
  return (
    <section className="beat" aria-labelledby="beat-race">
      <h2 id="beat-race">The race</h2>
      <p className="muted">
        {done
          ? "End of the day."
          : `Hour ${clock(Math.min(23, Math.floor(hour)))}.`}{" "}
        Space plays the day. The left station is our baseline, not Torus
        practice.
      </p>
      <div className="race">
        <Station
          plan={left}
          title="Battery on the off-peak rule"
          hour={hour}
          spin={false}
          stage={stage}
        />
        <Station
          plan={right}
          title="Simulated Torus-style station on Clearlane"
          hour={hour}
          spin
          stage={stage}
        />
      </div>
      <div className="cards reserved">
        {done ? (
          <>
            <EndCard
              stage={stage}
              title="Fixed off-peak rule"
              perMw="fixed_usd_mw_day"
              day="fixed_70"
              co2="co2_added_70"
              co2Words="added"
            />
            <EndCard
              stage={stage}
              title="Clearlane timetable"
              perMw="clearlane_usd_mw_day"
              day="clearlane_70"
              co2="co2_avoided_70"
              co2Words="avoided"
            />
          </>
        ) : (
          <p className="muted">
            End cards stay in this space and fill in when the day finishes.
          </p>
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
  stage,
}: {
  plan: Plan;
  title: string;
  hour: number;
  spin: boolean;
  stage: StageModel;
}) {
  const index = Math.min(95, Math.floor(hour * 4));
  const row = plan.intervals[index];
  const pulseCap = stage.site.station.pulse_kwh;
  const spinCap = stage.site.station.spin_kwh;
  const pulsePct = row
    ? Math.min(100, (row.pulse_soc_kwh / pulseCap) * 100)
    : 0;
  const spinPct =
    !spin || !row ? 0 : Math.min(100, (row.spin_soc_kwh / spinCap) * 100);
  const today = stage.number("cycles_today");
  const budget = stage.number("cycle_budget_day");
  return (
    <article className="panel">
      <h3>{title}</h3>
      <p className="muted">
        {spin ? "Spin held for calls" : "No Spin on this baseline"}
      </p>
      <p>
        Spin
        <span className="meter" aria-hidden="true">
          <b style={{ width: `${spinPct}%` }} />
        </span>
      </p>
      <p>
        Pulse
        <span className="meter" aria-hidden="true">
          <b style={{ width: `${pulsePct}%` }} />
        </span>
      </p>
      <Meter plan={plan} hour={hour} ceiling={stage.site.host_ceiling_kw} />
      <p>
        Today <Inline n={today} /> cycles, against a day budget of{" "}
        <Inline n={budget} />.
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
  const peak = Math.max(ceiling, ...shown.map((row) => row.meter_kw), 1);
  const points = shown
    .map((row) => {
      const x = (row.i / 95) * 280 + 8;
      const y = 78 - (row.meter_kw / peak) * 64;
      return `${x},${y}`;
    })
    .join(" ");
  const yCeiling = 78 - (ceiling / peak) * 64;
  return (
    <>
      <p className="muted">Host meter. The dashed line is the ceiling.</p>
      <svg
        className="trace"
        viewBox="0 0 300 90"
        preserveAspectRatio="none"
        role="img"
        aria-label="Host meter against its ceiling"
      >
        <line
          x1={8}
          x2={292}
          y1={yCeiling}
          y2={yCeiling}
          stroke="var(--jam)"
          strokeDasharray="4 3"
        />
        <polyline
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          points={points}
        />
      </svg>
    </>
  );
}

function EndCard({
  stage,
  title,
  perMw,
  day,
  co2,
  co2Words,
}: {
  stage: StageModel;
  title: string;
  perMw: string;
  day: string;
  co2: string;
  co2Words: string;
}) {
  const mou = stage.number("mou_mw");
  return (
    <article className="card">
      <h3>{title}</h3>
      <Num n={stage.number(perMw)} />
      <p className="muted">per MW-day</p>
      <Num n={stage.number(day)} />
      <p>
        per day at <Inline n={mou} /> MW, value to RMP&apos;s system at
        day-ahead prices.
      </p>
      <p>
        <Inline n={stage.number(co2)} /> t/day {co2Words}. Average-emissions
        estimate (EIA hourly); marginal emissions can differ.
      </p>
    </article>
  );
}
