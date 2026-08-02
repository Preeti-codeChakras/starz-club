"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Member = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
};

const initialForm = {
  name: "",
  email: "",
  phone: "",
  role: "Player",
};

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function loadMembers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("members")
      .select("id, name, email, phone, role")
      .order("name");

    if (error) {
      setMessage(`Unable to load members: ${error.message}`);
    } else {
      setMembers(data ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadMembers();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();

    if (!name) {
      setMessage("Member name is required.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("members").insert({
      name,
      email: email || null,
      phone: phone || null,
      role: form.role,
    });

    if (error) {
      setMessage(`Unable to add member: ${error.message}`);
      setSubmitting(false);
      return;
    }

    setForm(initialForm);
    setMessage("Member added successfully.");

    await loadMembers();
    setSubmitting(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-blue-700 hover:underline">
          ← Back to Home
        </Link>

        <h1 className="mt-6 text-3xl font-bold text-blue-900">
          👥 Starz Club Members
        </h1>

        <p className="mt-3 text-slate-600">
          Add and view Starz Club members.
        </p>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-blue-900">
            Add a member
          </h2>

          <form
            onSubmit={handleSubmit}
            className="mt-5 grid gap-4 sm:grid-cols-2"
          >
            <label>
              <span className="text-sm font-medium text-slate-700">
                Name *
              </span>

              <input
                type="text"
                required
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">
                Email
              </span>

              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">
                Phone
              </span>

              <input
                type="tel"
                value={form.phone}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">
                Club role
              </span>

              <select
                value={form.role}
                onChange={(event) =>
                  setForm({ ...form, role: event.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="Player">Player</option>
                <option value="Captain">Captain</option>
                <option value="Coach">Coach</option>
                <option value="Admin">Admin</option>
              </select>
            </label>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-blue-900 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Adding…" : "Add Member"}
              </button>
            </div>
          </form>

          {message && (
            <p className="mt-4 text-sm text-slate-700">{message}</p>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-slate-900">
            Current members
          </h2>

          {loading && (
            <p className="mt-4 text-slate-600">Loading members…</p>
          )}

          {!loading && members.length === 0 && (
            <p className="mt-4 text-slate-600">
              No members have been added yet.
            </p>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => (
              <article
                key={member.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h3 className="text-lg font-semibold text-blue-900">
                  {member.name}
                </h3>

                <p className="mt-1 text-sm font-medium text-slate-600">
                  {member.role || "Player"}
                </p>

                {member.email && (
                  <p className="mt-3 break-all text-sm text-slate-600">
                    {member.email}
                  </p>
                )}

                {member.phone && (
                  <p className="mt-1 text-sm text-slate-600">
                    {member.phone}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}