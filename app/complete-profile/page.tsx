"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type PrimaryRole =
  | "Batter"
  | "Bowler"
  | "Batting All-Rounder"
  | "Bowling All-Rounder"
  | "Wicketkeeper"
  | "Fielder";

type ProfileForm = {
  name: string;
  phone: string;
  primary_role: PrimaryRole;
  secondary_role: string;
  batting_rating: string;
  bowling_rating: string;
  fielding_rating: string;
  can_keep_wickets: boolean;
  captain_eligible: boolean;
};

const initialForm: ProfileForm = {
  name: "",
  phone: "",
  primary_role: "Batter",
  secondary_role: "",
  batting_rating: "3",
  bowling_rating: "3",
  fielding_rating: "3",
  can_keep_wickets: false,
  captain_eligible: false,
};

export default function CompleteProfilePage() {
  const router = useRouter();

  const [form, setForm] = useState<ProfileForm>(initialForm);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");

  const [checkingAccount, setCheckingAccount] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadAccount() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/auth");
        router.refresh();
        return;
      }

      setUserId(user.id);
      setEmail(user.email ?? "");

      const { data: existingProfile, error: profileError } =
        await supabase
          .from("profiles")
          .select("member_id")
          .eq("id", user.id)
          .maybeSingle();

      if (profileError) {
        setMessage(
          `Unable to check your profile: ${profileError.message}`
        );
        setCheckingAccount(false);
        return;
      }

      if (existingProfile?.member_id) {
        router.push("/");
        router.refresh();
        return;
      }

      setCheckingAccount(false);
    }

    void loadAccount();
  }, [router]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");

    const name = form.name.trim();

    if (!name) {
      setMessage("Name is required.");
      return;
    }

    if (!userId || !email) {
      setMessage(
        "Your signed-in account could not be identified."
      );
      return;
    }

    const battingRating = Number(form.batting_rating);
    const bowlingRating = Number(form.bowling_rating);
    const fieldingRating = Number(form.fielding_rating);

    const ratings = [
      battingRating,
      bowlingRating,
      fieldingRating,
    ];

    if (
      ratings.some(
        (rating) =>
          !Number.isInteger(rating) ||
          rating < 1 ||
          rating > 5
      )
    ) {
      setMessage("All ratings must be between 1 and 5.");
      return;
    }

    setSubmitting(true);

    const memberData = {
      user_id: userId,
      name,
      email,
      phone: form.phone.trim() || null,
      role: "Player",
      approval_status: "Pending",
      primary_role: form.primary_role,
      secondary_role:
        form.secondary_role.trim() || null,
      batting_rating: battingRating,
      bowling_rating: bowlingRating,
      fielding_rating: fieldingRating,
      can_keep_wickets: form.can_keep_wickets,
      captain_eligible: form.captain_eligible,
    };

    const { data: createdMember, error: memberError } =
      await supabase
        .from("members")
        .insert(memberData)
        .select("id")
        .single();

    if (memberError) {
      setMessage(
        `Unable to create your member profile: ${memberError.message}`
      );
      setSubmitting(false);
      return;
    }

    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({
        member_id: createdMember.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (profileUpdateError) {
      setMessage(
        `Your member profile was created, but your login could not be linked: ${profileUpdateError.message}`
      );
      setSubmitting(false);
      return;
    }

    router.push("/pending-approval");
    router.refresh();
  }

  if (checkingAccount) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-10">
        <div className="mx-auto max-w-3xl">
          <p className="text-slate-600">
            Checking your account…
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="text-blue-700 hover:underline"
        >
          ← Back to Home
        </Link>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-center">
            <div className="text-4xl">🏏</div>

            <h1 className="mt-4 text-3xl font-bold text-blue-900">
              Complete Your Player Profile
            </h1>

            <p className="mt-2 text-slate-600">
              Tell us about your cricket skills so the club
              can create fair and balanced teams.
            </p>
          </div>

          <div className="mt-6 rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
            Signed in as <strong>{email}</strong>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-6 grid gap-5"
          >
            <label>
              <span className="text-sm font-medium text-slate-700">
                Full name *
              </span>

              <input
                type="text"
                required
                value={form.name}
                onChange={(event) =>
                  setForm({
                    ...form,
                    name: event.target.value,
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3"
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">
                Phone number
              </span>

              <input
                type="tel"
                value={form.phone}
                onChange={(event) =>
                  setForm({
                    ...form,
                    phone: event.target.value,
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3"
              />
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Primary playing role *
                </span>

                <select
                  value={form.primary_role}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      primary_role:
                        event.target.value as PrimaryRole,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3"
                >
                  <option value="Batter">Batter</option>
                  <option value="Bowler">Bowler</option>
                  <option value="Batting All-Rounder">
                    Batting All-Rounder
                  </option>
                  <option value="Bowling All-Rounder">
                    Bowling All-Rounder
                  </option>
                  <option value="Wicketkeeper">
                    Wicketkeeper
                  </option>
                  <option value="Fielder">Fielder</option>
                </select>
              </label>

              <label>
                <span className="text-sm font-medium text-slate-700">
                  Secondary role
                </span>

                <input
                  type="text"
                  placeholder="Example: Medium pace bowler"
                  value={form.secondary_role}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      secondary_role:
                        event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3"
                />
              </label>
            </div>

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-lg font-semibold text-blue-900">
                Self-assessed skill ratings
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                Use 1 for beginner and 5 for advanced.
                Admins can review these ratings before team
                generation.
              </p>

              <div className="mt-5 grid gap-5 sm:grid-cols-3">
                <RatingSelect
                  label="Batting"
                  value={form.batting_rating}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      batting_rating: value,
                    })
                  }
                />

                <RatingSelect
                  label="Bowling"
                  value={form.bowling_rating}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      bowling_rating: value,
                    })
                  }
                />

                <RatingSelect
                  label="Fielding"
                  value={form.fielding_rating}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      fielding_rating: value,
                    })
                  }
                />
              </div>
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={form.can_keep_wickets}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      can_keep_wickets:
                        event.target.checked,
                    })
                  }
                />

                <span className="text-sm font-medium text-slate-700">
                  I can keep wickets
                </span>
              </label>

              <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={form.captain_eligible}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      captain_eligible:
                        event.target.checked,
                    })
                  }
                />

                <span className="text-sm font-medium text-slate-700">
                  I am open to captaincy
                </span>
              </label>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Your profile will be submitted for Admin
              approval before full club access is enabled.
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-900 px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? "Submitting profile…"
                : "Submit Profile for Approval"}
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

function RatingSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-sm font-medium text-slate-700">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3"
      >
        <option value="1">1 — Beginner</option>
        <option value="2">2 — Developing</option>
        <option value="3">3 — Intermediate</option>
        <option value="4">4 — Strong</option>
        <option value="5">5 — Advanced</option>
      </select>
    </label>
  );
}
