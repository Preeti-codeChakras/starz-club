"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { uploadMemberPhoto } from "@/lib/supabase/storage";
import AlertMessage from "@/components/AlertMessage";

type AppRole =
  | "Member"
  | "Captain"
  | "Treasurer"
  | "Admin";

type Member = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: AppRole;
  photo_url: string | null;
  birthday_month: number | null;
  birthday_day: number | null;
  arcl_player_id: string | null;
  hasLinkedProfile: boolean;
};

type MemberRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  photo_url: string | null;
  birthday_month: number | null;
  birthday_day: number | null;
  arcl_player_id: string | null;
  app_role: string | null;
  has_linked_profile: boolean;
};

type MemberForm = {
  name: string;
  email: string;
  phone: string;
  role: AppRole;
  photo_url: string;
  birthday_month: string;
  birthday_day: string;
  arcl_profile: string;
};

const initialForm: MemberForm = {
  name: "",
  email: "",
  phone: "",
  role: "Member",
  photo_url: "",
  birthday_month: "",
  birthday_day: "",
  arcl_profile: "",
};

const inputClassName =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 placeholder:opacity-100 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200";

const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

function normalizeRole(
  role: string | null | undefined
): AppRole {
  if (
    role === "Member" ||
    role === "Captain" ||
    role === "Treasurer" ||
    role === "Admin"
  ) {
    return role;
  }

  // Backward compatibility for older member rows.
  if (role === "Player" || role === "Coach") {
    return "Member";
  }

  return "Member";
}

function getMaximumBirthdayDay(month: string) {
  const numericMonth = Number(month);

  if (numericMonth === 2) {
    return 29;
  }

  if ([4, 6, 9, 11].includes(numericMonth)) {
    return 30;
  }

  return 31;
}

function formatBirthday(
  month: number | null,
  day: number | null
) {
  if (!month || !day) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(
    new Date(Date.UTC(2024, month - 1, day))
  );
}

function extractArclPlayerId(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);

    if (
      url.hostname !== "www.arcl.org" &&
      url.hostname !== "arcl.org"
    ) {
      return null;
    }

    const playerId = url.searchParams.get("player_id");

    return playerId && /^\d+$/.test(playerId)
      ? playerId
      : null;
  } catch {
    return null;
  }
}

