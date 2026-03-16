import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import { NavBar } from "@/components/nav-bar";
import { SiteFooter } from "@/components/site-footer";
import { AuthProvider } from "@/components/auth-provider";
import { ProfileProvider } from "@/components/profile-provider";
import {
  createThemeBootstrapScript,
  getThemeClass,
  LIGHT_THEME,
  readThemePreference,
  THEME_COOKIE,
} from "@/lib/settings";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Signal Eye — Trend Intelligence Platform",
    template: "%s | Signal Eye",
  },
  description:
    "Spot emerging trends before they peak. Signal Eye monitors 24+ data sources to surface rising topics, score momentum, and forecast breakouts for founders, creators, and investors.",
  keywords: [
    "trend intelligence",
    "emerging trends",
    "trend tracking",
    "trend forecasting",
    "market signals",
    "breakout topics",
    "trend analysis",
    "signal monitoring",
  ],
  openGraph: {
    type: "website",
    siteName: "Signal Eye",
    title: "Signal Eye — Trend Intelligence Platform",
    description:
      "Spot emerging trends before they peak. 24+ data sources, real-time scoring, and breakout forecasts.",
    locale: "en_US",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Signal Eye dashboard" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Signal Eye — Trend Intelligence Platform",
    description:
      "Spot emerging trends before they peak. 24+ data sources, real-time scoring, and breakout forecasts.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let themeKey = LIGHT_THEME;
  try {
    const cookieStore = await cookies();
    themeKey =
      readThemePreference(cookieStore.get(THEME_COOKIE)?.value) ?? LIGHT_THEME;
  } catch {
    themeKey = LIGHT_THEME;
  }
  const themeClass = getThemeClass(themeKey);
  const themeBootstrap = createThemeBootstrapScript(THEME_COOKIE);

  return (
    <html className={themeClass} lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <AuthProvider>
          <ProfileProvider>
            <NavBar />
            {children}
            <SiteFooter />
          </ProfileProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
