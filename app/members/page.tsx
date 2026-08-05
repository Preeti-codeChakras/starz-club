"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { uploadMemberPhoto } from "@/lib/supabase/storage";

type Member = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  photo_url: string | null;
};

const initialForm = {
  name: "",
  email: "",
  phone: "",
  role: "Player",
  photo_url: "",
};

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(initialForm);

  const [editingMemberId, setEditingMemberId] = useState<string | null>(
    null
  );

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoInputKey, setPhotoInputKey] = useState(0);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(
    null
  );

  const [message, setMessage] = useState("");

  async function loadMembers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("members")
      .select("id, name, email, phone, role, photo_url")
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

  function resetForm() {
    setEditingMemberId(null);
    setForm(initialForm);
    setPhotoFile(null);

    // Resets the visible file-input selection.
    setPhotoInputKey((current) => current + 1);
  }

  function startEditing(member: Member) {
    setEditingMemberId(member.id);

    setForm({
      name: member.name,
      email: member.email ?? "",
      phone: member.phone ?? "",
      role: member.role ?? "Player",
      photo_url: member.photo_url ?? "",
    });

    setPhotoFile(null);
    setPhotoInputKey((current) => current + 1);
    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelEditing() {
    resetForm();
    setMessage("");
  }

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

    let photoUrl = form.photo_url;

    try {
      if (photoFile) {
        photoUrl = await uploadMemberPhoto(photoFile);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown upload error";

      setMessage(`Unable to upload photo: ${errorMessage}`);
      setSubmitting(false);
      return;
    }

    const memberData = {
      name,
      email: email || null,
      phone: phone || null,
      role: form.role,
      photo_url: photoUrl || null,
    };

    const { error } = editingMemberId
      ? await supabase
          .from("members")
          .update(memberData)
          .eq("id", editingMemberId)
      : await supabase.from("members").insert(memberData);

    if (error) {
      setMessage(
        `Unable to ${
          editingMemberId ? "update" : "add"
        } member: ${error.message}`
      );

      setSubmitting(false);
      return;
    }

    const successMessage = editingMemberId
      ? "Member updated successfully."
      : "Member added successfully.";

    resetForm();
    setMessage(successMessage);

    await loadMembers();
    setSubmitting(false);
  }

  async function deleteMember(member: Member) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${member.name}?`
    );

    if (!confirmed) {
      return;
    }

    setDeletingMemberId(member.id);
    setMessage("");

    const { error } = await supabase
      .from("members")
      .delete()
      .eq("id", member.id);

    if (error) {
      setMessage(`Unable to delete member: ${error.message}`);
      setDeletingMemberId(null);
      return;
    }

    if (editingMemberId === member.id) {
      resetForm();
    }

    setMessage("Member deleted successfully.");
    await loadMembers();

    setDeletingMemberId(null);
  }

  function handlePhotoSelection(file: File | null) {
    if (!file) {
      setPhotoFile(null);
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setMessage("Please select a JPG, PNG, or WebP image.");
      setPhotoFile(null);
      setPhotoInputKey((current) => current + 1);
      return;
    }

    const maximumFileSize = 5 * 1024 * 1024;

    if (file.size > maximumFileSize) {
      setMessage("The member photo must be smaller than 5 MB.");
      setPhotoFile(null);
      setPhotoInputKey((current) => current + 1);
      return;
    }

    setMessage("");
    setPhotoFile(file);
  }

  const filteredMembers = members.filter((member) => {
    const searchText = search.trim().toLowerCase();

    return (
      member.name.toLowerCase().includes(searchText) ||
      (member.email?.toLowerCase().includes(searchText) ?? false) ||
      (member.phone?.toLowerCase().includes(searchText) ?? false) ||
      (member.role?.toLowerCase().includes(searchText) ?? false)
    );
  });

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
          Add and manage Starz Club members.
        </p>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-blue-900">
            {editingMemberId ? "Edit member" : "Add a member"}
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
                  setForm({
                    ...form,
                    name: event.target.value,
                  })
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
                  setForm({
                    ...form,
                    email: event.target.value,
                  })
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
                  setForm({
                    ...form,
                    phone: event.target.value,
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">
                Club responsibility
              </span>

              <select
                value={form.role}
                onChange={(event) =>
                  setForm({
                    ...form,
                    role: event.target.value,
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="Player">Player</option>
                <option value="Captain">Treasurer</option>
                <option value="Coach">Coach</option>
                <option value="Admin">Admin</option>
              </select>
            </label>

            <label className="sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">
                Member photo
              </span>

              <input
                key={photoInputKey}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) =>
                  handlePhotoSelection(
                    event.target.files?.[0] ?? null
                  )
                }
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />

              <p className="mt-2 text-xs text-slate-500">
                JPG, PNG, or WebP. Maximum size: 5 MB.
              </p>

              {photoFile && (
                <p className="mt-2 text-sm text-slate-600">
                  Selected: {photoFile.name}
                </p>
              )}

              {!photoFile && form.photo_url && (
                <div className="mt-3">
                  <p className="mb-2 text-sm text-slate-600">
                    Current photo:
                  </p>

                  <img
                    src={form.photo_url}
                    alt="Current member profile"
                    className="h-24 w-24 rounded-full object-cover"
                  />
                </div>
              )}
            </label>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-blue-900 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? editingMemberId
                    ? "Updating…"
                    : "Adding…"
                  : editingMemberId
                    ? "Update Member"
                    : "Add Member"}
              </button>

              {editingMemberId && (
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={submitting}
                  className="ml-3 rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 disabled:opacity-60"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {message && (
            <p className="mt-4 text-sm text-slate-700">
              {message}
            </p>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-slate-900">
            Current members
          </h2>

          <input
            type="search"
            placeholder="Search by name, email, phone, or role"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="mt-4 w-full max-w-md rounded-lg border border-slate-300 bg-white px-4 py-3"
          />

          {loading && (
            <p className="mt-4 text-slate-600">
              Loading members…
            </p>
          )}

          {!loading && members.length === 0 && (
            <p className="mt-4 text-slate-600">
              No members have been added yet.
            </p>
          )}

          {!loading &&
            members.length > 0 &&
            filteredMembers.length === 0 && (
              <p className="mt-5 text-slate-600">
                No members match your search.
              </p>
            )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMembers.map((member) => (
              <article
                key={member.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                {member.photo_url ? (
                  <img
                    src={member.photo_url}
                    alt={`${member.name} profile`}
                    className="mb-4 h-24 w-24 rounded-full object-cover"
                  />
                ) : (
                  <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-slate-200 text-4xl">
                    👤
                  </div>
                )}

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

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => startEditing(member)}
                    className="rounded-lg border border-blue-900 px-4 py-2 text-sm font-medium text-blue-900"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    disabled={deletingMemberId === member.id}
                    onClick={() => void deleteMember(member)}
                    className="rounded-lg border border-red-600 px-4 py-2 text-sm font-medium text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingMemberId === member.id
                      ? "Deleting…"
                      : "Delete"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
