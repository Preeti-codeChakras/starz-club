import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="text-blue-700 hover:underline"
        >
          ← Back to Home
        </Link>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-center">
            <div className="text-5xl">🏏⭐</div>

            <h1 className="mt-4 text-3xl font-bold text-blue-900 sm:text-4xl">
              About Starz Club
            </h1>

            <p className="mt-3 text-slate-600">
              Cricket, community and connection.
            </p>
          </div>

          <div className="mt-8 space-y-7 text-slate-700">
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                Who We Are
              </h2>

              <p className="mt-2 leading-7">
                Starz Club is a community-focused cricket
                club built around our shared love for the
                game, teamwork, friendship, and creating
                an inclusive environment where everyone
                can enjoy cricket together.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                What Matters to Us
              </h2>

              <p className="mt-2 leading-7">
                We believe cricket is more than matches
                and results. We value fairness, respect,
                inclusion, team spirit, and giving every
                player the opportunity to participate,
                improve, and feel part of the club.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                Our Community
              </h2>

              <p className="mt-2 leading-7">
                Through games, seasonal leagues,
                celebrations, and social gatherings, we
                aim to build friendships and a strong
                sense of community both on and off the
                cricket field.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                This App
              </h2>

              <p className="mt-2 leading-7">
                The Starz Club app helps us manage
                members, teams, player availability,
                schedules, seasons, and other club
                activities in one place.
              </p>
            </section>

            <section className="rounded-xl bg-blue-50 p-5">
              <p className="text-center font-medium text-blue-900">
                Built with ❤️, countless cups of chai ☕,
                and love for cricket 🏏
              </p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
