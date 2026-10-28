import { lazy, Suspense } from "react";
import type { Bundle } from "@contracts/types";
import { Chip } from "../components/Chip";
import { Num, useNumber } from "../components/Num";
import { COPY } from "../copy";
import { scaleUsdPerDay } from "../engineClient";
import { useFlag } from "../flags";
import { grouped, usdDay } from "../format";
import type { BeatProps } from "./types";

/**
 * Compute drag (#93, ff_compute_drag), a stretch item: loaded only while its flag is on, so the
 * flag-off close card imports and renders nothing new.
 */
const ComputeDrag = lazy(() => import("../stretch/ComputeDrag"));

/**
 * Beat 6: the fleet slider from mou_70mw to torus_500mw (both ends from keys), with $/day from
 * the engine's linear fleet scaling (price-taker). Right turns to the close card. Any AI
 * campus is SIMULATED; there is no Torus data-center claim.
 */
export function ScaleBeat({ live, fleetMw, onFleet, step }: BeatProps) {
  const min = useNumber("mou_70mw");
  const max = useNumber("torus_500mw");
  const ready = Boolean(min && max && fleetMw !== null);
  const close = step === "end";
  return (
    <section className="beat scale-beat" aria-labelledby="beat-scale">
      <h2 id="beat-scale">{close ? COPY.closeTitle : COPY.scaleTitle}</h2>
      {close ? (
        <CloseCard bundle={live.bundle} />
      ) : (
        <>
          <p>
            {COPY.fleetSize}{" "}
            <span className="slot-fleet" data-slot="fleet-value">
              {ready && fleetMw !== null ? (
                <Num
                  value={fleetMw}
                  display={`${grouped(fleetMw, 0)} MW`}
                  prov="SIMULATED"
                  source="fleet slider, between mou_70mw and torus_500mw"
                  width={8}
                />
              ) : (
                <Num k="mou_70mw" width={8} />
              )}
            </span>
            . {COPY.sliderFrom} <Num k="mou_70mw" /> {COPY.sliderTo}{" "}
            <Num k="torus_500mw" /> MW, {COPY.mouCeiling}.
          </p>
          <input
            className="slider"
            type="range"
            min={min?.value ?? 0}
            max={max?.value ?? 0}
            step={10}
            value={fleetMw ?? 0}
            disabled={!ready}
            aria-label={COPY.fleetAria}
            onChange={(event) => onFleet(Number(event.target.value))}
          />
          <p className="muted">
            {COPY.priceTaker}. {COPY.sliderKeys}
          </p>
          <div className="cards" data-slot="scale-cards">
            <ScaleCard
              title={COPY.fixedLabel}
              perMwKey="fixed_usd_mw_day"
              fleetMw={fleetMw}
            />
            <ScaleCard
              title={COPY.clearlaneLabel}
              perMwKey="clearlane_usd_mw_day"
              fleetMw={fleetMw}
            />
          </div>
          <p className="muted">{COPY.closeHint}</p>
        </>
      )}
    </section>
  );
}

/** The close card. Presenter mode passes no bundle, so the drag card never reaches it. */
export function CloseCard({ bundle }: { bundle?: Bundle }) {
  const drag = useFlag("ff_compute_drag");
  return (
    <article className="card close-card" data-slot="close-card">
      <h3>
        {COPY.campusTitle} <Chip prov="SIMULATED" source="Option 2 campus shift (engine), simulated" />
      </h3>
      <p>
        {COPY.campusLine1} <Num k="campus_mwh" /> {COPY.campusLine2}{" "}
        <Num k="campus_usd" />.
      </p>
      <p className="muted">
        {COPY.simulated} {COPY.notTorusProduct}
      </p>
      <p className="close-line">{COPY.closeLine1}</p>
      <p className="close-line">{COPY.closeLine2}</p>
      {drag && bundle ? (
        <Suspense fallback={null}>
          <ComputeDrag bundle={bundle} />
        </Suspense>
      ) : null}
    </article>
  );
}

export function ScaleCard({
  title,
  perMwKey,
  fleetMw,
}: {
  title: string;
  perMwKey: string;
  fleetMw: number | null;
}) {
  const perMw = useNumber(perMwKey);
  const value =
    perMw && fleetMw !== null ? scaleUsdPerDay(perMw.value, fleetMw) : null;
  return (
    <article className="card">
      <h3>{title}</h3>
      <Num
        value={value}
        display={value === null ? "" : usdDay(value)}
        prov="DERIVED"
        source={`engine scaleUsdPerDay(${perMwKey}, fleet MW)`}
        reason={`${perMwKey} ${COPY.orFleet}`}
        width={8}
      />
      <p>
        {COPY.perDay}, {COPY.valueToSystem}.
      </p>
    </article>
  );
}
