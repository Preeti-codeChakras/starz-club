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

type ClubRow = {
  id: string;
  name: string;
  arcl_league_id: number | null;
  arcl_season_id: number | null;
  arcl_season_name: string | null;
};

type TeamRow = {
  id: string;
  name: string;
  arcl_team_name: string | null;
};

type ParsedMatch = {
  arclMatchId: number;
  matchDate: string;
  startTime: string | null;
  endTime: string | null;
  ground: string | null;
  team1Name: string;
  team2Name: string;
  matchType: string | null;
  division: string | null;
  winnerName: string | null;
  runnerName: string | null;
  comment: string | null;
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

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function nullIfEmpty(value: string | undefined) {
  const cleaned = value?.trim() ?? "";
  return cleaned || null;
}

function parseArclDate(value: string) {
  /*
   * ARCL currently returns values such as:
   *
   * Saturday 09/19/2026
   *
   * Store them as PostgreSQL date:
   *
   * 2026-09-19
   */
  const match = value.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/
  );

  if (!match) {
    return null;
  }

  const month = match[1].padStart(2, "0");
  const day = match[2].padStart(2, "0");
  const year = match[3];

  return `${year}-${month}-${day}`;
}

function parseArclTime(value: string) {
  /*
   * Convert:
   * 8:00 AM
   * 10:30 AM
   * 12:50 PM
   *
   * into PostgreSQL time:
   * 08:00:00
   * 10:30:00
   * 12:50:00
   */
  const match = value
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (!match) {
    return null;
  }

  let hour = Number(match[1]);
  const minute = match[2];
  const meridiem = match[3].toUpperCase();

  if (meridiem === "AM" && hour === 12) {
    hour = 0;
  }

  if (meridiem === "PM" && hour !== 12) {
    hour += 12;
  }

  return `${String(hour).padStart(2, "0")}:${minute}:00`;
}

function getCells(rowHtml: string) {
  const cells: string[] = [];

  const cellRegex =
    /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;

  let cellMatch: RegExpExecArray | null;

  while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
    cells.push(cleanText(cellMatch[1]));
  }

  return cells;
}

