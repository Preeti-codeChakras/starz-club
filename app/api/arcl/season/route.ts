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

type ParsedUmpiringAssignment = {
  arclMatchId: number | null;
  matchDate: string;
  startTime: string | null;
  endTime: string | null;
  ground: string | null;
  team1Name: string;
  team2Name: string;
  responsibleTeamName: string;
  matchType: string | null;
  division: string | null;
};

type SeasonRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
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


function getTimeZoneOffsetMs(
  instant: Date,
  timeZone: string
) {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }
  ).formatToParts(instant);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return asUtc - instant.getTime();
}

function localDateTimeToUtcIso(
  date: string,
  time: string,
  timeZone: string
) {
  const dateMatch = date.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  const timeMatch = time.match(
    /^(\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!dateMatch || !timeMatch) {
    throw new Error(
      `Unable to convert local ARCL time ${date} ${time}.`
    );
  }

  const desiredUtc = Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    Number(timeMatch[3] ?? "0")
  );

  let candidate = desiredUtc;

  // Two passes safely handle normal DST offsets.
  for (let i = 0; i < 2; i += 1) {
    const offset = getTimeZoneOffsetMs(
      new Date(candidate),
      timeZone
    );

    candidate = desiredUtc - offset;
  }

  return new Date(candidate).toISOString();
}

function addDaysToIsoDate(
  date: string,
  days: number
) {
  const [year, month, day] =
    date.split("-").map(Number);

  const value = new Date(
    Date.UTC(year, month - 1, day)
  );

  value.setUTCDate(
    value.getUTCDate() + days
  );

  return value
    .toISOString()
    .slice(0, 10);
}

