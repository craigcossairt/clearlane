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

  // Proof drawer (#90, ff_proof_drawer): Q&A cards, never part of the six beats.
  proofPill: "Proof",
  proofTitle: "Proof drawer",
  proofIntro:
    "Answers for questions after the demo. Each card reads one file from the repo, and every number keeps its chip.",
  proofClose: "Close",
  proofReads: "Reads",
  proofNone: "No analysis files are in this build yet. Empty, not zero.",
  proofEmpty: "No file yet. Empty, not zero.",
  proofBroken: "The file is there but does not parse.",
  proofUnknown: "The file parses, but not in the shape this card reads:",
  proofBacktestTitle: "Backtest spread across every day of the window",
  proofBacktestLead:
    "Value to RMP's system per MW per day at day-ahead prices, one row per timetable.",
  proofBacktestAria:
    "One band per timetable from the tenth to the ninetieth percentile day, in dollars per MW-day, with the middle day and the mean marked",
  proofAxis: "dollars per MW-day",
  proofBandNote:
    "Each band runs from the tenth to the ninetieth percentile day. The tick is the middle day and the dot is the mean.",
  proofMean: ", mean ",
  proofBaseline: "The off-peak rule is our baseline, not Torus practice.",
  proofCrossTitle: "Independent cross-check of the pinned numbers",
  proofCrossLead:
    "A separate science script re-derives each pinned number from the raw public files, against tolerances written down before it computed anything.",
  proofCrossAria: "One square per check, marked by its status",
  proofStatusMatch: "Match",
  proofStatusMismatch: "Outside tolerance",
  proofStatusPending: "Not recomputed here",
  proofMismatchHead: "Outside tolerance, with the second path the script also ran:",
  proofPinned: "pinned",
  proofScience: "science",
  proofSameCent:
    "Same to the cent. They differ past the cent by more than the tolerance the science script set before running:",
  proofDifference: "difference",
  proofNotScalar: "not a single number; see",
  proofSecondPath: "Second path",
  proofFrom: "from",
  proofTolerance: "Tolerance:",
  proofSecondPathPasses: "passes tolerance",
  lineageTitle: "Where this number comes from",
  lineageOpen: "show where this number comes from",
  lineageClose: "Close",
  lineageKey: "Key",
  lineageLive:
    "Computed live by the engine on this page, so it has no key in numbers.json.",
  lineageShown: "Shown as",
  lineageClass: "Class",
  lineageClassReal: "Public data or a public statement, as published.",
  lineageClassDerived: "Computed by our code from public data.",
  lineageClassSimulated: "Our model, not a real site or a real call.",
  lineageClassTorus:
    "Published by Torus: a company claim, not an independent measurement.",
  lineageClassAssumption: "A value we chose and state.",
  lineageClassMeasured: "Timed live on this laptop.",
  lineageSource: "Source",
  lineageAsOf: "As of",
  lineageRetrieved: "retrieved",
  lineageTorus: "Torus page",
  lineageTorusField: "field",
  lineageTorusNone: "No matching value in",
  lineageCross: "Cross-check",
  lineageCrossLead: "A separate science script re-derived it from the raw public files:",
  lineageFacts: "Fact ledger",
  lineageFactsLoading: "Reading the fact ledger.",
  lineageFactsFailed: "The fact ledger did not load:",
  lineageFactsMissing: "No row for this key in",
  lineageFactsVerified: "Verified.",
  lineageFactsConflict:
    "Two sources disagree; the ledger row quotes both and says which wording to use.",
  lineageFactsUnchecked: "Carried from a research note; not yet re-checked against its source.",
  lineageFactsPending: "Not computed yet.",
  lineageLevel1: "Level one of five: stated in a research note or the plan.",
  lineageLevel2: "Level two of five: read in the named source.",
  lineageLevel3: "Level three of five: worked by hand from checked inputs.",
  lineageLevel4: "Level four of five: printed by a script run.",
  lineageLevel5: "Level five of five: reproduced in the running app.",
  proofSecondPathFails: "fails tolerance",
  proofStepTitle: "Is the evening price step real?",
  proofStepLead:
    "Could the day's largest price step land in the same evening hour by chance? A separate science script tests it on the real day-ahead prices for PacifiCorp East.",
  proofStepAria:
    "Two bar charts of days by the hour their largest upward price step landed in, October above July, with the target hours shaded",
  proofOctober: "October",
  proofJuly: "July",
  proofDaysWord: "days",
  proofStepShaded: "Shaded: the target hours,",
  proofAnd: "and",
  proofStepBars:
    ". Bars: days whose largest upward hour-to-hour price step landed in that hour.",
  proofStepWindows: "Windows:",
  proofStepOctPre: "In October,",
  proofStepJulPre: "In July,",
  proofOf: "of",
  proofStepDaysIn: "days had their largest step in the target hours.",
  proofStepChance:
    "If every hour were equally likely, the chance of that many or more is",
  proofStepBinom: "(exact binomial test).",
  proofChance: ", chance",
  proofPermPre: "October against July, the test to quote: of",
  proofPermMid:
    "random relabelings of the days as October or July,",
  proofPermPost:
    "gave step-hour distributions as far apart as the real ones. Distance between the two (total variation):",
  proofPermP: "; p about",
  proofPermFloor: ", the smallest this test can report.",
  proofMonthDays: "days. Most often at",
  proofMonthOn: ", on",
  proofMonthMedian: "days. Median step",
  proofPerMwh: "per MWh.",
  proofStepRepro: "Reproduction of the pinned step-hour numbers:",
  proofChecksMatch: "checks match.",
  proofIntervalsTitle: "How sure is the median?",
  proofIntervalsLead:
    "The backtest medians come from one run of days. A separate science script resamples those days in blocks, many times over, to put an interval around each median.",
  proofIntervalsAria:
    "For each timetable, the median value per MW-day as a tick inside its resampled interval.",
  proofIntervalsBars: "Bars: the",
  proofIntervalsFrom: "interval from",
  proofIntervalsBlocks: "resamples of the days in blocks of",
  proofIntervalsTick: "days. Tick: the median.",
  proofMedian: "median",
  proofIntervalWord: ", interval",
  proofBeatPre: "Clearlane beat the off-peak rule on",
  proofBeatPost: "of days, interval",
  proofStationaryPre: "Stationary blocks put Clearlane's median between",
  proofSeedPre: "; another seed moves the interval ends by at most",
  proofPointChecks: "checks of the point values against the backtest file match.",

  proofRtTitle: "Would re-planning on real-time prices help?",
  proofRtLead:
    "A separate replay settles each day on real-time prices three ways: holding the day-ahead plan all day, re-planning at the top of every hour, and perfect foresight, which no plan can reach and which sets the yardstick. Values are net of wear, as value to RMP's system.",
  proofRtAria:
    "For holding, re-planning and perfect foresight, net value per MW-day from the tenth to the ninetieth percentile day, with the middle day as a tick and the mean as a dot.",
  proofRtHold: "Hold the day-ahead plan",
  proofRtReplan: "Re-plan every hour",
  proofRtForesight: "Perfect foresight",
  proofRtDaysPre: "Re-planning beat holding on",
  proofRtDaysMid: "days and lost on",
  proofRtRegretPre: "Median regret against perfect foresight: holding",
  proofRtRegretMid: ", re-planning",
  proofRtEveningPre:
    "Real-time evening prices fell below real-time midday prices on",
  proofRtEveningMid: "days; day-ahead, on",
  proofRtWearPre: "Wear is charged at",
  proofRtSettlement: "Settlement rule:",
  proofRtUnverified:
    "The rule is an assumption, not yet checked against CAISO's EDAM business practice manual.",

  proofLedgerTitle: "Does each timetable answer RMP's calls?",
  proofLedgerLead:
    "A ledger places simulated calls on the backtest days by the published heatmap, read in Mountain time, and meets each call the way each timetable would. Every call is simulated, not an RMP event record.",
  proofLedgerAria:
    "For each timetable, the share of calls delivered in band, from none to all of them.",
  proofLedgerInBand: "of calls delivered in band;",
  proofLedgerUnanswerable: "unanswerable;",
  proofLedgerShort: "fell short,",
  proofLedgerInAll: "in all.",
  proofLedgerBandPre: "In band means at least",
  proofLedgerBandPost:
    "of the call delivered, the floor of Torus's published band; below it, a call is unanswerable.",
  proofLedgerCallsOn: "calls on",
  proofLedgerDaysIs: "days is",
  proofLedgerADay: "a day, about",
  proofLedgerTimesThe: "times the",
  proofLedgerRate: "daily rate of",
  proofLedgerStress: ". This is a stress replay, not a forecast.",

  proofSchTitle: "How do System Critical Hours compare with simpler rules?",
  proofSchLead:
    "The envelope marks System Critical Hours with one rule Clearlane proposes: the four highest net-load hours of each day plus every jam hour. A separate science script compares it with simpler rules over the season on real PacifiCorp East data, and weighs each against the published call hours, read in Mountain time. It is a study of rules, not a call forecast.",
  proofSchAria:
    "For each rule, how much of the published call weight it catches compared with flagging the same number of hours at random, against a dashed line at chance.",
  proofSchChance: "chance",
  proofSchAxis: "lift over chance",
  proofSchBars:
    "Bars: lift, the share of the call weight a rule catches divided by the share of hours it flags. The dashed line is chance.",
  proofSchTop6: "Six highest-price hours",
  proofSchP75: "Net load in the season's top quarter",
  proofSchTop4: "Four highest net-load hours only",
  proofSchHoursADay: "hours a day, catching",
  proofSchOfCalls: "of the call weight with",
  proofSchOfHours: "of the hours; lift",
  proofSchAgrees: "; agrees with ours on",
  proofSchOfFlagged: "of flagged hours",
  proofSchNone:
    "No rule here, ours included, catches more of the call hours than chance. System Critical Hours mark the tightest hours on the grid; they do not forecast calls.",
  proofSchStagePre: "On the stage day the rule, run on the engine's own inputs, flags",
  proofSchStageMid: "hours,",
  proofSchStageMatch: ": the same hours the envelope marks.",
  proofSchStageOff: ". The study's check against the envelope reads:",
  proofSchSeason: "Season:",

  proofScaleTitle: "What if the fleet moves prices?",
  proofScaleLead:
    "The Scale beat assumes the fleet does not move prices. This estimate lets each hour's day-ahead price move with the fleet's own charging and discharging, and shows what that does to value to RMP's system per MW of fleet.",
  proofScaleAria:
    "For each timetable, value per MW-day as the fleet grows from no price impact to the MOU ceiling, with a shaded band around each line.",
  proofScaleXAxis: "fleet size, MW",
  proofScaleNote:
    "Each line starts at the value with no price impact and follows the central estimate; the shading is its band.",
  proofScaleWear10: "Hourly plan with wear priced in",
  proofScaleTaker: "with no price impact,",
  proofScaleAtFirst: "at the first MOU and",
  proofScaleAtCeiling: "at the MOU ceiling (band",
  proofScaleOfTaker: "of the value with no price impact.",
  proofScaleFleetPre: "Fleet sizes:",
  proofScaleFirstMou: "MW, the first MOU;",
  proofScaleMw: "MW, the",
  proofScaleAssoc:
    "The price response comes from how PacifiCorp East day-ahead prices have moved with net load. Gas prices, imports and the wider EDAM footprint move them too, so it is an association, not a measured price impact: an estimate with a band, not a forecast.",
  proofScaleInconclusive: "Hours whose price response could not be told from zero:",
  proofScaleClamped: "Hours whose response was clamped to none:",

  proofSensTitle: "What would change the answer?",
  proofSensLead:
    "How far Clearlane stays ahead of the off-peak rule in value to RMP's system per MW-day, as one input at a time moves across a range we chose. Each bar runs from the backtest's gap to the gap with that input at one end of its range.",
  proofSensAria:
    "For each input, one bar from the backtest's gap to the gap with the input at the low end of its range and one to the gap at the high end, with the backtest's gap and zero marked.",
  proofSensAxis: "Clearlane minus the off-peak rule, per MW-day",
  proofSensBase: "Over the backtest, Clearlane is ahead of the off-peak rule by",
  proofSensPerMwDay: "per MW-day.",
  proofSensLowEnd: "input at the low end of its range",
  proofSensHighEnd: "input at the high end",
  proofSensBaseLine: "backtest gap",
  proofSensGap: "gap",
  proofSensNoChange: "no change",
  proofSensTimes: "times",
  proofSensAlone:
    "Each input moves alone with the others at the backtest's values, so the bars leave out interactions. The ranges are ours (ASSUMPTION). The off-peak rule is our baseline, not Torus practice.",
  proofSensPending: "Not run yet:",
  proofSensRte: "Round-trip efficiency",
  proofSensWear: "Wear price",
  proofSensSlack: "Host ceiling slack above the day's peak",
  proofSensEnrolled: "Enrolled kW",
  proofSensExport: "Export limit",
  proofSensSpinRefill: "Spin refill time from empty",
  proofSensSocGrid: "Pulse charge grid in the hourly plan",
  proofSensArchetype: "Host load archetype",
  proofSensCarbon: "Carbon basis, average or marginal",
  proofSensRteNone: "No round-trip efficiency from",
  proofSensClosesNot: "closes the gap; the narrowest is",
  proofSensAt: "at",
  proofSensRteFound: "The gap closes at a round-trip efficiency of",
  proofSensSpreadNone: "Scaling every day's price spread from",
  proofSensSpreadNever: "times never closes the gap; the narrowest is",
  proofSensSpreadTimes: "times today's spreads.",
  proofSensSpreadFound: "The gap closes with every day's price spread scaled to",
  proofSensFlat:
    "At flat prices the off-peak rule still pays its round-trip losses while Clearlane sits idle.",
  proofSensWearFound: "The gap closes only at a wear price of",
  proofSensAMwh: "a MWh,",
  proofSensWearOf: "the calibrated",
  proofSensWearNone: "No wear price up to",
  proofSensWearNoneTail: "a MWh closes the gap.",
  proofSensByDay: "Day by day, the off-peak rule ties or beats Clearlane on",
  proofSensOf: "of",
  proofSensByBand: "By the day's price spread, a MWh:",
  proofSensAndOver: "and over",

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
  ribbonLanes3: ". In October the evening price step landed at",
  ribbonOn: "on",
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
 * Compute drag (#93, ff_compute_drag): the close card's simulated compute block, for questions
 * and the judge URL. Numbers never appear here; the card renders them with Num. The campus is
 * simulated and the card makes no Torus data-center claim.
 */
export const DRAG = {
  title: "Drag the simulated compute block",
  intro:
    "A simulated AI campus block, not a real one. Drag it along the price line, tap the line, or focus it and use the arrow keys.",
  blockLabel: "Compute block",
  blockAria: "Simulated compute block, start hour",
  chartAria:
    "Day-ahead price by hour, with the priciest hours shaded and the compute block over the hours it moves into",
  lineLegend: "Line: day-ahead price at",
  shadeLegend:
    "Shaded: the day's priciest hours, which the block moves load out of.",
  axis: "Hour labels:",
  block: "Block:",
  to: "to",
  outOf: "Moves load out of",
  value: "Value to RMP's system at day-ahead prices:",
  co2Avoided: "CO2 avoided:",
  co2Added: "CO2 added:",
  overlap: "the block overlaps the hours it moves load out of",
  spaceToggle: "Move it in space",
  spaceLine:
    "The same hours at the bundle's other price nodes, day-ahead $/MWh.",
  colNode: "Node",
  noPrice: "no price for this hour",
  research1:
    "This bundle has no peer prices. October research on a longer job block across the EDAM nodes: moving it in time saved",
  research2: "of the cost, moving it in space saved",
  researchSource: "Source:",
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
    "It reads the next day's power prices, fills the battery when power is cheap at midday, stops buying in the evening rush, and keeps the flywheel ready for Rocky Mountain Power's calls.",
  titleNode: "CAISO day-ahead node",
  titleBy: "Presented by Craig Cossairt",
  start: "Start",

  trafficHeadline: "Power is cheapest at midday. The road jams after the evening step.",
  trafficLine:
    "Like a traffic report published the evening before: each bar is one hour's price, green when the road is clear and red in the evening jam.",
  // Screen 2's one caption sentence: "Price jumps {peak_over_trough} from the midday low to the
  // {peak_hour_mt} peak."
  trafficPeak1: "Price jumps",
  trafficPeak2: "from the midday low to the",
  trafficPeak3: "peak.",

  raceHeadlinePre: "Filling up at midday is worth",
  raceHeadlinePost: "the off-peak rule.",
  raceLine:
    "Same battery, selling in the same evening hours. The only difference is when it fills up. The off-peak rule is our baseline, not Torus practice.",
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
    "Each hour, the most the station will draw, and the power it keeps ready for RMP. A format Clearlane proposes, not a filing.",
  showBacktest: "Show the backtest",
  showEnvelope: "Show the envelope",

  // #270: screens 4 to 6 read from the screen alone. No digit sits in this copy; every number
  // is a Num or a Live engine value.
  callTraceLegend: "Gray: what Rocky Mountain Power asked for. Blue: Spin. Gold: Pulse.",
  callDeliveredOf: "of the call delivered",
  callSimTitle: "Our simulation",
  callPublishedTitle: "Torus's published record, separate from this simulation",
  callPublishedRamp: "Ramp",
  callPublishedDelivered: "target, delivered",
  callSpinBack: "Spin full again at",
  replanHero: "Re-planned in",
  replanHeroTail: "timed live on this laptop, from the charge the call left behind.",
  replanAxis: "Pulse battery charge",
  replanCallMark: "RMP call,",
  replanTakesOver: "The re-plan takes over here",
  replanKeyPlanned: "This morning's plan",
  replanKeyReplanned: "Re-plan after the call",
  replanCycles: "Pulse cycles today",
  replanCyclesBudget: "Budget",
  replanCyclesTail: "a year",
  envelopeDrawLabel: "Most the station will draw",
  envelopeReadyLabel: "Kept ready for RMP",
  envelopeSchLabel: "System Critical Hours, our proposal",
  envelopeSchCount: "System Critical Hours today",
  envelopeAria:
    "Twenty-four hours, Mountain time: the most the station will draw each hour, with the System Critical Hours marked",
  backtestScoreHeadline:
    "Battery-only is worth more on paper. Clearlane is the plan a host and RMP would allow.",
  backtestLinePre: "Backtested on",
  backtestLineDays: "days,",
  backtestLineTo: "to",
  backtestLineBeats: "Clearlane beats the off-peak rule on",
  backtestLineBeatsTail: "of days.",
  scoreMoney: "Typical day per MW, on paper",
  scoreMoneyRange: "Most days between",
  scoreMoneyAnd: "and",
  scoreWear: "Battery wear: cycles a year, budget",
  scoreCeiling: "Times it broke the host's meter ceiling",
  scoreCalls: "RMP calls it could not answer",
  scoreCallsRule: "Pass: fewer than the off-peak rule",
  scorePass: "Pass",
  scoreFail: "Fail",
  scoreBaseline: "Baseline",
  scaleHeadline: "Scale the station to the fleet the MOU allows.",
  scaleLine:
    "One station's daily value per MW, multiplied by the fleet in Torus's agreement (MOU) with Rocky Mountain Power.",
  scaleTimes: "×",
  scalePerMw: "per MW-day",
  scaleCaveat:
    "This assumes every enrolled MW is a two-hour battery like our reference station, and that the fleet does not move prices. The MOU is a ceiling, not installed capacity.",
  fleetMin: "MW",
  fleetMax: "MW",

  closeHeadline: "The ask: pilot the envelope.",
  closeLine:
    "Pilot the day-ahead envelope, a format Clearlane proposes, at a few Wattsmart sites this winter.",
  closeWhat:
    "Each hour it tells Rocky Mountain Power the reserve held for its calls and the most the station will charge or discharge.",
  sawRatio: "what filling up at midday is worth, against the off-peak rule",
  sawCalls: "of Rocky Mountain Power's calls missed in the backtest",
  sawDays: "of backtest days beat the off-peak rule",
  sawAria: "What you saw",
  // Plain text, not a link: the stage runs offline.
  closeRepo: "Code and data: github.com/craigcossairt/clearlane",

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
