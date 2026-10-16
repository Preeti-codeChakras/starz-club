"use client";
import Link from "next/link";
import useStarzUnread from "@/components/useStarzUnread";
import StarzUnreadBadge from "@/components/StarzUnreadBadge";
export default function StarzChatHomeLink() {
  const { total } = useStarzUnread();
  return <Link href="/club-chat" aria-label={`Open Starz Messenger${total ? `, ${total} unread messages` : ""}`} className="flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-lg border border-white/30 bg-white/15 px-2 py-2 text-xs font-semibold text-white transition hover:bg-white/25 sm:px-3 sm:text-sm">
    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
    <span className="sm:hidden">Chat</span><span className="hidden sm:inline">Messenger</span><StarzUnreadBadge count={total} />
  </Link>;
}
