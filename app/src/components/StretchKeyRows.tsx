import { useContext } from "react";
import { FlagsContext } from "../flags";
import { STRETCH_KEYMAP } from "../keymap";

/** The ? overlay rows for the stretch keys whose flag is on; nothing while every flag is off. */
export function StretchKeyRows() {
  const flags = useContext(FlagsContext);
  return (
    <>
      {STRETCH_KEYMAP.filter((b) => flags.has(b.flag)).map((b) => (
        <div key={b.key} style={{ display: "contents" }}>
          <dt data-copy-ok="key names">{b.keyLabel}</dt>
          <dd data-copy-ok="key action text">{b.label}</dd>
        </div>
      ))}
    </>
  );
}
