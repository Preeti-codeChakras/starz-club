import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

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

type ArclSeason = {
  id: number;
  name: string;
};

type SeasonDiscoveryResponse = {
  success: boolean;
  seasons?: ArclSeason[];
  error?: string;
};

type RequestBody = {
  seasonId?: number;
};

/*
 * =========================================================
 * POST /api/arcl/season
 * =========================================================
 *
 * Admin-only ARCL season switch.
 *
 * IMPORTANT:
 *
 * - We NEVER accept a club ID from the browser.
 * - Club comes from the authenticated user's profile.
 * - The requested season MUST exist in ARCL's season
 *   dropdown before we save it.
 * - This route changes configuration only.
 * - The Admin page calls /api/arcl/sync immediately after.
 *
 * =========================================================
 */

export async function POST(
  request: Request
) {
  try {
    /*
     * -----------------------------------------------------
     * 1. Read access token
     * -----------------------------------------------------
     */

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
          success: false,
          error:
            "You must be signed in to change the ARCL season.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * 2. Validate signed-in user
     * -----------------------------------------------------
     */

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
      console.error(
        "ARCL season switch auth error:",
        userError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Your sign-in session is invalid or expired.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * 3. Resolve user's club + Admin role
     * -----------------------------------------------------
     *
     * SERVICE ROLE SAFETY:
     * Never trust a club ID from the browser.
     */

    const {
      data: profile,
      error: profileError,
    } = await supabaseAdmin
      .from("profiles")
      .select(
        `
        id,
        club_id,
        app_role
        `
      )
      .eq(
        "id",
        userData.user.id
      )
      .maybeSingle();

    if (profileError) {
      console.error(
        "ARCL season profile lookup error:",
        profileError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to load your club profile.",
        },
        {
          status: 500,
        }
      );
    }

    if (
      !profile ||
      !profile.club_id
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your account is not associated with a club.",
        },
        {
          status: 409,
        }
      );
    }

    if (
      profile.app_role !== "Admin"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only club Admins can change the ARCL season.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * 4. Read requested season ID
     * -----------------------------------------------------
     */

    let body: RequestBody;

    try {
      body =
        (await request.json()) as RequestBody;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid request body.",
        },
        {
          status: 400,
        }
      );
    }

    const seasonId =
      Number(body.seasonId);

    if (
      !Number.isInteger(
        seasonId
      ) ||
      seasonId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid ARCL season ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * 5. Load caller's club
     * -----------------------------------------------------
     *
     * Explicit club filter because service role bypasses RLS.
     */

    const {
      data: club,
      error: clubError,
    } = await supabaseAdmin
      .from("clubs")
      .select(
        `
        id,
        name,
        arcl_league_id,
        arcl_season_id,
        arcl_season_name
        `
      )
      .eq(
        "id",
        profile.club_id
      )
      .maybeSingle();

    if (clubError) {
      console.error(
        "ARCL season club lookup error:",
        clubError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to load the club's ARCL configuration.",
        },
        {
          status: 500,
        }
      );
    }

    if (!club) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Club configuration could not be found.",
        },
        {
          status: 404,
        }
      );
    }

    if (!club.arcl_league_id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This club does not have an ARCL league configured.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * 6. Ask our EXISTING discovery endpoint what ARCL
     *    currently exposes.
     * -----------------------------------------------------
     *
     * This is intentional.
     *
     * /api/arcl/seasons already contains the ARCL HTML
     * parsing + safety checks we finalized.
     *
     * Keeping the parsing in ONE endpoint prevents the
     * discovery route and switch route from drifting apart.
     */

    const requestUrl =
      new URL(request.url);

    const discoveryUrl =
      new URL(
        "/api/arcl/seasons",
        requestUrl.origin
      );

    const discoveryResponse =
      await fetch(
        discoveryUrl.toString(),
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },

          cache: "no-store",
        }
      );

    let discoveryResult:
      SeasonDiscoveryResponse;

    try {
      discoveryResult =
        (await discoveryResponse.json()) as SeasonDiscoveryResponse;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "ARCL season discovery returned an invalid response.",
        },
        {
          status: 502,
        }
      );
    }

    if (
      !discoveryResponse.ok ||
      !discoveryResult.success
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            discoveryResult.error ??
            "Unable to verify the requested ARCL season.",
        },
        {
          status:
            discoveryResponse.status >=
              400 &&
            discoveryResponse.status <
              600
              ? discoveryResponse.status
              : 502,
        }
      );
    }

    const seasons =
      discoveryResult.seasons ??
      [];

    /*
     * Safety:
     *
     * Never change configuration if ARCL season discovery
     * did not positively identify season options.
     */

    if (seasons.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ARCL season options could not be verified. No configuration changes were made.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * 7. Verify requested season actually exists in ARCL
     * -----------------------------------------------------
     */

    const selectedSeason =
      seasons.find(
        (season) =>
          season.id ===
          seasonId
      );

    if (!selectedSeason) {
      return NextResponse.json(
        {
          success: false,
          error:
            `ARCL season ${seasonId} is not currently available for League ${club.arcl_league_id}. No configuration changes were made.`,
        },
        {
          status: 400,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * 8. If already configured, return success
     * -----------------------------------------------------
     */

    if (
      club.arcl_season_id ===
        selectedSeason.id &&
      club.arcl_season_name ===
        selectedSeason.name
    ) {
      return NextResponse.json({
        success: true,

        changed: false,

        club: {
          id: club.id,
          name: club.name,
          leagueId:
            club.arcl_league_id,
        },

        season: {
          id:
            selectedSeason.id,
          name:
            selectedSeason.name,
        },

        message:
          `${selectedSeason.name} is already the configured ARCL season.`,
      });
    }

    /*
     * -----------------------------------------------------
     * 9. Update ONLY caller's club
     * -----------------------------------------------------
     *
     * Explicit .eq("id", profile.club_id) is required
     * because this client uses the service role.
     */

    const {
      data: updatedClub,
      error: updateError,
    } = await supabaseAdmin
      .from("clubs")
      .update({
        arcl_season_id:
          selectedSeason.id,

        arcl_season_name:
          selectedSeason.name,
      })
      .eq(
        "id",
        profile.club_id
      )
      .select(
        `
        id,
        name,
        arcl_league_id,
        arcl_season_id,
        arcl_season_name
        `
      )
      .maybeSingle();

    if (updateError) {
      console.error(
        "ARCL season update error:",
        updateError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to update the club's ARCL season.",
        },
        {
          status: 500,
        }
      );
    }

    if (!updatedClub) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The ARCL season could not be updated.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * -----------------------------------------------------
     * 10. Success
     * -----------------------------------------------------
     *
     * We DO NOT sync here.
     *
     * The Admin page already calls /api/arcl/sync after
     * this request succeeds.
     */

    return NextResponse.json({
      success: true,

      changed: true,

      club: {
        id:
          updatedClub.id,

        name:
          updatedClub.name,

        leagueId:
          updatedClub.arcl_league_id,
      },

      previousSeason: {
        id:
          club.arcl_season_id,

        name:
          club.arcl_season_name,
      },

      season: {
        id:
          updatedClub.arcl_season_id,

        name:
          updatedClub.arcl_season_name,
      },

      message:
        `ARCL season switched to ${selectedSeason.name}.`,
    });
  } catch (error) {
    console.error(
      "ARCL season switch error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to switch the ARCL season.",
      },
      {
        status: 500,
      }
    );
  }
}
