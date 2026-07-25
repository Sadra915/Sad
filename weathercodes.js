/**
 * weathercodes.js
 * نگاشت کدهای استاندارد WMO به توضیح فارسی و آیکون SVG. کدهای شرایط جوی
 * OpenWeather (owCodeToWmo در پایین فایل) نیز به همین جدول تبدیل می‌شوند.
 */

const WEATHER_CODES = {
  0:  { text: "آسمان صاف", icon: "sun" },
  1:  { text: "عمدتاً صاف", icon: "sun-cloud" },
  2:  { text: "نیمه‌ابری", icon: "cloud-sun" },
  3:  { text: "ابری", icon: "cloud" },
  45: { text: "مه", icon: "fog" },
  48: { text: "مه یخ‌زده", icon: "fog" },
  51: { text: "نم‌نم باران سبک", icon: "drizzle" },
  53: { text: "نم‌نم باران متوسط", icon: "drizzle" },
  55: { text: "نم‌نم باران شدید", icon: "drizzle" },
  56: { text: "نم‌نم باران یخ‌زده سبک", icon: "drizzle" },
  57: { text: "نم‌نم باران یخ‌زده شدید", icon: "drizzle" },
  61: { text: "باران سبک", icon: "rain" },
  63: { text: "باران متوسط", icon: "rain" },
  65: { text: "باران شدید", icon: "rain" },
  66: { text: "باران یخ‌زده سبک", icon: "rain" },
  67: { text: "باران یخ‌زده شدید", icon: "rain" },
  71: { text: "برف سبک", icon: "snow" },
  73: { text: "برف متوسط", icon: "snow" },
  75: { text: "برف شدید", icon: "snow" },
  77: { text: "دانه‌های برف", icon: "snow" },
  80: { text: "رگبار سبک", icon: "rain" },
  81: { text: "رگبار متوسط", icon: "rain" },
  82: { text: "رگبار شدید", icon: "rain" },
  85: { text: "رگبار برف سبک", icon: "snow" },
  86: { text: "رگبار برف شدید", icon: "snow" },
  95: { text: "رعدوبرق", icon: "storm" },
  96: { text: "رعدوبرق با تگرگ سبک", icon: "storm" },
  99: { text: "رعدوبرق با تگرگ شدید", icon: "storm" }
};

function getWeatherInfo(code) {
  return WEATHER_CODES[code] || { text: "نامشخص", icon: "cloud" };
}

/**
 * نگاشت کد شرایط جوی OpenWeather (id گروه 2xx-8xx) به نزدیک‌ترین کد WMO
 * تا از همان جدول متن/آیکون بالا (WEATHER_CODES) بدون تغییر استفاده شود.
 */
function owCodeToWmo(owId, isDay = true) {
  if (owId >= 200 && owId <= 232) return owId === 202 || owId === 232 ? 99 : (owId === 212 ? 96 : 95);
  if (owId >= 300 && owId <= 321) return owId >= 313 ? 55 : (owId >= 310 ? 53 : 51);
  if (owId === 500) return 61;
  if (owId === 501) return 63;
  if (owId === 502 || owId === 503 || owId === 504) return 65;
  if (owId === 511) return 66;
  if (owId >= 520 && owId <= 531) return owId === 521 ? 81 : (owId === 522 ? 82 : 80);
  if (owId === 600 || owId === 601 || owId === 602) return owId === 602 ? 75 : (owId === 601 ? 73 : 71);
  if (owId >= 611 && owId <= 616) return 67;
  if (owId >= 620 && owId <= 622) return owId === 622 ? 86 : 85;
  if (owId === 701 || owId === 741) return 45;
  if (owId === 711 || owId === 721 || owId === 731 || owId === 751 || owId === 761 || owId === 762) return 45;
  if (owId === 771 || owId === 781) return 95;
  if (owId === 800) return 0;
  if (owId === 801) return isDay ? 1 : 1;
  if (owId === 802) return 2;
  if (owId === 803 || owId === 804) return 3;
  return 3;
}

