import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import { NavBar } from "@/components/nav-bar";
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
  title: "Signal Eye",
  description: "Trend intelligence dashboard for emerging topics.",
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
          </ProfileProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
