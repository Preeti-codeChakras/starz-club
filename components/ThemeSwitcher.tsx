"use client";

import { useEffect, useState } from "react";

type Theme = "starz" | "dark" | "pride"| "champions";

const themes: {
  value: Theme;
  label: string;
  icon: string;
}[] = [
  {
    value: "starz",
    label: "Starz Blue",
    icon: "⭐",
  },
  {
    value: "dark",
    label: "Dark",
    icon: "🌙",
  },
  {
    value: "pride",
    label: "Pride",
    icon: "🌈",
  },
   {
    value: "champions",
    label: "Champions",
    icon: "🏆",
  },
];

export default function ThemeSwitcher() {
  const [theme, setTheme] =
    useState<Theme>("starz");

  useEffect(() => {
    const savedTheme =
      localStorage.getItem(
        "starz-theme"
      ) as Theme | null;

    const initialTheme =
      savedTheme || "starz";

    setTheme(initialTheme);

    document.documentElement.setAttribute(
      "data-theme",
      initialTheme
    );
  }, []);

  function changeTheme(
    newTheme: Theme
  ) {
    setTheme(newTheme);

    localStorage.setItem(
      "starz-theme",
      newTheme
    );

    document.documentElement.setAttribute(
      "data-theme",
      newTheme
    );
  }

  return (
    <div className="theme-switcher">
      {themes.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() =>
            changeTheme(item.value)
          }
          className={
            theme === item.value
              ? "theme-option theme-option-active"
              : "theme-option"
          }
          title={item.label}
        >
          <span>
            {item.icon}
          </span>

          <span className="hidden sm:inline">
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
}
