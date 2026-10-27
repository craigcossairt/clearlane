import csv, sys
R = sys.argv[1]
rows = list(csv.DictReader(open(f"{R}/data/pace_snapshot_2026-10-27.csv")))
price = {}  # local hour beginning -> $/MWh (snapshot index 0 = 1am)
for i, r in enumerate(rows): price[(i + 1) % 24] = float(r["da_lmp_elap_pace"])
# EIA PACE generated CO2, Oct 1-25 2026 average, by hour ENDING (from co2.py); convert to hour beginning h -> HE h+1
he = {1:697,2:697,3:695,4:694,5:698,6:704,7:709,8:698,9:623,10:534,11:485,12:461,13:455,14:450,15:443,16:446,17:464,18:531,19:629,20:673,21:676,22:682,23:684,24:693}
ci = {h: he[h + 1] for h in range(24)}
RTE = 0.88
def run(name, chg_hours, dis_hours, E=2.0):
    # 1 MW / 2 MWh; deliver E*sqrt? keep simple: charge grid energy Cg so stored = E, discharge E*RTE to grid
    Cg = E / RTE ** 0.5; Dg = E * RTE ** 0.5
    cost = sum(price[h] for h in chg_hours) * Cg / len(chg_hours)
    rev = sum(price[h] for h in dis_hours) * Dg / len(dis_hours)
    co2_add = sum(ci[h] for h in chg_hours) * Cg / len(chg_hours) / 1000
    co2_avoid = sum(ci[h] for h in dis_hours) * Dg / len(dis_hours) / 1000
    print(f"{name:34s} charge {chg_hours} discharge {dis_hours}: value ${rev-cost:6.2f}/MW-day; charge cost ${cost/Cg:5.2f}/MWh; charge CO2 {co2_add/Cg*1000:4.0f} g/kWh; net CO2 {co2_avoid-co2_add:+.3f} t/MW-day")
    return rev - cost, co2_avoid - co2_add
h1 = run("habit: charge 1-5am, discharge 6-8pm", [1,2,3,4], [18,19])
p1 = run("timetable: charge 1-4pm, discharge 6-8pm", [13,14,15], [18,19])
print(f"timetable vs habit: value x{p1[0]/h1[0]:.2f}; net CO2 {h1[1]:+.3f} -> {p1[1]:+.3f} t/MW-day")
for mw in (70, 500):
    print(f"{mw} MW: habit ${h1[0]*mw:,.0f}/day, {h1[1]*mw:+.1f} t CO2/day ; timetable ${p1[0]*mw:,.0f}/day, {p1[1]*mw:+.1f} t CO2/day")
