import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [themeMode, setThemeMode] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
    // default: follow OS preference
    return "system";
  });

  const dark = themeMode === "dark" || (themeMode === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const setDark = (value) => {
    setThemeMode(value ? "dark" : "light");
  };

  useEffect(() => {
    localStorage.setItem("theme", themeMode);
    const root = window.document.documentElement;
    if (themeMode === "dark" || (themeMode === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [themeMode]);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      if (themeMode !== "system") return;
      const root = window.document.documentElement;
      if (media.matches) root.classList.add("dark");
      else root.classList.remove("dark");
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [themeMode]);

  return <ThemeContext.Provider value={{ dark, setDark, themeMode, setThemeMode }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
