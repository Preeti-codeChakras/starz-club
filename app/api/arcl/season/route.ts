import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL!;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

type ClubRow = {
  id: string;
  name: string;
  arcl_league_id: number | null;
  arcl_season_id: number | null;
  arcl_season_name: string | null;
};

type ArclSeason = {
  id: number;
  name: string;
};

function cleanText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function parseSeasonOptions(
  html: string
): ArclSeason[] {
  const seasons: ArclSeason[] = [];

  const optionRegex =
    /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;

  let match: RegExpExecArray | null;

  while (
    (match = optionRegex.exec(html)) !== null
  ) {
    const attributes = match[1];
    const text = cleanText(match[2]);

    if (
      !/^(Spring|Summer|Fall|Winter)\s+\d{4}$/i.test(
        text
      )
    ) {
      continue;
    }

    const valueMatch =
      attributes.match(
        /\bvalue\s*=\s*["']?(\d+)["']?/i
      );

    if (!valueMatch) {
      continue;
    }

    const id = Number(valueMatch[1]);

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      continue;
    }

    seasons.push({
      id,
      name: text,
    });
  }

  const unique =
    new Map<number, ArclSeason>();

  for (const season of seasons) {
    if (!unique.has(season.id)) {
      unique.set(
        season.id,
        season
      );
    }
  }

  return Array.from(
    unique.values()
  );
}

