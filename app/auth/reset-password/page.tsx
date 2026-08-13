"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import AlertMessage from "@/components/AlertMessage";

export default function ResetPasswordPage() {
  const router =
    useRouter();

  const [
    password,
    setPassword,
  ] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] =
    useState("");

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    recoveryReady,
    setRecoveryReady,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState(
      "Checking your password reset link…"
    );

  const [
    messageType,
    setMessageType,
  ] =
    useState<
      | "success"
      | "error"
      | "warning"
      | "info"
    >("info");

  useEffect(() => {
    const {
      data: {
        subscription,
      },
    } =
      supabase.auth
        .onAuthStateChange(
          (event) => {
            if (
              event ===
                "PASSWORD_RECOVERY" ||
              event ===
                "SIGNED_IN"
            ) {
              setRecoveryReady(
                true
              );

              setMessage(
                ""
              );
            }
          }
        );

    void supabase.auth
      .getSession()
      .then(
        ({
          data,
        }) => {
          if (
            data.session
          ) {
            setRecoveryReady(
              true
            );

            setMessage(
              ""
            );
          }
        }
      );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");
    setMessageType(
      "info"
    );

    if (
      password.length <
      6
    ) {
      setMessageType(
        "error"
      );

      setMessage(
        "Password must contain at least 6 characters."
      );

      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setMessageType(
        "error"
      );

      setMessage(
        "Passwords do not match."
      );

      return;
    }

    setSubmitting(
      true
    );

    const {
      error,
    } =
      await supabase.auth
        .updateUser({
          password,
        });

    if (error) {
      setMessageType(
        "error"
      );

      setMessage(
        `Unable to update password: ${error.message}`
      );

      setSubmitting(
        false
      );

      return;
    }

    setMessageType(
      "success"
    );

    setMessage(
      "Password updated successfully."
    );

    setSubmitting(
      false
    );

    window.setTimeout(
      () => {
        router.push("/");
        router.refresh();
      },
      1200
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-md">
        <Link
          href="/auth"
          className="text-blue-700 hover:underline"
        >
          ← Back to Sign
          In
        </Link>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="text-center">
            <div className="text-4xl">
              🔐
            </div>

            <h1 className="mt-4 text-3xl font-bold text-blue-900">
              Reset
              Password
            </h1>

            <p className="mt-2 text-slate-600">
              Create a new
              password for
              your Starz Club
              account.
            </p>
          </div>

          {message && (
            <div className="mt-6">
              <AlertMessage
                type={
                  messageType
                }
                message={
                  message
                }
              />
            </div>
          )}

          {recoveryReady && (
            <form
              onSubmit={
                handleSubmit
              }
              className="mt-6 grid gap-4"
            >
              <label>
                <span className="text-sm font-medium text-slate-700">
                  New
                  Password *
                </span>

                <input
                  type="password"
                  required
                  minLength={
                    6
                  }
                  autoComplete="new-password"
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
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>

              <label>
                <span className="text-sm font-medium text-slate-700">
                  Confirm
                  New
                  Password *
                </span>

                <input
                  type="password"
                  required
                  minLength={
                    6
                  }
                  autoComplete="new-password"
                  value={
                    confirmPassword
                  }
                  onChange={(
                    event
                  ) =>
                    setConfirmPassword(
                      event
                        .target
                        .value
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>

              <button
                type="submit"
                disabled={
                  submitting
                }
                className="mt-2 rounded-lg bg-blue-900 px-5 py-3 font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? "Updating password…"
                  : "Update Password"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
