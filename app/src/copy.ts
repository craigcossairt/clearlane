/**
 * Judge-facing strings live here so Pitch reviews one file. No em dashes, American English,
 * plain words. Numbers never appear in copy: they come from numbers.json or the engine.
 */
export const COPY = {
  title: "Clearlane",
  node: "ELAP_PACE-APND",
  dayToday: "Today",
  dayTomorrow: "Tomorrow (day-ahead)",
  dayCached: "Cached, from",
  snapshotFetched: "Snapshot, fetched",
  mt: "MT",
  stubBanner: "Engine stub: not engine output",
  chipLegend:
    "REAL: measured market data. DERIVED: computed from it. SIMULATED: our model, not a real site. TORUS PUBLISHED: from Torus's own pages. ASSUMPTION: a stated input. MEASURED: timed live on this laptop.",
  failedTitle: "This day cannot be shown",
  notComputed: "not computed",
  unavailable: "unavailable",
  failed: "failed",
  loading: "loading",

  fixedLabel: "Battery on the off-peak rule",
  clearlaneLabel: "Simulated Torus-style station on Clearlane",
  priceOnlyLabel: "Battery-only plan",
  valueToSystem: "value to RMP's system at day-ahead prices",
  co2Caveat:
    "Average-emissions estimate (EIA hourly); marginal emissions can differ.",
  mouCeiling: "MOU ceiling, not installed capacity",
  priceTaker: "Assumes the fleet does not move prices",
  schLabel: "System Critical Hours (our proposal)",
  closeLine1: "In Utah, compute should follow the sun in time, not in space.",
  closeLine2:
    "Clearlane: fill up when the road is clear, and keep Spin ready for the crash.",

  axisCaption: "hour beginning, Mountain time",
  ribbonTitle: "Traffic report",
  ribbonSubtitle:
    "Day-ahead price for PacifiCorp East, colored by lane: clear when power is cheap, jammed after the evening step.",
  ribbonAria:
    "Twenty-four hours of day-ahead price, each hour labeled Clear, Shoulder or Jam, with solar forecast and net load",
  ribbonLegendBars: "Bars: day-ahead price, colored and labeled by lane",
  ribbonLegendSolar: "Gold area: solar forecast, scaled to its own peak",
  ribbonLegendNet: "Ink line: net load, scaled to its own peak",
  ribbonPeak1: "Price jumps",
  ribbonPeak2: "by the peak hour,",
  ribbonFrom: "from",
  ribbonTo: "to",
  ribbonMw: "MW",
  ribbonNet: "Net load climbs",
  ribbonSolar: "as the solar forecast falls from",
  ribbonLanes1: "Clear means a price at or under",
  ribbonLanes2: "; jam means at or over",
  ribbonLanes3: ". In October the evening price step landed in the same hour on",
  ribbonOf: "of",
  ribbonStep: "days.",
  raceTitle: "The race",
  raceEnd: "End of the day.",
  raceHint:
    "Space plays the day. Same station, two timetables. The left station is our baseline, not Torus practice.",
  raceCardsPending:
    "End cards stay in this space and fill in when the day finishes.",
  perMwDay: "per MW-day",
  perDayAtMou: "per day at the MOU size",
  raceRatioTail: "the off-peak rule",
  co2AddedAt70: "t of carbon dioxide a day added at the MOU size.",
  co2AvoidedAt70: "t of carbon dioxide a day avoided at the MOU size.",
  spinHeld: "Spin held for calls",
  noSpin: "No Spin on this baseline",
  spinWord: "Spin",
  pulseWord: "Pulse",
  cyclesToday: "Pulse cycles today:",
  cyclesBudget: ". Budget:",
  cyclesBudgetTail: "cycles a year.",
  meterCaption: "Host meter, quarter-hour peak",
  meterCeiling: "against a ceiling of",
  meterAria: "Host quarter-hour meter in kW against the dashed ceiling line",
  crashTitle: "The call",
  crashBanner: "Simulated Rocky Mountain Power call:",
  crashBannerKw: "kW now.",
  crashDuration: "A call of about five and a half minutes.",
  crashPrompt:
    "Press C to drop a simulated Rocky Mountain Power call. This space stays put either way.",
  simClock: "Simulated clock",
  crashLegend:
    "Gray: requested kW. Blue: Spin kW. Gold: Pulse kW. Dotted: Spin energy. Red: host meter, under the dashed ceiling. Same scales on both sides.",
  crashAria: "call trace of requested, Spin and Pulse kW, Spin energy and the host meter",
  secondRule:
    "Second press inside the refill window: the call wins and Pulse diverts to cover it.",
  secondPrompt: "A second press during the refill shows any shortfall here.",
  shortfall: "Shortfall",
  ourSimulation: "Our simulation (SIMULATED)",
  delivered: "Delivered",
  ramp: "Ramp",
  spinFull: "Spin full again at",
  meterRefill: "Host meter peak during the refill",
  noCallYet: "No call yet.",
  publishedTitle: "Published record (Torus, RMP case study), separate from this simulation",
  eventsTail: "events in 2025.",
  against: "against a",
  target: "target",
  band: "band",
  scaleTitle: "Scale",
  closeTitle: "Close",
  fleetSize: "Fleet size",
  sliderFrom: "The slider runs from the MOU size,",
  sliderTo: "MW, up to",
  fleetAria: "Fleet size in MW",
  sliderKeys: "Plus and minus step the slider; Home and End jump to its ends.",
  perDay: "per day",
  orFleet: "or the fleet size is not computed",
  closeHint: "Right turns to the close.",
  campusTitle: "Simulated AI campus, moved in time",
  campusLine1: "A simulated campus moves",
  campusLine2: "MWh of compute load into the clear midday hours. Value to RMP's system at day-ahead prices:",
  notTorusProduct: "This is not a Torus data-center product.",
  envelopeTitle: "Envelope",
  backtestTitle: "Backtest",
  copyJson: "Copy JSON",
  copied: "Copied",
  copyFailed: "Copy failed",
  notComputedYet: "not computed yet",
  envelopeOtherDay: "the envelope file describes",
  envelopeStageDay: ", not the stage day",
  schemaWord: "Schema",
  workingExample: "The envelope is a format Clearlane proposes: a working example, not a filing.",
  schShort: "critical",
  colHour: "Hour",
  colReserve: "Reserve",
  colMaxCharge: "Max charge",
  colMaxDischarge: "Max discharge",
  colPlanned: "Planned",
  colReason: "Reason",
  backtestWindow: "Window:",
  daysWord: "days,",
  missingDays: "Missing days:",
  shareBeating: "Share of days Clearlane beats the off-peak rule:",
  bandP10: "Low (P10) ",
  bandP50: ", middle (P50) ",
  bandP90: ", high (P90) ",
  cyclesYear: "Pulse cycles a year",
  budgetWord: "budget.",
  callsUnanswerable: "Calls it could not answer, hours in Mountain time:",
  daysBeating: "Days beating the off-peak rule",
  ceilingBreaches: "Host ceiling breaches",
  replanTitle: "Re-plan",
  replannedIn: "Re-planned in",
  replanNote:
    "The rest of the day, re-solved from the state of charge the call left behind, timed live on this laptop. Simulated station.",
  replanEmpty: "No call yet, so there is no re-plan. Press C, then come back.",
  replanAria:
    "Pulse state of charge across the day: the morning plan, dashed, and the re-plan from the call, solid",
  replanLegend:
    "Dashed: Pulse state of charge as planned this morning. Solid: the re-plan from the call (red line). Space plays on from the call minute.",
  heatmapMountain: "Published calls by hour of day, Mountain time",
  heatmapNote: "Hours in Mountain time, confirmed by Torus.",
  simulated: "Simulated.",
  emptyNotZero: "Empty, not zero.",
} as const;

