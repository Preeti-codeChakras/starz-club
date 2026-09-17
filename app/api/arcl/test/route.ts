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

function isOurTeam(value: string) {
  return STARZ_TEAMS.includes(value.trim().toLowerCase());
}

function extractLinks(html: string) {
  const links: { text: string; href: string }[] = [];

  const linkRegex =
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    links.push({
      href: match[1]
        .replace(/&amp;/gi, "&")
        .trim(),
      text: cleanText(match[2]),
    });
  }

  return links;
}

export async function GET() {
  try {
    const leagueId = 2;
    const seasonId = 70;

    const url =
      `https://arcl.org/Pages/UI/LeagueSchedule.aspx` +
      `?league_id=${leagueId}&season_id=${seasonId}`;

    const response = await fetch(url, {
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

    const results: {
      tableNumber: number;
      rowNumber: number;
      cells: string[];
      links: {
        text: string;
        href: string;
      }[];
    }[] = [];

    let tableMatch: RegExpExecArray | null;
    let tableNumber = 0;

    while ((tableMatch = tableRegex.exec(html)) !== null) {
      tableNumber++;

      const tableHtml = tableMatch[1];

      const rowRegex =
        /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;

      let rowMatch: RegExpExecArray | null;
      let rowNumber = 0;

      while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
        rowNumber++;

        const rowHtml = rowMatch[1];

        const cells: string[] = [];

        const cellRegex =
          /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;

        let cellMatch: RegExpExecArray | null;

        while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
          cells.push(cleanText(cellMatch[1]));
        }

        const containsStarzTeam = cells.some((cell) =>
          isOurTeam(cell)
        );

        if (!containsStarzTeam) {
          continue;
        }

        results.push({
          tableNumber,
          rowNumber,
          cells,
          links: extractLinks(rowHtml),
        });
      }
    }

    const hrefsWithPossibleIds = results
      .flatMap((row) => row.links)
      .filter((link) =>
        /(game|match|schedule|score|id)=/i.test(link.href)
      );

    return NextResponse.json({
      success: true,
      leagueId,
      seasonId,

      rowsContainingStarzTeams: results.length,

      possibleGameLinksFound:
        hrefsWithPossibleIds.length,

      possibleGameLinks: hrefsWithPossibleIds,

      rows: results,
    });
  } catch (error) {
    console.error(
      "ARCL game ID diagnostic failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown ARCL diagnostic error",
      },
      { status: 500 }
    );
  }
}
