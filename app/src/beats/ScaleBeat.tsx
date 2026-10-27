import { Inline, Num } from "../Provenance";
import { scaleDay, type StageModel } from "../engineClient";

export function ScaleBeat({
  stage,
  fleetMw,
  onFleet,
}: {
  stage: StageModel;
  fleetMw: number;
  onFleet: (mw: number) => void;
}) {
  const mou = stage.number("mou_mw");
  const ceiling = stage.number("mou_ceiling_mw");
  return (
    <section className="beat" aria-labelledby="beat-scale">
      <h2 id="beat-scale">Scale</h2>
      <p>
        Fleet size <Inline n={liveMw(stage, fleetMw)} /> MW. The top of the
        slider is the MOU ceiling, not installed capacity.
      </p>
      <input
        className="slider"
        type="range"
        min={mou.value}
        max={ceiling.value}
        value={fleetMw}
        aria-label="Fleet size in MW"
        onChange={(event) => onFleet(Number(event.target.value))}
      />
      <p className="muted">Assumes the fleet does not move prices.</p>
      <div className="cards">
        <article className="card">
          <h3>Fixed off-peak rule</h3>
          <Num n={scaleDay(stage.number("fixed_usd_mw_day"), fleetMw)} />
          <p>per day, value to RMP&apos;s system at day-ahead prices.</p>
        </article>
        <article className="card">
          <h3>Clearlane timetable</h3>
          <Num n={scaleDay(stage.number("clearlane_usd_mw_day"), fleetMw)} />
          <p>per day, value to RMP&apos;s system at day-ahead prices.</p>
        </article>
      </div>
      <article className="card">
        <h3>Simulated AI campus, in time</h3>
        <p>
          A simulated campus moves <Inline n={stage.number("campus_mwh")} /> MWh
          into the cheap midday hours on this day. Value to the system at
          day-ahead prices: <Inline n={stage.number("campus_usd")} />.
        </p>
        <p className="muted">
          Simulated. A carbon input for this kind of shift is not advertised.
          This is not a Torus data-center product.
        </p>
      </article>
    </section>
  );
}

function liveMw(stage: StageModel, mw: number) {
  const base = stage.number("mou_mw");
  const atAgreement = Math.round(mw) === Math.round(base.value);
  return {
    ...base,
    value: mw,
    display: String(Math.round(mw)),
    unit: "MW",
    prov: atAgreement ? base.prov : "DERIVED",
    source: atAgreement
      ? base.source
      : "slider on the published agreement and ceiling",
  };
}
