import { Suspense } from "react";
import AuthPageClient from "./AuthPageClient";

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
          <div className="mx-auto max-w-md">
            <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
              <div className="text-4xl">
                🏏
              </div>

              <p className="mt-4 text-slate-600">
                Loading…
              </p>
            </section>
          </div>
        </main>
      }
    >
      <AuthPageClient />
    </Suspense>
  );
}
