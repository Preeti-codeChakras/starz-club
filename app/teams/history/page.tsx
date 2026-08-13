"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Season = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
};

type Assignment = {
  season_id: string;
  team_id: string;
  member_id: string;
  is_captain: boolean;
  team: {
    id: string;
    name: string;
  } | null;
  member: {
    id: string;
    name: string;
  } | null;
};

export default function TeamHistoryPage() {
  const router = useRouter();

  const [seasons, setSeasons] =
    useState<Season[]>([]);

  const [assignments, setAssignments] =
    useState<Assignment[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadHistory() {
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
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/auth");
        router.refresh();
        return;
      }

      /*
       * --------------------------------
       * LOAD PREVIOUS SEASONS
       * --------------------------------
       */

      const {
        data: seasonData,
        error: seasonError,
      } = await supabase
        .from("seasons")
        .select("*")
        .eq("active", false)
        .order("start_date", {
          ascending: false,
        })
        .limit(2);

      if (seasonError) {
        setError(
          `Unable to load seasons: ${seasonError.message}`
        );

        setLoading(false);
        return;
      }

      const loadedSeasons =
        (seasonData ?? []) as Season[];

      setSeasons(loadedSeasons);

      if (loadedSeasons.length === 0) {
        setAssignments([]);
        setLoading(false);
        return;
      }

      /*
       * --------------------------------
       * LOAD HISTORICAL ASSIGNMENTS
       * --------------------------------
       */

      const seasonIds =
        loadedSeasons.map(
          (season) => season.id
        );

      const {
        data: assignmentRows,
        error: assignmentError,
      } = await supabase
        .from("season_team_members")
        .select(`
          season_id,
          team_id,
          member_id,
          is_captain,
          team:teams (
            id,
            name
          ),
          member:members (
            id,
            name
          )
        `)
        .in("season_id", seasonIds);

      if (assignmentError) {
        setError(
          `Unable to load team history: ${assignmentError.message}`
        );

        setLoading(false);
        return;
      }

      setAssignments(
        (assignmentRows ??
          []) as unknown as Assignment[]
      );

      setLoading(false);
    }

    void loadHistory();
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/teams"
          className="text-blue-700 hover:underline"
        >
          ← Back to Teams
        </Link>

        <h1 className="mt-6 text-4xl font-bold text-blue-900">
          🕘 Team History
        </h1>

        <p className="mt-3 max-w-3xl text-slate-600">
          Compare the previous two seasons and see
          how players were distributed across teams.
          This page helps ensure players rotate
          instead of remaining together season after
          season.
        </p>

        {/* LOADING */}

        {loading && (
          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
            Loading team history…
          </div>
        )}

        {/* ERROR */}

        {!loading && error && (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
            {error}
          </div>
        )}

        {/* NO COMPLETED SEASONS */}

        {!loading &&
          !error &&
          seasons.length === 0 && (
            <div className="mt-8 rounded-xl border border-slate-200 bg-white p-8">
              No completed seasons found.
            </div>
          )}

        {!loading &&
          !error &&
          seasons.length > 0 && (
            <>
              {/* SEASON CARDS */}

              <div className="mt-10 grid gap-6 xl:grid-cols-2">
                {seasons.map((season) => {
                  const seasonAssignments =
                    assignments.filter(
                      (assignment) =>
                        assignment.season_id ===
                        season.id
                    );

                  return (
                    <SeasonCard
                      key={season.id}
                      season={season}
                      assignments={
                        seasonAssignments
                      }
                    />
                  );
                })}
              </div>

              {/* PAIRING SUMMARY */}

              <div className="mt-12">
                <h2 className="text-2xl font-bold text-slate-900">
                  👥 Repeated Player Pairings
                </h2>

                <p className="mt-2 text-slate-600">
                  Players who appeared together in
                  multiple seasons.
                </p>

                <PairingSummary
                  seasons={seasons}
                  assignments={assignments}
                />
              </div>
            </>
          )}
      </div>
    </main>
  );
}

