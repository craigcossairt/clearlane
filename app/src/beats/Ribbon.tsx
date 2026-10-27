import type { HourSignal, Lane } from "@contracts/types";
import { Num } from "../components/Num";
import { hourLabel } from "../components/Time";
import { COPY } from "../copy";
import type { BeatProps } from "./types";

const LANE_WORD: Record<Lane, string> = {
  clear: "Clear",
  shoulder: "Shoulder",
  jam: "Jam",
};

/** Beat 1 (core 4 only starts here): the day as a road, lanes from the engine. */
export function Ribbon({ live }: BeatProps) {
  const hours = live.bundle.hours;
  // Chart scaling only: each series is drawn against its own peak. No value is shown from this.
  const maxPrice = Math.max(...hours.map((h) => h.lmp_usd_mwh), 1);
  const maxSolar = Math.max(...hours.map((h) => h.solar_fcst_mw), 1);
  const maxNet = Math.max(...hours.map((h) => h.net_load_mw), 1);

  return (
    <section className="beat" aria-labelledby="beat-ribbon">
      <h2 id="beat-ribbon">Traffic report</h2>
      <p className="muted">
        Day-ahead price for PacifiCorp East, {COPY.axisCaption}.
      </p>
      <svg
        className="chart"
        viewBox="0 0 960 280"
        role="img"
        aria-label="Twenty-four hours colored by lane, with solar and net load"
      >
        {hours.map((hour, index) => {
          const lane = live.day.lanes[index] ?? "shoulder";
          const x = 48 + index * 37;
          const h = (hour.lmp_usd_mwh / maxPrice) * 180;
          return (
            <g key={hour.ts_utc}>
              <rect
                x={x}
                y={210 - h}
                width={32}
                height={h}
                fill={`var(--${lane})`}
                rx={2}
              >
                <title>{LANE_WORD[lane]}</title>
              </rect>
              {index % 6 === 0 ? (
                <text
                  x={x}
                  y={236}
                  fill="var(--muted)"
                  fontSize={14}
                  data-axis=""
                >
                  {hourLabel(hour.hour_mt)}
                </text>
              ) : null}
            </g>
          );
        })}
        <polyline
          fill="none"
          stroke="var(--solar)"
          strokeWidth={3}
          points={linePoints(hours, (h) => h.solar_fcst_mw / maxSolar)}
        />
        <polyline
          fill="none"
          stroke="var(--ink)"
          strokeWidth={3}
          points={linePoints(hours, (h) => h.net_load_mw / maxNet)}
        />
        <text x={48} y={266} fill="var(--muted)" fontSize={14}>
          {COPY.axisCaption}
        </text>
      </svg>
      <div className="legend">
        <span>
          <i className="swatch lane-clear" /> {LANE_WORD.clear}
        </span>
        <span>
          <i className="swatch lane-shoulder" /> {LANE_WORD.shoulder}
        </span>
        <span>
          <i className="swatch lane-jam" /> {LANE_WORD.jam}
        </span>
        <span>Gold line: solar forecast, scaled to its own peak</span>
        <span>Ink line: net load, scaled to its own peak</span>
      </div>
      <p>
        Net load climbs <Num k="net_load_climb_mw" /> by the evening step. The
        peak price <Num k="peak_price" /> is <Num k="peak_over_trough" /> the
        low <Num k="price_min_oct27" />. The solar forecast falls from{" "}
        <Num k="solar_4pm_to_6pm_mw_4pm" /> to{" "}
        <Num k="solar_4pm_to_6pm_mw_6pm" />.
      </p>
    </section>
  );
}

function linePoints(
  hours: HourSignal[],
  scale: (hour: HourSignal) => number,
): string {
  return hours
    .map((hour, index) => `${48 + index * 37 + 16},${210 - scale(hour) * 180}`)
    .join(" ");
}
