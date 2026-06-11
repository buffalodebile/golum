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
    legend: { orientation: "h", y: 1.12, x: 0, bgcolor: "rgba(0,0,0,0)" },
    xaxis: { gridcolor: GRID, zeroline: false, autorange: true },
    yaxis: { gridcolor: GRID, zeroline: false, autorange: true },
  };
  const config = { displayModeBar: false, responsive: true };

  const tracesTmpl = [
    {
      name: "Backtest (model, since " + D.backtest.dates[0].slice(0, 4) + ")",
      mode: "lines", line: { color: DIM, width: 1.6 },
      hovertemplate: "$%{y:,.0f}<extra>model</extra>",
    },
    {
      name: "Model since live start",
      mode: "lines", line: { color: DIM, width: 1.6, dash: "dot" },
      hovertemplate: "$%{y:,.0f}<extra>model</extra>",
    },
    {
      name: "Live performance (real money)",
      mode: "lines", line: { color: ACCENT, width: 2.6 },
      hovertemplate: "$%{y:,.0f}<extra>live</extra>",
    },
  ];

  const dataSources = [
    { x: D.backtest.dates, y: D.backtest.index },
    { x: D.backtest_since_inception.dates, y: D.backtest_since_inception.index },
    { x: D.live.dates, y: D.live.index },
  ];

  function buildTraces(years) {
    const traces = [];
    for (let i = 0; i < 3; i++) {
      const src = dataSources[i];
      let x, y;
      if (years === null) {
        x = src.x;
        y = src.y;
      } else {
        const lastDate = dataSources[2].x[dataSources[2].x.length - 1];
        const d = new Date(lastDate.slice(0, 4) + "-" + lastDate.slice(5, 7) + "-" + lastDate.slice(8, 10));
        d.setFullYear(d.getFullYear() - years);
        const start = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        const pairs = [];
        for (let j = 0; j < src.x.length; j++) {
          if (src.x[j] >= start) pairs.push({ x: src.x[j], y: src.y[j] });
        }
        if (pairs.length === 0) { x = []; y = []; continue; }
        const base = pairs[0].y;
        x = pairs.map(p => p.x);
        y = pairs.map(p => +(p.y / base * 100).toFixed(2));
      }
      traces.push(Object.assign({}, tracesTmpl[i], { x: x, y: y }));
    }
    return traces;
  }

  function buildLayout(scale) {
    return Object.assign({}, baseLayout, {
      xaxis: Object.assign({}, baseLayout.xaxis),
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

  let currentScale = "log";

  function drawChart(years) {
    Plotly.newPlot("equity-chart", buildTraces(years), buildLayout(currentScale), config);
  }

  drawChart(null);

  document.querySelectorAll("#period-toggle button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("#period-toggle button").forEach(function (b) { b.classList.remove("active"); });
      this.classList.add("active");
      drawChart(this.dataset.y === "all" ? null : parseInt(this.dataset.y));
    });
  });

  document.querySelectorAll("#scale-toggle button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("#scale-toggle button").forEach(function (b) { b.classList.remove("active"); });
      this.classList.add("active");
      currentScale = this.dataset.scale;
      var active = document.querySelector("#period-toggle .active");
      drawChart(active.dataset.y === "all" ? null : parseInt(active.dataset.y));
    });
  });

  function cellColor(v, cap) {
    if (v == null) return "transparent";
    var a = Math.min(Math.abs(v) / cap, 1) * 0.75 + 0.08;
    return v >= 0 ? "rgba(38,166,154," + a + ")" : "rgba(239,83,80," + a + ")";
  }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var table = document.getElementById("heatmap");
  var html = "<thead><tr><th></th>" +
    MONTHS.map(function (m) { return "<th>" + m + "</th>"; }).join("") +
    "<th class='total-col'>Year</th></tr></thead><tbody>";
  for (var r = 0; r < D.heatmap.length; r++) {
    var row = D.heatmap[r];
    var label = row.live ? row.y + ' <span class="live-tag">LIVE</span>' : "" + row.y;
    html += "<tr" + (row.live ? ' class="live-row"' : "") + "><th>" + label + "</th>";
    for (var c = 0; c < row.m.length; c++) {
      var v = row.m[c];
      var txt = v == null ? "" : (v > 0 ? "+" : "") + v.toFixed(1);
      html += '<td style="background:' + cellColor(v, 10) + '">' + txt + "</td>";
    }
    var t = row.total;
    html += '<td class="total-col" style="background:' + cellColor(t, 30) + '">' +
      (t > 0 ? "+" : "") + t.toFixed(1) + "</td></tr>";
  }
  table.innerHTML = html + "</tbody>";
  var wrap = table.parentElement;
  wrap.scrollTop = wrap.scrollHeight;
})();
