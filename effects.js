/**
 * effects.js
 * افکت‌های تصویری پویا: شب/روز (بر اساس طلوع و غروب واقعی شهر انتخابی)،
 * ستاره‌ها، ابرهای متحرک، باران، برف، مه و رعدوبرق — همه بر اساس
 * weather_code و is_day واقعیِ دریافتی از API، نه تصادفی/جعلی.
 * پیاده‌سازی با یک canvas سبک (بدون کتابخانه خارجی) برای کارایی بالا.
 */

const OwjEffects = (() => {
  const canvas = () => document.getElementById("fxCanvas");
  let ctx, raf, w, h, particles = [], mode = "clear", isDay = true;
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  function resize() {
    const c = canvas();
    if (!c) return;
    w = c.width = c.clientWidth * devicePixelRatio;
    h = c.height = c.clientHeight * devicePixelRatio;
  }
  window.addEventListener("resize", resize);

  function setSkyState(weatherCode, dayFlag) {
    isDay = dayFlag;
    document.body.classList.toggle("is-day", isDay);
    document.body.classList.toggle("is-night", !isDay);

    const info = getWeatherInfo(weatherCode);
    let newMode = "clear";
    if ([45, 48].includes(weatherCode)) newMode = "fog";
    else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) newMode = "rain";
    else if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) newMode = "snow";
    else if ([95, 96, 99].includes(weatherCode)) newMode = "storm";
    else if ([1, 2, 3].includes(weatherCode)) newMode = "cloudy";
    else newMode = "clear";

    document.body.setAttribute("data-sky", newMode);
    document.body.setAttribute("data-weather-icon", info.icon);
    mode = newMode;
    buildParticles();
  }

  function buildParticles() {
    if (!ctx) return;
    particles = [];
    const count = prefersReducedMotion ? 0 : { rain: 110, snow: 70, fog: 6, storm: 90, clear: isDay ? 0 : 60, cloudy: 0 }[mode] ?? 0;
    for (let i = 0; i < count; i++) {
      if (mode === "rain" || mode === "storm") {
        particles.push({ x: Math.random() * w, y: Math.random() * h, len: 14 + Math.random() * 18, speed: 9 + Math.random() * 8, drift: -2 });
      } else if (mode === "snow") {
        particles.push({ x: Math.random() * w, y: Math.random() * h, r: 1.5 + Math.random() * 2.5, speed: 0.6 + Math.random() * 1.2, drift: Math.random() * 1 - 0.5, sway: Math.random() * Math.PI * 2 });
      } else if (mode === "fog") {
        particles.push({ x: Math.random() * w, y: (h / 6) * i, wpx: 220 + Math.random() * 260, speed: 0.15 + Math.random() * 0.2, alpha: 0.05 + Math.random() * 0.06 });
      } else if (mode === "clear" && !isDay) {
        particles.push({ x: Math.random() * w, y: Math.random() * h * 0.7, r: Math.random() * 1.6, tw: Math.random() * Math.PI * 2 });
      }
    }
  }

  let lastBolt = 0;
  function draw(ts) {
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    if (mode === "rain" || mode === "storm") {
      ctx.strokeStyle = "rgba(180,210,255,.55)";
      ctx.lineWidth = 1.4 * devicePixelRatio;
      particles.forEach(p => {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.drift, p.y + p.len);
        ctx.stroke();
        p.y += p.speed * devicePixelRatio;
        p.x += p.drift;
        if (p.y > h) { p.y = -20; p.x = Math.random() * w; }
      });
      if (mode === "storm" && ts - lastBolt > (2500 + Math.random() * 4000)) {
        lastBolt = ts;
        flashBolt();
      }
    } else if (mode === "snow") {
      ctx.fillStyle = "rgba(255,255,255,.85)";
      particles.forEach(p => {
        p.sway += 0.02;
        ctx.beginPath();
        ctx.arc(p.x + Math.sin(p.sway) * 8, p.y, p.r * devicePixelRatio, 0, 7);
        ctx.fill();
        p.y += p.speed * devicePixelRatio;
        if (p.y > h) { p.y = -10; p.x = Math.random() * w; }
      });
    } else if (mode === "fog") {
      particles.forEach(p => {
        const grad = ctx.createLinearGradient(p.x, 0, p.x + p.wpx * devicePixelRatio, 0);
        grad.addColorStop(0, `rgba(200,210,220,0)`);
        grad.addColorStop(0.5, `rgba(200,210,220,${p.alpha})`);
        grad.addColorStop(1, `rgba(200,210,220,0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(p.x, p.y % h, p.wpx * devicePixelRatio, 40 * devicePixelRatio);
        p.x += p.speed * devicePixelRatio;
        if (p.x > w) p.x = -p.wpx * devicePixelRatio;
      });
    } else if (mode === "clear" && !isDay) {
      ctx.fillStyle = "#fff";
      particles.forEach(p => {
        p.tw += 0.03;
        const a = 0.4 + Math.sin(p.tw) * 0.4;
        ctx.globalAlpha = Math.max(0.1, a);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * devicePixelRatio, 0, 7);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    raf = requestAnimationFrame(draw);
  }

  function flashBolt() {
    const flash = document.getElementById("fxFlash");
    if (!flash) return;
    flash.style.opacity = "0.85";
    setTimeout(() => (flash.style.opacity = "0"), 120);
    setTimeout(() => (flash.style.opacity = "0.5"), 260);
    setTimeout(() => (flash.style.opacity = "0"), 340);
  }

  function init() {
    const c = canvas();
    if (!c) return;
    ctx = c.getContext("2d");
    resize();
    buildParticles();
    if (!prefersReducedMotion) raf = requestAnimationFrame(draw);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
  }

  return { init, setSkyState, stop };
})();
