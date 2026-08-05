"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase/client";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";

type Season = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
};

type Team = {
  id: string;
  name: string;
};

type SeasonTeam = {
  id: string;
  season_id: string;
  team_id: string;
  is_active: boolean;
};

type SeasonGameDate = {
  id: string;
  season_id: string;
  game_date: string;
  week_number: number;
  label: string | null;
  is_active: boolean;
};

type WeekendForm = {
  game_date: string;
  week_number: string;
  label: string;
  is_active: boolean;
};

function createInitialWeekendForm(): WeekendForm {
  return {
    game_date: "",
    week_number: "",
    label: "",
    is_active: true,
  };
}

export default function SeasonSetupPage() {
  const { profile, loadingProfile } = useCurrentProfile();

  const isAdmin = profile?.appRole === "Admin";

  const canManageDates =
    profile?.appRole === "Admin" ||
    profile?.appRole === "Captain";

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [seasonTeams, setSeasonTeams] = useState<SeasonTeam[]>([]);
  const [gameDates, setGameDates] = useState<SeasonGameDate[]>([]);

  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);

  const [weekendForm, setWeekendForm] =
    useState<WeekendForm>(createInitialWeekendForm);

  const [editingDateId, setEditingDateId] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingTeams, setSavingTeams] = useState(false);
  const [savingDate, setSavingDate] = useState(false);

  const [deletingDateId, setDeletingDateId] =
    useState<string | null>(null);

  const [message, setMessage] = useState("");

  const selectedSeason = useMemo(
    () =>
      seasons.find((season) => season.id === selectedSeasonId) ??
      null,
    [seasons, selectedSeasonId]
  );

  const loadSeasonDetails = useCallback(
    async (seasonId: string) => {
      if (!seasonId) {
        setSeasonTeams([]);
        setSelectedTeamIds([]);
        setGameDates([]);
        return;
      }

      setMessage("");

      const [seasonTeamsResult, gameDatesResult] =
        await Promise.all([
          supabase
            .from("season_teams")
            .select("id, season_id, team_id, is_active")
            .eq("season_id", seasonId),

          supabase
            .from("season_game_dates")
            .select(
              "id, season_id, game_date, week_number, label, is_active"
            )
            .eq("season_id", seasonId)
            .order("week_number", {
              ascending: true,
            }),
        ]);

      const errors: string[] = [];

      if (seasonTeamsResult.error) {
        errors.push(
          `Unable to load season teams: ${seasonTeamsResult.error.message}`
        );
      } else {
        const loadedSeasonTeams =
          (seasonTeamsResult.data ?? []) as SeasonTeam[];

        setSeasonTeams(loadedSeasonTeams);

        setSelectedTeamIds(
          loadedSeasonTeams
            .filter((seasonTeam) => seasonTeam.is_active)
            .map((seasonTeam) => seasonTeam.team_id)
        );
      }

      if (gameDatesResult.error) {
        errors.push(
          `Unable to load weekend dates: ${gameDatesResult.error.message}`
        );
      } else {
        setGameDates(
          (gameDatesResult.data ?? []) as SeasonGameDate[]
        );
      }

      if (errors.length > 0) {
        setMessage(errors.join(" "));
      }
    },
    []
  );

  const loadInitialData = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    const [seasonsResult, teamsResult] = await Promise.all([
      supabase
        .from("seasons")
        .select("id, name, start_date, end_date, active")
        .order("start_date", {
          ascending: false,
        }),

      supabase
        .from("teams")
        .select("id, name")
        .order("name"),
    ]);

    const errors: string[] = [];

    let loadedSeasons: Season[] = [];

    if (seasonsResult.error) {
      errors.push(
        `Unable to load seasons: ${seasonsResult.error.message}`
      );
    } else {
      loadedSeasons = (seasonsResult.data ?? []) as Season[];
      setSeasons(loadedSeasons);
    }

    if (teamsResult.error) {
      errors.push(
        `Unable to load teams: ${teamsResult.error.message}`
      );
    } else {
      setTeams((teamsResult.data ?? []) as Team[]);
    }

    if (errors.length > 0) {
      setMessage(errors.join(" "));
    }

    const activeSeason =
      loadedSeasons.find((season) => season.active) ??
      loadedSeasons[0] ??
      null;

    if (activeSeason) {
      setSelectedSeasonId(activeSeason.id);
      await loadSeasonDetails(activeSeason.id);
    }

    setLoading(false);
  }, [loadSeasonDetails, profile]);

  useEffect(() => {
    if (loadingProfile) {
      return;
    }

    void loadInitialData();
  }, [loadingProfile, loadInitialData]);

  async function handleSeasonChange(seasonId: string) {
    setSelectedSeasonId(seasonId);
    setMessage("");
    resetWeekendForm();

    await loadSeasonDetails(seasonId);
  }

  function toggleTeam(teamId: string) {
    if (!isAdmin) {
      return;
    }

    setSelectedTeamIds((current) =>
      current.includes(teamId)
        ? current.filter((id) => id !== teamId)
        : [...current, teamId]
    );

    setMessage("");
  }

  async function saveParticipatingTeams() {
    if (!isAdmin) {
      setMessage("Only an Admin can change participating teams.");
      return;
    }

    if (!selectedSeasonId) {
      setMessage("Please select a season.");
      return;
    }

    if (selectedTeamIds.length < 2) {
      setMessage("Please select at least two teams.");
      return;
    }

    setSavingTeams(true);
    setMessage("");

    const existingByTeamId = new Map(
      seasonTeams.map((seasonTeam) => [
        seasonTeam.team_id,
        seasonTeam,
      ])
    );

    const recordsToUpsert = teams.map((team) => {
      const existing = existingByTeamId.get(team.id);

      return {
        ...(existing ? { id: existing.id } : {}),
        season_id: selectedSeasonId,
        team_id: team.id,
        is_active: selectedTeamIds.includes(team.id),
      };
    });

    const { error } = await supabase
      .from("season_teams")
      .upsert(recordsToUpsert, {
        onConflict: "season_id,team_id",
      });

    if (error) {
      setMessage(
        `Unable to save participating teams: ${error.message}`
      );
      setSavingTeams(false);
      return;
    }

    await loadSeasonDetails(selectedSeasonId);

    setMessage(
      `${selectedTeamIds.length} participating teams saved successfully.`
    );

    setSavingTeams(false);
  }

  function resetWeekendForm() {
    setWeekendForm(createInitialWeekendForm());
    setEditingDateId(null);
  }

  function startEditingDate(gameDate: SeasonGameDate) {
    if (!canManageDates) {
      return;
    }

    setEditingDateId(gameDate.id);

    setWeekendForm({
      game_date: gameDate.game_date,
      week_number: gameDate.week_number.toString(),
      label: gameDate.label ?? "",
      is_active: gameDate.is_active,
    });

    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleWeekendSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");

    if (!canManageDates) {
      setMessage(
        "Only an Admin or Captain can manage weekend dates."
      );
      return;
    }

    if (!selectedSeasonId) {
      setMessage("Please select a season.");
      return;
    }

    if (!weekendForm.game_date) {
      setMessage("Weekend date is required.");
      return;
    }

    const weekNumber = Number(weekendForm.week_number);

    if (!Number.isInteger(weekNumber) || weekNumber <= 0) {
      setMessage(
        "Week number must be a whole number greater than zero."
      );
      return;
    }

    setSavingDate(true);

    const dateData = {
      season_id: selectedSeasonId,
      game_date: weekendForm.game_date,
      week_number: weekNumber,
      label: weekendForm.label.trim() || null,
      is_active: weekendForm.is_active,
    };

    const { error } = editingDateId
      ? await supabase
          .from("season_game_dates")
          .update(dateData)
          .eq("id", editingDateId)
      : await supabase
          .from("season_game_dates")
          .insert(dateData);

    if (error) {
      setMessage(
        `Unable to ${
          editingDateId ? "update" : "add"
        } weekend date: ${error.message}`
      );

      setSavingDate(false);
      return;
    }

    const successMessage = editingDateId
      ? "Weekend date updated successfully."
      : "Weekend date added successfully.";

    resetWeekendForm();
    await loadSeasonDetails(selectedSeasonId);

    setMessage(successMessage);
    setSavingDate(false);
  }

  async function toggleDateActive(gameDate: SeasonGameDate) {
    if (!canManageDates) {
      return;
    }

    setMessage("");

    const { error } = await supabase
      .from("season_game_dates")
      .update({
        is_active: !gameDate.is_active,
      })
      .eq("id", gameDate.id);

    if (error) {
      setMessage(
        `Unable to update weekend status: ${error.message}`
      );
      return;
    }

    await loadSeasonDetails(selectedSeasonId);
  }

  async function deleteWeekendDate(gameDate: SeasonGameDate) {
    if (!canManageDates) {
      return;
    }

    const confirmed = window.confirm(
      `Delete Week ${gameDate.week_number} — ${formatDate(
        gameDate.game_date
      )}? Existing player responses for this date will also be deleted.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingDateId(gameDate.id);
    setMessage("");

    const { error } = await supabase
      .from("season_game_dates")
      .delete()
      .eq("id", gameDate.id);

    if (error) {
      setMessage(
        `Unable to delete weekend date: ${error.message}`
      );
      setDeletingDateId(null);
      return;
    }

    if (editingDateId === gameDate.id) {
      resetWeekendForm();
    }

    await loadSeasonDetails(selectedSeasonId);

    setMessage("Weekend date deleted successfully.");
    setDeletingDateId(null);
  }

  if (loadingProfile) {
    return <PageMessage message="Checking account…" />;
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-10">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/"
            className="text-blue-700 hover:underline"
          >
            ← Back to Home
          </Link>

          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="text-4xl">🔐</div>

            <h1 className="mt-4 text-2xl font-bold text-blue-900">
              Sign in required
            </h1>

            <p className="mt-2 text-slate-600">
              Sign in to view the season setup.
            </p>

            <Link
              href="/auth"
              className="mt-6 inline-block rounded-lg bg-blue-900 px-5 py-3 font-medium text-white"
            >
              Sign In
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/"
          className="text-blue-700 hover:underline"
        >
          ← Back to Home
        </Link>

        <div className="mt-6">
          <h1 className="text-3xl font-bold text-blue-900">
            ⚙️ Season Setup
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Choose the teams participating in each season and
            configure the weekend dates players will use for
            preseason availability.
          </p>
        </div>

        {!isAdmin && (
          <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            {canManageDates
              ? "Captains can manage weekend dates. Only an Admin can change participating teams."
              : "Season setup is read-only for your account."}
          </div>
        )}

        {message && (
          <p className="mt-5 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            {message}
          </p>
        )}

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <label>
            <span className="text-sm font-medium text-slate-700">
              Season
            </span>

            <select
              value={selectedSeasonId}
              onChange={(event) =>
                void handleSeasonChange(event.target.value)
              }
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3"
            >
              <option value="">Select a season</option>

              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                  {season.active ? " — Active" : ""}
                </option>
              ))}
            </select>
          </label>

          {selectedSeason && (
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              {selectedSeason.start_date && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  Starts: {formatDate(selectedSeason.start_date)}
                </span>
              )}

              {selectedSeason.end_date && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  Ends: {formatDate(selectedSeason.end_date)}
                </span>
              )}

              {selectedSeason.active && (
                <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-800">
                  Active season
                </span>
              )}
            </div>
          )}
        </section>

        {loading ? (
          <p className="mt-8 text-slate-600">
            Loading season setup…
          </p>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-blue-900">
                    🏏 Participating Teams
                  </h2>

                  <p className="mt-1 text-sm text-slate-600">
                    Select any number of teams for this season.
                  </p>
                </div>

                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-900">
                  {selectedTeamIds.length} selected
                </span>
              </div>

              {!selectedSeasonId ? (
                <p className="mt-5 text-sm text-slate-600">
                  Select a season first.
                </p>
              ) : teams.length === 0 ? (
                <p className="mt-5 text-sm text-slate-600">
                  No teams are available in the Teams table.
                </p>
              ) : (
                <>
                  <div className="mt-5 space-y-3">
                    {teams.map((team) => {
                      const isSelected =
                        selectedTeamIds.includes(team.id);

                      return (
                        <button
                          key={team.id}
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => toggleTeam(team.id)}
                          className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${
                            isSelected
                              ? "border-blue-700 bg-blue-50 text-blue-950"
                              : "border-slate-200 bg-white text-slate-700"
                          } ${
                            isAdmin
                              ? "hover:border-blue-400"
                              : "cursor-default"
                          }`}
                        >
                          <span className="font-medium">
                            {team.name}
                          </span>

                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full border text-sm ${
                              isSelected
                                ? "border-blue-700 bg-blue-700 text-white"
                                : "border-slate-300"
                            }`}
                          >
                            {isSelected ? "✓" : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {isAdmin && (
                    <button
                      type="button"
                      disabled={savingTeams || !selectedSeasonId}
                      onClick={() =>
                        void saveParticipatingTeams()
                      }
                      className="mt-5 w-full rounded-lg bg-blue-900 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingTeams
                        ? "Saving teams…"
                        : "Save Participating Teams"}
                    </button>
                  )}
                </>
              )}
            </section>

            <section>
              {canManageDates && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-xl font-semibold text-blue-900">
                    {editingDateId
                      ? "Edit Weekend Date"
                      : "Add Weekend Date"}
                  </h2>

                  <p className="mt-1 text-sm text-slate-600">
                    Add the Saturdays or Sundays players will
                    mark availability for.
                  </p>

                  <form
                    onSubmit={handleWeekendSubmit}
                    className="mt-5 grid gap-4"
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label>
                        <span className="text-sm font-medium text-slate-700">
                          Weekend date *
                        </span>

                        <input
                          type="date"
                          required
                          value={weekendForm.game_date}
                          onChange={(event) =>
                            setWeekendForm({
                              ...weekendForm,
                              game_date: event.target.value,
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </label>

                      <label>
                        <span className="text-sm font-medium text-slate-700">
                          Week number *
                        </span>

                        <input
                          type="number"
                          min="1"
                          step="1"
                          required
                          value={weekendForm.week_number}
                          onChange={(event) =>
                            setWeekendForm({
                              ...weekendForm,
                              week_number: event.target.value,
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </label>
                    </div>

                    <label>
                      <span className="text-sm font-medium text-slate-700">
                        Label
                      </span>

                      <input
                        type="text"
                        value={weekendForm.label}
                        onChange={(event) =>
                          setWeekendForm({
                            ...weekendForm,
                            label: event.target.value,
                          })
                        }
                        placeholder="Example: Opening Weekend"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </label>

                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={weekendForm.is_active}
                        onChange={(event) =>
                          setWeekendForm({
                            ...weekendForm,
                            is_active: event.target.checked,
                          })
                        }
                      />

                      <span className="text-sm font-medium text-slate-700">
                        Players should respond for this date
                      </span>
                    </label>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="submit"
                        disabled={savingDate || !selectedSeasonId}
                        className="rounded-lg bg-blue-900 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingDate
                          ? editingDateId
                            ? "Updating…"
                            : "Adding…"
                          : editingDateId
                            ? "Update Date"
                            : "Add Date"}
                      </button>

                      {editingDateId && (
                        <button
                          type="button"
                          disabled={savingDate}
                          onClick={resetWeekendForm}
                          className="rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}

              <div className={canManageDates ? "mt-6" : ""}>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-900">
                      Weekend Game Dates
                    </h2>

                    <p className="mt-1 text-sm text-slate-600">
                      Players will submit availability for each
                      active date.
                    </p>
                  </div>

                  <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-900">
                    {gameDates.length}{" "}
                    {gameDates.length === 1 ? "date" : "dates"}
                  </span>
                </div>

                {!selectedSeasonId ? (
                  <p className="mt-5 text-slate-600">
                    Select a season first.
                  </p>
                ) : gameDates.length === 0 ? (
                  <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                    <div className="text-4xl">📅</div>

                    <p className="mt-3 font-medium text-slate-800">
                      No weekend dates have been added.
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {gameDates.map((gameDate) => (
                      <article
                        key={gameDate.id}
                        className={`rounded-2xl border bg-white p-5 shadow-sm ${
                          gameDate.is_active
                            ? "border-slate-200"
                            : "border-slate-200 opacity-60"
                        }`}
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900">
                                Week {gameDate.week_number}
                              </span>

                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  gameDate.is_active
                                    ? "bg-green-100 text-green-800"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {gameDate.is_active
                                  ? "Open for responses"
                                  : "Inactive"}
                              </span>
                            </div>

                            <h3 className="mt-3 text-lg font-semibold text-blue-900">
                              {formatDate(gameDate.game_date)}
                            </h3>

                            {gameDate.label && (
                              <p className="mt-1 text-sm text-slate-600">
                                {gameDate.label}
                              </p>
                            )}
                          </div>

                          {canManageDates && (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  void toggleDateActive(gameDate)
                                }
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                              >
                                {gameDate.is_active
                                  ? "Deactivate"
                                  : "Activate"}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  startEditingDate(gameDate)
                                }
                                className="rounded-lg border border-blue-900 px-3 py-2 text-sm font-medium text-blue-900"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                disabled={deletingDateId === gameDate.id}
                                onClick={() =>
                                  void deleteWeekendDate(gameDate)
                                }
                                className="rounded-lg border border-red-600 px-3 py-2 text-sm font-medium text-red-600 disabled:opacity-60"
                              >
                                {deletingDateId === gameDate.id
                                  ? "Deleting…"
                                  : "Delete"}
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function PageMessage({
  message,
}: {
  message: string;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-7xl">
        <p className="text-slate-600">{message}</p>
      </div>
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}
