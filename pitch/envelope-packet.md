# The Clearlane envelope: a working example, not a filing

Clearlane plans a day for simulated Torus-style stations on PacifiCorp East and writes the plan as an hourly operating envelope. The envelope is a format Clearlane proposes. It is a working example, not a filing, and it is not a claim about how Torus or Lasso operate today. Torus has not reviewed or endorsed it.

The sample in `pitch/torus-kit/sample-envelope.json` is one simulated station, enrolled at `{enrolled_kw}` kW, on the reference day.

## Fields in `clearlane.envelope/v1`

| Field              | Unit                | Meaning                                                                     |
| ------------------ | ------------------- | --------------------------------------------------------------------------- |
| `schema`           | text                | Always `clearlane.envelope/v1`, so a reader knows which field list applies. |
| `operating_day_mt` | date, Mountain time | The operating day the plan covers, as year, month and day.                  |
| `fleet_kw`         | kW                  | Enrolled fleet power the envelope speaks for.                               |
| `sch_rule`         | text                | Our proposed System Critical Hours rule, stated in words.                   |
| `generated_utc`    | timestamp, UTC      | When the plan was written, the evening before.                              |
| `hours`            | list of rows        | One row per hour of the operating day, in order.                            |
| `ts_utc`           | timestamp, UTC      | Start of the hour. Mountain time is for display only.                       |
| `system_critical`  | true or false       | Whether the hour is a System Critical Hour under our proposed rule.         |
| `reserve_kw`       | kW                  | Fleet power held back for Rocky Mountain Power's calls.                     |
| `max_charge_kw`    | kW                  | Most the fleet may charge in the hour, after host ceilings.                 |
| `max_discharge_kw` | kW                  | Most the fleet may discharge in the hour.                                   |
| `planned_kw`       | kW                  | Planned net power: charging positive, discharging negative.                 |
| `reason`           | text                | Why the hour looks the way it does, in plain words.                         |

## System Critical Hours: our proposal

Our rule: the four highest net-load hours of the day, plus every jam hour. In those hours Pulse keeps enough spare power to cover any part of the enrolled kW that Spin cannot. On the reference day the rule marks `{sch_hours_today}` hours.

No Utah or Wyoming docket defines System Critical Hours. Torus asked the Western resource adequacy program, ROWE, to define them, and said it has no definition of its own to push. The rule above is ours, offered as one worked answer, not as Torus's view.

<!-- pagebreak -->

## What Torus asked ROWE for

Torus's June 2026 comments to ROWE, the Western resource adequacy program. This is a regional filing, not a Utah docket. Short quotes from the consolidated comments file:

- Torus asks the program to "Define BTM dispatchability standards that recognize scheduled and utility-directed operating envelopes".
- On System Critical Hours, Torus "does not advocate for a specific SCH definition at this stage."
- And it says the "specific SCH definition methodology remains an area for further development."

Source: https://rowesternenergy.org/wp-content/uploads/2026/06/Consolidated-Spring-Workshop-Comments_06222026.pdf

The envelope is our attempt at what a scheduled operating envelope could look like, so that a conversation about standards has a concrete example to point at.

## How to read the reference day

The midday rows charge Pulse in the clear lane, and `max_charge_kw` drops where the host's meter would otherwise set a new peak; the host ceiling is `{host_ceiling_kw}` kW. The evening rows are System Critical Hours: Spin holds the full reserve and Pulse discharges into the jam.

On that day the clear-lane plan is worth `{clearlane_usd_mw_day}` per MW-day against `{fixed_usd_mw_day}` for a fixed off-peak rule, about `{race_ratio}` as much. That is value to RMP's system at day-ahead prices, not Torus revenue and not a host bill cut. The off-peak rule is our baseline, not Torus practice.

## What it is not

- Not a filing, a tariff proposal or a settlement.
- Not Torus practice, and not endorsed by Torus.
- Not a Lasso replacement. Whether Lasso's API accepts an outside schedule or envelope is an open question, so we do not say it does.
- Not a forecast of Rocky Mountain Power's calls. The call times in the demo are simulated, set beside Torus's published 2025 record.
