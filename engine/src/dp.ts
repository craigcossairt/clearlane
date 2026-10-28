// The one DP. Backward pass over SoC levels, then a forward trace from the start level.
// Mirrors fix.py dp_wear operation for operation (L[i] = i * dz, the 1e-9 tolerances, next level
// ascending with strictly greater winning) so the hourly mode reproduces it exactly.
//
// Energy is in "units" (MWh in the hourly mode, kWh in the 15-minute mode); `to_mwh` converts.
// Grid energy g follows fix.py: + is discharge to the grid, - is charge from the grid.
// Optional price impact (ff_price_impact): the price at step t moves by impact[t] x g, so discharge
// lowers it and charging raises it. The reward still depends only on that step's action, so the DP
// stays exact. Absent or 0, the step is a price taker and the arithmetic is unchanged.

export interface DpInput {
  price: number[]; // $/MWh per step
  levels: number; // levels + 1 states
  dz: number; // units per level
  eta: number; // one-way efficiency
  charge_max: number[]; // per step, grid units drawn, >= 0
  discharge_max: number[]; // per step, grid units delivered, may be < 0 (forces charging)
  W: number; // $/MWh on grid-side discharge
  soc_min: number; // units
  start_level: number;
  end_level: number; // terminal SoC must be at or above this level
  to_mwh: number;
  tol?: number;
  impact?: number[]; // per step, $/MWh per grid unit injected, >= 0
}

export interface DpResult {
  feasible: boolean;
  objective: number; // value minus wear
  gross: number; // value at prices, gross of wear
  socs: number[]; // units, steps + 1
  acts: number[]; // grid units per step, + discharge
  level_path: number[]; // steps + 1
}

const NEG = -1e18;

export function solveDp(x: DpInput): DpResult {
  const T = x.price.length;
  const N = x.levels;
  const tol = x.tol ?? 1e-9;
  const L = Array.from({ length: N + 1 }, (_, i) => i * x.dz);
  const V: Float64Array[] = Array.from({ length: T + 1 }, () =>
    new Float64Array(N + 1).fill(NEG),
  );
  const polK: Int32Array[] = Array.from({ length: T }, () =>
    new Int32Array(N + 1).fill(-1),
  );
  const polG: Float64Array[] = Array.from(
    { length: T },
    () => new Float64Array(N + 1),
  );
  for (let j = 0; j <= N; j++) if (j >= x.end_level) V[T]![j] = 0;

  for (let t = T - 1; t >= 0; t--) {
    const Vn = V[t + 1]!;
    const p = x.price[t]!;
    const cmax = x.charge_max[t]!;
    const dmax = x.discharge_max[t]!;
    const kq = x.impact?.[t] ?? 0;
    for (let j = 0; j <= N; j++) {
      if (L[j]! < x.soc_min - tol) continue;
      let best = NEG;
      let argK = -1;
      let argG = 0;
      for (let k = 0; k <= N; k++) {
        if (L[k]! < x.soc_min - tol || Vn[k] === NEG) continue;
        const d = L[k]! - L[j]!;
        let g: number;
        let c: number;
        if (d > 0) {
          g = -d / x.eta;
          if (-g > cmax + tol) continue;
          c = 0;
        } else {
          g = -d * x.eta;
          if (g > dmax + tol) continue;
          c = x.W * g;
        }
        const pe = kq === 0 ? p : p - kq * g;
        const val = (pe * g - c) * x.to_mwh + Vn[k]!;
        if (val > best) {
          best = val;
          argK = k;
          argG = g;
        }
      }
      V[t]![j] = best;
      polK[t]![j] = argK;
      polG[t]![j] = argG;
    }
  }

  const feasible = V[0]![x.start_level]! > NEG / 2;
  let j = x.start_level;
  const socs = [L[j]!];
  const acts: number[] = [];
  const level_path = [j];
  for (let t = 0; t < T; t++) {
    const k = feasible ? polK[t]![j]! : j;
    acts.push(feasible ? polG[t]![j]! : 0);
    j = k;
    socs.push(L[j]!);
    level_path.push(j);
  }
  let gross = 0;
  for (let t = 0; t < T; t++) {
    const kq = x.impact?.[t] ?? 0;
    const pe = kq === 0 ? x.price[t]! : x.price[t]! - kq * acts[t]!;
    gross += pe * acts[t]! * x.to_mwh;
  }
  return {
    feasible,
    objective: feasible ? V[0]![x.start_level]! : NEG,
    gross,
    socs,
    acts,
    level_path,
  };
}
