"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function HomeButton() {
  const pathname = usePathname();

  if (pathname === "/") {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
      <Link
        href="/"
        aria-label="Go to home"
        className="flex items-center gap-2 rounded-full bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-800"
      >
        🏠
        <span className="hidden sm:inline">
          Home
        </span>
      </Link>
    </div>
  );
}
