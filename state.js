/**
 * state.js
 * مدیریت وضعیت سراسری برنامه + تنظیمات ماندگار در LocalStorage
 */

const OwjState = (() => {
  const state = {
    selectedCity: localStorage.getItem(CONFIG.LS_LAST_CITY) || CONFIG.DEFAULT_CITY,
    theme: localStorage.getItem(CONFIG.LS_THEME) || "dark",
    unit: localStorage.getItem(CONFIG.LS_UNIT) || "metric",
    allCityData: {},
    alerts: {},
    isOnline: navigator.onLine,
    lastUpdate: null,
    mapLayer: "temp"
  };

  function setSelectedCity(id) {
    state.selectedCity = id;
    localStorage.setItem(CONFIG.LS_LAST_CITY, id);
  }

  function setTheme(theme) {
    state.theme = theme;
    localStorage.setItem(CONFIG.LS_THEME, theme);
    document.documentElement.setAttribute("data-theme", theme);
  }

  function toggleTheme() {
    setTheme(state.theme === "dark" ? "light" : "dark");
  }

  function setUnit(unit) {
    state.unit = unit;
    localStorage.setItem(CONFIG.LS_UNIT, unit);
  }

  function getCity(id) {
    return CITIES.find(c => c.id === id);
  }

  return {
    state, setSelectedCity, setTheme, toggleTheme, setUnit, getCity
  };
})();
