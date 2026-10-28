import type { HourSignal, Lane } from "@contracts/types";
import { Num } from "../components/Num";
import { hourLabel } from "../components/Time";
import { COPY } from "../copy";
import type { BeatProps } from "./types";

export const LANE_WORD: Record<Lane, string> = {
  clear: "Clear",
  shoulder: "Shoulder",
  jam: "Jam",
};

/**
 * The hours (Mountain, hour beginning) engine/src/numbers.ts stepHourDays counts for
 * oct_step_hour_days_at_5_or_6, its default. Ribbon.test.tsx recounts the key's history file with
 * them, so the caption names the hours the number was counted in.
 */
export const STEP_HOURS = [17, 18];
/** "5pm or 6pm": the hour labels joined as alternatives by the locale. */
const STEP_HOURS_LABEL = new Intl.ListFormat("en-US", {
  type: "disjunction",
}).format(STEP_HOURS.map(hourLabel));

// Chart geometry (viewBox units, not data).
const X0 = 56;
const CELL = 36;
const BAR_W = 31;
const BAR_TOP = 10;
const BAR_BASE = 126;
const STRIP_Y = 132;
const STRIP_H = 58;
const TICK_Y = 208;

/**
 * Beat 1: the day as a road. Lanes come from the engine through engineClient (live.day.lanes),
 * never from typed hours. Every hour cell carries its lane word, so color is never the only
 * signal. Hour 0 is drawn as the bundle has it (see bundle.notes); hours are never reordered.
 */
export function Ribbon({ live }: BeatProps) {
  const hours = live.bundle.hours;
  // Chart scaling only: each series is drawn against its own peak. No value is shown from this.
  const maxPrice = Math.max(...hours.map((h) => h.lmp_usd_mwh), 1);
  const maxSolar = Math.max(...hours.map((h) => h.solar_fcst_mw), 1);
  const maxNet = Math.max(...hours.map((h) => h.net_load_mw), 1);
  const barH = BAR_BASE - BAR_TOP;
  const solarPts = linePoints(hours, (h) => h.solar_fcst_mw / maxSolar);
  const firstX = X0 + BAR_W / 2;
  const lastX = X0 + (hours.length - 1) * CELL + BAR_W / 2;

  return (
    <section className="beat" aria-labelledby="beat-ribbon">
      <h2 id="beat-ribbon">{COPY.ribbonTitle}</h2>
      <p className="muted">{COPY.ribbonSubtitle}</p>
      <svg
        className="chart"
        viewBox="0 0 960 230"
        role="img"
        aria-label={COPY.ribbonAria}
        data-slot="ribbon-chart"
      >
        {hours.map((hour, index) => {
          const lane = live.day.lanes[index] ?? "shoulder";
          const x = X0 + index * CELL;
          const h = (hour.lmp_usd_mwh / maxPrice) * barH;
          const cx = x + BAR_W / 2;
          const wy = STRIP_Y + STRIP_H - 6;
          return (
            <g key={hour.ts_utc} data-lane={lane}>
              <rect
                x={x}
                y={BAR_BASE - h}
                width={BAR_W}
                height={h}
                fill={`var(--${lane})`}
                rx={2}
              />
              <rect
                x={x}
                y={STRIP_Y}
                width={BAR_W}
                height={STRIP_H}
                fill={`var(--${lane})`}
                opacity={0.35}
                rx={2}
              />
              <text
                className="lane-word"
                x={cx}
                y={wy}
                transform={`rotate(-90 ${cx} ${wy})`}
                fill="var(--ink)"
                fontSize={13}
                dominantBaseline="middle"
              >
                {LANE_WORD[lane]}
              </text>
              {index % 3 === 0 ? (
                <text
                  x={cx}
                  y={TICK_Y}
                  fill="var(--muted)"
                  fontSize={14}
                  textAnchor="middle"
                  data-axis=""
                >
                  {hourLabel(hour.hour_mt)}
                </text>
              ) : null}
            </g>
          );
        })}
        <polygon
          fill="var(--solar)"
          opacity={0.25}
          points={`${firstX},${BAR_BASE} ${solarPts} ${lastX},${BAR_BASE}`}
        />
        <polyline
          fill="none"
          stroke="var(--solar)"
          strokeWidth={3}
          points={solarPts}
        />
        <polyline
          fill="none"
          stroke="var(--ink)"
          strokeWidth={4}
          points={linePoints(hours, (h) => h.net_load_mw / maxNet)}
        />
        <text x={X0} y={226} fill="var(--muted)" fontSize={14}>
          {COPY.axisCaption}
        </text>
      </svg>
      <div className="legend">
        <span>{COPY.ribbonLegendBars}</span>
        <span>{COPY.ribbonLegendSolar}</span>
        <span>{COPY.ribbonLegendNet}</span>
      </div>
      <p className="ribbon-caption" data-slot="ribbon-caption">
        {COPY.ribbonPeak1} <Num k="peak_over_trough" /> {COPY.ribbonPeak2}{" "}
        <Num k="peak_hour_mt" /> ({COPY.ribbonFrom} <Num k="price_min_oct27" />{" "}
        {COPY.ribbonTo} <Num k="peak_price" />
        ). {COPY.ribbonNet} <Num k="net_load_climb_mw" /> {COPY.ribbonMw}{" "}
        {COPY.ribbonSolar} <Num k="solar_4pm_to_6pm_mw_4pm" /> {COPY.ribbonTo}{" "}
        <Num k="solar_4pm_to_6pm_mw_6pm" /> {COPY.ribbonMw}.
      </p>
      <p className="ribbon-caption" data-slot="ribbon-lanes">
        {COPY.ribbonLanes1} <Num k="lane_clear_max_usd" />
        {COPY.ribbonLanes2} <Num k="lane_jam_min_usd" />
        {COPY.ribbonLanes3} <span data-time="">{STEP_HOURS_LABEL}</span>{" "}
        {COPY.ribbonOn} <Num k="oct_step_hour_days_at_5_or_6" /> {COPY.ribbonOf}{" "}
        <Num k="oct_step_hour_days_total" /> {COPY.ribbonStep}
      </p>
    </section>
  );
}

function linePoints(
  hours: HourSignal[],
  scale: (hour: HourSignal) => number,
): string {
  return hours
    .map(
      (_hour, index) =>
        `${X0 + index * CELL + BAR_W / 2},${BAR_BASE - scale(hours[index]!) * (BAR_BASE - BAR_TOP)}`,
    )
    .join(" ");
}
