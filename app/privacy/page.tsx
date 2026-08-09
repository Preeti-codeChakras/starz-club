import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="text-blue-700 hover:underline"
        >
          ← Back to Home
        </Link>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-3xl font-bold text-blue-900">
            Privacy Policy
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Last updated: August 2026
          </p>

          <div className="mt-8 space-y-7 text-slate-700">
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                About Starz Club
              </h2>

              <p className="mt-2 leading-7">
                Starz Club uses this application to help
                manage club membership, teams, seasons,
                player availability, schedules, and other
                club activities.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                Information We Collect
              </h2>

              <p className="mt-2 leading-7">
                Depending on how you use the application,
                we may collect information such as your
                name, email address, phone number, profile
                photo, club role, team assignments, and
                cricket-related availability.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                How We Use Your Information
              </h2>

              <p className="mt-2 leading-7">
                Your information is used for Starz Club
                administration and activities, including
                managing membership, creating teams,
                planning seasons and schedules, and
                communicating about club activities.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                Who Can See Your Information
              </h2>

              <p className="mt-2 leading-7">
                Access to member information is limited
                based on the needs of the club. Club
                administrators may have additional access
                to information needed to manage members
                and the application.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                Service Providers
              </h2>

              <p className="mt-2 leading-7">
                Starz Club uses third-party technology
                providers to operate and host the
                application. These providers may process
                information as necessary to provide their
                services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                Sharing of Information
              </h2>

              <p className="mt-2 leading-7">
                Starz Club does not sell member personal
                information or use member information for
                third-party advertising.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                Data Security
              </h2>

              <p className="mt-2 leading-7">
                We take reasonable steps to protect member
                information and restrict access to the
                application and administrative functions.
                However, no online service can guarantee
                absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                Data Retention
              </h2>

              <p className="mt-2 leading-7">
                Member information is retained for as long
                as reasonably necessary for club
                administration, record keeping, and the
                purposes described in this policy.
                Information that is no longer needed may
                be removed.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                Your Choices
              </h2>

              <p className="mt-2 leading-7">
                Members may contact a Starz Club
                administrator to request correction or
                deletion of their personal information or
                account, subject to information the club
                may reasonably need to retain for
                legitimate administrative or record
                keeping purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                Changes to This Policy
              </h2>

              <p className="mt-2 leading-7">
                This Privacy Policy may be updated as the
                application and Starz Club&apos;s
                practices change. The updated date will
                be shown at the top of this page.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                Contact
              </h2>

              <p className="mt-2 leading-7">
                If you have questions about your
                information or would like to request a
                correction or deletion, please contact a
                Starz Club administrator.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
