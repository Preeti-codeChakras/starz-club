"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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

export default function TeamDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const id =
    typeof params.id === "string"
      ? params.id
      : "";

  const [team, setTeam] =
    useState<Team | null>(null);

  const [activeSeason, setActiveSeason] =
    useState<Season | null>(null);

  const [roster, setRoster] =
    useState<RosterRow[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!id) {
      return;
    }

    async function loadTeam() {
      setLoading(true);
      setError("");

      /*
       * --------------------------------
       * REQUIRE LOGIN
       * --------------------------------
       */

      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/auth");
        router.refresh();
        return;
      }

      /*
       * --------------------------------
       * LOAD TEAM
       * --------------------------------
       */

      const {
        data: teamData,
        error: teamError,
      } =
        await supabase
          .from("teams")
          .select(
            "id, name, description"
          )
          .eq("id", id)
          .maybeSingle();

      if (teamError) {
        setError(
          `Unable to load team: ${teamError.message}`
        );

        setLoading(false);
        return;
      }

      if (!teamData) {
        setError(
          "This team could not be found."
        );

        setLoading(false);
        return;
      }

      setTeam(teamData as Team);

      /*
       * --------------------------------
       * LOAD ACTIVE SEASON
       * --------------------------------
       */

      const {
        data: seasonData,
        error: seasonError,
      } =
        await supabase
          .from("seasons")
          .select("id, name")
          .eq("active", true)
          .limit(1)
          .maybeSingle();

      if (seasonError) {
        setError(
          `Unable to load active season: ${seasonError.message}`
        );

        setLoading(false);
        return;
      }

      setActiveSeason(
        seasonData as Season | null
      );

      if (!seasonData) {
        setRoster([]);
        setLoading(false);
        return;
      }

      /*
       * --------------------------------
       * LOAD TEAM ROSTER
       * --------------------------------
       */

      const {
        data: rosterData,
        error: rosterError,
      } =
        await supabase
          .from(
            "season_team_members"
          )
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
          .eq(
            "season_id",
            seasonData.id
          )
          .eq(
            "team_id",
            id
          );

      if (rosterError) {
        setError(
          `Unable to load roster: ${rosterError.message}`
        );

        setLoading(false);
        return;
      }

      setRoster(
        (rosterData ??
          []) as unknown as RosterRow[]
      );

      setLoading(false);
    }

    void loadTeam();
  }, [id, router]);

  const captains =
    roster.filter(
      (row) =>
        row.is_captain
    );

  const players =
    roster.filter(
      (row) =>
        !row.is_captain
    );

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/teams"
          className="text-blue-700 hover:underline"
        >
          ← Back to Teams
        </Link>

        {/* LOADING */}
        {loading && (
          <div className="mt-10 rounded-xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
            Loading team roster…
          </div>
        )}

        {/* ERROR */}
        {!loading && error && (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
            {error}
          </div>
        )}

        {!loading &&
          !error &&
          team && (
            <>
              {/* TEAM HEADER */}
              <header className="mt-6 rounded-2xl bg-blue-900 p-7 text-white shadow-sm">
                <p className="text-sm font-medium text-blue-200">
                  {activeSeason?.name ??
                    "No active season"}
                </p>

                <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
                  🏏 {team.name}
                </h1>

                {team.description && (
                  <p className="mt-3 text-blue-100">
                    {team.description}
                  </p>
                )}
              </header>

              {/* NO ACTIVE SEASON */}
              {!activeSeason && (
                <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                  No active season was
                  found.
                </p>
              )}

              {/* EMPTY ROSTER */}
              {activeSeason &&
                roster.length ===
                  0 && (
                  <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-600 shadow-sm">
                    No members have
                    been assigned to
                    this team yet.
                  </div>
                )}

              {/* CAPTAINS */}
              {captains.length >
                0 && (
                <section className="mt-10">
                  <h2 className="text-2xl font-semibold text-slate-900">
                    ⭐ Captain
                  </h2>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {captains.map(
                      (row) =>
                        row.member ? (
                          <MemberCard
                            key={
                              row
                                .member
                                .id
                            }
                            member={
                              row.member
                            }
                            captain
                          />
                        ) : null
                    )}
                  </div>
                </section>
              )}

              {/* PLAYERS */}
              {players.length >
                0 && (
                <section className="mt-10">
                  <h2 className="text-2xl font-semibold text-slate-900">
                    Players
                  </h2>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {players.map(
                      (row) =>
                        row.member ? (
                          <MemberCard
                            key={
                              row
                                .member
                                .id
                            }
                            member={
                              row.member
                            }
                          />
                        ) : null
                    )}
                  </div>
                </section>
              )}
            </>
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
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-xl">
          👤
        </div>

        <div>
          <h3 className="text-lg font-semibold text-blue-900">
            {member.name}
          </h3>

          <p className="text-sm font-medium text-slate-500">
            {captain
              ? "Captain"
              : member.role ||
                "Player"}
          </p>
        </div>
      </div>

      {member.email && (
        <p className="mt-4 break-all text-sm text-slate-600">
          ✉️ {member.email}
        </p>
      )}

      {member.phone && (
        <p className="mt-2 text-sm text-slate-600">
          📞 {member.phone}
        </p>
      )}
    </article>
  );
}
