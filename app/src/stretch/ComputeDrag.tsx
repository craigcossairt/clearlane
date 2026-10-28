import "./computeDrag.css";
import type { Bundle, Provenance } from "@contracts/types";
import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Chip } from "../components/Chip";
import { Num } from "../components/Num";
import { hourLabel } from "../components/Time";
import { COPY, DRAG } from "../copy";
import { OPTION2_BLOCK, option2Shift, option2ShiftAt } from "../engineClient";
import { useFlag } from "../flags";
import { grouped, usdDay, usdPerMw } from "../format";

const SHIFT_SRC =
  "engine option2Shift (engine/src/reference.ts) through engineClient.option2ShiftAt, value to RMP's system at day-ahead prices";
const BLOCK_SRC =
  "engine option2Shift default block (engine/src/reference.ts), simulated campus";
const PRICE_SRC = "bundle hours, CAISO OASIS day-ahead LMP";
const PEER_SRC = "bundle peers, CAISO OASIS day-ahead LMP (caiso_prc_lmp_dam)";
const RESEARCH_SRC = "research/analysis/option2/where_vs_when_output.txt";

// Chart geometry (viewBox units, not data). The SVG stretches to the track, so hour i spans
// [i / 24, (i + 1) / 24] of its width, the same fractions the HTML block and ticks use.
const CHART_W = 2400;
const CHART_H = 300;
const CHART_PAD = 24;
const TICK_EVERY = 3;

const pct = (n: number, of: number) => `${(n / of) * 100}%`;
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

/**
 * Compute drag (#93, ff_compute_drag). On the close card, a simulated AI campus block slides along
 * the day's price line by mouse, touch or arrow keys. At every start hour its value to RMP's system
 * and its CO2 come from the engine's Option 2 shift through engineClient; a position the engine
 * cannot price says so. "Move it in space" shows the same hours at the bundle's peer nodes, or the
 * October research figures when the bundle has none. Renders nothing while its flag is off.
 */
export default function ComputeDrag({ bundle }: { bundle: Bundle }) {
  const on = useFlag("ff_compute_drag");
  return on ? <DragOn bundle={bundle} /> : null;
}

function DragOn({ bundle }: { bundle: Bundle }) {
  const span = OPTION2_BLOCK.hours;
  const day = bundle.hours.length;
  const last = day - span;
  const base = useMemo(() => option2Shift(bundle), [bundle]);
  const [start, setStart] = useState(() => clamp(base.to_hb[0] ?? 0, 0, last));
  const [space, setSpace] = useState(false);
  const shift = useMemo(() => option2ShiftAt(bundle, start), [bundle, start]);
  const trackRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  /** While dragging: which hour of the block the pointer holds. */
  const grab = useRef<number | null>(null);

  const move = (to: number) => setStart(clamp(to, 0, last));
  const hourAt = (clientX: number): number | null => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r || r.width <= 0) return null;
    return clamp(Math.floor(((clientX - r.left) / r.width) * day), 0, day - 1);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const h = hourAt(e.clientX);
    if (h === null) return;
    const inBlock = h >= start && h < start + span;
    grab.current = inBlock ? h - start : Math.floor(span / 2);
    if (!inBlock) move(h - grab.current);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
    blockRef.current?.focus();
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (grab.current === null) return;
    const h = hourAt(e.clientX);
    if (h !== null) move(h - grab.current);
  };
  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    grab.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Arrows and Home/End move the block while it has focus and never reach the stage's own keys.
  // PageUp and PageDown are left to the stage, so a presenter remote still turns the beat.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        move(start - 1);
        break;
      case "ArrowRight":
      case "ArrowUp":
        move(start + 1);
        break;
      case "Home":
        move(0);
        break;
      case "End":
        move(last);
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  const prices = bundle.hours.map((h) => h.lmp_usd_mwh);
  // Chart scaling only: the line is drawn against the day's peak. No value is shown from this.
  const peak = Math.max(...prices, 1);
  const y = (p: number) =>
    CHART_H - CHART_PAD - (p / peak) * (CHART_H - 2 * CHART_PAD);
  const cell = CHART_W / day;
  const points = prices
    .map((p, i) => `${i * cell + cell / 2},${y(p)}`)
    .join(" ");
  const ticks = bundle.hours
    .map((h, i) => ({ i, label: hourLabel(h.hour_mt) }))
    .filter(({ i }) => i % TICK_EVERY === 0);
  const lmpProv: Provenance = bundle.hours[0]?.prov.lmp ?? "REAL";

  return (
    <section className="drag" data-compute-drag="" aria-labelledby="drag-title">
      <h4 id="drag-title">
        {DRAG.title}{" "}
        <Chip prov="SIMULATED" source={`${BLOCK_SRC}; ${SHIFT_SRC}`} />
      </h4>
      <div className="drag-grid">
        <div className="drag-chart-col">
          <p className="drag-intro">{DRAG.intro}</p>
          <div
            className="drag-track"
            data-drag-track=""
            ref={trackRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
          >
            <svg
              className="drag-chart"
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={DRAG.chartAria}
            >
              {base.from_hb.map((h) => (
                <rect
                  key={h}
                  className="drag-from"
                  data-from-hour={h}
                  x={h * cell}
                  y={0}
                  width={cell}
                  height={CHART_H}
                />
              ))}
              <polyline
                className="drag-price"
                points={points}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div
              ref={blockRef}
              className="drag-block"
              role="slider"
              tabIndex={0}
              aria-label={DRAG.blockAria}
              aria-valuemin={0}
              aria-valuemax={last}
              aria-valuenow={start}
              aria-valuetext={`${hourLabel(start)} ${DRAG.to} ${hourLabel(start + span)}`}
              style={{ left: pct(start, day), width: pct(span, day) }}
              onKeyDown={onKeyDown}
            >
              <span className="drag-block-label">{DRAG.blockLabel}</span>
            </div>
          </div>
          <div className="drag-ticks" aria-hidden="true">
            {ticks.map(({ i, label }) => (
              <span
                key={i}
                className="drag-tick"
                data-axis=""
                style={{ left: pct(i, day) }}
              >
                {label}
              </span>
            ))}
          </div>
          <p className="legend-line drag-legend">
            {DRAG.lineLegend}{" "}
            <span data-copy-ok="CAISO node id">{bundle.node}</span>{" "}
            <Chip prov={lmpProv} source={PRICE_SRC} />. {DRAG.shadeLegend}{" "}
            {DRAG.axis} {COPY.axisCaption}.
          </p>
        </div>
        <div className="drag-result" data-slot="drag-result">
          <p className="drag-line" data-detail="">
            {DRAG.block} <span data-time="">{hourLabel(start)}</span> {DRAG.to}{" "}
            <span data-time="">{hourLabel(start + span)}</span>,{" "}
            <Num
              value={OPTION2_BLOCK.mw}
              display={`${grouped(OPTION2_BLOCK.mw, 0)} MW`}
              prov="SIMULATED"
              source={BLOCK_SRC}
              width={5}
            />
            , <Num k="campus_mwh" width={2} /> MWh.
          </p>
          <p className="drag-line" data-detail="">
            {DRAG.outOf}{" "}
            <span data-time="">{base.from_hb.map(hourLabel).join(", ")}</span>.
          </p>
          <div className="drag-view">
            {space ? (
              <SpaceView bundle={bundle} start={start} span={span} />
            ) : (
              <TimeView shift={shift} />
            )}
          </div>
          <button
            type="button"
            className="ghost-btn drag-toggle"
            aria-pressed={space}
            onClick={() => setSpace((s) => !s)}
          >
            {DRAG.spaceToggle}
          </button>
        </div>
      </div>
    </section>
  );
}

