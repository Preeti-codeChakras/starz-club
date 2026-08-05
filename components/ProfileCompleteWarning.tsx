"use client";

import Link from "next/link";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";

export default function ProfileCompletionWarning() {
  const { profile, loadingProfile } =
    useCurrentProfile();

  if (
    loadingProfile ||
    !profile ||
    profile.isProfileComplete
  ) {
    return null;
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-amber-900">
            Your player profile is not complete.
          </p>

          <p className="mt-1 text-sm text-amber-800">
            Please complete your player details before
            using season availability and other club
            features.
          </p>
        </div>

        <Link
          href="/complete-profile"
          className="shrink-0 rounded-lg bg-amber-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-amber-800"
        >
          Complete Profile
        </Link>
      </div>
    </div>
  );
}

