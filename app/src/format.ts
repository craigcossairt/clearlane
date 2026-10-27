/** Format values that already came from the bundle or the engine stub. */

export function usdPerMw(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function usdDay(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

export function grouped(n: number, digits: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

export function ratio1(n: number): string {
  return `${n.toFixed(1)}x`;
}

export function mwFromKw(kw: number): string {
  return `${grouped(kw / 1000, 1)} MW`;
}

export function clock(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const suffix = h < 12 ? "am" : "pm";
  const face = h % 12 === 0 ? 12 : h % 12;
  return `${face}${suffix}`;
}
