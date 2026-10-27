// Safety checks on any plan. Returns violation strings; empty when clean.
import type { Plan, Site } from "@contracts/types";
import { INTERVAL_S, INTERVALS } from "./bundle";
import { schCapKw, spinAvailKw } from "./limits";
import { startSocKwh } from "./policies";

const TOL = 1e-6;

export function checkPlan(
  plan: Plan,
  site: Site,
  startSoc = startSocKwh(site, plan.policy),
  schFrom = 0, // first interval the SCH rule applies to (a re-plan's start; earlier ones are as executed)
): string[] {
  const v: string[] = [];
  const iv = plan.intervals;
  const st = site.station;
  const exp = site.export_limit_kw.value;
  if (iv.length !== INTERVALS)
    v.push(`expected ${INTERVALS} intervals, got ${iv.length}`);
  iv.forEach((x, k) => {
    const at = `interval ${x.i} (${x.ts_utc})`;
    if (x.i !== k) v.push(`${at}: index out of order`);
    for (const f of ["meter_kw", "pulse_kw", "pulse_soc_kwh"] as const)
      if (!Number.isFinite(x[f])) v.push(`${at}: ${f} is not finite`);
    if (
      k > 0 &&
      Date.parse(x.ts_utc) - Date.parse(iv[k - 1]!.ts_utc) !== INTERVAL_S * 1000
    ) {
      v.push(`${at}: ts_utc out of order`);
    }
    if (
      plan.policy !== "price_only" &&
      x.meter_kw > site.host_ceiling_kw + TOL
    ) {
      v.push(
        `${at}: meter ${x.meter_kw.toFixed(1)} kW over the host ceiling ${site.host_ceiling_kw} kW`,
      );
    }
    if (x.meter_kw < -exp - TOL)
      v.push(`${at}: meter ${x.meter_kw.toFixed(1)} kW under the export limit`);
    if (x.pulse_soc_kwh < -TOL || x.pulse_soc_kwh > st.pulse_kwh + TOL) {
      v.push(
        `${at}: Pulse SoC ${x.pulse_soc_kwh} kWh outside [0, ${st.pulse_kwh}]`,
      );
    }
    if (Math.abs(x.pulse_kw) > st.pulse_kw + TOL)
      v.push(`${at}: Pulse power ${x.pulse_kw} kW over its rating`);
    if (plan.policy === "clearlane" && x.system_critical && k >= schFrom) {
      const spinBefore = k === 0 ? st.spin_kwh : iv[k - 1]!.spin_soc_kwh;
      const cap = schCapKw(site, spinAvailKw(site, spinBefore));
      if (-x.pulse_kw > cap + TOL)
        v.push(
          `${at}: SCH cap ${cap.toFixed(1)} kW broken by ${-x.pulse_kw} kW discharge`,
        );
    }
  });
  const end = iv[iv.length - 1];
  if (end && !(end.pulse_soc_kwh >= startSoc - TOL)) {
    v.push(
      `terminal Pulse SoC ${end.pulse_soc_kwh} kWh below the start ${startSoc} kWh`,
    );
  }
  return v;
}
