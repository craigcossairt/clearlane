# For a host: the meter stays under the ceiling

Clearlane plans a day for a simulated Torus-style station on your site. Pulse runs the timetable. Spin stays ready for a Rocky Mountain Power call. Charging is capped so the 15-minute meter does not set a new peak.

## What you see

The host meter, in kW, against a ceiling of `{host_ceiling_kw}`. The ceiling is the month-to-date 15-minute peak the plan must not cross. It is simulated for the stage site.

During a call, and while Spin refills, the meter line stays at or under that ceiling. The enrolled commitment on the stage site is `{enrolled_kw}`.

## Why kW, not dollars

Rocky Mountain Power's Utah sheets bill demand on the 15-minute interval (Schedules 6, 6A and 8, P.S.C.U. No. 52, effective August 10, 2026). That interval is verified. The dollar rate is not what we show.

Schedule 6 has no time-of-day window, so a midday charge and a 6pm charge set the same demand charge. The host result that matters on that sheet is whether the 15-minute peak moved.

Riders adjust the posted base rates. We have not applied them. No host savings figure until that is done. Detail: `pitch/research-tariff.md`.

## What is simulated

The station, the host load, and the call are simulated. Prices on the ribbon are the real day-ahead prices for PacifiCorp East. The plan is derived from those prices and from the ceiling.
