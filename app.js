/**
 * app.js
 * نقطه ورود برنامه — هماهنگ‌کننده تمام ماژول‌ها (API، State، UI، Map، Charts، Effects)
 */

const OwjApp = (() => {
  let refreshTimer = null;

  async function init() {
    OwjState.setTheme(OwjState.state.theme); // اعمال تم ذخیره‌شده
    OwjUI.setClockAndDate();
    setInterval(OwjUI.setClockAndDate, 30000);

    wireGlobalControls();
    OwjMap.init();
    wireMapControls();
    renderSatelliteStrip();

    window.addEventListener("online", () => { OwjState.state.isOnline = true; refresh(); });
    window.addEventListener("offline", () => { OwjState.state.isOnline = false; OwjUI.setOnlineBadge(false, false); });

    OwjUI.showSkeleton();
    await refresh();
    OwjUI.hideLoadingScreen();

    refreshTimer = setInterval(refresh, CONFIG.REFRESH_INTERVAL_MS);
    registerServiceWorker();
  }

  async function refresh() {
    const apiOnline = navigator.onLine ? await OwjAPI.checkApiOnline() : false;
    OwjUI.setOnlineBadge(navigator.onLine, apiOnline);

    try {
      const allData = await OwjAPI.fetchAllCities();
      OwjState.state.allCityData = allData;
      OwjState.state.alerts = OwjAlerts.evaluateAll(allData);
      OwjState.state.lastUpdate = Date.now();
      localStorage.setItem("owj_last_update_ts", String(OwjState.state.lastUpdate));

      renderAll();
    } catch (err) {
      console.error("Refresh failed entirely:", err);
    }
  }

  function renderAll() {
    const { allCityData, alerts, selectedCity } = OwjState.state;
    const city = OwjState.getCity(selectedCity);
    const data = allCityData[selectedCity];

    OwjUI.renderSidebar(allCityData, selectedCity);
    OwjUI.renderCurrentPanel(city, data);
    OwjUI.renderHourly(data);
    OwjUI.renderWeekly(data);
    OwjUI.renderAlerts(alerts);
    OwjUI.renderProvinceDashboard(allCityData, alerts);
    OwjUI.renderAirQuality(city, data);
    OwjUI.renderDust(city, data);
    OwjUI.setLastUpdate(OwjState.state.lastUpdate);
    renderCompareTable(allCityData);

    if (data && !data.error) {
      const cur = data.forecast.current;
      OwjEffects.setSkyState(cur.weather_code, cur.is_day === 1);
      OwjCharts.renderAllForCity(data);
    }

    OwjMap.renderDataLayer(OwjState.state.mapLayer, allCityData, selectCity);
  }

  function selectCity(cityId) {
    OwjState.setSelectedCity(cityId);
    renderAll();
    OwjMap.flyToCity(cityId);
    document.getElementById("mainScrollArea")?.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------------- کنترل‌های عمومی: تم، تنظیمات ---------------- */
  function wireGlobalControls() {
    const themeBtn = document.getElementById("themeToggle");
    themeBtn?.addEventListener("click", () => {
      OwjState.toggleTheme();
      OwjCharts.renderAllForCity(OwjState.state.allCityData[OwjState.state.selectedCity]);
    });

    document.getElementById("refreshBtn")?.addEventListener("click", () => {
      OwjUI.showSkeleton();
      refresh();
    });

    // نمایش/مخفی‌سازی جدول مقایسه شهرها
    document.getElementById("compareToggle")?.addEventListener("click", () => {
      document.getElementById("compareTable")?.classList.toggle("open");
    });

    // منوی موبایل سایدبار
    document.getElementById("sidebarToggle")?.addEventListener("click", () => {
      document.querySelector(".sidebar")?.classList.toggle("open");
    });
  }

  /* ---------------- کنترل‌های نقشه ---------------- */
  function wireMapControls() {
    document.querySelectorAll("[data-map-layer]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-map-layer]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        OwjState.state.mapLayer = btn.dataset.mapLayer;
        OwjMap.renderDataLayer(btn.dataset.mapLayer, OwjState.state.allCityData, selectCity);
      });
    });
    document.querySelectorAll("[data-base-layer]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-base-layer]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        OwjMap.setBaseLayer(btn.dataset.baseLayer);
      });
    });
    const radarBtn = document.getElementById("radarToggle");
    radarBtn?.addEventListener("click", async () => {
      const on = !radarBtn.classList.contains("active");
      radarBtn.classList.toggle("active", on);
      radarBtn.textContent = on ? "رادار بارش (فعال)" : "رادار بارش";
      const ok = await OwjMap.toggleRadar(on);
      if (on && !ok) { radarBtn.classList.remove("active"); radarBtn.textContent = "رادار در دسترس نیست"; }
    });
    const satBtn = document.getElementById("satToggle");
    satBtn?.addEventListener("click", () => {
      const on = !satBtn.classList.contains("active");
      satBtn.classList.toggle("active", on);
      OwjMap.toggleSatellite(on, "truecolor");
    });

    // وقتی بخش نقشه در دید قرار می‌گیرد، سایز آن را بازمحاسبه کن (چون در ابتدا مخفی/کوچک است)
    const mapSection = document.getElementById("mapSection");
    if (mapSection && "IntersectionObserver" in window) {
      new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) OwjMap.invalidateSize(); });
      }, { threshold: 0.15 }).observe(mapSection);
    }
  }

  /* ---------------- نوار تصاویر ماهواره‌ای (NASA Worldview Snapshot - رایگان) ---------------- */
  function renderSatelliteStrip() {
    const wrap = document.getElementById("satStrip");
    if (!wrap) return;
    const b = PROVINCE_BBOX;
    const bboxParam = `${b.west},${b.south},${b.east},${b.north}`;
    const offsets = [
      { label: "امروز (تأخیر پردازش ~۲ روز)", d: 2 },
      { label: "۱ روز پیش", d: 3 },
      { label: "۲ روز پیش", d: 4 },
      { label: "۳ روز پیش", d: 5 },
    ];
    wrap.innerHTML = offsets.map(o => {
      const date = new Date(Date.now() - o.d * 86400000).toISOString().slice(0, 10);
      const url = `${CONFIG.NASA_SNAPSHOT}?REQUEST=GetSnapshot&LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor&CRS=EPSG:4326&TIME=${date}&BBOX=${bboxParam}&WIDTH=320&HEIGHT=260&FORMAT=image/jpeg`;
      return `<figure class="sat-card">
        <img src="${url}" alt="تصویر ماهواره‌ای ${o.label}" loading="lazy"
             onerror="this.closest('.sat-card').classList.add('sat-error')">
        <figcaption>${o.label}<br><small>${new Date(date).toLocaleDateString("fa-IR")}</small></figcaption>
      </figure>`;
    }).join("") + `<p class="sat-credit">منبع: NASA Worldview / MODIS Terra (رایگان، بدون کلید) — تصاویر واقعی روز درج‌شده هستند.</p>`;
  }

  /* ---------------- جدول مقایسه شهرها ---------------- */
  function renderCompareTable(allData) {
    const wrap = document.getElementById("compareTable");
    if (!wrap) return;
    const rows = CITIES.map(c => {
      const d = allData[c.id];
      const cur = d?.forecast?.current;
      const aq = d?.airQuality?.current;
      return `<tr class="${c.id === OwjState.state.selectedCity ? "active-row" : ""}" data-city="${c.id}">
        <td>${c.name}</td>
        <td>${cur ? Math.round(cur.temperature_2m) + "°" : "—"}</td>
        <td>${cur ? Math.round(cur.relative_humidity_2m) + "%" : "—"}</td>
        <td>${cur ? Math.round(cur.wind_speed_10m) + " km/h" : "—"}</td>
        <td>${cur ? Math.round(cur.pressure_msl) + " hPa" : "—"}</td>
        <td>${aq?.aqi != null ? aq.aqi + "/5" : "—"}</td>
      </tr>`;
    }).join("");
    wrap.innerHTML = `
      <div class="compare-inner">
        <table>
          <thead><tr><th>شهر</th><th>دما</th><th>رطوبت</th><th>باد</th><th>فشار</th><th>AQI</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    wrap.querySelectorAll("tbody tr").forEach(tr => {
      tr.addEventListener("click", () => selectCity(tr.dataset.city));
    });
  }

  /* ---------------- PWA / Service Worker ---------------- */
  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./service-worker.js").catch(err => {
        console.warn("Service worker registration failed:", err);
      });
    }
    let deferredPrompt;
    window.addEventListener("beforeinstallprompt", e => {
      e.preventDefault();
      deferredPrompt = e;
      const installBtn = document.getElementById("installBtn");
      if (installBtn) {
        installBtn.hidden = false;
        installBtn.addEventListener("click", async () => {
          installBtn.hidden = true;
          deferredPrompt.prompt();
          await deferredPrompt.userChoice;
          deferredPrompt = null;
        });
      }
    });
  }

  return { init, selectCity };
})();

document.addEventListener("DOMContentLoaded", OwjApp.init);
