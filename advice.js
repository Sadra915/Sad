/**
 * advice.js
 * تولید پیشنهادهای عملی بر اساس داده‌های واقعی دریافتی (نه داده جعلی).
 * این توصیه‌ها منطق قانون‌محور ساده روی داده واقعی هستند، نه یک سرویس API مجزا.
 */

const OwjAdvice = (() => {

  function clothing(temp, wind, precip) {
    if (temp <= 0) return "پوشش زمستانی کامل: کاپشن ضخیم، کلاه و دستکش";
    if (temp <= 10) return "کاپشن یا پالتوی گرم به همراه شال گردن";
    if (temp <= 18) return "ژاکت یا سویشرت مناسب هوای خنک";
    if (temp <= 28) return "پوشش سبک و راحت، ترجیحاً نخی";
    if (temp <= 36) return "لباس بسیار سبک و روشن‌رنگ، کلاه آفتابی";
    return "پوشش بسیار سبک، اجتناب از رنگ‌های تیره، محافظت در برابر آفتاب";
  }

  function activity(temp, uv, windGust, weatherCode) {
    if ([95, 96, 99].includes(weatherCode)) return "فعالیت در فضای باز توصیه نمی‌شود (رعدوبرق)";
    if (windGust >= 50) return "از فعالیت‌های بیرون از منزل به دلیل وزش شدید باد پرهیز کنید";
    if (temp >= 38) return "فعالیت بدنی سنگین را به ساعات خنک روز (صبح زود یا شب) موکول کنید";
    if (uv >= 8) return "در صورت فعالیت بیرون، از کرم ضدآفتاب و عینک استفاده کنید";
    if (temp >= 15 && temp <= 28 && windGust < 30) return "شرایط مناسبی برای پیاده‌روی و فعالیت در فضای باز است";
    return "فعالیت در فضای باز با احتیاط معمول امکان‌پذیر است";
  }

  function driving(windGust, visibility, weatherCode, rainProb) {
    if (visibility != null && visibility < 1000) return "دید افقی پایین است؛ سرعت را کاهش داده و چراغ مه‌شکن روشن کنید";
    if (windGust >= 60) return "وزش بسیار شدید باد؛ در جاده‌های باز و برای خودروهای سبک خطرناک است";
    if ([61,63,65,80,81,82].includes(weatherCode)) return "بارندگی در حال وقوع است؛ فاصله ایمنی را افزایش دهید";
    if ([71,73,75,85,86].includes(weatherCode)) return "احتمال لغزندگی جاده به دلیل برف؛ با احتیاط رانندگی کنید";
    if (rainProb >= 60) return "احتمال بارش بالاست؛ آماده شرایط جاده لغزنده باشید";
    return "شرایط جاده عادی است؛ رانندگی با احتیاط استاندارد";
  }

  function farming(temp, precipSum, wind, minTemp) {
    if (minTemp <= 0) return "خطر یخبندان محصولات؛ در صورت امکان از پوشش محافظ استفاده کنید";
    if (precipSum >= 10) return "بارش قابل توجه پیش‌بینی می‌شود؛ آبیاری را متناسب تنظیم کنید";
    if (temp >= 38) return "تنش گرمایی برای محصولات محتمل است؛ آبیاری در ساعات خنک انجام شود";
    if (wind >= 40) return "وزش باد شدید ممکن است به گلدهی و شاخه‌های ضعیف آسیب برساند";
    return "شرایط جوی برای فعالیت‌های معمول کشاورزی مناسب است";
  }

  function respiratory(aqi, pm10, pm25) {
    const info = getAqiInfo(aqi);
    if (aqi >= 4) return `کیفیت هوا (${info.label}) - بیماران تنفسی و قلبی از خروج غیرضروری خودداری کنند`;
    if (aqi >= 3) return `کیفیت هوا (${info.label}) - افراد حساس فعالیت شدید بیرون از منزل را محدود کنند`;
    return `کیفیت هوا (${info.label}) - برای بیماران تنفسی مشکل خاصی ندارد`;
  }

  return { clothing, activity, driving, farming, respiratory };
})();
