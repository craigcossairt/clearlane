/**
 * Presenter motion (#4, round 2): off for ?motion=off and for prefers-reduced-motion. Every
 * presenter keyframe is from-only, so with motion off the resting style is the end state.
 */
export function motionOff(): boolean {
  if (typeof window === "undefined") return true;
  if (new URLSearchParams(window.location.search).get("motion") === "off")
    return true;
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : true;
}

/** The section attribute that turns the presenter's CSS motion on or off. */
export const animAttr = (): "on" | "off" => (motionOff() ? "off" : "on");
