"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Team = {
  id: string;
  name: string;
};

type Member = {
  id: string;
  name: string;
};

type SeasonTeamMember = {
  team_id: string;
  member_id: string;
};

type Season = {
  id: string;
  name: string;
};

type ClubEvent = {
  id: string;
  title: string;
  event_type: "Practice" | "Game" | "Club Event" | "Umpiring Assignment";
  starts_at: string;
  ends_at: string | null;
  season_id: string | null;
  team_id: string | null;
  opponent: string | null;
  location_name: string;
  location_address: string | null;
  maps_url: string | null;
  notes: string | null;
  umpiring_team_id: string | null;
  umpire_member_id: string | null;
  umpire_status: "Pending" | "Confirmed" | "Declined";
  umpire_notes: string | null;
};

type EventForm = {
  title: string;
  event_type: "Practice" | "Game" | "Club Event" | "Umpiring Assignment";
  starts_at: string;
  ends_at: string;
  team_id: string;
  opponent: string;
  location_name: string;
  location_address: string;
  maps_url: string;
  notes: string;
  umpiring_team_id: string;
  umpire_member_id: string;
  umpire_status: "Pending" | "Confirmed" | "Declined";
  umpire_notes: string;
};

const initialForm: EventForm = {
  title: "",
  event_type: "Practice",
  starts_at: "",
  ends_at: "",
  team_id: "",
  opponent: "",
  location_name: "",
  location_address: "",
  maps_url: "",
  notes: "",
  umpiring_team_id: "",
  umpire_member_id: "",
  umpire_status: "Pending",
  umpire_notes: "",
};