function extractArclMatchId(rowHtml: string) {
  /*
   * Actual ARCL game rows contain links such as:
   *
   * Matchscorecard.aspx?match_id=294328&league_id=2&season_id=70
   */
  const match = rowHtml.match(
    /Matchscorecard\.aspx\?[^"'<>]*match_id=(\d+)/i
  );

  if (!match) {
    return null;
  }

  const id = Number(match[1]);

  return Number.isFinite(id) ? id : null;
}

function getHeaderIndexes(headers: string[]) {
  const normalizedHeaders = headers.map(normalize);

  return {
    date: normalizedHeaders.indexOf("date"),
    startTime: normalizedHeaders.indexOf("start time"),
    endTime: normalizedHeaders.indexOf("end time"),
    ground: normalizedHeaders.indexOf("ground"),
    team1: normalizedHeaders.indexOf("team1"),
    team2: normalizedHeaders.indexOf("team2"),
    matchType: normalizedHeaders.indexOf("match type"),
    division: normalizedHeaders.indexOf("division"),
    winner: normalizedHeaders.indexOf("winner"),
    runner: normalizedHeaders.indexOf("runner"),
    comment: normalizedHeaders.indexOf("comment"),
  };
}

function valueAt(
  cells: string[],
  index: number
) {
  if (index < 0) {
    return "";
  }

  return cells[index] ?? "";
}

function parseMatches(
  html: string,
  clubTeams: TeamRow[]
): ParsedMatch[] {
  const configuredTeamNames = new Set(
    clubTeams
      .map((team) => team.arcl_team_name)
      .filter(
        (name): name is string =>
          typeof name === "string" &&
          name.trim().length > 0
      )
      .map(normalize)
  );

  /*
   * Keyed by ARCL's real match_id.
   *
   * If the same match appears in multiple ARCL tables,
   * it becomes ONE match here.
   */
  const matchesById =
    new Map<number, ParsedMatch>();

  const tableRegex =
    /<table\b[^>]*>([\s\S]*?)<\/table>/gi;

  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHtml = tableMatch[1];

    const rawRows: {
      html: string;
      cells: string[];
    }[] = [];

    const rowRegex =
      /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;

    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      rawRows.push({
        html: rowMatch[1],
        cells: getCells(rowMatch[1]),
      });
    }

    if (rawRows.length < 2) {
      continue;
    }

    const indexes =
      getHeaderIndexes(rawRows[0].cells);

    /*
     * Ignore non-game tables.
     */
    if (
      indexes.date === -1 ||
      indexes.team1 === -1 ||
      indexes.team2 === -1
    ) {
      continue;
    }

    for (const row of rawRows.slice(1)) {
      /*
       * This is the key distinction:
       *
       * only rows with an actual ARCL match scorecard ID
       * are treated as real games.
       */
      const arclMatchId =
        extractArclMatchId(row.html);

      if (!arclMatchId) {
        continue;
      }

      const team1Name = valueAt(
        row.cells,
        indexes.team1
      ).trim();

      const team2Name = valueAt(
        row.cells,
        indexes.team2
      ).trim();

      if (!team1Name || !team2Name) {
        continue;
      }

      const belongsToClub =
        configuredTeamNames.has(
          normalize(team1Name)
        ) ||
        configuredTeamNames.has(
          normalize(team2Name)
        );

      if (!belongsToClub) {
        continue;
      }

      const matchDate = parseArclDate(
        valueAt(row.cells, indexes.date)
      );

      if (!matchDate) {
        console.warn(
          `Skipping ARCL match ${arclMatchId}: invalid date`
        );

        continue;
      }

      const candidate: ParsedMatch = {
        arclMatchId,
        matchDate,

        startTime: parseArclTime(
          valueAt(row.cells, indexes.startTime)
        ),

        endTime: parseArclTime(
          valueAt(row.cells, indexes.endTime)
        ),

        ground: nullIfEmpty(
          valueAt(row.cells, indexes.ground)
        ),

        team1Name,
        team2Name,

        matchType: nullIfEmpty(
          valueAt(row.cells, indexes.matchType)
        ),

        division: nullIfEmpty(
          valueAt(row.cells, indexes.division)
        ),

        winnerName: nullIfEmpty(
          valueAt(row.cells, indexes.winner)
        ),

        runnerName: nullIfEmpty(
          valueAt(row.cells, indexes.runner)
        ),

        comment: nullIfEmpty(
          valueAt(row.cells, indexes.comment)
        ),
      };

      const existing =
        matchesById.get(arclMatchId);

      if (!existing) {
        matchesById.set(
          arclMatchId,
          candidate
        );

        continue;
      }

      /*
       * ARCL can show the same game in more than one
       * table. Preserve whichever copy contains the
       * richer result information.
       */
      matchesById.set(arclMatchId, {
        ...existing,

        matchDate:
          candidate.matchDate ||
          existing.matchDate,

        startTime:
          candidate.startTime ??
          existing.startTime,

        endTime:
          candidate.endTime ??
          existing.endTime,

        ground:
          candidate.ground ??
          existing.ground,

        team1Name:
          candidate.team1Name ||
          existing.team1Name,

        team2Name:
          candidate.team2Name ||
          existing.team2Name,

        matchType:
          candidate.matchType ??
          existing.matchType,

        division:
          candidate.division ??
          existing.division,

        winnerName:
          candidate.winnerName ??
          existing.winnerName,

        runnerName:
          candidate.runnerName ??
          existing.runnerName,

        comment:
          candidate.comment ??
          existing.comment,
      });
    }
  }

  return Array.from(
    matchesById.values()
  ).sort((a, b) => {
    const aValue =
      `${a.matchDate} ${a.startTime ?? ""}`;

    const bValue =
      `${b.matchDate} ${b.startTime ?? ""}`;

    return aValue.localeCompare(bValue);
  });
}

