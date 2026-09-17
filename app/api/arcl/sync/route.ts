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
  arclMatchId: number | null;
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

function parseOriginalDateMetadata(value: string) {
  const match = value
    .trim()
    .match(/^Original:\s*(\d{1,2}\/\d{1,2}\/\d{4})$/i);

  if (!match) return null;

  return parseArclDate(match[1]);
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
function isLeagueScheduleTable(headers: string[]) {
  const normalizedHeaders = headers.map(normalize);

  /*
   * We intentionally sync ONLY ARCL's League Schedule table.
   *
   * League Schedule contains:
   * Date, Team1, Team2, Umpire, Match Type,
   * Winner, Runner and Comment.
   *
   * Upcoming Games and Umpiring Assignments are ignored.
   */
  return (
    normalizedHeaders.includes("date") &&
    normalizedHeaders.includes("team1") &&
    normalizedHeaders.includes("team2") &&
    normalizedHeaders.includes("winner") &&
    normalizedHeaders.includes("runner") &&
    normalizedHeaders.includes("comment")
  );
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

function scheduleKey(match: {
  matchDate: string;
  startTime: string | null;
  team1Name: string;
  team2Name: string;
}) {
  return [
    match.matchDate,
    match.startTime ?? "",
    normalize(match.team1Name),
    normalize(match.team2Name),
  ].join("|");
}

function parseMatches(
  html: string,
  clubTeams: TeamRow[]
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

  type ParsedLeagueRow = {
    match: ParsedMatch;
    originalDate: string | null;
  };

  const parsedLeagueRows: ParsedLeagueRow[] = [];

  const tableRegex =
    /<table\b[^>]*>([\s\S]*?)<\/table>/gi;

  let tableMatch: RegExpExecArray | null;
  let leagueTablesSeen = 0;
  let leagueRowsSeen = 0;
  let originalMetadataRowsSeen = 0;
  let originalMetadataRowsSuppressed = 0;

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

    const headers = rawRows[0].cells;

    // Permanent rule: ONLY League Schedule is a match source.
    if (!isLeagueScheduleTable(headers)) {
      continue;
    }

    leagueTablesSeen += 1;

    const indexes = getHeaderIndexes(headers);

    if (
      indexes.date === -1 ||
      indexes.team1 === -1 ||
      indexes.team2 === -1
    ) {
      continue;
    }

    for (const row of rawRows.slice(1)) {
      leagueRowsSeen += 1;

      const team1Name =
        valueAt(row.cells, indexes.team1).trim();

      const team2Name =
        valueAt(row.cells, indexes.team2).trim();

      if (!team1Name || !team2Name) {
        continue;
      }

      /*
       * Club qualification is ONLY Team1/Team2.
       * Umpire/Umpire2 never makes this a scorecard match.
       */
      const belongsToClub =
        configuredTeamNames.has(normalize(team1Name)) ||
        configuredTeamNames.has(normalize(team2Name));

      if (!belongsToClub) {
        continue;
      }

      const matchDate =
        parseArclDate(valueAt(row.cells, indexes.date));

      if (!matchDate) {
        continue;
      }

      const rawUmpire2 =
        valueAt(row.cells, indexes.umpire2);

      /*
       * ARCL sometimes places schedule metadata such as
       * "Original: 09/12/2026" in the Umpire2 column.
       *
       * This is NOT an umpire name. We retain the date temporarily
       * so that a second pass can determine whether this row is an
       * alternate/reschedule representation of an original League
       * Schedule row already present for the same two teams.
       */
      const originalDate =
        parseOriginalDateMetadata(rawUmpire2);

      if (originalDate) {
        originalMetadataRowsSeen += 1;
      }

      const candidate: ParsedMatch = {
        arclMatchId: extractArclMatchId(row.html),

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

        // Retained for future automatic umpiring reminders.
        umpireName: nullIfEmpty(
          valueAt(row.cells, indexes.umpire)
        ),

        // "Original: <date>" is ARCL metadata, never an umpire.
        umpire2Name: originalDate
          ? null
          : nullIfEmpty(rawUmpire2),

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

      parsedLeagueRows.push({
        match: candidate,
        originalDate,
      });
    }
  }

  /*
   * Build a lookup of ordinary League Schedule rows by:
   * original date + unordered team pair.
   *
   * Team order is intentionally ignored here because ARCL could
   * reverse Team1/Team2 when representing the same fixture.
   */
  function fixtureKey(
    matchDate: string,
    team1Name: string,
    team2Name: string
  ) {
    const teams = [
      normalize(team1Name),
      normalize(team2Name),
    ].sort();

    return [
      matchDate,
      teams[0],
      teams[1],
    ].join("|");
  }

  const ordinaryFixtureKeys = new Set<string>();

  for (const row of parsedLeagueRows) {
    if (!row.originalDate) {
      ordinaryFixtureKeys.add(
        fixtureKey(
          row.match.matchDate,
          row.match.team1Name,
          row.match.team2Name
        )
      );
    }
  }

  const byIdentity = new Map<string, ParsedMatch>();

  for (const row of parsedLeagueRows) {
    const candidate = row.match;

    /*
     * If ARCL explicitly says "Original: <date>" AND the League
     * Schedule also contains the same fixture on that original
     * date, the metadata row is an alternate/reschedule artifact.
     *
     * Suppress only in that evidence-backed case.
     *
     * If the original fixture is NOT present, keep this row rather
     * than guessing. This protects legitimate reschedules for other
     * clubs/seasons.
     */
    if (
      row.originalDate &&
      ordinaryFixtureKeys.has(
        fixtureKey(
          row.originalDate,
          candidate.team1Name,
          candidate.team2Name
        )
      )
    ) {
      originalMetadataRowsSuppressed += 1;
      continue;
    }

    const identity = candidate.arclMatchId
      ? `id:${candidate.arclMatchId}`
      : `schedule:${scheduleKey(candidate)}`;

    const existing = byIdentity.get(identity);

    if (!existing) {
      byIdentity.set(identity, candidate);
    } else {
      byIdentity.set(identity, {
        ...existing,
        ...candidate,
        winnerName:
          candidate.winnerName ?? existing.winnerName,
        runnerName:
          candidate.runnerName ?? existing.runnerName,
        comment:
          candidate.comment ?? existing.comment,
        umpireName:
          candidate.umpireName ?? existing.umpireName,
        umpire2Name:
          candidate.umpire2Name ?? existing.umpire2Name,
      });
    }
  }

  const matches = [...byIdentity.values()].sort((a, b) => {
    const aValue =
      `${a.matchDate} ${a.startTime ?? ""}`;

    const bValue =
      `${b.matchDate} ${b.startTime ?? ""}`;

    return aValue.localeCompare(bValue);
  });

  return {
    matches,
    leagueTablesSeen,
    leagueRowsSeen,
    originalMetadataRowsSeen,
    originalMetadataRowsSuppressed,
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

  const clubTeams = (teams ?? []) as TeamRow[];

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

  const {
    matches,
    leagueTablesSeen,
    leagueRowsSeen,
    originalMetadataRowsSeen,
    originalMetadataRowsSuppressed,
  } = parseMatches(
    html,
    clubTeams
  );

  /*
   * Safety guard:
   * Never reconcile/delete data unless we positively found
   * ARCL's League Schedule table.
   */
  if (leagueTablesSeen === 0) {
    throw new Error(
      "ARCL League Schedule table could not be identified. No database changes were made."
    );
  }

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

  /*
   * Load the club's current ARCL rows once.
   * Service role bypasses RLS, so all reads/writes stay
   * explicitly scoped to this club + league + season.
   */
  const {
    data: existingRows,
    error: existingError,
  } = await supabaseAdmin
    .from("arcl_matches")
    .select(`
      id,
      arcl_match_id,
      match_date,
      start_time,
      end_time,
      ground,
      team1_name,
      team2_name,
      umpire_name,
      umpire2_name,
      match_type,
      division,
      club_team1_id,
      club_team2_id,
      winner_name,
      runner_name,
      comment,
      source
    `)
    .eq("club_id", club.id)
    .eq("arcl_league_id", club.arcl_league_id)
    .eq("arcl_season_id", club.arcl_season_id)
    .eq("source", "ARCL");

  if (existingError) {
    throw new Error(
      `Unable to inspect existing ARCL matches for ${club.name}: ${existingError.message}`
    );
  }

  const existingById = new Map<number, any>();
  const existingBySchedule = new Map<string, any>();

  for (const row of existingRows ?? []) {
    if (typeof row.arcl_match_id === "number") {
      existingById.set(row.arcl_match_id, row);
    }

    existingBySchedule.set(
      scheduleKey({
        matchDate: row.match_date,
        startTime: row.start_time,
        team1Name: row.team1_name,
        team2Name: row.team2_name,
      }),
      row
    );
  }

  const now = new Date().toISOString();

  const keptRowIds = new Set<string>();
  const syncedRows: any[] = [];

  for (const match of matches) {
    const key = scheduleKey(match);

    /*
     * Match priority:
     * 1. Existing real ARCL match_id
     * 2. Existing schedule identity
     *
     * #2 promotes an older no-ID future row when ARCL later
     * exposes its real match_id.
     */
    const existing =
      (match.arclMatchId
        ? existingById.get(match.arclMatchId)
        : undefined) ??
      existingBySchedule.get(key);

    const row = {
      club_id: club.id,
      arcl_league_id: club.arcl_league_id,
      arcl_season_id: club.arcl_season_id,
      arcl_match_id: match.arclMatchId,
      match_date: match.matchDate,
      start_time: match.startTime,
      end_time: match.endTime,
      ground: match.ground,
      team1_name: match.team1Name,
      team2_name: match.team2Name,
      umpire_name: match.umpireName,
      umpire2_name: match.umpire2Name,
      match_type: match.matchType,
      division: match.division,
      club_team1_id:
        teamIdByArclName.get(
          normalize(match.team1Name)
        ) ?? null,
      club_team2_id:
        teamIdByArclName.get(
          normalize(match.team2Name)
        ) ?? null,
      winner_name: match.winnerName,
      runner_name: match.runnerName,
      comment: match.comment,
      source: "ARCL",
      updated_at: now,
    };

    if (existing) {
      const {
        data: updated,
        error: updateError,
      } = await supabaseAdmin
        .from("arcl_matches")
        .update(row)
        .eq("club_id", club.id)
        .eq("id", existing.id)
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
        `)
        .single();

      if (updateError) {
        throw new Error(
          `Unable to update ARCL match for ${club.name}: ${updateError.message}`
        );
      }

      keptRowIds.add(updated.id);
      syncedRows.push(updated);

      if (typeof updated.arcl_match_id === "number") {
        existingById.set(
          updated.arcl_match_id,
          updated
        );
      }

      existingBySchedule.set(key, updated);
    } else {
      const {
        data: inserted,
        error: insertError,
      } = await supabaseAdmin
        .from("arcl_matches")
        .insert(row)
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
        `)
        .single();

      if (insertError) {
        throw new Error(
          `Unable to insert ARCL match for ${club.name}: ${insertError.message}`
        );
      }

      keptRowIds.add(inserted.id);
      syncedRows.push(inserted);

      if (typeof inserted.arcl_match_id === "number") {
        existingById.set(
          inserted.arcl_match_id,
          inserted
        );
      }

      existingBySchedule.set(key, inserted);
    }
  }

  /*
   * League Schedule is now our SINGLE SOURCE OF TRUTH.
   *
   * Any ARCL row for this exact club/league/season that is
   * not represented by the current League Schedule result
   * is stale and must be removed.
   *
   * This is what removes old bogus rows such as:
   *   Allstarz vs Bijlee
   *   SuperStarz vs Toofan
   * if ARCL no longer lists them in League Schedule.
   *
   * IMPORTANT:
   * This runs only after League Schedule was positively
   * identified above.
   */
  const staleRowIds =
    (existingRows ?? [])
      .filter(
        (row) => !keptRowIds.has(row.id)
      )
      .map((row) => row.id);

  if (staleRowIds.length > 0) {
    const {
      error: deleteError,
    } = await supabaseAdmin
      .from("arcl_matches")
      .delete()
      .eq("club_id", club.id)
      .eq("arcl_league_id", club.arcl_league_id)
      .eq("arcl_season_id", club.arcl_season_id)
      .eq("source", "ARCL")
      .in("id", staleRowIds);

    if (deleteError) {
      throw new Error(
        `Unable to remove stale ARCL matches for ${club.name}: ${deleteError.message}`
      );
    }
  }

  return {
    clubId: club.id,
    clubName: club.name,
    leagueId: club.arcl_league_id,
    seasonId: club.arcl_season_id,
    seasonName: club.arcl_season_name,

    configuredTeams:
      clubTeams.map(
        (team) => team.arcl_team_name
      ),

    sourceSection: "League Schedule",
    leagueTablesSeen,
    leagueRowsSeen,
    originalMetadataRowsSeen,
    originalMetadataRowsSuppressed,
    matchesFound: matches.length,
    matchesSynced: syncedRows.length,
    staleMatchesRemoved: staleRowIds.length,
    matches: syncedRows,
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


