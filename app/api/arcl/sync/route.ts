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
  // Look at the HTML immediately before this table.
  // ARCL is an older ASP.NET site and its section labels are
  // not guaranteed to be real h1-h6 heading elements.
  const beforeTable = html.slice(
    Math.max(0, tableStartIndex - 8000),
    tableStartIndex
  );

  const visibleText = cleanText(beforeTable).toLowerCase();

  // Find whichever known ARCL section label occurs LAST.
  // The last one is the section this table belongs to.
  const sections = [
    {
      name: "umpiring assignments",
      index: visibleText.lastIndexOf("umpiring assignments"),
    },
    {
      name: "upcoming games",
      index: visibleText.lastIndexOf("upcoming games"),
    },
    {
      name: "league schedule",
      index: visibleText.lastIndexOf("league schedule"),
    },
  ];

  sections.sort((a, b) => b.index - a.index);

  return sections[0]?.index >= 0
    ? sections[0].name
    : "";
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

function scheduleKey(match: Pick<ParsedMatch, "matchDate" | "startTime" | "team1Name" | "team2Name">) {
  return [
    match.matchDate,
    match.startTime ?? "",
    normalize(match.team1Name),
    normalize(match.team2Name),
  ].join("|");
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
          typeof name === "string" && name.trim().length > 0
      )
      .map(normalize)
  );

  // Upcoming Games is authoritative for current/future playing schedule.
  // League Schedule is authoritative for historical completed matches/results.
  // Umpiring Assignments is deliberately ignored for scorecard reminders.
  const upcomingByKey = new Map<string, ParsedMatch>();
  const historicalById = new Map<number, ParsedMatch>();

  const tableRegex = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHtml = tableMatch[1];
    const section = getTableSection(html, tableMatch.index);
    const isUpcoming = section.includes("upcoming games");
    const isLeague = section.includes("league schedule");

    if (!isUpcoming && !isLeague) continue;

    const rawRows: { html: string; cells: string[] }[] = [];
    const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      rawRows.push({
        html: rowMatch[1],
        cells: getCells(rowMatch[1]),
      });
    }

    if (rawRows.length < 2) continue;

    const indexes = getHeaderIndexes(rawRows[0].cells);
    if (indexes.date === -1 || indexes.team1 === -1 || indexes.team2 === -1) {
      continue;
    }

    for (const row of rawRows.slice(1)) {
      const team1Name = valueAt(row.cells, indexes.team1).trim();
      const team2Name = valueAt(row.cells, indexes.team2).trim();
      if (!team1Name || !team2Name) continue;

      // Only Team1/Team2 qualify a game for scorecard reminders.
      // A Starz team appearing only as Umpire/Umpire2 does not qualify.
      const belongsToClub =
        configuredTeamNames.has(normalize(team1Name)) ||
        configuredTeamNames.has(normalize(team2Name));
      if (!belongsToClub) continue;

      const matchDate = parseArclDate(valueAt(row.cells, indexes.date));
      if (!matchDate) continue;

      if (isUpcoming && matchDate < today) continue;
      if (isLeague && matchDate >= today) continue;

      const candidate: ParsedMatch = {
        // Upcoming rows may legitimately have no scorecard link/match_id yet.
        arclMatchId: extractArclMatchId(row.html),
        matchDate,
        startTime: parseArclTime(valueAt(row.cells, indexes.startTime)),
        endTime: parseArclTime(valueAt(row.cells, indexes.endTime)),
        ground: nullIfEmpty(valueAt(row.cells, indexes.ground)),
        team1Name,
        team2Name,
        umpireName: nullIfEmpty(valueAt(row.cells, indexes.umpire)),
        umpire2Name: nullIfEmpty(valueAt(row.cells, indexes.umpire2)),
        matchType: nullIfEmpty(valueAt(row.cells, indexes.matchType)),
        division: nullIfEmpty(valueAt(row.cells, indexes.division)),
        winnerName: nullIfEmpty(valueAt(row.cells, indexes.winner)),
        runnerName: nullIfEmpty(valueAt(row.cells, indexes.runner)),
        comment: nullIfEmpty(valueAt(row.cells, indexes.comment)),
        section: isUpcoming ? "upcoming" : "league",
      };

      if (isUpcoming) {
        // Stable identity while ARCL has not exposed a match_id yet.
        upcomingByKey.set(scheduleKey(candidate), candidate);
      } else {
        // Historical League Schedule rows should have a real ARCL match ID.
        if (!candidate.arclMatchId) {
          console.log(
            `Skipping historical ARCL row without match_id: ${matchDate} ${team1Name} vs ${team2Name}`
          );
          continue;
        }

        const existing = historicalById.get(candidate.arclMatchId);
        if (!existing) {
          historicalById.set(candidate.arclMatchId, candidate);
        } else {
          historicalById.set(candidate.arclMatchId, {
            ...existing,
            winnerName: candidate.winnerName ?? existing.winnerName,
            runnerName: candidate.runnerName ?? existing.runnerName,
            comment: candidate.comment ?? existing.comment,
            umpireName: candidate.umpireName ?? existing.umpireName,
            umpire2Name: candidate.umpire2Name ?? existing.umpire2Name,
          });
        }
      }
    }
  }

  const matches = [
    ...historicalById.values(),
    ...upcomingByKey.values(),
  ].sort((a, b) =>
    `${a.matchDate} ${a.startTime ?? ""}`.localeCompare(
      `${b.matchDate} ${b.startTime ?? ""}`
    )
  );

  return {
    matches,
    // This is the authoritative set of future playing slots from Upcoming Games.
    upcomingScheduleKeys: new Set(upcomingByKey.keys()),
  };
}