function SeasonCard({
  season,
  assignments,
}: {
  season: Season;
  assignments: Assignment[];
}) {
  const teamsMap = new Map<
    string,
    {
      id: string;
      name: string;
      players: {
        id: string;
        name: string;
        isCaptain: boolean;
      }[];
    }
  >();

  assignments.forEach((assignment) => {
    if (
      !assignment.team ||
      !assignment.member
    ) {
      return;
    }

    const existingTeam =
      teamsMap.get(
        assignment.team.id
      );

    if (existingTeam) {
      existingTeam.players.push({
        id: assignment.member.id,
        name: assignment.member.name,
        isCaptain:
          assignment.is_captain,
      });

      return;
    }

    teamsMap.set(
      assignment.team.id,
      {
        id: assignment.team.id,
        name: assignment.team.name,
        players: [
          {
            id: assignment.member.id,
            name:
              assignment.member.name,
            isCaptain:
              assignment.is_captain,
          },
        ],
      }
    );
  });

  const teams =
    [...teamsMap.values()]
      .map((team) => ({
        ...team,

        players: [
          ...team.players,
        ].sort(
          (
            first,
            second
          ) => {
            if (
              first.isCaptain !==
              second.isCaptain
            ) {
              return first.isCaptain
                ? -1
                : 1;
            }

            return first.name.localeCompare(
              second.name
            );
          }
        ),
      }))
      .sort(
        (
          first,
          second
        ) =>
          first.name.localeCompare(
            second.name
          )
      );

  const totalPlayers =
    teams.reduce(
      (
        total,
        team
      ) =>
        total +
        team.players.length,
      0
    );

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="bg-gradient-to-r from-blue-950 to-blue-700 p-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">
          Previous season
        </p>

        <h2 className="mt-2 text-2xl font-bold">
          {season.name}
        </h2>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-white/15 px-3 py-1">
            {teams.length}{" "}
            {teams.length === 1
              ? "team"
              : "teams"}
          </span>

          <span className="rounded-full bg-white/15 px-3 py-1">
            {totalPlayers}{" "}
            {totalPlayers === 1
              ? "player"
              : "players"}
          </span>

          {season.start_date && (
            <span className="rounded-full bg-white/15 px-3 py-1">
              {formatSeasonYear(
                season.start_date
              )}
            </span>
          )}
        </div>
      </header>

      {teams.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-slate-600">
            No saved team assignments
            were found for this season.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {teams.map((team) => (
            <div
              key={team.id}
              className="p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-blue-900">
                  🏏 {team.name}
                </h3>

                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  {team.players.length}{" "}
                  {team.players.length ===
                  1
                    ? "player"
                    : "players"}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {team.players.map(
                  (player) => (
                    <span
                      key={
                        player.id
                      }
                      className={`rounded-full px-3 py-1.5 text-sm ${
                        player.isCaptain
                          ? "bg-amber-100 font-semibold text-amber-900"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {player.isCaptain
                        ? "⭐ "
                        : ""}

                      {player.name}
                    </span>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PairingSummary({
  seasons,
  assignments,
}: {
  seasons: Season[];
  assignments: Assignment[];
}) {
  const pairings =
    buildRepeatedPairings(
      seasons,
      assignments
    );

  if (pairings.length === 0) {
    return (
      <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-6">
        <p className="font-semibold text-green-900">
          ✅ No repeated pairings found
        </p>

        <p className="mt-2 text-sm text-green-800">
          No player pair appeared
          together in both previous
          seasons.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {pairings.map(
        (pairing) => (
          <article
            key={pairing.key}
            className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                Together{" "}
                {
                  pairing
                    .seasonsTogether
                    .length
                }{" "}
                seasons
              </span>

              <span className="text-xl">
                👥
              </span>
            </div>

            <h3 className="mt-4 text-lg font-bold text-slate-900">
              {
                pairing.firstPlayerName
              }
            </h3>

            <p className="my-1 text-sm text-slate-400">
              and
            </p>

            <h3 className="text-lg font-bold text-slate-900">
              {
                pairing.secondPlayerName
              }
            </h3>

            <div className="mt-4 space-y-2">
              {pairing.seasonsTogether.map(
                (
                  seasonTogether
                ) => (
                  <div
                    key={
                      seasonTogether.seasonId
                    }
                    className="rounded-lg bg-slate-50 p-3 text-sm"
                  >
                    <p className="font-medium text-slate-800">
                      {
                        seasonTogether.seasonName
                      }
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {
                        seasonTogether.teamName
                      }
                    </p>
                  </div>
                )
              )}
            </div>
          </article>
        )
      )}
    </div>
  );
}

type PairingSummaryItem = {
  key: string;

  firstPlayerName: string;

  secondPlayerName: string;

  seasonsTogether: {
    seasonId: string;
    seasonName: string;
    teamName: string;
  }[];
};

function buildRepeatedPairings(
  seasons: Season[],
  assignments: Assignment[]
): PairingSummaryItem[] {
  const seasonNameById =
    new Map(
      seasons.map(
        (season) => [
          season.id,
          season.name,
        ]
      )
    );

  const pairings = new Map<
    string,
    PairingSummaryItem
  >();

  seasons.forEach(
    (season) => {
      const seasonAssignments =
        assignments.filter(
          (assignment) =>
            assignment.season_id ===
              season.id &&
            assignment.team &&
            assignment.member
        );

      const assignmentsByTeam =
        new Map<
          string,
          Assignment[]
        >();

      seasonAssignments.forEach(
        (assignment) => {
          const currentAssignments =
            assignmentsByTeam.get(
              assignment.team_id
            ) ?? [];

          currentAssignments.push(
            assignment
          );

          assignmentsByTeam.set(
            assignment.team_id,
            currentAssignments
          );
        }
      );

      assignmentsByTeam.forEach(
        (teamAssignments) => {
          for (
            let firstIndex = 0;
            firstIndex <
            teamAssignments.length;
            firstIndex += 1
          ) {
            for (
              let secondIndex =
                firstIndex + 1;
              secondIndex <
              teamAssignments.length;
              secondIndex += 1
            ) {
              const firstAssignment =
                teamAssignments[
                  firstIndex
                ];

              const secondAssignment =
                teamAssignments[
                  secondIndex
                ];

              if (
                !firstAssignment.member ||
                !secondAssignment.member ||
                !firstAssignment.team
              ) {
                continue;
              }

              const sortedPlayers =
                [
                  {
                    id:
                      firstAssignment
                        .member.id,

                    name:
                      firstAssignment
                        .member.name,
                  },

                  {
                    id:
                      secondAssignment
                        .member.id,

                    name:
                      secondAssignment
                        .member.name,
                  },
                ].sort(
                  (
                    first,
                    second
                  ) =>
                    first.id.localeCompare(
                      second.id
                    )
                );

              const pairingKey =
                `${sortedPlayers[0].id}:${sortedPlayers[1].id}`;

              const seasonTogether =
                {
                  seasonId:
                    season.id,

                  seasonName:
                    seasonNameById.get(
                      season.id
                    ) ??
                    season.name,

                  teamName:
                    firstAssignment
                      .team.name,
                };

              const existingPairing =
                pairings.get(
                  pairingKey
                );

              if (
                existingPairing
              ) {
                const alreadyAdded =
                  existingPairing.seasonsTogether.some(
                    (item) =>
                      item.seasonId ===
                      season.id
                  );

                if (
                  !alreadyAdded
                ) {
                  existingPairing.seasonsTogether.push(
                    seasonTogether
                  );
                }

                continue;
              }

              pairings.set(
                pairingKey,
                {
                  key:
                    pairingKey,

                  firstPlayerName:
                    sortedPlayers[0]
                      .name,

                  secondPlayerName:
                    sortedPlayers[1]
                      .name,

                  seasonsTogether:
                    [
                      seasonTogether,
                    ],
                }
              );
            }
          }
        }
      );
    }
  );

  return [
    ...pairings.values(),
  ]
    .filter(
      (pairing) =>
        pairing
          .seasonsTogether
          .length > 1
    )
    .sort(
      (
        first,
        second
      ) => {
        const seasonCountDifference =
          second
            .seasonsTogether
            .length -
          first
            .seasonsTogether
            .length;

        if (
          seasonCountDifference !==
          0
        ) {
          return seasonCountDifference;
        }

        return first.firstPlayerName.localeCompare(
          second.firstPlayerName
        );
      }
    );
}

function formatSeasonYear(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      year: "numeric",
    }
  ).format(
    new Date(
      `${value}T00:00:00`
    )
  );
}
