"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const ALERT_KEY = "starz-chat-alerts";
const ALERT_EVENT = "starz-chat-alerts-changed";

type ChatAlert = {
  id: string;
  sender: string;
  text: string;
  buzz: boolean;
};
type ChatRow = {
  id: string;
  user_a: string;
  user_b: string;
};
type IncomingMessage = {
  id: string;
  sender_user_id: string;
  sender_name: string;
  body: string;
  chat_id?: string;
  kind?: string;
};
type IncomingEffect = {
  id: string;
  chat_id: string | null;
  sender_user_id: string;
  sender_name: string;
  effect: string;
};

export default function StarzChatNotifications() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const [alert, setAlert] = useState<ChatAlert | null>(null);
  // A saved explicit "false" is respected; otherwise alerts are on by default.
  const [enabled, setEnabled] = useState(true);
  const [settingsReady, setSettingsReady] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  useEffect(() => {
    const sync = () => {
      setEnabled(localStorage.getItem(ALERT_KEY) !== "false");
      setSettingsReady(true);
    };
    sync();
    window.addEventListener(ALERT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ALERT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => () => {
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    void audioRef.current?.close();
  }, []);

  const playAlert = useCallback((buzz: boolean) => {
    try {
      const Context = window.AudioContext;
      if (!Context) return;
      const ctx = audioRef.current ?? new Context();
      audioRef.current = ctx;
      if (ctx.state === "suspended") void ctx.resume();
      const start = ctx.currentTime + 0.02;
      const notes = buzz
        ? [{ hz: 185, at: 0, duration: 0.28 }, { hz: 120, at: 0.34, duration: 0.36 }]
        : [{ hz: 660, at: 0, duration: 0.12 }, { hz: 880, at: 0.13, duration: 0.12 }];
      for (const note of notes) {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const at = start + note.at;
        oscillator.type = buzz ? "sawtooth" : "sine";
        oscillator.frequency.setValueAtTime(note.hz, at);
        if (buzz) oscillator.frequency.exponentialRampToValueAtTime(75, at + note.duration);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(buzz ? 0.12 : 0.08, at + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + note.duration);
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start(at);
        oscillator.stop(at + note.duration + 0.01);
      }
    } catch {
      // Mobile browsers may prevent sound before a user gesture.
    }
  }, []);

  const notify = useCallback((item: ChatAlert) => {
    // Messenger already handles its own in-room effects and messages.
    if (pathnameRef.current === "/club-chat" || pathnameRef.current?.startsWith("/club-chat/")) return;
    setAlert(item);
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    alertTimerRef.current = setTimeout(() => setAlert(null), 12000);
    playAlert(item.buzz);
    try {
      if (typeof navigator.vibrate === "function" &&
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        navigator.vibrate(item.buzz ? [200, 100, 200, 100, 400] : [120, 80, 120]);
      }
    } catch { /* Vibration may not be supported. */ }
  }, [playAlert]);

  useEffect(() => {
    if (!settingsReady || !enabled) { setAlert(null); return; }
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let authSubscription: { unsubscribe: () => void } | null = null;
    let generation = 0;
    const seen = new Set<string>();
    const knownChats = new Set<string>();

    function once(key: string): boolean {
      if (seen.has(key)) return false;
      seen.add(key);
      if (seen.size > 300) seen.clear();
      return true;
    }

    async function start() {
      const currentGeneration = ++generation;
      if (channel) {
        const old = channel;
        channel = null;
        void supabase.removeChannel(old);
      }
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || cancelled || currentGeneration !== generation) return;
      const userId = auth.user.id;
      const { data: profile } = await supabase.from("profiles")
        .select("member_id").eq("id", userId).maybeSingle();
      if (!profile?.member_id || cancelled || currentGeneration !== generation) return;
      const { data: member } = await supabase.from("members")
        .select("club_id,approval_status").eq("id", profile.member_id).maybeSingle();
      if (!member?.club_id || String(member.approval_status).toLowerCase() !== "active" ||
          cancelled || currentGeneration !== generation) return;
      const clubId = member.club_id as string;

      // RLS should return only chats the signed-in user is permitted to see.
      const { data: chats, error: chatsError } = await supabase.from("starz_private_chats")
        .select("id,user_a,user_b").eq("club_id", clubId);
      if (cancelled || currentGeneration !== generation) return;
      knownChats.clear();
      if (!chatsError) {
        for (const chat of (chats ?? []) as ChatRow[]) {
          if (chat.user_a === userId || chat.user_b === userId) knownChats.add(chat.id);
        }
      }

      async function isMyChat(chatId: string): Promise<boolean> {
        if (knownChats.has(chatId)) return true;
        // Handles a private chat created after this page loaded. Do not display
        // private content unless membership is verified against the database.
        const { data, error } = await supabase.from("starz_private_chats")
          .select("id,user_a,user_b,club_id").eq("id", chatId).eq("club_id", clubId).maybeSingle();
        if (cancelled || currentGeneration !== generation || error || !data) return false;
        if (data.user_a !== userId && data.user_b !== userId) return false;
        knownChats.add(chatId);
        return true;
      }

      channel = supabase.channel(`starz-global-alerts-${userId}-${currentGeneration}`)
        .on("postgres_changes", {
          event: "INSERT", schema: "public", table: "club_chat_messages",
          filter: `club_id=eq.${clubId}`,
        }, payload => {
          const m = payload.new as IncomingMessage;
          if (m.sender_user_id === userId || m.kind === "buzz" || !once(`group:${m.id}`)) return;
          notify({ id: m.id, sender: m.sender_name, text: m.body, buzz: false });
        })
        .on("postgres_changes", {
          event: "INSERT", schema: "public", table: "starz_private_messages",
        }, payload => {
          const m = payload.new as IncomingMessage;
          if (!m.chat_id || m.sender_user_id === userId || !once(`private:${m.id}`)) return;
          void isMyChat(m.chat_id).then(allowed => {
            if (allowed && !cancelled && currentGeneration === generation) {
              notify({ id: m.id, sender: m.sender_name, text: m.body, buzz: false });
            }
          });
        })
        .on("postgres_changes", {
          event: "INSERT", schema: "public", table: "starz_chat_effects",
          filter: `club_id=eq.${clubId}`,
        }, payload => {
          const e = payload.new as IncomingEffect;
          if (e.effect !== "buzz" || e.sender_user_id === userId || !once(`effect:${e.id}`)) return;
          const show = () => notify({
            id: e.id, sender: e.sender_name,
            text: e.chat_id ? "⚡ Sent you a private BUZZ!" : "⚡ Sent a BUZZ to the club!",
            buzz: true,
          });
          if (!e.chat_id) { show(); return; }
          void isMyChat(e.chat_id).then(allowed => {
            if (allowed && !cancelled && currentGeneration === generation) show();
          });
        })
        .subscribe();
    }

    // Refresh subscriptions if the signed-in account changes.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        // Defer Supabase calls until the auth callback has returned.
        setTimeout(() => { if (!cancelled) void start(); }, 0);
      }
    });
    authSubscription = listener.subscription;
    void start();

    return () => {
      cancelled = true;
      generation++;
      authSubscription?.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [enabled, settingsReady, notify]);

  if (!alert) return null;
  return (
    <div role="status" className={`fixed right-4 top-20 z-[100] w-[min(90vw,350px)] rounded-xl border bg-white p-4 text-slate-900 shadow-xl ${alert.buzz ? "border-amber-400" : "border-blue-200"}`}>
      <p className="font-bold">{alert.buzz ? "⚡" : "💬"} {alert.sender}</p>
      <p className="mt-1 line-clamp-2 text-sm">{alert.text}</p>
      <div className="mt-3 flex justify-end gap-3">
        <button type="button" onClick={() => setAlert(null)} className="text-sm text-slate-500">Dismiss</button>
        <Link href="/club-chat" onClick={() => setAlert(null)} className="text-sm font-bold text-blue-700">Open Chat</Link>
      </div>
    </div>
  );
}
