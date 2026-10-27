import type { Plan } from "@contracts/types";
import { Num } from "../components/Num";
import { hourLabel } from "../components/Time";
import { COPY } from "../copy";
import type { BeatProps } from "./types";

/**
 * Beat 2 (core 5 only starts here). The end cards read only the reference set:
 * fixed_usd_mw_day, clearlane_usd_mw_day, race_ratio, fixed_70, clearlane_70,
 * fixed_rule_charge_usd_mwh and timetable_charge_usd_mwh. CO2, the MOU size and the cycle
 * lines sit on other beats.
 */
export function Race({ live, hour }: BeatProps) {
  const done = hour >= 24;
  return (
    <section className="beat" aria-labelledby="beat-race">
      <h2 id="beat-race">The race</h2>
      <p className="muted">
        <span data-slot="race-clock" className="slot-clock">
          {done ? (
            "End of the day."
          ) : (
            <span data-time="">
              {hourLabel(Math.min(23, Math.floor(hour)))}
            </span>
          )}
        </span>{" "}
        Space plays the day. The left station is our baseline, not Torus
        practice.
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
          plan={live.plans.clearlane}
          title={COPY.clearlaneLabel}
          hour={hour}
          spin
          live={live}
        />
      </div>
      <div className="cards" data-slot="race-end-cards">
        {done ? (
          <>
            <article className="card">
              <h3>{COPY.fixedLabel}</h3>
              <Num k="fixed_usd_mw_day" width={8} />
              <p className="muted">per MW-day</p>
              <Num k="fixed_70" width={8} />
              <p>per day at the MOU size, {COPY.valueToSystem}.</p>
              <p>
                Charges at <Num k="fixed_rule_charge_usd_mwh" /> per MWh.
              </p>
            </article>
            <article className="card">
              <h3>{COPY.clearlaneLabel}</h3>
              <Num k="clearlane_usd_mw_day" width={8} />
              <p className="muted">per MW-day</p>
              <Num k="clearlane_70" width={8} />
              <p>per day at the MOU size, {COPY.valueToSystem}.</p>
              <p>
                Charges at <Num k="timetable_charge_usd_mwh" /> per MWh.{" "}
                <Num k="race_ratio" /> the off-peak rule.
              </p>
            </article>
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
      <Meter plan={plan} hour={hour} ceiling={live.site.host_ceiling_kw} />
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
  const peak = Math.max(ceiling, ...shown.map((r) => r.meter_kw), 1);
  const points = shown
    .map((r) => `${(r.i / 95) * 280 + 8},${78 - (r.meter_kw / peak) * 64}`)
    .join(" ");
  const yCeiling = 78 - (ceiling / peak) * 64;
  return (
    <>
      <p className="muted">Host meter, in kW. The dashed line is the ceiling.</p>
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
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
          points={points}
        />
      </svg>
    </>
  );
}
