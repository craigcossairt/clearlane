import { useState } from "react";
import { Num } from "../components/Num";
import { hourLabel } from "../components/Time";
import { COPY } from "../copy";
import { envelope as solveEnvelope } from "../engineClient";
import { mwFromKw } from "../format";
import type { BeatProps } from "./types";

const ENVELOPE_SOURCE = "engineClient.envelope (stub)";

/** Beat 5 (core 8 only starts here). */
export function EnvelopeBeat({ live, fleetMw, backtest }: BeatProps) {
  const [copyNote, setCopyNote] = useState("Copy JSON");
  const fleetKw = (fleetMw ?? 0) * 1000;
  const envelope =
    fleetMw === null
      ? null
      : solveEnvelope(live.bundle, live.plans.clearlane, live.site, fleetKw);
  return (
    <section className="beat" aria-labelledby="beat-envelope">
      <h2 id="beat-envelope">{backtest ? "Backtest" : "Envelope"}</h2>
      {backtest ? (
        <div className="cards" data-slot="backtest-bands">
          {[COPY.fixedLabel, COPY.priceOnlyLabel, COPY.clearlaneLabel].map(
            (title) => (
              <article className="card" key={title}>
                <h3>{title}</h3>
                <p>
                  Days beating the off-peak rule <Num k="share_days_beating" />.
                </p>
                <p>
                  Window <Num k="backtest_days" /> days. Calls unanswerable are
                  shown {COPY.heatmapMountain} and {COPY.heatmapUtc} once the
                  backtest is computed.
                </p>
              </article>
            ),
          )}
        </div>
      ) : envelope ? (
        <>
          <p>
            {COPY.schLabel}: <Num k="sch_hours_today" /> today.{" "}
            <span data-copy-ok="engine sch_rule text and schema id">
              {envelope.sch_rule} Schema {envelope.schema}.
            </span>{" "}
            A working example, not a filing.
          </p>
          <div className="scroll" data-detail="">
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
                  <tr
                    key={hour.ts_utc}
                    className={hour.system_critical ? "critical" : undefined}
                  >
                    <td>
                      <span data-time="">{hourLabel(index)}</span>
                    </td>
                    <td>{hour.system_critical ? "yes" : "no"}</td>
                    <td>
                      <Num
                        value={hour.planned_kw}
                        display={mwFromKw(hour.planned_kw)}
                        prov="DERIVED"
                        source={ENVELOPE_SOURCE}
                      />
                    </td>
                    <td data-copy-ok="engine reason text">{hour.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="ghost-btn copy-btn"
            data-slot="copy-json"
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
      ) : (
        <p className="num-not-computed">
          The envelope needs the fleet size, which is{" "}
          {COPY.notComputed}.
        </p>
      )}
    </section>
  );
}
