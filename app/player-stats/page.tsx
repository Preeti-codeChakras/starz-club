"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type PlayerStats = {
  id: string;
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

type Player = {
  id: string;
  name: string;
  photoUrl: string | null;
  arclPlayerId: string;

  battingMatches: number | null;
  battingRuns: number | null;
  battingBalls: number | null;
  battingFours: number | null;
  battingSixes: number | null;
  battingStrikeRate: number | null;
  battingAverage: number | null;
  batting50s: number | null;
  batting100s: number | null;

  bowlingMatches: number | null;
  bowlingOvers: number | null;
  bowlingMaidens: number | null;
  bowlingRuns: number | null;
  bowlingWickets: number | null;
  bowlingAverage: number | null;
  bowlingEconomy: number | null;
  bowling3w: number | null;
  bowling5w: number | null;

  lastSyncedAt: string;
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

export default function PlayerStatsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    void loadPlayerStats();
  }, []);

  async function loadPlayerStats() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("player_stats")
      .select(`
        id,
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
      .order("batting_runs", {
        ascending: false,
        nullsFirst: false,
      });

    if (error) {
      setMessage(
        `Unable to load player stats: ${error.message}`
      );
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as PlayerStats[];

    const loadedPlayers: Player[] = rows
      .map((row) => {
        const member = Array.isArray(row.members)
          ? row.members[0]
          : row.members;

        if (!member) {
          return null;
        }

        return {
          id: member.id,
          name: member.name,
          photoUrl: member.photo_url,
          arclPlayerId: row.arcl_player_id,

          battingMatches: row.batting_matches,
          battingRuns: row.batting_runs,
          battingBalls: row.batting_balls,
          battingFours: row.batting_fours,
          battingSixes: row.batting_sixes,
          battingStrikeRate: row.batting_strike_rate,
          battingAverage: row.batting_average,
          batting50s: row.batting_50s,
          batting100s: row.batting_100s,

          bowlingMatches: row.bowling_matches,
          bowlingOvers: row.bowling_overs,
          bowlingMaidens: row.bowling_maidens,
          bowlingRuns: row.bowling_runs,
          bowlingWickets: row.bowling_wickets,
          bowlingAverage: row.bowling_average,
          bowlingEconomy: row.bowling_economy,
          bowling3w: row.bowling_3w,
          bowling5w: row.bowling_5w,

          lastSyncedAt: row.last_synced_at,
        };
      })
      .filter((player): player is Player => player !== null);

    setPlayers(loadedPlayers);
    setLoading(false);
  }

  const filteredPlayers = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    if (!searchText) {
      return players;
    }

    return players.filter((player) =>
      player.name.toLowerCase().includes(searchText)
    );
  }, [players, search]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/teams"
          className="text-blue-700 hover:underline"
        >
          ← Back to Teams
        </Link>

        <header className="mt-6">
          <h1 className="text-3xl font-bold text-blue-900 sm:text-4xl">
            📊 Player Stats
          </h1>

          <p className="mt-3 max-w-3xl text-slate-600">
            Batting and bowling statistics for Starz Club
            players, synced from ARCL.
          </p>
        </header>

        <div className="mt-7">
          <input
            type="search"
            placeholder="Search player..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            className="w-full max-w-md rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        {message && (
          <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {message}
          </p>
        )}

        {loading && (
          <p className="mt-8 text-slate-600">
            Loading player stats…
          </p>
        )}

        {!loading &&
          !message &&
          players.length === 0 && (
            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <div className="text-4xl">🏏</div>

              <h2 className="mt-3 text-xl font-semibold text-slate-900">
                No player statistics yet
              </h2>

              <p className="mt-2 text-sm text-slate-600">
                Add an ARCL Player Profile to a member and
                run the ARCL stats sync.
              </p>
            </div>
          )}

        {!loading &&
          players.length > 0 &&
          filteredPlayers.length === 0 && (
            <p className="mt-8 text-slate-600">
              No players match your search.
            </p>
          )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredPlayers.map((player) => (
          <article
  key={player.id}
  className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-md"
>
  {/* PLAYER HEADER */}
  <div className="flex items-center gap-3">
    {player.photoUrl ? (
      <img
        src={player.photoUrl}
        alt={`${player.name} profile`}
        className="h-12 w-12 rounded-full object-cover"
      />
    ) : (
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-xl">
        👤
      </div>
    )}

    <div className="min-w-0 flex-1">
      <h2 className="truncate text-lg font-bold text-blue-950">
        {player.name}
      </h2>

      <p className="text-xs text-slate-500">
        ARCL #{player.arclPlayerId}
      </p>
    </div>
  </div>

  {/* QUICK STATS */}
  <div className="mt-4 grid grid-cols-2 gap-3">
    <div className="rounded-xl bg-blue-50 p-3">
      <p className="text-xs font-semibold uppercase text-blue-700">
        Batting
      </p>

      <p className="mt-1 text-lg font-bold text-blue-950">
        {displayNumber(player.battingRuns)} runs
      </p>

      <p className="mt-1 text-xs text-slate-600">
        Avg {displayNumber(player.battingAverage, 2)}
        {" • "}
        SR {displayNumber(player.battingStrikeRate, 2)}
      </p>
    </div>

    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-600">
        Bowling
      </p>

      <p className="mt-1 text-lg font-bold text-slate-900">
        {displayNumber(player.bowlingWickets)} wickets
      </p>

      <p className="mt-1 text-xs text-slate-600">
        Econ {displayNumber(player.bowlingEconomy, 2)}
        {" • "}
        Avg {displayNumber(player.bowlingAverage, 2)}
      </p>
    </div>
  </div>

  {/* FOOTER */}
  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
    <span className="text-xs text-slate-500">
      {displayNumber(player.battingMatches)} matches
    </span>

    <Link
      href={`/player-stats/${player.id}`}
      className="text-sm font-semibold text-blue-700 hover:underline"
    >
      View full stats →
    </Link>
  </div>
</article>

          ))}
        </div>
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
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
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
