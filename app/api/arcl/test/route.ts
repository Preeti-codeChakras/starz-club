import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

    const html = await response.text();

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      requestedUrl: url,
      finalUrl: response.url,
      htmlLength: html.length,

      containsAllstarz: html
        .toLowerCase()
        .includes("allstarz"),

      containsSuperstarz: html
        .toLowerCase()
        .includes("superstarz"),

      containsRockstarz: html
        .toLowerCase()
        .includes("rockstarz"),

      preview: html.slice(0, 1000),
    });
  } catch (error) {
    console.error("ARCL fetch test failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown ARCL fetch error",
      },
      { status: 500 }
    );
  }
}