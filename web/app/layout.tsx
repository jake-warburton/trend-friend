import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import { NavBar } from "@/components/nav-bar";
import { getThemeClass, readThemePreference, THEME_COOKIE } from "@/lib/settings";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal Eye",
  description: "Trend intelligence dashboard for emerging topics.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let themeClass = getThemeClass(readThemePreference(undefined));
  try {
    const cookieStore = await cookies();
    themeClass = getThemeClass(readThemePreference(cookieStore.get(THEME_COOKIE)?.value));
  } catch {
    themeClass = getThemeClass(readThemePreference(undefined));
  }

  return (
    <html className={themeClass} lang="en">
      <body>
        <NavBar />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
