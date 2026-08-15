import { Suspense } from "react";
import KitPageClient from "./KitPageClient";

export default function KitPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
          <div className="mx-auto max-w-5xl">
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
              Loading Kit Management….
            </div>
          </div>
        </main>
      }
    >
      <KitPageClient />
    </Suspense>
  );
}
