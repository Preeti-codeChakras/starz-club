"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function PendingApprovalPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      const { data } = await supabase
        .from("members")
        .select("approval_status")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.approval_status === "Active") {
        router.push("/");
        router.refresh();
        return;
      }

      setChecking(false);
    }

    void checkStatus();
  }, [router]);

  if (checking) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-10">
        <div className="mx-auto max-w-3xl">
          <p className="text-slate-600">
            Checking approval status…
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-2xl">
        <section className="rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <div className="text-5xl">⏳</div>

          <h1 className="mt-5 text-3xl font-bold text-blue-900">
            Profile Pending Approval
          </h1>

          <p className="mt-3 text-slate-600">
            Your player profile has been submitted. A Starz
            Club Admin must approve it before full access is
            enabled.
          </p>

          <p className="mt-4 text-sm text-slate-500">
            You can return later and sign in again to check
            your status.
          </p>

          <Link
            href="/"
            className="mt-6 inline-block rounded-lg border border-blue-900 px-5 py-3 font-medium text-blue-900"
          >
            Back to Home
          </Link>
        </section>
      </div>
    </main>
  );
}
