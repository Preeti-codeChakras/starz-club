import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const STARZ_TEAMS = ["allstarz", "rockstarz", "superstarz"];

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

function getRows(tableHtml: string): string[][] {
  const rows: string[][] = [];
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;

  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const cells: string[] = [];

    const cellRegex =
      /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;

    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      cells.push(cleanText(cellMatch[1]));
    }

    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  return rows;
}

function isOurTeam(teamName: string) {
  return STARZ_TEAMS.includes(teamName.trim().toLowerCase());
}

export async function GET() {
  try {
    const leagueId = 2;
    const seasonId = 70;

    const url =
      `https://arcl.org/Pages/UI/LeagueSchedule.aspx` +
      `?league_id=${leagueId}&season_id=${seasonId}`;

    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; StarzCricketClub/1.0)",
        Accept: "text/html",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          status: response.status,
          error: "ARCL returned a non-success status.",
        },
        { status: 502 }
      );
    }

    const html = await response.text();

    const tableRegex =
      /<table\b[^>]*>([\s\S]*?)<\/table>/gi;

    const matches: {
      date: string;
      startTime: string;
      endTime: string;
      ground: string;
      team1: string;
      team2: string;
      matchType: string;
      division?: string;
      winner?: string;
      runner?: string;
      sourceTable: number;
    }[] = [];

    let tableMatch: RegExpExecArray | null;
    let tableNumber = 0;

    while ((tableMatch = tableRegex.exec(html)) !== null) {
      tableNumber++;

      const rows = getRows(tableMatch[1]);

      if (rows.length < 2) {
        continue;
      }

      /*
       * Use the first row as the table header.
       * This is safer than assuming that Team1/Team2
       * are always at a particular column number.
       */
      const headers = rows[0].map((header) =>
        header.trim().toLowerCase()
      );

      const dateIndex = headers.indexOf("date");
      const startIndex = headers.indexOf("start time");
      const endIndex = headers.indexOf("end time");
      const groundIndex = headers.indexOf("ground");
      const team1Index = headers.indexOf("team1");
      const team2Index = headers.indexOf("team2");
      const matchTypeIndex = headers.indexOf("match type");
      const divisionIndex = headers.indexOf("division");
      const winnerIndex = headers.indexOf("winner");
      const runnerIndex = headers.indexOf("runner");

      // Not a game table.
      if (
        dateIndex === -1 ||
        team1Index === -1 ||
        team2Index === -1
      ) {
        continue;
      }

      for (const row of rows.slice(1)) {
        const team1 = row[team1Index]?.trim() ?? "";
        const team2 = row[team2Index]?.trim() ?? "";

        if (!team1 || !team2) {
          continue;
        }

        // Keep the game if EITHER side is one of our club teams.
        if (!isOurTeam(team1) && !isOurTeam(team2)) {
          continue;
        }

        matches.push({
          date: row[dateIndex]?.trim() ?? "",
          startTime:
            startIndex >= 0
              ? row[startIndex]?.trim() ?? ""
              : "",
          endTime:
            endIndex >= 0
              ? row[endIndex]?.trim() ?? ""
              : "",
          ground:
            groundIndex >= 0
              ? row[groundIndex]?.trim() ?? ""
              : "",
          team1,
          team2,
          matchType:
            matchTypeIndex >= 0
              ? row[matchTypeIndex]?.trim() ?? ""
              : "",
          division:
            divisionIndex >= 0
              ? row[divisionIndex]?.trim() ?? ""
              : undefined,
          winner:
            winnerIndex >= 0
              ? row[winnerIndex]?.trim() ?? ""
              : undefined,
          runner:
            runnerIndex >= 0
              ? row[runnerIndex]?.trim() ?? ""
              : undefined,
          sourceTable: tableNumber,
        });
      }
    }

    /*
     * For this diagnostic response we intentionally return
     * everything first. The same ARCL game may currently appear
     * more than once because ARCL has multiple schedule tables.
     *
     * We want to SEE that before deciding our dedupe rule.
     */
    return NextResponse.json({
      success: true,
      leagueId,
      seasonId,
      starzTeams: STARZ_TEAMS,
      matchCountBeforeDeduplication: matches.length,
      matches,
    });
  } catch (error) {
    console.error("ARCL match parsing test failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown ARCL parsing error",
      },
      { status: 500 }
    );
  }
}
