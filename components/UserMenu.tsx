"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type UserProfile = {
  app_role: "Member" | "Captain" | "Treasurer" | "Admin";
  member_id: string | null;
  members:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
};

export default function UserMenu() {
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  async function loadCurrentUser() {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setProfile(null);
      setEmail("");
      setLoading(false);
      return;
    }

    setEmail(user.email ?? "");

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select(
        `
          app_role,
          member_id,
          members (
            name
          )
        `
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Unable to load user profile:", profileError);
      setProfile(null);
      setLoading(false);
      return;
    }

    setProfile(data as UserProfile | null);
    setLoading(false);
  }

  useEffect(() => {
    void loadCurrentUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED" ||
        event === "TOKEN_REFRESHED"
      ) {
        void loadCurrentUser();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    setSigningOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Unable to sign out:", error);
      setSigningOut(false);
      return;
    }

    setProfile(null);
    setEmail("");

    router.push("/auth");
    router.refresh();
  }

  function getMemberName() {
    if (!profile?.members) {
      return email || "Club member";
    }

    if (Array.isArray(profile.members)) {
      return profile.members[0]?.name ?? email ?? "Club member";
    }

    return profile.members.name;
  }

  if (loading) {
    return (
      <div className="text-sm text-slate-500">
        Checking account…
      </div>
    );
  }

  if (!profile && !email) {
    return (
      <Link
        href="/auth"
        className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
      >
        Sign In
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <div className="text-right">
        <p className="text-sm font-semibold text-slate-900">
          Welcome, {getMemberName()}
        </p>

        <p className="text-xs text-slate-500">
          {profile?.app_role ?? "Member"}
        </p>
      </div>

      <button
        type="button"
        disabled={signingOut}
        onClick={() => void handleSignOut()}
        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {signingOut ? "Signing out…" : "Sign Out"}
      </button>
    </div>
  );
}
