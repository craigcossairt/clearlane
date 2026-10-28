import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CrashResult, Provenance } from "@contracts/types";
import type { Live } from "../beats/types";
import { Chip } from "../components/Chip";
import { Num, useNumber } from "../components/Num";
import { hourLabel, mtClock } from "../components/Time";
import { COPY, FLEET } from "../copy";
import { crash, envelope } from "../engineClient";
import { useFlag } from "../flags";
import { grouped } from "../format";
import { FLEET_KEY, KEYMAP, typedIntoInput } from "../keymap";
import "./fleetBoard.css";

/*
 * The fleet board (#92, ff_fleet_board), a stretch item that never joins the six beats. F or the
 * pill opens it over the current beat; F, Esc or Close shuts it and hands focus back.
 *
 * Partial, and honest about it: the engine's fleet roll-up of many simulated sites (#66) and its
 * fleet call allocator (#67) were cut at Train 5. So the board tiles the one simulated site the
 * engine models, draws the engine envelope scaled to the 70 MW MOU, and lands a call through
 * engineClient.crash. The many-site tiles and the fleet's delivered share show "not computed".
 * Nothing here computes a number; every value is an engine field or a numbers.json key.
 */

const QUARTER_MS = 15 * 60 * 1000;
const PLAN_SOURCE = "engine plan for the simulated site (clearlane policy)";
const CALL_SOURCE = "engine crash and re-plan (live, this machine)";

interface BoardCalls {
  first: CrashResult | null;
  second: CrashResult | null;
}
const NO_CALLS: BoardCalls = { first: null, second: null };

const norm = (key: string) => (key.length === 1 ? key.toLowerCase() : key);
const CORE_KEYS = new Set(KEYMAP.flatMap((b) => b.keys.map(norm)));

/** The plan's quarter hour that holds the scripted 6:40pm call (time arithmetic only), or -1. */
export function callIntervalIndex(live: Live): number {
  const t = Date.parse(live.calls.first.start_utc);
  return live.plans.clearlane.intervals.findIndex((iv) => {
    const start = Date.parse(iv.ts_utc);
    return start <= t && t < start + QUARTER_MS;
  });
}

/** Renders nothing unless ff_fleet_board is on. App.tsx loads this module lazily. */
export default function FleetBoard({ live }: { live: Live }) {
  if (!useFlag(FLEET_KEY.flag)) return null;
  return <BoardOn live={live} />;
}

function BoardOn({ live }: { live: Live }) {
  const [open, setOpen] = useState(false);
  const [calls, setCalls] = useState<BoardCalls>(NO_CALLS);
  const pillRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnRef = useRef<Element | null>(null);

  const openBoard = useCallback(() => {
    returnRef.current = document.activeElement;
    setOpen(true);
  }, []);

  const closeBoard = useCallback(() => {
    setOpen(false);
    const back = returnRef.current;
    const target =
      back instanceof HTMLElement && back !== document.body && back.isConnected
        ? back
        : pillRef.current;
    target?.focus();
  }, []);

  // The same two presses as the stage: the 6:40pm call, then a second inside the refill.
  const land = useCallback(() => {
    setCalls((prev) => {
      if (!prev.first)
        return {
          first: crash(
            live.plans.clearlane,
            live.site,
            live.calls.first,
            live.torus,
          ),
          second: null,
        };
      if (!prev.second)
        return {
          ...prev,
          second: crash(
            live.plans.clearlane,
            live.site,
            live.calls.second,
            live.torus,
            live.calls.first,
          ),
        };
      return prev;
    });
  }, [live]);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  // Capture phase, so while the board is open its keys never reach the stage's own handler.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = norm(event.key);
      if (typedIntoInput(event.target) && key !== "Escape") return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (!open) {
        if (key === FLEET_KEY.key) {
          event.preventDefault();
          openBoard();
        }
        return;
      }
      const take = () => {
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      if (key === FLEET_KEY.key || key === "Escape") {
        take();
        closeBoard();
      } else if (key === "c") {
        take();
        land();
      } else if (CORE_KEYS.has(key)) {
        // Modal: the stage does not move under the board.
        take();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, openBoard, closeBoard, land]);

  const shown = calls.second ?? calls.first;
  const state = calls.second ? "second" : calls.first ? "first" : "none";

  return (
    <>
      <button
        ref={pillRef}
        type="button"
        className="fleet-pill"
        data-fleet-pill=""
        aria-expanded={open}
        title={FLEET.pillTitle}
        onClick={() => (open ? closeBoard() : openBoard())}
      >
        {FLEET.pill}
      </button>
      {open ? (
        <div className="fleet-backdrop">
          <section
            className="fleet-board"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fleet-title"
            data-fleet-board="open"
            data-fleet-call={state}
          >
            <header className="fleet-head">
              <h2 id="fleet-title">{FLEET.title}</h2>
              <button
                ref={closeRef}
                type="button"
                className="ghost-btn"
                onClick={closeBoard}
              >
                {FLEET.close}
              </button>
            </header>
            <p className="fleet-caption">{FLEET.caption}</p>
            <div className="fleet-grid">
              <div className="fleet-tiles" data-slot="fleet-tiles">
                <SiteTile live={live} after={shown} />
                <MoreSites />
              </div>
              <CallPanel live={live} calls={calls} onLand={land} />
            </div>
            <FleetStrip live={live} />
          </section>
        </div>
      ) : null}
    </>
  );
}

