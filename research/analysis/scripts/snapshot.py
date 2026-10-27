import csv, glob, json, os, sys, datetime as dt
import xml.etree.ElementTree as ET
D = sys.argv[1]
def utc(s): return dt.datetime.fromisoformat(s.replace('-00:00', '+00:00')).astimezone(dt.timezone.utc)
rows = {}
def put(t, k, v): rows.setdefault(t, {})[k] = v
for r in csv.DictReader(open(glob.glob(os.path.join(D, 'caiso5', '*.csv'))[0])):
    if r['XML_DATA_ITEM'] == 'LMP_PRC':
        put(utc(r['INTERVALSTARTTIME_GMT']), 'da_lmp_' + r['NODE'].replace('-APND', '').lower(), round(float(r['MW']), 2))
for r in csv.DictReader(open(glob.glob(os.path.join(D, 'caiso2', '*.csv'))[0])):
    if r['XML_DATA_ITEM'] == 'LMP_CONG_PRC':
        put(utc(r['INTERVALSTARTTIME_GMT']), 'da_congestion_pace', round(float(r['MW']), 2))
for r in csv.DictReader(open(glob.glob(os.path.join(D, 'caiso3', '*.csv'))[0])):
    if r['TAC_AREA_NAME'] == 'PACE':
        put(utc(r['INTERVALSTARTTIME_GMT']), 'da_load_fcst_pace_mw', float(r['MW']))
ns = '{http://www.caiso.com/soa/EDAMWindAndSolarForecast_v1.xsd}'
root = ET.parse(glob.glob(os.path.join(D, 'caiso4', '*.xml'))[0]).getroot()
for x in root.iter(ns + 'REPORT_DATA'):
    f = {c.tag.replace(ns, ''): c.text for c in x}
    if f['BAA_GRP_ID'] == 'PACE':
        t = utc(f['INTERVAL_START_GMT']); put(t, 'edam_solar_fcst_pace_mw', float(f['SOLAR'])); put(t, 'edam_wind_fcst_pace_mw', float(f['WIND']))
om = json.load(open(os.path.join(D, 'openmeteo', 'fc.json'), encoding='utf-8'))
off = dt.timedelta(seconds=-om['utc_offset_seconds'])
for i, t in enumerate(om['hourly']['time']):
    tu = (dt.datetime.fromisoformat(t) + off).replace(tzinfo=dt.timezone.utc)
    if tu in rows:
        put(tu, 'slc_temp_c', om['hourly']['temperature_2m'][i]); put(tu, 'slc_ghi_wm2', om['hourly']['shortwave_radiation'][i]); put(tu, 'slc_cloud_pct', om['hourly']['cloud_cover'][i])
cols = sorted({k for v in rows.values() for k in v})
out = os.path.join(D, 'pace_snapshot_2026-10-27.csv')
with open(out, 'w', newline='') as fh:
    w = csv.writer(fh); w.writerow(['interval_start_utc', 'local_mt'] + cols)
    for t in sorted(rows):
        w.writerow([t.isoformat(), (t - dt.timedelta(hours=6)).strftime('%m-%d %H:%M')] + [rows[t].get(c, '') for c in cols])
print('wrote', out, len(rows), 'rows'); print(open(out).read())
