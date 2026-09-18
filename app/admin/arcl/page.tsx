"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { supabase } from "@/lib/supabase/client";

type ClubConfig = {
  id: string;
  name: string;
  arcl_league_id: number | null;
  arcl_season_id: number | null;
  arcl_season_name: string | null;
};

type ClubTeam = {
  id: string;
  name: string;
  arcl_team_name: string | null;
};

type ArclMatch = {
  id: string;
  arcl_match_id: number | null;
  match_date: string;
  start_time: string | null;
  end_time: string | null;
  ground: string | null;
  team1_name: string;
  team2_name: string;
  match_type: string | null;
  division: string | null;
  winner_name: string | null;
  runner_name: string | null;
  comment: string | null;
};

type ArclSeason = {
  id: number;
  name: string;
};

type SeasonDiscoveryResponse = {
  success: boolean;

  configuredSeason?: {
    id: number | null;
    name: string | null;
  };

  detectedCurrentSeason?: ArclSeason | null;

  nextSeason?: ArclSeason | null;

  seasons?: ArclSeason[];

  configurationChanged?: boolean;

  error?: string;
};

function formatTime(
  value: string | null
) {
  if (!value) return "";

  const parts = value.split(":");
  const hour = Number(parts[0]);
  const minute =
    parts[1] ?? "00";

  if (!Number.isFinite(hour)) {
    return value;
  }

  const suffix =
    hour >= 12 ? "PM" : "AM";

  const displayHour =
    hour % 12 || 12;

  return `${displayHour}:${minute} ${suffix}`;
}

function formatDate(
  value: string
) {
  const [year, month, day] =
    value.split("-").map(Number);

  if (
    !year ||
    !month ||
    !day
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  ).format(
    new Date(
      year,
      month - 1,
      day
    )
  );
}

