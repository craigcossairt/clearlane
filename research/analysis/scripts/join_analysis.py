import csv, sys, glob, os, statistics
from datetime import datetime, timedelta

eia_dir, jul_pat, oct_pat = sys.argv[1], sys.argv[2], sys.argv[3]

def num(x):
    x = (x or "").replace(",", "").strip()
    try:
        return float(x) if x else None
    except ValueError:
        return None

eia = {}
for f in glob.glob(os.path.join(eia_dir, "PACE_EIA930_BALANCE_2026_*.csv")):
    with open(f, newline="") as fh:
        for row in csv.DictReader(fh):
            lt = datetime.strptime(row["Local Time at End of Hour"], "%m/%d/%Y %I:%M:%S %p")
            g = lambda k: num(row.get(k)) or 0.0
            parts = dict(coal=g("Net Generation (MW) from Coal (Adjusted)"), gas=g("Net Generation (MW) from Natural Gas (Adjusted)"),
                         hydro=g("Net Generation (MW) from Hydropower Excluding Pumped Storage (Adjusted)"),
                         solar=g("Net Generation (MW) from Solar without Integrated Battery Storage (Adjusted)"),
                         wind=g("Net Generation (MW) from Wind without Integrated Battery Storage (Adjusted)"),
                         geo=g("Net Generation (MW) from Geothermal (Adjusted)"), other=g("Net Generation (MW) from Other Fuel Sources (Adjusted)"))
            pos = sum(max(v, 0) for v in parts.values())
            fossil = (max(parts["coal"], 0) + max(parts["gas"], 0)) / pos if pos else None
            dem = num(row.get("Demand (MW) (Adjusted)")) or num(row.get("Demand (MW)"))
            eia[lt - timedelta(hours=1)] = dict(dem=dem, fossil=fossil, solar=parts["solar"])  # key = hour beginning local

def load_lmp(pat):
    out = {}
    for f in glob.glob(pat):
        with open(f, newline="") as fh:
            for row in csv.DictReader(fh):
                if row["LMP_TYPE"] != "LMP":
                    continue
                t = datetime.strptime(row["INTERVALSTARTTIME_GMT"][:19], "%Y-%m-%dT%H:%M:%S") - timedelta(hours=6)
                out[t] = float(row["MW"])
    return out

def pearson(xs, ys):
    mx, my = statistics.mean(xs), statistics.mean(ys)
    num_ = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    den = (sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys)) ** 0.5
    return num_ / den

for label, pat in [("July 1-30 2026", jul_pat), ("Oct 1-25 2026", oct_pat)]:
    lmp = load_lmp(pat)
    keys = [k for k in lmp if k in eia and eia[k]["fossil"] is not None and eia[k]["dem"]]
    r_f = pearson([eia[k]["fossil"] for k in keys], [lmp[k] for k in keys])
    r_d = pearson([eia[k]["dem"] for k in keys], [lmp[k] for k in keys])
    print(f"{label}: joined hours {len(keys)}; corr(DA LMP, fossil share) = {r_f:.2f}; corr(DA LMP, demand) = {r_d:.2f}")
    # top-decile price hours vs bottom-decile: avg fossil share
    ks = sorted(keys, key=lambda k: lmp[k])
    n = len(ks) // 10
    lo, hi = ks[:n], ks[-n:]
    print(f"  cheapest 10% hours: avg LMP ${statistics.mean(lmp[k] for k in lo):.1f}, avg fossil {100*statistics.mean(eia[k]['fossil'] for k in lo):.1f}%, most common hour-beginning {statistics.mode(k.hour for k in lo)}")
    print(f"  priciest 10% hours: avg LMP ${statistics.mean(lmp[k] for k in hi):.1f}, avg fossil {100*statistics.mean(eia[k]['fossil'] for k in hi):.1f}%, most common hour-beginning {statistics.mode(k.hour for k in hi)}")

lmp = load_lmp(jul_pat)
print("\nJuly 20 2026 (PACE peak day) hour-beginning MDT: demand MW, solar MW, fossil %, DA LMP $/MWh")
for h in range(24):
    k = datetime(2026, 7, 20, h)
    e = eia.get(k, {})
    print(f" {h:>2}  {e.get('dem') or 0:6.0f}  {e.get('solar') or 0:5.0f}  {100*(e.get('fossil') or 0):5.1f}  {lmp.get(k, float('nan')):6.1f}")
