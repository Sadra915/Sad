/**
 * config.js
 * پیکربندی مرکزی سامانه اوج - هواشناسی خراسان جنوبی
 * تمام ثابت‌ها، مختصات شهرها و تنظیمات API در این فایل قرار دارد.
 */

// مختصات جغرافیایی دقیق شهرهای استان خراسان جنوبی
const CITIES = [
  { id: "birjand",    name: "بیرجند",   lat: 32.8663, lon: 59.2211, isCapital: true },
  { id: "qaen",       name: "قائن",     lat: 33.7267, lon: 59.1804 },
  { id: "ferdows",    name: "فردوس",    lat: 34.0158, lon: 58.1725 },
  { id: "tabas",      name: "طبس",      lat: 33.5959, lon: 56.9241 },
  { id: "nehbandan",  name: "نهبندان",  lat: 31.5350, lon: 60.0319 },
  { id: "sarbisheh",  name: "سربیشه",   lat: 32.5750, lon: 59.7867 },
  { id: "boshruyeh",  name: "بشرویه",   lat: 33.8536, lon: 57.4288 },
  { id: "khusf",      name: "خوسف",     lat: 32.7667, lon: 58.9333 },
  { id: "sarayan",    name: "سرایان",   lat: 33.8592, lon: 58.5292 },
  { id: "zirkuh",     name: "زیرکوه",   lat: 33.0333, lon: 60.4667 }
];

const CONFIG = {
  // اطلاعات کلی
  APP_NAME: "اوج",
  APP_FULL_NAME: "هواشناسی خراسان جنوبی",
  DEFAULT_CITY: "birjand",
  TIMEZONE: "Asia/Tehran",

  // OpenWeather - منبع اصلی داده هواشناسی و کیفیت هوا (کلید ثابت، طبق دستور صاحب پروژه به‌صورت عمومی در کد قرار دارد)
  OPENWEATHER_KEY: "36ba4e5680e71868366e4aca1ab75cef",
  OPENWEATHER_ONECALL: "https://api.openweathermap.org/data/3.0/onecall",
  OPENWEATHER_AIR_POLLUTION: "https://api.openweathermap.org/data/2.5/air_pollution",
  OPENWEATHER_AIR_POLLUTION_FORECAST: "https://api.openweathermap.org/data/2.5/air_pollution/forecast",

  // کاشی‌های رادار بارش رایگان (RainViewer)
  RAINVIEWER_INDEX: "https://api.rainviewer.com/public/weather-maps.json",

  // کاشی‌های ماهواره‌ای رایگان ناسا (GIBS) - بدون کلید
  GIBS_WMTS: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best",
  // تصاویر لحظه‌ای برش‌خورده ناسا (Worldview Snapshots) - بدون کلید، برای کارت‌های تصاویر ماهواره‌ای
  NASA_SNAPSHOT: "https://wvs.earthdata.nasa.gov/api/v1/snapshot",
  // نقشه توپوگرافی رایگان بدون کلید
  OPENTOPOMAP: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  // تصاویر ماهواره‌ای پایه رایگان Esri (بدون کلید)
  ESRI_IMAGERY: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",

  // زمان‌بندی بروزرسانی و کش
  REFRESH_INTERVAL_MS: 10 * 60 * 1000, // هر ۱۰ دقیقه
  CACHE_MAX_AGE_MS: 30 * 60 * 1000,    // اعتبار کش: ۳۰ دقیقه

  // کلیدهای LocalStorage
  LS_THEME: "owj_theme",
  LS_LAST_CITY: "owj_last_city",
  LS_CACHE_PREFIX: "owj_cache_",
  LS_UNIT: "owj_unit",

  // آستانه‌های هشدار (برای موتور هشدار محاسباتی - تخمینی)
  THRESHOLDS: {
    HEAT_C: 38,
    EXTREME_HEAT_C: 42,
    COLD_C: 2,
    EXTREME_COLD_C: -5,
    WIND_KMH: 40,
    STORM_WIND_KMH: 60,
    DUST_PM10: 150,
    SEVERE_DUST_PM10: 300,
    RAIN_PROB: 70,
    HEAVY_RAIN_MM: 15,
    FOG_VISIBILITY_M: 1000,
    UV_HIGH: 8
  }
};

// محدوده جغرافیایی تقریبی استان خراسان جنوبی (برای نقشه و تصاویر ماهواره‌ای)
const PROVINCE_BBOX = { west: 56.4, south: 30.9, east: 61.3, north: 34.7 };
const PROVINCE_CENTER = [32.9, 59.3];

// شاخص کیفیت هوای رسمی OpenWeather (مقیاس ۱ تا ۵: خوب تا بسیار ناسالم)
const AQI_COLORS = [
  { max: 1, color: "#2ecc71", label: "خوب",                         healthTip: "کیفیت هوا مطلوب است." },
  { max: 2, color: "#a3d900", label: "قابل قبول",                    healthTip: "برای اکثر افراد بی‌خطر است." },
  { max: 3, color: "#f1c40f", label: "متوسط",                        healthTip: "بیماران تنفسی و قلبی احتیاط کنند." },
  { max: 4, color: "#e67e22", label: "ناسالم",                       healthTip: "فعالیت بیرون از منزل را کاهش دهید." },
  { max: 5, color: "#e74c3c", label: "بسیار ناسالم",                  healthTip: "از فعالیت طولانی در فضای باز خودداری کنید و در صورت امکان ماسک بزنید." }
];

function getAqiInfo(aqi) {
  if (aqi == null || isNaN(aqi)) return { color: "#7f8c8d", label: "نامشخص", healthTip: "داده‌ای موجود نیست." };
  return AQI_COLORS.find(b => aqi <= b.max) || AQI_COLORS[AQI_COLORS.length - 1];
}
