"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

type MemberStatus = {
  approval_status: "Pending" | "Active" | "Rejected";
};

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function routeSignedInUser(userId: string) {
    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("member_id")
        .eq("id", userId)
        .maybeSingle();

    if (profileError) {
      setMessage(
        `Signed in, but unable to load your profile: ${profileError.message}`
      );
      return;
    }

    if (!profile?.member_id) {
      router.push("/complete-profile");
      router.refresh();
      return;
    }

    const { data: member, error: memberError } =
      await supabase
        .from("members")
        .select("approval_status")
        .eq("id", profile.member_id)
        .maybeSingle<MemberStatus>();

    if (memberError) {
      setMessage(
        `Signed in, but unable to load your member status: ${memberError.message}`
      );
      return;
    }

    if (!member) {
      router.push("/complete-profile");
      router.refresh();
      return;
    }

    if (member.approval_status === "Pending") {
      router.push("/pending-approval");
      router.refresh();
      return;
    }

    if (member.approval_status === "Rejected") {
      router.push("/pending-approval");
      router.refresh();
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");

    const normalizedEmail =
      email.trim().toLowerCase();

    if (!normalizedEmail) {
      setMessage("Email is required.");
      return;
    }

    if (password.length < 6) {
      setMessage(
        "Password must contain at least 6 characters."
      );
      return;
    }

    setSubmitting(true);

    if (mode === "signup") {
      const { data, error } =
        await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo:
              `${window.location.origin}/auth`,
          },
        });

      if (error) {
        setMessage(
          `Unable to create account: ${error.message}`
        );
        setSubmitting(false);
        return;
      }

      if (data.session && data.user) {
        await routeSignedInUser(data.user.id);
      } else {
        setMessage(
          "Account created. Please check your email and confirm your account before signing in."
        );
      }

      setSubmitting(false);
      return;
    }

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

    if (error) {
      setMessage(
        `Unable to sign in: ${error.message}`
      );
      setSubmitting(false);
      return;
    }

    if (!data.user) {
      setMessage(
        "Signed in, but the user account could not be loaded."
      );
      setSubmitting(false);
      return;
    }

    await routeSignedInUser(data.user.id);
    setSubmitting(false);
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
    setPassword("");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-md">
        <Link
          href="/"
          className="text-blue-700 hover:underline"
        >
          ← Back to Home
        </Link>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="text-center">
            <div className="text-4xl">🏏</div>

            <h1 className="mt-4 text-3xl font-bold text-blue-900">
              Starz Club
            </h1>

            <p className="mt-2 text-slate-600">
              {mode === "login"
                ? "Sign in to your club account."
                : "Create your club account."}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => changeMode("login")}
              className={`rounded-md px-4 py-2 text-sm font-medium ${
                mode === "login"
                  ? "bg-white text-blue-900 shadow-sm"
                  : "text-slate-600"
              }`}
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={() => changeMode("signup")}
              className={`rounded-md px-4 py-2 text-sm font-medium ${
                mode === "signup"
                  ? "bg-white text-blue-900 shadow-sm"
                  : "text-slate-600"
              }`}
            >
              Sign Up
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-6 grid gap-4"
          >
            <label>
              <span className="text-sm font-medium text-slate-700">
                Email *
              </span>

              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3"
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">
                Password *
              </span>

              <input
                type="password"
                required
                minLength={6}
                autoComplete={
                  mode === "login"
                    ? "current-password"
                    : "new-password"
                }
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3"
              />

              <p className="mt-1 text-xs text-slate-500">
                Minimum 6 characters.
              </p>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 rounded-lg bg-blue-900 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? mode === "login"
                  ? "Signing in…"
                  : "Creating account…"
                : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>

          {message && (
            <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
              {message}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
