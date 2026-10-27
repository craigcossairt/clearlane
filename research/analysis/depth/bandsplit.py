"""SIMULATED feasibility check of the Spin / Pulse / compute band split for a 300 MW AI campus.

Every load parameter here is an ASSUMPTION (labeled). Sourced anchors only:
 - training power energy concentrates at 0.2-3 Hz (Microsoft/OpenAI/NVIDIA arXiv 2508.14318)
 - AI sites swing ~40% -> 100% load within fractions of a second (ERCOT Aug 2025 deck)
 - Spin 10C, 25,000 cycles; Pulse 0.5C, 7,500 cycles (Torus Station page, company-reported)
"""
import numpy as np
from scipy.signal import welch

rng = np.random.default_rng(7)
fs = 50.0                       # Hz, so the 0.1-20 Hz band is observable (Nyquist 25 Hz)
T = 2 * 3600                    # 2 simulated hours
t = np.arange(0, T, 1 / fs)
n = len(t)

# ---- ASSUMED campus load ----
P_campus = 300.0                # MW
sync_share = 0.60               # share of campus in one synchronized training job (assumption)
P_job = P_campus * sync_share   # 180 MW
f0 = 0.5                        # Hz training iteration rate (inside the sourced 0.2-3 Hz band)
duty = 0.6                      # compute-phase share of each iteration (assumption)
# square-ish wave with jittered period and ~50 ms edges
phase = np.cumsum(f0 * (1 + 0.03 * rng.standard_normal(n)) / fs)
frac = phase % 1.0
edge = 0.05 * f0                # edge width in cycles
sq = 0.5 * (np.tanh((frac) / edge) - np.tanh((frac - duty) / edge))
sq = np.clip(sq, 0, 1)
job = P_job * (0.4 + 0.6 * sq)  # 40% -> 100% of job power (ERCOT-style swing)
# checkpoint stalls: every 20 min, 30 s at 40% (assumption)
for k in range(0, T, 1200):
    s, e = int((k + 600) * fs), int((k + 630) * fs)
    job[s:e] = P_job * 0.4
# rest of campus: other jobs, slow drift + small noise (assumption)
rest = (P_campus - P_job) * (0.85 + 0.05 * np.sin(2 * np.pi * t / 3600)) + 2.0 * rng.standard_normal(n)
# a job-mix step at t=50 min: 40 MW of other jobs finish (assumption)
rest[t > 3000] -= 40.0
load = job + rest

def ema(x, tau):
    if tau <= 0:
        return x.copy()
    a = 1.0 / (1.0 + tau * fs)
    y = np.empty_like(x)
    y[0] = x[0]
    # vectorized via scipy lfilter
    from scipy.signal import lfilter
    y = lfilter([a], [1, -(1 - a)], x, zi=[x[0] * (1 - a)])[0]
    return y

def ramp_max(x):
    return np.max(np.abs(np.diff(x))) * fs   # MW/s

def band_share(x, lo=0.1, hi=20.0):
    f, p = welch(x - x.mean(), fs=fs, nperseg=int(fs * 120))
    tot = np.trapezoid(p, f)
    m = (f >= lo) & (f <= hi)
    return np.trapezoid(p[m], f[m]), tot, f, p

def turning_points(x):
    d = np.diff(x)
    keep = np.where(np.sign(d[1:]) != np.sign(d[:-1]))[0] + 1
    return np.concatenate([[x[0]], x[keep], [x[-1]]])

def rainflow(x):
    """ASTM-style 3-point rainflow on turning points; returns list of (range, count)."""
    tp = turning_points(x)
    stack, out = [], []
    for v in tp:
        stack.append(v)
        while len(stack) >= 3:
            X = abs(stack[-1] - stack[-2]); Y = abs(stack[-2] - stack[-3])
            if X < Y:
                break
            if len(stack) == 3:
                out.append((Y, 0.5)); stack.pop(0)
            else:
                out.append((Y, 1.0)); last = stack.pop(); stack.pop(); stack.pop(); stack.append(last)
    for i in range(len(stack) - 1):
        out.append((abs(stack[i + 1] - stack[i]), 0.5))
    return out

