/**
 * api.js
 * لایه ارتباط با OpenWeather (One Call 3.0 + Air Pollution) + مدیریت کش
 * LocalStorage + مدیریت خطا و حالت آفلاین.
 *
 * توجه: کلید OpenWeather طبق دستور صریح صاحب پروژه به‌صورت ثابت و عمومی
 * در CONFIG.OPENWEATHER_KEY قرار دارد (بدون مودال تنظیمات کاربر).
 *
 * پاسخ خام OpenWeather در همان قالب داخلی قبلی (temperature_2m، daily
 * arrays و ...) نرمال‌سازی می‌شود تا بقیه ماژول‌ها (ui.js, map.js,
 * charts.js, alerts.js, dust.js) بدون تغییر کار کنند.
 */

const OwjAPI = (() => {

  function setCache(key, data) {
    try {
      const payload = { ts: Date.now(), data };
      localStorage.setItem(CONFIG.LS_CACHE_PREFIX + key, JSON.stringify(payload));
    } catch (e) {
      console.warn("Cache write failed:", e);
    }
  }

  function getCache(key, maxAge = null) {
    try {
      const raw = localStorage.getItem(CONFIG.LS_CACHE_PREFIX + key);
      if (!raw) return null;
      const payload = JSON.parse(raw);
      if (maxAge != null && Date.now() - payload.ts > maxAge) return null;
      return payload;
    } catch (e) {
      return null;
    }
  }

  async function safeFetch(url, timeoutMs = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${body ? "- " + body.slice(0, 120) : ""}`);
      }
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  function buildOneCallUrl(city) {
    const params = new URLSearchParams({
      lat: city.lat, lon: city.lon,
      appid: CONFIG.OPENWEATHER_KEY,
      units: "metric",
      lang: "fa",
      exclude: "minutely",
    });
    return `${CONFIG.OPENWEATHER_ONECALL}?${params.toString()}`;
  }

  function buildAirPollutionUrl(city) {
    const params = new URLSearchParams({ lat: city.lat, lon: city.lon, appid: CONFIG.OPENWEATHER_KEY });
    return `${CONFIG.OPENWEATHER_AIR_POLLUTION}?${params.toString()}`;
  }

  function buildAirPollutionForecastUrl(city) {
    const params = new URLSearchParams({ lat: city.lat, lon: city.lon, appid: CONFIG.OPENWEATHER_KEY });
    return `${CONFIG.OPENWEATHER_AIR_POLLUTION_FORECAST}?${params.toString()}`;
  }

  const MS_TO_KMH = 3.6;

  function computeIsDay(dtSec, sunriseSec, sunsetSec) {
    if (sunriseSec == null || sunsetSec == null) return true;
    return dtSec >= sunriseSec && dtSec < sunsetSec;
  }

  function normalizeOneCall(raw) {
    const c = raw.current || {};
    const isDay = computeIsDay(c.dt, c.sunrise, c.sunset);
    const current = {
      temperature_2m: c.temp,
      apparent_temperature: c.feels_like,
      relative_humidity_2m: c.humidity,
      is_day: isDay ? 1 : 0,
      precipitation: (c.rain?.["1h"] ?? 0) + (c.snow?.["1h"] ?? 0),
      weather_code: owCodeToWmo(c.weather?.[0]?.id ?? 800, isDay),
      cloud_cover: c.clouds,
      pressure_msl: c.pressure,
      wind_speed_10m: c.wind_speed != null ? c.wind_speed * MS_TO_KMH : null,
      wind_direction_10m: c.wind_deg,
      wind_gusts_10m: (c.wind_gust ?? c.wind_speed) != null ? (c.wind_gust ?? c.wind_speed) * MS_TO_KMH : null,
    };

    const daily = { time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [],
      apparent_temperature_max: [], apparent_temperature_min: [], sunrise: [], sunset: [],
      uv_index_max: [], precipitation_sum: [], precipitation_probability_max: [],
      wind_speed_10m_max: [], wind_gusts_10m_max: [], wind_direction_10m_dominant: [], snowfall_sum: [] };

    (raw.daily || []).slice(0, 7).forEach(d => {
      daily.time.push(new Date(d.dt * 1000).toISOString());
      daily.weather_code.push(owCodeToWmo(d.weather?.[0]?.id ?? 800, true));
      daily.temperature_2m_max.push(d.temp?.max);
      daily.temperature_2m_min.push(d.temp?.min);
      daily.apparent_temperature_max.push(d.feels_like?.day);
      daily.apparent_temperature_min.push(d.feels_like?.night);
      daily.sunrise.push(new Date(d.sunrise * 1000).toISOString());
      daily.sunset.push(new Date(d.sunset * 1000).toISOString());
      daily.uv_index_max.push(d.uvi);
      daily.precipitation_sum.push((d.rain ?? 0) + (d.snow ?? 0));
      daily.precipitation_probability_max.push(d.pop != null ? Math.round(d.pop * 100) : null);
      daily.wind_speed_10m_max.push(d.wind_speed != null ? d.wind_speed * MS_TO_KMH : null);
      daily.wind_gusts_10m_max.push((d.wind_gust ?? d.wind_speed) != null ? (d.wind_gust ?? d.wind_speed) * MS_TO_KMH : null);
      daily.wind_direction_10m_dominant.push(d.wind_deg);
      daily.snowfall_sum.push(d.snow ?? 0);
    });

    const hourly = { time: [], temperature_2m: [], relative_humidity_2m: [], dew_point_2m: [],
      apparent_temperature: [], precipitation_probability: [], precipitation: [], weather_code: [],
      visibility: [], wind_speed_10m: [], wind_direction_10m: [], wind_gusts_10m: [], uv_index: [],
      cloud_cover: [], snowfall: [], snow_depth: [], pressure_msl: [] };

    (raw.hourly || []).slice(0, 48).forEach(hh => {
      const hIsDay = computeIsDay(hh.dt, c.sunrise, c.sunset);
      hourly.time.push(new Date(hh.dt * 1000).toISOString());
      hourly.temperature_2m.push(hh.temp);
      hourly.relative_humidity_2m.push(hh.humidity);
      hourly.dew_point_2m.push(hh.dew_point);
      hourly.apparent_temperature.push(hh.feels_like);
      hourly.precipitation_probability.push(hh.pop != null ? Math.round(hh.pop * 100) : null);
      hourly.precipitation.push((hh.rain?.["1h"] ?? 0) + (hh.snow?.["1h"] ?? 0));
      hourly.weather_code.push(owCodeToWmo(hh.weather?.[0]?.id ?? 800, hIsDay));
      hourly.visibility.push(hh.visibility);
      hourly.wind_speed_10m.push(hh.wind_speed != null ? hh.wind_speed * MS_TO_KMH : null);
      hourly.wind_direction_10m.push(hh.wind_deg);
      hourly.wind_gusts_10m.push((hh.wind_gust ?? hh.wind_speed) != null ? (hh.wind_gust ?? hh.wind_speed) * MS_TO_KMH : null);
      hourly.uv_index.push(hh.uvi);
      hourly.cloud_cover.push(hh.clouds);
      hourly.snowfall.push(hh.snow?.["1h"] ?? 0);
      hourly.snow_depth.push(null);
      hourly.pressure_msl.push(hh.pressure);
    });

    return { current, daily, hourly, timezone_offset: raw.timezone_offset, raw_alerts: raw.alerts || [] };
  }

  function normalizeAirPollution(raw, forecastRaw) {
    const item = raw?.list?.[0];
    const current = item ? {
      aqi: item.main?.aqi,
      pm2_5: item.components?.pm2_5,
      pm10: item.components?.pm10,
      carbon_monoxide: item.components?.co,
      nitrogen_dioxide: item.components?.no2,
      sulphur_dioxide: item.components?.so2,
      ozone: item.components?.o3,
    } : null;

    const hourly = { time: [], aqi: [], pm10: [], pm2_5: [] };
    (forecastRaw?.list || []).slice(0, 48).forEach(h => {
      hourly.time.push(new Date(h.dt * 1000).toISOString());
      hourly.aqi.push(h.main?.aqi);
      hourly.pm10.push(h.components?.pm10);
      hourly.pm2_5.push(h.components?.pm2_5);
    });

    return { current, hourly };
  }

  async function fetchCityData(city) {
    const cacheKey = `city_${city.id}`;
    try {
      const [oneCallRaw, airRaw, airForecastRaw] = await Promise.all([
        safeFetch(buildOneCallUrl(city)),
        safeFetch(buildAirPollutionUrl(city)),
        safeFetch(buildAirPollutionForecastUrl(city)).catch(() => null),
      ]);
      const result = {
        forecast: normalizeOneCall(oneCallRaw),
        airQuality: normalizeAirPollution(airRaw, airForecastRaw),
        fetchedAt: Date.now(),
        isStale: false,
      };
      setCache(cacheKey, result);
      return result;
    } catch (err) {
      console.warn(`API error for ${city.name}:`, err.message);
      const cached = getCache(cacheKey, null);
      if (cached) return { ...cached.data, isStale: true, staleTs: cached.ts };
      throw err;
    }
  }

  async function fetchAllCities() {
    const results = await Promise.allSettled(CITIES.map(c => fetchCityData(c)));
    const data = {};
    results.forEach((r, i) => {
      const city = CITIES[i];
      if (r.status === "fulfilled") data[city.id] = r.value;
      else data[city.id] = { error: true, message: r.reason?.message || "خطای نامشخص" };
    });
    return data;
  }

  async function checkApiOnline() {
    try {
      const params = new URLSearchParams({ lat: 32.86, lon: 59.22, appid: CONFIG.OPENWEATHER_KEY, exclude: "minutely,hourly,daily,alerts" });
      await safeFetch(`${CONFIG.OPENWEATHER_ONECALL}?${params.toString()}`, 6000);
      return true;
    } catch {
      return false;
    }
  }

  return { fetchCityData, fetchAllCities, checkApiOnline, getCache, setCache };
})();
