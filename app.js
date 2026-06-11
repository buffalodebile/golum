/* Public results page — renders SITE_DATA (data.js) with Plotly.
   Strategy curve is a single color throughout; a dashed vertical line marks
   the live-trading start. Every selected period re-bases to $100 at the left
   edge. Optional Nasdaq-100 buy & hold overlay. */

(function () {
  const D = window.SITE_DATA;
  if (!D || !D.strategy) {
    document.getElementById("stats-band").innerHTML =
      "<p style='color:#EF5350'>data.js missing — run scripts/generate_site_data.py</p>";
    return;
  }

  const ACCENT = "#00CED1";   // strategy
  const NASDAQ = "#7C9CFF";   // benchmark overlay
  const GREEN = "#26A69A";
  const RED = "#EF5350";
  const GRID = "#262730";
  const MUTED = "#9AA0AC";

  // ---- Stats band ----
  const s = D.stats;
  const fmtPct = (v) => (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
  document.getElementById("stats-band").innerHTML = [
    ["Live return", fmtPct(s.live_total_pct), s.live_total_pct >= 0 ? "pos" : "neg"],
    ["Months live", String(s.live_months), "accent"],
    ["Live max drawdown", s.live_max_dd_pct.toFixed(1) + "%", "neg"],
    ["Model CAGR (" + s.backtest_years.toFixed(0) + "y)", fmtPct(s.backtest_cagr_pct), ""],
  ].map(([label, value, cls]) =>
    `<div class="stat"><div class="value ${cls}">${value}</div><div class="label">${label}</div></div>`
  ).join("");

  const ddEl = document.getElementById("dd-callout");
  if (ddEl) ddEl.textContent = s.backtest_max_dd_pct.toFixed(0) + "%";
  const upEl = document.getElementById("updated");
  if (upEl) upEl.textContent = "Data updated " + D.generated_at;

  // ---- Equity chart ----
  const strat = D.strategy;     // {dates, values} growth of $100 since 1985
  const ndx = D.nasdaq;
  const firstDate = strat.dates[0];
  const today = strat.dates[strat.dates.length - 1];
  const inception = D.inception;

  const state = { from: firstDate, to: today, scale: "log", nasdaq: false };

  // Re-base a series to $100 at the first point inside [from, to] (ISO strings
  // sort chronologically, so plain string comparison works).
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

  function minusYears(iso, n) {
    const d = new Date(iso + "T00:00:00Z");
    d.setUTCFullYear(d.getUTCFullYear() - n);
    return d.toISOString().slice(0, 10);
  }

  const PRESETS = [
    ["All", () => firstDate],
    ["20Y", () => minusYears(today, 20)],
    ["10Y", () => minusYears(today, 10)],
    ["5Y", () => minusYears(today, 5)],
    ["3Y", () => minusYears(today, 3)],
    ["1Y", () => minusYears(today, 1)],
    ["YTD", () => today.slice(0, 4) + "-01-01"],
    ["Live", () => inception],
  ];

  const bar = document.getElementById("period-bar");
  bar.innerHTML = PRESETS.map(([label], i) =>
    `<button data-i="${i}"${label === "All" ? ' class="active"' : ""}>${label}</button>`
  ).join("");

  const fromInput = document.getElementById("from-date");
  const toInput = document.getElementById("to-date");
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
      xaxis: Object.assign({}, baseLayout.xaxis, {
        type: "date", range: [state.from, state.to],
      }),
      yaxis: Object.assign({}, baseLayout.yaxis, {
        type: state.scale, tickprefix: "$",
        title: { text: "Value of $100 invested", font: { size: 12 } },
      }),
    });
    Plotly.react("equity-chart", traces, layout, config);
  }

  // Period preset buttons
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

  // Custom date range
  function onDateInput() {
    if (fromInput.value) state.from = fromInput.value;
    if (toInput.value) state.to = toInput.value;
    if (state.from >= state.to) return;
    bar.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    render();
  }
  fromInput.addEventListener("change", onDateInput);
  toInput.addEventListener("change", onDateInput);

  // Nasdaq compare + scale toggles
  document.getElementById("cmp-nasdaq").addEventListener("change", (e) => {
    state.nasdaq = e.target.checked;
    render();
  });
  document.querySelectorAll("#scale-toggle button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#scale-toggle button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.scale = btn.dataset.scale;
      render();
    });
  });

  fromInput.value = state.from;
  toInput.value = state.to;
  render();

  // ---- Monthly returns heatmap (Streamlit-style grid) ----
  function cellColor(v, cap) {
    if (v == null) return "transparent";
    const a = Math.min(Math.abs(v) / cap, 1) * 0.75 + 0.08;
    return v >= 0 ? `rgba(38,166,154,${a})` : `rgba(239,83,80,${a})`;
  }
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const table = document.getElementById("heatmap");
  let html = "<thead><tr><th></th>" +
    MONTHS.map((m) => `<th>${m}</th>`).join("") +
    "<th class='total-col'>Year</th></tr></thead><tbody>";
  for (const row of D.heatmap) {
    const label = row.live
      ? `${row.y} <span class="live-tag"><span class="live-dot"></span>LIVE</span>`
      : row.y;
    html += `<tr${row.live ? ' class="live-row"' : ""}><th>${label}</th>`;
    for (const v of row.m) {
      const txt = v == null ? "" : (v > 0 ? "+" : "") + v.toFixed(1);
      html += `<td style="background:${cellColor(v, 10)}">${txt}</td>`;
    }
    const t = row.total;
    html += `<td class="total-col" style="background:${cellColor(t, 30)}">` +
      `${(t > 0 ? "+" : "") + t.toFixed(1)}</td></tr>`;
  }
  table.innerHTML = html + "</tbody>";
  const wrap = table.parentElement;
  wrap.scrollTop = wrap.scrollHeight;
})();