def wear(power_mw, cap_mwh, rated_cycles, m=None, endurance=None):
    """power_mw: discharge-positive power the device supplies. Returns per-day metrics."""
    soc = -np.cumsum(power_mw) / fs / 3600.0     # MWh relative
    dis = np.sum(np.clip(power_mw, 0, None)) / fs / 3600.0
    days = T / 86400.0
    efc_day = dis / cap_mwh / days                # throughput reading
    cyc = rainflow(soc)
    count_day = sum(c for r, c in cyc if r > 1e-6) / days  # every oscillation counted
    out = dict(efc_day=efc_day, life_years_efc=rated_cycles / efc_day / 365 if efc_day > 0 else np.inf,
               osc_day=count_day, life_hours_count=rated_cycles / count_day * 24 if count_day > 0 else np.inf,
               soc_swing_mwh=soc.max() - soc.min())
    if m is not None:
        dmg = sum(c * (r / cap_mwh) ** m for r, c in cyc if r / cap_mwh > (endurance or 0))
        dmg_day = dmg / days                      # full-cycle equivalents per day (Miner, S-N exponent m)
        out["fatigue_fce_day"] = dmg_day
        out["life_years_fatigue"] = rated_cycles / dmg_day / 365 if dmg_day > 0 else np.inf
    return out

print(f"campus mean {load.mean():.0f} MW, min {load.min():.0f}, max {load.max():.0f}; raw ramp max {ramp_max(load):,.0f} MW/s")
b, tot, f, p = band_share(load)
print(f"raw: {b/tot*100:.1f}% of load variance in 0.1-20 Hz; std {load.std():.1f} MW")

print("\nCrossover sweep (Spin takes everything faster than tau; grid sees EMA(load, tau)):")
print(" tau_s  grid_ramp_MW/s  grid_0.1-20Hz_std_MW  spin_P_MW  spin_E_need_MWh  spin_cap_MWh(10C)  spin_EFC/day  spin_life_yr(EFC)  spin_life_h(count)  spin_life_yr(fatigue m=3)")
for tau in (2, 10, 30, 120, 300):
    grid = ema(load, tau)
    spin = load - grid                       # Spin discharges when load > grid draw
    P = np.max(np.abs(spin))
    cap = max(P / 10.0, 1e-6)                # 10C sizing: energy = power / 10 h
    w = wear(spin, cap, 25000, m=3, endurance=0.001)
    bb, tt, _, _ = band_share(grid)
    print(f" {tau:5d}  {ramp_max(grid):14.2f}  {np.sqrt(bb):20.2f}  {P:9.1f}  {w['soc_swing_mwh']:15.2f}  {cap:17.2f}  {w['efc_day']:12.1f}  {w['life_years_efc']:17.2f}  {w['life_hours_count']:18.2f}  {w['life_years_fatigue']:25.1f}")

# Counterfactual: Pulse (0.5C, 7,500 cycles) sized for curtailment at 100 MW / 200 MWh absorbs the same fast band
tau = 30
grid = ema(load, tau)
fast = load - grid
for cap in (200.0,):
    w = wear(fast, cap, 7500, m=None)
    print(f"\nPulse {cap:.0f} MWh taking the fast band (tau {tau}s): EFC/day {w['efc_day']:.2f} -> life {w['life_years_efc']:.1f} yr on throughput reading; oscillations/day {w['osc_day']:,.0f}")
print(f"Pulse {200:.0f} MWh doing one arbitrage cycle/day plus ~22 curtailment events/yr instead: ~{7500/(365+22):.1f} yr (throughput reading)")

f2, praw = welch(load - load.mean(), fs=fs, nperseg=int(fs * 120))
_, pgrid = welch(grid - grid.mean(), fs=fs, nperseg=int(fs * 120))
for lo, hi, name in ((0.0, 0.5, "<0.5 Hz inter-area"), (0.5, 5, "0.5-5 Hz local swing"), (5, 25, "5-25 Hz torsional (part)")):
    m = (f2 >= lo) & (f2 < hi)
    print(f"band {name}: raw {np.sqrt(np.trapezoid(praw[m], f2[m])):.2f} MW rms -> grid {np.sqrt(np.trapezoid(pgrid[m], f2[m])):.3f} MW rms (tau {tau}s)")