async function syncClub(club: ClubRow) {
  if (!club.arcl_league_id || !club.arcl_season_id) {
    throw new Error(
      `${club.name} does not have ARCL league/season configuration.`
    );
  }

  const { data: teams, error: teamsError } = await supabaseAdmin
    .from("teams")
    .select(`id, name, arcl_team_name`)
    .eq("club_id", club.id)
    .not("arcl_team_name", "is", null);

  if (teamsError) {
    throw new Error(
      `Unable to load teams for ${club.name}: ${teamsError.message}`
    );
  }

  const clubTeams = (teams ?? []) as TeamRow[];
  if (clubTeams.length === 0) {
    throw new Error(`${club.name} has no ARCL team mappings.`);
  }

  const url =
    `https://arcl.org/Pages/UI/LeagueSchedule.aspx` +
    `?league_id=${club.arcl_league_id}` +
    `&season_id=${club.arcl_season_id}`;

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; CricketClubScheduleSync/1.0)",
      Accept: "text/html",
    },
  });

  if (!response.ok) {
    throw new Error(`ARCL returned HTTP ${response.status}.`);
  }

  const html = await response.text();
  const timeZone = club.timezone || "America/Los_Angeles";
  const today = getTodayInTimeZone(timeZone);
  const { matches, upcomingScheduleKeys } = parseMatches(
    html,
    clubTeams,
    today
  );

  const teamIdByArclName = new Map<string, string>();
  for (const team of clubTeams) {
    if (team.arcl_team_name) {
      teamIdByArclName.set(normalize(team.arcl_team_name), team.id);
    }
  }

  const now = new Date().toISOString();

  const makeRow = (match: ParsedMatch) => ({
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
      teamIdByArclName.get(normalize(match.team1Name)) ?? null,
    club_team2_id:
      teamIdByArclName.get(normalize(match.team2Name)) ?? null,
    winner_name: match.winnerName,
    runner_name: match.runnerName,
    comment: match.comment,
    source: "ARCL",
    updated_at: now,
  });

  const syncedRows: unknown[] = [];

  // 1) Save historical/official-ID matches.
  // Before upserting an ID match, promote an existing no-ID row for the same
  // schedule slot if ARCL has since exposed its official match ID.
  for (const match of matches.filter((m) => m.arclMatchId !== null)) {
    const row = makeRow(match);

    let noIdLookup = supabaseAdmin
      .from("arcl_matches")
      .select("id")
      .eq("club_id", club.id)
      .eq("arcl_league_id", club.arcl_league_id)
      .eq("arcl_season_id", club.arcl_season_id)
      .eq("match_date", match.matchDate)
      .ilike("team1_name", match.team1Name)
      .ilike("team2_name", match.team2Name)
      .is("arcl_match_id", null);

    noIdLookup =
      match.startTime === null
        ? noIdLookup.is("start_time", null)
        : noIdLookup.eq("start_time", match.startTime);

    const { data: noIdExisting, error: noIdLookupError } =
      await noIdLookup.maybeSingle();

    if (noIdLookupError) {
      throw new Error(
        `Unable to inspect pending ARCL match for ${club.name}: ${noIdLookupError.message}`
      );
    }

    if (noIdExisting) {
      const { data, error } = await supabaseAdmin
        .from("arcl_matches")
        .update(row)
        .eq("club_id", club.id)
        .eq("id", noIdExisting.id)
        .select();

      if (error) {
        throw new Error(
          `Unable to promote ARCL match for ${club.name}: ${error.message}`
        );
      }
      syncedRows.push(...(data ?? []));
      continue;
    }

    const { data, error } = await supabaseAdmin
      .from("arcl_matches")
      .upsert(row, {
        onConflict: "arcl_league_id,arcl_season_id,arcl_match_id",
      })
      .select();

    if (error) {
      throw new Error(
        `Unable to sync ARCL match for ${club.name}: ${error.message}`
      );
    }
    syncedRows.push(...(data ?? []));
  }

  // 2) Save current/future Upcoming Games that do not yet have match_id.
  // We intentionally do manual lookup/update/insert here because the database
  // uniqueness rule for these rows is a PARTIAL unique index (WHERE match_id IS NULL).
  for (const match of matches.filter((m) => m.arclMatchId === null)) {
    const row = makeRow(match);

    let lookup = supabaseAdmin
      .from("arcl_matches")
      .select("id")
      .eq("club_id", club.id)
      .eq("arcl_league_id", club.arcl_league_id)
      .eq("arcl_season_id", club.arcl_season_id)
      .eq("match_date", match.matchDate)
      .ilike("team1_name", match.team1Name)
      .ilike("team2_name", match.team2Name)
      .is("arcl_match_id", null);

    lookup = match.startTime === null
      ? lookup.is("start_time", null)
      : lookup.eq("start_time", match.startTime);

    const { data: existing, error: lookupError } = await lookup.maybeSingle();

    if (lookupError) {
      throw new Error(
        `Unable to inspect upcoming ARCL match for ${club.name}: ${lookupError.message}`
      );
    }

    if (existing) {
      const { data, error } = await supabaseAdmin
        .from("arcl_matches")
        .update(row)
        .eq("club_id", club.id)
        .eq("id", existing.id)
        .select();

      if (error) {
        throw new Error(
          `Unable to update upcoming ARCL match for ${club.name}: ${error.message}`
        );
      }
      syncedRows.push(...(data ?? []));
    } else {
      const { data, error } = await supabaseAdmin
        .from("arcl_matches")
        .insert(row)
        .select();

      if (error) {
        throw new Error(
          `Unable to insert upcoming ARCL match for ${club.name}: ${error.message}`
        );
      }
      syncedRows.push(...(data ?? []));
    }
  }

  // 3) Remove stale future rows using the CURRENT Upcoming Games schedule,
  // regardless of whether those rows already have a match_id.
  const { data: existingFutureRows, error: futureError } = await supabaseAdmin
    .from("arcl_matches")
    .select(`id, arcl_match_id, match_date, start_time, team1_name, team2_name`)
    .eq("club_id", club.id)
    .eq("arcl_league_id", club.arcl_league_id)
    .eq("arcl_season_id", club.arcl_season_id)
    .eq("source", "ARCL")
    .gte("match_date", today);

  if (futureError) {
    throw new Error(
      `Unable to inspect future ARCL matches for ${club.name}: ${futureError.message}`
    );
  }

  const staleRowIds = (existingFutureRows ?? [])
    .filter((row) => {
      const key = scheduleKey({
        matchDate: row.match_date,
        startTime: row.start_time,
        team1Name: row.team1_name,
        team2Name: row.team2_name,
      });
      return !upcomingScheduleKeys.has(key);
    })
    .map((row) => row.id);

  if (staleRowIds.length > 0) {
    const { error: deleteError } = await supabaseAdmin
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
    clubId: club.id,
    clubName: club.name,
    leagueId: club.arcl_league_id,
    seasonId: club.arcl_season_id,
    seasonName: club.arcl_season_name,
    configuredTeams: clubTeams.map((team) => team.arcl_team_name),
    matchesFound: matches.length,
    matchesSynced: syncedRows.length,
    upcomingMatches: upcomingScheduleKeys.size,
    staleFutureMatchesRemoved: staleRowIds.length,
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
