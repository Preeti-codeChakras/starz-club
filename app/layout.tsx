import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SessionTimeout from "@/components/SessionTimeout";
import HomeButton from "@/components/HomeButton";
import ThemeSwitcher from "@/components/ThemeSwitcher";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Starz Cricket Club WebApp",
  description:
    "Manage player availability, skills, and generate balanced cricket teams.",

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

        <div className="fixed left-3 top-3 z-50">
          <ThemeSwitcher />
        </div>

        {children}

        <HomeButton />
      </body>
    </html>
  );
}
