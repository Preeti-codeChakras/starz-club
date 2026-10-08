"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Player = {
  id: string;
  full_name: string;
  primary_skill: string | null;
  secondary_skill: string | null;
  interested_in_captaincy: boolean;
  registration_status: string;
};

type Team = {
  id: string;
  name: string;
  captain_registration_id: string | null;
};
type TeamMember = {
  league_team_id: string;
  registration_id: string;
};
type DraftTeam = {
  name: string;
  captainId: string | null;
  playerIds: string[];
};

function skillScore(player: Player, skill: string): number {
  return (player.primary_skill === skill ? 2 : 0) +
    (player.secondary_skill === skill ? 1 : 0);
}

function generateTeams(players: Player[], teamCount: number): DraftTeam[] {
  const result: DraftTeam[] = Array.from({ length: teamCount }, (_, i) => ({
    name: `Team ${i + 1}`,
    captainId: null,
    playerIds: [],
  }));

  // Distribute captaincy volunteers first, at most one per team.
  const captains = players.filter((p) => p.interested_in_captaincy);
  const others = players.filter((p) => !p.interested_in_captaincy);
  const assigned = new Set<string>();

  for (let i = 0; i < Math.min(teamCount, captains.length); i++) {
    result[i].captainId = captains[i].id;
    result[i].playerIds.push(captains[i].id);
    assigned.add(captains[i].id);
  }

  // Scarcer roles first; distribute each player to the least-populated
  // team with the weakest coverage of their skills.
  const pool = [...captains, ...others]
    .filter((p) => !assigned.has(p.id))
    .sort((a, b) => {
      const rank = (p: Player) =>
        (p.primary_skill === "Wicket Keeper" ? 5 : 0) +
        (p.primary_skill === "All-Rounder" ? 3 : 0) +
        (p.primary_skill === "Bowling" ? 2 : 0) +
        (p.primary_skill === "Batting" ? 1 : 0);
      return rank(b) - rank(a) || a.full_name.localeCompare(b.full_name);
    });

  for (const player of pool) {
    const relevantSkill = player.primary_skill || player.secondary_skill || "";
    const candidateIndexes = result.map((_, i) => i);
    candidateIndexes.sort((a, b) => {
      const teamA = result[a];
      const teamB = result[b];
      if (teamA.playerIds.length !== teamB.playerIds.length) {
        return teamA.playerIds.length - teamB.playerIds.length;
      }
      const coverage = (team: DraftTeam) =>
        team.playerIds.reduce((sum, id) => {
          const member = players.find((p) => p.id === id);
          return sum + (member ? skillScore(member, relevantSkill) : 0);
        }, 0);
      return coverage(teamA) - coverage(teamB) || a - b;
    });
    result[candidateIndexes[0]].playerIds.push(player.id);
  }

  return result;
}