export async function POST(
  request: Request
) {
  try {
    /*
     * Authenticate exactly like the existing
     * ARCL sync endpoint.
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
            "You must be signed in to switch the ARCL season.",
        },
        {
          status: 401,
        }
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
     * Resolve the club from the authenticated profile.
     * Never trust a club ID supplied by the browser.
     */
    const {
      data: profile,
      error: profileError,
    } = await supabaseAdmin
      .from("profiles")
      .select(`
        id,
        club_id,
        app_role
      `)
      .eq(
        "id",
        userData.user.id
      )
      .maybeSingle();

    if (profileError) {
      console.error(
        "ARCL season switch profile lookup error:",
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
            "Only club Admins can switch the ARCL season.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * Read requested season.
     *
     * We accept the season ID from the browser,
     * but DO NOT trust the supplied name.
     *
     * The real name will be looked up directly
     * from ARCL.
     */
    let body: {
      seasonId?: unknown;
    };

    try {
      body = await request.json();
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

    const requestedSeasonId =
      Number(body.seasonId);

    if (
      !Number.isInteger(
        requestedSeasonId
      ) ||
      requestedSeasonId <= 0
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
     * Explicitly load ONLY the caller's club.
     */
    const {
      data: club,
      error: clubError,
    } = await supabaseAdmin
      .from("clubs")
      .select(`
        id,
        name,
        arcl_league_id,
        arcl_season_id,
        arcl_season_name
      `)
      .eq(
        "id",
        profile.club_id
      )
      .maybeSingle<ClubRow>();

    if (clubError) {
      console.error(
        "ARCL season switch club lookup error:",
        clubError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to load your club's ARCL configuration.",
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
            "Your club could not be found.",
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

    if (!club.arcl_season_id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This club does not have a current ARCL season configured.",
        },
        {
          status: 409,
        }
      );
    }

    if (
      requestedSeasonId ===
      club.arcl_season_id
    ) {
      return NextResponse.json({
        success: true,
        changed: false,
        season: {
          id: club.arcl_season_id,
          name:
            club.arcl_season_name,
        },
        message:
          "This ARCL season is already active.",
      });
    }

    /*
     * We only allow moving FORWARD from this UI.
     *
     * Historical matches remain stored in arcl_matches,
     * but an accidental click cannot move the club back
     * to an older season.
     */
    if (
      requestedSeasonId <
      club.arcl_season_id
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The ARCL season cannot be switched backward from this screen.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * Re-fetch ARCL at switch time.
     *
     * This is important:
     * we do NOT trust stale browser discovery data.
     */
    const discoveryUrl =
      `https://arcl.org/Pages/UI/LeagueSchedule.aspx` +
      `?league_id=${club.arcl_league_id}` +
      `&season_id=${club.arcl_season_id}`;

    const discoveryResponse =
      await fetch(
        discoveryUrl,
        {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; CricketClubSeasonSwitch/1.0)",
            Accept: "text/html",
          },
        }
      );

    if (
      !discoveryResponse.ok
    ) {
      throw new Error(
        `ARCL returned HTTP ${discoveryResponse.status} while validating the season.`
      );
    }

    const discoveryHtml =
      await discoveryResponse.text();

    const seasons =
      parseSeasonOptions(
        discoveryHtml
      );

    if (seasons.length === 0) {
      throw new Error(
        "ARCL season dropdown could not be identified. No configuration changes were made."
      );
    }

    /*
     * Positive safety check:
     *
     * The currently configured season must itself
     * appear in the ARCL dropdown before we trust
     * the dropdown.
     */
    const currentSeasonExists =
      seasons.some(
        (season) =>
          season.id ===
          club.arcl_season_id
      );

    if (!currentSeasonExists) {
      throw new Error(
        "The currently configured ARCL season could not be verified in ARCL. No configuration changes were made."
      );
    }

    /*
     * Requested season must ACTUALLY exist in ARCL.
     */
    const requestedSeason =
      seasons.find(
        (season) =>
          season.id ===
          requestedSeasonId
      );

    if (!requestedSeason) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The requested season is not currently available in ARCL.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * Don't allow skipping over another published season.
     *
     * Example:
     *
     * Current = 70
     * ARCL contains 71 and 72
     *
     * Admin must switch 70 -> 71 first.
     */
    const nextSeason =
      seasons
        .filter(
          (season) =>
            season.id >
            club.arcl_season_id!
        )
        .sort(
          (a, b) =>
            a.id - b.id
        )[0];

    if (!nextSeason) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ARCL does not currently list a newer season.",
        },
        {
          status: 409,
        }
      );
    }

    if (
      requestedSeason.id !==
      nextSeason.id
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `The next available ARCL season is ${nextSeason.name} (Season ID ${nextSeason.id}).`,
        },
        {
          status: 409,
        }
      );
    }

    /*
     * Before changing the club configuration,
     * verify that the target season's League Schedule
     * page can actually be reached.
     */
    const targetUrl =
      `https://arcl.org/Pages/UI/LeagueSchedule.aspx` +
      `?league_id=${club.arcl_league_id}` +
      `&season_id=${requestedSeason.id}`;

    const targetResponse =
      await fetch(
        targetUrl,
        {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; CricketClubSeasonSwitch/1.0)",
            Accept: "text/html",
          },
        }
      );

    if (!targetResponse.ok) {
      throw new Error(
        `ARCL returned HTTP ${targetResponse.status} for ${requestedSeason.name}. No configuration changes were made.`
      );
    }

    const targetHtml =
      await targetResponse.text();

    /*
     * Basic positive validation that ARCL returned
     * the League Schedule page rather than an error,
     * redirect page, etc.
     *
     * The normal schedule sync still has its own
     * stronger table-identification safety checks.
     */
    if (
      !/League\s*Schedule/i.test(
        cleanText(targetHtml)
      )
    ) {
      throw new Error(
        `The League Schedule page for ${requestedSeason.name} could not be verified. No configuration changes were made.`
      );
    }

    /*
     * Update ONLY this club.
     *
     * Also require the old season ID to still match.
     * This protects against two Admin requests racing
     * with each other.
     */
    const {
      data: updatedClub,
      error: updateError,
    } = await supabaseAdmin
      .from("clubs")
      .update({
        arcl_season_id:
          requestedSeason.id,
        arcl_season_name:
          requestedSeason.name,
      })
      .eq(
        "id",
        club.id
      )
      .eq(
        "arcl_season_id",
        club.arcl_season_id
      )
      .select(`
        id,
        name,
        arcl_league_id,
        arcl_season_id,
        arcl_season_name
      `)
      .maybeSingle<ClubRow>();

    if (updateError) {
      console.error(
        "ARCL season update error:",
        updateError
      );

      throw new Error(
        "Unable to update the club's ARCL season."
      );
    }

    if (!updatedClub) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The ARCL configuration changed while this request was running. Please refresh and try again.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * IMPORTANT:
     *
     * We do NOT delete old arcl_matches.
     *
     * Summer 2026 remains historical data.
     * The normal sync endpoint will now use the newly
     * configured season on its next call.
     */
    return NextResponse.json({
      success: true,
      changed: true,

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
        `ARCL season switched to ${updatedClub.arcl_season_name}.`,
    });
  } catch (error) {
    console.error(
      "ARCL season switch API error:",
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
