"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type ChatAlert = { id: string; sender: string; text: string };
const ALERT_KEY = "starz-chat-alerts";
const ALERT_EVENT = "starz-chat-alerts-changed";

export default function StarzChatNotifications() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const [alert, setAlert] = useState<ChatAlert | null>(null);
  const [enabled, setEnabled] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  useEffect(() => {
    const sync = () => setEnabled(localStorage.getItem(ALERT_KEY) === "true");
    sync();
    window.addEventListener(ALERT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ALERT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => () => { void audioRef.current?.close(); }, []);

  function playAlert() {
    try {
      const AudioContextClass = window.AudioContext;
      if (!AudioContextClass) return;
      const ctx = audioRef.current ?? new AudioContextClass();
      audioRef.current = ctx;
      if (ctx.state === "suspended") void ctx.resume();
      const start = ctx.currentTime + 0.02;
      [660, 880].forEach((frequency, index) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const time = start + index * 0.13;
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(0.08, time + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(time);
        oscillator.stop(time + 0.13);
      });
    } catch { /* Browser may block audio playback. */ }
  }

  useEffect(() => {
    if (!enabled) { setAlert(null); return; }
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function subscribe() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || cancelled) return;
      const { data: profile } = await supabase.from("profiles")
        .select("member_id").eq("id", auth.user.id).maybeSingle();
      if (!profile?.member_id || cancelled) return;
      const { data: member } = await supabase.from("members")
        .select("club_id,approval_status").eq("id", profile.member_id).maybeSingle();
      if (!member?.club_id || String(member.approval_status).toLowerCase() !== "active" || cancelled) return;
      const userId = auth.user.id;

      function notify(message: { id: string; sender_user_id: string; sender_name: string; body: string }) {
        if (message.sender_user_id === userId || pathnameRef.current === "/club-chat") return;
        setAlert({ id: message.id, sender: message.sender_name, text: message.body });
        playAlert();
        if (typeof navigator.vibrate === "function" &&
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          navigator.vibrate([120, 80, 120]);
        }
      }

      channel = supabase.channel(`starz-global-alerts-${userId}`)
        .on("postgres_changes", {
          event: "INSERT", schema: "public", table: "club_chat_messages",
          filter: `club_id=eq.${member.club_id}`,
        }, payload => {
          const message = payload.new as {
            id: string; sender_user_id: string; sender_name: string; body: string; kind?: string;
          };
          if (message.kind !== "buzz") notify(message);
        }).subscribe();
    }
    void subscribe();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [enabled]);

  return alert ? (
    <div role="status" className="fixed right-4 top-20 z-[100] w-[min(90vw,350px)] rounded-xl border border-blue-200 bg-white p-4 text-slate-900 shadow-xl">
      <p className="font-bold">💬 {alert.sender}</p>
      <p className="mt-1 line-clamp-2 text-sm">{alert.text}</p>
      <div className="mt-3 flex justify-end gap-3">
        <button type="button" onClick={() => setAlert(null)} className="text-sm text-slate-500">Dismiss</button>
        <Link href="/club-chat" onClick={() => setAlert(null)} className="text-sm font-bold text-blue-700">Open Chat</Link>
      </div>
    </div>
  ) : null;
}