export default function LeagueTeamBuilder({
  leagueId,
  playersPerTeam,
  canManage,
  registrations,
}: {
  leagueId: string;
  playersPerTeam: number | null;
  canManage: boolean;
  registrations: Player[];
}) {
  const eligible = useMemo(
    () => registrations.filter((p) => p.registration_status === "Registered"),
    [registrations]
  );
  const [size, setSize] = useState(playersPerTeam && playersPerTeam > 0 ? playersPerTeam : 6);
  const [draft, setDraft] = useState<DraftTeam[]>([]);
  const [saved, setSaved] = useState<DraftTeam[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadTeams = useCallback(async () => {
    setLoading(true);
    const { data: teams, error: teamError } = await supabase
      .from("league_teams")
      .select("id, name, captain_registration_id")
      .eq("league_id", leagueId)
      .order("name");
    if (teamError) {
      setMessage(teamError.message);
      setLoading(false);
      return;
    }
    const typedTeams = (teams ?? []) as Team[];
    if (!typedTeams.length) {
      setSaved([]);
      setLoading(false);
      return;
    }
    const { data: members, error: memberError } = await supabase
      .from("league_team_members")
      .select("league_team_id, registration_id")
      .in("league_team_id", typedTeams.map((t) => t.id));
    if (memberError) {
      setMessage(memberError.message);
    } else {
      const typedMembers = (members ?? []) as TeamMember[];
      setSaved(typedTeams.map((team) => ({
        name: team.name,
        captainId: team.captain_registration_id,
        playerIds: typedMembers
          .filter((member) => member.league_team_id === team.id)
          .map((member) => member.registration_id),
      })));
    }
    setLoading(false);
  }, [leagueId]);

  useEffect(() => { void loadTeams(); }, [loadTeams]);

  const count = size > 0 ? Math.ceil(eligible.length / size) : 0;
  const display = draft.length ? draft : saved;

  function generate() {
    if (!canManage) return;
    if (!eligible.length) {
      setMessage("No registered players available to generate teams.");
      return;
    }
    if (!Number.isInteger(size) || size < 1 || size > 100) {
      setMessage("Enter a valid players-per-team value between 1 and 100.");
      return;
    }
    setDraft(generateTeams(eligible, count));
    setMessage("Preview generated. Review assignments, then save when ready.");
  }

  function movePlayer(playerId: string, destination: number) {
    setDraft((current) => {
      const next = current.map((team) => ({
        ...team,
        playerIds: team.playerIds.filter((id) => id !== playerId),
        captainId: team.captainId === playerId ? null : team.captainId,
      }));
      next[destination].playerIds.push(playerId);
      return next;
    });
  }

  function setCaptain(teamIndex: number, id: string) {
    setDraft((current) => current.map((team, index) =>
      index === teamIndex ? { ...team, captainId: id || null } : team
    ));
  }

  async function saveTeams() {
    if (!canManage || !draft.length || busy) return;
    if (!window.confirm(
      saved.length
        ? "Replace the existing temporary league teams with this preview? Existing team assignments will be removed."
        : "Save these temporary league teams?"
    )) return;

    setBusy(true);
    setMessage("");
    try {
      // Never replace teams after matches exist: league_matches has
      // cascading team foreign keys and deleting teams would delete matches.
      const { count: matchCount, error: matchError } = await supabase
        .from("league_matches")
        .select("id", { count: "exact", head: true })
        .eq("league_id", leagueId);
      if (matchError) throw matchError;
      if ((matchCount ?? 0) > 0) {
        throw new Error("This league already has scheduled matches. Team replacement is blocked to protect the schedule.");
      }

      // Existing teams and memberships are removed before inserting the new set.
      // Deleting teams cascades to league_team_members in the existing schema.
      const { error: deleteError } = await supabase
        .from("league_teams")
        .delete()
        .eq("league_id", leagueId);
      if (deleteError) throw deleteError;

      for (const team of draft) {
        const { data: created, error: createError } = await supabase
          .from("league_teams")
          .insert({
            league_id: leagueId,
            name: team.name,
            captain_registration_id: team.captainId,
          })
          .select("id")
          .single();
        if (createError) throw createError;
        if (team.playerIds.length) {
          const { error: membersError } = await supabase
            .from("league_team_members")
            .insert(team.playerIds.map((registrationId) => ({
              league_team_id: created.id,
              registration_id: registrationId,
            })));
          if (membersError) throw membersError;
        }
      }
      setDraft([]);
      await loadTeams();
      setMessage("Temporary teams saved successfully.");
    } catch (error) {
      setMessage(
        `Unable to save teams: ${error instanceof Error ? error.message : String(error)}. Check the saved teams before retrying.`
      );
      await loadTeams();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Temporary Team Builder</h2>
          <p className="mt-1 text-sm text-slate-600">
            Create league-only teams using skill categories and captaincy interest.
            Permanent Starz teams are not changed.
          </p>
        </div>
        <div className="rounded-xl bg-blue-50 px-4 py-3 text-center">
          <div className="text-xs font-semibold text-blue-800">Eligible players</div>
          <div className="text-2xl font-bold text-blue-950">{canManage ? eligible.length : "—"}</div>
        </div>
      </div>

      {message && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
          {message}
        </div>
      )}

      {!canManage ? (
        <p className="mt-5 text-sm text-slate-600">Team management is available only to League Organizers.</p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-4">
            <label className="text-sm font-semibold text-slate-800">
              Players per team
              <input
                type="number"
                min={1}
                max={100}
                value={size}
                onChange={(event) => setSize(Number(event.target.value))}
                className="mt-1 block w-32 rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </label>
            <div className="px-2 pb-2 text-sm text-slate-700">
              Estimated teams: <strong>{count}</strong>
            </div>
            <button
              type="button"
              onClick={generate}
              disabled={busy || !eligible.length}
              className="rounded-xl bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Generate Team Preview
            </button>
            {draft.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={saveTeams}
                  disabled={busy}
                  className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "Saving..." : "Save Teams"}
                </button>
                <button
                  type="button"
                  onClick={() => setDraft([])}
                  disabled={busy}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold"
                >
                  Cancel Preview
                </button>
              </>
            )}
          </div>

          {loading ? (
            <p className="mt-5 text-sm text-slate-500">Loading saved teams...</p>
          ) : display.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-600">
              No temporary teams yet. Generate a preview when players have registered.
            </p>
          ) : (
            <>
              {draft.length > 0 && (
                <p className="mt-4 text-sm font-semibold text-amber-800">
                  Unsaved preview — changes are not permanent until you click Save Teams.
                </p>
              )}
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {display.map((team, index) => (
                  <div key={index} className="rounded-2xl border border-blue-100 p-4">
                    {draft.length ? (
                      <input
                        value={team.name}
                        onChange={(event) => setDraft((current) => current.map(
                          (t, i) => i === index ? { ...t, name: event.target.value } : t
                        ))}
                        className="w-full rounded-lg border border-slate-200 px-2 py-1 font-bold text-slate-900"
                        aria-label={`Team ${index + 1} name`}
                      />
                    ) : (
                      <h3 className="font-bold text-slate-900">{team.name}</h3>
                    )}
                    <p className="mt-1 text-xs text-slate-500">{team.playerIds.length} players</p>

                    {draft.length > 0 && (
                      <label className="mt-3 block text-xs font-semibold text-slate-600">
                        Captain
                        <select
                          value={team.captainId ?? ""}
                          onChange={(event) => setCaptain(index, event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
                        >
                          <option value="">Not assigned</option>
                          {team.playerIds.map((id) => {
                            const player = eligible.find((p) => p.id === id);
                            return player ? (
                              <option key={id} value={id}>{player.full_name}</option>
                            ) : null;
                          })}
                        </select>
                      </label>
                    )}

                    <div className="mt-3 space-y-2">
                      {team.playerIds.map((id) => {
                        const player = eligible.find((p) => p.id === id);
                        if (!player) return null;
                        return (
                          <div key={id} className="rounded-xl bg-slate-50 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {player.full_name} {team.captainId === id ? "★" : ""}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {player.primary_skill || "Skill not specified"}
                                  {player.secondary_skill ? ` · ${player.secondary_skill}` : ""}
                                </p>
                              </div>
                            </div>
                            {draft.length > 0 && display.length > 1 && (
                              <select
                                aria-label={`Move ${player.full_name} to team`}
                                value={index}
                                onChange={(event) => movePlayer(id, Number(event.target.value))}
                                className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs"
                              >
                                {display.map((other, otherIndex) => (
                                  <option key={otherIndex} value={otherIndex}>
                                    {other.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
