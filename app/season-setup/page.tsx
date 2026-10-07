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

type SeasonForm = {
  name: string;
  start_date: string;
  end_date: string;
  active: boolean;
};

type ArclSeason = {
  id: number;
  name: string;
};

type BulkDatePreview = {
  game_date: string;
  week_number: number;
};

function createInitialWeekendForm(): WeekendForm {
  return {
    game_date: "",
    week_number: "",
    label: "",
    is_active: true,
  };
}

function createInitialSeasonForm(): SeasonForm {
  return {
    name: "",
    start_date: "",
    end_date: "",
    active: false,
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

  const [selectedDateIds, setSelectedDateIds] =
    useState<string[]>([]);
  const [deletingSelectedDates, setDeletingSelectedDates] =
    useState(false);

  const [message, setMessage] = useState("");

  const [showCreateSeason, setShowCreateSeason] = useState(false);
  const [seasonForm, setSeasonForm] =
    useState<SeasonForm>(createInitialSeasonForm);
  const [savingSeason, setSavingSeason] = useState(false);

  const [arclSeasons, setArclSeasons] = useState<ArclSeason[]>([]);
  const [selectedArclSeasonId, setSelectedArclSeasonId] = useState("");
  const [loadingArclSeasons, setLoadingArclSeasons] = useState(false);

  const [bulkSaturday, setBulkSaturday] = useState(true);
  const [bulkSunday, setBulkSunday] = useState(true);
  const [bulkStartDate, setBulkStartDate] = useState("");
  const [bulkEndDate, setBulkEndDate] = useState("");
  const [bulkPreview, setBulkPreview] = useState<BulkDatePreview[]>([]);
  const [savingBulkDates, setSavingBulkDates] = useState(false);

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
      setBulkStartDate(
        getSuggestedBulkStartDate(activeSeason.start_date)
      );
      setBulkEndDate(activeSeason.end_date ?? "");
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
    setBulkPreview([]);
    setSelectedDateIds([]);

    const changingToSeason =
      seasons.find((season) => season.id === seasonId) ?? null;

    setBulkStartDate(
      changingToSeason
        ? getSuggestedBulkStartDate(changingToSeason.start_date)
        : ""
    );
    setBulkEndDate(changingToSeason?.end_date ?? "");

    await loadSeasonDetails(seasonId);
  }

  async function loadArclSeasons() {
    if (!isAdmin) return;

    setLoadingArclSeasons(true);
    setMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const response = await fetch("/api/arcl/seasons", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to load ARCL seasons.");
      }

      const discovered = (result.seasons ?? []) as ArclSeason[];
      setArclSeasons(discovered);

      if (discovered.length === 0) {
        setMessage("No ARCL seasons were found.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load ARCL seasons."
      );
    } finally {
      setLoadingArclSeasons(false);
    }
  }

  function applyArclSeason(seasonId: string) {
    setSelectedArclSeasonId(seasonId);

    const arclSeason = arclSeasons.find(
      (season) => season.id === Number(seasonId)
    );

    if (arclSeason) {
      setSeasonForm((current) => ({
        ...current,
        name: arclSeason.name,
      }));
    }
  }

  async function createSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isAdmin) {
      setMessage("Only an Admin can create seasons.");
      return;
    }

    const name = seasonForm.name.trim();

    if (!name) {
      setMessage("Season name is required.");
      return;
    }

    if (!seasonForm.start_date || !seasonForm.end_date) {
      setMessage("Season start and end dates are required.");
      return;
    }

    if (seasonForm.end_date < seasonForm.start_date) {
      setMessage("Season end date cannot be before the start date.");
      return;
    }

    setSavingSeason(true);
    setMessage("");

    if (seasonForm.active) {
      const { error: deactivateError } = await supabase
        .from("seasons")
        .update({ active: false })
        .eq("active", true);

      if (deactivateError) {
        setMessage(
          `Unable to update the current active season: ${deactivateError.message}`
        );
        setSavingSeason(false);
        return;
      }
    }

    const { data, error } = await supabase
      .from("seasons")
      .insert({
        name,
        start_date: seasonForm.start_date,
        end_date: seasonForm.end_date,
        active: seasonForm.active,
      })
      .select("id, name, start_date, end_date, active")
      .single();

    if (error) {
      setMessage(`Unable to create season: ${error.message}`);
      setSavingSeason(false);
      return;
    }

    const createdSeason = data as Season;

    setSeasonForm(createInitialSeasonForm());
    setSelectedArclSeasonId("");
    setShowCreateSeason(false);

    await loadInitialData();
    setSelectedSeasonId(createdSeason.id);
    setBulkStartDate(
      getSuggestedBulkStartDate(createdSeason.start_date)
    );
    setBulkEndDate(createdSeason.end_date ?? "");
    await loadSeasonDetails(createdSeason.id);

    setMessage(
      `${createdSeason.name} created successfully. You can now choose teams and generate availability dates.`
    );
    setSavingSeason(false);
  }

  async function setSeasonActive(season: Season) {
    if (!isAdmin || season.active) return;

    const confirmed = window.confirm(
      `Make "${season.name}" the active season? The current active season will be kept as history.`
    );

    if (!confirmed) return;

    setMessage("");

    const { error: deactivateError } = await supabase
      .from("seasons")
      .update({ active: false })
      .eq("active", true);

    if (deactivateError) {
      setMessage(`Unable to change active season: ${deactivateError.message}`);
      return;
    }

    const { error: activateError } = await supabase
      .from("seasons")
      .update({ active: true })
      .eq("id", season.id);

    if (activateError) {
      setMessage(`Unable to activate season: ${activateError.message}`);
      return;
    }

    await loadInitialData();
    setSelectedSeasonId(season.id);
    await loadSeasonDetails(season.id);
    setMessage(`${season.name} is now the active season.`);
  }

  function generateBulkPreview() {
    if (!selectedSeason) {
      setMessage("Please select a season first.");
      return;
    }

    if (!bulkStartDate || !bulkEndDate) {
      setMessage(
        "Choose a start date and end date for availability generation."
      );
      return;
    }

    if (bulkEndDate < bulkStartDate) {
      setMessage(
        "Availability end date cannot be before the start date."
      );
      return;
    }

    if (
      selectedSeason.start_date &&
      bulkStartDate < selectedSeason.start_date
    ) {
      setMessage(
        "Availability start date cannot be before the season start date."
      );
      return;
    }

    if (
      selectedSeason.end_date &&
      bulkEndDate > selectedSeason.end_date
    ) {
      setMessage(
        "Availability end date cannot be after the season end date."
      );
      return;
    }

    if (!bulkSaturday && !bulkSunday) {
      setMessage("Choose Saturday, Sunday, or both.");
      return;
    }

    const existingDates = new Set(gameDates.map((item) => item.game_date));
    const generated = generateWeekendDates(
      bulkStartDate,
      bulkEndDate,
      bulkSaturday,
      bulkSunday,
      existingDates,
      getNextWeekNumber(gameDates)
    );

    setBulkPreview(generated);
    setMessage(
      generated.length > 0
        ? `${generated.length} new availability date${
            generated.length === 1 ? "" : "s"
          } ready to add.`
        : "No new dates were found. The selected weekend dates already exist for this season."
    );
  }

  async function saveBulkDates() {
    if (!canManageDates || !selectedSeasonId || bulkPreview.length === 0) {
      return;
    }

    setSavingBulkDates(true);
    setMessage("");

    const rows = bulkPreview.map((item) => ({
      season_id: selectedSeasonId,
      game_date: item.game_date,
      week_number: item.week_number,
      label: null,
      is_active: true,
    }));

    const { error } = await supabase
      .from("season_game_dates")
      .insert(rows);

    if (error) {
      setMessage(`Unable to add generated dates: ${error.message}`);
      setSavingBulkDates(false);
      return;
    }

    const addedCount = rows.length;
    setBulkPreview([]);
    await loadSeasonDetails(selectedSeasonId);
    setMessage(
      `${addedCount} availability date${addedCount === 1 ? "" : "s"} added successfully.`
    );
    setSavingBulkDates(false);
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

    const enteredWeekNumber = weekendForm.week_number.trim();
    const weekNumber = enteredWeekNumber
      ? Number(enteredWeekNumber)
      : editingDateId
        ? gameDates.find((item) => item.id === editingDateId)?.week_number ??
          getNextWeekNumber(gameDates)
        : getNextWeekNumber(gameDates);

    if (!Number.isInteger(weekNumber) || weekNumber <= 0) {
      setMessage(
        "If provided, week number must be a whole number greater than zero."
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

  function toggleDateSelection(dateId: string) {
    setSelectedDateIds((current) =>
      current.includes(dateId)
        ? current.filter((id) => id !== dateId)
        : [...current, dateId]
    );
  }

  function toggleSelectAllDates() {
    const allSelected =
      gameDates.length > 0 &&
      selectedDateIds.length === gameDates.length;

    setSelectedDateIds(
      allSelected ? [] : gameDates.map((item) => item.id)
    );
  }

  async function deleteSelectedDates() {
    if (!canManageDates || selectedDateIds.length === 0) {
      return;
    }

    const count = selectedDateIds.length;

    const confirmed = window.confirm(
      `Delete ${count} selected date${count === 1 ? "" : "s"}? Existing player availability responses associated with these dates will also be deleted.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingSelectedDates(true);
    setMessage("");

    const { error } = await supabase
      .from("season_game_dates")
      .delete()
      .in("id", selectedDateIds)
      .eq("season_id", selectedSeasonId);

    if (error) {
      setMessage(
        `Unable to delete selected dates: ${error.message}`
      );
      setDeletingSelectedDates(false);
      return;
    }

    if (
      editingDateId &&
      selectedDateIds.includes(editingDateId)
    ) {
      resetWeekendForm();
    }

    setSelectedDateIds([]);
    await loadSeasonDetails(selectedSeasonId);

    setMessage(
      `${count} date${count === 1 ? "" : "s"} deleted successfully.`
    );
    setDeletingSelectedDates(false);
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <label className="flex-1">
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

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setShowCreateSeason((current) => !current);
                  setMessage("");
                }}
                className="rounded-xl bg-blue-900 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-800"
              >
                {showCreateSeason ? "Cancel New Season" : "＋ Create Season"}
              </button>
            )}
          </div>

          {selectedSeason && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
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

              {selectedSeason.active ? (
                <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-800">
                  Active season
                </span>
              ) : (
                isAdmin && (
                  <button
                    type="button"
                    onClick={() => void setSeasonActive(selectedSeason)}
                    className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1 font-semibold text-blue-900 hover:bg-blue-100"
                  >
                    Make Active
                  </button>
                )
              )}
            </div>
          )}

          {showCreateSeason && isAdmin && (
            <form
              onSubmit={createSeason}
              className="mt-6 rounded-2xl border border-blue-200 bg-blue-50/60 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-blue-950">
                    ✨ Create a New Season
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Create it manually or pull the season name from ARCL, then
                    generate all availability dates at once.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={loadingArclSeasons}
                  onClick={() => void loadArclSeasons()}
                  className="rounded-lg border border-blue-900 bg-white px-4 py-2 text-sm font-semibold text-blue-900 disabled:opacity-60"
                >
                  {loadingArclSeasons
                    ? "Loading ARCL…"
                    : "🏏 Import from ARCL"}
                </button>
              </div>

              {arclSeasons.length > 0 && (
                <label className="mt-5 block">
                  <span className="text-sm font-medium text-slate-700">
                    ARCL season
                  </span>
                  <select
                    value={selectedArclSeasonId}
                    onChange={(event) => applyArclSeason(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  >
                    <option value="">Choose an ARCL season</option>
                    {arclSeasons.map((season) => (
                      <option key={season.id} value={season.id}>
                        {season.name} — ARCL Season {season.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    ARCL supplies the season identity. Set the availability
                    window below so Starz can generate its own response dates.
                  </p>
                </label>
              )}

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Season name *
                  </span>
                  <input
                    type="text"
                    required
                    value={seasonForm.name}
                    onChange={(event) =>
                      setSeasonForm({
                        ...seasonForm,
                        name: event.target.value,
                      })
                    }
                    placeholder="Example: Summer 2027"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  />
                </label>

                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Start date *
                  </span>
                  <input
                    type="date"
                    required
                    value={seasonForm.start_date}
                    onChange={(event) =>
                      setSeasonForm({
                        ...seasonForm,
                        start_date: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  />
                </label>

                <label>
                  <span className="text-sm font-medium text-slate-700">
                    End date *
                  </span>
                  <input
                    type="date"
                    required
                    value={seasonForm.end_date}
                    onChange={(event) =>
                      setSeasonForm({
                        ...seasonForm,
                        end_date: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  />
                </label>
              </div>

              <label className="mt-4 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={seasonForm.active}
                  onChange={(event) =>
                    setSeasonForm({
                      ...seasonForm,
                      active: event.target.checked,
                    })
                  }
                />
                <span className="text-sm font-medium text-slate-700">
                  Make this the active season
                </span>
              </label>

              <button
                type="submit"
                disabled={savingSeason}
                className="mt-5 rounded-lg bg-blue-900 px-5 py-3 font-semibold text-white disabled:opacity-60"
              >
                {savingSeason ? "Creating…" : "Create Season"}
              </button>
            </form>
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
              {canManageDates && selectedSeasonId && (
                <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/60 p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-blue-950">
                        ⚡ Quick Generate Availability Dates
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        Generate every selected weekend day between this
                        season&apos;s start and end dates.
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-900 px-3 py-1 text-xs font-semibold text-white">
                      Faster setup
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label>
                      <span className="text-sm font-medium text-slate-700">
                        Start generating from
                      </span>
                      <input
                        type="date"
                        value={bulkStartDate}
                        min={selectedSeason?.start_date ?? undefined}
                        max={bulkEndDate || selectedSeason?.end_date || undefined}
                        onChange={(event) => {
                          setBulkStartDate(event.target.value);
                          setBulkPreview([]);
                          setMessage("");
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                      />
                    </label>

                    <label>
                      <span className="text-sm font-medium text-slate-700">
                        Generate until
                      </span>
                      <input
                        type="date"
                        value={bulkEndDate}
                        min={bulkStartDate || selectedSeason?.start_date || undefined}
                        max={selectedSeason?.end_date ?? undefined}
                        onChange={(event) => {
                          setBulkEndDate(event.target.value);
                          setBulkPreview([]);
                          setMessage("");
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={bulkSaturday}
                        onChange={(event) => {
                          setBulkSaturday(event.target.checked);
                          setBulkPreview([]);
                        }}
                      />
                      <span className="font-medium text-slate-700">
                        Saturdays
                      </span>
                    </label>

                    <label className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={bulkSunday}
                        onChange={(event) => {
                          setBulkSunday(event.target.checked);
                          setBulkPreview([]);
                        }}
                      />
                      <span className="font-medium text-slate-700">
                        Sundays
                      </span>
                    </label>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={generateBulkPreview}
                      className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                    >
                      Preview Dates
                    </button>

                    {bulkPreview.length > 0 && (
                      <button
                        type="button"
                        disabled={savingBulkDates}
                        onClick={() => void saveBulkDates()}
                        className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {savingBulkDates
                          ? "Adding dates…"
                          : `Add ${bulkPreview.length} Dates`}
                      </button>
                    )}

                    {bulkPreview.length > 0 && (
                      <button
                        type="button"
                        disabled={savingBulkDates}
                        onClick={() => {
                          setBulkPreview([]);
                          setMessage("");
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  {bulkPreview.length > 0 && (
                    <div className="mt-5">
                      <div className="mb-2 text-sm font-semibold text-slate-700">
                        Preview
                      </div>
                      <div className="max-h-56 overflow-y-auto rounded-xl border border-blue-100 bg-white">
                        {bulkPreview.map((item) => (
                          <div
                            key={item.game_date}
                            className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-sm last:border-b-0"
                          >
                            <span className="font-medium text-slate-700">
                              {formatDate(item.game_date)}
                            </span>
                            <span className="text-slate-500">
                              Week {item.week_number}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {canManageDates && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
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
                    className="mt-4 grid gap-3"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
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
                          Week number (optional)
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
                        className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
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
                          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
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

                {selectedSeasonId &&
                  gameDates.length > 0 &&
                  canManageDates && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={
                            gameDates.length > 0 &&
                            selectedDateIds.length === gameDates.length
                          }
                          onChange={toggleSelectAllDates}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Select All
                      </label>

                      <div className="flex flex-wrap items-center gap-2">
                        {selectedDateIds.length > 0 && (
                          <>
                            <span className="text-sm font-medium text-slate-600">
                              {selectedDateIds.length} selected
                            </span>

                            <button
                              type="button"
                              disabled={deletingSelectedDates}
                              onClick={() => setSelectedDateIds([])}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                              Clear
                            </button>

                            <button
                              type="button"
                              disabled={deletingSelectedDates}
                              onClick={() => void deleteSelectedDates()}
                              className="rounded-lg border border-red-600 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                            >
                              {deletingSelectedDates
                                ? "Deleting…"
                                : `Delete Selected (${selectedDateIds.length})`}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

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
                        className={`rounded-2xl border bg-white p-5 shadow-sm transition ${
                          selectedDateIds.includes(gameDate.id)
                            ? "border-blue-500 ring-2 ring-blue-100"
                            : gameDate.is_active
                              ? "border-slate-200"
                              : "border-slate-200 opacity-60"
                        }`}
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-start gap-3">
                            {canManageDates && (
                              <input
                                type="checkbox"
                                aria-label={`Select ${formatDate(
                                  gameDate.game_date
                                )}`}
                                checked={selectedDateIds.includes(
                                  gameDate.id
                                )}
                                onChange={() =>
                                  toggleDateSelection(gameDate.id)
                                }
                                className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300"
                              />
                            )}

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

function getSuggestedBulkStartDate(
  seasonStartDate: string | null
) {
  const today = toLocalDateString(new Date());

  if (!seasonStartDate) {
    return today;
  }

  return seasonStartDate > today
    ? seasonStartDate
    : today;
}

function getNextWeekNumber(gameDates: SeasonGameDate[]) {
  const highest = gameDates.reduce(
    (max, item) => Math.max(max, item.week_number || 0),
    0
  );

  return highest + 1;
}

function generateWeekendDates(
  startDate: string,
  endDate: string,
  includeSaturday: boolean,
  includeSunday: boolean,
  existingDates: Set<string>,
  firstWeekNumber: number
): BulkDatePreview[] {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
    return [];
  }

  const result: BulkDatePreview[] = [];
  const weekNumbers = new Map<string, number>();
  let nextWeekNumber = firstWeekNumber;

  const cursor = new Date(start);

  while (cursor <= end) {
    const day = cursor.getDay();
    const shouldInclude =
      (day === 6 && includeSaturday) ||
      (day === 0 && includeSunday);

    if (shouldInclude) {
      const dateValue = toLocalDateString(cursor);

      if (!existingDates.has(dateValue)) {
        const weekendKeyDate = new Date(cursor);

        if (day === 0) {
          weekendKeyDate.setDate(weekendKeyDate.getDate() - 1);
        }

        const weekendKey = toLocalDateString(weekendKeyDate);

        if (!weekNumbers.has(weekendKey)) {
          weekNumbers.set(weekendKey, nextWeekNumber);
          nextWeekNumber += 1;
        }

        result.push({
          game_date: dateValue,
          week_number: weekNumbers.get(weekendKey)!,
        });
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

function toLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}


