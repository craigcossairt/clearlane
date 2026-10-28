import { useContext, useMemo } from "react";
import type { Live } from "../beats/types";
import { findNumber, Num, NumbersContext } from "../components/Num";
import { hourLabel } from "../components/Time";
import { COPY, PRESENTER } from "../copy";
import { referenceRaceFor } from "../engineClient";
import { raceCards, type ArithRow, type RaceCard } from "./race";

const ENGINE_SRC = "engine referenceRace (live, this machine)";
const STATION_SRC =
  "reference battery, 1 MW / 2 MWh at 88% round trip (FACTS ref_station)";

/**
 * Screen 3: the race as arithmetic (#216). Each card leads with what it keeps per MW per day,
 * then buys, sells and keeps, so the bigger figure reads as value kept, not cost. The strip
 * below marks each plan's buy and sell hours from referenceRace; "Replay the day" sweeps a
 * cursor across it. Nothing here animates the DP plans, so nothing disagrees with the rows.
 */
export function RaceScreen({
  live,
  hour,
}: {
  live: Live;
  /** Cursor hour, 0 to 24; null before the replay has run. */
  hour: number | null;
}) {
  const ctx = useContext(NumbersContext);
  const cards = useMemo(
    () => raceCards(referenceRaceFor(live.bundle), (k) => findNumber(ctx, k)),
    [live.bundle, ctx],
  );
  return (
    <div className="p-race">
      <div className="p-race-cards">
        {cards.map((c) => (
          <Card key={c.policy} card={c} />
        ))}
      </div>
      <Strip cards={cards} hour={hour} />
    </div>
  );
}

function Card({ card }: { card: RaceCard }) {
  const ours = card.policy === "clearlane";
  return (
    <article
      className={`p-card${ours ? " p-card-ours" : ""}`}
      data-card={card.policy}
      data-slot={`race-card-${card.policy}`}
    >
      <header className="p-card-head">
        <h3>{ours ? COPY.clearlaneLabel : COPY.fixedLabel}</h3>
        {ours ? (
          <span className="p-check">
            <span aria-hidden="true">{PRESENTER.checkMark}</span>{" "}
            {PRESENTER.clearlaneChip}
          </span>
        ) : null}
      </header>
      <div className="p-keep">
        <Num k={card.keep.key} width={7} />
      </div>
      <p className="p-keep-label">{PRESENTER.keepsLabel}</p>
      <table className="p-arith" data-detail="">
        <tbody>
          <Row label={PRESENTER.rowBuys} row={card.buy} />
          <Row label={PRESENTER.rowSells} row={card.sell} />
          <tr className="p-arith-keep">
            <th scope="row">{PRESENTER.rowKeeps}</th>
            <td colSpan={4} />
            <td>
              <Num
                value={card.keep.subtotalValue}
                display={card.keep.subtotal}
                prov="DERIVED"
                source={`${ENGINE_SRC}: sells minus buys, whole dollars`}
                width={4}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}

function Row({ label, row }: { label: string; row: ArithRow }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>
        <Num
          value={row.mwhValue}
          display={row.mwh}
          prov="ASSUMPTION"
          source={STATION_SRC}
          width={9}
        />
      </td>
      <td className="p-op">{PRESENTER.at}</td>
      <td>
        <Num k={row.priceKey} width={6} />
      </td>
      <td className="p-op">{PRESENTER.equals}</td>
      <td>
        <Num
          value={row.subtotalValue}
          display={row.subtotal}
          prov="DERIVED"
          source={`${ENGINE_SRC}: MWh times price, whole dollars`}
          width={4}
        />
      </td>
    </tr>
  );
}

// Strip geometry, in CSS px at 1920x1080 (the viewBox matches, so 1 unit is 1px on stage).
const LABEL_W = 230;
const CELL = 64;
const ROW_H = 44;
const ROW_GAP = 8;
const TOP = 8;
const W = LABEL_W + 24 * CELL;

function Strip({
  cards,
  hour,
}: {
  cards: RaceCard[];
  hour: number | null;
}) {
  const rowsH = cards.length * (ROW_H + ROW_GAP);
  const laneY = TOP + rowsH;
  const axisY = laneY + 30;
  const H = axisY + 8;
  const filled = (h: number) => hour !== null && hour > h;
  const cursorX =
    hour === null ? null : LABEL_W + Math.min(24, Math.max(0, hour)) * CELL;
  return (
    <div className="p-strip" data-slot="race-strip">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={PRESENTER.stripAria}
        data-replay={hour === null ? "idle" : hour >= 24 ? "done" : "running"}
      >
        {cards.map((c, r) => {
          const y = TOP + r * (ROW_H + ROW_GAP);
          return (
            <g key={c.policy} data-row={c.policy}>
              <text
                x={0}
                y={y + ROW_H / 2}
                dominantBaseline="middle"
                className="p-strip-label"
              >
                {c.policy === "clearlane"
                  ? PRESENTER.stripClear
                  : PRESENTER.stripFixed}
              </text>
              {Array.from({ length: 24 }, (_, h) => {
                const kind = c.buyHours.includes(h)
                  ? "buy"
                  : c.sellHours.includes(h)
                    ? "sell"
                    : null;
                const x = LABEL_W + h * CELL;
                return (
                  <g key={h}>
                    <rect
                      x={x + 2}
                      y={y}
                      width={CELL - 4}
                      height={ROW_H}
                      rx={6}
                      className={
                        kind
                          ? `p-mark p-mark-${kind}${filled(h) ? " is-filled" : ""}`
                          : "p-mark p-mark-none"
                      }
                      data-mark={kind ?? undefined}
                      data-filled={kind ? String(filled(h)) : undefined}
                    />
                    {kind ? (
                      <text
                        x={x + CELL / 2}
                        y={y + ROW_H / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className={`p-mark-word${filled(h) ? " is-filled" : ""}`}
                      >
                        {kind === "buy"
                          ? PRESENTER.markBuy
                          : PRESENTER.markSell}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          );
        })}
        {Array.from({ length: 8 }, (_, i) => i * 3).map((h) => (
          <text
            key={h}
            x={LABEL_W + h * CELL + 4}
            y={axisY}
            className="p-axis"
            data-axis=""
          >
            {hourLabel(h)}
          </text>
        ))}
        {cursorX !== null && hour !== null && hour < 24 ? (
          <line
            x1={cursorX}
            x2={cursorX}
            y1={0}
            y2={laneY}
            className="p-cursor"
          />
        ) : null}
      </svg>
      <p className="p-strip-legend">
        <span className="p-swatch p-swatch-buy" aria-hidden="true" />{" "}
        {PRESENTER.stripBuy}
        <span className="p-swatch p-swatch-sell" aria-hidden="true" />{" "}
        {PRESENTER.stripSell}
        <span className="p-strip-note">{PRESENTER.raceNote}</span>
      </p>
    </div>
  );
}
