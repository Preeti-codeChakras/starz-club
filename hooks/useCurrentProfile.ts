"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type AppRole =
  | "Member"
  | "Captain"
  | "Treasurer"
  | "Admin";

type MemberRelation = {
  name: string;
  approval_status: "Pending" | "Active" | "Rejected";
};

type ProfileQueryResult = {
  member_id: string | null;
  app_role: AppRole;
  members: MemberRelation | MemberRelation[] | null;
};

type CurrentProfile = {
  userId: string;
  email: string;
  memberId: string | null;
  memberName: string | null;
  appRole: AppRole;
  approvalStatus: "Pending" | "Active" | "Rejected" | null;
  isProfileComplete: boolean;
};

export function useCurrentProfile() {
  const [profile, setProfile] =
    useState<CurrentProfile | null>(null);

  const [loadingProfile, setLoadingProfile] =
    useState(true);

  async function loadProfile() {
    setLoadingProfile(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setProfile(null);
      setLoadingProfile(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(
        `
          member_id,
          app_role,
          members (
            name,
            approval_status
          )
        `
      )
      .eq("id", user.id)
      .maybeSingle();

if (error) {
  console.error(
    "Unable to load profile:",
    error
  );
  setProfile(null);
  setLoadingProfile(false);
  return;
}

if (!data) {
  setProfile(null);
  setLoadingProfile(false);
  return;
}


    const typedData =
      data as unknown as ProfileQueryResult;

    const memberRelation = typedData.members;

    let memberName: string | null = null;
    let approvalStatus:
      | "Pending"
      | "Active"
      | "Rejected"
      | null = null;

    if (Array.isArray(memberRelation)) {
      memberName =
        memberRelation[0]?.name ?? null;

      approvalStatus =
        memberRelation[0]?.approval_status ?? null;
    } else if (memberRelation) {
      memberName = memberRelation.name;
      approvalStatus =
        memberRelation.approval_status;
    }

    setProfile({
      userId: user.id,
      email: user.email ?? "",
      memberId: typedData.member_id,
      memberName,
      appRole: typedData.app_role,
      approvalStatus,
      isProfileComplete:
        Boolean(typedData.member_id) &&
        Boolean(memberName),
    });

    setLoadingProfile(false);
  }

  useEffect(() => {
    void loadProfile();

  const {
  data: { subscription },
} = supabase.auth.onAuthStateChange(
  (event) => {
    if (event === "SIGNED_OUT") {
      setProfile(null);
      setLoadingProfile(false);
      return;
    }

    // Run outside the auth callback to avoid Supabase deadlock
    setTimeout(() => {
      void loadProfile();
    }, 0);
  }
);

return () => {
  subscription.unsubscribe();
};

  }, []);

  return {
    profile,
    loadingProfile,
    reloadProfile: loadProfile,
  };
}
