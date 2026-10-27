import { describe, expect, it } from "vitest";
import { laneCommands } from "./lib/check-lane.mjs";

const has =
  (...paths: string[]) =>
  (p: string) =>
    paths.includes(p);

describe("laneCommands", () => {
  it("runs nothing while a lane has no tests yet", () => {
    expect(laneCommands("pitch", has())).toEqual([]);
    expect(laneCommands("science", has())).toEqual([]);
  });

  it("runs pitch's node tests and resolver once they exist", () => {
    expect(
      laneCommands("pitch", has("pitch/test", "pitch/resolve.mjs")),
    ).toEqual([
      ["node", ["--test", "pitch/test/"]],
      ["node", ["pitch/resolve.mjs"]],
    ]);
  });

  it("runs science's unittests once they exist", () => {
    expect(laneCommands("science", has("science/tests"))).toEqual([
      [
        "python",
        ["-I", "-m", "unittest", "discover", "-s", "science/tests", "-t", "."],
      ],
    ]);
  });

  it("rejects an unknown lane", () => {
    expect(() => laneCommands("ui", has())).toThrow(/unknown lane/);
  });
});
