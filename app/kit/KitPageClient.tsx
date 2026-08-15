"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Member = {
  id: string;
  name: string;
};

type Kit = {
  id: string;
  name: string;
  updated_at: string;
  current_holder_member_id: string | null;

  current_holder:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
};

type Handoff = {
  id: string;
  handed_off_at: string;
  note: string | null;

  from_member:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;

  to_member:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
};

export default function KitPageClient() {
  const searchParams = useSearchParams();

  const requestedKitId =
    searchParams.get("kit");

  const [kits, setKits] =
    useState<Kit[]>([]);

  const [members, setMembers] =
    useState<Member[]>([]);

  const [handoffs, setHandoffs] =
    useState<Record<string, Handoff[]>>({});

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const [openKitId, setOpenKitId] =
    useState<string | null>(null);

  const [
    selectedMemberId,
    setSelectedMemberId,
  ] = useState("");

  const [note, setNote] =
    useState("");

  const [
    savingKitId,
    setSavingKitId,
  ] = useState<string | null>(null);

  useEffect(() => {
    void loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);
    setMessage("");

    const [
      kitsResult,
      membersResult,
    ] = await Promise.all([
      supabase
        .from("club_kits")
        .select(`
          id,
          name,
          updated_at,
          current_holder_member_id,

          current_holder:members (
            id,
            name
          )
        `)
        .order("name"),

      supabase
        .from("members")
        .select("id, name")
        .order("name"),
    ]);

    if (kitsResult.error) {
      setMessage(
        `Unable to load club kits: ${kitsResult.error.message}`
      );

      setLoading(false);
      return;
    }

    if (membersResult.error) {
      setMessage(
        `Unable to load members: ${membersResult.error.message}`
      );

      setLoading(false);
      return;
    }

    const loadedKits =
      (kitsResult.data ??
        []) as unknown as Kit[];

    setKits(loadedKits);

    setMembers(
      (membersResult.data ??
        []) as Member[]
    );

    if (
      requestedKitId &&
      loadedKits.some(
        (kit) =>
          kit.id === requestedKitId
      )
    ) {
      setOpenKitId(
        requestedKitId
      );

      window.setTimeout(() => {
        document
          .getElementById(
            `kit-${requestedKitId}`
          )
          ?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
      }, 100);
    }

    await loadHandoffs(
      loadedKits
    );

    setLoading(false);
  }

  async function loadHandoffs(
    loadedKits: Kit[]
  ) {
    if (
      loadedKits.length === 0
    ) {
      setHandoffs({});
      return;
    }

    const kitIds =
      loadedKits.map(
        (kit) => kit.id
      );

    const {
      data,
      error,
    } =
      await supabase
        .from("kit_handoffs")
        .select(`
          id,
          kit_id,
          handed_off_at,
          note,

          from_member:members!kit_handoffs_from_member_id_fkey (
            id,
            name
          ),

          to_member:members!kit_handoffs_to_member_id_fkey (
            id,
            name
          )
        `)
        .in(
          "kit_id",
          kitIds
        )
        .order(
          "handed_off_at",
          {
            ascending: false,
          }
        );

    if (error) {
      console.error(
        "Unable to load kit history:",
        error
      );

      return;
    }

    const grouped:
      Record<string, Handoff[]> =
      {};

    for (
      const kit
      of loadedKits
    ) {
      grouped[
        kit.id
      ] = [];
    }

    for (
      const row
      of data ?? []
    ) {
      const kitId =
        (
          row as {
            kit_id: string;
          }
        ).kit_id;

      if (
        !grouped[
          kitId
        ]
      ) {
        grouped[
          kitId
        ] = [];
      }

      grouped[
        kitId
      ].push(
        row as unknown as Handoff
      );
    }

    setHandoffs(
      grouped
    );
  }

  function startHandoff(
    kit: Kit
  ) {
    setOpenKitId(
      kit.id
    );

    setSelectedMemberId(
      ""
    );

    setNote("");
    setMessage("");
  }

  function cancelHandoff() {
    setOpenKitId(null);
    setSelectedMemberId("");
    setNote("");
  }

  async function confirmHandoff(
    kit: Kit
  ) {
    if (
      !selectedMemberId
    ) {
      setMessage(
        "Please choose the member receiving the kit."
      );

      return;
    }

    if (
      selectedMemberId ===
      kit.current_holder_member_id
    ) {
      setMessage(
        "That member already has this kit."
      );

      return;
    }

    setSavingKitId(
      kit.id
    );

    setMessage("");

    const {
      error:
        handoffError,
    } =
      await supabase
        .from(
          "kit_handoffs"
        )
        .insert({
          kit_id:
            kit.id,

          from_member_id:
            kit.current_holder_member_id,

          to_member_id:
            selectedMemberId,

          handoff_type:
            null,

          note:
            note.trim() ||
            null,
        });

    if (handoffError) {
      setMessage(
        `Unable to record handoff: ${handoffError.message}`
      );

      setSavingKitId(
        null
      );

      return;
    }

    const {
      error:
        kitError,
    } =
      await supabase
        .from(
          "club_kits"
        )
        .update({
          current_holder_member_id:
            selectedMemberId,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          kit.id
        );

    if (kitError) {
      setMessage(
        `Handoff history was saved, but the current holder could not be updated: ${kitError.message}`
      );

      setSavingKitId(
        null
      );

      return;
    }

    const newHolder =
      members.find(
        (member) =>
          member.id ===
          selectedMemberId
      );

    setOpenKitId(
      null
    );

    setSelectedMemberId(
      ""
    );

    setNote("");

    await loadPage();

    setMessage(
      `✅ ${kit.name} handed to ${newHolder?.name ?? "the selected member"}.`
    );

    setSavingKitId(
      null
    );
  }

  async function copyKitLink() {
    try {
      await navigator.clipboard.writeText(
        "https://www.starzcricketclub.com/kit"
      );

      setMessage(
        "✅ Kit tracker link copied."
      );
    } catch {
      setMessage(
        "Unable to copy the link automatically."
      );
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="text-blue-700 hover:underline"
        >
          ← Back to Home
        </Link>

        <header className="mt-6">
          <h1 className="text-3xl font-bold text-blue-900 sm:text-4xl">
            🏏 Kit Management
          </h1>

          <p className="mt-2 text-slate-600">
            See who has each Starz kit and update it whenever the kit changes hands.
          </p>
        </header>

        {/* QUICK KIT LINK */}

        <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-900">
            📱 Quick Kit Link
          </p>

          <p className="mt-1 text-sm text-blue-800">
            Share this in WhatsApp so whoever takes a kit can update it quickly.
          </p>

          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                void copyKitLink()
              }
              className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              🔗 Copy Kit Link
            </button>

            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                "🏏 Starz Kit Tracker — see who has each kit or update a handoff: https://www.starzcricketclub.com/kit"
              )}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-green-600 bg-white px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50"
            >
              💬 Share on WhatsApp
            </a>
          </div>
        </div>

        {message && (
          <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
            {message}
          </div>
        )}

        {loading && (
          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
            Loading kits…
          </div>
        )}

        {!loading &&
          kits.length === 0 && (
            <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
              No club kits found.
            </div>
          )}

        {!loading &&
          kits.length > 0 && (
            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              {kits.map(
                (kit) => {
                  const holder =
                    getRelation(
                      kit.current_holder
                    );

                  const kitHistory =
                    handoffs[
                      kit.id
                    ] ?? [];

                  const isOpen =
                    openKitId ===
                    kit.id;

                  return (
                    <article
                      id={`kit-${kit.id}`}
                      key={kit.id}
                      className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm"
                    >
                      <div className="bg-gradient-to-r from-blue-50 via-white to-blue-50 p-6">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                              Club Kit
                            </p>

                            <h2 className="mt-1 text-2xl font-bold text-blue-950">
                              🏏{" "}
                              {
                                kit.name
                              }
                            </h2>
                          </div>

                          <span className="text-3xl">
                            🎒
                          </span>
                        </div>

                        <div className="mt-5 rounded-xl bg-white p-4 shadow-sm">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Current Holder
                          </p>

                          <p className="mt-2 text-xl font-bold text-slate-900">
                            {holder
                              ? `👤 ${holder.name}`
                              : "Not assigned yet"}
                          </p>

                          {holder && (
                            <p className="mt-1 text-xs text-slate-500">
                              Since{" "}
                              {formatDate(
                                kit.updated_at
                              )}
                            </p>
                          )}
                        </div>

                        {!isOpen && (
                          <button
                            type="button"
                            onClick={() =>
                              startHandoff(
                                kit
                              )
                            }
                            className="mt-5 w-full rounded-lg bg-blue-900 px-5 py-3 font-semibold text-white hover:bg-blue-800"
                          >
                            🔄 Hand Off Kit
                          </button>
                        )}
                      </div>

                      {/* HANDOFF FORM */}

                      {isOpen && (
                        <div className="border-t border-slate-200 p-6">
                          <h3 className="font-semibold text-slate-900">
                            🔄 Who has the kit now?
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            Pick the person taking the kit home.
                          </p>

                          <label className="mt-4 block">
                            <span className="text-sm font-medium text-slate-700">
                              Member
                            </span>

                            <select
                              value={
                                selectedMemberId
                              }
                              onChange={(
                                event
                              ) =>
                                setSelectedMemberId(
                                  event
                                    .target
                                    .value
                                )
                              }
                              className="mt-2 w-full rounded-lg border border-slate-400 bg-white px-3 py-3 font-medium text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            >
                              <option value="">
                                Select member
                              </option>

                              {members.map(
                                (
                                  member
                                ) => (
                                  <option
                                    key={
                                      member.id
                                    }
                                    value={
                                      member.id
                                    }
                                  >
                                    {
                                      member.name
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          </label>

                          <label className="mt-4 block">
                            <span className="text-sm font-medium text-slate-700">
                              Note{" "}
                              <span className="font-normal text-slate-400">
                                (optional)
                              </span>
                            </span>

                            <textarea
                              rows={
                                2
                              }
                              value={
                                note
                              }
                              onChange={(
                                event
                              ) =>
                                setNote(
                                  event
                                    .target
                                    .value
                                )
                              }
                              placeholder="Example: Bring to Sunday's game."
                              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-900"
                            />
                          </label>

                          <div className="mt-5 flex flex-wrap gap-3">
                            <button
                              type="button"
                              disabled={
                                savingKitId ===
                                kit.id
                              }
                              onClick={() =>
                                void confirmHandoff(
                                  kit
                                )
                              }
                              className="rounded-lg bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {savingKitId ===
                              kit.id
                                ? "Saving…"
                                : "✅ Confirm Handoff"}
                            </button>

                            <button
                              type="button"
                              disabled={
                                savingKitId ===
                                kit.id
                              }
                              onClick={
                                cancelHandoff
                              }
                              className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* HISTORY */}

                      <div className="border-t border-slate-200 p-6">
                        <h3 className="font-semibold text-slate-900">
                          🕘 Recent Handoffs
                        </h3>

                        {kitHistory.length ===
                          0 && (
                          <p className="mt-3 text-sm text-slate-500">
                            No handoffs recorded yet.
                          </p>
                        )}

                        <div className="mt-4 space-y-3">
                          {kitHistory
                            .slice(
                              0,
                              5
                            )
                            .map(
                              (
                                handoff
                              ) => {
                                const from =
                                  getRelation(
                                    handoff.from_member
                                  );

                                const to =
                                  getRelation(
                                    handoff.to_member
                                  );

                                return (
                                  <div
                                    key={
                                      handoff.id
                                    }
                                    className="rounded-xl bg-slate-50 p-4 text-sm"
                                  >
                                    <p className="font-medium text-slate-900">
                                      {from
                                        ? `${from.name} → `
                                        : ""}
                                      {to?.name ??
                                        "Unknown member"}
                                    </p>

                                    <p className="mt-1 text-xs text-slate-500">
                                      {formatDate(
                                        handoff.handed_off_at
                                      )}
                                    </p>

                                    {handoff.note && (
                                      <p className="mt-2 text-slate-600">
                                        {
                                          handoff.note
                                        }
                                      </p>
                                    )}
                                  </div>
                                );
                              }
                            )}
                        </div>
                      </div>
                    </article>
                  );
                }
              )}
            </section>
          )}
      </div>
    </main>
  );
}

function getRelation<T>(
  relation:
    | T
    | T[]
    | null
): T | null {
  if (!relation) {
    return null;
  }

  if (
    Array.isArray(
      relation
    )
  ) {
    return (
      relation[0] ??
      null
    );
  }

  return relation;
}

function formatDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      dateStyle:
        "medium",

      timeStyle:
        "short",
    }
  ).format(
    new Date(
      value
    )
  );
}
