"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Member = {
  id: string;
  name: string;
};

type Team = {
  id: string;
  name: string;
};

type Season = {
  id: string;
  name: string;
  active: boolean;
};

type Assignment = {
  member_id: string;
  team_id: string;
  is_captain: boolean;
};

export default function AssignmentsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [assignments, setAssignments] = useState<
    Record<string, Assignment>
  >({});
  const [loading, setLoading] = useState(true);
  const [savingMemberId, setSavingMemberId] = useState<string | null>(
    null
  );
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);
    setMessage("");

    const [
      membersResult,
      teamsResult,
      seasonResult,
    ] = await Promise.all([
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
        .select("id, name, active")
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
    setActiveSeason(seasonResult.data);

    if (seasonResult.data) {
      const { data, error } = await supabase
        .from("season_team_members")
        .select("member_id, team_id, is_captain")
        .eq("season_id", seasonResult.data.id);

      if (error) {
        setMessage(
          `Unable to load assignments: ${error.message}`
        );
      } else {
        const assignmentMap: Record<string, Assignment> = {};

        for (const assignment of data ?? []) {
          assignmentMap[assignment.member_id] = assignment;
        }

        setAssignments(assignmentMap);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  function changeTeam(memberId: string, teamId: string) {
    setAssignments((current) => ({
      ...current,
      [memberId]: {
        member_id: memberId,
        team_id: teamId,
        is_captain:
          current[memberId]?.is_captain ?? false,
      },
    }));
  }

  function changeCaptain(memberId: string, isCaptain: boolean) {
    const currentAssignment = assignments[memberId];

    if (!currentAssignment) {
      setMessage("Select a team before marking a captain.");
      return;
    }

    setAssignments((current) => ({
      ...current,
      [memberId]: {
        ...currentAssignment,
        is_captain: isCaptain,
      },
    }));
  }

  async function saveAssignment(memberId: string) {
    if (!activeSeason) {
      setMessage("No active season was found.");
      return;
    }

    const assignment = assignments[memberId];

    if (!assignment?.team_id) {
      setMessage("Please select a team.");
      return;
    }

    setSavingMemberId(memberId);
    setMessage("");

    const { error } = await supabase
      .from("season_team_members")
      .upsert(
        {
          season_id: activeSeason.id,
          team_id: assignment.team_id,
          member_id: memberId,
          is_captain: assignment.is_captain,
        },
        {
          onConflict: "season_id,member_id",
        }
      );

    if (error) {
      setMessage(
        `Unable to save team assignment: ${error.message}`
      );
    } else {
      setMessage("Team assignment saved.");
    }

    setSavingMemberId(null);
  }

  async function removeAssignment(memberId: string) {
    if (!activeSeason) {
      return;
    }

    const confirmed = window.confirm(
      "Remove this member from their current team?"
    );

    if (!confirmed) {
      return;
    }

    setSavingMemberId(memberId);
    setMessage("");

    const { error } = await supabase
      .from("season_team_members")
      .delete()
      .eq("season_id", activeSeason.id)
      .eq("member_id", memberId);

    if (error) {
      setMessage(
        `Unable to remove assignment: ${error.message}`
      );
    } else {
      setAssignments((current) => {
        const updated = { ...current };
        delete updated[memberId];
        return updated;
      });

      setMessage("Team assignment removed.");
    }

    setSavingMemberId(null);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-blue-700 hover:underline">
          ← Back to Home
        </Link>

        <h1 className="mt-6 text-3xl font-bold text-blue-900">
          🏏 Team Assignments
        </h1>

        <p className="mt-3 text-slate-600">
          Assign members to teams for{" "}
          <strong>
            {activeSeason?.name ?? "the active season"}
          </strong>
          .
        </p>

        {message && (
          <p className="mt-5 rounded-lg bg-white p-4 text-slate-700 shadow-sm">
            {message}
          </p>
        )}

        {loading && (
          <p className="mt-8 text-slate-600">
            Loading assignments…
          </p>
        )}

        {!loading && !activeSeason && (
          <p className="mt-8 rounded-lg bg-amber-100 p-4 text-amber-900">
            No active season was found. Mark a season as active in
            Supabase.
          </p>
        )}

        {!loading && activeSeason && (
          <div className="mt-8 space-y-4">
            {members.map((member) => {
              const assignment = assignments[member.id];

              return (
                <article
                  key={member.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <h2 className="text-lg font-semibold text-blue-900">
                    {member.name}
                  </h2>

                  <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
                    <label>
                      <span className="text-sm font-medium text-slate-700">
                        Team
                      </span>

                      <select
                        value={assignment?.team_id ?? ""}
                        onChange={(event) =>
                          changeTeam(
                            member.id,
                            event.target.value
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      >
                        <option value="">
                          Select a team
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

                    <label className="flex items-center gap-2 pb-2">
                      <input
                        type="checkbox"
                        checked={
                          assignment?.is_captain ?? false
                        }
                        onChange={(event) =>
                          changeCaptain(
                            member.id,
                            event.target.checked
                          )
                        }
                      />

                      <span className="text-sm font-medium text-slate-700">
                        Captain
                      </span>
                    </label>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={
                          savingMemberId === member.id
                        }
                        onClick={() =>
                          saveAssignment(member.id)
                        }
                        className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                      >
                        {savingMemberId === member.id
                          ? "Saving…"
                          : "Save"}
                      </button>

                      {assignment && (
                        <button
                          type="button"
                          disabled={
                            savingMemberId === member.id
                          }
                          onClick={() =>
                            removeAssignment(member.id)
                          }
                          className="rounded-lg border border-red-600 px-4 py-2 text-sm font-medium text-red-600 disabled:opacity-60"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}