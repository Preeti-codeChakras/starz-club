import Link from "next/link";

export default function PhotosPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-blue-700 hover:underline">
          ← Back to Home
        </Link>

        <h1 className="mt-6 text-3xl font-bold text-blue-900">
          📸 Club Photos
        </h1>

        <p className="mt-3 text-slate-600">
          Starz Club photo albums will appear here.
        </p>
      </div>
    </main>
  );
}