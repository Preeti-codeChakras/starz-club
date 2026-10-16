"use client";

import { useEffect, useRef, useState } from "react";

type Theme = "starz" | "dark" | "pride" | "champions" | "onam";
type ThemeOption = { value: Theme; label: string; icon: string; description: string };

const mainThemes: ThemeOption[] = [
  { value: "starz", label: "Starz Blue", icon: "⭐", description: "Classic" },
  { value: "dark", label: "Dark", icon: "🌙", description: "Low light" },
  { value: "pride", label: "Pride", icon: "🌈", description: "Celebrate" },
  { value: "champions", label: "Champions", icon: "🏆", description: "Victory" },
];
const eventThemes: ThemeOption[] = [
  { value: "onam", label: "Onam", icon: "🌼", description: "Kerala festival" },
];
const allThemes = [...mainThemes, ...eventThemes];

function PaletteIcon() {
  return (
    <svg className="h-[17px] w-[17px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="13.5" cy="6.5" r="1" /><circle cx="17.5" cy="10.5" r="1" />
      <circle cx="8" cy="7.5" r="1" /><circle cx="6.5" cy="12.5" r="1" />
      <path d="M12 3a9 9 0 1 0 9 9c0-1.5-1.1-2.5-2.5-2.5H16a2 2 0 0 0-2 2c0 1.2.9 1.9.9 3.1 0 1.4-1.2 2.4-2.9 2.4" />
    </svg>
  );
}

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>("starz");
  const [open, setOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("starz-theme") as Theme | null;
    const initial: Theme = saved && allThemes.some(t => t.value === saved) ? saved : "starz";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
        setEventsOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  function changeTheme(next: Theme) {
    setTheme(next);
    localStorage.setItem("starz-theme", next);
    document.documentElement.setAttribute("data-theme", next);
    setOpen(false);
    setEventsOpen(false);
  }

  function getThemePreview(value: Theme) {
    switch (value) {
      case "dark": return "bg-slate-900 text-white hover:bg-slate-800";
      case "pride": return "bg-gradient-to-r from-rose-50 via-amber-50 to-violet-50 text-slate-800";
      case "champions": return "bg-gradient-to-r from-amber-50 to-yellow-100 text-slate-800";
      case "onam": return "bg-gradient-to-r from-amber-50 via-yellow-50 to-emerald-50 text-slate-800";
      default: return "bg-blue-50 text-slate-800 hover:bg-blue-100";
    }
  }

  function renderThemeOption(item: ThemeOption) {
    const selected = item.value === theme;
    return (
      <button key={item.value} type="button" onClick={() => changeTheme(item.value)}
        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${getThemePreview(item.value)} ${selected ? "ring-1 ring-blue-400" : ""}`}>
        <span className="text-base">{item.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{item.label}</div>
          <div className={item.value === "dark" ? "text-[10px] text-slate-300" : "text-[10px] text-slate-500"}>{item.description}</div>
        </div>
        {selected && <span className="text-xs font-bold text-blue-600">✓</span>}
      </button>
    );
  }

  return (
    <div ref={menuRef} className="relative w-full min-w-0 sm:w-auto sm:shrink-0">
      <button type="button" onClick={() => setOpen(v => !v)} aria-label="Change app theme"
        aria-expanded={open} title="Change Theme"
        className="flex h-10 w-full min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-white/20 bg-white/10 px-1.5 text-xs font-semibold text-white shadow-sm backdrop-blur-sm transition hover:bg-white/20 active:scale-95 sm:h-[58px] sm:w-auto sm:gap-1.5 sm:rounded-xl sm:px-3">
        <span className="sm:hidden"><PaletteIcon /></span>
        <span className="hidden text-lg sm:inline">🎨</span>
        <span className="sm:hidden">Theme</span>
        <span className="hidden text-left sm:block">
          <span className="block text-xs font-semibold">Theme</span>
          <span className="block text-[10px] text-blue-100">{allThemes.find(t => t.value === theme)?.icon} {allThemes.find(t => t.value === theme)?.label}</span>
        </span>
        <span className="hidden text-[9px] text-blue-100 sm:inline">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-[100] w-56 max-w-[calc(100vw-24px)] rounded-xl border border-slate-200/80 bg-white/95 p-2 shadow-2xl backdrop-blur-md sm:top-[66px]">
          <div className="px-2 pb-2 pt-1">
            <p className="text-sm font-semibold text-slate-900">✨ Pick a look</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Choose your app style</p>
          </div>
          <div className="space-y-1">
            {mainThemes.map(renderThemeOption)}
            <button type="button" onClick={() => setEventsOpen(v => !v)}
              className="flex w-full items-center gap-2.5 rounded-lg bg-gradient-to-r from-orange-50 to-yellow-50 px-2.5 py-2 text-left text-slate-800 transition hover:brightness-[0.98]">
              <span className="text-base">🎉</span>
              <div className="flex-1">
                <div className="text-sm font-medium">Events</div>
                <div className="text-[10px] text-slate-500">Seasonal themes</div>
              </div>
              <span className="text-xs text-slate-500">{eventsOpen ? "▲" : "▼"}</span>
            </button>
            {eventsOpen && <div className="ml-3 space-y-1 border-l border-amber-200 pl-2">{eventThemes.map(renderThemeOption)}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
