import { Num, useNumber } from "../components/Num";
import { COPY } from "../copy";
import { scaleUsdPerDay } from "../engineClient";
import { grouped, usdDay } from "../format";
import type { BeatProps } from "./types";

/** Beat 6 (core 9 only starts here). Slider ends come from mou_70mw and torus_500mw. */
export function ScaleBeat({ fleetMw, onFleet }: BeatProps) {
  const min = useNumber("mou_70mw");
  const max = useNumber("torus_500mw");
  const ready = Boolean(min && max && fleetMw !== null);
  return (
    <section className="beat" aria-labelledby="beat-scale">
      <h2 id="beat-scale">Scale</h2>
      <p>
        Fleet size{" "}
        {ready && fleetMw !== null ? (
          <Num
            value={fleetMw}
            display={`${grouped(fleetMw, 0)} MW`}
            prov="SIMULATED"
            source="fleet slider, between mou_70mw and torus_500mw"
          />
        ) : (
          <Num k="mou_70mw" />
        )}
        . The top of the slider is the {COPY.mouCeiling}: <Num k="torus_500mw" />
        .
      </p>
      <input
        className="slider"
        type="range"
        min={min?.value ?? 0}
        max={max?.value ?? 0}
        value={fleetMw ?? 0}
        disabled={!ready}
        aria-label="Fleet size in MW"
        onChange={(event) => onFleet(Number(event.target.value))}
      />
      <p className="muted">{COPY.priceTaker}.</p>
      <div className="cards" data-slot="scale-cards">
        <ScaleCard title={COPY.fixedLabel} perMwKey="fixed_usd_mw_day" fleetMw={fleetMw} />
        <ScaleCard
          title={COPY.clearlaneLabel}
          perMwKey="clearlane_usd_mw_day"
          fleetMw={fleetMw}
        />
      </div>
      <p>
        At the MOU size, the off-peak rule adds <Num k="co2_added_70" /> of{" "}
        <span data-copy-ok="CO2 is the gas's name">CO2</span> a day and the timetable avoids <Num k="co2_avoided_70" />. Per MW-day:{" "}
        <Num k="co2_fixed_t_per_mw_day" /> and{" "}
        <Num k="co2_timetable_t_per_mw_day" />. {COPY.co2Caveat}
      </p>
      <article className="card" data-slot="close-card">
        <h3>Simulated AI campus, in time</h3>
        <p>
          A simulated campus moves <Num k="campus_mwh" /> into the cheap midday
          hours. Value to the system at day-ahead prices:{" "}
          <Num k="campus_usd" />.
        </p>
        <p className="muted">
          {COPY.simulated} This is not a Torus data-center product.
        </p>
        <p>{COPY.closeLine1}</p>
        <p>{COPY.closeLine2}</p>
      </article>
    </section>
  );
}

function ScaleCard({
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
        reason={`${perMwKey} or the fleet size is not computed`}
        width={8}
      />
      <p>per day, {COPY.valueToSystem}.</p>
    </article>
  );
}
