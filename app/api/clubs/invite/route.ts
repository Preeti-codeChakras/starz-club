import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type InviteRow = {
  id: string;
  club_id: string;
  token: string;
  is_active: boolean;
  expires_at: string | null;
};
type JoinLinkRow = {
  club_id: string;
  token: string;
  is_active: boolean;
};
type ClaimResolution =
  | { invite: { club_id: string }; error?: never; status?: never }
  | { invite?: never; error: string; status: number };

function expired(date: string | null): boolean {
  return date !== null && (!Number.isFinite(Date.parse(date)) || Date.parse(date) <= Date.now());
}

async function resolveClaimToken(token: string): Promise<ClaimResolution> {
  // A token is a UUID in both flows. Never accept a club slug as a POST credential.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    return { error: "Invalid invitation token.", status: 400 };
  }
  const { data: link, error: linkError } = await supabaseAdmin
    .from("club_join_links")
    .select("club_id,token,is_active")
    .eq("token", token)
    .maybeSingle<JoinLinkRow>();
  if (linkError) {
    console.error("Permanent club link lookup failed:", linkError);
    return { error: "Unable to validate club link.", status: 500 };
  }
  if (link) {
    return link.is_active
      ? { invite: { club_id: link.club_id } }
      : { error: "This club signup link is disabled.", status: 404 };
  }
  const { data: invite, error: inviteError } = await supabaseAdmin
    .from("club_invites")
    .select("id,club_id,token,is_active,expires_at")
    .eq("token", token)
    .maybeSingle<InviteRow>();
  if (inviteError) {
    console.error("Temporary invite lookup failed:", inviteError);
    return { error: "Unable to validate invitation.", status: 500 };
  }
  if (!invite || !invite.is_active || expired(invite.expires_at)) {
    return { error: "This invitation is invalid or has expired.", status: 404 };
  }
  return { invite: { club_id: invite.club_id } };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token")?.trim() || "";
    const slug = url.searchParams.get("slug")?.trim().toLowerCase() || "";
    if (!token && !slug) {
      return NextResponse.json({ error: "Invite token or club slug is required." }, { status: 400 });
    }
    if (token && slug) {
      return NextResponse.json({ error: "Provide either token or slug, not both." }, { status: 400 });
    }
    let clubId: string;
    let claimToken: string;
    if (slug) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return NextResponse.json({ error: "Invalid club slug." }, { status: 400 });
      }
      const { data: club, error: clubError } = await supabaseAdmin
        .from("clubs")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (clubError) {
        console.error("Club lookup failed:", clubError);
        return NextResponse.json({ error: "Unable to find club." }, { status: 500 });
      }
      if (!club) return NextResponse.json({ error: "This club does not exist." }, { status: 404 });
      const { data: link, error: linkError } = await supabaseAdmin
        .from("club_join_links")
        .select("club_id,token,is_active")
        .eq("club_id", club.id)
        .maybeSingle<JoinLinkRow>();
      if (linkError) {
        console.error("Club signup link lookup failed:", linkError);
        return NextResponse.json({ error: "Unable to load club signup link." }, { status: 500 });
      }
      if (!link || !link.is_active) {
        return NextResponse.json({ error: "Club signup is currently unavailable." }, { status: 404 });
      }
      clubId = link.club_id;
      claimToken = link.token;
    } else {
      const resolved = await resolveClaimToken(token);
      if (resolved.error) {
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });
      }
      clubId = resolved.invite!.club_id;
      claimToken = token;
    }
    const { data: club, error: clubError } = await supabaseAdmin
      .from("clubs")
      .select("id,name,slug,logo_url")
      .eq("id", clubId)
      .maybeSingle();
    if (clubError) {
      console.error("Club detail lookup failed:", clubError);
      return NextResponse.json({ error: "Unable to load club information." }, { status: 500 });
    }
    if (!club) return NextResponse.json({ error: "Club no longer exists." }, { status: 404 });
    return NextResponse.json({ success: true, club, claimToken }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Club join GET failed:", error);
    return NextResponse.json({ error: "Unable to validate club signup link." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader =
      request.headers.get("authorization");

    const accessToken =
      authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "You must be signed in to join a club.",
        },
        { status: 401 }
      );
    }

    const {
      data: userData,
      error: userError,
    } = await supabaseAdmin.auth.getUser(
      accessToken
    );

    if (userError || !userData.user) {
      return NextResponse.json(
        {
          error:
            "Your sign-in session is invalid or expired.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const token =
      typeof body?.token === "string"
        ? body.token.trim()
        : "";

    if (!token) {
      return NextResponse.json(
        {
          error: "Invite token is required.",
        },
        { status: 400 }
      );
    }

    // Resolve either a revocable permanent club link or a temporary invite.
    const resolved = await resolveClaimToken(token);
    if (resolved.error) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const invite = resolved.invite!;

    const {
      data: profile,
      error: profileError,
    } = await supabaseAdmin
      .from("profiles")
      .select(
        `
        id,
        club_id
        `
      )
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "Profile lookup error:",
        profileError
      );

      return NextResponse.json(
        {
          error: "Unable to load your profile.",
        },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        {
          error:
            "Your account profile has not been created yet.",
        },
        { status: 409 }
      );
    }

    /*
     * ONE USER = ONE CLUB
     */
    if (
      profile.club_id &&
      profile.club_id !== invite.club_id
    ) {
      return NextResponse.json(
        {
          error:
            "This account already belongs to another club.",
        },
        { status: 409 }
      );
    }

    /*
     * Already belongs to this club.
     */
    if (profile.club_id === invite.club_id) {
      return NextResponse.json({
        success: true,
        alreadyJoined: true,
        clubId: invite.club_id,
      });
    }

    /*
     * First club assignment.
     */
    const { error: updateError } =
      await supabaseAdmin
        .from("profiles")
        .update({
          club_id: invite.club_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userData.user.id)
        .is("club_id", null);

    if (updateError) {
      console.error(
        "Unable to assign club:",
        updateError
      );

      return NextResponse.json(
        {
          error: "Unable to join this club.",
        },
        { status: 500 }
      );
    }

    /*
     * Read back profile to protect against simultaneous
     * attempts to assign different clubs.
     */
    const {
      data: updatedProfile,
      error: updatedProfileError,
    } = await supabaseAdmin
      .from("profiles")
      .select("club_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (
      updatedProfileError ||
      !updatedProfile
    ) {
      return NextResponse.json(
        {
          error:
            "Unable to verify club membership.",
        },
        { status: 500 }
      );
    }

    if (
      updatedProfile.club_id !== invite.club_id
    ) {
      return NextResponse.json(
        {
          error:
            "This account already belongs to another club.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      alreadyJoined: false,
      clubId: invite.club_id,
    });
  } catch (error) {
    console.error(
      "Invite claim API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to join club.",
      },
      { status: 500 }
    );
  }
}


