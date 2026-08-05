  import Link from "next/link";
  import UserMenu from "@/components/UserMenu";


  const menuItems = [
    {
      name: "Teams",
      icon: "🏏",
      description: "View Starz Club teams and members",
      href: "/teams",
    },
    {
    name: "Members",
    icon: "👥",
    description: "View and manage club members",
    href: "/members",
  },

  {
    name: "Team Assignments",
    icon: "🔄",
    description: "Assign members to teams for the active season",
    href: "/assignments",
  },
    {
      name: "Practice Schedule",
      icon: "📅",
      description: "View upcoming practices and locations",
      href: "/schedule",
    },
    {
      name: "Availability",
      icon: "✅",
      description: "Submit your availability for club events",
      href: "/availability",
    },
    {
    name: "Finance",
    icon: "💰",
    description: "Club income, expenses and receipts",
    href: "/finance",
  },
    {
      name: "Photos",
      icon: "📸",
      description: "View club photos and albums",
      href: "/photos",
    },
    {
  name: "Season Setup",
  icon: "⚙️",
  description: "Configure season teams and weekend game dates",
  href: "/season-setup",
},

  ];

  export default function Home() {
    return (
      <main className="min-h-screen bg-slate-50">
        <header className="bg-blue-900 px-6 py-8 text-white">
          <div className="mx-auto max-w-5xl">
            <div className="flex justify-end">
              <UserMenu />
            </div>
            <h1 className="text-4xl font-bold">⭐ Starz Club</h1>
            <p className="mt-2 text-blue-100">
              Cricket, community and connection
            </p>
          </div>
        </header>

        <section className="mx-auto max-w-5xl px-6 py-10">
          <h2 className="text-2xl font-semibold text-slate-900">
            Welcome to Starz Club
          </h2>

          <p className="mt-2 text-slate-600">
            Manage teams, practices, availability and club photos.
          </p>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {menuItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="text-3xl">{item.icon}</div>

                <h3 className="mt-4 text-xl font-semibold text-blue-900">
                  {item.name}
                </h3>

                <p className="mt-2 text-slate-600">{item.description}</p>
              </Link>
            ))}
          </div>

          <p className="mt-10 text-center text-sm text-slate-500">
            Built with ❤️ for cricket and our club by Preeti
          </p>
        </section>
      </main>
    );
  }