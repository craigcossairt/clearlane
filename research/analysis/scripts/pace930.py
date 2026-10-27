import csv, sys
path = sys.argv[1]
def num(s):
    s = (s or '').replace(',', '').strip()
    try: return float(s)
    except: return None
rows = [r for r in csv.DictReader(open(path, newline='', encoding='utf-8-sig')) if r['Balancing Authority'] == 'PACE']
print('PACE rows', len(rows))
print('first', rows[0]['UTC Time at End of Hour'], 'last', rows[-1]['UTC Time at End of Hour'])
# find latest row with non-empty demand and coal
def has(r, k): return num(r.get(k)) is not None
lastD = [r for r in rows if has(r, 'Demand (MW)')][-1]
lastF = [r for r in rows if has(r, 'Demand Forecast (MW)')][-1]
lastC = [r for r in rows if has(r, 'Net Generation (MW) from Coal')][-1]
print('latest demand', lastD['UTC Time at End of Hour'], lastD['Demand (MW)'])
print('latest forecast', lastF['UTC Time at End of Hour'], lastF['Demand Forecast (MW)'])
print('latest coal', lastC['UTC Time at End of Hour'])
fuels = ['Coal','Natural Gas','Nuclear','All Petroleum Products','Hydropower Excluding Pumped Storage','Solar without Integrated Battery Storage','Solar with Integrated Battery Storage','Wind without Integrated Battery Storage','Wind with Integrated Battery Storage','Battery Storage','Geothermal','Other Fuel Sources','Unknown Fuel Sources']
# show a recent full day of fuel mix (use Adjusted when present? file has Imputed and Adjusted variants per fuel?)
cols = list(rows[0].keys())
print('n columns', len(cols)); print([c for c in cols if 'Coal' in c])
# pick the last 24 rows that have coal values
day = [r for r in rows if has(r, 'Net Generation (MW) from Coal')][-24:]
# emission factors gCO2/kWh, direct combustion, illustrative (see report for sources)
EF = {'Coal': 1000, 'Natural Gas': 400, 'All Petroleum Products': 900}
for r in day:
    gen = {f: (num(r.get('Net Generation (MW) from ' + f)) or 0.0) for f in fuels}
    tot = sum(v for v in gen.values() if v > 0)
    co2 = sum(EF.get(f, 0) * max(v, 0) for f, v in gen.items())
    ci = co2 / tot if tot else None
    print(r['Local Time at End of Hour'], 'D', r['Demand (MW)'], 'DF', r['Demand Forecast (MW)'], 'coal', gen['Coal'], 'gas', gen['Natural Gas'], 'solar', gen['Solar without Integrated Battery Storage'], 'wind', gen['Wind without Integrated Battery Storage'], 'hydro', gen['Hydropower Excluding Pumped Storage'], 'batt', gen['Battery Storage'], 'TI', r['Total Interchange (MW)'], 'gen-mix CI~', round(ci) if ci else None)
