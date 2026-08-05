"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase/client";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";

type AvailabilityStatus =
  | "Available"
  | "Tentative"
  | "Unavailable";

type Season = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
};

type SeasonGameDate = {
  id: string;
  season_id: string;
  game_date: string;
  week_number: number;
  label: string | null;
  is_active: boolean;
};

type SeasonAvailability = {
  id: string;
  season_game_date_id: string;
  member_id: string;
  status: AvailabilityStatus;
  notes: string | null;
  updated_at: string;
};

type AvailabilityForm = Record<
  string,
  {
    status: AvailabilityStatus | "";
    notes: string;
  }
>;

const statusOptions: {
  value: AvailabilityStatus;
  label: string;
  icon: string;
  selectedClassName: string;
}[] = [
  {
    value: "Available",
    label: "Available",
    icon: "✅",
    selectedClassName:
      "border-green-600 bg-green-100 text-green-900",
  },
  {
    value: "Tentative",
    label: "Tentative",
    icon: "🟡",
    selectedClassName:
      "border-amber-500 bg-amber-100 text-amber-900",
  },
  {
    value: "Unavailable",
    label: "Unavailable",
    icon: "❌",
    selectedClassName:
      "border-red-600 bg-red-100 text-red-900",
  },
];

export default function AvailabilityPage() {
  const { profile, loadingProfile } =
    useCurrentProfile();

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] =
    useState("");

  const [gameDates, setGameDates] = useState<
    SeasonGameDate[]
  >([]);

  const [availability, setAvailability] =
    useState<AvailabilityForm>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selectedSeason = useMemo(
    () =>
      seasons.find(
        (season) => season.id === selectedSeasonId
      ) ?? null,
    [seasons, selectedSeasonId]
  );

  const completedCount = useMemo(
    () =>
      gameDates.filter(
        (gameDate) =>
          Boolean(availability[gameDate.id]?.status)
      ).length,
    [availability, gameDates]
  );

  const completionPercentage =
    gameDates.length > 0
      ? Math.round(
          (completedCount / gameDates.length) * 100
        )
      : 0;

  const availableCount = useMemo(
    () =>
      gameDates.filter(
        (gameDate) =>
          availability[gameDate.id]?.status ===
          "Available"
      ).length,
    [availability, gameDates]
  );

  const tentativeCount = useMemo(
    () =>
      gameDates.filter(
        (gameDate) =>
          availability[gameDate.id]?.status ===
          "Tentative"
      ).length,
    [availability, gameDates]
  );

  const unavailableCount = useMemo(
    () =>
      gameDates.filter(
        (gameDate) =>
          availability[gameDate.id]?.status ===
          "Unavailable"
      ).length,
    [availability, gameDates]
  );

  const weightedAvailability = useMemo(() => {
    if (gameDates.length === 0) {
      return 0;
    }

    const weightedScore =
      availableCount + tentativeCount * 0.5;

    return Math.round(
      (weightedScore / gameDates.length) * 100
    );
  }, [
    availableCount,
    tentativeCount,
    gameDates.length,
  ]);

  const loadSeasonAvailability = useCallback(
    async (seasonId: string) => {
      if (!profile?.memberId || !seasonId) {
        setGameDates([]);
        setAvailability({});
        setLoading(false);
        return;
      }

      setLoading(true);
      setMessage("");

      const gameDatesResult = await supabase
        .from("season_game_dates")
        .select(
          `
            id,
            season_id,
            game_date,
            week_number,
            label,
            is_active
          `
        )
        .eq("season_id", seasonId)
        .eq("is_active", true)
        .order("week_number", {
          ascending: true,
        });

      if (gameDatesResult.error) {
        setMessage(
          `Unable to load weekend dates: ${gameDatesResult.error.message}`
        );
        setGameDates([]);
        setAvailability({});
        setLoading(false);
        return;
      }

      const loadedGameDates =
        (gameDatesResult.data ??
          []) as SeasonGameDate[];

      setGameDates(loadedGameDates);

      if (loadedGameDates.length === 0) {
        setAvailability({});
        setLoading(false);
        return;
      }

      const gameDateIds = loadedGameDates.map(
        (gameDate) => gameDate.id
      );

      const responsesResult = await supabase
        .from("season_availability")
        .select(
          `
            id,
            season_game_date_id,
            member_id,
            status,
            notes,
            updated_at
          `
        )
        .eq("member_id", profile.memberId)
        .in("season_game_date_id", gameDateIds);

      if (responsesResult.error) {
        setMessage(
          `Unable to load your availability: ${responsesResult.error.message}`
        );
        setAvailability({});
        setLoading(false);
        return;
      }

      const loadedResponses =
        (responsesResult.data ??
          []) as SeasonAvailability[];

      const responseByDateId = new Map(
        loadedResponses.map((response) => [
          response.season_game_date_id,
          response,
        ])
      );

      const nextAvailability: AvailabilityForm = {};

      loadedGameDates.forEach((gameDate) => {
        const response = responseByDateId.get(
          gameDate.id
        );

        nextAvailability[gameDate.id] = {
          status: response?.status ?? "",
          notes: response?.notes ?? "",
        };
      });

      setAvailability(nextAvailability);
      setLoading(false);
    },
    [profile?.memberId]
  );

  const loadInitialData = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    const seasonsResult = await supabase
      .from("seasons")
      .select(
        `
          id,
          name,
          start_date,
          end_date,
          active
        `
      )
      .order("start_date", {
        ascending: false,
      });

    if (seasonsResult.error) {
      setMessage(
        `Unable to load seasons: ${seasonsResult.error.message}`
      );
      setLoading(false);
      return;
    }

    const loadedSeasons =
      (seasonsResult.data ?? []) as Season[];

    setSeasons(loadedSeasons);

    const defaultSeason =
      loadedSeasons.find(
        (season) => season.active
      ) ??
      loadedSeasons[0] ??
      null;

    if (!defaultSeason) {
      setLoading(false);
      return;
    }

    setSelectedSeasonId(defaultSeason.id);

    await loadSeasonAvailability(
      defaultSeason.id
    );
  }, [loadSeasonAvailability, profile]);

  useEffect(() => {
    if (loadingProfile) {
      return;
    }

    void loadInitialData();
  }, [loadingProfile, loadInitialData]);

  async function handleSeasonChange(
    seasonId: string
  ) {
    setSelectedSeasonId(seasonId);
    setMessage("");

    await loadSeasonAvailability(seasonId);
  }

  function updateStatus(
    gameDateId: string,
    status: AvailabilityStatus
  ) {
    setAvailability((current) => ({
      ...current,
      [gameDateId]: {
        status,
        notes:
          current[gameDateId]?.notes ?? "",
      },
    }));

    setMessage("");
  }

  function updateNotes(
    gameDateId: string,
    notes: string
  ) {
    setAvailability((current) => ({
      ...current,
      [gameDateId]: {
        status:
          current[gameDateId]?.status ?? "",
        notes,
      },
    }));
  }

  async function saveAvailability() {
    if (!profile?.memberId) {
      setMessage(
        "Your login is not linked to a club member profile."
      );
      return;
    }

    if (!selectedSeasonId) {
      setMessage("Please select a season.");
      return;
    }

    const incompleteDates = gameDates.filter(
      (gameDate) =>
        !availability[gameDate.id]?.status
    );

    if (incompleteDates.length > 0) {
      setMessage(
        `Please select an availability status for all ${gameDates.length} weekend dates.`
      );
      return;
    }

    const responses = gameDates.map(
      (gameDate) => ({
        season_game_date_id: gameDate.id,
        member_id: profile.memberId,
        status:
          availability[gameDate.id]
            .status as AvailabilityStatus,
        notes:
          availability[
            gameDate.id
          ].notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
    );

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("season_availability")
      .upsert(responses, {
        onConflict:
          "season_game_date_id,member_id",
      });

    if (error) {
      setMessage(
        `Unable to save availability: ${error.message}`
      );
      setSaving(false);
      return;
    }

    await loadSeasonAvailability(
      selectedSeasonId
    );

    setMessage(
      "Your season availability was saved successfully."
    );

    setSaving(false);
  }

  if (loadingProfile) {
    return (
      <PageMessage message="Checking account…" />
    );
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
              Sign in to submit your season
              availability.
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

  if (!profile.memberId) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-10">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/"
            className="text-blue-700 hover:underline"
          >
            ← Back to Home
          </Link>

          <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
            <div className="text-4xl">⚠️</div>

            <h1 className="mt-4 text-2xl font-bold text-amber-900">
              Member profile not linked
            </h1>

            <p className="mt-2 text-amber-800">
              Your login account must be linked to
              your record in the Members table before
              you can submit availability.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="text-blue-700 hover:underline"
        >
          ← Back to Home
        </Link>

        <div className="mt-6">
          <h1 className="text-3xl font-bold text-blue-900">
            ✅ My Season Availability
          </h1>

          <p className="mt-2 text-slate-600">
            Welcome,{" "}
            <strong>
              {profile.memberName ||
                profile.email}
            </strong>
            . Mark your availability for each
            weekend in the selected season.
          </p>
        </div>

        {message && (
          <div
            className={`mt-5 rounded-lg border p-4 text-sm ${
              message.includes("successfully")
                ? "border-green-200 bg-green-50 text-green-900"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            {message}
          </div>
        )}

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <label>
            <span className="text-sm font-medium text-slate-700">
              Season
            </span>

            <select
              value={selectedSeasonId}
              onChange={(event) =>
                void handleSeasonChange(
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3"
            >
              <option value="">
                Select a season
              </option>

              {seasons.map((season) => (
                <option
                  key={season.id}
                  value={season.id}
                >
                  {season.name}
                  {season.active
                    ? " — Active"
                    : ""}
                </option>
              ))}
            </select>
          </label>

          {selectedSeason && (
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedSeason.start_date && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                  Starts:{" "}
                  {formatDate(
                    selectedSeason.start_date
                  )}
                </span>
              )}

              {selectedSeason.end_date && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                  Ends:{" "}
                  {formatDate(
                    selectedSeason.end_date
                  )}
                </span>
              )}
            </div>
          )}
        </section>

        {!loading && gameDates.length > 0 && (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                label="Completed"
                value={`${completedCount}/${gameDates.length}`}
                detail={`${completionPercentage}% complete`}
                className="bg-blue-50 text-blue-900"
              />

              <SummaryCard
                label="Available"
                value={availableCount.toString()}
                detail="Full availability"
                className="bg-green-50 text-green-900"
              />

              <SummaryCard
                label="Tentative"
                value={tentativeCount.toString()}
                detail="May be available"
                className="bg-amber-50 text-amber-900"
              />

              <SummaryCard
                label="Weighted availability"
                value={`${weightedAvailability}%`}
                detail="Tentative counts as 50%"
                className="bg-violet-50 text-violet-900"
              />
            </section>

            <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-blue-700 transition-all duration-300"
                style={{
                  width: `${completionPercentage}%`,
                }}
              />
            </div>
          </>
        )}

        {loading ? (
          <p className="mt-8 text-slate-600">
            Loading weekend dates…
          </p>
        ) : !selectedSeasonId ? (
          <p className="mt-8 text-slate-600">
            Select a season to continue.
          </p>
        ) : gameDates.length === 0 ? (
          <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <div className="text-4xl">📅</div>

            <h2 className="mt-4 text-xl font-semibold text-slate-900">
              No weekend dates available
            </h2>

            <p className="mt-2 text-slate-600">
              An Admin or Captain must add the
              season’s weekend dates before players
              can submit availability.
            </p>
          </section>
        ) : (
          <>
            <section className="mt-8 space-y-5">
              {gameDates.map((gameDate) => {
                const response =
                  availability[gameDate.id];

                return (
                  <article
                    key={gameDate.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="lg:max-w-xs">
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900">
                          Week {gameDate.week_number}
                        </span>

                        <h2 className="mt-3 text-xl font-semibold text-blue-900">
                          {formatLongDate(
                            gameDate.game_date
                          )}
                        </h2>

                        {gameDate.label && (
                          <p className="mt-1 text-sm text-slate-600">
                            {gameDate.label}
                          </p>
                        )}
                      </div>

                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-700">
                          Are you available?
                        </p>

                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          {statusOptions.map(
                            (option) => {
                              const isSelected =
                                response?.status ===
                                option.value;

                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() =>
                                    updateStatus(
                                      gameDate.id,
                                      option.value
                                    )
                                  }
                                  className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                                    isSelected
                                      ? option.selectedClassName
                                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                                  }`}
                                >
                                  <span className="mr-2">
                                    {option.icon}
                                  </span>

                                  {option.label}
                                </button>
                              );
                            }
                          )}
                        </div>

                        <label className="mt-4 block">
                          <span className="text-sm font-medium text-slate-700">
                            Optional note
                          </span>

                          <input
                            type="text"
                            value={
                              response?.notes ?? ""
                            }
                            onChange={(event) =>
                              updateNotes(
                                gameDate.id,
                                event.target.value
                              )
                            }
                            placeholder="Example: Available after 2 PM"
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                          />
                        </label>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            <div className="sticky bottom-4 mt-8 rounded-2xl border border-blue-200 bg-white/95 p-4 shadow-xl backdrop-blur sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-900">
                  {completedCount} of{" "}
                  {gameDates.length} weekends
                  completed
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  You can return and update these
                  responses later.
                </p>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void saveAvailability()
                }
                className="mt-4 w-full rounded-lg bg-blue-900 px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 sm:mt-0 sm:w-auto"
              >
                {saving
                  ? "Saving…"
                  : "Save My Availability"}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: string;
  detail: string;
  className: string;
}) {
  return (
    <article
      className={`rounded-xl border border-slate-200 p-4 shadow-sm ${className}`}
    >
      <p className="text-sm font-medium">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold">
        {value}
      </p>

      <p className="mt-1 text-xs opacity-80">
        {detail}
      </p>
    </article>
  );
}

function PageMessage({
  message,
}: {
  message: string;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-6xl">
        <p className="text-slate-600">
          {message}
        </p>
      </div>
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}
