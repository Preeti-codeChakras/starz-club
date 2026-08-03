"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type AvailabilityStatus =
  | "Available"
  | "Tentative"
  | "Unavailable";

type Member = {
  id: string;
  name: string;
};

type Team = {
  id: string;
  name: string;
};

type ClubEvent = {
  id: string;
  title: string;
  event_type: "Practice" | "Game" | "Club Event";
  starts_at: string;
  team_id: string | null;
  location_name: string;
};

type AvailabilityRow = {
  id: string;
  event_id: string;
  member_id: string;
  status: AvailabilityStatus;
  notes: string | null;
};

type ResponseMap = Record<
  string,
  AvailabilityStatus | ""
>;

const statusOptions: {
  value: AvailabilityStatus;
  label: string;
  selectedClassName: string;
}[] = [
  {
    value: "Available",
    label: "🟢 Available",
    selectedClassName:
      "border-green-600 bg-green-100 text-green-800",
  },
  {
    value: "Tentative",
    label: "🟡 Tentative",
    selectedClassName:
      "border-amber-500 bg-amber-100 text-amber-800",
  },
  {
    value: "Unavailable",
    label: "🔴 Unavailable",
    selectedClassName:
      "border-red-600 bg-red-100 text-red-800",
  },
];

export default function AvailabilityPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [availabilityRows, setAvailabilityRows] = useState<
    AvailabilityRow[]
  >([]);

  const [selectedMemberId, setSelectedMemberId] =
    useState("");
  const [responses, setResponses] = useState<ResponseMap>(
    {}
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);
    setMessage("");

    const [membersResult, teamsResult, seasonResult] =
      await Promise.all([
        supabase
          .from("members")
          .select("id, name")
          .order("name"),

        supabase
          .from("teams")
          .select("id, name")
          .order("name"),

        supabase
          .from("seasons")
          .select("id, name")
          .eq("active", true)
          .limit(1)
          .maybeSingle(),
      ]);

    if (membersResult.error) {
      setMessage(
        `Unable to load members: ${membersResult.error.message}`
      );
      setLoading(false);
      return;
    }

    if (teamsResult.error) {
      setMessage(
        `Unable to load teams: ${teamsResult.error.message}`
      );
      setLoading(false);
      return;
    }

    if (seasonResult.error) {
      setMessage(
        `Unable to load the active season: ${seasonResult.error.message}`
      );
      setLoading(false);
      return;
    }

    setMembers(membersResult.data ?? []);
    setTeams(teamsResult.data ?? []);

    if (!seasonResult.data) {
      setMessage(
        "No active season was found. Mark a season as active in Supabase."
      );
      setLoading(false);
      return;
    }

    const eventsResult = await supabase
      .from("events")
      .select(
        `
          id,
          title,
          event_type,
          starts_at,
          team_id,
          location_name
        `
      )
      .eq("season_id", seasonResult.data.id)
      .order("starts_at", { ascending: true });

    if (eventsResult.error) {
      setMessage(
        `Unable to load events: ${eventsResult.error.message}`
      );
      setLoading(false);
      return;
    }

    const loadedEvents =
      (eventsResult.data ?? []) as ClubEvent[];

    setEvents(loadedEvents);

    if (loadedEvents.length === 0) {
      setAvailabilityRows([]);
      setLoading(false);
      return;
    }

    const eventIds = loadedEvents.map(
      (event) => event.id
    );

    const availabilityResult = await supabase
      .from("event_availability")
      .select(
        "id, event_id, member_id, status, notes"
      )
      .in("event_id", eventIds);

    if (availabilityResult.error) {
      setMessage(
        `Unable to load availability: ${availabilityResult.error.message}`
      );
    } else {
      setAvailabilityRows(
        (availabilityResult.data ??
          []) as AvailabilityRow[]
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!selectedMemberId) {
      setResponses({});
      return;
    }

    const memberResponses: ResponseMap = {};

    for (const event of events) {
      const savedResponse = availabilityRows.find(
        (row) =>
          row.member_id === selectedMemberId &&
          row.event_id === event.id
      );

      memberResponses[event.id] =
        savedResponse?.status ?? "";
    }

    setResponses(memberResponses);
    setMessage("");
  }, [
    selectedMemberId,
    events,
    availabilityRows,
  ]);

  function selectStatus(
    eventId: string,
    status: AvailabilityStatus
  ) {
    setResponses((current) => ({
      ...current,
      [eventId]: status,
    }));

    setMessage("");
  }

  function clearStatus(eventId: string) {
    setResponses((current) => ({
      ...current,
      [eventId]: "",
    }));

    setMessage("");
  }

  async function saveAllAvailability() {
    if (!selectedMemberId) {
      setMessage("Please select your name.");
      return;
    }

    const completedResponses = events
      .filter((event) => responses[event.id])
      .map((event) => ({
        event_id: event.id,
        member_id: selectedMemberId,
        status: responses[
          event.id
        ] as AvailabilityStatus,
        updated_at: new Date().toISOString(),
      }));

    if (completedResponses.length === 0) {
      setMessage(
        "Please mark your availability for at least one event."
      );
      return;
    }

    setSaving(true);
    setMessage("");

    const { error: saveError } = await supabase
      .from("event_availability")
      .upsert(completedResponses, {
        onConflict: "event_id,member_id",
      });

    if (saveError) {
      setMessage(
        `Unable to save availability: ${saveError.message}`
      );
      setSaving(false);
      return;
    }

    /*
      Remove previously saved responses that the player
      cleared on this page.
    */
    const clearedEventIds = events
      .filter((event) => !responses[event.id])
      .map((event) => event.id);

    if (clearedEventIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("event_availability")
        .delete()
        .eq("member_id", selectedMemberId)
        .in("event_id", clearedEventIds);

      if (deleteError) {
        setMessage(
          `Availability was saved, but cleared responses could not be removed: ${deleteError.message}`
        );
        setSaving(false);
        await loadData();
        return;
      }
    }

    await loadData();

    setMessage("Availability saved successfully.");
    setSaving(false);
  }

  function getTeamName(teamId: string | null) {
    if (!teamId) {
      return "Entire Starz Club";
    }

    return (
      teams.find((team) => team.id === teamId)
        ?.name ?? "Unknown team"
    );
  }

  const selectedMemberName =
    members.find(
      (member) => member.id === selectedMemberId
    )?.name ?? "";

  const answeredCount = Object.values(
    responses
  ).filter(Boolean).length;

  const summaryByEvent = useMemo(() => {
    const summary: Record<
      string,
      {
        available: number;
        tentative: number;
        unavailable: number;
        noResponse: number;
      }
    > = {};

    for (const event of events) {
      const eventRows = availabilityRows.filter(
        (row) => row.event_id === event.id
      );

      summary[event.id] = {
        available: eventRows.filter(
          (row) => row.status === "Available"
        ).length,
        tentative: eventRows.filter(
          (row) => row.status === "Tentative"
        ).length,
        unavailable: eventRows.filter(
          (row) => row.status === "Unavailable"
        ).length,
        noResponse: Math.max(
          members.length - eventRows.length,
          0
        ),
      };
    }

    return summary;
  }, [events, availabilityRows, members.length]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/"
          className="text-blue-700 hover:underline"
        >
          ← Back to Home
        </Link>

        <h1 className="mt-6 text-3xl font-bold text-blue-900">
          ✅ Season Availability
        </h1>

        <p className="mt-3 max-w-3xl text-slate-600">
          Select your name and mark your availability
          for the season’s practices, games, and club
          events.
        </p>

        {message && (
          <p className="mt-5 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            {message}
          </p>
        )}

        {loading && (
          <p className="mt-8 text-slate-600">
            Loading availability…
          </p>
        )}

        {!loading && (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            {/* PLAYER AVAILABILITY */}
            <section>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Select your name *
                  </span>

                  <select
                    value={selectedMemberId}
                    onChange={(event) =>
                      setSelectedMemberId(
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3"
                  >
                    <option value="">
                      Choose your name
                    </option>

                    {members.map((member) => (
                      <option
                        key={member.id}
                        value={member.id}
                      >
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedMemberId && (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-lg bg-blue-50 p-4">
                    <div>
                      <p className="font-semibold text-blue-900">
                        {selectedMemberName}
                      </p>

                      <p className="mt-1 text-sm text-blue-700">
                        {answeredCount} of{" "}
                        {events.length} events answered
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void saveAllAvailability()
                      }
                      className="rounded-lg bg-blue-900 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving
                        ? "Saving…"
                        : "Save All Availability"}
                    </button>
                  </div>
                )}
              </div>

              {events.length === 0 && (
                <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <div className="text-4xl">📅</div>

                  <p className="mt-3 font-medium text-slate-800">
                    No events are scheduled for the
                    active season yet.
                  </p>

                  <Link
                    href="/schedule"
                    className="mt-3 inline-block text-blue-700 hover:underline"
                  >
                    Go to Schedule →
                  </Link>
                </div>
              )}

              {selectedMemberId &&
                events.length > 0 && (
                  <div className="mt-5 space-y-4">
                    {events.map((event) => {
                      const selectedStatus =
                        responses[event.id] ?? "";

                      return (
                        <article
                          key={event.id}
                          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                        >
                          <div className="flex flex-col gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <EventTypeBadge
                                  type={
                                    event.event_type
                                  }
                                />

                                <span className="text-sm font-medium text-slate-500">
                                  {getTeamName(
                                    event.team_id
                                  )}
                                </span>
                              </div>

                              <h2 className="mt-3 text-lg font-semibold text-blue-900">
                                {event.title}
                              </h2>

                              <p className="mt-2 text-sm font-medium text-slate-700">
                                {formatEventDate(
                                  event.starts_at
                                )}
                              </p>

                              <p className="mt-1 text-sm text-slate-600">
                                📍{" "}
                                {event.location_name}
                              </p>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-3">
                              {statusOptions.map(
                                (option) => {
                                  const isSelected =
                                    selectedStatus ===
                                    option.value;

                                  return (
                                    <button
                                      key={
                                        option.value
                                      }
                                      type="button"
                                      onClick={() =>
                                        selectStatus(
                                          event.id,
                                          option.value
                                        )
                                      }
                                      className={`rounded-lg border px-3 py-3 text-sm font-medium transition ${
                                        isSelected
                                          ? option.selectedClassName
                                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                      }`}
                                    >
                                      {option.label}
                                    </button>
                                  );
                                }
                              )}
                            </div>

                            {selectedStatus && (
                              <button
                                type="button"
                                onClick={() =>
                                  clearStatus(
                                    event.id
                                  )
                                }
                                className="self-start text-sm text-slate-500 hover:text-red-600 hover:underline"
                              >
                                Clear response
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void saveAllAvailability()
                      }
                      className="w-full rounded-lg bg-blue-900 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving
                        ? "Saving…"
                        : "Save All Availability"}
                    </button>
                  </div>
                )}

              {!selectedMemberId &&
                events.length > 0 && (
                  <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                    <div className="text-4xl">👤</div>

                    <p className="mt-3 font-medium text-slate-800">
                      Select your name to begin.
                    </p>

                    <p className="mt-1 text-sm text-slate-600">
                      Your previously saved answers will
                      load automatically.
                    </p>
                  </div>
                )}
            </section>

            {/* CAPTAIN OVERVIEW */}
            <section className="lg:sticky lg:top-6">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-blue-900">
                  📊 Captain Overview
                </h2>

                <p className="mt-2 text-sm text-slate-600">
                  Live availability totals for each
                  scheduled event.
                </p>

                {events.length === 0 ? (
                  <p className="mt-5 text-sm text-slate-600">
                    No scheduled events to summarize.
                  </p>
                ) : (
                  <div className="mt-5 space-y-4">
                    {events.map((event) => {
                      const summary =
                        summaryByEvent[event.id];

                      return (
                        <article
                          key={event.id}
                          className="rounded-lg border border-slate-200 p-4"
                        >
                          <h3 className="font-semibold text-slate-900">
                            {event.title}
                          </h3>

                          <p className="mt-1 text-xs text-slate-500">
                            {formatShortDate(
                              event.starts_at
                            )}
                          </p>

                          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                            <SummaryItem
                              label="Available"
                              value={
                                summary.available
                              }
                              className="bg-green-50 text-green-800"
                            />

                            <SummaryItem
                              label="Tentative"
                              value={
                                summary.tentative
                              }
                              className="bg-amber-50 text-amber-800"
                            />

                            <SummaryItem
                              label="Unavailable"
                              value={
                                summary.unavailable
                              }
                              className="bg-red-50 text-red-800"
                            />

                            <SummaryItem
                              label="No response"
                              value={
                                summary.noResponse
                              }
                              className="bg-slate-100 text-slate-700"
                            />
                          </div>
                        </article>
                      );
                    })}
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

function EventTypeBadge({
  type,
}: {
  type: ClubEvent["event_type"];
}) {
  const label =
    type === "Game"
      ? "🏏 Game"
      : type === "Practice"
        ? "🥎 Practice"
        : "🎉 Club Event";

  return (
    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900">
      {label}
    </span>
  );
}

function SummaryItem({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div
      className={`rounded-lg p-3 ${className}`}
    >
      <p className="text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs font-medium">
        {label}
      </p>
    </div>
  );
}

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
