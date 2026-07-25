/**
 * api.js
 * دریافت داده از Open-Meteo (Forecast API + Air Quality API — رایگان، بدون نیاز
 * به کلید یا اشتراک)، نرمال‌سازی به همون ساختار داخلی قبلی برنامه، کش در
 * localStorage و بازگشت به آخرین داده کش‌شده در صورت قطعی شبکه یا خطای API.
 */

const OwjApi = (() => {

  function cacheKey(cityId) {
    return CONFIG.LS_CACHE_PREFIX + cityId;
  }

  function saveCache(cityId, data) {
    try {
      localStorage.setItem(cacheKey(cityId), JSON.stringify({ data, ts: Date.now() }));
    } catch (e) {
      console.warn("localStorage cache write failed:", e);
    }
  }

  function loadCache(cityId) {
    try {
      const raw = localStorage.getItem(cacheKey(cityId));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  /** european_aqi (عدد پیوسته ۰ به بالا) را به سطح ۱ تا ۵ هم‌ارز مقیاس قبلی OpenWeather تبدیل می‌کند */
  function europeanAqiToLevel(aqi) {
    if (aqi == null) return null;
    if (aqi <= 20) return 1;
    if (aqi <= 40) return 2;
    if (aqi <= 60) return 3;
    if (aqi <= 80) return 4;
    return 5;
  }

  /** برش آرایه‌های ساعتی از نزدیک‌ترین ساعت به «الان» تا N ساعت بعد (هم‌ارز رفتار قبلی OWM) */
  function sliceFromNow(hourly, hours = 48) {
    const times = hourly.time || [];
    const found = times.findIndex(t => new Date(t) >= new Date());
    const nowIdx = Math.max(0, found === -1 ? 0 : found);
    const out = {};
    Object.keys(hourly).forEach(key => {
      out[key] = (hourly[key] || []).slice(nowIdx, nowIdx + hours);
    });
    return out;
  }

  /** نرمال‌سازی پاسخ Open-Meteo Forecast به ساختار forecast.current/hourly/daily برنامه (بدون تغییر شکل قبلی) */
  function normalizeForecast(json) {
    const current = {
      temperature_2m: json.current.temperature_2m,
      apparent_temperature: json.current.apparent_temperature,
      relative_humidity_2m: json.current.relative_humidity_2m,
      pressure_msl: json.current.pressure_msl,
      wind_speed_10m: json.current.wind_speed_10m,
      wind_direction_10m: json.current.wind_direction_10m,
      wind_gusts_10m: json.current.wind_gusts_10m,
      cloud_cover: json.current.cloud_cover,
      precipitation: json.current.precipitation,
      weather_code: json.current.weather_code, // Open-Meteo از همون کد استاندارد WMO استفاده می‌کند
      is_day: json.current.is_day,
    };

    const rawHourly = {
      time: json.hourly.time,
      temperature_2m: json.hourly.temperature_2m,
      weather_code: json.hourly.weather_code,
      wind_speed_10m: json.hourly.wind_speed_10m,
      precipitation_probability: json.hourly.precipitation_probability,
      uv_index: json.hourly.uv_index,
      dew_point_2m: json.hourly.dew_point_2m,
      visibility: json.hourly.visibility,
      snow_depth: json.hourly.snow_depth,
    };
    const hourly = sliceFromNow(rawHourly, 48);

    const d = json.daily;
    const daily = {
      time: d.time,
      temperature_2m_min: d.temperature_2m_min,
      temperature_2m_max: d.temperature_2m_max,
      weather_code: d.weather_code,
      precipitation_probability_max: d.precipitation_probability_max,
      uv_index_max: d.uv_index_max,
      precipitation_sum: d.precipitation_sum,
      snowfall_sum: d.snowfall_sum,
      sunrise: d.sunrise,
      sunset: d.sunset,
      wind_speed_10m_max: d.wind_speed_10m_max,
      wind_gusts_10m_max: d.wind_gusts_10m_max,
    };

    return { current, hourly, daily };
  }

  /** نرمال‌سازی پاسخ کیفیت هوای Open-Meteo (european_aqi) به همون ساختار قبلی (سطح ۱ تا ۵) */
  function normalizeAirQuality(json) {
    const c = json.current;
    const current = c ? {
      aqi: europeanAqiToLevel(c.european_aqi),
      pm2_5: c.pm2_5,
      pm10: c.pm10,
      nitrogen_dioxide: c.nitrogen_dioxide,
      sulphur_dioxide: c.sulphur_dioxide,
      carbon_monoxide: c.carbon_monoxide,
      ozone: c.ozone,
    } : null;

    const h = json.hourly || {};
    const times = h.time || [];
    const found = times.findIndex(t => new Date(t) >= new Date());
    const nowIdx = Math.max(0, found === -1 ? 0 : found);
    const hourly = { time: [], aqi: [] };
    for (let i = nowIdx; i < Math.min(nowIdx + 24, times.length); i++) {
      hourly.time.push(times[i]);
      hourly.aqi.push(europeanAqiToLevel(h.european_aqi?.[i]));
    }

    return { current, hourly };
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${url} ${body.slice(0, 200)}`);
    }
    return res.json();
  }

  /** دریافت داده کامل یک شهر (هواشناسی + کیفیت هوا) از Open-Meteo، با fallback به کش در صورت خطا */
  async function fetchCity(city) {
    const forecastUrl = `${CONFIG.OPEN_METEO_FORECAST}?latitude=${city.lat}&longitude=${city.lon}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,precipitation,weather_code,is_day` +
      `&hourly=temperature_2m,weather_code,wind_speed_10m,precipitation_probability,uv_index,dew_point_2m,visibility,snow_depth` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,snowfall_sum,wind_speed_10m_max,wind_gusts_10m_max` +
      `&timezone=${encodeURIComponent(CONFIG.TIMEZONE)}&forecast_days=7`;

    const airUrl = `${CONFIG.OPEN_METEO_AIR_QUALITY}?latitude=${city.lat}&longitude=${city.lon}` +
      `&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,european_aqi` +
      `&hourly=european_aqi&timezone=${encodeURIComponent(CONFIG.TIMEZONE)}&forecast_days=2`;

    try {
      const [forecastJson, airJson] = await Promise.all([
        fetchJson(forecastUrl),
        fetchJson(airUrl),
      ]);

      const data = {
        forecast: normalizeForecast(forecastJson),
        airQuality: normalizeAirQuality(airJson),
        isStale: false,
        fetchedAt: Date.now(),
      };
      saveCache(city.id, data);
      return data;
    } catch (err) {
      console.warn(`دریافت داده ${city.name} ناموفق بود:`, err.message);
      const cached = loadCache(city.id);
      if (cached) {
        return { ...cached.data, isStale: true };
      }
      return { error: true, message: err.message };
    }
  }

  /** دریافت هم‌زمان داده تمام شهرها → نقشه cityId -> data */
  async function fetchAll(cities) {
    const entries = await Promise.all(
      cities.map(async city => [city.id, await fetchCity(city)])
    );
    return Object.fromEntries(entries);
  }

  return { fetchCity, fetchAll, loadCache };
})();