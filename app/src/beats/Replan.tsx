import { Num } from "../components/Num";
import { COPY } from "../copy";
import { grouped } from "../format";
import type { BeatProps } from "./types";

/** Beat 4 (core 7 only starts here). solve_ms is MEASURED live and never stored. */
export function Replan({ call }: BeatProps) {
  const result = call.second ?? call.first;
  return (
    <section className="beat" aria-labelledby="beat-replan">
      <h2 id="beat-replan">Re-plan</h2>
      <div className="card" data-slot="replan-line">
        {result ? (
          <>
            <p>
              Re-planned in{" "}
              <Num
                value={result.replan.solve_ms}
                display={`${grouped(result.replan.solve_ms, 1)} ms`}
                prov="MEASURED"
                source="performance.now in the engine client"
              />
              .
            </p>
            <p className="muted">
              Rest of the day re-solved from the state of charge after the
              call, timed on this machine. {COPY.simulated}
            </p>
          </>
        ) : (
          <p className="unavailable">
            No call yet, so there is no re-plan. Press C, then come back.{" "}
            {COPY.emptyNotZero}
          </p>
        )}
      </div>
      <p>
        Pulse cycles today <Num k="cycles_today" />, against a budget of{" "}
        <Num k="pulse_cycle_budget" /> a year.
      </p>
    </section>
  );
}
