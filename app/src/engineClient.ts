import { loadStageModel, scaleDay, type StageModel } from "./stub/stage";

export type { StageModel };
export { scaleDay };

/** The only module the stage uses for plans, crashes, and envelopes. Snapshot mode imports the fixture. No network. */
export function loadStage(): StageModel {
  return loadStageModel();
}
