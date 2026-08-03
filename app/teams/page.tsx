import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type Team = {
  id: string;
  name: string;
  description: string | null;
};

export default async function TeamsPage() {
  const { data: teams, error } = await supabase
    .from("teams")
    .select("id, name, description")
    .order("name");

    console.log("teams data :", teams);
    console.log("teams error :", error);
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-blue-700 hover:underline">
          ← Back to Home
        </Link>

        <h1 className="mt-6 text-3xl font-bold text-blue-900">
          🏏 Starz Club Teams
        </h1>

        <p className="mt-3 text-slate-600">
          Summer League 2026 teams
        </p>

        {error && (
          <p className="mt-6 rounded-lg bg-red-100 p-4 text-red-700">
            Unable to load teams: {error.message}
          </p>
        )}

        {!error && (!teams || teams.length === 0) && (
          <p className="mt-6 text-slate-600">No teams found.</p>
        )}

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(teams as Team[] | null)?.map((team) => (
            <Link
  key={team.id}
  href={`/teams/${team.id}`}
  className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
>

  <div className="text-3xl">🏏</div>

  <h2 className="mt-4 text-xl font-semibold text-blue-900">
    {team.name}
  </h2>

  <p className="mt-2 text-slate-600">
    {team.description || "Starz Club team"}
  </p>

  <p className="mt-4 text-sm font-medium text-blue-700">
    View roster →
  </p>
</Link>
          ))}
        </div>
      </div>
    </main>
  );
}