/** آیکون‌های SVG سبک و انیمیشن‌دار (بدون فایل خارجی) */
const WEATHER_ICONS = {
  sun: `<svg viewBox="0 0 64 64" class="wicon wicon-sun"><circle cx="32" cy="32" r="14" class="sun-core"/><g class="sun-rays">
    <line x1="32" y1="4" x2="32" y2="14"/><line x1="32" y1="50" x2="32" y2="60"/>
    <line x1="4" y1="32" x2="14" y2="32"/><line x1="50" y1="32" x2="60" y2="32"/>
    <line x1="12" y1="12" x2="19" y2="19"/><line x1="45" y1="45" x2="52" y2="52"/>
    <line x1="52" y1="12" x2="45" y2="19"/><line x1="19" y1="45" x2="12" y2="52"/>
  </g></svg>`,
  "sun-cloud": `<svg viewBox="0 0 64 64" class="wicon wicon-suncloud"><circle cx="24" cy="24" r="10" class="sun-core"/>
    <path d="M14 46a12 12 0 0 1 2-23.8A16 16 0 0 1 46 30a10 10 0 0 1-2 16H14z" class="cloud-body"/></svg>`,
  "cloud-sun": `<svg viewBox="0 0 64 64" class="wicon wicon-suncloud"><circle cx="24" cy="22" r="9" class="sun-core"/>
    <path d="M12 48a12 12 0 0 1 3-23.6A16 16 0 0 1 47 31a10 10 0 0 1-2 17H12z" class="cloud-body"/></svg>`,
  cloud: `<svg viewBox="0 0 64 64" class="wicon wicon-cloud"><path d="M16 48a13 13 0 0 1 2.5-25.8A17 17 0 0 1 50 29a10.5 10.5 0 0 1-2 19H16z" class="cloud-body"/></svg>`,
  fog: `<svg viewBox="0 0 64 64" class="wicon wicon-fog"><g class="fog-lines">
    <line x1="10" y1="24" x2="54" y2="24"/><line x1="6" y1="34" x2="58" y2="34"/>
    <line x1="12" y1="44" x2="52" y2="44"/></g></svg>`,
  drizzle: `<svg viewBox="0 0 64 64" class="wicon wicon-rain"><path d="M16 34a12 12 0 0 1 2-23.8A16 16 0 0 1 48 16a9.5 9.5 0 0 1-2 18H16z" class="cloud-body"/>
    <g class="rain-drops light"><line x1="24" y1="46" x2="22" y2="54"/><line x1="34" y1="46" x2="32" y2="54"/><line x1="44" y1="46" x2="42" y2="54"/></g></svg>`,
  rain: `<svg viewBox="0 0 64 64" class="wicon wicon-rain"><path d="M16 32a12 12 0 0 1 2-23.8A16 16 0 0 1 48 14a9.5 9.5 0 0 1-2 18H16z" class="cloud-body"/>
    <g class="rain-drops"><line x1="20" y1="44" x2="17" y2="56"/><line x1="30" y1="44" x2="27" y2="56"/><line x1="40" y1="44" x2="37" y2="56"/><line x1="48" y1="44" x2="45" y2="56"/></g></svg>`,
  snow: `<svg viewBox="0 0 64 64" class="wicon wicon-snow"><path d="M16 32a12 12 0 0 1 2-23.8A16 16 0 0 1 48 14a9.5 9.5 0 0 1-2 18H16z" class="cloud-body"/>
    <g class="snow-flakes"><circle cx="20" cy="50" r="2"/><circle cx="32" cy="54" r="2"/><circle cx="44" cy="50" r="2"/></g></svg>`,
  storm: `<svg viewBox="0 0 64 64" class="wicon wicon-storm"><path d="M16 30a12 12 0 0 1 2-23.8A16 16 0 0 1 48 12a9.5 9.5 0 0 1-2 18H16z" class="cloud-body"/>
    <polygon points="34,40 24,54 32,54 28,62 42,46 33,46" class="bolt"/></svg>`,
  moon: `<svg viewBox="0 0 64 64" class="wicon wicon-moon"><path d="M40 8a24 24 0 1 0 16 40A20 20 0 0 1 40 8z" class="moon-body"/></svg>`
};

function weatherIconHtml(iconKey) {
  return WEATHER_ICONS[iconKey] || WEATHER_ICONS.cloud;
}
