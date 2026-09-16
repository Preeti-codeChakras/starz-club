"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import AlertMessage from "@/components/AlertMessage";

type AuthMode =
  | "login"
  | "signup";

type MemberStatus = {
  approval_status:
    | "Pending"
    | "Active"
    | "Rejected";
};

export default function AuthPageClient() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const inviteToken =
    searchParams
      .get("invite")
      ?.trim() ?? "";

  const requestedMode =
    searchParams.get(
      "mode"
    );

  const [mode, setMode] =
    useState<AuthMode>(
      requestedMode ===
        "signup"
        ? "signup"
        : "login"
    );

  const [email, setEmail] =
    useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    messageType,
    setMessageType,
  ] = useState<
    | "success"
    | "error"
    | "warning"
    | "info"
  >("info");

  useEffect(() => {
    if (
      requestedMode ===
      "signup"
    ) {
      setMode("signup");
    }

    if (
      requestedMode ===
      "login"
    ) {
      setMode("login");
    }
  }, [requestedMode]);

  /*
   * =======================================================
   * CLAIM INVITE
   *
   * The browser never updates club_id directly.
   * Our server validates both:
   * - Supabase user session
   * - invite token
   *
   * Server then enforces:
   * ONE USER = ONE CLUB.
   * =======================================================
   */

  async function claimInvite() {
    if (!inviteToken) {
      return true;
    }

    const {
      data: sessionData,
      error: sessionError,
    } =
      await supabase.auth.getSession();

    if (
      sessionError ||
      !sessionData.session
    ) {
      setMessageType(
        "error"
      );

      setMessage(
        "Signed in, but your session could not be verified."
      );

      return false;
    }

    try {
      const response =
        await fetch(
          "/api/clubs/invite",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${sessionData.session.access_token}`,
            },

            body:
              JSON.stringify(
                {
                  token:
                    inviteToken,
                }
              ),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok
      ) {
        setMessageType(
          "error"
        );

        setMessage(
          result.error ||
            "Unable to join this club."
        );

        return false;
      }

      return true;
    } catch (error) {
      console.error(
        "Unable to claim invite:",
        error
      );

      setMessageType(
        "error"
      );

      setMessage(
        "Unable to join this club. Please try again."
      );

      return false;
    }
  }
async function routeSignedInUser(
  userId: string
) {
  /*
   * If this authentication came
   * from an invite link, claim
   * the club BEFORE deciding
   * where the user should go.
   */

  const inviteClaimed =
    await claimInvite();

  if (!inviteClaimed) {
    return;
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select(
      "member_id, club_id"
    )
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    setMessageType(
      "error"
    );

    setMessage(
      `Signed in, but unable to load your profile: ${profileError.message}`
    );

    return;
  }

  /*
   * No club yet means this is
   * an unassigned account.
   *
   * They can create their own club.
   */
  if (!profile?.club_id) {
    router.push(
      "/create-club"
    );

    router.refresh();

    return;
  }

  /*
   * User belongs to a club,
   * but has not created their
   * member/player profile yet.
   */
  if (!profile.member_id) {
    router.push(
      "/complete-profile"
    );

    router.refresh();

    return;
  }

  const {
    data: member,
    error: memberError,
  } = await supabase
    .from("members")
    .select(
      "approval_status"
    )
    .eq(
      "id",
      profile.member_id
    )
    .maybeSingle<MemberStatus>();

  if (memberError) {
    setMessageType(
      "error"
    );

    setMessage(
      `Signed in, but unable to load your member status: ${memberError.message}`
    );

    return;
  }

  if (!member) {
    router.push(
      "/complete-profile"
    );

    router.refresh();

    return;
  }

  if (
    member.approval_status ===
    "Pending"
  ) {
    router.push(
      "/pending-approval"
    );

    router.refresh();

    return;
  }

  if (
    member.approval_status ===
    "Rejected"
  ) {
    router.push(
      "/pending-approval"
    );

    router.refresh();

    return;
  }

  router.push("/");

  router.refresh();
}


  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");

    setMessageType(
      "info"
    );

    const normalizedEmail =
      email
        .trim()
        .toLowerCase();

    if (!normalizedEmail) {
      setMessageType(
        "error"
      );

      setMessage(
        "Email is required."
      );

      return;
    }

    if (
      password.length < 6
    ) {
      setMessageType(
        "error"
      );

      setMessage(
        "Password must contain at least 6 characters."
      );

      return;
    }

    setSubmitting(true);

    /*
     * ====================================
     * SIGN UP
     * ====================================
     */

    if (
      mode === "signup"
    ) {
      const confirmationUrl =
        inviteToken
          ? `${window.location.origin}/auth?invite=${encodeURIComponent(
              inviteToken
            )}&mode=login`
          : `${window.location.origin}/auth`;

      const {
        data,
        error,
      } =
        await supabase.auth.signUp(
          {
            email:
              normalizedEmail,

            password,

            options: {
              emailRedirectTo:
                confirmationUrl,
            },
          }
        );

      if (error) {
        setMessageType(
          "error"
        );

        setMessage(
          `Unable to create account: ${error.message}`
        );

        setSubmitting(
          false
        );

        return;
      }

      if (
        data.session &&
        data.user
      ) {
        await routeSignedInUser(
          data.user.id
        );
      } else {
        setMessageType(
          "success"
        );

        setMessage(
          inviteToken
            ? "Account created. Please check your email and confirm your account, then sign in to finish joining the club."
            : "Account created. Please check your email and confirm your account before signing in."
        );
      }

      setSubmitting(
        false
      );

      return;
    }

    /*
     * ====================================
     * SIGN IN
     * ====================================
     */

    const {
      data,
      error,
    } =
      await supabase.auth
        .signInWithPassword(
          {
            email:
              normalizedEmail,

            password,
          }
        );

    if (error) {
      setMessageType(
        "error"
      );

      setMessage(
        `Unable to sign in: ${error.message}`
      );

      setSubmitting(false);

      return;
    }

    if (!data.user) {
      setMessageType(
        "error"
      );

      setMessage(
        "Signed in, but the user account could not be loaded."
      );

      setSubmitting(false);

      return;
    }

    await routeSignedInUser(
      data.user.id
    );

    setSubmitting(false);
  }

  /*
   * ====================================
   * FORGOT PASSWORD
   * ====================================
   */

  async function handleForgotPassword() {
    setMessage("");

    setMessageType(
      "info"
    );

    const normalizedEmail =
      email
        .trim()
        .toLowerCase();

    if (!normalizedEmail) {
      setMessageType(
        "warning"
      );

      setMessage(
        "Enter your email address first, then click Forgot password."
      );

      return;
    }

    setSubmitting(true);

    const { error } =
      await supabase.auth
        .resetPasswordForEmail(
          normalizedEmail,
          {
            redirectTo:
              `${window.location.origin}/auth/reset-password`,
          }
        );

    if (error) {
      setMessageType(
        "error"
      );

      setMessage(
        `Unable to send password reset email: ${error.message}`
      );

      setSubmitting(false);

      return;
    }

    setMessageType(
      "success"
    );

    setMessage(
      "Password reset email sent. Please check your inbox."
    );

    setSubmitting(false);
  }

  function changeMode(
    nextMode: AuthMode
  ) {
    setMode(nextMode);

    setMessage("");

    setMessageType(
      "info"
    );

    setPassword("");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-md">
        <Link
          href="/"
          className="text-blue-700 hover:underline"
        >
          ← Back to Home
        </Link>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          {/* HEADER */}

          <div className="text-center">
            <div className="text-4xl">
              🏏
            </div>

            <h1 className="mt-4 text-3xl font-bold text-blue-900">
              Starz Club
            </h1>

            <p className="mt-2 text-slate-600">
              {inviteToken
                ? mode ===
                  "login"
                  ? "Sign in to accept your club invitation."
                  : "Create an account to accept your club invitation."
                : mode ===
                    "login"
                  ? "Sign in to your club account."
                  : "Create your club account."}
            </p>
          </div>

          {/* INVITE BANNER */}

          {inviteToken && (
            <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              🏏 You&apos;re
              continuing from a
              club invitation.
            </div>
          )}

          {/* LOGIN / SIGNUP TABS */}

          <div className="mt-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() =>
                changeMode(
                  "login"
                )
              }
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
              onClick={() =>
                changeMode(
                  "signup"
                )
              }
              className={`rounded-md px-4 py-2 text-sm font-medium ${
                mode === "signup"
                  ? "bg-white text-blue-900 shadow-sm"
                  : "text-slate-600"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* FORM */}

          <form
            onSubmit={
              handleSubmit
            }
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
                onChange={(
                  event
                ) =>
                  setEmail(
                    event
                      .target
                      .value
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-900 placeholder:text-slate-400 placeholder:opacity-100 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                value={
                  password
                }
                onChange={(
                  event
                ) =>
                  setPassword(
                    event
                      .target
                      .value
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-900 placeholder:text-slate-400 placeholder:opacity-100 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />

              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Minimum 6
                  characters.
                </p>

                {mode ===
                  "login" && (
                  <button
                    type="button"
                    disabled={
                      submitting
                    }
                    onClick={() =>
                      void handleForgotPassword()
                    }
                    className="text-xs font-semibold text-blue-700 transition hover:text-blue-900 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
            </label>

            {/* PRIVACY */}

            {mode ===
              "signup" && (
              <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <input
                  id="privacy"
                  type="checkbox"
                  required
                  className="mt-1 h-4 w-4 shrink-0"
                />

                <label
                  htmlFor="privacy"
                  className="text-sm leading-6 text-slate-700"
                >
                  I acknowledge
                  that my
                  information
                  will be used
                  for club
                  membership and
                  administration
                  as described in
                  the{" "}
                  <Link
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-700 hover:underline"
                  >
                    Privacy Policy
                  </Link>
                  .
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={
                submitting
              }
              className="mt-2 rounded-lg bg-blue-900 px-5 py-3 font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? mode ===
                  "login"
                  ? "Signing in…"
                  : "Creating account…"
                : mode ===
                    "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>

          {message && (
            <AlertMessage
              type={
                messageType
              }
              message={
                message
              }
            />
          )}
        </section>
      </div>
    </main>
  );
}
