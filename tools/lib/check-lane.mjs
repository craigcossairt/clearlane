// Commands that check one lane's own tests. A lane with no tests yet runs nothing, so check:all
// stays green until the lane lands its first test, then covers it with no config change.

/**
 * @param {"pitch" | "science"} lane
 * @param {(path: string) => boolean} exists
 * @returns {[string, string[]][]}
 */
export function laneCommands(lane, exists) {
  if (lane === "pitch") {
    const cmds = [];
    if (exists("pitch/test")) cmds.push(["node", ["--test", "pitch/test/**/*.test.mjs"]]);
    if (exists("pitch/resolve.mjs")) cmds.push(["node", ["pitch/resolve.mjs"]]);
    return cmds;
  }
  if (lane === "science") {
    return exists("science/tests")
      ? [["python", ["-I", "-m", "unittest", "discover", "-s", "science/tests", "-t", "."]]]
      : [];
  }
  throw new Error(`unknown lane: ${lane}`);
}
