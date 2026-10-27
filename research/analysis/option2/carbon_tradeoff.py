"""Cost vs carbon for a 4-hour deferrable block, and break-even carbon price PACE vs PACW.
REAL: OASIS DAM LMPs (Oct 1-27, Jul 1-30). DERIVED: CI from EIA-930 mix x IPCC AR5 medians.
"""
import statistics as st
from collections import defaultdict
from datetime import timedelta
from edam_where_vs_when import load_lmp, load_ci, mdt, BA_FOR

ci, fossil, netload = load_ci()

def run(label, folder, nodes):
    lmp, _ = load_lmp(folder)
    hrs = sorted(t for t in lmp if all(n in lmp[t] for n in nodes) and all(BA_FOR[n] in ci.get(t, {}) for n in nodes))
    days = defaultdict(list)
    for t in hrs:
        days[mdt(t).date()].append(t)
    pol = defaultdict(lambda: [0.0, 0.0])  # cost $/MWh sum, CO2 kg/MWh sum
    nd = 0
    utah_share = defaultdict(list)
    for d, ts in days.items():
        ts = sorted(ts)
        if len(ts) < 24:
            continue
        base = [t for t in ts if 17 <= mdt(t).hour <= 20]
        if len(base) < 4:
            continue
        nd += 1
        P = lambda t, n: lmp[t][n]
        C = lambda t, n: ci[t][BA_FOR[n]]
        def add(name, picks):
            pol[name][0] += sum(P(t, n) for t, n in picks) / 4
            pol[name][1] += sum(C(t, n) for t, n in picks) / 4
            utah_share[name].append(sum(n == "PACE" for _, n in picks) / 4)
        add("stay: PACE 5-9pm", [(t, "PACE") for t in base])
        add("time only (cheapest 4h in PACE)", min(([(ts[i+k], "PACE") for k in range(4)] for i in range(len(ts)-3)), key=lambda p: sum(P(t, n) for t, n in p)))
        add("space only, price (same hours, cheapest node)", [(t, min(nodes, key=lambda n: P(t, n))) for t in base])
        add("space only, carbon (same hours, cleanest BA)", [(t, min(nodes, key=lambda n: C(t, n))) for t in base])
        # both, price-min (contiguous 4h window, node chosen per hour)
        def best(score):
            return min(([(ts[i+k], min(nodes, key=lambda n: score(ts[i+k], n))) for k in range(4)] for i in range(len(ts)-3)),
                       key=lambda p: sum(score(t, n) for t, n in p))
        add("both, price-min", best(P))
        add("both, carbon-min", best(C))
        for cp in (25, 50, 100, 200):
            add(f"both, price + ${cp}/t CO2", best(lambda t, n, cp=cp: P(t, n) + cp * C(t, n) / 1000.0))
    print(f"\n===== {label} ({nd} days, 4-hour block, nodes {nodes}) =====")
    b = pol["stay: PACE 5-9pm"]
    for k, (c, g) in pol.items():
        c, g = c / nd, g / nd
        print(f"  {k:48s} ${c:5.1f}/MWh ({100*(b[0]/nd-c)/(b[0]/nd):+4.0f}% cost)  {g:5.0f} g/kWh ({100*(b[1]/nd-g)/(b[1]/nd):+4.0f}% CO2)  Utah share {st.mean(utah_share[k]):.0%}")
    # break-even carbon price between PACE and PACW, per hour, where PACE is cheaper and dirtier
    be = defaultdict(list)
    for t in hrs:
        dp = lmp[t]["PACW"] - lmp[t]["PACE"]
        dc = ci[t]["PACE"] - ci[t]["PACW"]
        if dp > 0 and dc > 0:
            be[mdt(t).hour].append(dp / (dc / 1000.0))
    allbe = [v for vs in be.values() for v in vs]
    if allbe:
        print(f"  hours PACE cheaper AND dirtier than PACW: {len(allbe)}/{len(hrs)}; median break-even carbon price ${st.median(allbe):.0f}/t CO2 (p25 ${sorted(allbe)[len(allbe)//4]:.0f}, p75 ${sorted(allbe)[3*len(allbe)//4]:.0f})")
        for hb in (3, 12, 18, 20):
            if be[hb]:
                print(f"    HB{hb}: median ${st.median(be[hb]):.0f}/t over {len(be[hb])} hours")

run("Oct 1-27 2026, EDAM PacifiCorp+PGE", "oct", ["PACE", "PACW", "PGE"])
run("Oct 1-27 2026, incl SP15 (CISO carbon)", "oct", ["PACE", "PACW", "PGE", "SP15"])
run("Jul 1-30 2026, PACE/PACW/SP15", "jul", ["PACE", "PACW", "SP15"])

# Price step at the evening boundary (top-of-hour) in PACE, Oct
lmp, _ = load_lmp("oct")
steps = []
for t in sorted(lmp):
    if mdt(t).hour == 17 and (t + timedelta(hours=1)) in lmp and "PACE" in lmp[t]:
        steps.append(lmp[t + timedelta(hours=1)]["PACE"] - lmp[t]["PACE"])
print(f"\nPACE DA price jump HB17->HB18 MDT in Oct: median ${st.median(steps):.1f}, n={len(steps)}")
# Largest single-hour price jump each day, and which hour
jumps = defaultdict(int)
for t in sorted(lmp):
    tn = t + timedelta(hours=1)
    if tn in lmp and "PACE" in lmp[t] and "PACE" in lmp[tn]:
        pass
days = defaultdict(list)
for t in sorted(lmp):
    if "PACE" in lmp[t]:
        days[mdt(t).date()].append(t)
for d, ts in days.items():
    ts = sorted(ts)
    best = max(range(len(ts)-1), key=lambda i: lmp[ts[i+1]]["PACE"] - lmp[ts[i]]["PACE"])
    jumps[mdt(ts[best+1]).hour] += 1
print("hour (MDT) of each day's largest upward PACE price step, Oct:", dict(sorted(jumps.items())))
