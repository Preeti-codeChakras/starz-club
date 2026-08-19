"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

type Theme =
  | "starz"
  | "dark"
  | "pride"
  | "champions"
  | "onam";

type ThemeOption = {
  value: Theme;
  label: string;
  icon: string;
  description: string;
};

const mainThemes: ThemeOption[] = [
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

const eventThemes: ThemeOption[] = [
  {
    value: "onam",
    label: "Onam",
    icon: "🌼",
    description: "Kerala festival",
  },
];

const allThemes = [
  ...mainThemes,
  ...eventThemes,
];

export default function ThemeSwitcher() {
  const [theme, setTheme] =
    useState<Theme>("starz");

  const [open, setOpen] =
    useState(false);

  const [eventsOpen, setEventsOpen] =
    useState(false);

  const menuRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTheme =
      localStorage.getItem(
        "starz-theme"
      ) as Theme | null;

    const validTheme =
      allThemes.some(
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
    function handleOutsideClick(
      event: MouseEvent
    ) {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
        setEventsOpen(false);
      }
    }

    if (open) {
      document.addEventListener(
        "mousedown",
        handleOutsideClick
      );
    }

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
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
    setEventsOpen(false);
  }

  const activeTheme =
    allThemes.find(
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
        return "bg-gradient-to-r from-rose-50 via-amber-50 to-violet-50 text-slate-800";

      case "champions":
        return "bg-gradient-to-r from-amber-50 to-yellow-100 text-slate-800";

      case "onam":
        return "bg-gradient-to-r from-amber-50 via-yellow-50 to-emerald-50 text-slate-800";

      default:
        return "bg-blue-50 text-slate-800 hover:bg-blue-100";
    }
  }

  function renderThemeOption(
    item: ThemeOption
  ) {
    const isActive =
      item.value === theme;

    return (
      <button
        key={item.value}
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
            className={
              item.value === "dark"
                ? "text-[10px] text-slate-300"
                : "text-[10px] text-slate-500"
            }
          >
            {item.description}
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

  return (
    <div
      ref={menuRef}
      className="relative shrink-0"
    >
      <button
        type="button"
        onClick={() =>
          setOpen(
            (current) =>
              !current
          )
        }
        aria-label="Change app theme"
        aria-expanded={open}
        title="Change Theme"
        className="
          flex
          h-[58px]
          items-center
          gap-1.5
          rounded-xl
          border
          border-white/20
          bg-white/10
          px-3
          text-white
          shadow-sm
          backdrop-blur-sm
          transition
          hover:bg-white/20
          active:scale-95
        "
      >
        <span className="text-lg">
          🎨
        </span>

        <div className="text-left">
          <div className="text-xs font-semibold">
            Theme
          </div>

          <div className="text-[10px] text-blue-100">
            {activeTheme?.icon}{" "}
            {activeTheme?.label}
          </div>
        </div>

        <span className="ml-0.5 text-[9px] text-blue-100">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div
          className="
            absolute
            right-0
            top-[66px]
            z-[100]
            w-56
            rounded-xl
            border
            border-slate-200/80
            bg-white/95
            p-2
            shadow-2xl
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
            {mainThemes.map(
              renderThemeOption
            )}

            <button
              type="button"
              onClick={() =>
                setEventsOpen(
                  (current) =>
                    !current
                )
              }
              className="
                flex
                w-full
                items-center
                gap-2.5
                rounded-lg
                bg-gradient-to-r
                from-orange-50
                to-yellow-50
                px-2.5
                py-2
                text-left
                text-slate-800
                transition
                hover:brightness-[0.98]
              "
            >
              <span className="text-base">
                🎉
              </span>

              <div className="flex-1">
                <div className="text-sm font-medium">
                  Events
                </div>

                <div className="text-[10px] text-slate-500">
                  Seasonal themes
                </div>
              </div>

              <span className="text-xs text-slate-500">
                {eventsOpen
                  ? "▲"
                  : "▼"}
              </span>
            </button>

            {eventsOpen && (
              <div className="ml-3 space-y-1 border-l border-amber-200 pl-2">
                {eventThemes.map(
                  renderThemeOption
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
