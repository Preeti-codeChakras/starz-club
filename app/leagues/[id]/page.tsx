"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type League = {
  id: string;
  name: string;
  organizer_name: string | null;
  description: string | null;
  registration_start: string | null;
  registration_end: string | null;
  league_start: string | null;
  league_end: string | null;
  players_per_team: number | null;
  registration_status: "Draft" | "Open" | "Closed";
  status: "Upcoming" | "Active" | "Completed" | "Cancelled";
};

type Registration = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  primary_skill: string | null;
  secondary_skill: string | null;
  interested_in_captaincy: boolean;
  friday_available: boolean;
  saturday_available: boolean;
  sunday_available: boolean;
  interested_in_club: boolean;
  membership_status: string;
  registration_status: string;
  created_at: string;
};

type Tab = "Overview" | "Registration" | "Players" | "Teams" | "Schedule";

function prettyDate(value: string | null) {
  if (!value) return "Not set";
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function LeagueWorkspacePage() {
  const params = useParams<{ id: string }>();
  const leagueId = params.id;

  const [league, setLeague] = useState<League | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMessage("");

      const { data: leagueData, error: leagueError } = await supabase
        .from("leagues")
        .select(
          "id, name, organizer_name, description, registration_start, registration_end, league_start, league_end, players_per_team, registration_status, status"
        )
        .eq("id", leagueId)
        .single();

      if (leagueError) {
        setMessage(leagueError.message);
        setLoading(false);
        return;
      }

      setLeague(leagueData as League);

      const { data: permissionData } = await supabase.rpc(
        "can_current_user_manage_leagues"
      );
      const organizer = permissionData === true;
      setCanManage(organizer);

      if (organizer) {
        const { data, error } = await supabase
          .from("league_registrations")
          .select(
            "id, full_name, email, phone, primary_skill, secondary_skill, interested_in_captaincy, friday_available, saturday_available, sunday_available, interested_in_club, membership_status, registration_status, created_at"
          )
          .eq("league_id", leagueId)
          .order("created_at", { ascending: false });

        if (error) setMessage(error.message);
        else setRegistrations((data ?? []) as Registration[]);
      }

      setLoading(false);
    }

    void load();
  }, [leagueId]);

  async function copyRegistrationLink() {
    const url = `${window.location.origin}/leagues/${leagueId}/register`;
    await navigator.clipboard.writeText(url);
    setMessage("Public registration link copied.");
  }

  async function updateRegistrationStatus(
    status: "Draft" | "Open" | "Closed"
  ) {
    if (!canManage) {
      setMessage("Only a League Organizer can change registration status.");
      return;
    }

    setUpdatingStatus(true);
    setMessage("");

    const { error } = await supabase
      .from("leagues")
      .update({ registration_status: status })
      .eq("id", leagueId);

    if (error) {
      setMessage(`Unable to update registration: ${error.message}`);
    } else {
      setLeague((current) =>
        current ? { ...current, registration_status: status } : current
      );
      setMessage(
        status === "Open"
          ? "Registration is now OPEN. The public registration link is live."
          : status === "Closed"
            ? "Registration is now CLOSED."
            : "Registration moved back to DRAFT."
      );
    }

    setUpdatingStatus(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-8 text-center text-slate-600">
        Loading league...
      </main>
    );
  }

  if (!league) {
    return (
      <main className="min-h-screen bg-slate-50 p-8 text-center">
        <p className="text-slate-700">League not found.</p>
        <Link href="/leagues" className="mt-4 inline-block font-semibold text-blue-800">
          ← Back to Leagues
        </Link>
      </main>
    );
  }

  const tabs: Tab[] = ["Overview", "Registration", "Players", "Teams", "Schedule"];

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-blue-950 via-blue-900 to-blue-700 text-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-8">
          <Link href="/leagues" className="text-sm font-medium text-blue-100 hover:text-white">
            ← Leagues & Tournaments
          </Link>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">{league.name}</h1>
              <p className="mt-1 text-sm text-blue-100">
                {league.organizer_name || "League Workspace"}
              </p>
            </div>
            <span className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">
              Registration {league.registration_status}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
        {message && (
          <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
            {message}
          </div>
        )}

        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold ${
                activeTab === tab
                  ? "bg-blue-900 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-blue-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "Overview" && (
          <section className="grid gap-5 lg:grid-cols-3">
            <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="text-xl font-bold text-slate-900">Overview</h2>
              <p className="mt-2 text-sm text-slate-600">
                {league.description || "No description added yet."}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Info label="Registration" value={`${prettyDate(league.registration_start)} – ${prettyDate(league.registration_end)}`} />
                <Info label="League dates" value={`${prettyDate(league.league_start)} – ${prettyDate(league.league_end)}`} />
                <Info label="Players per team" value={league.players_per_team?.toString() || "Not set"} />
                <Info label="Registered players" value={canManage ? registrations.length.toString() : "Organizer only"} />
              </div>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-slate-900">Public Registration</h2>
              <p className="mt-2 text-sm text-slate-600">
                Share this link with anyone who wants to register. They do not need a Starz login.
              </p>
              <Link
                href={`/leagues/${leagueId}/register`}
                target="_blank"
                className="mt-4 block rounded-xl bg-blue-900 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-800"
              >
                Open Registration Form ↗
              </Link>
              <button
                type="button"
                onClick={copyRegistrationLink}
                className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-900 hover:bg-blue-50"
              >
                Copy Registration Link
              </button>
            </div>
          </section>
        )}

        {activeTab === "Registration" && (
          <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Registration</h2>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm text-slate-600">Public registration:</span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      league.registration_status === "Open"
                        ? "bg-emerald-100 text-emerald-800"
                        : league.registration_status === "Closed"
                          ? "bg-slate-200 text-slate-700"
                          : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {league.registration_status}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/leagues/${leagueId}/register`}
                  target="_blank"
                  className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-900"
                >
                  Preview Form ↗
                </Link>
                <button
                  type="button"
                  onClick={copyRegistrationLink}
                  className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-900"
                >
                  Copy Link
                </button>
              </div>
            </div>

            {canManage && (
              <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
                <div className="text-sm font-bold text-blue-950">
                  Registration Controls
                </div>
                <p className="mt-1 text-xs text-blue-900/75">
                  Draft keeps the form unavailable. Open accepts registrations. Closed stops new registrations.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {league.registration_status !== "Open" && (
                    <button
                      type="button"
                      disabled={updatingStatus}
                      onClick={() => updateRegistrationStatus("Open")}
                      className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                    >
                      {league.registration_status === "Closed"
                        ? "Reopen Registration"
                        : "Open Registration"}
                    </button>
                  )}

                  {league.registration_status === "Open" && (
                    <button
                      type="button"
                      disabled={updatingStatus}
                      onClick={() => updateRegistrationStatus("Closed")}
                      className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
                    >
                      Close Registration
                    </button>
                  )}

                  {league.registration_status !== "Draft" && (
                    <button
                      type="button"
                      disabled={updatingStatus}
                      onClick={() => updateRegistrationStatus("Draft")}
                      className="rounded-xl border border-blue-300 bg-white px-4 py-2.5 text-sm font-semibold text-blue-900 hover:bg-blue-50 disabled:opacity-60"
                    >
                      Move to Draft
                    </button>
                  )}
                </div>
              </div>
            )}

            {!canManage ? (
              <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                Registration details are available only to League Organizers.
              </p>
            ) : registrations.length === 0 ? (
              <p className="mt-6 rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-600">
                No registrations yet.
              </p>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-3">Player</th>
                      <th className="px-3 py-3">Skills</th>
                      <th className="px-3 py-3">Availability</th>
                      <th className="px-3 py-3">Captain</th>
                      <th className="px-3 py-3">Club Interest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map((r) => {
                      const availability = [
                        r.friday_available && "Fri",
                        r.saturday_available && "Sat",
                        r.sunday_available && "Sun",
                      ].filter(Boolean).join(", ") || "None";

                      return (
                        <tr key={r.id} className="border-b border-slate-100 align-top">
                          <td className="px-3 py-4">
                            <div className="font-semibold text-slate-900">{r.full_name}</div>
                            <div className="text-xs text-slate-500">{r.email}</div>
                            {r.phone && <div className="text-xs text-slate-500">{r.phone}</div>}
                          </td>
                          <td className="px-3 py-4 text-slate-700">
                            {r.primary_skill || "—"}
                            {r.secondary_skill ? ` / ${r.secondary_skill}` : ""}
                          </td>
                          <td className="px-3 py-4 text-slate-700">{availability}</td>
                          <td className="px-3 py-4 text-slate-700">
                            {r.interested_in_captaincy ? "Yes" : "No"}
                          </td>
                          <td className="px-3 py-4 text-slate-700">
                            {r.interested_in_club ? r.membership_status : "No"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === "Players" && (
          <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Player Pool</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Registered players for this league. These players are league-only until a separate club membership is approved.
                </p>
              </div>

              {canManage && (
                <div className="rounded-xl bg-blue-50 px-4 py-3 text-center">
                  <div className="text-xs font-medium uppercase tracking-wide text-blue-700">
                    Registered
                  </div>
                  <div className="text-2xl font-bold text-blue-950">
                    {registrations.filter((r) => r.registration_status === "Registered").length}
                  </div>
                </div>
              )}
            </div>

            {!canManage ? (
              <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                Player details are available only to League Organizers.
              </p>
            ) : registrations.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-blue-200 bg-slate-50 p-8 text-center">
                <div className="text-3xl">🏏</div>
                <p className="mt-2 font-semibold text-slate-800">No players registered yet</p>
                <p className="mt-1 text-sm text-slate-600">
                  Share the public registration link to start building the player pool.
                </p>
              </div>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {registrations.map((player) => {
                  const availability = [
                    player.friday_available && "Fri",
                    player.saturday_available && "Sat",
                    player.sunday_available && "Sun",
                  ].filter(Boolean);

                  return (
                    <article
                      key={player.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-slate-900">{player.full_name}</h3>
                          <p className="mt-0.5 text-xs text-slate-500">{player.email}</p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            player.registration_status === "Registered"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {player.registration_status}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <div className="text-xs text-slate-500">Primary skill</div>
                          <div className="mt-1 font-semibold text-slate-800">
                            {player.primary_skill || "Not specified"}
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <div className="text-xs text-slate-500">Secondary</div>
                          <div className="mt-1 font-semibold text-slate-800">
                            {player.secondary_skill || "Not specified"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="text-xs font-medium text-slate-500">Availability</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {availability.length > 0 ? (
                            availability.map((day) => (
                              <span
                                key={day as string}
                                className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800"
                              >
                                {day}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-slate-500">None selected</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                        {player.interested_in_captaincy && (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                            Captain interest
                          </span>
                        )}
                        {player.interested_in_club && (
                          <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-800">
                            Club interest · {player.membership_status}
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
        {activeTab === "Teams" && (
          <ComingSoon title="Temporary Teams" text="We will generate balanced temporary teams here without adding them to the permanent club Teams table." />
        )}
        {activeTab === "Schedule" && (
          <ComingSoon title="League Schedule" text="Round-robin and custom league schedule generation will be built here." />
        )}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{text}</p>
    </section>
  );
}
