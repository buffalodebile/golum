/* Prisma Capital — brand interactions.
   Shared by every page. All logic guards for missing elements, so the same file
   is safe on the landing, the strategy pages and the contact page.
   Runs on DOMContentLoaded so the deferred data.js / quality.js have executed
   (their window.SITE_DATA / QUALITY_DATA are available for the landing KPIs). */

(function () {
  "use strict";
  var REDUCE = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  ready(function () {
    /* ---------------- Prism loader (landing only) ---------------- */
    var loader = document.getElementById("loader");
    if (loader) {
      var seen = false;
      try { seen = sessionStorage.getItem("prismaSeen") === "1"; } catch (e) {}
      if (REDUCE || seen) {
        loader.parentNode && loader.parentNode.removeChild(loader);
      } else {
        document.body.style.overflow = "hidden";
        window.setTimeout(function () {
          loader.classList.add("done");
          document.body.style.overflow = "";
          try { sessionStorage.setItem("prismaSeen", "1"); } catch (e) {}
          revealHero();
          window.setTimeout(function () {
            loader.parentNode && loader.parentNode.removeChild(loader);
          }, 700);
        }, 1900);
      }
      if (REDUCE || seen) revealHero();
    } else {
      revealHero();
    }

    /* ---------------- Hero word reveal ---------------- */
    function revealHero() {
      var words = document.querySelectorAll(".reveal-word");
      if (!words.length) return;
      words.forEach(function (w, i) {
        if (REDUCE) { w.classList.add("in"); return; }
        w.style.transitionDelay = (i * 70) + "ms";
        window.requestAnimationFrame(function () { w.classList.add("in"); });
      });
    }

    /* ---------------- Sticky nav background + mobile menu ---------------- */
    var nav = document.getElementById("nav");
    if (nav) {
      var onScroll = function () { nav.classList.toggle("scrolled", window.scrollY > 10); };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });

      var toggle = document.getElementById("navToggle");
      if (toggle) {
        toggle.addEventListener("click", function () {
          var open = nav.classList.toggle("open");
          toggle.setAttribute("aria-expanded", open ? "true" : "false");
        });
        nav.querySelectorAll(".nav-links a").forEach(function (a) {
          a.addEventListener("click", function () {
            nav.classList.remove("open");
            toggle.setAttribute("aria-expanded", "false");
          });
        });
      }
    }

    /* ---------------- Scroll reveals ---------------- */
    var reveals = document.querySelectorAll(".reveal");
    if (reveals.length) {
      if (REDUCE || !("IntersectionObserver" in window)) {
        reveals.forEach(function (r) { r.classList.add("in"); });
      } else {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
          });
        }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });
        reveals.forEach(function (r) { io.observe(r); });
        // safety net: reveal anything already in/above the viewport (fast scroll, restore, bfcache)
        var sweep = function () {
          document.querySelectorAll(".reveal:not(.in)").forEach(function (r) {
            if (r.getBoundingClientRect().top < window.innerHeight * 0.92) { r.classList.add("in"); io.unobserve(r); }
          });
        };
        window.addEventListener("scroll", sweep, { passive: true });
        window.addEventListener("load", sweep);
        sweep();
      }
    }

    /* ---------------- Landing KPI injection (from chart data) ---------------- */
    function fmtPct(v) { return (v >= 0 ? "+" : "") + v.toFixed(1) + "%"; }
    function setKpi(key, txt, cls) {
      var el = document.querySelector('[data-kpi="' + key + '"]');
      if (!el) return;
      el.textContent = txt;
      if (cls) el.classList.add(cls);
    }
    var R = window.SITE_DATA, Q = window.QUALITY_DATA, S = window.STEADY_DATA;
    if (R && R.stats) {
      var rs = R.stats;
      setKpi("r-cagr", fmtPct(rs.backtest_cagr_pct));
      var rl = document.querySelector('[data-kpi="r-cagr-l"]');
      if (rl && typeof rs.backtest_years === "number") rl.textContent = "Model CAGR (" + Math.round(rs.backtest_years) + "y)";
      setKpi("r-live", fmtPct(rs.live_total_pct), rs.live_total_pct >= 0 ? "pos" : "neg");
    }
    if (Q && Q.stats) {
      var qs = Q.stats;
      setKpi("q-cagr", fmtPct(qs.backtest_cagr_pct));
      var ql = document.querySelector('[data-kpi="q-cagr-l"]');
      if (ql && typeof qs.backtest_years === "number") ql.textContent = "Model CAGR (" + Math.round(qs.backtest_years) + "y)";
      setKpi("q-live", fmtPct(qs.live_total_pct), qs.live_total_pct >= 0 ? "pos" : "neg");
    }
    if (S && S.stats) {
      var ss = S.stats;
      setKpi("s-cagr", fmtPct(ss.backtest_cagr_pct));
      var sl = document.querySelector('[data-kpi="s-cagr-l"]');
      if (sl && typeof ss.backtest_years === "number") sl.textContent = "Model CAGR (" + Math.round(ss.backtest_years) + "y)";
      // Paper / simulated track (no real capital); show a dash until it has run.
      setKpi("s-live", ss.live_months > 0 ? fmtPct(ss.live_total_pct) : "—",
             ss.live_total_pct >= 0 ? "pos" : "neg");
    }

    /* ---------------- Contact form (FormSubmit.co AJAX) ---------------- */
    var form = document.getElementById("contactForm");
    if (form) {
      var status = document.getElementById("formStatus");
      var btn = form.querySelector('button[type="submit"]');
      var label = form.querySelector(".btn-label");

      function showStatus(kind, msg) {
        if (!status) return;
        status.textContent = msg;
        status.className = "form-status show " + kind;
      }

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!form.checkValidity()) { form.reportValidity(); return; }

        var action = form.getAttribute("action") || "";
        if (action.indexOf("__PRISMA_EMAIL__") !== -1) {
          showStatus("err", "This form isn't connected to an inbox yet — email setup is pending. Please check back soon.");
          return;
        }
        var ajax = action.replace("formsubmit.co/", "formsubmit.co/ajax/");

        btn.disabled = true;
        var old = label ? label.textContent : "";
        if (label) label.textContent = "Sending…";

        fetch(ajax, {
          method: "POST",
          headers: { "Accept": "application/json" },
          body: new FormData(form)
        }).then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            return { ok: res.ok, data: data };
          });
        }).then(function (r) {
          if (r.ok) {
            form.reset();
            showStatus("ok", "Thanks — your message is on its way. We'll get back to you personally.");
          } else {
            showStatus("err", (r.data && r.data.message) || "Something went wrong. Please try again, or reach us via the eToro profile.");
          }
        }).catch(function () {
          showStatus("err", "Network error. Please try again in a moment.");
        }).then(function () {
          btn.disabled = false;
          if (label) label.textContent = old || "Send message";
        });
      });
    }
  });
})();
