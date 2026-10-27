import sys, importlib.util, statistics
R = sys.argv[1]
spec = importlib.util.spec_from_file_location("n", sys.argv[2])
import io, contextlib
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    n = importlib.util.module_from_spec(spec); sys.argv = ["x", R]; spec.loader.exec_module(n)
prices = n.prices
loc = [(i + 1) % 24 for i in range(24)]  # snapshot index 0 = hour beginning 1am MT
by_hour = n.by_hour
def crash(socs, acts, label):
    bad = [loc[i] for i in range(24) if not (min(socs[i], socs[i+1]) >= 0.1 - 1e-9 and acts[i] < 1.0 - 1e-6)]
    out = []
    for name, shift in [("local", 0), ("UTC->MDT", 6), ("UTC->MST", 7)]:
        m = sum(by_hour[(h + shift) % 24] for h in bad)
        out.append(f"{name} {m}/359={m/359:.0%}")
    print(f"{label}: cannot answer in hours {sorted(bad)} -> " + "; ".join(out))
# unconstrained price-only
v, s, a = n.dp(prices, soc0=0.1, soc_end=0.1)
crash(s, a, f"price-only (value ${v:.2f}/MW-day)")
# wear-priced: subtract $W per MWh discharged by adding to price on discharge -> emulate by DP on modified prices is not exact; do brute force with wear in objective
def dp_wear(price, W, soc_min=0.0, dis_cap=1.0, P=1.0, E=2.0, soc0=0.1, soc_end=0.1):
    STEPS=n.STEPS; ETA=n.ETA; dz=E/STEPS; L=[i*dz for i in range(STEPS+1)]; T=len(price); NEG=-1e18
    V=[[NEG]*(STEPS+1) for _ in range(T+1)]
    ie=round(soc_end/dz)
    for j in range(STEPS+1):
        if j>=ie: V[T][j]=0.0
    pol=[[None]*(STEPS+1) for _ in range(T)]
    for t in range(T-1,-1,-1):
        for j in range(STEPS+1):
            if L[j]<soc_min-1e-9: continue
            best=NEG;arg=None
            for k in range(STEPS+1):
                if L[k]<soc_min-1e-9 or V[t+1][k]==NEG: continue
                d=L[k]-L[j]
                if d>0:
                    g=-d/ETA
                    if -g>P+1e-9: continue
                    c=0
                else:
                    g=-d*ETA
                    if g>dis_cap+1e-9: continue
                    c=W*g
                val=price[t]*g-c+V[t+1][k]
                if val>best: best,arg=val,(k,g)
            V[t][j]=best;pol[t][j]=arg
    j=round(soc0/dz);socs=[L[j]];acts=[]
    for t in range(T):
        k,g=pol[t][j];acts.append(g);j=k;socs.append(L[j])
    gross=sum(price[t]*acts[t] for t in range(T))
    return V[0][round(soc0/dz)],gross,socs,acts
for W in (0, 10, 15):
    net, gross, s, a = dp_wear(prices, W)
    dis = sum(x for x in a if x > 0)
    print(f"wear ${W}/MWh: gross ${gross:.2f}/MW-day, discharged {dis:.2f} MWh/MW, hours " + str([loc[i] for i in range(24) if abs(a[i])>1e-6]))
    crash(s, a, f"  wear {W} price-only")
# Clearlane battery-only variant: hold 0.1 MWh and 0.25 MW headroom (ASSUMPTION call = 25% of power)
net, gross, s, a = dp_wear(prices, 10, soc_min=0.1, dis_cap=0.75)
print(f"battery-only with reserve (0.1 MWh, 25% headroom), wear 10: gross ${gross:.2f}/MW-day")
# backtest with wear 10 over July and Oct
for label, pat in [("July", f"{R}/oasis/dam_jul/*.csv"), ("Oct", f"{R}/oasis/dam_oct/*.csv")]:
    days = n.load_dam(pat)
    g = [dp_wear(days[d], 10)[1] for d in sorted(days)]
    print(f"{label}: wear-10 gross mean ${statistics.mean(g):.2f}/MW-day -> ${statistics.mean(g)*365:,.0f}/MW-yr if every day alike")
