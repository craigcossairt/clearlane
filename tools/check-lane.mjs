// Usage: node tools/check-lane.mjs <pitch|science>
// Runs that lane's tests if it has any. Exit code is the first failing command's, else 0.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { laneCommands } from "./lib/check-lane.mjs";

const lane = process.argv[2];
const cmds = laneCommands(lane, existsSync);
if (cmds.length === 0) console.log(`check:${lane}: no tests yet, nothing to run`);
for (const [cmd, args] of cmds) {
  console.log(`check:${lane}: ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 2);
}
