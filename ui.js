/**
 * ui.js
 * تمام توابع رندر رابط کاربری (سایدبار، پنل اصلی، ساعتی، هفتگی، هشدارها، AQI، گرد و غبار، داشبورد استان)
 */

const OwjUI = (() => {

  const $ = sel => document.querySelector(sel);
  const $$ = sel => document.querySelectorAll(sel);

  function fmt(n, digits = 0) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toFixed(digits);
  }

  function toJalali(date) {
    try {
      return new Intl.DateTimeFormat("fa-IR", {
        year: "numeric", month: "long", day: "numeric", weekday: "long"
      }).format(date);
    } catch { return ""; }
  }

  function tehranClock() {
    try {
      return new Intl.DateTimeFormat("fa-IR", {
        hour: "2-digit", minute: "2-digit", timeZone: CONFIG.TIMEZONE
      }).format(new Date());
    } catch { return ""; }
  }

  /* ---------------- سایدبار شهرها ---------------- */
  function renderSidebar(allData, selectedId) {
    const list = $("#cityList");
    list.innerHTML = "";
    CITIES.forEach(city => {
      const data = allData[city.id];
      const cur = data?.forecast?.current;
      const temp = cur ? Math.round(cur.temperature_2m) : null;
      const wIcon = cur ? getWeatherInfo(cur.weather_code).icon : "cloud";
      const li = document.createElement("li");
      li.className = "city-item" + (city.id === selectedId ? " active" : "");
      li.dataset.cityId = city.id;
      li.innerHTML = `
        <span class="city-temp">${temp != null ? temp + "°" : "—"}</span>
        <span class="city-name">${city.name}</span>
        <span class="city-icon">${weatherIconHtml(wIcon)}</span>
      `;
      li.addEventListener("click", () => window.OwjApp.selectCity(city.id));
      list.appendChild(li);
    });
  }

  /* ---------------- پنل هوای فعلی ---------------- */
  function renderCurrentPanel(city, data) {
    if (!data || data.error) {
      $("#currentPanel").innerHTML = `<div class="error-box">داده‌ای برای ${city.name} در دسترس نیست.</div>`;
      return;
    }
    const cur = data.forecast.current;
    const daily = data.forecast.daily;
    const aq = data.airQuality?.current || {};
    const wInfo = getWeatherInfo(cur.weather_code);
    const isDay = cur.is_day === 1;

    $("#cityTitle").textContent = city.name;
    $("#staleBadge").style.display = data.isStale ? "inline-flex" : "none";

    $("#currentPanel").innerHTML = `
      <div class="cur-main">
        <div class="cur-icon">${weatherIconHtml(isDay ? wInfo.icon : (wInfo.icon === "sun" ? "moon" : wInfo.icon))}</div>
        <div class="cur-temp-block">
          <div class="cur-temp">${fmt(cur.temperature_2m)}<span class="deg">°C</span></div>
          <div class="cur-desc">${wInfo.text}</div>
        </div>
      </div>
      <div class="cur-grid">
        ${metricCard("دمای احساسی", fmt(cur.apparent_temperature) + "°", "🌡️")}
        ${metricCard("حداقل دما", fmt(daily.temperature_2m_min?.[0]) + "°", "⬇️")}
        ${metricCard("حداکثر دما", fmt(daily.temperature_2m_max?.[0]) + "°", "⬆️")}
        ${metricCard("رطوبت", fmt(cur.relative_humidity_2m) + "%", "💧")}
        ${metricCard("فشار هوا", fmt(cur.pressure_msl) + " hPa", "📟")}
        ${metricCard("نقطه شبنم", fmt(data.forecast.hourly?.dew_point_2m?.[0]) + "°", "💦")}
        ${metricCard("سرعت باد", fmt(cur.wind_speed_10m) + " km/h", "💨")}
        ${metricCard("جهت باد", windDir(cur.wind_direction_10m), "🧭")}
        ${metricCard("تندباد", fmt(cur.wind_gusts_10m) + " km/h", "🌬️")}
        ${metricCard("دید افقی", fmt((data.forecast.hourly?.visibility?.[0] ?? 0) / 1000, 1) + " km", "👁️")}
        ${metricCard("شاخص UV", fmt(daily.uv_index_max?.[0]), "☀️")}
        ${metricCard("درصد ابر", fmt(cur.cloud_cover) + "%", "☁️")}
        ${metricCard("احتمال بارش", fmt(daily.precipitation_probability_max?.[0]) + "%", "🌦️")}
        ${metricCard("شدت بارش", fmt(cur.precipitation, 1) + " mm", "🌧️")}
        ${metricCard("احتمال برف", (daily.snowfall_sum?.[0] > 0 ? "دارد" : "خیر"), "🌨️")}
        ${metricCard("ارتفاع برف", fmt(data.forecast.hourly?.snow_depth?.[0] * 100, 1) + " cm", "❄️")}
        ${metricCard("طلوع خورشید", timeOnly(daily.sunrise?.[0]), "🌅")}
        ${metricCard("غروب خورشید", timeOnly(daily.sunset?.[0]), "🌇")}
        ${metricCard("AQI", (aq.aqi != null ? aq.aqi + "/5 · " + getAqiInfo(aq.aqi).label : "—"), "🏭")}
        ${metricCard("PM2.5", fmt(aq.pm2_5) + " µg/m³", "🔬")}
        ${metricCard("PM10", fmt(aq.pm10) + " µg/m³", "🔬")}
        ${metricCard("NO₂", fmt(aq.nitrogen_dioxide) + " µg/m³", "🏭")}
        ${metricCard("SO₂", fmt(aq.sulphur_dioxide) + " µg/m³", "🏭")}
        ${metricCard("CO", fmt(aq.carbon_monoxide) + " µg/m³", "🏭")}
        ${metricCard("O₃", fmt(aq.ozone) + " µg/m³", "🏭")}
      </div>
      <div class="advice-grid">
        ${adviceCard("👕 پیشنهاد لباس", OwjAdvice.clothing(cur.temperature_2m, cur.wind_speed_10m, cur.precipitation))}
        ${adviceCard("🏃 پیشنهاد فعالیت", OwjAdvice.activity(cur.temperature_2m, daily.uv_index_max?.[0], cur.wind_gusts_10m, cur.weather_code))}
        ${adviceCard("🚗 توصیه رانندگی", OwjAdvice.driving(cur.wind_gusts_10m, data.forecast.hourly?.visibility?.[0], cur.weather_code, daily.precipitation_probability_max?.[0]))}
        ${adviceCard("🌾 توصیه کشاورزی", OwjAdvice.farming(cur.temperature_2m, daily.precipitation_sum?.[0], cur.wind_speed_10m, daily.temperature_2m_min?.[0]))}
        ${adviceCard("🫁 توصیه بیماران تنفسی", OwjAdvice.respiratory(aq.aqi, aq.pm10, aq.pm2_5))}
      </div>
    `;
  }

  function metricCard(label, value, emoji) {
    return `<div class="metric-card"><span class="metric-emoji">${emoji}</span><div class="metric-info"><span class="metric-value">${value}</span><span class="metric-label">${label}</span></div></div>`;
  }
  function adviceCard(title, text) {
    return `<div class="advice-card"><h4>${title}</h4><p>${text}</p></div>`;
  }
  function windDir(deg) {
    if (deg == null) return "—";
    const dirs = ["شمال","شمال‌شرق","شرق","جنوب‌شرق","جنوب","جنوب‌غرب","غرب","شمال‌غرب"];
    return dirs[Math.round(deg / 45) % 8];
  }
  function timeOnly(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
  }

  /* ---------------- پیش‌بینی ساعتی ---------------- */
  function renderHourly(data) {
    const wrap = $("#hourlyScroll");
    if (!data || data.error) { wrap.innerHTML = ""; return; }
    const h = data.forecast.hourly;
    const nowIdx = h.time.findIndex(t => new Date(t) >= new Date());
    const start = Math.max(0, nowIdx);
    let html = "";
    for (let i = start; i < start + 24 && i < h.time.length; i++) {
      const d = new Date(h.time[i]);
      const wInfo = getWeatherInfo(h.weather_code[i]);
      html += `
        <div class="hour-card">
          <span class="hour-time">${d.toLocaleTimeString("fa-IR", { hour: "2-digit" })}</span>
          <div class="hour-icon">${weatherIconHtml(wInfo.icon)}</div>
          <span class="hour-temp">${Math.round(h.temperature_2m[i])}°</span>
          <span class="hour-detail">💨 ${Math.round(h.wind_speed_10m[i])}</span>
          <span class="hour-detail">💧 ${h.precipitation_probability[i]}%</span>
          <span class="hour-detail">☀️ ${fmt(h.uv_index[i],1)}</span>
        </div>`;
    }
    wrap.innerHTML = html;
  }

  /* ---------------- پیش‌بینی هفتگی ---------------- */
  function renderWeekly(data) {
    const wrap = $("#weeklyCards");
    if (!data || data.error) { wrap.innerHTML = ""; return; }
    const d = data.forecast.daily;
    let html = "";
    for (let i = 0; i < d.time.length; i++) {
      const date = new Date(d.time[i]);
      const wInfo = getWeatherInfo(d.weather_code[i]);
      html += `
        <div class="week-card">
          <span class="week-day">${date.toLocaleDateString("fa-IR", { weekday: "long" })}</span>
          <span class="week-date">${date.toLocaleDateString("fa-IR", { day: "numeric", month: "short" })}</span>
          <div class="week-icon">${weatherIconHtml(wInfo.icon)}</div>
          <span class="week-desc">${wInfo.text}</span>
          <div class="week-temps"><span class="tmax">${Math.round(d.temperature_2m_max[i])}°</span><span class="tmin">${Math.round(d.temperature_2m_min[i])}°</span></div>
          <span class="week-detail">🌧️ ${d.precipitation_probability_max[i]}%</span>
          <span class="week-detail">💨 ${Math.round(d.wind_speed_10m_max[i])} km/h</span>
          <span class="week-detail">☀️ UV ${fmt(d.uv_index_max[i],1)}</span>
        </div>`;
    }
    wrap.innerHTML = html;
  }

  /* ---------------- هشدارها ---------------- */
  function renderAlerts(alertsMap) {
    const wrap = $("#alertsPanel");
    const countBadge = $("#alertsCount");
    let all = [];
    Object.entries(alertsMap).forEach(([cityId, list]) => {
      const city = CITIES.find(c => c.id === cityId);
      list.forEach(a => all.push({ ...a, cityName: city.name }));
    });
    countBadge.textContent = all.length;
    if (all.length === 0) {
      wrap.innerHTML = `<div class="no-alerts">هیچ هشدار فعالی ثبت نشده است.</div>`;
      return;
    }
    wrap.innerHTML = all.map(a => `
      <div class="alert-card sev-${a.severity}" style="--alert-color:${OwjAlerts.COLORS[a.type]}">
        <span class="alert-icon">${OwjAlerts.ICONS[a.type]}</span>
        <div class="alert-body">
          <div class="alert-title">${a.title}</div>
          <div class="alert-desc">${a.desc}</div>
          <div class="alert-note">${a.note}</div>
        </div>
        <span class="alert-severity">${a.severity}</span>
      </div>
    `).join("");
  }

  /* ---------------- داشبورد استان ---------------- */
  function renderProvinceDashboard(allData, alertsMap) {
    const rows = CITIES.map(c => {
      const d = allData[c.id];
      const cur = d?.forecast?.current;
      const aq = d?.airQuality?.current;
      return {
        city: c,
        temp: cur?.temperature_2m,
        humidity: cur?.relative_humidity_2m,
        wind: cur?.wind_speed_10m,
        pressure: cur?.pressure_msl,
        uv: d?.forecast?.daily?.uv_index_max?.[0],
        rainProb: d?.forecast?.daily?.precipitation_probability_max?.[0],
        aqi: aq?.aqi
      };
    }).filter(r => r.temp != null);

    if (rows.length === 0) { $("#provinceDashboard").innerHTML = ""; return; }

    const warmest = rows.reduce((a, b) => b.temp > a.temp ? b : a);
    const coldest = rows.reduce((a, b) => b.temp < a.temp ? b : a);
    const windiest = rows.reduce((a, b) => b.wind > a.wind ? b : a);
    const mostHumid = rows.reduce((a, b) => b.humidity > a.humidity ? b : a);
    const driest = rows.reduce((a, b) => b.humidity < a.humidity ? b : a);
    const rainiest = rows.reduce((a, b) => (b.rainProb ?? 0) > (a.rainProb ?? 0) ? b : a);
    const highestUv = rows.reduce((a, b) => (b.uv ?? 0) > (a.uv ?? 0) ? b : a);
    const bestAir = rows.reduce((a, b) => (b.aqi ?? 999) < (a.aqi ?? 999) ? b : a);
    const worstAir = rows.reduce((a, b) => (b.aqi ?? 0) > (a.aqi ?? 0) ? b : a);

    const avg = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
    const avgTemp = avg(rows.map(r => r.temp));
    const avgHumidity = avg(rows.map(r => r.humidity));
    const avgPressure = avg(rows.map(r => r.pressure));
    const totalAlerts = Object.values(alertsMap).reduce((s, l) => s + l.length, 0);

    const stat = (label, city, value, emoji) =>
      `<div class="dash-stat"><span class="dash-emoji">${emoji}</span><div><div class="dash-label">${label}</div><div class="dash-value">${city.name} · ${value}</div></div></div>`;

    $("#provinceDashboard").innerHTML = `
      ${stat("گرم‌ترین شهر", warmest.city, Math.round(warmest.temp) + "°", "🔥")}
      ${stat("سردترین شهر", coldest.city, Math.round(coldest.temp) + "°", "🧊")}
      ${stat("پربادترین شهر", windiest.city, Math.round(windiest.wind) + " km/h", "💨")}
      ${stat("مرطوب‌ترین شهر", mostHumid.city, Math.round(mostHumid.humidity) + "%", "💧")}
      ${stat("خشک‌ترین شهر", driest.city, Math.round(driest.humidity) + "%", "🏜️")}
      ${stat("بیشترین احتمال بارش", rainiest.city, (rainiest.rainProb ?? 0) + "%", "🌧️")}
      ${stat("بیشترین UV", highestUv.city, fmt(highestUv.uv,1), "☀️")}
      ${stat("بهترین کیفیت هوا", bestAir.city, Math.round(bestAir.aqi ?? 0), "🌿")}
      ${stat("بدترین کیفیت هوا", worstAir.city, Math.round(worstAir.aqi ?? 0), "🏭")}
      ${stat("میانگین دمای استان", { name: "" }, Math.round(avgTemp) + "°", "📊")}
      ${stat("میانگین رطوبت استان", { name: "" }, Math.round(avgHumidity) + "%", "📊")}
      ${stat("میانگین فشار استان", { name: "" }, Math.round(avgPressure) + " hPa", "📊")}
      ${stat("هشدارهای فعال", { name: "" }, totalAlerts, "🚨")}
    `;
  }

  /* ---------------- کیفیت هوا ---------------- */
  function renderAirQuality(city, data) {
    const aq = data?.airQuality?.current;
    if (!aq) { $("#aqiPanel").innerHTML = ""; return; }
    const info = getAqiInfo(aq.aqi);
    $("#aqiPanel").innerHTML = `
      <div class="aqi-gauge" style="--aqi-color:${info.color}">
        <svg viewBox="0 0 120 70" class="aqi-arc">
          <path d="M10,65 A50,50 0 0,1 110,65" class="aqi-arc-bg"/>
          <path d="M10,65 A50,50 0 0,1 110,65" class="aqi-arc-fill" style="stroke-dasharray: ${Math.min(100,((aq.aqi||0)/5)*100)} 100"/>
        </svg>
        <div class="aqi-value">${aq.aqi ?? "—"}<span class="aqi-of5">/5</span></div>
        <div class="aqi-label">${info.label}</div>
      </div>
      <div class="pollutant-grid">
        ${pollutant("PM2.5", aq.pm2_5)}
        ${pollutant("PM10", aq.pm10)}
        ${pollutant("SO₂", aq.sulphur_dioxide)}
        ${pollutant("NO₂", aq.nitrogen_dioxide)}
        ${pollutant("CO", aq.carbon_monoxide)}
        ${pollutant("O₃", aq.ozone)}
      </div>
      <p class="aqi-source">منبع: OpenWeather Air Pollution API — شاخص رسمی ۱ (خوب) تا ۵ (بسیار ناسالم)</p>
      <p class="aqi-health-tip">${info.healthTip}</p>
    `;
  }
  function pollutant(name, val) {
    return `<div class="pollutant"><span class="p-name">${name}</span><span class="p-val">${fmt(val,1)}</span></div>`;
  }

  /* ---------------- گرد و غبار ---------------- */
  function renderDust(city, data) {
    const risk = OwjDust.computeRiskIndex(data);
    const wrap = $("#dustPanel");
    if (!risk) { wrap.innerHTML = `<div class="error-box">داده‌ای در دسترس نیست.</div>`; return; }
    wrap.innerHTML = `
      <div class="dust-index" style="--dust-color:${risk.color}">
        <div class="dust-index-value">${risk.index}<span>/100</span></div>
        <div class="dust-index-label">${risk.level}</div>
      </div>
      <div class="dust-components">
        ${pollutant("PM10", risk.components.pm10)}
        ${pollutant("باد", risk.components.wind)}
        ${pollutant("دید (km)", risk.components.visibilityKm)}
      </div>
      <p class="estimate-note">⚠️ این شاخص از ترکیب داده‌های PM10 (OpenWeather Air Pollution)، سرعت باد و دید افقی محاسبه شده و <b>تخمینی</b> است؛ جایگزین هشدار رسمی نیست.</p>
    `;
  }

  /* ---------------- وضعیت آفلاین/آنلاین ---------------- */
  function setOnlineBadge(isOnline, apiOnline) {
    const el = $("#connStatus");
    if (!isOnline) {
      el.textContent = "آفلاین - نمایش آخرین داده ذخیره‌شده";
      el.className = "conn-badge offline";
    } else if (!apiOnline) {
      el.textContent = "سرویس داده در دسترس نیست";
      el.className = "conn-badge warn";
    } else {
      el.textContent = "متصل";
      el.className = "conn-badge online";
    }
  }

  function setLastUpdate(ts) {
    const d = new Date(ts);
    $("#lastUpdate").textContent = "آخرین بروزرسانی: " + d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
  }

  function setClockAndDate() {
    $("#tehranClock").textContent = tehranClock();
    $("#jalaliDate").textContent = toJalali(new Date());
  }

  function showSkeleton() {
    $("#currentPanel").innerHTML = skeletonBlock(9);
    $("#hourlyScroll").innerHTML = skeletonRow(8);
    $("#weeklyCards").innerHTML = skeletonRow(7);
  }
  function skeletonBlock(n) {
    return `<div class="skeleton-grid">${Array(n).fill('<div class="skeleton sk-card"></div>').join("")}</div>`;
  }
  function skeletonRow(n) {
    return Array(n).fill('<div class="skeleton sk-hour"></div>').join("");
  }

  function hideLoadingScreen() {
    const el = $("#loadingScreen");
    el.classList.add("hide");
    setTimeout(() => el.remove(), 600);
  }

  return {
    renderSidebar, renderCurrentPanel, renderHourly, renderWeekly,
    renderAlerts, renderProvinceDashboard, renderAirQuality, renderDust,
    setOnlineBadge, setLastUpdate, setClockAndDate, showSkeleton, hideLoadingScreen
  };
})();