export default function MembersPage() {
  const [messageType, setMessageType] = useState<
    "success" | "error" | "warning" | "info"
  >("info");

  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] =
    useState<MemberForm>(initialForm);

  const [editingMemberId, setEditingMemberId] =
    useState<string | null>(null);

  const [
    editingMemberHasLinkedProfile,
    setEditingMemberHasLinkedProfile,
  ] = useState(false);

  const [photoFile, setPhotoFile] =
    useState<File | null>(null);

  const [photoInputKey, setPhotoInputKey] =
    useState(0);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] =
    useState(false);

  const [deletingMemberId, setDeletingMemberId] =
    useState<string | null>(null);

  const [message, setMessage] = useState("");

  async function loadMembers() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.rpc(
      "get_members_with_login_roles"
    );

    if (error) {
      setMessageType("error");
      setMessage(
        `Unable to load members: ${error.message}`
      );
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as MemberRow[];

    const loadedMembers: Member[] = rows.map(
      (member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        phone: member.phone,

        role: normalizeRole(
          member.app_role ?? member.role
        ),

        photo_url: member.photo_url,
        birthday_month: member.birthday_month,
        birthday_day: member.birthday_day,
        arcl_player_id: member.arcl_player_id,

        hasLinkedProfile:
          member.has_linked_profile,
      })
    );

    setMembers(loadedMembers);
    setLoading(false);
  }

  useEffect(() => {
    void loadMembers();
  }, []);

  function resetForm() {
    setEditingMemberId(null);
    setEditingMemberHasLinkedProfile(false);
    setForm(initialForm);
    setPhotoFile(null);

    setPhotoInputKey(
      (current) => current + 1
    );
  }

  function startEditing(member: Member) {
    setEditingMemberId(member.id);

    setEditingMemberHasLinkedProfile(
      member.hasLinkedProfile
    );

    setForm({
      name: member.name,
      email: member.email ?? "",
      phone: member.phone ?? "",
      role: member.role,
      photo_url: member.photo_url ?? "",
      birthday_month:
        member.birthday_month?.toString() ?? "",
      birthday_day:
        member.birthday_day?.toString() ?? "",
      arcl_profile: member.arcl_player_id
        ? `https://www.arcl.org/Pages/UI/PlayerHistory.aspx?player_id=${member.arcl_player_id}`
        : "",
    });

    setPhotoFile(null);

    setPhotoInputKey(
      (current) => current + 1
    );

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

  function changeBirthdayMonth(month: string) {
    const maximumDay =
      getMaximumBirthdayDay(month);

    const currentDay = Number(
      form.birthday_day
    );

    setForm({
      ...form,
      birthday_month: month,
      birthday_day:
        currentDay > maximumDay
          ? ""
          : form.birthday_day,
    });
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");

    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const arclProfile = form.arcl_profile.trim();
    const arclPlayerId = arclProfile
      ? extractArclPlayerId(arclProfile)
      : null;

    if (!name) {
      setMessageType("error");
      setMessage("Member name is required.");
      return;
    }

    if (arclProfile && !arclPlayerId) {
      setMessageType("error");
      setMessage(
        "Enter a valid ARCL player ID or ARCL Player History URL."
      );
      return;
    }

    const birthdayMonth = form.birthday_month
      ? Number(form.birthday_month)
      : null;

    const birthdayDay = form.birthday_day
      ? Number(form.birthday_day)
      : null;

    if (
      (birthdayMonth && !birthdayDay) ||
      (!birthdayMonth && birthdayDay)
    ) {
      setMessageType("error");
      setMessage(
        "Please select both birthday month and day, or leave both blank."
      );
      return;
    }

    setSubmitting(true);

    let photoUrl = form.photo_url;

    try {
      if (photoFile) {
        photoUrl =
          await uploadMemberPhoto(photoFile);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown upload error";

      setMessageType("error");
      setMessage(
        `Unable to upload photo: ${errorMessage}`
      );

      setSubmitting(false);
      return;
    }

    const memberData = {
      name,
      email: email || null,
      phone: phone || null,
      role: form.role,
      photo_url: photoUrl || null,
      birthday_month: birthdayMonth,
      birthday_day: birthdayDay,
      arcl_player_id: arclPlayerId,
    };

    if (editingMemberId) {
      const { error: updateError } =
        await supabase.rpc(
          "update_member_and_role",
          {
            p_member_id: editingMemberId,
            p_name: name,
            p_email: email,
            p_phone: phone,
            p_role: form.role,
            p_photo_url: photoUrl,
            p_birthday_month:
              birthdayMonth,
            p_birthday_day:
              birthdayDay,
          }
        );

      if (updateError) {
        setMessageType("error");
        setMessage(
          `Unable to update member: ${updateError.message}`
        );
        setSubmitting(false);
        return;
      }

      const { error: arclUpdateError } = await supabase
        .from("members")
        .update({ arcl_player_id: arclPlayerId })
        .eq("id", editingMemberId);

      if (arclUpdateError) {
        setMessageType("error");
        setMessage(
          `Member updated, but ARCL profile could not be saved: ${arclUpdateError.message}`
        );
        setSubmitting(false);
        return;
      }

      resetForm();
      await loadMembers();

      setMessageType("success");
      setMessage(
        "Member details, birthday, app role, and ARCL profile updated successfully."
      );

      setSubmitting(false);
      return;
    }

    const { error: insertError } =
      await supabase
        .from("members")
        .insert(memberData);

    if (insertError) {
      setMessageType("error");
      setMessage(
        `Unable to add member: ${insertError.message}`
      );
      setSubmitting(false);
      return;
    }

    resetForm();

    await loadMembers();

    setMessageType("success");
    setMessage(
      "Member added successfully."
    );

    setSubmitting(false);
  }

  async function deleteMember(
    member: Member
  ) {
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
      setMessageType("error");
      setMessage(
        `Unable to delete member: ${error.message}`
      );
      setDeletingMemberId(null);
      return;
    }

    if (editingMemberId === member.id) {
      resetForm();
    }

    setMessageType("success");
    setMessage(
      "Member deleted successfully."
    );

    await loadMembers();

    setDeletingMemberId(null);
  }

  function handlePhotoSelection(
    file: File | null
  ) {
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
      setMessageType("error");
      setMessage(
        "Please select a JPG, PNG, or WebP image."
      );
      setPhotoFile(null);

      setPhotoInputKey(
        (current) => current + 1
      );

      return;
    }

    const maximumFileSize =
      5 * 1024 * 1024;

    if (file.size > maximumFileSize) {
      setMessageType("error");
      setMessage(
        "The member photo must be smaller than 5 MB."
      );
      setPhotoFile(null);

      setPhotoInputKey(
        (current) => current + 1
      );

      return;
    }

    setMessage("");
    setPhotoFile(file);
  }

  const filteredMembers =
    members.filter((member) => {
      const searchText =
        search.trim().toLowerCase();

      const birthdayText =
        formatBirthday(
          member.birthday_month,
          member.birthday_day
        )?.toLowerCase() ?? "";

      return (
        member.name
          .toLowerCase()
          .includes(searchText) ||
        (member.email
          ?.toLowerCase()
          .includes(searchText) ??
          false) ||
        (member.phone
          ?.toLowerCase()
          .includes(searchText) ??
          false) ||
        member.role
          .toLowerCase()
          .includes(searchText) ||
        (member.arcl_player_id
          ?.toLowerCase()
          .includes(searchText) ?? false) ||
        birthdayText.includes(searchText)
      );
    });

  const maximumBirthdayDay =
    getMaximumBirthdayDay(
      form.birthday_month
    );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="text-blue-700 hover:underline"
        >
          ← Back to Home
        </Link>

        <h1 className="mt-6 text-3xl font-bold text-blue-900">
          👥 Starz Club Members
        </h1>

        <p className="mt-3 text-slate-600">
          Add members, manage their club role,
          birthdays, and linked login permissions.
        </p>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold text-blue-900">
            {editingMemberId
              ? "Edit member"
              : "Add a member"}
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
                className={inputClassName}
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
                className={inputClassName}
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
                className={inputClassName}
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">
                Club role
              </span>

              <select
                value={form.role}
                onChange={(event) =>
                  setForm({
                    ...form,
                    role:
                      event.target
                        .value as AppRole,
                  })
                }
                className={inputClassName}
              >
                <option value="Member">
                  Member
                </option>

                <option value="Captain">
                  Captain
                </option>

                <option value="Treasurer">
                  Treasurer
                </option>

                <option value="Admin">
                  Admin
                </option>
              </select>

              <p className="mt-1 text-xs text-slate-500">
                {editingMemberId &&
                editingMemberHasLinkedProfile
                  ? "This also updates the linked login's app permissions."
                  : "The role is saved on the member record and can synchronize to app permissions after the login is linked."}
              </p>
            </label>

            <div className="sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">
                Birthday
              </span>

              <div className="mt-1 grid grid-cols-2 gap-3">
                <label>
                  <span className="sr-only">
                    Birthday month
                  </span>

                  <select
                    value={
                      form.birthday_month
                    }
                    onChange={(event) =>
                      changeBirthdayMonth(
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="">
                      Month
                    </option>

                    {MONTHS.map((month) => (
                      <option
                        key={month.value}
                        value={month.value}
                      >
                        {month.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="sr-only">
                    Birthday day
                  </span>

                  <select
                    value={form.birthday_day}
                    disabled={
                      !form.birthday_month
                    }
                    onChange={(event) =>
                      setForm({
                        ...form,
                        birthday_day:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="">
                      Day
                    </option>

                    {Array.from(
                      {
                        length:
                          maximumBirthdayDay,
                      },
                      (_, index) =>
                        index + 1
                    ).map((day) => (
                      <option
                        key={day}
                        value={day}
                      >
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Optional. Only month and day are
                stored — not the birth year.
              </p>
            </div>

            <label className="sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">
                ARCL Player Profile
              </span>

              <input
                type="text"
                placeholder="Paste ARCL profile URL or player ID"
                value={form.arcl_profile}
                onChange={(event) =>
                  setForm({
                    ...form,
                    arcl_profile: event.target.value,
                  })
                }
                className={inputClassName}
              />

              <p className="mt-2 text-xs text-slate-500">
                Optional. Paste the full ARCL Player History URL or just the player ID.
              </p>
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
                    event.target.files?.[0] ??
                      null
                  )
                }
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-medium file:text-blue-900"
              />

              <p className="mt-2 text-xs text-slate-500">
                JPG, PNG, or WebP. Maximum
                size: 5 MB.
              </p>

              {photoFile && (
                <p className="mt-2 text-sm text-slate-600">
                  Selected: {photoFile.name}
                </p>
              )}

              {!photoFile &&
                form.photo_url && (
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

            <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-blue-900 px-5 py-3 font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {message && (
            <AlertMessage
              type={messageType}
              message={message}
            />
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-slate-900">
            Current members
          </h2>

          <input
            type="search"
            placeholder="Search by name, email, phone, role, birthday, or ARCL ID"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            className="mt-4 w-full max-w-md rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 placeholder:opacity-100 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />

          {loading && (
            <p className="mt-4 text-slate-600">
              Loading members…
            </p>
          )}

          {!loading &&
            members.length === 0 && (
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
            {filteredMembers.map(
              (member) => {
                const birthday =
                  formatBirthday(
                    member.birthday_month,
                    member.birthday_day
                  );

                return (
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

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          member.role === "Admin"
                            ? "bg-blue-100 text-blue-900"
                            : member.role ===
                                "Treasurer"
                              ? "bg-green-100 text-green-900"
                              : member.role ===
                                  "Captain"
                                ? "bg-amber-100 text-amber-900"
                                : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {member.role}
                      </span>

                      {!member.hasLinkedProfile && (
                        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                          Login not linked
                        </span>
                      )}
                    </div>

                    {birthday && (
                      <p className="mt-3 text-sm font-medium text-pink-700">
                        🎂 {birthday}
                      </p>
                    )}

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

                    {member.arcl_player_id && (
                      <a
                        href={`https://www.arcl.org/Pages/UI/PlayerHistory.aspx?player_id=${member.arcl_player_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-sm font-medium text-blue-700 hover:underline"
                      >
                        ARCL Profile #{member.arcl_player_id} →
                      </a>
                    )}

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          startEditing(member)
                        }
                        className="rounded-lg border border-blue-900 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-50"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        disabled={
                          deletingMemberId ===
                          member.id
                        }
                        onClick={() =>
                          void deleteMember(
                            member
                          )
                        }
                        className="rounded-lg border border-red-600 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingMemberId ===
                        member.id
                          ? "Deleting…"
                          : "Delete"}
                      </button>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        </section>
      </div>
    </main>
  );
}


