import statistics as st
from collections import defaultdict
from datetime import timedelta
from edam_where_vs_when import load_lmp, load_ci, mdt
for folder in ("oct", "jul"):
    lmp, _ = load_lmp(folder)
    days = defaultdict(list)
    for t in sorted(lmp):
        if "PACE" in lmp[t]:
            days[mdt(t).date()].append(t)
    jumps = defaultdict(int); sizes = []
    for d, ts in days.items():
        ts = sorted(ts)
        if len(ts) < 24: continue
        i = max(range(len(ts)-1), key=lambda i: lmp[ts[i+1]]["PACE"] - lmp[ts[i]]["PACE"])
        jumps[mdt(ts[i+1]).hour] += 1; sizes.append(lmp[ts[i+1]]["PACE"] - lmp[ts[i]]["PACE"])
    print(folder, "hour (MDT, hour-beginning) where each day's largest upward PACE DA step lands:", dict(sorted(jumps.items())), "median step $%.1f" % st.median(sizes), "n days", sum(jumps.values()))
