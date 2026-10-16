import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const runtime = "nodejs";

type EventRow = { id: string; club_id?: string; chat_id?: string | null; sender_user_id: string; sender_name?: string; body?: string; kind?: string; effect?: string };
type Hook = { type: string; table: string; schema: string; record?: { id?: string } };

const tables = new Set(["club_chat_messages", "starz_private_messages", "starz_chat_effects"]);

export async function POST(request: NextRequest) {
  const secret = process.env.STARZ_PUSH_WEBHOOK_SECRET;
  const received = request.headers.get("x-starz-webhook-secret");
  // Require a long random shared secret configured on every Supabase webhook.
  if (!secret || secret.length < 32 || !received || received.length !== secret.length) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { timingSafeEqual } = await import("node:crypto");
  if (!timingSafeEqual(Buffer.from(received), Buffer.from(secret))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.NEXT_PUBLIC_STARZ_VAPID_PUBLIC_KEY;
  const privateKey = process.env.STARZ_VAPID_PRIVATE_KEY;
  const subject = process.env.STARZ_VAPID_SUBJECT;
  if (!url || !serviceKey || !publicKey || !privateKey || !subject) {
    return NextResponse.json({ error: "Push sender is not configured" }, { status: 503 });
  }

  let hook: Hook;
  try { hook = await request.json() as Hook; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (hook.schema !== "public" || hook.type !== "INSERT" || !tables.has(hook.table) || !hook.record?.id) {
    return NextResponse.json({ ignored: true });
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  // Re-fetch the database record: never trust webhook-supplied message contents or recipients.
  const { data: raw, error: rowError } = await db.from(hook.table).select("*").eq("id", hook.record.id).maybeSingle();
  if (rowError) return NextResponse.json({ error: "Could not read event" }, { status: 500 });
  if (!raw) return NextResponse.json({ ignored: true });
  const row = raw as EventRow;
  if (!row.sender_user_id) return NextResponse.json({ ignored: true });

  let clubId = row.club_id;
  let recipients: string[] = [];
  let target = "/club-chat";
  let title = "🏏 Starz Messenger";
  let body = "You have a new message in Starz.";
  let kind = "message";

  if (hook.table === "starz_private_messages" || (hook.table === "starz_chat_effects" && row.chat_id)) {
    if (!row.chat_id) return NextResponse.json({ ignored: true });
    const { data: chat, error } = await db.from("starz_private_chats")
      .select("id,club_id,user_a,user_b").eq("id", row.chat_id).maybeSingle();
    if (error || !chat) return NextResponse.json({ ignored: true });
    if (row.sender_user_id !== chat.user_a && row.sender_user_id !== chat.user_b) return NextResponse.json({ ignored: true });
    if (clubId && clubId !== chat.club_id) return NextResponse.json({ ignored: true });
    clubId = chat.club_id;
    recipients = [chat.user_a === row.sender_user_id ? chat.user_b : chat.user_a];
    target = `/club-chat?chat=${encodeURIComponent(chat.id)}`;
    title = `💬 ${String(row.sender_name || "Starz member").slice(0, 60)}`;
  }

  if (hook.table === "starz_chat_effects") {
    if (row.effect !== "buzz") return NextResponse.json({ ignored: true });
    kind = "buzz";
    title = `⚡ BUZZ from ${String(row.sender_name || "Starz member").slice(0, 60)}`;
    body = "Someone sent you a BUZZ in Starz Messenger!";
  } else if (hook.table === "club_chat_messages") {
    if (row.kind === "buzz") return NextResponse.json({ ignored: true });
    if (row.kind && row.kind !== "message") return NextResponse.json({ ignored: true });
    title = `🏏 ${String(row.sender_name || "Starz member").slice(0, 60)} in Club Chat`;
    // Avoid showing potentially private message text on the lock screen.
    body = "New club message. Tap to open Starz.";
  } else {
    body = "New private message. Tap to open Starz.";
  }

  if (!clubId) return NextResponse.json({ ignored: true });
  if (!recipients.length) {
    // Only active members of the same club should receive group notifications.
    const { data: members, error: membersError } = await db.from("members")
      .select("id").eq("club_id", clubId).ilike("approval_status", "active");
    if (membersError) return NextResponse.json({ error: "Could not load club members" }, { status: 500 });
    const ids = (members ?? []).map(m => m.id);
    if (!ids.length) return NextResponse.json({ delivered: 0 });
    const { data: profiles, error: profileError } = await db.from("profiles")
      .select("id,member_id").in("member_id", ids);
    if (profileError) return NextResponse.json({ error: "Could not load member accounts" }, { status: 500 });
    recipients = (profiles ?? []).map(p => p.id);
  } else {
    // For private chats, ensure the recipient still has an active membership in this club.
    const { data: profile } = await db.from("profiles").select("member_id").eq("id", recipients[0]).maybeSingle();
    if (!profile?.member_id) return NextResponse.json({ delivered: 0 });
    const { data: member } = await db.from("members").select("id")
      .eq("id", profile.member_id).eq("club_id", clubId).ilike("approval_status", "active").maybeSingle();
    if (!member) return NextResponse.json({ delivered: 0 });
  }
  recipients = [...new Set(recipients)].filter(id => id !== row.sender_user_id);
  if (!recipients.length) return NextResponse.json({ delivered: 0 });

  const { data: subscriptions, error: subsError } = await db.from("starz_push_subscriptions")
    .select("id,endpoint,p256dh,auth,user_id").in("user_id", recipients);
  if (subsError) return NextResponse.json({ error: "Could not read subscriptions" }, { status: 500 });

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const payload = JSON.stringify({ title, body, kind, url: target, tag: `starz-${hook.table}-${row.id}` });
  let delivered = 0;
  let failed = 0;
  await Promise.all((subscriptions ?? []).map(async sub => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 3600 });
      delivered++;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db.from("starz_push_subscriptions").delete().eq("id", sub.id);
      } else {
        failed++;
        console.error("Starz push delivery failed", { status });
      }
    }
  }));
  return NextResponse.json({ delivered, failed });
}
