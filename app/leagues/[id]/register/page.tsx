"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type LeagueInfo = {
  id: string;
  name: string;
  organizer_name: string | null;
  description: string | null;
  registration_end: string | null;
  registration_status: "Draft" | "Open" | "Closed";
};

type Club = { id: string; name: string };

export default function PublicLeagueRegistrationPage() {
  const params = useParams<{ id: string }>();
  const leagueId = params.id;

  const [league, setLeague] = useState<LeagueInfo | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    primary_skill: "",
    secondary_skill: "",
    interested_in_captaincy: false,
    friday_available: false,
    saturday_available: false,
    sunday_available: false,
    interested_in_club: false,
    preferred_club_id: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/leagues/${leagueId}/register`, {
          cache: "no-store",
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load registration.");
        setLeague(body.league);
        setClubs(body.clubs ?? []);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load registration.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [leagueId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!form.full_name.trim() || !form.email.trim()) {
      setMessage("Name and email are required.");
      return;
    }

    if (form.interested_in_club && !form.preferred_club_id) {
      setMessage("Please choose the club you are interested in.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/leagues/${leagueId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Registration failed.");
      setSuccess(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-slate-50 p-8 text-center">Loading registration...</main>;
  }

  if (!league) {
    return (
      <main className="min-h-screen bg-slate-50 p-8 text-center">
        <h1 className="text-xl font-bold text-slate-900">Registration unavailable</h1>
        <p className="mt-2 text-slate-600">{message}</p>
      </main>
    );
  }

  if (success) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-xl rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
          <div className="text-5xl">🏏</div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">You're registered!</h1>
          <p className="mt-2 text-slate-600">
            Your registration for <strong>{league.name}</strong> has been received.
          </p>
          {form.interested_in_club && (
            <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-950">
              Your club interest was also recorded. This does not automatically create a permanent club membership; the club can review it separately.
            </p>
          )}
        </div>
      </main>
    );
  }

  const isOpen = league.registration_status === "Open";

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-blue-950 via-blue-900 to-blue-700 text-white">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="text-sm font-semibold text-blue-100">🏆 League Registration</div>
          <h1 className="mt-2 text-3xl font-bold">{league.name}</h1>
          {league.organizer_name && <p className="mt-1 text-blue-100">{league.organizer_name}</p>}
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-7">
        {!isOpen ? (
          <div className="rounded-2xl border border-amber-200 bg-white p-7 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Registration is not open</h2>
            <p className="mt-2 text-slate-600">Current status: {league.registration_status}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-bold text-slate-900">Player Registration</h2>
            {league.description && <p className="mt-2 text-sm text-slate-600">{league.description}</p>}

            {message && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {message}
              </div>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Full name *">
                <input required value={form.full_name} onChange={(e) => setForm({...form, full_name:e.target.value})} className={inputClass} />
              </Field>
              <Field label="Email *">
                <input required type="email" value={form.email} onChange={(e) => setForm({...form, email:e.target.value})} className={inputClass} />
              </Field>
              <Field label="Phone">
                <input type="tel" value={form.phone} onChange={(e) => setForm({...form, phone:e.target.value})} className={inputClass} />
              </Field>
              <Field label="Primary skill">
                <select value={form.primary_skill} onChange={(e) => setForm({...form, primary_skill:e.target.value})} className={inputClass}>
                  <option value="">Select</option><option>Batting</option><option>Bowling</option><option>All-Rounder</option><option>Wicket Keeper</option>
                </select>
              </Field>
              <Field label="Secondary skill">
                <select value={form.secondary_skill} onChange={(e) => setForm({...form, secondary_skill:e.target.value})} className={inputClass}>
                  <option value="">Select</option><option>Batting</option><option>Bowling</option><option>All-Rounder</option><option>Wicket Keeper</option>
                </select>
              </Field>
            </div>

            <div className="mt-6">
              <div className="text-sm font-semibold text-slate-800">Typical availability</div>
              <div className="mt-2 flex flex-wrap gap-4">
                <Check label="Friday" checked={form.friday_available} onChange={(v) => setForm({...form, friday_available:v})} />
                <Check label="Saturday" checked={form.saturday_available} onChange={(v) => setForm({...form, saturday_available:v})} />
                <Check label="Sunday" checked={form.sunday_available} onChange={(v) => setForm({...form, sunday_available:v})} />
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-slate-50 p-4">
              <Check label="I'm interested in being a team captain" checked={form.interested_in_captaincy} onChange={(v) => setForm({...form, interested_in_captaincy:v})} />
            </div>

            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <Check
                label="I'm also interested in joining a participating cricket club"
                checked={form.interested_in_club}
                onChange={(v) => setForm({...form, interested_in_club:v, preferred_club_id: v ? form.preferred_club_id : ""})}
              />
              {form.interested_in_club && (
                <label className="mt-4 block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Preferred club *</span>
                  <select required value={form.preferred_club_id} onChange={(e) => setForm({...form, preferred_club_id:e.target.value})} className={inputClass}>
                    <option value="">Choose a club</option>
                    {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
                  </select>
                  <span className="mt-2 block text-xs text-slate-600">
                    This records your interest only. Club membership requires separate approval.
                  </span>
                </label>
              )}
            </div>

            <button disabled={submitting} className="mt-6 w-full rounded-xl bg-blue-900 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
              {submitting ? "Submitting..." : "Register for League"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100";

function Field({label, children}:{label:string; children:React.ReactNode}) {
  return <label><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>{children}</label>;
}

function Check({label, checked, onChange}:{label:string; checked:boolean; onChange:(value:boolean)=>void}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e)=>onChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
      <span>{label}</span>
    </label>
  );
}
