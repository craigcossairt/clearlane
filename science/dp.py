"""Independent price-only DP over Pulse state of charge (issue #107). Stdlib only.

Written from the planner spec in docs/plan/synthesis.json and docs/lanes/engine.md section 6.4
(levels, limits at the meter, sqrt(RTE) on each leg, terminal level), never from engine code.
Used by science/crosscheck.py to re-derive the backtest's price_only values day by day.

Sign convention: grid_kwh > 0 is energy sold to the grid (discharge), < 0 is energy bought (charge).
"""
import math

NEG_INF = float("-inf")
EPS = 1e-9

# Site and planner inputs for price_only (docs/lanes/engine.md 6.4; public/derived/site_default.json)
PULSE_KW = 250.0
PULSE_KWH = 500.0
LEVELS = 40               # 41 states
RTE = 0.88                # ASSUMPTION
START_LEVEL = 2           # 25 kWh, start and minimum end
EXPORT_LIMIT_KW = 0.0     # ASSUMPTION; price_only keeps it
STEP_H = 0.25             # 15-minute steps, 96 a day


def reach(level_kwh, eta, charge_kw, discharge_kw, step_h):
    """Largest number of levels one step can move up (charge) and down (discharge) at the meter."""
    up = 0
    while (up + 1) * level_kwh / eta <= charge_kw * step_h + EPS:
        up += 1
    down = 0
    while (down + 1) * level_kwh * eta <= discharge_kw * step_h + EPS:
        down += 1
    return up, down


def _limit(x, t):
    return x[t] if isinstance(x, (list, tuple)) else x


def solve(prices, levels, level_kwh, eta, start_level, end_level, step_h, charge_kw, discharge_kw):
    """Maximize sum(price x grid MWh) over len(prices) steps.

    charge_kw and discharge_kw are limits at the meter (a number, or one per step). Terminal value is
    0 at or above end_level and minus infinity below it. Returns value_usd, levels (len T+1) and grid_kwh.
    """
    T = len(prices)
    n = levels + 1
    v_next = [0.0 if j >= end_level else NEG_INF for j in range(n)]
    choice = [None] * T
    for t in range(T - 1, -1, -1):
        price = prices[t]
        cmax = _limit(charge_kw, t) * step_h + EPS
        dmax = _limit(discharge_kw, t) * step_h + EPS
        v = [NEG_INF] * n
        best_k = [0] * n
        for j in range(n):
            bv, bk = NEG_INF, j
            for k in range(n):
                if v_next[k] == NEG_INF:
                    continue
                d = (k - j) * level_kwh
                if d > 0:
                    grid = -d / eta
                    if -grid > cmax:
                        continue
                elif d < 0:
                    grid = -d * eta
                    if grid > dmax:
                        continue
                else:
                    grid = 0.0
                val = price * grid / 1000.0 + v_next[k]
                if val > bv:
                    bv, bk = val, k
            v[j], best_k[j] = bv, bk
        choice[t] = best_k
        v_next = v
    if v_next[start_level] == NEG_INF:
        raise ValueError("end level unreachable from the start level")
    path, grid_kwh = [start_level], []
    for t in range(T):
        j = path[-1]
        k = choice[t][j]
        d = (k - j) * level_kwh
        grid_kwh.append(-d / eta if d > 0 else (-d * eta if d < 0 else 0.0))
        path.append(k)
    return {"value_usd": v_next[start_level], "levels": path, "grid_kwh": grid_kwh}


def stored_cycles(levels, level_kwh, pulse_kwh):
    """Equivalent full Pulse cycles on stored energy (#213): kWh that leaves the store over the day,
    divided by the usable capacity. Read off the level path, so it does not depend on the efficiency split.
    """
    out = sum(max(0, levels[t] - levels[t + 1]) for t in range(len(levels) - 1)) * level_kwh
    return out / pulse_kwh


def price_only_day(lmp24, host_kw_15m, pulse_kw=PULSE_KW, pulse_kwh=PULSE_KWH, levels=LEVELS, rte=RTE,
                   start_level=START_LEVEL, export_limit_kw=EXPORT_LIMIT_KW):
    """One Mountain day of the price_only policy, in $ per MW-day (value / (pulse_kw / 1000))."""
    if len(lmp24) != 24 or len(host_kw_15m) != 96:
        raise ValueError("need 24 hourly prices and 96 host-load intervals")
    prices = [lmp24[t // 4] for t in range(96)]
    discharge = [min(pulse_kw, host_kw_15m[t] + export_limit_kw) for t in range(96)]
    r = solve(prices, levels=levels, level_kwh=pulse_kwh / levels, eta=math.sqrt(rte),
              start_level=start_level, end_level=start_level, step_h=STEP_H,
              charge_kw=pulse_kw, discharge_kw=discharge)
    discharged = sum(g for g in r["grid_kwh"] if g > 0)
    return {"usd_per_mw_day": r["value_usd"] / (pulse_kw / 1000.0), "value_usd": r["value_usd"],
            "discharged_kwh": discharged, "levels": r["levels"],
            "pulse_cycles": stored_cycles(r["levels"], pulse_kwh / levels, pulse_kwh)}
