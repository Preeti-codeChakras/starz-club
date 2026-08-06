"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";

export default function PendingApprovalsCard() {
  const { profile, loadingProfile } = useCurrentProfile();

  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.appRole === "Admin";

  const loadPendingCount = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const { count, error } = await supabase
      .from("members")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("approval_status", "Pending");

    if (!error) {
      setPendingCount(count ?? 0);
    }

    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    if (loadingProfile) {
      return;
    }

    void loadPendingCount();
  }, [loadingProfile, loadPendingCount]);

  if (loadingProfile || loading || !isAdmin) {
    return null;
  }

  return (
    <Link
      href="/admin/pending-approvals"
      className={`mb-8 block rounded-2xl border p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md ${
        pendingCount > 0
          ? "border-amber-300 bg-amber-50"
          : "border-green-200 bg-green-50"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
            {pendingCount > 0 ? "⚠️" : "✅"}
          </div>

          <div>
            <h2
              className={`text-lg font-bold ${
                pendingCount > 0
                  ? "text-amber-950"
                  : "text-green-900"
              }`}
            >
              Pending Player Approvals
            </h2>

            <p
              className={`mt-1 text-sm ${
                pendingCount > 0
                  ? "text-amber-800"
                  : "text-green-800"
              }`}
            >
              {pendingCount > 0
                ? `${pendingCount} ${
                    pendingCount === 1 ? "player is" : "players are"
                  } waiting for approval.`
                : "No players are currently waiting for approval."}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span
            className={`inline-flex min-w-10 items-center justify-center rounded-full px-3 py-1 text-lg font-bold ${
              pendingCount > 0
                ? "bg-amber-200 text-amber-950"
                : "bg-green-200 text-green-900"
            }`}
          >
            {pendingCount}
          </span>

          <p className="mt-2 text-sm font-semibold text-blue-800">
            Review →
          </p>
        </div>
      </div>
    </Link>
  );
}
