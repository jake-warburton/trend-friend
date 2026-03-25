import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { NavBar } from "@/components/nav-bar";
import { SiteFooter } from "@/components/site-footer";
import { AuthProvider } from "@/components/auth-provider";
import { ProfileProvider } from "@/components/profile-provider";
import {
  createThemeBootstrapScript,
  LIGHT_THEME,
  THEME_COOKIE,
} from "@/lib/settings";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.SIGNAL_EYE_FRONTEND_URL ?? "https://www.signaleye.live"
  ),
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
  },
  twitter: {
    card: "summary_large_image",
    title: "Signal Eye — Trend Intelligence Platform",
    description:
      "Spot emerging trends before they peak. 24+ data sources, real-time scoring, and breakout forecasts.",
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
  const themeBootstrap = createThemeBootstrapScript(THEME_COOKIE);

  return (
    <html className="theme-tech-light" lang="en" suppressHydrationWarning>
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
