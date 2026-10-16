"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import StarzDoodleLayer from "./StarzDoodleLayer";

type Member = { user_id: string; name: string; club_id: string };
type Message = { id: string; sender_user_id: string; sender_name: string; body: string; created_at: string; kind?: string };
type ChatVisibility = { chat_id: string; cleared_at: string; hidden: boolean };
type PrivateChat = { id: string; club_id: string; user_a: string; user_b: string; theme: string };
type Effect = { id: string; club_id: string; chat_id: string | null; sender_user_id: string; sender_name: string; effect: string; created_at: string };
type Theme = "classic" | "hearts" | "stars" | "rainbow" | "stadium";
const themes: Theme[] = ["classic", "hearts", "stars", "rainbow", "stadium"];
const effects = [{ id: "buzz", label: "⚡ BUZZ" }, { id: "hearts", label: "❤️ Hearts" }, { id: "punch", label: "🥊 POW" }, { id: "kiss", label: "💋 Kiss" }, { id: "confetti", label: "🎉 Confetti" }, { id: "cricket", label: "🏏 SIX!" }, { id: "four", label: "🏏 FOUR!" }, { id: "fireworks", label: "🎆 Fireworks" }, { id: "laugh", label: "😂 Laugh" }, { id: "clap", label: "👏 Clap" }];
const wallpapers: Record<Theme, string> = {
 classic: "bg-white", hearts: "bg-rose-50", stars: "bg-indigo-950", rainbow: "bg-gradient-to-br from-pink-100 via-sky-100 to-amber-100", stadium: "bg-gradient-to-b from-sky-100 via-green-100 to-emerald-300"
};
function messageOrder(a: Message, b: Message) { return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id); }
function labelForEffect(id: string) { return effects.find(x => x.id === id)?.label ?? id; }

