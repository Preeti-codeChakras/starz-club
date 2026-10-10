"use client";

import { useEffect, useState } from "react";

const SIGNATURE = "• Built with ❤️ by Preeti •";
const LETTERS = Array.from(SIGNATURE);

export default function HomeSideSignature() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (count >= LETTERS.length) return;
    const timeout = window.setTimeout(() => setCount((current) => current + 1), 95);
    return () => window.clearTimeout(timeout);
  }, [count]);

  return (
    <aside
      aria-label="Built with love by Preeti"
      className="pointer-events-none fixed right-1 top-1/2 z-30 hidden -translate-y-1/2 items-center justify-center xl:flex"
    >
      <span
        className="whitespace-nowrap text-[16px] font-medium tracking-[0.12em] text-slate-600"
        style={{ writingMode: "vertical-rl", textShadow: "0 1px 2px rgba(255,255,255,.95)" }}
        aria-hidden="true"
      >
        {LETTERS.slice(0, count).join("")}
        <span className="inline-block animate-pulse text-blue-700">▏</span>
      </span>
    </aside>
  );
}
