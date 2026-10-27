// Display strings for numbers.json: en-US grouping, no em or en dashes, ranges say "to".
const grouped = (x: number, dp: number) =>
  x.toLocaleString("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });

// -0 would print as "-0.00"
const tidy = (x: number, dp: number) => {
  const r = Number(x.toFixed(dp));
  return Object.is(r, -0) ? 0 : r;
};

export const num = (x: number, dp = 0) => grouped(tidy(x, dp), dp);

export const usd = (x: number, dp = 2) => {
  const r = tidy(x, dp);
  return `${r < 0 ? "-" : ""}$${grouped(Math.abs(r), dp)}`;
};

export const pct = (x: number, dp = 0) => `${num(x, dp)}%`;

export const times = (x: number, dp = 1) => `${num(x, dp)}x`;

// Hour beginning, e.g. 18 -> "6pm", 0 -> "12am"
export const hourLabel = (h: number) =>
  `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;
