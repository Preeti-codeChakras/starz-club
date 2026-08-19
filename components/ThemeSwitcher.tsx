"use client";

import { useEffect, useRef, useState } from "react";

type Theme =
  | "starz"
  | "dark"
  | "pride"
  | "champions";

const themes: {
  value: Theme;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    value: "starz",
    label: "Starz Blue",
    icon: "⭐",
    description: "Classic",
  },
  {
    value: "dark",
    label: "Dark",
    icon: "🌙",
    description: "Low light",
  },
  {
    value: "pride",
    label: "Pride",
    icon: "🌈",
    description: "Celebrate",
  },
  {
    value: "champions",
    label: "Champions",
    icon: "🏆",
    description: "Victory",
  },
];

export default function ThemeSwitcher() {
  const [theme, setTheme] =
    useState<Theme>("starz");

  const [open, setOpen] =
    useState(false);

  const menuRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTheme =
      localStorage.getItem(
        "starz-theme"
      ) as Theme | null;

    const validTheme =
      themes.some(
        (item) =>
          item.value === savedTheme
      );

    const initialTheme: Theme =
      savedTheme && validTheme
        ? savedTheme
        : "starz";

    setTheme(initialTheme);

    document.documentElement.setAttribute(
      "data-theme",
      initialTheme
    );
  }, []);

  useEffect(() => {
    function handleClickOutside(
      event: MouseEvent
    ) {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener(
        "mousedown",
        handleClickOutside
      );
    }

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, [open]);

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

    setOpen(false);
  }

  const activeTheme =
    themes.find(
      (item) =>
        item.value === theme
    );

  function getThemePreview(
    value: Theme
  ) {
    switch (value) {
      case "dark":
        return "bg-slate-900 text-white hover:bg-slate-800";

      case "pride":
        return "bg-gradient-to-r from-rose-50 via-amber-50 via-emerald-50 to-violet-50 text-slate-800 hover:brightness-[0.98]";

      case "champions":
        return "bg-gradient-to-r from-amber-50 to-yellow-100 text-slate-800 hover:brightness-[0.98]";

      default:
        return "bg-blue-50 text-slate-800 hover:bg-blue-100";
    }
  }

  return (
    <div
      ref={menuRef}
      className="relative"
    >
      {/* MAIN BUTTON */}

      <button
        type="button"
        onClick={() =>
          setOpen(
            (current) =>
              !current
          )
        }
        className="
          flex
          items-center
          gap-2
          rounded-full
          border
          border-white/30
          bg-gradient-to-r
          from-indigo-600
          via-violet-600
          to-fuchsia-500
          px-3.5
          py-2
          text-sm
          font-semibold
          text-white
          shadow-md
          transition
          hover:scale-[1.02]
          hover:shadow-lg
          active:scale-95
        "
        aria-label="Change theme"
        aria-expanded={open}
      >
        <span>
          🎨
        </span>

        <span>
          Theme
        </span>

        <span className="text-xs opacity-90">
          {activeTheme?.icon}
        </span>
      </button>

      {/* DROPDOWN */}

      {open && (
        <div
          className="
            absolute
            left-0
            top-12
            z-[100]
            w-56
            rounded-xl
            border
            border-slate-200/80
            bg-white/95
            p-2
            shadow-xl
            backdrop-blur-md
          "
        >
          <div className="px-2 pb-2 pt-1">
            <p className="text-sm font-semibold text-slate-900">
              ✨ Pick a look
            </p>

            <p className="mt-0.5 text-[11px] text-slate-500">
              Choose your app style
            </p>
          </div>

          <div className="space-y-1">
            {themes.map(
              (item) => {
                const isActive =
                  theme ===
                  item.value;

                return (
                  <button
                    key={
                      item.value
                    }
                    type="button"
                    onClick={() =>
                      changeTheme(
                        item.value
                      )
                    }
                    className={`
                      flex
                      w-full
                      items-center
                      gap-2.5
                      rounded-lg
                      px-2.5
                      py-2
                      text-left
                      transition
                      ${getThemePreview(
                        item.value
                      )}
                      ${
                        isActive
                          ? "ring-1 ring-blue-400"
                          : ""
                      }
                    `}
                  >
                    <span className="text-base">
                      {item.icon}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">
                        {item.label}
                      </div>

                      <div
                        className={`
                          text-[10px]
                          ${
                            item.value === "dark"
                              ? "text-slate-300"
                              : "text-slate-500"
                          }
                        `}
                      >
                        {
                          item.description
                        }
                      </div>
                    </div>

                    {isActive && (
                      <span className="text-xs font-bold text-blue-600">
                        ✓
                      </span>
                    )}
                  </button>
                );
              }
            )}
          </div>
        </div>
      )}
    </div>
  );
}
