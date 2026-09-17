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
  timezone: string | null;
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
  umpireName: string | null;
  umpire2Name: string | null;
  matchType: string | null;
  division: string | null;
  winnerName: string | null;
  runnerName: string | null;
  comment: string | null;
  section: "upcoming" | "league";
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
  const match = value.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/
  );

  if (!match) return null;

  const month = match[1].padStart(2, "0");
  const day = match[2].padStart(2, "0");
  const year = match[3];

  return `${year}-${month}-${day}`;
}

function parseArclTime(value: string) {
  const match = value
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (!match) return null;

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
  const match = rowHtml.match(
    /Matchscorecard\.aspx\?[^"'<>]*match_id=(\d+)/i
  );

  if (!match) return null;

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
    umpire: normalizedHeaders.indexOf("umpire"),
    umpire2: normalizedHeaders.indexOf("umpire2"),
    matchType: normalizedHeaders.indexOf("match type"),
    division: normalizedHeaders.indexOf("division"),
    winner: normalizedHeaders.indexOf("winner"),
    runner: normalizedHeaders.indexOf("runner"),
    comment: normalizedHeaders.indexOf("comment"),
  };
}

function valueAt(cells: string[], index: number) {
  if (index < 0) return "";
  return cells[index] ?? "";
}

/*
 * Find the heading immediately before a table.
 *
 * ARCL currently has sections such as:
 *
 * Umpiring Assignments
 * Upcoming Games
 * League Schedule
 */
function getTableSection(
  html: string,
  tableStartIndex: number
): string {
  const beforeTable = html.slice(
    Math.max(0, tableStartIndex - 5000),
    tableStartIndex
  );

  const headingRegex =
    /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi;

  let match: RegExpExecArray | null;
  let lastHeading = "";

  while ((match = headingRegex.exec(beforeTable)) !== null) {
    lastHeading = cleanText(match[1]);
  }

  return normalize(lastHeading);
}

function getTodayInTimeZone(
  timeZone: string
) {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(new Date());

  const year =
    parts.find((part) => part.type === "year")?.value;

  const month =
    parts.find((part) => part.type === "month")?.value;

  const day =
    parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(
      `Unable to determine current date for timezone ${timeZone}.`
    );
  }

  return `${year}-${month}-${day}`;
}