/**
 * Presenter mode (#216, ff_presenter). One idea per screen: a takeaway headline, one supporting
 * line, labelled buttons. Written from the beat copy above and pitch/stage-script.md: same
 * claims, shorter. Numbers never appear here; a headline that needs one renders it with Num.
 * Buttons are named, never keys ("Call again during refill", not "Press C").
 */
export const PRESENTER = {
  back: "Back",
  next: "Next",
  sources: "Sources",
  closeOverlay: "Close",
  progressAria: "Screens",
  keysTitle: "Presenter keys",
  keys: [
    ["Right or Page Down", "Next"],
    ["Left or Page Up", "Back"],
    ["Home", "Title"],
    ["?", "Show or hide these keys"],
  ],
  sourcesTitle: "Sources",
  provenanceTitle: "What each chip means",
  operatingDay: "Operating day",
  checkMark: "✓",

  titleLine: "A day planner for simulated Torus-style stations on Utah's grid.",
  titleDetail:
    "It reads the CAISO day-ahead price for PacifiCorp East, fills the battery in the midday clear lane, and keeps Spin ready for Rocky Mountain Power's calls.",
  titleNode: "CAISO day-ahead node",
  start: "Start",

  trafficHeadline: "Power is cheapest at midday. The road jams after the evening step.",
  trafficLine:
    "Day-ahead price for PacifiCorp East, each hour labeled Clear, Shoulder or Jam.",

  raceHeadlinePre: "Filling up at midday is worth",
  raceHeadlinePost: "the off-peak rule.",
  raceLine:
    "Same battery, same evening sale. Only the hours it buys in change. The off-peak rule is our baseline, not Torus practice.",
  replay: "Replay the day",
  keepsLabel: "value to RMP's system per MW per day, higher is better",
  rowBuys: "Buys",
  rowSells: "Sells",
  rowKeeps: "Net",
  at: "at",
  equals: "=",
  clearlaneChip: "Clearlane",
  stripFixed: "Off-peak rule",
  stripClear: "Clearlane",
  markBuy: "Buy",
  markSell: "Sell",
  stripBuy: "Buy hours",
  stripSell: "Sell hours",
  stripAria:
    "Twenty-four hours, Mountain time, marking each plan's buy hours and sell hours",
  raceNote: "Value to RMP's system at day-ahead prices, per MW of battery.",

  callHeadline: "When Rocky Mountain Power calls, Spin answers.",
  callLine:
    "A simulated call of about five and a half minutes. Call again during the refill, and the card shows any shortfall.",
  callNow: "Rocky Mountain Power calls now",
  callAgain: "Call again during refill",
  callPrompt:
    "Click Rocky Mountain Power calls now to drop a simulated call. This space stays put either way.",
  secondPrompt: "A second call during the refill shows any shortfall here.",
  secondRule:
    "Second call inside the refill window: the call wins and Pulse diverts to cover it.",

  replanHeadline: "After the call, the rest of the day is re-solved.",
  replanLine: "The morning plan, and the plan re-solved at the call minute.",
  replanLegend:
    "Dashed: Pulse state of charge as planned this morning. Solid: the re-plan from the call (red line).",
  resume: "Resume the day",

  envelopeHeadline: "An hourly envelope Rocky Mountain Power could plan around.",
  envelopeLine:
    "A format Clearlane proposes: a working example, not a filing. System Critical Hours are our proposal.",
  // "Backtested on {backtest_days} days, {window start} to {window end}." The count is a Num and the
  // dates are the backtest window rendered as times, so no digit sits in copy (Pitch review, #217).
  backtestHeadlinePre: "Backtested on",
  backtestHeadlineDays: "days,",
  backtestHeadlineTo: "to",
  backtestLine:
    "Each policy run on every day of the history with full data, beside the off-peak rule.",
  showBacktest: "Show the backtest",
  showEnvelope: "Show the envelope",

  scaleHeadline: "Scale the station to the fleet the MOU allows.",
  scaleLine:
    "MOU ceiling, not installed capacity. Assumes the fleet does not move prices.",
  fleetMin: "MW",
  fleetMax: "MW",

  closeHeadline: "The ask: pilot the envelope.",

  footTitle: "Data: CAISO OASIS and EIA.",
  footTraffic: "CAISO day-ahead price and forecasts.",
  footRace: "CAISO prices; engine reference race.",
  footCall: "Our simulation; Torus's published record.",
  footReplan: "Engine re-plan, timed on this laptop.",
  footEnvelope: "Engine envelope and backtest.",
  footScale: "Torus and RMP announcements.",
  footClose: "Simulated campus; engine shift.",
  sourceTitle:
    "Clearlane, built for the Torus bounty. Prices and forecasts from CAISO OASIS; hourly CO2 from EIA.",
  sourceTraffic:
    "CAISO OASIS day-ahead price, load forecast and wind and solar forecast for PacifiCorp East.",
  sourceRace:
    "CAISO day-ahead prices; reference battery of one MW and two MWh (our assumption); engine reference race.",
  sourceCall:
    "Our simulated call and station; the event record is Torus's own published RMP case study.",
  sourceReplan: "Engine re-plan, solved live on this laptop from the simulated call.",
  sourceEnvelope:
    "Engine envelope and backtest over the May to October CAISO day-ahead history.",
  sourceScale:
    "MOU and fleet sizes from Torus and Rocky Mountain Power announcements; price-taker scaling.",
  sourceClose: "Simulated campus shift on the day-ahead prices; not a Torus product.",
} as const;

