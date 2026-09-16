"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type CreateClubResult = {
  created_club_id: string;
  invite_token: string;
};

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CreateClubPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles"
  );
  const [contactEmail, setContactEmail] = useState("");
  const [website, setWebsite] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const suggestedSlug = useMemo(() => makeSlug(name), [name]);

  function handleNameChange(value: string) {
    setName(value);

    if (!slugTouched) {
      setSlug(makeSlug(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlugTouched(true);
    setSlug(makeSlug(value));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const cleanName = name.trim();
    const cleanSlug = slug.trim();
    const cleanTimezone = timezone.trim();

    if (!cleanName) {
      setMessage("Club name is required.");
      return;
    }

    if (!cleanSlug) {
      setMessage("Club URL is required.");
      return;
    }

    if (!cleanTimezone) {
      setMessage("Timezone is required.");
      return;
    }

    setSubmitting(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setSubmitting(false);
      router.push("/auth");
      router.refresh();
      return;
    }

    const { data, error } = await supabase.rpc("create_my_club", {
      p_name: cleanName,
      p_slug: cleanSlug,
      p_timezone: cleanTimezone,
      p_contact_email: contactEmail.trim() || null,
      p_website: website.trim() || null,
    });

    if (error) {
      setMessage(error.message);
      setSubmitting(false);
      return;
    }

    const result = data?.[0] as CreateClubResult | undefined;

    if (!result?.created_club_id || !result?.invite_token) {
      setMessage(
        "The club was created, but the invite information could not be loaded."
      );
      setSubmitting(false);
      return;
    }

    const invitePath = `/join/${result.invite_token}`;

    router.push(
      `/create-club/success?club=${encodeURIComponent(
        result.created_club_id
      )}&invite=${encodeURIComponent(result.invite_token)}&path=${encodeURIComponent(
        invitePath
      )}`
    );
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-center">
            <div className="text-4xl">🏏</div>

            <h1 className="mt-4 text-3xl font-bold text-blue-900">
              Create Your Cricket Club
            </h1>

            <p className="mt-2 text-slate-600">
              Set up your club and become its first administrator.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
            <label>
              <span className="text-sm font-medium text-slate-700">
                Club name *
              </span>

              <input
                type="text"
                required
                value={name}
                onChange={(event) => handleNameChange(event.target.value)}
                placeholder="Example: Seattle Warriors Cricket Club"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none"
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">
                Club URL *
              </span>

              <div className="mt-1 flex items-center rounded-lg border border-slate-300 bg-white">
                <span className="whitespace-nowrap border-r border-slate-200 px-3 text-sm text-slate-500">
                  /club/
                </span>

                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(event) => handleSlugChange(event.target.value)}
                  placeholder="seattle-warriors"
                  className="w-full rounded-r-lg px-3 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </div>

              <p className="mt-1 text-xs text-slate-500">
                Lowercase letters, numbers and hyphens only.
                {suggestedSlug && !slugTouched
                  ? ` Suggested: ${suggestedSlug}`
                  : ""}
              </p>
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">
                Timezone *
              </span>

              <input
                type="text"
                required
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                placeholder="America/Los_Angeles"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none"
              />

              <p className="mt-1 text-xs text-slate-500">
                Used later for schedules, reminders and club events.
              </p>
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">
                Contact email
              </span>

              <input
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                placeholder="admin@yourclub.com"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none"
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">
                Website
              </span>

              <input
                type="url"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                placeholder="https://www.yourclub.com"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none"
              />
            </label>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              You will become the Admin of this club. Your account can belong to
              only one cricket club.
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-900 px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Creating club…" : "Create Club"}
            </button>
          </form>

          {message && (
            <p className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-800">
              {message}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
