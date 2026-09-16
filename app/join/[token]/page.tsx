"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";
import { useParams } from "next/navigation";

type Club = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
};

type InviteResponse = {
  success?: boolean;
  club?: Club;
  claimToken?: string;
  error?: string;
};

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export default function JoinClubPage() {
  const params = useParams();

  const inviteIdentifier =
    typeof params.token === "string"
      ? params.token.trim()
      : "";

  const [club, setClub] =
    useState<Club | null>(null);

  const [claimToken, setClaimToken] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadInvite() {
      if (!inviteIdentifier) {
        setError(
          "This invite link is invalid."
        );

        setLoading(false);

        return;
      }

      try {
        const query = looksLikeUuid(
          inviteIdentifier
        )
          ? `token=${encodeURIComponent(
              inviteIdentifier
            )}`
          : `slug=${encodeURIComponent(
              inviteIdentifier.toLowerCase()
            )}`;

        const response = await fetch(
          `/api/clubs/invite?${query}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const result: InviteResponse =
          await response.json();

        if (!response.ok) {
          setError(
            result.error ||
              "This invite could not be validated."
          );

          return;
        }

        if (
          !result.club ||
          !result.claimToken
        ) {
          setError(
            "This invitation could not be loaded."
          );

          return;
        }

        setClub(result.club);
        setClaimToken(
          result.claimToken
        );
      } catch (loadError) {
        console.error(
          "Unable to load invite:",
          loadError
        );

        setError(
          "Unable to load this invitation."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadInvite();
  }, [inviteIdentifier]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="text-4xl">
              🏏
            </div>

            <p className="mt-4 text-slate-600">
              Checking your club invitation…
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (
    error ||
    !club ||
    !claimToken
  ) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <div className="text-4xl">
              ⚠️
            </div>

            <h1 className="mt-4 text-2xl font-bold text-slate-900">
              Invite unavailable
            </h1>

            <p className="mt-3 text-slate-600">
              {error}
            </p>

            <Link
              href="/"
              className="mt-6 inline-block font-semibold text-blue-700 hover:underline"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const encodedToken =
    encodeURIComponent(claimToken);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-md">
        <section className="rounded-2xl border border-blue-100 bg-white p-8 text-center shadow-sm">
          {club.logo_url ? (
            <img
              src={club.logo_url}
              alt={`${club.name} logo`}
              className="mx-auto h-20 w-20 rounded-2xl object-contain"
            />
          ) : (
            <div className="text-5xl">
              🏏
            </div>
          )}

          <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-blue-700">
            Club Invitation
          </p>

          <h1 className="mt-2 text-3xl font-bold text-blue-950">
            Join {club.name}
          </h1>

          <p className="mt-3 text-slate-600">
            You&apos;ve been invited to join this
            cricket club.
          </p>

          <div className="mt-7 grid gap-3">
            <Link
              href={`/auth?invite=${encodedToken}&mode=signup`}
              className="rounded-lg bg-blue-900 px-5 py-3 font-semibold text-white hover:bg-blue-800"
            >
              Create Account
            </Link>

            <Link
              href={`/auth?invite=${encodedToken}&mode=login`}
              className="rounded-lg border border-blue-200 bg-white px-5 py-3 font-semibold text-blue-800 hover:bg-blue-50"
            >
              I Already Have an Account
            </Link>
          </div>

          <p className="mt-5 text-xs leading-5 text-slate-500">
            An account can belong to only one
            cricket club.
          </p>
        </section>
      </div>
    </main>
  );
}
