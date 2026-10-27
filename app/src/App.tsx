import { useEffect, useState } from "react";
import type { CrashResult } from "@contracts/types";
import { CrashBeat } from "./beats/CrashBeat";
import { EnvelopeBeat } from "./beats/EnvelopeBeat";
import { Race } from "./beats/Race";
import { Replan } from "./beats/Replan";
import { Ribbon } from "./beats/Ribbon";
import { ScaleBeat } from "./beats/ScaleBeat";
import { loadStage } from "./engineClient";
import cards from "./qa/cards.json";
import "./styles.css";

type Beat = 1 | 2 | 3 | 4 | 5 | 6;
type Heat = "mt" | "utc";

const BEATS: { id: Beat; label: string }[] = [
  { id: 1, label: "Ribbon" },
  { id: 2, label: "Race" },
  { id: 3, label: "Call" },
  { id: 4, label: "Re-plan" },
  { id: 5, label: "Envelope" },
  { id: 6, label: "Scale" },
];

export function App() {
  const [stage] = useState(() => loadStage());
  const [beat, setBeat] = useState<Beat>(1);
  const [hour, setHour] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [call, setCall] = useState<CrashResult | null>(null);
  const [ghost, setGhost] = useState<CrashResult | null>(null);
  const [second, setSecond] = useState<CrashResult | null>(null);
  const [backtest, setBacktest] = useState(false);
  const [heat, setHeat] = useState<Heat>("mt");
  const [qa, setQa] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [fleetMw, setFleetMw] = useState(stage.number("mou_mw").value);
  const [snapshotOn, setSnapshotOn] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!playing) return;
    if (reduced) {
      setHour(24);
      setPlaying(false);
      return;
    }
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / 18000);
      setHour(t * 24);
      if (t < 1) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, reduced]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "q") {
        setArmed(true);
        return;
      }
      if (armed && key >= "1" && key <= "6") {
        setQa(key);
        setArmed(false);
        event.preventDefault();
        return;
      }
      setArmed(false);
      if (key >= "1" && key <= "6") {
        setBeat(Number(key) as Beat);
        if (key === "5") setBacktest(false);
      } else if (key === " ") {
        event.preventDefault();
        setBeat(2);
        setHour(0);
        setPlaying(true);
      } else if (key === "c") {
        setPlaying(false);
        setBeat(3);
        if (!call) {
          setCall(stage.crash("clearlane", false));
          setGhost(stage.crash("price_only", false));
        } else if (!second) {
          setSecond(stage.crash("clearlane", true));
        }
      } else if (key === "e") {
        setBeat(5);
        setBacktest(false);
      } else if (key === "b") {
        setBeat(5);
        setBacktest(true);
      } else if (key === "t") {
        setHeat((prev) => (prev === "mt" ? "utc" : "mt"));
      } else if (key === "l") {
        setSnapshotOn(true);
      } else if (key === "r") {
        setBeat(1);
        setHour(0);
        setPlaying(false);
        setCall(null);
        setGhost(null);
        setSecond(null);
        setBacktest(false);
        setHeat("mt");
        setQa(null);
        setFleetMw(stage.number("mou_mw").value);
        setSnapshotOn(false);
      } else if (key === "escape") {
        setQa(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armed, call, second, stage]);

  const card = cards.find((row) => row.id === qa);
  const reading =
    heat === "mt"
      ? "Heatmap reading: Mountain time"
      : "Heatmap reading: UTC, shown as Mountain (UTC-6)";

  return (
    <div className="stage">
      <header className="top">
        <h1>Clearlane</h1>
        <p>
          Operating day{" "}
          <span className="inline-num">{stage.bundle.operating_day_mt}</span>
        </p>
        <p data-snapshot={snapshotOn ? "on" : "off"}>
          Snapshot,{" "}
          <span className="inline-num">{stage.bundle.fetched_utc}</span>
        </p>
        <p>{reading}</p>
      </header>
      <nav className="beats" aria-label="Beats">
        {BEATS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={beat === item.id ? "true" : undefined}
            onClick={() => {
              setBeat(item.id);
              if (item.id === 5) setBacktest(false);
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <main className="main">
        {beat === 1 ? <Ribbon stage={stage} /> : null}
        {beat === 2 ? <Race stage={stage} hour={hour} /> : null}
        {beat === 3 ? (
          <CrashBeat
            stage={stage}
            result={call}
            ghost={ghost}
            second={second}
            heatmap={heat}
          />
        ) : null}
        {beat === 4 ? <Replan stage={stage} result={second ?? call} /> : null}
        {beat === 5 ? (
          <EnvelopeBeat
            stage={stage}
            fleetMw={fleetMw}
            backtest={backtest}
            heatmap={heat}
          />
        ) : null}
        {beat === 6 ? (
          <ScaleBeat stage={stage} fleetMw={fleetMw} onFleet={setFleetMw} />
        ) : null}
      </main>
      <footer className="foot">
        <p>
          1-6 beats. Space play. C call. E envelope. B backtest. T heatmap. Q
          then 1-6. L snapshot. R reset.
        </p>
      </footer>
      {card ? (
        <div className="qa" role="dialog" aria-modal="true">
          <article className="card">
            <h2>{card.question}</h2>
            <p>{card.answer}</p>
            <button
              className="ghost-btn"
              type="button"
              onClick={() => setQa(null)}
            >
              Close
            </button>
          </article>
        </div>
      ) : null}
    </div>
  );
}
