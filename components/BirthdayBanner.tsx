"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type BirthdayMember = {
  id: string;
  name: string;
  birthday_month: number | null;
  birthday_day: number | null;
};

function getDaysUntilBirthday(
  month: number,
  day: number
) {
  const now = new Date();

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  let birthday = new Date(
    now.getFullYear(),
    month - 1,
    day
  );

  if (birthday < today) {
    birthday = new Date(
      now.getFullYear() + 1,
      month - 1,
      day
    );
  }

  const diff =
    birthday.getTime() - today.getTime();

  return Math.round(
    diff / (1000 * 60 * 60 * 24)
  );
}

export default function BirthdayBanner() {
  const [upcoming, setUpcoming] =
    useState<BirthdayMember[]>([]);

  useEffect(() => {
    async function loadBirthdays() {
      const { data, error } = await supabase
        .from("members")
        .select(
          "id, name, birthday_month, birthday_day"
        )
        .not("birthday_month", "is", null)
        .not("birthday_day", "is", null);

      if (error) {
        console.error(
          "Unable to load birthdays:",
          error
        );
        return;
      }

      const upcomingBirthdays =
        (data ?? []).filter((member) => {
          if (
            !member.birthday_month ||
            !member.birthday_day
          ) {
            return false;
          }

          const days =
            getDaysUntilBirthday(
              member.birthday_month,
              member.birthday_day
            );

          return days >= 0 && days <= 3;
        });

      setUpcoming(upcomingBirthdays);
    }

    void loadBirthdays();
  }, []);

  if (upcoming.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 rounded-xl border border-pink-200 bg-pink-50 p-4 shadow-sm">
      <p className="font-semibold text-pink-900">
        🎂 Upcoming Birthday
      </p>

      <div className="mt-2 space-y-1">
        {upcoming.map((member) => {
          const days =
            getDaysUntilBirthday(
              member.birthday_month!,
              member.birthday_day!
            );

          return (
            <p
              key={member.id}
              className="text-sm text-pink-800"
            >
              {days === 0
                ? `🎉 Happy Birthday ${member.name}!`
                : `${member.name}'s birthday is in ${days} day${
                    days === 1 ? "" : "s"
                  } 🎈`}
            </p>
          );
        })}
      </div>
    </div>
  );
}
