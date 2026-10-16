
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

type EventRow = {
  id: string;
  club_id?: string;
  chat_id?: string | null;
  sender_user_id: string;
  sender_name?: string;
  body?: string;
  kind?: string;
  effect?: string;
};

type Hook = {
  type: string;
  table: string;
  schema: string;
  record?: { id?: string };
};

const tables = new Set([
  "club_chat_messages",
  "starz_private_messages",
  "starz_chat_effects",
]);

function logSkip(reason: string, table: string) {
  console.log("[STARZ PUSH SKIPPED]", { reason, table });
}

export async function POST(request: NextRequest) {
  // 1. Authenticate the Supabase webhook.
  const secret = process.env.STARZ_PUSH_WEBHOOK_SECRET;
  const received = request.headers.get("x-starz-webhook-secret");

  if (
    !secret ||
    secret.length < 32 ||
    !received ||
    received.length !== secret.length ||
    !timingSafeEqual(Buffer.from(received), Buffer.from(secret))
  ) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // 2. Validate server configuration.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.NEXT_PUBLIC_STARZ_VAPID_PUBLIC_KEY;
  const privateKey = process.env.STARZ_VAPID_PRIVATE_KEY;
  const subject = process.env.STARZ_VAPID_SUBJECT;

  if (!url || !serviceKey || !publicKey || !privateKey || !subject) {
    console.error("[STARZ PUSH] Missing server configuration");

    return NextResponse.json(
      { error: "Push sender is not configured" },
      { status: 503 }
    );
  }

  // 3. Parse and validate the event.
  let hook: Hook;

  try {
    hook = (await request.json()) as Hook;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  if (
    hook.schema !== "public" ||
    hook.type !== "INSERT" ||
    !tables.has(hook.table) ||
    !hook.record?.id
  ) {
    logSkip("Unsupported webhook event", hook.table);

    return NextResponse.json({ ignored: true });
  }

  const db = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // 4. Fetch the actual event from Supabase.
  // Never trust message content or recipients from the webhook.
  const { data: raw, error: rowError } = await db
    .from(hook.table)
    .select("*")
    .eq("id", hook.record.id)
    .maybeSingle();

  if (rowError) {
    console.error("[STARZ PUSH] Could not read event", {
      table: hook.table,
      code: rowError.code,
    });

    return NextResponse.json(
      { error: "Could not read event" },
      { status: 500 }
    );
  }

  if (!raw) {
    logSkip("Event not found", hook.table);
    return NextResponse.json({ ignored: true });
  }

  const row = raw as EventRow;

  if (!row.sender_user_id) {
    logSkip("Missing sender", hook.table);
    return NextResponse.json({ ignored: true });
  }

  // 5. Build the notification.
  let clubId = row.club_id;
  let recipients: string[] = [];
  let target = "/club-chat";
  let title = "🏏 Starz Messenger";
  let body = "You have a new message in Starz.";
  let kind = "message";

  const isPrivate =
    hook.table === "starz_private_messages" ||
    (hook.table === "starz_chat_effects" && Boolean(row.chat_id));

  if (isPrivate) {
    if (!row.chat_id) {
      logSkip("Missing private chat ID", hook.table);
      return NextResponse.json({ ignored: true });
    }

    const { data: chat, error } = await db
      .from("starz_private_chats")
      .select("id,club_id,user_a,user_b")
      .eq("id", row.chat_id)
      .maybeSingle();

    if (error || !chat) {
      logSkip("Private chat not found", hook.table);
      return NextResponse.json({ ignored: true });
    }

    if (
      row.sender_user_id !== chat.user_a &&
      row.sender_user_id !== chat.user_b
    ) {
      logSkip("Sender is not a chat participant", hook.table);
      return NextResponse.json({ ignored: true });
    }

    if (clubId && clubId !== chat.club_id) {
      logSkip("Club mismatch", hook.table);
      return NextResponse.json({ ignored: true });
    }

    clubId = chat.club_id;

    recipients = [
      chat.user_a === row.sender_user_id
        ? chat.user_b
        : chat.user_a,
    ];

    target = `/club-chat?chat=${encodeURIComponent(chat.id)}`;
    title = `💬 ${String(row.sender_name || "Starz member").slice(0, 60)}`;
  }

  if (hook.table === "starz_chat_effects") {
    if (row.effect !== "buzz") {
      logSkip("Effect does not require push", hook.table);
      return NextResponse.json({ ignored: true });
    }

    kind = "buzz";
    title = `⚡ BUZZ from ${String(row.sender_name || "Starz member").slice(0, 60)}`;
    body = "Someone sent you a BUZZ in Starz Messenger!";
  } else if (hook.table === "club_chat_messages") {
    if (row.kind && row.kind !== "message") {
      logSkip("Not a standard group message", hook.table);
      return NextResponse.json({ ignored: true });
    }

    title = `🏏 ${String(row.sender_name || "Starz member").slice(0, 60)} in Club Chat`;
    body = "New club message. Tap to open Starz.";
  } else {
    body = "New private message. Tap to open Starz.";
  }

  if (!clubId) {
    logSkip("Missing club ID", hook.table);
    return NextResponse.json({ ignored: true });
  }

  // 6. Resolve eligible recipients.
  if (!recipients.length) {
    const { data: members, error: membersError } = await db
      .from("members")
      .select("id")
      .eq("club_id", clubId)
      .ilike("approval_status", "active");

    if (membersError) {
      console.error("[STARZ PUSH] Could not load club members", {
        code: membersError.code,
      });

      return NextResponse.json(
        { error: "Could not load club members" },
        { status: 500 }
      );
    }

    const memberIds = (members ?? []).map((member) => member.id);

    if (!memberIds.length) {
      logSkip("No active club members", hook.table);
      return NextResponse.json({
        delivered: 0,
        failed: 0,
        reason: "no_active_members",
      });
    }

    const { data: profiles, error: profileError } = await db
      .from("profiles")
      .select("id,member_id")
      .in("member_id", memberIds);

    if (profileError) {
      console.error("[STARZ PUSH] Could not load profiles", {
        code: profileError.code,
      });

      return NextResponse.json(
        { error: "Could not load member accounts" },
        { status: 500 }
      );
    }

    recipients = (profiles ?? []).map((profile) => profile.id);
  } else {
    // Private notifications require active club membership.
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("member_id")
      .eq("id", recipients[0])
      .maybeSingle();

    if (profileError || !profile?.member_id) {
      logSkip("Private recipient has no linked profile", hook.table);
      return NextResponse.json({
        delivered: 0,
        failed: 0,
        reason: "recipient_profile_missing",
      });
    }

    const { data: member, error: memberError } = await db
      .from("members")
      .select("id")
      .eq("id", profile.member_id)
      .eq("club_id", clubId)
      .ilike("approval_status", "active")
      .maybeSingle();

    if (memberError || !member) {
      logSkip("Private recipient is not an active member", hook.table);
      return NextResponse.json({
        delivered: 0,
        failed: 0,
        reason: "recipient_not_active",
      });
    }
  }

  // Never send notifications to the message sender.
  recipients = [...new Set(recipients)].filter(
    (id) => id !== row.sender_user_id
  );

  if (!recipients.length) {
    logSkip("No eligible recipients after sender exclusion", hook.table);
    return NextResponse.json({
      delivered: 0,
      failed: 0,
      reason: "no_recipients",
    });
  }

  // 7. Load device subscriptions.
  const { data: subscriptions, error: subsError } = await db
    .from("starz_push_subscriptions")
    .select("id,endpoint,p256dh,auth,user_id")
    .in("user_id", recipients);

  if (subsError) {
    console.error("[STARZ PUSH] Could not read subscriptions", {
      code: subsError.code,
    });

    return NextResponse.json(
      { error: "Could not read subscriptions" },
      { status: 500 }
    );
  }

  console.log("[STARZ PUSH RECIPIENTS]", {
    table: hook.table,
    recipients: recipients.length,
    subscriptions: subscriptions?.length ?? 0,
  });

  if (!subscriptions?.length) {
    logSkip("No matching device subscriptions", hook.table);

    return NextResponse.json({
      delivered: 0,
      failed: 0,
      reason: "no_subscriptions",
    });
  }

  // 8. Send Web Push notifications.
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch {
    console.error("[STARZ PUSH] Invalid VAPID configuration");

    return NextResponse.json(
      { error: "Invalid push configuration" },
      { status: 503 }
    );
  }

  // FIX: Every message now gets a unique notification tag.
  const payload = JSON.stringify({
    title,
    body,
    kind,
    url: target,
    tag: `starz-${hook.table}-${row.id}`,
  });

  let delivered = 0;
  let failed = 0;
  let expired = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload,
          {
            TTL: 3600,
          }
        );

        delivered++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;

        if (status === 404 || status === 410) {
          const { error: deleteError } = await db
            .from("starz_push_subscriptions")
            .delete()
            .eq("id", sub.id);

          if (deleteError) {
            failed++;
            console.error("[STARZ PUSH] Could not remove expired subscription", {
              code: deleteError.code,
            });
          } else {
            expired++;
          }
        } else {
          failed++;

          console.error("[STARZ PUSH DELIVERY FAILED]", {
            status: status ?? "unknown",
          });
        }
      }
    })
  );

  // 9. Privacy-safe delivery diagnostics.
  console.log("[STARZ PUSH DELIVERY]", {
    table: hook.table,
    recipients: recipients.length,
    subscriptions: subscriptions.length,
    delivered,
    failed,
    expired,
  });

  return NextResponse.json({
    delivered,
    failed,
    expired,
  });
}