function TimeView({ shift }: { shift: ReturnType<typeof option2ShiftAt> }) {
  const added = shift !== null && shift.co2_t < 0;
  // An unpriced position is explanation, not a headline figure: it reads at detail size.
  const detail = shift === null ? "" : undefined;
  return (
    <>
      <p className="drag-value" data-slot="drag-value" data-detail={detail}>
        {DRAG.value}{" "}
        <Num
          value={shift ? shift.usd : null}
          display={shift ? usdDay(shift.usd) : ""}
          prov="SIMULATED"
          source={SHIFT_SRC}
          reason={DRAG.overlap}
          width={7}
        />
      </p>
      <p className="drag-co2" data-slot="drag-co2" data-detail={detail}>
        <span data-copy-ok="CO2 is a formula">
          {added ? DRAG.co2Added : DRAG.co2Avoided}
        </span>{" "}
        <Num
          value={shift ? Math.abs(shift.co2_t) : null}
          display={shift ? `${grouped(Math.abs(shift.co2_t), 1)} t` : ""}
          prov="SIMULATED"
          source={`${SHIFT_SRC}; EIA hourly average emissions`}
          reason={DRAG.overlap}
          width={7}
        />
      </p>
      <p className="muted drag-caveat" data-copy-ok="CO2 is a formula">
        {COPY.co2Caveat}
      </p>
    </>
  );
}

function SpaceView({
  bundle,
  start,
  span,
}: {
  bundle: Bundle;
  start: number;
  span: number;
}) {
  if (bundle.peers.length === 0)
    return (
      <div className="drag-space" data-drag-space="" data-detail="">
        <p>
          {DRAG.research1} <Num k="time_vs_space_oct_time" width={3} />{" "}
          {DRAG.research2} <Num k="time_vs_space_oct_space" width={3} />.
        </p>
        <p className="muted">
          {DRAG.researchSource}{" "}
          <span data-copy-ok="file path">{RESEARCH_SRC}</span>
        </p>
      </div>
    );
  const hours = Array.from({ length: span }, (_, k) => start + k);
  const rows: { node: string; lmp: number[]; prov: Provenance; src: string }[] =
    [
      {
        node: bundle.node,
        lmp: bundle.hours.map((h) => h.lmp_usd_mwh),
        prov: bundle.hours[0]?.prov.lmp ?? "REAL",
        src: PRICE_SRC,
      },
      ...bundle.peers.map((p) => ({
        node: p.node,
        lmp: p.lmp_usd_mwh,
        prov: "REAL" as const,
        src: PEER_SRC,
      })),
    ];
  return (
    <div className="drag-space" data-drag-space="" data-detail="">
      <p>{DRAG.spaceLine}</p>
      <table className="drag-peers">
        <thead>
          <tr>
            <th scope="col">{DRAG.colNode}</th>
            {hours.map((h) => (
              <th scope="col" key={h}>
                <span data-time="">{hourLabel(h)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.node} data-node={row.node}>
              <th scope="row" data-copy-ok="CAISO node id">
                {row.node}
              </th>
              {hours.map((h) => {
                const v = row.lmp[h];
                return (
                  <td key={h}>
                    <Num
                      value={v ?? null}
                      display={v === undefined ? "" : usdPerMw(v)}
                      prov={row.prov}
                      source={row.src}
                      reason={DRAG.noPrice}
                      width={6}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
