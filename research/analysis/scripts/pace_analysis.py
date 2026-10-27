import csv, sys, os, statistics
from datetime import datetime
from collections import defaultdict

D = sys.argv[1]
files = ["PACE_EIA930_BALANCE_2025_Jul_Dec.csv", "PACE_EIA930_BALANCE_2026_Jan_Jun.csv", "PACE_EIA930_BALANCE_2026_Jul_Dec.csv"]

def num(x):
    x = (x or "").replace(",", "").strip()
    if x == "":
        return None
    try:
        return float(x)
    except ValueError:
        return None

rows = []
for f in files:
    with open(os.path.join(D, f), newline="") as fh:
        r = csv.DictReader(fh)
        for row in r:
            lt = datetime.strptime(row["Local Time at End of Hour"], "%m/%d/%Y %I:%M:%S %p")
            ut = datetime.strptime(row["UTC Time at End of Hour"], "%m/%d/%Y %I:%M:%S %p")
            off = round((lt - ut).total_seconds() / 3600)
            g = lambda k: num(row.get(k))
            d = g("Demand (MW) (Adjusted)") or g("Demand (MW)")
            rec = dict(
                lt=lt, off=off, demand=d, fcst=g("Demand Forecast (MW)"),
                ng=g("Net Generation (MW) (Adjusted)") or g("Net Generation (MW)"),
                ti=g("Total Interchange (MW) (Adjusted)") or g("Total Interchange (MW)"),
                coal=g("Net Generation (MW) from Coal (Adjusted)"),
                gas=g("Net Generation (MW) from Natural Gas (Adjusted)"),
                hydro=g("Net Generation (MW) from Hydropower Excluding Pumped Storage (Adjusted)"),
                solar=g("Net Generation (MW) from Solar without Integrated Battery Storage (Adjusted)"),
                wind=g("Net Generation (MW) from Wind without Integrated Battery Storage (Adjusted)"),
                batt=g("Net Generation (MW) from Battery Storage (Adjusted)"),
                geo=g("Net Generation (MW) from Geothermal (Adjusted)"),
                other=g("Net Generation (MW) from Other Fuel Sources (Adjusted)"),
                unk=g("Net Generation (MW) from Unknown Fuel Sources (Adjusted)"),
            )
            rows.append(rec)

rows = [r for r in rows if r["demand"] is not None and r["demand"] > 0]
print("rows", len(rows), "range", min(r["lt"] for r in rows), "->", max(r["lt"] for r in rows))
print("UTC offsets seen:", sorted(set(r["off"] for r in rows)))

def z(v):
    return v or 0.0

# Peaks
top = sorted(rows, key=lambda r: -r["demand"])[:5]
print("\nTop 5 demand hours (local time = hour ending):")
for r in top:
    print(" ", r["lt"], int(r["demand"]), "MW")

def season(m):
    if m in (6, 7, 8, 9):
        return "summer(Jun-Sep)"
    if m in (12, 1, 2):
        return "winter(Dec-Feb)"
    return "shoulder"

by_season = defaultdict(list)
for r in rows:
    by_season[season(r["lt"].month)].append(r)
for s, rs in by_season.items():
    pk = max(rs, key=lambda r: r["demand"])
    mn = min(rs, key=lambda r: r["demand"])
    print(f"\n{s}: n={len(rs)} peak {int(pk['demand'])} MW at {pk['lt']}; min {int(mn['demand'])} MW at {mn['lt']}; mean {int(statistics.mean(r['demand'] for r in rs))} MW")

# monthly peak
mp = defaultdict(lambda: (0, None))
for r in rows:
    k = r["lt"].strftime("%Y-%m")
    if r["demand"] > mp[k][0]:
        mp[k] = (r["demand"], r["lt"])
print("\nMonthly peak demand (MW, local hour ending):")
for k in sorted(mp):
    print(" ", k, int(mp[k][0]), mp[k][1])

EF_LIFE = dict(coal=820, gas=490, hydro=24, solar=48, wind=11, geo=38, batt=0, other=700, unk=700)  # gCO2e/kWh lifecycle (IPCC AR5 medians); other/unk assumed