function SiteTile({ live, after }: { live: Live; after: CrashResult | null }) {
  const i = callIntervalIndex(live);
  const plan = after ? after.replan : live.plans.clearlane;
  const iv = i >= 0 ? plan.intervals[i] : undefined;
  const st = live.site.station;
  // Plan values are DERIVED; anything about a call, or the host meter, is SIMULATED.
  const prov: Provenance = after ? "SIMULATED" : "DERIVED";
  const source = after ? CALL_SOURCE : PLAN_SOURCE;
  return (
    <article className="card fleet-tile" data-site={live.site.id}>
      <h3>
        {live.site.label}{" "}
        <Chip
          prov="SIMULATED"
          source="engine defaultSite: a simulated site, not a metered one"
        />
      </h3>
      {iv ? (
        <>
          {/* Both labels share one grid cell, the idle one hidden, so the tile keeps its size. */}
          <p className="muted fleet-moment">
            <span
              className={after ? "off" : undefined}
              aria-hidden={after ? true : undefined}
            >
              {FLEET.tilePlanned} <span data-time="">{mtClock(iv.ts_utc)}</span>{" "}
              {COPY.mt}
            </span>
            <span
              className={after ? undefined : "off"}
              aria-hidden={after ? undefined : true}
            >
              {FLEET.tileAfter} <span data-time="">{mtClock(iv.ts_utc)}</span>{" "}
              {COPY.mt}
            </span>
          </p>
          <dl className="fleet-bars" data-detail="">
            <Bar
              label={FLEET.tileSpin}
              value={iv.spin_soc_kwh}
              max={st.spin_kwh}
              unit="kWh"
              prov={prov}
              source={source}
            />
            <Bar
              label={FLEET.tilePulse}
              value={iv.pulse_soc_kwh}
              max={st.pulse_kwh}
              unit="kWh"
              prov={prov}
              source={source}
            />
            <Bar
              label={FLEET.tileMeter}
              value={iv.meter_kw}
              max={live.site.host_ceiling_kw}
              unit="kW"
              prov="SIMULATED"
              source={source}
            >
              {FLEET.tileCeiling} <Num k="host_ceiling_kw" /> kW
            </Bar>
          </dl>
        </>
      ) : (
        <p className="num-unavailable">
          {COPY.unavailable}: {FLEET.tileUnavailable}
        </p>
      )}
      <p className="fleet-refill" data-slot="fleet-refill">
        {after ? (
          <>
            {COPY.spinFull}{" "}
            <span data-time="">{mtClock(after.spin_full_again_utc)}</span>{" "}
            {COPY.mt}.
          </>
        ) : (
          FLEET.refillNone
        )}
      </p>
    </article>
  );
}

function Bar({
  label,
  value,
  max,
  unit,
  prov,
  source,
  children,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  prov: Provenance;
  source: string;
  children?: React.ReactNode;
}) {
  // Drawing only: the fill is the value's share of the bar's full scale.
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="fleet-bar-row">
      <dt>{label}</dt>
      <dd>
        <span className="fleet-bar" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </span>
        <Num
          value={value}
          display={`${grouped(value, 0)} ${unit}`}
          prov={prov}
          source={source}
          width={7}
        />{" "}
        {children}
      </dd>
    </div>
  );
}

function MoreSites() {
  return (
    <article className="card fleet-tile fleet-more" data-slot="fleet-more">
      <h3>{FLEET.moreTitle}</h3>
      <p>
        <span className="num-not-computed">{COPY.notComputed}</span>
      </p>
      <p className="muted">{FLEET.moreLine}</p>
    </article>
  );
}

