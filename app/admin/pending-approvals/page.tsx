"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";

type PendingMember = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  photo_url: string | null;
  approval_status: string;
};

export default function PendingApprovalsPage() {
  const { profile, loadingProfile } = useCurrentProfile();

  const [members, setMembers] = useState<PendingMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingMemberId, setProcessingMemberId] =
    useState<string | null>(null);
  const [message, setMessage] = useState("");

  const isAdmin = profile?.appRole === "Admin";

  const loadPendingMembers = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("members")
      .select(
        `
          id,
          name,
          email,
          phone,
          role,
          photo_url,
          approval_status
        `
      )
      .eq("approval_status", "Pending")
      .order("name");

    if (error) {
      setMessage(`Unable to load pending players: ${error.message}`);
    } else {
      setMembers((data ?? []) as PendingMember[]);
    }

    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    if (loadingProfile) {
      return;
    }

    void loadPendingMembers();
  }, [loadingProfile, loadPendingMembers]);

  async function approveMember(member: PendingMember) {
    const confirmed = window.confirm(
      `Approve ${member.name} as an active club member?`
    );

    if (!confirmed) {
      return;
    }

    setProcessingMemberId(member.id);
    setMessage("");

    const { error } = await supabase
      .from("members")
      .update({
        approval_status: "Active",
      })
      .eq("id", member.id);

    if (error) {
      setMessage(`Unable to approve player: ${error.message}`);
      setProcessingMemberId(null);
      return;
    }

    setMessage(`${member.name} was approved successfully.`);
    await loadPendingMembers();
    setProcessingMemberId(null);
  }

  async function rejectMember(member: PendingMember) {
    const confirmed = window.confirm(
      `Reject ${member.name}'s membership request?`
    );

    if (!confirmed) {
      return;
    }

    setProcessingMemberId(member.id);
    setMessage("");

    const { error } = await supabase
      .from("members")
      .update({
        approval_status: "Rejected",
      })
      .eq("id", member.id);

    if (error) {
      setMessage(`Unable to reject player: ${error.message}`);
      setProcessingMemberId(null);
      return;
    }

    setMessage(`${member.name}'s request was rejected.`);
    await loadPendingMembers();
    setProcessingMemberId(null);
  }

  if (loadingProfile) {
    return <PageMessage message="Checking account…" />;
  }

  if (!profile) {
    return (
      <AccessMessage
        title="Sign in required"
        message="Sign in to review player approvals."
      />
    );
  }

  if (!isAdmin) {
    return (
      <AccessMessage
        title="Admin access required"
        message="Only an Admin can approve new players."
      />
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-blue-700 hover:underline">
          ← Back to Home
        </Link>

        <header className="mt-6">
          <h1 className="text-3xl font-bold text-blue-900 sm:text-4xl">
            ⚠️ Pending Player Approvals
          </h1>

          <p className="mt-3 text-slate-600">
            Review new player registrations before granting access to
            club features.
          </p>
        </header>

        {message && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            {message}
          </div>
        )}

        {loading ? (
          <p className="mt-8 text-slate-600">
            Loading pending players…
          </p>
        ) : members.length === 0 ? (
          <section className="mt-8 rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
            <div className="text-4xl">✅</div>

            <h2 className="mt-4 text-xl font-bold text-green-900">
              No pending approvals
            </h2>

            <p className="mt-2 text-sm text-green-800">
              Every submitted player profile has been reviewed.
            </p>
          </section>
        ) : (
          <>
            <div className="mt-8 flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-slate-900">
                Waiting for review
              </h2>

              <span className="rounded-full bg-amber-200 px-3 py-1 text-sm font-bold text-amber-950">
                {members.length}
              </span>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {members.map((member) => {
                const isProcessing =
                  processingMemberId === member.id;

                return (
                  <article
                    key={member.id}
                    className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-start gap-4">
                      {member.photo_url ? (
                        <img
                          src={member.photo_url}
                          alt={`${member.name} profile`}
                          className="h-16 w-16 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-200 text-3xl">
                          👤
                        </div>
                      )}

                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-blue-900">
                          {member.name}
                        </h3>

                        <p className="mt-1 text-sm font-medium text-slate-600">
                          {member.role || "Player"}
                        </p>

                        {member.email && (
                          <p className="mt-2 break-all text-sm text-slate-600">
                            {member.email}
                          </p>
                        )}

                        {member.phone && (
                          <p className="mt-1 text-sm text-slate-600">
                            {member.phone}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => void approveMember(member)}
                        className="flex-1 rounded-lg bg-green-700 px-4 py-3 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isProcessing ? "Processing…" : "Approve"}
                      </button>

                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => void rejectMember(member)}
                        className="flex-1 rounded-lg border border-red-600 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function PageMessage({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-5xl">
        <p className="text-slate-600">{message}</p>
      </div>
    </main>
  );
}

function AccessMessage({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-blue-700 hover:underline">
          ← Back to Home
        </Link>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="text-4xl">🔐</div>

          <h1 className="mt-4 text-2xl font-bold text-blue-900">
            {title}
          </h1>

          <p className="mt-2 text-slate-600">{message}</p>
        </section>
      </div>
    </main>
  );
}
