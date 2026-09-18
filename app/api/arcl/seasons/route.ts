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

/*
 * Decode enough HTML entities for ARCL dropdown text.
 */
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

/*
 * Extract ARCL seasons from <option> elements.
 *
 * We intentionally DO NOT assume:
 *
 *   next season = current season + 1
 *
 * The season ID and name must actually be present in ARCL HTML.
 */
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

    /*
     * ARCL season names currently look like:
     *
     * Summer 2026
     * Fall 2026
     * Spring 2026
     * Winter 2025
     *
     * Requiring this format prevents unrelated dropdowns
     * such as league/team selectors from being mistaken
     * for seasons.
     */
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

  /*
   * Remove duplicates while preserving ARCL's order.
   */
  const unique = new Map<
    number,
    ArclSeason
  >();

  for (const season of seasons) {
    if (!unique.has(season.id)) {
      unique.set(
        season.id,
        season
      );
    }
  }

  return Array.from(unique.values());
}

export async function GET(
  request: Request
) {
  try {
    /*
     * Use the same authentication pattern as the
     * existing /api/arcl/sync route.
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
            "You must be signed in to view ARCL seasons.",
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
     * Resolve club from authenticated profile.
     *
     * Never accept club_id from the browser.
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
            "Only club Admins can view ARCL season configuration.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * Explicit club-scoped lookup.
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
        "ARCL season club lookup error:",
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

    /*
     * Fetch the SAME League Schedule page we already trust.
     *
     * The currently configured season remains in the URL.
     * ARCL returns the season selector containing the other
     * available seasons.
     */
    const url =
      `https://arcl.org/Pages/UI/LeagueSchedule.aspx` +
      `?league_id=${club.arcl_league_id}` +
      (
        club.arcl_season_id
          ? `&season_id=${club.arcl_season_id}`
          : ""
      );

    const response = await fetch(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; CricketClubSeasonDiscovery/1.0)",
          Accept: "text/html",
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `ARCL returned HTTP ${response.status}.`
      );
    }

    const html =
      await response.text();

    const seasons =
      parseSeasonOptions(html);

    /*
     * Safety:
     * Don't pretend discovery succeeded if we couldn't
     * positively identify ARCL season options.
     */
    if (seasons.length === 0) {
      throw new Error(
        "ARCL season dropdown could not be identified."
      );
    }

    const currentSeason =
      club.arcl_season_id
        ? seasons.find(
            (season) =>
              season.id ===
              club.arcl_season_id
          ) ?? null
        : null;

    /*
     * IMPORTANT:
     *
     * "Available" does NOT mean "activate automatically".
     *
     * We only expose detected seasons to the Admin UI.
     */
    const otherSeasons =
      seasons.filter(
        (season) =>
          season.id !==
          club.arcl_season_id
      );

    /*
     * For the notification card we want seasons newer than
     * the configured season ID.
     *
     * This is only a DISPLAY candidate.
     * It does NOT update the database.
     */
    const newerSeasons =
      club.arcl_season_id
        ? seasons.filter(
            (season) =>
              season.id >
              club.arcl_season_id!
          )
        : [];

    /*
     * If several future seasons are already published,
     * choose the smallest ID above the current one as the
     * immediate next candidate.
     *
     * Again: this is NOT automatic activation.
     */
    const nextSeason =
      newerSeasons.length > 0
        ? [...newerSeasons].sort(
            (a, b) =>
              a.id - b.id
          )[0]
        : null;

    return NextResponse.json({
      success: true,

      club: {
        id: club.id,
        name: club.name,
        leagueId:
          club.arcl_league_id,
      },

      configuredSeason: {
        id:
          club.arcl_season_id,
        name:
          club.arcl_season_name,
      },

      /*
       * What ARCL itself reports for the currently
       * configured ID.
       */
      detectedCurrentSeason:
        currentSeason,

      /*
       * Candidate shown by the future UI.
       */
      nextSeason,

      /*
       * Useful for debugging and future season selection.
       */
      seasons,
      otherSeasons,

      /*
       * Explicitly communicate that discovery made
       * ZERO configuration changes.
       */
      configurationChanged: false,
    });
  } catch (error) {
    console.error(
      "ARCL seasons API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to discover ARCL seasons.",
      },
      {
        status: 500,
      }
    );
  }
}
