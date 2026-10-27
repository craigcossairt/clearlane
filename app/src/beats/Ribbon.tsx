import type { HourSignal, Lane } from "@contracts/types";
import { clock } from "../format";
import { Inline } from "../Provenance";
import type { StageModel } from "../engineClient";

function laneClass(lane: Lane): string {
  if (lane === "clear") return "lane-clear";
  if (lane === "jam") return "lane-jam";
  return "lane-shoulder";
}

export function Ribbon({ stage }: { stage: StageModel }) {
  const hours = stage.bundle.hours;
  const maxPrice = Math.max(...hours.map((hour) => hour.lmp_usd_mwh));
  const maxSolar = Math.max(...hours.map((hour) => hour.solar_fcst_mw), 1);
  const maxNet = Math.max(...hours.map((hour) => hour.net_load_mw), 1);
  const climb = stage.number("net_load_climb_mw");
  const ratio = stage.number("peak_over_trough");
  const solar4 = stage.number("solar_4pm_mw");
  const solar6 = stage.number("solar_6pm_mw");

  return (
    <section className="beat" aria-labelledby="beat-ribbon">
      <h2 id="beat-ribbon">Traffic report</h2>
      <p className="muted">
        Day-ahead price for PacifiCorp East, hour beginning, Mountain time. Lane
        color is paired with a pattern.
      </p>
      <svg
        className="chart"
        viewBox="0 0 960 280"
        role="img"
        aria-label="Twenty-four hours colored by lane, with solar and net load"
      >
        <PatternDefs />
        {hours.map((hour, index) => {
          const lane = stage.lanes[hour.hour_mt] ?? "shoulder";
          const x = 48 + index * 37;
          const h = (hour.lmp_usd_mwh / maxPrice) * 180;
          return (
            <g key={hour.ts_utc}>
              <rect
                x={x}
                y={210 - h}
                width={32}
                height={h}
                fill={`url(#pat-${lane})`}
                rx={2}
              >
                <title>{`${clock(hour.hour_mt)} ${lane}`}</title>
              </rect>
              {index % 6 === 0 ? (
                <text x={x} y={236} fill="var(--muted)" fontSize={14}>
                  {clock(hour.hour_mt)}
                </text>
              ) : null}
            </g>
          );
        })}
        <polyline
          fill="none"
          stroke="var(--solar)"
          strokeWidth={2}
          points={linePoints(hours, (hour) => hour.solar_fcst_mw / maxSolar)}
        />
        <polyline
          fill="none"
          stroke="var(--ink)"
          strokeWidth={2}
          points={linePoints(hours, (hour) => hour.net_load_mw / maxNet)}
        />
      </svg>
      <div className="legend">
        <span>
          <i className="swatch lane-clear" /> Clear
        </span>
        <span>
          <i className="swatch lane-shoulder" /> Shoulder
        </span>
        <span>
          <i className="swatch lane-jam" /> Jam
        </span>
        <span>Gold line, solar forecast, scaled to its own peak</span>
        <span>Ink line, net load, scaled to its own peak</span>
      </div>
      <p>
        Net load climbs <Inline n={climb} /> MW from the 3pm hour to the 6pm
        hour. The 6pm price is <Inline n={ratio} /> the 3pm price. The solar
        forecast falls from <Inline n={solar4} /> MW in the 4pm hour to{" "}
        <Inline n={solar6} /> MW in the 6pm hour.
      </p>
    </section>
  );
}

function linePoints(
  hours: HourSignal[],
  scale: (hour: HourSignal) => number,
): string {
  return hours
    .map((hour, index) => {
      const x = 48 + index * 37 + 16;
      const y = 210 - scale(hour) * 180;
      return `${x},${y}`;
    })
    .join(" ");
}

function PatternDefs() {
  return (
    <defs>
      <pattern
        id="pat-clear"
        width="6"
        height="6"
        patternUnits="userSpaceOnUse"
      >
        <rect width="6" height="6" fill="var(--clear)" />
        <path d="M0 6 L6 0" stroke="rgba(255,255,255,.5)" strokeWidth="1" />
      </pattern>
      <pattern
        id="pat-shoulder"
        width="6"
        height="6"
        patternUnits="userSpaceOnUse"
      >
        <rect width="6" height="6" fill="var(--shoulder)" />
        <path d="M0 3 H6" stroke="rgba(0,0,0,.35)" strokeWidth="1" />
      </pattern>
      <pattern id="pat-jam" width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="var(--jam)" />
        <path d="M3 0 V6" stroke="rgba(255,255,255,.55)" strokeWidth="1" />
      </pattern>
    </defs>
  );
}
