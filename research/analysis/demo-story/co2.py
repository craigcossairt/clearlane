import zipfile, sys, re, statistics
import xml.etree.ElementTree as ET
from datetime import date, timedelta
from collections import defaultdict
z = zipfile.ZipFile(sys.argv[1])
ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
ss = []
with z.open('xl/sharedStrings.xml') as f:
    for ev, el in ET.iterparse(f):
        if el.tag == ns + 'si':
            ss.append(''.join(t.text or '' for t in el.iter() if t.tag == ns + 't')); el.clear()
def col(ref): return re.match(r'[A-Z]+', ref).group(0)
base = date(1899, 12, 30)
lo1, hi1 = date(2026, 10, 1), date(2026, 10, 25)
lo2, hi2 = date(2026, 7, 1), date(2026, 7, 31)
header = None
octb = defaultdict(list); julb = defaultdict(list); fos_oct = defaultdict(list)
with z.open('xl/worksheets/sheet1.xml') as f:
    for ev, el in ET.iterparse(f):
        if el.tag != ns + 'row': continue
        d = {}
        for c in el:
            v = c.find(ns + 'v'); val = v.text if v is not None else ''
            if c.get('t') == 's' and val: val = ss[int(val)]
            d[col(c.get('r'))] = val
        el.clear()
        if header is None:
            header = d; inv = {v: k for k, v in header.items()}; continue
        try:
            dt = base + timedelta(days=int(float(d.get(inv['Local date'], '') or 0)))
        except Exception:
            continue
        ci = d.get(inv['CO2 Emissions Intensity for Generated Electricity'], '')
        if not ci: continue
        hr = int(float(d.get(inv['Hour'])))
        g = float(ci) * 453.592
        if lo1 <= dt <= hi1: octb[hr].append(g)
        if lo2 <= dt <= hi2: julb[hr].append(g)
for name, b in [("Oct 1-25 2026", octb), ("Jul 2026", julb)]:
    print(f"== EIA PACE generated CO2 intensity, {name}, g/kWh by hour ending (local) ==")
    m = {h: statistics.mean(v) for h, v in b.items()}
    for h in sorted(m): print(f"HE{h:02d} {m[h]:5.0f}  n={len(b[h])}")
    lo = min(m, key=m.get); hi = max(m, key=m.get)
    print(f"cleanest HE{lo} {m[lo]:.0f}; dirtiest HE{hi} {m[hi]:.0f}; ratio {m[hi]/m[lo]:.2f}")
    def avg(hs): return statistics.mean(m[h] for h in hs)
    print(f"HE10-16 (9am-4pm) {avg(range(10,17)):.0f}; HE19-22 (6pm-10pm) {avg(range(19,23)):.0f}; HE2-6 (1am-6am) {avg(range(2,7)):.0f}")
