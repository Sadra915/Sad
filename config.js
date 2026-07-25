/**
 * config.js
 * شهرها، تنظیمات کلی، endpointها و آستانه‌های هشدار.
 * این فایل باید همیشه قبل از تمام ماژول‌های دیگر بارگذاری شود.
 *
 * منبع داده هواشناسی/کیفیت هوا: Open-Meteo (رایگان، بدون نیاز به کلید یا اشتراک)
 */
const CONFIG = {
  OPEN_METEO_FORECAST: "https://api.open-meteo.com/v1/forecast",
  OPEN_METEO_AIR_QUALITY: "https://air-quality-api.open-meteo.com/v1/air-quality",

  RAINVIEWER_INDEX: "https://api.rainviewer.com/public/weather-maps.json",
  OPENTOPOMAP: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  ESRI_IMAGERY: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  GIBS_WMTS: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best",
  GIBS_SNAPSHOT: "https://wvs.earthdata.nasa.gov/api/v1/snapshot",

  TIMEZONE: "Asia/Tehran",

  LS_LAST_CITY: "owj_last_city",
  LS_THEME: "owj_theme",
  LS_UNIT: "owj_unit",
  LS_CACHE_PREFIX: "owj_cache_",

  DEFAULT_CITY: "birjand",

  THRESHOLDS: {
    EXTREME_HEAT_C: 40,
    HEAT_C: 35,
    EXTREME_COLD_C: -10,
    COLD_C: 0,
    STORM_WIND_KMH: 70,
    WIND_KMH: 45,
    SEVERE_DUST_PM10: 350,
    DUST_PM10: 150,
    HEAVY_RAIN_MM: 20,
    RAIN_PROB: 70,
    FOG_VISIBILITY_M: 1000,
  },
};

const CITIES = [
  { id: "birjand",   name: "بیرجند",   lat: 32.8663, lon: 59.2211, isCapital: true },
  { id: "qayen",     name: "قائن",     lat: 33.7267, lon: 59.1804 },
  { id: "ferdows",   name: "فردوس",    lat: 34.0141, lon: 58.1706 },
  { id: "tabas",     name: "طبس",      lat: 33.5959, lon: 56.9247 },
  { id: "nehbandan", name: "نهبندان",  lat: 31.5350, lon: 60.0311 },
  { id: "sarbisheh", name: "سربیشه",   lat: 32.5766, lon: 59.7793 },
  { id: "boshrooyeh",name: "بشرویه",   lat: 33.8577, lon: 57.4302 },
  { id: "khusf",     name: "خوسف",     lat: 32.7614, lon: 58.8977 },
  { id: "sarayan",   name: "سرایان",   lat: 33.8593, lon: 58.5236 },
  { id: "zirkuh",    name: "زیرکوه",   lat: 33.1725, lon: 59.9027 },
];

const PROVINCE_CENTER = [32.9, 58.9];
const PROVINCE_BBOX = { north: 34.6, south: 30.9, east: 61.3, west: 56.6 };

const AQI_INFO = {
  1: { label: "خوب",            color: "#2ecc71", healthTip: "کیفیت هوا مطلوب است؛ محدودیتی برای فعالیت در فضای باز وجود ندارد." },
  2: { label: "قابل قبول",       color: "#a3d900", healthTip: "کیفیت هوا قابل قبول است؛ افراد بسیار حساس احتیاط جزئی داشته باشند." },
  3: { label: "متوسط",           color: "#f1c40f", healthTip: "افراد حساس (تنفسی/قلبی) فعالیت شدید طولانی در بیرون را محدود کنند." },
  4: { label: "ناسالم",          color: "#e67e22", healthTip: "عموم مردم فعالیت سنگین بیرون از منزل را کاهش دهند." },
  5: { label: "بسیار ناسالم",    color: "#e74c3c", healthTip: "از خروج غیرضروری خودداری شود؛ در صورت امکان از ماسک استفاده کنید." },
};

function getAqiInfo(aqi) {
  return AQI_INFO[aqi] || { label: "—", color: "#7f8c8d", healthTip: "" };
}