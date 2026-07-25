/**
 * charts.js
 * نمودارهای حرفه‌ای با Chart.js (از CDN بارگذاری می‌شود)
 * همه نمودارها Responsive هستند و در تم تیره/روشن رنگ‌بندی خود را وفق می‌دهند.
 */

const OwjCharts = (() => {
  const instances = {};

  function themeColors() {
    const dark = document.documentElement.getAttribute("data-theme") !== "light";
    return {
      grid: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)",
      text: dark ? "rgba(255,255,255,.65)" : "rgba(0,0,0,.6)",
    };
  }

  function baseOptions(extra = {}) {
    const t = themeColors();
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700, easing: "easeOutQuart" },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: t.text, font: { family: "Vazirmatn" } } },
        tooltip: {
          rtl: true, textDirection: "rtl",
          titleFont: { family: "Vazirmatn" }, bodyFont: { family: "Vazirmatn" },
          backgroundColor: "rgba(15,25,45,.92)", borderColor: "#3fd0e0", borderWidth: 1,
          padding: 10, cornerRadius: 8,
        },
      },
      scales: {
        x: { grid: { color: t.grid }, ticks: { color: t.text, font: { family: "Vazirmatn" } } },
        y: { grid: { color: t.grid }, ticks: { color: t.text, font: { family: "Vazirmatn" } } },
      },
      ...extra,
    };
  }

  function gradient(ctx, color1, color2) {
    const g = ctx.createLinearGradient(0, 0, 0, 260);
    g.addColorStop(0, color1);
    g.addColorStop(1, color2);
    return g;
  }

  function upsert(id, config) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (instances[id]) instances[id].destroy();
    instances[id] = new Chart(canvas.getContext("2d"), config);
  }

  /** نمودار دمای ۷ روز آینده (حداقل/حداکثر) */
  function renderTempChart(data) {
    const d = data.forecast.daily;
    const labels = d.time.map(t => new Date(t).toLocaleDateString("fa-IR", { weekday: "short" }));
    const ctx = document.getElementById("chartTemp")?.getContext("2d");
    upsert("chartTemp", {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "حداکثر دما (°C)", data: d.temperature_2m_max,
            borderColor: "#f5a623", backgroundColor: ctx ? gradient(ctx, "rgba(245,166,35,.35)", "rgba(245,166,35,0)") : "rgba(245,166,35,.2)",
            fill: true, tension: 0.4, pointRadius: 3, borderWidth: 2.5,
          },
          {
            label: "حداقل دما (°C)", data: d.temperature_2m_min,
            borderColor: "#3fd0e0", backgroundColor: "transparent",
            fill: false, tension: 0.4, pointRadius: 3, borderWidth: 2.5, borderDash: [5, 3],
          },
        ],
      },
      options: baseOptions(),
    });
  }

  /** نمودار سرعت باد ۷ روز آینده */
  function renderWindChart(data) {
    const d = data.forecast.daily;
    const labels = d.time.map(t => new Date(t).toLocaleDateString("fa-IR", { weekday: "short" }));
    upsert("chartWind", {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "سرعت باد (km/h)", data: d.wind_speed_10m_max, backgroundColor: "#1abc9c", borderRadius: 6 },
          { label: "تندباد (km/h)", data: d.wind_gusts_10m_max, backgroundColor: "rgba(26,188,156,.35)", borderRadius: 6 },
        ],
      },
      options: baseOptions(),
    });
  }

  /** نمودارهای ساعتی: رطوبت، فشار، UV، دید، احتمال بارش (۲۴ ساعت آینده) */
  function renderHourlyMetric(canvasId, data, field, color, label, unit = "") {
    const h = data.forecast.hourly;
    const nowIdx = Math.max(0, h.time.findIndex(t => new Date(t) >= new Date()));
    const slice = h.time.slice(nowIdx, nowIdx + 24);
    const labels = slice.map(t => new Date(t).toLocaleTimeString("fa-IR", { hour: "2-digit" }));
    const values = h[field]?.slice(nowIdx, nowIdx + 24) || [];
    const ctx = document.getElementById(canvasId)?.getContext("2d");
    upsert(canvasId, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: label + (unit ? ` (${unit})` : ""), data: values,
          borderColor: color,
          backgroundColor: ctx ? gradient(ctx, color + "55", color + "00") : color + "33",
          fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2,
        }],
      },
      options: baseOptions(),
    });
  }

  /** نمودار کیفیت هوا AQI ساعتی (پیش‌بینی OpenWeather Air Pollution، مقیاس ۱ تا ۵) */
  function renderAqiChart(data) {
    const h = data.airQuality?.hourly;
    if (!h?.time?.length) return;
    const nowIdx = Math.max(0, h.time.findIndex(t => new Date(t) >= new Date()));
    const slice = h.time.slice(nowIdx, nowIdx + 24);
    const labels = slice.map(t => new Date(t).toLocaleTimeString("fa-IR", { hour: "2-digit" }));
    const values = h.aqi?.slice(nowIdx, nowIdx + 24) || [];
    const colors = values.map(v => getAqiInfo(v).color);
    const opts = baseOptions();
    opts.scales.y.min = 0;
    opts.scales.y.max = 5;
    opts.scales.y.ticks.stepSize = 1;
    upsert("chartAqi", {
      type: "bar",
      data: { labels, datasets: [{ label: "AQI (۱ تا ۵)", data: values, backgroundColor: colors, borderRadius: 4 }] },
      options: opts,
    });
  }

  /** رسم همه نمودارهای شهر انتخاب‌شده */
  function renderAllForCity(data) {
    if (!data || data.error) return;
    renderTempChart(data);
    renderWindChart(data);
    renderHourlyMetric("chartHumidity", data, "relative_humidity_2m", "#3498db", "رطوبت", "%");
    renderHourlyMetric("chartPressure", data, "pressure_msl", "#9b59b6", "فشار هوا", "hPa");
    renderHourlyMetric("chartUv", data, "uv_index", "#f5a623", "شاخص UV");
    renderHourlyMetric("chartVisibility", data, "visibility", "#7f8c8d", "دید افقی", "m");
    renderHourlyMetric("chartPrecipProb", data, "precipitation_probability", "#2980b9", "احتمال بارش", "%");
    renderAqiChart(data);
  }

  function destroyAll() {
    Object.keys(instances).forEach(k => { instances[k].destroy(); delete instances[k]; });
  }

  return { renderAllForCity, destroyAll };
})();
