"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function OnamBanner() {
  const [showOnam, setShowOnam] =
    useState(false);

  useEffect(() => {
    function updateTheme() {
      const currentTheme =
        document.documentElement.getAttribute(
          "data-theme"
        );

      setShowOnam(
        currentTheme === "onam"
      );
    }

    updateTheme();

    const observer =
      new MutationObserver(
        updateTheme
      );

    observer.observe(
      document.documentElement,
      {
        attributes: true,
        attributeFilter: [
          "data-theme",
        ],
      }
    );

    return () => {
      observer.disconnect();
    };
  }, []);

  if (!showOnam) {
    return null;
  }

  return (
    <section
      className="
        onam-banner
        mx-auto
        mt-5
        max-w-7xl
        px-4

        sm:px-8
      "
    >
      <div
        className="
          overflow-hidden
          rounded-2xl
          border
          border-amber-300/80
          bg-amber-50
          shadow-lg
        "
      >
        <Image
          src="/onam-banner.png"
          alt="Happy Onam celebration for Starz Club with a pookalam and Kerala snake boat"
          width={1468}
          height={522}
          priority
          className="
            h-auto
            w-full
            object-cover
          "
        />
      </div>
    </section>
  );
}
