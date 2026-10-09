import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publicKey) {
    return NextResponse.json({ error: "Supabase URL or public key is missing" }, { status: 503 });
  }
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Please sign in again" }, { status: 401 });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/functions/v1/finance-reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: publicKey, Authorization: authorization },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({ error: `Finance function returned HTTP ${response.status}` }));
    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    console.error("Finance reminder function request failed:", error);
    return NextResponse.json({ error: "Unable to contact Finance reminder service" }, { status: 502 });
  }
}
