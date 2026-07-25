/**
 * dust.js
 * تحلیل ریسک گرد و غبار / طوفان شن
 * چون OpenWeather مقدار مستقیم "غلظت گردوغبار جوی" یا "احتمال طوفان شن"
 * ارائه نمی‌دهد، این ماژول با ترکیب وزن‌دار PM10، سرعت باد و دید افقی یک
 * شاخص ۰ تا ۱۰۰ تخمینی می‌سازد. این مقدار همیشه با برچسب «تخمینی» نمایش
 * داده می‌شود.
 */

const OwjDust = (() => {

  function computeRiskIndex(data) {
    if (!data || data.error || !data.airQuality?.current) return null;
    const aq = data.airQuality.current;
    const cur = data.forecast?.current || {};
    const vis = data.forecast?.hourly?.visibility?.[0];

    const pm10 = aq.pm10 ?? 0;
    const wind = cur.wind_speed_10m ?? 0;
    const gust = cur.wind_gusts_10m ?? wind;
    const visKm = vis != null ? vis / 1000 : 20;

    const pm10Score = Math.min(100, (pm10 / 400) * 100);
    const windScore = Math.min(100, (gust / 80) * 100);
    const visScore = Math.min(100, Math.max(0, (10 - visKm) / 10) * 100);

    // میانگین وزن‌دار: غلظت ذرات مهم‌ترین عامل است (بدون داده مستقل aerosol/dust)
    const index = Math.round(pm10Score * 0.5 + windScore * 0.3 + visScore * 0.2);

    let level, color;
    if (index < 20)      { level = "بسیار کم";  color = "#2ecc71"; }
    else if (index < 40) { level = "کم";         color = "#a3d900"; }
    else if (index < 60) { level = "متوسط";      color = "#f1c40f"; }
    else if (index < 80) { level = "زیاد";       color = "#e67e22"; }
    else                 { level = "بسیار زیاد (احتمال طوفان شن)"; color = "#e74c3c"; }

    return {
      index, level, color,
      components: { pm10, wind: gust, visibilityKm: visKm },
      estimated: true
    };
  }

  return { computeRiskIndex };
})();
