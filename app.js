(function () {
  var D = window.SITE_DATA;
  if (!D) {
    document.getElementById("stats-band").innerHTML =
      "<p style='color:#EF5350'>data.js missing — run scripts/generate_site_data.py</p>";
    return;
  }

  var ACCENT = "#00CED1";
  var DIM = "rgba(0,206,209,0.28)";
  var GREEN = "#26A69A";
  var RED = "#EF5350";
  var GRID = "#262730";
  var MUTED = "#9AA0AC";

  var s = D.stats;
  var fmtPct = function (v) { return (v >= 0 ? "+" : "") + v.toFixed(1) + "%"; };
  document.getElementById("stats-band").innerHTML = [
    ["Live return", fmtPct(s.live_total_pct), s.live_total_pct >= 0 ? "pos" : "neg"],
    ["Months live", String(s.live_months), "accent"],
    ["Live max drawdown", s.live_max_dd_pct.toFixed(1) + "%", "neg"],
    ["Model CAGR (" + s.backtest_years.toFixed(0) + "y)", fmtPct(s.backtest_cagr_pct), ""],
  ].map(function (x) {
    return '<div class="stat"><div class="value ' + x[2] + '">' + x[1] + '</div><div class="label">' + x[0] + "</div></div>";
  }).join("");

  document.getElementById("dd-callout").textContent = s.backtest_max_dd_pct.toFixed(0) + "%";
  document.getElementById("updated").textContent = "Data updated " + D.generated_at;

  // Raw data sources (original, never mutated)
  var src = [
    { x: D.backtest.dates, y: D.backtest.index },
    { x: D.backtest_since_inception.dates, y: D.backtest_since_inception.index },
    { x: D.live.dates, y: D.live.index },
  ];

  var traceStyle = [
    { name: "Backtest (model, since " + D.backtest.dates[0].slice(0, 4) + ")", mode: "lines", line: { color: DIM, width: 1.6 }, hovertemplate: "$%{y:,.0f}<extra>model</extra>" },
    { name: "Model since live start", mode: "lines", line: { color: DIM, width: 1.6, dash: "dot" }, hovertemplate: "$%{y:,.0f}<extra>model</extra>" },
    { name: "Live performance (real money)", mode: "lines", line: { color: ACCENT, width: 2.6 }, hovertemplate: "$%{y:,.0f}<extra>live</extra>" },
  ];

  function buildTraces(startDate) {
    var out = [];
    for (var i = 0; i < 3; i++) {
      var sx = src[i].x, sy = src[i].y;
      var x, y;
      if (startDate === null) {
        x = sx; y = sy;
      } else {
        var pairs = [];
        for (var j = 0; j < sx.length; j++) {
          if (sx[j] >= startDate) pairs.push({ x: sx[j], y: sy[j] });
        }
        if (pairs.length < 2) { x = []; y = []; }
        else {
          var base = pairs[0].y;
          x = []; y = [];
          for (var k = 0; k < pairs.length; k++) {
            x.push(pairs[k].x);
            y.push(+(pairs[k].y / base * 100).toFixed(2));
          }
        }
      }
      var t = traceStyle[i];
      out.push({ x: x, y: y, name: t.name, mode: t.mode, line: t.line, hovertemplate: t.hovertemplate });
    }
    return out;
  }

  function baseLayout(scale) {
    return {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: MUTED, family: "Segoe UI, system-ui, sans-serif", size: 12 },
      margin: { l: 55, r: 15, t: 10, b: 40 },
      hovermode: "x unified",
      hoverlabel: { bgcolor: "#1A1D26", bordercolor: GRID, font: { color: "#FAFAFA" } },
      legend: { orientation: "h", y: 1.08, x: 0, bgcolor: "rgba(0,0,0,0)" },
      xaxis: {
        gridcolor: GRID, zeroline: false,
        rangeselector: {
          buttons: [
            { count: 1, step: "year", stepmode: "backward", label: "1y" },
            { count: 3, step: "year", stepmode: "backward", label: "3y" },
            { count: 5, step: "year", stepmode: "backward", label: "5y" },
            { count: 10, step: "year", stepmode: "backward", label: "10y" },
            { step: "all", label: "All" },
          ],
          bgcolor: "#1A1D26", activecolor: "#00CED1",
          bordercolor: GRID, borderwidth: 1,
          font: { color: "#FAFAFA", size: 11 }, y: 1.18,
        },
      },
      yaxis: {
        gridcolor: GRID, zeroline: false,
        type: scale,
        title: { text: "Value of $100 invested", font: { size: 12 } },
        tickprefix: "$",
      },
      shapes: [{
        type: "line", x0: D.inception, x1: D.inception, y0: 0, y1: 1,
        yref: "paper", line: { color: MUTED, width: 1, dash: "dash" },
      }],
      annotations: [{
        x: D.inception, y: 1, yref: "paper", yanchor: "bottom",
        text: "Live trading starts", showarrow: false,
        font: { color: MUTED, size: 11 },
      }],
    };
  }

  var config = { displayModeBar: false, responsive: true };
  var currentScale = "log";
  var isUpdating = false;

  function drawChart(startDate) {
    Plotly.newPlot("equity-chart", buildTraces(startDate), baseLayout(currentScale), config);
  }

  // Initial plot: all data (startDate = null = original full range)
  drawChart(null);

  // Detect rangeselector clicks and reindex
  document.getElementById("equity-chart").on("plotly_relayout", function (e) {
    if (isUpdating) return;
    var r0 = e["xaxis.range[0]"];
    var r1 = e["xaxis.range[1]"];
    // If rangeselector changed the range
    if (r0 !== undefined || e["xaxis.autorange"] !== undefined || e["xaxis.range"] !== undefined) {
      isUpdating = true;
      if (e["xaxis.autorange"] === true || (e["xaxis.range"] && e["xaxis.range"][0] === undefined)) {
        drawChart(null);
      } else {
        var start = r0 || (e["xaxis.range"] ? e["xaxis.range"][0] : null);
        if (start) drawChart(start);
        else drawChart(null);
      }
      setTimeout(function () { isUpdating = false; }, 100);
    }
  });

  // Scale toggle (Log / Linear)
  document.querySelectorAll("#scale-toggle button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("#scale-toggle button").forEach(function (b) { b.classList.remove("active"); });
      this.classList.add("active");
      currentScale = this.dataset.scale;
      Plotly.relayout("equity-chart", { "yaxis.type": currentScale });
    });
  });

  // Remove the custom period-toggle from the previous version if present
  var pt = document.getElementById("period-toggle");
  if (pt) pt.innerHTML = "";

  // --- Monthly returns heatmap ---
  function cellColor(v, cap) {
    if (v == null) return "transparent";
    var a = Math.min(Math.abs(v) / cap, 1) * 0.75 + 0.08;
    return v >= 0 ? "rgba(38,166,154," + a + ")" : "rgba(239,83,80," + a + ")";
  }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var table = document.getElementById("heatmap");
  var html = "<thead><tr><th></th>";
  for (var m = 0; m < MONTHS.length; m++) html += "<th>" + MONTHS[m] + "</th>";
  html += "<th class='total-col'>Year</th></tr></thead><tbody>";
  for (var r = 0; r < D.heatmap.length; r++) {
    var row = D.heatmap[r];
    var label = row.live ? row.y + ' <span class="live-tag">LIVE</span>' : "" + row.y;
    html += "<tr" + (row.live ? ' class="live-row"' : "") + "><th>" + label + "</th>";
    for (var c = 0; c < 12; c++) {
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
