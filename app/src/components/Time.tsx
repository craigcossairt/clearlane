/**
 * Time labels. Always America/Denver through Intl with "en-US", never the machine's time
 * zone (CI runs in UTC).
 */
const TZ = "America/Denver";

export function hourLabel(hourMt: number): string {
  const h = ((hourMt % 24) + 24) % 24;
  const face = h % 12 === 0 ? 12 : h % 12;
  return `${face}${h < 12 ? "am" : "pm"}`;
}

export function mtClock(utc: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  })
    .format(new Date(utc))
    .replace(" AM", "am")
    .replace(" PM", "pm");
}

export function mtDate(day: string): string {
  // A Mountain day YYYY-MM-DD, shown as e.g. "Tue, Oct 27, 2026". Noon UTC keeps it on that date.
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${day}T18:00:00Z`));
}

export function Time({
  children,
  axis,
}: {
  children: string;
  axis?: boolean;
}) {
  return axis ? (
    <tspan data-axis="">{children}</tspan>
  ) : (
    <span data-time="">{children}</span>
  );
}
