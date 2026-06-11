/* Public results page — renders SITE_DATA (data.js) with Plotly.
   Colors match the Streamlit dashboard: live #00CED1, dimmed backtest. */

(function () {
  const D = window.SITE_DATA;
  if (!D) {
    document.getElementById("stats-band").innerHTML =
      "<p style='color:#EF5350'>data.js missing — run scripts/generate_site_data.py</p>";
    return;
  }

  const ACCENT = "#00CED1";
  const DIM = "rgba(0,206,209,0.28)";
  const GREEN = "#26A69A";
  const RED = "#EF5350";
  const GRID = "#262730";
  const MUTED = "#9AA0AC";

  // --- Stats band ---
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

  document.getElementById("dd-callout").textContent = s.backtest_max_dd_pct.toFixed(0) + "%";
  document.getElementById("updated").textContent = "Data updated " + D.generated_at;

  const baseLayout = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: MUTED, family: "Segoe UI, system-ui, sans-serif", size: 12 },
    margin: { l: 55, r: 15, t: 10, b: 40 },
    hovermode: "x unified",
    hoverlabel: { bgcolor: "#1A1D26", bordercolor: GRID, font: { color: "#FAFAFA" } },
    legend: { orientation: "h", y: 1.08, x: 0, bgcolor: "rgba(0,0,0,0)" },
    xaxis: { gridcolor: GRID, zeroline: false },
    yaxis: { gridcolor: GRID, zeroline: false },
  };
  const config = { displayModeBar: false, responsive: true };

  // --- Equity chart ---
  const equityTraces = [
    {
      x: D.backtest.dates, y: D.backtest.index,
      name: "Backtest (model, since " + D.backtest.dates[0].slice(0, 4) + ")",
      mode: "lines", line: { color: DIM, width: 1.6 },
      hovertemplate: "$%{y:,.0f}<extra>model</extra>",
    },
    {
      x: D.backtest_since_inception.dates, y: D.backtest_since_inception.index,
      name: "Model since live start",
      mode: "lines", line: { color: DIM, width: 1.6, dash: "dot" },
      hovertemplate: "$%{y:,.0f}<extra>model</extra>",
    },
    {
      x: D.live.dates, y: D.live.index,
      name: "Live performance (real money)",
      mode: "lines", line: { color: ACCENT, width: 2.6 },
      hovertemplate: "$%{y:,.0f}<extra>live</extra>",
    },
  ];

  // Months elapsed since live inception (for the "Live" zoom button)
  const liveMonths = Math.max(2, Math.round(
    (new Date(D.live.dates[D.live.dates.length - 1]) - new Date(D.inception)) / 2.63e9) + 1);

  function equityLayout(scale) {
    return Object.assign({}, baseLayout, {
      xaxis: Object.assign({}, baseLayout.xaxis, {
        rangeselector: {
          buttons: [
            { step: "all", label: "All" },
            { count: 10, step: "year", stepmode: "backward", label: "10y" },
            { count: 1, step: "year", stepmode: "backward", label: "1y" },
            { count: liveMonths, step: "month", stepmode: "backward", label: "Live" },
          ],
          bgcolor: "#1A1D26", activecolor: "#00CED1",
          bordercolor: GRID, borderwidth: 1,
          font: { color: "#FAFAFA", size: 11 }, y: 1.18,
        },
      }),
      yaxis: Object.assign({}, baseLayout.yaxis, {
        type: scale,
        title: { text: "Value of $100 invested", font: { size: 12 } },
        tickprefix: "$",
      }),
      shapes: [{
        type: "line", x0: D.inception, x1: D.inception, y0: 0, y1: 1,
        yref: "paper", line: { color: MUTED, width: 1, dash: "dash" },
      }],
      annotations: [{
        x: D.inception, y: 1, yref: "paper", yanchor: "bottom",
        text: "Live trading starts", showarrow: false,
        font: { color: MUTED, size: 11 },
      }],
    });
  }

  Plotly.newPlot("equity-chart", equityTraces, equityLayout("log"), config);

  document.querySelectorAll("#scale-toggle button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#scale-toggle button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      Plotly.relayout("equity-chart", { "yaxis.type": btn.dataset.scale });
    });
  });

  // --- Monthly returns heatmap (Streamlit-style grid) ---
  // Cell tint: green for positive, red for negative, intensity scales with
  // |return| (months saturate at ±10%, year totals at ±30%).
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
    const label = row.live ? `${row.y} <span class="live-tag">LIVE</span>` : row.y;
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
  // Most visitors care about recent years: scroll the grid to the bottom
  const wrap = table.parentElement;
  wrap.scrollTop = wrap.scrollHeight;
})();
