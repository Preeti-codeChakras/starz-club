import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

    /*
     * Diagnostic parser only.
     *
     * Find every HTML table, then every row and cell inside it.
     * This lets us see exactly how ARCL structures its schedule
     * before we build the real parser.
     */
    const tables: {
      tableNumber: number;
      rows: string[][];
    }[] = [];

    const tableRegex = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;

    let tableMatch: RegExpExecArray | null;
    let tableNumber = 0;

    while ((tableMatch = tableRegex.exec(html)) !== null) {
      tableNumber++;

      const tableHtml = tableMatch[1];
      const rows: string[][] = [];

      const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;

      let rowMatch: RegExpExecArray | null;

      while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
        const rowHtml = rowMatch[1];
        const cells: string[] = [];

        const cellRegex =
          /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;

        let cellMatch: RegExpExecArray | null;

        while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
          cells.push(cleanText(cellMatch[1]));
        }

        if (cells.length > 0) {
          rows.push(cells);
        }
      }

      if (rows.length > 0) {
        tables.push({
          tableNumber,
          rows,
        });
      }
    }

    // Show tables containing one of our Starz team names.
    const starzTeams = [
      "allstarz",
      "superstarz",
      "rockstarz",
    ];

    const relevantTables = tables.filter((table) =>
      table.rows.some((row) =>
        row.some((cell) =>
          starzTeams.some((team) =>
            cell.toLowerCase().includes(team)
          )
        )
      )
    );

    return NextResponse.json({
      success: true,
      status: response.status,
      leagueId,
      seasonId,
      htmlLength: html.length,

      totalTablesFound: tables.length,
      relevantTablesFound: relevantTables.length,

      relevantTables,
    });
  } catch (error) {
    console.error("ARCL table parsing test failed:", error);

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
