/**
 * alerts.js
 * موتور هشدار محاسباتی (تخمینی)
 *
 * توجه مهم: هیچ API رسمی و رایگانی برای هشدارهای هواشناسی سازمان هواشناسی ایران
 * در دسترس نیست. بنابراین این ماژول با ترکیب داده‌های دما، باد، رطوبت، دید و
 * PM10/دما یک هشدار «تخمینی» تولید می‌کند و همیشه با برچسب واضح «تخمینی -
 * غیررسمی» نمایش داده می‌شود. این هشدارها جایگزین هشدارهای رسمی نیستند.
 */

const OwjAlerts = (() => {
  const T = CONFIG.THRESHOLDS;

  /** تولید لیست هشدار برای یک شهر بر اساس داده current/daily/airQuality */
  function evaluateCity(cityId, cityName, data) {
    const alerts = [];
    if (!data || data.error || !data.forecast) return alerts;

    const cur = data.forecast.current || {};
    const daily = data.forecast.daily || {};
    const aq = data.airQuality?.current || {};

    const maxToday = daily.temperature_2m_max?.[0];
    const minToday = daily.temperature_2m_min?.[0];
    const windGustMax = daily.wind_gusts_10m_max?.[0] ?? cur.wind_gusts_10m;
    const pm10 = aq.pm10;
    const rainProb = daily.precipitation_probability_max?.[0];
    const rainSum = daily.precipitation_sum?.[0];

    // هشدار گرما
    if (maxToday >= T.EXTREME_HEAT_C) {
      alerts.push(mk("heat", "شدید", `دمای شدید (${Math.round(maxToday)}°) در ${cityName}`, "از فعالیت سنگین در ساعات گرم روز خودداری کنید و آب کافی بنوشید."));
    } else if (maxToday >= T.HEAT_C) {
      alerts.push(mk("heat", "متوسط", `هوای گرم (${Math.round(maxToday)}°) در ${cityName}`, "در ساعات اوج گرما از فعالیت شدید بیرون از منزل پرهیز کنید."));
    }

    // هشدار سرما
    if (minToday <= T.EXTREME_COLD_C) {
      alerts.push(mk("cold", "شدید", `سرمای شدید (${Math.round(minToday)}°) در ${cityName}`, "احتمال یخبندان شدید؛ از خودروها و لوله‌های آب محافظت کنید."));
    } else if (minToday <= T.COLD_C) {
      alerts.push(mk("cold", "متوسط", `هوای سرد (${Math.round(minToday)}°) در ${cityName}`, "احتمال یخبندان سطحی، مراقب لغزندگی جاده‌ها باشید."));
    }

    // هشدار باد
    if (windGustMax >= T.STORM_WIND_KMH) {
      alerts.push(mk("wind", "شدید", `تندباد (${Math.round(windGustMax)} km/h) در ${cityName}`, "از پارک خودرو زیر درختان و تابلوهای سست خودداری کنید."));
    } else if (windGustMax >= T.WIND_KMH) {
      alerts.push(mk("wind", "متوسط", `باد نسبتاً شدید (${Math.round(windGustMax)} km/h) در ${cityName}`, "در جاده‌های باز و مناطق کویری احتیاط کنید."));
    }

    // هشدار گرد و غبار (تخمینی از PM10)
    if (pm10 >= T.SEVERE_DUST_PM10) {
      alerts.push(mk("dust", "شدید", `احتمال طوفان شن/گرد و غبار شدید در ${cityName}`, "در صورت امکان در فضای بسته بمانید و از ماسک استفاده کنید.", true));
    } else if (pm10 >= T.DUST_PM10) {
      alerts.push(mk("dust", "متوسط", `افزایش گرد و غبار در ${cityName}`, "بیماران تنفسی از حضور طولانی در فضای باز پرهیز کنند.", true));
    }

    // هشدار بارندگی/سیل
    if (rainSum >= T.HEAVY_RAIN_MM) {
      alerts.push(mk("flood", "متوسط", `احتمال بارش سنگین (${rainSum} mm) در ${cityName}`, "احتمال آبگرفتگی معابر و رواناب سطحی وجود دارد."));
    } else if (rainProb >= T.RAIN_PROB) {
      alerts.push(mk("rain", "کم", `احتمال بارندگی (${rainProb}%) در ${cityName}`, "چتر یا پوشش ضدآب همراه داشته باشید."));
    }

    // هشدار رعدوبرق (کد هواشناسی ۹۵ تا ۹۹)
    const code = cur.weather_code;
    if ([95, 96, 99].includes(code)) {
      alerts.push(mk("storm", "متوسط", `احتمال رعدوبرق در ${cityName}`, "از قرارگیری در فضای باز و زیر درختان بلند خودداری کنید."));
    }

    // هشدار مه (بر اساس دید افقی ساعت جاری - از hourly اولین مقدار)
    const vis = data.forecast.hourly?.visibility?.[0];
    if (vis != null && vis <= T.FOG_VISIBILITY_M) {
      alerts.push(mk("fog", "کم", `کاهش دید (${Math.round(vis)} متر) در ${cityName}`, "هنگام رانندگی سرعت خود را کاهش دهید و چراغ مه‌شکن روشن کنید."));
    }

    return alerts;
  }

  function mk(type, severity, title, desc, estimatedFromAQ = false) {
    return {
      type, severity, title, desc,
      estimated: true,
      note: estimatedFromAQ
        ? "تخمینی - غیررسمی (بر اساس ترکیب داده PM10 و شرایط جوی)"
        : "تخمینی - غیررسمی (بر اساس آستانه‌های آماری، جایگزین هشدار رسمی نیست)"
    };
  }

  /** ارزیابی همه شهرها و بازگرداندن نقشه cityId -> alerts[] */
  function evaluateAll(allCityData) {
    const map = {};
    CITIES.forEach(c => {
      map[c.id] = evaluateCity(c.id, c.name, allCityData[c.id]);
    });
    return map;
  }

  const ICONS = {
    heat: "🌡️", cold: "❄️", wind: "💨", dust: "🌪️",
    rain: "🌧️", flood: "🌊", storm: "⛈️", fog: "🌫️"
  };
  const COLORS = {
    heat: "#e74c3c", cold: "#3498db", wind: "#1abc9c", dust: "#d35400",
    rain: "#2980b9", flood: "#c0392b", storm: "#8e44ad", fog: "#7f8c8d"
  };

  return { evaluateAll, evaluateCity, ICONS, COLORS };
})();
