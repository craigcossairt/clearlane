# For Rocky Mountain Power: a day-ahead envelope

Clearlane writes an hourly operating envelope for simulated Torus-style stations on PacifiCorp East. It is a planning artifact. It is not a filing, and it is not a claim about how Torus operates today.

## What the envelope carries

Schema `clearlane.envelope/v1`. One row per hour:

- System Critical Hours, under our proposed rule. No Utah or Wyoming docket defines that term. Torus asked ROWE, in June 2026, for a transparent definition. https://rowesternenergy.org/wp-content/uploads/2026/06/Consolidated-Spring-Workshop-Comments_06222026.pdf
- Reserve kW held for calls.
- Max charge kW and max discharge kW after host ceilings.
- Planned kW, charge positive and discharge negative.
- A one-line reason, in plain words.

The envelope is a format Clearlane proposes. Torus does not know whether Lasso's API accepts an outside schedule or envelope (Torus, message to Craig Cossairt, Oct 27 2026), so we do not say it does.

## The value, and whose it is

On the reference day, a battery on our fixed off-peak rule is worth `{fixed_usd_mw_day}` per MW-day. The Clearlane timetable is worth `{clearlane_usd_mw_day}` per MW-day, about `{race_ratio}` the off-peak rule.

At `{mou_70mw}` MW, that is `{fixed_70}` a day against `{clearlane_70}` a day. Those figures assume every MW behaves like the reference station and the fleet does not move prices.

Every dollar here is value to RMP's system at day-ahead prices, not Torus revenue, not a host bill cut. It is not a settlement.

CO2 is estimated, using average emissions for PacifiCorp East, not marginal: the off-peak rule adds about `{co2_added_70}` a day at that scale, and the timetable avoids about `{co2_avoided_70}`. Average emissions can differ from marginal.

## The call

Spin, sized to the enrolled kW, covers one call of about five and a half minutes. A second call inside the refill window is the case the crash card shows, including any shortfall.

The 2025 heatmap is in Mountain time (Torus, message to Craig Cossairt, Oct 27 2026). In the backtest, calls missed: Clearlane `{calls_missed_by_policy_clearlane_mt}`, the fixed overnight rule `{calls_missed_by_policy_fixed_overnight_mt}`, price-only `{calls_missed_by_policy_price_only_mt}`.
