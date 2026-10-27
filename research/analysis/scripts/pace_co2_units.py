import zipfile, sys, re
import xml.etree.ElementTree as ET
z = zipfile.ZipFile(sys.argv[1]); want_dates = set(sys.argv[2:])
ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
ss = []
with z.open('xl/sharedStrings.xml') as f:
    for ev, el in ET.iterparse(f):
        if el.tag == ns + 'si':
            ss.append(''.join(t.text or '' for t in el.iter() if t.tag == ns + 't')); el.clear()
def col(ref): return re.match(r'[A-Z]+', ref).group(0)
header = None; last_ci = None
keep = ['Local time','Positive Generation','Consumed Electricity','CO2 Emissions: COL','CO2 Emissions: NG','Demand','NG: COL','NG: NG','NG: SUN','NG: WND','NG: WAT','Total interchange','CO2 Factor: COL','CO2 Factor: NG','CO2 Factor: OIL','CO2 Emissions Generated','CO2 Emissions Consumed','CO2 Emissions Intensity for Generated Electricity','CO2 Emissions Intensity for Consumed Electricity']
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
            header = {k: v for k, v in d.items()}; inv = {v: k for k, v in header.items()}; continue
        rec = {h: d.get(inv[h], '') for h in keep}
        if rec['CO2 Emissions Intensity for Generated Electricity']: last_ci = (d.get(inv['Local date']), d.get(inv['Hour']), rec['CO2 Emissions Intensity for Generated Electricity'], rec['CO2 Emissions Intensity for Consumed Electricity'])
        if d.get(inv['Local date']) in want_dates:
            print(d.get(inv['Local date']), d.get(inv['Hour']), {k: rec[k] for k in keep[1:]})
print('latest row with CO2 intensity (local date serial, hour, gen, consumed):', last_ci)
