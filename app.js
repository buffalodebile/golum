/* Public results page — renders one or more strategies (SITE_DATA / QUALITY_DATA)
   with Plotly, in tabs. Each strategy curve is a single color throughout; a dashed
   vertical line marks the live-trading start. Every selected period re-bases to
   $100 at the left edge. Optional Nasdaq-100 buy & hold overlay. */

(function () {
  const ACCENT = "#00CED1";   // strategy
  const NASDAQ = "#7C9CFF";   // benchmark overlay
  const RED = "#EF5350";
  const GRID = "#262730";
  const MUTED = "#9AA0AC";

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function cellColor(v, cap) {
    if (v == null) return "transparent";
    const a = Math.min(Math.abs(v) / cap, 1) * 0.75 + 0.08;
    return v >= 0 ? `rgba(38,166,154,${a})` : `rgba(239,83,80,${a})`;
  }

  // Render a full strategy panel (stats band + equity/drawdown charts + heatmap)
  // for the data object D into the elements named by `ids`. Returns a small
  // handle with resize() — needed because Plotly charts built inside a hidden
  // tab render at 0 width and must be resized when the tab becomes visible.
  function renderStrategy(D, ids) {
    const statsEl = document.getElementById(ids.stats);
    if (!D || !D.strategy) {
      if (statsEl) statsEl.innerHTML =
        "<p style='color:#EF5350'>data missing — run the generator script</p>";
      return null;
    }

    // ---- Stats band ----
    const s = D.stats;
    const fmtPct = (v) => (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
    if (statsEl) statsEl.innerHTML = [
      ["Live return", fmtPct(s.live_total_pct), s.live_total_pct >= 0 ? "pos" : "neg"],
      ["Months live", String(s.live_months), "accent"],
      ["Live max drawdown", s.live_max_dd_pct.toFixed(1) + "%", "neg"],
      ["Model CAGR (" + s.backtest_years.toFixed(0) + "y)", fmtPct(s.backtest_cagr_pct), ""],
    ].map(([label, value, cls]) =>
      `<div class="stat"><div class="value ${cls}">${value}</div><div class="label">${label}</div></div>`
    ).join("");

    if (ids.ddCallout) {
      const ddEl = document.getElementById(ids.ddCallout);
      if (ddEl) ddEl.textContent = s.backtest_max_dd_pct.toFixed(0) + "%";
    }
    const upHero = document.getElementById(ids.updatedHero);
    if (upHero) upHero.textContent = "Data updated " + D.generated_at;

    if (ids.risk && ids.riskGauge) renderRiskGauge(ids.risk, ids.riskGauge);

    // ---- Equity chart ----
    const strat = D.strategy;
    const ndx = D.nasdaq;
    const firstDate = strat.dates[0];
    const today = strat.dates[strat.dates.length - 1];
    const inception = D.inception;

    const state = { from: firstDate, to: today, scale: "log", nasdaq: false };

    function rebase(series, from, to) {
      const x = [], y = [];
      let base = null;
      for (let i = 0; i < series.dates.length; i++) {
        const d = series.dates[i];
        if (d < from || d > to) continue;
        if (base === null) base = series.values[i];
        x.push(d);
        y.push(series.values[i] / base * 100);
      }
      return { x, y };
    }

    function ddWindow(series, from, to) {
      let peak = -Infinity;
      const x = [], y = [];
      for (let i = 0; i < series.dates.length; i++) {
        const d = series.dates[i];
        if (d < from || d > to) continue;
        const v = series.values[i];
        if (v > peak) peak = v;
        x.push(d);
        y.push(v / peak * 100 - 100);
      }
      return { x, y };
    }

    function minusYears(iso, n) {
      const d = new Date(iso + "T00:00:00Z");
      d.setUTCFullYear(d.getUTCFullYear() - n);
      return d.toISOString().slice(0, 10);
    }

    // Drop fixed-horizon presets longer than the available history (e.g. no
    // "20Y" on a strategy with only ~17 years of backtest). All/YTD/Live always
    // stay.
    const spanYears = (new Date(today) - new Date(firstDate)) / (365.25 * 86400000);
    const PRESETS = [
      ["All", () => firstDate],
      ["20Y", () => minusYears(today, 20)],
      ["10Y", () => minusYears(today, 10)],
      ["5Y", () => minusYears(today, 5)],
      ["3Y", () => minusYears(today, 3)],
      ["1Y", () => minusYears(today, 1)],
      ["YTD", () => today.slice(0, 4) + "-01-01"],
      ["Live", () => inception],
    ].filter(([label]) => {
      const m = label.match(/^(\d+)Y$/);
      return !m || +m[1] <= spanYears;
    });

    const bar = document.getElementById(ids.periodBar);
    bar.innerHTML = PRESETS.map(([label], i) =>
      `<button data-i="${i}"${label === "All" ? ' class="active"' : ""}>${label}</button>`
    ).join("");

    const fromInput = document.getElementById(ids.fromDate);
    const toInput = document.getElementById(ids.toDate);
    fromInput.min = firstDate; fromInput.max = today;
    toInput.min = firstDate; toInput.max = today;

    const baseLayout = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: MUTED, family: "Inter, Segoe UI, system-ui, sans-serif", size: 12 },
      margin: { l: 62, r: 18, t: 18, b: 38 },
      hovermode: "x unified",
      hoverlabel: { bgcolor: "#1A1D26", bordercolor: GRID, font: { color: "#FAFAFA" } },
      legend: { orientation: "h", y: 1.08, x: 0, bgcolor: "rgba(0,0,0,0)" },
      xaxis: { gridcolor: GRID, zeroline: false },
      yaxis: { gridcolor: GRID, zeroline: false },
    };
    const config = { displayModeBar: false, responsive: true };

    function render() {
      const sStrat = rebase(strat, state.from, state.to);
      const ddS = ddWindow(strat, state.from, state.to);
      const traces = [{
        x: sStrat.x, y: sStrat.y, name: "Strategy",
        mode: "lines", line: { color: ACCENT, width: 2.4 },
        hovertemplate: "$%{y:,.0f}<extra>Strategy</extra>",
      }];
      if (state.nasdaq) {
        const sNdx = rebase(ndx, state.from, state.to);
        traces.push({
          x: sNdx.x, y: sNdx.y, name: "Nasdaq-100 (buy & hold)",
          mode: "lines", line: { color: NASDAQ, width: 1.8 },
          hovertemplate: "$%{y:,.0f}<extra>Nasdaq-100</extra>",
        });
      }

      const shapes = [], annotations = [];
      if (inception >= state.from && inception <= state.to) {
        shapes.push({
          type: "line", x0: inception, x1: inception, y0: 0, y1: 1, yref: "paper",
          line: { color: "#C7CCD6", width: 1.3, dash: "dash" },
        });
        annotations.push({
          x: inception, y: 1, yref: "paper", yanchor: "bottom", xanchor: "right",
          text: "Live start", showarrow: false, font: { color: "#C7CCD6", size: 11 },
        });
      }

      const layout = Object.assign({}, baseLayout, {
        shapes, annotations, showlegend: state.nasdaq,
        margin: { l: 62, r: 18, t: 18, b: 6 },
        xaxis: Object.assign({}, baseLayout.xaxis, {
          type: "date", range: [state.from, state.to], showticklabels: false,
        }),
        yaxis: Object.assign({}, baseLayout.yaxis, {
          type: state.scale, tickprefix: "$",
          fixedrange: true,
          title: { text: "Value of $100 invested", font: { size: 12 } },
        }),
      });
      Plotly.react(ids.equity, traces, layout, config);

      const ddTraces = [{
        x: ddS.x, y: ddS.y, name: "Strategy",
        mode: "lines", line: { color: RED, width: 1 },
        fill: "tozeroy", fillcolor: "rgba(239,83,80,.22)",
        hovertemplate: "%{y:.1f}%<extra>Drawdown</extra>",
      }];
      if (state.nasdaq) {
        const ddN = ddWindow(ndx, state.from, state.to);
        ddTraces.push({
          x: ddN.x, y: ddN.y, name: "Nasdaq-100",
          mode: "lines", line: { color: NASDAQ, width: 1.4 },
          hovertemplate: "%{y:.1f}%<extra>Nasdaq DD</extra>",
        });
      }
      const ddLayout = Object.assign({}, baseLayout, {
        shapes, showlegend: false,
        margin: { l: 62, r: 18, t: 6, b: 34 },
        xaxis: Object.assign({}, baseLayout.xaxis, {
          type: "date", range: [state.from, state.to], fixedrange: true,
        }),
        yaxis: Object.assign({}, baseLayout.yaxis, {
          ticksuffix: "%", fixedrange: true, rangemode: "nonpositive",
          title: { text: "Drawdown (%)", font: { size: 12 } },
        }),
      });
      Plotly.react(ids.drawdown, ddTraces, ddLayout, config);
    }

    function setActivePreset(label) {
      bar.querySelectorAll("button").forEach((b) =>
        b.classList.toggle("active", label != null && b.textContent === label));
    }

    function toISO(x) {
      return typeof x === "number"
        ? new Date(x).toISOString().slice(0, 10)
        : String(x).slice(0, 10);
    }
    function wireZoom() {
      const gd = document.getElementById(ids.equity);
      let guard = false;
      gd.on("plotly_relayout", (ev) => {
        if (guard) return;
        if (ev["xaxis.autorange"]) {
          state.from = firstDate; state.to = today;
          setActivePreset("All");
          fromInput.value = state.from; toInput.value = state.to;
          guard = true; render(); guard = false;
          return;
        }
        const x0 = ev["xaxis.range[0]"], x1 = ev["xaxis.range[1]"];
        if (x0 == null || x1 == null) return;
        let f = toISO(x0), t = toISO(x1);
        if (f < firstDate) f = firstDate;
        if (t > today) t = today;
        if (f >= t) return;
        state.from = f; state.to = t;
        setActivePreset(null);
        fromInput.value = f; toInput.value = t;
        guard = true; render(); guard = false;
      });
    }

    bar.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        bar.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.from = PRESETS[+btn.dataset.i][1]();
        state.to = today;
        fromInput.value = state.from;
        toInput.value = state.to;
        render();
      });
    });

    function onDateInput() {
      if (fromInput.value) state.from = fromInput.value;
      if (toInput.value) state.to = toInput.value;
      if (state.from >= state.to) return;
      bar.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      render();
    }
    fromInput.addEventListener("change", onDateInput);
    toInput.addEventListener("change", onDateInput);

    document.getElementById(ids.cmpNasdaq).addEventListener("change", (e) => {
      state.nasdaq = e.target.checked;
      render();
    });
    const toggle = document.getElementById(ids.scaleToggle);
    toggle.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        toggle.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.scale = btn.dataset.scale;
        render();
      });
    });

    fromInput.value = state.from;
    toInput.value = state.to;
    render();
    wireZoom();

    // ---- Monthly returns heatmap ----
    const table = document.getElementById(ids.heatmap);
    let html = "<thead><tr><th></th>" +
      MONTHS.map((m) => `<th>${m}</th>`).join("") +
      "<th class='total-col'>Year</th></tr></thead><tbody>";
    for (const row of D.heatmap) {
      const label = row.live
        ? `${row.y} <span class="live-tag"><span class="live-dot"></span>LIVE</span>`
        : row.y;
      // Non-color cue for live (real-money) months, for users who can't perceive
      // the green border/label (color-blind, high-contrast).
      const liveTitle = row.live ? ' title="Live (real money)"' : "";
      html += `<tr${row.live ? ' class="live-row"' : ""}><th>${label}</th>`;
      for (const v of row.m) {
        const txt = v == null ? "" : (v > 0 ? "+" : "") + v.toFixed(1);
        html += `<td${liveTitle} style="background:${cellColor(v, 10)}">${txt}</td>`;
      }
      const t = row.total;
      html += `<td class="total-col"${liveTitle} style="background:${cellColor(t, 30)}">` +
        `${(t > 0 ? "+" : "") + t.toFixed(1)}</td></tr>`;
    }
    table.innerHTML = html + "</tbody>";
    const wrap = table.parentElement;
    wrap.scrollTop = wrap.scrollHeight;

    return {
      resize() {
        Plotly.Plots.resize(document.getElementById(ids.equity));
        Plotly.Plots.resize(document.getElementById(ids.drawdown));
      },
    };
  }

  // ---- Risk gauge (1-10 editorial indicator, shown under the stats band) ----
  function renderRiskGauge(level, elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    const lvl = Math.max(1, Math.min(10, Math.round(level)));
    const scoreColor = lvl >= 8 ? "var(--magenta, #EC4899)"
      : lvl >= 5 ? "var(--indigo, #6366F1)" : "var(--accent, #00CED1)";
    let segs = "";
    for (let i = 0; i < 10; i++) {
      segs += `<span class="rg-seg${i < lvl ? " on" : ""}" style="--i:${i}"></span>`;
    }
    el.innerHTML =
      `<div class="rg-head"><span class="rg-title">Risk level</span>` +
      `<span class="rg-score" style="color:${scoreColor}"><b>${lvl}</b><span>/10</span></span></div>` +
      `<div class="rg-track" role="img" aria-label="Risk level ${lvl} out of 10">${segs}</div>` +
      `<div class="rg-scale"><span>Lower risk</span><span>Higher risk</span></div>` +
      `<p class="rg-note">A 1–10 indicator of how bumpy the ride can be, ` +
      `based on leverage and the strategy's historical drawdown.</p>`;
  }

  // ---- Current portfolio (Quality tab): holdings table + rebalance countdown ----
  function renderHoldings(D, ids) {
    const cd = document.getElementById(ids.countdown);
    if (cd && D.next_rebalance) {
      const target = new Date(D.next_rebalance + "T00:00:00");
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const days = Math.max(0, Math.round((target - today) / 86400000));
      const opts = { year: "numeric", month: "long", day: "numeric" };
      cd.innerHTML = `Next rebalance in <strong>${days}</strong> day${days === 1 ? "" : "s"} ` +
        `<span class="cd-date">(${target.toLocaleDateString("en-US", opts)})</span>`;
    }

    const table = document.getElementById(ids.table);
    if (!table) return;
    const H = D.holdings || [];
    if (!H.length) {
      table.innerHTML = "<tbody><tr><td class='hint'>Portfolio not available right now.</td></tr></tbody>";
      return;
    }
    const fmtW = (w) => (w * 100).toFixed(1) + "%";
    const fmtG = (g) => (g == null ? "&mdash;" : (g >= 0 ? "+" : "") + g.toFixed(1) + "%");
    let html = "<thead><tr><th>Ticker</th><th>Company</th><th>Sector</th>" +
      "<th class='num'>Weight</th><th class='num'>Growth</th></tr></thead><tbody>";
    for (const h of H) {
      const g = h.growth_pct;
      const cls = g == null ? "" : (g >= 0 ? "pos" : "neg");
      html += `<tr><td class="tk">${esc(h.ticker)}</td><td>${esc(h.company || h.ticker)}</td>` +
        `<td class="sec">${esc(h.sector || "")}</td>` +
        `<td class="num">${fmtW(h.weight || 0)}</td>` +
        `<td class="num ${cls}">${fmtG(g)}</td></tr>`;
    }
    table.innerHTML = html + "</tbody>";
  }

  // ---- Element id maps per tab ----
  const R_IDS = {
    stats: "stats-band", updatedHero: "updated-hero",
    equity: "equity-chart", drawdown: "drawdown-chart", periodBar: "period-bar",
    fromDate: "from-date", toDate: "to-date", cmpNasdaq: "cmp-nasdaq",
    scaleToggle: "scale-toggle", heatmap: "heatmap", ddCallout: "dd-callout",
    risk: 9, riskGauge: "risk-gauge",
  };
  const Q_IDS = {
    stats: "stats-band-q", updatedHero: "updated-hero-q",
    equity: "equity-chart-q", drawdown: "drawdown-chart-q", periodBar: "period-bar-q",
    fromDate: "from-date-q", toDate: "to-date-q", cmpNasdaq: "cmp-nasdaq-q",
    scaleToggle: "scale-toggle-q", heatmap: "heatmap-q", ddCallout: null,
    risk: 6, riskGauge: "risk-gauge-q",
  };

  // ---- Per-page init ----
  // Each strategy now lives on its own page (rotation.html / quality.html).
  // Render whichever panel is present. Panels are always visible, so Plotly lays
  // out at full width immediately — no tab switching or lazy-render needed.
  const gen = (window.SITE_DATA && window.SITE_DATA.generated_at) ||
              (window.QUALITY_DATA && window.QUALITY_DATA.generated_at);
  const upEl = document.getElementById("updated");
  if (upEl && gen) upEl.textContent = "Data updated " + gen;

  if (document.getElementById("equity-chart") && window.SITE_DATA) {
    renderStrategy(window.SITE_DATA, R_IDS);
  }
  if (document.getElementById("equity-chart-q") && window.QUALITY_DATA) {
    renderStrategy(window.QUALITY_DATA, Q_IDS);
    renderHoldings(window.QUALITY_DATA, { table: "holdings-q", countdown: "countdown-q" });
  }
})();
