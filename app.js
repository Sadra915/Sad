/**
 * app.js
 * هماهنگ‌کننده اصلی: بارگذاری اولیه، رفرش دوره‌ای، رویدادهای رابط کاربری،
 * و اتصال همه ماژول‌ها (state/api/ui/map/charts/effects/alerts) به هم.
 */

(() => {
  const $ = sel => document.querySelector(sel);
  let refreshTimer = null;
  let deferredInstallPrompt = null;

  /* ---------------- رندر کامل صفحه برای شهر انتخاب‌شده ---------------- */
  function renderSelectedCity() {
    const city = OwjState.getCity(OwjState.state.selectedCity) || CITIES[0];
    const data = OwjState.state.allCityData[city.id];

    OwjUI.renderCurrentPanel(city, data);
    OwjUI.renderHourly(data);
    OwjUI.renderWeekly(data);
    OwjUI.renderAirQuality(city, data);
    OwjUI.renderDust(city, data);
    OwjCharts.renderAllForCity(data);

    if (data && !data.error) {
      OwjEffects.setSkyState(data.forecast.current.weather_code, data.forecast.current.is_day === 1);
    }

    OwjUI.renderSidebar(OwjState.state.allCityData, city.id);
    OwjMap.renderDataLayer(OwjState.state.mapLayer, OwjState.state.allCityData, selectCity);
    OwjMap.flyToCity(city.id);
    renderCompareTable();
  }

  /* ---------------- جدول مقایسه شهرها ---------------- */
  function renderCompareTable() {
    const wrap = $("#compareTable");
    const rows = CITIES.map(c => {
      const d = OwjState.state.allCityData[c.id];
      const cur = d?.forecast?.current;
      const aq = d?.airQuality?.current;
      return { city: c, cur, aq };
    });
    wrap.innerHTML = `
      <div class="compare-inner">
        <table>
          <thead><tr>
            <th>شهر</th><th>دما</th><th>رطوبت</th><th>باد</th><th>AQI</th>
          </tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr data-city="${r.city.id}" class="${r.city.id === OwjState.state.selectedCity ? "active-row" : ""}">
                <td>${r.city.name}</td>
                <td>${r.cur ? Math.round(r.cur.temperature_2m) + "°" : "—"}</td>
                <td>${r.cur ? Math.round(r.cur.relative_humidity_2m) + "%" : "—"}</td>
                <td>${r.cur ? Math.round(r.cur.wind_speed_10m) : "—"}</td>
                <td>${r.aq?.aqi ?? "—"}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
    wrap.querySelectorAll("tr[data-city]").forEach(tr => {
      tr.addEventListener("click", () => selectCity(tr.dataset.city));
    });
  }

  /* ---------------- تصاویر ماهواره‌ای NASA GIBS ---------------- */
  function renderSatStrip() {
    const wrap = $("#satStrip");
    const date = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10); // تأخیر پردازش ۲ روزه
    const bbox = `${PROVINCE_BBOX.west},${PROVINCE_BBOX.south},${PROVINCE_BBOX.east},${PROVINCE_BBOX.north}`;
    const layers = [
      { id: "MODIS_Terra_CorrectedReflectance_TrueColor", title: "رنگ طبیعی (True Color)" },
      { id: "MODIS_Terra_Aerosol", title: "آئروسل / گردوغبار جوی" },
      { id: "MODIS_Terra_NDVI_8Day", title: "شاخص پوشش گیاهی (NDVI ۸ روزه)" },
    ];
    wrap.innerHTML = layers.map(l => {
      const url = `${CONFIG.GIBS_SNAPSHOT}?REQUEST=GetSnapshot&LAYERS=${l.id}&CRS=EPSG:4326&TIME=${date}&BBOX=${bbox}&FORMAT=image/jpeg&WIDTH=480&HEIGHT=360`;
      return `<figure class="sat-card">
        <img src="${url}" alt="${l.title}" loading="lazy" onerror="this.closest('.sat-card').classList.add('sat-error')">
        <figcaption>${l.title} — ${date}</figcaption>
      </figure>`;
    }).join("");
  }

  /* ---------------- انتخاب شهر ---------------- */
  function selectCity(cityId) {
    OwjState.setSelectedCity(cityId);
    renderSelectedCity();
  }

  /* ---------------- بارگذاری کامل داده ---------------- */
  async function loadAll(isManualRefresh = false) {
    OwjUI.setOnlineBadge(navigator.onLine, true);
    if (!isManualRefresh) OwjUI.showSkeleton();

    try {
      const allData = await OwjApi.fetchAll(CITIES);
      OwjState.state.allCityData = allData;
      OwjState.state.alerts = OwjAlerts.evaluateAll(allData);
      OwjState.state.lastUpdate = Date.now();

      const anySuccess = Object.values(allData).some(d => d && !d.error);
      OwjUI.setOnlineBadge(navigator.onLine, anySuccess);

      OwjUI.renderAlerts(OwjState.state.alerts);
      OwjUI.renderProvinceDashboard(allData, OwjState.state.alerts);
      OwjUI.setLastUpdate(OwjState.state.lastUpdate);
      renderSelectedCity();

      if (!anySuccess) {
        console.error("دریافت داده برای هیچ شهری موفق نبود — احتمالاً کلید API یا پلن OpenWeather مشکل دارد.");
      }
    } catch (err) {
      // حتی اگر رندر کردن داده‌ی خراب یا ناقص خطا بدهد، صفحه نباید روی لودینگ گیر کند
      console.error("خطا در بارگذاری/رندر داده:", err);
      OwjUI.setOnlineBadge(navigator.onLine, false);
    } finally {
      OwjUI.hideLoadingScreen();
    }
  }

  /* ---------------- رویدادهای رابط کاربری ---------------- */
  function wireEvents() {
    $("#refreshBtn").addEventListener("click", () => loadAll(true));

    $("#themeToggle").addEventListener("click", () => OwjState.toggleTheme());

    $("#sidebarToggle").addEventListener("click", () => {
      document.querySelector(".sidebar").classList.toggle("open");
    });

    $("#compareToggle").addEventListener("click", () => {
      $("#compareTable").classList.toggle("open");
    });

    document.querySelectorAll("[data-base-layer]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-base-layer]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        OwjMap.setBaseLayer(btn.dataset.baseLayer);
      });
    });

    document.querySelectorAll("[data-map-layer]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-map-layer]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        OwjState.state.mapLayer = btn.dataset.mapLayer;
        OwjMap.renderDataLayer(btn.dataset.mapLayer, OwjState.state.allCityData, selectCity);
      });
    });

    $("#radarToggle").addEventListener("click", async () => {
      const on = !$("#radarToggle").classList.contains("active");
      const ok = await OwjMap.toggleRadar(on);
      $("#radarToggle").classList.toggle("active", on && ok);
    });

    $("#satToggle").addEventListener("click", () => {
      const on = !$("#satToggle").classList.contains("active");
      OwjMap.toggleSatellite(on);
      $("#satToggle").classList.toggle("active", on);
    });

    window.addEventListener("online", () => { OwjState.state.isOnline = true; loadAll(true); });
    window.addEventListener("offline", () => {
      OwjState.state.isOnline = false;
      OwjUI.setOnlineBadge(false, false);
    });

    window.addEventListener("beforeinstallprompt", e => {
      e.preventDefault();
      deferredInstallPrompt = e;
      $("#installBtn").hidden = false;
    });
    $("#installBtn").addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      $("#installBtn").hidden = true;
    });

    setInterval(OwjUI.setClockAndDate, 30000);
  }

  /* ---------------- راه‌اندازی اولیه ---------------- */
  function init() {
    // شبکه‌ی امن: هر اتفاقی بیفتد، حداکثر بعد از ۱۲ ثانیه صفحه‌ی لودینگ باید بسته شود
    const safetyTimer = setTimeout(() => {
      console.warn("Safety timeout: forcing loading screen to hide.");
      OwjUI.hideLoadingScreen();
    }, 12000);

    try {
      document.documentElement.setAttribute("data-theme", OwjState.state.theme);
      OwjUI.setClockAndDate();
      OwjEffects.init();
      OwjMap.init();
      renderSatStrip();
      wireEvents();
    } catch (err) {
      console.error("خطا در راه‌اندازی اولیه:", err);
    }

    loadAll().finally(() => clearTimeout(safetyTimer));
    refreshTimer = setInterval(() => loadAll(true), 15 * 60 * 1000); // بروزرسانی خودکار هر ۱۵ دقیقه

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./service-worker.js").catch(err => {
        console.warn("Service worker registration failed:", err);
      });
    }
  }

  window.OwjApp = { selectCity, refresh: () => loadAll(true) };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();