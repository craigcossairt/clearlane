import { useState } from "react";
import { clock, mwFromKw } from "../format";
import { Chip } from "../Provenance";
import type { StageModel } from "../engineClient";

export function EnvelopeBeat({
  stage,
  fleetMw,
  backtest,
  heatmap,
}: {
  stage: StageModel;
  fleetMw: number;
  backtest: boolean;
  heatmap: "mt" | "utc";
}) {
  const envelope = stage.envelopeKw(fleetMw * 1000);
  const [copyNote, setCopyNote] = useState("Copy JSON");
  const criticalHours = envelope.hours.filter((hour) => hour.system_critical).length;
  return (
    <section className="beat" aria-labelledby="beat-envelope">
      <h2 id="beat-envelope">{backtest ? "Backtest" : "Envelope"}</h2>
      {backtest ? (
        <div className="cards">
          {(["fixed_overnight", "price_only", "clearlane"] as const).map((policy) => (
            <article className="card" key={policy}>
              <h3>{label(policy)}</h3>
              <p className="unavailable">P10 to P90 unavailable until the engine backtest is on this build.</p>
              <p className="unavailable">
                Calls unanswerable, {heatmap === "mt" ? "Mountain reading" : "UTC reading"}, unavailable until that
                backtest lands.
              </p>
            </article>
          ))}
        </div>
      ) : (
        <>
          <p>{envelope.sch_rule} A working example, not a filing.</p>
          <p>
            System Critical Hours this day: {criticalHours}
            <Chip prov="DERIVED" source="app/src/stub/lanes.ts" />. Reserve {mwFromKw(envelope.fleet_kw)}
            <Chip prov="SIMULATED" source="app/src/stub/envelope.ts" />.
          </p>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Hour</th>
                  <th>Critical</th>
                  <th>Planned</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {envelope.hours.map((hour, index) => (
                  <tr key={hour.ts_utc} className={hour.system_critical ? "critical" : undefined}>
                    <td>{clock(index)}</td>
                    <td>{hour.system_critical ? "yes" : "no"}</td>
                    <td>
                      {mwFromKw(hour.planned_kw)}
                      <Chip prov="DERIVED" source="app/src/stub/envelope.ts" />
                    </td>
                    <td>{hour.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="ghost-btn"
            type="button"
            onClick={() => {
              const text = JSON.stringify(envelope, null, 2);
              if (!navigator.clipboard) {
                setCopyNote("Copy failed");
                return;
              }
              void navigator.clipboard.writeText(text).then(
                () => setCopyNote("Copied"),
                () => setCopyNote("Copy failed"),
              );
            }}
          >
            {copyNote}
          </button>
        </>
      )}
    </section>
  );
}

function label(policy: string): string {
  if (policy === "fixed_overnight") return "Fixed off-peak rule";
  if (policy === "price_only") return "Battery-only plan";
  return "Clearlane";
}
