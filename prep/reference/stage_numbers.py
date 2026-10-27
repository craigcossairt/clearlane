# Source: research/analysis/demo-story/numbers.py. Oracle copy: do not change the arithmetic.
"""Scratch numbers for the Clearlane concept. Stdlib only. Reads cached research data; writes nothing but stdout.
Assumptions are flagged ASSUMPTION. Real inputs: CAISO OASIS DAM CSVs (cached), pace_snapshot_2026-10-27.csv,
Torus 2025 VPP heatmap counts (torus-cases-a.findings.md line 10)."""
import csv, glob, statistics, sys
from datetime import datetime, timedelta
from collections import defaultdict

R = sys.argv[1]

# ---------- 1. Tomorrow (Oct 27) snapshot: net load, cliff, spread ----------
with open(f"{R}/data/pace_snapshot_2026-10-27.csv", newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
print("=== Oct 27 PACE snapshot (hour beginning MT) ===")
net = []
for r in rows:
    h = r["local_mt"][-5:]
    ld = float(r["da_load_fcst_pace_mw"]); so = float(r["edam_solar_fcst_pace_mw"]); wi = float(r["edam_wind_fcst_pace_mw"])
    p = float(r["da_lmp_elap_pace"])
    n = ld - so - wi
    net.append((r["local_mt"], ld, so, wi, n, p))
    print(f"{r['local_mt']}  load {ld:6.0f}  solar {so:6.0f}  wind {wi:6.0f}  net {n:6.0f}  lmp {p:6.2f}  sp15 {float(r['da_lmp_th_sp15_gen']):6.2f}")
mn = min(net[8:18], key=lambda x: x[4]); mx = max(net, key=lambda x: x[4])
print(f"min daytime net load {mn[4]:.0f} at {mn[0]}; max net load {mx[4]:.0f} at {mx[0]}; rise {mx[4]-mn[4]:.0f} MW")
best3 = max(range(len(net)-3), key=lambda i: net[i+3][4]-net[i][4])
print(f"steepest 3h net-load rise: {net[best3][0]} -> {net[best3+3][0]}: {net[best3+3][4]-net[best3][4]:+.0f} MW")
prices = [x[5] for x in net[:24]]
srt = sorted(range(24), key=lambda i: prices[i])
print("cheapest 4 hours:", [(net[i][0][-5:], prices[i]) for i in srt[:4]])
print("priciest 4 hours:", [(net[i][0][-5:], prices[i]) for i in srt[-4:]])
night = [prices[i] for i in range(0, 5)]
print(f"overnight 1am-5am mean ${statistics.mean(night):.2f}; 9am-4pm mean ${statistics.mean(prices[8:16]):.2f}; 6pm-10pm mean ${statistics.mean(prices[17:21]):.2f}")

# ---------- 2. Battery DP: 1 MW / 2 MWh Pulse-like (0.5C per Torus Pulse page) ----------
RTE = 0.88  # ASSUMPTION round-trip efficiency (not a Torus spec)
ETA = RTE ** 0.5
STEPS = 40  # SOC grid: 2 MWh / 40 = 0.05 MWh

def dp(price, P=1.0, E=2.0, soc0=None, soc_min=0.0, soc_end=None, dis_cap=None):
    """Hourly DP over discretized SOC. Returns (value $, soc path, action path MW (+dis,-chg) at meter)."""
    dis_cap = P if dis_cap is None else dis_cap
    dz = E / STEPS
    levels = [i * dz for i in range(STEPS + 1)]
    n = len(price)
    if soc0 is None: soc0 = E / 2
    i0 = round(soc0 / dz)
    iend = None if soc_end is None else round(soc_end / dz)
    NEG = -1e18
    V = [[NEG] * (STEPS + 1) for _ in range(n + 1)]
    for j in range(STEPS + 1):
        if iend is None or j >= iend:
            V[n][j] = 0.0
    pol = [[None] * (STEPS + 1) for _ in range(n)]
    for t in range(n - 1, -1, -1):
        for j in range(STEPS + 1):
            if levels[j] < soc_min - 1e-9: continue
            best = NEG; arg = None
            for k in range(STEPS + 1):
                if levels[k] < soc_min - 1e-9 or V[t + 1][k] == NEG: continue
                d = levels[k] - levels[j]  # energy into storage
                if d > 0:
                    grid = -d / ETA  # charging from grid
                    if -grid > P + 1e-9: continue
                else:
                    grid = -d * ETA  # discharging to meter
                    if grid > dis_cap + 1e-9: continue
                v = price[t] * grid + V[t + 1][k]
                if v > best: best, arg = v, (k, grid)
            V[t][j] = best; pol[t][j] = arg
    j = i0; socs = [levels[j]]; acts = []
    for t in range(n):
        k, g = pol[t][j]; acts.append(g); j = k; socs.append(levels[j])
    return V[0][i0], socs, acts

print("\n=== Oct 27 plan, 1 MW / 2 MWh, start & end at 0.1 MWh ===")
val, socs, acts = dp(prices, soc0=0.1, soc_end=0.1)
print(f"price-only plan value ${val:.2f}/MW-day")
for i in range(24):
    if abs(acts[i]) > 1e-6:
        print(f"  {net[i][0][-5:]}  {'DIS' if acts[i]>0 else 'CHG'} {acts[i]:+.2f} MW at ${prices[i]}")

# ---------- 3. Backtest over cached July + October DAM ----------
def load_dam(pattern):
    lmp = {}
    for f in glob.glob(pattern):
        with open(f, newline="", encoding="utf-8") as source:
            file_rows = list(csv.DictReader(source))
        for row in file_rows:
            if row["NODE"] != "ELAP_PACE-APND" or row["LMP_TYPE"] != "LMP": continue
            t = datetime.strptime(row["INTERVALSTARTTIME_GMT"][:19], "%Y-%m-%dT%H:%M:%S") - timedelta(hours=6)
            lmp[t] = float(row["MW"])
    days = defaultdict(dict)
    for t, v in lmp.items(): days[t.date()][t.hour] = v
    return {d: [h[i] for i in range(24)] for d, h in days.items() if len(h) == 24}

for label, pat in [("July 2026", f"{R}/data/oasis/dam_jul/*.csv"), ("Oct 1-25 2026", f"{R}/data/oasis/dam_oct/*.csv")]:
    days = load_dam(pat)
    vals = []
    for d in sorted(days):
        v, _, _ = dp(days[d], soc0=0.1, soc_end=0.1)
        vals.append(v)
    print(f"\n{label}: {len(vals)} days; price-only 1MW/2MWh daily value mean ${statistics.mean(vals):.2f}, median ${statistics.median(vals):.2f}, min ${min(vals):.2f}, max ${max(vals):.2f}")
    print(f"  -> annualized if every day were like this: ${statistics.mean(vals)*365:,.0f} per MW-year")

# ---------- 4. Torus 2025 crash calls vs a price-only Pulse ----------
by_hour = [9, 41, 5, 4, 1, 3, 4, 14, 23, 26, 25, 20, 15, 33, 19, 14, 14, 8, 6, 4, 5, 34, 24, 8]  # 12am..11pm, sums 359
assert sum(by_hour) == 359
# hourly SOC path for Oct 27 plan above, steady-state day (start=end)
need = 0.1  # MWh per MW for a 6-min full-power call (Spin 'full discharge in 6 minutes'; calls ~5-6 min)
def failing_hours(socs, acts, P=1.0):
    bad = []
    for h in range(24):
        energy_ok = min(socs[h], socs[h + 1]) >= need - 1e-9
        headroom_ok = acts[h] < P - 1e-6  # already at full discharge -> no headroom
        if not (energy_ok and headroom_ok): bad.append(h)
    return bad
bad = failing_hours(socs, acts)
print("\n=== Crash calls (Torus 2025 heatmap) vs Oct 27 price-only Pulse plan ===")
print("hours where price-only Pulse can't answer a full-power 6-min call:", bad)
for name, shift in [("chart = local time", 0), ("chart = UTC, read as MDT (UTC-6)", 6), ("chart = UTC, read as MST (UTC-7)", 7)]:
    # local hour h corresponds to chart hour (h + shift) % 24
    missed = sum(by_hour[(h + shift) % 24] for h in bad)
    print(f"  {name}: {missed} of 359 calls ({missed/359:.0%}) land in those hours")
# rush-hour windows
for name, shift in [("local", 0), ("UTC->MDT", 6), ("UTC->MST", 7)]:
    rush = sum(by_hour[(h + shift) % 24] for h in range(18, 22))
    empty = sum(by_hour[(h + shift) % 24] for h in list(range(20, 24)) + list(range(0, 10)))
    print(f"  [{name}] calls in 6-10pm: {rush} ({rush/359:.0%}); calls 8pm-10am: {empty} ({empty/359:.0%})")

# ---------- 5. Pulse cycle wear ----------
print(f"\nOne full cycle/day = 365 cycles/yr vs Pulse 7,500 rated -> {7500/365:.1f} years; Spin 359 calls/yr vs 25,000 -> {25000/359:.0f} years (company-reported ratings)")

# ---------- 6. Fleet scale-ups on Oct 27 ----------
for mw in (70, 500):
    print(f"Fleet {mw} MW / {2*mw} MWh on Oct 27: price-only value ${val*mw:,.0f}; discharge {sum(a for a in acts if a>0)*mw:,.0f} MWh into hours {[net[i][0][-5:] for i in range(24) if acts[i]>0]}")

# ---------- 7. AI campus: 100 MW, 25% for 3 h (Emerald Phoenix anchor) ----------
flex = 25.0; hrs = 3
rush = sorted(range(24), key=lambda i: -prices[i])[:hrs]
clean = sorted(range(8, 17), key=lambda i: prices[i])[:hrs]
d_val = flex * (sum(prices[i] for i in rush) - sum(prices[i] for i in clean))
print(f"\nAI campus 100 MW, shift 25 MW x 3h from {[net[i][0][-5:] for i in rush]} to {[net[i][0][-5:] for i in clean]}: {flex*hrs:.0f} MWh, ${d_val:,.0f} at Oct 27 DA prices")
