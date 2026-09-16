"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Club = {
  name: string;
  logo_url: string | null;
};

export default function CurrentClubBrand() {
  const [club, setClub] = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadClub() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("club_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile?.club_id) {
        console.error(
          "Unable to load club from profile:",
          profileError
        );

        setLoading(false);
        return;
      }

      const {
        data: clubData,
        error: clubError,
      } = await supabase
        .from("clubs")
        .select("name, logo_url")
        .eq("id", profile.club_id)
        .maybeSingle();

      if (clubError) {
        console.error(
          "Unable to load club:",
          clubError
        );

        setLoading(false);
        return;
      }

      setClub(clubData);
      setLoading(false);
    }

    void loadClub();
  }, []);

  return (
    <div className="flex items-center gap-3">
      <div
        className="
          flex
          h-11
          w-11
          shrink-0
          items-center
          justify-center
          overflow-hidden
          rounded-xl
          bg-white/10
          text-2xl
          shadow-sm
          backdrop-blur-sm
          sm:h-12
          sm:w-12
          sm:text-3xl
        "
      >
        {club?.logo_url ? (
          <img
            src={club.logo_url}
            alt={`${club.name} logo`}
            className="h-full w-full object-cover"
          />
        ) : (
          "🏏"
        )}
      </div>

      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-3xl">
          {loading
            ? "Cricket Club"
            : club?.name ?? "Cricket Club"}
        </h1>

        <p className="mt-0.5 text-xs text-blue-100 sm:text-sm">
          Cricket, community and connection
        </p>
      </div>
    </div>
  );
}
