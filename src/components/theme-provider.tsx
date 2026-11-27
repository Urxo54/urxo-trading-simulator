"use client";

import { useEffect } from "react";

export type Theme = "dark" | "light";
export const THEME_STORAGE_KEY = "urxo-theme";

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    document.documentElement.dataset.theme = saved === "light" ? "light" : "dark";
  }, []);
  return children;
}
