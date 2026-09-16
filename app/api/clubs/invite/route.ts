import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

type InviteRow = {
  id: string;
  club_id: string;
  token: string;
  is_active: boolean;
  expires_at: string | null;
};

function inviteExpired(
  expiresAt: string | null
) {
  if (!expiresAt) {
    return false;
  }

  return (
    new Date(expiresAt).getTime() <=
    Date.now()
  );
}

/*
 * =========================================================
 * GET
 *
 * Public invite validation.
 *
 * Example:
 * /api/clubs/invite?token=<TOKEN>
 *
 * Returns only safe club information.
 * It never exposes the invite table directly to anon users.
 * =========================================================
 */

export async function GET(
  request: Request
) {
  try {
    const url =
      new URL(request.url);

    const token =
      url.searchParams
        .get("token")
        ?.trim();

    if (!token) {
      return NextResponse.json(
        {
          error:
            "Invite token is required.",
        },
        { status: 400 }
      );
    }

    const {
      data: invite,
      error: inviteError,
    } = await supabaseAdmin
      .from("club_invites")
      .select(
        `
        id,
        club_id,
        token,
        is_active,
        expires_at
        `
      )
      .eq("token", token)
      .maybeSingle<InviteRow>();

    if (inviteError) {
      console.error(
        "Invite lookup error:",
        inviteError
      );

      return NextResponse.json(
        {
          error:
            "Unable to validate this invite.",
        },
        { status: 500 }
      );
    }

    if (
      !invite ||
      !invite.is_active ||
      inviteExpired(
        invite.expires_at
      )
    ) {
      return NextResponse.json(
        {
          error:
            "This invite is invalid or has expired.",
        },
        { status: 404 }
      );
    }

    const {
      data: club,
      error: clubError,
    } = await supabaseAdmin
      .from("clubs")
      .select(
        `
        id,
        name,
        slug,
        logo_url
        `
      )
      .eq(
        "id",
        invite.club_id
      )
      .maybeSingle();

    if (clubError) {
      console.error(
        "Club lookup error:",
        clubError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load the invited club.",
        },
        { status: 500 }
      );
    }

    if (!club) {
      return NextResponse.json(
        {
          error:
            "The club for this invite no longer exists.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      club,
    });
  } catch (error) {
    console.error(
      "Invite validation API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to validate invite.",
      },
      { status: 500 }
    );
  }
}

/*
 * =========================================================
 * POST
 *
 * Claim invite for the currently authenticated user.
 *
 * Critical rule:
 *
 * ONE ACCOUNT = ONE CLUB
 *
 * - No club yet -> assign invited club.
 * - Already same club -> allowed.
 * - Already another club -> BLOCK.
 *
 * Authentication is verified server-side from the user's
 * Supabase access token.
 * =========================================================
 */

export async function POST(
  request: Request
) {
  try {
    const authHeader =
      request.headers.get(
        "authorization"
      );

    const accessToken =
      authHeader?.startsWith(
        "Bearer "
      )
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
    } =
      await supabaseAdmin.auth.getUser(
        accessToken
      );

    if (
      userError ||
      !userData.user
    ) {
      return NextResponse.json(
        {
          error:
            "Your sign-in session is invalid or expired.",
        },
        { status: 401 }
      );
    }

    const body =
      await request.json();

    const token =
      typeof body?.token ===
      "string"
        ? body.token.trim()
        : "";

    if (!token) {
      return NextResponse.json(
        {
          error:
            "Invite token is required.",
        },
        { status: 400 }
      );
    }

    /*
     * Validate invite using service role.
     */

    const {
      data: invite,
      error: inviteError,
    } = await supabaseAdmin
      .from("club_invites")
      .select(
        `
        id,
        club_id,
        token,
        is_active,
        expires_at
        `
      )
      .eq("token", token)
      .maybeSingle<InviteRow>();

    if (inviteError) {
      console.error(
        "Invite claim lookup error:",
        inviteError
      );

      return NextResponse.json(
        {
          error:
            "Unable to validate this invite.",
        },
        { status: 500 }
      );
    }

    if (
      !invite ||
      !invite.is_active ||
      inviteExpired(
        invite.expires_at
      )
    ) {
      return NextResponse.json(
        {
          error:
            "This invite is invalid or has expired.",
        },
        { status: 404 }
      );
    }

    /*
     * Find the user's profile.
     */

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
      .eq(
        "id",
        userData.user.id
      )
      .maybeSingle();

    if (profileError) {
      console.error(
        "Profile lookup error:",
        profileError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load your profile.",
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
     * =====================================================
     * ONE USER = ONE CLUB
     * =====================================================
     */

    if (
      profile.club_id &&
      profile.club_id !==
        invite.club_id
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
     * Already in this club.
     * Nothing else to update.
     */

    if (
      profile.club_id ===
      invite.club_id
    ) {
      return NextResponse.json({
        success: true,
        alreadyJoined: true,
        clubId:
          invite.club_id,
      });
    }

    /*
     * First club assignment.
     */

    const {
      error: updateError,
    } = await supabaseAdmin
      .from("profiles")
      .update({
        club_id:
          invite.club_id,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        userData.user.id
      )
      .is(
        "club_id",
        null
      );

    if (updateError) {
      console.error(
        "Unable to assign club:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            "Unable to join this club.",
        },
        { status: 500 }
      );
    }

    /*
     * Read back the profile.
     *
     * This protects us against two simultaneous
     * attempts trying to assign different clubs.
     */

    const {
      data: updatedProfile,
      error:
        updatedProfileError,
    } = await supabaseAdmin
      .from("profiles")
      .select("club_id")
      .eq(
        "id",
        userData.user.id
      )
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
      updatedProfile.club_id !==
      invite.club_id
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
      clubId:
        invite.club_id,
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
