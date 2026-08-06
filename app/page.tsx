import Link from "next/link";
import UserMenu from "@/components/UserMenu";
import ProfileCompletionWarning from "@/components/ProfileCompleteWarning";
import PendingApprovalsCard from "@/components/PendingApprovalsCard";

type MenuItem = {
  name: string;
  icon: string;
  description: string;
  href: string;
};

type MenuSection = {
  title: string;
  description: string;
  items: MenuItem[];
};

const menuSections: MenuSection[] = [
  {
    title: "Club",
    description:
      "Members, teams, and seasonal team assignments.",
    items: [
      {
        name: "Teams",
        icon: "🏏",
        description: "View teams and player rosters.",
        href: "/teams",
      },
      {
        name: "Members",
        icon: "👥",
        description: "View and manage club members.",
        href: "/members",
      },
      {
        name: "Team Assignments",
        icon: "🔄",
        description:
          "Assign players to teams for the active season.",
        href: "/assignments",
      },
    ],
  },
  {
    title: "Season",
    description:
      "Configure the season, schedule, and availability.",
    items: [
      {
        name: "Season Setup",
        icon: "⚙️",
        description:
          "Configure teams and weekend game dates.",
        href: "/season-setup",
      },
      {
        name: "Availability",
        icon: "✅",
        description:
          "Submit and review season availability.",
        href: "/availability",
      },
      {
        name: "Schedule",
        icon: "🗓️",
        description:
          "View practices, games, and locations.",
        href: "/schedule",
      },
      {
        name: "Team Generator",
        icon: "⚖️",
        description: "Create Fair Teams Using Skills and Availability.",
        href: "/team-generator",
      },
    ],
  },
  {
    title: "Club Management",
    description:
      "Manage finances, receipts, and club photos.",
    items: [
      {
        name: "Finance",
        icon: "💰",
        description:
          "Track income, expenses, and receipts.",
        href: "/finance",
      },
      {
        name: "Photos",
        icon: "📷",
        description:
          "View club photos and seasonal albums.",
        href: "/photos",
      },
    ],
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      {/* HEADER */}
      <header className="bg-gradient-to-r from-blue-950 via-blue-900 to-blue-700 text-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-8 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* CLUB BRAND */}
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-2xl shadow-sm backdrop-blur-sm sm:h-12 sm:w-12 sm:text-3xl">
                ⭐
              </div>

              <div>
                <h1 className="text-xl font-bold tracking-tight sm:text-3xl">
                  Starz Club
                </h1>

                <p className="mt-0.5 text-xs text-blue-100 sm:text-sm">
                  Cricket, community and connection
                </p>
              </div>
            </div>

            {/* USER INFORMATION */}
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm sm:bg-transparent sm:p-0">
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
        {/* PROFILE COMPLETION WARNING */}
        <ProfileCompletionWarning />
        <PendingApprovalsCard />
        <div className="space-y-10">
          {menuSections.map((section) => (
            <section key={section.title}>
              {/* SECTION HEADING */}
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                  {section.title}
                </h2>

                <p className="mt-1 text-sm leading-5 text-slate-600">
                  {section.description}
                </p>
              </div>

              {/* RESPONSIVE CARDS */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {section.items.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="
                      group
                      flex
                      min-h-36
                      flex-col
                      rounded-2xl
                      border
                      border-blue-100
                      bg-blue-50/70
                      p-5
                      shadow-sm
                      transition-all
                      duration-300
                      ease-out

                      hover:-translate-y-1
                      hover:border-blue-900
                      hover:bg-blue-900
                      hover:shadow-xl
                      hover:shadow-blue-200/70

                      focus:outline-none
                      focus:ring-2
                      focus:ring-blue-700
                      focus:ring-offset-2
                    "
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* ICON */}
                      <div
                        className="
                          flex
                          h-11
                          w-11
                          shrink-0
                          items-center
                          justify-center
                          rounded-xl
                          bg-white
                          text-2xl
                          shadow-sm
                          transition-all
                          duration-300

                          group-hover:scale-110
                          group-hover:bg-white/20
                        "
                      >
                        {item.icon}
                      </div>

                      {/* ARROW */}
                      <span
                        aria-hidden="true"
                        className="
                          text-xl
                          text-blue-300
                          transition-all
                          duration-300

                          group-hover:translate-x-1
                          group-hover:text-white
                        "
                      >
                        →
                      </span>
                    </div>

                    {/* CARD TITLE */}
                    <h3
                      className="
                        mt-4
                        text-lg
                        font-semibold
                        text-blue-950
                        transition-colors
                        duration-300

                        group-hover:text-white
                      "
                    >
                      {item.name}
                    </h3>

                    {/* CARD DESCRIPTION */}
                    <p
                      className="
                        mt-1
                        text-sm
                        leading-5
                        text-slate-600
                        transition-colors
                        duration-300

                        group-hover:text-blue-100
                      "
                    >
                      {item.description}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <footer className="mt-8 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 text-center text-xs text-slate-500 sm:px-10 sm:text-sm">
          © 2026 Starz Club ⭐
          A family surviving on countless cups of chai ☕ and love for cricket 🏏 
        </div>
      </footer>
      <div
  className="
    hidden
    xl:flex
    fixed
    right-6
    top-1/2
    -translate-y-1/2
    [writing-mode:vertical-rl]
    text-sm
    font-semibold
    tracking-[0.25em]
    text-slate-500
    opacity-80
    hover:text-blue-600
    hover:opacity-100
    transition-all
    duration-300
    select-none
  "
>
  Built with ❤️ by Preeti • Starz Club
</div>


    </main>
  );
}
