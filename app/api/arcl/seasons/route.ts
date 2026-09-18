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

/*
 * Parse actual ARCL season options.
 *
 * We deliberately read the season ID from ARCL.
 * We do NOT assume that the next season is current + 1.
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
     * ARCL season names currently follow patterns such as:
     *
     * Spring 2026
     * Summer 2026
     * Fall 2026
     * Winter 2025
     *
     * This prevents unrelated dropdowns from being
     * mistaken for the season selector.
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

    const id =
      Number(valueMatch[1]);

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
   * Remove duplicate options while preserving
   * ARCL's original dropdown order.
   */
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

export async function GET(
  request: Request
) {
  try {
    /*
     * Same authentication approach as the existing
     * ARCL sync API.
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
     * Resolve club from authenticated user.
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
     * Explicitly fetch ONLY the authenticated
     * Admin's club.
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
     * Fetch the League Schedule page for the
     * currently configured season.
     *
     * ARCL includes its season selector on this page.
     */
    const url =
      `https://arcl.org/Pages/UI/LeagueSchedule.aspx` +
      `?league_id=${club.arcl_league_id}` +
      (
        club.arcl_season_id
          ? `&season_id=${club.arcl_season_id}`
          : ""
      );

    const response =
      await fetch(
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
     *
     * If we can't positively identify season options,
     * don't guess.
     */
    if (seasons.length === 0) {
      throw new Error(
        "ARCL season dropdown could not be identified."
      );
    }

    /*
     * Extra safety:
     *
     * If the club already has a configured season,
     * that season should appear in the dropdown.
     *
     * This helps make sure we really parsed the
     * correct ARCL selector.
     */
    const currentSeason =
      club.arcl_season_id
        ? seasons.find(
            (season) =>
              season.id ===
              club.arcl_season_id
          ) ?? null
        : null;

    if (
      club.arcl_season_id &&
      !currentSeason
    ) {
      throw new Error(
        `Configured ARCL season ${club.arcl_season_id} could not be verified in the ARCL season dropdown.`
      );
    }

    /*
     * Find seasons whose ACTUAL ARCL IDs are above
     * the configured season.
     *
     * We are NOT switching anything here.
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
     * If ARCL already exposes multiple future seasons,
     * show the immediate next one rather than skipping.
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

      detectedCurrentSeason:
        currentSeason,

      nextSeason,

      seasons,

      /*
       * This endpoint is discovery-only.
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
