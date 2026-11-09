"use client";

import { useEffect, useState } from "react";

export const THEME_KEY = "2mt_theme";
type Theme = "light" | "dark";

// Choix du theme par le visiteur (clair par defaut), memorise sur l'appareil.
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  function choose(t: Theme) {
    setTheme(t);
    if (t === "dark") document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* stockage indisponible : le choix vaut pour cette visite */
    }
  }

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Thème">
      <button type="button" role="radio" aria-checked={theme === "light"} className={theme === "light" ? "on" : ""} onClick={() => choose("light")}>
        ☀️ Clair
      </button>
      <button type="button" role="radio" aria-checked={theme === "dark"} className={theme === "dark" ? "on" : ""} onClick={() => choose("dark")}>
        🌙 Sombre
      </button>
    </div>
  );
}