export default function StarzMessengerPage() {
 const [self, setSelf] = useState<Member | null>(null);
 const [members, setMembers] = useState<Member[]>([]);
 const [chats, setChats] = useState<PrivateChat[]>([]);
 const [visibility, setVisibility] = useState<Record<string, ChatVisibility>>({});
 const visibilityRef = useRef<Record<string, ChatVisibility>>({});
 const [chatMenu, setChatMenu] = useState<string | null>(null);
 const [room, setRoom] = useState<string>("group");
 const [messages, setMessages] = useState<Message[]>([]);
 const [draft, setDraft] = useState("");
 const [doodleMode, setDoodleMode] = useState(false);
 const [theme, setTheme] = useState<Theme>("classic");
 const [busy, setBusy] = useState(false);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState("");
 const [soundOn, setSoundOn] = useState(false);
 const [vibrationOn, setVibrationOn] = useState(true);
 const [vibrationSupported, setVibrationSupported] = useState(false);
 const [reduceMotion, setReduceMotion] = useState(false);
 const [animation, setAnimation] = useState<Effect | null>(null);
 const [showMagic, setShowMagic] = useState(false);
 const [memberSearch, setMemberSearch] = useState("");
 const [cooldown, setCooldown] = useState(0);
 const [now, setNow] = useState(Date.now());
 const [unread, setUnread] = useState<Record<string, number>>({});
 const bottomRef = useRef<HTMLDivElement>(null);
 const seenMessages = useRef(new Set<string>());
 const seenEffects = useRef(new Set<string>());
 const animationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
 const audioRef = useRef<AudioContext | null>(null);
 const activeRoomRef = useRef(room);
 const roomRef = useRef(room);
 const selfRef = useRef<Member | null>(null);
 const chatRef = useRef<PrivateChat[]>([]);
 const soundRef = useRef(soundOn);
 const vibrationRef = useRef(vibrationOn);
 const reduceRef = useRef(reduceMotion);
 useEffect(() => { setDoodleMode(false); activeRoomRef.current = room; roomRef.current = room; seenMessages.current.clear(); setMessages([]); setAnimation(null); setUnread(p => ({ ...p, [room]: 0 })); }, [room]);
 useEffect(() => { selfRef.current = self; }, [self]);
 useEffect(() => { chatRef.current = chats; }, [chats]);
 useEffect(() => { soundRef.current = soundOn; }, [soundOn]);
 useEffect(() => { vibrationRef.current = vibrationOn; }, [vibrationOn]);
 useEffect(() => { setVibrationSupported(typeof navigator.vibrate === "function"); }, []);
 useEffect(() => { reduceRef.current = reduceMotion; }, [reduceMotion]);
 useEffect(() => { const m = window.matchMedia("(prefers-reduced-motion: reduce)"); setReduceMotion(m.matches); const listener = (e: MediaQueryListEvent) => setReduceMotion(e.matches); m.addEventListener("change", listener); return () => m.removeEventListener("change", listener); }, []);
 useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 500); return () => window.clearInterval(timer); }, []);

 // Synthesized sound effects: no external audio files or third-party assets needed.
 // Optional real recordings live in public/sounds/starz-messenger/.
 // Missing recordings fall back to the existing synthesized effect.
 const recordedSounds: Record<string, string> = {
  kiss: "/sounds/starz-messenger/kiss.mp3",
  laugh: "/sounds/starz-messenger/laugh.mp3",
  clap: "/sounds/starz-messenger/clap.mp3",
  punch: "/sounds/starz-messenger/punch.mp3",
  four: "/sounds/starz-messenger/four.mp3",
  cricket: "/sounds/starz-messenger/six.mp3",
 };
 const playSound = useCallback((effect: string) => {
  if (!soundRef.current) return;
  const recordedUrl = recordedSounds[effect];
  if (recordedUrl) {
   const audio = new Audio(recordedUrl);
   audio.volume = 0.65;
   // Fall back to synthesized audio if a recording hasn't been added yet.
   audio.addEventListener("error", () => playSynthesizedSound(effect), { once: true });
   void audio.play().catch(() => {
    // Browsers can block playback before a user gesture; avoid double sounds.
   });
   return;
  }
  playSynthesizedSound(effect);
 }, []);
 function playSynthesizedSound(effect: string) {
  if (!soundRef.current) return;
  try {
   const Context = window.AudioContext;
   if (!Context) return;
   const ctx = audioRef.current ?? new Context(); audioRef.current = ctx;
   void ctx.resume();
   const at = ctx.currentTime + 0.01;
   const tone = (frequency: number, duration: number, offset = 0, endFrequency = frequency, shape: OscillatorType = "sine", volume = 0.10) => {
    const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
    oscillator.type = shape;
    oscillator.frequency.setValueAtTime(frequency, at + offset);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), at + offset + duration);
    gain.gain.setValueAtTime(0.0001, at + offset);
    gain.gain.exponentialRampToValueAtTime(volume, at + offset + Math.min(0.015, duration / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + offset + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(at + offset); oscillator.stop(at + offset + duration + 0.01);
   };
   const noise = (duration: number, offset = 0, volume = 0.16, highpass = 0) => {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource(); source.buffer = buffer;
    const filter = ctx.createBiquadFilter(); filter.type = "highpass"; filter.frequency.value = highpass || 400;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, at + offset);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + offset + duration);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(at + offset); source.stop(at + offset + duration);
   };
   switch (effect) {
    case "buzz": tone(190, 0.30, 0, 85, "sawtooth", 0.11); tone(170, 0.25, 0.32, 80, "sawtooth", 0.10); break;
    case "clap": // Three sharp, noisy handclaps.
     [0, 0.19, 0.38].forEach(t => { noise(0.11, t, 0.20, 850); noise(0.055, t + 0.022, 0.12, 1400); }); break;
    case "kiss": // Soft lip-smack followed by a playful rising kiss whistle.
     noise(0.055, 0, 0.12, 900); tone(450, 0.19, 0.07, 1100, "sine", 0.09); break;
    case "punch": noise(0.11, 0, 0.24, 160); tone(125, 0.19, 0, 48, "triangle", 0.18); break;
    case "four": // Bat strike, two boundary chimes, and crowd-like applause.
     noise(0.045, 0, 0.23, 750); tone(560, 0.17, 0.11, 740, "triangle"); tone(740, 0.23, 0.29, 990, "triangle");
     [0.18, 0.29, 0.43, 0.56].forEach(t => noise(0.10, t, 0.07, 1100)); break;
    case "cricket": // SIX: bigger rising stadium fanfare.
     noise(0.055, 0, 0.24, 700);
     [392, 523, 659, 784].forEach((f, i) => tone(f, 0.23, 0.10 + i * 0.14, f * 1.06, "triangle", 0.09));
     [0.25, 0.37, 0.49, 0.61, 0.73].forEach(t => noise(0.10, t, 0.065, 1200)); break;
    case "hearts": tone(523, 0.17); tone(659, 0.21, 0.19); break;
    case "laugh": [0, 0.17, 0.34].forEach(t => tone(420, 0.13, t, 620, "triangle", 0.08)); break;
    case "confetti": case "fireworks": noise(0.28, 0, 0.10, 900); tone(880, 0.22, 0.07, 1320); break;
    default: tone(600, 0.22, 0, 850);
   }
  } catch { /* Audio may be blocked until the user interacts with the page. */ }
 }
 const showEffect = useCallback((effect: Effect) => {
  if (seenEffects.current.has(effect.id)) return;
  seenEffects.current.add(effect.id);
  if (animationTimer.current) clearTimeout(animationTimer.current);
  setAnimation(effect); playSound(effect.effect);
  // Only incoming BUZZ events vibrate; sender gets the existing animation and sound.
  if (effect.effect === "buzz" && effect.sender_user_id !== selfRef.current?.user_id && vibrationRef.current && !reduceRef.current && typeof navigator.vibrate === "function") {
   try { navigator.vibrate([200, 100, 200, 100, 400]); } catch { /* Vibration may be blocked by device settings. */ }
  }
  animationTimer.current = setTimeout(() => setAnimation(null), effect.effect === "hearts" ? 5400 : 2300);
 }, [playSound]);
 const append = useCallback((m: Message) => {
  if (seenMessages.current.has(m.id)) return;
  seenMessages.current.add(m.id);
  setMessages(p => [...p, m].sort(messageOrder).slice(-150));
 }, []);

 useEffect(() => {
  let cancelled = false;
  async function init() {
   const { data: auth, error: authError } = await supabase.auth.getUser();
   if (cancelled) return;
   if (authError || !auth.user) { setError("Sign in to use Starz Messenger."); setLoading(false); return; }
   const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("member_id").eq("id", auth.user.id).maybeSingle();
   if (cancelled) return;
   if (profileError || !profile?.member_id) { setError(profileError?.message || "Your account is not linked to a club member profile."); setLoading(false); return; }
   const { data: mine, error: memberError } = await supabase.from("members")
    .select("id,name,club_id,approval_status").eq("id", profile.member_id).maybeSingle();
   if (cancelled) return;
   if (memberError || !mine?.club_id || String(mine.approval_status).toLowerCase() !== "active") {
    setError(memberError?.message || "An active club membership is required."); setLoading(false); return;
   }
   const current: Member = { user_id: auth.user.id, name: mine.name, club_id: mine.club_id };
   selfRef.current = current; setSelf(current);
   const [directory, privateRooms, visibilityRows] = await Promise.all([
    supabase.rpc("starz_chat_directory", { p_club_id: current.club_id }),
    supabase.from("starz_private_chats").select("*").eq("club_id",current.club_id),
     supabase.from("starz_private_chat_visibility").select("chat_id,cleared_at,hidden").eq("user_id",current.user_id)
   ]);
   if (cancelled) return;
   if (directory.error) setError(directory.error.message);
   if (privateRooms.error) setError(privateRooms.error.message);
    if (visibilityRows.error) setError(visibilityRows.error.message);
    else { const map = Object.fromEntries(((visibilityRows.data ?? []) as ChatVisibility[]).map(v => [v.chat_id, v])); visibilityRef.current = map; setVisibility(map); }
   setMembers(((directory.data ?? []) as Member[]).filter(m => m.user_id && m.user_id !== current.user_id));
   const existing = (privateRooms.data ?? []) as PrivateChat[]; chatRef.current = existing; setChats(existing);
   setLoading(false);
  }
  void init(); return () => { cancelled = true; };
 }, []);

 // History and persistent wallpaper load on room change.
 useEffect(() => {
  if (!self) return;
  let cancelled = false;
  const target = room;
  const clubId = self.club_id;
  async function loadRoom() {
   setError("");
   const clearedAt = visibilityRef.current[target]?.cleared_at;
    const query = target === "group"
    ? supabase.from("club_chat_messages").select("*").eq("club_id", clubId).order("created_at", { ascending: false }).limit(100)
    : (() => { let q = supabase.from("starz_private_messages").select("*").eq("chat_id", target); if (clearedAt) q = q.gt("created_at", clearedAt); return q.order("created_at", { ascending: false }).limit(100); })();
   const [history, setting] = await Promise.all([
    query,
    target === "group" ? supabase.from("starz_group_chat_settings").select("theme").eq("club_id",clubId).maybeSingle()
     : supabase.from("starz_private_chats").select("theme").eq("id",target).maybeSingle()
   ]);
   if (cancelled || activeRoomRef.current !== target) return;
   if (history.error) setError(history.error.message);
   else {
    const list = ((history.data ?? []) as Message[]).reverse();
    seenMessages.current = new Set(list.map(m => m.id)); setMessages(list);
   }
   if (!setting.error && setting.data && themes.includes(setting.data.theme as Theme)) setTheme(setting.data.theme as Theme);
   else setTheme("classic");
  }
  void loadRoom(); return () => { cancelled = true; };
 }, [self, room]);

 // Subscribe at club level, but only show private content for the active conversation.
 useEffect(() => {
  if (!self) return;
  const channel = supabase.channel(`starz-messenger-self.clubid-{self.user_id}`)
   .on("postgres_changes", { event: "INSERT", schema: "public", table: "club_chat_messages", filter: `club_id=eq.${self.club_id}` }, payload => {
    const m = payload.new as Message;
    if (m.kind === "buzz") return; // Legacy v1 buzz events are historical; new effects use starz_chat_effects.
    if (activeRoomRef.current === "group") append(m);
    else setUnread(p => ({ ...p, group: (p.group ?? 0) + (m.sender_user_id === self.user_id ? 0 : 1) }));
   })
   .on("postgres_changes", { event: "INSERT", schema: "public", table: "starz_private_messages" }, payload => {
    const m = payload.new as Message & { chat_id: string };
    if (activeRoomRef.current === m.chat_id) append(m);
    else setUnread(p => ({ ...p, [m.chat_id]: (p[m.chat_id] ?? 0) + (m.sender_user_id === self.user_id ? 0 : 1) }));
   })
   .on("postgres_changes", { event: "INSERT", schema: "public", table: "starz_chat_effects", filter: `club_id=eq.${self.club_id}` }, payload => {
    const e = payload.new as Effect;
    if ((e.chat_id ?? "group") === activeRoomRef.current) showEffect(e);
   })
   .on("postgres_changes", { event: "INSERT", schema: "public", table: "starz_group_chat_settings", filter: `club_id=eq.${self.club_id}` }, payload => {
    if (activeRoomRef.current === "group" && themes.includes((payload.new as {theme:Theme}).theme)) setTheme((payload.new as {theme:Theme}).theme);
   })
   .on("postgres_changes", { event: "UPDATE", schema: "public", table: "starz_group_chat_settings", filter: `club_id=eq.${self.club_id}` }, payload => {
    if (activeRoomRef.current === "group" && themes.includes((payload.new as {theme:Theme}).theme)) setTheme((payload.new as {theme:Theme}).theme);
   })
   .on("postgres_changes", { event: "UPDATE", schema: "public", table: "starz_private_chats", filter: `club_id=eq.${self.club_id}` }, payload => {
    const c = payload.new as PrivateChat;
    setChats(p => p.map(x => x.id === c.id ? c : x));
    if (activeRoomRef.current === c.id && themes.includes(c.theme as Theme)) setTheme(c.theme as Theme);
   })
   .subscribe();
  return () => { void supabase.removeChannel(channel); };
 }, [self, append, showEffect]);
 useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, room]);
 useEffect(() => () => { if (animationTimer.current) clearTimeout(animationTimer.current); void audioRef.current?.close(); }, []);

 async function openPrivate(other: Member) {
  if (!self || busy) return;
  setBusy(true); setError("");
  const { data, error: e } = await supabase.rpc("starz_open_private_chat", { p_club_id: self.club_id, p_other_user_id: other.user_id });
  if (e) setError(e.message);
  else if (data) {
   const id = String(data);
   if (!chats.some(c => c.id === id)) {
    const { data: row, error: readError } = await supabase.from("starz_private_chats").select("*").eq("id",id).single();
    if (readError) setError(readError.message);
    else if (row) setChats(p => [...p.filter(c => c.id !== id), row as PrivateChat]);
   }
   const existingVisibility = visibilityRef.current[id];
   if (existingVisibility?.hidden) {
    const { error: showError } = await supabase.from("starz_private_chat_visibility").update({ hidden: false }).eq("chat_id", id).eq("user_id", self.user_id);
    if (showError) setError(showError.message);
    else { const updated = { ...existingVisibility, hidden: false }; visibilityRef.current = { ...visibilityRef.current, [id]: updated }; setVisibility(p => ({ ...p, [id]: updated })); }
   }
   setRoom(id); setMemberSearch("");
  }
  setBusy(false);
 }
 async function deletePrivateChat(chatId: string) {
  if (!self || busy) return;
  const chat = chats.find(c => c.id === chatId);
  if (!chat || (chat.user_a !== self.user_id && chat.user_b !== self.user_id)) return;
  if (!window.confirm("Delete this conversation for you? The other member will keep their messages. This cannot be undone for your account.")) return;
  setBusy(true); setError("");
  const cutoff = new Date().toISOString();
  const { data, error: deleteError } = await supabase.from("starz_private_chat_visibility")
   .upsert({ chat_id: chatId, user_id: self.user_id, cleared_at: cutoff, hidden: true }, { onConflict: "chat_id,user_id" })
   .select("chat_id,cleared_at,hidden").single();
  if (deleteError) setError(deleteError.message);
  else if (data) {
   const updated = data as ChatVisibility;
   visibilityRef.current = { ...visibilityRef.current, [chatId]: updated };
   setVisibility(p => ({ ...p, [chatId]: updated }));
   setUnread(p => ({ ...p, [chatId]: 0 }));
   if (roomRef.current === chatId) setRoom("group");
   setChatMenu(null);
  }
  setBusy(false);
 }

 async function sendMessage(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault(); if (!self || !draft.trim() || busy) return;
  const text = draft.trim().slice(0, 2000); setBusy(true); setError("");
  const result = room === "group"
   ? await supabase.from("club_chat_messages").insert({ club_id: self.club_id, sender_user_id: self.user_id, sender_name: self.name, kind: "message", body: text }).select("*").single()
   : await supabase.from("starz_private_messages").insert({ chat_id: room, sender_user_id: self.user_id, sender_name: self.name, body: text }).select("*").single();
  if (result.error) setError(result.error.message);
  else { setDraft(""); if (result.data) append(result.data as Message); }
  setBusy(false);
 }
 async function sendEffect(effect: string) {
  if (!self || busy || cooldown > now) return;
  setBusy(true); setError("");
  const target = room;
  const { data, error: e } = await supabase.rpc("starz_send_effect", { p_club_id: self.club_id, p_chat_id: target === "group" ? null : target, p_effect: effect });
  if (e) setError(e.message);
  else { setCooldown(Date.now() + (effect === "buzz" ? 30000 : 5000)); if (data && activeRoomRef.current === target) showEffect(data as Effect); setShowMagic(false); }
  setBusy(false);
 }
 async function changeTheme(next: Theme) {
  if (!self || busy) return;
  setBusy(true); setError("");
  const target = room;
  const { error: e } = await supabase.rpc("starz_set_chat_theme", { p_club_id: self.club_id, p_chat_id: target === "group" ? null : target, p_theme: next });
  if (e) setError(e.message);
  else if (activeRoomRef.current === target) setTheme(next);
  setBusy(false);
 }
 const partner = room === "group" ? null : (() => { const chat = chats.find(c => c.id === room); return members.find(m => m.user_id === (chat?.user_a === self?.user_id ? chat?.user_b : chat?.user_a)); })();
 const title = room === "group" ? "🏏 Club Group Chat" : `💬 ${partner?.name ?? "Private Chat"}`;
 const dark = theme === "stars";
 const seconds = Math.max(0, Math.ceil((cooldown - now) / 1000));
 const symbols: Record<string,string[]> = { hearts:["❤️","💗","💕","💖","❤️","💞"], punch:["🥊","💥","POW!"], kiss:["💋","😘","💖"], confetti:["🎊","🎉","✨","🎈"], cricket:["🏏","🏏","💥","SIX!"], four:["🏏","🏃","💨","FOUR!"], fireworks:["🎆","🎇","✨"], laugh:["😂","🤣","😆"], clap:["👏","👏","🙌"], buzz:["⚡","BUZZ!","⚡"] };
 return <main className="min-h-[100dvh] bg-slate-50 px-3 py-4 text-slate-900 sm:px-6">
  <div className="mx-auto max-w-6xl">
   <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-blue-950 px-5 py-4 text-white">
    <div><h1 className="text-xl font-bold">🏏 Starz Messenger</h1><p className="text-xs text-blue-200">Club chat • Private messages • Magic Effects</p></div>
    <div className="flex items-center gap-2"><button type="button" onClick={() => { setSoundOn(v => !v); }} className="rounded-lg border border-blue-300 px-3 py-2 text-sm">{soundOn ? "🔊 Sound on" : "🔇 Sound off"}</button><button type="button" disabled={!vibrationSupported} onClick={() => setVibrationOn(v => !v)} title={vibrationSupported ? "Toggle vibration for incoming BUZZ" : "Vibration is not supported by this browser"} className="rounded-lg border border-blue-300 px-3 py-2 text-sm disabled:opacity-50">{!vibrationSupported ? "📳 Vibration unavailable" : vibrationOn ? "📳 Vibration on" : "📴 Vibration off"}</button><Link href="/" className="rounded-lg border border-blue-300 px-3 py-2 text-sm">Home</Link></div>
   </header>
   {loading ? <p className="p-8 text-center">Loading messenger…</p> : !self ? <p role="alert" className="rounded-xl bg-red-50 p-6 text-red-700">{error}</p> :
   <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
    <aside className="rounded-2xl border bg-white p-4 shadow-sm">
     <h2 className="mb-3 font-bold text-blue-950">Conversations</h2>
     <button onClick={() => setRoom("group")} className={`mb-3 flex w-full justify-between rounded-xl px-3 py-3 text-left ${room === "group" ? "bg-blue-900 text-white" : "bg-slate-100"}`}>🏏 Club Group <span>{unread.group ? `(${unread.group})` : ""}</span></button>
     <h3 className="mb-2 text-sm font-bold">Private chats</h3>
     {chats.filter(c => !visibility[c.id]?.hidden).map(c => {
       const other = members.find(m => m.user_id === (c.user_a === self.user_id ? c.user_b : c.user_a));
       return <div key={c.id} className="relative mb-1 flex items-center gap-1">
        <button type="button" onClick={() => { setRoom(c.id); setChatMenu(null); }} className={`min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-left text-sm ${room === c.id ? "bg-blue-900 text-white" : "hover:bg-blue-50"}`}>💬 {other?.name ?? "Member"} {unread[c.id] ? `(${unread[c.id]})` : ""}</button>
        <button type="button" aria-label={`Options for ${other?.name ?? "private chat"}`} aria-expanded={chatMenu === c.id} onClick={() => setChatMenu(v => v === c.id ? null : c.id)} className="rounded-lg border px-2 py-2 text-slate-700" >⋮</button>
        {chatMenu === c.id && <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border bg-white p-1 shadow-xl">
         <button type="button" disabled={busy} onClick={() => void deletePrivateChat(c.id)} className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">🗑 Delete for me</button>
         <button type="button" onClick={() => setChatMenu(null)} className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
        </div>}
       </div>;
      })}
     <div className="mt-4 border-t pt-3"><label htmlFor="member-search" className="text-sm font-bold">Start private chat</label><input id="member-search" value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Find club member…" className="mt-2 w-full rounded-lg border px-3 py-2 text-sm" />
      <div className="mt-2 max-h-48 overflow-y-auto">{members.filter(m => m.name.toLowerCase().includes(memberSearch.toLowerCase())).map(m => <button key={m.user_id} disabled={busy} onClick={() => void openPrivate(m)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-blue-50 disabled:opacity-50">{m.name}</button>)}{members.length === 0 && <p className="text-xs text-slate-500">No other active members found.</p>}</div>
     </div>
    </aside>
    <section className="min-w-0 rounded-2xl border bg-white p-3 shadow-sm sm:p-4">
     <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-blue-950">{title}</h2><label className="text-sm">Shared background <select value={theme} disabled={busy} onChange={e => void changeTheme(e.target.value as Theme)} className="ml-2 rounded-lg border bg-white p-2">{themes.map(t => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}</select></label></div>
     {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
     <div className={`relative h-[min(58dvh,560px)] min-h-[300px] overflow-hidden rounded-xl border ${wallpapers[theme]}`}>
      {theme === "hearts" && !reduceMotion && <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">{Array.from({length:14},(_,i) => <span key={i} className="heart-float absolute text-2xl opacity-30" style={{left:`(i*17+5)%95%`,fontSize:`{12+(i%4)*5}px`,animationDuration:`10+i%5*2s`,animationDelay:`{-i*1.9}s`}}>{["💕","💗","🩷","❤️"][i%4]}</span>)}</div>}
      <StarzDoodleLayer clubId={self.club_id} roomId={room} userId={self.user_id} enabled={doodleMode} />
      {theme === "stars" && <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-40" style={{backgroundImage:"radial-gradient(white 1px, transparent 1px)",backgroundSize:"32px 32px"}} />}
      <div className={`relative z-10 h-full overflow-y-auto p-3 sm:p-4 ${doodleMode ? "pointer-events-none" : ""}`} aria-label={title}>
       {messages.length === 0 && <p className={`py-12 text-center ${dark ? "text-white" : "text-slate-500"}`}>Start the conversation! 👋</p>}
       <div className="space-y-3">{messages.map(m => m.kind === "buzz" ? <p key={m.id} className="rounded-lg bg-amber-100 p-2 text-center text-sm font-bold">⚡ {m.sender_name} sent a BUZZ!</p> : <div key={m.id} className={`max-w-[88%] rounded-2xl px-3 py-2 shadow-sm sm:max-w-[75%] ${m.sender_user_id === self.user_id ? "ml-auto bg-blue-100" : "bg-white/95"}`}><p className="text-xs font-bold text-blue-800">{m.sender_name}</p><p className="whitespace-pre-wrap break-words text-sm">{m.body}</p><time className="block text-right text-[10px] text-slate-500" dateTime={m.created_at}>{new Date(m.created_at).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}</time></div>)}<div ref={bottomRef}/></div>
      </div>
      {animation?.effect === "hearts" && <div aria-live="polite" className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-label={`${animation.sender_name} sent hearts`}>
       <span className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-rose-700 shadow-sm">{animation.sender_name} sent ❤️ Hearts</span>
       {Array.from({length:reduceMotion ? 7 : 26},(_,i) => <span key={`animation.id-heart-{i}`} className={`absolute bottom-[-48px] select-none ${!reduceMotion ? "heart-burst" : "heart-still"}`} style={{left:`${(i*37+11)%96}%`,fontSize:`14+(i*7)%23px`,animationDelay:`{(i%13)*0.12}s`,animationDuration:`${2.3+(i%5)*0.26}s`,opacity:reduceMotion?.35:undefined}}>{["💕","💗","❤️","💖","🩷"][i%5]}</span>)}
      </div>}
      {animation && animation.effect !== "hearts" && <div aria-live="polite" className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden"><div className={`rounded-3xl bg-white/85 px-5 py-4 text-center shadow-xl ${!reduceMotion ? "magic-pop" : ""}`}><p className="text-sm font-bold text-blue-950">{animation.sender_name} sent {labelForEffect(animation.effect)}</p><div className="relative mt-3 flex min-h-20 items-center justify-center gap-3 text-4xl">{(symbols[animation.effect] ?? ["✨"]).map((symbol,i) => <span key={`${animation.id}-${i}`} className={!reduceMotion ? (animation.effect === "buzz" ? "magic-shake" : animation.effect === "punch" ? "magic-punch" : "magic-float") : ""} style={{animationDelay:`${i*0.12}s`}}>{symbol}</span>)}</div></div></div>}
     </div>
     <div className="mt-2 flex items-center gap-2"><button type="button" onClick={() => setDoodleMode(v => !v)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${doodleMode ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-800 border"}`}>{doodleMode ? "✏️ Finish drawing" : "🎨 Doodle on background"}</button><span className="text-xs text-slate-500">{doodleMode ? "Draw on the chat background. Messages stay visible." : "Shared live with everyone in this conversation"}</span></div>
     <form onSubmit={sendMessage} className="mt-3 flex gap-2"><input aria-label="Chat message" maxLength={2000} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Type a message…" className="min-w-0 flex-1 rounded-xl border px-3 py-3"/><button disabled={busy || !draft.trim()} className="rounded-xl bg-blue-900 px-4 py-3 font-semibold text-white disabled:opacity-50">Send</button></form>
     <div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={busy || seconds > 0} onClick={() => void sendEffect("buzz")} className="rounded-xl bg-amber-300 px-4 py-2 font-bold disabled:opacity-50">⚡ BUZZ {seconds > 0 ? `${seconds}s` : ""}</button><button type="button" onClick={() => setShowMagic(v => !v)} className="rounded-xl border border-violet-300 bg-violet-50 px-4 py-2 font-bold text-violet-900">🪄 Magic Effects {showMagic ? "▲" : "▼"}</button></div>
     {showMagic && <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-3">{effects.filter(e => e.id !== "buzz").map(e => <button key={e.id} disabled={busy || seconds > 0} onClick={() => void sendEffect(e.id)} className="rounded-xl border bg-white px-2 py-3 text-sm hover:bg-violet-50 disabled:opacity-50">{e.label}</button>)}</div>}
     <p className="mt-3 text-xs text-slate-500">Effects appear for everyone viewing this conversation. Sound is opt-in. Incoming BUZZ vibration is available on supported devices; iPhone browsers do not support web vibration. BUZZ has a 30-second cooldown; other effects have a 5-second cooldown. Respect reduced-motion settings.</p>
    </section>
   </div>}
  </div>
  <style jsx>{`
   @keyframes floatUp { 0% { transform:translateY(80vh) rotate(-12deg);opacity:0 } 20% {opacity:.55} 100% {transform:translateY(-20vh) rotate(20deg);opacity:0} }
   @keyframes heartBurst { 0% { transform:translate3d(0,0,0) scale(.65) rotate(-12deg);opacity:0 } 14% {opacity:.75} 75% {opacity:.55} 100% {transform:translate3d(22px,-65vh,0) scale(1.12) rotate(16deg);opacity:0} }
   .heart-burst { animation:heartBurst 3s ease-out both;will-change:transform,opacity }
   .heart-still { bottom:auto;top:30%; }
   @keyframes pop { 0% { transform:scale(.5);opacity:0 } 45% { transform:scale(1.1);opacity:1 } 100% { transform:scale(1);opacity:1 } }
   @keyframes shake { 0%,100% { transform:translateX(0) } 20%,60% { transform:translateX(-12px) } 40%,80% { transform:translateX(12px) } }
   @keyframes punch { 0% { transform:translateX(-120px) scale(.5) } 70% { transform:translateX(15px) scale(1.5) } 100% { transform:translateX(0) scale(1) } }
   @keyframes magicFloat { 0% { transform:translateY(25px) scale(.5);opacity:0 } 45% {opacity:1} 100% { transform:translateY(-20px) scale(1.1);opacity:1 } }
   .heart-float { bottom:-30px;animation:floatUp 12s linear infinite }
   .magic-pop { animation:pop .45s ease-out }
   .magic-shake { display:inline-block;animation:shake .45s linear 2 }
   .magic-punch { display:inline-block;animation:punch .65s ease-out both }
   .magic-float { display:inline-block;animation:magicFloat 1.1s ease-out both }
   @media(prefers-reduced-motion:reduce) { .heart-float,.heart-burst,.magic-pop,.magic-shake,.magic-punch,.magic-float { animation:none !important } }
  `}</style>
 </main>;
}


