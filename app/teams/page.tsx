"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Team = {
  id: string;
  name: string;
  description: string | null;
};

type Season = {
  id: string;
  name: string;
};

export default function TeamsPage() {
  const router = useRouter();

  const [teams, setTeams] = useState<Team[]>([]);
  const [activeSeason, setActiveSeason] =
    useState<Season | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTeams() {
      setLoading(true);
      setError("");

      // --------------------------------
      // REQUIRE LOGIN
      // --------------------------------

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/auth");
        router.refresh();
        return;
      }

      // --------------------------------
      // LOAD TEAMS + ACTIVE SEASON
      // --------------------------------

      const [
        teamsResult,
        activeSeasonResult,
      ] = await Promise.all([
        supabase
          .from("teams")
          .select(
            "id, name, description"
          )
          .order("name"),

        supabase
          .from("seasons")
          .select("id, name")
          .eq("active", true)
          .limit(1)
          .maybeSingle(),
      ]);

      if (teamsResult.error) {
        setError(
          `Unable to load teams: ${teamsResult.error.message}`
        );
        setLoading(false);
        return;
      }

      if (activeSeasonResult.error) {
        setError(
          `Unable to load active season: ${activeSeasonResult.error.message}`
        );
        setLoading(false);
        return;
      }

      setTeams(
        (teamsResult.data ?? []) as Team[]
      );

      setActiveSeason(
        activeSeasonResult.data as Season | null
      );

      setLoading(false);
    }

    void loadTeams();
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="text-blue-700 hover:underline"
        >
          ← Back to Home
        </Link>

        <header className="mt-6">
          <h1 className="text-3xl font-bold text-blue-900 sm:text-4xl">
            🏏 Starz Club Teams
          </h1>

          <p className="mt-3 text-slate-600">
            {activeSeason
              ? `${activeSeason.name} teams`
              : "View Starz Club teams and player rosters."}
          </p>
        </header>

        {/* LOADING */}
        {loading && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
            Loading teams…
          </div>
        )}

        {/* ERROR */}
        {!loading && error && (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </p>
        )}

        {/* NO TEAMS */}
        {!loading &&
          !error &&
          teams.length === 0 && (
            <p className="mt-6 text-slate-600">
              No teams found.
            </p>
          )}

        {/* TEAMS */}
        {!loading &&
          !error &&
          teams.length > 0 && (
            <section className="mt-8">
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {teams.map((team) => (
                  <Link
                    key={team.id}
                    href={`/teams/${team.id}`}
                    className="group rounded-2xl border border-blue-100 bg-blue-50 p-7 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-300 hover:bg-blue-100 hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
                        🏏
                      </div>

                      <span className="text-xl text-blue-400 transition group-hover:translate-x-1 group-hover:text-blue-700">
                        →
                      </span>
                    </div>

                    <h2 className="mt-5 text-2xl font-semibold text-blue-900">
                      {team.name}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {team.description ||
                        "Starz Club team"}
                    </p>

                    <div className="mt-6 inline-flex items-center rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition group-hover:bg-blue-100">
                      View roster →
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

        {/* TEAM HISTORY + PLAYER STATS */}
        <section className="mt-8">
          <div className="grid gap-5 lg:grid-cols-2">

            {/* TEAM HISTORY */}
            <Link
              href="/teams/history"
              className="group block overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-blue-50 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-400 hover:shadow-md"
            >
              <div className="flex h-full flex-col justify-between gap-5 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-2xl">
                    🕘
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                      Historical comparison
                    </p>

                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      Team History
                    </h2>

                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      Compare previous season
                      assignments and identify
                      players who have repeatedly
                      played together.
                    </p>

                    <p className="mt-2 text-sm font-medium text-blue-700">
                      Helps rotate players and keep
                      teams fresh each season.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <span className="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-blue-800">
                    View Team History

                    <span className="transition group-hover:translate-x-1">
                      →
                    </span>
                  </span>
                </div>
              </div>
            </Link>

            {/* PLAYER STATS */}
            <Link
              href="/player-stats"
              className="group block overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-blue-50 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-400 hover:shadow-md"
            >
              <div className="flex h-full flex-col justify-between gap-5 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-2xl">
                    📊
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                      Player performance
                    </p>

                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      Player Stats
                    </h2>

                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      View batting and bowling
                      statistics synced from ARCL
                      for Starz Club players.
                    </p>

                    <p className="mt-2 text-sm font-medium text-blue-700">
                      Useful for player development
                      and future team balancing.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <span className="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-blue-800">
                    View Player Stats

                    <span className="transition group-hover:translate-x-1">
                      →
                    </span>
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
