"""Duke-style curtailment-enabled headroom on PACE EIA-930 hourly demand (DERIVED).

Our implementation, not Duke's code. Curtailment rate = curtailed energy / (L * hours),
i.e. share of the new load's maximum annual uptime. Ceiling rule is a parameter:
  annual  = max demand in the 12-month window
  seasonal = max demand of the season the hour belongs to (summer Jun-Sep, winter Nov-Mar, shoulder otherwise)
"""
import csv, sys, os
from datetime import datetime
import numpy as np

R = sys.argv[1]
files = [os.path.join(R, "eia930", "EIA930_BALANCE_2025_Jul_Dec.csv"),
         os.path.join(R, "eia930", "EIA930_BALANCE_2026_Jan_Jun.csv"),
         os.path.join(R, "data", "eia930", "EIA930_BALANCE_2026_Jul_Dec.csv")]

def num(x):
    x = (x or "").replace(",", "").strip()
    try:
        return float(x) if x else None
    except ValueError:
        return None

rows = {}
for f in files:
    with open(f, newline="") as fh:
        r = csv.reader(fh)
        hdr = next(r)
        i_ba = hdr.index("Balancing Authority")
        i_lt = hdr.index("Local Time at End of Hour")
        i_d = hdr.index("Demand (MW)")
        i_da = hdr.index("Demand (MW) (Adjusted)")
        for row in r:
            if row[i_ba] != "PACE":
                continue
            lt = datetime.strptime(row[i_lt], "%m/%d/%Y %I:%M:%S %p")
            d = num(row[i_da]) or num(row[i_d])
            if d and d > 0:
                rows[lt] = d

ts = sorted(rows)
# 12-month window ending at the last full day
end = datetime(2026, 10, 26, 0, 0)
start = datetime(2025, 10, 26, 1, 0)
ts = [t for t in ts if start <= t <= end]
D = np.array([rows[t] for t in ts])
# clean the known implausible hour(s): anything < 2500 MW replaced by neighbor mean
bad = np.where(D < 2500)[0]
for b in bad:
    D[b] = np.mean([D[max(b - 1, 0)], D[min(b + 1, len(D) - 1)]])
H = len(D)
print(f"hours {H}  window {ts[0]} -> {ts[-1]}  cleaned {len(bad)} bad hours  peak {D.max():.0f} MW at {ts[int(D.argmax())]}")

def season(m):
    if m in (6, 7, 8, 9):
        return 0
    if m in (11, 12, 1, 2, 3):
        return 1
    return 2

S = np.array([season(t.month) for t in ts])
ceil_annual = np.full(H, D.max())
ceil_season = np.array([D[S == s].max() for s in S])

def curtail(L, ceil):
    return np.clip(D + L - ceil, 0, L)

def rate(L, ceil):
    return curtail(L, ceil).sum() / (L * H)

def solve(target, ceil):
    lo, hi = 1.0, 20000.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if rate(mid, ceil) > target:
            hi = mid
        else:
            lo = mid
    return lo

def events(c):
    on = c > 0
    ev = []
    i = 0
    while i < H:
        if on[i]:
            j = i
            while j < H and on[j]:
                j += 1
            ev.append((i, j))
            i = j
        else:
            i += 1
    return ev

for name, ceil in [("annual", ceil_annual), ("seasonal", ceil_season)]:
    print(f"\n=== ceiling rule: {name} ===")
    for target in (0.0025, 0.005, 0.01):
        L = solve(target, ceil)
        c = curtail(L, ceil)
        ev = events(c)
        hrs = int((c > 0).sum())
        durs = [j - i for i, j in ev]
        half = (c[c > 0] <= 0.5 * L).mean() if hrs else float("nan")
        months = {}
        hours_of_day = {}
        for i, j in ev:
            for k in range(i, j):
                months[ts[k].strftime("%b")] = months.get(ts[k].strftime("%b"), 0) + 1
                he = ts[k].hour  # hour ending local
                hours_of_day[he] = hours_of_day.get(he, 0) + 1
        maxE = max(c[i:j].sum() for i, j in ev) if ev else 0
        print(f" rate {target*100:.2f}%: headroom {L:,.0f} MW | curtailed hours {hrs} | events {len(ev)} | mean dur {np.mean(durs):.2f} h | max dur {max(durs)} h | hours needing <=50% curtail {half*100:.0f}% | largest event energy {maxE:,.0f} MWh")
        print(f"   months {months}")
        print(f"   hour-ending local {dict(sorted(hours_of_day.items()))}")

# The Utah grid-connected cohort under construction: 2,602 MW total minus 1,700 MW BTM/off-grid = 902 MW (legislative brief arithmetic)
for L in (300.0, 902.0, 2602.0):
    for name, ceil in [("annual", ceil_annual), ("seasonal", ceil_season)]:
        c = curtail(L, ceil)
        ev = events(c)
        hrs = int((c > 0).sum())
        durs = [j - i for i, j in ev] or [0]
        maxE = max((c[i:j].sum() for i, j in ev), default=0)
        print(f"\nnew load {L:,.0f} MW ({name}): rate {rate(L, ceil)*100:.3f}% | curtailed hours {hrs} | events {len(ev)} | mean dur {np.mean(durs):.2f} h | max dur {max(durs)} h | max event energy {maxE:,.0f} MWh | max curtail depth {c.max():,.0f} MW")

# Pulse sizing coverage for a 300 MW campus as a pro-rata slice of the 902 MW cohort (annual ceiling)
L = 902.0
c = curtail(L, ceil_annual) * (300.0 / 902.0)
ev = events(c)
print("\n300 MW campus slice of 902 MW cohort (annual ceiling): per-event (hours, MWh, peak MW):")
print("  ", [(j - i, round(c[i:j].sum()), round(c[i:j].max())) for i, j in ev])
tot = c.sum()
for P in (25, 50, 75, 100, 150):
    E = 2 * P  # 0.5C: 2-hour battery
    covered = 0.0
    for i, j in ev:
        e_left = E
        for k in range(i, j):
            take = min(c[k], P, e_left)
            covered += take
            e_left -= take
    print(f"   Pulse {P} MW / {E} MWh (0.5C): covers {covered/tot*100 if tot else 0:.0f}% of curtailed energy ({tot:.0f} MWh/yr); residual to compute {tot-covered:.0f} MWh/yr")