def profile(rs, label):
    hrs = defaultdict(list)
    for r in rs:
        hrs[r["lt"].hour if r["lt"].hour != 0 else 24].append(r)
    print(f"\n=== Hourly profile: {label} (hour ending local; n days ~{len(rs)//24}) ===")
    print("HE  demand  coal   gas  solar  wind  hydro  netload  interchg  fossil%  coal%  estCI(g/kWh)")
    out = {}
    for h in range(1, 25):
        rr = hrs.get(h, [])
        if not rr:
            continue
        m = lambda k: statistics.mean(z(x[k]) for x in rr)
        dem, coal, gas, sol, wnd, hyd, ti = m("demand"), m("coal"), m("gas"), m("solar"), m("wind"), m("hydro"), m("ti")
        gen_parts = {k: m(k) for k in EF_LIFE}
        gen_pos = sum(max(v, 0) for v in gen_parts.values())
        fossil = (max(coal, 0) + max(gas, 0)) / gen_pos * 100 if gen_pos else 0
        coalp = max(coal, 0) / gen_pos * 100 if gen_pos else 0
        ci = sum(max(v, 0) * EF_LIFE[k] for k, v in gen_parts.items()) / gen_pos if gen_pos else 0
        net = dem - sol - wnd
        out[h] = dict(dem=dem, net=net, sol=sol, ci=ci, ti=ti, fossil=fossil)
        print(f"{h:>2} {dem:7.0f} {coal:6.0f} {gas:5.0f} {sol:6.0f} {wnd:5.0f} {hyd:6.0f} {net:8.0f} {ti:9.0f} {fossil:7.1f} {coalp:6.1f} {ci:8.0f}")
    hmin = min(out, key=lambda h: out[h]["ci"]); hmax = max(out, key=lambda h: out[h]["ci"])
    print(f"cleanest HE{hmin} ({out[hmin]['ci']:.0f} g/kWh, fossil {out[hmin]['fossil']:.1f}%), dirtiest HE{hmax} ({out[hmax]['ci']:.0f} g/kWh, fossil {out[hmax]['fossil']:.1f}%), ratio {out[hmax]['ci']/out[hmin]['ci']:.2f}")
    hd = max(out, key=lambda h: out[h]["dem"]); hn = max(out, key=lambda h: out[h]["net"])
    print(f"avg demand peak HE{hd} ({out[hd]['dem']:.0f}); avg net-load peak HE{hn} ({out[hn]['net']:.0f}); solar peak {max(o['sol'] for o in out.values()):.0f}")
    # biggest 3-hour net load ramp
    best = max(range(1, 22), key=lambda h: out.get(h + 3, {"net": 0})["net"] - out.get(h, {"net": 0})["net"])
    print(f"steepest avg 3-hr net-load ramp HE{best}->HE{best+3}: +{out[best+3]['net']-out[best]['net']:.0f} MW")
    return out

summer26 = [r for r in rows if r["lt"].year == 2026 and r["lt"].month in (6, 7, 8)]
jul26 = [r for r in rows if r["lt"].year == 2026 and r["lt"].month == 7]
winter = [r for r in rows if (r["lt"].year == 2025 and r["lt"].month == 12) or (r["lt"].year == 2026 and r["lt"].month in (1, 2))]
oct26 = [r for r in rows if r["lt"].year == 2026 and r["lt"].month == 10]
profile(summer26, "Summer 2026 (Jun-Aug)")
profile(winter, "Winter 2025-26 (Dec-Feb)")
if oct26:
    profile(oct26, "October 2026 (to date)")

# daily evening ramp on summer days: per day max 3h increase of net load and when solar falls
ramps = []
days = defaultdict(dict)
for r in summer26:
    days[r["lt"].date()][r["lt"].hour] = r
for d, hs in days.items():
    nets = {h: z(hs[h]["demand"]) - z(hs[h]["solar"]) - z(hs[h]["wind"]) for h in hs}
    best = None
    for h in range(0, 21):
        if h in nets and h + 3 in nets:
            v = nets[h + 3] - nets[h]
            if best is None or v > best[0]:
                best = (v, h)
    if best:
        ramps.append(best)
if ramps:
    print(f"\nSummer 2026 daily max 3-hr net-load ramp: median {statistics.median(v for v,_ in ramps):.0f} MW, max {max(v for v,_ in ramps):.0f} MW; most common start hour-ending {statistics.mode(h for _,h in ramps)}")

# Forecast error at peak hours
errs = [abs(r["demand"] - r["fcst"]) / r["demand"] * 100 for r in rows if r["fcst"] and r["fcst"] > 1000]
print(f"\nDay-ahead demand forecast abs error (EIA-930 BA forecast): median {statistics.median(errs):.1f}%, p90 {sorted(errs)[int(len(errs)*0.9)]:.1f}% (n={len(errs)})")