function CallPanel({
  live,
  calls,
  onLand,
}: {
  live: Live;
  calls: BoardCalls;
  onLand: () => void;
}) {
  const shown = calls.second ?? calls.first;
  return (
    <article className="card fleet-call" data-slot="fleet-call">
      <h3>{FLEET.callTitle}</h3>
      {shown ? (
        <>
          <p>
            {COPY.crashBanner} <Num k="enrolled_kw" /> {COPY.crashBannerKw}
          </p>
          <div className="fleet-contribution" data-contribution={live.site.id}>
            <p className="fleet-site-name">{live.site.label}</p>
            <dl data-detail="">
              <dt>{FLEET.colSpin}</dt>
              <dd>
                <Sim value={shown.spin_kwh} unit="kWh" digits={1} />
              </dd>
              <dt>{FLEET.colPulse}</dt>
              <dd>
                <Sim value={shown.pulse_kwh} unit="kWh" digits={1} />
              </dd>
              <dt>{FLEET.colDelivered}</dt>
              <dd>
                <Sim value={shown.delivered_pct} unit="%" digits={0} />
              </dd>
              <dt>{FLEET.colShortfall}</dt>
              <dd data-shortfall="">
                <Sim value={shown.shortfall_kwh} unit="kWh" digits={1} />
              </dd>
            </dl>
          </div>
          <p data-slot="fleet-share">
            {FLEET.fleetShare}{" "}
            <span className="num-not-computed">{COPY.notComputed}</span>,{" "}
            {FLEET.fleetNotBuilt}
          </p>
          <p>
            {COPY.replannedIn}{" "}
            <Num
              value={shown.replan.solve_ms}
              display={`${grouped(shown.replan.solve_ms, 1)} ms`}
              prov="MEASURED"
              source="performance.now inside the engine re-plan after the call, this machine"
              width={9}
            />
          </p>
          <p className="muted">
            {calls.second ? COPY.secondRule : FLEET.callSecondPrompt}
          </p>
        </>
      ) : (
        <>
          <p>{FLEET.callPrompt}</p>
          <button
            type="button"
            className="ghost-btn fleet-land"
            onClick={onLand}
          >
            {FLEET.callButton}
          </button>
        </>
      )}
    </article>
  );
}

function Sim({
  value,
  unit,
  digits,
}: {
  value: number;
  unit: string;
  digits: number;
}) {
  return (
    <Num
      value={value}
      display={`${grouped(value, digits)} ${unit}`}
      prov="SIMULATED"
      source={CALL_SOURCE}
      width={7}
    />
  );
}

// The strip's drawing box, in SVG units sized so 24-unit tick labels read at 24px at 1920.
const STRIP_W = 1800;
const STRIP_H = 196;
const ZERO_Y = 80;
const HALF_H = 72;
const TICK_Y = 188;

function FleetStrip({ live }: { live: Live }) {
  const mou = useNumber("mou_70mw");
  // MW to kW is a unit conversion; the envelope itself is the engine's.
  const fleetKw = mou ? mou.value * 1000 : null;
  const env = useMemo(
    () =>
      fleetKw === null
        ? null
        : envelope(live.bundle, live.plans.clearlane, live.site, fleetKw),
    [live, fleetKw],
  );
  return (
    <section className="card fleet-strip" data-slot="fleet-strip">
      <h3>{FLEET.stripTitle}</h3>
      <p>
        {FLEET.stripLine1} <Num k="mou_70mw" /> {FLEET.stripLine2}
      </p>
      {env && fleetKw !== null ? (
        <StripChart hours={env.hours} fleetKw={fleetKw} />
      ) : (
        <p className="num-not-computed">
          {COPY.notComputed}: {FLEET.stripMissing}
        </p>
      )}
      <p className="muted">
        {FLEET.stripLegend} {FLEET.stripAxis} {COPY.axisCaption}.
      </p>
    </section>
  );
}

function StripChart({
  hours,
  fleetKw,
}: {
  hours: { ts_utc: string; system_critical: boolean; planned_kw: number }[];
  fleetKw: number;
}) {
  const col = STRIP_W / Math.max(hours.length, 1);
  // Drawing scale only: the tallest bar fills its half of the strip.
  const peak = Math.max(1, ...hours.map((h) => Math.abs(h.planned_kw)));
  return (
    <svg
      className="fleet-svg"
      viewBox={`0 0 ${STRIP_W} ${STRIP_H}`}
      role="img"
      aria-label={FLEET.stripAria}
      data-fleet-kw={String(fleetKw)}
    >
      {hours.map((h, i) => {
        const len = (Math.abs(h.planned_kw) / peak) * HALF_H;
        const up = h.planned_kw >= 0;
        return (
          <g
            key={h.ts_utc}
            data-hour={i}
            data-critical={h.system_critical ? "yes" : "no"}
          >
            {h.system_critical ? (
              <rect
                className="fleet-sch"
                x={i * col}
                y={0}
                width={col}
                height={ZERO_Y + HALF_H + 8}
              />
            ) : null}
            <rect
              className={up ? "fleet-charge" : "fleet-discharge"}
              x={i * col + col * 0.15}
              y={up ? ZERO_Y - len : ZERO_Y}
              width={col * 0.7}
              height={len}
            />
          </g>
        );
      })}
      <line
        className="fleet-zero"
        x1={0}
        x2={STRIP_W}
        y1={ZERO_Y}
        y2={ZERO_Y}
      />
      {hours.map((h, i) =>
        i % 3 === 0 ? (
          <text
            key={`t${h.ts_utc}`}
            className="fleet-tick"
            x={i * col + col / 2}
            y={TICK_Y}
            textAnchor="middle"
            data-axis=""
          >
            {hourLabel(i)}
          </text>
        ) : null,
      )}
    </svg>
  );
}
