// The hourly operating envelope a utility could read: clearlane.envelope/v1.
import type {
  Bundle,
  Envelope,
  EnvelopeHour,
  Plan,
  Site,
} from "@contracts/types";
import { STEPS_PER_HOUR } from "./bundle";
import { lanes } from "./lanes";
import { schCapKw, spinAvailKw, stepLimits } from "./limits";
import { schFlags } from "./plan";

export const SCH_RULE =
  "System Critical Hours (our proposal): the 4 highest net-load hours of the day plus every jam hour. In these hours Pulse keeps enough spare power to cover any part of the enrolled kW that Spin cannot.";

export interface EnvelopeOpts {
  fleet_kw?: number;
  generated_utc: string;
}

const kw = (x: number) => `${Math.round(x).toLocaleString("en-US")} kW`;
const range4 = (h: number) =>
  Array.from({ length: STEPS_PER_HOUR }, (_, k) => h * STEPS_PER_HOUR + k);

export function buildEnvelope(
  plan: Plan,
  site: Site,
  b: Bundle,
  opts: EnvelopeOpts,
): Envelope {
  const st = site.station;
  const fleet = opts.fleet_kw ?? st.pulse_kw;
  const scale = fleet / st.pulse_kw;
  const clear = plan.policy === "clearlane";
  const spinBefore = plan.intervals.map((_, t) =>
    t === 0 ? (clear ? st.spin_kwh : 0) : plan.intervals[t - 1]!.spin_soc_kwh,
  );
  const spinAvail = spinBefore.map((kwh) => spinAvailKw(site, kwh));
  const sch = schFlags(b);
  const limits = stepLimits(site, {
    ceiling: plan.policy !== "price_only",
    sch: clear ? sch : null,
    spin_avail_kw: spinAvail,
    other_load_kw: plan.intervals.map((x) => Math.max(0, x.spin_kw)),
  });
  const ls = lanes(b);
  const hours: EnvelopeHour[] = b.hours.map((h, hb) => {
    const ts = range4(hb);
    const isSch = sch[ts[0]!]!;
    const spin = Math.min(...ts.map((t) => spinAvail[t]!));
    const held =
      isSch && clear
        ? Math.min(
            ...ts.map((t) => st.pulse_kw - schCapKw(site, spinAvail[t]!)),
          )
        : 0;
    const maxCharge = Math.min(...ts.map((t) => limits.charge_kw[t]!));
    const maxDischarge = Math.min(...ts.map((t) => limits.discharge_kw[t]!));
    const planned =
      ts.reduce((a, t) => a + plan.intervals[t]!.pulse_kw, 0) / ts.length;
    const action =
      planned > 1e-6
        ? `charging ${kw(planned * scale)}`
        : planned < -1e-6
          ? `discharging ${kw(-planned * scale)}`
          : "idle";
    let reason: string;
    if (isSch) {
      reason = `System Critical Hour (our proposal): Spin holds ${kw(spin * scale)}; Pulse ${action}`;
      if (held > 1e-6)
        reason += `, keeping ${kw(held * scale)} spare for the enrolled kW`;
    } else if (planned > 1e-6 && maxCharge < st.pulse_kw - 1e-6) {
      reason = `${ls[hb]} lane: charging, host ceiling limits charge to ${kw(maxCharge * scale)}`;
    } else {
      reason = `${ls[hb]} lane: Pulse ${action}`;
    }
    return {
      ts_utc: h.ts_utc,
      system_critical: isSch,
      reserve_kw: (spin + held) * scale,
      max_charge_kw: maxCharge * scale,
      max_discharge_kw: maxDischarge * scale,
      planned_kw: planned * scale,
      reason,
    };
  });
  return {
    schema: "clearlane.envelope/v1",
    operating_day_mt: b.operating_day_mt,
    fleet_kw: fleet,
    sch_rule: SCH_RULE,
    hours,
    generated_utc: opts.generated_utc,
  };
}

const EM_DASH = String.fromCharCode(0x2014);

const isNum = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x);

// Hand-written validator; returns errors, empty when valid.
export function validateEnvelope(x: unknown): string[] {
  const e: string[] = [];
  const o = x as Partial<Envelope> | null;
  if (!o || typeof o !== "object") return ["not an object"];
  if (o.schema !== "clearlane.envelope/v1")
    e.push(`schema is ${String(o.schema)}`);
  if (typeof o.operating_day_mt !== "string")
    e.push("operating_day_mt is not a string");
  if (!isNum(o.fleet_kw) || o.fleet_kw <= 0)
    e.push("fleet_kw is not a positive number");
  if (typeof o.sch_rule !== "string") e.push("sch_rule is not a string");
  if (typeof o.generated_utc !== "string" || !o.generated_utc.endsWith("Z"))
    e.push("generated_utc is not UTC");
  if (!Array.isArray(o.hours) || o.hours.length !== 24) {
    e.push(
      `expected 24 hours, got ${Array.isArray(o.hours) ? o.hours.length : "none"}`,
    );
  } else {
    o.hours.forEach((h, i) => {
      const at = `hour ${i}`;
      if (!h || typeof h !== "object") {
        e.push(`${at}: not an object`);
        return;
      }
      if (typeof h.ts_utc !== "string" || !h.ts_utc.endsWith("Z"))
        e.push(`${at}: ts_utc is not UTC`);
      if (typeof h.system_critical !== "boolean")
        e.push(`${at}: system_critical is not a boolean`);
      for (const k of [
        "reserve_kw",
        "max_charge_kw",
        "max_discharge_kw",
        "planned_kw",
      ] as const) {
        if (!isNum(h[k])) e.push(`${at}: ${k} is not a finite number`);
      }
      if (isNum(h.max_charge_kw) && h.max_charge_kw < 0)
        e.push(`${at}: max_charge_kw is negative`);
      if (isNum(h.max_discharge_kw) && h.max_discharge_kw < 0)
        e.push(`${at}: max_discharge_kw is negative`);
      if (isNum(h.reserve_kw) && h.reserve_kw < 0)
        e.push(`${at}: reserve_kw is negative`);
      if (
        isNum(h.planned_kw) &&
        isNum(h.max_charge_kw) &&
        isNum(h.max_discharge_kw) &&
        (h.planned_kw > h.max_charge_kw + 1e-6 ||
          h.planned_kw < -h.max_discharge_kw - 1e-6)
      ) {
        e.push(`${at}: planned_kw outside the limits`);
      }
      if (typeof h.reason !== "string" || h.reason.length === 0)
        e.push(`${at}: reason is missing`);
    });
  }
  if (JSON.stringify(o).includes(EM_DASH)) e.push("contains an em dash");
  return e;
}