function umpiringScheduleKey(assignment: {
  matchDate: string;
  startTime: string | null;
  team1Name: string;
  team2Name: string;
  responsibleTeamName: string;
}) {
  return [
    assignment.matchDate,
    assignment.startTime ?? "",
    normalize(assignment.team1Name),
    normalize(assignment.team2Name),
    normalize(assignment.responsibleTeamName),
  ].join("|");
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
    clubPlaying: boolean;
    responsibleUmpiringTeams: string[];
  };

  const parsedLeagueRows: ParsedLeagueRow[] = [];

  const tableRegex =
    /<table\b[^>]*>([\s\S]*?)<\/table>/gi;

  let tableMatch: RegExpExecArray | null;
  let leagueTablesSeen = 0;
  let leagueRowsSeen = 0;
  let originalMetadataRowsSeen = 0;
  let originalMetadataRowsRestored = 0;

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

      // Scorecard relevance remains ONLY Team1/Team2.
      // Umpiring relevance is tracked separately and never turns
      // an umpiring-only row into an arcl_matches row.
      const clubPlaying =
        configuredTeamNames.has(normalize(team1Name)) ||
        configuredTeamNames.has(normalize(team2Name));

      const rawUmpire =
        valueAt(row.cells, indexes.umpire).trim();

      const rawUmpire2 =
        valueAt(row.cells, indexes.umpire2).trim();

      const originalDateMetadata =
        parseOriginalDateMetadata(rawUmpire2);

      const responsibleUmpiringTeams = [
        rawUmpire,
        originalDateMetadata ? "" : rawUmpire2,
      ]
        .filter(
          (name) =>
            Boolean(name) &&
            configuredTeamNames.has(normalize(name))
        )
        .filter(
          (name, index, values) =>
            values.findIndex(
              (candidate) =>
                normalize(candidate) === normalize(name)
            ) === index
        );

      if (
        !clubPlaying &&
        responsibleUmpiringTeams.length === 0
      ) {
        continue;
      }

      const displayedDate =
        parseArclDate(valueAt(row.cells, indexes.date));

      if (!displayedDate) {
        continue;
      }

      /*
       * ARCL can temporarily move a completed match to another
       * date/time so a late scorecard can be entered. In that case
       * it places metadata such as "Original: 09/12/2026" in the
       * Umpire2 column.
       *
       * That value is NOT an umpire. The match belongs to the
       * original fixture date.
       */
      const originalDate =
        originalDateMetadata;

      if (originalDate) {
        originalMetadataRowsSeen += 1;
      }

      const candidate: ParsedMatch = {
        arclMatchId: extractArclMatchId(row.html),

        // Restore ARCL's explicitly supplied original fixture date.
        matchDate: originalDate ?? displayedDate,

        // Keep the displayed time for now. A second pass below
        // restores the original time when the original fixture is
        // also present in League Schedule.
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

        umpireName: nullIfEmpty(rawUmpire),

        // Never store "Original: <date>" as an umpire.
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
        clubPlaying,
        responsibleUmpiringTeams,
      });
    }
  }

  /*
   * Find an ordinary League Schedule row for the same original
   * date + same unordered team pair. If present, it is the safest
   * source for the original start/end time and ground.
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

  const ordinaryFixtures =
    new Map<string, ParsedMatch>();

  for (const row of parsedLeagueRows) {
    if (!row.originalDate) {
      ordinaryFixtures.set(
        fixtureKey(
          row.match.matchDate,
          row.match.team1Name,
          row.match.team2Name
        ),
        row.match
      );
    }
  }

  const byIdentity = new Map<string, ParsedMatch>();

  const umpiringByIdentity =
    new Map<string, ParsedUmpiringAssignment>();

  for (const row of parsedLeagueRows) {
    let candidate = row.match;

    if (row.originalDate) {
      const originalFixture =
        ordinaryFixtures.get(
          fixtureKey(
            row.originalDate,
            candidate.team1Name,
            candidate.team2Name
          )
        );

      if (originalFixture) {
        /*
         * Preserve this row's real ARCL match_id, but restore the
         * actual fixture schedule from the original League Schedule
         * row. This avoids inventing AM/PM rules.
         */
        candidate = {
          ...candidate,
          matchDate: originalFixture.matchDate,
          startTime: originalFixture.startTime,
          endTime: originalFixture.endTime,
          ground:
            originalFixture.ground ?? candidate.ground,
        };

        originalMetadataRowsRestored += 1;
      }
    }

    if (row.clubPlaying) {
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

    for (
      const responsibleTeamName
      of row.responsibleUmpiringTeams
    ) {
      const assignment: ParsedUmpiringAssignment = {
        arclMatchId: candidate.arclMatchId,
        matchDate: candidate.matchDate,
        startTime: candidate.startTime,
        endTime: candidate.endTime,
        ground: candidate.ground,
        team1Name: candidate.team1Name,
        team2Name: candidate.team2Name,
        responsibleTeamName,
        matchType: candidate.matchType,
        division: candidate.division,
      };

      const identity = candidate.arclMatchId
        ? `id:${candidate.arclMatchId}:${normalize(responsibleTeamName)}`
        : `schedule:${umpiringScheduleKey(assignment)}`;

      umpiringByIdentity.set(identity, assignment);
    }
  }

  const matches = [...byIdentity.values()].sort((a, b) => {
    const aValue =
      `${a.matchDate} ${a.startTime ?? ""}`;

    const bValue =
      `${b.matchDate} ${b.startTime ?? ""}`;

    return aValue.localeCompare(bValue);
  });

  const umpiringAssignments =
    [...umpiringByIdentity.values()].sort((a, b) => {
      const aValue =
        `${a.matchDate} ${a.startTime ?? ""}`;

      const bValue =
        `${b.matchDate} ${b.startTime ?? ""}`;

      return aValue.localeCompare(bValue);
    });

  return {
    matches,
    umpiringAssignments,
    leagueTablesSeen,
    leagueRowsSeen,
    originalMetadataRowsSeen,
    originalMetadataRowsRestored,
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
    umpiringAssignments,
    leagueTablesSeen,
    leagueRowsSeen,
    originalMetadataRowsSeen,
    originalMetadataRowsRestored,
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
   * =========================================================
   * ARCL UMPIRING ASSIGNMENTS -> EXISTING EVENTS SYSTEM
   * =========================================================
   *
   * IMPORTANT:
   * - arcl_matches remains PLAYING matches only.
   * - Umpiring-only rows never become scorecard matches.
   * - ARCL umpiring assignments are written to the existing
   *   events table so the existing 7-day / 2-day reminder
   *   Edge Function can keep working unchanged.
   * - Manual umpire_member_id, umpire_status and umpire_notes
   *   are intentionally never overwritten by ARCL sync.
   */

  const {
    data: seasons,
    error: seasonsError,
  } = await supabaseAdmin
    .from("seasons")
    .select(`
      id,
      name,
      start_date,
      end_date
    `)
    .eq("club_id", club.id);

  if (seasonsError) {
    throw new Error(
      `Unable to load internal seasons for ${club.name}: ${seasonsError.message}`
    );
  }

  const internalSeasons =
    (seasons ?? []) as SeasonRow[];

  const {
    data: existingUmpiringEvents,
    error: existingUmpiringError,
  } = await supabaseAdmin
    .from("events")
    .select(`
      id,
      title,
      starts_at,
      ends_at,
      season_id,
      team_id,
      opponent,
      location_name,
      notes,
      umpiring_team_id,
      umpire_member_id,
      umpire_status,
      umpire_notes,
      club_id,
      source,
      arcl_match_id,
      arcl_season_id
    `)
    .eq("club_id", club.id)
    .eq("source", "ARCL")
    .eq("event_type", "Umpiring Assignment")
    .eq("arcl_season_id", club.arcl_season_id);

  if (existingUmpiringError) {
    throw new Error(
      `Unable to inspect existing ARCL umpiring events for ${club.name}: ${existingUmpiringError.message}`
    );
  }

  const existingUmpiringByMatch =
    new Map<string, any>();

  const existingUmpiringBySchedule =
    new Map<string, any>();

  for (const event of existingUmpiringEvents ?? []) {
    if (
      typeof event.arcl_match_id === "number" &&
      event.umpiring_team_id
    ) {
      existingUmpiringByMatch.set(
        `${event.arcl_match_id}|${event.umpiring_team_id}`,
        event
      );
    }

    if (
      event.starts_at &&
      event.umpiring_team_id &&
      event.title
    ) {
      existingUmpiringBySchedule.set(
        [
          event.starts_at,
          event.umpiring_team_id,
          normalize(event.title),
        ].join("|"),
        event
      );
    }
  }

  const keptUmpiringEventIds =
    new Set<string>();

  const syncedUmpiringEvents: any[] = [];

  const skippedUmpiringAssignments: {
    reason: string;
    matchDate: string;
    team1Name: string;
    team2Name: string;
    responsibleTeamName: string;
  }[] = [];

  const clubTimeZone =
    club.timezone || "America/Los_Angeles";

  for (
    const assignment
    of umpiringAssignments
  ) {
    const responsibleTeamId =
      teamIdByArclName.get(
        normalize(
          assignment.responsibleTeamName
        )
      );

    if (!responsibleTeamId) {
      skippedUmpiringAssignments.push({
        reason:
          "Responsible ARCL team is not mapped to a club team.",
        matchDate: assignment.matchDate,
        team1Name: assignment.team1Name,
        team2Name: assignment.team2Name,
        responsibleTeamName:
          assignment.responsibleTeamName,
      });

      continue;
    }

    if (!assignment.startTime) {
      skippedUmpiringAssignments.push({
        reason:
          "ARCL assignment does not have a start time.",
        matchDate: assignment.matchDate,
        team1Name: assignment.team1Name,
        team2Name: assignment.team2Name,
        responsibleTeamName:
          assignment.responsibleTeamName,
      });

      continue;
    }

    /*
     * ARCL season IDs (for example 70) are NOT our internal
     * seasons UUIDs. Resolve the internal season by the actual
     * fixture date so the existing reminder function can find
     * season_team_members correctly.
     */
    const internalSeason =
      internalSeasons.find(
        (season) =>
          assignment.matchDate >= season.start_date &&
          assignment.matchDate <= season.end_date
      );

    if (!internalSeason) {
      skippedUmpiringAssignments.push({
        reason:
          "No internal club season contains this ARCL fixture date.",
        matchDate: assignment.matchDate,
        team1Name: assignment.team1Name,
        team2Name: assignment.team2Name,
        responsibleTeamName:
          assignment.responsibleTeamName,
      });

      continue;
    }

    const startsAt =
      localDateTimeToUtcIso(
        assignment.matchDate,
        assignment.startTime,
        clubTimeZone
      );

    let endsAt: string | null = null;

    if (assignment.endTime) {
      let endDate =
        assignment.matchDate;

      if (
        assignment.endTime <=
        assignment.startTime
      ) {
        endDate =
          addDaysToIsoDate(
            assignment.matchDate,
            1
          );
      }

      endsAt =
        localDateTimeToUtcIso(
          endDate,
          assignment.endTime,
          clubTimeZone
        );
    }

    const title =
      `Umpiring - ${assignment.team1Name} vs ${assignment.team2Name}`;

    const scheduleIdentity = [
      startsAt,
      responsibleTeamId,
      normalize(title),
    ].join("|");

    const matchIdentity =
      assignment.arclMatchId
        ? `${assignment.arclMatchId}|${responsibleTeamId}`
        : null;

    /*
     * Match priority mirrors arcl_matches:
     * 1. Existing real ARCL match ID + responsible team.
     * 2. Existing schedule identity.
     *
     * #2 lets a future no-ID assignment be promoted when ARCL
     * later exposes the real match_id.
     */
    const existing =
      (matchIdentity
        ? existingUmpiringByMatch.get(
            matchIdentity
          )
        : undefined) ??
      existingUmpiringBySchedule.get(
        scheduleIdentity
      );

    const eventRow = {
      club_id: club.id,
      title,
      event_type: "Umpiring Assignment",
      starts_at: startsAt,
      ends_at: endsAt,
      season_id: internalSeason.id,

      // Keep both populated for compatibility with the existing
      // schedule UI and reminder function.
      team_id: responsibleTeamId,
      umpiring_team_id:
        responsibleTeamId,

      opponent:
        `${assignment.team1Name} vs ${assignment.team2Name}`,

      location_name:
        assignment.ground ||
        "ARCL venue TBD",

      notes:
        assignment.arclMatchId
          ? `Automatically synced from ARCL League Schedule. ARCL Match #${assignment.arclMatchId}.`
          : "Automatically synced from ARCL League Schedule.",

      source: "ARCL",
      arcl_match_id:
        assignment.arclMatchId,
      arcl_season_id:
        club.arcl_season_id,
    };

    if (existing) {
      const {
        data: updatedEvent,
        error: updateEventError,
      } = await supabaseAdmin
        .from("events")
        .update(eventRow)
        .eq("club_id", club.id)
        .eq("id", existing.id)
        .select(`
          id,
          title,
          starts_at,
          ends_at,
          season_id,
          team_id,
          opponent,
          location_name,
          umpiring_team_id,
          umpire_member_id,
          umpire_status,
          umpire_notes,
          source,
          arcl_match_id,
          arcl_season_id
        `)
        .single();

      if (updateEventError) {
        throw new Error(
          `Unable to update ARCL umpiring assignment for ${club.name}: ${updateEventError.message}`
        );
      }

      keptUmpiringEventIds.add(
        updatedEvent.id
      );

      syncedUmpiringEvents.push(
        updatedEvent
      );

      if (
        typeof updatedEvent.arcl_match_id ===
          "number" &&
        updatedEvent.umpiring_team_id
      ) {
        existingUmpiringByMatch.set(
          `${updatedEvent.arcl_match_id}|${updatedEvent.umpiring_team_id}`,
          updatedEvent
        );
      }

      existingUmpiringBySchedule.set(
        scheduleIdentity,
        updatedEvent
      );
    } else {
      const {
        data: insertedEvent,
        error: insertEventError,
      } = await supabaseAdmin
        .from("events")
        .insert({
          ...eventRow,

          // Only set defaults on first creation. Future ARCL syncs
          // never overwrite the club's assignment/status work.
          umpire_member_id: null,
          umpire_status: "Pending",
          umpire_notes: null,
        })
        .select(`
          id,
          title,
          starts_at,
          ends_at,
          season_id,
          team_id,
          opponent,
          location_name,
          umpiring_team_id,
          umpire_member_id,
          umpire_status,
          umpire_notes,
          source,
          arcl_match_id,
          arcl_season_id
        `)
        .single();

      if (insertEventError) {
        throw new Error(
          `Unable to insert ARCL umpiring assignment for ${club.name}: ${insertEventError.message}`
        );
      }

      keptUmpiringEventIds.add(
        insertedEvent.id
      );

      syncedUmpiringEvents.push(
        insertedEvent
      );

      if (
        typeof insertedEvent.arcl_match_id ===
          "number" &&
        insertedEvent.umpiring_team_id
      ) {
        existingUmpiringByMatch.set(
          `${insertedEvent.arcl_match_id}|${insertedEvent.umpiring_team_id}`,
          insertedEvent
        );
      }

      existingUmpiringBySchedule.set(
        scheduleIdentity,
        insertedEvent
      );
    }
  }

  /*
   * ARCL League Schedule is also the source of truth for
   * ARCL-generated umpiring events for this club/season.
   * Manual events are untouched because this deletion is scoped
   * to source='ARCL' + event_type + club + ARCL season.
   */
  const staleUmpiringEventIds =
    (existingUmpiringEvents ?? [])
      .filter(
        (event) =>
          !keptUmpiringEventIds.has(event.id)
      )
      .map((event) => event.id);

  if (staleUmpiringEventIds.length > 0) {
    const {
      error: deleteUmpiringError,
    } = await supabaseAdmin
      .from("events")
      .delete()
      .eq("club_id", club.id)
      .eq("source", "ARCL")
      .eq(
        "event_type",
        "Umpiring Assignment"
      )
      .eq(
        "arcl_season_id",
        club.arcl_season_id
      )
      .in(
        "id",
        staleUmpiringEventIds
      );

    if (deleteUmpiringError) {
      throw new Error(
        `Unable to remove stale ARCL umpiring assignments for ${club.name}: ${deleteUmpiringError.message}`
      );
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
    originalMetadataRowsRestored,
    matchesFound: matches.length,
    matchesSynced: syncedRows.length,
    staleMatchesRemoved: staleRowIds.length,

    umpiringAssignmentsFound:
      umpiringAssignments.length,
    umpiringAssignmentsSynced:
      syncedUmpiringEvents.length,
    umpiringAssignmentsSkipped:
      skippedUmpiringAssignments.length,
    staleUmpiringAssignmentsRemoved:
      staleUmpiringEventIds.length,

    skippedUmpiringAssignments,
    umpiringAssignments:
      syncedUmpiringEvents,

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