async function syncClub(club: ClubRow) {
  if (
    !club.arcl_league_id ||
    !club.arcl_season_id
  ) {
    throw new Error(
      `${club.name} does not have ARCL league/season configuration.`
    );
  }

  /*
   * SERVICE ROLE:
   *
   * Explicit club_id filter is mandatory because
   * service-role queries bypass RLS.
   */
  const {
    data: teams,
    error: teamsError,
  } = await supabaseAdmin
    .from("teams")
    .select(
      `
      id,
      name,
      arcl_team_name
      `
    )
    .eq("club_id", club.id)
    .not("arcl_team_name", "is", null);

  if (teamsError) {
    throw new Error(
      `Unable to load teams for ${club.name}: ${teamsError.message}`
    );
  }

  const clubTeams =
    (teams ?? []) as TeamRow[];

  if (clubTeams.length === 0) {
    throw new Error(
      `${club.name} has no ARCL team mappings.`
    );
  }

  const url =
    `https://arcl.org/Pages/UI/LeagueSchedule.aspx` +
    `?league_id=${club.arcl_league_id}` +
    `&season_id=${club.arcl_season_id}`;

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; CricketClubScheduleSync/1.0)",
      Accept: "text/html",
    },
  });

  if (!response.ok) {
    throw new Error(
      `ARCL returned HTTP ${response.status}.`
    );
  }

  const html = await response.text();

  const matches =
    parseMatches(html, clubTeams);

  /*
   * Map official ARCL names back to our internal
   * teams table IDs.
   */
  const teamIdByArclName =
    new Map<string, string>();

  for (const team of clubTeams) {
    if (team.arcl_team_name) {
      teamIdByArclName.set(
        normalize(team.arcl_team_name),
        team.id
      );
    }
  }

  if (matches.length === 0) {
    return {
      clubId: club.id,
      clubName: club.name,
      leagueId: club.arcl_league_id,
      seasonId: club.arcl_season_id,
      seasonName: club.arcl_season_name,
      configuredTeams: clubTeams.map(
        (team) => team.arcl_team_name
      ),
      matchesFound: 0,
      matchesSynced: 0,
    };
  }

  const now =
    new Date().toISOString();

  const rows = matches.map((match) => ({
    club_id: club.id,

    arcl_league_id:
      club.arcl_league_id,

    arcl_season_id:
      club.arcl_season_id,

    arcl_match_id:
      match.arclMatchId,

    match_date:
      match.matchDate,

    start_time:
      match.startTime,

    end_time:
      match.endTime,

    ground:
      match.ground,

    team1_name:
      match.team1Name,

    team2_name:
      match.team2Name,

    match_type:
      match.matchType,

    division:
      match.division,

    club_team1_id:
      teamIdByArclName.get(
        normalize(match.team1Name)
      ) ?? null,

    club_team2_id:
      teamIdByArclName.get(
        normalize(match.team2Name)
      ) ?? null,

    winner_name:
      match.winnerName,

    runner_name:
      match.runnerName,

    comment:
      match.comment,

    source: "ARCL",

    updated_at: now,
  }));

  /*
   * Upsert using the unique ARCL identity we created:
   *
   * arcl_league_id
   * arcl_season_id
   * arcl_match_id
   *
   * IMPORTANT:
   * Every row explicitly contains club_id.
   */
  const {
    data: syncedRows,
    error: syncError,
  } = await supabaseAdmin
    .from("arcl_matches")
    .upsert(rows, {
      onConflict:
        "arcl_league_id,arcl_season_id,arcl_match_id",
    })
    .select(
      `
      id,
      club_id,
      arcl_match_id,
      match_date,
      start_time,
      end_time,
      ground,
      team1_name,
      team2_name,
      club_team1_id,
      club_team2_id,
      winner_name,
      runner_name
      `
    );

  if (syncError) {
    throw new Error(
      `Unable to sync ARCL matches for ${club.name}: ${syncError.message}`
    );
  }

  return {
    clubId: club.id,
    clubName: club.name,

    leagueId:
      club.arcl_league_id,

    seasonId:
      club.arcl_season_id,

    seasonName:
      club.arcl_season_name,

    configuredTeams:
      clubTeams.map(
        (team) => team.arcl_team_name
      ),

    matchesFound:
      matches.length,

    matchesSynced:
      syncedRows?.length ?? 0,

    matches:
      syncedRows ?? [],
  };
}

/*
 * =========================================================
 * POST /api/arcl/sync
 *
 * Authenticated Admin sync.
 *
 * No club ID is accepted from the browser.
 * The club is resolved from the authenticated user's
 * profile, preventing an Admin from asking the endpoint
 * to sync another club.
 * =========================================================
 */

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
            "You must be signed in to sync the ARCL schedule.",
        },
        { status: 401 }
      );
    }

    /*
     * Validate the user's Supabase access token.
     */
    const {
      data: userData,
      error: userError,
    } = await supabaseAdmin.auth.getUser(
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

    /*
     * SERVICE ROLE:
     *
     * Resolve the caller's club from profiles.
     * Do NOT trust a club ID supplied by the client.
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
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "ARCL profile lookup error:",
        profileError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load your club profile.",
        },
        { status: 500 }
      );
    }

    if (
      !profile ||
      !profile.club_id
    ) {
      return NextResponse.json(
        {
          error:
            "Your account is not associated with a club.",
        },
        { status: 409 }
      );
    }

    if (profile.app_role !== "Admin") {
      return NextResponse.json(
        {
          error:
            "Only club Admins can sync the ARCL schedule.",
        },
        { status: 403 }
      );
    }

    /*
     * Explicitly fetch ONLY the caller's club.
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
      .eq("id", profile.club_id)
      .maybeSingle<ClubRow>();

    if (clubError) {
      console.error(
        "ARCL club lookup error:",
        clubError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load your club's ARCL configuration.",
        },
        { status: 500 }
      );
    }

    if (!club) {
      return NextResponse.json(
        {
          error:
            "Your club could not be found.",
        },
        { status: 404 }
      );
    }

    const result =
      await syncClub(club);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "ARCL sync API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to sync ARCL schedule.",
      },
      { status: 500 }
    );
  }
}
