"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type SuccessClientProps = {
  clubId: string;
  inviteToken: string;
  invitePath: string;
};

export default function SuccessClient({
  clubId,
  inviteToken,
  invitePath,
}: SuccessClientProps) {
  const router = useRouter();

  const [copied, setCopied] = useState(false);

  const inviteUrl =
    typeof window !== "undefined" && invitePath
      ? `${window.location.origin}${invitePath}`
      : invitePath;

  async function copyInvite() {
    if (!inviteUrl) return;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setCopied(false);
    }
  }

  if (!clubId || !inviteToken || !invitePath) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-10">
        <div className="mx-auto max-w-2xl">
          <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">
              Club setup information is missing
            </h1>

            <p className="mt-3 text-slate-600">
              We could not load the club invitation information.
            </p>

            <Link
              href="/"
              className="mt-6 inline-block font-medium text-blue-700 hover:underline"
            >
              Go to Home
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-center">
            <div className="text-5xl">🎉</div>

            <h1 className="mt-4 text-3xl font-bold text-blue-900">
              Your Club Is Ready!
            </h1>

            <p className="mt-3 text-slate-600">
              Your cricket club has been created and you are now its
              administrator.
            </p>
          </div>

          <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-5">
            <h2 className="font-semibold text-green-900">
              Invite your players
            </h2>

            <p className="mt-1 text-sm text-green-800">
              Share this private invitation link with players who should join
              your club.
            </p>

            <div className="mt-4 break-all rounded-lg border border-green-200 bg-white p-3 text-sm text-slate-700">
              {inviteUrl}
            </div>

            <button
              type="button"
              onClick={copyInvite}
              className="mt-3 w-full rounded-lg bg-green-700 px-5 py-3 font-medium text-white hover:bg-green-800"
            >
              {copied ? "Copied!" : "Copy Invite Link"}
            </button>
          </div>

          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            This invitation expires after 30 days. Players who join using it
            will belong only to this cricket club.
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                router.push("/");
                router.refresh();
              }}
              className="rounded-lg bg-blue-900 px-5 py-3 font-medium text-white"
            >
              Go to Club Home
            </button>

            <Link
              href={invitePath}
              target="_blank"
              className="rounded-lg border border-blue-900 px-5 py-3 text-center font-medium text-blue-900"
            >
              Preview Invite
            </Link>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            Club ID: {clubId}
          </p>
        </section>
      </div>
    </main>
  );
}
