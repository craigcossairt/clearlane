"""Where-vs-when analysis across the EDAM footprint.

Inputs (all REAL, pulled 2026-10-26):
  - CAISO OASIS PRC_LMP DAM for ELAP_PACE, ELAP_PACW, ELAP_PGE, TH_SP15_GEN (Oct 1-27) and PACE/PACW/SP15 (Jul 1-30)
  - EIA-930 six-month balance file 2026 Jul-Dec (fuel mix per BA)
Carbon intensity is DERIVED: generation-weighted IPCC AR5 lifecycle medians (same factors as utah-grid.findings.md).
"""
import csv, glob, os, sys, statistics as st
from collections import defaultdict
from datetime import datetime, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
EIA = os.path.join(HERE, "..", "data", "eia930", "EIA930_BALANCE_2026_Jul_Dec.csv")

NODES = {"ELAP_PACE-APND": "PACE", "ELAP_PACW-APND": "PACW", "ELAP_PGE-APND": "PGE", "TH_SP15_GEN-APND": "SP15"}
BA_FOR = {"PACE": "PACE", "PACW": "PACW", "PGE": "PGE", "SP15": "CISO"}

def load_lmp(folder):
    out = defaultdict(dict)  # utc hour start -> node -> lmp
    cong = defaultdict(dict)
    for f in glob.glob(os.path.join(HERE, folder, "*.csv")):
        for r in csv.DictReader(open(f, newline="")):
            t = datetime.strptime(r["INTERVALSTARTTIME_GMT"][:19], "%Y-%m-%dT%H:%M:%S")
            n = NODES.get(r["NODE"])
            if not n:
                continue
            if r["LMP_TYPE"] == "LMP":
                out[t][n] = float(r["MW"])
            elif r["LMP_TYPE"] == "MCC":
                cong[t][n] = float(r["MW"])
    return out, cong

EF = {"Coal": 820, "Natural Gas": 490, "Nuclear": 12, "All Petroleum Products": 650,
      "Hydropower Excluding Pumped Storage": 24, "Solar without Integrated Battery Storage": 48,
      "Solar with Integrated Battery Storage": 48, "Wind without Integrated Battery Storage": 11,
      "Wind with Integrated Battery Storage": 11, "Geothermal": 38, "Other Fuel Sources": 230}

def num(s):
    s = (s or "").replace(",", "").strip()
    try:
        return float(s)
    except ValueError:
        return None

def load_ci():
    ci = defaultdict(dict)   # utc hour START -> BA -> g/kWh
    fossil = defaultdict(dict)
    netload = defaultdict(dict)
    for r in csv.DictReader(open(EIA, newline="", encoding="utf-8-sig")):
        ba = r["Balancing Authority"]
        if ba not in ("PACE", "PACW", "PGE", "CISO"):
            continue
        tend = datetime.strptime(r["UTC Time at End of Hour"], "%m/%d/%Y %I:%M:%S %p")
        t = tend - timedelta(hours=1)
        gen = {}
        for f in EF:
            v = num(r.get(f"Net Generation (MW) from {f} (Adjusted)"))
            if v is None:
                v = num(r.get(f"Net Generation (MW) from {f}"))
            gen[f] = max(v or 0.0, 0.0)
        tot = sum(gen.values())
        if tot < 100:
            continue
        ci[t][ba] = sum(EF[f] * gen[f] for f in gen) / tot
        fossil[t][ba] = (gen["Coal"] + gen["Natural Gas"]) / tot
        d = num(r.get("Demand (MW) (Adjusted)")) or num(r.get("Demand (MW)"))
        if d:
            vre = sum(gen[k] for k in gen if k.startswith("Solar") or k.startswith("Wind"))
            netload[t][ba] = d - vre
    return ci, fossil, netload

def mdt(t):  # MDT before Nov 1 2026
    return t - timedelta(hours=6)

