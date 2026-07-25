/**
 * api.js
 * دریافت داده از OpenWeather (One Call 3.0 + Air Pollution)، نرمال‌سازی به
 * ساختار داخلی برنامه، کش در localStorage و بازگشت به آخرین داده کش‌شده
 * در صورت قطعی شبکه یا خطای API.
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

  const msToKmh = ms => (ms == null ? null : Math.round(ms * 3.6 * 10) / 10);

  function isDayAt(unixSec, sunriseSec, sunsetSec) {
    if (sunriseSec == null || sunsetSec == null) return true;
    return unixSec >= sunriseSec && unixSec < sunsetSec;
  }

  /** نرمال‌سازی پاسخ One Call 3.0 به ساختار forecast.current/hourly/daily برنامه */
  function normalizeOneCall(json) {
    const daily0 = json.daily?.[0];
    const dayFlag = isDayAt(json.current.dt, json.current.sunrise, json.current.sunset);

    const current = {
      temperature_2m: json.current.temp,
      apparent_temperature: json.current.feels_like,
      relative_humidity_2m: json.current.humidity,
      pressure_msl: json.current.pressure,
      wind_speed_10m: msToKmh(json.current.wind_speed),
      wind_direction_10m: json.current.wind_deg,
      wind_gusts_10m: msToKmh(json.current.wind_gust ?? json.current.wind_speed),
      cloud_cover: json.current.clouds,
      precipitation: (json.current.rain?.["1h"] ?? 0) + (json.current.snow?.["1h"] ?? 0),
      weather_code: owCodeToWmo(json.current.weather?.[0]?.id ?? 800, dayFlag),
      is_day: dayFlag ? 1 : 0,
    };

    const hourlySrc = json.hourly || [];
    const hourly = {
      time: [], temperature_2m: [], weather_code: [], wind_speed_10m: [],
      precipitation_probability: [], uv_index: [], dew_point_2m: [],
      visibility: [], snow_depth: [],
    };
    hourlySrc.slice(0, 48).forEach(h => {
      hourly.time.push(new Date(h.dt * 1000).toISOString());
      hourly.temperature_2m.push(h.temp);
      hourly.weather_code.push(owCodeToWmo(h.weather?.[0]?.id ?? 800, true));
      hourly.wind_speed_10m.push(msToKmh(h.wind_speed));
      hourly.precipitation_probability.push(Math.round((h.pop ?? 0) * 100));
      hourly.uv_index.push(h.uvi);
      hourly.dew_point_2m.push(h.dew_point);
      hourly.visibility.push(h.visibility);
      hourly.snow_depth.push((h.snow?.["1h"] ?? 0) / 1000); // تخمین تجمعی ساده بر حسب متر
    });

    const dailySrc = json.daily || [];
    const daily = {
      time: [], temperature_2m_min: [], temperature_2m_max: [], weather_code: [],
      precipitation_probability_max: [], uv_index_max: [], precipitation_sum: [],
      snowfall_sum: [], sunrise: [], sunset: [], wind_speed_10m_max: [], wind_gusts_10m_max: [],
    };
    dailySrc.forEach(d => {
      daily.time.push(new Date(d.dt * 1000).toISOString());
      daily.temperature_2m_min.push(d.temp?.min);
      daily.temperature_2m_max.push(d.temp?.max);
      daily.weather_code.push(owCodeToWmo(d.weather?.[0]?.id ?? 800, true));
      daily.precipitation_probability_max.push(Math.round((d.pop ?? 0) * 100));
      daily.uv_index_max.push(d.uvi);
      daily.precipitation_sum.push((d.rain ?? 0) + (d.snow ?? 0));
      daily.snowfall_sum.push(d.snow ?? 0);
      daily.sunrise.push(d.sunrise ? new Date(d.sunrise * 1000).toISOString() : null);
      daily.sunset.push(d.sunset ? new Date(d.sunset * 1000).toISOString() : null);
      daily.wind_speed_10m_max.push(msToKmh(d.wind_speed));
      daily.wind_gusts_10m_max.push(msToKmh(d.wind_gust ?? d.wind_speed));
    });

    return { current, hourly, daily };
  }

  /** نرمال‌سازی کیفیت هوای فعلی + پیش‌بینی ۲۴ ساعته */
  function normalizeAirQuality(currentJson, forecastJson) {
    const c = currentJson?.list?.[0];
    const current = c ? {
      aqi: c.main.aqi,
      pm2_5: c.components.pm2_5,
      pm10: c.components.pm10,
      nitrogen_dioxide: c.components.no2,
      sulphur_dioxide: c.components.so2,
      carbon_monoxide: c.components.co,
      ozone: c.components.o3,
    } : null;

    const hourly = { time: [], aqi: [] };
    (forecastJson?.list || []).slice(0, 24).forEach(item => {
      hourly.time.push(new Date(item.dt * 1000).toISOString());
      hourly.aqi.push(item.main.aqi);
    });

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

  /** دریافت داده کامل یک شهر (هواشناسی + کیفیت هوا)، با fallback به کش در صورت خطا */
  async function fetchCity(city) {
    const key = CONFIG.OPENWEATHER_KEY;
    const oneCallUrl = `${CONFIG.OPENWEATHER_ONECALL}?lat=${city.lat}&lon=${city.lon}&units=metric&lang=fa&appid=${key}`;
    const airCurrentUrl = `${CONFIG.OPENWEATHER_AIR_CURRENT}?lat=${city.lat}&lon=${city.lon}&appid=${key}`;
    const airForecastUrl = `${CONFIG.OPENWEATHER_AIR_FORECAST}?lat=${city.lat}&lon=${city.lon}&appid=${key}`;

    try {
      const [oneCall, airCurrent, airForecast] = await Promise.all([
        fetchJson(oneCallUrl),
        fetchJson(airCurrentUrl),
        fetchJson(airForecastUrl),
      ]);

      const data = {
        forecast: normalizeOneCall(oneCall),
        airQuality: normalizeAirQuality(airCurrent, airForecast),
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
