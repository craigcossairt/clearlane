import csv, sys, glob, statistics
from datetime import datetime, timedelta
from collections import defaultdict

for label, pattern in [("July 1-30 2026", sys.argv[1]), ("Oct 1-25 2026", sys.argv[2])]:
    lmp = {}
    cong = {}
    for f in glob.glob(pattern):
        with open(f, newline="") as fh:
            for row in csv.DictReader(fh):
                t = datetime.strptime(row["INTERVALSTARTTIME_GMT"][:19], "%Y-%m-%dT%H:%M:%S")
                mt = t - timedelta(hours=6)  # MDT (both windows are in daylight time)
                if row["LMP_TYPE"] == "LMP":
                    lmp[mt] = float(row["MW"])
                elif row["LMP_TYPE"] == "MCC":
                    cong[mt] = float(row["MW"])
    byh = defaultdict(list)
    for t, v in lmp.items():
        byh[t.hour].append(v)
    print(f"\n=== PACE ELAP day-ahead LMP, {label} (hour beginning, MDT); n={len(lmp)} hours ===")
    print("HB  mean   median  max")
    for h in range(24):
        vs = byh[h]
        print(f"{h:>2} {statistics.mean(vs):6.1f} {statistics.median(vs):7.1f} {max(vs):6.1f}")
    means = {h: statistics.mean(byh[h]) for h in range(24)}
    lo = min(means, key=means.get); hi = max(means, key=means.get)
    print(f"cheapest hour HB{lo} ${means[lo]:.1f}/MWh; priciest HB{hi} ${means[hi]:.1f}/MWh; ratio {means[hi]/means[lo]:.2f}x")
    top = sorted(lmp.items(), key=lambda kv: -kv[1])[:5]
    print("top 5 hours:", [(t.strftime('%m-%d %H:00'), round(v, 1)) for t, v in top])
    # daily spread
    days = defaultdict(list)
    for t, v in lmp.items():
        days[t.date()].append(v)
    spreads = [max(v) - min(v) for v in days.values() if len(v) >= 23]
    print(f"daily max-min spread: median ${statistics.median(spreads):.1f}, max ${max(spreads):.1f} (n days {len(spreads)})")
    nz = sum(1 for v in cong.values() if abs(v) > 0.01)
    print(f"hours with nonzero congestion component: {nz} of {len(cong)}")
