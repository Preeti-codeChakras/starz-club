"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Team = {
  id: string;
  name: string;
};

type Season = {
  id: string;
  name: string;
};

type ClubEvent = {
  id: string;
  title: string;
  event_type: "Practice" | "Game" | "Club Event";
  starts_at: string;
  ends_at: string | null;
  season_id: string | null;
  team_id: string | null;
  opponent: string | null;
  location_name: string;
  location_address: string | null;
  maps_url: string | null;
  notes: string | null;
};

type EventForm = {
  title: string;
  event_type: "Practice" | "Game" | "Club Event";
  starts_at: string;
  ends_at: string;
  team_id: string;
  opponent: string;
  location_name: string;
  location_address: string;
  maps_url: string;
  notes: string;
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
};

export default function SchedulePage() {
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
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

    const [eventsResult, teamsResult, seasonResult] = await Promise.all([
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
            notes
          `
        )
        .order("starts_at", { ascending: true }),

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

    if (seasonResult.error) {
      setMessage(
        `Unable to load active season: ${seasonResult.error.message}`
      );
    } else {
      setActiveSeason(seasonResult.data);
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
                  Team
                </span>

                <select
                  value={form.team_id}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      team_id: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="">
                    Entire Starz Club
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
