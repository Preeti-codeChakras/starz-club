"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type PlayerStatsRow = {
  member_id: string;
  arcl_player_id: string;

  batting_matches: number | null;
  batting_runs: number | null;
  batting_balls: number | null;
  batting_fours: number | null;
  batting_sixes: number | null;
  batting_strike_rate: number | null;
  batting_average: number | null;
  batting_50s: number | null;
  batting_100s: number | null;

  bowling_matches: number | null;
  bowling_overs: number | null;
  bowling_maidens: number | null;
  bowling_runs: number | null;
  bowling_wickets: number | null;
  bowling_average: number | null;
  bowling_economy: number | null;
  bowling_3w: number | null;
  bowling_5w: number | null;

  last_synced_at: string;

  members:
    | {
        id: string;
        name: string;
        photo_url: string | null;
      }
    | {
        id: string;
        name: string;
        photo_url: string | null;
      }[]
    | null;
};

function displayNumber(
  value: number | null,
  decimals?: number
) {
  if (value === null || value === undefined) {
    return "—";
  }

  if (decimals !== undefined) {
    return Number(value).toFixed(decimals);
  }

  return String(value);
}

function formatLastSynced(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function PlayerStatsDetailPage() {
  const params = useParams();
  const memberId = params.memberId as string;

  const [row, setRow] =
    useState<PlayerStatsRow | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    if (!memberId) {
      return;
    }

    void loadStats();
  }, [memberId]);

  async function loadStats() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("player_stats")
      .select(`
        member_id,
        arcl_player_id,

        batting_matches,
        batting_runs,
        batting_balls,
        batting_fours,
        batting_sixes,
        batting_strike_rate,
        batting_average,
        batting_50s,
        batting_100s,

        bowling_matches,
        bowling_overs,
        bowling_maidens,
        bowling_runs,
        bowling_wickets,
        bowling_average,
        bowling_economy,
        bowling_3w,
        bowling_5w,

        last_synced_at,

        members (
          id,
          name,
          photo_url
        )
      `)
      .eq("member_id", memberId)
      .maybeSingle();

    if (error) {
      setMessage(
        `Unable to load player stats: ${error.message}`
      );
      setLoading(false);
      return;
    }

    if (!data) {
      setMessage(
        "No statistics were found for this player."
      );
      setLoading(false);
      return;
    }

    setRow(data as PlayerStatsRow);
    setLoading(false);
  }

  const member = row
    ? Array.isArray(row.members)
      ? row.members[0]
      : row.members
    : null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/player-stats"
          className="text-blue-700 hover:underline"
        >
          ← Back to Player Stats
        </Link>

        {loading && (
          <p className="mt-8 text-slate-600">
            Loading player stats…
          </p>
        )}

        {!loading && message && (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            {message}
          </div>
        )}

        {!loading && row && member && (
          <>
            {/* PLAYER HEADER */}
            <section className="mt-6 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
              <div className="bg-gradient-to-r from-blue-50 via-white to-blue-50 p-6 sm:p-8">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    {member.photo_url ? (
                      <img
                        src={member.photo_url}
                        alt={`${member.name} profile`}
                        className="h-20 w-20 rounded-full object-cover shadow-sm"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-4xl">
                        👤
                      </div>
                    )}

                    <div>
                      <h1 className="text-3xl font-bold text-blue-950">
                        {member.name}
                      </h1>

                      <p className="mt-1 text-sm text-slate-500">
                        ARCL Player #{row.arcl_player_id}
                      </p>
                    </div>
                  </div>

                  <a
                    href={`https://www.arcl.org/Pages/UI/PlayerHistory.aspx?player_id=${row.arcl_player_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
                  >
                    View ARCL Profile ↗
                  </a>
                </div>
              </div>
            </section>

            {/* STATS */}
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {/* BATTING */}
              <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏏</span>

                  <h2 className="text-2xl font-bold text-blue-950">
                    Batting
                  </h2>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <StatBox
                    label="Matches"
                    value={displayNumber(
                      row.batting_matches
                    )}
                  />

                  <StatBox
                    label="Runs"
                    value={displayNumber(
                      row.batting_runs
                    )}
                    emphasized
                  />

                  <StatBox
                    label="Balls"
                    value={displayNumber(
                      row.batting_balls
                    )}
                  />

                  <StatBox
                    label="Average"
                    value={displayNumber(
                      row.batting_average,
                      2
                    )}
                  />

                  <StatBox
                    label="Strike Rate"
                    value={displayNumber(
                      row.batting_strike_rate,
                      2
                    )}
                  />

                  <StatBox
                    label="Fours"
                    value={displayNumber(
                      row.batting_fours
                    )}
                  />

                  <StatBox
                    label="Sixes"
                    value={displayNumber(
                      row.batting_sixes
                    )}
                  />

                  <StatBox
                    label="50s"
                    value={displayNumber(
                      row.batting_50s
                    )}
                  />

                  <StatBox
                    label="100s"
                    value={displayNumber(
                      row.batting_100s
                    )}
                  />
                </div>
              </section>

              {/* BOWLING */}
              <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🎯</span>

                  <h2 className="text-2xl font-bold text-blue-950">
                    Bowling
                  </h2>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <StatBox
                    label="Matches"
                    value={displayNumber(
                      row.bowling_matches
                    )}
                  />

                  <StatBox
                    label="Wickets"
                    value={displayNumber(
                      row.bowling_wickets
                    )}
                    emphasized
                  />

                  <StatBox
                    label="Overs"
                    value={displayNumber(
                      row.bowling_overs
                    )}
                  />

                  <StatBox
                    label="Runs"
                    value={displayNumber(
                      row.bowling_runs
                    )}
                  />

                  <StatBox
                    label="Average"
                    value={displayNumber(
                      row.bowling_average,
                      2
                    )}
                  />

                  <StatBox
                    label="Economy"
                    value={displayNumber(
                      row.bowling_economy,
                      2
                    )}
                  />

                  <StatBox
                    label="Maidens"
                    value={displayNumber(
                      row.bowling_maidens
                    )}
                  />

                  <StatBox
                    label="3W"
                    value={displayNumber(
                      row.bowling_3w
                    )}
                  />

                  <StatBox
                    label="5W"
                    value={displayNumber(
                      row.bowling_5w
                    )}
                  />
                </div>
              </section>
            </div>

            {/* SYNC INFO */}
            <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
              Last synced from ARCL:{" "}
              <span className="font-medium text-slate-700">
                {formatLastSynced(
                  row.last_synced_at
                )}
              </span>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function StatBox({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        emphasized
          ? "border-blue-200 bg-blue-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p
        className={`mt-1 text-xl font-bold ${
          emphasized
            ? "text-blue-900"
            : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
