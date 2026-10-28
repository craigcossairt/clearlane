/* Clearlane explainer scenes on a fixed clock.
 *
 * render.mjs injects window.__EXPLAINER__ = { data, timeline, keys, copy } and calls
 * window.__seek(t) before each frame. Every style is a pure function of t, so a frame renders
 * the same way every time. Every number on screen is a key display from numbers.json or the
 * engine's scene data (pitch/explainer/data.ts); this file types none.
 */
(() => {
  const { data, timeline, keys, copy } = window.__EXPLAINER__;
  const stage = document.getElementById("stage");

  // ---------- helpers ----------
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const smooth = (x) => {
    const u = clamp(x);
    return u * u * (3 - 2 * u);
  };
  const out3 = (x) => 1 - (1 - clamp(x)) ** 3;
  const inOut = (x) => {
    const u = clamp(x);
    return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
  };
  const ramp = (t, t0, d) => clamp((t - t0) / d);
  const lerp = (a, b, p) => a + (b - a) * p;

  const K = (key) => {
    const k = keys[key];
    if (!k) throw new Error(`no key ${key}`);
    return k;
  };
  const PROV = { TORUS_PUBLISHED: "TORUS PUBLISHED" };
  const chip = (prov) => `<span class="chip">${PROV[prov] ?? prov}</span>`;
  const n = (key) =>
    `<span class="num">${K(key).display}</span>${chip(K(key).prov)}`;
  // A figure with its unit before the chip, so "800 kW" reads as one value.
  const nu = (key, unit) =>
    `<span class="num">${K(key).display} ${unit}</span>${chip(K(key).prov)}`;

  function el(tag, cls, parent, html, style) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    if (style) Object.assign(node.style, style);
    parent.appendChild(node);
    return node;
  }
  const SVGNS = "http://www.w3.org/2000/svg";
  function sv(tag, attrs, parent) {
    const node = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs ?? {}))
      node.setAttribute(k, String(v));
    if (parent) parent.appendChild(node);
    return node;
  }
  function show(node, p, dy = 24, dx = 0) {
    node.style.opacity = String(p);
    node.style.transform =
      p >= 1 ? "" : `translate(${(1 - p) * dx}px, ${(1 - p) * dy}px)`;
    node.style.visibility = p <= 0.001 ? "hidden" : "visible";
  }
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, p) => {
    const [x, y] = [hex(a), hex(b)];
    return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], clamp(p)))).join(",")})`;
  };
  const C = {
    bg: "#121212",
    ink: "#f1ede4",
    muted: "#a39e94",
    dim: "#6b6862",
    line: "#34332f",
    surface2: "#232321",
    neutral: "#4a4844",
    clear: "#3cbf84",
    shoulder: "#e2a73c",
    jam: "#ee6b58",
    solar: "#f0c04c",
    spin: "#8fb4ff",
  };
  const LANE = { clear: C.clear, shoulder: C.shoulder, jam: C.jam };
  const hourLabel = (h) =>
    `${h % 12 === 0 ? 12 : h % 12}${h % 24 < 12 ? "am" : "pm"}`;
  const clock = (min) => {
    const h = Math.floor(min / 60) % 24;
    return `${h % 12 === 0 ? 12 : h % 12}:${String(Math.floor(min % 60)).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
  };
  const dayLabel = new Date(
    `${data.operating_day_mt}T12:00:00Z`,
  ).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  // Scale the price-taker way, as the engine's scaleUsdPerDay and the beat 6 slider do.
  const usd0 = (x) => `$${Math.round(x).toLocaleString("en-US")}`;

  /** Cue times on a scene's local clock, plus a point partway into a line by where a phrase starts. */
  function cueTable(s) {
    const c = { dur: s.end - s.start };
    for (const l of s.lines) {
      if (!l.cue) continue;
      c[l.cue] = {
        at: l.at - s.start,
        s0: l.speech[0] - s.start,
        s1: l.speech[1] - s.start,
        text: l.caption,
      };
    }
    c.when = (cue, phrase) => {
      const x = c[cue];
      if (!x) throw new Error(`no cue ${cue} in ${s.id}`);
      if (!phrase) return x.s0;
      const i = x.text.indexOf(phrase);
      if (i < 0) throw new Error(`cue ${cue} has no phrase "${phrase}"`);
      return x.s0 + (x.s1 - x.s0) * (i / x.text.length);
    };
    return c;
  }

  // ---------- chrome ----------
  const scenesRoot = el("div", "", stage);
  const chapters = el("div", "chapters", stage);
  chapters.style.gridTemplateColumns = `repeat(${timeline.scenes.length}, 1fr)`;
  const chapterEls = timeline.scenes.map((s) =>
    el("div", "chapter", chapters, s.chapter),
  );
  const foot = el("div", "foot", stage);
  el(
    "div",
    "",
    foot,
    `Operating day ${dayLabel}. CAISO day-ahead, PacifiCorp East (${data.node}).`,
  );
  const footNote = el("div", "note", foot, "");
  const caption = el("div", "caption", stage, "");

  // ---------- scenes ----------
  const BUILD = {};

  BUILD.title = (root, c) => {
    const mark = el("div", "mark", root);
    const svg = sv(
      "svg",
      { width: 150, height: 150, viewBox: "0 0 150 150" },
      mark,
    );
    svg.style.position = "relative";
    const R = 60;
    const circ = 2 * Math.PI * R;
    const ring = sv(
      "circle",
      {
        cx: 75,
        cy: 75,
        r: R,
        fill: "none",
        stroke: C.ink,
        "stroke-width": 15,
        "stroke-dasharray": circ,
        transform: "rotate(-90 75 75)",
      },
      svg,
    );
    const word = el("div", "word", mark, "Clearlane");
    const tag = el(
      "div",
      "abs",
      root,
      "A day planner for simulated Torus-style stations on Utah's grid.",
      { left: "72px", top: "462px", fontSize: "54px" },
    );
    const more = el(
      "div",
      "abs muted",
      root,
      "It reads the CAISO day-ahead price for PacifiCorp East, fills the battery in the midday clear lane, and keeps Spin ready for Rocky Mountain Power's calls.",
      {
        left: "72px",
        top: "548px",
        width: "1420px",
        fontSize: "32px",
        lineHeight: "1.35",
      },
    );
    const meta = el("div", "abs", root, "", {
      left: "72px",
      top: "690px",
      display: "flex",
      gap: "70px",
    });
    el(
      "div",
      "",
      meta,
      `<div class="muted" style="font-size:25px">Operating day</div><div style="font-size:36px;margin-top:6px">${dayLabel}</div>`,
    );
    el(
      "div",
      "",
      meta,
      `<div class="muted" style="font-size:25px">CAISO day-ahead node</div><div style="font-size:36px;margin-top:6px">${data.node}</div>`,
    );
    return (t) => {
      ring.setAttribute(
        "stroke-dashoffset",
        String(circ * (1 - inOut(ramp(t, 0.15, 1.2)))),
      );
      const w = out3(ramp(t, 0.55, 1.1));
      word.style.clipPath = `inset(-20px ${(1 - w) * 100}% -40px 0)`;
      word.style.opacity = String(w);
      show(tag, out3(ramp(t, c.mark.at, 0.7)));
      show(more, out3(ramp(t, c.mark.at + 1.0, 0.7)));
      show(meta, out3(ramp(t, c.mark.at + 1.8, 0.7)));
    };
  };

  BUILD.traffic = (root, c) => {
    const h1 = el(
      "div",
      "h1",
      root,
      "Cheapest at midday. Jammed after the evening step.",
    );
    const sub = el(
      "div",
      "sub",
      root,
      "Day-ahead price for PacifiCorp East, each hour labeled Clear, Shoulder or Jam.",
    );
    const hours = data.hours;
    const x0 = 160;
    const slot = (1760 - x0) / 24;
    const barW = 50;
    const base = 660;
    const maxH = 350;
    const pMax = Math.max(...hours.map((h) => h.price));
    const cx = (i) => x0 + i * slot + slot / 2;
    const svg = sv(
      "svg",
      { width: 1920, height: 1080, viewBox: "0 0 1920 1080" },
      root,
    );
    svg.style.left = "0";
    svg.style.top = "0";
    // Solar forecast, scaled to its own peak, behind the bars.
    const sMax = Math.max(...hours.map((h) => h.solar_mw));
    const solarPts = hours.map(
      (h, i) => `${cx(i)},${base - (h.solar_mw / sMax) * maxH * 0.92}`,
    );
    const solarG = sv("g", {}, svg);
    sv(
      "polygon",
      {
        points: `${cx(0)},${base} ${solarPts.join(" ")} ${cx(23)},${base}`,
        fill: C.solar,
        "fill-opacity": 0.13,
        stroke: C.solar,
        "stroke-width": 3,
        "stroke-opacity": 0.75,
      },
      solarG,
    );
    const bars = hours.map((h, i) => {
      const b = el("div", "abs", root, "", {
        left: `${cx(i) - barW / 2}px`,
        width: `${barW}px`,
        borderRadius: "7px 7px 0 0",
      });
      b.dataset.h = String((h.price / pMax) * maxH);
      return b;
    });
    const strip = hours.map((h, i) =>
      el("div", "abs", root, "", {
        left: `${cx(i) - barW / 2}px`,
        width: `${barW}px`,
        top: `${base + 10}px`,
        height: "12px",
        borderRadius: "4px",
      }),
    );
    // Net load, scaled to its own peak, drawn over the bars.
    const nMax = Math.max(...hours.map((h) => h.net_load_mw));
    const netPts = hours.map((h, i) => [
      cx(i),
      base - (h.net_load_mw / nMax) * maxH * 0.92,
    ]);
    let netLen = 0;
    for (let i = 1; i < netPts.length; i++)
      netLen += Math.hypot(
        netPts[i][0] - netPts[i - 1][0],
        netPts[i][1] - netPts[i - 1][1],
      );
    const net = sv(
      "polyline",
      {
        points: netPts.map((p) => p.join(",")).join(" "),
        fill: "none",
        stroke: C.ink,
        "stroke-width": 5,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
        "stroke-dasharray": netLen,
      },
      svg,
    );
    // Lane group labels under the strip, hour labels under them.
    const groups = [];
    hours.forEach((h, i) => {
      const g = groups.at(-1);
      if (g && g.lane === h.lane) g.to = i;
      else groups.push({ lane: h.lane, from: i, to: i });
    });
    const NAMES = { clear: "Clear lane", shoulder: "Shoulder", jam: "Jam" };
    const groupEls = groups
      .filter((g) => g.to - g.from >= 2)
      .map((g) => {
        const node = el("div", "abs", root, NAMES[g.lane], {
          left: `${cx(g.from) - barW / 2}px`,
          width: `${cx(g.to) - cx(g.from) + barW}px`,
          top: `${base + 30}px`,
          textAlign: "center",
          fontSize: "24px",
          color: LANE[g.lane],
        });
        return { node, lane: g.lane };
      });
    for (let h = 0; h < 24; h += 3)
      el("div", "abs muted", root, hourLabel(h), {
        left: `${cx(h) - 60}px`,
        width: "120px",
        textAlign: "center",
        top: `${base + 68}px`,
        fontSize: "23px",
      });
    // Legend above the morning bars: what the area and the line are, and the hour convention.
    const axis = el(
      "div",
      "abs muted",
      root,
      `<span style="display:inline-block;width:34px;height:16px;margin-right:10px;vertical-align:middle;background:rgba(240,192,76,0.18);border-top:3px solid ${C.solar}"></span>Solar forecast` +
        `<span style="display:inline-block;width:34px;height:0;margin:0 10px 0 34px;vertical-align:middle;border-top:5px solid ${C.ink}"></span>Net load` +
        `<span style="margin-left:34px">Each scaled to its own peak. Hours beginning, Mountain time.</span>`,
      { left: "170px", top: "252px", fontSize: "21px", whiteSpace: "nowrap" },
    );
    // Price labels at the day's low and at the peak hour.
    const iMin = hours.reduce(
      (m, h, i) => (h.price < hours[m].price ? i : m),
      0,
    );
    const iMax = hours.reduce(
      (m, h, i) => (h.price > hours[m].price ? i : m),
      0,
    );
    const tagAt = (i, html) =>
      el("div", "abs", root, html, {
        left: `${cx(i) - 160}px`,
        width: "320px",
        textAlign: "center",
        top: `${base - (hours[i].price / pMax) * maxH - 52}px`,
        fontSize: "30px",
      });
    const lowTag = tagAt(iMin, n("price_min_oct27"));
    const peakTag = tagAt(iMax, n("peak_price"));
    const callout = el(
      "div",
      "abs",
      root,
      `Price jumps ${n("peak_over_trough")} by the peak hour, ${n("peak_hour_mt")}. Net load climbs ${nu("net_load_climb_mw", "MW")}.`,
      { left: "72px", top: "780px", fontSize: "31px", whiteSpace: "nowrap" },
    );
    const oct = el("div", "abs", root, "", {
      left: "72px",
      top: "842px",
      display: "flex",
      alignItems: "center",
      gap: "14px",
      fontSize: "29px",
      whiteSpace: "nowrap",
    });
    el("span", "muted", oct, "October days with the jump at 5pm or 6pm:");
    const dotsBox = el("span", "", oct, "", {
      display: "inline-flex",
      gap: "6px",
      margin: "0 6px",
    });
    const hits = K("oct_step_hour_days_at_5_or_6").value;
    const total = K("oct_step_hour_days_total").value;
    const dots = Array.from({ length: total }, (_, i) =>
      el("span", "", dotsBox, "", {
        width: "16px",
        height: "16px",
        borderRadius: "50%",
        display: "inline-block",
        border: `2px solid ${i < hits ? C.jam : C.dim}`,
        background: i < hits ? C.jam : "transparent",
      }),
    );
    el(
      "span",
      "",
      oct,
      `${n("oct_step_hour_days_at_5_or_6")} of ${n("oct_step_hour_days_total")}`,
    );
    return (t) => {
      show(h1, out3(ramp(t, 0.1, 0.6)));
      show(sub, out3(ramp(t, 0.4, 0.6)));
      const tClear = c.when("clear");
      const tJam = c.when("jam");
      bars.forEach((b, i) => {
        const p = out3(ramp(t, c.ribbon.at + 0.05 * i, 0.55));
        const h = Number(b.dataset.h) * p;
        b.style.top = `${base - h}px`;
        b.style.height = `${h}px`;
        const lane = hours[i].lane;
        const pc =
          lane === "clear"
            ? smooth(ramp(t, tClear, 0.6))
            : smooth(ramp(t, tJam, 0.6));
        b.style.background = mix(C.neutral, LANE[lane], pc);
        strip[i].style.background = mix(C.surface2, LANE[lane], pc);
      });
      groupEls.forEach(({ node, lane }) =>
        show(
          node,
          out3(ramp(t, lane === "clear" ? tClear + 0.3 : tJam + 0.3, 0.5)),
          10,
        ),
      );
      show(axis, out3(ramp(t, c.ribbon.at + 1, 0.6)), 0);
      const sp = inOut(ramp(t, tClear - 0.2, 1.4));
      solarG.setAttribute(
        "transform",
        `translate(0 ${base}) scale(1 ${sp}) translate(0 ${-base})`,
      );
      solarG.style.opacity = String(sp > 0 ? 1 : 0);
      net.setAttribute(
        "stroke-dashoffset",
        String(netLen * (1 - inOut(ramp(t, tJam, 1.8)))),
      );
      show(lowTag, out3(ramp(t, tClear + 0.5, 0.5)), 12);
      show(peakTag, out3(ramp(t, c.when("jam", "by 6pm"), 0.5)), 12);
      show(callout, out3(ramp(t, c.when("jam", "the price"), 0.6)));
      show(oct, out3(ramp(t, c.october.at, 0.5)), 12);
      dots.forEach(
        (d, i) =>
          (d.style.opacity = String(
            out3(ramp(t, c.october.at + 0.3 + 0.06 * i, 0.25)),
          )),
      );
    };
  };

  BUILD.race = (root, c) => {
    const R = data.race;
    const h1a = el("div", "h1", root, "The race: one battery, two timetables.");
    const h1b = el(
      "div",
      "h1",
      root,
      `Filling up at midday is worth <span class="green">${K("race_ratio").display}</span>${chip(K("race_ratio").prov)} the off-peak rule.`,
    );
    const sub = el(
      "div",
      "sub",
      root,
      "Same battery, same evening sale. Only the hours it buys in change.",
    );
    const legs = [
      {
        key: "fixed",
        leg: R.fixed,
        x: 72,
        label: copy.fixedLabel,
        note: "Our baseline, not Torus practice.",
        buyPrice: "fixed_rule_charge_usd_mwh",
        buyUsd: "race_fixed_buy_usd",
        net: "race_fixed_net_usd",
        keep: "fixed_usd_mw_day",
        cue: "fixed",
      },
      {
        key: "clearlane",
        leg: R.clearlane,
        x: 976,
        label: copy.clearlaneLabel,
        note: "Charges in the clear lane.",
        buyPrice: "timetable_charge_usd_mwh",
        buyUsd: "race_clearlane_buy_usd",
        net: "race_clearlane_net_usd",
        keep: "clearlane_usd_mw_day",
        cue: "cl",
      },
    ];
    const W = 872;
    const barMax = W - 60;
    const sellScale = barMax / R.fixed.sell_usd;
    for (const L of legs) {
      const card = el(
        "div",
        `card${L.key === "clearlane" ? " clear" : ""}`,
        root,
        "",
        { left: `${L.x}px`, top: "236px", width: `${W}px`, height: "418px" },
      );
      L.card = card;
      el("div", "abs muted", card, L.label, {
        left: "30px",
        top: "22px",
        fontSize: "27px",
      });
      el("div", "abs", card, L.note, {
        left: "30px",
        top: "58px",
        fontSize: "21px",
        color: C.dim,
      });
      L.big = el(
        "div",
        "abs",
        card,
        `<span class="figure${L.key === "clearlane" ? " green" : ""}" style="font-size:96px">${K(L.keep).display}</span>${chip(K(L.keep).prov)}`,
        { left: "30px", top: "92px" },
      );
      L.bigNote = el(
        "div",
        "abs muted",
        card,
        "value to RMP's system per MW per day, higher is better",
        { left: "30px", top: "196px", fontSize: "23px" },
      );
      const row = (top, html) =>
        el("div", "arith", card, html, { top: `${top}px`, fontSize: "26px" });
      L.buy = row(
        232,
        `<span class="lbl">Buys</span><span>${n("race_buy_mwh")}</span><span>at ${n(L.buyPrice)}</span><span>= ${n(L.buyUsd)}</span>`,
      );
      L.sell = row(
        278,
        `<span class="lbl">Sells</span><span>${n("race_sell_mwh")}</span><span>at ${n("race_discharge_usd_mwh")}</span><span>= ${n("race_sell_usd")}</span>`,
      );
      L.net = row(
        324,
        `<span class="lbl">Net</span><span class="muted">sells minus buys</span><span></span><span>= ${n(L.net)}</span>`,
      );
      // Sell bar, the buy bar sliding over it, and what is left: the value kept.
      L.sellBar = el("div", "abs", card, "", {
        left: "30px",
        top: "374px",
        height: "26px",
        width: `${R.fixed.sell_usd * sellScale}px`,
        borderRadius: "6px",
        background: C.shoulder,
      });
      L.keepBar = el("div", "abs", card, "", {
        left: `${30 + L.leg.buy_usd * sellScale}px`,
        top: "374px",
        height: "26px",
        width: `${(R.fixed.sell_usd - L.leg.buy_usd) * sellScale}px`,
        borderRadius: "0 6px 6px 0",
        background: L.key === "clearlane" ? C.clear : C.ink,
      });
      L.buyBar = el(
        "div",
        "abs",
        card,
        `<span style="font-size:18px;color:${C.muted};padding-left:12px;line-height:26px">buys</span>`,
        {
          left: "30px",
          top: "374px",
          height: "26px",
          width: `${L.leg.buy_usd * sellScale}px`,
          borderRadius: "6px 0 0 6px",
          background: "#3a3936",
        },
      );
      L.keepLbl = el("div", "abs", L.keepBar, "kept", {
        right: "12px",
        top: "0",
        lineHeight: "26px",
        fontSize: "18px",
        color: C.bg,
      });
    }
    // The day strip: buy and sell hours on each timetable, swept by a playhead.
    const sx = 262;
    const cw = (1848 - sx) / 24;
    const rows = [
      { label: "Off-peak rule", leg: R.fixed, top: 690 },
      { label: "Clearlane", leg: R.clearlane, top: 740 },
    ];
    const stripBox = el("div", "abs", root, "", { left: "0", top: "0" });
    for (const r of rows) {
      el("div", "abs muted", stripBox, r.label, {
        left: "72px",
        top: `${r.top + 6}px`,
        fontSize: "25px",
        whiteSpace: "nowrap",
      });
      r.cells = Array.from({ length: 24 }, (_, h) => {
        const kind = r.leg.charge_hb.includes(h)
          ? "buy"
          : r.leg.discharge_hb.includes(h)
            ? "sell"
            : null;
        const cell = el(
          "div",
          "cell",
          stripBox,
          kind === "buy" ? "Buy" : kind === "sell" ? "Sell" : "",
          {
            left: `${sx + h * cw + 2}px`,
            top: `${r.top}px`,
            width: `${cw - 4}px`,
            height: "40px",
          },
        );
        return { cell, kind, h };
      });
    }
    for (let h = 0; h < 24; h += 3)
      el("div", "abs muted", stripBox, hourLabel(h), {
        left: `${sx + h * cw - 40}px`,
        width: "80px",
        textAlign: "center",
        top: "792px",
        fontSize: "22px",
      });
    const head = el("div", "abs", root, "", {
      top: "680px",
      width: "3px",
      height: "108px",
      background: C.ink,
      borderRadius: "2px",
    });
    // The end: value kept, side by side.
    const cmp = el("div", "abs", root, "", {
      left: "72px",
      top: "676px",
      width: "1776px",
    });
    el(
      "div",
      "muted",
      cmp,
      "Value kept per MW per day: value to Rocky Mountain Power's system at day-ahead prices. Higher is better.",
      { fontSize: "25px" },
    );
    const cmpMax = 1150;
    const cmpRows = [
      {
        label: copy.fixedLabel,
        key: "fixed_usd_mw_day",
        color: C.muted,
        v: R.fixed.keep_usd,
      },
      {
        label: "Clearlane",
        key: "clearlane_usd_mw_day",
        color: C.clear,
        v: R.clearlane.keep_usd,
      },
    ].map((r, i) => {
      const box = el("div", "abs", cmp, "", {
        left: "0",
        top: `${46 + i * 56}px`,
        display: "flex",
        alignItems: "center",
        gap: "18px",
        whiteSpace: "nowrap",
      });
      el("div", "muted", box, r.label, { width: "380px", fontSize: "25px" });
      const bar = el("div", "", box, "", {
        height: "34px",
        borderRadius: "8px",
        background: r.color,
      });
      const val = el("div", "", box, n(r.key), { fontSize: "32px" });
      return { bar, val, w: (r.v / R.clearlane.keep_usd) * cmpMax };
    });
    const ratio = el(
      "div",
      "abs",
      cmp,
      `<span class="figure green" style="font-size:56px">${K("race_ratio").display}</span>${chip(K("race_ratio").prov)}<span class="muted" style="font-size:28px"> as much</span>`,
      { right: "0px", top: "34px", whiteSpace: "nowrap" },
    );

    return (t) => {
      const tAfter = c.when("cl-sell", "as much");
      const pB = smooth(ramp(t, tAfter, 0.6));
      show(h1a, out3(ramp(t, 0.1, 0.6)) * (1 - pB));
      show(h1b, pB, 16);
      show(sub, out3(ramp(t, 0.4, 0.6)));
      for (const L of legs) {
        show(
          L.card,
          out3(ramp(t, c.race.at + (L.key === "fixed" ? 0.2 : 0.5), 0.6)),
          20,
        );
        const cue = L.cue;
        const tBuy = c.when(
          `${cue}-buy`,
          L.key === "fixed" ? "buys overnight" : "buys the same",
        );
        const tSell =
          L.key === "fixed" ? c.when("fixed-sell") : c.when("cl-sell");
        const tNet =
          L.key === "fixed"
            ? c.when("fixed-sell", "Sell minus buy")
            : c.when("cl-sell", "It keeps");
        const tKeep =
          L.key === "fixed"
            ? c.when("fixed-sell", "it keeps")
            : c.when("cl-sell", "It keeps");
        // Each row builds left to right: what, how much, at what price, the subtotal.
        const build = (row, t0) =>
          [...row.children].forEach((ch, i) =>
            show(ch, out3(ramp(t, t0 + 0.28 * i, 0.4)), 0, -18),
          );
        build(L.buy, tBuy);
        build(L.sell, tSell);
        build(L.net, tNet);
        show(L.sellBar, out3(ramp(t, tSell + 0.6, 0.5)), 0);
        const pb = inOut(ramp(t, tNet, 0.9));
        L.buyBar.style.width = `${L.leg.buy_usd * sellScale * pb}px`;
        L.buyBar.style.opacity = String(pb > 0 ? 1 : 0);
        L.keepBar.style.opacity = String(smooth(ramp(t, tNet + 0.8, 0.5)));
        show(L.big, out3(ramp(t, tKeep, 0.6)), 16);
        show(L.bigNote, out3(ramp(t, tKeep + 0.3, 0.6)), 10);
      }
      // Playhead: the off-peak row first, then the Clearlane row.
      const sweeps = [
        {
          row: 0,
          from: 0,
          to: 5.5,
          t0: c.when("fixed-buy"),
          t1: c["fixed-buy"].s1,
        },
        {
          row: 0,
          from: 5.5,
          to: 20,
          t0: c.when("fixed-sell"),
          t1: c.when("fixed-sell", "Sell minus buy"),
        },
        { row: 1, from: 0, to: 17, t0: c.when("cl-buy"), t1: c["cl-buy"].s1 },
        {
          row: 1,
          from: 17,
          to: 20,
          t0: c.when("cl-sell"),
          t1: c.when("cl-sell", "It keeps"),
        },
      ];
      const done = [-1, -1];
      let active = null;
      for (const s of sweeps) {
        if (t >= s.t0) {
          const hour = lerp(s.from, s.to, inOut(ramp(t, s.t0, s.t1 - s.t0)));
          done[s.row] = Math.max(done[s.row], hour);
          active = { row: s.row, hour };
        }
      }
      const stripP = 1 - smooth(ramp(t, c.value.at - 0.2, 0.5));
      stripBox.style.opacity = String(
        out3(ramp(t, c.race.at + 0.6, 0.6)) * stripP,
      );
      rows.forEach((r, ri) => {
        for (const { cell, kind, h } of r.cells) {
          const lit = kind ? smooth(ramp(done[ri], h + 0.2, 0.6)) : 0;
          const col = kind === "buy" ? C.clear : C.shoulder;
          cell.style.background = kind ? mix(C.surface2, col, lit) : C.surface2;
          cell.style.color = kind ? (lit > 0.5 ? C.bg : C.dim) : C.dim;
        }
      });
      const hp = active ? smooth(ramp(t, sweeps[0].t0 - 0.2, 0.3)) * stripP : 0;
      if (active) {
        const x = sx + active.hour * cw;
        head.style.left = `${x - 1.5}px`;
        head.style.top = `${rows[active.row].top - 8}px`;
        head.style.height = "56px";
      }
      head.style.opacity = String(hp);
      // The comparison.
      const cp = out3(ramp(t, c.value.at, 0.6));
      show(cmp, cp, 16);
      cmpRows.forEach((r, i) => {
        r.bar.style.width = `${r.w * inOut(ramp(t, c.value.at + 0.3 + 0.4 * i, 1.0))}px`;
        show(r.val, out3(ramp(t, c.value.at + 0.9 + 0.4 * i, 0.5)), 0, -10);
      });
      show(ratio, out3(ramp(t, c.value.at + 1.8, 0.6)), 0, -14);
    };
  };

  BUILD.call = (root, c) => {
    const call = data.call;
    const trace = call.trace;
    const tMax = trace.at(-1).t_s;
    const h1 = el(
      "div",
      "h1",
      root,
      "When Rocky Mountain Power calls, Spin answers.",
    );
    const banner = el("div", "abs", root, "", {
      left: "72px",
      top: "196px",
      width: "1776px",
      height: "86px",
      borderRadius: "16px",
      background: "#2e1a17",
      borderLeft: `6px solid ${C.jam}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 30px",
      fontSize: "30px",
      whiteSpace: "nowrap",
    });
    el(
      "div",
      "",
      banner,
      `Simulated call from Rocky Mountain Power: ${nu("enrolled_kw", "kW")} for about five and a half minutes.`,
    );
    const clockEl = el("div", "", banner, "", {
      fontSize: "27px",
      marginLeft: "40px",
      color: C.muted,
    });
    // Our simulation: Spin, Pulse, and the request.
    const sim = el("div", "card", root, "", {
      left: "72px",
      top: "306px",
      width: "1150px",
      height: "560px",
    });
    el("div", "abs muted", sim, `Our simulation ${chip("SIMULATED")}`, {
      left: "30px",
      top: "22px",
      fontSize: "25px",
    });
    const svg = sv(
      "svg",
      { width: 1150, height: 560, viewBox: "0 0 1150 560" },
      sim,
    );
    svg.style.left = "0";
    svg.style.top = "0";
    // Pulse, the battery: its fill follows the morning plan through the call.
    const pulse = { x: 110, y: 120, w: 150, h: 300 };
    sv(
      "rect",
      {
        x: pulse.x,
        y: pulse.y,
        width: pulse.w,
        height: pulse.h,
        rx: 22,
        fill: "none",
        stroke: C.line,
        "stroke-width": 4,
      },
      svg,
    );
    sv(
      "rect",
      {
        x: pulse.x + pulse.w / 2 - 30,
        y: pulse.y - 16,
        width: 60,
        height: 16,
        rx: 5,
        fill: C.line,
      },
      svg,
    );
    const pulseFill = sv(
      "rect",
      {
        x: pulse.x + 10,
        width: pulse.w - 20,
        rx: 14,
        fill: C.solar,
        "fill-opacity": 0.85,
      },
      svg,
    );
    const pulseLbl = sv(
      "text",
      {
        x: pulse.x + pulse.w / 2,
        y: 470,
        "text-anchor": "middle",
        "font-size": 27,
        fill: C.ink,
      },
      svg,
    );
    pulseLbl.textContent = "Pulse, the battery";
    const pulseNote = sv(
      "text",
      {
        x: pulse.x + pulse.w / 2,
        y: 506,
        "text-anchor": "middle",
        "font-size": 23,
      },
      svg,
    );
    pulseNote.textContent = "keeps its plan";
    // Spin, the flywheel: the ring is its stored energy, the rotor turns while it holds energy.
    const sc = { x: 520, y: 270, r: 150 };
    sv(
      "circle",
      {
        cx: sc.x,
        cy: sc.y,
        r: sc.r,
        fill: "none",
        stroke: C.line,
        "stroke-width": 16,
      },
      svg,
    );
    const circ = 2 * Math.PI * sc.r;
    const energy = sv(
      "circle",
      {
        cx: sc.x,
        cy: sc.y,
        r: sc.r,
        fill: "none",
        stroke: C.spin,
        "stroke-width": 16,
        "stroke-dasharray": `${circ} ${circ}`,
        transform: `rotate(-90 ${sc.x} ${sc.y})`,
        "stroke-linecap": "round",
      },
      svg,
    );
    const rotor = sv("g", {}, svg);
    sv(
      "circle",
      {
        cx: sc.x,
        cy: sc.y,
        r: 108,
        fill: "#1f2430",
        stroke: C.spin,
        "stroke-opacity": 0.5,
        "stroke-width": 3,
      },
      rotor,
    );
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      sv(
        "line",
        {
          x1: sc.x,
          y1: sc.y,
          x2: sc.x + 104 * Math.cos(a),
          y2: sc.y + 104 * Math.sin(a),
          stroke: C.spin,
          "stroke-width": 6,
          "stroke-linecap": "round",
          "stroke-opacity": 0.8,
        },
        rotor,
      );
    }
    sv("circle", { cx: sc.x, cy: sc.y, r: 16, fill: C.spin }, rotor);
    const spinLbl = sv(
      "text",
      {
        x: sc.x,
        y: 470,
        "text-anchor": "middle",
        "font-size": 27,
        fill: C.ink,
      },
      svg,
    );
    spinLbl.textContent = "Spin, the flywheel";
    const spinNote = sv(
      "text",
      { x: sc.x, y: 506, "text-anchor": "middle", "font-size": 23 },
      svg,
    );
    // The request: power flows from Spin to Rocky Mountain Power while the call runs.
    const rmp = { x: 830, y: 210, w: 270, h: 120 };
    sv(
      "rect",
      {
        x: rmp.x,
        y: rmp.y,
        width: rmp.w,
        height: rmp.h,
        rx: 24,
        fill: "#2e1a17",
        stroke: C.jam,
        "stroke-width": 3,
      },
      svg,
    );
    const rmpT1 = sv(
      "text",
      {
        x: rmp.x + rmp.w / 2,
        y: rmp.y + 52,
        "text-anchor": "middle",
        "font-size": 26,
        fill: C.ink,
      },
      svg,
    );
    rmpT1.textContent = "Rocky Mountain";
    const rmpT2 = sv(
      "text",
      {
        x: rmp.x + rmp.w / 2,
        y: rmp.y + 86,
        "text-anchor": "middle",
        "font-size": 26,
        fill: C.ink,
      },
      svg,
    );
    rmpT2.textContent = "Power";
    const flow = sv(
      "line",
      {
        x1: sc.x + sc.r + 20,
        y1: sc.y,
        x2: rmp.x - 12,
        y2: sc.y,
        stroke: C.spin,
        "stroke-width": 8,
        "stroke-linecap": "round",
        "stroke-dasharray": "4 22",
      },
      svg,
    );
    const arrow = sv(
      "path",
      {
        d: `M ${rmp.x - 30} ${sc.y - 16} L ${rmp.x - 8} ${sc.y} L ${rmp.x - 30} ${sc.y + 16}`,
        fill: "none",
        stroke: C.spin,
        "stroke-width": 7,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      },
      svg,
    );
    // Host meter: stays under the ceiling.
    const meter = el("div", "card", root, "", {
      left: "1254px",
      top: "306px",
      width: "594px",
      height: "300px",
    });
    el(
      "div",
      "abs muted",
      meter,
      `Host meter, ceiling ${nu("host_ceiling_kw", "kW")}`,
      { left: "26px", top: "20px", fontSize: "23px", whiteSpace: "nowrap" },
    );
    const gsv = sv(
      "svg",
      { width: 594, height: 300, viewBox: "0 0 594 300" },
      meter,
    );
    gsv.style.left = "0";
    gsv.style.top = "0";
    const g = { x: 297, y: 262, r: 170 };
    const scaleMax = call.host_ceiling_kw * 1.25;
    const ang = (kw) => Math.PI * (1 - clamp(kw / scaleMax));
    const arcPt = (a, r) => `${g.x + r * Math.cos(a)} ${g.y - r * Math.sin(a)}`;
    sv(
      "path",
      {
        d: `M ${arcPt(Math.PI, g.r)} A ${g.r} ${g.r} 0 0 1 ${arcPt(0, g.r)}`,
        fill: "none",
        stroke: C.line,
        "stroke-width": 18,
      },
      gsv,
    );
    sv(
      "path",
      {
        d: `M ${arcPt(ang(call.host_ceiling_kw), g.r)} A ${g.r} ${g.r} 0 0 1 ${arcPt(0, g.r)}`,
        fill: "none",
        stroke: C.jam,
        "stroke-width": 18,
        "stroke-opacity": 0.55,
      },
      gsv,
    );
    const ca = ang(call.host_ceiling_kw);
    sv(
      "line",
      {
        x1: g.x + (g.r - 30) * Math.cos(ca),
        y1: g.y - (g.r - 30) * Math.sin(ca),
        x2: g.x + (g.r + 22) * Math.cos(ca),
        y2: g.y - (g.r + 22) * Math.sin(ca),
        stroke: C.jam,
        "stroke-width": 4,
        "stroke-dasharray": "6 5",
      },
      gsv,
    );
    const needle = sv(
      "line",
      {
        x1: g.x,
        y1: g.y,
        stroke: C.ink,
        "stroke-width": 6,
        "stroke-linecap": "round",
      },
      gsv,
    );
    sv("circle", { cx: g.x, cy: g.y, r: 12, fill: C.ink }, gsv);
    // Torus's published record, kept apart from the simulation.
    const rec = el("div", "card", root, "", {
      left: "1254px",
      top: "630px",
      width: "594px",
      height: "236px",
      padding: "24px 26px",
    });
    el(
      "div",
      "muted",
      rec,
      copy.publishedTitle ??
        "Published record (Torus, RMP case study), separate from this simulation",
      { fontSize: "22px", lineHeight: "1.35" },
    );
    el(
      "div",
      "",
      rec,
      `<span class="figure" style="font-size:72px">${K("rmp_events_2025").display}</span>${chip(K("rmp_events_2025").prov)}`,
      { marginTop: "14px" },
    );
    el("div", "", rec, "events in 2025, all unplanned calls.", {
      fontSize: "28px",
      marginTop: "8px",
    });

    // Playback of the engine's call trace, sped up: the call, then Spin's refill.
    const p0 = c.when("spin") - 0.2;
    const p1 = c.record.at - 0.4;
    const simT = (t) => tMax * ramp(t, p0, p1 - p0);
    const at = (s) => {
      const i = clamp(
        Math.floor((s / tMax) * (trace.length - 1)),
        0,
        trace.length - 2,
      );
      const f = clamp((s - trace[i].t_s) / (trace[i + 1].t_s - trace[i].t_s));
      const a = trace[i];
      const b = trace[i + 1];
      return {
        spin_kw: lerp(a.spin_kw, b.spin_kw, f),
        spin_soc: lerp(a.spin_soc, b.spin_soc, f),
        meter_kw: lerp(a.meter_kw, b.meter_kw, f),
      };
    };
    const soc = data.replan.morning_soc;
    return (t) => {
      show(h1, out3(ramp(t, 0.1, 0.6)));
      const pb = out3(ramp(t, c.call.at, 0.5));
      show(banner, pb, 0, -40);
      show(sim, out3(ramp(t, c.call.at + 0.4, 0.6)), 20);
      show(meter, out3(ramp(t, c.call.at + 0.7, 0.6)), 20);
      show(rec, out3(ramp(t, c.record.at, 0.6)), 20);
      const s = simT(t);
      const st = at(s);
      clockEl.innerHTML = `Clock ${clock(call.start_min_mt + s / 60)} MT`;
      energy.setAttribute(
        "stroke-dasharray",
        `${circ * clamp(st.spin_soc)} ${circ}`,
      );
      // Rotor angle: the integral of a speed that follows stored energy.
      let angle = 0;
      const steps = 120;
      for (let k = 0; k < steps; k++) {
        const tk = (t * (k + 0.5)) / steps;
        angle += (t / steps) * 260 * Math.sqrt(clamp(at(simT(tk)).spin_soc));
      }
      rotor.setAttribute("transform", `rotate(${angle % 360} ${sc.x} ${sc.y})`);
      const answering = s > 0 && s < call.duration_s;
      const refilling = s >= call.duration_s && st.spin_soc < 0.995;
      spinNote.textContent =
        s <= 0
          ? "full, waiting"
          : answering
            ? "answering the call"
            : refilling
              ? "refilling"
              : "full again";
      const fp = answering ? clamp(-st.spin_kw / call.requested_kw) : 0;
      flow.setAttribute("stroke-dashoffset", String(-t * 90));
      flow.setAttribute("stroke-opacity", String(0.15 + 0.85 * fp));
      arrow.setAttribute("stroke-opacity", String(0.15 + 0.85 * fp));
      // Pulse follows its plan: fill from the morning plan at the simulated minute.
      const idx = (call.start_min_mt + s / 60) / 15;
      const i0 = clamp(Math.floor(idx), 0, soc.length - 2);
      const lvl = lerp(soc[i0], soc[i0 + 1], clamp(idx - i0));
      const fh = (pulse.h - 20) * clamp(lvl);
      pulseFill.setAttribute("y", String(pulse.y + pulse.h - 10 - fh));
      pulseFill.setAttribute("height", String(fh));
      const a = ang(st.meter_kw);
      needle.setAttribute("x2", String(g.x + (g.r - 40) * Math.cos(a)));
      needle.setAttribute("y2", String(g.y - (g.r - 40) * Math.sin(a)));
    };
  };

  BUILD.replan = (root, c) => {
    const h1 = el(
      "div",
      "h1",
      root,
      "The rest of the day, solved again from the call.",
    );
    const sub = el(
      "div",
      "sub",
      root,
      `Pulse state of charge across the day, simulated station ${chip("SIMULATED")}`,
    );
    const x0 = 160;
    const x1 = 1760;
    const yTop = 300;
    const yBot = 700;
    const N = data.replan.morning_soc.length;
    const X = (i) => x0 + (i / N) * (x1 - x0);
    const Y = (v) => yBot - clamp(v) * (yBot - yTop);
    const svg = sv(
      "svg",
      { width: 1920, height: 1080, viewBox: "0 0 1920 1080" },
      root,
    );
    svg.style.left = "0";
    svg.style.top = "0";
    const defs = sv("defs", {}, svg);
    const clipA = sv("clipPath", { id: "clipA" }, defs);
    const rectA = sv(
      "rect",
      { x: x0 - 10, y: 0, height: 1080, width: 0 },
      clipA,
    );
    const clipB = sv("clipPath", { id: "clipB" }, defs);
    const callX = x0 + (data.call.start_min_mt / 1440) * (x1 - x0);
    const rectB = sv("rect", { x: callX, y: 0, height: 1080, width: 0 }, clipB);
    sv(
      "line",
      { x1: x0, y1: yBot, x2: x1, y2: yBot, stroke: C.line, "stroke-width": 2 },
      svg,
    );
    sv(
      "line",
      {
        x1: x0,
        y1: yTop,
        x2: x1,
        y2: yTop,
        stroke: C.line,
        "stroke-width": 1,
        "stroke-dasharray": "4 8",
      },
      svg,
    );
    const full = sv(
      "text",
      { x: x0 - 16, y: yTop + 8, "text-anchor": "end", "font-size": 22 },
      svg,
    );
    full.textContent = "full";
    const empty = sv(
      "text",
      { x: x0 - 16, y: yBot + 8, "text-anchor": "end", "font-size": 22 },
      svg,
    );
    empty.textContent = "empty";
    data.hours.forEach((h, i) =>
      sv(
        "rect",
        {
          x: X(i * 4) + 2,
          y: yBot + 10,
          width: (x1 - x0) / 24 - 4,
          height: 10,
          rx: 3,
          fill: LANE[h.lane],
          "fill-opacity": 0.8,
        },
        svg,
      ),
    );
    for (let h = 0; h < 24; h += 3) {
      const tx = sv(
        "text",
        { x: X(h * 4), y: yBot + 52, "text-anchor": "middle", "font-size": 23 },
        svg,
      );
      tx.textContent = hourLabel(h);
    }
    const path = (vals, from) =>
      vals
        .map((v, i) => (i < from ? null : `${X(i + 1)},${Y(v)}`))
        .filter(Boolean)
        .join(" ");
    const morning = sv(
      "polyline",
      {
        points: `${X(0)},${Y(data.replan.morning_soc[0])} ${path(data.replan.morning_soc, 0)}`,
        fill: "none",
        stroke: C.muted,
        "stroke-width": 5,
        "stroke-dasharray": "16 12",
        "clip-path": "url(#clipA)",
      },
      svg,
    );
    morning.style.opacity = "1";
    const ci = data.replan.call_index;
    const replan = sv(
      "polyline",
      {
        points: `${X(ci)},${Y(data.replan.replan_soc[ci - 1] ?? data.replan.replan_soc[ci])} ${path(data.replan.replan_soc, ci)}`,
        fill: "none",
        stroke: C.ink,
        "stroke-width": 7,
        "stroke-linejoin": "round",
        "clip-path": "url(#clipB)",
      },
      svg,
    );
    const callLine = sv(
      "line",
      {
        x1: callX,
        y1: yTop - 30,
        x2: callX,
        y2: yBot,
        stroke: C.jam,
        "stroke-width": 4,
      },
      svg,
    );
    const callTag = el("div", "abs", root, `Call, ${n("call_time_mt")}`, {
      left: `${callX - 330}px`,
      width: "310px",
      textAlign: "right",
      top: `${yTop - 52}px`,
      fontSize: "26px",
      color: C.jam,
    });
    const holds = el(
      "div",
      "abs",
      root,
      "Spin carried the call.<br>Pulse keeps its plan.",
      {
        left: `${callX + 100}px`,
        top: `${yTop + 220}px`,
        fontSize: "28px",
        lineHeight: "1.35",
        whiteSpace: "nowrap",
      },
    );
    const legend = el(
      "div",
      "abs muted",
      root,
      "Dashed: Pulse state of charge as planned this morning. Solid: the re-plan from the call.",
      { left: "160px", top: "800px", fontSize: "26px" },
    );
    return (t) => {
      show(h1, out3(ramp(t, 0.1, 0.6)));
      show(sub, out3(ramp(t, 0.4, 0.6)));
      rectA.setAttribute(
        "width",
        String((x1 - x0 + 20) * inOut(ramp(t, c.replan.at - 0.2, 1.6))),
      );
      const pc = out3(ramp(t, c.when("replan", "from the state"), 0.4));
      callLine.style.opacity = String(pc);
      show(callTag, pc, 0, 12);
      rectB.setAttribute(
        "width",
        String(
          (x1 - callX + 10) *
            inOut(ramp(t, c.when("replan", "from the state") + 0.4, 1.4)),
        ),
      );
      show(holds, out3(ramp(t, c.holds.at, 0.6)), 12);
      show(legend, out3(ramp(t, c.replan.at + 0.8, 0.6)), 10);
    };
  };

  BUILD.envelope = (root, c) => {
    const env = data.envelope;
    const h1 = el(
      "div",
      "h1",
      root,
      "An hourly envelope, with System Critical Hours.",
    );
    const sub = el(
      "div",
      "sub",
      root,
      "The envelope is a format Clearlane proposes: a working example, not a filing.",
    );
    const schema = el("div", "abs pill", root, env.schema, {
      right: "72px",
      top: "176px",
      fontSize: "23px",
      color: C.muted,
      fontFamily: "Consolas, 'Cascadia Mono', monospace",
    });
    const sx = 330;
    const cw = (1848 - sx) / 24;
    const kwMax = Math.max(
      ...env.hours.map((h) =>
        Math.max(h.max_charge_kw, h.max_discharge_kw, h.reserve_kw),
      ),
    );
    const grid = el("div", "abs", root, "", {
      left: "0",
      top: "0",
      width: "1920px",
      height: "1080px",
    });
    const rowLbl = (txt, top) =>
      el("div", "abs muted", grid, txt, {
        left: "72px",
        top: `${top}px`,
        fontSize: "24px",
        width: "250px",
      });
    const R = { reserve: 262, chargeBase: 432, band: 110, dischargeTop: 448 };
    rowLbl(
      `Reserve for calls<br>${env.hours[0].reserve_kw === env.hours.at(-1).reserve_kw ? `${env.hours[0].reserve_kw} kW` : "kW"}${chip("SIMULATED")}`,
      R.reserve - 6,
    ).style.lineHeight = "1.25";
    rowLbl("Max charge", R.chargeBase - 60);
    rowLbl("Max discharge", R.dischargeTop + 40);
    const cols = env.hours.map((h, i) => {
      const x = sx + i * cw + 3;
      const w = cw - 6;
      const reserve = el("div", "abs", grid, "", {
        left: `${x}px`,
        top: `${R.reserve}px`,
        width: `${w}px`,
        height: "28px",
        borderRadius: "6px",
        background: C.spin,
        opacity: "0.75",
      });
      const chg = el("div", "abs", grid, "", {
        left: `${x}px`,
        width: `${w}px`,
        borderRadius: "6px 6px 0 0",
        background: C.clear,
      });
      const dis = el("div", "abs", grid, "", {
        left: `${x}px`,
        top: `${R.dischargeTop}px`,
        width: `${w}px`,
        borderRadius: "0 0 6px 6px",
        background: C.shoulder,
      });
      const plan = el("div", "abs", grid, "", {
        left: `${x - 2}px`,
        width: `${w + 4}px`,
        height: "5px",
        borderRadius: "3px",
        background: C.ink,
      });
      return { h, reserve, chg, dis, plan };
    });
    for (let h = 0; h < 24; h += 3)
      el("div", "abs muted", grid, hourLabel(h), {
        left: `${sx + h * cw - 40 + cw / 2}px`,
        width: "80px",
        textAlign: "center",
        top: "574px",
        fontSize: "22px",
      });
    el("div", "abs", grid, "Tick: planned power", {
      left: "72px",
      top: "534px",
      fontSize: "20px",
      color: C.dim,
      whiteSpace: "nowrap",
    });
    const schIdx = env.hours
      .map((h, i) => (h.system_critical ? i : -1))
      .filter((i) => i >= 0);
    const s0 = Math.min(...schIdx);
    const s1 = Math.max(...schIdx);
    const schBox = el("div", "abs", grid, "", {
      left: `${sx + s0 * cw - 4}px`,
      top: `${R.reserve - 14}px`,
      width: `${(s1 - s0 + 1) * cw + 8}px`,
      height: `${R.dischargeTop + R.band - R.reserve + 28}px`,
      border: `3px solid ${C.jam}`,
      borderRadius: "14px",
      background: "rgba(238,107,88,0.08)",
    });
    const schLbl = el(
      "div",
      "abs",
      grid,
      `${copy.schLabel}: ${n("sch_hours_today")} hours today`,
      {
        right: "72px",
        top: "614px",
        fontSize: "26px",
        color: C.jam,
        whiteSpace: "nowrap",
      },
    );
    // The backtest: calls missed by policy, lower is better.
    const bt = el("div", "abs", root, "", {
      left: "72px",
      top: "668px",
      width: "1776px",
    });
    el(
      "div",
      "muted",
      bt,
      `Calls missed in a simulated backtest over ${nu("backtest_days", "days")}, with Torus's call heatmap in Mountain time. Lower is better.`,
      { fontSize: "25px" },
    );
    const btRows = [
      {
        label: "Clearlane",
        key: "calls_missed_by_policy_clearlane_mt",
        color: C.clear,
      },
      {
        label: "Off-peak rule",
        key: "calls_missed_by_policy_fixed_overnight_mt",
        color: C.shoulder,
      },
      {
        label: "Price-only plan",
        key: "calls_missed_by_policy_price_only_mt",
        color: C.jam,
      },
    ];
    const vMax = Math.max(...btRows.map((r) => K(r.key).value));
    btRows.forEach((r, i) => {
      const box = el("div", "abs", bt, "", {
        left: "0",
        top: `${48 + i * 52}px`,
        display: "flex",
        alignItems: "center",
        gap: "18px",
        whiteSpace: "nowrap",
      });
      el("div", "muted", box, r.label, { width: "250px", fontSize: "26px" });
      r.bar = el("div", "", box, "", {
        height: "30px",
        borderRadius: "7px",
        background: r.color,
        minWidth: "8px",
      });
      r.val = el("div", "", box, n(r.key), { fontSize: "30px" });
      r.w = (K(r.key).value / vMax) * 1000;
    });
    return (t) => {
      show(h1, out3(ramp(t, 0.1, 0.6)));
      show(sub, out3(ramp(t, 0.4, 0.6)));
      show(schema, out3(ramp(t, 0.7, 0.6)), 0, 20);
      const dimP = 1 - 0.55 * smooth(ramp(t, c.backtest.at, 0.6));
      grid.style.opacity = String(dimP);
      cols.forEach(({ h, reserve, chg, dis, plan }, i) => {
        const p = out3(ramp(t, c.envelope.at + 0.05 * i, 0.6));
        const ch = (h.max_charge_kw / kwMax) * R.band * p;
        chg.style.top = `${R.chargeBase - ch}px`;
        chg.style.height = `${ch}px`;
        dis.style.height = `${(h.max_discharge_kw / kwMax) * R.band * p}px`;
        reserve.style.opacity = String(0.75 * p);
        const py =
          h.planned_kw >= 0
            ? R.chargeBase - (h.planned_kw / kwMax) * R.band
            : R.dischargeTop + (-h.planned_kw / kwMax) * R.band;
        plan.style.top = `${py - 2}px`;
        plan.style.opacity = String(
          out3(ramp(t, c.envelope.at + 1.4 + 0.03 * i, 0.4)),
        );
      });
      const ps = out3(ramp(t, c.sch.at, 0.6));
      schBox.style.opacity = String(ps);
      show(schLbl, ps, 10);
      show(bt, out3(ramp(t, c.backtest.at, 0.6)), 16);
      btRows.forEach((r, i) => {
        r.bar.style.width = `${r.w * inOut(ramp(t, c.backtest.at + 0.4 + 0.5 * i, 0.9))}px`;
        show(r.val, out3(ramp(t, c.backtest.at + 0.9 + 0.5 * i, 0.4)), 0, -10);
      });
    };
  };

  BUILD.scale = (root, c) => {
    const h1 = el(
      "div",
      "h1",
      root,
      "Scale the station to the fleet the MOU allows.",
    );
    const sub = el(
      "div",
      "sub",
      root,
      `${copy.mouCeiling}. ${copy.priceTaker}.`,
    );
    const lo = K("mou_70mw").value;
    const hi = K("torus_500mw").value;
    const tx0 = 72;
    const tx1 = 1848;
    const ty = 352;
    const track = el("div", "abs", root, "", {
      left: `${tx0}px`,
      top: `${ty}px`,
      width: `${tx1 - tx0}px`,
      height: "6px",
      borderRadius: "3px",
      background: C.line,
    });
    const fill = el("div", "abs", root, "", {
      left: `${tx0}px`,
      top: `${ty}px`,
      height: "6px",
      borderRadius: "3px",
      background: C.ink,
    });
    const knob = el("div", "abs", root, "", {
      top: `${ty - 13}px`,
      width: "32px",
      height: "32px",
      borderRadius: "50%",
      background: C.ink,
    });
    const loLbl = el("div", "abs", root, `MOU, ${nu("mou_70mw", "MW")}`, {
      left: `${tx0}px`,
      top: `${ty + 34}px`,
      fontSize: "26px",
    });
    const hiLbl = el(
      "div",
      "abs",
      root,
      `MOU for up to ${nu("torus_500mw", "MW")}`,
      { right: `${1920 - tx1}px`, top: `${ty + 34}px`, fontSize: "26px" },
    );
    const fleet = el("div", "abs", root, "", {
      left: `${tx0}px`,
      top: "254px",
      fontSize: "30px",
    });
    const cards = [
      {
        label: copy.fixedLabel,
        perMw: "fixed_usd_mw_day",
        lo: "fixed_70",
        hi: "fixed_500",
        x: 72,
        cls: "",
      },
      {
        label: copy.clearlaneLabel,
        perMw: "clearlane_usd_mw_day",
        lo: "clearlane_70",
        hi: "clearlane_500",
        x: 976,
        cls: " green",
      },
    ].map((d) => {
      const card = el("div", `card${d.cls ? " clear" : ""}`, root, "", {
        left: `${d.x}px`,
        top: "452px",
        width: "872px",
        height: "330px",
      });
      el("div", "abs muted", card, d.label, {
        left: "32px",
        top: "26px",
        fontSize: "27px",
      });
      const fig = el("div", "abs", card, "", {
        left: "32px",
        top: "86px",
        whiteSpace: "nowrap",
      });
      el(
        "div",
        "abs",
        card,
        "per day, value to RMP's system at day-ahead prices.",
        { left: "32px", top: "228px", fontSize: "25px" },
      );
      el("div", "abs muted", card, "Higher is better.", {
        left: "32px",
        top: "266px",
        fontSize: "25px",
      });
      return { ...d, card, fig };
    });
    let lastMw = null;
    return (t) => {
      show(h1, out3(ramp(t, 0.1, 0.6)));
      show(sub, out3(ramp(t, 0.4, 0.6)));
      const pIn = out3(ramp(t, c["scale-70"].at, 0.6));
      [track, loLbl, hiLbl, fleet].forEach((e) => show(e, pIn, 10));
      cards.forEach((d, i) =>
        show(d.card, out3(ramp(t, c["scale-70"].at + 0.3 + 0.2 * i, 0.6)), 20),
      );
      const pm = inOut(ramp(t, c.when("scale-500") + 0.2, 3.2));
      const mw = Math.round(lerp(lo, hi, pm));
      const x = tx0 + ((mw - lo) / (hi - lo)) * (tx1 - tx0);
      fill.style.width = `${x - tx0}px`;
      fill.style.opacity = String(pIn);
      knob.style.left = `${x - 16}px`;
      knob.style.opacity = String(pIn);
      if (mw !== lastMw) {
        lastMw = mw;
        const fleetProv =
          mw === lo
            ? K("mou_70mw").prov
            : mw === hi
              ? K("torus_500mw").prov
              : "SIMULATED";
        fleet.innerHTML = `<span class="muted">Fleet size</span> ${mw} MW${chip(fleetProv)}`;
        for (const d of cards) {
          // The endpoints print the keys; between them the slider scales linearly, as the engine does.
          const text =
            mw === lo
              ? K(d.lo).display
              : mw === hi
                ? K(d.hi).display
                : usd0(K(d.perMw).value * mw);
          const prov =
            mw === lo ? K(d.lo).prov : mw === hi ? K(d.hi).prov : "DERIVED";
          d.fig.innerHTML = `<span class="figure${d.cls}" style="font-size:120px">${text}</span>${chip(prov)}`;
        }
      }
    };
  };

  BUILD.close = (root, c) => {
    const words = (text, top, size, cls) => {
      const box = el("div", `abs ${cls ?? ""}`, root, "", {
        left: "72px",
        top: `${top}px`,
        fontSize: `${size}px`,
        width: "1776px",
        lineHeight: "1.18",
        whiteSpace: "nowrap",
      });
      return text
        .split(" ")
        .map((w, i, all) =>
          el("span", "", box, w + (i < all.length - 1 ? " " : "")),
        );
    };
    const l1 = words(copy.closeLine1, 300, 58);
    const l2 = words(copy.closeLine2, 410, 46);
    l2[0].className = "green";
    const ask = el(
      "div",
      "abs pill solid",
      root,
      "The ask: pilot the envelope.",
      {
        left: "72px",
        top: "574px",
        fontSize: "38px",
        padding: "12px 34px 14px",
      },
    );
    const brand = el("div", "abs wordmark-small", root, "", {
      left: "72px",
      top: "742px",
    });
    const bsv = sv(
      "svg",
      { width: 54, height: 54, viewBox: "0 0 54 54" },
      brand,
    );
    bsv.style.position = "relative";
    sv(
      "circle",
      { cx: 27, cy: 27, r: 21, fill: "none", stroke: C.ink, "stroke-width": 6 },
      bsv,
    );
    el("span", "", brand, "Clearlane");
    el(
      "span",
      "muted",
      brand,
      "Simulated Torus-style stations on Utah's grid.",
      { fontSize: "26px", marginLeft: "18px" },
    );
    // Words light up across the time the voice speaks them.
    const reveal = (spans, cue, t) => {
      const x = c[cue];
      spans.forEach((s, i) => {
        const p = out3(
          ramp(t, x.s0 + ((x.s1 - x.s0) * i) / spans.length, 0.35),
        );
        s.style.opacity = String(0.12 + 0.88 * p);
      });
    };
    return (t) => {
      const p1 = out3(ramp(t, c.close1.at - 0.3, 0.5));
      l1[0].parentElement.style.opacity = String(p1);
      reveal(l1, "close1", t);
      const p2 = out3(ramp(t, c.close2.at - 0.3, 0.5));
      l2[0].parentElement.style.opacity = String(p2);
      reveal(l2, "close2", t);
      show(ask, out3(ramp(t, c.ask.at, 0.5)), 14);
      show(brand, out3(ramp(t, c.ask.s1 + 0.4, 0.8)), 10);
    };
  };

  const NOTES = {
    title: "Data: CAISO OASIS and EIA.",
    traffic: "CAISO day-ahead price and forecasts.",
    race: "Engine reference race. The off-peak rule is our baseline, not Torus practice.",
    call: "Our simulation; Torus's published record shown separately.",
    replan: "Simulated station; the engine's re-plan.",
    envelope: "Engine envelope and backtest.",
    scale:
      "Torus and RMP announcements; value to RMP's system at day-ahead prices.",
    close: "Simulated Torus-style stations. Data: CAISO OASIS and EIA.",
  };

  const scenes = timeline.scenes.map((s) => {
    const root = el("section", "scene", scenesRoot);
    const c = cueTable(s);
    const build = BUILD[s.id];
    if (!build) throw new Error(`no scene ${s.id}`);
    return { s, root, c, update: build(root, c) };
  });

  let lastCaption = null;
  function seek(t) {
    let current = scenes[0];
    for (const sc of scenes) {
      const lt = t - sc.s.start;
      const dur = sc.s.end - sc.s.start;
      const isLast = sc === scenes.at(-1);
      const on = lt >= 0 && (lt < dur || isLast);
      sc.root.style.display = on ? "block" : "none";
      if (!on) continue;
      current = sc;
      const fadeIn = sc === scenes[0] ? 1 : smooth(ramp(lt, 0, 0.45));
      const fadeOut = isLast
        ? 1 - smooth(ramp(lt, dur - 0.9, 0.9))
        : 1 - smooth(ramp(lt, dur - 0.45, 0.45));
      sc.root.style.opacity = String(Math.min(fadeIn, fadeOut));
      sc.update(lt);
    }
    const ci = scenes.indexOf(current);
    chapterEls.forEach(
      (e, i) =>
        (e.className = `chapter${i === ci ? " on" : i < ci ? " past" : ""}`),
    );
    footNote.textContent = NOTES[current.s.id] ?? "";
    const cap = timeline.captions.find((k) => t >= k.start && t < k.end);
    if (cap !== lastCaption) {
      caption.textContent = cap ? cap.text : "";
      lastCaption = cap;
    }
    const cp = cap
      ? Math.min(ramp(t, cap.start, 0.12), 1 - ramp(t, cap.end - 0.12, 0.12))
      : 0;
    caption.style.opacity = String(cp);
    caption.style.visibility = cap ? "visible" : "hidden";
  }

  window.__seek = seek;
  seek(0);
  window.__ready = document.fonts.ready.then(() => true);
})();
