"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type UserProfile = {
  app_role: "Member" | "Captain" | "Treasurer" | "Admin";
  member_id: string | null;

  members:
    | {
        name: string;
        photo_url: string | null;
      }
    | {
        name: string;
        photo_url: string | null;
      }[]
    | null;
};

export default function UserMenu() {
  const router = useRouter();

  const menuRef = useRef<HTMLDivElement | null>(null);

  const [profile, setProfile] =
    useState<UserProfile | null>(null);

  const [email, setEmail] =
    useState("");

  const [hasPlayerStats, setHasPlayerStats] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [signingOut, setSigningOut] =
    useState(false);

  const [menuOpen, setMenuOpen] =
    useState(false);

  async function loadCurrentUser() {
    setLoading(true);
    setHasPlayerStats(false);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setProfile(null);
      setEmail("");
      setHasPlayerStats(false);
      setLoading(false);
      return;
    }

    setEmail(user.email ?? "");

    const {
      data,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select(`
        app_role,
        member_id,
        members (
          name,
          photo_url
        )
      `)
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "Unable to load user profile:",
        profileError
      );

      setProfile(null);
      setLoading(false);
      return;
    }

    const currentProfile =
      data as UserProfile | null;

    setProfile(currentProfile);

    if (currentProfile?.member_id) {
      const {
        data: stats,
        error: statsError,
      } = await supabase
        .from("player_stats")
        .select("member_id")
        .eq(
          "member_id",
          currentProfile.member_id
        )
        .maybeSingle();

      if (statsError) {
        console.error(
          "Unable to check player stats:",
          statsError
        );
      } else {
        setHasPlayerStats(Boolean(stats));
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadCurrentUser();

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (event) => {
          if (
            event === "SIGNED_IN" ||
            event === "SIGNED_OUT" ||
            event === "USER_UPDATED" ||
            event === "TOKEN_REFRESHED"
          ) {
            void loadCurrentUser();
          }
        }
      );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent
    ) {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target as Node
        )
      ) {
        setMenuOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  async function handleSignOut() {
    setSigningOut(true);

    const { error } =
      await supabase.auth.signOut();

    if (error) {
      console.error(
        "Unable to sign out:",
        error
      );

      setSigningOut(false);
      return;
    }

    setProfile(null);
    setEmail("");
    setHasPlayerStats(false);
    setMenuOpen(false);

    router.push("/auth");
    router.refresh();
  }

  function getMember() {
    if (!profile?.members) {
      return null;
    }

    if (Array.isArray(profile.members)) {
      return profile.members[0] ?? null;
    }

    return profile.members;
  }

  function getMemberName() {
    const member = getMember();

    return (
      member?.name ||
      email ||
      "Club member"
    );
  }

  function getPhotoUrl() {
    return (
      getMember()?.photo_url ??
      null
    );
  }

  if (loading) {
    return (
      <div className="text-sm text-blue-100">
        Checking account…
      </div>
    );
  }

  if (!profile && !email) {
    return (
      <Link
        href="/auth"
        className="rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
      >
        Sign In
      </Link>
    );
  }

  return (
    <div
      ref={menuRef}
      className="relative"
    >
      {/* USER MENU BUTTON */}
      <button
        type="button"
        onClick={() =>
          setMenuOpen(
            (current) => !current
          )
        }
        aria-expanded={menuOpen}
        className="
          group
          flex
          items-center
          gap-3
          rounded-xl
          border
          border-white/20
          bg-white/10
          px-3
          py-2
          text-left
          transition-all
          duration-200

          hover:bg-white/15
          hover:shadow-md
        "
      >
        {/* AVATAR */}
        {getPhotoUrl() ? (
          <img
            src={getPhotoUrl()!}
            alt={`${getMemberName()} profile`}
            className="
              h-10
              w-10
              shrink-0
              rounded-lg
              border
              border-white/25
              object-cover
            "
          />
        ) : (
          <div
            className="
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-lg
              border
              border-white/20
              bg-white/10
              text-white
            "
          >
            <UserIcon />
          </div>
        )}

        {/* NAME + ROLE */}
        <div className="min-w-0">
          <p className="max-w-36 truncate text-sm font-semibold text-white">
            {getMemberName()}
          </p>

          <p className="text-xs text-blue-100">
            {profile?.app_role ?? "Member"}
          </p>
        </div>

        {/* CHEVRON */}
        <svg
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className={`ml-1 h-4 w-4 text-blue-100 transition-transform duration-200 ${
            menuOpen
              ? "rotate-180"
              : ""
          }`}
        >
          <path
            d="M5 7.5 10 12.5 15 7.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* DROPDOWN */}
      {menuOpen && (
        <div
          className="
            absolute
            right-0
            z-50
            mt-2
            w-64
            overflow-hidden
            rounded-xl
            border
            border-slate-200
            bg-white
            shadow-xl
          "
        >
          {/* PROFILE SUMMARY */}
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-900">
              {getMemberName()}
            </p>

            <p className="mt-0.5 truncate text-xs text-slate-500">
              {email}
            </p>
          </div>

          <div className="p-2">
            {/* MY PROFILE + STATS */}
            {profile?.member_id &&
            hasPlayerStats ? (
              <Link
                href={`/player-stats/${profile.member_id}`}
                onClick={() =>
                  setMenuOpen(false)
                }
                className="
                  group
                  flex
                  items-center
                  gap-3
                  rounded-lg
                  px-3
                  py-2.5
                  text-sm
                  font-medium
                  text-slate-700
                  transition

                  hover:bg-blue-50
                  hover:text-blue-900
                "
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <ChartIcon />
                </span>

                <span className="flex-1">
                  My Profile & Stats
                </span>

                <span className="text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-blue-700">
                  →
                </span>
              </Link>
            ) : (
              <div
                className="
                  flex
                  items-center
                  gap-3
                  rounded-lg
                  px-3
                  py-2.5
                  text-sm
                  text-slate-400
                "
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                  <ChartIcon />
                </span>

                <div>
                  <p className="font-medium">
                    My Profile & Stats
                  </p>

                  <p className="text-xs">
                    Stats not available yet
                  </p>
                </div>
              </div>
            )}

            {/* SIGN OUT */}
            <button
              type="button"
              disabled={signingOut}
              onClick={() =>
                void handleSignOut()
              }
              className="
                mt-1
                flex
                w-full
                items-center
                gap-3
                rounded-lg
                px-3
                py-2.5
                text-left
                text-sm
                font-medium
                text-slate-700
                transition

                hover:bg-red-50
                hover:text-red-700

                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <SignOutIcon />
              </span>

              {signingOut
                ? "Signing out…"
                : "Sign Out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />

      <path
        d="M4.5 20c.8-3.5 3.5-5.5 7.5-5.5s6.7 2 7.5 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M5 19V11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      <path
        d="M12 19V5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      <path
        d="M19 19V8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      <path
        d="M14 8l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M18 12H9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
