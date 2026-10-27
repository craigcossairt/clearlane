import type {
  Envelope,
  EnvelopeHour,
  HourSignal,
  Lane,
  Plan,
} from "@contracts/types";
import { criticalReason } from "./lanes";

export function buildEnvelope(
  hours: HourSignal[],
  lanes: Lane[],
  critical: boolean[],
  plan: Plan,
  fleetKw: number,
  sitePulseKw: number,
  operatingDay: string,
): Envelope {
  const scale = fleetKw / sitePulseKw;
  const out: EnvelopeHour[] = hours.map((hour, index) => {
    const slice = plan.intervals.filter(
      (row) => Math.floor(row.i / 4) === index,
    );
    const planned =
      slice.reduce((sum, row) => sum + row.pulse_kw, 0) / (slice.length || 1);
    return {
      ts_utc: hour.ts_utc,
      system_critical: critical[index] ?? false,
      reserve_kw: fleetKw,
      max_charge_kw: fleetKw,
      max_discharge_kw: fleetKw,
      planned_kw: planned * scale,
      reason: criticalReason(index, hours, lanes, critical),
    };
  });
  return {
    schema: "clearlane.envelope/v1",
    operating_day_mt: operatingDay,
    fleet_kw: fleetKw,
    sch_rule:
      "Our proposal: the day's 4 highest net-load hours, plus every jam hour.",
    hours: out,
    generated_utc: new Date().toISOString().replace(".000Z", "Z"),
  };
}
