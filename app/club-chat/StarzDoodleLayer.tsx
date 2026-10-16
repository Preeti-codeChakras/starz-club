"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { supabase } from "@/lib/supabase/client";

type Point = [number, number];
type Stroke = { id: string; user_id: string; color: string; width: number; points: Point[] };
type EventRow = {
  id: string;
  user_id: string;
  action: "stroke" | "clear" | "undo";
  color: string | null;
  width: number | null;
  points: Point[] | null;
  target_id: string | null;
  created_at: string;
};

const colors = ["#e11d48", "#2563eb", "#16a34a", "#eab308", "#111827", "#ffffff"];

function project(rows: EventRow[]): Stroke[] {
  const strokes: Stroke[] = [];
  for (const row of [...rows].sort((a, b) =>
    a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
  )) {
    if (row.action === "clear") {
      strokes.length = 0;
    } else if (row.action === "undo") {
      const index = strokes.findIndex((stroke) => stroke.id === row.target_id);
      if (index >= 0) strokes.splice(index, 1);
    } else if (row.points && row.color) {
      strokes.push({
        id: row.id,
        user_id: row.user_id,
        color: row.color,
        width: row.width ?? 4,
        points: row.points,
      });
    }
  }
  return strokes;
}

export default function StarzDoodleLayer({
  clubId,
  roomId,
  userId,
  enabled,
}: {
  clubId: string;
  roomId: string;
  userId: string;
  enabled: boolean;
}) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [color, setColor] = useState("#e11d48");
  const [width, setWidth] = useState(4);
  const [current, setCurrent] = useState<Point[]>([]);
  const [error, setError] = useState("");
  const [toolsOpen, setToolsOpen] = useState(false);
  const active = useRef(false);
  const draft = useRef<Point[]>([]);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const key = roomId === "group" ? "group" : roomId;

  const add = useCallback((row: EventRow) => {
    setEvents((previous) =>
      previous.some((event) => event.id === row.id) ? previous : [...previous, row]
    );
  }, []);

  useEffect(() => {
    if (!enabled) setToolsOpen(false);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !toolsOpen) return;

    function handleOutsidePointer(event: PointerEvent) {
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(event.target as Node)
      ) {
        setToolsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer);
  }, [enabled, toolsOpen]);

  useEffect(() => {
    let alive = true;
    setEvents([]);
    setCurrent([]);
    setError("");
    draft.current = [];
    active.current = false;

    void supabase
      .from("starz_doodle_events")
      .select("*")
      .eq("club_id", clubId)
      .eq("room_key", key)
      .order("created_at", { ascending: true })
      .limit(2000)
      .then(({ data, error: loadError }) => {
        if (!alive) return;
        if (loadError) {
          setError(loadError.message);
          return;
        }
        setEvents((previous) => {
          const merged = new Map<string, EventRow>();
          for (const row of [...(data ?? []), ...previous]) {
            const typedRow = row as EventRow;
            merged.set(typedRow.id, typedRow);
          }
          return [...merged.values()];
        });
      });

    const channel = supabase
      .channel(`starz-doodle-${clubId}-${key}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "starz_doodle_events",
          filter: `club_id=eq.${clubId}`,
        },
        (payload) => {
          const row = payload.new as EventRow & { room_key: string };
          if (row.room_key === key) add(row);
        }
      )
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [clubId, key, add]);

  async function save(
    action: "stroke" | "clear" | "undo",
    points?: Point[],
    targetId?: string
  ) {
    setError("");
    const { data, error: saveError } = await supabase
      .from("starz_doodle_events")
      .insert({
        club_id: clubId,
        room_key: key,
        user_id: userId,
        action,
        color: action === "stroke" ? color : null,
        width: action === "stroke" ? width : null,
        points: action === "stroke" ? points : null,
        target_id: targetId ?? null,
      })
      .select("*")
      .single();

    if (saveError) setError(saveError.message);
    else if (data) add(data as EventRow);
  }

  function getPoint(event: ReactPointerEvent<SVGSVGElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1000, Math.round(((event.clientX - rect.left) / rect.width) * 1000))),
      Math.max(0, Math.min(600, Math.round(((event.clientY - rect.top) / rect.height) * 600))),
    ];
  }

  function down(event: ReactPointerEvent<SVGSVGElement>) {
    if (!enabled) return;
    setToolsOpen(false);
    event.currentTarget.setPointerCapture(event.pointerId);
    active.current = true;
    draft.current = [getPoint(event)];
    setCurrent(draft.current);
  }

  function move(event: ReactPointerEvent<SVGSVGElement>) {
    if (!active.current) return;
    draft.current = [...draft.current, getPoint(event)];
    setCurrent(draft.current);
  }

  function up() {
    if (!active.current) return;
    active.current = false;
    const points = draft.current;
    draft.current = [];
    setCurrent([]);
    if (points.length) {
      void save("stroke", points.length === 1 ? [points[0], points[0]] : points);
    }
  }

  const strokes = project(events);
  const mine = [...strokes].reverse().find((stroke) => stroke.user_id === userId);

  return (
    <>
      <svg
        viewBox="0 0 1000 600"
        preserveAspectRatio="none"
        aria-label="Shared drawing canvas"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className={`absolute inset-0 z-[5] h-full w-full ${
          enabled ? "cursor-crosshair" : "pointer-events-none"
        }`}
        style={{ touchAction: enabled ? "none" : "auto" }}
      >
        {strokes.map((stroke) => (
          <polyline
            key={stroke.id}
            points={stroke.points.map((point) => point.join(",")).join(" ")}
            fill="none"
            stroke={stroke.color}
            strokeWidth={stroke.width * 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity=".58"
          />
        ))}
        {current.length > 0 && (
          <polyline
            points={current.map((point) => point.join(",")).join(" ")}
            fill="none"
            stroke={color}
            strokeWidth={width * 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity=".8"
          />
        )}
      </svg>

      {enabled && (
        toolsOpen ? (
          <div
            ref={toolbarRef}
            className="absolute bottom-3 left-3 right-3 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-800">✏️ Doodle tools</span>
              <button
                type="button"
                onClick={() => setToolsOpen(false)}
                aria-label="Minimize doodle tools"
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
              >
                Minimize −
              </button>
            </div>
            {colors.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={`Pen ${option}`}
                aria-pressed={color === option}
                onClick={() => setColor(option)}
                className={`h-7 w-7 rounded-full border-2 ${
                  color === option ? "border-slate-900" : "border-slate-300"
                }`}
                style={{ background: option }}
              />
            ))}
            <label className="flex items-center gap-2 text-xs text-slate-800">
              Pen
              <input
                aria-label="Pen width"
                type="range"
                min="2"
                max="14"
                value={width}
                onChange={(event) => setWidth(Number(event.target.value))}
              />
            </label>
            <button
              type="button"
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-800 disabled:opacity-50"
              disabled={!mine}
              onClick={() => mine && void save("undo", undefined, mine.id)}
            >
              ↶ Undo mine
            </button>
            <button
              type="button"
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-800"
              onClick={() => {
                if (window.confirm("Clear the drawing for everyone in this chat?")) {
                  void save("clear");
                }
              }}
            >
              Clear all
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setToolsOpen(true)}
            aria-label="Open doodle tools"
            title="Open doodle tools"
            className="absolute bottom-3 right-3 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-blue-900 text-xl text-white shadow-lg"
          >
            ✏️
          </button>
        )
      )}

      {error && (
        <div role="alert" className="absolute left-2 top-2 z-30 rounded bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}
    </>
  );
}
