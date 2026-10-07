import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase server environment variables are not configured.");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function clean(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function getLeague(supabase: ReturnType<typeof adminClient>, id: string) {
  return supabase
    .from("leagues")
    .select("id, club_id, name, organizer_name, description, registration_start, registration_end, league_start, league_end, registration_status")
    .eq("id", id)
    .single();
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = adminClient();

    const { data: league, error } = await getLeague(supabase, id);
    if (error || !league) {
      return NextResponse.json({ error: "League not found." }, { status: 404 });
    }

    const { data: clubs } = await supabase
      .from("clubs")
      .select("id, name")
      .order("name");

    return NextResponse.json({
      league: {
        id: league.id,
        name: league.name,
        organizer_name: league.organizer_name,
        description: league.description,
        registration_end: league.registration_end,
        registration_status: league.registration_status,
      },
      clubs: clubs ?? [],
    });
  } catch (error) {
    console.error("League registration GET error:", error);
    return NextResponse.json({ error: "Unable to load registration." }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = adminClient();

    const { data: league, error: leagueError } = await getLeague(supabase, id);
    if (leagueError || !league) {
      return NextResponse.json({ error: "League not found." }, { status: 404 });
    }

    if (league.registration_status !== "Open") {
      return NextResponse.json({ error: "Registration is not currently open." }, { status: 400 });
    }

    const body = await request.json();
    const full_name = clean(body.full_name, 120);
    const email = clean(body.email, 254).toLowerCase();
    const phone = clean(body.phone, 40);
    const primary_skill = clean(body.primary_skill, 60);
    const secondary_skill = clean(body.secondary_skill, 60);
    const interested_in_club = body.interested_in_club === true;
    const preferred_club_id = interested_in_club ? clean(body.preferred_club_id, 100) : "";

    if (!full_name || !email || !validEmail(email)) {
      return NextResponse.json({ error: "A valid name and email are required." }, { status: 400 });
    }

    if (interested_in_club && !preferred_club_id) {
      return NextResponse.json({ error: "Please select a preferred club." }, { status: 400 });
    }

    if (preferred_club_id) {
      const { data: club } = await supabase
        .from("clubs")
        .select("id")
        .eq("id", preferred_club_id)
        .maybeSingle();
      if (!club) {
        return NextResponse.json({ error: "Selected club is not valid." }, { status: 400 });
      }
    }

    const { error: insertError } = await supabase.from("league_registrations").insert({
      league_id: id,
      full_name,
      email,
      phone: phone || null,
      primary_skill: primary_skill || null,
      secondary_skill: secondary_skill || null,
      interested_in_captaincy: body.interested_in_captaincy === true,
      friday_available: body.friday_available === true,
      saturday_available: body.saturday_available === true,
      sunday_available: body.sunday_available === true,
      interested_in_club,
      preferred_club_id: preferred_club_id || null,
      membership_status: interested_in_club ? "Interested" : "None",
      registration_status: "Registered",
    });

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "This email is already registered for this league." },
          { status: 409 }
        );
      }
      console.error("League registration insert error:", insertError);
      return NextResponse.json({ error: "Unable to save registration." }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("League registration POST error:", error);
    return NextResponse.json({ error: "Unable to submit registration." }, { status: 500 });
  }
}
