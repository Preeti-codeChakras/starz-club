import Link from "next/link";
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

export default async function TeamsPage() {
  const [
    teamsResult,
    activeSeasonResult,
  ] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, description")
      .order("name"),

    supabase
      .from("seasons")
      .select("id, name")
      .eq("active", true)
      .limit(1)
      .maybeSingle(),
  ]);

  const teams =
    (teamsResult.data ?? []) as Team[];

  const activeSeason =
    activeSeasonResult.data as Season | null;

  const error =
    teamsResult.error ??
    activeSeasonResult.error;

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

        {error && (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            Unable to load teams: {error.message}
          </p>
        )}

        {!error && teams.length === 0 && (
          <p className="mt-6 text-slate-600">
            No teams found.
          </p>
        )}

        {teams.length > 0 && (
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

                  <div className="mt-6 inline-flex items-center rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100">
  View roster →
</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* TEAM HISTORY CARD */}
        <section className="mt-8">
          <Link
            href="/teams/history"
            className="group block overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-blue-50 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-400 hover:shadow-md"
          >
            <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-3xl">
                  🕘
                </div>

                <div>
                  <p className="text-s font-semibold uppercase tracking-wider text-blue-700 ">
                    Historical comparison
                  </p>

                  <h2 className="mt-1 text-2xl font-bold text-slate-900">
                    Team History
                  </h2>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700 sm:text-base px-5 py-3 font-semibold">
                    Compare team assignments from the
                    previous two seasons and identify
                    players who have repeatedly played
                    together.
                  </p>

                  <p className="mt-3 text-sm text-blue-700 px-5 py-3 font-semibold">
                    This helps the club rotate players and
                    avoid the same groups staying together
                    every season.
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 rounded-xl bg-blue-900 px-5 py-3 font-semibold text-white transition group-hover:bg-blue-800">
                View Team History
                <span className="transition group-hover:translate-x-1">
                  →
                </span>
              </div>
            </div>
          </Link>
        </section>
      </div>
    </main>
  );
}
