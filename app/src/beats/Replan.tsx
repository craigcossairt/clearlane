import type { CrashResult } from "@contracts/types";
import { Inline } from "../Provenance";
import type { StageModel } from "../engineClient";

export function Replan({
  stage,
  result,
}: {
  stage: StageModel;
  result: CrashResult | null;
}) {
  const ms = result ? result.replan.solve_ms : stage.number("solve_ms").value;
  const timed = {
    ...stage.number("solve_ms"),
    key: result ? "replan_ms" : "solve_ms",
    value: ms,
    display: ms.toFixed(1),
    prov: "MEASURED" as const,
    source: "performance.now",
  };
  return (
    <section className="beat" aria-labelledby="beat-replan">
      <h2 id="beat-replan">Re-plan</h2>
      <div className="card reserved">
        {result ? (
          <>
            <p>
              Re-planned in <Inline n={timed} /> ms.
            </p>
            <p className="muted">
              Rest of the day re-solved from the state of charge after the call.
              The time is measured on this machine.
            </p>
          </>
        ) : (
          <p className="unavailable">
            No call yet, so there is no re-plan. Press C, then come back. This
            is empty, not a zero.
          </p>
        )}
      </div>
    </section>
  );
}