function parseMatches(
  html: string,
  clubTeams: TeamRow[],
  today: string
) {
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
   * Upcoming Games is authoritative for FUTURE/current
   * schedule information.
   *
   * League Schedule is authoritative for historical
   * completed matches/results.
   */
  const upcomingById =
    new Map<number, ParsedMatch>();

  const historicalById =
    new Map<number, ParsedMatch>();

  const tableRegex =
    /<table\b[^>]*>([\s\S]*?)<\/table>/gi;

  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHtml = tableMatch[1];

    const section =
      getTableSection(html, tableMatch.index);

    /*
     * IMPORTANT:
     *
     * Umpiring Assignments is NOT a playing schedule.
     *
     * A Starz team appearing only in the Umpire column
     * must NEVER create a scorecard match/reminder.
     */
    const isUpcoming =
      section.includes("upcoming games");

    const isLeague =
      section.includes("league schedule");

    if (!isUpcoming && !isLeague) {
      continue;
    }

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

    if (
      indexes.date === -1 ||
      indexes.team1 === -1 ||
      indexes.team2 === -1
    ) {
      continue;
    }

    for (const row of rawRows.slice(1)) {
      const team1Name =
        valueAt(row.cells, indexes.team1).trim();

      const team2Name =
        valueAt(row.cells, indexes.team2).trim();

      if (!team1Name || !team2Name) {
        continue;
      }

      /*
       * SCORECARD QUALIFICATION RULE:
       *
       * ONLY Team1 or Team2 counts.
       *
       * Umpire/Umpire2 NEVER makes this a club
       * scorecard match.
       */
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

      const matchDate =
        parseArclDate(
          valueAt(row.cells, indexes.date)
        );

      if (!matchDate) {
        continue;
      }

      /*
       * Upcoming Games should only supply current/future
       * schedule rows.
       *
       * League Schedule should supply historical rows.
       *
       * This prevents an old/stale League Schedule row
       * from overwriting the current Upcoming Games
       * schedule.
       */
      if (isUpcoming && matchDate < today) {
        continue;
      }

      if (isLeague && matchDate >= today) {
        continue;
      }

      const arclMatchId =
        extractArclMatchId(row.html);

      /*
       * Our arcl_matches table uses ARCL's real match ID
       * as the stable external identity.
       *
       * Rank# playoff placeholders and other rows without
       * an official match ID are intentionally ignored
       * until ARCL creates the real match.
       */
      if (!arclMatchId) {
        console.log(
          `Skipping ARCL row without match_id: ${matchDate} ${team1Name} vs ${team2Name}`
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

        /*
         * Store these for our FUTURE automatic
         * umpiring reminder feature.
         *
         * They do NOT affect belongsToClub above.
         */
        umpireName: nullIfEmpty(
          valueAt(row.cells, indexes.umpire)
        ),

        umpire2Name: nullIfEmpty(
          valueAt(row.cells, indexes.umpire2)
        ),

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

        section:
          isUpcoming
            ? "upcoming"
            : "league",
      };

      if (isUpcoming) {
        upcomingById.set(
          arclMatchId,
          candidate
        );
      } else {
        const existing =
          historicalById.get(arclMatchId);

        /*
         * Historical result tables can sometimes expose
         * the same match more than once.
         *
         * Keep schedule data and enrich result fields.
         */
        if (!existing) {
          historicalById.set(
            arclMatchId,
            candidate
          );
        } else {
          historicalById.set(
            arclMatchId,
            {
              ...existing,

              winnerName:
                candidate.winnerName ??
                existing.winnerName,

              runnerName:
                candidate.runnerName ??
                existing.runnerName,

              comment:
                candidate.comment ??
                existing.comment,

              umpireName:
                candidate.umpireName ??
                existing.umpireName,

              umpire2Name:
                candidate.umpire2Name ??
                existing.umpire2Name,
            }
          );
        }
      }
    }
  }

  const matches = [
    ...historicalById.values(),
    ...upcomingById.values(),
  ].sort((a, b) => {
    const aValue =
      `${a.matchDate} ${a.startTime ?? ""}`;

    const bValue =
      `${b.matchDate} ${b.startTime ?? ""}`;

    return aValue.localeCompare(bValue);
  });

  return {
    matches,

    /*
     * These IDs represent the CURRENT authoritative
     * future Starz playing schedule.
     */
    upcomingMatchIds:
      new Set(upcomingById.keys()),
  };
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
   * Explicit club filter required.
   */
  const {
    data: teams,
    error: teamsError,
  } = await supabaseAdmin
    .from("teams")
    .select(`
      id,
      name,
      arcl_team_name
    `)
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

  const html =
    await response.text();

  const timeZone =
    club.timezone ||
    "America/Los_Angeles";

  const today =
    getTodayInTimeZone(timeZone);

  const {
    matches,
    upcomingMatchIds,
  } = parseMatches(
    html,
    clubTeams,
    today
  );

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

  const now =
    new Date().toISOString();

  const rows =
    matches.map((match) => ({
      club_id:
        club.id,

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

      /*
       * Saved for future umpiring automation.
       */
      umpire_name:
        match.umpireName,

      umpire2_name:
        match.umpire2Name,

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

      source:
        "ARCL",

      updated_at:
        now,
    }));

  let syncedRows: unknown[] = [];

  if (rows.length > 0) {
    const {
      data,
      error: syncError,
    } = await supabaseAdmin
      .from("arcl_matches")
      .upsert(rows, {
        onConflict:
          "arcl_league_id,arcl_season_id,arcl_match_id",
      })
      .select(`
        id,
        club_id,
        arcl_match_id,
        match_date,
        start_time,
        end_time,
        ground,
        team1_name,
        team2_name,
        umpire_name,
        umpire2_name,
        club_team1_id,
        club_team2_id,
        winner_name,
        runner_name
      `);

    if (syncError) {
      throw new Error(
        `Unable to sync ARCL matches for ${club.name}: ${syncError.message}`
      );
    }

    syncedRows =
      data ?? [];
  }

  /*
   * =====================================================
   * REMOVE STALE FUTURE MATCHES
   * =====================================================
   *
   * This is the piece the old sync was missing.
   *
   * Example:
   *
   * ARCL previously had:
   *   Allstarz vs Bijlee
   *
   * but the current Upcoming Games section no longer
   * contains it.
   *
   * The old DB row must not survive and later trigger
   * a false scorecard reminder.
   *
   * Historical matches are NEVER deleted here.
   */
  const {
    data: existingFutureRows,
    error: futureError,
  } = await supabaseAdmin
    .from("arcl_matches")
    .select(`
      id,
      arcl_match_id,
      match_date,
      team1_name,
      team2_name
    `)
    .eq("club_id", club.id)
    .eq(
      "arcl_league_id",
      club.arcl_league_id
    )
    .eq(
      "arcl_season_id",
      club.arcl_season_id
    )
    .eq("source", "ARCL")
    .gte("match_date", today);

  if (futureError) {
    throw new Error(
      `Unable to inspect future ARCL matches for ${club.name}: ${futureError.message}`
    );
  }

  const staleRowIds =
    (existingFutureRows ?? [])
      .filter((row) => {
        if (
          typeof row.arcl_match_id !==
          "number"
        ) {
          return false;
        }

        return !upcomingMatchIds.has(
          row.arcl_match_id
        );
      })
      .map((row) => row.id);

  if (staleRowIds.length > 0) {
    /*
     * Explicit club_id filter remains here even though
     * we already selected the IDs above.
     *
     * Service role bypasses RLS, so we keep every write
     * deliberately club-scoped.
     */
    const {
      error: deleteError,
    } = await supabaseAdmin
      .from("arcl_matches")
      .delete()
      .eq("club_id", club.id)
      .in("id", staleRowIds);

    if (deleteError) {
      throw new Error(
        `Unable to remove stale ARCL matches for ${club.name}: ${deleteError.message}`
      );
    }
  }

  return {
    clubId:
      club.id,

    clubName:
      club.name,

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
      syncedRows.length,

    upcomingMatches:
      upcomingMatchIds.size,

    staleFutureMatchesRemoved:
      staleRowIds.length,

    matches:
      syncedRows,
  };
}

/*
 * =========================================================
 * POST /api/arcl/sync
 * =========================================================
 *
 * Authenticated Admin only.
 *
 * Club is ALWAYS obtained from the signed-in user's
 * profile. We never accept a club ID from the browser.
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
            "You must be signed in to sync the ARCL schedule.",
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
          error:
            "Your sign-in session is invalid or expired.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * SERVICE ROLE:
     *
     * Resolve caller's club from profile.
     * Never trust a client-provided club ID.
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
        "ARCL profile lookup error:",
        profileError
      );

      return NextResponse.json(
        {
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
          error:
            "Only club Admins can sync the ARCL schedule.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * Explicitly fetch ONLY caller's club.
     */
    const {
      data: club,
      error: clubError,
    } = await supabaseAdmin
      .from("clubs")
      .select(`
        id,
        name,
        timezone,
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
        "ARCL club lookup error:",
        clubError
      );

      return NextResponse.json(
        {
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
          error:
            "Your club could not be found.",
        },
        {
          status: 404,
        }
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
      {
        status: 500,
      }
    );
  }
}