/**
 * Fleet board (#92, ff_fleet_board). Partial: the engine models one simulated site, so the board
 * tiles that site and says plainly what is not built. No numbers here; they come from the engine
 * or numbers.json.
 */
export const FLEET = {
  pill: "Fleet board",
  pillTitle: "F opens or closes the fleet board",
  title: "Fleet board: simulated Torus-style sites",
  caption:
    "Each tile is one simulated Torus-style site, not a real one: Spin and Pulse energy, the host's quarter-hour meter against its ceiling, and when Spin is full again after a call.",
  close: "Close",
  tilePlanned: "Planned for the quarter hour from",
  tileAfter: "Re-planned after the call, quarter hour from",
  tileSpin: "Spin energy",
  tilePulse: "Pulse energy",
  tileMeter: "Host meter",
  tileCeiling: "against a ceiling of",
  tileUnavailable: "the plan has no quarter hour at the call minute",
  refillNone: "Spin is full. No refill under way.",
  moreTitle: "More sites",
  moreLine:
    "The engine models one simulated site today. A roll-up of many simulated sites, with a tile for each, is not built yet.",
  stripTitle: "Fleet envelope, hour by hour",
  stripLine1: "The engine's envelope for the simulated site, scaled to the",
  stripLine2:
    "MW MOU. It assumes identical sites and no feeder limit between them.",
  stripLegend:
    "Bars above the line: planned charging. Below: planned discharging. Shaded: System Critical Hours (our proposal), the grid's tightest hours, not a call forecast.",
  stripAria:
    "Planned fleet power for each hour of the day, charging above the line and discharging below it, with System Critical Hours shaded",
  stripMissing: "the MOU size is not in numbers.json",
  stripAxis: "Hour labels:",
  callTitle: "A simulated call on the board",
  callPrompt:
    "Press C, or the button, to land a simulated Rocky Mountain Power call on the board.",
  callButton: "Land a simulated call",
  callSecondPrompt: "Press C again during the refill for a second call.",
  colSpin: "Spin",
  colPulse: "Pulse",
  colDelivered: "Delivered",
  colShortfall: "Shortfall",
  fleetShare: "Share of the call the fleet delivered:",
  fleetNotBuilt: "the engine does not split one call across sites yet.",
} as const;