export default function ArclAdminPage() {
  const [loading, setLoading] =
    useState(true);

  const [syncing, setSyncing] =
    useState(false);

  const [
    checkingSeasons,
    setCheckingSeasons,
  ] = useState(false);

  const [
    switchingSeason,
    setSwitchingSeason,
  ] = useState(false);

  const [
    authorized,
    setAuthorized,
  ] = useState(false);

  const [club, setClub] =
    useState<ClubConfig | null>(
      null
    );

  const [teams, setTeams] =
    useState<ClubTeam[]>([]);

  const [matches, setMatches] =
    useState<ArclMatch[]>([]);

  const [
    availableSeasons,
    setAvailableSeasons,
  ] = useState<ArclSeason[]>([]);

  const [
    nextSeason,
    setNextSeason,
  ] =
    useState<ArclSeason | null>(
      null
    );

  const [
    seasonCheckError,
    setSeasonCheckError,
  ] = useState("");

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  /*
   * Discover seasons directly from ARCL.
   *
   * This is READ ONLY.
   * It never changes the club configuration.
   */
  const discoverSeasons =
    useCallback(async () => {
      setCheckingSeasons(true);
      setSeasonCheckError("");

      try {
        const {
          data: { session },
          error: sessionError,
        } =
          await supabase.auth.getSession();

        if (
          sessionError ||
          !session?.access_token
        ) {
          throw new Error(
            "Your session has expired. Please sign in again."
          );
        }

        const response =
          await fetch(
            "/api/arcl/seasons",
            {
              method: "GET",

              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },
            }
          );

        const result =
          (await response.json()) as SeasonDiscoveryResponse;

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.error ??
              "Unable to check ARCL seasons."
          );
        }

        setAvailableSeasons(
          result.seasons ?? []
        );

        setNextSeason(
          result.nextSeason ?? null
        );
      } catch (err) {
        console.error(
          "ARCL season discovery error:",
          err
        );

        /*
         * Season discovery failing should NOT
         * prevent Admin from using the normal
         * schedule page.
         */
        setSeasonCheckError(
          err instanceof Error
            ? err.message
            : "Unable to check for newer ARCL seasons."
        );

        setAvailableSeasons([]);
        setNextSeason(null);
      } finally {
        setCheckingSeasons(false);
      }
    }, []);

  const loadPage =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const {
          data: { user },
          error: userError,
        } =
          await supabase.auth.getUser();

        if (
          userError ||
          !user
        ) {
          setAuthorized(false);

          setError(
            "Please sign in to access ARCL administration."
          );

          return;
        }

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select(
            "club_id, app_role"
          )
          .eq(
            "id",
            user.id
          )
          .maybeSingle();

        if (profileError) {
          throw new Error(
            profileError.message
          );
        }

        if (!profile?.club_id) {
          setAuthorized(false);

          setError(
            "Your account is not associated with a club."
          );

          return;
        }

        if (
          profile.app_role !==
          "Admin"
        ) {
          setAuthorized(false);

          setError(
            "Only club Admins can manage the ARCL schedule."
          );

          return;
        }

        setAuthorized(true);

        const clubId =
          profile.club_id;

        const {
          data: clubData,
          error: clubError,
        } = await supabase
          .from("clubs")
          .select(
            "id, name, arcl_league_id, arcl_season_id, arcl_season_name"
          )
          .eq(
            "id",
            clubId
          )
          .maybeSingle();

        if (clubError) {
          throw new Error(
            clubError.message
          );
        }

        if (!clubData) {
          throw new Error(
            "Club configuration could not be found."
          );
        }

        setClub(
          clubData as ClubConfig
        );

        const {
          data: teamData,
          error: teamError,
        } = await supabase
          .from("teams")
          .select(
            "id, name, arcl_team_name"
          )
          .eq(
            "club_id",
            clubId
          )
          .order("name");

        if (teamError) {
          throw new Error(
            teamError.message
          );
        }

        setTeams(
          (teamData ??
            []) as ClubTeam[]
        );

       const {
  data: matchData,
  error: matchError,
} = await supabase
  .from("arcl_matches")
  .select(`
    id,
    arcl_match_id,
    match_date,
    start_time,
    end_time,
    ground,
    team1_name,
    team2_name,
    match_type,
    division,
    winner_name,
    runner_name,
    comment
  `)
  .eq(
    "club_id",
    clubId
  )
  .eq(
    "arcl_league_id",
    clubData.arcl_league_id
  )
  .eq(
    "arcl_season_id",
    clubData.arcl_season_id
  )
  .order(
    "match_date",
    {
      ascending: true,
    }
  )
  .order(
    "start_time",
    {
      ascending: true,
    }
  );


        if (matchError) {
          throw new Error(
            matchError.message
          );
        }

        setMatches(
          (matchData ??
            []) as ArclMatch[]
        );
      } catch (err) {
        console.error(
          "ARCL page load error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load ARCL schedule."
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  /*
   * Once the Admin page has successfully loaded,
   * check ARCL for a newer season.
   */
  useEffect(() => {
    if (
      !loading &&
      authorized &&
      club?.arcl_league_id &&
      club?.arcl_season_id
    ) {
      void discoverSeasons();
    }
  }, [
    loading,
    authorized,
    club?.arcl_league_id,
    club?.arcl_season_id,
    discoverSeasons,
  ]);

  async function syncSchedule() {
    setSyncing(true);
    setError("");
    setMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      const response =
        await fetch(
          "/api/arcl/sync",
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ??
            "Unable to sync the ARCL schedule."
        );
      }

      setMessage(
        `Schedule synced successfully. ${
          result.matchesSynced ??
          0
        } match${
          result.matchesSynced ===
          1
            ? ""
            : "es"
        } synced.`
      );

      await loadPage();
    } catch (err) {
      console.error(
        "ARCL sync error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to sync the ARCL schedule."
      );
    } finally {
      setSyncing(false);
    }
  }

  /*
   * Permanent Admin-controlled season switch.
   *
   * Flow:
   *
   * 1. Ask Admin for confirmation.
   * 2. Backend re-validates season against ARCL.
   * 3. Backend updates this club.
   * 4. Existing /api/arcl/sync imports the new season.
   * 5. Reload page.
   */
  async function switchSeason(
    season: ArclSeason
  ) {
    const confirmed =
      window.confirm(
        `Switch ARCL season from ${
          club?.arcl_season_name ??
          `Season ${club?.arcl_season_id ?? ""}`
        } to ${season.name} (Season ID ${season.id})?\n\n` +
          "Existing matches from the current season will remain in history."
      );

    if (!confirmed) {
      return;
    }

    setSwitchingSeason(true);
    setError("");
    setMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      /*
       * First switch the configured season.
       */
      const switchResponse =
        await fetch(
          "/api/arcl/season",
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              seasonId:
                season.id,
            }),
          }
        );

      const switchResult =
        await switchResponse.json();

      if (
        !switchResponse.ok ||
        !switchResult.success
      ) {
        throw new Error(
          switchResult.error ??
            "Unable to switch the ARCL season."
        );
      }

      /*
       * Now reuse the existing, already-tested
       * ARCL schedule sync.
       */
      const syncResponse =
        await fetch(
          "/api/arcl/sync",
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
          }
        );

      const syncResult =
        await syncResponse.json();

      if (
        !syncResponse.ok ||
        !syncResult.success
      ) {
        /*
         * Important distinction:
         *
         * The season DID switch successfully.
         * Only the immediate schedule import failed.
         *
         * Don't tell the Admin that the whole
         * operation failed.
         */
        setMessage(
          `ARCL season switched to ${season.name}.`
        );

        setError(
          `The season was switched successfully, but the new schedule could not be synced automatically: ${
            syncResult.error ??
            "Unknown sync error."
          }`
        );

        await loadPage();

        return;
      }

      setMessage(
        `ARCL season switched to ${season.name}. ${
          syncResult.matchesSynced ??
          0
        } match${
          syncResult.matchesSynced ===
          1
            ? ""
            : "es"
        } synced.`
      );

      await loadPage();
    } catch (err) {
      console.error(
        "ARCL season switch error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to switch the ARCL season."
      );
    } finally {
      setSwitchingSeason(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-slate-600">
            Loading ARCL schedule...
          </p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-10">
        <div className="mx-auto max-w-xl">
          <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">
              ARCL Schedule
            </h1>

            <p className="mt-4 text-slate-600">
              {error ||
                "You do not have access to this page."}
            </p>

            <Link
              href="/"
              className="mt-6 inline-block rounded-lg bg-blue-900 px-5 py-3 font-medium text-white"
            >
              Back to Home
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const configuredTeams =
    teams.filter(
      (team) =>
        team.arcl_team_name?.trim()
    );

  const configurationComplete =
    Boolean(
      club?.arcl_league_id
    ) &&
    Boolean(
      club?.arcl_season_id
    ) &&
    configuredTeams.length > 0;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/"
              className="text-sm font-medium text-blue-800 hover:underline"
            >
              ← Back to Home
            </Link>

            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              🏏 ARCL Schedule
            </h1>

            <p className="mt-1 text-slate-600">
              {club?.name}
            </p>
          </div>

          <button
            type="button"
            onClick={
              syncSchedule
            }
            disabled={
              syncing ||
              switchingSeason ||
              !configurationComplete
            }
            className="rounded-xl bg-blue-900 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncing
              ? "Syncing..."
              : "Sync ARCL Schedule"}
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-800">
            {message}
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                ARCL Configuration
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Schedule source
                currently configured
                for this club.
              </p>
            </div>

            <div
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                configurationComplete
                  ? "bg-green-100 text-green-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {configurationComplete
                ? "Configured"
                : "Configuration incomplete"}
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                ARCL League
              </div>

              <div className="mt-1 text-lg font-semibold text-slate-900">
                {club?.arcl_league_id ??
                  "Not configured"}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                ARCL Season
              </div>

              {availableSeasons.length > 0 &&
              club?.arcl_season_id ? (
                <select
                  value={
                    club.arcl_season_id
                  }
                  onChange={(event) => {
                    const selectedId =
                      Number(
                        event.target.value
                      );

                    const selectedSeason =
                      availableSeasons.find(
                        (season) =>
                          season.id ===
                          selectedId
                      );

                    if (
                      selectedSeason &&
                      selectedSeason.id !==
                        club.arcl_season_id
                    ) {
                      void switchSeason(
                        selectedSeason
                      );
                    }
                  }}
                  disabled={
                    switchingSeason ||
                    syncing ||
                    checkingSeasons
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-semibold text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {availableSeasons.map(
                    (season) => (
                      <option
                        key={season.id}
                        value={season.id}
                      >
                        {season.name}
                        {season.id ===
                        club.arcl_season_id
                          ? " — Current"
                          : ""}
                      </option>
                    )
                  )}
                </select>
              ) : (
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {club?.arcl_season_name ??
                    "Not configured"}
                </div>
              )}

              {switchingSeason && (
                <div className="mt-2 text-xs font-medium text-blue-700">
                  Switching season and
                  syncing schedule...
                </div>
              )}
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Season ID
              </div>

              <div className="mt-1 text-lg font-semibold text-slate-900">
                {club?.arcl_season_id ??
                  "Not configured"}
              </div>
            </div>
          </div>

          {checkingSeasons && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Checking ARCL for
              newer seasons...
            </div>
          )}

          {!checkingSeasons &&
            nextSeason && (
              <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
                <div className="text-sm font-semibold text-amber-900">
                  🆕 New ARCL season available: {" "}
                  {nextSeason.name}
                  {" · "}
                  Season ID {nextSeason.id}
                </div>

                <p className="mt-1 text-sm text-amber-800">
                  Use the ARCL Season dropdown
                  above whenever you are ready
                  to switch. You can also switch
                  back to any season ARCL lists.
                </p>
              </div>
            )}

          {!checkingSeasons &&
            !nextSeason &&
            !seasonCheckError &&
            club?.arcl_season_id && (
              <div className="mt-5 flex items-center gap-2 text-sm text-slate-500">
                <span>✓</span>
                <span>
                  No newer ARCL
                  season is currently
                  available.
                </span>
              </div>
            )}

          {seasonCheckError && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="text-sm font-medium text-amber-900">
                ARCL season check
                unavailable
              </div>

              <div className="mt-1 text-sm text-amber-800">
                {
                  seasonCheckError
                }
              </div>

              <button
                type="button"
                onClick={() =>
                  void discoverSeasons()
                }
                disabled={
                  checkingSeasons
                }
                className="mt-3 text-sm font-semibold text-amber-900 underline"
              >
                Try again
              </button>
            </div>
          )}

          <div className="mt-6">
            <h3 className="font-semibold text-slate-900">
              Club teams mapped
              to ARCL
            </h3>

            {configuredTeams.length ===
            0 ? (
              <p className="mt-2 text-sm text-amber-700">
                No teams have an
                ARCL team name
                configured.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {configuredTeams.map(
                  (team) => (
                    <span
                      key={
                        team.id
                      }
                      className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-900"
                    >
                      {
                        team.name
                      }

                      {team.arcl_team_name !==
                      team.name
                        ? ` → ${team.arcl_team_name}`
                        : ""}
                    </span>
                  )
                )}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Imported Matches
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Matches involving
                  one or more of your
                  club teams.
                </p>
              </div>

              <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                {matches.length}{" "}
                match
                {matches.length ===
                1
                  ? ""
                  : "es"}
              </div>
            </div>
          </div>

          {matches.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-4xl">
                🏏
              </div>

              <h3 className="mt-3 font-semibold text-slate-900">
                No ARCL matches
                imported yet
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Click Sync ARCL
                Schedule to import
                this club&apos;s
                configured ARCL
                schedule.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {matches.map(
                (match) => (
                  <article
                    key={
                      match.id
                    }
                    className="p-5 sm:p-6"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-blue-900">
                          {formatDate(
                            match.match_date
                          )}

                          {match.start_time
                            ? ` • ${formatTime(
                                match.start_time
                              )}`
                            : ""}

                          {match.end_time
                            ? ` – ${formatTime(
                                match.end_time
                              )}`
                            : ""}
                        </div>

                        <div className="mt-2 text-lg font-bold text-slate-900">
                          {
                            match.team1_name
                          }

                          <span className="mx-2 font-normal text-slate-400">
                            vs
                          </span>

                          {
                            match.team2_name
                          }
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                          {match.ground && (
                            <span>
                              📍{" "}
                              {
                                match.ground
                              }
                            </span>
                          )}

                          {match.match_type && (
                            <span>
                              {
                                match.match_type
                              }
                            </span>
                          )}

                          {match.division && (
                            <span>
                              {
                                match.division
                              }
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-sm lg:text-right">
                        {match.winner_name ? (
                          <>
                            <div className="font-semibold text-green-700">
                              Winner:{" "}
                              {
                                match.winner_name
                              }
                            </div>

                            {match.runner_name && (
                              <div className="mt-1 text-slate-500">
                                Runner:{" "}
                                {
                                  match.runner_name
                                }
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                            Scheduled
                          </div>
                        )}

                        {match.arcl_match_id !==
                          null && (
                          <div className="mt-2 text-xs text-slate-400">
                            ARCL Match #
                            {
                              match.arcl_match_id
                            }
                          </div>
                        )}
                      </div>
                    </div>

                    {match.comment && (
                      <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        {
                          match.comment
                        }
                      </div>
                    )}
                  </article>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}


