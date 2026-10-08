"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Team = { id: string; name: string };
type Match = {
  id?: string;
  home_team_id: string;
  away_team_id: string;
  match_date: string;
  start_time: string | null;
  venue: string | null;
  status?: string;
};
type Fixture = Match & { round: number };

function localISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function advance(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day + days, 12);
  return localISO(date);
}

function roundsFor(teams: Team[]): Array<Array<[string, string]>> {
  const ids: Array<string | null> = teams.map((team) => team.id);
  if (ids.length % 2) ids.push(null);
  const rounds: Array<Array<[string, string]>> = [];
  const n = ids.length;
  if (n < 2) return rounds;
  for (let round = 0; round < n - 1; round++) {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i];
      const b = ids[n - 1 - i];
      if (a && b) pairs.push(round % 2 ? [b, a] : [a, b]);
    }
    rounds.push(pairs);
    ids.splice(1, 0, ids.pop()!);
  }
  return rounds;
}

export default function LeagueScheduleBuilder({
  leagueId,
  canManage,
  leagueStart,
  leagueEnd,
}: {
  leagueId: string;
  canManage: boolean;
  leagueStart: string | null;
  leagueEnd: string | null;
}) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [saved, setSaved] = useState<Match[]>([]);
  const [preview, setPreview] = useState<Fixture[]>([]);
  const [startDate, setStartDate] = useState(leagueStart || localISO(new Date()));
  const [startTime, setStartTime] = useState("09:00");
  const [venue, setVenue] = useState("");
  const [daysBetweenRounds, setDaysBetweenRounds] = useState(7);
  const [minutesBetweenMatches, setMinutesBetweenMatches] = useState(90);
  const [doubleRound, setDoubleRound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const [teamResult, matchResult] = await Promise.all([
      supabase.from("league_teams").select("id, name").eq("league_id", leagueId).order("name"),
      supabase.from("league_matches")
        .select("id, home_team_id, away_team_id, match_date, start_time, venue, status")
        .eq("league_id", leagueId)
        .order("match_date", { ascending: true })
        .order("start_time", { ascending: true }),
    ]);
    if (teamResult.error || matchResult.error) {
      setMessage(teamResult.error?.message || matchResult.error?.message || "Unable to load schedule.");
    } else {
      setTeams((teamResult.data || []) as Team[]);
      setSaved((matchResult.data || []) as Match[]);
    }
    setLoading(false);
  }, [leagueId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const teamNames = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t.name])), [teams]);

  function generate() {
    setMessage("");
    if (teams.length < 2) {
      setMessage("Save at least two temporary league teams before generating a schedule.");
      return;
    }
    if (!startDate || !startTime || !Number.isInteger(daysBetweenRounds) ||
        daysBetweenRounds < 1 || daysBetweenRounds > 365 ||
        !Number.isInteger(minutesBetweenMatches) || minutesBetweenMatches < 15 ||
        minutesBetweenMatches > 720) {
      setMessage("Enter a valid start date, time, round interval (1–365 days), and match interval (15–720 minutes).");
      return;
    }
    const firstLeg = roundsFor(teams);
    const rounds = doubleRound
      ? [...firstLeg, ...firstLeg.map((round) => round.map(([a, b]) => [b, a] as [string, string]))]
      : firstLeg;
    const result: Fixture[] = [];
    rounds.forEach((round, roundIndex) => {
      const date = advance(startDate, roundIndex * daysBetweenRounds);
      round.forEach(([home, away], matchIndex) => {
        const [h, m] = startTime.split(":").map(Number);
        const total = h * 60 + m + matchIndex * minutesBetweenMatches;
        const dayOffset = Math.floor(total / 1440);
        const time = `${String(Math.floor((total % 1440) / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
        result.push({
          home_team_id: home,
          away_team_id: away,
          match_date: advance(date, dayOffset),
          start_time: time,
          venue: venue.trim() || null,
          round: roundIndex + 1,
        });
      });
    });
    if (leagueEnd && result.some((f) => f.match_date > leagueEnd)) {
      setMessage("Some fixtures fall after the league end date. Adjust the start date or round spacing.");
      return;
    }
    setPreview(result);
    setMessage(`${result.length} fixtures generated for preview. Nothing has been saved yet.`);
  }

  function updateFixture(index: number, change: Partial<Fixture>) {
    setPreview((current) => current.map((item, i) => i === index ? { ...item, ...change } : item));
  }

  async function save() {
    if (!canManage || !preview.length || saving) return;
    if (saved.length) {
      setMessage("A schedule already exists. This version does not overwrite or duplicate saved matches.");
      return;
    }
    if (preview.some((f) => !f.match_date || !f.start_time ||
        f.home_team_id === f.away_team_id ||
        (leagueEnd && f.match_date > leagueEnd))) {
      setMessage("Fix invalid fixture dates, times, or team pairings before saving.");
      return;
    }
    if (!window.confirm(`Save ${preview.length} matches to this league?`)) return;
    setSaving(true);
    setMessage("");
    try {
      // Recheck before inserting to avoid overwriting existing fixtures.
      const { count, error: checkError } = await supabase
        .from("league_matches").select("id", { count: "exact", head: true }).eq("league_id", leagueId);
      if (checkError) throw checkError;
      if (count) throw new Error("Matches already exist for this league. Refresh before continuing.");
      const { error } = await supabase.from("league_matches").insert(
        preview.map(({ home_team_id, away_team_id, match_date, start_time, venue }) => ({
          league_id: leagueId,
          home_team_id,
          away_team_id,
          match_date,
          start_time,
          venue,
          status: "Scheduled",
        }))
      );
      if (error) throw error;
      setPreview([]);
      await refresh();
      setMessage("League schedule saved successfully.");
    } catch (error) {
      setMessage(`Could not save schedule: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900">League Schedule Generator</h2>
      <p className="mt-2 text-sm text-slate-600">
        Generate round-robin matches using temporary league teams. The club and ARCL schedules are unchanged.
      </p>
      {message && <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-950">{message}</p>}
      {loading ? <p className="mt-4 text-sm text-slate-600">Loading league teams and matches...</p> : (
        <>
          <div className="mt-5 rounded-xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-800">
              {teams.length} saved teams · {saved.length} saved matches
            </p>
            {canManage && saved.length === 0 && (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-sm text-slate-700">First match date
                    <input type="date" value={startDate} onChange={(e) => {setStartDate(e.target.value); setPreview([]);}} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" />
                  </label>
                  <label className="text-sm text-slate-700">First match time
                    <input type="time" value={startTime} onChange={(e) => {setStartTime(e.target.value); setPreview([]);}} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" />
                  </label>
                  <label className="text-sm text-slate-700">Days between rounds
                    <input type="number" min="1" max="365" value={daysBetweenRounds} onChange={(e) => {setDaysBetweenRounds(Number(e.target.value)); setPreview([]);}} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" />
                  </label>
                  <label className="text-sm text-slate-700">Minutes between matches
                    <input type="number" min="15" max="720" value={minutesBetweenMatches} onChange={(e) => {setMinutesBetweenMatches(Number(e.target.value)); setPreview([]);}} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" />
                  </label>
                  <label className="text-sm text-slate-700 sm:col-span-2">Venue (optional)
                    <input value={venue} onChange={(e) => {setVenue(e.target.value); setPreview([]);}} placeholder="e.g. Indoor Cricket Academy" className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" />
                  </label>
                </div>
                <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={doubleRound} onChange={(e) => {setDoubleRound(e.target.checked); setPreview([]);}} />
                  Double round-robin (each team plays every other team twice)
                </label>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={generate} disabled={teams.length < 2 || saving} className="rounded-xl bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                    Generate Schedule Preview
                  </button>
                  {preview.length > 0 && (
                    <>
                      <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                        {saving ? "Saving..." : `Save ${preview.length} Matches`}
                      </button>
                      <button type="button" onClick={() => setPreview([])} disabled={saving} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold">Cancel Preview</button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
          {saved.length > 0 && (
            <p className="mt-4 text-sm text-slate-600">The schedule is saved. Regeneration is disabled to protect existing matches.</p>
          )}
          {(preview.length > 0 || saved.length > 0) && (
            <div className="mt-5 overflow-x-auto">
              <h3 className="mb-3 font-bold text-slate-900">{preview.length ? "Unsaved Schedule Preview" : "Saved League Schedule"}</h3>
              <table className="min-w-full text-left text-sm">
                <thead className="bg-blue-50 text-blue-950"><tr>
                  <th className="p-3">Match</th><th className="p-3">Date</th><th className="p-3">Time</th><th className="p-3">Venue</th>
                </tr></thead>
                <tbody>
                  {(preview.length ? preview : saved).map((match, i) => (
                    <tr key={match.id || i} className="border-b border-slate-100">
                      <td className="p-3 font-semibold text-slate-800">{teamNames[match.home_team_id] || "Unknown"} vs {teamNames[match.away_team_id] || "Unknown"}</td>
                      <td className="p-3">{preview.length ? (
                        <input aria-label={`Match ${i+1} date`} type="date" value={match.match_date} onChange={(e) => updateFixture(i, {match_date: e.target.value})} className="rounded-lg border border-slate-300 p-2" />
                      ) : match.match_date}</td>
                      <td className="p-3">{preview.length ? (
                        <input aria-label={`Match ${i+1} time`} type="time" value={match.start_time || ""} onChange={(e) => updateFixture(i, {start_time: e.target.value})} className="rounded-lg border border-slate-300 p-2" />
                      ) : match.start_time?.slice(0, 5) || "—"}</td>
                      <td className="p-3">{preview.length ? (
                        <input aria-label={`Match ${i+1} venue`} value={match.venue || ""} onChange={(e) => updateFixture(i, {venue: e.target.value})} className="min-w-40 rounded-lg border border-slate-300 p-2" />
                      ) : match.venue || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
