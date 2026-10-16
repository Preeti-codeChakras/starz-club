
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SessionTimeout from "@/components/SessionTimeout";
import HomeButton from "@/components/HomeButton";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import StarzChatNotifications from "@/components/StarzChatNotifications";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// NEW: Mobile browser theme color
export const viewport: Viewport = {
  themeColor: "#1565c0",
};

export const metadata: Metadata = {
  title: "Starz Cricket Club WebApp",
  description:
    "Manage player availability, skills, and generate balanced cricket teams.",

  // NEW: PWA and iPhone home-screen support
  applicationName: "Starz Cricket Club",

  appleWebApp: {
    capable: true,
    title: "Starz",
    statusBarStyle: "default",
  },

  icons: {
    icon: [
      {
        url: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },

  openGraph: {
    title: "Starz Cricket Club WebApp",
    description:
      "From player availability and skill ratings to fair and balanced team generation.",
    url: "https://www.starzcricketclub.com",
    siteName: "Starz Cricket Club",
    type: "website",

    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Starz Cricket Club App",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const savedTheme =
                  localStorage.getItem("starz-theme");

                document.documentElement.setAttribute(
                  "data-theme",
                  savedTheme || "starz"
                );
              } catch (_) {}
            `,
          }}
        />
      </head>

      <body className="min-h-full">
        <div className="pride-strip" />

        <SessionTimeout />
<ServiceWorkerRegistration />
<StarzChatNotifications />
        <div
          className="
            fixed
            bottom-5
            left-4
            z-50

            sm:bottom-auto
            sm:left-4
            sm:top-5
          "
        ></div>

        {children}

        <HomeButton />
      </body>
    </html>
  );
}
