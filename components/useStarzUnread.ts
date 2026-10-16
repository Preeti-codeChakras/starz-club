"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type CountRow = { room_id: string; unread_count: number };

export default function useStarzUnread() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc("starz_unread_counts");
    if (error) { console.warn("Unread counts unavailable:", error.message); return; }
    const next: Record<string, number> = {};
    for (const row of (data ?? []) as CountRow[]) next[row.room_id] = Number(row.unread_count) || 0;
    setCounts(next);
    setReady(true);
  }, []);
  const markRead = useCallback(async (roomId: string) => {
    const { error } = await supabase.rpc("starz_mark_chat_read", { p_room_id: roomId });
    if (error) { console.warn("Could not mark chat read:", error.message); return; }
    await refresh();
    window.dispatchEvent(new Event("starz-unread-changed"));
  }, [refresh]);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { if (alive) void refresh(); }, 150);
    };
    const onVisibility = () => { if (document.visibilityState === "visible") schedule(); };
    void refresh();
    const channel = supabase.channel(`starz-unread-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "club_chat_messages" }, schedule)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "starz_private_messages" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "starz_chat_read_status" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "starz_private_chat_visibility" }, schedule)
      .subscribe();
    window.addEventListener("focus", schedule);
    window.addEventListener("starz-unread-changed", schedule);
    document.addEventListener("visibilitychange", onVisibility);
    const interval = setInterval(() => { if (document.visibilityState === "visible") schedule(); }, 15000);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("focus", schedule);
      window.removeEventListener("starz-unread-changed", schedule);
      document.removeEventListener("visibilitychange", onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [refresh]);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return { counts, total, ready, refresh, markRead };
}
