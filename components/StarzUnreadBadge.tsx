"use client";
export default function StarzUnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return <span aria-label={`${count} unread messages`} className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-none text-white shadow-sm">{count > 99 ? "99+" : count}</span>;
}
