"use client";

import Link from "next/link";
import {
  ChangeEvent,
  useEffect,
  useState,
} from "react";

import { supabase } from "@/lib/supabase/client";
import AlertMessage from "@/components/AlertMessage";

type MemberProfile = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  birthday_month: number | null;
  birthday_day: number | null;
  bio: string | null;
};

type PlayerStats = {
  arcl_player_id: string;

  batting_matches: number | null;
  batting_runs: number | null;
  batting_average: number | null;
  batting_strike_rate: number | null;

  bowling_matches: number | null;
  bowling_wickets: number | null;
  bowling_average: number | null;
  bowling_economy: number | null;

  last_synced_at: string;
};

const monthOptions = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export default function MyProfilePage() {
  const [profile, setProfile] =
    useState<MemberProfile | null>(null);

  const [stats, setStats] =
    useState<PlayerStats | null>(null);

  const [phone, setPhone] =
    useState("");

  const [
    birthdayMonth,
    setBirthdayMonth,
  ] = useState("");

  const [
    birthdayDay,
    setBirthdayDay,
  ] = useState("");

  const [bio, setBio] =
    useState("");

  const [editing, setEditing] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [
    statsLoading,
    setStatsLoading,
  ] = useState(false);

  const [saving, setSaving] =
    useState(false);

  const [
    uploadingPhoto,
    setUploadingPhoto,
  ] = useState(false);

  const [message, setMessage] =
    useState("");

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
    void loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      setMessageType("error");
      setMessage(
        "You must be signed in to view your profile."
      );

      setLoading(false);
      return;
    }

    const {
      data,
      error,
    } =
      await supabase
        .from("members")
        .select(`
          id,
          name,
          email,
          phone,
          photo_url,
          birthday_month,
          birthday_day,
          bio
        `)
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();

    if (error) {
      setMessageType("error");
      setMessage(
        `Unable to load your profile: ${error.message}`
      );

      setLoading(false);
      return;
    }

    if (!data) {
      setMessageType("warning");
      setMessage(
        "Your member profile could not be found."
      );

      setLoading(false);
      return;
    }

    const member =
      data as MemberProfile;

    setProfile(member);

    setPhone(
      member.phone ?? ""
    );

    setBirthdayMonth(
      member.birthday_month
        ? String(
            member.birthday_month
          )
        : ""
    );

    setBirthdayDay(
      member.birthday_day
        ? String(
            member.birthday_day
          )
        : ""
    );

    setBio(
      member.bio ?? ""
    );

    setLoading(false);

    await loadPlayerStats(
      member.id
    );
  }

  async function loadPlayerStats(
    memberId: string
  ) {
    setStatsLoading(true);

    const {
      data,
      error,
    } =
      await supabase
        .from("player_stats")
        .select(`
          arcl_player_id,

          batting_matches,
          batting_runs,
          batting_average,
          batting_strike_rate,

          bowling_matches,
          bowling_wickets,
          bowling_average,
          bowling_economy,

          last_synced_at
        `)
        .eq(
          "member_id",
          memberId
        )
        .maybeSingle();

    if (error) {
      console.error(
        "Unable to load player stats:",
        error
      );

      setStats(null);
      setStatsLoading(false);
      return;
    }

    setStats(
      data as PlayerStats | null
    );

    setStatsLoading(false);
  }

  function startEditing() {
    if (!profile) {
      return;
    }

    setPhone(
      profile.phone ?? ""
    );

    setBirthdayMonth(
      profile.birthday_month
        ? String(
            profile.birthday_month
          )
        : ""
    );

    setBirthdayDay(
      profile.birthday_day
        ? String(
            profile.birthday_day
          )
        : ""
    );

    setBio(
      profile.bio ?? ""
    );

    setMessage("");
    setEditing(true);
  }

  function cancelEditing() {
    if (!profile) {
      return;
    }

    setPhone(
      profile.phone ?? ""
    );

    setBirthdayMonth(
      profile.birthday_month
        ? String(
            profile.birthday_month
          )
        : ""
    );

    setBirthdayDay(
      profile.birthday_day
        ? String(
            profile.birthday_day
          )
        : ""
    );

    setBio(
      profile.bio ?? ""
    );

    setMessage("");
    setEditing(false);
  }

  async function saveProfile() {
    if (!profile) {
      return;
    }

    setSaving(true);
    setMessage("");

    const month =
      birthdayMonth
        ? Number(
            birthdayMonth
          )
        : null;

    const day =
      birthdayDay
        ? Number(
            birthdayDay
          )
        : null;

    if (
      month !== null &&
      (
        month < 1 ||
        month > 12
      )
    ) {
      setMessageType("error");

      setMessage(
        "Please select a valid birthday month."
      );

      setSaving(false);
      return;
    }

    if (
      day !== null &&
      (
        day < 1 ||
        day > 31
      )
    ) {
      setMessageType("error");

      setMessage(
        "Please enter a valid birthday day."
      );

      setSaving(false);
      return;
    }

    if (
      (month && !day) ||
      (!month && day)
    ) {
      setMessageType("error");

      setMessage(
        "Please provide both birthday month and day, or leave both blank."
      );

      setSaving(false);
      return;
    }

    const { error } =
      await supabase
        .from("members")
        .update({
          phone:
            phone.trim() ||
            null,

          birthday_month:
            month,

          birthday_day:
            day,

          bio:
            bio.trim() ||
            null,
        })
        .eq(
          "id",
          profile.id
        );

    if (error) {
      setMessageType("error");

      setMessage(
        `Unable to update your profile: ${error.message}`
      );

      setSaving(false);
      return;
    }

    setEditing(false);
    setSaving(false);

    await loadProfile();

    setMessageType(
      "success"
    );

    setMessage(
      "Your profile was updated."
    );
  }

  async function uploadPhoto(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target
        .files?.[0];

    if (
      !file ||
      !profile
    ) {
      return;
    }

    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
      ].includes(
        file.type
      )
    ) {
      setMessageType(
        "error"
      );

      setMessage(
        "Please choose a JPG, PNG, or WebP image."
      );

      return;
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      setMessageType(
        "error"
      );

      setMessage(
        "Photo must be 5 MB or smaller."
      );

      return;
    }

    setUploadingPhoto(
      true
    );

    setMessage("");

    const fileExtension =
      file.name
        .split(".")
        .pop()
        ?.toLowerCase() ??
      "jpg";

    const filePath =
      `${profile.id}/${Date.now()}.${fileExtension}`;

    const {
      error:
        uploadError,
    } =
      await supabase.storage
        .from(
          "member-photo"
        )
        .upload(
          filePath,
          file,
          {
            upsert: true,
          }
        );

    if (uploadError) {
      setMessageType(
        "error"
      );

      setMessage(
        `Unable to upload photo: ${uploadError.message}`
      );

      setUploadingPhoto(
        false
      );

      return;
    }

    const {
      data:
        publicUrlData,
    } =
      supabase.storage
        .from(
          "member-photo"
        )
        .getPublicUrl(
          filePath
        );

    const photoUrl =
      publicUrlData
        .publicUrl;

    const {
      error:
        updateError,
    } =
      await supabase
        .from("members")
        .update({
          photo_url:
            photoUrl,
        })
        .eq(
          "id",
          profile.id
        );

    if (updateError) {
      setMessageType(
        "error"
      );

      setMessage(
        `Photo uploaded, but profile could not be updated: ${updateError.message}`
      );

      setUploadingPhoto(
        false
      );

      return;
    }

    setUploadingPhoto(
      false
    );

    await loadProfile();

    setMessageType(
      "success"
    );

    setMessage(
      "Profile photo updated."
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="text-blue-700 hover:underline"
        >
          ← Back to Home
        </Link>

        <header className="mt-6">
          <h1 className="text-3xl font-bold text-blue-900 sm:text-4xl">
            👤 My Profile & Stats
          </h1>

          <p className="mt-2 text-slate-600">
            View and update your club profile and see your cricket performance.
          </p>
        </header>

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

        {loading && (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
            Loading your
            profile…
          </div>
        )}

        {!loading &&
          profile && (
            <>
              {/* ======================================
                  PROFILE
              ====================================== */}

              <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="bg-gradient-to-r from-blue-50 via-white to-blue-50 p-6 sm:p-8">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    {profile.photo_url ? (
                      <img
                        src={
                          profile.photo_url
                        }
                        alt={`${profile.name} profile`}
                        className="h-24 w-24 rounded-full object-cover shadow-sm"
                      />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-100 text-4xl">
                        👤
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <h2 className="text-2xl font-bold text-blue-950">
                        {
                          profile.name
                        }
                      </h2>

                      {profile.email && (
                        <p className="mt-1 break-all text-sm text-slate-500">
                          {
                            profile.email
                          }
                        </p>
                      )}

                      <div className="mt-4">
                        <label className="inline-flex cursor-pointer items-center rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50">
                          {uploadingPhoto
                            ? "Uploading…"
                            : "📷 Change Photo"}

                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={
                              uploadingPhoto
                            }
                            onChange={
                              uploadPhoto
                            }
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {!editing && (
                      <button
                        type="button"
                        onClick={
                          startEditing
                        }
                        className="rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                      >
                        ✏️ Edit Profile
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-6 sm:p-8">
                  {!editing ? (
                    <div className="grid gap-6 sm:grid-cols-2">
                      <ProfileField
                        label="Phone"
                        value={
                          profile.phone ||
                          "Not provided"
                        }
                      />

                      <ProfileField
                        label="Birthday"
                        value={
                          formatBirthday(
                            profile.birthday_month,
                            profile.birthday_day
                          )
                        }
                      />

                      <div className="sm:col-span-2">
                        <ProfileField
                          label="About me"
                          value={
                            profile.bio ||
                            "No bio added yet."
                          }
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-5">
                      <label>
                        <span className="text-sm font-medium text-slate-700">
                          Phone
                        </span>

                        <input
                          type="tel"
                          value={
                            phone
                          }
                          onChange={(
                            event
                          ) =>
                            setPhone(
                              event
                                .target
                                .value
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3"
                        />
                      </label>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label>
                          <span className="text-sm font-medium text-slate-700">
                            Birthday month
                          </span>

                          <select
                            value={
                              birthdayMonth
                            }
                            onChange={(
                              event
                            ) =>
                              setBirthdayMonth(
                                event
                                  .target
                                  .value
                              )
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3"
                          >
                            <option value="">
                              Select month
                            </option>

                            {monthOptions.map(
                              (
                                month
                              ) => (
                                <option
                                  key={
                                    month.value
                                  }
                                  value={
                                    month.value
                                  }
                                >
                                  {
                                    month.label
                                  }
                                </option>
                              )
                            )}
                          </select>
                        </label>

                        <label>
                          <span className="text-sm font-medium text-slate-700">
                            Birthday day
                          </span>

                          <input
                            type="number"
                            min={
                              1
                            }
                            max={
                              31
                            }
                            value={
                              birthdayDay
                            }
                            onChange={(
                              event
                            ) =>
                              setBirthdayDay(
                                event
                                  .target
                                  .value
                              )
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3"
                          />
                        </label>
                      </div>

                      <label>
                        <span className="text-sm font-medium text-slate-700">
                          About me
                        </span>

                        <textarea
                          rows={
                            5
                          }
                          maxLength={
                            500
                          }
                          value={
                            bio
                          }
                          onChange={(
                            event
                          ) =>
                            setBio(
                              event
                                .target
                                .value
                            )
                          }
                          placeholder="Tell the club a little about yourself..."
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3"
                        />

                        <p className="mt-1 text-xs text-slate-500">
                          {
                            bio.length
                          }
                          /500
                          characters
                        </p>
                      </label>

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          disabled={
                            saving
                          }
                          onClick={
                            saveProfile
                          }
                          className="rounded-lg bg-blue-900 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                        >
                          {saving
                            ? "Saving…"
                            : "Save Changes"}
                        </button>

                        <button
                          type="button"
                          disabled={
                            saving
                          }
                          onClick={
                            cancelEditing
                          }
                          className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* ======================================
                  CRICKET STATS
              ====================================== */}

              <section className="mt-8">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-blue-950">
                      📊 My Cricket
                      Stats
                    </h2>

                    <p className="mt-1 text-sm text-slate-600">
                      Batting and
                      bowling statistics
                      synced from ARCL.
                    </p>
                  </div>

                  {stats && (
                    <Link
                      href={`/player-stats/${profile.id}`}
                      className="text-sm font-semibold text-blue-700 hover:underline"
                    >
                      View Full
                      Stats →
                    </Link>
                  )}
                </div>

                {statsLoading && (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
                    Loading your
                    cricket stats…
                  </div>
                )}

                {!statsLoading &&
                  !stats && (
                    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
                      <div className="text-4xl">
                        🏏
                      </div>

                      <h3 className="mt-3 text-lg font-semibold text-slate-900">
                        No cricket
                        statistics yet
                      </h3>

                      <p className="mt-2 text-sm text-slate-600">
                        Your ARCL
                        statistics will
                        appear here after
                        your player
                        profile is linked
                        and synced.
                      </p>
                    </div>
                  )}

                {!statsLoading &&
                  stats && (
                    <>
                      <div className="mt-5 grid gap-5 md:grid-cols-2">
                        {/* BATTING */}

                        <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">
                              🏏
                            </span>

                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                                Batting
                              </p>

                              <h3 className="text-xl font-bold text-blue-950">
                                {
                                  displayNumber(
                                    stats.batting_runs
                                  )
                                }{" "}
                                Runs
                              </h3>
                            </div>
                          </div>

                          <div className="mt-5 grid grid-cols-3 gap-3">
                            <StatBox
                              label="Matches"
                              value={
                                displayNumber(
                                  stats.batting_matches
                                )
                              }
                            />

                            <StatBox
                              label="Average"
                              value={
                                displayNumber(
                                  stats.batting_average,
                                  2
                                )
                              }
                            />

                            <StatBox
                              label="Strike Rate"
                              value={
                                displayNumber(
                                  stats.batting_strike_rate,
                                  2
                                )
                              }
                            />
                          </div>
                        </article>

                        {/* BOWLING */}

                        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">
                              🎯
                            </span>

                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                                Bowling
                              </p>

                              <h3 className="text-xl font-bold text-slate-900">
                                {
                                  displayNumber(
                                    stats.bowling_wickets
                                  )
                                }{" "}
                                Wickets
                              </h3>
                            </div>
                          </div>

                          <div className="mt-5 grid grid-cols-3 gap-3">
                            <StatBox
                              label="Matches"
                              value={
                                displayNumber(
                                  stats.bowling_matches
                                )
                              }
                            />

                            <StatBox
                              label="Average"
                              value={
                                displayNumber(
                                  stats.bowling_average,
                                  2
                                )
                              }
                            />

                            <StatBox
                              label="Economy"
                              value={
                                displayNumber(
                                  stats.bowling_economy,
                                  2
                                )
                              }
                            />
                          </div>
                        </article>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm shadow-sm">
                        <span className="text-slate-500">
                          ARCL Player #
                          {
                            stats.arcl_player_id
                          }
                        </span>

                        <span className="text-slate-500">
                          Last synced:{" "}
                          <span className="font-medium text-slate-700">
                            {
                              formatLastSynced(
                                stats.last_synced_at
                              )
                            }
                          </span>
                        </span>
                      </div>
                    </>
                  )}
              </section>
            </>
          )}
      </div>
    </main>
  );
}

function ProfileField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 whitespace-pre-wrap text-slate-900">
        {value}
      </p>
    </div>
  );
}

function StatBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-lg font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function displayNumber(
  value: number | null,
  decimals?: number
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  if (
    decimals !== undefined
  ) {
    return Number(
      value
    ).toFixed(
      decimals
    );
  }

  return String(
    value
  );
}

function formatLastSynced(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(
    new Date(
      value
    )
  );
}

function formatBirthday(
  month: number | null,
  day: number | null
) {
  if (
    !month ||
    !day
  ) {
    return "Not provided";
  }

  const monthName =
    monthOptions.find(
      (option) =>
        option.value ===
        month
    )?.label;

  if (!monthName) {
    return "Not provided";
  }

  return `${monthName} ${day}`;
}