export default function SchedulePage() {
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [seasonTeamMembers, setSeasonTeamMembers] = useState<
    SeasonTeamMember[]
  >([]);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);

  const [form, setForm] = useState<EventForm>(initialForm);
  const [editingEventId, setEditingEventId] = useState<string | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(
    null
  );

  const [message, setMessage] = useState("");

  async function loadScheduleData() {
    setLoading(true);
    setMessage("");

    const [eventsResult, teamsResult, membersResult, seasonResult] =
      await Promise.all([
      supabase
        .from("events")
        .select(
          `
            id,
            title,
            event_type,
            starts_at,
            ends_at,
            season_id,
            team_id,
            opponent,
            location_name,
            location_address,
            maps_url,
            notes,
            umpiring_team_id,
            umpire_member_id,
            umpire_status,
            umpire_notes
          `
        )
        .order("starts_at", { ascending: true }),

      supabase
        .from("teams")
        .select("id, name")
        .order("name"),

      supabase
        .from("members")
        .select("id, name")
        .order("name"),

      supabase
        .from("seasons")
        .select("id, name")
        .eq("active", true)
        .limit(1)
        .maybeSingle(),
    ]);

    if (eventsResult.error) {
      setMessage(
        `Unable to load events: ${eventsResult.error.message}`
      );
    } else {
      setEvents((eventsResult.data ?? []) as ClubEvent[]);
    }

    if (teamsResult.error) {
      setMessage(
        `Unable to load teams: ${teamsResult.error.message}`
      );
    } else {
      setTeams(teamsResult.data ?? []);
    }

    if (membersResult.error) {
      setMessage(
        `Unable to load members: ${membersResult.error.message}`
      );
    } else {
      setMembers((membersResult.data ?? []) as Member[]);
    }

    if (seasonResult.error) {
      setMessage(
        `Unable to load active season: ${seasonResult.error.message}`
      );
      setActiveSeason(null);
      setSeasonTeamMembers([]);
    } else {
      const season = seasonResult.data as Season | null;
      setActiveSeason(season);

      if (season?.id) {
        const { data: assignmentRows, error: assignmentError } =
          await supabase
            .from("season_team_members")
            .select("team_id, member_id")
            .eq("season_id", season.id);

        if (assignmentError) {
          setMessage(
            `Unable to load team rosters: ${assignmentError.message}`
          );
          setSeasonTeamMembers([]);
        } else {
          setSeasonTeamMembers(
            (assignmentRows ?? []) as SeasonTeamMember[]
          );
        }
      } else {
        setSeasonTeamMembers([]);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadScheduleData();
  }, []);

  function resetForm() {
    setForm(initialForm);
    setEditingEventId(null);
  }

  function startEditing(event: ClubEvent) {
    setEditingEventId(event.id);

    setForm({
      title: event.title,
      event_type: event.event_type,
      starts_at: convertToDateTimeInput(event.starts_at),
      ends_at: event.ends_at
        ? convertToDateTimeInput(event.ends_at)
        : "",
      team_id: event.team_id ?? "",
      opponent: event.opponent ?? "",
      location_name: event.location_name,
      location_address: event.location_address ?? "",
      maps_url: event.maps_url ?? "",
      notes: event.notes ?? "",
      umpiring_team_id:
        event.event_type === "Umpiring Assignment"
          ? event.team_id ?? event.umpiring_team_id ?? ""
          : event.umpiring_team_id ?? "",
      umpire_member_id: event.umpire_member_id ?? "",
      umpire_status: event.umpire_status ?? "Pending",
      umpire_notes: event.umpire_notes ?? "",
    });

    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelEditing() {
    resetForm();
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const title = form.title.trim();
    const locationName = form.location_name.trim();

    if (!title) {
      setMessage("Event title is required.");
      return;
    }

    if (!form.starts_at) {
      setMessage("Start date and time are required.");
      return;
    }

    if (!locationName) {
      setMessage("Location name is required.");
      return;
    }

    const startsAt = new Date(form.starts_at);

    if (Number.isNaN(startsAt.getTime())) {
      setMessage("Please enter a valid start date and time.");
      return;
    }

    let endsAt: Date | null = null;

    if (form.ends_at) {
      endsAt = new Date(form.ends_at);

      if (Number.isNaN(endsAt.getTime())) {
        setMessage("Please enter a valid end date and time.");
        return;
      }

      if (endsAt < startsAt) {
        setMessage("End time cannot be before the start time.");
        return;
      }
    }

    if (
      form.event_type === "Game" &&
      form.umpiring_team_id &&
      form.umpiring_team_id === form.team_id
    ) {
      setMessage(
        "The umpiring team must be different from the Starz team playing this game."
      );
      return;
    }

    if (
      form.event_type === "Umpiring Assignment" &&
      !form.team_id
    ) {
      setMessage(
        "Please select the Starz team responsible for this umpiring assignment."
      );
      return;
    }

    if (
      (form.event_type === "Game" ||
        form.event_type === "Umpiring Assignment") &&
      form.umpire_status === "Confirmed" &&
      !form.umpire_member_id
    ) {
      setMessage(
        "Please select an umpire before marking the assignment Confirmed."
      );
      return;
    }

    setSubmitting(true);

    const eventData = {
      title,
      event_type: form.event_type,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt?.toISOString() ?? null,
      season_id: activeSeason?.id ?? null,
      team_id: form.team_id || null,
      opponent: form.opponent.trim() || null,
      location_name: locationName,
      location_address: form.location_address.trim() || null,
      maps_url: form.maps_url.trim() || null,
      notes: form.notes.trim() || null,
      umpiring_team_id:
        form.event_type === "Umpiring Assignment"
          ? form.team_id || null
          : form.event_type === "Game"
            ? form.umpiring_team_id || null
            : null,
      umpire_member_id:
        form.event_type === "Game" ||
        form.event_type === "Umpiring Assignment"
          ? form.umpire_member_id || null
          : null,
      umpire_status:
        form.event_type === "Game" ||
        form.event_type === "Umpiring Assignment"
          ? form.umpire_status
          : "Pending",
      umpire_notes:
        form.event_type === "Game" ||
        form.event_type === "Umpiring Assignment"
          ? form.umpire_notes.trim() || null
          : null,
    };

    const { error } = editingEventId
      ? await supabase
          .from("events")
          .update(eventData)
          .eq("id", editingEventId)
      : await supabase.from("events").insert(eventData);

    if (error) {
      setMessage(
        `Unable to ${
          editingEventId ? "update" : "add"
        } event: ${error.message}`
      );

      setSubmitting(false);
      return;
    }

    const successMessage = editingEventId
      ? "Event updated successfully."
      : "Event added successfully.";

    resetForm();

    await loadScheduleData();

    setMessage(successMessage);
    setSubmitting(false);
  }

  async function deleteEvent(event: ClubEvent) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${event.title}"?`
    );

    if (!confirmed) {
      return;
    }

    setDeletingEventId(event.id);
    setMessage("");

    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", event.id);

    if (error) {
      setMessage(`Unable to delete event: ${error.message}`);
      setDeletingEventId(null);
      return;
    }

    if (editingEventId === event.id) {
      resetForm();
    }

    await loadScheduleData();

    setMessage("Event deleted successfully.");
    setDeletingEventId(null);
  }

  function getTeamName(teamId: string | null) {
    if (!teamId) {
      return "Entire Starz Club";
    }

    return (
      teams.find((team) => team.id === teamId)?.name ??
      "Unknown team"
    );
  }

  function getMemberName(memberId: string | null) {
    if (!memberId) {
      return "Not assigned";
    }

    return (
      members.find((member) => member.id === memberId)?.name ??
      "Unknown member"
    );
  }

  function getMembersForTeam(teamId: string) {
    if (!teamId) {
      return [];
    }

    const memberIds = new Set(
      seasonTeamMembers
        .filter((row) => row.team_id === teamId)
        .map((row) => row.member_id)
    );

    return members.filter((member) => memberIds.has(member.id));
  }

  const umpiringRosterTeamId =
    form.event_type === "Umpiring Assignment"
      ? form.team_id
      : form.umpiring_team_id;

  const availableUmpires = getMembersForTeam(
    umpiringRosterTeamId
  );

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <Link href="/" className="text-blue-700 hover:underline">
          ← Back to Home
        </Link>

        <h1 className="mt-6 text-3xl font-bold text-blue-900">
          📅 Practice and Game Schedule
        </h1>

        <p className="mt-3 text-slate-600">
          Manage games, practices, locations, and club events
          {activeSeason ? ` for ${activeSeason.name}` : ""}.
        </p>

        {message && (
          <p className="mt-5 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            {message}
          </p>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          {/* LEFT SIDE: UPCOMING EVENTS */}
          <section>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  Upcoming schedule
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  View upcoming practices, games, and club events.
                </p>
              </div>

              <span className="shrink-0 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-900">
                {events.length}{" "}
                {events.length === 1 ? "event" : "events"}
              </span>
            </div>

            {loading && (
              <p className="mt-5 text-slate-600">
                Loading events…
              </p>
            )}

            {!loading && events.length === 0 && (
              <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <div className="text-4xl">📅</div>

                <p className="mt-3 font-medium text-slate-800">
                  No events scheduled yet
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  Use the form to add your first event.
                </p>
              </div>
            )}

            <div className="mt-6 space-y-4">
              {events.map((event) => (
                <article
                  key={event.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <EventTypeBadge
                          type={event.event_type}
                        />

                        <span className="text-sm font-medium text-slate-500">
                          {getTeamName(event.team_id)}
                        </span>
                      </div>

                      <h3 className="mt-3 text-xl font-semibold text-blue-900">
                        {event.title}
                      </h3>

                      <p className="mt-3 font-medium text-slate-800">
                        {formatEventDate(event.starts_at)}
                      </p>

                      {event.ends_at && (
                        <p className="mt-1 text-sm text-slate-600">
                          Ends:{" "}
                          {formatEventDate(event.ends_at)}
                        </p>
                      )}

                      {event.opponent && (
                        <p className="mt-3 text-sm text-slate-700">
                          <strong>Opponent:</strong>{" "}
                          {event.opponent}
                        </p>
                      )}

                      <p className="mt-3 text-sm text-slate-700">
                        <strong>Location:</strong>{" "}
                        {event.location_name}
                      </p>

                      {event.location_address && (
                        <p className="mt-1 text-sm text-slate-600">
                          {event.location_address}
                        </p>
                      )}

                      {event.maps_url && (
                        <a
                          href={event.maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline"
                        >
                          Open in Google Maps →
                        </a>
                      )}

                      {(event.event_type === "Game" ||
                        event.event_type === "Umpiring Assignment") && (
                        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                          <p className="font-semibold text-amber-900">
                            🏏 Umpiring Assignment
                          </p>

                          <p className="mt-2 text-sm text-slate-700">
                            <strong>
                              {event.event_type === "Umpiring Assignment"
                                ? "Responsible Starz team:"
                                : "Neutral team:"}
                            </strong>{" "}
                            {event.umpiring_team_id
                              ? getTeamName(event.umpiring_team_id)
                              : event.team_id
                                ? getTeamName(event.team_id)
                                : "Not assigned"}
                          </p>

                          <p className="mt-1 text-sm text-slate-700">
                            <strong>Umpire:</strong>{" "}
                            {getMemberName(event.umpire_member_id)}
                          </p>

                          <p className="mt-1 text-sm text-slate-700">
                            <strong>Status:</strong>{" "}
                            {event.umpire_status || "Pending"}
                          </p>

                          {event.umpire_notes && (
                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                              {event.umpire_notes}
                            </p>
                          )}
                        </div>
                      )}

                      {event.notes && (
                        <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                          {event.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => startEditing(event)}
                        className="rounded-lg border border-blue-900 px-4 py-2 text-sm font-medium text-blue-900"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        disabled={
                          deletingEventId === event.id
                        }
                        onClick={() =>
                          void deleteEvent(event)
                        }
                        className="rounded-lg border border-red-600 px-4 py-2 text-sm font-medium text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingEventId === event.id
                          ? "Deleting…"
                          : "Delete"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* RIGHT SIDE: ADD / EDIT FORM */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-xl font-semibold text-blue-900">
              {editingEventId
                ? "Edit event"
                : "Add an event"}
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Add a practice, game, or club event.
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-5 grid gap-4"
            >
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Event title *
                </span>

                <input
                  type="text"
                  required
                  placeholder="Example: Allstarz vs Royal Flames"
                  value={form.title}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      title: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>

              <label>
                <span className="text-sm font-medium text-slate-700">
                  Event type *
                </span>

                <select
                  value={form.event_type}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      event_type:
                        event.target
                          .value as EventForm["event_type"],
                      ...(event.target.value === "Umpiring Assignment"
                        ? {
                            umpiring_team_id: form.team_id,
                            umpire_member_id: "",
                            umpire_status: "Pending" as const,
                          }
                        : event.target.value !== "Game"
                          ? {
                              umpiring_team_id: "",
                              umpire_member_id: "",
                              umpire_status: "Pending" as const,
                              umpire_notes: "",
                            }
                          : {}),
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="Practice">
                    Practice
                  </option>
                  <option value="Game">Game</option>
                  <option value="Club Event">
                    Club Event
                  </option>
                  <option value="Umpiring Assignment">
                    Umpiring Assignment
                  </option>
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Start date and time *
                  </span>

                  <input
                    type="datetime-local"
                    required
                    value={form.starts_at}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        starts_at: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>

                <label>
                  <span className="text-sm font-medium text-slate-700">
                    End date and time
                  </span>

                  <input
                    type="datetime-local"
                    value={form.ends_at}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        ends_at: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
              </div>

              <label>
                <span className="text-sm font-medium text-slate-700">
                  {form.event_type === "Umpiring Assignment"
                    ? "Starz team responsible for umpiring *"
                    : "Team"}
                </span>

                <select
                  value={form.team_id}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      team_id: event.target.value,
                      ...(form.event_type === "Umpiring Assignment"
                        ? {
                            umpiring_team_id: event.target.value,
                            umpire_member_id: "",
                            umpire_status: "Pending" as const,
                          }
                        : {}),
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="">
                    {form.event_type === "Umpiring Assignment"
                      ? "Select responsible Starz team"
                      : "Entire Starz Club"}
                  </option>

                  {teams.map((team) => (
                    <option
                      key={team.id}
                      value={team.id}
                    >
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>

              {form.event_type !== "Umpiring Assignment" && (
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Opponent
                  </span>

                  <input
                    type="text"
                    placeholder="For games only"
                    value={form.opponent}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        opponent: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
              )}

              {form.event_type === "Umpiring Assignment" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <h3 className="font-semibold text-amber-900">
                    🏏 Umpiring Assignment
                  </h3>

                  <p className="mt-1 text-xs text-slate-600">
                    The Team field above is the Starz team responsible for this
                    external match. Assign the umpire from that team's confirmed
                    season roster.
                  </p>

                  <div className="mt-4 grid gap-4">
                    <label>
                      <span className="text-sm font-medium text-slate-700">
                        Assigned umpire
                      </span>

                      <select
                        value={form.umpire_member_id}
                        disabled={!form.team_id}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            umpire_member_id: event.target.value,
                            umpire_status: "Pending",
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100 disabled:text-slate-500"
                      >
                        <option value="">
                          {form.team_id
                            ? "Select umpire"
                            : "Choose responsible Starz team first"}
                        </option>

                        {availableUmpires.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>

                      {form.team_id && availableUmpires.length === 0 && (
                        <p className="mt-1 text-xs text-amber-800">
                          No confirmed season roster members were found for this team.
                        </p>
                      )}
                    </label>

                    <label>
                      <span className="text-sm font-medium text-slate-700">
                        Umpire status
                      </span>

                      <select
                        value={form.umpire_status}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            umpire_status: event.target
                              .value as EventForm["umpire_status"],
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Declined">Declined</option>
                      </select>
                    </label>

                    <label>
                      <span className="text-sm font-medium text-slate-700">
                        Umpiring notes
                      </span>

                      <textarea
                        rows={3}
                        placeholder="Arrival time, umpiring instructions, contact details..."
                        value={form.umpire_notes}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            umpire_notes: event.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                      />
                    </label>
                  </div>
                </div>
              )}

              {form.event_type === "Game" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <h3 className="font-semibold text-amber-900">
                    🏏 Umpiring Assignment
                  </h3>

                  <p className="mt-1 text-xs text-slate-600">
                    Choose the neutral team responsible for umpiring, then
                    assign an umpire from that team's confirmed season roster.
                  </p>

                  <div className="mt-4 grid gap-4">
                    <label>
                      <span className="text-sm font-medium text-slate-700">
                        Neutral umpiring team
                      </span>

                      <select
                        value={form.umpiring_team_id}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            umpiring_team_id: event.target.value,
                            umpire_member_id: "",
                            umpire_status: "Pending",
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                      >
                        <option value="">Not assigned yet</option>

                        {teams
                          .filter((team) => team.id !== form.team_id)
                          .map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                      </select>
                    </label>

                    <label>
                      <span className="text-sm font-medium text-slate-700">
                        Assigned umpire
                      </span>

                      <select
                        value={form.umpire_member_id}
                        disabled={!form.umpiring_team_id}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            umpire_member_id: event.target.value,
                            umpire_status: event.target.value
                              ? "Pending"
                              : "Pending",
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100 disabled:text-slate-500"
                      >
                        <option value="">
                          {form.umpiring_team_id
                            ? "Select umpire"
                            : "Choose umpiring team first"}
                        </option>

                        {availableUmpires.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>

                      {form.umpiring_team_id &&
                        availableUmpires.length === 0 && (
                          <p className="mt-1 text-xs text-amber-800">
                            No confirmed season roster members were found for
                            this team.
                          </p>
                        )}
                    </label>

                    <label>
                      <span className="text-sm font-medium text-slate-700">
                        Umpire status
                      </span>

                      <select
                        value={form.umpire_status}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            umpire_status: event.target
                              .value as EventForm["umpire_status"],
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Declined">Declined</option>
                      </select>
                    </label>

                    <label>
                      <span className="text-sm font-medium text-slate-700">
                        Umpiring notes
                      </span>

                      <textarea
                        rows={3}
                        placeholder="Arrival time, umpiring instructions, contact details..."
                        value={form.umpire_notes}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            umpire_notes: event.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                      />
                    </label>
                  </div>
                </div>
              )}

              <label>
                <span className="text-sm font-medium text-slate-700">
                  Location name *
                </span>

                <input
                  type="text"
                  required
                  placeholder="Example: Summit Park"
                  value={form.location_name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      location_name:
                        event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>

              <label>
                <span className="text-sm font-medium text-slate-700">
                  Location address
                </span>

                <input
                  type="text"
                  placeholder="Street address, city and state"
                  value={form.location_address}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      location_address:
                        event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>

              <label>
                <span className="text-sm font-medium text-slate-700">
                  Google Maps link
                </span>

                <input
                  type="url"
                  placeholder="https://maps.google.com/..."
                  value={form.maps_url}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      maps_url: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>

              <label>
                <span className="text-sm font-medium text-slate-700">
                  Notes
                </span>

                <textarea
                  rows={4}
                  placeholder="Arrival time, jersey color, equipment, parking instructions..."
                  value={form.notes}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      notes: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-900 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? editingEventId
                      ? "Updating…"
                      : "Adding…"
                    : editingEventId
                      ? "Update Event"
                      : "Add Event"}
                </button>

                {editingEventId && (
                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={submitting}
                    className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
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
        : type === "Umpiring Assignment"
          ? "🧑‍⚖️ Umpiring Assignment"
          : "🎉 Club Event";

  return (
    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900">
      {label}
    </span>
  );
}

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function convertToDateTimeInput(value: string) {
  const date = new Date(value);

  const localDate = new Date(
    date.getTime() -
      date.getTimezoneOffset() * 60_000
  );

  return localDate.toISOString().slice(0, 16);
}