def analyze(label, lmp, cong, ci, nodes):
    print(f"\n===== {label} (nodes: {', '.join(nodes)}) =====")
    hrs = sorted(t for t in lmp if all(n in lmp[t] for n in nodes))
    print("hours with all nodes:", len(hrs))
    # cross-node spread by local hour
    by_hb_spread = defaultdict(list); by_hb_spread_pnw = defaultdict(list)
    cheapest_count = defaultdict(int)
    within1 = 0
    for t in hrs:
        vals = {n: lmp[t][n] for n in nodes}
        hb = mdt(t).hour
        by_hb_spread[hb].append(max(vals.values()) - min(vals.values()))
        eda = [vals[n] for n in nodes if n != "SP15"]
        by_hb_spread_pnw[hb].append(max(eda) - min(eda))
        if max(eda) - min(eda) <= 1.0:
            within1 += 1
        cheapest_count[min(vals, key=vals.get)] += 1
    print(f"share of hours where PACE/PACW(/PGE) are within $1/MWh of each other: {within1/len(hrs):.1%}")
    print("cheapest node share of hours:", {k: f"{v/len(hrs):.0%}" for k, v in cheapest_count.items()})
    print("HB(MDT)  PACE mean  cross-node spread incl SP15 (mean)  spread excl SP15 (mean)")
    pace_by_hb = defaultdict(list)
    for t in hrs:
        pace_by_hb[mdt(t).hour].append(lmp[t]["PACE"])
    for hb in range(24):
        if by_hb_spread[hb]:
            print(f"  {hb:>2}   {st.mean(pace_by_hb[hb]):6.1f}   {st.mean(by_hb_spread[hb]):6.1f}   {st.mean(by_hb_spread_pnw[hb]):6.1f}")
    # within-PACE daily spread vs cross-node spread at the PACE daily peak hour
    days = defaultdict(list)
    for t in hrs:
        days[mdt(t).date()].append(t)
    time_spreads, space_at_peak, space_at_peak_pnw = [], [], []
    for d, ts in days.items():
        if len(ts) < 23:
            continue
        p = {t: lmp[t]["PACE"] for t in ts}
        tpk = max(p, key=p.get)
        time_spreads.append(max(p.values()) - min(p.values()))
        space_at_peak.append(p[tpk] - min(lmp[tpk][n] for n in nodes))
        space_at_peak_pnw.append(p[tpk] - min(lmp[tpk][n] for n in nodes if n != "SP15"))
    print(f"days: {len(time_spreads)}; median within-PACE daily max-min (time shift): ${st.median(time_spreads):.1f}")
    print(f"  median saving at PACE's priciest hour by moving to cheapest node (space shift, incl SP15): ${st.median(space_at_peak):.1f}")
    print(f"  ... excluding SP15 (EDAM PacifiCorp/PGE only): ${st.median(space_at_peak_pnw):.1f}")

    # A 4-hour deferrable block per day, PACE-homed, 24h window.
    # Policies: stay put at evening peak (baseline = run 17-21 MDT), time-only, space-only (same hours, cheapest node), both.
    res = defaultdict(list)
    for d, ts in days.items():
        ts = sorted(ts)
        if len(ts) < 24:
            continue
        base = [t for t in ts if 17 <= mdt(t).hour <= 20]
        if len(base) < 4:
            continue
        c_base = sum(lmp[t]["PACE"] for t in base)
        c_space = sum(min(lmp[t][n] for n in nodes) for t in base)
        # time-only: cheapest 4 contiguous hours in PACE
        best = min(sum(lmp[ts[i+k]]["PACE"] for k in range(4)) for i in range(len(ts)-3))
        best_both = min(sum(min(lmp[ts[i+k]][n] for n in nodes) for k in range(4)) for i in range(len(ts)-3))
        res["base"].append(c_base / 4); res["space"].append(c_space / 4)
        res["time"].append(best / 4); res["both"].append(best_both / 4)
    if res["base"]:
        b = st.mean(res["base"])
        for k in ("space", "time", "both"):
            v = st.mean(res[k])
            print(f"  4h block, avg $/MWh: baseline evening PACE {b:.1f} -> {k}: {v:.1f}  (saving {100*(b-v)/b:.0f}%)")

    # Carbon vs price disagreement: for each hour, cheapest node vs cleanest BA
    agree = tot = 0
    for t in hrs:
        if not all(BA_FOR[n] in ci.get(t, {}) for n in nodes):
            continue
        tot += 1
        cheap = min(nodes, key=lambda n: lmp[t][n])
        clean = min(nodes, key=lambda n: ci[t][BA_FOR[n]])
        agree += cheap == clean
    if tot:
        print(f"  hours where cheapest node == cleanest BA: {agree}/{tot} = {agree/tot:.0%}")
    # PACE carbon by hour, and PACE vs others
    print("  HB(MDT) mean derived CI g/kWh by BA:")
    acc = defaultdict(lambda: defaultdict(list))
    for t in hrs:
        for n in nodes:
            ba = BA_FOR[n]
            if ba in ci.get(t, {}):
                acc[mdt(t).hour][ba].append(ci[t][ba])
    for hb in (3, 9, 12, 15, 18, 20, 22):
        print("   ", hb, {ba: round(st.mean(v)) for ba, v in acc[hb].items() if v})

    # congestion component share at PACE
    cc = [abs(cong[t].get("PACE", 0)) for t in hrs]
    lm = [abs(lmp[t]["PACE"]) for t in hrs]
    print(f"  PACE congestion share of |LMP|: {sum(cc)/sum(lm):.1%}")

if __name__ == "__main__":
    ci, fossil, netload = load_ci()
    oct_lmp, oct_cong = load_lmp("oct")
    jul_lmp, jul_cong = load_lmp("jul")
    analyze("Oct 1-27 2026", oct_lmp, oct_cong, ci, ["PACE", "PACW", "PGE", "SP15"])
    analyze("Oct 1-27 2026 (EDAM PacifiCorp+PGE only)", oct_lmp, oct_cong, ci, ["PACE", "PACW", "PGE"])
    analyze("Jul 1-30 2026", jul_lmp, jul_cong, ci, ["PACE", "PACW", "SP15"])
    # PACE net-load ramp by hour (Oct) for grid-stress
    print("\nPACE mean net load (demand - wind - solar) by HB MDT, Oct 1-25:")
    acc = defaultdict(list)
    for t, d in netload.items():
        if "PACE" in d and t.month == 10:
            acc[mdt(t).hour].append(d["PACE"])
    print({hb: round(st.mean(v)) for hb, v in sorted(acc.items())})
