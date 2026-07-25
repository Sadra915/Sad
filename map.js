/**
 * map.js
 * نقشه تعاملی مبتنی بر Leaflet + OpenStreetMap
 *
 * محدودیت صادقانه: OpenWeather و RainViewer داده‌های نقطه‌ای/رادار می‌دهند نه
 * لایه‌های گریدی رنگی برای هر پارامتر (دما/رطوبت/فشار و...) به‌صورت رایگان.
 * بنابراین لایه‌های «دما / ابر / باد / فشار / رطوبت / AQI / گردوغبار» با استفاده
 * از داده واقعی همان ۱۰ شهر به‌صورت دایره‌های رنگی/برچسب مقداری روی نقشه ساخته
 * می‌شوند (Data Markers) — نه یک لایه گریدی کامل بین‌شهری. رادار بارش (RainViewer)
 * و تصاویر ماهواره‌ای (NASA GIBS) لایه‌های کاشی واقعی و زنده هستند.
 */

const OwjMap = (() => {
  let map = null;
  let baseLayers = {};
  let dataLayerGroup = null;   // برای لایه‌های داده‌محور شهرها (دما/باد/رطوبت/فشار/AQI/گردوغبار)
  let radarLayer = null;
  let satLayer = null;
  let cityMarkers = {};
  let currentDataLayer = "temp";
  let radarFrames = [];
  let radarFrameIndex = 0;
  let radarTimer = null;

  function init() {
    map = L.map("mapView", {
      zoomControl: false,
      attributionControl: true,
    }).setView(PROVINCE_CENTER, 7);

    L.control.zoom({ position: "bottomleft" }).addTo(map);

    baseLayers.standard = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18, attribution: "© OpenStreetMap contributors",
    });
    baseLayers.terrain = L.tileLayer(CONFIG.OPENTOPOMAP, {
      maxZoom: 16, attribution: "© OpenTopoMap, © OpenStreetMap contributors",
    });
    baseLayers.satellite = L.tileLayer(CONFIG.ESRI_IMAGERY, {
      maxZoom: 17, attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics",
    });

    baseLayers.standard.addTo(map);
    dataLayerGroup = L.layerGroup().addTo(map);

    drawProvinceOutlineHint();

    return map;
  }

  /** خط راهنمای محدوده استان (مستطیل تقریبی، صرفاً جهت جهت‌گیری بصری) */
  function drawProvinceOutlineHint() {
    const b = PROVINCE_BBOX;
    L.rectangle([[b.south, b.west], [b.north, b.east]], {
      color: "#3fd0e0", weight: 1, dashArray: "4 6", fillOpacity: 0,
    }).addTo(map);
  }

  /** تعویض نقشه پایه: standard | terrain | satellite */
  function setBaseLayer(key) {
    Object.values(baseLayers).forEach(l => map.removeLayer(l));
    (baseLayers[key] || baseLayers.standard).addTo(map);
  }

  /** رنگ‌بندی مقدار برای لایه‌های داده‌محور */
  function colorFor(layer, value) {
    if (value == null || isNaN(value)) return "#7f8c8d";
    switch (layer) {
      case "temp": {
        if (value <= 0) return "#3498db";
        if (value <= 15) return "#1abc9c";
        if (value <= 28) return "#f1c40f";
        if (value <= 38) return "#e67e22";
        return "#e74c3c";
      }
      case "wind": {
        if (value <= 10) return "#2ecc71";
        if (value <= 25) return "#1abc9c";
        if (value <= 40) return "#f1c40f";
        if (value <= 60) return "#e67e22";
        return "#e74c3c";
      }
      case "humidity": return `hsl(205, 80%, ${Math.max(25, 70 - value * 0.4)}%)`;
      case "pressure": {
        if (value < 1005) return "#e74c3c";
        if (value < 1013) return "#f1c40f";
        if (value < 1020) return "#2ecc71";
        return "#3498db";
      }
      case "cloud": return `hsl(210, 15%, ${Math.max(30, 90 - value * 0.5)}%)`;
      case "aqi": return getAqiInfo(value).color;
      case "dust": {
        if (value < 20) return "#2ecc71";
        if (value < 40) return "#a3d900";
        if (value < 60) return "#f1c40f";
        if (value < 80) return "#e67e22";
        return "#e74c3c";
      }
      default: return "#3fd0e0";
    }
  }

  function valueFor(layer, city, data) {
    if (!data || data.error) return null;
    const cur = data.forecast?.current;
    const aq = data.airQuality?.current;
    switch (layer) {
      case "temp": return cur?.temperature_2m;
      case "wind": return cur?.wind_speed_10m;
      case "humidity": return cur?.relative_humidity_2m;
      case "pressure": return cur?.pressure_msl;
      case "cloud": return cur?.cloud_cover;
      case "aqi": return aq?.aqi;
      case "dust": return OwjDust.computeRiskIndex(data)?.index ?? null;
      default: return null;
    }
  }

  function unitFor(layer) {
    return { temp: "°C", wind: "km/h", humidity: "%", pressure: "hPa", cloud: "%", aqi: "", dust: "/100" }[layer] || "";
  }
  function labelFor(layer) {
    return {
      temp: "دما", wind: "سرعت باد", humidity: "رطوبت", pressure: "فشار هوا",
      cloud: "ابرناکی", aqi: "کیفیت هوا (AQI)", dust: "شاخص گردوغبار (تخمینی)",
    }[layer] || layer;
  }

  /** رسم مارکرهای داده‌محور برای لایه انتخاب‌شده */
  function renderDataLayer(layer, allData, onCityClick) {
    currentDataLayer = layer;
    dataLayerGroup.clearLayers();
    cityMarkers = {};

    CITIES.forEach(city => {
      const data = allData[city.id];
      const value = valueFor(layer, city, data);
      const color = colorFor(layer, value);
      const displayVal = value == null ? "—" : Math.round(value * 10) / 10;

      const icon = L.divIcon({
        className: "city-map-marker",
        html: `<div class="cmm-dot" style="background:${color};box-shadow:0 0 14px ${color}">
                 <span class="cmm-val">${displayVal}${value != null ? unitFor(layer) : ""}</span>
               </div>
               <div class="cmm-name">${city.name}</div>`,
        iconSize: [70, 46],
        iconAnchor: [35, 40],
      });

      const marker = L.marker([city.lat, city.lon], { icon }).addTo(dataLayerGroup);

      if (data && !data.error) {
        const cur = data.forecast.current;
        const wInfo = getWeatherInfo(cur.weather_code);
        marker.bindPopup(`
          <div class="map-popup">
            <h4>${city.name}${city.isCapital ? " (مرکز استان)" : ""}</h4>
            <div class="mp-row"><span>${wInfo.text}</span></div>
            <div class="mp-grid">
              <span>🌡️ ${fmt1(cur.temperature_2m)}°</span>
              <span>💧 ${fmt1(cur.relative_humidity_2m)}%</span>
              <span>💨 ${fmt1(cur.wind_speed_10m)} km/h</span>
              <span>📟 ${fmt1(cur.pressure_msl)} hPa</span>
            </div>
            <div class="mp-label">${labelFor(layer)}: <b>${displayVal}${unitFor(layer)}</b></div>
            <button class="mp-btn" data-city="${city.id}">مشاهده جزئیات ←</button>
          </div>
        `);
        marker.on("popupopen", () => {
          const btn = document.querySelector(`.mp-btn[data-city="${city.id}"]`);
          if (btn) btn.addEventListener("click", () => onCityClick(city.id));
        });
      }
      marker.on("click", () => onCityClick(city.id));
      cityMarkers[city.id] = marker;
    });
  }

  function fmt1(n) { return n == null || isNaN(n) ? "—" : Math.round(n * 10) / 10; }

  /** لایه رادار بارش زنده RainViewer (کاشی واقعی، رایگان، بدون کلید) */
  async function toggleRadar(on) {
    if (!on) {
      if (radarLayer) { map.removeLayer(radarLayer); radarLayer = null; }
      if (radarTimer) { clearInterval(radarTimer); radarTimer = null; }
      return true;
    }
    try {
      const res = await fetch(CONFIG.RAINVIEWER_INDEX);
      const json = await res.json();
      radarFrames = [...(json.radar.past || []), ...(json.radar.nowcast || [])];
      if (!radarFrames.length) return false;
      radarFrameIndex = radarFrames.length - 1;
      applyRadarFrame(json.host);
      return true;
    } catch (e) {
      console.warn("RainViewer error:", e);
      return false;
    }
  }
  function applyRadarFrame(host) {
    if (radarLayer) map.removeLayer(radarLayer);
    const frame = radarFrames[radarFrameIndex];
    if (!frame) return;
    radarLayer = L.tileLayer(`${host}${frame.path}/256/{z}/{x}/{y}/4/1_1.png`, {
      opacity: 0.55, maxZoom: 12, zIndex: 450,
    }).addTo(map);
  }

  /** لایه ماهواره‌ای زنده NASA GIBS (کاشی واقعی WMTS، رایگان) — layer: truecolor | aerosol | ndvi */
  function toggleSatellite(on, layer = "truecolor", dateStr = null) {
    if (satLayer) { map.removeLayer(satLayer); satLayer = null; }
    if (!on) return;
    const date = dateStr || new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10); // تأخیر ۲ روزه پردازش GIBS
    const layers = {
      truecolor: { id: "MODIS_Terra_CorrectedReflectance_TrueColor", maxZoom: 9 },
      aerosol:   { id: "MODIS_Terra_Aerosol", maxZoom: 6 },
      ndvi:      { id: "MODIS_Terra_NDVI_8Day", maxZoom: 8 },
    };
    const L_ = layers[layer] || layers.truecolor;
    const url = `${CONFIG.GIBS_WMTS}/${L_.id}/default/${date}/GoogleMapsCompatible_Level${L_.maxZoom}/{z}/{y}/{x}.jpg`;
    satLayer = L.tileLayer(url, {
      maxNativeZoom: L_.maxZoom, maxZoom: 17, opacity: 0.85, zIndex: 400,
      attribution: "NASA GIBS / MODIS",
    }).addTo(map);
  }

  function flyToCity(cityId) {
    const city = CITIES.find(c => c.id === cityId);
    if (city && map) map.flyTo([city.lat, city.lon], 9, { duration: 0.8 });
    const marker = cityMarkers[cityId];
    if (marker) setTimeout(() => marker.openPopup(), 500);
  }

  function invalidateSize() {
    if (map) setTimeout(() => map.invalidateSize(), 200);
  }

  return {
    init, setBaseLayer, renderDataLayer, toggleRadar, toggleSatellite,
    flyToCity, invalidateSize, labelFor,
  };
})();
