import Link from "next/link";
import { notFound } from "next/navigation";
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

type RosterMember = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
};

type RosterRow = {
  is_captain: boolean;
  member: RosterMember | null;
};

export default async function TeamDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, name, description")
    .eq("id", id)
    .maybeSingle();

  if (teamError) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <Link href="/teams" className="text-blue-700 hover:underline">
            ← Back to Teams
          </Link>

          <p className="mt-8 rounded-lg bg-red-100 p-4 text-red-700">
            Unable to load team: {teamError.message}
          </p>
        </div>
      </main>
    );
  }

  if (!team) {
    notFound();
  }

  const { data: activeSeason, error: seasonError } = await supabase
    .from("seasons")
    .select("id, name")
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  let roster: RosterRow[] = [];
  let rosterErrorMessage = "";

  if (activeSeason) {
    const { data, error } = await supabase
      .from("season_team_members")
      .select(`
        is_captain,
        member:members (
          id,
          name,
          email,
          phone,
          role
        )
      `)
      .eq("season_id", activeSeason.id)
      .eq("team_id", id);

    if (error) {
      rosterErrorMessage = error.message;
    } else {
      roster = (data ?? []) as unknown as RosterRow[];
    }
  }

  const captains = roster.filter((row) => row.is_captain);
  const players = roster.filter((row) => !row.is_captain);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/teams" className="text-blue-700 hover:underline">
          ← Back to Teams
        </Link>

        <header className="mt-6 rounded-xl bg-blue-900 p-7 text-white">
          <p className="text-sm font-medium text-blue-200">
            {activeSeason?.name ?? "No active season"}
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            🏏 {(team as Team).name}
          </h1>

          {(team as Team).description && (
            <p className="mt-3 text-blue-100">
              {(team as Team).description}
            </p>
          )}
        </header>

        {seasonError && (
          <p className="mt-6 rounded-lg bg-red-100 p-4 text-red-700">
            Unable to load active season: {seasonError.message}
          </p>
        )}

        {!seasonError && !activeSeason && (
          <p className="mt-6 rounded-lg bg-amber-100 p-4 text-amber-900">
            No active season was found.
          </p>
        )}

        {rosterErrorMessage && (
          <p className="mt-6 rounded-lg bg-red-100 p-4 text-red-700">
            Unable to load roster: {rosterErrorMessage}
          </p>
        )}

        {!rosterErrorMessage && activeSeason && roster.length === 0 && (
          <p className="mt-8 text-slate-600">
            No members have been assigned to this team yet.
          </p>
        )}

        {captains.length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl font-semibold text-slate-900">
              ⭐ Captain
            </h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {captains.map((row) =>
                row.member ? (
                  <MemberCard
                    key={row.member.id}
                    member={row.member}
                    captain
                  />
                ) : null
              )}
            </div>
          </section>
        )}

        {players.length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl font-semibold text-slate-900">
              Players
            </h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {players.map((row) =>
                row.member ? (
                  <MemberCard
                    key={row.member.id}
                    member={row.member}
                  />
                ) : null
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function MemberCard({
  member,
  captain = false,
}: {
  member: RosterMember;
  captain?: boolean;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-blue-900">
        {member.name}
      </h3>

      <p className="mt-1 text-sm font-medium text-slate-600">
        {captain ? "Captain" : member.role || "Player"}
      </p>

      {member.email && (
        <p className="mt-3 break-all text-sm text-slate-600">
          {member.email}
        </p>
      )}

      {member.phone && (
        <p className="mt-1 text-sm text-slate-600">
          {member.phone}
        </p>
      )}
    </article>
  );
}