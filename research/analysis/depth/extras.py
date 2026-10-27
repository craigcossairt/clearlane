"""Event calendar for the 902 MW cohort (DERIVED) + GPU power-floor energy cost at real PACE DA prices (SIMULATED load, REAL price)."""
import csv, sys, os
from datetime import datetime
import numpy as np

R = sys.argv[1]
files = [os.path.join(R, "eia930", "EIA930_BALANCE_2025_Jul_Dec.csv"),
         os.path.join(R, "eia930", "EIA930_BALANCE_2026_Jan_Jun.csv"),
         os.path.join(R, "data", "eia930", "EIA930_BALANCE_2026_Jul_Dec.csv")]
rows = {}
for f in files:
    with open(f, newline="") as fh:
        r = csv.reader(fh); hdr = next(r)
        ib, il, idd, ida = hdr.index("Balancing Authority"), hdr.index("Local Time at End of Hour"), hdr.index("Demand (MW)"), hdr.index("Demand (MW) (Adjusted)")
        for row in r:
            if row[ib] != "PACE":
                continue
            v = (row[ida] or row[idd]).replace(",", "").strip()
            if v and float(v) > 2500:
                rows[datetime.strptime(row[il], "%m/%d/%Y %I:%M:%S %p")] = float(v)
ts = [t for t in sorted(rows) if datetime(2025, 10, 26, 1) <= t <= datetime(2026, 10, 26, 0)]
D = np.array([rows[t] for t in ts]); ceil = D.max()
L = 902.0
c = np.clip(D + L - ceil, 0, L)
ev, i = [], 0
while i < len(c):
    if c[i] > 0:
        j = i
        while j < len(c) and c[j] > 0:
            j += 1
        ev.append((i, j)); i = j
    else:
        i += 1
print(f"902 MW cohort, ceiling {ceil:.0f} MW: {len(ev)} events")
for a, b in sorted(ev, key=lambda e: -c[e[0]:e[1]].sum())[:6]:
    print(f"  {ts[a]} HE -> {ts[b-1]} HE: {b-a} h, {c[a:b].sum():,.0f} MWh, peak {c[a:b].max():.0f} MW (300 MW campus slice: {c[a:b].sum()*300/902:,.0f} MWh)")

# Real PACE DA LMP for Oct 27 2026 (snapshot) and July 2026 mean
lmp = []
with open(os.path.join(R, "data", "pace_snapshot_2026-10-27.csv"), newline="") as fh:
    for row in csv.DictReader(fh):
        lmp.append(float(row["da_lmp_elap_pace"]))
lmp = np.array(lmp)
print(f"\nOct 27 DA LMP PACE: mean ${lmp.mean():.2f}, min ${lmp.min():.2f}, max ${lmp.max():.2f}")

# GPU power floor ('burner') alternative for the fast band, using the SAME assumed job as bandsplit.py
P_job, comm_share, floor_now = 180.0, 0.4, 0.4
for floor_new in (0.55, 0.7, 0.85):
    waste_mw = (floor_new - floor_now) * P_job * comm_share
    swing_left = (1 - floor_new) / (1 - floor_now)
    for price, label in ((lmp.mean(), "Oct 27 DA mean"), (31.01, "July 2026 DA mean")):
        print(f"  floor {floor_now:.0%}->{floor_new:.0%}: wastes {waste_mw:.1f} MW avg = {waste_mw*24:,.0f} MWh/day = ${waste_mw*8760*price/1e6:.2f}M/yr at {label} ${price:.2f}; Spin power needed falls to {swing_left:.0%}")

# Pulse 100 MW / 200 MWh daily arbitrage on Oct 27 at real prices (RTE assumption 0.90)
order = np.argsort(lmp)
ch, dis = order[:2], order[-2:]
rev = 100 * 0.9 * lmp[dis].sum() - 100 * lmp[ch].sum()
print(f"\nPulse 100 MW/200 MWh, 2 h charge at ${lmp[ch].mean():.2f} avg, 2 h discharge at ${lmp[dis].mean():.2f} avg, RTE 0.90 (assumed): ${rev:,.0f} for Oct 27")
