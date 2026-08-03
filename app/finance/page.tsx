import Link from "next/link";

export default function FinancePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="text-blue-700 hover:underline">
          ← Back to Home
        </Link>

        <h1 className="mt-6 text-3xl font-bold text-blue-900">
          💰 Club Finances
        </h1>

        <p className="mt-3 text-slate-600">
          Track club income, expenses, and receipts.
        </p>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          Finance dashboard coming next.
        </div>
      </div>
    </main>
  );
}